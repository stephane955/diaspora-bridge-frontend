const DEFAULT_RADIUS_M = 500;

/**
 * Distance in meters between two lat/lng points (Haversine approximation).
 */
export function distanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6371000 * c; // meters
}

export type GeofenceResult = {
    allowed: boolean;
    distanceMeters?: number;
    message?: string;
};

/**
 * Check if the user is within radiusM of the project site.
 * If project has no coordinates, returns allowed: true.
 * Uses expo-location when available; if unresolved, allows submission (no geofence).
 */
export async function checkProjectGeofence(
    projectLat: number | null | undefined,
    projectLon: number | null | undefined,
    radiusM: number = DEFAULT_RADIUS_M
): Promise<GeofenceResult> {
    if (
        projectLat == null ||
        projectLon == null ||
        typeof projectLat !== 'number' ||
        typeof projectLon !== 'number'
    ) {
        return { allowed: true };
    }

    try {
        const locModule = 'expo-' + 'location';
        const Location = require(locModule) as typeof import('expo-location');

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            return {
                allowed: true,
                message: 'Location permission not granted; cannot verify site.',
            };
        }

        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });
        const lat = location.coords.latitude;
        const lon = location.coords.longitude;
        const dist = distanceMeters(lat, lon, projectLat, projectLon);

        if (dist <= radiusM) {
            return { allowed: true, distanceMeters: dist };
        }
        return {
            allowed: false,
            distanceMeters: dist,
            message: `You are about ${Math.round(dist)} m from the site. Please be at the project location to submit updates.`,
        };
    } catch (_) {
        return { allowed: true };
    }
}
