import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
type ThreeGridProps = {
    userPosition: [number, number, number];
    feetY: [number, number, number]; // <- NEW: Y coordinate of feet in world space
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

const GridFloor = ({ y }: { y: [number, number, number] }) => {
    return (
        <gridHelper args={[40, 40, "#00ffff", "#00ffff"]} rotation={[0, 0, 0]} position={y} />
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
const ThreeGrid = ({ userPosition, feetY }: ThreeGridProps) => {
    return (
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
                <GridFloor y={feetY} />
                <GridTunnel />
                <UserMarker position={userPosition} />
                {/* <OrbitControls /> // You can enable for dev/debugging */}
            </Canvas>
        </div>
    );
};

const UserMarker = ({ position }: { position: [number, number, number] }) => (
    <mesh position={position}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="cyan" />
    </mesh>
);

export default ThreeGrid;
