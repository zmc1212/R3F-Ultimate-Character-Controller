
import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Cylinder, Box } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';

export const JumpPad = ({ position }: { position: [number, number, number] }) => {
  const [active, setActive] = useState(false);
  const timeRef = useRef(0);

  useFrame((state, delta) => {
    if (active) {
        timeRef.current += delta * 10;
        if (timeRef.current > 1) {
            setActive(false);
            timeRef.current = 0;
        }
    }
  });

  return (
    <group position={position}>
        <RigidBody
            type="fixed"
            colliders="hull"
            restitution={1} // Bouncy
            onCollisionEnter={({ other }) => {
                if (other.rigidBody && !other.rigidBody.isFixed()) {
                    // Apply strong upward impulse
                    other.rigidBody.applyImpulse({ x: 0, y: 2, z: 0 }, true);
                    setActive(true);
                }
            }}
        >
            <Cylinder args={[1.5, 1.5, 0.2, 32]} receiveShadow>
                <meshStandardMaterial
                    color={active ? "#ffffff" : "#00ffcc" }
                    emissive="#00ffcc"
                    emissiveIntensity={active ? 5 : 1}
                    toneMapped={false}
                />
            </Cylinder>
        </RigidBody>
        
        {/* Holographic Ring Effect */}
        <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.2, 1.4, 32]} />
            <meshBasicMaterial color="#00ffcc" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
        
        {/* Floating Text */}
        <group position={[0, 1, 0]}>
             <mesh visible={false}>
                <boxGeometry />
             </mesh>
        </group>
    </group>
  );
};

const DiscoTile = ({ position }: { position: [number, number, number] }) => {
    const materialRef = useRef<THREE.MeshStandardMaterial>(null);
    const colorRef = useRef(new THREE.Color(0.1, 0.1, 0.1));
    const targetColor = useRef(new THREE.Color(0.1, 0.1, 0.1));

    useFrame((state, delta) => {
        if (materialRef.current) {
             // Fade out logic
             colorRef.current.lerp(targetColor.current, delta * 2); // Lerp towards target
             targetColor.current.lerp(new THREE.Color(0.05, 0.05, 0.05), delta * 0.5); // Target slowly fades to black
             
             materialRef.current.color.copy(colorRef.current);
             materialRef.current.emissive.copy(colorRef.current);
        }
    });

    const handleEnter = () => {
        // Random Neon Color
        const hue = Math.random();
        colorRef.current.setHSL(hue, 1, 0.6);
        targetColor.current.setHSL(hue, 1, 0.2);
    }

    return (
        <RigidBody type="fixed" sensor onIntersectionEnter={handleEnter} position={position}>
            <Box args={[1.9, 0.1, 1.9]} receiveShadow>
                <meshStandardMaterial 
                    ref={materialRef} 
                    color="#111" 
                    roughness={0.2}
                    metalness={0.8}
                    emissiveIntensity={2}
                />
            </Box>
        </RigidBody>
    )
}

export const DiscoFloor = ({ position, rows = 4, cols = 4 }: { position: [number, number, number], rows?: number, cols?: number }) => {
    const tiles = useMemo(() => {
        const t = [];
        for(let i=0; i<rows; i++) {
            for(let j=0; j<cols; j++) {
                t.push({
                    x: (i - rows/2) * 2,
                    z: (j - cols/2) * 2
                });
            }
        }
        return t;
    }, [rows, cols]);

    return (
        <group position={position}>
            {tiles.map((t, idx) => (
                <DiscoTile key={idx} position={[t.x, 0, t.z]} />
            ))}
            {/* Border */}
            <mesh rotation={[-Math.PI/2, 0, 0]} position={[-1, -0.04, -1]}>
                <planeGeometry args={[rows * 2 + 0.2, cols * 2 + 0.2]} />
                <meshStandardMaterial color="#333" />
            </mesh>
        </group>
    );
};
