import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useRef } from "react";
import { Text } from "@react-three/drei";
import { useSpring, animated } from '@react-spring/three';
import { OrbitControls } from "@react-three/drei";
type ThreeGridProps = {
    userPosition: [number, number, number];
    feetY: [number, number, number]; // <- NEW: Y coordinate of feet in world space
    poseState: "searching" | "aligning" | "locked" | "too_far" | "too_close";
    showGrid: boolean;
};
const GridTunnel = () => {
    const rects = [];
    const depth = 10;
    const spacing = 2;

    for (let i = 1; i <= depth; i++) {
        const size = i * 2;
        rects.push(
            <lineSegments key={i} position={[0, 0, -i * spacing]}>
                <edgesGeometry attach="geometry" args={[new THREE.PlaneGeometry(size, size)]} />
                <lineBasicMaterial color="#00ffff" />
            </lineSegments>
        );
    }

    return <group>{rects}</group>;
};

const GridFloor = ({ y, poseState }: { y: [number, number, number], poseState: string }) => {
    const color = poseState === "locked" ? "cyan" : poseState === "aligning" ? "yellow" : "#555";
    return (
        <gridHelper args={[40, 40, color, color]} rotation={[0, 0, 0]} position={y} />
    );
};
const ResizeCamera = () => {
    const { camera, size } = useThree();

    useEffect(() => {
        // Only set aspect if camera is a PerspectiveCamera
        if ((camera as THREE.Camera).type === "PerspectiveCamera") {
            (camera as THREE.PerspectiveCamera).aspect = size.width / size.height;
            (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
        }
    }, [camera, size]);

    return null;
};

const ThreeGrid = ({ userPosition, feetY, poseState, showGrid }: ThreeGridProps) => {
    return (
        showGrid ? (
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    zIndex: 1,
                    pointerEvents: "none",
                }}
            >
                <Canvas
                    camera={{ position: [0, 2, 10], fov: 75 }}
                    style={{ background: "transparent" }}
                >
                    <ResizeCamera />
                    <ambientLight intensity={0.4} />
                    <GridFloor y={feetY} poseState={poseState} />
                    {/* <GridTunnel /> */}

                    {['too_close', 'too_far', 'aligning'].includes(poseState) && (
                        <>
                            {[-4, -2, 0, 2, 4].map((x) => {
                                if (poseState === 'too_close') {
                                    return <ArrowTrail key={`back-${x}`} direction="backward" x={x} userZ={userPosition[2]} />;
                                }
                                if (poseState === 'too_far') {
                                    return <ArrowTrail key={`for-${x}`} direction="forward" x={x} userZ={userPosition[2]} />;
                                }
                                if (poseState === 'aligning') {
                                    return (
                                        <>
                                            <ArrowTrail key={`back-${x}`} direction="backward" x={x} userZ={userPosition[2]} />
                                            <ArrowTrail key={`for-${x}`} direction="forward" x={x} userZ={userPosition[2]} />
                                        </>
                                    );
                                }
                                return null;
                            })}
                        </>
                    )}

                    <UserMarker position={userPosition} />
                    {poseState === 'too_close' && (
                        <Text
                            position={[-6, 2.5, userPosition[2] + 2]}
                            fontSize={0.5}
                            color="orange"
                            anchorX="center"
                            anchorY="middle"
                        >
                            Step Back
                        </Text>
                    )}

                    {poseState === 'too_far' && (
                        <Text
                            position={[0, 2.5, userPosition[2] - 2]}
                            fontSize={0.5}
                            color="lime"
                            anchorX="center"
                            anchorY="middle"
                        >
                            Move Forward
                        </Text>
                    )}

                    {poseState === 'aligning' && (
                        <Text
                            position={[-4, 2.5, userPosition[2] - 2]}
                            fontSize={0.5}
                            color="orange"
                            anchorX="center"
                            anchorY="middle"
                        >
                            Alright
                        </Text>
                    )}

                    {/* <OrbitControls /> // You can enable for dev/debugging */}
                </Canvas>
            </div>
        ) : <></>
    );
};
const FlatArrowShape = ({ color }: { color: string }) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(-0.4, 0.3);
    shape.lineTo(-0.2, 0.3);
    shape.lineTo(-0.2, 0.8);
    shape.lineTo(0.2, 0.8);
    shape.lineTo(0.2, 0.3);
    shape.lineTo(0.4, 0.3);
    shape.lineTo(0, 0); // Close the arrow

    return (
        <mesh>
            <shapeGeometry args={[shape]} />
            <meshStandardMaterial color={color} side={THREE.DoubleSide} />
        </mesh>
    );
};
const ArrowTrail = ({
    direction,
    x,
    userZ,
}: {
    direction: 'forward' | 'backward';
    x: number;
    userZ: number;
}) => {
    const isForward = direction === 'forward';
    const distance = 6;
    const arrowCount = 5;
    const travelRange = distance + 2; // ensure they start offscreen

    const { offset } = useSpring({
        loop: true,
        from: { offset: 0 },
        to: { offset: travelRange },
        config: { duration: 800 },
    });

    return (
        <>
            {[...Array(arrowCount)].map((_, i) => {
                return (
                    <animated.group
                        key={i}
                        position={offset.to((val) => {
                            const zBase = userZ + (isForward ? -1 : 1);
                            const zOffset = (i * 2 - val) * (isForward ? -1 : 1);
                            return [x, 0.01, zBase + zOffset];
                        })}
                        rotation={[Math.PI / 2, isForward ? 0 : Math.PI, 0]}
                    >
                        <FlatArrowShape color={isForward ? 'lime' : 'orange'} />
                    </animated.group>
                );
            })}
        </>
    );
};


const UserMarker = ({ position }: { position: [number, number, number] }) => (
    <mesh position={position}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="cyan" />
    </mesh>
);

export default ThreeGrid;
