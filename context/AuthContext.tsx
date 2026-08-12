import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveAccountRole } from '@/lib/resolveAccountRole';

export type UserRole = 'client' | 'provider' | 'supplier' | null;

type AuthContextType = {
    user: User | null;
    session: Session | null;
    /** Role from Supabase auth.users.raw_user_meta_data.role (or user_metadata.role). Set at signup/login to prevent routing leaks. */
    role: UserRole;
    isAuthenticated: boolean;
    loading: boolean;
    login: () => void;
    logout: () => Promise<void>;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [role, setRole] = useState<UserRole>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setSession(session);
            const u = session?.user ?? null;
            setUser(u);
            setRole(u ? await resolveAccountRole(u) : null);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            const u = session?.user ?? null;
            setSession(session);
            setUser(u);
            setRole(u ? await resolveAccountRole(u) : null);

            if (event === 'SIGNED_OUT') {
                router.replace('/login');
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const login = () => {};

    const logout = async () => {
        try {
            await supabase.auth.signOut();
            setUser(null);
            setSession(null);
            setRole(null);

            const keys = await AsyncStorage.getAllKeys();
            const purge = keys.filter(
                (k) =>
                    k.startsWith('chat_read_') ||
                    k === 'loggedIn' ||
                    k === 'userRole',
            );
            if (purge.length) await AsyncStorage.multiRemove(purge);

            router.replace('/login');
        } catch (error) {
            console.error('Logout error:', error);
            setUser(null);
            setSession(null);
            setRole(null);
            router.replace('/login');
        }
    };

    return (
        <AuthContext.Provider value={{ user, session, role, isAuthenticated: !!user, loading, login, logout, signOut: logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
