/**
 * @file useMusicPlayer.ts
 * @description FocusView에서 사용하는 음악 플레이어 로직(트랙 로드/재생 제어)을 캡슐화합니다.
 */

import { useEffect } from 'react';

import { useSettingsStore } from '@/shared/stores/settingsStore';
import { useFocusMusicStore } from '@/features/schedule/stores/focusMusicStore';

/**
 * 음악 플레이어 상태/핸들러를 제공합니다.
 * - 트랙이 비어있을 경우 최초 1회 로드합니다.
 */
export const useMusicPlayer = () => {
  const { settings } = useSettingsStore();
  const store = useFocusMusicStore();

  useEffect(() => {
    if (store.musicTracks.length === 0 && !store.isMusicLoading) {
      store.fetchMusicTracks(settings?.githubToken);
    }
  }, [store.musicTracks.length, store.isMusicLoading, store.fetchMusicTracks, settings?.githubToken]);

  return store;
};
