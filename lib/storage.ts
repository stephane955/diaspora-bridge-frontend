import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';

/** KYC: upload to kyc_documents/{userId}/filename (private). Compress before upload. */
export async function uploadKycDocument(uri: string, userId: string, filename: string): Promise<string> {
    const manip = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
    );
    const response = await fetch(manip.uri);
    const blob = await response.blob();
    const path = `${userId}/${filename}`;
    const { error } = await supabase.storage.from('kyc_documents').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('kyc_documents').getPublicUrl(path);
    return data.publicUrl;
}

/** Project media: upload to project_media/{projectId}/{filename}. Compress before upload. */
export async function uploadProjectMedia(uri: string, projectId: string, filename: string): Promise<string> {
    const manip = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
    );
    const response = await fetch(manip.uri);
    const blob = await response.blob();
    const path = `${projectId}/${filename}`;
    const { error } = await supabase.storage.from('project_media').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('project_media').getPublicUrl(path);
    return data.publicUrl;
}

/** Avatars: upload to avatars/{userId}/avatar.jpg (public). */
export async function uploadAvatar(uri: string, userId: string): Promise<string> {
    const manip = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 400 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    const response = await fetch(manip.uri);
    const blob = await response.blob();
    const path = `${userId}/avatar.jpg`;
    const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
}

/** Normalize stored evidence path: strip legacy `evidence/` prefix(es) and pass through full URLs. */
export function normalizeEvidencePath(stored: string): string {
    if (stored.startsWith('http://') || stored.startsWith('https://')) {
        return stored;
    }
    let path = stored;
    while (path.startsWith('evidence/')) {
        path = path.slice('evidence/'.length);
    }
    return path;
}

/** Milestone evidence: upload to evidence bucket root as `{milestoneId}_{ts}.jpg`. Returns storage path for DB. */
export async function uploadMilestoneEvidence(uri: string, milestoneId: string): Promise<string> {
    const manip = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
    );
    const response = await fetch(manip.uri);
    const blob = await response.blob();
    const path = `${milestoneId}_${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('evidence').upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: true,
    });
    if (error) throw error;
    return path;
}

/** Resolve stored evidence path to public URL (evidence bucket is public). */
export function resolveEvidenceImageUrl(stored: string | null | undefined): string | null {
    if (!stored || stored === 'pending') return null;
    if (stored.startsWith('http://') || stored.startsWith('https://')) return stored;

    const path = normalizeEvidencePath(stored);
    const { data } = supabase.storage.from('evidence').getPublicUrl(path);
    return data.publicUrl;
}
