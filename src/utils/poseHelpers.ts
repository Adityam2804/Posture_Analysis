import { NormalizedLandmark } from "@mediapipe/tasks-vision";

export enum PersonOrientation {
  FRONT = "FRONT",
  LEFT = "LEFT",
  RIGHT = "RIGHT",
}
// Determines the orientation
export const determineOrientation = (
  landmarks: NormalizedLandmark[]
): PersonOrientation => {
  const get = (i: number) => landmarks[i];

  const leftShoulder = get(11);
  const rightShoulder = get(12);
  const leftHip = get(23);
  const rightHip = get(24);

  const leftAnkle = get(27);
  const rightAnkle = get(28);
  const leftHeel = get(29);
  const rightHeel = get(30);
  const leftFoot = get(31);
  const rightFoot = get(32);

  const shouldersVisible =
    leftShoulder?.visibility > 0.7 && rightShoulder?.visibility > 0.7;

  if (shouldersVisible) {
    const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);

    const shoulderZDiff = Math.abs(leftShoulder.z - rightShoulder.z);
    const hipZDiff = Math.abs(leftHip.z - rightHip.z);
    const avgZDiff = (shoulderZDiff + hipZDiff) / 2;

    if (avgZDiff > 0.15) {
      if (leftShoulder.z < rightShoulder.z && leftHip.z < rightHip.z) {
        return PersonOrientation.LEFT;
      }
      if (rightShoulder.z < leftShoulder.z && rightHip.z < leftHip.z) {
        return PersonOrientation.RIGHT;
      }
    }

    const hipsVisible = leftHip?.visibility > 0.5 && rightHip?.visibility > 0.5;

    if (hipsVisible) {
      const hipWidth = Math.abs(rightHip.x - leftHip.x);
      const ratio = shoulderWidth / hipWidth;
      if (ratio > 1.2 || ratio < 0.8) return PersonOrientation.FRONT;
    }

    return PersonOrientation.FRONT;
  }

  if (leftShoulder?.visibility > 0.7 && rightShoulder?.visibility < 0.4) {
    return PersonOrientation.LEFT;
  }
  if (rightShoulder?.visibility > 0.7 && leftShoulder?.visibility < 0.4) {
    return PersonOrientation.RIGHT;
  }

  const feetVisible = [
    leftAnkle,
    rightAnkle,
    leftHeel,
    rightHeel,
    leftFoot,
    rightFoot,
  ].every((lm) => lm?.visibility > 0.5);

  if (feetVisible) {
    const leftDir = leftFoot.x - leftHeel.x;
    const rightDir = rightFoot.x - rightHeel.x;

    if (leftDir < -0.05 && rightDir < -0.05) return PersonOrientation.LEFT;
    if (leftDir > 0.05 && rightDir > 0.05) return PersonOrientation.RIGHT;

    const footGap = Math.abs(leftAnkle.x - rightAnkle.x);
    if (footGap > 0.1) return PersonOrientation.FRONT;
  }

  return PersonOrientation.FRONT;
};
// Tracks last 5 frames of each landmark
export const updateVisibilityHistory = (
  historyMap: Map<number, number[]>,
  landmarks: NormalizedLandmark[],
  maxFrames = 5
) => {
  landmarks.forEach((lm, index) => {
    if (!historyMap.has(index)) {
      historyMap.set(index, []);
    }
    const history = historyMap.get(index)!;
    history.push(lm.visibility ?? 0);
    if (history.length > maxFrames) history.shift();
  });
};
// Gets visbility score using history and scores
export const getSmoothedVisibility = (
  historyMap: Map<number, number[]>,
  index: number
): number => {
  const history = historyMap.get(index) || [];
  if (history.length === 0) return 0;
  return history.reduce((sum, v) => sum + v, 0) / history.length;
};
// Gets a threshold score
export const getAdaptiveThreshold = (index: number): number => {
  const lowThresholdJoints = new Set([13, 14, 15, 16]); // elbows, wrists
  return lowThresholdJoints.has(index) ? 0.4 : 0.6;
};
// Gets orientation confidence
export const getOrientationConfidence = (
  historyMap: Map<number, number[]>,
  landmarks: NormalizedLandmark[]
): number => {
  const values = landmarks.map((lm, index) =>
    getSmoothedVisibility(historyMap, index)
  );
  const sum = values.reduce((a, b) => a + b, 0);
  return values.length ? sum / values.length : 0;
};
// Drawing visbility score in canvas
export const drawVisibilityScores = (
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  landmarks: NormalizedLandmark[],
  historyMap: Map<number, number[]>,
  indices: Set<number>,
  labelMap: Record<number, string>
) => {
  ctx.font = "12px monospace";
  ctx.fillStyle = "#00FFAA";
  ctx.textAlign = "left";

  indices.forEach((index) => {
    const lm = landmarks[index];
    const score = getSmoothedVisibility(historyMap, index);

    if (score > 0.3 && lm.visibility > 0) {
      const x = lm.x * canvasWidth;
      const y = lm.y * canvasHeight;
      ctx.fillText(
        `${labelMap[index] || index}: ${score.toFixed(2)}`,
        x + 5,
        y - 5
      );
    }
  });
};
