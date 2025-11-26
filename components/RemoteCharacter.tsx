import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF, Clone } from '@react-three/drei';

const MODEL_URL = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Xbot.glb";

interface RemoteCharacterProps {
  position: [number, number, number];
  rotation: number;
  animation: string;
}

export const RemoteCharacter: React.FC<RemoteCharacterProps> = ({ 
  position, 
  rotation, 
  animation 
}) => {
  const group = useRef<THREE.Group>(null);
  
  // Use useGLTF to get the model data
  const { scene, animations } = useGLTF(MODEL_URL);
  
  // We use the <Clone> component which handles SkinnedMesh cloning correctly
  // without needing manual SkeletonUtils or provoking library version errors.
  
  // Connect animations to the group where the Clone will be mounted
  const { actions } = useAnimations(animations, group);

  // Target values for interpolation
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

  // Smooth interpolation (Linear Interpolation for position, slight dampening for rotation)
  useFrame((state, delta) => {
    if (!group.current) return;

    // Smooth Position
    group.current.position.lerp(targetPosition.current, 10 * delta);

    // Smooth Rotation
    // Shortest path interpolation for angles
    let angleDiff = targetRotation.current - group.current.rotation.y;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    group.current.rotation.y += angleDiff * 10 * delta;
  });

  return (
    <group ref={group} position={position} dispose={null}>
       {/* Use Clone to instantiate independent characters */}
       <Clone object={scene} scale={1} />
       
       {/* Name tag or visual indicator for remote player */}
       <mesh position={[0, 2, 0]}>
         <sphereGeometry args={[0.05, 8, 8]} />
         <meshBasicMaterial color="cyan" />
       </mesh>
    </group>
  );
};