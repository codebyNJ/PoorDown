// Pirate Smash — Smash-Karts style arena battler with pirate ships.

export const PLAYER_COLORS = [
  '#FF3B30', '#0A84FF', '#30D158', '#FFD60A',
  '#BF5AF2', '#32D2D0', '#FF9F0A', '#FF375F',
];

export const SHIP_MODELS = [
  'ship-pirate-small', 'ship-pirate-medium', 'ship-pirate-large',
  'ship-small', 'ship-medium', 'ship-large',
];

// Arena
export const ARENA_RADIUS = 70;          // playable circle radius
export const SPAWN_RADIUS = 50;          // distance from center where players spawn
export const OBSTACLE_COUNT = 6;         // inner rocks/islands

// Lives & match
export const LIVES_PER_PLAYER = 3;
export const RESPAWN_DELAY_MS = 3000;
export const COUNTDOWN_MS = 3000;        // 3-2-1 before match
export const POST_KILL_HOLD_MS = 1500;   // pause after match end before winner screen

// Ship motion (Smash-Karts feel: snappy, arcade)
export const SHIP_MAX_SPEED = 26;
export const SHIP_ACCEL = 28;
export const SHIP_TURN_RATE = 2.6;       // rad/sec
export const SHIP_RADIUS = 1.8;          // collision radius
export const PUBLISH_HZ = 14;

// Combat — 1-hit kills, like Smash Karts
export const CANNON_RANGE = 38;
export const CANNON_BALL_SPEED = 70;
export const DEFAULT_CANNON_COOLDOWN_MS = 1100;
export const TRIPLE_FAN_ANGLE = 0.28;    // rad spread between fan shots
export const MORTAR_RANGE = 30;
export const MORTAR_FLIGHT_MS = 900;
export const MORTAR_SPLASH = 6;
export const MINE_LIFETIME_MS = 18_000;
export const MINE_TRIGGER_RADIUS = 2.4;
export const HIT_RADIUS = 2.2;           // cannonball collision
export const BOOST_DURATION_MS = 3000;
export const BOOST_MULT = 1.8;
export const SHIELD_DURATION_MS = 3500;

// Crates
export const CRATE_TYPES = ['triple', 'mortar', 'mine', 'boost', 'shield'];
export const CRATE_MAX = 5;              // simultaneous crates on the map
export const CRATE_SPAWN_INTERVAL_MS = 5500;
export const CRATE_PICKUP_RADIUS = 3.0;

export const WEAPONS = {
  triple: { label: 'Triple Shot',  uses: 1, color: '#FF9F0A' },
  mortar: { label: 'Mortar',       uses: 2, color: '#BF5AF2' },
  mine:   { label: 'Mine',         uses: 2, color: '#32D2D0' },
  boost:  { label: 'Speed Boost',  uses: 1, color: '#30D158' },
  shield: { label: 'Iron Hull',    uses: 1, color: '#0A84FF' },
};

export const PHASE = {
  LOBBY: 'lobby',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  GAME_OVER: 'gameOver',
};
