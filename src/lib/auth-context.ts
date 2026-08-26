import { createContext, useContext } from "react";
import type { AppUser } from "./types";

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  assuranceLevel: "aal1" | "aal2" | null;
  nextAssuranceLevel: "aal1" | "aal2" | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAssurance: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  assuranceLevel: null,
  nextAssuranceLevel: null,
  login: async () => {},
  logout: async () => {},
  refreshAssurance: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
