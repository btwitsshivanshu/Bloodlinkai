// ============================================================
// Socket.io - Real-time communication
// ============================================================
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: true, // Allow all origins (set to specific URL for production)
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authentication middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      if (!process.env.JWT_SECRET) return next(new Error('Server configuration error'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.userId}`);

    // Join user's personal room for targeted notifications
    socket.join(socket.userId);

    // Join role-based room
    socket.join(`role:${socket.userRole}`);

    // ============================================================
    // Chat Events
    // ============================================================

    // Join a conversation room
    socket.on('join-conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`User ${socket.userId} joined conversation ${conversationId}`);
    });

    // Leave a conversation room
    socket.on('leave-conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Send a chat message (real-time broadcast)
    socket.on('send-message', (data) => {
      if (!data) return;
      const { conversationId, content, message } = data;
      if (!conversationId) return;

      // Broadcast to conversation room (except sender)
      socket.to(`conversation:${conversationId}`).emit('new-message', {
        conversationId,
        content: content ?? message?.content,
        senderId: socket.userId,
      });
    });

    // Typing indicator
    socket.on('typing', (data) => {
      const { conversationId, userName } = data;
      socket.to(`conversation:${conversationId}`).emit('user-typing', {
        userId: socket.userId,
        userName,
        conversationId,
      });
    });

    socket.on('stop-typing', (data) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit('user-stop-typing', {
        userId: socket.userId,
      });
    });

    // ============================================================
    // Blood Request Events
    // ============================================================

    // When a new blood request is created
    socket.on('new-blood-request', (data) => {
      // Broadcast to all donors
      socket.to('role:donor').emit('blood-request-alert', data);
    });

    // When a donor responds to a request
    socket.on('donor-response', (data) => {
      const { requestId, receiverId, donorName, accepted } = data;
      io.to(receiverId).emit('donor-response', {
        requestId,
        donorName,
        accepted,
      });
    });

    // ============================================================
    // Location Updates
    // ============================================================
    socket.on('update-location', (data) => {
      const { lat, lng } = data;
      // Could update donor location in real-time
      socket.broadcast.emit('donor-location-update', {
        userId: socket.userId,
        lat,
        lng,
      });
    });

    // ============================================================
    // Disconnect
    // ============================================================
    socket.on('disconnect', (reason) => {
      console.log(`🔌 User disconnected: ${socket.userId} (${reason})`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

module.exports = { initializeSocket, getIO };
