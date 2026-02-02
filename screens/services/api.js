import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://localhost:5000';

const validateResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }
  return response.json();
};

export const login = async (username, password) => {
  try {
    if (!username || !password) {
      return {
        success: false,
        message: 'Username and password are required'
      };
    }

    if (username.length < 4) {
      return {
        success: false,
        message: 'Username must be at least 4 characters'
      };
    }

    if (password.length < 8) {
      return {
        success: false,
        message: 'Password must be at least 8 characters'
      };
    }

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ 
        username: username.trim(), 
        password: password.trim() 
      })
    });

    const data = await validateResponse(response);

    if (data.success && data.user) {
      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      console.log('Login successful - Token stored');
    }

    return data;

  } catch (error) {
    console.error('Login API Error:', error);
    
    if (error.message === 'Failed to fetch' || error.message.includes('Network')) {
      return {
        success: false,
        message: 'Cannot connect to server. Please check if backend is running on port 5000.'
      };
    }

    return {
      success: false,
      message: error.message || 'Login failed'
    };
  }
};

export const getProfile = async (token) => {
  try {
    const response = await fetch(`${API_URL}/auth/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return validateResponse(response);
  } catch (error) {
    console.error('Get Profile Error:', error);
    throw error;
  }
};

export const logout = async (token) => {
  try {
    if (token) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    }
    
    await AsyncStorage.clear();
    console.log('Logout successful');
    return { success: true };
    
  } catch (error) {
    console.error('Logout Error:', error);
    return { success: false };
  }
};

export const checkBackendConnection = async () => {
  try {
    const response = await fetch(`${API_URL}/`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    const data = await response.json();
    return data.message === 'CIRAS Backend Server is running!';
  } catch (error) {
    console.error('Backend connection check failed:', error);
    return false;
  }
};
