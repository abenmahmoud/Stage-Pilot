import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  // Erreur dev-time uniquement, pas un throw pour ne pas casser la build
  // eslint-disable-next-line no-console
  console.error(
    "[supabase] VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définis dans .env.local"
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
