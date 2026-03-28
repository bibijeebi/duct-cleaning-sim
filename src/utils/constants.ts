import { Color3 } from '@babylonjs/core';

// === COLORS ===
export const COLORS = {
  // Primary palette
  SAFETY_YELLOW: Color3.FromHexString('#FFD700'),
  DARK_BG: Color3.FromHexString('#1A1A1A'),
  DARK_PANEL: Color3.FromHexString('#2D2D2D'),

  // UI text
  TEXT_PRIMARY: '#FFD700',
  TEXT_SECONDARY: '#AAAAAA',
  TEXT_DANGER: '#FF4444',
  TEXT_SUCCESS: '#44FF44',
  TEXT_WHITE: '#FFFFFF',

  // Building materials
  WALL_COLOR: new Color3(0.85, 0.82, 0.78),
  FLOOR_COLOR: new Color3(0.3, 0.3, 0.3),
  CEILING_COLOR: new Color3(0.9, 0.9, 0.88),
  CEILING_TILE: new Color3(0.92, 0.91, 0.88),
  MECHANICAL_FLOOR: new Color3(0.4, 0.42, 0.4),

  // HVAC components
  DUCT_METAL: new Color3(0.6, 0.62, 0.65),
  DUCT_FLEX: new Color3(0.45, 0.45, 0.5),
  DUCT_BOARD: new Color3(0.55, 0.5, 0.4),
  SUPPLY_TINT: new Color3(0.5, 0.55, 0.7),
  RETURN_TINT: new Color3(0.7, 0.5, 0.5),
  REGISTER_COLOR: new Color3(0.7, 0.7, 0.75),
  AIR_HANDLER: new Color3(0.5, 0.52, 0.55),
  VAV_BOX: new Color3(0.55, 0.55, 0.6),

  // Exterior
  PARKING_LOT: new Color3(0.25, 0.25, 0.28),
  VAN_COLOR: new Color3(0.9, 0.9, 0.92),
  GRASS: new Color3(0.25, 0.45, 0.2),

  // Debris levels (interpolate between clean and dirty)
  DEBRIS_CLEAN: new Color3(0.6, 0.62, 0.65),
  DEBRIS_DIRTY: new Color3(0.2, 0.18, 0.15),
} as const;

// === PHYSICS ===
export const PHYSICS = {
  GRAVITY: -9.81 / 60,
  PLAYER_HEIGHT: 1.7,
  PLAYER_RADIUS: 0.4,
  PLAYER_SPEED: 0.3,
  PLAYER_ANGULAR_SENSIBILITY: 2000,
  CAMERA_MIN_Z: 0.1,
  INTERACTION_DISTANCE: 3.0,
} as const;

// === BUILDING DIMENSIONS ===
export const BUILDING = {
  WALL_HEIGHT: 3.0,
  WALL_THICKNESS: 0.2,
  CEILING_HEIGHT: 2.9,
  CEILING_TILE_SIZE: 0.6,
  CEILING_TILE_THICKNESS: 0.02,
  DOOR_WIDTH: 1.0,
  DOOR_HEIGHT: 2.2,
  REGISTER_WIDTH: 0.6,
  REGISTER_DEPTH: 0.3,
  REGISTER_THICKNESS: 0.05,
  DUCT_TRUNK_WIDTH: 0.6,
  DUCT_TRUNK_HEIGHT: 0.4,
  DUCT_BRANCH_WIDTH: 0.3,
  DUCT_BRANCH_HEIGHT: 0.25,
  ACCESS_HOLE_SMALL: 0.025,  // 1 inch in meters
  ACCESS_HOLE_LARGE: 0.2,    // 8 inches in meters
  MAX_DUCT_RUN_BEFORE_ACCESS: 3.66, // 12 feet in meters
} as const;

// === SCORING ===
export const SCORING = {
  STARTING_SCORE: 100,
  GRADE_THRESHOLDS: {
    'A+': 95,
    'A': 90,
    'A-': 85,
    'B+': 80,
    'B': 75,
    'B-': 70,
    'C+': 65,
    'C': 60,
    'C-': 55,
    'D': 50,
    'F': 0,
  },
} as const;

// === TIMING ===
export const TIMING = {
  PHASE_TRANSITION_DELAY: 2000,  // ms
  INTERACTION_COOLDOWN: 500,      // ms
  PROBLEM_CHECK_INTERVAL: 30000,  // ms - check for random events
} as const;

// === UI ===
export const UI = {
  FONT_FAMILY: 'monospace',
  TITLE_FONT_SIZE: 24,
  HUD_FONT_SIZE: 16,
  PROMPT_FONT_SIZE: 14,
  CROSSHAIR_SIZE: 20,
} as const;
