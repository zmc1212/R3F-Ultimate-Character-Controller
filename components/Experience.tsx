
import React, { useState, useRef, useEffect } from 'react';
import { Physics, RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { Character } from './Character';
import { RemoteCharacter } from './RemoteCharacter';
import { World } from './World';
import { ConferenceRoom } from './ConferenceRoom';
import { Chair } from './Furniture';
import { JumpPad, DiscoFloor } from './InteractiveObjects';
import { Teleporter } from './Teleporter';
import { SpeedPad } from './SpeedPad';
import { Door } from './Door';
import { ItemPickup } from './ItemPickup';
import { CyberBall, ZeroGZone } from './MiniGames'; 
import { LaserFence, PhysicsCrates, GravityTerminal } from './InteractiveZones';
import { ControlMode, PlayerData, InventoryItem } from '../types';
import * as THREE from 'three';
import { Socket } from 'socket.io-client';
import { Environment, useTexture, Box, Text } from '@react-three/drei';

interface ExperienceProps {
  controlMode: ControlMode;
  socket: Socket | null;
  players: Record<string, PlayerData>;
  playerName: string;
  playerPosRef: React.MutableRefObject<{ position: THREE.Vector3; rotation: number }>;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  emote: string | null;
  setEmote: (emote: string | null) => void;
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

const INITIAL_ITEMS: InventoryItem[] = [
    { id: 'item-1', name: '数据方块', icon: '🧊', description: '包含加密的扇区数据' },
    { id: 'item-2', name: '等离子电池', icon: '🔋', description: '高能动力源 (喷气背包燃料)' },
    { id: 'item-3', name: '访问密钥', icon: '🔑', description: '5级安全权限' }
];

export const Experience: React.FC<ExperienceProps> = ({ 
    controlMode, socket, players, playerName, playerPosRef, inventory, setInventory, emote, setEmote 
}) => {
  const [targetLocation, setTargetLocation] = useState<THREE.Vector3 | null>(null);
  
  const [isSitting, setIsSitting] = useState(false);
  const [sitPose, setSitPose] = useState<{ position: THREE.Vector3, rotation: number } | null>(null);
  
  const [isOpeningDoor, setIsOpeningDoor] = useState(false);
  const [isDoorOpen, setIsDoorOpen] = useState(false);

  const [availableItems, setAvailableItems] = useState(INITIAL_ITEMS);
  const [isPickingUp, setIsPickingUp] = useState(false);
  const [pendingPickup, setPendingPickup] = useState<InventoryItem | null>(null);

  const [isPushing, setIsPushing] = useState(false);
  const [globalGravityScale, setGlobalGravityScale] = useState(1.0);

  const pendingInteraction = useRef<{ type: 'sit', position: THREE.Vector3, rotation: number } | null>(null);

  const envMap = useTexture('/images/env.png');
  envMap.mapping = THREE.EquirectangularReflectionMapping;

  const handleCharacterUpdate = (data: { x: number; y: number; z: number; rotation: number; animation: string }) => {
      if (socket && socket.connected) {
          socket.emit('move', data);
      }
      if (emote && (data.animation === 'Walking' || data.animation === 'Running')) {
          setEmote(null);
      }
  };

  const handleFloorClick = (point: THREE.Vector3) => {
    if (controlMode === 'pointToClick') {
        if (isSitting) {
            setIsSitting(false);
            setSitPose(null);
        }
        setEmote(null);
        setTargetLocation(point);
        pendingInteraction.current = null;
        if (isPushing) setIsPushing(false);
    }
  };

  const handleChairInteract = (entryPos: THREE.Vector3, sitPos: THREE.Vector3, sitRot: number) => {
      setTargetLocation(entryPos);
      pendingInteraction.current = {
          type: 'sit',
          position: sitPos,
          rotation: sitRot
      };
  };

  const handleTargetReached = () => {
      setTargetLocation(null);
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
  
  const handleOpenDoorRequest = () => {
      if (!isDoorOpen) setIsOpeningDoor(true); 
  };

  const handleDoorOpened = () => {
      setIsOpeningDoor(false);
      setIsDoorOpen(true); 
      setTimeout(() => setIsDoorOpen(false), 5000);
  };

  const handlePickup = (item: InventoryItem) => {
      if (!isPickingUp) {
          setPendingPickup(item);
          setIsPickingUp(true); 
      }
  };

  const handlePickupFinished = () => {
      if (pendingPickup) {
          setInventory(prev => [...prev, pendingPickup]);
          setAvailableItems(prev => prev.filter(i => i.id !== pendingPickup.id));
          setPendingPickup(null);
      }
      setIsPickingUp(false);
  };

  const handlePushToggle = () => setIsPushing(!isPushing);

  return (
    <>
      <Environment map={envMap} />
      
      <mesh position={[0, 10, 0]} scale={100}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial map={envMap} side={THREE.BackSide} />
      </mesh>
      
      <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0001}>
        <orthographicCamera attach="shadow-camera" args={[-30, 30, 30, -30]} />
      </directionalLight>
      <ambientLight intensity={0.2} color="#00ffcc" />

      <Physics gravity={[0, -9.81 * globalGravityScale, 0]}>
        
        <Character 
          controlMode={controlMode} 
          movementTarget={targetLocation}
          onUpdate={handleCharacterUpdate}
          playerName={playerName}
          onTargetReached={handleTargetReached}
          isSitting={isSitting}
          sitPose={sitPose}
          onStopSitting={handleStopSitting}
          positionRef={playerPosRef}
          isOpeningDoor={isOpeningDoor}
          onDoorOpened={handleDoorOpened}
          isPickingUp={isPickingUp}
          onPickupFinished={handlePickupFinished}
          isPushing={isPushing} 
          inventory={inventory}
          emote={emote}
          gravityScale={globalGravityScale}
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

        <group position={[20, 0.2, 3]}>
            <Chair position={[0, 0, 1]} rotation={[0, Math.PI, 0]} onInteract={handleChairInteract} />
            <Chair position={[3, 0, 1]} rotation={[0, Math.PI + 0.4, 0]} onInteract={handleChairInteract} />
            <Chair position={[-3, 0, 1]} rotation={[0, Math.PI - 0.4, 0]} onInteract={handleChairInteract} />
        </group>

        <group position={[-20, 0, 15]}>
            <LaserFence position={[0, 0, 0]} width={8} />
            <LaserFence position={[0, 0.5, 5]} width={8} rotation={[0, 0.2, 0]} />
            <Text position={[0, 5, 2.5]} fontSize={0.8} color="#ff0044">激光挑战区</Text>
        </group>

        <group position={[-25, 0, -15]}>
            <PhysicsCrates position={[0, 1, 0]} />
            <PhysicsCrates position={[1.2, 1, 0.5]} />
            <PhysicsCrates position={[-0.5, 1, 1.5]} />
            <PhysicsCrates position={[0.5, 2.5, 0.5]} />
            <Text position={[0, 4, 1]} fontSize={0.6} color="#00ffcc">动力装卸区</Text>
        </group>

        <GravityTerminal 
            position={[5, 0, -15]} 
            onGravityChange={(scale) => setGlobalGravityScale(scale)} 
        />

        <JumpPad position={[28, 0, -8]} />
        <DiscoFloor position={[20, 0.05, 12]} rows={3} cols={6} />
        
        {/* 高台区域 - 修复了缺失的刚体 */}
        <group position={[20, 8, 0]}>
             <RigidBody type="fixed">
                <Box args={[14, 0.5, 6]} receiveShadow>
                    <meshStandardMaterial color="#222" metalness={0.8} roughness={0.4} transparent opacity={0.9} />
                </Box>
             </RigidBody>
             {availableItems.find(i => i.id === 'item-3') && (
                 <ItemPickup 
                    item={availableItems.find(i => i.id === 'item-3')!} 
                    position={[2, 1, 0]} 
                    onPickup={handlePickup} 
                 />
             )}
        </group>

        <Teleporter 
            position={[10, 0, 10]} 
            targetPosition={[20, 9, 0]} 
            label="前往高台" 
            color="#00ffcc" 
        />
        <Teleporter 
            position={[25, 8.5, 0]} 
            targetPosition={[8, 2, 10]} 
            label="前往地面" 
            color="#ff00ff" 
        />
       <group>
            <SpeedPad position={[-15, 0, 10]} direction={[0, 0, -1]} boostStrength={50} />
            <SpeedPad position={[-15, 0, 0]} direction={[0, 0, -1]} boostStrength={50} />
            <SpeedPad position={[-15, 0, -12]} direction={[1, 0, 0]} boostStrength={50} />
            <SpeedPad position={[-5, 0, -12]} direction={[0, 0, 1]} boostStrength={50} />
            <SpeedPad position={[-5, 0, 0]} direction={[0, 0, 1]} boostStrength={50} />
            <SpeedPad position={[-5, 0, 10]} direction={[-1, 0, 0]} boostStrength={50} />
        </group>

        <group position={[-10, 0, 5]}>
             <RigidBody type="fixed">
                 <mesh position={[-3, 1.5, 0]} receiveShadow><boxGeometry args={[4, 3, 0.5]} /><meshStandardMaterial color="#222" /></mesh>
                 <mesh position={[3, 1.5, 0]} receiveShadow><boxGeometry args={[4, 3, 0.5]} /><meshStandardMaterial color="#222" /></mesh>
                 <mesh position={[0, 4, 0]} receiveShadow><boxGeometry args={[10, 2, 0.5]} /><meshStandardMaterial color="#222" /></mesh>
             </RigidBody>
             <Door position={[0, 0, 0]} isOpen={isDoorOpen} onOpenRequest={handleOpenDoorRequest} />
        </group>

        {availableItems.find(i => i.id === 'item-1') && (
            <ItemPickup item={availableItems.find(i => i.id === 'item-1')!} position={[-8, 0.5, 8]} onPickup={handlePickup} />
        )}
        {availableItems.find(i => i.id === 'item-2') && (
            <ItemPickup item={availableItems.find(i => i.id === 'item-2')!} position={[24, 0.5, 5]} onPickup={handlePickup} />
        )}

        <CyberBall position={[40, 0, 0]} isPushing={isPushing} onPushToggle={handlePushToggle} playerPosRef={playerPosRef} />
        <ZeroGZone position={[-30, 0, 0]} />

      </Physics>

      <TargetMarker position={controlMode === 'pointToClick' ? targetLocation : null} />
    </>
  );
};
