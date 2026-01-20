import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

/**
 * Storage adapter for Supabase that uses Capacitor Preferences on native
 * and localStorage on web.
 * 
 * Supabase supports both sync and async storage adapters.
 * For native platforms, we use async Capacitor Preferences.
 * For web, we use sync localStorage.
 */
export const createCapacitorStorage = () => {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    // Native: Use async Capacitor Preferences
    return {
      getItem: async (key: string): Promise<string | null> => {
        try {
          const { value } = await Preferences.get({ key });
          return value;
        } catch (error) {
          console.error('Error getting item from storage:', error);
          return null;
        }
      },
      setItem: async (key: string, value: string): Promise<void> => {
        try {
          await Preferences.set({ key, value });
        } catch (error) {
          console.error('Error setting item in storage:', error);
          throw error;
        }
      },
      removeItem: async (key: string): Promise<void> => {
        try {
          await Preferences.remove({ key });
        } catch (error) {
          console.error('Error removing item from storage:', error);
          throw error;
        }
      },
    };
  }

  // Web: Use sync localStorage
  return {
    getItem: (key: string): string | null => {
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        console.error('Error getting item from localStorage:', error);
        return null;
      }
    },
    setItem: (key: string, value: string): void => {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        console.error('Error setting item in localStorage:', error);
        throw error;
      }
    },
    removeItem: (key: string): void => {
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        console.error('Error removing item from localStorage:', error);
        throw error;
      }
    },
  };
};
