# iOS Setup Guide for Saiko App

This guide will help you set up the iOS app for TestFlight submission.

> **Don't have a Mac?** See [NO_MAC_SETUP.md](./NO_MAC_SETUP.md) for cloud build options!

## Prerequisites

1. **macOS** - iOS development requires macOS and Xcode (or use cloud build - see NO_MAC_SETUP.md)
2. **Xcode** - Install from the Mac App Store (latest version recommended)
3. **Apple Developer Account** - Required for TestFlight ($99/year)
4. **CocoaPods** - Install with `sudo gem install cocoapods`

## Initial Setup (Run on macOS)

1. **Navigate to your project directory:**
   ```bash
   cd "path/to/Saiko App"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the web app:**
   ```bash
   npm run build
   ```

4. **Add iOS platform (if not already added):**
   ```bash
   npx cap add ios
   ```

5. **Sync Capacitor:**
   ```bash
   npx cap sync
   ```

## Xcode Configuration

1. **Open the project in Xcode:**
   ```bash
   npm run cap:ios
   ```
   Or manually:
   ```bash
   npx cap open ios
   ```

2. **Configure Signing & Capabilities:**
   - Select the "App" target in Xcode
   - Go to "Signing & Capabilities" tab
   - Select your Team (Apple Developer account)
   - Xcode will automatically create/select a provisioning profile

3. **Configure URL Schemes (for OAuth):**
   - In Xcode, select the "App" target
   - Go to "Info" tab
   - Expand "URL Types"
   - Add a new URL Type:
     - Identifier: `com.saiko.app`
     - URL Schemes: `com.saiko.app`
     - Role: `Editor`

4. **Update Info.plist for OAuth:**
   - Add the following to `ios/App/App/Info.plist`:
   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLSchemes</key>
       <array>
         <string>com.saiko.app</string>
       </array>
       <key>CFBundleURLName</key>
       <string>com.saiko.app</string>
     </dict>
   </array>
   <key>LSApplicationQueriesSchemes</key>
   <array>
     <string>https</string>
     <string>http</string>
   </array>
   ```

5. **Configure App Icons:**
   - Replace the default icons in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
   - Required sizes:
     - 20x20 (@2x, @3x)
     - 29x29 (@2x, @3x)
     - 40x40 (@2x, @3x)
     - 60x60 (@2x, @3x)
     - 76x76 (@1x, @2x)
     - 83.5x83.5 (@2x)
     - 1024x1024 (@1x)

6. **Update Bundle Identifier:**
   - Ensure the bundle identifier is `com.saiko.app` (or your preferred identifier)
   - This must match your Apple Developer account

## Environment Variables

Create a `.env` file in the project root with:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_STRAVA_CLIENT_ID=your_strava_client_id
VITE_STRAVA_CLIENT_SECRET=your_strava_client_secret
VITE_STRAVA_REDIRECT_URI=com.saiko.app://auth/strava/callback
```

**Important:** For iOS, the Strava redirect URI should use the custom URL scheme: `com.saiko.app://auth/strava/callback`

## Strava OAuth Configuration

1. **Update Strava App Settings:**
   - Go to [Strava API Settings](https://www.strava.com/settings/api)
   - Edit your app
   - Add redirect URI: `com.saiko.app://auth/strava/callback`
   - Save changes

## Building for TestFlight

1. **Select a device/simulator:**
   - In Xcode, select "Any iOS Device" or a connected device

2. **Archive the app:**
   - Product → Archive
   - Wait for the build to complete

3. **Distribute to TestFlight:**
   - In the Organizer window, click "Distribute App"
   - Select "App Store Connect"
   - Follow the prompts to upload
   - Wait for processing (can take 10-30 minutes)

4. **Configure in App Store Connect:**
   - Go to [App Store Connect](https://appstoreconnect.apple.com)
   - Navigate to your app → TestFlight
   - Add testers (internal or external)
   - Add build notes if needed

## Testing Locally

1. **Run on iOS Simulator:**
   ```bash
   npm run cap:ios:run
   ```
   Or in Xcode: Product → Run

2. **Run on Physical Device:**
   - Connect your iPhone via USB
   - Select your device in Xcode
   - Product → Run
   - Trust the developer certificate on your device if prompted

## Common Issues

### Build Errors
- **"No such module 'Capacitor'":** Run `pod install` in the `ios/App` directory
- **Signing errors:** Ensure your Apple Developer account is configured in Xcode
- **Missing dependencies:** Run `npm install` and `npx cap sync`

### OAuth Issues
- **Redirect not working:** Ensure URL scheme is configured correctly in Info.plist
- **Strava callback fails:** Verify redirect URI matches exactly in Strava app settings

### Runtime Issues
- **Supabase connection fails:** Check environment variables are set correctly
- **Storage not persisting:** Ensure Capacitor Preferences plugin is installed

## Useful Commands

```bash
# Build and sync
npm run cap:sync

# Open in Xcode
npm run cap:ios

# Build, sync, and run
npm run cap:ios:run

# Update CocoaPods dependencies
cd ios/App && pod install && cd ../..
```

## Next Steps

1. Test the app thoroughly on iOS Simulator
2. Test on a physical device
3. Archive and upload to TestFlight
4. Add testers and gather feedback
5. Submit for App Store review when ready

## Resources

- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [TestFlight Guide](https://developer.apple.com/testflight/)
