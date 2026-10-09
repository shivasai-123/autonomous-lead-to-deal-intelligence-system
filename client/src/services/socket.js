import { io } from 'socket.io-client';
import { API_BASE_URL } from '../utils/constants';
import { getAuthToken } from './api';

const SOCKET_SERVER_URL = API_BASE_URL.replace(/\/api\/?$/, '');

class SocketClient {
  constructor() {
    this.socket = null;
    this.notificationListeners = new Set();
    this.unreadCountListeners = new Set();
  }

  connect(token = null) {
    const authToken = token || getAuthToken();
    if (!authToken) {
      this.disconnect();
      return null;
    }

    // If socket already connected with same token, keep alive
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    // Close previous instance if any
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(SOCKET_SERVER_URL, {
      auth: { token: authToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      // Successfully authenticated and joined private user room
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[SocketClient] Connection error:', err.message);
    });

    this.socket.on('notification:new', (notification) => {
      this.notificationListeners.forEach((listener) => {
        try {
          listener(notification);
        } catch (e) {
          console.error('[SocketClient] Listener error:', e);
        }
      });
    });

    this.socket.on('notification:unread_count', (payload) => {
      this.unreadCountListeners.forEach((listener) => {
        try {
          listener(payload);
        } catch (e) {
          console.error('[SocketClient] Unread count listener error:', e);
        }
      });
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  onNotification(listener) {
    this.notificationListeners.add(listener);
    return () => this.notificationListeners.delete(listener);
  }

  onUnreadCount(listener) {
    this.unreadCountListeners.add(listener);
    return () => this.unreadCountListeners.delete(listener);
  }

  getSocket() {
    return this.socket;
  }
}

export const socketService = new SocketClient();
export default socketService;
