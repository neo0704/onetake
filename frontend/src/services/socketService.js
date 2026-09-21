import { io } from 'socket.io-client';

/**
 * Thin wrapper around a socket.io-client connection.
 * Keeps a single active socket and exposes a small, predictable API
 * so hooks/components never touch socket.io directly.
 */
class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(serverUrl) {
    if (this.socket) return this.socket;
    this.socket = io(serverUrl, {
      transports: ['polling', 'websocket'],
      reconnection: false,
      forceNew: true,
    });
    return this.socket;
  }

  getSocket() {
    return this.socket;
  }

  getId() {
    return this.socket?.id;
  }

  emit(event, payload) {
    this.socket?.emit(event, payload);
  }

  on(event, handler) {
    this.socket?.on(event, handler);
  }

  off(event, handler) {
    this.socket?.off(event, handler);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// Singleton, mirrors how socketService/webrtcService are used in the reference component.
export default new SocketService();