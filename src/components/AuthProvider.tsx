import { useState, useEffect, useCallback, type ReactNode } from "react";
import {
  login as identityLogin,
  logout as identityLogout,
  getUser,
  handleAuthCallback,
} from "@netlify/identity";
import { AuthContext } from "../lib/auth-context";
import type { AppUser, UserRole } from "../lib/types";

function mapIdentityUser(user: Record<string, unknown>): AppUser {
  const meta = (user.app_metadata ?? user.appMetadata ?? {}) as Record<
    string,
    unknown
  >;
  const userMeta = (user.user_metadata ?? user.userMetadata ?? {}) as Record<
    string,
    unknown
  >;
  const roles = (meta.roles ?? []) as string[];
  const role: UserRole = (roles[0] as UserRole) || "eleve";
  const name =
    (userMeta.full_name as string) ||
    (userMeta.name as string) ||
    (user.email as string) ||
    "";
  return {
    id: user.id as string,
    email: user.email as string,
    name,
    role,
    metadata: meta,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        await handleAuthCallback();
      } catch {}
      try {
        const current = await getUser();
        if (current) setUser(mapIdentityUser(current as unknown as Record<string, unknown>));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await identityLogin(email, password);
    setUser(mapIdentityUser(u as unknown as Record<string, unknown>));
  }, []);

  const logout = useCallback(async () => {
    await identityLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
