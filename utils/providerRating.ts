import type { SupabaseClient } from '@supabase/supabase-js';

export type ProviderRatingSummary = {
    average: number | null;
    count: number;
};

export async function fetchProviderRating(
    supabase: SupabaseClient,
    providerId: string,
): Promise<ProviderRatingSummary> {
    const { data } = await supabase
        .from('reviews')
        .select('rating')
        .eq('provider_id', providerId);

    if (!data?.length) return { average: null, count: 0 };

    const sum = data.reduce((acc, row) => acc + Number(row.rating), 0);
    return {
        average: Math.round((sum / data.length) * 10) / 10,
        count: data.length,
    };
}

/** Recompute average from all reviews and persist on profiles.rating */
export async function syncProviderRating(
    supabase: SupabaseClient,
    providerId: string,
): Promise<ProviderRatingSummary> {
    const summary = await fetchProviderRating(supabase, providerId);
    if (summary.average !== null) {
        await supabase.from('profiles').update({ rating: summary.average }).eq('id', providerId);
    }
    return summary;
}
