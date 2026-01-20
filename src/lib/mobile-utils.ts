import { Capacitor } from '@capacitor/core';

/**
 * Get the base URL for the app (handles both web and mobile)
 */
export const getBaseUrl = (): string => {
  if (Capacitor.isNativePlatform()) {
    // For mobile, use the app's custom URL scheme
    return 'com.saiko.app://';
  }
  
  // For web, use the current origin
  return window.location.origin;
};

/**
 * Get the redirect URL for OAuth callbacks
 */
export const getRedirectUrl = (path: string = ''): string => {
  const baseUrl = getBaseUrl();
  return `${baseUrl}${path}`;
};
