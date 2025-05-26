import React, { useRef, useEffect, useState } from 'react';
import {
    ImageSegmenter,
    FilesetResolver,
} from '@mediapipe/tasks-vision';

const ImageSegmenterDemo: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const rawCanvasRef = useRef<HTMLCanvasElement>(null);
    const outputCanvasRef = useRef<HTMLCanvasElement>(null);
    const [segmenter, setSegmenter] = useState<ImageSegmenter | null>(null);
    const isRunningRef = useRef(false);

    useEffect(() => {
        const initializeSegmenter = async () => {
            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
            );

            const imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite',
                    delegate: 'GPU',
                },
                runningMode: 'VIDEO',
                outputCategoryMask: true,
            });

            setSegmenter(imageSegmenter);
        };

        initializeSegmenter();
    }, []);

    const startSegmentation = async () => {
        const video = videoRef.current;
        const rawCanvas = rawCanvasRef.current;
        const outputCanvas = outputCanvasRef.current;

        if (!segmenter || !video || !rawCanvas || !outputCanvas) return;

        const rawCtx = rawCanvas.getContext('2d');
        const outputCtx = outputCanvas.getContext('2d');
        if (!rawCtx || !outputCtx) return;

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: false,
        });

        video.srcObject = stream;
        await video.play();
        isRunningRef.current = true;

        const processFrame = async () => {
            if (!segmenter || !isRunningRef.current) return;

            const now = performance.now();
            const result = await segmenter.segmentForVideo(video, now);

            rawCtx.drawImage(video, 0, 0, 640, 480);
            const originalFrame = rawCtx.getImageData(0, 0, 640, 480);

            // Blur background on output canvas
            outputCtx.filter = 'blur(5px)';
            outputCtx.drawImage(video, 0, 0, 640, 480);
            outputCtx.filter = 'none';

            if (result?.categoryMask) {
                const maskArray = result.categoryMask.getAsUint8Array();
                const width = result.categoryMask.width;
                const height = result.categoryMask.height;

                const blurredFrame = outputCtx.getImageData(0, 0, width, height);
                const blended = outputCtx.createImageData(width, height);

                for (let i = 0; i < width * height; i++) {
                    const offset = i * 4;
                    const category = maskArray[i];

                    if ([1, 2, 3, 4].includes(category)) {
                        // Person: Use original (unblurred) pixels
                        blended.data[offset] = originalFrame.data[offset];
                        blended.data[offset + 1] = originalFrame.data[offset + 1];
                        blended.data[offset + 2] = originalFrame.data[offset + 2];
                        blended.data[offset + 3] = 255;
                    } else {
                        // Background: Use blurred
                        blended.data[offset] = blurredFrame.data[offset];
                        blended.data[offset + 1] = blurredFrame.data[offset + 1];
                        blended.data[offset + 2] = blurredFrame.data[offset + 2];
                        blended.data[offset + 3] = 255;
                    }
                }

                outputCtx.putImageData(blended, 0, 0);
                result.categoryMask.close();
            }

            requestAnimationFrame(processFrame);
        };

        processFrame();
    };

    const stopSegmentation = () => {
        isRunningRef.current = false;

        if (videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach((track) => track.stop());
            videoRef.current.srcObject = null;
        }
    };

    return (
        <div>
            <h2>🟢 Person Focus with Blurred Background</h2>
            <button onClick={startSegmentation}>Start</button>
            <button onClick={stopSegmentation}>Stop</button>

            <div style={{ position: 'relative', width: 640, height: 480 }}>
                <video
                    ref={videoRef}
                    width={640}
                    height={480}
                    style={{ display: 'none' }}
                    muted
                    playsInline
                />
                <canvas
                    ref={rawCanvasRef}
                    width={640}
                    height={480}
                    style={{ display: 'none' }}
                />
                <canvas
                    ref={outputCanvasRef}
                    width={640}
                    height={480}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        zIndex: 1,
                    }}
                />
            </div>
        </div>
    );
};

export default ImageSegmenterDemo;
