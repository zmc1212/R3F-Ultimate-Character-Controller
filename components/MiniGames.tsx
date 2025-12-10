import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, RapierRigidBody } from '@react-three/rapier';
import { Text, Float, Box, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Hand } from 'lucide-react';

// --- Cyber Soccer Ball ---
export const CyberBall = ({ 
    position, 
    isPushing,
    onPushToggle 
}: { 
    position: [number, number, number], 
    isPushing: boolean,
    onPushToggle: () => void 
}) => {
    const ballRef = useRef<RapierRigidBody>(null);
    const uiRef = useRef<THREE.Group>(null); // Ref for UI container
    const [score, setScore] = useState({ red: 0, blue: 0 });
    const [lastGoalTime, setLastGoalTime] = useState(0);
    
    // Interaction State
    const [isNear, setIsNear] = useState(false);

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

    // Interaction Logic
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isNear && (e.key === 'e' || e.key === 'E')) {
                onPushToggle();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isNear, onPushToggle]);

    useFrame(() => {
        if (ballRef.current) {
            // Physics Assistance
            if (isPushing && isNear) {
                ballRef.current.setLinearDamping(1.4); 
                ballRef.current.setAngularDamping(1.4);
            } else {
                ballRef.current.setLinearDamping(2.0); 
                ballRef.current.setAngularDamping(1.0);
            }

            // Sync UI position to ball (but ignore rotation)
            if (uiRef.current) {
                const { x, y, z } = ballRef.current.translation();
                uiRef.current.position.set(x, y + 2.5, z);
            }
        }
    });

    return (
        <group>
            {/* The Ball */}
            <RigidBody 
                ref={ballRef} 
                colliders="ball" 
                restitution={0.8} 
                friction={0.5} 
                position={[position[0], position[1] + 2, position[2]]}
                mass={50} 
            >
                <mesh castShadow>
                    <sphereGeometry args={[1, 32, 32]} />
                    <meshStandardMaterial color="#ffffff" emissive="#00ffcc" emissiveIntensity={0.5} />
                </mesh>

                {/* Proximity Sensor attached to ball */}
                <CuboidCollider 
                    args={[2.5, 2.5, 2.5]} 
                    sensor 
                    onIntersectionEnter={({ other }) => {
                        // Ensure it triggers for any rigid body
                        if (other.rigidBody) {
                            setIsNear(true);
                        }
                    }}
                    onIntersectionExit={() => {
                        setIsNear(false);
                    }}
                />
            </RigidBody>

            {/* Independent UI Container */}
            <group ref={uiRef}>
                {isNear && (
                    <Html center zIndexRange={[100, 0]}>
                        <div className="flex flex-col items-center pointer-events-none whitespace-nowrap">
                             <div className={`bg-black/80 border ${isPushing ? 'border-red-500 text-red-500' : 'border-[#00ffcc] text-[#00ffcc]'} px-3 py-1 rounded font-mono text-xs flex items-center gap-2 backdrop-blur-md animate-bounce`}>
                                 <Hand size={14} />
                                 <span className="font-bold tracking-widest">{isPushing ? "STOP PUSHING [E]" : "PUSH MODE [E]"}</span>
                             </div>
                        </div>
                    </Html>
                )}
            </group>

            {/* Scoreboard */}
            <group position={[position[0], position[1] + 8, position[2] - 12]}>
                <Text fontSize={3} color="#ff0055" position={[-3, 0, 0]}>{score.red}</Text>
                <Text fontSize={1} color="#ffffff" position={[0, 0, 0]}>-</Text>
                <Text fontSize={3} color="#00aaff" position={[3, 0, 0]}>{score.blue}</Text>
            </group>

            {/* Goal Posts (Sensors) */}
            <Goal 
                position={[position[0] - 10, position[1], position[2]]} 
                color="#ff0055" 
                onGoal={() => handleGoal('blue')} 
            />
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