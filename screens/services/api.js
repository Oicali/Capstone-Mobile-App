import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

const validateResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }
  return response.json();
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export const login = async (username, password) => {
  try {
    if (!username || !password) {
      return { success: false, message: 'Username and password are required' };
    }
    if (username.length < 4) {
      return { success: false, message: 'Username must be at least 4 characters' };
    }
    if (password.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters' };
    }

    const response = await fetch(`${BASE_URL}/auth/mobile/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ username: username.trim(), password: password.trim() }),
    });

    const data = await validateResponse(response);

    if (data.success && data.token) {
      await saveSession(data.token, data.user);
    }

    return data;
  } catch (error) {
    console.error('Login API Error:', error);
    if (error.message === 'Failed to fetch' || error.message.includes('Network')) {
      return { success: false, message: 'Cannot connect to server.' };
    }
    return { success: false, message: error.message || 'Login failed' };
  }
};

export const logout = async (token) => {
  try {
    if (token) {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
    }
    await clearSession();
    return { success: true };
  } catch (error) {
    console.error('Logout Error:', error);
    await clearSession();
    return { success: false };
  }
};

export const getProfile = async (token) => {
  try {
    const response = await fetch(`${BASE_URL}/auth/profile`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    return validateResponse(response);
  } catch (error) {
    console.error('Get Profile Error:', error);
    throw error;
  }
};

// ─── SESSION MANAGEMENT ───────────────────────────────────────────────────────

export const saveSession = async (token, user) => {
  await AsyncStorage.setItem('auth_token', token);
  await AsyncStorage.setItem('auth_user', JSON.stringify(user));
};

// ✅ FIX: Only remove auth keys, don't wipe all of AsyncStorage
export const clearSession = async () => {
  await AsyncStorage.multiRemove(['auth_token', 'auth_user']);
};

export const getSession = async () => {
  const token = await AsyncStorage.getItem('auth_token');
  const userRaw = await AsyncStorage.getItem('auth_user');
  if (!token || !userRaw) return null;
  return { token, user: JSON.parse(userRaw) };
};

// ✅ FIX: Add timeout + don't kill session on network failure
export const validateToken = async (token) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${BASE_URL}/auth/validate-token`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.status === 401) {
      // Explicitly unauthorized — token is truly invalid
      return false;
    }

    const data = await res.json();
    return data.success === true;
  } catch {
    // Network error or timeout — don't kill the session, assume still valid
    return true;
  }
};

// ─── BACKEND HEALTH ───────────────────────────────────────────────────────────

export const checkBackendConnection = async () => {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    return data.status === '✅ ok';
  } catch (error) {
    return false;
  }
};

// ─── CRIME DASHBOARD ──────────────────────────────────────────────────────────

const todayIso = () => new Date().toISOString().slice(0, 10);

const offsetDate = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const getPresetRange = (key) => {
  const t = todayIso();
  if (key === '7d')   return { from: offsetDate(-6),   to: t };
  if (key === '30d')  return { from: offsetDate(-29),  to: t };
  if (key === '3m')   return { from: offsetDate(-90),  to: t };
  if (key === '365d') return { from: offsetDate(-364), to: t };
  return null;
};

export const getGranularity = (preset, dateFrom, dateTo) => {
  if (preset === '7d')   return 'daily';
  if (preset === '30d')  return 'bidaily';
  if (preset === '3m')   return 'weekly';
  if (preset === '365d') return 'monthly';
  const days =
    Math.round((new Date(dateTo) - new Date(dateFrom)) / 86400000) + 1;
  if (days <= 16)  return 'daily';
  if (days <= 112) return 'weekly';
  return 'monthly';
};

export const getCrimeDashboard = async (filters) => {
  try {
    const session = await getSession();
    if (!session?.token) throw new Error('No auth token found');

    const granularity = getGranularity(
      filters.preset,
      filters.dateFrom,
      filters.dateTo,
    );

    const params = new URLSearchParams();
    if (filters.dateFrom)           params.set('date_from',   filters.dateFrom);
    if (filters.dateTo)             params.set('date_to',     filters.dateTo);
    if (filters.crimeTypes?.length) params.set('crime_types', filters.crimeTypes.join(','));
    if (filters.barangays?.length)  params.set('barangays',   filters.barangays.join(','));
    params.set('granularity', granularity);
    params.set('preset',      filters.preset);

    const response = await fetch(
      `${BASE_URL}/crime-dashboard/overview?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const data = await validateResponse(response);
    return data;
  } catch (error) {
    console.error('getCrimeDashboard Error:', error);
    throw error;
  }
};