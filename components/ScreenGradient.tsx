import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePremiumColors } from '@/hooks/usePremiumColors';

type Props = {
    children: React.ReactNode;
    colors?: readonly [string, string, ...string[]];
    style?: any;
};

/** Full-screen gradient that follows Light/Dark premium palette. */
export default function ScreenGradient({ children, colors, style }: Props) {
    const c = usePremiumColors();
    const fallback: [string, string, ...string[]] = c.isDark
        ? [c.bg, '#0F172A', c.surface]
        : ['#FFFFFF', c.bg, c.surfaceAlt];

    return (
        <LinearGradient
            colors={colors ?? fallback}
            style={[styles.fill, style]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
        >
            {children}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
});
