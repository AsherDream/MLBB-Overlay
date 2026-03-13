const { z } = require('zod');

// 1. Atom Schema (The individual UI components)
const componentSchema = z.object({
  instanceId: z.string(),
  atom: z.enum([
    'T1_NAME', 'T1_SCORE', 'T1_PLAYER_NAME', 'T1_PICK', 'T1_BAN', 'T1_LOGO',
    'T2_NAME', 'T2_SCORE', 'T2_PLAYER_NAME', 'T2_PICK', 'T2_BAN', 'T2_LOGO',
    'MAP', 'CUSTOM_TEXT', 'CUSTOM_IMAGE'
  ]),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  zIndex: z.number().default(1),
  bind: z.object({
    idx: z.number().optional(), // Maps to array index 0-9
  }).optional(),
  // Diagonal Masking
  maskPoints: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
  // Panning/Zoom for "Focus Mode"
  crop: z.object({ x: z.number(), y: z.number(), scale: z.number() }).default({ x: 0, y: 0, scale: 1 })
});

// 2. Flexible Match State Schema
const matchStateSchema = z.object({
  blueTeam: z.object({
    name: z.string().default('TEAM BLUE'),
    score: z.number().min(0).default(0),
    players: z.array(z.string()).default(['', '', '', '', '']),
    picks: z.array(z.string()).max(5).default([]), // Dynamic 1-by-1 entry
    bans: z.array(z.string()).max(10).default([]), // Flexible ban count
    logo: z.string().default('default_logo.png'),
  }).default({}),
  redTeam: z.object({
    name: z.string().default('TEAM RED'),
    score: z.number().min(0).default(0),
    players: z.array(z.string()).default(['', '', '', '', '']),
    picks: z.array(z.string()).max(5).default([]),
    bans: z.array(z.string()).max(10).default([]),
    logo: z.string().default('default_logo.png'),
  }).default({}),
  map: z.string().default('The Land of Dawn'),
  phase: z.enum(['draft', 'game', 'ended']).default('draft'),
  activeLayout: z.string().default('testing'),
});

// 3. Layout Schema
const layoutSchema = z.object({
  name: z.string(),
  background: z.string().default('default_bg.jpg'),
  frame: z.string().default('master_frame.png'),
  components: z.array(componentSchema).default([]),
});

module.exports = { matchStateSchema, layoutSchema, componentSchema };