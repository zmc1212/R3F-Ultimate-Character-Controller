/**
 * NODE.JS SERVER CODE
 * 1. Create a folder named 'server'
 * 2. Run 'npm init -y'
 * 3. Run 'npm install socket.io'
 * 4. Paste this code into 'server.js'
 * 5. Run 'node server.js'
 */

const { Server } = require("socket.io");

const io = new Server(3000, {
  cors: {
    origin: "*", // Allow all origins for demo purposes
  },
});

// Store player state: { id: { x, y, z, rotation, animation } }
const players = {};

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // Initialize new player with default data
  players[socket.id] = {
    x: 0,
    y: 0,
    z: 0,
    rotation: 0,
    animation: "idle",
  };

  // Send existing players to the new client
  socket.emit("init", players);

  // Notify others about the new player
  socket.broadcast.emit("playerJoined", {
    id: socket.id,
    ...players[socket.id],
  });

  // Handle movement updates
  socket.on("move", (data) => {
    if (players[socket.id]) {
      // Update server state
      players[socket.id] = { ...players[socket.id], ...data };
      // Broadcast to everyone else (excluding sender)
      socket.broadcast.emit("playerMoved", {
        id: socket.id,
        ...data,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    delete players[socket.id];
    io.emit("playerLeft", socket.id);
  });
});

console.log("Socket.io server running on port 3000");