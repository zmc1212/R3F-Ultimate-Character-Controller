import React, { useState, useRef, useEffect } from 'react';
import { ControlMode, ChatMessage } from '../types';
import { MousePointer2, Gamepad2, Send, Power, Terminal } from 'lucide-react';

interface InterfaceProps {
  controlMode: ControlMode;
  setControlMode: (mode: ControlMode) => void;
  isJoined: boolean;
  onJoin: (name: string) => void;
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
  currentPlayerName: string;
}

// Helper component for keyboard keys
const Kbd = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`h-5 w-5 flex items-center justify-center bg-white/10 border border-white/20 text-[10px] font-bold text-[#00ffcc] ${className}`}>
    {children}
  </div>
);

export const Interface = ({ 
  controlMode, 
  setControlMode, 
  isJoined, 
  onJoin,
  chatMessages,
  onSendMessage,
  currentPlayerName
}: InterfaceProps) => {
  const [nameInput, setNameInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const submitJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      onJoin(nameInput);
    }
  };

  const submitChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
        onSendMessage(chatInput);
        setChatInput('');
    }
  };

  if (!isJoined) {
    return (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
            <div className="bg-[#111] border border-[#00ffcc] p-8 max-w-md w-full shadow-[0_0_20px_rgba(0,255,204,0.2)] clip-path-polygon">
                <div className="flex items-center gap-3 mb-6 text-[#00ffcc]">
                    <Terminal size={32} />
                    <h1 className="text-2xl font-bold tracking-widest uppercase">System Login</h1>
                </div>
                <form onSubmit={submitJoin} className="flex flex-col gap-4">
                    <div className="relative">
                        <label className="text-xs text-[#00ffcc]/70 uppercase tracking-widest mb-1 block">Identity_String</label>
                        <input 
                            type="text" 
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            placeholder="ENTER USERNAME..."
                            maxLength={12}
                            className="w-full bg-[#050505] border-2 border-[#333] focus:border-[#00ffcc] text-white p-3 font-mono outline-none transition-colors placeholder:text-[#333]"
                            autoFocus
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={!nameInput.trim()}
                        className="bg-[#00ffcc] text-black font-bold py-3 uppercase tracking-widest hover:bg-[#00ffcc]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        <Power size={18} /> Initialize
                    </button>
                </form>
                <div className="mt-6 text-xs text-[#444] font-mono border-t border-[#222] pt-4">
                    {'>'} CONNECTING TO NEURAL NET...<br/>
                    {'>'} WAITING FOR INPUT...
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none p-6 flex flex-col justify-between z-10 font-mono">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="bg-[#111]/80 backdrop-blur border-l-4 border-[#00ffcc] p-4 text-white">
            <h1 className="text-2xl font-bold leading-none tracking-tighter text-[#00ffcc]">
            CYBER_CONTROLLER_V3
            </h1>
            <p className="text-xs text-white/50 mt-1 uppercase tracking-widest">
            OPERATOR: {currentPlayerName}
            </p>
        </div>
      </div>

      <div className="flex items-end justify-between w-full gap-8">
        {/* Left: Controls & Stats */}
        <div className="flex flex-col gap-4 pointer-events-auto">
          
          {/* Mode Switcher */}
          <div className="bg-[#111]/80 backdrop-blur border border-white/10 p-1 flex gap-1 rounded-sm">
            <button
              onClick={() => setControlMode('direct')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all ${
                controlMode === 'direct' 
                  ? 'bg-[#00ffcc] text-black' 
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Gamepad2 size={14} /> Direct
            </button>
            <button
              onClick={() => setControlMode('pointToClick')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all ${
                controlMode === 'pointToClick' 
                  ? 'bg-[#00ffcc] text-black' 
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <MousePointer2 size={14} /> Auto_Nav
            </button>
          </div>

          {/* Key Hints */}
          <div className="bg-[#111]/80 backdrop-blur border border-white/10 p-4 text-white/80 w-64">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#00ffcc] mb-3 border-b border-white/10 pb-2">Control_Schematic</h3>
            
            {controlMode === 'direct' ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                 <div className="flex items-center gap-2"><Kbd>W</Kbd> FWD</div>
                 <div className="flex items-center gap-2"><Kbd>S</Kbd> BWD</div>
                 <div className="flex items-center gap-2"><Kbd>A</Kbd> LEFT</div>
                 <div className="flex items-center gap-2"><Kbd>D</Kbd> RIGHT</div>
                 <div className="col-span-2 flex items-center gap-2 mt-2"><Kbd className="w-12">SPACE</Kbd> JUMP_THRUST</div>
                 <div className="col-span-2 flex items-center gap-2"><Kbd className="w-12">SHIFT</Kbd> OVERDRIVE</div>
              </div>
            ) : (
              <div className="text-xs space-y-2">
                 <div className="flex items-center gap-2 text-[#00ffcc]">
                    <MousePointer2 size={14} /> NAVIGATE
                 </div>
                 <p className="text-white/50 text-[10px]">CLICK TERRAIN TO DESIGNATE WAYPOINT.</p>
              </div>
            )}
            
            <div className="mt-3 pt-3 border-t border-white/10 text-[10px] text-white/40 uppercase">
                R-CLICK + DRAG TO ROTATE CAM
            </div>
          </div>
        </div>

        {/* Right: Chat Terminal */}
        <div className="bg-[#111]/90 backdrop-blur border border-white/10 w-80 h-64 flex flex-col pointer-events-auto shadow-2xl">
            <div className="bg-[#222] px-3 py-1 text-[10px] text-white/50 uppercase tracking-widest border-b border-white/10 flex justify-between">
                <span>COMMS_CHANNEL_01</span>
                <span className="text-[#00ffcc] animate-pulse">● LIVE</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
                {chatMessages.length === 0 && (
                    <div className="text-white/20 italic text-center mt-10">NO SIGNAL...</div>
                )}
                {chatMessages.map((msg) => (
                    <div key={msg.id} className="break-words">
                        <span className={`font-bold ${msg.senderId === 'system' ? 'text-yellow-500' : 'text-[#00ffcc]'}`}>
                            [{msg.senderName}]:
                        </span>{' '}
                        <span className="text-white/80">{msg.text}</span>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>

            <form onSubmit={submitChat} className="border-t border-white/10 p-2 flex gap-2 bg-[#000]">
                <input 
                    className="flex-1 bg-transparent border-none outline-none text-white text-xs placeholder:text-white/20 font-mono"
                    placeholder="TRANSMIT MESSAGE..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                />
                <button type="submit" className="text-[#00ffcc] hover:text-white transition-colors">
                    <Send size={14} />
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};
