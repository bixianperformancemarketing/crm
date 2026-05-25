const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');

let io;
const connectedUsers = new Map();

const init = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { id: userId, organizationId, workspaceId, role } = socket.user;

    socket.join(`user:${userId}`);
    if (organizationId) socket.join(`org:${organizationId}`);
    if (workspaceId) socket.join(`workspace:${workspaceId}`);

    connectedUsers.set(userId, socket.id);
    console.log(`Socket connected: user ${userId} (${role})`);

    socket.on('join_workspace', (wsId) => {
      socket.join(`workspace:${wsId}`);
    });

    socket.on('mark_notification_read', async (notificationId) => {
      try {
        const { Notification } = require('../config/models');
        await Notification.update(
          { isRead: true, readAt: new Date() },
          { where: { id: notificationId, userId } }
        );
      } catch (err) {
        console.error('mark_notification_read error:', err);
      }
    });

    socket.on('disconnect', () => {
      connectedUsers.delete(userId);
      console.log(`Socket disconnected: user ${userId}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

const emitToUser = (userId, event, data) => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
};

const emitToWorkspace = (workspaceId, event, data) => {
  if (!io) return;
  io.to(`workspace:${workspaceId}`).emit(event, data);
};

const emitToOrg = (organizationId, event, data) => {
  if (!io) return;
  io.to(`org:${organizationId}`).emit(event, data);
};

const isUserOnline = (userId) => connectedUsers.has(userId);

module.exports = { init, getIO, emitToUser, emitToWorkspace, emitToOrg, isUserOnline };
