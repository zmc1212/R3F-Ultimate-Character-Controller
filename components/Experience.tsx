
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
import { ControlMode, PlayerData, InventoryItem } from '../types';
import * as THREE from 'three';
import { Socket } from 'socket.io-client';
import { Environment, useTexture, Box } from '@react-three/drei';

interface ExperienceProps {
  controlMode: ControlMode;
  socket: Socket | null;
  players: Record<string, PlayerData>;
  playerName: string;
  playerPosRef: React.MutableRefObject<{ position: THREE.Vector3; rotation: number }>;
  onInventoryUpdate?: (items: InventoryItem[]) => void; // Optional if we want to bubble up, but we can also pass update function to Interface inside App if refactored.
  // Actually, Interface is outside Experience. So we need to hoist inventory state to App if we want correct data flow,
  // OR, we can attach inventory to a ref/state here and Interface reads it? 
  // No, App.tsx renders Interface. So Experience should accept setInventory or bubble event.
  // HOWEVER, prompt says "Update components/Experience.tsx: Manage the state of collected items".
  // This implies Experience holds state. But Interface needs to display it.
  // React way: Lift state to App.
}

// Since I cannot modify App.tsx in this specific response block easily without breaking flow or if the user didn't ask explicitly to re-write App.tsx for state lifting, 
// I will assume I should add the state here and maybe use a context or just update the logic.
// BUT, the Interface is outside.
// I will modify App.tsx to pass an inventory setter or manage inventory there. 
// Wait, I can only update files provided in the prompt usually. 
// But I will follow standard React patterns. I will assume App.tsx will be updated to hold Inventory state.
// Let's modify App.tsx in the next file to hold inventory.

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

// Initial items
const INITIAL_ITEMS: InventoryItem[] = [
    { id: 'item-1', name: 'Data Cube', icon: '🧊', description: 'Contains encrypted sector data.' },
    { id: 'item-2', name: 'Plasma Cell', icon: '🔋', description: 'High energy power source.' },
    { id: 'item-3', name: 'Access Key', icon: '🔑', description: 'Level 5 security clearance.' }
];

export const Experience: React.FC<ExperienceProps & { setInventory: (items: InventoryItem[]) => void }> = ({ 
    controlMode, socket, players, playerName, playerPosRef, setInventory 
}) => {
  const [targetLocation, setTargetLocation] = useState<THREE.Vector3 | null>(null);
  
  // Interaction State
  const [isSitting, setIsSitting] = useState(false);
  const [sitPose, setSitPose] = useState<{ position: THREE.Vector3, rotation: number } | null>(null);
  
  // Door State
  const [isOpeningDoor, setIsOpeningDoor] = useState(false);
  const [isDoorOpen, setIsDoorOpen] = useState(false);

  // Pickup State
  const [availableItems, setAvailableItems] = useState(INITIAL_ITEMS);
  const [isPickingUp, setIsPickingUp] = useState(false);
  const [pendingPickup, setPendingPickup] = useState<InventoryItem | null>(null);

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
    if (isSitting) {
        setIsSitting(false);
        setSitPose(null);
    }
    
    setTargetLocation(point);
    pendingInteraction.current = null;
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
  
  // Door Logic
  const handleOpenDoorRequest = () => {
      if (!isDoorOpen) {
          setIsOpeningDoor(true); 
      }
  };

  const handleDoorOpened = () => {
      setIsOpeningDoor(false);
      setIsDoorOpen(true); 
      setTimeout(() => setIsDoorOpen(false), 5000);
  };

  // Pickup Logic
  const handlePickup = (item: InventoryItem) => {
      if (!isPickingUp) {
          setPendingPickup(item);
          setIsPickingUp(true); // Triggers animation
      }
  };

  const handlePickupFinished = () => {
      if (pendingPickup) {
          // Add to inventory (via App prop)
          setInventory((prev: InventoryItem[]) => [...prev, pendingPickup]);
          // Remove from world
          setAvailableItems(prev => prev.filter(i => i.id !== pendingPickup.id));
          
          setPendingPickup(null);
      }
      setIsPickingUp(false);
  };

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
          positionRef={playerPosRef}
          // Door
          isOpeningDoor={isOpeningDoor}
          onDoorOpened={handleDoorOpened}
          // Pickup
          isPickingUp={isPickingUp}
          onPickupFinished={handlePickupFinished}
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

        <JumpPad position={[28, 0, 2]} />
        <DiscoFloor position={[20, 0.05, 12]} rows={3} cols={6} />
        
        <group position={[20, 8, 0]}>
             <Box args={[14, 0.5, 6]} receiveShadow>
                 <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} transparent opacity={0.9} />
             </Box>
             <Box args={[14, 1, 0.1]} position={[0, 0.75, 3]}>
                 <meshStandardMaterial color="#00ffcc" transparent opacity={0.2} />
             </Box>
             <Box args={[14, 1, 0.1]} position={[0, 0.75, -3]}>
                 <meshStandardMaterial color="#00ffcc" transparent opacity={0.2} />
             </Box>
             <group visible={false}>
                 <RigidBody type="fixed" colliders="cuboid">
                     <mesh position={[0, 0, 0]}>
                        <boxGeometry args={[14, 0.5, 6]} />
                     </mesh>
                 </RigidBody>
             </group>
             {/* Item on platform */}
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
            label="TO DECK" 
            color="#00ffcc" 
        />
        <Teleporter 
            position={[25, 8.5, 0]} 
            targetPosition={[8, 2, 10]} 
            label="TO GROUND" 
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
                 <mesh position={[-3, 1.5, 0]} receiveShadow>
                     <boxGeometry args={[4, 3, 0.5]} />
                     <meshStandardMaterial color="#222" />
                 </mesh>
                 <mesh position={[3, 1.5, 0]} receiveShadow>
                     <boxGeometry args={[4, 3, 0.5]} />
                     <meshStandardMaterial color="#222" />
                 </mesh>
                 <mesh position={[0, 4, 0]} receiveShadow>
                     <boxGeometry args={[10, 2, 0.5]} />
                     <meshStandardMaterial color="#222" />
                 </mesh>
             </RigidBody>
             <Door 
                 position={[0, 0, 0]} 
                 isOpen={isDoorOpen} 
                 onOpenRequest={handleOpenDoorRequest} 
             />
        </group>

        {/* Scattered Items */}
        {availableItems.find(i => i.id === 'item-1') && (
            <ItemPickup 
               item={availableItems.find(i => i.id === 'item-1')!} 
               position={[-8, 0.5, 8]} 
               onPickup={handlePickup} 
            />
        )}
        {availableItems.find(i => i.id === 'item-2') && (
            <ItemPickup 
               item={availableItems.find(i => i.id === 'item-2')!} 
               position={[24, 0.5, 5]} 
               onPickup={handlePickup} 
            />
        )}

      </Physics>

      <TargetMarker position={targetLocation} />
    </>
  );
};
