import { useAuthStore, User } from '../auth';

// Setup mock window & localStorage for Node test environment
const storage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = v; },
  removeItem: (k: string) => { delete storage[k]; },
  clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
};

(global as any).window = {
  location: { pathname: '/inbox' },
};
(global as any).localStorage = mockLocalStorage;

describe('useAuthStore - Isolated Dual Sessions', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    (global as any).window.location.pathname = '/inbox';
    useAuthStore.setState({
      adminToken: null,
      adminUser: null,
      customerToken: null,
      customerUser: null,
      token: null,
      user: null,
      ready: false,
    });
  });

  const mockAdmin: User = {
    id: 'adm-1',
    name: 'Administrator',
    email: 'admin@clienteasylegal.co.id',
    type: 'admin',
  };

  const mockCustomer: User = {
    id: 'cust-1',
    name: 'Budi Santoso',
    email: 'budi@clienteasylegal.co.id',
    type: 'customer',
  };

  it('sets admin auth without affecting customer state', () => {
    useAuthStore.getState().setAuth('admin-token-123', mockAdmin, 'admin');

    const state = useAuthStore.getState();
    expect(state.adminToken).toBe('admin-token-123');
    expect(state.adminUser?.email).toBe('admin@clienteasylegal.co.id');
    expect(state.customerToken).toBeNull();
    expect(state.customerUser).toBeNull();

    expect(mockLocalStorage.getItem('admin_token')).toBe('admin-token-123');
    expect(mockLocalStorage.getItem('customer_token')).toBeNull();
  });

  it('allows both admin and customer to be logged in simultaneously', () => {
    useAuthStore.getState().setAuth('admin-token-123', mockAdmin, 'admin');
    useAuthStore.getState().setAuth('customer-token-456', mockCustomer, 'customer');

    const state = useAuthStore.getState();
    expect(state.adminToken).toBe('admin-token-123');
    expect(state.adminUser?.name).toBe('Administrator');
    expect(state.customerToken).toBe('customer-token-456');
    expect(state.customerUser?.name).toBe('Budi Santoso');

    expect(mockLocalStorage.getItem('admin_token')).toBe('admin-token-123');
    expect(mockLocalStorage.getItem('customer_token')).toBe('customer-token-456');
  });

  it('logging out customer does not log out admin', () => {
    useAuthStore.getState().setAuth('admin-token-123', mockAdmin, 'admin');
    useAuthStore.getState().setAuth('customer-token-456', mockCustomer, 'customer');

    // Logout customer only
    useAuthStore.getState().logout('customer');

    const state = useAuthStore.getState();
    expect(state.customerToken).toBeNull();
    expect(state.customerUser).toBeNull();
    expect(state.adminToken).toBe('admin-token-123');
    expect(state.adminUser?.name).toBe('Administrator');

    expect(mockLocalStorage.getItem('customer_token')).toBeNull();
    expect(mockLocalStorage.getItem('admin_token')).toBe('admin-token-123');
  });

  it('logging out admin does not log out customer', () => {
    useAuthStore.getState().setAuth('admin-token-123', mockAdmin, 'admin');
    useAuthStore.getState().setAuth('customer-token-456', mockCustomer, 'customer');

    // Logout admin only
    useAuthStore.getState().logout('admin');

    const state = useAuthStore.getState();
    expect(state.adminToken).toBeNull();
    expect(state.adminUser).toBeNull();
    expect(state.customerToken).toBe('customer-token-456');
    expect(state.customerUser?.name).toBe('Budi Santoso');

    expect(mockLocalStorage.getItem('admin_token')).toBeNull();
    expect(mockLocalStorage.getItem('customer_token')).toBe('customer-token-456');
  });

  it('hydrates both sessions from localStorage', () => {
    mockLocalStorage.setItem('admin_token', 'saved-admin-token');
    mockLocalStorage.setItem('admin_user', JSON.stringify(mockAdmin));
    mockLocalStorage.setItem('customer_token', 'saved-cust-token');
    mockLocalStorage.setItem('customer_user', JSON.stringify(mockCustomer));

    useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.adminToken).toBe('saved-admin-token');
    expect(state.adminUser?.email).toBe('admin@clienteasylegal.co.id');
    expect(state.customerToken).toBe('saved-cust-token');
    expect(state.customerUser?.email).toBe('budi@clienteasylegal.co.id');
    expect(state.ready).toBe(true);
  });

  it('migrates legacy token and user to appropriate role during hydration', () => {
    mockLocalStorage.setItem('token', 'legacy-admin-token');
    mockLocalStorage.setItem('user', JSON.stringify(mockAdmin));

    useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.adminToken).toBe('legacy-admin-token');
    expect(state.adminUser?.type).toBe('admin');
    expect(mockLocalStorage.getItem('admin_token')).toBe('legacy-admin-token');
  });
});
