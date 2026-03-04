import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserRole = 'client' | 'provider' | null;

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

function getRoleFromUser(user: User | null): UserRole {
    const role = user?.user_metadata?.role ?? user?.raw_user_meta_data?.role;
    if (role === 'client' || role === 'provider') return role;
    return null;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [role, setRole] = useState<UserRole>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            const u = session?.user ?? null;
            setUser(u);
            setRole(getRoleFromUser(u));
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            const u = session?.user ?? null;
            setSession(session);
            setUser(u);
            setRole(getRoleFromUser(u));

            if (event === 'SIGNED_OUT') {
                router.replace('/login');
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const login = () => {};

    const logout = async () => {
        try {
            // 1. Kill Supabase Session
            await supabase.auth.signOut();

            // 2. MANUALLY reset state to fix the "Stuck" bug
            setUser(null);
            setSession(null);

            // 3. Clear all local persistence
            await AsyncStorage.multiRemove(['loggedIn', 'userRole']);

            // 4. Force Redirect
            router.replace('/login');
        } catch (error) {
            console.error("Logout error:", error);
            // Fallback
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
