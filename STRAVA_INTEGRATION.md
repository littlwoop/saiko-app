# Strava Integration Setup

This project now includes Strava integration that allows users to connect their Strava accounts and import their profile information.

## Features

- **OAuth Authentication**: Secure connection to Strava using OAuth 2.0
- **Profile Import**: Automatically import user profile information from Strava
- **Token Management**: Automatic token refresh and expiration handling
- **Connection Status**: Real-time connection status and management
- **Database Storage**: Secure storage of Strava connection data

## Setup Instructions

### 1. Create a Strava Application

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Click "Create an App"
3. Fill in the required information:
   - **Application Name**: Your app name
   - **Category**: Choose appropriate category
   - **Club**: Leave empty or select a club
   - **Website**: Your website URL
   - **Authorization Callback Domain**: `localhost:5173` (for development)
4. After creation, you'll receive:
   - **Client ID**
   - **Client Secret**

### 2. Environment Variables

Add the following environment variables to your `.env` file:

```env
# Strava API Configuration
VITE_STRAVA_CLIENT_ID=your_strava_client_id_here
VITE_STRAVA_CLIENT_SECRET=your_strava_client_secret_here
VITE_STRAVA_REDIRECT_URI=http://localhost:5173/auth/strava/callback
```

For production, update the redirect URI to your production domain:
```env
VITE_STRAVA_REDIRECT_URI=https://yourdomain.com/auth/strava/callback
```

### 3. Database Setup

Run the database migration to create the required table:

```sql
-- The migration file is located at: database/migrations/001_create_strava_connections.sql
-- Run this SQL in your Supabase SQL editor or database management tool
```

### 4. Update Strava App Settings

After setting up your environment variables, update your Strava app settings:

1. Go back to [Strava API Settings](https://www.strava.com/settings/api)
2. Edit your app
3. Update the **Authorization Callback Domain** to match your production domain
4. Save the changes

## Usage

### For Users

1. **Connect Strava Account**:
   - Go to your Profile page
   - Scroll down to the "Strava Integration" section
   - Click "Connect to Strava"
   - Authorize the application on Strava
   - You'll be redirected back to your profile

2. **Import Profile Information**:
   - After connecting, click "Import Profile"
   - Your Strava profile information will be imported and displayed
   - This includes your name, location, bio, and profile picture

3. **Manage Connection**:
   - View connection status (Connected/Expired)
   - Re-import profile information when needed
   - Disconnect your Strava account if desired

### For Developers

The integration includes several key components:

- **StravaService** (`src/lib/strava.ts`): Core service for API interactions
- **StravaCallback** (`src/pages/StravaCallback.tsx`): OAuth callback handler
- **StravaConnectionCard** (`src/components/profile/StravaConnectionCard.tsx`): UI component
- **Database Schema**: Secure storage of connection data

## API Endpoints Used

- **Authorization**: `https://www.strava.com/oauth/authorize`
- **Token Exchange**: `https://www.strava.com/oauth/token`
- **Athlete Profile**: `https://www.strava.com/api/v3/athlete`

## Security Features

- **Row Level Security**: Database access restricted to authenticated users
- **Token Encryption**: Access tokens stored securely in database
- **Automatic Refresh**: Tokens automatically refreshed before expiration
- **Secure Storage**: No sensitive data stored in client-side code

## Troubleshooting

### Common Issues

1. **"Strava credentials not configured"**
   - Ensure environment variables are set correctly
   - Restart your development server after adding env vars

2. **"Authorization failed"**
   - Check that redirect URI matches exactly in Strava app settings
   - Ensure client ID and secret are correct

3. **"Token expired"**
   - The system automatically refreshes tokens
   - If issues persist, disconnect and reconnect your Strava account

4. **"Failed to import profile"**
   - Check that the user has a valid Strava connection
   - Ensure the Strava API is accessible

### Debug Mode

To enable debug logging, add this to your environment variables:
```env
VITE_DEBUG_STRAVA=true
```

## Future Enhancements

Potential future features:
- Activity data synchronization
- Challenge integration with Strava activities
- Leaderboards based on Strava data
- Automated progress tracking
- Social features integration

## Support

For issues related to:
- **Strava API**: Check [Strava API Documentation](https://developers.strava.com/)
- **This Integration**: Check the code comments and error messages
- **Database Issues**: Verify RLS policies and table structure
