import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.saiko.app',
  appName: 'Saiko',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    // Allow navigation to external URLs for OAuth
    allowNavigation: [
      'www.strava.com',
      'strava.com',
      '*.supabase.co',
      '*.supabase.io',
    ],
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
    // Configure URL schemes for deep linking
    scheme: 'com.saiko.app',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#000000',
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#ffffff',
    },
    App: {
      // Handle OAuth redirects
      launchUrl: 'com.saiko.app://',
    },
  },
};

export default config;
