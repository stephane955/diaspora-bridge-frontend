import React, { useState, useEffect } from 'react';
import {
    View, Text, Image, TouchableOpacity, ActivityIndicator,
    StyleSheet, ImageStyle, StyleProp, ViewStyle, NativeSyntheticEvent, ImageErrorEventData,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEvidenceImageUrl } from '@/hooks/useEvidenceImageUrl';
import { PREMIUM_GOLD } from '@/constants/layout';

type Props = {
    path: string | null | undefined;
    style?: StyleProp<ImageStyle>;
    containerStyle?: StyleProp<ViewStyle>;
    onPress?: (url: string) => void;
    resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
};

export default function EvidenceImage({
    path,
    style,
    containerStyle,
    onPress,
    resizeMode = 'cover',
}: Props) {
    const { url, loading, failed } = useEvidenceImageUrl(path);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        setLoadError(false);
    }, [path, url]);

    const flatStyle = StyleSheet.flatten(style) ?? {};
    const placeholderStyle: ViewStyle = {
        width: flatStyle.width,
        height: flatStyle.height,
        borderRadius: flatStyle.borderRadius,
    };

    if (loading) {
        return (
            <View style={[styles.placeholder, containerStyle, placeholderStyle]}>
                <ActivityIndicator color={PREMIUM_GOLD} />
            </View>
        );
    }

    if (failed || !url) {
        return (
            <View style={[styles.placeholder, containerStyle, placeholderStyle]}>
                <Ionicons name="image-outline" size={28} color="#64748B" />
                <Text style={styles.errorText}>Image unavailable</Text>
            </View>
        );
    }

    if (loadError) {
        return (
            <View style={[styles.placeholder, containerStyle, placeholderStyle]}>
                <Ionicons name="alert-circle-outline" size={28} color="#F87171" />
                <Text style={styles.errorText}>Failed to load image</Text>
            </View>
        );
    }

    const handleError = (e: NativeSyntheticEvent<ImageErrorEventData>) => {
        console.log('EvidenceImage Load Error:', e.nativeEvent.error, { path, url });
        setLoadError(true);
    };

    const image = (
        <Image
            source={{ uri: url }}
            style={style}
            resizeMode={resizeMode}
            onError={handleError}
        />
    );

    if (onPress) {
        return (
            <TouchableOpacity activeOpacity={0.95} onPress={() => onPress(url)} style={containerStyle}>
                {image}
            </TouchableOpacity>
        );
    }

    return <View style={containerStyle}>{image}</View>;
}

const styles = StyleSheet.create({
    placeholder: {
        backgroundColor: '#334155',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: 80,
    },
    errorText: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '600',
    },
});
