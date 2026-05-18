import { useState, useEffect, useCallback, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase-browser";
import { AuthContext } from "../lib/auth-context";
import type { AppUser, UserRole } from "../lib/types";

function mapSupabaseUser(user: User): AppUser {
  const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;

  const role: UserRole =
    typeof appMeta.role === "string" ? (appMeta.role as UserRole) : "eleve";

  const name =
    (typeof userMeta.full_name === "string" && userMeta.full_name) ||
    (typeof userMeta.name === "string" && userMeta.name) ||
    user.email ||
    "";

  return {
    id: user.id,
    email: user.email ?? "",
    name,
    role,
    metadata: appMeta,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Récupérer la session actuelle au démarrage
    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => {
        if (!mounted) return;
        if (data.session?.user) {
          setUser(mapSupabaseUser(data.session.user));
        }
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    // Écouter les changements d'état (login, logout, refresh token)
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        if (!mounted) return;
        if (session?.user) {
          setUser(mapSupabaseUser(session.user));
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(error.message);
    if (data.user) setUser(mapSupabaseUser(data.user));
  }, []);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
