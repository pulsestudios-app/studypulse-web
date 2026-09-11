import { createClient } from "@supabase/supabase-js";

import { config } from "./config";
import { AUTH_STORAGE_KEY } from "./storage";

/**
 * Browser Supabase client: anon key + RLS only. PKCE, and `detectSessionInUrl: false`
 * because /auth/callback and /auth/reset exchange the code explicitly (clear error
 * handling, no double exchange under StrictMode).
 */
export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: AUTH_STORAGE_KEY,
  },
});
