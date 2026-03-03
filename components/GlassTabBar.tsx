import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

type Theme = 'light' | 'dark';

// Inline design tokens so tab bar never depends on theme module resolution at runtime
const COLORS = {
    active: '#0EA5E9',
    activeSoft: '#38BDF8',
    textSubtle: '#94A3B8',
    textMuted: '#64748B',
    glass: 'rgba(255,255,255,0.65)',
    glassDark: 'rgba(15,23,42,0.7)',
};

const ROUTE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    index: 'home',
    new: 'add-circle',
    profile: 'person',
    projects: 'briefcase',
    wallet: 'wallet',
    market: 'search',
    menu: 'menu',
    active: 'briefcase',
    earnings: 'wallet',
    inbox: 'chatbubbles',
    timeline: 'time',
};

export default function GlassTabBar(props: BottomTabBarProps & { theme?: Theme }) {
    const { state, descriptors, navigation, theme = 'light' } = props;

    const visibleRoutes = state.routes.filter((route) => {
        const options = descriptors[route.key]?.options ?? {};
        const href = (options as { href?: string | null }).href;
        const display = (options as { display?: string }).display;
        if (href === null || display === 'none') return false;
        return true;
    });

    const isDark = theme === 'dark';

    return (
        <View
            style={[
                styles.container,
                Platform.OS === 'ios' && styles.shadowIos,
                Platform.OS === 'android' && styles.shadowAndroid,
            ]}
            pointerEvents="box-none"
        >
            <BlurView
                intensity={80}
                tint={isDark ? 'dark' : 'light'}
                style={[
                    styles.glass,
                    isDark ? styles.glassDark : styles.glassLight,
                ]}
            >
                {visibleRoutes.map((route, index) => {
                    const isFocused = state.routes[state.index].key === route.key;
                    const options = descriptors[route.key]?.options ?? {};
                    const iconName = ROUTE_ICONS[route.name] ?? 'ellipse';
                    const icon = (isFocused ? iconName : `${iconName}-outline`) as keyof typeof Ionicons.glyphMap;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });
                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name, route.params);
                        }
                    };

                    return (
                        <TouchableOpacity
                            key={route.key}
                            accessibilityRole="button"
                            accessibilityState={isFocused ? { selected: true } : {}}
                            onPress={onPress}
                            style={styles.tab}
                            activeOpacity={0.8}
                        >
                            <View style={styles.iconWrap}>
                                <Ionicons
                                    name={icon in Ionicons.glyphMap ? icon : 'ellipse-outline'}
                                    size={26}
                                    color={isFocused ? COLORS.active : (isDark ? COLORS.textSubtle : COLORS.textMuted)}
                                />
                                {isFocused && (
                                    <View style={[styles.activeDot, isDark ? styles.activeDotDark : styles.activeDotLight]} />
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 24,
        left: 20,
        right: 20,
        height: 70,
        borderRadius: 35,
        overflow: 'hidden',
    },
    shadowIos: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
    },
    shadowAndroid: {
        elevation: 12,
    },
    glass: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        borderRadius: 35,
        overflow: 'hidden',
    },
    glassLight: {
        borderWidth: 1,
        borderColor: COLORS.glass,
    },
    glassDark: {
        borderWidth: 1,
        borderColor: COLORS.glassDark,
    },
    tab: {
        flex: 1,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeDot: {
        position: 'absolute',
        bottom: -8,
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    activeDotLight: {
        backgroundColor: COLORS.active,
        shadowColor: COLORS.active,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
    activeDotDark: {
        backgroundColor: COLORS.activeSoft,
        shadowColor: COLORS.activeSoft,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
});
