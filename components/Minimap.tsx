import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Navigation } from 'lucide-react';

interface MinimapProps {
    playerPosRef: React.MutableRefObject<{ position: THREE.Vector3; rotation: number }>;
    mapSize?: number; 
    margin?: number;
    worldSize?: number; // Total size of the world area to map (e.g., 100 units)
}

export const Minimap: React.FC<MinimapProps> = ({ 
    playerPosRef, 
    mapSize = 200, 
    margin = 30,
    worldSize = 100 
}) => {
    const playerDotRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let rAFId: number;

        const update = () => {
            if (playerPosRef.current && playerDotRef.current) {
                const { position, rotation } = playerPosRef.current;
                // console.log('playerPosRef.current',playerPosRef.current)
                // Map world pos (-50 to 50) to percentage (0 to 100)
                // Assuming world is centered at 0,0. World coordinates: -50 (Left) to +50 (Right)
                const x = (position.x + worldSize / 2) / worldSize * 100;
                const z = (position.z + worldSize / 2) / worldSize * 100;
                
                // In 3D: -Z is North/Up, +Z is South/Down. +X is East/Right, -X is West/Left.
                // In CSS: Top is 0%, Bottom is 100%. Left is 0%, Right is 100%.
                // So Z corresponds to Top (vertical axis).
                
                playerDotRef.current.style.left = `${Math.max(0, Math.min(100, x))}%`;
                playerDotRef.current.style.top = `${Math.max(0, Math.min(100, z))}%`;
                
                // Rotation: 
                // 3D rotation Y is 0 facing South-ish or North? 
                // Character.tsx: atan2(moveX, moveZ).
                // atan2(0, 1) = 0 (Facing Z+) -> Down in Map
                // atan2(1, 0) = PI/2 (Facing X+) -> Right in Map
                // CSS Rotate: 0deg points UP usually? No, it rotates the element.
                // Our SVG Arrow points UP by default.
                // If Rot=0 (Z+), we want arrow pointing DOWN (180deg).
                // If Rot=PI/2 (X+), we want arrow pointing RIGHT (90deg).
                // CSS Rotate(0) -> Up.
                // Formula: -rotation (convert CCW to CW) + Offset?
                // Let's test: 
                // If Rot = 0 (Facing Z+/South), we want 180deg.
                // If Rot = PI (Facing Z-/North), we want 0deg.
                // If Rot = PI/2 (Facing X+/East), we want 90deg.
                // Angle = Rot * (180/PI).
                // 0 -> 0. Wait.
                // Character atan2(x, z): 0,1 -> 0. 1,0 -> PI/2.
                // Map: Z+ is Down (180), X+ is Right (90).
                // So if input is 0, output 180. If input 90, output 90? No.
                // atan2(x, z) means 0 is (0,1) i.e. Z+.
                // In map, Z+ is Down (180deg).
                // So CSS Rotation = Rotation (rads) -> Deg. 
                // If rot=0, deg=0. But we want 180.
                // If rot=PI, deg=180. We want 0.
                // So maybe 180 - (rot * 180/PI)? Or just -rot?
                // Let's try: transform: rotate(-rot rad + 180deg)
                
                playerDotRef.current.style.transform = `translate(-50%, -50%) rotate(${-rotation}rad) rotate(180deg)`;
            }
            rAFId = requestAnimationFrame(update);
        };

        update();
        return () => cancelAnimationFrame(rAFId);
    }, [worldSize, playerPosRef]);

    return (
        <div 
            style={{
                position: 'absolute',
                right: margin,
                top: margin,
                width: mapSize,
                height: mapSize,
                backgroundColor: 'rgba(0, 20, 10, 0.8)',
                border: '2px solid #00ffcc',
                borderRadius: '12px',
                boxShadow: '0 0 15px rgba(0, 255, 204, 0.2)',
                overflow: 'hidden',
                clipPath: 'polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)',
                zIndex: 50,
                pointerEvents: 'none'
            }}
        >
            {/* Map Background / Grid */}
            <div className="absolute inset-0 opacity-20" 
                 style={{ 
                     backgroundImage: 'linear-gradient(#00ffcc 1px, transparent 1px), linear-gradient(90deg, #00ffcc 1px, transparent 1px)',
                     backgroundSize: '20px 20px'
                 }} 
            />

            {/* Static Landmarks (Simplified representation of world objects) */}
            
            {/* Conference Room (approx at 20, 0) */}
            <div className="absolute w-8 h-6 bg-[#00ffcc] opacity-30 border border-[#00ffcc]" 
                 style={{ left: `${(20 + 50)/100*100}%`, top: `${(0 + 50)/100*100}%`, transform: 'translate(-50%, -50%)' }} 
                 title="Conference Room"
            />

            {/* Player Marker (Arrow) */}
            <div 
                ref={playerDotRef}
                className="absolute z-10 text-[#00ffcc] flex items-center justify-center w-4 h-4"
                style={{ transformOrigin: 'center center' }}
            >
                <Navigation size={16} fill="#00ffcc" />
            </div>

            <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[#00ffcc] font-bold text-xs font-mono">N</div>
        </div>
    );
};