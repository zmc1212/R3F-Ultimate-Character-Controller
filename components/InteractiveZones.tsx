
import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, RapierRigidBody } from '@react-three/rapier';
import { Text, Html, Float, Box } from '@react-three/drei';
import * as THREE from 'three';
import { Zap, Box as BoxIcon, Radio } from 'lucide-react';

// --- 激光避障组件 ---
export const LaserFence = ({ position, rotation = [0, 0, 0], width = 10 }: { position: [number, number, number], rotation?: [number, number, number], width?: number }) => {
    const laserRef = useRef<THREE.Group>(null);
    
    useFrame((state) => {
        if (laserRef.current) {
            // 激光上下摆动
            laserRef.current.position.y = Math.sin(state.clock.getElapsedTime() * 2) * 1.5;
        }
    });

    return (
        <group position={position} rotation={rotation}>
            {/* 支柱 */}
            <mesh position={[-width/2, 2, 0]}><cylinderGeometry args={[0.2, 0.2, 4]} /><meshStandardMaterial color="#333" /></mesh>
            <mesh position={[width/2, 2, 0]}><cylinderGeometry args={[0.2, 0.2, 4]} /><meshStandardMaterial color="#333" /></mesh>
            
            <group ref={laserRef}>
                <RigidBody type="fixed" sensor onIntersectionEnter={({ other }) => {
                    if (other.rigidBody) {
                        // 碰到激光产生剧烈推力
                        other.rigidBody.applyImpulse({ x: 0, y: 5, z: 10 }, true);
                    }
                }}>
                    <mesh rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.05, 0.05, width]} />
                        <meshBasicMaterial color="#ff0044" transparent opacity={0.8} />
                    </mesh>
                    <pointLight color="#ff0044" intensity={2} distance={width} />
                </RigidBody>
            </group>
            <Text position={[0, 4.5, 0]} fontSize={0.5} color="#ff0044">高压激光 - 禁止通行</Text>
        </group>
    );
};

// --- 可推开的动力箱体 ---
export const PhysicsCrates = ({ position }: { position: [number, number, number] }) => {
    return (
        <RigidBody position={position} colliders="cuboid" mass={0.5} restitution={0.2} friction={0.8}>
            <Box args={[1, 1, 1]} castShadow receiveShadow>
                <meshStandardMaterial color="#444" metalness={0.7} roughness={0.3} />
            </Box>
            {/* 边框发光 */}
            <Box args={[1.05, 1.05, 1.05]}>
                <meshStandardMaterial color="#00ffcc" wireframe transparent opacity={0.2} />
            </Box>
        </RigidBody>
    );
};

// --- 重力控制器终端 ---
export const GravityTerminal = ({ position, onGravityChange }: { position: [number, number, number], onGravityChange: (scale: number) => void }) => {
    const [isNear, setIsNear] = useState(false);
    const [mode, setMode] = useState(0); // 0: 正常, 1: 低重力, 2: 极低
    const modes = [
        { label: '标准引力', scale: 1.0, color: '#00ffcc' },
        { label: '月球引力', scale: 0.3, color: '#ffff00' },
        { label: '零重力模拟', scale: 0.05, color: '#ff00ff' }
    ];

    const cycleMode = () => {
        const next = (mode + 1) % modes.length;
        setMode(next);
        onGravityChange(modes[next].scale);
    };

    return (
        <group position={position}>
            <RigidBody type="fixed" sensor 
                onIntersectionEnter={() => setIsNear(true)} 
                onIntersectionExit={() => setIsNear(false)}
            >
                <CuboidCollider args={[2, 2, 2]} />
            </RigidBody>

            {/* 终端模型 */}
            <mesh position={[0, 0.5, 0]} castShadow>
                <boxGeometry args={[0.8, 1, 0.5]} />
                <meshStandardMaterial color="#111" metalness={0.9} />
            </mesh>
            <mesh position={[0, 1.05, 0.1]} rotation={[-Math.PI/6, 0, 0]}>
                <planeGeometry args={[0.6, 0.4]} />
                <meshStandardMaterial color={modes[mode].color} emissive={modes[mode].color} emissiveIntensity={2} />
            </mesh>

            {isNear && (
                <Html position={[0, 2, 0]} center>
                    <div className="flex flex-col items-center pointer-events-auto">
                        <button 
                            onClick={cycleMode}
                            className="bg-black/90 border-2 px-4 py-2 rounded font-mono text-xs flex items-center gap-2 backdrop-blur-md shadow-lg transition-all active:scale-95"
                            style={{ borderColor: modes[mode].color, color: modes[mode].color }}
                        >
                            <Radio size={14} />
                            <div className="flex flex-col items-start">
                                <span className="text-[8px] opacity-50">重力设置 [点击]</span>
                                <span className="font-bold">{modes[mode].label}</span>
                            </div>
                        </button>
                    </div>
                </Html>
            )}
            
            <Text position={[0, 2.5, 0]} fontSize={0.3} color={modes[mode].color}>重力控制台</Text>
        </group>
    );
};
