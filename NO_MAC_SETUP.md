# Building iOS App Without a Mac

Since you don't have a Mac, here are several options to build and submit your iOS app to TestFlight:

## Option 1: GitHub Actions (Recommended - Free for Public Repos)

GitHub Actions can build iOS apps using macOS runners. This is **free for public repositories**.

### Setup Steps:

1. **Push your code to GitHub** (if not already done)

2. **Set up GitHub Secrets:**
   Go to your repository → Settings → Secrets and variables → Actions → New repository secret
   
   Add these secrets:
   - `VITE_SUPABASE_URL` - Your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key
   - `VITE_STRAVA_CLIENT_ID` - Your Strava client ID
   - `VITE_STRAVA_CLIENT_SECRET` - Your Strava client secret
   - `VITE_STRAVA_REDIRECT_URI` - `com.saiko.app://auth/strava/callback`
   - `IOS_CERTIFICATE_BASE64` - Base64 encoded .p12 certificate (see below)
   - `IOS_CERTIFICATE_PASSWORD` - Password for the certificate
   - `IOS_APP_ID` - Your app ID (e.g., `com.saiko.app`)
   - `IOS_ISSUER_ID` - App Store Connect API Key Issuer ID
   - `IOS_API_KEY_ID` - App Store Connect API Key ID
   - `IOS_API_PRIVATE_KEY` - App Store Connect API Private Key
   - `APPLE_ID` - Your Apple ID email
   - `APPLE_APP_SPECIFIC_PASSWORD` - App-specific password (see below)

3. **Get Apple Developer Certificates:**
   
   **Option A: Using App Store Connect API (Recommended)**
   - Go to [App Store Connect](https://appstoreconnect.apple.com)
   - Users and Access → Keys → Generate API Key
   - Download the key and note the Key ID and Issuer ID
   - This avoids needing to manually manage certificates
   
   **Option B: Manual Certificate Setup**
   - You'll need someone with a Mac to generate certificates, OR
   - Use a cloud Mac service (see Option 3) to generate them once

4. **Create App-Specific Password:**
   - Go to [appleid.apple.com](https://appleid.apple.com)
   - Sign in → App-Specific Passwords → Generate
   - Use this for `APPLE_APP_SPECIFIC_PASSWORD`

5. **Trigger the Build:**
   - Push to `main` or `master` branch, OR
   - Go to Actions tab → "Build iOS App" → Run workflow

6. **Download the IPA:**
   - After build completes, download from the Artifacts section
   - Upload manually to App Store Connect if auto-upload fails

### Limitations:
- ⚠️ **Private repos**: GitHub Actions macOS runners cost $0.08/minute (~$115/month for unlimited)
- ⚠️ **First-time setup**: You'll need certificates initially (can use cloud Mac once)

---

## Option 2: Convert to Expo (Easier Cloud Builds)

Expo has excellent cloud build services that handle certificates automatically.

### Pros:
- ✅ Free tier available (limited builds)
- ✅ Automatic certificate management
- ✅ No Mac needed at all
- ✅ Easier setup

### Cons:
- ⚠️ Requires converting from Capacitor to Expo
- ⚠️ Some code changes needed

### If you want to go this route:
1. Install Expo CLI: `npm install -g expo-cli`
2. Initialize Expo: `npx create-expo-app --template`
3. Migrate your React code (most will work as-is)
4. Use EAS Build: `eas build --platform ios`

**Would you like me to help convert to Expo?** It's a bigger change but might be easier long-term.

---

## Option 3: Cloud Mac Services (Paid)

Rent a Mac in the cloud to build manually:

### Services:
1. **MacStadium** - $99/month
2. **MacinCloud** - $30-50/month
3. **AWS EC2 Mac instances** - Pay per hour
4. **MacStadium Orka** - Enterprise solution

### Steps:
1. Rent a Mac instance
2. Connect via Remote Desktop
3. Install Xcode and dependencies
4. Build and archive manually
5. Upload to App Store Connect

---

## Option 4: Mobile CI/CD Services (Easiest - Some Free Tiers)

These services specialize in mobile builds and handle certificates automatically:

### Codemagic (Recommended)
- ✅ **Free tier**: 500 build minutes/month
- ✅ Automatic certificate management
- ✅ Built-in TestFlight upload
- ✅ Great Capacitor support

**Setup:**
1. Sign up at [codemagic.io](https://codemagic.io)
2. Connect your GitHub repo
3. Use their Capacitor template
4. Add environment variables
5. Build and upload automatically!

### AppCircle
- ✅ Free tier available
- ✅ Automatic signing
- ✅ TestFlight integration

### Bitrise
- ✅ Free tier: 200 builds/month
- ✅ Good Capacitor support
- ✅ Automatic certificate handling

### CircleCI
- ✅ Free tier available
- ⚠️ Requires more setup than Codemagic

**I recommend Codemagic** - it's the easiest for Capacitor apps and has the best free tier.

---

## Recommended Approach

**For your situation, I recommend:**

1. **Short-term**: Use GitHub Actions to build (free for public repo)
   - Set up the workflow I created
   - Build IPA files automatically
   - Upload manually to App Store Connect

2. **Long-term**: Consider Expo if you want easier certificate management

---

## Quick Start: GitHub Actions Setup

The workflow file (`.github/workflows/ios-build.yml`) is already created. You just need to:

1. **Push to GitHub** (make repo public if you want free builds)
2. **Add secrets** (at minimum: environment variables)
3. **Push a tag** like `v1.0.0` to trigger build
4. **Download IPA** from artifacts
5. **Upload to App Store Connect** manually

### Minimal Secrets Needed (for build only):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STRAVA_CLIENT_ID`
- `VITE_STRAVA_CLIENT_SECRET`
- `VITE_STRAVA_REDIRECT_URI`

The certificate secrets are only needed for automatic TestFlight upload.

---

## Need Help?

Let me know which option you'd like to pursue, and I can help you set it up!
