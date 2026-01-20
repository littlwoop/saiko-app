# Codemagic Setup Guide

## Quick Fix for Configuration Errors

The `codemagic.yaml` file has been fixed! Here's what changed:

### Fixed Issues:
1. ✅ Script format corrected
2. ✅ Environment variables moved to workflow level
3. ✅ Publishing section simplified (optional TestFlight upload)

## Two Options

### Option 1: Build Only (Simplest) ⭐ Recommended

Use `codemagic-simple.yaml`:
- Builds your iOS app
- Downloads IPA file
- Upload manually to App Store Connect

**Steps:**
1. Rename `codemagic-simple.yaml` to `codemagic.yaml`
2. Push to GitHub
3. Set up Codemagic (see below)
4. Build and download IPA

### Option 2: Automatic TestFlight Upload

Use the main `codemagic.yaml`:
- Builds iOS app
- Automatically uploads to TestFlight
- Requires App Store Connect API setup

**Steps:**
1. Set up App Store Connect API (see below)
2. Configure in Codemagic
3. Build automatically uploads

---

## Setup Steps

### 1. Sign Up for Codemagic
1. Go to [codemagic.io](https://codemagic.io)
2. Sign up with GitHub
3. Click "Add application"
4. Select `littlwoop/saiko-app`

### 2. Add Environment Variables

In Codemagic → Your App → Environment variables, add:

- `VITE_SUPABASE_URL` - Your Supabase URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key
- `VITE_STRAVA_CLIENT_ID` - Your Strava client ID
- `VITE_STRAVA_CLIENT_SECRET` - Your Strava client secret
- `VITE_STRAVA_REDIRECT_URI` - `com.saiko.app://auth/strava/callback`

### 3. For Automatic TestFlight Upload (Optional)

#### Step 3a: Create App Store Connect API Key

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Users and Access → Keys → App Store Connect API
3. Click "+" to generate new key
4. Download the `.p8` file (you can only download once!)
5. Note the **Key ID** and **Issuer ID**

#### Step 3b: Add to Codemagic

1. In Codemagic → Settings → Integrations → App Store Connect
2. Click "Add integration"
3. Enter:
   - **Issuer ID** (from App Store Connect)
   - **Key ID** (from App Store Connect)
   - **Private Key** (upload the `.p8` file)
   - **Name** (e.g., "saiko-app-store")

#### Step 3c: Update codemagic.yaml

Uncomment these lines in `codemagic.yaml`:

```yaml
integrations:
  app_store_connect: saiko-app-store  # Use the name from step 3b

publishing:
  app_store_connect:
    auth: integration
    submit_to_testflight: true
```

### 4. Build!

1. Click "Start new build"
2. Select your workflow
3. Wait ~10-15 minutes
4. Download IPA or check TestFlight

---

## Troubleshooting

### "No such file or directory" errors
- Make sure `ios/App` directory exists
- Run `npx cap add ios` first (on Mac or in cloud)

### Code signing errors
- For manual upload: Use development signing (will work for TestFlight)
- For automatic: Set up App Store Connect API (see above)

### Build fails
- Check environment variables are set
- Check Codemagic build logs
- Ensure `exportOptions.plist` exists

---

## Recommended: Start Simple

1. **First build**: Use `codemagic-simple.yaml` (build only)
2. **Test**: Download IPA and upload manually
3. **Later**: Set up automatic upload if needed

This way you can get your first build working quickly!
