import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRM, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { Pose } from 'kalidokit';
import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import {
    FRONT_VIEW_CONNECTIONS,
    LEFT_VIEW_CONNECTIONS,
    RIGHT_VIEW_CONNECTIONS,
    PersonOrientation,
} from '../utils/landmarklabels';

type Props = {
    poseWorldLandmarks: NormalizedLandmark[] | null | undefined;
    poseLandmarks: NormalizedLandmark[] | null | undefined;
    fullVisible?: boolean;
    orientation?: PersonOrientation;
    gender: 'male' | 'female';
};

export default function AvatarFromPose({ poseWorldLandmarks, poseLandmarks, fullVisible, orientation = PersonOrientation.FRONT, gender }: Props) {
    return (
        <div style={{ position: 'absolute', top: 25, left: 0, width: '100%', zIndex: 5, aspectRatio: '4/3', margin: '0 auto', }}>

            <Canvas camera={{ position: [0, 1.5, 2.5], fov: 35 }}>
                <ambientLight />
                <directionalLight position={[0, 2, 2]} intensity={1} />

                <VRMAvatar poseWorldLandmarks={poseWorldLandmarks} poseLandmarks={poseLandmarks} fullVisible={fullVisible} orientation={orientation} gender={gender} />
            </Canvas>
        </div>
    );
}
// function logBones(vrm: VRM) {
//     vrm.scene.traverse((object) => {

//         console.log(object.name);

//     });
// }
function VRMAvatar({ poseWorldLandmarks, poseLandmarks, fullVisible, orientation, gender }: Props) {
    const vrmRef = useRef<VRM | null>(null);
    const clock = useRef(new THREE.Clock());
    const [loaded, setLoaded] = useState(false);
    const markersRef = useRef<THREE.Object3D[]>([]);
    const BoneNameMap: Record<string, string> = {
        Hips: 'CC_Base_Hip',
        Spine: 'CC_Base_Spine01',
        Chest: 'CC_Base_Spine02',
        Neck: 'CC_Base_NeckTwist01',
        Head: 'CC_Base_Head',

        LeftShoulder: 'CC_Base_L_Clavicle',
        LeftUpperArm: 'CC_Base_L_Upperarm',
        LeftLowerArm: 'CC_Base_L_Forearm',
        LeftHand: 'CC_Base_L_Hand',

        RightShoulder: 'CC_Base_R_Clavicle',
        RightUpperArm: 'CC_Base_R_Upperarm',
        RightLowerArm: 'CC_Base_R_Forearm',
        RightHand: 'CC_Base_R_Hand',

        LeftUpperLeg: 'CC_Base_L_Thigh',
        LeftLowerLeg: 'CC_Base_L_Calf',
        LeftFoot: 'CC_Base_L_Foot',
        LeftToes: 'CC_Base_L_ToeBaseShareBone',

        RightUpperLeg: 'CC_Base_R_Thigh',
        RightLowerLeg: 'CC_Base_R_Calf',
        RightFoot: 'CC_Base_R_Foot',
        RightToes: 'CC_Base_R_ToeBase',

        LeftEye: 'CC_Base_L_Eye',
        RightEye: 'CC_Base_R_Eye',
        Jaw: 'CC_Base_JawRoot',
    };



    const scale = 1.3;
    const yOffset = -1.2;
    const zOffset = 1;
    const EXCLUDED_FACE_INDICES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    function landmarkToVrmCoords(lm: NormalizedLandmark) {
        return new THREE.Vector3(
            (lm.x - 0.5) * scale + 3,
            (1 - lm.y) * scale + yOffset,
            -lm.z * scale + zOffset
        );
    }
    useEffect(() => {
        setLoaded(false);
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));
        const modelUrl = gender == 'male' ? '/avatar-man.vrm' : '/avatar-women.vrm';

        loader.load(modelUrl, (gltf) => {
            const vrm = gltf.userData.vrm as VRM;

            vrm.scene.rotation.y = Math.PI;
            vrmRef.current = vrm;
            setLoaded(true);
        });
    }, [gender]);

    useFrame(() => {
        const time = clock.current.getElapsedTime();
        if (!vrmRef.current || !poseWorldLandmarks || !poseLandmarks) return;

        vrmRef.current.scene.position.set(0, -1.5, -2);
        if (fullVisible) {

            markersRef.current.forEach((marker) => vrmRef.current!.scene.remove(marker));
            markersRef.current = [];



            const group = new THREE.Group();

            poseWorldLandmarks.forEach((lm, index) => {
                if (EXCLUDED_FACE_INDICES.has(index)) return;
                const pos = landmarkToVrmCoords(lm);
                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(0.015),
                    new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false })
                );
                sphere.renderOrder = 999;
                sphere.position.copy(pos);
                group.add(sphere);
            });


            const connectionList = orientation === PersonOrientation.LEFT
                ? LEFT_VIEW_CONNECTIONS
                : orientation === PersonOrientation.RIGHT
                    ? RIGHT_VIEW_CONNECTIONS
                    : FRONT_VIEW_CONNECTIONS;

            connectionList.forEach(({ start, end }) => {
                const startPt = landmarkToVrmCoords(poseWorldLandmarks[start]);
                const endPt = landmarkToVrmCoords(poseWorldLandmarks[end]);

                const geometry = new THREE.BufferGeometry().setFromPoints([startPt, endPt]);
                const line = new THREE.Line(
                    geometry,
                    new THREE.LineBasicMaterial({ color: 0x00ff00, depthTest: false })
                );
                line.renderOrder = 999;
                group.add(line);
            });


            vrmRef.current.scene.add(group);
            markersRef.current.push(group);
        }

        if (!fullVisible) {
            animateRetreatLegs(vrmRef.current, time);
        } else {
            const solved = Pose.solve(poseWorldLandmarks, poseLandmarks, {
                runtime: 'mediapipe',
                enableLegs: true,
            });

            if (poseLandmarks?.[27]?.visibility > 0.9) {
                const targetZ = -poseWorldLandmarks[27].z * 5;
                vrmRef.current.scene.position.z = THREE.MathUtils.lerp(
                    vrmRef.current.scene.position.z, targetZ, 0.1
                );
            }

            if (solved) {
                animatePose(vrmRef.current, solved, BoneNameMap);
            }
        }
    });



    return loaded && vrmRef.current ? <primitive object={vrmRef.current.scene} scale={[-1, 1, 1]} renderOrder={100} /> : null;
}

function animateRetreatLegs(vrm: VRM, time: number) {
    const legSwing = Math.sin(time * 6) * 0.5;
    const headShake = Math.sin(time * 3) * 0.3;

    const rotateBone = (name: string, angleX: number, angleY = 0, angleZ = 0) => {
        const bone = vrm.scene.getObjectByName(name) as THREE.Object3D;
        if (!bone) return;
        const targetQuat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(angleX, angleY, angleZ)
        );
        bone.quaternion.slerp(targetQuat, 0.2);
    };

    // Swing legs
    rotateBone('CC_Base_L_Thigh', -legSwing);
    rotateBone('CC_Base_R_Thigh', legSwing);

    // Shake head
    rotateBone('CC_Base_Head', 0, headShake);
}


function animatePose(vrm: VRM, pose: ReturnType<typeof Pose.solve> | undefined, BoneNameMap: Record<string, string>) {
    if (!pose) return;
    const rigRotation = (name: string, rotation = { x: 0, y: 0, z: 0 }, dampener = 1, lerpAmount = 0.9, overrideVertical = false) => {
        const boneName = BoneNameMap[name];
        const bone = vrm.scene.getObjectByName(boneName) as THREE.Object3D;
        if (!bone) return;
        const euler = new THREE.Euler(
            overrideVertical ? 0 : rotation.x * dampener,
            overrideVertical ? 0 : rotation.y * dampener,
            rotation.z * dampener,
            'XYZ'
        );
        const targetQuat = new THREE.Quaternion().setFromEuler(euler);
        bone.quaternion.slerp(targetQuat, lerpAmount);
    };
    const yaw = pose.Hips?.rotation?.y ?? 0;
    const targetYaw = -yaw + Math.PI;
    vrm.scene.rotation.y = THREE.MathUtils.lerp(vrm.scene.rotation.y, targetYaw, 0.3);
    rigRotation('Hips', pose.Hips.rotation, 0.7, 0.6, true);
    rigRotation('Spine', pose.Spine, 0.45);
    rigRotation('LeftUpperArm', pose.LeftUpperArm);
    rigRotation('LeftLowerArm', pose.LeftLowerArm);
    rigRotation('RightUpperArm', pose.RightUpperArm);
    rigRotation('RightLowerArm', pose.RightLowerArm);
    rigRotation('LeftUpperLeg', pose.LeftUpperLeg);
    rigRotation('LeftLowerLeg', pose.LeftLowerLeg);
    rigRotation('RightUpperLeg', pose.RightUpperLeg);
    rigRotation('RightLowerLeg', pose.RightLowerLeg);
}
