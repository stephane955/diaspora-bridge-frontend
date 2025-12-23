import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// -----------------------------------------------------------------------
// YOUR KEYS (Keep these exactly as you had them)
// -----------------------------------------------------------------------
const supabaseUrl = 'https://xtyqcdktwxzuezarnqhz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0eXFjZGt0d3h6dWV6YXJucWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NzQwNzQsImV4cCI6MjA4MTU1MDA3NH0.2n7rf2-7dVtb2f0BoRjJQoX0uHDW_b1W0TXImvK2yAk';

// --- NEW: Custom Storage Adapter to fix "window is not defined" ---
const ExpoStorage = {
    getItem: (key: string) => {
        // If we are on the Server (Node.js), return null
        if (Platform.OS === 'web' && typeof window === 'undefined') {
            return Promise.resolve(null);
        }
        return AsyncStorage.getItem(key);
    },
    setItem: (key: string, value: string) => {
        if (Platform.OS === 'web' && typeof window === 'undefined') {
            return Promise.resolve();
        }
        return AsyncStorage.setItem(key, value);
    },
    removeItem: (key: string) => {
        if (Platform.OS === 'web' && typeof window === 'undefined') {
            return Promise.resolve();
        }
        return AsyncStorage.removeItem(key);
    },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: ExpoStorage, // <--- Use our safe storage here
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// Tells Supabase to handle app background/foreground changes
AppState.addEventListener('change', (state) => {
    if (state === 'active') {
        supabase.auth.startAutoRefresh();
    } else {
        supabase.auth.stopAutoRefresh();
    }
});