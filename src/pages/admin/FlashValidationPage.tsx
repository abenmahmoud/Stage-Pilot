import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Lock,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { apiFetch } from "../../lib/api";
import type { FlashImportance } from "../../../shared/flash-version-diff";
import {
  isValidFlashInfoVersionPayload,
  isValidFlashValidationAccessPayload,
  type FlashInfoVersionPayload,
  type FlashValidationAccessPayload,
} from "../../../shared/flash-payload-policy";

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

type FlashValidationQueueItem = {
  version: FlashInfoVersionPayload;
  access: FlashValidationAccessPayload;
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
      isValidFlashValidationAccessPayload(record.access)
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [queuePayload, expiredPayload] = await Promise.all([
        apiFetch<unknown>("flash/validation/queue"),
        apiFetch<unknown>("flash/validation/expired"),
      ]);
      if (!isFlashValidationQueuePayload(queuePayload)) {
        throw new Error("La file de validation n'a pas pu être lue.");
      }
      if (!isFlashExpiredListPayload(expiredPayload)) {
        throw new Error("La liste des propositions expirées n'a pas pu être lue.");
      }
      setQueue(queuePayload.items);
      setExpiredCount(expiredPayload.count);
      setExpiredItems(expiredPayload.items);
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
          ? "Validation enregistrée. Rien n'a été envoyé : la publication n'est pas encore branchée."
          : "Refus enregistré."
      );
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La décision n'a pas pu être enregistrée.");
    } finally {
      setDecidingId(null);
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
          Le public visé (audience) et le nom de l'auteur ne sont pas encore renvoyés par ces
          routes : seul l'identifiant de l'auteur est affiché. La modification du texte avant
          validation et la correction après publication ne sont pas branchées dans cet écran.
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

      {queue.map(({ version, access }) => (
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
              Proposée par {version.proposedBy} ·{" "}
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
