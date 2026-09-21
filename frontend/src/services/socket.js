import { io } from 'socket.io-client';

let socket = null;

// Always connect directly to backend port 5000
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const initSocket = (userId) => {
  if (socket && socket.connected) return socket;

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('🔌 Global socket connected:', socket.id, 'joining room:', userId);
    socket.emit('join_room', userId);
  });

  socket.on('connect_error', (err) => {
    console.error('Global socket error:', err.message);
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export default { initSocket, getSocket, disconnectSocket };
