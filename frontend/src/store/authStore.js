import { create } from 'zustand';
import api from '../services/api';
import toast from 'react-hot-toast';

const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('onetake_token') || null,
  loading: true,

  init: async () => {
    const token = localStorage.getItem('onetake_token');

    // No token saved — not logged in
    if (!token) {
      set({ loading: false, user: null, token: null });
      return;
    }

    // Token exists — verify with server
    try {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const { data } = await api.get('/auth/me');
      set({ user: data.user, token, loading: false });
    } catch (err) {
      // Token invalid or expired — clear it
      console.warn('Auth token invalid:', err.message);
      localStorage.removeItem('onetake_token');
      delete api.defaults.headers.common['Authorization'];
      set({ user: null, token: null, loading: false });
    }
  },

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('onetake_token', data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    set({ user: data.user, token: data.token });
    return data.user;
  },

  // credential = the ID token string returned by Google Identity Services.
  // role is optional — only used by the backend if this Google account is
  // signing up for the first time (ignored for an existing user logging in).
  // Google-authenticated accounts are always email-verified server-side.
  loginWithGoogle: async (credential, role) => {
    const { data } = await api.post('/auth/google', { credential, role });
    localStorage.setItem('onetake_token', data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    set({ user: data.user, token: data.token });
    return data.user;
  },

  // Does NOT log the user in. The backend creates the account as unverified
  // and emails a 6-digit code; returns { needsVerification: true, email }.
  // Call verifyEmail() with that code to finish and receive a token.
  register: async (userData) => {
    const { data } = await api.post('/auth/register', userData);
    if (data.needsVerification) {
      return { needsVerification: true, email: data.email };
    }
    localStorage.setItem('onetake_token', data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    set({ user: data.user, token: data.token });
    return data.user;
  },

  verifyEmail: async (email, code) => {
    const { data } = await api.post('/auth/verify-email', { email, code });
    if (data.pending) {
      return { pending: true, message: data.message };
    }
    localStorage.setItem('onetake_token', data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    set({ user: data.user, token: data.token });
    return data.user;
  },

  resendVerification: async (email) => {
    await api.post('/auth/resend-verification', { email });
  },

  logout: () => {
    localStorage.removeItem('onetake_token');
    delete api.defaults.headers.common['Authorization'];
    set({ user: null, token: null });
    toast.success('Logged out');
  },

  updateUser: (updatedUser) => set({ user: updatedUser })
}));

export default useAuthStore;