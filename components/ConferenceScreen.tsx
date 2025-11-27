
import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Html, Text } from '@react-three/drei';
import { Maximize2, Minimize2, MonitorUp, StopCircle, Cast, RefreshCw, Loader2, SignalHigh } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { PlayerData } from '../types';

interface ConferenceScreenProps {
    socket: Socket | null;
    players: Record<string, PlayerData>;
}

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ]
};

export const ConferenceScreen: React.FC<ConferenceScreenProps> = ({ socket, players }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  
  const [isHovered, setIsHovered] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // State for remote sharing
  const [isBroadcaster, setIsBroadcaster] = useState(false);
  const [remoteBroadcasterId, setRemoteBroadcasterId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  
  // WebRTC Refs
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidateQueue = useRef<Record<string, RTCIceCandidate[]>>({});
  const retryTimeoutRef = useRef<any>(null);

  // Initialize Video Element with Loading Listeners
  useEffect(() => {
    const video = document.createElement('video');
    video.muted = true; 
    video.playsInline = true;
    video.autoplay = true;
    video.crossOrigin = "Anonymous";
    
    // Listen for playback state to handle the "black screen" gap
    video.onplaying = () => {
        console.log("Video started playing");
        setIsVideoPlaying(true);
    };
    
    video.onwaiting = () => {
        console.log("Video buffering");
        setIsVideoPlaying(false);
    };

    setVideoElement(video);

    return () => {
      if (video.srcObject) {
        const tracks = (video.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
      video.onplaying = null;
      video.onwaiting = null;
    };
  }, []);

  // Helper: Create Peer Connection
  // Viewer is Initiator (Pull model). Broadcaster is Receiver.
  const createPeerConnection = async (targetId: string, isInitiator: boolean) => {
      if (!socket) return;
      console.log(`Creating PeerConnection to ${targetId} (Initiator: ${isInitiator})`);

      // Close existing if any (cleanup)
      if (peerConnections.current[targetId]) {
          peerConnections.current[targetId].close();
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnections.current[targetId] = pc;

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
          if (event.candidate) {
              socket.emit('signal', { to: targetId, type: 'candidate', payload: event.candidate });
          }
      };

      // Handle Stream (Viewer side)
      pc.ontrack = (event) => {
          const remoteStream = event.streams[0];
          console.log("Received remote track from:", targetId);
          
          if (videoElement && remoteStream) {
              // PREVENT DUPLICATE LOAD: Only apply if it's a new stream reference
              // This prevents AbortError: The play() request was interrupted by a new load request.
              if (videoElement.srcObject !== remoteStream) {
                  console.log("Setting new remote stream to video element");
                  setStream(remoteStream);
                  setIsVideoPlaying(false); // Reset playing state on new stream
                  videoElement.srcObject = remoteStream;
                  videoElement.play().catch(e => {
                      if (e.name !== 'AbortError') console.error("Auto-play failed:", e);
                  });
              }
          }
      };

      // Connection state monitoring
      pc.onconnectionstatechange = () => {
          console.log(`PC State with ${targetId}:`, pc.connectionState);
      };

      // Broadcaster Logic: Add Tracks if we have a stream (regardless of initiator status, but usually Receiver here)
      if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => {
              pc.addTrack(track, localStreamRef.current!);
          });
      }

      // Viewer Logic: We are Initiator, asking for video.
      if (isInitiator) {
          pc.addTransceiver('video', { direction: 'recvonly' });
      }

      // If initiator (Viewer), create offer
      if (isInitiator) {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('signal', { to: targetId, type: 'offer', payload: offer });
          } catch (e) {
              console.error("Error creating offer:", e);
          }
      }

      return pc;
  };

  // Connection Watchdog
  useEffect(() => {
    if (remoteBroadcasterId && !stream && socket) {
        setConnectionStatus('connecting');
        // If we don't get a stream within 5 seconds, retry creating the connection
        retryTimeoutRef.current = setTimeout(() => {
            console.log("Connection timeout, retrying P2P connection...");
            if (remoteBroadcasterId) {
                 createPeerConnection(remoteBroadcasterId, true);
            }
        }, 5000);
    } else if (stream) {
        setConnectionStatus('connected');
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    }
    return () => {
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [remoteBroadcasterId, stream, socket]);

  // --- Socket Event Listeners ---
  useEffect(() => {
      if (!socket) return;

      // Someone started sharing
      const onShareStarted = (broadcasterId: string) => {
          if (broadcasterId !== socket.id) {
            console.log("Remote share started by:", broadcasterId);
            setRemoteBroadcasterId(broadcasterId);
            // Viewer initiates the connection immediately (Pull model)
            createPeerConnection(broadcasterId, true);
          }
      };

      // Someone stopped sharing
      const onShareEnded = () => {
          console.log("Share ended");
          setRemoteBroadcasterId(null);
          setStream(null);
          setIsVideoPlaying(false);
          setConnectionStatus('idle');
          if (videoElement) {
              videoElement.pause();
              videoElement.srcObject = null;
          }
          // Cleanup peers
          Object.values(peerConnections.current).forEach(pc => pc.close());
          peerConnections.current = {};
          iceCandidateQueue.current = {};
      };

      // WebRTC Signal Relay
      const onSignal = async (data: { from: string, type: string, payload: any }) => {
          if (data.from === socket.id) return; // Ignore self

          // If peer connection doesn't exist, we are the Receiver (Broadcaster)
          if (!peerConnections.current[data.from]) {
              await createPeerConnection(data.from, false);
          }

          const pc = peerConnections.current[data.from];

          try {
            if (data.type === 'offer') {
                // Broadcaster receives Offer
                await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('signal', { to: data.from, type: 'answer', payload: answer });
                
                processQueue(pc, data.from);

            } else if (data.type === 'answer') {
                // Viewer receives Answer
                await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
                processQueue(pc, data.from);

            } else if (data.type === 'candidate') {
                const candidate = new RTCIceCandidate(data.payload);
                try {
                    await pc.addIceCandidate(candidate);
                } catch (e) {
                    // Queue if not ready
                    if (!iceCandidateQueue.current[data.from]) {
                        iceCandidateQueue.current[data.from] = [];
                    }
                    iceCandidateQueue.current[data.from].push(candidate);
                }
            }
          } catch (err) {
              console.error("Signal handling error:", err);
          }
      };

      const processQueue = async (pc: RTCPeerConnection, fromId: string) => {
          if (iceCandidateQueue.current[fromId]) {
              console.log(`Processing ${iceCandidateQueue.current[fromId].length} queued candidates for ${fromId}`);
              for (const candidate of iceCandidateQueue.current[fromId]) {
                  try {
                      await pc.addIceCandidate(candidate);
                  } catch (e) {
                      console.error("Error adding queued candidate:", e);
                  }
              }
              delete iceCandidateQueue.current[fromId];
          }
      };

      socket.on('share-started', onShareStarted);
      socket.on('share-ended', onShareEnded);
      socket.on('signal', onSignal);

      return () => {
          socket.off('share-started', onShareStarted);
          socket.off('share-ended', onShareEnded);
          socket.off('signal', onSignal);
      };
  }, [socket, isBroadcaster]);


  // --- User Actions ---

  const startSharing = async () => {
    if (!socket) {
        alert("Connect to server to share screen.");
        return;
    }
    // Check for display media support more robustly
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert("Screen sharing is not supported in this browser or requires HTTPS.");
        return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as any,
        audio: false
      });

      // Local Display
      if (videoElement) {
        setStream(mediaStream); // Set stream state immediately
        setIsVideoPlaying(false); // Wait for playing event
        
        videoElement.srcObject = mediaStream;
        videoElement.play().catch(e => {
            if (e.name !== 'AbortError') console.error("Local play failed:", e);
        });
      }

      localStreamRef.current = mediaStream;
      setIsBroadcaster(true);
      
      // Notify Server
      socket.emit('start-share');

      // Cleanup when user stops sharing via browser UI
      mediaStream.getVideoTracks()[0].onended = () => {
        stopSharing();
      };
    } catch (err) {
      console.error("Error sharing screen:", err);
    }
  };

  const stopSharing = () => {
    // Stop tracks
    if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    setStream(null);
    localStreamRef.current = null;
    setIsBroadcaster(false);
    setIsFullScreen(false);
    setIsVideoPlaying(false);
    setConnectionStatus('idle');

    if (videoElement) {
        videoElement.pause();
        videoElement.srcObject = null;
    }

    // Close all peers
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
    iceCandidateQueue.current = {};

    if (socket) {
        socket.emit('stop-share');
    }
  };

  const toggleFullScreen = () => {
    if (stream && isVideoPlaying) {
      setIsFullScreen(!isFullScreen);
    }
  };

  const forceReconnect = () => {
      if (socket && remoteBroadcasterId) {
          createPeerConnection(remoteBroadcasterId, true);
      }
  }

  return (
    <group>
      {/* Screen Frame */}
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[8.2, 4.7, 0.2]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.8} />
      </mesh>

      {/* Screen Surface */}
      <mesh 
        position={[0, 0, 0.05]}
        onPointerOver={() => setIsHovered(true)}
        onPointerOut={() => setIsHovered(false)}
        onClick={stream && isVideoPlaying ? toggleFullScreen : (!remoteBroadcasterId ? startSharing : undefined)}
      >
        <planeGeometry args={[8, 4.5]} />
        {stream && videoElement ? (
           <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false}>
             <videoTexture attach="map" args={[videoElement]} colorSpace={THREE.SRGBColorSpace} />
           </meshBasicMaterial>
        ) : (
           <meshStandardMaterial color="#111" emissive="#00ffcc" emissiveIntensity={isHovered ? 0.2 : 0.05} />
        )}
      </mesh>
      
      {/* UI Overlay: IDLE (No one sharing) */}
      {!stream && !remoteBroadcasterId && (
        <group position={[0, 0, 0.2]}>
           <Text 
            fontSize={0.4} 
            color="#00ffcc" 
            font={"/fonts/st.otf"}
            position={[0, 0.5, 0]}
            anchorX="center"
            anchorY="middle"
           >
             CONFERENCE_DISPLAY_01
           </Text>
           <Html center position={[0, -0.5, 0]} transform>
              <button 
                onClick={startSharing}
                className="bg-[#00ffcc] text-black px-6 py-2 font-mono font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-white transition-colors"
              >
                <MonitorUp size={18} /> Start Presentation
              </button>
           </Html>
        </group>
      )}

      {/* UI Overlay: CONNECTING / WAITING (Before stream object arrives) */}
      {!stream && remoteBroadcasterId && (
          <group position={[0, 0, 0.2]}>
             <Html center position={[0, 0, 0]} transform>
                 <div className="flex flex-col items-center gap-4 bg-black/80 p-4 border border-[#ffcc00]/50 rounded">
                     <div className="flex items-center gap-2 text-[#ffcc00] animate-pulse font-mono font-bold tracking-widest">
                        <SignalHigh size={24} /> 
                        {connectionStatus === 'connecting' ? 'ESTABLISHING LINK...' : 'WAITING FOR SIGNAL'}
                     </div>
                     <button 
                        onClick={(e) => { e.stopPropagation(); forceReconnect(); }}
                        className="text-xs text-white/50 hover:text-white underline mt-2 flex items-center gap-1"
                     >
                        <RefreshCw size={10} /> FORCE RECONNECT
                     </button>
                 </div>
             </Html>
          </group>
      )}

      {/* UI Overlay: DECODING (Stream arrived but not playing yet - Fixes Black Screen) */}
      {stream && !isVideoPlaying && (
          <group position={[0, 0, 0.2]}>
             <Html center position={[0, 0, 0]} transform>
                 <div className="flex flex-col items-center gap-3 bg-black/80 p-6 border border-[#00ffcc]/50 shadow-[0_0_15px_rgba(0,255,204,0.3)]">
                     <Loader2 size={32} className="text-[#00ffcc] animate-spin" />
                     <div className="text-[#00ffcc] font-mono text-sm tracking-widest animate-pulse">
                        DECODING DATA STREAM...
                     </div>
                 </div>
             </Html>
          </group>
      )}

      {/* 3D Control Bar (Only active when video is playing) */}
      {stream && isVideoPlaying && !isFullScreen && (
        <Html position={[0, -2.5, 0]} center transform>
            <div className="flex gap-2 bg-black/80 backdrop-blur border border-white/10 p-2 rounded">
                <button 
                    onClick={toggleFullScreen}
                    className="p-2 hover:bg-white/10 text-[#00ffcc] rounded transition-colors"
                    title="Toggle Fullscreen"
                >
                    <Maximize2 size={20} />
                </button>
                {isBroadcaster && (
                    <button 
                        onClick={stopSharing}
                        className="p-2 hover:bg-red-500/20 text-red-500 rounded transition-colors"
                        title="Stop Sharing"
                    >
                        <StopCircle size={20} />
                    </button>
                )}
            </div>
        </Html>
      )}

      {/* Full Screen Overlay */}
      {isFullScreen && stream && (
        <Html 
            portal={{ current: document.body }} 
            calculatePosition={() => [0, 0, 0]} 
            style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 999999 }}
        >
          <div className="w-full h-full bg-black/95 flex flex-col items-center justify-center p-4">
             <div className="w-full h-full max-w-[90vw] max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 text-[#00ffcc] font-mono border-b border-[#00ffcc]/30 pb-2 bg-black/50 p-2">
                    <h2 className="text-xl tracking-widest flex items-center gap-2">
                        <MonitorUp /> {isBroadcaster ? 'BROADCASTING_LIVE' : 'INCOMING_SIGNAL'}
                    </h2>
                    <button 
                        onClick={() => setIsFullScreen(false)}
                        className="text-white/70 hover:text-white hover:bg-white/10 p-1 rounded transition-colors"
                    >
                        <Minimize2 size={24} />
                    </button>
                </div>
                
                <div className="flex-1 bg-black border border-[#333] relative overflow-hidden flex items-center justify-center rounded">
                    <video 
                        ref={node => {
                            if (node && stream) {
                                // Only update if srcObject is different to prevent interrupting play()
                                if (node.srcObject !== stream) {
                                    node.srcObject = stream;
                                    node.muted = true;
                                    node.playsInline = true;
                                    node.play().catch(e => {
                                        if (e.name !== 'AbortError') console.error("Fullscreen play failed:", e);
                                    });
                                }
                            }
                        }}
                        className="w-full h-full object-contain"
                        autoPlay
                        playsInline
                        muted
                    />
                </div>
             </div>
          </div>
        </Html>
      )}
    </group>
  );
};
