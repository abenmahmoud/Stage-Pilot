import { useState, type FormEvent } from "react";
import { BadgeCheck, Eye, EyeOff, KeyRound, LoaderCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { isStrongAgentPassword } from "../../shared/password-policy";

export default function ResetPasswordPage() {
  const { user, loading, updatePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!isStrongAgentPassword(password)) {
      setError(
        "Utilisez au moins 12 caractères avec une minuscule, une majuscule, un chiffre et un symbole."
      );
      return;
    }
    if (password !== confirmation) {
      setError("Les deux mots de passe ne sont pas identiques.");
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(password);
      await logout();
      navigate("/login?mode=staff&reset=success", { replace: true });
    } catch {
      setError(
        "Le lien n’est plus valide ou le mot de passe a été refusé. Demandez un nouveau lien."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-950 sm:py-16">
      <section className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          <KeyRound className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mt-6 text-sm font-semibold text-emerald-700">Compte du lycée</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight">
          Choisir un nouveau mot de passe
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Le lien reçu par email ouvre une session temporaire. Après la modification, vous devrez vous reconnecter.
        </p>

        {loading ? (
          <div className="mt-8 flex items-center gap-3 text-sm text-slate-600" aria-live="polite">
            <LoaderCircle className="h-5 w-5 animate-spin" /> Vérification du lien…
          </div>
        ) : !user ? (
          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Ce lien est invalide ou a expiré. Revenez à la connexion pour demander un nouveau lien.
          </div>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={submit}>
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800" role="alert">
                {error}
              </div>
            ) : null}

            <label className="block text-sm font-semibold text-slate-800">
              Nouveau mot de passe
              <span className="relative mt-2 block">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  className="h-12 w-full rounded-lg border border-slate-300 px-4 pr-12 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </span>
            </label>

            <label className="block text-sm font-semibold text-slate-800">
              Confirmer le mot de passe
              <input
                type={showPassword ? "text" : "password"}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-4 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </label>

            <p className="text-xs leading-5 text-slate-500">
              12 caractères minimum, avec une majuscule, une minuscule, un chiffre et un symbole.
            </p>

            <button
              type="submit"
              disabled={submitting || !password || !confirmation}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
            >
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
              Enregistrer le nouveau mot de passe
            </button>
          </form>
        )}

        <Link
          to="/login?mode=staff"
          className="mt-7 inline-flex text-sm font-semibold text-primary-500 hover:text-primary-600"
        >
          Retour à la connexion
        </Link>
      </section>
    </main>
  );
}
