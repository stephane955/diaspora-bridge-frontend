import { Redirect, useLocalSearchParams } from 'expo-router';

export default function ProviderProjectRedirect() {
    const { id } = useLocalSearchParams();

    // Safety check: if no ID, go back to dashboard
    if (!id) return <Redirect href="/provider" />;

    // This MUST match the folder name where your management screen is
    return <Redirect href={`/provider/job/${id}`} />;
}