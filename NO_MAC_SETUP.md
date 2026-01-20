# Building iOS App Without a Mac

Since you don't have a Mac, here are several options to build and submit your iOS app to TestFlight:

## Option 1: Codemagic (Recommended - Easiest) ⭐

Codemagic is the easiest option for building iOS apps without a Mac.

### Setup Steps:

1. **Sign up at [codemagic.io](https://codemagic.io)**
   - Sign up with GitHub
   - Click "Add application"
   - Select your repository

2. **Add Environment Variables:**
   In Codemagic → Your App → Environment variables:
   - `VITE_SUPABASE_URL` - Your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key
   - `VITE_STRAVA_CLIENT_ID` - Your Strava client ID
   - `VITE_STRAVA_CLIENT_SECRET` - Your Strava client secret
   - `VITE_STRAVA_REDIRECT_URI` - `com.saiko.app://auth/strava/callback`

3. **Build!**
   - Click "Start new build"
   - Select iOS workflow
   - Wait ~10-15 minutes
   - Download IPA or auto-upload to TestFlight

### Benefits:
- ✅ **Free tier**: 500 build minutes/month
- ✅ **Automatic certificate management**
- ✅ **Built-in TestFlight upload**
- ✅ **No Mac needed**
- ✅ **Great for Capacitor apps**

See [CODEMAGIC_SETUP.md](./CODEMAGIC_SETUP.md) for detailed setup instructions.

---

## Option 3: Convert to Expo (Easier Cloud Builds)

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

## Option 4: Cloud Mac Services (Paid)

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

## Option 2: Other Cloud Build Services

If you want alternatives to Codemagic:

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

---

## Recommended Approach

**For your situation, I recommend:**

**Use Codemagic** - It's the easiest and handles everything automatically:
- ✅ Free tier: 500 build minutes/month
- ✅ Automatic certificate management
- ✅ Built-in TestFlight upload
- ✅ No Mac needed
- ✅ Perfect for Capacitor apps

See [CODEMAGIC_SETUP.md](./CODEMAGIC_SETUP.md) for step-by-step setup instructions.

---

## Need Help?

Let me know which option you'd like to pursue, and I can help you set it up!
