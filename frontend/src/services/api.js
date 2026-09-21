import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 30000
});

const token = localStorage.getItem('onetake_token');
if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

// 401s from these endpoints are expected, normal business responses (wrong
// password, wrong current password, failed Google verification) — NOT a
// sign the session expired. Redirecting to /login for these would wipe out
// the page mid-request before the caller's own error handling (a toast,
// etc) ever gets a chance to run.
const EXPECTED_401_ENDPOINTS = ['/auth/me', '/auth/login', '/auth/google', '/auth/change-password'];

api.interceptors.response.use(
  res => res,
  err => {
    const url = err.config?.url || '';
    const isExpected401 = EXPECTED_401_ENDPOINTS.some(endpoint => url.includes(endpoint));
    if (err.response?.status === 401 && !isExpected401) {
      localStorage.removeItem('onetake_token');
      delete api.defaults.headers.common['Authorization'];
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;