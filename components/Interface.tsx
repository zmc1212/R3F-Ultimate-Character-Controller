import React from 'react';
import { ControlMode } from '../types';
import { MousePointer2, Gamepad2 } from 'lucide-react';

interface InterfaceProps {
  controlMode: ControlMode;
  setControlMode: (mode: ControlMode) => void;
}

export const Interface: React.FC<InterfaceProps> = ({ controlMode, setControlMode }) => {
  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none p-8 flex flex-col justify-between z-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold text-white tracking-tighter drop-shadow-md">
          R3F Controller
        </h1>
        <p className="text-white/60 text-sm max-w-md">
          A physics-based character controller built with React Three Fiber and Rapier.
        </p>
      </div>

      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-4">
          
          {/* Mode Switcher */}
          <div className="bg-black/30 backdrop-blur-md p-2 rounded-xl border border-white/10 flex gap-2 pointer-events-auto">
            <button
              onClick={() => setControlMode('direct')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                controlMode === 'direct' 
                  ? 'bg-white text-black shadow-lg' 
                  : 'text-white/50 hover:text-white hover:bg-white/10'
              }`}
            >
              <Gamepad2 size={16} /> Direct
            </button>
            <button
              onClick={() => setControlMode('pointToClick')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                controlMode === 'pointToClick' 
                  ? 'bg-white text-black shadow-lg' 
                  : 'text-white/50 hover:text-white hover:bg-white/10'
              }`}
            >
              <MousePointer2 size={16} /> Click
            </button>
          </div>

          <div className="bg-black/30 backdrop-blur-md p-4 rounded-xl border border-white/10 text-white/80 max-w-xs transition-opacity duration-300">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3">Controls</h3>
            
            {controlMode === 'direct' ? (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex gap-1">
                    <Kbd>W</Kbd><Kbd>A</Kbd><Kbd>S</Kbd><Kbd>D</Kbd>
                  </div>
                  <span className="text-sm">Move</span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <Kbd className="w-16">Shift</Kbd>
                  <span className="text-sm">Run</span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <Kbd className="w-24">Space</Kbd>
                  <span className="text-sm">Jump</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <MousePointer2 size={20} className="text-white" />
                  <span className="text-sm">Left Click Ground to Move</span>
                </div>
              </>
            )}
            
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/10 text-white/60">
                <span className="text-xs border border-white/20 rounded px-1.5 py-0.5">R-Click + Drag</span>
                <span className="text-xs">Rotate Camera</span>
            </div>
          </div>
        </div>
        
        <div className="text-right text-white/30 text-xs">
           Model: X Bot by Mixamo / Three.js<br/>
           Engine: R3F + Rapier
        </div>
      </div>
    </div>
  );
};

const Kbd: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`h-8 w-8 flex items-center justify-center rounded bg-white/10 border-b-2 border-white/20 text-xs font-bold font-mono ${className}`}>
    {children}
  </div>
);