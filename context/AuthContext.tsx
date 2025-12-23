import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthContextType = {
    user: User | null;
    session: Session | null;
    isAuthenticated: boolean;
    login: () => void;
    logout: () => Promise<void>; // Changed to Promise
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // 1. Check active session on startup
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // 2. Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("Auth Event:", event); // Debugging
            setSession(session);
            setUser(session?.user ?? null);

            // If the user signed out, force them to login immediately
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
        <AuthContext.Provider value={{ user, session, isAuthenticated: !!user, login, logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};