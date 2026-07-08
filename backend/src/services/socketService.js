// -----------------------------------------------------------------------------
// socketService.js — thin wrapper around Socket.IO so controllers can emit
// real-time events without importing `io` everywhere directly.
//
// Pattern: initSocket(server) is called once in server.js. It stores the io
// instance in module scope, and getIO() lets any controller broadcast an
// event, e.g.  getIO().emit('incident:new', incident)
// -----------------------------------------------------------------------------

const { Server } = require('socket.io');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`[socket] client connected: ${socket.id}`);

    // Clients join a "room" per role so, e.g., only EOC dashboards receive
    // every incident, while a citizen only receives updates on their own
    // reports (joined by their incident/user id from the frontend).
    socket.on('join', (roomName) => {
      socket.join(roomName);
    });

    socket.on('disconnect', () => {
      console.log(`[socket] client disconnected: ${socket.id}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.IO was requested before initSocket() was called');
  }
  return io;
}

module.exports = { initSocket, getIO };
