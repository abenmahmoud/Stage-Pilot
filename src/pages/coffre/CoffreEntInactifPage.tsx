// Écran réel du parcours « ENT inactif » du coffre de codes — LOT 5 du plan
// du 6 septembre 2026
// (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`).
//
// Monte `CodeVaultSecureDisplay` (`src/components/CodeVaultSecureDisplay.tsx`)
// sur la vraie route du LOT 3 (`POST /api/vault/ent-inactif`,
// `handleEntInactifVaultRequest`), via la décision pure
// `decideEntInactifScreenState` (`shared/code-vault-ent-inactif-screen.ts`).
// Cette page ne recalcule aucune règle d'autorisation ni de quota : elle
// affiche ce que la route décide, phase par phase, à partir d'événements
// réels de la personne (preuve envoyée, vérification confirmée) — jamais une
// phase avancée d'elle-même, même esprit que `shared/code-vault-journeys.ts`
// (« c'est à l'appelant de faire progresser cette phase »).
//
// Point non résolu, documenté explicitement plutôt que masqué (voir
// `docs/operations/night-logs/BRANCHE-LOT5.md`) : la route du LOT 3 ne
// déchiffre et ne renvoie jamais la valeur du code (aucun point de lecture de
// `code_vault_private_rows` n'existe dans ce dépôt). L'état `revealed` porte
// donc toujours `value: null` aujourd'hui, et cette page l'assume au lieu de
// fabriquer une valeur : `CodeVaultSecureDisplay` n'est réellement rendu avec
// un code que le jour où un point de lecture unique sera tranché.
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, KeyRound, LoaderCircle, Mail, Phone, ShieldAlert, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { CodeVaultSecureDisplay } from "../../components/CodeVaultSecureDisplay";
import { apiFetch } from "../../lib/api";
import {
  decideEntInactifScreenState,
  ENT_INACTIF_PHASE_AFTER_DISPLAY_EXPIRY,
  type EntInactifRouteResultLike,
  type EntInactifScreenState,
} from "../../../shared/code-vault-ent-inactif-screen";
import { VAULT_PROOF_CHANNELS, type EntInactifPhase, type VaultProofChannel } from "../../../shared/code-vault-journeys";
import type { VaultAccessRefusalReason } from "../../../shared/code-vault-policy";

type PageState = { kind: "loading" } | { kind: "error"; message: string } | EntInactifScreenState;

const PROOF_CHANNEL_LABEL: Readonly<Record<VaultProofChannel, string>> = {
  email: "Email déjà au dossier",
  phone: "Téléphone déjà au dossier",
};

const REFUSAL_MESSAGE: Readonly<Record<VaultAccessRefusalReason, string>> = {
  parent_to_child_forbidden: "La remise d'un code élève à un parent n'est pas autorisée.",
  institution_mismatch: "Ce compte n'appartient pas à cet établissement.",
  self_only: "Ce coffre n'est accessible qu'à son propre titulaire.",
  cantine_availability_not_validated: "La disponibilité cantine n'est pas validée pour ce compte.",
  professeur_principal_ent_forbidden: "Ce parcours n'est pas ouvert au professeur principal.",
  professeur_principal_single_active_code_required: "Un seul code actif à la fois est autorisé pour le professeur principal.",
  professeur_principal_class_not_validated: "La classe n'est pas validée pour ce professeur principal.",
  service_scope_required: "Ce compte n'a pas le service requis pour cet accès.",
};

const GENERIC_ERROR_MESSAGE = "Le service ne répond pas pour le moment. Réessayez dans quelques instants.";

export default function CoffreEntInactifPage() {
  const [schoolYear, setSchoolYear] = useState<string | null>(null);
  const [proofChannel, setProofChannel] = useState<VaultProofChannel>("email");
  const [screen, setScreen] = useState<PageState>({ kind: "loading" });

  const requestStep = useCallback(
    async (phase: EntInactifPhase, year: string, channel: VaultProofChannel) => {
      setScreen({ kind: "loading" });
      try {
        const result = await apiFetch<EntInactifRouteResultLike>("vault/ent-inactif", {
          method: "POST",
          body: JSON.stringify({ phase, proofChannel: channel, schoolYear: year }),
        });
        setScreen(decideEntInactifScreenState(result));
      } catch (error) {
        setScreen({
          kind: "error",
          message: error instanceof Error ? error.message : GENERIC_ERROR_MESSAGE,
        });
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const etablissement = await apiFetch<{ anneeScolaire?: string }>("etablissement");
        if (cancelled) return;
        const year = etablissement.anneeScolaire ?? "";
        setSchoolYear(year);
        await requestStep("before_proof", year, "email");
      } catch (error) {
        if (!cancelled) {
          setScreen({
            kind: "error",
            message: error instanceof Error ? error.message : GENERIC_ERROR_MESSAGE,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Chargement initial uniquement : les transitions suivantes répondent à
    // des actions explicites de la personne (voir les gestionnaires plus bas),
    // jamais à un changement de dépendance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restartAfterExpiryOrGap = useCallback(() => {
    if (schoolYear === null) return;
    // Une nouvelle demande de preuve d'identité, jamais une reprise à
    // `verified` : voir `ENT_INACTIF_PHASE_AFTER_DISPLAY_EXPIRY`.
    void requestStep(ENT_INACTIF_PHASE_AFTER_DISPLAY_EXPIRY, schoolYear, proofChannel);
  }, [requestStep, schoolYear, proofChannel]);

  const handleChannelChange = useCallback(
    (channel: VaultProofChannel) => {
      setProofChannel(channel);
      if (schoolYear !== null) void requestStep("before_proof", schoolYear, channel);
    },
    [requestStep, schoolYear]
  );

  const handleProofSent = useCallback(() => {
    if (schoolYear === null) return;
    void requestStep("awaiting_verification", schoolYear, proofChannel);
  }, [requestStep, schoolYear, proofChannel]);

  const handleVerificationConfirmed = useCallback(() => {
    if (schoolYear === null) return;
    void requestStep("verified", schoolYear, proofChannel);
  }, [requestStep, schoolYear, proofChannel]);

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary-600" aria-hidden="true" />
            <h1 className="text-base font-semibold text-gray-900">Récupérer mon code ENT</h1>
          </div>
        </CardHeader>
        <CardContent>
          {screen.kind === "loading" && (
            <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
              <LoaderCircle className="h-6 w-6 animate-spin text-primary-500" aria-hidden="true" />
            </div>
          )}

          {screen.kind === "error" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-red-500" aria-hidden="true" />
                <p className="text-sm text-red-700">{screen.message}</p>
              </div>
              <button
                type="button"
                onClick={restartAfterExpiryOrGap}
                className="mt-3 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Réessayer
              </button>
            </div>
          )}

          {screen.kind === "denied" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-5 w-5 text-red-500" aria-hidden="true" />
                <p className="text-sm text-red-700">{REFUSAL_MESSAGE[screen.reason]}</p>
              </div>
            </div>
          )}

          {screen.kind === "send_proof" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                Une preuve d'identité doit vous être envoyée par une coordonnée déjà au dossier.
              </p>
              <div className="space-y-2" role="radiogroup" aria-label="Canal de la preuve d'identité">
                {VAULT_PROOF_CHANNELS.map((channel) => (
                  <label key={channel} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="proof-channel"
                      value={channel}
                      checked={proofChannel === channel}
                      onChange={() => handleChannelChange(channel)}
                    />
                    {channel === "email" ? (
                      <Mail className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    ) : (
                      <Phone className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    )}
                    {PROOF_CHANNEL_LABEL[channel]}
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={handleProofSent}
                className="min-h-[40px] w-full rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Preuve reçue, continuer
              </button>
            </div>
          )}

          {screen.kind === "awaiting_verification" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-700">Vérification de la preuve en attente.</p>
              <button
                type="button"
                onClick={handleVerificationConfirmed}
                className="min-h-[40px] w-full rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Vérification confirmée, continuer
              </button>
            </div>
          )}

          {screen.kind === "form_fallback" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                Ce parcours nécessite le formulaire enrichi (motif : {screen.reasonCode}).
              </p>
            </div>
          )}

          {screen.kind === "password_reset_invited" && (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden="true" />
                <p className="text-sm text-emerald-800">
                  Identifiant récupéré. Réinitialisez maintenant votre mot de passe ENT.
                </p>
              </div>
              <Link
                to="/reset-password"
                className="inline-block min-h-[40px] rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Réinitialiser mon mot de passe
              </Link>
            </div>
          )}

          {screen.kind === "revealed" &&
            (screen.value !== null ? (
              <CodeVaultSecureDisplay
                service="ent"
                value={screen.value}
                revealedAt={screen.revealedAt}
                onExpire={restartAfterExpiryOrGap}
              />
            ) : (
              <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-5 w-5 text-gray-400" aria-hidden="true" />
                  <p className="text-sm text-gray-700">
                    Autorisation confirmée ({screen.remainingDisplaysToday} affichage(s) restant(s)
                    aujourd'hui), mais la lecture du code n'est pas encore branchée sur ce parcours —
                    voir le compte rendu du LOT 5.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={restartAfterExpiryOrGap}
                  className="min-h-[40px] rounded-xl bg-gray-600 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                >
                  Redemander une preuve d'identité
                </button>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
