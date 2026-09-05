import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Lock,
  Mail,
  MessageSquareWarning,
  Sparkles,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { apiFetch } from "../../lib/api";
import {
  FLASH_IMPORTANCE_LEVELS,
  type FlashImportance,
} from "../../../shared/flash-version-diff";
import {
  FLASH_NOTIFICATION_CHANNELS,
  parseFlashGroupRef,
  type FlashNotificationChannel,
} from "../../../shared/flash-audience-correction";
import {
  isValidFlashInfoVersionPayload,
  type FlashInfoVersionPayload,
} from "../../../shared/flash-payload-policy";

// Meme adresse que celle deja utilisee (en lecture seule, aucune mutation)
// dans src/pages/prototype/LyceeConnectPrototype.tsx pour ouvrir la
// messagerie professionnelle du lycee. Reprise ici a l'identique plutot que
// devinee, pour renvoyer vers le meme outil quand une personne doit joindre
// son public tout de suite (exigence du LOT 3).
const WEBMAIL_URL = "https://mail.lycee-blaise-cendrars-sevran.fr/";

type FictitiousGroup = { ref: string; label: string };
type FictitiousContact = { ref: string; label: string };

// Public fictif pour cet ecran de proposition (aucune donnee reelle, aucun
// nom d'eleve, de parent ou de personnel).
const FICTITIOUS_FLASH_GROUPS: readonly FictitiousGroup[] = [
  { ref: "classe:2ndea", label: "Seconde A" },
  { ref: "classe:1stmga", label: "Première STMG A" },
  { ref: "niveau:terminale", label: "Tout le niveau terminale" },
  { ref: "personnel:enseignants", label: "Personnel enseignant" },
  { ref: "personnel:administratif", label: "Personnel administratif" },
  { ref: "parents:cantine", label: "Parents inscrits à la cantine" },
];

// Contacts fictifs pour le SMS (§13 : « SMS aux seules personnes choisies »,
// jamais a un groupe). Roles inventes, pas des personnes reelles.
const FICTITIOUS_FLASH_SMS_CONTACTS: readonly FictitiousContact[] = [
  { ref: "contact:referent-numerique-fictif", label: "Référent numérique (compte fictif)" },
  { ref: "contact:vie-scolaire-fictif", label: "Vie scolaire (compte fictif)" },
  { ref: "contact:cpe-fictif", label: "CPE (compte fictif)" },
];

const IMPORTANCE_LABEL: Record<FlashImportance, string> = {
  normale: "Normale",
  importante: "Importante",
  urgente: "Urgente",
};

const IMPORTANCE_HELP: Record<FlashImportance, string> = {
  normale: "Site seul. Aucune notification.",
  importante: "Push obligatoire, email facultatif.",
  urgente: "Push et email obligatoires, SMS possible aux personnes choisies.",
};

type ChannelRequirement = "obligatoire" | "facultatif" | "indisponible";

/**
 * Traduit en exigence d'ecran la contrainte SQL `channels` du LOT 1
 * (`flash_info_versions`) : normale = aucun canal, importante = push
 * obligatoire + email facultatif, urgente = push et email obligatoires + sms
 * facultatif. Cette fonction ne fait que refleter cette regle deja actee ;
 * elle n'invente rien.
 */
function flashChannelRequirement(
  importance: FlashImportance
): Record<FlashNotificationChannel, ChannelRequirement> {
  if (importance === "normale") {
    return { push: "indisponible", email: "indisponible", sms: "indisponible" };
  }
  if (importance === "importante") {
    return { push: "obligatoire", email: "facultatif", sms: "indisponible" };
  }
  return { push: "obligatoire", email: "obligatoire", sms: "facultatif" };
}

const URGENT_KEYWORDS = [
  "annulé",
  "annulée",
  "annulation",
  "urgent",
  "urgente",
  "évacuation",
  "danger",
  "sécurité",
  "immédiat",
  "immédiate",
];

const IMPORTANT_KEYWORDS = [
  "changement",
  "changé",
  "changée",
  "modifié",
  "modifiée",
  "report",
  "reporté",
  "reportée",
  "décalé",
  "décalée",
  "nouvelle salle",
  "nouvel horaire",
];

/**
 * Suggestion tres simple, par mots-cles, pour illustrer « l'agent suggere
 * l'importance ». Ce n'est pas une preuve de justesse metier : c'est une
 * heuristique de demonstration, affichee comme une proposition que la
 * personne peut reprendre ou ignorer. Voir le compte rendu du lot pour
 * l'aveu explicite de cette limite.
 */
function suggestFlashImportance(title: string, body: string): { importance: FlashImportance; reason: string } {
  const text = `${title} ${body}`.toLocaleLowerCase("fr-FR");
  const matchedUrgent = URGENT_KEYWORDS.find((keyword) => text.includes(keyword));
  if (matchedUrgent) {
    return { importance: "urgente", reason: `Mot-clé détecté : « ${matchedUrgent} ».` };
  }
  const matchedImportant = IMPORTANT_KEYWORDS.find((keyword) => text.includes(keyword));
  if (matchedImportant) {
    return { importance: "importante", reason: `Mot-clé détecté : « ${matchedImportant} ».` };
  }
  return { importance: "normale", reason: "Aucun mot-clé de changement décisif détecté." };
}

type SubmittedFlashProposal = {
  version: FlashInfoVersionPayload;
  duplicate: boolean;
};

function isFlashProposalSubmissionPayload(
  value: unknown
): value is { version: FlashInfoVersionPayload; duplicate: boolean } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    isValidFlashInfoVersionPayload(record.version) && typeof record.duplicate === "boolean"
  );
}

export default function FlashProposalPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [importance, setImportance] = useState<FlashImportance | null>(null);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [smsContacts, setSmsContacts] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<SubmittedFlashProposal | null>(null);
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const suggestion = useMemo(() => suggestFlashImportance(title, body), [title, body]);
  const requirement = importance ? flashChannelRequirement(importance) : null;

  function toggleGroup(ref: string) {
    setSubmitted(null);
    setSelectedGroups((previous) =>
      previous.includes(ref) ? previous.filter((item) => item !== ref) : [...previous, ref]
    );
  }

  function toggleSmsContact(ref: string) {
    setSubmitted(null);
    setSmsContacts((previous) =>
      previous.includes(ref) ? previous.filter((item) => item !== ref) : [...previous, ref]
    );
  }

  function chooseImportance(next: FlashImportance) {
    setSubmitted(null);
    setImportance(next);
    if (next !== "importante") setEmailOptIn(false);
    if (next !== "urgente") setSmsContacts([]);
  }

  async function submitProposal() {
    setError("");
    setSubmitted(null);
    let groupRefs: string[];
    let importanceValue: FlashImportance;
    let expiresAtDate: Date;
    let trimmedTitle: string;
    let trimmedBody: string;
    try {
      trimmedTitle = title.trim();
      trimmedBody = body.trim();
      if (trimmedTitle.length < 2 || trimmedTitle.length > 180) {
        throw new Error("Le titre doit contenir entre 2 et 180 caractères.");
      }
      if (trimmedBody.length < 1) {
        throw new Error("Le texte de l'information ne peut pas être vide.");
      }
      if (selectedGroups.length === 0) {
        throw new Error("Choisissez au moins un public.");
      }
      groupRefs = selectedGroups.map((ref) => parseFlashGroupRef(ref));
      if (!importance) {
        throw new Error("Choisissez l'importance : la suggestion de l'agent n'est pas une décision.");
      }
      importanceValue = importance;
      if (!expiresAt) {
        throw new Error("L'expiration est obligatoire : aucune information flash ne peut en être dépourvue.");
      }
      expiresAtDate = new Date(expiresAt);
      if (Number.isNaN(expiresAtDate.getTime()) || expiresAtDate.getTime() <= Date.now()) {
        throw new Error("L'expiration doit être une date future.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Proposition invalide");
      return;
    }

    const channels: FlashNotificationChannel[] = [];
    if (importanceValue === "importante") {
      channels.push("push");
      if (emailOptIn) channels.push("email");
    } else if (importanceValue === "urgente") {
      channels.push("push", "email");
      if (smsContacts.length > 0) channels.push("sms");
    }

    setSubmitting(true);
    try {
      const payload = await apiFetch<unknown>("flash/proposals", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKeyRef.current },
        body: JSON.stringify({
          title: trimmedTitle,
          bodyMarkdown: trimmedBody,
          importance: importanceValue,
          channels,
          groupRefs,
          expiresAt: expiresAtDate.toISOString(),
        }),
      });
      if (!isFlashProposalSubmissionPayload(payload)) {
        throw new Error("La confirmation de la proposition est invalide.");
      }
      setSubmitted(payload);
      idempotencyKeyRef.current = crypto.randomUUID();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La proposition n'a pas pu être enregistrée.");
    } finally {
      setSubmitting(false);
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
          Proposer une information flash
        </h1>
        <p className="text-sm text-gray-500">
          Un canal supplémentaire, jamais le canal d'urgence. Le texte, l'importance et
          l'expiration sont enregistrés sur le serveur ; le public visé reste un jeu d'essai
          fictif. Rien n'est envoyé sans validation.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">
            Une proposition en attente n'a prévenu personne, même une fois préparée ici.
          </p>
          <p>
            Rien ne part sans validation du référent numérique ou de la DDFPT. Si vous devez
            joindre votre public tout de suite, ne passez pas par cet écran :
          </p>
          <a
            href={WEBMAIL_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-amber-900 underline underline-offset-2"
          >
            <Mail className="h-3.5 w-3.5" />
            Ouvrir la messagerie du lycée
          </a>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Le public visé (groupes ci-dessous) est un jeu d'essai fictif, non branché à un
          annuaire réel. Le bouton en bas de page envoie une vraie requête au serveur.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Texte de l'information</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Titre</span>
            <input
              value={title}
              onChange={(event) => {
                setSubmitted(null);
                setTitle(event.target.value);
              }}
              maxLength={180}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-primary-500"
              placeholder="Ex. : Sortie pédagogique de la classe de Seconde A reportée"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Texte</span>
            <textarea
              value={body}
              onChange={(event) => {
                setSubmitted(null);
                setBody(event.target.value);
              }}
              rows={4}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-primary-500"
              placeholder="Détail de l'information à afficher"
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Public visé</h2>
          <p className="text-xs text-gray-500">{selectedGroups.length} groupe(s) sélectionné(s)</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FICTITIOUS_FLASH_GROUPS.map((group) => (
              <label
                key={group.ref}
                className="flex min-h-[40px] items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedGroups.includes(group.ref)}
                  onChange={() => toggleGroup(group.ref)}
                  className="h-4 w-4 shrink-0"
                />
                <span className="min-w-0 truncate text-gray-800">{group.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Importance</h2>
          <p className="text-xs text-gray-500">L'agent suggère ; vous décidez.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl border border-primary-100 bg-primary-50 p-3 text-xs text-primary-900">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1">
              <p>
                Suggestion : <span className="font-semibold">{IMPORTANCE_LABEL[suggestion.importance]}</span>
              </p>
              <p className="text-primary-800">{suggestion.reason}</p>
            </div>
            <button
              type="button"
              onClick={() => chooseImportance(suggestion.importance)}
              className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-primary-700 shadow-sm hover:bg-primary-100"
            >
              Reprendre
            </button>
          </div>

          <div className="space-y-2">
            {FLASH_IMPORTANCE_LEVELS.map((level) => (
              <label
                key={level}
                className={
                  "flex min-h-[40px] flex-col gap-0.5 rounded-xl border px-3 py-2 text-sm sm:flex-row sm:items-center sm:gap-3 " +
                  (importance === level ? "border-primary-400 bg-primary-50" : "border-gray-200")
                }
              >
                <span className="flex items-center gap-2 sm:w-32 sm:shrink-0">
                  <input
                    type="radio"
                    name="flash-importance"
                    checked={importance === level}
                    onChange={() => chooseImportance(level)}
                    className="h-4 w-4 shrink-0"
                  />
                  <span className="font-medium text-gray-900">{IMPORTANCE_LABEL[level]}</span>
                </span>
                <span className="text-xs text-gray-500">{IMPORTANCE_HELP[level]}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Canaux</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {!requirement && (
            <p className="text-xs text-gray-500">Choisissez d'abord l'importance ci-dessus.</p>
          )}
          {requirement && importance === "normale" && (
            <p className="text-xs text-gray-500">
              Aucun canal : seul le site est mis à jour, sans notification.
            </p>
          )}
          {requirement && importance !== "normale" && (
            <ul className="space-y-2 text-sm">
              {FLASH_NOTIFICATION_CHANNELS.filter((channel) => requirement[channel] !== "indisponible").map(
                (channel) => (
                  <li key={channel} className="flex flex-wrap items-center gap-2">
                    <span className="w-16 shrink-0 font-medium text-gray-800">
                      {channel === "push" ? "Push" : channel === "email" ? "Email" : "SMS"}
                    </span>
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs " +
                        (requirement[channel] === "obligatoire"
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-600")
                      }
                    >
                      {requirement[channel]}
                    </span>
                    {channel === "email" && requirement.email === "facultatif" && (
                      <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={emailOptIn}
                          onChange={(event) => {
                            setSubmitted(null);
                            setEmailOptIn(event.target.checked);
                          }}
                          className="h-4 w-4"
                        />
                        Inclure l'email
                      </label>
                    )}
                  </li>
                )
              )}
              {importance === "urgente" && (
                <li className="space-y-2 rounded-xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">
                    SMS facultatif, uniquement à des personnes choisies (jamais à un groupe) :
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {FICTITIOUS_FLASH_SMS_CONTACTS.map((contact) => (
                      <label
                        key={contact.ref}
                        className="flex min-h-[40px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={smsContacts.includes(contact.ref)}
                          onChange={() => toggleSmsContact(contact.ref)}
                          className="h-4 w-4 shrink-0"
                        />
                        <span className="min-w-0 truncate text-gray-800">{contact.label}</span>
                      </label>
                    ))}
                  </div>
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Expiration</h2>
        </CardHeader>
        <CardContent className="space-y-2">
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Date et heure d'expiration (obligatoire)</span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => {
                setSubmitted(null);
                setExpiresAt(event.target.value);
              }}
              required
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </label>
          <p className="text-xs text-gray-500">
            Une information flash ne peut jamais être publiée sans expiration.
          </p>
        </CardContent>
      </Card>

      <button
        onClick={() => void submitProposal()}
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        {submitting ? "Envoi en cours…" : "Envoyer la proposition"}
      </button>

      {submitted && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">
              {submitted.duplicate ? "Proposition déjà enregistrée" : "Proposition enregistrée"}
            </h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">
                  En attente de validation par le référent numérique ou la DDFPT.
                </p>
                <p className="text-xs">
                  Personne n'a été prévenu : une proposition en attente ne notifie jamais son
                  public. {submitted.duplicate
                    ? "Ce renvoi correspond à une proposition déjà enregistrée : aucune seconde entrée n'a été créée."
                    : "Rien n'est envoyé tant que la validation n'a pas eu lieu."}
                </p>
              </div>
            </div>

            <dl className="space-y-1 text-sm">
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-gray-700">Titre :</dt>
                <dd className="text-gray-900">{submitted.version.title}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-gray-700">Importance :</dt>
                <dd className="text-gray-900">{IMPORTANCE_LABEL[submitted.version.importance]}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-gray-700">Statut :</dt>
                <dd className="text-gray-900">{submitted.version.status}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-gray-700">Canaux :</dt>
                <dd className="text-gray-900">
                  {submitted.version.channels.length > 0
                    ? submitted.version.channels.join(", ")
                    : "aucun (site seul)"}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-gray-700">Expire le :</dt>
                <dd className="text-gray-900">
                  {new Date(submitted.version.expiresAt).toLocaleString("fr-FR")}
                </dd>
              </div>
            </dl>

            <div className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <span>
                Besoin de joindre ce public avant la validation ?{" "}
                <a
                  href={WEBMAIL_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-gray-800 underline underline-offset-2"
                >
                  Ouvrir la messagerie du lycée
                </a>
                .
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
