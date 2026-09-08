'use client';
import { create } from 'zustand';

export interface User {
  id: string;
  name: string;
  email: string;
  type: 'customer' | 'admin';
}

interface AuthState {
  token: string | null;
  user: User | null;
  ready: boolean;
  hydrate: () => void;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  ready: false, // false until localStorage has been read; guards SSR mismatch
  hydrate: () => {
    const token = localStorage.getItem('token');
    const raw = localStorage.getItem('user');
    set({ token, user: raw ? JSON.parse(raw) : null, ready: true });
  },
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user, ready: true });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null, ready: true });
  },
}));
