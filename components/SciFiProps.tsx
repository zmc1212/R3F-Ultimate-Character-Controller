
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Torus, Text } from '@react-three/drei';
import { RigidBody, CylinderCollider, CuboidCollider } from '@react-three/rapier';
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
                <Torus ref={ringRef1} args={[1.2, 0.05, 16, 100]} rotation={[Math.PI / 2, 0, 0]}>
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
                </Torus>
                <Torus ref={ringRef2} args={[1.0, 0.05, 16, 100]} rotation={[0, Math.PI / 2, 0]}>
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
                    font="/fonts/st.otf" // Assuming share tech mono from html/css is available or fallback
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

interface SpeedPadProps {
    position: [number, number, number];
    direction?: [number, number, number]; // Normalized direction vector
    boostStrength?: number;
}

export const SpeedPad: React.FC<SpeedPadProps> = ({ 
    position, 
    direction = [0, 0, -1],
    boostStrength = 40 
}) => {
    const arrowRef1 = useRef<THREE.Group>(null);
    const arrowRef2 = useRef<THREE.Group>(null);
    const arrowRef3 = useRef<THREE.Group>(null);
    
    useFrame((state) => {
        const time = state.clock.getElapsedTime();
        // Animate arrows scrolling
        if (arrowRef1.current) arrowRef1.current.position.z = -0.5 + (time * 2) % 1.5;
        if (arrowRef2.current) arrowRef2.current.position.z = -0.5 + ((time * 2) + 0.5) % 1.5;
        if (arrowRef3.current) arrowRef3.current.position.z = -0.5 + ((time * 2) + 1.0) % 1.5;
    });

    const rotationY = Math.atan2(direction[0], direction[2]);

    return (
        <group position={position} rotation={[0, rotationY, 0]}>
            <RigidBody type="fixed" sensor onIntersectionEnter={({ other }) => {
                if (other.rigidBody) {
                    const impulse = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY).normalize().multiplyScalar(boostStrength);
                    // Add slightly upward force to prevent friction dragging
                    impulse.y = 2; 
                    other.rigidBody.applyImpulse(impulse, true);
                }
            }}>
                {/* Trigger Area - Explicit Collider */}
                <CuboidCollider args={[1, 0.1, 1.5]} position={[0, 0.1, 0]} />
            </RigidBody>
            
            {/* Base Plate */}
            <mesh position={[0, 0.05, 0]} receiveShadow>
                <boxGeometry args={[2, 0.1, 3]} />
                <meshStandardMaterial color="#111" metalness={0.8} roughness={0.4} />
            </mesh>
            
            {/* Glowing Side Rails */}
            <mesh position={[-0.9, 0.1, 0]}>
                <boxGeometry args={[0.1, 0.1, 3]} />
                <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={2} />
            </mesh>
            <mesh position={[0.9, 0.1, 0]}>
                <boxGeometry args={[0.1, 0.1, 3]} />
                <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={2} />
            </mesh>

            {/* Animated Arrows Container - Local Z is forward for the arrows visuals */}
            <group position={[0, 0.11, 0]} rotation={[-Math.PI/2, 0, Math.PI]}> 
                {/* Clip area */}
                <group ref={arrowRef1}>
                    <Text fontSize={1} color="#ffff00" fillOpacity={0.5}>^</Text>
                </group>
                <group ref={arrowRef2}>
                    <Text fontSize={1} color="#ffff00" fillOpacity={0.5}>^</Text>
                </group>
                <group ref={arrowRef3}>
                    <Text fontSize={1} color="#ffff00" fillOpacity={0.5}>^</Text>
                </group>
            </group>
        </group>
    );
};
