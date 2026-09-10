import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config;

  // Preserve existing Authorization header if explicitly provided
  if (config.headers?.Authorization) return config;

  const url = config.url || '';
  const pathname = window.location.pathname || '';

  const adminToken = localStorage.getItem('admin_token');
  const customerToken = localStorage.getItem('customer_token');
  const legacyToken = localStorage.getItem('token');

  const isAdminEndpoint =
    url.includes('/mailboxes') ||
    url.includes('/storage') ||
    url.includes('/audit') ||
    url.includes('/auth/register') ||
    url.includes('/auth/impersonate') ||
    url.includes('/security/admin');

  const isCustomerEndpoint =
    !url.includes('/security/admin') && (
      url.includes('/email') ||
      url.includes('/documents') ||
      url.includes('/support') ||
      url.includes('/search') ||
      url.includes('/security') ||
      url.includes('/settings') ||
      url.includes('/companion') ||
      url.includes('/auth/change-password') ||
      url.includes('/auth/me')
    );

  let chosenToken: string | null = null;

  if (isAdminEndpoint) {
    chosenToken = adminToken || (pathname.startsWith('/admin') ? legacyToken : null);
  } else if (isCustomerEndpoint) {
    chosenToken = customerToken || (!pathname.startsWith('/admin') ? legacyToken : null);
  } else if (pathname.startsWith('/admin')) {
    chosenToken = adminToken || legacyToken;
  } else {
    chosenToken = customerToken || legacyToken;
  }

  if (chosenToken) {
    config.headers.Authorization = `Bearer ${chosenToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    // Only handle 401 when the session expired, not on a bad password attempt at the login form
    const url: string = error.config?.url ?? '';
    if (error.response?.status === 401 && !url.includes('/auth/login') && typeof window !== 'undefined') {
      const pathname = window.location.pathname || '';
      const isAdminReq =
        url.includes('/mailboxes') ||
        url.includes('/storage') ||
        url.includes('/audit') ||
        url.includes('/auth/register') ||
        url.includes('/auth/impersonate') ||
        url.includes('/security/admin') ||
        pathname.startsWith('/admin');

      if (isAdminReq) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        if (pathname.startsWith('/admin')) {
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('customer_token');
        localStorage.removeItem('customer_user');
        if (!pathname.startsWith('/login') && !pathname.startsWith('/admin')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const fetcher = (url: string) => api.get(url).then((r) => r.data);
export const errMsg = (e: any, fallback = 'Terjadi kesalahan') =>
  e?.response?.data?.error || fallback;

export default api;
