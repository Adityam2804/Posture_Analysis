import * as tf from "@tensorflow/tfjs";
import { useEffect, useRef } from "react";

export const useVisibilityModel = () => {
  const modelRef = useRef<tf.LayersModel | null>(null);

  useEffect(() => {
    tf.loadLayersModel("/model/model.json").then((model) => {
      modelRef.current = model;
      console.log("✅ Visibility model loaded");
    });
  }, []);

  const predictVisibility = (features: number[]): number => {
    if (!modelRef.current) return 0;
    const input = tf.tensor2d([features]); // shape [1, 4]
    const output = modelRef.current.predict(input) as tf.Tensor;
    const confidence = output.dataSync()[0];
    return confidence; // 0.0 – 1.0
  };

  return predictVisibility;
};
