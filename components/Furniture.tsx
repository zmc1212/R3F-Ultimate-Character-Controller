
import React, { useState, useRef } from 'react';
import { Html, Box } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { Armchair } from 'lucide-react';

interface ChairProps {
    position: [number, number, number];
    rotation?: [number, number, number];
    onInteract: (entryPos: THREE.Vector3, sitPos: THREE.Vector3, sitRot: number) => void;
}

export const Chair: React.FC<ChairProps> = ({ position, rotation = [0, 0, 0], onInteract }) => {
    const [hovered, setHovered] = useState(false);
    const groupRef = useRef<THREE.Group>(null);

    const handleClick = (e: any) => {
        e.stopPropagation();
        
        if (!groupRef.current) return;

        // Get World Position
        const worldPos = new THREE.Vector3();
        groupRef.current.getWorldPosition(worldPos);

        // Get World Rotation Quaternion
        const worldQuat = new THREE.Quaternion();
        groupRef.current.getWorldQuaternion(worldQuat);

        // Calculate Forward Direction based on World Quaternion
        // Assuming the chair model's local +Z is "forward" (legs are at +/- X, backrest at -Z)
        const forwardDir = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuat);
        
        // Calculate Rotation Angle from the forward vector
        // Math.atan2(x, z) gives the angle relative to the Z axis in 3D space for Y-rotation
        const rotY = Math.atan2(forwardDir.x, forwardDir.z);
        
        // Calculate Entry Point (1.0 unit in front of the chair)
        const entryPos = worldPos.clone().add(forwardDir.clone().multiplyScalar(1.0));
        entryPos.y += 0.1;
        
        // Calculate Sit Position (Floor level)
        // Set to slightly above 0 (0.05) to align feet with ground
        const sitPos = worldPos.clone().add(new THREE.Vector3(0, 0.05, 0));

        onInteract(entryPos, sitPos, rotY);
    };

    return (
        <group ref={groupRef} position={position} rotation={rotation}>
            <RigidBody type="fixed" colliders="hull">
                <group 
                    onClick={handleClick} 
                    onPointerOver={() => setHovered(true)} 
                    onPointerOut={() => setHovered(false)}
                >
                    {/* Seat */}
                    <Box args={[0.6, 0.1, 0.6]} position={[0, 0.4, 0]}>
                        <meshStandardMaterial color={hovered ? "#00ffcc" : "#333"} />
                    </Box>
                    {/* Backrest */}
                    <Box args={[0.6, 0.6, 0.1]} position={[0, 0.9, -0.25]}>
                         <meshStandardMaterial color={hovered ? "#00ffcc" : "#333"} />
                    </Box>
                    {/* Legs */}
                    <Box args={[0.05, 0.4, 0.05]} position={[-0.25, 0.2, -0.25]}><meshStandardMaterial color="#222" /></Box>
                    <Box args={[0.05, 0.4, 0.05]} position={[0.25, 0.2, -0.25]}><meshStandardMaterial color="#222" /></Box>
                    <Box args={[0.05, 0.4, 0.05]} position={[-0.25, 0.2, 0.25]}><meshStandardMaterial color="#222" /></Box>
                    <Box args={[0.05, 0.4, 0.05]} position={[0.25, 0.2, 0.25]}><meshStandardMaterial color="#222" /></Box>
                </group>
            </RigidBody>

            {hovered && (
                 <Html position={[0, 1.5, 0]} center zIndexRange={[100, 0]}>
                     <div className="flex flex-col items-center pointer-events-none">
                        <div className="bg-black/90 border border-[#00ffcc] text-[#00ffcc] text-[10px] px-2 py-1 uppercase tracking-widest flex items-center gap-2 shadow-[0_0_10px_#00ffcc]">
                            <Armchair size={12} /> Interact
                        </div>
                        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-[#00ffcc]"></div>
                     </div>
                 </Html>
            )}
        </group>
    );
};
