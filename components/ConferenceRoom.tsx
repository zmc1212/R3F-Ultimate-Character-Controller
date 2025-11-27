
import React from 'react';
import { RigidBody } from '@react-three/rapier';
import { ConferenceScreen } from './ConferenceScreen';
import { Box } from '@react-three/drei';
import { Socket } from 'socket.io-client';
import { PlayerData } from '../types';

interface ConferenceRoomProps {
    position?: [number, number, number];
    socket: Socket | null;
    players: Record<string, PlayerData>;
}

export const ConferenceRoom: React.FC<ConferenceRoomProps> = ({ 
    position = [0, 0, 0],
    socket,
    players
}) => {
  return (
    <group position={position}>
      {/* Platform */}
      <RigidBody type="fixed" friction={1}>
        <mesh position={[0, 0.1, 0]} receiveShadow>
          <boxGeometry args={[14, 0.2, 10]} />
          <meshStandardMaterial color="#222" metalness={0.6} roughness={0.4} />
        </mesh>
      </RigidBody>

      {/* Back Wall */}
      <RigidBody type="fixed">
        <mesh position={[0, 2.5, -4.5]} receiveShadow>
            <boxGeometry args={[12, 5, 1]} />
            <meshStandardMaterial color="#111" />
        </mesh>
        {/* Decorative Light Strips */}
        <mesh position={[0, 4, -4]} rotation={[0,0,0]}>
            <boxGeometry args={[10, 0.1, 0.1]} />
            <meshBasicMaterial color="#00ffcc" />
        </mesh>
        <mesh position={[0, 1, -4]} rotation={[0,0,0]}>
            <boxGeometry args={[10, 0.1, 0.1]} />
            <meshBasicMaterial color="#00ffcc" />
        </mesh>
      </RigidBody>

      {/* Screen Positioned on Wall */}
      <group position={[0, 2.5, -3.9]}>
        <ConferenceScreen socket={socket} players={players} />
      </group>

      {/* Conference Table */}
      <RigidBody type="fixed">
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[2.5, 2.5, 0.1, 32]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.5, 1, 0.5, 16]} />
            <meshStandardMaterial color="#333" />
        </mesh>
      </RigidBody>

      {/* Side Pillars */}
      <RigidBody type="fixed">
          <Box args={[1, 4, 1]} position={[-6, 2, -4]}><meshStandardMaterial color="#333" /></Box>
          <Box args={[1, 4, 1]} position={[6, 2, -4]}><meshStandardMaterial color="#333" /></Box>
      </RigidBody>
      
      {/* Ambient Area Light for Screen */}
      <pointLight position={[0, 3, -2]} color="#00ffcc" intensity={0.5} distance={10} />
    </group>
  );
};
