import React, { useRef, useEffect, useState } from 'react';
import {
    PoseLandmarker,
    FilesetResolver,
    DrawingUtils,
    ImageSegmenter,
    NormalizedLandmark
} from '@mediapipe/tasks-vision';
import { determineOrientation } from '../utils/poseHelpers';
import { Button } from 'antd';
import { FullscreenOutlined } from '@ant-design/icons';
import ThreeGrid from './ThreeGrid';
import {
    updateVisibilityHistory,
    getSmoothedVisibility,
    getAdaptiveThreshold,
    getOrientationConfidence,
    drawVisibilityScores,
} from '../utils/poseHelpers';
import { LANDMARK_LABELS, FRONT_VIEW_CONNECTIONS, LEFT_VIEW_CONNECTIONS, RIGHT_VIEW_CONNECTIONS, PersonOrientation } from '../utils/landmarklabels';


const PoseTracker: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null) as React.RefObject<HTMLVideoElement>;
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const [orientation, setOrientation] = useState<PersonOrientation>(PersonOrientation.FRONT);
    const visibilityHistory = useRef<Map<number, number[]>>(new Map());
    const containerRef = useRef<HTMLDivElement>(null);
    const [orientationConfidence, setorientationConfidence] = useState<number | null>(null);
    const [visibleIndices, setVisibleIndices] = useState<number[]>([]);
    const FRAME_INTERVAL = 1000 / 24;
    let lastTime = 0;
    const segmenterRef = useRef<ImageSegmenter | null>(null);
    const rawCanvasRef = useRef<HTMLCanvasElement>(null);
    const SEGMENTATION_INTERVAL = 100;
    const POSE_INTERVAL = 66;
    let lastSegmentTime = 0;
    let lastPoseTime = 0;
    const blendedRef = useRef<ImageData | null>(null);

    const poseResultsRef = useRef<any>(null);
    const segmentResultRef = useRef<any>(null);
    const lastScoreDrawTime = useRef<number>(0);
    const gridCanvasRef = useRef<HTMLCanvasElement>(null);
    const [userPosition, setUserPosition] = useState<[number, number, number]>([0, 0, 0]);
    const backgroundImage = useRef<HTMLImageElement | null>(null);
    const [backgroundReady, setBackgroundReady] = useState(false);
    const [feetY, setFeetY] = useState<[number, number, number]>([0, 0, 0]);
    const [poseState, setPoseState] = useState<PoseState>("searching");
    const lastEstimateRef = useRef(0);
    type PoseState = "searching" | "aligning" | "locked" | "too_far" | "too_close";
    const stabilityStartRef = useRef<number | null>(null);
    const [frozenFeetY, setFrozenFeetY] = useState<[number, number, number] | null>(null);
    type BackgroundMode = 'blank' | 'image' | 'grid';
    const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('blank');
    const [customImage, setCustomImage] = useState<string | null>(null);

    const freezeGridAt = (feet: [number, number, number]) => {
        if (!frozenFeetY) {
            setFrozenFeetY(feet);

        }
    };

    const enterFullscreen = () => {
        const container = containerRef.current;
        if (!container) return;

        if (document.fullscreenElement) {
            document.exitFullscreen();

        } else {
            container.requestFullscreen?.();

        }
    };
    useEffect(() => {
        const img = new Image();
        img.src = '/assets/bridge.jpeg';

        img.onload = () => {
            backgroundImage.current = img;
            setBackgroundReady(true);

        };

        img.onerror = () => {
            console.error('❌ Failed to load image:', img.src);
        };
    }, []);
    const drawBackgroundCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
        const canvasAspect = ctx.canvas.width / ctx.canvas.height;
        const imgAspect = img.width / img.height;

        let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

        if (imgAspect > canvasAspect) {
            const newWidth = img.height * canvasAspect;
            sx = (img.width - newWidth) / 2;
            sWidth = newWidth;
        } else {
            const newHeight = img.width / canvasAspect;
            sy = (img.height - newHeight) / 2;
            sHeight = newHeight;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, ctx.canvas.width, ctx.canvas.height);
    };
    function estimateFloorYFromSegmentation(mask: Uint8Array, width: number, height: number): number | null {
        const personLabels = new Set([1, 2, 3, 4]);
        const threshold = width * 0.05;

        for (let row = height - 1; row >= 0; row--) {
            let count = 0;
            for (let col = 0; col < width; col++) {
                const idx = row * width + col;
                if (personLabels.has(mask[idx])) count++;
            }

            if (count > threshold) {
                // Found floor row!
                const normalizedY = row / height;
                const worldY = (0.5 - normalizedY) * 5;
                return worldY;
            }
        }

        return null; // Not found
    }

    const processVideo = async (timestamp: number) => {
        if (timestamp - lastTime < FRAME_INTERVAL) {
            animationFrameRef.current = requestAnimationFrame(processVideo);
            return;
        }
        lastTime = timestamp;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d', { willReadFrequently: true });
        if (!video || !canvas || !ctx || !poseLandmarkerRef.current || !segmenterRef.current) {
            animationFrameRef.current = requestAnimationFrame(processVideo);
            return;
        }

        const now = performance.now();


        if (now - lastPoseTime > POSE_INTERVAL) {
            poseResultsRef.current = poseLandmarkerRef.current.detectForVideo(video, now);
            lastPoseTime = now;
        }


        let segmentationResult = null;

        if (now - lastSegmentTime > SEGMENTATION_INTERVAL) {
            segmentationResult = await segmenterRef.current.segmentForVideo(video, now);
            segmentResultRef.current = segmentationResult;
            lastSegmentTime = now;
        } else {
            segmentationResult = segmentResultRef.current;
        }

        // === Blending (segmentation) ===
        const rawCtx = rawCanvasRef.current?.getContext('2d', { willReadFrequently: true });
        const mask = segmentationResult?.categoryMask?.getAsUint8Array();

        const results = poseResultsRef.current;

        let personPixelCount = 0;
        const landmarkPixelSet = new Set<number>();

        if (results?.landmarks?.length > 0) {
            const points = results.landmarks[0];

            for (let i = 0; i < points.length; i++) {
                const pt = points[i];

                const vis = getSmoothedVisibility(visibilityHistory.current, i);
                const minThreshold = getAdaptiveThreshold(i);
                if (vis < minThreshold * 0.75) continue;

                const x = Math.floor(pt.x * canvas.width);
                const y = Math.floor(pt.y * canvas.height);

                const radius = 10;

                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;


                        if (dx * dx + dy * dy > radius * radius) continue;

                        if (nx >= 0 && nx < canvas.width && ny >= 0 && ny < canvas.height) {
                            const index = ny * canvas.width + nx;
                            landmarkPixelSet.add(index);
                        }
                    }
                }
            }
        }

        if (rawCtx && segmentationResult?.categoryMask && mask) {


            rawCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const original = rawCtx.getImageData(0, 0, canvas.width, canvas.height);


            if (
                !blendedRef.current ||
                blendedRef.current.width !== canvas.width ||
                blendedRef.current.height !== canvas.height
            ) {
                blendedRef.current = ctx.createImageData(canvas.width, canvas.height);
            }
            const blended = blendedRef.current;

            // Step 3: Draw background image
            // const bgImg = backgroundImage.current;
            // if (bgImg && bgImg.width > 0 && bgImg.height > 0) {
            //     drawBackgroundCover(ctx, bgImg);

            // } else {
            //     ctx.fillStyle = '#222';
            //     ctx.fillRect(0, 0, canvas.width, canvas.height);
            // }
            // const bgImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
            // Step 4: Blend only person pixels from original image into the blended buffer

            for (let i = 0; i < mask.length; i++) {
                const offset = i * 4;

                const isSegmentPerson = [1, 2, 3, 4].includes(mask[i]);
                const isLandmarkBoosted = landmarkPixelSet.has(i);

                if (isSegmentPerson || isLandmarkBoosted) {
                    blended.data[offset] = original.data[offset];
                    blended.data[offset + 1] = original.data[offset + 1];
                    blended.data[offset + 2] = original.data[offset + 2];
                    blended.data[offset + 3] = 255;
                    personPixelCount++;
                } else {
                    blended.data[offset] = 0;
                    blended.data[offset + 1] = 0;
                    blended.data[offset + 2] = 0;
                    blended.data[offset + 3] = 0;
                }
            }


            if (personPixelCount > 1000) {
                ctx.putImageData(blended, 0, 0);
            }
            if (personPixelCount < 1000) return;

            const results = poseResultsRef.current;
            if (results?.landmarks?.length > 0 && personPixelCount > 1000) {
                const faceIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
                const facePoints = faceIndices.map(i => results.landmarks[0][i]);

                const padding = 20;
                const minX = Math.max(0, Math.min(...facePoints.map(p => p.x)) * canvas.width - padding);
                const maxX = Math.min(canvas.width, Math.max(...facePoints.map(p => p.x)) * canvas.width + padding);
                const minY = Math.max(0, Math.min(...facePoints.map(p => p.y)) * canvas.height - padding);
                const maxY = Math.min(canvas.height, Math.max(...facePoints.map(p => p.y)) * canvas.height + padding);

                const width = Math.max(1, maxX - minX);
                const height = Math.max(1, maxY - minY);

                const faceData = ctx.getImageData(minX, minY, width, height);
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
                const tempCtx = tempCanvas.getContext('2d')!;
                tempCtx.putImageData(faceData, 0, 0);
                tempCtx.filter = 'blur(8px)';
                tempCtx.drawImage(tempCanvas, 0, 0);
                const blurredFace = tempCtx.getImageData(0, 0, width, height);
                ctx.putImageData(blurredFace, minX, minY);
            }

            segmentationResult.categoryMask.close();
        }


        // === Pose Landmark Drawing ===
        if (results?.landmarks?.length > 0 && personPixelCount > 1000) {
            const landmark = results.landmarks[0];


            const leftFoot = landmark[31];
            const rightFoot = landmark[32];

            if (leftFoot && rightFoot && leftFoot.visibility > 0.5 && rightFoot.visibility > 0.5) {

                const avgX = (leftFoot.x + rightFoot.x) / 2;
                const avgY = (leftFoot.y + rightFoot.y) / 2;
                const avgZ = leftFoot.z ?? 0;
                const worldX = (avgX - 0.5) * 3;
                const worldY = (0.5 - avgY) * 20;
                const worldZ = -avgZ * 6;

                const feetPosition: [number, number, number] = [worldX, worldY, worldZ];
                if (frozenFeetY == null) {
                    setFeetY(feetPosition);
                }
            }



            const midX = (landmark[23].x + landmark[24].x) / 2;
            const midY = (landmark[23].y + landmark[24].y) / 2;
            const poseZ = landmark[23].z ?? 0;

            const mappedX = (midX - 0.5) * 3;
            const mappedY = (0.5 - midY) * 5;
            const mappedZ = -poseZ * 4;

            setUserPosition([mappedX, mappedY, mappedZ]);


            updateVisibilityHistory(visibilityHistory.current, landmark);

            const currentOrientation = determineOrientation(landmark);
            const orientationConfidence = getOrientationConfidence(visibilityHistory.current, landmark);
            setOrientation(currentOrientation);
            setorientationConfidence(orientationConfidence);


            const connections =
                currentOrientation === PersonOrientation.LEFT
                    ? LEFT_VIEW_CONNECTIONS
                    : currentOrientation === PersonOrientation.RIGHT
                        ? RIGHT_VIEW_CONNECTIONS
                        : FRONT_VIEW_CONNECTIONS;


            const EXCLUDED_FACE_INDICES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);


            const maskedLandmarks = landmark.map((point: NormalizedLandmark, index: number) =>
                EXCLUDED_FACE_INDICES.has(index)
                    ? { ...point, visibility: 0, x: 0, y: 0, z: 0 }
                    : point
            );

            const requiredIndices = new Set<number>();
            connections.forEach(({ start, end }) => {
                requiredIndices.add(start);
                requiredIndices.add(end);
            });

            setVisibleIndices(Array.from(requiredIndices));

            const allVisible = Array.from(requiredIndices).every((index) =>
                getSmoothedVisibility(visibilityHistory.current, index) >
                getAdaptiveThreshold(index)
            );
            const feetVisible = leftFoot.visibility > 0.5 || rightFoot.visibility > 0.5;
            const allKeypointsVisible = allVisible; // already computed earlier
            const poseDepthZ = userPosition[2];


            const MIN_DEPTH = -1.5;
            const MAX_DEPTH = -4.5;

            if (!feetVisible) {
                setPoseState("too_close");
                stabilityStartRef.current = null;
            }
            else if (allKeypointsVisible) {
                setPoseState("aligning");

                if (stabilityStartRef.current === null) {
                    stabilityStartRef.current = Date.now();
                } else if (Date.now() - stabilityStartRef.current > 1000) {
                    setPoseState("locked");
                    freezeGridAt(feetY);
                }
            }
            else if (poseDepthZ > MIN_DEPTH) {
                setPoseState("too_close");
                stabilityStartRef.current = null;
            } else if (poseDepthZ < MAX_DEPTH) {
                setPoseState("too_far");
                stabilityStartRef.current = null;
            } else {
                stabilityStartRef.current = null;
            }


            const drawLandmarkPoint = (point: NormalizedLandmark) => {
                const x = Math.floor(point.x * canvas.width);
                const y = Math.floor(point.y * canvas.height);
                const index = y * canvas.width + x;
                if (!mask || ![1, 2, 3, 4].includes(mask[index])) return;

                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = '#00ffff';
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur = 10;
                ctx.fill();
                ctx.shadowBlur = 0;
            };

            const drawConnectorLine = (p1: NormalizedLandmark, p2: NormalizedLandmark, idx1: number, idx2: number) => {
                const x1 = Math.floor(p1.x * canvas.width);
                const y1 = Math.floor(p1.y * canvas.height);
                const x2 = Math.floor(p2.x * canvas.width);
                const y2 = Math.floor(p2.y * canvas.height);

                const isInside = (x: number, y: number) => x >= 0 && x < canvas.width && y >= 0 && y < canvas.height;
                if (!isInside(x1, y1) || !isInside(x2, y2)) return;

                const pixelIndex1 = y1 * canvas.width + x1;
                const pixelIndex2 = y2 * canvas.width + x2;

                const inMask = (i: number) => [1, 2, 3, 4].includes(mask?.[i] ?? -1);
                const vis1 = getSmoothedVisibility(visibilityHistory.current, idx1);
                const vis2 = getSmoothedVisibility(visibilityHistory.current, idx2);
                const threshold1 = getAdaptiveThreshold(idx1);
                const threshold2 = getAdaptiveThreshold(idx2);

                const allowFallback = vis1 > threshold1 && vis2 > threshold2;

                const drawAnyway =
                    inMask(pixelIndex1) && inMask(pixelIndex2) || allowFallback;

                if (!drawAnyway) return;

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur = 8;
                ctx.stroke();
                ctx.shadowBlur = 0;
            };



            if (allVisible) {
                Array.from(requiredIndices).forEach((index) => {
                    drawLandmarkPoint(maskedLandmarks[index]);
                });
                connections.forEach(({ start, end }) => {
                    drawConnectorLine(maskedLandmarks[start], maskedLandmarks[end], start, end);
                });
            } else {
                Array.from(requiredIndices).forEach((index) => {
                    if (getSmoothedVisibility(visibilityHistory.current, index) > 0.6) {
                        drawLandmarkPoint(maskedLandmarks[index]);
                    }
                });
            }

            // Optional: draw debug visibility scores
            // drawVisibilityScores(ctx, canvas.width, canvas.height, landmark, visibilityHistory.current, requiredIndices, LANDMARK_LABELS);
        }

        animationFrameRef.current = requestAnimationFrame(processVideo);
    }
    useEffect(() => {
        let stream: MediaStream;


        const initialize = async () => {
            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
            );

            poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
                    delegate: 'GPU',
                },
                runningMode: 'VIDEO',
                minPoseDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
                outputSegmentationMasks: false,
            });
            segmenterRef.current = await ImageSegmenter.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite',
                    delegate: 'GPU',
                },
                runningMode: 'VIDEO',
                outputCategoryMask: true,
                outputConfidenceMasks: true,
            });
            stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 },
                audio: false,
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;

                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play();

                    requestAnimationFrame(processVideo);
                };
            }
        };




        initialize();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (poseLandmarkerRef.current) {
                poseLandmarkerRef.current.close();
            }
            if (segmenterRef.current) {
                segmenterRef.current.close();
            }
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [backgroundReady]);

    return (
        <>



            <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '16px' }}>
                    Select Background Mode
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>

                    <Button
                        type={backgroundMode === 'blank' ? 'primary' : 'default'}
                        onClick={() => setBackgroundMode('blank')}
                    >
                        Blank
                    </Button>
                    <Button
                        type={backgroundMode === 'image' ? 'primary' : 'default'}
                        onClick={() => setBackgroundMode('image')}
                    >
                        Image
                    </Button>
                    <Button
                        type={backgroundMode === 'grid' ? 'primary' : 'default'}
                        onClick={() => setBackgroundMode('grid')}
                    >
                        Grid
                    </Button>
                    <label htmlFor="bg-upload" style={{ margin: 0 }}>
                        <input
                            id="bg-upload"
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const url = URL.createObjectURL(file);
                                    setCustomImage(url);
                                    setBackgroundMode('image');
                                }
                            }}
                        />
                        <Button
                            type='default'
                            onClick={() => {
                                document.getElementById('bg-upload')?.click();
                            }}
                        >
                            Choose Image
                        </Button>
                        <Button
                            type='default'
                            disabled={!customImage}
                            onClick={() => {
                                setCustomImage(null);

                            }}
                        >
                            Remove Custom Image
                        </Button>
                    </label>
                </div>
            </div>

            <div
                ref={containerRef}
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '1000px',
                    aspectRatio: '4 / 3',
                    margin: '0 auto',
                    marginBottom: '20px',
                    backgroundColor: '#000',
                }}
            >
                <video
                    ref={videoRef}
                    style={{ display: 'none' }}
                    muted
                    playsInline
                />
                <Button
                    shape="circle"
                    icon={<FullscreenOutlined />}
                    onClick={enterFullscreen}
                    style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        zIndex: 3,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        color: '#fff',
                        border: 'none',
                    }}
                />

                {backgroundMode === 'image' && (<img
                    ref={backgroundImage}
                    src={customImage || '../../assets/bridge.jpeg'}
                    alt="Background"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        zIndex: 0,
                    }}
                />)}
                <ThreeGrid userPosition={userPosition} feetY={frozenFeetY ?? feetY} poseState={poseState} showGrid={backgroundMode === 'grid'} />
                <canvas ref={rawCanvasRef} width={640} height={480} style={{ display: 'none' }} />
                <canvas
                    ref={canvasRef}
                    width={640}
                    height={480}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: 2,
                        objectFit: 'contain',
                    }}
                />

                <div
                    style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        color: '#fff',
                        padding: '5px 10px',
                        borderRadius: '5px',
                        zIndex: 2,
                    }}
                >
                    Orientation: <strong>{orientation}</strong> Confidence: <strong>{(orientationConfidence ?? 0).toFixed(2)}</strong>
                </div>
            </div>
        </>
    );
};

export default PoseTracker;
