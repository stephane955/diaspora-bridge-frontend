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
