import { useEffect, useState, useCallback } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

/**
 * Lightweight online/offline signal for Low-Data Workroom.
 */
export function useNetworkStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const apply = (state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsConnected(online);
      setIsOffline(!online);
    };
    const unsub = NetInfo.addEventListener(apply);
    NetInfo.fetch().then(apply);
    return () => unsub();
  }, []);

  const refresh = useCallback(async () => {
    const state = await NetInfo.fetch();
    const online = state.isConnected === true && state.isInternetReachable !== false;
    setIsConnected(online);
    setIsOffline(!online);
    return online;
  }, []);

  return { isOffline, isConnected, refresh };
}
