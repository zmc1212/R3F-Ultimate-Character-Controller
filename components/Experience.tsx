import React, { useState, useRef, useEffect } from 'react';
import { Physics } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { Character } from './Character';
import { RemoteCharacter } from './RemoteCharacter';
import { World } from './World';
import { ControlMode, PlayerData } from '../types';
import * as THREE from 'three';
import { Socket } from 'socket.io-client';

interface ExperienceProps {
  controlMode: ControlMode;
  socket: Socket | null;
  players: Record<string, PlayerData>;
  playerName: string;
}

const TargetMarker = ({ position }: { position: THREE.Vector3 | null }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Mesh>(null);
    
    useFrame((state) => {
        if (!meshRef.current || !ringRef.current || !position) return;
        const time = state.clock.getElapsedTime();
        
        // Bobbing cylinder
        meshRef.current.position.y = 1.0 + Math.sin(time * 5) * 0.2;
        meshRef.current.rotation.y += 0.05;

        // Expanding ring
        const scale = (time * 2) % 1;
        ringRef.current.scale.set(scale, scale, scale);
        const material = ringRef.current.material as THREE.MeshBasicMaterial;
        material.opacity = 1 - scale;
    });

    if (!position) return null;

    return (
        <group position={position}>
            {/* Inner Pointer - Inverted Cone */}
            <mesh ref={meshRef} position={[0, 1.0, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.2, 0.5, 4]} />
                <meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={2} />
            </mesh>
            
            {/* Ground Ring Ripple */}
            <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                <ringGeometry args={[0.3, 0.5, 32]} />
                <meshBasicMaterial color="#00ffcc" transparent opacity={0.5} />
            </mesh>
            
            {/* Glow Light */}
            <pointLight intensity={2} distance={3} color="#00ffcc" decay={2} position={[0, 0.5, 0]} />
        </group>
    );
};

export const Experience: React.FC<ExperienceProps> = ({ controlMode, socket, players, playerName }) => {
  const [targetLocation, setTargetLocation] = useState<THREE.Vector3 | null>(null);

  const handleCharacterUpdate = (data: { x: number; y: number; z: number; rotation: number; animation: string }) => {
      if (socket && socket.connected) {
          socket.emit('move', data);
      }
  };

  const handleFloorClick = (point: THREE.Vector3) => {
    if (controlMode === 'pointToClick') {
      setTargetLocation(point);
    }
  };

  return (
    <>
      {/* Lighting & Atmosphere */}
      <color attach="background" args={['#0a0a0f']} />
      <fog attach="fog" args={['#0a0a0f', 5, 30]} />
      
      <directionalLight
        position={[5, 10, 5]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
      >
        <orthographicCamera attach="shadow-camera" args={[-20, 20, 20, -20]} />
      </directionalLight>
      <ambientLight intensity={0.2} color="#00ffcc" />

      {/* Physics World */}
      <Physics gravity={[0, -9.81, 0]}>
        
        {/* Local Player */}
        <Character 
          controlMode={controlMode} 
          movementTarget={targetLocation}
          onUpdate={handleCharacterUpdate}
          playerName={playerName}
        />

        {/* Remote Players */}
        {Object.entries(players).map(([id, p]) => (
            <RemoteCharacter 
                key={id} 
                position={[p.x, p.y, p.z]} 
                rotation={p.rotation} 
                animation={p.animation} 
                name={p.name}
            />
        ))}

        <World onFloorClick={handleFloorClick} />
      </Physics>

      {/* Visual Effects */}
      <TargetMarker position={targetLocation} />
    </>
  );
};