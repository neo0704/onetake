import { create } from 'zustand';
import api from '../services/api';
import { initSocket, getSocket } from '../services/socket.js';
import useAuthStore from './authStore.js';

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,

  fetchNotifications: async () => {
    try {
      const { data } = await api.get('/notifications');
      const { user } = useAuthStore.getState();
      if (user?._id && !getSocket()) {
        initSocket(user._id);
      }
      set({ notifications: data.notifications, unreadCount: data.unreadCount });
      
      // Setup socket listener if not already
      const socket = getSocket();
      if (socket && !socket.hasListener) {
        socket.hasListener = true;
        socket.on('new_notification', (notif) => {
          set(state => ({
            notifications: [notif, ...state.notifications],
            unreadCount: state.unreadCount + 1
          }));
        });
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  },

  addNotification: (notif) => {
    set(state => ({
      notifications: [{ ...notif, isRead: false }, ...state.notifications],
      unreadCount: state.unreadCount + 1
    }));
  },

  markRead: async (id) => {
    await api.put(`/notifications/${id}/read`);
    set(state => ({
      notifications: state.notifications.map(n => n._id === id ? { ...n, isRead: true } : n),
      unreadCount: Math.max(0, state.unreadCount - 1)
    }));
  },

  markAllRead: async () => {
    await api.put('/notifications/mark-all-read');
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, isRead: true })),
      unreadCount: 0
    }));
  }
}));

export default useNotificationStore;
