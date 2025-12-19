
import React, { Suspense, useMemo, useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import { io, Socket } from 'socket.io-client';
import { Controls, ControlMode, PlayerData, ChatMessage, InventoryItem } from './types';
import { Experience } from './components/Experience';
import { Interface } from './components/Interface';
import { Minimap } from './components/Minimap';
import * as THREE from 'three';

const App: React.FC = () => {
  const [controlMode, setControlMode] = useState<ControlMode>('direct');
  
  // App State
  const [playerName, setPlayerName] = useState<string>('');
  const [isJoined, setIsJoined] = useState(false);
  const [isRoaming, setIsRoaming] = useState(false); // 新增：相机漫游状态
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  
  // Multiplayer State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<Record<string, PlayerData>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Shared Ref for Player Position & Rotation
  const playerPosRef = useRef({ position: new THREE.Vector3(), rotation: 0 });

  // Emote State
  const [currentEmote, setCurrentEmote] = useState<string | null>(null);

  // Keyboard map
  const map = useMemo(
    () => [
      { name: Controls.forward, keys: ['ArrowUp', 'KeyW'] },
      { name: Controls.backward, keys: ['ArrowDown', 'KeyS'] },
      { name: Controls.left, keys: ['ArrowLeft', 'KeyA'] },
      { name: Controls.right, keys: ['ArrowRight', 'KeyD'] },
      { name: Controls.jump, keys: ['Space'] },
      { name: Controls.run, keys: ['Shift'] },
    ],
    []
  );

  useEffect(() => {
    const newSocket = io('http://localhost:3000', {
        reconnectionAttempts: 5,
        transports: ['websocket'],
        autoConnect: false 
    } as any);

    (newSocket as any).on('connect', () => {
        console.log('Connected to server with ID:', newSocket.id);
    });

    (newSocket as any).on('init', (serverPlayers: Record<string, PlayerData>) => {
        const otherPlayers = { ...serverPlayers };
        delete otherPlayers[newSocket.id as string];
        setPlayers(otherPlayers);
    });

    (newSocket as any).on('playerJoined', (player: PlayerData) => {
        if (player.id !== newSocket.id) {
            setPlayers((prev) => ({ ...prev, [player.id as string]: player }));
        }
    });

    (newSocket as any).on('playerMoved', (player: PlayerData) => {
        setPlayers((prev) => ({
            ...prev,
            [player.id as string]: { ...prev[player.id as string], ...player }
        }));
    });

    (newSocket as any).on('playerLeft', (id: string) => {
        setPlayers((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    });

    (newSocket as any).on('chat', (message: ChatMessage) => {
        setChatMessages(prev => [...prev.slice(-49), message]);
    });

    setSocket(newSocket);

    return () => {
        newSocket.disconnect();
    };
  }, []);

  const handleJoin = (name: string) => {
      if (socket && name.trim()) {
          socket.connect();
          socket.emit('join', name);
          setPlayerName(name);
          setIsJoined(true);
          setIsRoaming(true); // 进入游戏开始漫游
      } else if (name.trim()) {
          setPlayerName(name);
          setIsJoined(true);
          setIsRoaming(true); // 离线模式也漫游
      }
  };

  const handleSendMessage = (text: string) => {
      if (socket && socket.connected) {
          socket.emit('chat', text);
      }
  };

  return (
    <>
      <KeyboardControls map={map}>
        <div className="w-full h-full relative" onContextMenu={(e) => e.preventDefault()}>
          <Canvas
            shadows
            camera={{ position: [0, 20, 20], fov: 45 }}
            className="w-full h-full bg-[#111]"
          >
            <Suspense fallback={null}>
              {isJoined && (
                  <Experience 
                    controlMode={controlMode} 
                    socket={socket}
                    players={players}
                    playerName={playerName}
                    playerPosRef={playerPosRef}
                    inventory={inventory}
                    setInventory={setInventory as any}
                    emote={currentEmote}
                    setEmote={setCurrentEmote}
                    isRoaming={isRoaming}
                    setIsRoaming={setIsRoaming}
                  />
              )}
            </Suspense>
          </Canvas>
          
          <Interface 
            controlMode={controlMode} 
            setControlMode={setControlMode} 
            isJoined={isJoined}
            onJoin={handleJoin}
            chatMessages={chatMessages}
            onSendMessage={handleSendMessage}
            currentPlayerName={playerName}
            inventory={inventory}
            onEmote={(emote) => setCurrentEmote(emote)}
            isRoaming={isRoaming}
            onSkipRoam={() => setIsRoaming(false)}
          />

          {isJoined && !isRoaming && (
            <Minimap playerPosRef={playerPosRef} />
          )}
        </div>
      </KeyboardControls>
    </>
  );
};

export default App;
