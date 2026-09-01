import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { isAgentRole } from "../lib/auth-policy";
import { supabase } from "../lib/supabase-browser";
import { safeAuthReturnPath } from "../../shared/auth-return-path";

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("invalid") || message.includes("expired")) {
    return "Le code est incorrect ou a expiré. Saisissez le nouveau code affiché sur votre téléphone.";
  }
  return "La vérification n’a pas abouti. Réessayez dans quelques instants.";
}

export default function MfaSecurityPage() {
  const { user, assuranceLevel, nextAssuranceLevel, refreshAssurance, logout } =
    useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = safeAuthReturnPath(searchParams.get("returnTo")) ?? "/prototype?view=agent";
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const loadFactors = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const verified = data.totp.find((factor) => factor.status === "verified");
      setVerifiedFactorId(verified?.id ?? null);
      await refreshAssurance();
    } catch (loadError) {
      setError(friendlyError(loadError));
    } finally {
      setLoading(false);
    }
  }, [refreshAssurance]);

  useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  async function startEnrollment() {
    setSubmitting(true);
    setError("");
    try {
      const { data: factors, error: factorsError } =
        await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const pendingFactors = factors.all.filter(
        (factor) =>
          factor.factor_type === "totp" && factor.status === "unverified"
      );
      for (const factor of pendingFactors) {
        const { error: removeError } = await supabase.auth.mfa.unenroll({
          factorId: factor.id,
        });
        if (removeError) throw removeError;
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "LycéeGest - appareil principal",
      });
      if (enrollError) throw enrollError;
      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (enrollError) {
      setError(friendlyError(enrollError));
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    const factorId = enrollment?.factorId ?? verifiedFactorId;
    if (!factorId || !/^\d{6}$/.test(code)) return;

    setSubmitting(true);
    setError("");
    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      await refreshAssurance();
      setEnrollment(null);
      setVerifiedFactorId(factorId);
      setCode("");
    } catch (verifyError) {
      setError(friendlyError(verifyError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  if (!user || !isAgentRole(user.role)) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-10">
        <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6">
          <h1 className="text-xl font-bold text-slate-950">Accès réservé</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Cette page protège les comptes de la direction et de l’administration.
          </p>
          <Link className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary-500" to="/">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>
        </div>
      </main>
    );
  }

  const isVerifiedNow = assuranceLevel === "aal2";
  const needsChallenge =
    verifiedFactorId && nextAssuranceLevel === "aal2" && !isVerifiedNow;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to={isVerifiedNow ? returnTo : "/"} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>
          <div className="flex items-center gap-2 text-sm font-bold text-primary-500">
            <ShieldCheck className="h-5 w-5" /> LycéeGest
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:py-14">
        <section className="min-w-0">
          <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-emerald-700">Sécurité du compte</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
            Protéger l’espace de traitement des demandes
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Après votre connexion, un code temporaire affiché sur votre téléphone protège l’accès aux dossiers.
          </p>

          {error ? (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800" role="alert">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-10 flex items-center gap-3 text-sm text-slate-600" aria-live="polite">
              <LoaderCircle className="h-5 w-5 animate-spin" /> Vérification du compte…
            </div>
          ) : isVerifiedNow ? (
            <div className="mt-10 border-l-4 border-emerald-500 pl-5">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <BadgeCheck className="h-5 w-5" /> Double vérification confirmée
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                La double vérification est active pour cette session. L’accès aux dossiers dépend aussi des autorisations accordées par le lycée.
              </p>
              <button
                type="button"
                onClick={() => navigate(returnTo, { replace: true })}
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-500 px-5 text-sm font-semibold text-white hover:bg-primary-600"
              >
                Continuer vers l’espace agent
              </button>
            </div>
          ) : enrollment ? (
            <div className="mt-10 grid gap-7 sm:grid-cols-[13rem_minmax(0,1fr)]">
              <div className="flex aspect-square items-center justify-center rounded-lg border border-slate-200 bg-white p-4">
                <img src={enrollment.qrCode} alt="QR code à scanner avec l’application d’authentification" className="h-full w-full" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold">1. Scannez le QR code</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Utilisez Google Authenticator, Microsoft Authenticator ou une application équivalente.
                </p>
                <p className="mt-4 text-xs font-semibold uppercase text-slate-500">Clé de saisie manuelle</p>
                <code className="mt-2 block break-all rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800">
                  {enrollment.secret}
                </code>
                <VerificationForm code={code} setCode={setCode} submitting={submitting} onSubmit={verifyCode} title="2. Saisissez le code à six chiffres" />
              </div>
            </div>
          ) : needsChallenge ? (
            <div className="mt-10 max-w-lg">
              <VerificationForm code={code} setCode={setCode} submitting={submitting} onSubmit={verifyCode} title="Saisissez le code affiché sur votre téléphone" />
            </div>
          ) : (
            <div className="mt-10 max-w-xl border-t border-slate-200 pt-7">
              <h2 className="text-xl font-bold">Activer sur ce compte</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                L’activation prend environ une minute. Gardez votre téléphone à portée de main.
              </p>
              <button
                type="button"
                onClick={startEnrollment}
                disabled={submitting}
                className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary-500 px-5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
              >
                {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                Configurer mon téléphone
              </button>
            </div>
          )}
        </section>

        <aside className="border-t border-slate-200 pt-7 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <h2 className="text-sm font-bold text-slate-900">Compte connecté</h2>
          <p className="mt-2 break-all text-sm text-slate-600">{user.email}</p>
          <div className="mt-6 space-y-5 text-sm leading-6 text-slate-600">
            <p className="flex gap-3"><KeyRound className="mt-1 h-4 w-4 shrink-0 text-emerald-700" /> Le code change toutes les trente secondes.</p>
            <p className="flex gap-3"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-700" /> Ne partagez jamais votre mot de passe ni ce code.</p>
          </div>
          <button type="button" onClick={handleLogout} className="mt-8 text-sm font-semibold text-slate-500 underline underline-offset-4 hover:text-slate-900">
            Utiliser un autre compte
          </button>
        </aside>
      </div>
    </main>
  );
}

function VerificationForm({
  code,
  setCode,
  submitting,
  onSubmit,
  title,
}: {
  code: string;
  setCode: (value: string) => void;
  submitting: boolean;
  onSubmit: (event: FormEvent) => void;
  title: string;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-6">
      <label htmlFor="mfa-code" className="block text-sm font-bold text-slate-900">{title}</label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id="mfa-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          aria-label="Code de vérification à six chiffres"
          className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-center font-mono text-xl tracking-[0.2em] outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 sm:w-44"
        />
        <button
          type="submit"
          disabled={submitting || !/^\d{6}$/.test(code)}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary-500 px-5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
        >
          {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
          Vérifier
        </button>
      </div>
    </form>
  );
}
