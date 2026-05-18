import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const env = import.meta.env as Record<string, string | undefined>;

// On accepte les deux préfixes pour faciliter la migration depuis un projet Next.js
const supabaseUrl =
  env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey =
  env.VITE_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  // Erreur dev-time uniquement, pas un throw pour ne pas casser la build
  // eslint-disable-next-line no-console
  console.error(
    "[supabase] SUPABASE_URL et SUPABASE_ANON_KEY doivent être définis (préfixe VITE_ ou NEXT_PUBLIC_)"
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
