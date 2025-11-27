
import { Server } from "socket.io";


const io = new Server(3000, {
  cors: {
    origin: "*", // Allow all origins for demo purposes
  },
});

// Store player state: { id: { name, x, y, z, rotation, animation } }
const players = {};
let broadcasterId = null;

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // Initialize new player with default data
  players[socket.id] = {
    name: "Guest",
    x: 0,
    y: 0,
    z: 0,
    rotation: 0,
    animation: "idle",
  };

  // Send existing players and current broadcaster state
  socket.emit("init", players);
  if (broadcasterId) {
    socket.emit("share-started", broadcasterId);
  }

  socket.on("join", (name) => {
    players[socket.id].name = name;
    socket.broadcast.emit("playerJoined", {
      id: socket.id,
      ...players[socket.id],
    });
    console.log(`Player ${socket.id} joined as ${name}`);
  });

  socket.on("move", (data) => {
    if (players[socket.id]) {
      players[socket.id] = { ...players[socket.id], ...data };
      socket.broadcast.emit("playerMoved", {
        id: socket.id,
        ...data,
      });
    }
  });

  socket.on("chat", (message) => {
    io.emit("chat", {
      id: Math.random().toString(36).substr(2, 9),
      senderId: socket.id,
      senderName: players[socket.id]?.name || "Unknown",
      text: message,
      timestamp: Date.now(),
    });
  });

  // --- WebRTC Signaling ---

  // Broadcaster notifies server they started sharing
  socket.on("start-share", () => {
    broadcasterId = socket.id;
    socket.broadcast.emit("share-started", broadcasterId);
    console.log(`User ${socket.id} started sharing`);
  });

  // Broadcaster stops sharing
  socket.on("stop-share", () => {
    broadcasterId = null;
    socket.broadcast.emit("share-ended");
  });

  // Relay signaling data (Offer, Answer, ICE Candidate)
  socket.on("signal", (data) => {
    // data = { to: targetSocketId, type: 'offer'|'answer'|'candidate', payload: ... }
    io.to(data.to).emit("signal", {
      from: socket.id,
      type: data.type,
      payload: data.payload,
    });
  });

  // Viewers request to watch the stream
  socket.on("request-view", (targetId) => {
    io.to(targetId).emit("viewer-joined", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    delete players[socket.id];
    io.emit("playerLeft", socket.id);

    // If the broadcaster leaves, stop the stream for everyone
    if (socket.id === broadcasterId) {
      broadcasterId = null;
      io.emit("share-ended");
    }
  });
});

console.log("Socket.io server running on port 3000");
