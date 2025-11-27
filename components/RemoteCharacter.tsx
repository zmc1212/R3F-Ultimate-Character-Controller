
import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF, Html } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';

const MODEL_URL = "/models/fmale.glb";

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
  // This is required for SkinnedMeshes to function correctly when cloned.
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  
  // Bind animations to the group. The mixer will find the bones inside the clone.
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
    const animName = 
      animation === 'Idle' ? 'Idle' :
      animation === 'Walking' ? 'Walking' :
      animation === 'Run' ? 'Run' : 
      animation === 'Jump' ? 'Jump' : 
      animation === 'RunJump' ? 'RunJump' :
      animation === 'land' ? 'land' : 
      (animation === 'Sitting' || animation === 'Sit') ? 'Sitting' : 'Idle';

    // Fallback logic
    let action = actions[animName] || actions['Idle'];
    
    // Safety check for RunJump
    if (animName === 'RunJump' && !actions['RunJump']) {
        action = actions['Jump'] || actions['Idle'];
    }
    
    // Safety check for Sitting (Try Sit as alias)
    if (animName === 'Sitting' && !actions['Sitting']) {
        if (actions['Sit']) action = actions['Sit'];
        else action = actions['Idle'];
    }
    
    if (action) {
       action.reset().fadeIn(0.2).play();
       if (animName === 'Jump' || animName === 'RunJump' || animName === 'land') {
         action.setLoop(THREE.LoopOnce, 1);
         action.clampWhenFinished = true;
         if (animName === 'RunJump') {
             action.timeScale = 0.6; // Match local slowdown
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
    // Normalize angle to -PI to PI
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    
    group.current.rotation.y += angleDiff * 10 * delta;
  });

  return (
    <group ref={group} dispose={null} scale={0.5}>
       {/* Render the manually cloned scene */}
       <primitive object={clone} />
       
       {/* Name Tag */}
       <Html position={[0, 2.2, 0]} center>
          <div className="bg-black/50 backdrop-blur-sm border border-white/20 px-2 py-0.5 rounded text-[10px] text-white font-mono whitespace-nowrap">
              {name}
          </div>
       </Html>
    </group>
  );
};
