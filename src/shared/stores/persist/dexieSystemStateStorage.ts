import type { StateStorage } from 'zustand/middleware';
import { deleteSystemState, getSystemState, setSystemState } from '@/data/repositories/systemRepository';

interface DexieSystemStateStorageOptions {
  /** systemState에 저장될 key prefix (충돌 방지용) */
  prefix: string;
}

export function createDexieSystemStateStorage(
  options: DexieSystemStateStorageOptions
): StateStorage {
  const prefix = options.prefix;

  const memoryStorage = new Map<string, string>();
  let shouldUseMemoryStorageOnly = false;

  return {
    getItem: async (name: string) => {
      if (shouldUseMemoryStorageOnly) {
        return memoryStorage.get(`${prefix}${name}`) ?? null;
      }
      try {
        const value = await getSystemState<string>(`${prefix}${name}`);
        return value ?? null;
      } catch (error) {
        console.error('[DexieSystemStateStorage] getItem failed:', error);
        shouldUseMemoryStorageOnly = true;
        return memoryStorage.get(`${prefix}${name}`) ?? null;
      }
    },
    setItem: async (name: string, value: string) => {
      if (shouldUseMemoryStorageOnly) {
        memoryStorage.set(`${prefix}${name}`, value);
        return;
      }
      try {
        await setSystemState(`${prefix}${name}`, value);
      } catch (error) {
        console.error('[DexieSystemStateStorage] setItem failed:', error);
        shouldUseMemoryStorageOnly = true;
        memoryStorage.set(`${prefix}${name}`, value);
      }
    },
    removeItem: async (name: string) => {
      if (shouldUseMemoryStorageOnly) {
        memoryStorage.delete(`${prefix}${name}`);
        return;
      }
      try {
        await deleteSystemState(`${prefix}${name}`);
      } catch (error) {
        console.error('[DexieSystemStateStorage] removeItem failed:', error);
        shouldUseMemoryStorageOnly = true;
        memoryStorage.delete(`${prefix}${name}`);
      }
    },
  };
}
