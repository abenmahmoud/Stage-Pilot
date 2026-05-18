import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { ROLE_HOME } from "../lib/types";
import {
  GraduationCap,
  Eye,
  EyeOff,
  AlertCircle,
  User,
  School,
  KeyRound,
} from "lucide-react";

type Mode = "eleve" | "professeur" | "staff";

/**
 * On convertit un code d'accès élève (NOM-CLASSE-XXXX) en pseudo-email + mot de passe
 * pour utiliser le système d'auth Supabase standard.
 */
function codeToCredentials(code: string): { email: string; password: string } {
  const clean = code.trim().toUpperCase();
  const slug = clean.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return {
    email: `${slug}@eleve.lyceegest.local`,
    password: clean,
  };
}

function codeProfToCredentials(code: string): { email: string; password: string } {
  const clean = code.trim().toUpperCase();
  const slug = clean.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return {
    email: `${slug}@prof.lyceegest.local`,
    password: clean,
  };
}

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("eleve");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    navigate(ROLE_HOME[user.role], { replace: true });
    return null;
  }

  async function handleStaffSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Identifiants incorrects";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleEleveSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { email: e_, password: p_ } = codeToCredentials(code);
      await login(e_, p_);
      navigate("/dashboard", { replace: true });
    } catch {
      setError(
        "Code d'accès incorrect. Vérifie l'orthographe (ex: AMIAR-2E1-7842) ou contacte ton professeur principal."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleProfSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { email: e_, password: p_ } = codeProfToCredentials(code);
      await login(e_, p_);
      navigate("/dashboard", { replace: true });
    } catch {
      setError(
        "Code d'accès professeur incorrect. Vérifie l'orthographe ou contacte l'administration."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 bg-primary-500 flex-col justify-between p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 -left-10 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-accent-400/30 blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-heading tracking-tight">
                LycéeGest
              </h1>
              <p className="text-sm text-white/70">Blaise Cendrars — Sevran</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-heading font-bold leading-tight">
            Gestion simplifiée
            <br />
            des stages et du
            <br />
            <span className="text-accent-300">Grand Oral</span>
          </h2>
          <p className="text-white/80 text-lg max-w-md">
            Collecte des données, circuit de validation et génération
            automatique des conventions et fiches — tout au même endroit.
          </p>
        </div>
        <div className="relative z-10 text-xs text-white/50">
          12 avenue Léon Jouhaux, 93270 Sevran — Année scolaire 2025-2026
        </div>
      </div>

      <div className="flex w-full lg:w-1/2 flex-col justify-center px-6 sm:px-12 py-12 bg-white">
        <div className="mx-auto w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center text-white">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-heading text-gray-900">
                LycéeGest
              </h1>
              <p className="text-xs text-gray-500">Blaise Cendrars — Sevran</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setMode("eleve");
                setError("");
              }}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl py-3 px-1 text-center text-xs sm:text-sm font-medium transition-all ${
                mode === "eleve"
                  ? "bg-white text-primary-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <User className="w-4 h-4" />
              Je suis élève
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("professeur");
                setError("");
              }}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl py-3 px-1 text-center text-xs sm:text-sm font-medium transition-all ${
                mode === "professeur"
                  ? "bg-white text-primary-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Je suis professeur
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("staff");
                setError("");
              }}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl py-3 px-1 text-center text-xs sm:text-sm font-medium transition-all ${
                mode === "staff"
                  ? "bg-white text-primary-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <School className="w-4 h-4" />
              Personnel administratif
            </button>
          </div>

          {mode === "eleve" && (
            <form onSubmit={handleEleveSubmit} className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold font-heading text-gray-900">
                  Bienvenue !
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Saisis ton code d'accès personnel donné par ton professeur
                  principal.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code d'accès
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    required
                    autoComplete="username"
                    autoCapitalize="characters"
                    placeholder="EX: AMIAR-2E1-7842"
                    className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 tracking-wider font-mono uppercase"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Format : NOM-CLASSE-CODE (4 chiffres)
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full rounded-xl bg-primary-500 py-3 text-sm font-semibold text-white hover:bg-primary-600 transition-all disabled:opacity-50"
              >
                {loading ? "Connexion…" : "Se connecter"}
              </button>

              <p className="text-center text-xs text-gray-400">
                Code perdu ? Contacte ton professeur principal.
              </p>
            </form>
          )}

          {mode === "professeur" && (
            <form onSubmit={handleProfSubmit} className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold font-heading text-gray-900">
                  Espace professeur
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Saisis ton code d'accès professeur remis par l'administration.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code d'accès professeur
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    required
                    autoComplete="username"
                    autoCapitalize="characters"
                    placeholder="EX: DURAND-PROF-4821"
                    className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 tracking-wider font-mono uppercase"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Format : NOM-PROF-CODE (4 chiffres)
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full rounded-xl bg-primary-500 py-3 text-sm font-semibold text-white hover:bg-primary-600 transition-all disabled:opacity-50"
              >
                {loading ? "Connexion…" : "Se connecter"}
              </button>

              <p className="text-center text-xs text-gray-400">
                Code perdu ? Contacte l'administration du lycée.
              </p>
            </form>
          )}

          {mode === "staff" && (
            <form onSubmit={handleStaffSubmit} className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold font-heading text-gray-900">
                  Connexion
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Espace réservé au personnel administratif du lycée.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="nom@ac-creteil.fr"
                  className="w-full rounded-xl border border-gray-300 bg-white py-3 px-4 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-gray-300 bg-white py-3 px-4 pr-10 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={
                      showPw ? "Masquer le mot de passe" : "Afficher le mot de passe"
                    }
                  >
                    {showPw ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full rounded-xl bg-primary-500 py-3 text-sm font-semibold text-white hover:bg-primary-600 transition-all disabled:opacity-50"
              >
                {loading ? "Connexion…" : "Se connecter"}
              </button>

              <p className="text-center text-xs text-gray-400">
                Mot de passe oublié ? Contactez l'administration du lycée.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
