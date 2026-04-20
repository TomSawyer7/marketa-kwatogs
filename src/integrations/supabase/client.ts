import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gsawquzxlrkraylbyitt.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzYXdxdXp4bHJrcmF5bGJ5aXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODYzOTIsImV4cCI6MjA5MjI2MjM5Mn0.awgPGJQFZLUwDUQeqtPeFfQKtD4NxuQdAhtKFS8w1ps";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: localStorage,
  },
});
