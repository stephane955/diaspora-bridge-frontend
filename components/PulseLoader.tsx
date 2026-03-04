import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

type Props = {
    size?: number;
    color?: string;
};

export default function PulseLoader({ size = 48, color = theme.colors.active }: Props) {
    const scale = useRef(new Animated.Value(0.85)).current;
    const opacity = useRef(new Animated.Value(0.4)).current;

    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.parallel([
                    Animated.timing(scale, { toValue: 1.15, duration: 700, useNativeDriver: true }),
                    Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
                ]),
                Animated.parallel([
                    Animated.timing(scale, { toValue: 0.85, duration: 700, useNativeDriver: true }),
                    Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
                ]),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [scale, opacity]);

    return (
        <View style={styles.wrap}>
            <Animated.View
                style={[
                    styles.dot,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: color,
                        transform: [{ scale }],
                        opacity,
                    },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center', padding: 20 },
    dot: {},
});
