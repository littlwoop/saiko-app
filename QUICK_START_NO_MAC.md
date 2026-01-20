# Quick Start: Build iOS App Without a Mac 🚀

## Easiest Option: Codemagic (Recommended)

**Why Codemagic?**
- ✅ Free tier: 500 build minutes/month
- ✅ Automatic certificate management
- ✅ Built-in TestFlight upload
- ✅ No Mac needed
- ✅ Great for Capacitor apps

### Step 1: Sign Up
1. Go to [codemagic.io](https://codemagic.io) and sign up with GitHub
2. Click "Add application"
3. Select your GitHub repository

### Step 2: Configure Build
1. Codemagic will detect the `codemagic.yaml` file (already created!)
2. Go to "Environment variables" and add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_STRAVA_CLIENT_ID`
   - `VITE_STRAVA_CLIENT_SECRET`
   - `VITE_STRAVA_REDIRECT_URI` = `com.saiko.app://auth/strava/callback`

### Step 3: Set Up App Store Connect
1. Go to Codemagic → "App Store Connect" → "Add credentials"
2. Enter your Apple ID and app-specific password
3. Codemagic will handle certificates automatically!

### Step 4: Build!
1. Click "Start new build"
2. Select the iOS workflow
3. Wait for build to complete (~10-15 minutes)
4. Download IPA or let Codemagic upload to TestFlight automatically!

---

## Alternative: GitHub Actions (Free for Public Repos)

If your repo is public, GitHub Actions is free!

### Quick Setup:
1. **Push your code to GitHub**
2. **Add secrets** (Settings → Secrets):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_STRAVA_CLIENT_ID`
   - `VITE_STRAVA_CLIENT_SECRET`
   - `VITE_STRAVA_REDIRECT_URI`

3. **Push a tag** to trigger build:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. **Download IPA** from Actions → Artifacts

5. **Upload to App Store Connect**:
   - Use [Transporter app](https://apps.apple.com/us/app/transporter/id1450874784) (Windows/Mac)
   - Or use App Store Connect web interface

---

## What You Need

### Required:
- ✅ GitHub account
- ✅ Apple Developer account ($99/year)
- ✅ Environment variables (Supabase, Strava)

### Not Required:
- ❌ Mac computer
- ❌ Xcode
- ❌ Local iOS development setup

---

## Next Steps After Build

1. **Download the IPA file**
2. **Upload to App Store Connect**:
   - Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   - My Apps → Your App → TestFlight
   - Click "+" → Upload Build
   - Drag and drop the IPA file

3. **Add Testers**:
   - Internal testers (up to 100)
   - External testers (up to 10,000)

4. **Test!** 🎉

---

## Troubleshooting

### Build Fails?
- Check environment variables are set correctly
- Ensure `codemagic.yaml` is in the repo root
- Check Codemagic build logs for errors

### Can't Upload to TestFlight?
- Verify Apple Developer account is active
- Check app-specific password is correct
- Ensure bundle ID matches (`com.saiko.app`)

### Need Help?
- See [NO_MAC_SETUP.md](./NO_MAC_SETUP.md) for detailed options
- Codemagic docs: https://docs.codemagic.io
- GitHub Actions: See `.github/workflows/ios-build-simple.yml`

---

## Recommendation

**Start with Codemagic** - it's the easiest and handles everything automatically. You can always switch to GitHub Actions later if needed.
