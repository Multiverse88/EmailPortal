'use client';
import { create } from 'zustand';

export interface User {
  id: string;
  name: string;
  email: string;
  type: 'customer' | 'admin';
  avatarUrl?: string | null;
  storageQuota?: number;
}

export type UserRole = 'customer' | 'admin';

interface AuthState {
  adminToken: string | null;
  adminUser: User | null;
  customerToken: string | null;
  customerUser: User | null;

  // Contextual/legacy fallback fields for backwards compatibility
  token: string | null;
  user: User | null;
  ready: boolean;

  hydrate: () => void;
  setAuth: (token: string, user: User, targetRole?: UserRole) => void;
  updateUser: (patch: Partial<User>, targetRole?: UserRole) => void;
  logout: (targetRole?: UserRole) => void;
  getRoleAuth: (role: UserRole) => { token: string | null; user: User | null };
}

function getActiveRoleContext(): UserRole {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    return 'admin';
  }
  return 'customer';
}

export const useAuthStore = create<AuthState>((set, get) => ({
  adminToken: null,
  adminUser: null,
  customerToken: null,
  customerUser: null,
  token: null,
  user: null,
  ready: false,

  hydrate: () => {
    if (typeof window === 'undefined') return;

    let adminToken = localStorage.getItem('admin_token');
    let adminUserRaw = localStorage.getItem('admin_user');
    let customerToken = localStorage.getItem('customer_token');
    let customerUserRaw = localStorage.getItem('customer_user');

    // Migration helper for legacy token/user
    const legacyToken = localStorage.getItem('token');
    const legacyUserRaw = localStorage.getItem('user');
    if (legacyToken && legacyUserRaw) {
      try {
        const legacyUser = JSON.parse(legacyUserRaw);
        if (legacyUser?.type === 'admin' && !adminToken) {
          adminToken = legacyToken;
          adminUserRaw = legacyUserRaw;
          localStorage.setItem('admin_token', legacyToken);
          localStorage.setItem('admin_user', legacyUserRaw);
        } else if (legacyUser?.type === 'customer' && !customerToken) {
          customerToken = legacyToken;
          customerUserRaw = legacyUserRaw;
          localStorage.setItem('customer_token', legacyToken);
          localStorage.setItem('customer_user', legacyUserRaw);
        }
      } catch {
        // ignore malformed JSON
      }
    }

    const adminUser = adminUserRaw ? JSON.parse(adminUserRaw) : null;
    const customerUser = customerUserRaw ? JSON.parse(customerUserRaw) : null;

    const currentRole = getActiveRoleContext();
    const token = currentRole === 'admin' ? (adminToken || customerToken) : (customerToken || adminToken);
    const user = currentRole === 'admin' ? (adminUser || customerUser) : (customerUser || adminUser);

    set({
      adminToken,
      adminUser,
      customerToken,
      customerUser,
      token,
      user,
      ready: true,
    });
  },

  setAuth: (token, user, targetRole) => {
    const role: UserRole = targetRole || (user.type === 'admin' ? 'admin' : 'customer');
    if (typeof window !== 'undefined') {
      if (role === 'admin') {
        localStorage.setItem('admin_token', token);
        localStorage.setItem('admin_user', JSON.stringify(user));
      } else {
        localStorage.setItem('customer_token', token);
        localStorage.setItem('customer_user', JSON.stringify(user));
      }
      // Keep legacy keys updated for compatibility
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }

    set((state) => {
      const nextAdminToken = role === 'admin' ? token : state.adminToken;
      const nextAdminUser = role === 'admin' ? user : state.adminUser;
      const nextCustomerToken = role === 'customer' ? token : state.customerToken;
      const nextCustomerUser = role === 'customer' ? user : state.customerUser;

      const currentRole = getActiveRoleContext();
      const currentToken = currentRole === 'admin'
        ? (nextAdminToken || nextCustomerToken)
        : (nextCustomerToken || nextAdminToken);
      const currentUser = currentRole === 'admin'
        ? (nextAdminUser || nextCustomerUser)
        : (nextCustomerUser || nextAdminUser);

      return {
        adminToken: nextAdminToken,
        adminUser: nextAdminUser,
        customerToken: nextCustomerToken,
        customerUser: nextCustomerUser,
        token: currentToken,
        user: currentUser,
        ready: true,
      };
    });
  },

  updateUser: (patch, targetRole) => {
    const role: UserRole = targetRole || getActiveRoleContext();
    set((state) => {
      let nextCustomerUser = state.customerUser;
      let nextAdminUser = state.adminUser;

      if (role === 'customer' && state.customerUser) {
        nextCustomerUser = { ...state.customerUser, ...patch };
        if (typeof window !== 'undefined') {
          localStorage.setItem('customer_user', JSON.stringify(nextCustomerUser));
          localStorage.setItem('user', JSON.stringify(nextCustomerUser));
        }
      } else if (role === 'admin' && state.adminUser) {
        nextAdminUser = { ...state.adminUser, ...patch };
        if (typeof window !== 'undefined') {
          localStorage.setItem('admin_user', JSON.stringify(nextAdminUser));
          localStorage.setItem('user', JSON.stringify(nextAdminUser));
        }
      }

      const currentRole = getActiveRoleContext();
      const currentUser = currentRole === 'admin'
        ? (nextAdminUser || nextCustomerUser)
        : (nextCustomerUser || nextAdminUser);

      return {
        customerUser: nextCustomerUser,
        adminUser: nextAdminUser,
        user: currentUser,
      };
    });
  },

  logout: (targetRole) => {
    const role: UserRole = targetRole || getActiveRoleContext();
    if (typeof window !== 'undefined') {
      if (role === 'admin') {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
      } else {
        localStorage.removeItem('customer_token');
        localStorage.removeItem('customer_user');
      }

      // If neither role has an active token, clean legacy keys
      const remainingCustomer = localStorage.getItem('customer_token');
      const remainingAdmin = localStorage.getItem('admin_token');
      if (!remainingCustomer && !remainingAdmin) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }

    set((state) => {
      const nextAdminToken = role === 'admin' ? null : state.adminToken;
      const nextAdminUser = role === 'admin' ? null : state.adminUser;
      const nextCustomerToken = role === 'customer' ? null : state.customerToken;
      const nextCustomerUser = role === 'customer' ? null : state.customerUser;

      const currentRole = getActiveRoleContext();
      const currentToken = currentRole === 'admin' ? nextAdminToken : nextCustomerToken;
      const currentUser = currentRole === 'admin' ? nextAdminUser : nextCustomerUser;

      return {
        adminToken: nextAdminToken,
        adminUser: nextAdminUser,
        customerToken: nextCustomerToken,
        customerUser: nextCustomerUser,
        token: currentToken,
        user: currentUser,
        ready: true,
      };
    });
  },

  getRoleAuth: (role) => {
    const state = get();
    if (role === 'admin') {
      return { token: state.adminToken, user: state.adminUser };
    }
    return { token: state.customerToken, user: state.customerUser };
  },
}));

export function useCustomerAuth() {
  const store = useAuthStore();
  return {
    token: store.customerToken,
    user: store.customerUser,
    ready: store.ready,
    hydrate: store.hydrate,
    setAuth: (token: string, user: User) => store.setAuth(token, user, 'customer'),
    updateUser: (patch: Partial<User>) => store.updateUser(patch, 'customer'),
    logout: () => store.logout('customer'),
  };
}

export function useAdminAuth() {
  const store = useAuthStore();
  return {
    token: store.adminToken,
    user: store.adminUser,
    ready: store.ready,
    hydrate: store.hydrate,
    setAuth: (token: string, user: User) => store.setAuth(token, user, 'admin'),
    logout: () => store.logout('admin'),
  };
}
