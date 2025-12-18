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
    onPushToggle,
    playerPosRef 
}: { 
    position: [number, number, number], 
    isPushing: boolean,
    onPushToggle: () => void,
    playerPosRef: React.MutableRefObject<{ position: THREE.Vector3; rotation: number }>
}) => {
    const ballRef = useRef<RapierRigidBody>(null);
    const uiRef = useRef<THREE.Group>(null); 
    const [score, setScore] = useState({ red: 0, blue: 0 });
    const [lastGoalTime, setLastGoalTime] = useState(0);
    const [isNear, setIsNear] = useState(false);
    
    // For calculating player velocity to apply smart push force
    const lastPlayerPos = useRef(new THREE.Vector3());

    const resetBall = () => {
        if (ballRef.current) {
            ballRef.current.setTranslation({ x: position[0], y: position[1] + 5, z: position[2] }, true);
            ballRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
            ballRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
    };

    const handleGoal = (team: 'red' | 'blue') => {
        const now = Date.now();
        if (now - lastGoalTime < 2000) return; 
        setScore(prev => ({ ...prev, [team]: prev[team] + 1 }));
        setLastGoalTime(now);
        setTimeout(resetBall, 1000);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isNear && (e.key === 'e' || e.key === 'E')) {
                onPushToggle();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isNear, onPushToggle]);

    useFrame((state, delta) => {
        if (ballRef.current) {
            const currentBallPos = ballRef.current.translation();

            // 1. Sync UI position manually to avoid rotation
            if (uiRef.current) {
                uiRef.current.position.set(currentBallPos.x, currentBallPos.y + 2.5, currentBallPos.z);
            }

            // 2. Smart Push Assist
            if (isPushing && isNear && playerPosRef.current) {
                ballRef.current.setLinearDamping(0.1); 
                ballRef.current.setAngularDamping(0.1);

                const currentPlayerPos = playerPosRef.current.position;
                
                const distMoved = currentPlayerPos.distanceTo(lastPlayerPos.current);
                const speed = distMoved / delta;
                lastPlayerPos.current.copy(currentPlayerPos);

                if (speed > 0.1) {
                    const dx = currentBallPos.x - currentPlayerPos.x;
                    const dz = currentBallPos.z - currentPlayerPos.z;
                    const distToBall = Math.sqrt(dx*dx + dz*dz);

                    if (distToBall < 3.0) {
                        const pushDir = new THREE.Vector3(dx, 0, dz).normalize();
                        const pushForce = 40; 

                        ballRef.current.applyImpulse({
                            x: pushDir.x * pushForce * delta,
                            y: 0, 
                            z: pushDir.z * pushForce * delta
                        }, true);
                    }
                }
            } else {
                ballRef.current.setLinearDamping(2.0); 
                ballRef.current.setAngularDamping(1.0);
            }
        }
    });

    return (
        <group>
            <RigidBody 
                ref={ballRef} 
                colliders="ball" 
                restitution={0.8} 
                friction={0.5} 
                position={[position[0], position[1] + 2, position[2]]}
                mass={1} 
            >
                <mesh castShadow>
                    <sphereGeometry args={[1, 32, 32]} />
                    <meshStandardMaterial color="#ffffff" emissive="#00ffcc" emissiveIntensity={0.5} />
                </mesh>

                <CuboidCollider 
                    args={[2.5, 2.5, 2.5]} 
                    sensor 
                    onIntersectionEnter={({ other }) => {
                        if (other.rigidBody) setIsNear(true);
                    }}
                    onIntersectionExit={() => setIsNear(false)}
                />
            </RigidBody>

            <group ref={uiRef}>
                {isNear && (
                    <Html center zIndexRange={[100, 0]}>
                        <div className="flex flex-col items-center pointer-events-none whitespace-nowrap">
                             <div className={`bg-black/80 border ${isPushing ? 'border-red-500 text-red-500' : 'border-[#00ffcc] text-[#00ffcc]'} px-3 py-1 rounded font-mono text-xs flex items-center gap-2 backdrop-blur-md animate-bounce`}>
                                 <Hand size={14} />
                                 <span className="font-bold tracking-widest">{isPushing ? "停止推球 [E]" : "推球模式 [E]"}</span>
                             </div>
                        </div>
                    </Html>
                )}
            </group>

            <group position={[position[0], position[1] + 8, position[2] - 12]}>
                <Text fontSize={3} color="#ff0055" position={[-3, 0, 0]}>{score.red}</Text>
                <Text fontSize={1} color="#ffffff" position={[0, 0, 0]}>-</Text>
                <Text fontSize={3} color="#00aaff" position={[3, 0, 0]}>{score.blue}</Text>
            </group>

            <Goal position={[position[0] - 10, position[1], position[2]]} color="#ff0055" onGoal={() => handleGoal('blue')} />
            <Goal position={[position[0] + 10, position[1], position[2]]} color="#00aaff" onGoal={() => handleGoal('red')} />
        </group>
    );
};

const Goal = ({ position, color, onGoal }: { position: [number, number, number], color: string, onGoal: () => void }) => {
    return (
        <group position={position}>
            <mesh position={[0, 2, -2]}><boxGeometry args={[0.2, 4, 0.2]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} /></mesh>
            <mesh position={[0, 2, 2]}><boxGeometry args={[0.2, 4, 0.2]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} /></mesh>
            <mesh position={[0, 4, 0]}><boxGeometry args={[0.2, 0.2, 4]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} /></mesh>
            <RigidBody type="fixed" sensor onIntersectionEnter={({ other }) => { if (other.rigidBody && !other.rigidBody.isFixed()) onGoal(); }}>
                <CuboidCollider args={[0.5, 2, 2]} position={[0, 2, 0]} />
            </RigidBody>
        </group>
    );
};

export const ZeroGZone = ({ position }: { position: [number, number, number] }) => {
    return (
        <group position={position}>
             <mesh position={[0, 5, 0]}>
                 <boxGeometry args={[10, 10, 10]} />
                 <meshStandardMaterial color="#00aaff" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
             </mesh>
             <Float speed={2} rotationIntensity={1} floatIntensity={2}>
                 <Box args={[0.5, 0.5, 0.5]} position={[2, 4, 2]}><meshStandardMaterial color="#00aaff" wireframe /></Box>
                 <Box args={[0.3, 0.3, 0.3]} position={[-2, 6, -1]}><meshStandardMaterial color="#00aaff" wireframe /></Box>
             </Float>
             <Text position={[0, 11, 0]} fontSize={1} color="#00aaff" anchorY="bottom">零重力区域</Text>
             <RigidBody type="fixed" sensor onIntersectionEnter={({ other }) => {
                    if (other.rigidBody) {
                        other.rigidBody.setGravityScale(0.1, true);
                        other.rigidBody.resetForces(true);
                        other.rigidBody.applyImpulse({ x:0, y: 1, z:0 }, true);
                    }
                }} onIntersectionExit={({ other }) => {
                    if (other.rigidBody) other.rigidBody.setGravityScale(1.0, true);
                }}>
                 <CuboidCollider args={[5, 5, 5]} position={[0, 5, 0]} />
             </RigidBody>
        </group>
    );
};