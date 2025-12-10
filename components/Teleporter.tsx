
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Torus, Text } from '@react-three/drei';
import { RigidBody, CylinderCollider } from '@react-three/rapier';
import * as THREE from 'three';

interface TeleporterProps {
    position: [number, number, number];
    targetPosition: [number, number, number];
    label?: string;
    color?: string;
}

export const Teleporter: React.FC<TeleporterProps> = ({ 
    position, 
    targetPosition, 
    label = "PORTAL",
    color = "#00ffcc"
}) => {
    const ringRef1 = useRef<THREE.Mesh>(null);
    const ringRef2 = useRef<THREE.Mesh>(null);
    
    useFrame((state) => {
        const time = state.clock.getElapsedTime();
        if (ringRef1.current) {
            ringRef1.current.rotation.x = time * 0.5;
            ringRef1.current.rotation.y = time * 0.3;
        }
        if (ringRef2.current) {
            ringRef2.current.rotation.x = -time * 0.3;
            ringRef2.current.rotation.y = time * 0.5;
        }
    });

    return (
        <group position={position}>
            {/* Physics Sensor */}
            <RigidBody type="fixed" sensor onIntersectionEnter={({ other }) => {
                if (other.rigidBody) {
                    // 1. Stop momentum
                    other.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
                    other.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
                    
                    // 2. Teleport
                    // Note: We teleport slightly above the target y to prevent floor clipping
                    other.rigidBody.setTranslation({ 
                        x: targetPosition[0], 
                        y: targetPosition[1], 
                        z: targetPosition[2] 
                    }, true);
                }
            }}>
                {/* Trigger Area - Explicit Collider is required for invisible sensors */}
                <CylinderCollider args={[1, 1]} />
            </RigidBody>

            {/* Visuals */}
            <group position={[0, 1, 0]}>
                {/* Rotating Rings */}
                <Torus ref={ringRef1} args={[1.2, 0.05, 16, 100]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.4, 0]}>
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
                </Torus>
                <Torus ref={ringRef2} args={[1.0, 0.05, 16, 100]} rotation={[0, Math.PI / 2, 0]} position={[0, 0.4, 0]}>
                     <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} toneMapped={false} />
                </Torus>
                
                {/* Base */}
                <mesh position={[0, -1, 0]} receiveShadow>
                    <cylinderGeometry args={[1.4, 1.5, 0.2, 32]} />
                    <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} />
                </mesh>
                
                {/* Floating Label */}
                <Text 
                    position={[0, 2.5, 0]} 
                    fontSize={0.3} 
                    color={color}
                    font="/fonts/st.otf" 
                >
                    {label}
                </Text>
                
                {/* Particle / Energy Core effect simulated with transparency */}
                <mesh>
                    <sphereGeometry args={[0.8, 32, 32]} />
                    <meshStandardMaterial color={color} transparent opacity={0.1} />
                </mesh>
            </group>
        </group>
    );
};
