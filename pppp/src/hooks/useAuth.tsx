// src/hooks/useAuth.tsx
import { createContext, useContext, useEffect, useRef, useState, ReactNode, FC } from 'react';
import { supabase } from '../lib/supabase';
import { logAdminAction } from '../lib/admin';
import { sendLoginNotificationEmail } from '../lib/emailService';
import type { User } from '@supabase/supabase-js';

export interface UserProfile {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  role: 'seller' | 'recycler';
  latitude: number;
  longitude: number;
  registered_at: string;
}

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (
    email: string,
    password: string,
    userData: Omit<UserProfile, 'user_id' | 'registered_at'>
  ) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signInAsAdmin: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      if (mountedRef.current) setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // Initialize session
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;

        if (mountedRef.current) {
          setUser(currentUser);
          setIsAdmin(localStorage.getItem('isAdmin') === 'true');
          if (currentUser) fetchProfile(currentUser.id);
          else setLoading(false);
        }

        supabase.auth.onAuthStateChange((_event, session) => {
          const newUser = session?.user ?? null;
          if (mountedRef.current) {
            setUser(newUser);
            if (newUser) fetchProfile(newUser.id);
            else {
              setProfile(null);
              setIsAdmin(false);
              setLoading(false);
            }
          }
        });
      } catch (err) {
        console.error('Auth init error:', err);
        if (mountedRef.current) {
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setLoading(false);
        }
      }
    };
    init();
  }, []);

  // --- Normal user sign-up ---
  const signUp = async (
    email: string,
    password: string,
    userData: Omit<UserProfile, 'user_id' | 'registered_at'>
  ) => {
    // 1. Call Backend to create user and profile (bypassing RLS)
    const backendUrl = (import.meta as any).env.VITE_RF_API_URL || "";

    const res = await fetch(`${backendUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, userData })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Signup failed");
    }

    // 2. Sign in to establish session on client
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    return data;
  };

  // --- Normal user sign-in ---
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Send Login Notification Email
    if (data.user) {
      // Fetch profile to get the name
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('name')
          .eq('user_id', data.user.id)
          .single();

        if (profile?.name) {
          await sendLoginNotificationEmail(email, profile.name);
        }
      } catch (e) {
        console.warn('Login notification email failed:', e);
      }
    }

    return data;
  };

  // --- Admin sign-in (real admin table) ---
  const signInAsAdmin = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_login', {
        email_input: email,
        password_input: password,
      });

      // Handle RPC errors or unexpected shapes defensively.
      if (error) {
        throw new Error(error.message || 'Admin RPC error');
      }

      if (!data) {
        throw new Error('Invalid admin credentials');
      }

      // Supabase RPC can return an array or a single object depending on implementation.
      const admin = Array.isArray(data) ? (data as any)[0] : (data as any);

      if (!admin) {
        // If RPC returned an empty result, surface a helpful message
        throw new Error('Admin login returned no user. Check RPC implementation.');
      }

      console.log('✅ Admin authenticated (RPC result):', admin);

      // Persist admin login across refresh. Use admin.email if present, otherwise the supplied email.
      localStorage.setItem('isAdmin', 'true');
      localStorage.setItem('adminEmail', admin.email ?? email);

      if (mountedRef.current) {
        // We don't rely on a normal Supabase `user` session for admins — leave `user` as null
        // to avoid mismatched shapes. The `isAdmin` flag controls admin routing.
        setUser(null);
        setProfile(null);
        setIsAdmin(true);
      }

      // Attempt to write an audit log for admin login (best-effort)
      try {
        await logAdminAction(admin.id ?? admin.email ?? null, 'admin_login', { email: admin.email ?? email, timestamp: new Date().toISOString() });
      } catch (err) {
        console.warn('Audit log write failed for admin_login:', err);
      }
    } catch (err) {
      console.error('Admin login failed:', err);
      localStorage.removeItem('isAdmin');
      localStorage.removeItem('adminEmail');
      throw err;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // --- Sign-out (both admin and normal user) ---
  const signOut = async () => {
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('adminEmail');

    if (mountedRef.current) {
      setIsAdmin(false);
      setUser(null);
      setProfile(null);
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  };

  // --- Reset Password ---
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  // --- Update Password ---
  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };

  const value: AuthContextType = {
    user,
    profile,
    loading,
    isAdmin,
    signUp,
    signIn,
    signInAsAdmin,
    signOut,
    resetPassword,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default useAuth;