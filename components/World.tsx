import React from 'react';
import { RigidBody } from '@react-three/rapier';
import { Box } from '@react-three/drei';
import * as THREE from 'three';

interface WorldProps {
  onFloorClick?: (point: THREE.Vector3) => void;
}

export const World: React.FC<WorldProps> = ({ onFloorClick }) => {
  return (
    <group>
      {/* Floor */}
      <RigidBody type="fixed" friction={2}>
        <mesh 
          receiveShadow 
          position={[0, 0, 0]} 
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            if (onFloorClick) onFloorClick(e.point);
          }}
        >
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </RigidBody>

      {/* Grid Pattern */}
      <gridHelper args={[100, 50, 0x666666, 0x444444]} position={[0, 0.01, 0]} />

      {/* Obstacles */}
      <RigidBody type="fixed" position={[5, 1, 5]}>
        <Box args={[2, 2, 2]} castShadow receiveShadow>
          <meshStandardMaterial color="#ff6b6b" />
        </Box>
      </RigidBody>

      <RigidBody type="fixed" position={[-5, 0.5, 2]}>
         <Box args={[4, 1, 4]} castShadow receiveShadow>
          <meshStandardMaterial color="#4ecdc4" />
        </Box>
      </RigidBody>
      
      <RigidBody type="fixed" position={[0, 1.5, -8]} rotation={[0, Math.PI / 4, 0]}>
         <Box args={[10, 3, 1]} castShadow receiveShadow>
          <meshStandardMaterial color="#ffe66d" />
        </Box>
      </RigidBody>

      {/* Steps */}
       <group position={[-8, 0, -8]}>
        <RigidBody type="fixed" position={[0, 0.5, 0]}>
            <Box args={[2, 1, 2]} receiveShadow><meshStandardMaterial color="#666" /></Box>
        </RigidBody>
        <RigidBody type="fixed" position={[2, 1, 0]}>
            <Box args={[2, 2, 2]} receiveShadow><meshStandardMaterial color="#777" /></Box>
        </RigidBody>
        <RigidBody type="fixed" position={[4, 1.5, 0]}>
            <Box args={[2, 3, 2]} receiveShadow><meshStandardMaterial color="#888" /></Box>
        </RigidBody>
       </group>

    </group>
  );
};