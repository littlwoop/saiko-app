#!/bin/bash

# Database Migration Script for Strava Integration
# This script helps you run the required database migrations

echo "🚀 Setting up Strava Integration Database Tables..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "📋 Migration files to run:"
echo "1. database/migrations/001_create_strava_connections.sql"
echo "2. database/migrations/002_create_strava_app_configs.sql"
echo ""

echo "🔧 To run these migrations:"
echo ""
echo "Option 1 - Supabase Dashboard:"
echo "1. Go to your Supabase project dashboard"
echo "2. Navigate to SQL Editor"
echo "3. Copy and paste the contents of each migration file"
echo "4. Run the SQL"
echo ""

echo "Option 2 - Supabase CLI (if installed):"
echo "1. Run: supabase db push"
echo ""

echo "Option 3 - Manual SQL execution:"
echo "1. Connect to your database"
echo "2. Run the SQL from each migration file"
echo ""

echo "📝 Migration 1 - Strava Connections Table:"
echo "This creates the table to store user's Strava account connections"
echo ""

echo "📝 Migration 2 - Strava App Configs Table:"
echo "This creates the table to store user's Strava app credentials"
echo ""

echo "✅ After running the migrations:"
echo "1. Restart your development server"
echo "2. Go to /profile in your app"
echo "3. You should see the Strava App Configuration section"
echo "4. Follow the setup instructions to create your Strava app"
echo ""

echo "🔗 Useful links:"
echo "- Strava API Settings: https://www.strava.com/settings/api"
echo "- Supabase Dashboard: https://supabase.com/dashboard"
echo ""

echo "Need help? Check the USER_FRIENDLY_STRAVA_SETUP.md file for detailed instructions."
