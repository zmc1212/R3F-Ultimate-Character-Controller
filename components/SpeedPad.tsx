
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';

interface SpeedPadProps {
    position: [number, number, number];
    direction?: [number, number, number]; // Normalized direction vector
    boostStrength?: number;
}

export const SpeedPad: React.FC<SpeedPadProps> = ({ 
    position, 
    direction = [0, 0, -1],
    boostStrength = 25 // Reduced from 60 to 25 for better control
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
                    // 1. Reset current horizontal velocity to stop previous momentum
                    // This ensures the character takes the new direction instantly without drifting diagonally
                    const curVel = other.rigidBody.linvel();
                    other.rigidBody.setLinvel({ x: 0, y: curVel.y, z: 0 }, true);

                    // 2. Calculate boost vector
                    const impulse = new THREE.Vector3(0, 0, 1)
                        .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY)
                        .normalize()
                        .multiplyScalar(boostStrength);
                    
                    impulse.y = 0; 

                    // 3. Apply impulse to center of mass
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
