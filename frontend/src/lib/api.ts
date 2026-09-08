import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
});

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    // Only bounce to login when the session itself died, not on a bad password
    // attempt at the login form.
    const url: string = error.config?.url ?? '';
    if (error.response?.status === 401 && !url.includes('/auth/login') && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const fetcher = (url: string) => api.get(url).then((r) => r.data);
export const errMsg = (e: any, fallback = 'Terjadi kesalahan') =>
  e?.response?.data?.error || fallback;

export default api;
