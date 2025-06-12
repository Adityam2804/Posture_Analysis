import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRef, useMemo, useEffect } from 'react';

export type Landmark = { x: number; y: number; z: number; visibility?: number };

type Props = {
    poseLandmarks: Landmark[] | null;
    position?: [number, number, number];
    scale?: number;
};

const AVATAR_HEIGHT = 1.6;

const BONE_MAP = [
    { bone: 'mixamorigLeftArm', from: 11, to: 13 },
    { bone: 'mixamorigLeftForeArm', from: 13, to: 15 },
    { bone: 'mixamorigRightArm', from: 12, to: 14 },
    { bone: 'mixamorigRightForeArm', from: 14, to: 16 },
    // { bone: 'mixamorigLeftUpLeg', from: 23, to: 25 },
    // { bone: 'mixamorigLeftLeg', from: 25, to: 27 },
    // { bone: 'mixamorigRightUpLeg', from: 24, to: 26 },
    // { bone: 'mixamorigRightLeg', from: 26, to: 28 },
];

const BONE_FORWARD_MAP: Record<string, THREE.Vector3> = {
    mixamorigLeftArm: new THREE.Vector3(-1, 0, 0),
    mixamorigLeftForeArm: new THREE.Vector3(-1, 0, 0),
    mixamorigRightArm: new THREE.Vector3(1, 0, 0),
    mixamorigRightForeArm: new THREE.Vector3(1, 0, 0),
    // mixamorigLeftUpLeg: new THREE.Vector3(0, 0, -1),
    // mixamorigLeftLeg: new THREE.Vector3(0, 0, -1),
    // mixamorigRightUpLeg: new THREE.Vector3(0, 0, 1),
    // mixamorigRightLeg: new THREE.Vector3(0, 0, 1),
};

export default function AvatarRigged({ poseLandmarks, position = [0, 0, 8], scale = 1.5 }: Props) {
    const { scene } = useGLTF('/Xbot.glb');
    const avatarRef = useRef<THREE.Group>(null);

    const skeleton = useMemo(() => {
        const skinnedMesh = scene.getObjectByProperty('type', 'SkinnedMesh') as THREE.SkinnedMesh;
        return skinnedMesh?.skeleton;
    }, [scene]);

    const initialRotations = useMemo(() => {
        const map: Record<string, THREE.Quaternion> = {};
        skeleton?.bones.forEach((bone) => {
            map[bone.name] = bone.quaternion.clone();
        });
        return map;
    }, [skeleton]);
    useEffect(() => {
        if (!skeleton) return;
        const leftArm = skeleton.getBoneByName('mixamorigLeftArm');
        const rightArm = skeleton.getBoneByName('mixamorigRightArm');
        if (leftArm) leftArm.rotation.z = -Math.PI / 4; // -45 degrees
        if (rightArm) rightArm.rotation.z = Math.PI / 4;
    }, [skeleton]);
    const previousDirs = useRef<Record<string, THREE.Vector3>>({});

    useFrame(() => {
        if (!poseLandmarks || !skeleton) return;

        const landmarkVec = (l: Landmark) => new THREE.Vector3(
            -(l.x - 0.5),
            l.y - 0.5,
            l.z
        );

        const leftHip = landmarkVec(poseLandmarks[23]);
        const rightHip = landmarkVec(poseLandmarks[24]);
        const hipsCenter = new THREE.Vector3().addVectors(leftHip, rightHip).multiplyScalar(0.5);

        const head = landmarkVec(poseLandmarks[0]);
        const foot = landmarkVec(poseLandmarks[27]);
        const bodyHeight = head.distanceTo(foot) || 1;
        const scaleFactor = AVATAR_HEIGHT / bodyHeight;

        for (const { bone, from, to } of BONE_MAP) {
            const b = skeleton.getBoneByName(bone);
            const fromRaw = poseLandmarks[from];
            const toRaw = poseLandmarks[to];
            if (!b || !fromRaw || !toRaw) continue;
            if ((fromRaw.visibility ?? 1) < 0.3 || (toRaw.visibility ?? 1) < 0.3) continue;

            const fromL = landmarkVec(fromRaw).sub(hipsCenter).multiplyScalar(scaleFactor);
            const toL = landmarkVec(toRaw).sub(hipsCenter).multiplyScalar(scaleFactor);
            const dir = new THREE.Vector3().subVectors(toL, fromL).normalize();

            const prev = previousDirs.current[bone] || dir.clone();
            const smoothed = prev.lerp(dir, 0.5);
            previousDirs.current[bone] = smoothed;

            const boneForward = BONE_FORWARD_MAP[bone] || new THREE.Vector3(0, 1, 0);
            const deltaQuat = new THREE.Quaternion().setFromUnitVectors(boneForward.clone().normalize(), smoothed);
            const finalQuat = initialRotations[bone].clone().multiply(deltaQuat);
            b.quaternion.slerp(finalQuat, 0.4);
        }
    });

    return (
        <primitive
            ref={avatarRef}
            object={scene}
            position={position}
            scale={scale}
        />
    );
}

useGLTF.preload('/Xbot.glb');