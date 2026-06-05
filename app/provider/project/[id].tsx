import { Redirect, useLocalSearchParams } from 'expo-router';

export default function ProviderProjectRedirect() {
    const { id } = useLocalSearchParams<{ id?: string }>();

    // Safety check: if no ID, go back to dashboard
    if (!id) return <Redirect href="/provider" />;

    return <Redirect href={`/workroom/${id}`} />;
}