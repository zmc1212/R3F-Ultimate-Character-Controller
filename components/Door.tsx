import React, { useState, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { RigidBody, CuboidCollider, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { Fingerprint } from 'lucide-react';

interface DoorProps {
    position: [number, number, number];
    rotation?: [number, number, number];
    onOpenRequest?: () => void;
    isOpen: boolean;
}

export const Door: React.FC<DoorProps> = ({ 
    position, 
    rotation = [0, 0, 0],
    onOpenRequest,
    isOpen
}) => {
    const [isNear, setIsNear] = useState(false);
    const doorPanel = useRef<RapierRigidBody>(null);
    const groupRef = useRef<THREE.Group>(null);
    
    // Height Configuration
    const doorHeight = 3.5;
    const closedCenterY = doorHeight / 2; // 1.75
    const openCenterY = closedCenterY + 2.5; // Slide up 2.5 units

    // Store current Y offset relative to the door group origin
    const currentOffsetY = useRef(closedCenterY);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isNear && !isOpen && (e.key === 'e' || e.key === 'E')) {
                if (onOpenRequest) onOpenRequest();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isNear, isOpen, onOpenRequest]);

    useFrame((state, delta) => {
        if (doorPanel.current && groupRef.current) {
            const targetOffset = isOpen ? openCenterY : closedCenterY;

            // Smooth Lerp
            currentOffsetY.current = THREE.MathUtils.lerp(currentOffsetY.current, targetOffset, delta * 3);
            
            // Get absolute world coordinates of the door group base
            const worldPos = new THREE.Vector3();
            groupRef.current.getWorldPosition(worldPos);

            // Calculate the global position of the door center based on local up movement
            // Start with local vector (0, currentOffsetY, 0)
            const localPos = new THREE.Vector3(0, currentOffsetY.current, 0);
            
            // Apply group's world rotation to the offset vector
            localPos.applyQuaternion(groupRef.current.getWorldQuaternion(new THREE.Quaternion()));
            
            // Add to base world position
            const globalTarget = worldPos.add(localPos);

            doorPanel.current.setNextKinematicTranslation(globalTarget);
        }
    });

    return (
        <group ref={groupRef} position={position} rotation={rotation}>
            {/* Proximity Sensor */}
            <RigidBody type="fixed" sensor onIntersectionEnter={(e) => {
                if (e.other.rigidBody && !e.other.rigidBody.isFixed()) setIsNear(true);
            }} onIntersectionExit={() => setIsNear(false)}>
                <CuboidCollider args={[1.5, 1.5, 1.5]} position={[0, 1, 0]} />
            </RigidBody>

            {/* Door Frame (Static) */}
            <RigidBody type="fixed">
                {/* Left Post */}
                <mesh position={[-1.1, 1.75, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.2, 3.5, 0.4]} />
                    <meshStandardMaterial color="#333" />
                </mesh>
                {/* Right Post */}
                <mesh position={[1.1, 1.75, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.2, 3.5, 0.4]} />
                    <meshStandardMaterial color="#333" />
                </mesh>
                {/* Top Header */}
                <mesh position={[0, 3.6, 0]} castShadow receiveShadow>
                    <boxGeometry args={[2.4, 0.2, 0.4]} />
                    <meshStandardMaterial color="#333" />
                </mesh>
                {/* Holographic scanner */}
                <mesh position={[1.3, 1.5, 0.1]}>
                    <boxGeometry args={[0.1, 0.3, 0.1]} />
                    <meshStandardMaterial color={isOpen ? "#00ffcc" : (isNear ? "#ffff00" : "#ff0000")} emissiveIntensity={2} toneMapped={false} />
                </mesh>
            </RigidBody>

            {/* Sliding Door Panel (Kinematic Position) */}
            <RigidBody 
                ref={doorPanel} 
                type="kinematicPosition" 
                colliders="hull"
                // Initial local position to prevent glitch before first frame update
                position={[0, 1.75, 0]}
            >
                <mesh castShadow receiveShadow>
                    <boxGeometry args={[2, 3.5, 0.1]} />
                    <meshStandardMaterial 
                        color="#1a1a1a" 
                        metalness={0.8} 
                        roughness={0.2}
                        transparent
                        opacity={0.95}
                    />
                </mesh>
                {/* Sci-fi details on door */}
                <mesh position={[0, 0, 0.06]}>
                     <planeGeometry args={[1.8, 3.3]} />
                     <meshBasicMaterial color={isOpen ? "#00ffcc" : "#00aa88"} wireframe transparent opacity={0.1} />
                </mesh>
            </RigidBody>

            {/* UI Prompt */}
            {isNear && !isOpen && (
                <Html position={[0, 2, 0]} center>
                    <div className="flex flex-col items-center animate-bounce">
                        <div className="bg-black/80 border border-[#00ffcc] text-[#00ffcc] px-3 py-2 rounded font-mono text-xs flex items-center gap-2 backdrop-blur-md">
                            <Fingerprint size={16} />
                            <span className="font-bold tracking-widest">按 [E] 开启</span>
                        </div>
                        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[#00ffcc] mt-1"></div>
                    </div>
                </Html>
            )}
        </group>
    );
};