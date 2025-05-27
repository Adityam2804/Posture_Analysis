import { useRef, useEffect } from "react";
import * as tf from "@tensorflow/tfjs";
import * as depth from "@tensorflow-models/depth-estimation";

export function useDepthEstimator(videoRef: React.RefObject<HTMLVideoElement>) {
  const modelRef = useRef<depth.DepthEstimator | null>(null);

  useEffect(() => {
    const loadModel = async () => {
      await tf.ready();
      const model = await depth.createEstimator(depth.SupportedModels.MiDaS);
      modelRef.current = model;
    };

    loadModel();
  }, []);

  const estimateFloorDepth = async (): Promise<number | null> => {
    const model = modelRef.current;
    const video = videoRef.current;
    if (!model || !video) return null;

    const depthMap = await model.estimateDepth(video);
    const tensor = await depthMap.toTensor(); // shape: [height, width]
    const data = await tensor.data();
    const [height, width] = tensor.shape;

    const floorRows = Math.floor(height * 0.1);
    const floorValues: number[] = [];

    for (let y = height - floorRows; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        floorValues.push(data[idx]);
      }
    }

    const averageDepth =
      floorValues.reduce((sum, v) => sum + v, 0) / floorValues.length;
    tensor.dispose();
    return averageDepth;
  };

  return { estimateFloorDepth };
}
