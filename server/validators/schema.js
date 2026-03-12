const { z } = require('zod');

const heroSchema = z.string().min(1, "Hero name cannot be empty");

const playerSchema = z.string().default('');

const teamSchema = z.object({
  name: z.string().min(1, "Team name cannot be empty"),
  score: z.number().int().min(0).default(0),
  players: z.array(playerSchema).length(5).default([
    '', '', '', '', ''
  ]),
  picks: z.array(heroSchema).length(5).default(["none", "none", "none", "none", "none"]),
  bans: z.array(heroSchema).length(5).default(["none", "none", "none", "none", "none"])
});

const matchStateSchema = z.object({
  blueTeam: teamSchema,
  redTeam: teamSchema,
  map: z.string().default('none'),
  mapType: z.string().default('none'),
  activeLayout: z.string().default('default_draft'),
  phase: z.enum(["draft", "game", "ended"]).default("draft")
});

const layoutComponentSchema = z.preprocess((val) => {
  if (!val || typeof val !== 'object') return val;
  const v = val;
  if (typeof v.width !== 'number' && typeof v.w === 'number') v.width = v.w;
  if (typeof v.height !== 'number' && typeof v.h === 'number') v.height = v.h;
  return v;
}, z.union([
  // Legacy shape (id/type driven)
  z.object({
    id: z.string().min(1, 'Component id cannot be empty'),
    type: z.enum(['text', 'image']).default('text'),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    visible: z.boolean().optional().default(true),
    locked: z.boolean().optional().default(false),
    alias: z.string().optional().default(''),
    zIndex: z.number().int().optional(),
    src: z.string().optional().default('')
  }),

  // New component-driven shape (atom + bind driven)
  z.object({
    instanceId: z.string().min(1, 'instanceId cannot be empty'),
    atom: z.string().min(1, 'atom cannot be empty'),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    visible: z.boolean().optional().default(true),
    locked: z.boolean().optional().default(false),
    alias: z.string().optional().default(''),
    zIndex: z.number().int().optional(),
    src: z.string().optional().default(''),
    bind: z.object({}).passthrough().optional().default({})
  })
]));

const layoutSchema = z.object({
  name: z.string().default(''),
  background: z.string().default(''),
  frame: z.string().default(''),
  components: z.array(layoutComponentSchema).default([])
});

module.exports = {
  matchStateSchema,
  teamSchema,
  heroSchema,
  playerSchema,
  layoutSchema,
  layoutComponentSchema
};
