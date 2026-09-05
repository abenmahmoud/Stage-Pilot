import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Lock,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Send,
  ShieldCheck,
  ShieldX,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { apiFetch } from "../../lib/api";
import { FLASH_IMPORTANCE_LEVELS, type FlashGapKind, type FlashImportance } from "../../../shared/flash-version-diff";
import {
  FLASH_NOTIFICATION_CHANNELS,
  parseFlashGroupRef,
  type FlashNotificationChannel,
} from "../../../shared/flash-audience-correction";
import {
  isValidFlashInfoVersionPayload,
  isValidFlashValidationAccessPayload,
  isValidFlashAudienceTreatmentPayload,
  type FlashInfoVersionPayload,
  type FlashValidationAccessPayload,
  type FlashAudienceTreatmentPayload,
} from "../../../shared/flash-payload-policy";
import { FICTITIOUS_FLASH_GROUPS, flashChannelRequirement } from "./FlashProposalPage";

const IMPORTANCE_LABEL: Record<FlashImportance, string> = {
  normale: "Normale",
  importante: "Importante",
  urgente: "Urgente",
};

const ACCESS_REASON_LABEL: Record<string, string> = {
  service_not_granted: "Ce compte ne porte pas le service référent numérique ou DDFPT.",
  self_validation_forbidden: "L'auto-validation est fermée pour cet établissement.",
};

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function formatFlashAge(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / MINUTE_MS));
  if (minutes < 60) return minutes <= 1 ? "il y a 1 min" : `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours <= 1 ? "il y a 1 h" : `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return days <= 1 ? "il y a 1 j" : `il y a ${days} j`;
}

function isValidProposedByName(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.trim().length > 0);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

type FlashValidationQueueItem = {
  version: FlashInfoVersionPayload;
  access: FlashValidationAccessPayload;
  proposedByName: string | null;
};

function isFlashValidationQueuePayload(
  value: unknown
): value is { items: FlashValidationQueueItem[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const items = (value as Record<string, unknown>).items;
  if (!Array.isArray(items)) return false;
  return items.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const record = item as Record<string, unknown>;
    return (
      isValidFlashInfoVersionPayload(record.version) &&
      isValidFlashValidationAccessPayload(record.access) &&
      isValidProposedByName(record.proposedByName)
    );
  });
}

function isFlashExpiredListPayload(
  value: unknown
): value is { count: number; items: FlashInfoVersionPayload[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.count === "number" &&
    Array.isArray(record.items) &&
    record.items.every((item) => isValidFlashInfoVersionPayload(item))
  );
}

function isFlashDecisionConfirmationPayload(
  value: unknown
): value is { version: FlashInfoVersionPayload; access: FlashValidationAccessPayload } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    isValidFlashInfoVersionPayload(record.version) &&
    isValidFlashValidationAccessPayload(record.access)
  );
}

// LOT 3 du plan de publication : versions validées, en attente de la
// transition `validee -> publiee` (bouton "Publier" ci-dessous).
type FlashPublishableItem = {
  version: FlashInfoVersionPayload;
  access: FlashValidationAccessPayload;
  proposedByName: string | null;
};

function isFlashPublishableQueuePayload(
  value: unknown
): value is { items: FlashPublishableItem[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const items = (value as Record<string, unknown>).items;
  if (!Array.isArray(items)) return false;
  return items.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const record = item as Record<string, unknown>;
    return (
      isValidFlashInfoVersionPayload(record.version) &&
      isValidFlashValidationAccessPayload(record.access) &&
      isValidProposedByName(record.proposedByName)
    );
  });
}

function isFlashPublicationResultPayload(
  value: unknown
): value is { version: FlashInfoVersionPayload; access: FlashValidationAccessPayload; alreadyPublished: boolean } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    isValidFlashInfoVersionPayload(record.version) &&
    isValidFlashValidationAccessPayload(record.access) &&
    typeof record.alreadyPublished === "boolean"
  );
}

// LOT 3 du plan de publication : versions publiées, pour brancher enfin la
// correction (POST .../correction). `audience` vient de
// `api/flash/validation/published.ts`, jamais ressaisie à l'aveugle.
type FlashPublishedItem = {
  version: FlashInfoVersionPayload;
  audience: string[];
  proposedByName: string | null;
};

function isFlashPublishedListPayload(
  value: unknown
): value is { count: number; items: FlashPublishedItem[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.count !== "number" || !Array.isArray(record.items)) return false;
  return record.items.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const r = item as Record<string, unknown>;
    return (
      isValidFlashInfoVersionPayload(r.version) &&
      isStringArray(r.audience) &&
      isValidProposedByName(r.proposedByName)
    );
  });
}

function isFlashCorrectionResultPayload(
  value: unknown
): value is { version: FlashInfoVersionPayload; audienceTreatment: FlashAudienceTreatmentPayload; gapKind: FlashGapKind } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    isValidFlashInfoVersionPayload(record.version) &&
    isValidFlashAudienceTreatmentPayload(record.audienceTreatment) &&
    (record.gapKind === "decisif" || record.gapKind === "forme")
  );
}

function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function FlashValidationPage() {
  const navigate = useNavigate();
  const [now] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [queue, setQueue] = useState<FlashValidationQueueItem[]>([]);
  const [expiredCount, setExpiredCount] = useState(0);
  const [expiredItems, setExpiredItems] = useState<FlashInfoVersionPayload[]>([]);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [publishable, setPublishable] = useState<FlashPublishableItem[]>([]);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [published, setPublished] = useState<FlashPublishedItem[]>([]);

  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctionTitle, setCorrectionTitle] = useState("");
  const [correctionBody, setCorrectionBody] = useState("");
  const [correctionImportance, setCorrectionImportance] = useState<FlashImportance>("normale");
  const [correctionGroups, setCorrectionGroups] = useState<string[]>([]);
  const [correctionEmailOptIn, setCorrectionEmailOptIn] = useState(false);
  const [correctionExpiresAt, setCorrectionExpiresAt] = useState("");
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);
  const [correctionError, setCorrectionError] = useState("");
  // Capturée à l'ouverture du formulaire (openCorrection), avant toute
  // frappe : c'est le titre réellement encore servi au public tant que la
  // correction n'est pas republiée (LOT 2 du plan de correction visible).
  const [correctionBeforeVersion, setCorrectionBeforeVersion] = useState<{
    title: string;
    bodyMarkdown: string;
  } | null>(null);
  const [correctionResult, setCorrectionResult] = useState<{
    version: FlashInfoVersionPayload;
    audienceTreatment: FlashAudienceTreatmentPayload;
    gapKind: FlashGapKind;
    previousVersion: { title: string; bodyMarkdown: string };
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [queuePayload, expiredPayload, publishablePayload, publishedPayload] = await Promise.all([
        apiFetch<unknown>("flash/validation/queue"),
        apiFetch<unknown>("flash/validation/expired"),
        apiFetch<unknown>("flash/validation/publishable"),
        apiFetch<unknown>("flash/validation/published"),
      ]);
      if (!isFlashValidationQueuePayload(queuePayload)) {
        throw new Error("La file de validation n'a pas pu être lue.");
      }
      if (!isFlashExpiredListPayload(expiredPayload)) {
        throw new Error("La liste des propositions expirées n'a pas pu être lue.");
      }
      if (!isFlashPublishableQueuePayload(publishablePayload)) {
        throw new Error("La file des versions validées n'a pas pu être lue.");
      }
      if (!isFlashPublishedListPayload(publishedPayload)) {
        throw new Error("La liste des informations publiées n'a pas pu être lue.");
      }
      setQueue(queuePayload.items);
      setExpiredCount(expiredPayload.count);
      setExpiredItems(expiredPayload.items);
      setPublishable(publishablePayload.items);
      setPublished(publishedPayload.items);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "La file de validation est momentanément indisponible."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(flashInfoId: string, target: "validee" | "refusee") {
    setDecidingId(flashInfoId);
    setError("");
    setNotice("");
    try {
      const confirmation = await apiFetch<unknown>(`flash/proposals/${flashInfoId}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision: target, content: null }),
      });
      if (!isFlashDecisionConfirmationPayload(confirmation)) {
        throw new Error("La décision n'a pas été confirmée par le serveur.");
      }
      setNotice(
        target === "validee"
          ? "Validation enregistrée. Rien n'a été envoyé : la publication reste un geste distinct, à faire plus bas."
          : "Refus enregistré."
      );
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La décision n'a pas pu être enregistrée.");
    } finally {
      setDecidingId(null);
    }
  }

  // LOT 1 du plan de publication, branché ici (LOT 3) : transition
  // `validee -> publiee`, aucun paramètre. Aucun envoi n'est déclenché par
  // cette route (les canaux de notification restent fermés).
  async function publish(flashInfoId: string) {
    setPublishingId(flashInfoId);
    setError("");
    setNotice("");
    try {
      const confirmation = await apiFetch<unknown>(`flash/proposals/${flashInfoId}/publication`, {
        method: "POST",
      });
      if (!isFlashPublicationResultPayload(confirmation)) {
        throw new Error("La confirmation de publication n'a pas pu être lue.");
      }
      setNotice(
        confirmation.alreadyPublished
          ? "Cette information était déjà publiée : aucune seconde publication n'a eu lieu."
          : "Publication enregistrée : l'information est désormais visible. Aucun envoi n'est déclenché, les canaux de notification restent fermés."
      );
      // Le rappel « pas encore visible » n'a plus lieu d'être une fois cette
      // même information réellement republiée (LOT 2 du plan de correction
      // visible) : il disparaît, le bandeau de succès ci-dessus suffit.
      setCorrectionResult((previous) =>
        previous && previous.version.flashInfoId === flashInfoId ? null : previous
      );
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La publication n'a pas pu être enregistrée.");
    } finally {
      setPublishingId(null);
    }
  }

  function openCorrection(item: FlashPublishedItem) {
    setError("");
    setCorrectionError("");
    setCorrectionResult(null);
    setCorrectingId(item.version.flashInfoId);
    setCorrectionBeforeVersion({ title: item.version.title, bodyMarkdown: item.version.bodyMarkdown });
    setCorrectionTitle(item.version.title);
    setCorrectionBody(item.version.bodyMarkdown);
    setCorrectionImportance(item.version.importance);
    setCorrectionGroups(item.audience);
    setCorrectionEmailOptIn(item.version.channels.includes("email"));
    setCorrectionExpiresAt(toDatetimeLocalValue(item.version.expiresAt));
  }

  function closeCorrection() {
    setCorrectingId(null);
    setCorrectionError("");
  }

  function toggleCorrectionGroup(ref: string) {
    setCorrectionGroups((previous) =>
      previous.includes(ref) ? previous.filter((item) => item !== ref) : [...previous, ref]
    );
  }

  // T071B : brancher enfin POST .../correction (écrit au LOT 4 du plan de
  // persistance, jamais appelé jusqu'ici). Le serveur recalcule les trois
  // ensembles depuis l'audience et les envois RÉELS ; rien de tout ça n'est
  // recalculé côté client (même règle que pour `decide`).
  async function submitCorrection() {
    if (!correctingId || !correctionBeforeVersion) return;
    setCorrectionError("");
    let groupRefs: string[];
    let trimmedTitle: string;
    let trimmedBody: string;
    let expiresAtDate: Date;
    try {
      trimmedTitle = correctionTitle.trim();
      trimmedBody = correctionBody.trim();
      if (trimmedTitle.length < 2 || trimmedTitle.length > 180) {
        throw new Error("Le titre doit contenir entre 2 et 180 caractères.");
      }
      if (trimmedBody.length < 1) {
        throw new Error("Le texte de l'information ne peut pas être vide.");
      }
      if (correctionGroups.length === 0) {
        throw new Error("Choisissez au moins un public.");
      }
      groupRefs = correctionGroups.map((ref) => parseFlashGroupRef(ref));
      if (!correctionExpiresAt) {
        throw new Error("L'expiration est obligatoire.");
      }
      expiresAtDate = new Date(correctionExpiresAt);
      if (Number.isNaN(expiresAtDate.getTime()) || expiresAtDate.getTime() <= Date.now()) {
        throw new Error("L'expiration doit être une date future.");
      }
    } catch (caught) {
      setCorrectionError(caught instanceof Error ? caught.message : "Correction invalide.");
      return;
    }

    const channels: FlashNotificationChannel[] = [];
    if (correctionImportance === "importante") {
      channels.push("push");
      if (correctionEmailOptIn) channels.push("email");
    } else if (correctionImportance === "urgente") {
      channels.push("push", "email");
    }

    setCorrectionSubmitting(true);
    try {
      const confirmation = await apiFetch<unknown>(`flash/proposals/${correctingId}/correction`, {
        method: "POST",
        body: JSON.stringify({
          title: trimmedTitle,
          bodyMarkdown: trimmedBody,
          importance: correctionImportance,
          channels,
          groupRefs,
          expiresAt: expiresAtDate.toISOString(),
        }),
      });
      if (!isFlashCorrectionResultPayload(confirmation)) {
        throw new Error("La confirmation de la correction n'a pas pu être lue.");
      }
      setCorrectionResult({ ...confirmation, previousVersion: correctionBeforeVersion });
      setCorrectingId(null);
      await load();
    } catch (caught) {
      setCorrectionError(caught instanceof Error ? caught.message : "La correction n'a pas pu être enregistrée.");
    } finally {
      setCorrectionSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-3 sm:px-0">
      <button
        onClick={() => navigate("/admin")}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>

      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-bold text-gray-900 sm:text-2xl">
          Valider et modifier les informations flash
        </h1>
        <p className="text-sm text-gray-500">
          Réservé au référent numérique ou à la DDFPT. La file et les décisions ci-dessous sont
          lues et écrites sur le serveur ; rien n'est publié ni envoyé depuis cet écran.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Le nom de l'auteur n'est affiché que pour les comptes liés à une fiche professeur ;
          les autres restent identifiés par leur compte. La modification du texte avant
          validation n'est pas branchée dans cet écran.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-gray-900">Propositions en attente ({queue.length})</h2>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              title="Actualiser"
              aria-label="Actualiser"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && queue.length === 0 ? (
            <div className="flex min-h-24 items-center justify-center">
              <LoaderCircle className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : queue.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune proposition en attente.</p>
          ) : null}
        </CardContent>
      </Card>

      {queue.map(({ version, access, proposedByName }) => (
        <Card key={version.id}>
          <CardHeader className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-gray-900">{version.title}</h2>
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {IMPORTANCE_LABEL[version.importance]}
              </span>
            </div>
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              Proposée par {proposedByName ?? `compte ${version.proposedBy.slice(0, 8)}…`} ·{" "}
              {formatFlashAge(now.getTime() - new Date(version.createdAt).getTime())} · expire le{" "}
              {new Date(version.expiresAt).toLocaleString("fr-FR")}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="whitespace-pre-wrap text-sm text-gray-700">{version.bodyMarkdown}</p>
            <p className="text-xs text-gray-500">
              Canaux : {version.channels.length > 0 ? version.channels.join(", ") : "aucun (site seul)"}
            </p>

            {access.selfValidated && (
              <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Vous êtes l'auteur de cette proposition. Une auto-validation reste possible mais
                est enregistrée comme telle.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              {access.allowed ? (
                <>
                  <button
                    type="button"
                    onClick={() => void decide(version.flashInfoId, "validee")}
                    disabled={decidingId === version.flashInfoId}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {decidingId === version.flashInfoId ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    Valider
                  </button>
                  <button
                    type="button"
                    onClick={() => void decide(version.flashInfoId, "refusee")}
                    disabled={decidingId === version.flashInfoId}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-50"
                  >
                    <ShieldX className="h-4 w-4" /> Refuser
                  </button>
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
                  <XCircle className="h-4 w-4" />
                  {(access.reason && ACCESS_REASON_LABEL[access.reason]) ??
                    "Cette décision n'est pas ouverte à ce compte."}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">
            Validées, en attente de publication ({publishable.length})
          </h2>
          <p className="text-xs text-gray-500">
            Publier rend l'information visible. Aucun envoi n'est déclenché : les canaux de
            notification restent fermés.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {publishable.length === 0 && <p className="text-sm text-gray-500">Aucune, à ce jour.</p>}
        </CardContent>
      </Card>

      {publishable.map(({ version, access, proposedByName }) => (
        <Card key={version.id}>
          <CardHeader className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-gray-900">{version.title}</h2>
              <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Validée
              </span>
            </div>
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              Proposée par {proposedByName ?? `compte ${version.proposedBy.slice(0, 8)}…`} · expire le{" "}
              {new Date(version.expiresAt).toLocaleString("fr-FR")}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">
              Canaux : {version.channels.length > 0 ? version.channels.join(", ") : "aucun (site seul)"}
            </p>
            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              {access.allowed ? (
                <button
                  type="button"
                  onClick={() => void publish(version.flashInfoId)}
                  disabled={publishingId === version.flashInfoId}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                >
                  {publishingId === version.flashInfoId ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Publier
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
                  <XCircle className="h-4 w-4" />
                  {(access.reason && ACCESS_REASON_LABEL[access.reason]) ??
                    "Cette publication n'est pas ouverte à ce compte."}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Publiées ({published.length})</h2>
          <p className="text-xs text-gray-500">
            Corriger reprend le texte, l'importance, les canaux, l'expiration et le public de la
            version publiée, calcule les maintenus/retirés/ajoutés à partir de l'audience et des
            envois réels, puis enregistre la décision humaine. Aucun envoi n'est déclenché par
            cette route.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {published.length === 0 && <p className="text-sm text-gray-500">Aucune, à ce jour.</p>}
        </CardContent>
      </Card>

      {published.map((item) => (
        <Card key={item.version.id}>
          <CardHeader className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-gray-900">{item.version.title}</h2>
              <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                Publiée
              </span>
            </div>
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              Proposée par {item.proposedByName ?? `compte ${item.version.proposedBy.slice(0, 8)}…`} · expire le{" "}
              {new Date(item.version.expiresAt).toLocaleString("fr-FR")}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="whitespace-pre-wrap text-sm text-gray-700">{item.version.bodyMarkdown}</p>
            <p className="text-xs text-gray-500">
              Public actuel : {item.audience.length > 0 ? item.audience.join(", ") : "aucun"}
            </p>

            {correctingId !== item.version.flashInfoId && (
              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => openCorrection(item)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700"
                >
                  <Pencil className="h-4 w-4" />
                  Corriger
                </button>
              </div>
            )}

            {correctingId === item.version.flashInfoId && (
              <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                {correctionError && (
                  <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{correctionError}</span>
                  </div>
                )}
                <label className="block text-sm">
                  <span className="mb-1 block text-gray-600">Titre</span>
                  <input
                    value={correctionTitle}
                    onChange={(event) => setCorrectionTitle(event.target.value)}
                    maxLength={180}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-gray-600">Texte</span>
                  <textarea
                    value={correctionBody}
                    onChange={(event) => setCorrectionBody(event.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
                  />
                </label>

                <div className="space-y-1.5">
                  <span className="block text-xs font-medium text-gray-600">Importance</span>
                  <div className="flex flex-wrap gap-2">
                    {FLASH_IMPORTANCE_LEVELS.map((level) => (
                      <label
                        key={level}
                        className={
                          "flex min-h-[40px] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs " +
                          (correctionImportance === level ? "border-primary-400 bg-primary-50" : "border-gray-200 bg-white")
                        }
                      >
                        <input
                          type="radio"
                          name={`correction-importance-${item.version.id}`}
                          checked={correctionImportance === level}
                          onChange={() => setCorrectionImportance(level)}
                          className="h-4 w-4 shrink-0"
                        />
                        {IMPORTANCE_LABEL[level]}
                      </label>
                    ))}
                  </div>
                </div>

                {correctionImportance !== "normale" && (
                  <p className="text-xs text-gray-500">
                    {(() => {
                      const requirement = flashChannelRequirement(correctionImportance);
                      return FLASH_NOTIFICATION_CHANNELS.filter((channel) => requirement[channel] !== "indisponible")
                        .map((channel) => `${channel} (${requirement[channel]})`)
                        .join(", ");
                    })()}
                    {correctionImportance === "importante" && (
                      <label className="ml-2 inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={correctionEmailOptIn}
                          onChange={(event) => setCorrectionEmailOptIn(event.target.checked)}
                          className="h-4 w-4"
                        />
                        Inclure l'email
                      </label>
                    )}
                  </p>
                )}

                <div className="space-y-1.5">
                  <span className="block text-xs font-medium text-gray-600">
                    Public ({correctionGroups.length} groupe(s))
                  </span>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {FICTITIOUS_FLASH_GROUPS.map((group) => (
                      <label
                        key={group.ref}
                        className="flex min-h-[40px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={correctionGroups.includes(group.ref)}
                          onChange={() => toggleCorrectionGroup(group.ref)}
                          className="h-4 w-4 shrink-0"
                        />
                        <span className="min-w-0 truncate text-gray-800">{group.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <label className="block text-sm">
                  <span className="mb-1 block text-gray-600">Expiration</span>
                  <input
                    type="datetime-local"
                    value={correctionExpiresAt}
                    onChange={(event) => setCorrectionExpiresAt(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void submitCorrection()}
                    disabled={correctionSubmitting}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {correctionSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                    Confirmer la correction
                  </button>
                  <button
                    type="button"
                    onClick={closeCorrection}
                    disabled={correctionSubmitting}
                    className="inline-flex min-h-[40px] items-center rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      ))}

      {correctionResult && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Correction confirmée : {correctionResult.version.title}</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="flex items-start gap-1.5 font-medium">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Correction enregistrée, mais pas visible : il faut la publier pour qu'elle
                remplace ce que le public voit encore.
              </p>
              <p>
                Tant que cette publication n'a pas eu lieu, le public voit toujours l'ancienne
                version : « {correctionResult.previousVersion.title} ».
              </p>
              <button
                type="button"
                onClick={() => void publish(correctionResult.version.flashInfoId)}
                disabled={publishingId === correctionResult.version.flashInfoId}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                {publishingId === correctionResult.version.flashInfoId ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Publier la correction maintenant
              </button>
            </div>

            <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <p className="flex items-start gap-1.5 font-medium">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {correctionResult.gapKind === "decisif" ? "Écart décisif" : "Correction de forme"}. Aucun envoi
                n'est déclenché par cet écran.
              </p>
              <ul className="space-y-1.5">
                <li>
                  Maintenus ({correctionResult.audienceTreatment.maintained.length}) : reçoivent l'information
                  corrigée (le nouveau texte).
                </li>
                <li>
                  Retirés ({correctionResult.audienceTreatment.removed.length}) : reçoivent une ligne sans détail
                  signalant que cette information ne les concerne plus.
                </li>
                <li>
                  Ajoutés ({correctionResult.audienceTreatment.added.length}) : reçoivent l'information comme
                  neuve, jamais présentée comme une correction.
                </li>
              </ul>
              <p>
                {correctionResult.audienceTreatment.correctionPossible
                  ? `Canaux concernés (déjà notifiés réellement) : ${
                      correctionResult.audienceTreatment.eligibleChannels.length > 0
                        ? correctionResult.audienceTreatment.eligibleChannels.join(", ")
                        : "aucun"
                    }.`
                  : "Aucun envoi n'est concerné : rien n'avait réellement notifié avant, ou rien ne notifie après."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">
            Propositions expirées sans validation ({expiredCount})
          </h2>
          <p className="text-xs text-gray-500">
            Échecs comptés et consultables, pour ajuster ensuite les délais ou le nombre de valideurs.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {expiredItems.length === 0 && <p className="text-sm text-gray-500">Aucune, à ce jour.</p>}
          {expiredItems.map((version) => (
            <div key={version.id} className="space-y-1 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs">
              <p className="font-medium text-gray-800">{version.title}</p>
              <p className="text-gray-500">
                Proposée par {version.proposedBy} · expirée le{" "}
                {new Date(version.expiresAt).toLocaleString("fr-FR")}
              </p>
              <p className="flex items-start gap-1.5 text-gray-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                Message à l'auteur (à émettre) : cette proposition n'a pas été publiée, faute de
                validation à temps, et personne n'a été informé.
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
