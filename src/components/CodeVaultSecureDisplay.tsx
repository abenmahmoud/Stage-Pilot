// Composant sécurisé d'affichage du coffre de codes (LOT 4 du plan du
// 5 septembre 2026). Jamais rendu dans le fil de conversation de
// l'assistant : c'est un composant d'écran classique, monté par une route
// du parcours (LOT 5), qui reçoit une valeur déjà autorisée et révélée.
//
// Garanties tenues ici :
// - aucune valeur n'apparaît dans le titre de la page ni dans une URL (la
//   valeur ne quitte jamais les props/état de ce composant) ;
// - la valeur est rendue dans un élément non éditable (`code`, pas un champ
//   de saisie) pour ne pas être proposée à l'enregistrement par un
//   gestionnaire de mots de passe ni capturée par une extension qui
//   surveille les champs de formulaire ;
// - aucun lien ou attribut `download` : la valeur ne peut pas être
//   exportée en fichier ;
// - la copie passe par `navigator.clipboard.writeText`, jamais par une
//   sélection de texte dans un champ, et le presse-papier est effacé
//   automatiquement après un délai court pour ne pas laisser la valeur
//   trainer indéfiniment (best effort : rien ne peut empêcher un
//   gestionnaire de presse-papier tiers de l'avoir déjà capturée entre
//   temps, voir le compte rendu du lot) ;
// - l'affichage disparaît de lui-même à l'expiration (30 minutes, plan
//   LOT 3, `VAULT_DISPLAY_VISIBILITY_SECONDS`), sans action de l'utilisateur.
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, ShieldAlert } from "lucide-react";
import {
  VAULT_DISPLAY_VISIBILITY_SECONDS,
  isVaultDisplayStillVisible,
  type VaultService,
} from "../../shared/code-vault-policy";

const VAULT_SERVICE_LABELS: Readonly<Record<VaultService, string>> = {
  ent: "ENT",
  cantine: "Cantine",
  koxo: "Koxo",
};

/** Le presse-papier est effacé 30 secondes après la copie : assez pour un
 * collage immédiat, pas assez pour rester indéfiniment dans l'historique
 * d'un gestionnaire de presse-papier. */
const CLIPBOARD_CLEAR_DELAY_MS = 30_000;

const TICK_INTERVAL_MS = 1_000;

function formatRemaining(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export type CodeVaultSecureDisplayProps = {
  service: VaultService;
  /** Valeur déjà autorisée et révélée par l'appelant. Ce composant ne la
   * récupère jamais lui-même : il se contente de l'afficher puis de la
   * faire disparaître. */
  value: string;
  revealedAt: Date;
  /** Appelé une seule fois, au moment où l'affichage expire. */
  onExpire?: () => void;
};

export function CodeVaultSecureDisplay({
  service,
  value,
  revealedAt,
  onExpire,
}: CodeVaultSecureDisplayProps) {
  const [now, setNow] = useState(() => new Date());
  const [copied, setCopied] = useState(false);
  const clipboardClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFiredExpireRef = useRef(false);

  const stillVisible = isVaultDisplayStillVisible(revealedAt, now);
  const remainingSeconds = stillVisible
    ? VAULT_DISPLAY_VISIBILITY_SECONDS - (now.getTime() - revealedAt.getTime()) / 1000
    : 0;

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!stillVisible && !hasFiredExpireRef.current) {
      hasFiredExpireRef.current = true;
      onExpire?.();
    }
  }, [stillVisible, onExpire]);

  useEffect(() => {
    return () => {
      if (clipboardClearTimeoutRef.current) {
        clearTimeout(clipboardClearTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
      if (clipboardClearTimeoutRef.current) {
        clearTimeout(clipboardClearTimeoutRef.current);
      }
      clipboardClearTimeoutRef.current = setTimeout(() => {
        // Best effort : efface le presse-papier plutôt que de le laisser
        // porter la valeur indéfiniment. N'écrase rien si l'échec est côté
        // permissions (Safari/iOS notamment) : on ne peut pas faire mieux
        // sans lire le presse-papier, ce qui demanderait une permission
        // supplémentaire pour un composant qui doit rester discret.
        navigator.clipboard.writeText("").catch(() => {});
      }, CLIPBOARD_CLEAR_DELAY_MS);
    } catch {
      // Écriture refusée (permissions, contexte non sécurisé) : le bouton
      // reste disponible pour un nouvel essai, aucune valeur n'est journalisée.
    }
  }, [value]);

  if (!stillVisible) {
    return (
      <div
        role="status"
        className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center sm:p-6"
      >
        <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-gray-400" aria-hidden="true" />
        <p className="text-sm font-medium text-gray-700">
          Ce code n'est plus affiché. Une nouvelle vérification d'identité est nécessaire.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
          Code {VAULT_SERVICE_LABELS[service]}
        </span>
        <span
          role="timer"
          aria-live="polite"
          className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"
        >
          Expire dans {formatRemaining(remainingSeconds)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code
          data-testid="vault-code-value"
          className="min-h-[40px] flex-1 select-all break-all rounded-xl border border-amber-300 bg-white px-3 py-2 text-lg font-mono tracking-widest text-gray-900"
        >
          {value}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          aria-label="Copier le code"
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>

      <p className="mt-3 text-xs text-amber-800">
        Ce code disparaîtra automatiquement à l'expiration. Il n'est pas
        téléchargeable et le presse-papier sera effacé après 30 secondes.
      </p>
    </div>
  );
}
