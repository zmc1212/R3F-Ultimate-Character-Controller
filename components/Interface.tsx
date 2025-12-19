
import React, { useState, useRef, useEffect } from 'react';
import { ControlMode, ChatMessage, InventoryItem } from '../types';
import { MousePointer2, Gamepad2, Send, Power, Terminal, Backpack as BackpackIcon, Music, Hand, SkipForward, Camera } from 'lucide-react';
import { Backpack } from './Backpack';

interface InterfaceProps {
  controlMode: ControlMode;
  setControlMode: (mode: ControlMode) => void;
  isJoined: boolean;
  onJoin: (name: string) => void;
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
  currentPlayerName: string;
  inventory?: InventoryItem[]; 
  onEmote?: (emote: string | null) => void;
  isRoaming?: boolean;
  onSkipRoam?: () => void;
}

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
  currentPlayerName,
  inventory = [],
  onEmote,
  isRoaming = false,
  onSkipRoam
}: InterfaceProps) => {
  const [nameInput, setNameInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isBackpackOpen, setIsBackpackOpen] = useState(false);

  const hasJetpack = inventory.some(i => i.id === 'item-2');

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const submitJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) onJoin(nameInput);
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
            <div className="bg-[#111] border border-[#00ffcc] p-8 max-w-md w-full shadow-[0_0_20px_rgba(0,255,204,0.2)] clip-path-polygon font-mono">
                <div className="flex items-center gap-3 mb-6 text-[#00ffcc]">
                    <Terminal size={32} />
                    <h1 className="text-2xl font-bold tracking-widest uppercase text-shadow-glow">系统登录</h1>
                </div>
                <form onSubmit={submitJoin} className="flex flex-col gap-4">
                    <div className="relative">
                        <label className="text-xs text-[#00ffcc]/70 uppercase tracking-widest mb-1 block">身份标识</label>
                        <input 
                            type="text" 
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            placeholder="输入用户名..."
                            maxLength={12}
                            className="w-full bg-[#050505] border-2 border-[#333] focus:border-[#00ffcc] text-white p-3 font-mono outline-none transition-colors placeholder:text-[#333]"
                            autoFocus
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="bg-[#00ffcc] text-black font-bold py-3 uppercase tracking-widest hover:bg-[#00ffcc]/80 transition-all flex items-center justify-center gap-2"
                    >
                        <Power size={18} /> 初始化系统
                    </button>
                </form>
            </div>
        </div>
    );
  }

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none p-6 flex flex-col justify-between z-10 font-mono">
      {/* 漫游覆盖层 */}
      {isRoaming && (
        <div className="absolute inset-0 bg-black/20 pointer-events-none flex flex-col items-center justify-center z-50">
          <div className="absolute top-10 flex flex-col items-center gap-2">
            <div className="flex items-center gap-3 text-[#00ffcc] bg-black/60 px-6 py-3 border-y border-[#00ffcc]/30 backdrop-blur-md">
              <Camera className="animate-pulse" />
              <h2 className="text-xl font-bold tracking-[0.3em] uppercase">场景漫游中...</h2>
            </div>
          </div>
          <div className="absolute bottom-10 pointer-events-auto">
            <button 
              onClick={onSkipRoam}
              className="group flex items-center gap-3 bg-[#00ffcc] text-black px-8 py-3 font-bold uppercase tracking-widest hover:bg-white transition-all shadow-[0_0_15px_rgba(0,255,204,0.5)]"
            >
              跳过漫游 <SkipForward size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-10 items-start">
        <div className="bg-[#111]/80 backdrop-blur border-l-4 border-[#00ffcc] p-4 text-white">
            <h1 className="text-2xl font-bold leading-none tracking-tighter text-[#00ffcc]">虚拟空间_V3</h1>
            <p className="text-xs text-white/50 mt-1 uppercase tracking-widest">当前用户: {currentPlayerName}</p>
        </div>
        {!isRoaming && (
          <div className="pointer-events-auto">
               <button onClick={() => setIsBackpackOpen(!isBackpackOpen)} className={`flex flex-col items-center gap-1 p-3 border ${isBackpackOpen ? 'bg-[#00ffcc] text-black border-[#00ffcc]' : 'bg-[#111]/80 border-white/20 text-[#00ffcc]'} transition-all rounded-sm backdrop-blur`}>
                  <BackpackIcon size={24} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">背包</span>
               </button>
          </div>
        )}
      </div>
      
      {!isRoaming && (
        <div className="pointer-events-auto">
            <Backpack items={inventory} isOpen={isBackpackOpen} onClose={() => setIsBackpackOpen(false)} />
        </div>
      )}

      {!isRoaming && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-auto bg-[#111]/90 p-2 rounded-full border border-white/10 backdrop-blur">
            <button onClick={() => onEmote?.('Dance')} className="w-10 h-10 rounded-full bg-white/5 hover:bg-[#00ffcc] hover:text-black text-white flex items-center justify-center transition-all border border-white/10" title="跳舞"><Music size={18} /></button>
            <button onClick={() => onEmote?.('Wave')} className="w-10 h-10 rounded-full bg-white/5 hover:bg-[#00ffcc] hover:text-black text-white flex items-center justify-center transition-all border border-white/10" title="挥手"><Hand size={18} /></button>
            <div className="w-px h-6 bg-white/20 mx-1"></div>
            <div className={`flex flex-col items-center px-3 ${hasJetpack ? 'text-[#00ffcc]' : 'text-white/30'}`}>
                <span className="text-[9px] font-bold uppercase tracking-widest">喷气背包</span>
                <div className="flex gap-1 mt-1">
                    <div className={`w-2 h-2 rounded-full ${hasJetpack ? 'bg-[#00ffcc] animate-pulse' : 'bg-white/20'}`} />
                </div>
            </div>
        </div>
      )}

      {!isRoaming && (
        <div className="flex items-end justify-between w-full gap-8">
          <div className="flex flex-col gap-4 pointer-events-auto">
            <div className="bg-[#111]/80 backdrop-blur border border-white/10 p-1 flex gap-1 rounded-sm">
              <button onClick={() => setControlMode('direct')} className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all ${controlMode === 'direct' ? 'bg-[#00ffcc] text-black' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                <Gamepad2 size={14} /> 直接控制
              </button>
              <button onClick={() => setControlMode('pointToClick')} className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all ${controlMode === 'pointToClick' ? 'bg-[#00ffcc] text-black' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                <MousePointer2 size={14} /> 自动导航
              </button>
            </div>

            <div className="bg-[#111]/80 backdrop-blur border border-white/10 p-4 text-white/80 w-64">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#00ffcc] mb-3 border-b border-white/10 pb-2">操作说明</h3>
              {controlMode === 'direct' ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                   <div className="flex items-center gap-2"><Kbd>W</Kbd> 前进</div>
                   <div className="flex items-center gap-2"><Kbd>S</Kbd> 后退</div>
                   <div className="flex items-center gap-2"><Kbd>A</Kbd> 左移</div>
                   <div className="flex items-center gap-2"><Kbd>D</Kbd> 右移</div>
                   <div className="col-span-2 flex items-center gap-2 mt-2"><Kbd className="w-12">空格</Kbd> 跳跃/飞行</div>
                   <div className="col-span-2 flex items-center gap-2"><Kbd className="w-12">Shift</Kbd> 加速奔跑</div>
                   <div className="col-span-2 flex items-center gap-2 mt-1 text-[#00ffcc]"><Kbd className="w-12 border-[#00ffcc]">E</Kbd> 交互</div>
                </div>
              ) : (
                <div className="text-xs space-y-2">
                   <div className="flex items-center gap-2 text-[#00ffcc]"><MousePointer2 size={14} /> 导航模式</div>
                   <p className="text-white/50 text-[10px]">点击地面任意位置，角色将自动寻路前往。</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#111]/90 backdrop-blur border border-white/10 w-80 h-64 flex flex-col pointer-events-auto shadow-2xl">
              <div className="bg-[#222] px-3 py-1 text-[10px] text-white/50 uppercase tracking-widest border-b border-white/10 flex justify-between">
                  <span>通讯频道_01</span>
                  <span className="text-[#00ffcc] animate-pulse">● 连线中</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
                  {chatMessages.length === 0 && <div className="text-white/20 italic text-center mt-10">暂无信号...</div>}
                  {chatMessages.map((msg) => (
                      <div key={msg.id} className="break-words">
                          <span className={`font-bold ${msg.senderId === 'system' ? 'text-yellow-500' : 'text-[#00ffcc]'}`}>[{msg.senderName}]:</span> <span className="text-white/80">{msg.text}</span>
                      </div>
                  ))}
                  <div ref={chatEndRef} />
              </div>
              <form onSubmit={submitChat} className="border-t border-white/10 p-2 flex gap-2 bg-[#000]">
                  <input className="flex-1 bg-transparent border-none outline-none text-white text-xs placeholder:text-white/20 font-mono" placeholder="发送消息..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
                  <button type="submit" className="text-[#00ffcc] hover:text-white transition-colors"><Send size={14} /></button>
              </form>
          </div>
        </div>
      )}
    </div>
  );
};
