
import React from 'react';
import { InventoryItem } from '../types';
import { Backpack as BackpackIcon, X } from 'lucide-react';

interface BackpackProps {
    items: InventoryItem[];
    isOpen: boolean;
    onClose: () => void;
}

export const Backpack: React.FC<BackpackProps> = ({ items, isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="absolute right-4 top-20 w-64 bg-black/90 border border-[#00ffcc] text-white p-4 clip-path-polygon backdrop-blur-md z-40 shadow-[0_0_20px_rgba(0,255,204,0.1)] font-mono">
            <div className="flex justify-between items-center mb-4 border-b border-[#00ffcc]/30 pb-2">
                <div className="flex items-center gap-2 text-[#00ffcc]">
                    <BackpackIcon size={18} />
                    <h2 className="font-bold tracking-widest text-sm uppercase">Inventory</h2>
                </div>
                <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                    <X size={16} />
                </button>
            </div>

            {items.length === 0 ? (
                <div className="text-xs text-white/30 font-mono text-center py-4 italic">
                    CONTAINER EMPTY...
                </div>
            ) : (
                <div className="grid grid-cols-4 gap-2">
                    {items.map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className="aspect-square bg-[#111] border border-white/10 hover:border-[#00ffcc] flex items-center justify-center text-xl cursor-help relative group transition-colors">
                            {item.icon}
                            {/* Tooltip */}
                            <div className="absolute right-0 bottom-full mb-2 w-32 bg-[#222] border border-white/20 p-2 hidden group-hover:block z-50 pointer-events-none shadow-lg">
                                <div className="text-[#00ffcc] text-[10px] font-bold uppercase">{item.name}</div>
                                {item.description && <div className="text-[9px] text-white/60 leading-tight mt-1">{item.description}</div>}
                            </div>
                        </div>
                    ))}
                    {/* Fill empty slots */}
                    {[...Array(Math.max(0, 8 - items.length))].map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square bg-[#050505] border border-white/5" />
                    ))}
                </div>
            )}
            
            <div className="mt-4 text-[9px] text-[#00ffcc]/50 font-mono uppercase text-right">
                CAPACITY: {items.length}/8
            </div>
        </div>
    );
};
