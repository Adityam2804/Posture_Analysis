export enum PersonOrientation {
  FRONT = "FRONT",
  LEFT = "LEFT",
  RIGHT = "RIGHT",
}
export const LANDMARK_LABELS: Record<number, string> = {
  0: "Nose",
  1: "Left Eye (Inner)",
  2: "Left Eye",
  3: "Left Eye (Outer)",
  4: "Right Eye (Inner)",
  5: "Right Eye",
  6: "Right Eye (Outer)",
  7: "Left Ear",
  8: "Right Ear",
  9: "Mouth (Left)",
  10: "Mouth (Right)",
  11: "Left Shoulder",
  12: "Right Shoulder",
  13: "Left Elbow",
  14: "Right Elbow",
  15: "Left Wrist",
  16: "Right Wrist",
  17: "Left Pinky",
  18: "Right Pinky",
  19: "Left Index",
  20: "Right Index",
  21: "Left Thumb",
  22: "Right Thumb",
  23: "Left Hip",
  24: "Right Hip",
  25: "Left Knee",
  26: "Right Knee",
  27: "Left Ankle",
  28: "Right Ankle",
  29: "Left Heel",
  30: "Right Heel",
  31: "Left Foot Index",
  32: "Right Foot Index",
};
export const FRONT_VIEW_CONNECTIONS = [
  { start: 11, end: 12 },
  { start: 11, end: 13 },
  { start: 13, end: 15 },
  { start: 12, end: 14 },
  { start: 14, end: 16 },
  { start: 11, end: 23 },
  { start: 12, end: 24 },
  { start: 23, end: 24 },
  { start: 23, end: 25 },
  { start: 25, end: 27 },
  { start: 24, end: 26 },
  { start: 26, end: 28 },
];

export const LEFT_VIEW_CONNECTIONS = [
  { start: 11, end: 13 },
  { start: 13, end: 15 },
  { start: 11, end: 23 },
  { start: 23, end: 25 },
  { start: 25, end: 27 },
];

export const RIGHT_VIEW_CONNECTIONS = [
  { start: 12, end: 14 },
  { start: 14, end: 16 },
  { start: 12, end: 24 },
  { start: 24, end: 26 },
  { start: 26, end: 28 },
];
export const BACK_VIEW_CONNECTIONS = FRONT_VIEW_CONNECTIONS;
export const CRITICAL_JOINTS = {
  FRONT: new Set([11, 12, 23, 24, 25, 26, 27, 28]), // Shoulders to ankles
  LEFT: new Set([11, 13, 15, 23, 25, 27]),
  RIGHT: new Set([12, 14, 16, 24, 26, 28]),
};
