import React, { Suspense, useMemo, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import { io, Socket } from 'socket.io-client';
import { Controls, ControlMode, PlayerData, ChatMessage } from './types';
import { Experience } from './components/Experience';
import { Interface } from './components/Interface';

const App: React.FC = () => {
  const [controlMode, setControlMode] = useState<ControlMode>('direct');
  
  // App State
  const [playerName, setPlayerName] = useState<string>('');
  const [isJoined, setIsJoined] = useState(false);
  
  // Multiplayer State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<Record<string, PlayerData>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

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

  // Initialize Socket connection
  useEffect(() => {
    const newSocket = io('http://localhost:3000', {
        reconnectionAttempts: 5,
        transports: ['websocket'],
        autoConnect: false // Wait until user joins
    });

    newSocket.on('connect', () => {
        console.log('Connected to server with ID:', newSocket.id);
    });

    newSocket.on('init', (serverPlayers: Record<string, PlayerData>) => {
        const otherPlayers = { ...serverPlayers };
        delete otherPlayers[newSocket.id as string];
        setPlayers(otherPlayers);
    });

    newSocket.on('playerJoined', (player: PlayerData) => {
        if (player.id !== newSocket.id) {
            setPlayers((prev) => ({ ...prev, [player.id as string]: player }));
        }
    });

    newSocket.on('playerMoved', (player: PlayerData) => {
        setPlayers((prev) => ({
            ...prev,
            [player.id as string]: { ...prev[player.id as string], ...player }
        }));
    });

    newSocket.on('playerLeft', (id: string) => {
        setPlayers((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    });

    newSocket.on('chat', (message: ChatMessage) => {
        setChatMessages(prev => [...prev.slice(-49), message]); // Keep last 50
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
            camera={{ position: [0, 5, 8], fov: 45 }}
            className="w-full h-full bg-[#111]"
          >
            <Suspense fallback={null}>
              {isJoined && (
                  <Experience 
                    controlMode={controlMode} 
                    socket={socket}
                    players={players}
                    playerName={playerName}
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
          />
        </div>
      </KeyboardControls>
    </>
  );
};

export default App;