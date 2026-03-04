import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';

type Props = {
    children: React.ReactNode;
    colors?: readonly [string, string, ...string[]];
    style?: any;
};

export default function ScreenGradient({ children, colors, style }: Props) {
    const { theme } = useTheme();
    return (
        <LinearGradient
            colors={colors ?? theme.gradient.screen as [string, string, ...string[]]}
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
