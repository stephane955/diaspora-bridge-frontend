import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';
import { supabase } from '@/lib/supabase';

const VOICE_BUCKET = 'voice-notes';

export function useVoiceRecorder(projectId: string) {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [uploading, setUploading] = useState(false);

  const clearDurationTimer = () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  };

  const requestMicrophonePermission = useCallback(async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Microphone access',
        'Allow microphone access to send voice notes.'
      );
      return false;
    }
    return true;
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    const allowed = await requestMicrophonePermission();
    if (!allowed) return;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      durationTimerRef.current = setInterval(async () => {
        const rec = recordingRef.current;
        if (!rec) return;
        const status = await rec.getStatusAsync();
        if (status.isRecording) {
          setRecordingDuration(Math.floor(status.durationMillis / 1000));
        }
      }, 250);
    } catch (e) {
      console.warn('startRecording failed', e);
      setIsRecording(false);
      clearDurationTimer();
    }
  }, [isRecording, requestMicrophonePermission]);

  const stopRecording = useCallback(async () => {
    const rec = recordingRef.current;
    if (!rec) return null;

    clearDurationTimer();
    setIsRecording(false);

    try {
      const status = await rec.getStatusAsync();
      const durationSec = status.isRecording
        ? Math.floor(status.durationMillis / 1000)
        : recordingDuration;

      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;
      setRecordingDuration(0);

      if (!uri || durationSec < 1) return null;
      return { uri, durationSec };
    } catch (e) {
      console.warn('stopRecording failed', e);
      recordingRef.current = null;
      setRecordingDuration(0);
      return null;
    }
  }, [recordingDuration]);

  const uploadVoiceNote = useCallback(
    async (localUri: string) => {
      if (!projectId) return null;
      setUploading(true);
      try {
        const path = `${projectId}/voice_${Date.now()}.m4a`;
        const response = await fetch(localUri);
        const arrayBuffer = await response.arrayBuffer();
        const { error: uploadError } = await supabase.storage
          .from(VOICE_BUCKET)
          .upload(path, arrayBuffer, { contentType: 'audio/mp4' });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from(VOICE_BUCKET).getPublicUrl(path);
        return data.publicUrl;
      } catch (e) {
        console.error('uploadVoiceNote:', e);
        Alert.alert('Upload failed', 'Could not upload voice note. Please try again.');
        return null;
      } finally {
        setUploading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    return () => {
      clearDurationTimer();
      recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
    };
  }, []);

  return {
    isRecording,
    recordingDuration,
    uploading,
    startRecording,
    stopRecording,
    uploadVoiceNote,
  };
}
