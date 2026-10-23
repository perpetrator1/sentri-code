import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type UserRole = 'candidate' | 'examiner' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  quickLoginAs: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'sentri_auth_token';
const USER_KEY = 'sentri_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY);
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate token with backend if online
  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        } else if (res.status === 401) {
          // Token expired or invalid
          logout();
        }
      } catch (err) {
        // Backend offline: keep local cached user so platform is 100% offline-functional
        console.warn('Backend unreachable for auth check, using cached credentials.');
      } finally {
        setIsLoading(false);
      }
    }

    verifyToken();
  }, [token]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed.' };
      }

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return { success: true };
    } catch (err: any) {
      // Offline fallback login for demo accounts
      if (email.toLowerCase().includes('candidate')) {
        const mockUser: User = { id: 'cand-offline-77', email, name: 'Alex Rivera (Offline)', role: 'candidate' };
        setUser(mockUser);
        setToken('offline-candidate-token');
        localStorage.setItem(TOKEN_KEY, 'offline-candidate-token');
        localStorage.setItem(USER_KEY, JSON.stringify(mockUser));
        return { success: true };
      } else if (email.toLowerCase().includes('professor') || email.toLowerCase().includes('examiner')) {
        const mockUser: User = { id: 'exam-offline-1', email, name: 'Prof. Henderson (Offline)', role: 'examiner' };
        setUser(mockUser);
        setToken('offline-examiner-token');
        localStorage.setItem(TOKEN_KEY, 'offline-examiner-token');
        localStorage.setItem(USER_KEY, JSON.stringify(mockUser));
        return { success: true };
      }
      return { success: false, error: 'Network error and credentials could not be verified offline.' };
    }
  };

  const register = async (name: string, email: string, password: string, role: UserRole): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Registration failed.' };
      }

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: 'Network error during registration.' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const quickLoginAs = async (role: UserRole) => {
    if (role === 'candidate') {
      await login('candidate@sentri.dev', 'password123');
    } else if (role === 'examiner') {
      await login('professor@sentri.dev', 'password123');
    } else {
      await login('admin@sentri.dev', 'password123');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        quickLoginAs,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
