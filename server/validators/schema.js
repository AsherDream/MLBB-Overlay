const { z } = require('zod');

const heroSchema = z.string().min(1, "Hero name cannot be empty");

const playerSchema = z.object({
  name: z.string().default('')
});

const teamSchema = z.object({
  name: z.string().min(1, "Team name cannot be empty"),
  score: z.number().int().min(0).default(0),
  players: z.array(playerSchema).length(5).default([
    { name: '' },
    { name: '' },
    { name: '' },
    { name: '' },
    { name: '' }
  ]),
  picks: z.array(heroSchema).length(5).default(["none", "none", "none", "none", "none"]),
  bans: z.array(heroSchema).length(5).default(["none", "none", "none", "none", "none"])
});

const matchStateSchema = z.object({
  blueTeam: teamSchema,
  redTeam: teamSchema,
  phase: z.enum(["draft", "game", "ended"]).default("draft")
});

const layoutComponentSchema = z.object({
  id: z.string().min(1, 'Component id cannot be empty'),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive()
});

const layoutSchema = z.object({
  backgroundImage: z.string().default(''),
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
