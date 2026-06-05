import { useMemo } from 'react';
import { resolveEvidenceImageUrl } from '@/lib/storage';

export function useEvidenceImageUrl(storedPath: string | null | undefined) {
    const url = useMemo(() => resolveEvidenceImageUrl(storedPath), [storedPath]);
    const failed = !!(storedPath && storedPath !== 'pending' && !url);

    return { url, loading: false, failed };
}
