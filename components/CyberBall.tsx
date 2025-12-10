import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, BallCollider, CuboidCollider, RapierRigidBody } from '@react-three/rapier';
import { Text, Float, Box } from '@react-three/drei';
import * as THREE from 'three';

// --- Cyber Soccer Ball ---
export const CyberBall = ({ position }: { position: [number, number, number] }) => {
    const ballRef = useRef<RapierRigidBody>(null);
    const [score, setScore] = useState({ red: 0, blue: 0 });
    const [lastGoalTime, setLastGoalTime] = useState(0);

    const resetBall = () => {
        if (ballRef.current) {
            ballRef.current.setTranslation({ x: position[0], y: position[1] + 5, z: position[2] }, true);
            ballRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
            ballRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
    };

    const handleGoal = (team: 'red' | 'blue') => {
        const now = Date.now();
        if (now - lastGoalTime < 2000) return; // Debounce

        setScore(prev => ({ ...prev, [team]: prev[team] + 1 }));
        setLastGoalTime(now);
        
        // Reset effect delay
        setTimeout(resetBall, 1000);
    };

    return (
        <group>
            {/* The Ball */}
            <RigidBody 
                ref={ballRef} 
                colliders="ball" 
                restitution={1.2} 
                friction={0.5} 
                position={[position[0], position[1] + 2, position[2]]}
                linearDamping={0.2}
                angularDamping={0.2}
            >
                <mesh castShadow>
                    <sphereGeometry args={[1, 32, 32]} />
                    <meshStandardMaterial color="#ffffff" emissive="#00ffcc" emissiveIntensity={0.5} />
                </mesh>
            </RigidBody>

            {/* Scoreboard */}
            <group position={[position[0], position[1] + 8, position[2] - 12]}>
                <Text fontSize={3} color="#ff0055" position={[-3, 0, 0]}>{score.red}</Text>
                <Text fontSize={1} color="#ffffff" position={[0, 0, 0]}>-</Text>
                <Text fontSize={3} color="#00aaff" position={[3, 0, 0]}>{score.blue}</Text>
            </group>

            {/* Goal Posts (Sensors) */}
            {/* Red Goal (Left) */}
            <Goal 
                position={[position[0] - 10, position[1], position[2]]} 
                color="#ff0055" 
                onGoal={() => handleGoal('blue')} 
            />
            {/* Blue Goal (Right) */}
            <Goal 
                position={[position[0] + 10, position[1], position[2]]} 
                color="#00aaff" 
                onGoal={() => handleGoal('red')} 
            />
        </group>
    );
};

const Goal = ({ position, color, onGoal }: { position: [number, number, number], color: string, onGoal: () => void }) => {
    return (
        <group position={position}>
            {/* Visual Frame */}
            <mesh position={[0, 2, -2]}>
                <boxGeometry args={[0.2, 4, 0.2]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
            </mesh>
            <mesh position={[0, 2, 2]}>
                <boxGeometry args={[0.2, 4, 0.2]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
            </mesh>
            <mesh position={[0, 4, 0]}>
                <boxGeometry args={[0.2, 0.2, 4]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
            </mesh>

            {/* Sensor */}
            <RigidBody type="fixed" sensor onIntersectionEnter={({ other }) => {
                if (other.rigidBody && !other.rigidBody.isFixed()) {
                    onGoal();
                }
            }}>
                <CuboidCollider args={[0.5, 2, 2]} position={[0, 2, 0]} />
            </RigidBody>
        </group>
    );
};

// --- Zero Gravity Chamber ---
export const ZeroGZone = ({ position }: { position: [number, number, number] }) => {
    return (
        <group position={position}>
             {/* Visual Container */}
             <mesh position={[0, 5, 0]}>
                 <boxGeometry args={[10, 10, 10]} />
                 <meshStandardMaterial 
                    color="#00aaff" 
                    transparent 
                    opacity={0.1} 
                    side={THREE.DoubleSide} 
                    depthWrite={false}
                 />
             </mesh>
             
             {/* Floating Particles */}
             <Float speed={2} rotationIntensity={1} floatIntensity={2}>
                 <Box args={[0.5, 0.5, 0.5]} position={[2, 4, 2]}>
                     <meshStandardMaterial color="#00aaff" wireframe />
                 </Box>
                 <Box args={[0.3, 0.3, 0.3]} position={[-2, 6, -1]}>
                     <meshStandardMaterial color="#00aaff" wireframe />
                 </Box>
             </Float>

             {/* Text Label */}
             <Text 
                position={[0, 11, 0]} 
                fontSize={1} 
                color="#00aaff"
                anchorY="bottom"
             >
                 ZERO-G ZONE
             </Text>

             {/* Physics Sensor */}
             <RigidBody 
                type="fixed" 
                sensor 
                onIntersectionEnter={({ other }) => {
                    if (other.rigidBody) {
                        // Directly manipulate Rapier physics body
                        other.rigidBody.setGravityScale(0.1, true);
                        other.rigidBody.resetForces(true);
                        other.rigidBody.applyImpulse({ x:0, y: 1, z:0 }, true);
                    }
                }}
                onIntersectionExit={({ other }) => {
                    if (other.rigidBody) {
                        other.rigidBody.setGravityScale(1.0, true);
                    }
                }}
             >
                 <CuboidCollider args={[5, 5, 5]} position={[0, 5, 0]} />
             </RigidBody>
        </group>
    );
};