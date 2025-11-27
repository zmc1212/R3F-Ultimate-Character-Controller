
import React, { useState, useRef, useEffect } from 'react';
import { Physics } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { Character } from './Character';
import { RemoteCharacter } from './RemoteCharacter';
import { World } from './World';
import { ConferenceRoom } from './ConferenceRoom';
import { Chair } from './Furniture';
import { ControlMode, PlayerData } from '../types';
import * as THREE from 'three';
import { Socket } from 'socket.io-client';
import { Environment, useTexture } from '@react-three/drei';

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
        meshRef.current.position.y = 1.0 + Math.sin(time * 5) * 0.2;
        meshRef.current.rotation.y += 0.05;
        const scale = (time * 2) % 1;
        ringRef.current.scale.set(scale, scale, scale);
        const material = ringRef.current.material as THREE.MeshBasicMaterial;
        material.opacity = 1 - scale;
    });

    if (!position) return null;

    return (
        <group position={position}>
            <mesh ref={meshRef} position={[0, 1.0, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.2, 0.5, 4]} />
                <meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={2} />
            </mesh>
            <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                <ringGeometry args={[0.3, 0.5, 32]} />
                <meshBasicMaterial color="#00ffcc" transparent opacity={0.5} />
            </mesh>
            <pointLight intensity={2} distance={3} color="#00ffcc" decay={2} position={[0, 0.5, 0]} />
        </group>
    );
};

export const Experience: React.FC<ExperienceProps> = ({ controlMode, socket, players, playerName }) => {
  const [targetLocation, setTargetLocation] = useState<THREE.Vector3 | null>(null);
  
  // Interaction State
  const [isSitting, setIsSitting] = useState(false);
  const [sitPose, setSitPose] = useState<{ position: THREE.Vector3, rotation: number } | null>(null);
  
  // Track pending interaction (waiting for character to walk to chair)
  const pendingInteraction = useRef<{ type: 'sit', position: THREE.Vector3, rotation: number } | null>(null);

  // Load Environment Map
  const envMap = useTexture('/images/env.png');
  envMap.mapping = THREE.EquirectangularReflectionMapping;
  envMap.colorSpace = THREE.SRGBColorSpace;

  const handleCharacterUpdate = (data: { x: number; y: number; z: number; rotation: number; animation: string }) => {
      if (socket && socket.connected) {
          socket.emit('move', data);
      }
  };

  const handleFloorClick = (point: THREE.Vector3) => {
    // If we are sitting, clicking the floor means we want to stand up and walk
    if (isSitting) {
        setIsSitting(false);
        setSitPose(null);
    }
    
    // Always allow setting target, Character.tsx now prioritizes Manual Keys over this.
    // This allows "Direct Mode" users to still click-to-walk if they want.
    setTargetLocation(point);
    
    // IMPORTANT: Clear any pending interaction so we don't sit down if we clicked the floor
    pendingInteraction.current = null;
  };

  const handleChairInteract = (entryPos: THREE.Vector3, sitPos: THREE.Vector3, sitRot: number) => {
      // 1. Set nav target to the entry point in front of chair
      setTargetLocation(entryPos);
      
      // 2. Queue the sit action
      pendingInteraction.current = {
          type: 'sit',
          position: sitPos,
          rotation: sitRot
      };
  };

  const handleTargetReached = () => {
      setTargetLocation(null);
      
      // Check if we have a pending interaction
      if (pendingInteraction.current && pendingInteraction.current.type === 'sit') {
          setSitPose({
              position: pendingInteraction.current.position,
              rotation: pendingInteraction.current.rotation
          });
          setIsSitting(true);
          pendingInteraction.current = null;
      }
  };

  const handleStopSitting = () => {
      setIsSitting(false);
      setSitPose(null);
  };

  return (
    <>
      {/* 
        ENVIRONMENT & BACKGROUND
        Using a manual sphere for the visual background to allow height adjustment (position.y).
        Using Environment component strictly for lighting (IBL).
      */}
      <Environment map={envMap} />
      
      {/* Visual Background Sphere - Raised by 10 units to adjust horizon */}
      <mesh position={[0, 10, 0]} scale={100}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial map={envMap} side={THREE.BackSide} />
      </mesh>
      
      <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0001}>
        <orthographicCamera attach="shadow-camera" args={[-30, 30, 30, -30]} />
      </directionalLight>
      <ambientLight intensity={0.2} color="#00ffcc" />

      <Physics gravity={[0, -9.81, 0]}>
        
        <Character 
          controlMode={controlMode} 
          movementTarget={targetLocation}
          onUpdate={handleCharacterUpdate}
          playerName={playerName}
          onTargetReached={handleTargetReached}
          isSitting={isSitting}
          sitPose={sitPose}
          onStopSitting={handleStopSitting}
        />

        {players && Object.entries(players).map(([id, p]) => (
            <RemoteCharacter 
                key={id} 
                position={[p.x, p.y, p.z]} 
                rotation={p.rotation} 
                animation={p.animation} 
                name={p.name}
            />
        ))}

        <World onFloorClick={handleFloorClick} />
        
        <ConferenceRoom position={[20, 0, 0]} socket={socket} players={players} />

        {/* Interactive Chairs - Positioned in front of Conference Room */}
        <group position={[20, 0, 7]}>
            {/* Center Chair */}
            <Chair position={[0, 0, 0]} rotation={[0, Math.PI, 0]} onInteract={handleChairInteract} />
            {/* Right Side */}
            <Chair position={[3, 0, 1]} rotation={[0, Math.PI + 0.4, 0]} onInteract={handleChairInteract} />
            {/* Left Side */}
            <Chair position={[-3, 0, 1]} rotation={[0, Math.PI - 0.4, 0]} onInteract={handleChairInteract} />
        </group>

      </Physics>

      <TargetMarker position={targetLocation} />
    </>
  );
};
