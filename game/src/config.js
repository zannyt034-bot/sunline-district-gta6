// Sunline District — tuning and shared constants for the offline coastal courier sandbox.
// Every name, place and piece of art here is original to this game.

export const STEP = 1 / 60;
export const BEST_KEY = 'sunline-district.best-cash';

export const WORLD = {
  width: 3200,
  height: 2400,
  centerX: 1600,
  centerY: 1200,
  shoreX: 2820,
  beachX: 2680,
  promenadeX: 2564,
  minX: 24,
  minY: 24,
  maxX: 3176,
  maxY: 2376,
};

export const ROADS = {
  vertical: [300, 740, 1180, 1620, 2060, 2500],
  horizontal: [300, 700, 1100, 1500, 1900],
  width: 88,
  sidewalk: 18,
};

export const VIEW = { width: 1280, height: 720 };

export const PLAYER = {
  walkSpeed: 190,
  sprintSpeed: 300,
  radius: 11,
  maxHealth: 100,
  staminaMax: 100,
  staminaDrain: 30,
  staminaRegen: 26,
  regenDelay: 6.5,
  regenRate: 5.5,
  hurtInvuln: 0.55,
};

// A car is described nose-to-tail along its local +x axis. Speeds are world pixels per second.
export const VEHICLE_TYPES = {
  courier: {
    label: 'Sunline Courier',
    length: 112,
    width: 56,
    maxSpeed: 308,
    reverseSpeed: 105,
    accel: 238,
    brake: 520,
    turn: 2.35,
    drag: 0.2,
    paint: ['#e8874f'],
  },
  sedan: {
    label: 'Tide Sedan',
    length: 94,
    width: 48,
    maxSpeed: 348,
    reverseSpeed: 118,
    accel: 286,
    brake: 540,
    turn: 2.85,
    drag: 0.18,
    paint: ['#cf6b52', '#4f8f8b', '#d8c079', '#8974a0', '#b9c7c9'],
  },
  sport: {
    label: 'Sundial GT',
    length: 102,
    width: 46,
    maxSpeed: 430,
    reverseSpeed: 125,
    accel: 370,
    brake: 610,
    turn: 3.1,
    drag: 0.14,
    paint: ['#e0a13b', '#d34f63', '#3f8fc4', '#e7e2d4'],
  },
  taxi: {
    label: 'Gullwing Cab',
    length: 96,
    width: 50,
    maxSpeed: 362,
    reverseSpeed: 112,
    accel: 300,
    brake: 545,
    turn: 2.7,
    drag: 0.18,
    paint: ['#e5b83f'],
  },
  van: {
    label: 'Harbor Van',
    length: 110,
    width: 58,
    maxSpeed: 296,
    reverseSpeed: 100,
    accel: 222,
    brake: 490,
    turn: 2.2,
    drag: 0.22,
    paint: ['#7f9c8d', '#b6a075', '#71849a'],
  },
};

export const VEHICLE = {
  enterRadius: 66,
  exitOffset: 39,
  collisionRadius: 21,
  roadGrip: 1,
  offRoadGrip: 0.58,
  impactShake: 0.8,
};

export const PATROL = {
  maxUnits: 8,
  radius: 19,
  patrolSpeed: 146,
  baseChaseSpeed: 232,
  chaseSpeedPerStar: 20,
  detectBase: 300,
  detectPerStar: 45,
  damage: 17,
  carDamage: 21,
  contactRange: 31,
};

export const PULSE = {
  range: 250,
  halfAngle: 0.62,
  cooldown: 4.2,
  stunSeconds: 3.2,
  maxTargets: 3,
};

export const MISSION = {
  interactRadius: 76,
  markers: {
    pickup: '#5fe3cf',
    drop: '#ffb45e',
  },
};

export const MISSIONS = [
  {
    id: 'pier-nine',
    client: 'Mira Vale',
    pickup: {
      x: 2940,
      y: 1786,
      name: 'Pier Nine Lockup',
      hint: 'A sealed crate waits at the end of the south pier.',
    },
    drop: {
      x: 1420,
      y: 640,
      name: 'Neon Arcade',
      hint: 'Run the crate to the arcade frontage on Bellview Row.',
    },
    deadline: 168,
    reward: 420,
  },
  {
    id: 'cold-store',
    client: 'Ansel Rook',
    pickup: {
      x: 2604,
      y: 760,
      name: 'Marina Cold Store',
      hint: 'Collect the chilled case from the marina promenade.',
    },
    drop: {
      x: 900,
      y: 1570,
      name: 'Bellview Radio',
      hint: 'The radio crew is waiting on the south side of Bellview.',
    },
    deadline: 152,
    reward: 540,
  },
  {
    id: 'lantern',
    client: 'The Lantern Club',
    pickup: {
      x: 1540,
      y: 1038,
      name: 'Civic Archive',
      hint: 'Take the ledger from the archive steps downtown.',
    },
    drop: {
      x: 2940,
      y: 1266,
      name: 'Lantern Light',
      hint: 'Deliver the ledger to the lantern at the end of the north pier.',
    },
    deadline: 142,
    reward: 760,
  },
];

export const DEPOT = { x: 500, y: 1232, name: 'Sunline Dispatch' };

export const PIERS = [
  { x: 2620, y: 1762, w: 420, h: 48, name: 'Pier Nine' },
  { x: 2650, y: 1242, w: 390, h: 48, name: 'Lantern Pier' },
];

export const PARKS = [
  { x: 1688, y: 1168, w: 294, h: 262, name: 'Sunline Common' },
  { x: 820, y: 1984, w: 284, h: 260, name: 'Bellview Green' },
];

export const DISTRICTS = [
  { x: 560, y: 510, text: 'BELLVIEW', color: '#d9c48f' },
  { x: 1360, y: 940, text: 'CIVIC ROW', color: '#d9c48f' },
  { x: 2260, y: 1650, text: 'HARBORLINE', color: '#d9c48f' },
  { x: 510, y: 1860, text: 'WESTLINE', color: '#d9c48f' },
];

export const PALETTE = {
  ink: '#081014',
  deepWater: '#0a2831',
  water: '#12434c',
  waterLight: '#1b5c61',
  foam: '#cfe9de',
  sand: '#d8b87b',
  sandDark: '#b9955d',
  asphalt: '#262d34',
  asphaltEdge: '#1c2228',
  lane: '#d8bc6e',
  sidewalk: '#505960',
  sidewalkLight: '#626d73',
  curb: '#767f82',
  grass: '#284435',
  grassDark: '#1d3328',
  path: '#8a8067',
  wall: '#3b464d',
  roof: '#2a3339',
  roofLight: '#475259',
  glass: '#76c4bf',
  windowLit: '#ffd287',
  neon: '#ff658f',
  amber: '#ffb45e',
  teal: '#62e2d0',
  cream: '#f5eddc',
  muted: '#a8b0ae',
  danger: '#ff6d5f',
  good: '#7ce0a2',
  shadow: 'rgba(3, 9, 12, 0.34)',
  panel: 'rgba(8, 17, 21, 0.84)',
  panelSolid: '#0b171c',
  panelLine: 'rgba(112, 206, 194, 0.30)',
  HUDInk: '#f4efe1',
};

export const FONT = "'DejaVu Sans', 'Liberation Sans', 'Segoe UI', sans-serif";
export const MONO = "'DejaVu Sans Mono', 'Liberation Mono', monospace";

export const BUILDING_NAMES = [
  'Tide & Tan', 'Morrow Books', 'Blue Heron Cafe', 'Sandpiper Inn',
  'Sunline Savings', 'Palm & Pine', 'Kestrel Hotel', 'Copper Gull',
  'Westline Market', 'Harbor Dental', 'Marlin Freight', 'Civic Annex',
  'Sea Glass Studio', 'The Dry Dock', 'Gullwing Diner', 'Bellview Tailor',
  'Lantern Supply', 'Northstar Radio', 'Pelican Post', 'Coral Bank',
  'Aster Pharmacy', 'Rook & Reed', 'Marina Hardware', 'The Salty Cactus',
  'Sunset Laundry', 'Kite & Anchor', 'Sable Records', 'Cove Printworks',
  'Harborline Fish Co.', 'Meridian Travel', 'Sundeck Apartments', 'The Wren',
  'Civic Archive', 'Bluewater Legal', 'Foghorn Storage', 'Tern Fitness',
];

export const STOP_MESSAGE = {
  busted: 'BUSTED · THE PATROL CLOSED IN',
  lapsed: 'CONTRACT LAPSED · THE CLOCK RAN OUT',
  win: 'SHIFT COMPLETE · SUNLINE IS YOURS',
};
