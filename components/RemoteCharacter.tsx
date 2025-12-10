
import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF, Html } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';

const MODEL_URL = "/models/ch42.gltf";

interface RemoteCharacterProps {
  position: [number, number, number];
  rotation: number;
  animation: string;
  name?: string;
}

export const RemoteCharacter: React.FC<RemoteCharacterProps> = ({ 
  position, 
  rotation, 
  animation,
  name = "Unknown"
}) => {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(MODEL_URL);
  
  // Create a unique clone of the character for this instance using SkeletonUtils.
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  
  const { actions } = useAnimations(animations, group);

  // Target values for smooth interpolation
  const targetPosition = useRef(new THREE.Vector3(...position));
  const targetRotation = useRef(rotation);

  // Update targets when props change
  useEffect(() => {
    targetPosition.current.set(...position);
    targetRotation.current = rotation;
  }, [position, rotation]);

  // Handle Animations
  useEffect(() => {
    const animName = animation;

    // Fallback logic
    let action = actions[animName] || actions['Idle'];
    
    // Safety aliases
    if (!action) {
        if (animName === 'Sitting' && actions['Sit']) action = actions['Sit'];
        if (animName === 'Falling' && actions['Fall']) action = actions['Fall'];
        if (animName === 'RunJump' && actions['Jump']) action = actions['Jump'];
        if (animName === 'Flying' && actions['Jump']) action = actions['Jump']; // Fallback for flying
    }
    
    if (action) {
       action.reset().fadeIn(0.2).play();
       
       const isOneShot = 
         animName === 'Jump' || 
         animName === 'RunJump' || 
         animName === 'land' || 
         animName === 'Wave' || 
         animName === 'PickingUp' || 
         animName === 'OpenDoor';

       if (isOneShot) {
         action.setLoop(THREE.LoopOnce, 1);
         action.clampWhenFinished = true;
         if (animName === 'RunJump') {
             action.timeScale = 0.6;
         }
       } else {
         action.timeScale = 1;
       }
    }

    return () => {
      if (action) action.fadeOut(0.2);
    };
  }, [animation, actions]);

  useFrame((state, delta) => {
    if (!group.current) return;

    // Linearly interpolate position to the target
    group.current.position.lerp(targetPosition.current, 10 * delta);

    // Smoothly interpolate rotation
    let angleDiff = targetRotation.current - group.current.rotation.y;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    
    group.current.rotation.y += angleDiff * 10 * delta;

    // Procedural Dance Rotation (Spin) if clip is missing or just for effect
    if (animation === 'Dance') {
        group.current.rotation.y += delta * 5;
    }
  });

  return (
    <group ref={group} dispose={null} scale={1}>
       <primitive object={clone} />
       
       {/* Jetpack Visual for Remote Players if flying */}
       {animation === 'Flying' && (
           <group position={[0, 1.4, -0.25]}>
               <mesh>
                   <boxGeometry args={[0.4, 0.5, 0.2]} />
                   <meshStandardMaterial color="#444" />
               </mesh>
               <group position={[-0.25, -0.6, 0]} rotation={[Math.PI, 0, 0]}>
                   <mesh>
                       <coneGeometry args={[0.1, 0.6, 8]} />
                       <meshBasicMaterial color="#00ffcc" transparent opacity={0.6} />
                   </mesh>
               </group>
               <group position={[0.25, -0.6, 0]} rotation={[Math.PI, 0, 0]}>
                   <mesh>
                       <coneGeometry args={[0.1, 0.6, 8]} />
                       <meshBasicMaterial color="#00ffcc" transparent opacity={0.6} />
                   </mesh>
               </group>
           </group>
       )}
       
       {/* Name Tag */}
       <Html position={[0, 2.2, 0]} center>
          <div className="bg-black/50 backdrop-blur-sm border border-white/20 px-2 py-0.5 rounded text-[10px] text-white font-mono whitespace-nowrap">
              {name}
          </div>
       </Html>
    </group>
  );
};
