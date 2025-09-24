import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

interface UserProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  address?: string;
  place?: string;
  role: string;
  store?: number;
  photo?: string;
}

interface Store {
  id: string;
  name: string;
  address?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  signIn: (username: string, password: string, role: string, storeId?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  registerStaff: (staffData: any) => Promise<void>;
  loading: boolean;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const API_BASE_URL = 'https://app-backend-code.onrender.com';

  useEffect(() => {
    const loadUser = async () => {
      setLoading(true);
      try {
        const storedToken = await AsyncStorage.getItem('authToken');
        const storedUser = await AsyncStorage.getItem('userData');
        
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          await fetchWithAuth('/api/accounts/profile/');
        }
      } catch (error) {
        console.error('Failed to load user:', error);
        await signOut();
      } finally {
        setLoading(false);
      }
    };
    
    loadUser();
  }, []);

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    let authToken = token;
    
    if (!authToken) {
      authToken = await AsyncStorage.getItem('authToken');
      if (authToken) setToken(authToken);
    }
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    };
    
    let response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    });
    
    if (response.status === 401) {
      const newToken = await refreshAuthToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(`${API_BASE_URL}${url}`, {
          ...options,
          headers,
        });
      } else {
        throw new Error('Session expired. Please login again.');
      }
    }
    
    return response;
  };

  const refreshAuthToken = async (): Promise<string | null> => {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      if (!refreshToken) return null;

      const res = await fetch(`${API_BASE_URL}/api/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!res.ok) return null;

      const { access } = await res.json();
      await AsyncStorage.setItem('authToken', access);
      setToken(access);
      return access;
    } catch (err) {
      console.error('Token refresh error:', err);
      return null;
    }
  };

  const signIn = async (username: string, password: string, role: string, storeId?: string) => {
    setLoading(true);
    try {
      // First verify staff store assignment if needed
      if (role === 'STAFF') {
        const storeResponse = await fetch(`${API_BASE_URL}/api/accounts/staff-stores/?username=${username}`);
        const storeData = await storeResponse.json();
        
        if (!storeData.assigned) {
          throw new Error('Your account is not assigned to any store. Contact admin.');
        }
        
        if (storeId && storeData.stores[0].id !== storeId) {
          throw new Error(`You are assigned to ${storeData.stores[0].name}, not the selected store`);
        }
        
        // Auto-fill store ID if only one is assigned
        if (storeData.stores.length === 1 && !storeId) {
          storeId = storeData.stores[0].id;
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/token/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          role,
          store_id: storeId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      await AsyncStorage.multiSet([
        ['authToken', data.access],
        ['refreshToken', data.refresh],
        ['userData', JSON.stringify(data.user)],
      ]);
      
      setToken(data.access);
      setUser(data.user);

      return data;
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed. Please try again.';
      
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
        
        if (error.message.includes('credentials')) {
          errorMessage = 'Invalid username or password';
        } else if (error.message.includes('assigned')) {
          errorMessage = 'Your account is not assigned to any store. Contact admin.';
        }
      }
      
      Alert.alert('Login Failed', errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.multiRemove(['authToken', 'refreshToken', 'userData']);
      setToken(null);
      setUser(null);
      router.replace('/login');
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await fetchWithAuth('/api/accounts/profile/');
      if (!response.ok) throw new Error('Failed to refresh user');
      
      const userData = await response.json();
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      await signOut();
    }
  };

  const registerStaff = async (staffData: any) => {
    try {
      const response = await fetchWithAuth('/api/accounts/register/admin/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...staffData,
          role: 'STAFF',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Staff registration failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        signIn,
        signOut,
        refreshUser,
        registerStaff,
        loading,
        fetchWithAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// 👇 Dummy default export to silence Expo Router warning (if needed)
export default () => null;