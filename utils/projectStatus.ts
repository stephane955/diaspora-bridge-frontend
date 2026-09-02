export type NormalizedProjectStatus = 'pending' | 'in_progress' | 'completed';

export function normalizeProjectStatus(status?: string | null): NormalizedProjectStatus {
    const s = (status || '').toLowerCase().trim();
    if (s === 'completed') return 'completed';
    if (s === 'in_progress' || s === 'in progress') return 'in_progress';
    return 'pending';
}

export function isActiveProjectStatus(status?: string | null): boolean {
    return normalizeProjectStatus(status) === 'in_progress';
}

export function projectStatusProgress(status?: string | null): number {
    switch (normalizeProjectStatus(status)) {
        case 'completed':
            return 1;
        case 'in_progress':
            return 0.65;
        default:
            return 0.3;
    }
}
