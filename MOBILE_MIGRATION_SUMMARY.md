# Mobile Migration Summary

This document summarizes the changes made to convert the Saiko web app into an iOS app ready for TestFlight.

## What Was Done

### 1. Capacitor Integration
- ✅ Installed Capacitor core packages and iOS platform
- ✅ Created `capacitor.config.ts` with iOS-specific settings
- ✅ Configured URL schemes for OAuth callbacks (`com.saiko.app://`)
- ✅ Added build scripts for iOS development

### 2. Storage Migration
- ✅ Created `src/lib/capacitor-storage.ts` - Storage adapter that uses:
  - **Native (iOS)**: Capacitor Preferences (async, secure)
  - **Web**: localStorage (sync)
- ✅ Updated `src/lib/supabase.ts` to use the new storage adapter
- ✅ Ensures authentication tokens persist securely on mobile

### 3. Mobile-Specific Utilities
- ✅ Created `src/lib/mobile-utils.ts` with:
  - `getBaseUrl()` - Returns correct base URL for web vs mobile
  - `getRedirectUrl()` - Handles OAuth redirect URLs for both platforms
- ✅ Updated `src/contexts/AuthContext.tsx` to use mobile-aware redirect URLs
- ✅ Updated `src/lib/strava.ts` to use mobile-aware redirect URLs

### 4. App Initialization
- ✅ Updated `src/main.tsx` to:
  - Initialize Capacitor plugins on mobile
  - Handle app state changes
  - Handle URL open events for OAuth callbacks
  - Skip service worker registration on native platforms
  - Configure StatusBar for iOS

### 5. iOS Configuration
- ✅ Created `ios/App/App/Info.plist.template` with:
  - URL schemes for OAuth (`com.saiko.app`)
  - Privacy permissions (camera, photo library)
  - App metadata and display settings
- ✅ Created comprehensive `IOS_SETUP.md` guide

### 6. Build Scripts
Added to `package.json`:
- `npm run cap:sync` - Build and sync with Capacitor
- `npm run cap:ios` - Build, sync, and open in Xcode
- `npm run cap:ios:run` - Build, sync, and run on iOS

## Key Files Changed

### New Files
- `capacitor.config.ts` - Capacitor configuration
- `src/lib/capacitor-storage.ts` - Storage adapter
- `src/lib/mobile-utils.ts` - Mobile utility functions
- `ios/App/App/Info.plist.template` - iOS configuration template
- `IOS_SETUP.md` - Setup guide
- `MOBILE_MIGRATION_SUMMARY.md` - This file

### Modified Files
- `package.json` - Added Capacitor dependencies and scripts
- `src/lib/supabase.ts` - Updated to use Capacitor storage
- `src/lib/strava.ts` - Updated redirect URLs for mobile
- `src/contexts/AuthContext.tsx` - Updated redirect URLs
- `src/main.tsx` - Added Capacitor initialization

## Next Steps (On macOS)

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Build the App:**
   ```bash
   npm run build
   ```

3. **Add iOS Platform (if needed):**
   ```bash
   npx cap add ios
   ```

4. **Sync Capacitor:**
   ```bash
   npm run cap:sync
   ```

5. **Open in Xcode:**
   ```bash
   npm run cap:ios
   ```

6. **Configure in Xcode:**
   - Set up signing & capabilities
   - Configure URL schemes (already in Info.plist template)
   - Add app icons
   - Test on simulator/device

7. **Update Environment Variables:**
   - Set `VITE_STRAVA_REDIRECT_URI=com.saiko.app://auth/strava/callback` for iOS

8. **Update Strava App Settings:**
   - Add redirect URI: `com.saiko.app://auth/strava/callback`

9. **Build for TestFlight:**
   - Archive in Xcode
   - Distribute to App Store Connect
   - Configure in TestFlight

## Important Notes

### OAuth Redirect URLs
- **Web**: `https://yourdomain.com/auth/strava/callback`
- **iOS**: `com.saiko.app://auth/strava/callback`

Both must be configured in your Strava app settings.

### Storage
- Authentication tokens are now stored securely using Capacitor Preferences on iOS
- Web continues to use localStorage
- The storage adapter automatically detects the platform

### URL Handling
- Deep linking is configured via URL schemes
- OAuth callbacks are handled through the `appUrlOpen` event in Capacitor
- React Router handles the navigation

## Testing Checklist

- [ ] App builds successfully
- [ ] Authentication works (login/signup)
- [ ] Session persists after app restart
- [ ] Strava OAuth flow works
- [ ] Deep linking works
- [ ] All features work on iOS Simulator
- [ ] Test on physical device
- [ ] Ready for TestFlight upload

## Troubleshooting

See `IOS_SETUP.md` for detailed troubleshooting steps.

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [iOS Setup Guide](./IOS_SETUP.md)
- [Supabase Mobile Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
