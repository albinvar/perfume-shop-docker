import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStoredData();
  }, []);

  async function loadStoredData() {
    try {
      const storedUser = await authService.getCurrentUser();
      if (storedUser) {
        setUser(storedUser);
      }
    } catch (error) {
      console.error('Error loading stored data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email, password) {
    try {
      setError(null);
      const { user, token } = await authService.login(email, password);
      setUser(user);
      return true;
    } catch (error) {
      setError(error.response?.data?.message || 'Login failed');
      throw error;
    }
  }

  async function signUp(userData) {
    try {
      setError(null);
      const { user, token } = await authService.register(userData);
      setUser(user);
      return true;
    } catch (error) {
      setError(error.response?.data?.message || 'Registration failed');
      throw error;
    }
  }

  async function signOut() {
    try {
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      setError(error.message);
      throw error;
    }
  }

  async function updateProfile(profileData) {
    try {
      setError(null);
      const updatedUser = await authService.updateProfile(profileData);
      setUser(updatedUser);
      return updatedUser;
    } catch (error) {
      setError(error.response?.data?.message || 'Profile update failed');
      throw error;
    }
  }

  async function changePassword(currentPassword, newPassword) {
    try {
      setError(null);
      await authService.changePassword(currentPassword, newPassword);
      return true;
    } catch (error) {
      setError(error.response?.data?.message || 'Password change failed');
      throw error;
    }
  }

  async function forgotPassword(email) {
    try {
      setError(null);
      await authService.forgotPassword(email);
      return true;
    } catch (error) {
      setError(error.response?.data?.message || 'Password reset request failed');
      throw error;
    }
  }

  async function resetPassword(token, newPassword) {
    try {
      setError(null);
      await authService.resetPassword(token, newPassword);
      return true;
    } catch (error) {
      setError(error.response?.data?.message || 'Password reset failed');
      throw error;
    }
  }

  return (
    <AuthContext.Provider
      value={{
        signed: !!user,
        user,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        updateProfile,
        changePassword,
        forgotPassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 