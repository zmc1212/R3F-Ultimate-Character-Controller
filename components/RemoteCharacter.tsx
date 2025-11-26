import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF, Html } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';

const MODEL_URL = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Xbot.glb";

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
      animation === 'idle' ? 'idle' :
      animation === 'walk' ? 'walk' :
      animation === 'run' ? 'run' : 
      animation === 'jump' ? 'jump' : 
      animation === 'land' ? 'land' : 'idle';

    const action = actions[animName] || actions['idle'];
    
    if (action) {
       action.reset().fadeIn(0.2).play();
       if (animName === 'jump' || animName === 'land') {
         action.setLoop(THREE.LoopOnce, 1);
         action.clampWhenFinished = true;
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
    <group ref={group} dispose={null}>
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