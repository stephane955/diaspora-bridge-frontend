import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, SafeAreaView, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGlobal } from '../context/GlobalContext';
import { supabase } from '../../lib/supabase'; // Import the cloud connection

export default function PostUpdateScreen() {
    const router = useRouter();
    const { addEvent } = useGlobal(); // Get the function to save data

    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const [photo, setPhoto] = useState<string | null>(null);
    const [facing, setFacing] = useState<'back' | 'front'>('back');
    const [uploading, setUploading] = useState(false); // New state to show spinner while uploading

    // 1. Permission Loading
    if (!permission) {
        return <View style={styles.container} />;
    }

    // 2. Permission Denied
    if (!permission.granted) {
        return (
            <View style={styles.permissionContainer}>
                <Ionicons name="camera-off" size={64} color="#ccc" />
                <Text style={styles.permTitle}>Camera Access Needed</Text>
                <Text style={styles.permText}>To post updates for your clients, we need access to your camera.</Text>
                <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
                    <Text style={styles.permBtnText}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // 3. Take Picture Logic
    const takePicture = async () => {
        if (cameraRef.current) {
            // quality: 0.5 makes the upload faster
            const photoData = await cameraRef.current.takePictureAsync({ quality: 0.5 });
            setPhoto(photoData?.uri || null);
        }
    };

    // 4. Send Update Logic (The Cloud Upload)
    const sendUpdate = async () => {
        if (!photo) return;

        try {
            setUploading(true); // Start spinner

            // A. Create a unique file name using the current time
            const fileName = `${Date.now()}.jpg`;

            // B. Prepare the file for upload
            const formData = new FormData();
            formData.append('file', {
                uri: photo,
                name: fileName,
                type: 'image/jpeg',
            } as any);

            // C. Upload to Supabase Storage Bucket 'job_photos'
            const { data, error } = await supabase.storage
                .from('job_photos')
                .upload(fileName, formData, {
                    contentType: 'image/jpeg',
                });

            if (error) {
                throw error;
            }

            // D. Get the Public Internet Link for the photo
            const { data: publicData } = supabase.storage
                .from('job_photos')
                .getPublicUrl(fileName);

            const publicImageLink = publicData.publicUrl;

            // E. Save to Database using the real cloud link
            addEvent({
                title: 'Work Update',
                status: 'pending_approval',
                description: 'Here is the latest progress from the site.',
                image: publicImageLink // We save the URL, not the local file path
            });

            alert('Update Sent to Client! 🚀');
            router.replace('/provider/active'); // Go back to work list

        } catch (error) {
            console.log('Error uploading:', error);
            alert('Failed to upload photo. Please try again.');
        } finally {
            setUploading(false); // Stop spinner
        }
    };

    // ---------------- RENDER ---------------- //

    // A. PREVIEW MODE (After taking photo)
    if (photo) {
        return (
            <View style={styles.container}>
                <Image source={{ uri: photo }} style={styles.previewImage} />

                {/* Overlay Controls */}
                <View style={styles.overlay}>
                    <View style={styles.previewActions}>
                        <TouchableOpacity
                            style={styles.retakeBtn}
                            onPress={() => setPhoto(null)}
                            disabled={uploading}
                        >
                            <Ionicons name="refresh" size={24} color="#fff" />
                            <Text style={styles.retakeText}>Retake</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.sendBtn}
                            onPress={sendUpdate}
                            disabled={uploading}
                        >
                            {uploading ? (
                                <ActivityIndicator color="#000" />
                            ) : (
                                <>
                                    <Text style={styles.sendText}>Send Update</Text>
                                    <Ionicons name="send" size={20} color="#000" />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    // B. CAMERA MODE
    return (
        <View style={styles.container}>
            <CameraView
                style={styles.camera}
                facing={facing}
                ref={cameraRef}
            >
                {/* Top Controls */}
                <SafeAreaView style={styles.topControls}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                </SafeAreaView>

                {/* Bottom Controls */}
                <View style={styles.bottomControls}>
                    <View style={styles.spacer} />

                    {/* Shutter Button */}
                    <TouchableOpacity style={styles.shutterOuter} onPress={takePicture}>
                        <View style={styles.shutterInner} />
                    </TouchableOpacity>

                    {/* Flip Camera */}
                    <TouchableOpacity
                        style={styles.flipBtn}
                        onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
                        <Ionicons name="camera-reverse" size={28} color="#fff" />
                    </TouchableOpacity>
                </View>
            </CameraView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    camera: { flex: 1 },

    // Permission Styles
    permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#fff' },
    permTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
    permText: { textAlign: 'center', color: '#666', marginBottom: 30, lineHeight: 22 },
    permButton: { backgroundColor: '#007AFF', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 30 },
    permBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    // Camera UI
    topControls: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, marginTop: 10 },
    bottomControls: { position: 'absolute', bottom: 50, flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 40 },
    iconBtn: { padding: 10, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20 },

    shutterOuter: { width: 80, height: 80, borderRadius: 40, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    shutterInner: { width: 65, height: 65, borderRadius: 35, backgroundColor: '#fff' },
    spacer: { width: 40 },
    flipBtn: { width: 40, alignItems: 'center' },

    // Preview UI
    previewImage: { flex: 1 },
    overlay: { position: 'absolute', bottom: 50, width: '100%', alignItems: 'center' },
    previewActions: { flexDirection: 'row', gap: 20 },
    retakeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 15, paddingHorizontal: 25, borderRadius: 30, gap: 10 },
    retakeText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    sendBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 15, paddingHorizontal: 25, borderRadius: 30, gap: 10 },
    sendText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});