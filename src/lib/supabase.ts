import { createClient } from "@supabase/supabase-js";
import { createCapacitorStorage } from "./capacitor-storage";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

// Add debug logging
console.log("Initializing Supabase client with URL:", supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Use Capacitor storage adapter for native, localStorage for web
    storage: createCapacitorStorage(),
    storageKey: "supabase.auth.token",
  },
  db: {
    schema: "public",
  },
});

// Test the connection
/*
void (async () => {
  try {
    await supabase.from('challenges').select('id').limit(1);
    console.log('Supabase connection successful');
  } catch (error) {
    console.error('Supabase connection error:', error);
  }
})(); 
*/
