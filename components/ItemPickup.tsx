
import React, { useState, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { Html, Text } from '@react-three/drei';
import * as THREE from 'three';
import { Package } from 'lucide-react';
import { InventoryItem } from '../types';

interface ItemPickupProps {
    item: InventoryItem;
    position: [number, number, number];
    onPickup: (item: InventoryItem) => void;
}

export const ItemPickup: React.FC<ItemPickupProps> = ({ item, position, onPickup }) => {
    const [hovered, setHovered] = useState(false);
    const [isNear, setIsNear] = useState(false);
    const meshRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (meshRef.current) {
            const t = state.clock.getElapsedTime();
            meshRef.current.position.y = Math.sin(t * 2) * 0.1;
            meshRef.current.rotation.y += 0.02;
        }
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isNear && (e.key === 'e' || e.key === 'E')) {
                onPickup(item);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isNear, item, onPickup]);

    return (
        <group position={position}>
            <RigidBody type="fixed" sensor onIntersectionEnter={({ other }) => {
                if (other.rigidBody && !other.rigidBody.isFixed()) setIsNear(true);
            }} onIntersectionExit={() => setIsNear(false)}>
                <CuboidCollider args={[0.5, 0.5, 0.5]} />
            </RigidBody>

            <group ref={meshRef} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
                {/* Item Visual - Glowing Box for now */}
                <mesh castShadow>
                    <boxGeometry args={[0.4, 0.4, 0.4]} />
                    <meshStandardMaterial
                        color="#ff00ff"
                        emissive="#ff00ff"
                        emissiveIntensity={hovered ? 2 : 1}
                        toneMapped={false}
                    />
                </mesh>

                {/* Icon/Text */}
                <Text
                    position={[0, 0.5, 0]}
                    fontSize={0.2}
                    color="#ff00ff"
                    anchorY="bottom"
                    font={"/fonts/st.otf"}
                >
                    {item.icon}
                </Text>
            </group>

            {isNear && (
                <Html position={[0, 1, 0]} center zIndexRange={[100, 0]}>
                    <div className="flex flex-col items-center pointer-events-none whitespace-nowrap">
                        <div className="bg-black/80 border border-[#ff00ff] text-[#ff00ff] px-2 py-1 rounded font-mono text-xs flex items-center gap-2 backdrop-blur-md animate-pulse">
                            <Package size={14} />
                            <span className="font-bold tracking-widest">拾取 {item.name.toUpperCase()} [E]</span>
                        </div>
                        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-[#ff00ff] mt-1"></div>
                    </div>
                </Html>
            )}
        </group>
    );
};
