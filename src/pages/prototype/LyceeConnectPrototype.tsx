import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  Archive,
  BadgeCheck,
  BarChart3,
  Bell,
  BookOpenCheck,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleUserRound,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  FolderCheck,
  Filter,
  GraduationCap,
  Headphones,
  Home,
  Inbox,
  KeyRound,
  Laptop,
  Languages,
  LifeBuoy,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircleMore,
  Mic2,
  Newspaper,
  Paperclip,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Smartphone,
  TicketCheck,
  Trash2,
  UserRound,
  Users,
  UsersRound,
  WandSparkles,
  Wifi,
} from "lucide-react";
import { supabase } from "../../lib/supabase-browser";
import { apiFetch } from "../../lib/api";
import { PublicContentMarkdown } from "../../components/PublicContentMarkdown";
import {
  clearSupportDeviceDraft,
  clearRememberedSupportRequests,
  listRememberedSupportRequests,
  readSupportDeviceDraft,
  rememberSupportRequests,
  saveSupportDeviceDraft,
  type SupportDraftFormValues,
} from "../../lib/support-device-memory";
import {
  evaluateConversationPolicy,
  resolveAssistantAction,
  type AssistantPolicyAction,
  type AssistantScope,
} from "../../../shared/assistant-policy";
import { evaluateLaptopIntake } from "../../../shared/laptop-intake";
import {
  prepareSupportSubmissionConversation,
  summarizeSupportDescription,
} from "../../../shared/support-conversation";
import { verifySupportRequestPersistenceConfirmation } from "../../../shared/support-request-confirmation";
import { verifySupportRequestMutationConfirmation } from "../../../shared/support-request-mutation-confirmation";
import { verifySupportAgentReplyConfirmation } from "../../../shared/support-agent-reply-confirmation";
import { verifySupportRequesterMessageConfirmation } from "../../../shared/support-requester-message-confirmation";
import { verifySupportInternalNoteConfirmation } from "../../../shared/support-internal-note-confirmation";
import { verifySupportCallbackConfirmation } from "../../../shared/support-callback-confirmation";
import { verifySupportAttachmentRemovalConfirmation } from "../../../shared/support-attachment-removal-confirmation";
import {
  DEFAULT_SUPPORT_REPLY_TEMPLATES,
  renderSupportReplyTemplate,
  type SupportReplyTemplate,
} from "../../../shared/support-reply-templates";
import { assessSupportQueueItem } from "../../../shared/support-queue-policy";
import {
  filterPublicContentFeed,
  publicContentDateLabel,
  publicContentFeedCategories,
} from "../../../shared/public-content-feed";
import {
  SUPPORT_IDENTITY_VERIFICATION_MESSAGE,
  supportTranslationTargetLanguage,
} from "../../../shared/support-reply-policy";
import {
  reconcileActiveSupportNotification,
  type ActiveSupportNotification,
  type ActiveSupportNotificationSnapshot,
} from "../../../shared/support-active-notification";
import { readJsonApiResponse } from "../../../shared/json-api-response";
import {
  readPublicContentPayload,
  type PublicContent,
  type PublicContentScope,
} from "./public-content-client";
import "./lycee-connect.css";

type View = "home" | "services" | "help" | "requests" | "school" | "news" | "agent" | "trust";
type RequesterProfile = "eleve" | "parent" | "professeur" | "personnel" | "autre" | "";

const SUPPORT_API_ENABLED = import.meta.env.VITE_SUPPORT_API_ENABLED === "true";
const AI_ASSISTANT_ENABLED = import.meta.env.VITE_AI_ASSISTANT_ENABLED !== "false";
const LYCEEGEST_URL = "/login";
const ENT_URL = "https://ent.iledefrance.fr/auth/login";
const SCOLARITE_SERVICES_URL = "https://www.education.gouv.fr/scolarite-services-un-acces-unique-pour-toutes-les-demarches-scolaires-326158";
const WEBMAIL_URL = "https://mail.lycee-blaise-cendrars-sevran.fr/";
const WEBMAIL_ADMIN_URL = `${WEBMAIL_URL}admin`;
const MAX_SUPPORT_FILES = 5;
const MAX_SUPPORT_ATTACHMENTS_PER_REQUEST = 10;
const MAX_SUPPORT_FILE_BYTES = 10 * 1024 * 1024;
const SUPPORT_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const SUPPORT_ASSISTANT_DEVICE_KEY = "bc_support_assistant_session";

function supportAssistantSessionId(): string {
  try {
    const existing = window.localStorage.getItem(SUPPORT_ASSISTANT_DEVICE_KEY);
    if (existing && /^[a-zA-Z0-9-]{16,80}$/.test(existing)) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(SUPPORT_ASSISTANT_DEVICE_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function forgetSupportAssistantDevice(): void {
  try {
    window.localStorage.removeItem(SUPPORT_ASSISTANT_DEVICE_KEY);
  } catch {
    // The opaque rate-limit identifier contains no dossier or identity data.
  }
}

const supportCategories = [
  { value: "inscription", label: "Inscription ou réinscription" },
  { value: "affectation_classe", label: "Classe ou emploi du temps" },
  { value: "documents_scolarite", label: "Document ou dossier incomplet" },
  { value: "ent", label: "ENT ou EduConnect" },
  { value: "email_academique", label: "Email académique" },
  { value: "ordinateur", label: "Ordinateur ou équipement" },
  { value: "logiciel", label: "Logiciel ou accès numérique" },
  { value: "restauration_bourse", label: "Restauration, bourse ou intendance" },
  { value: "orientation_formation", label: "Orientation ou formation" },
  { value: "vie_scolaire", label: "Vie scolaire" },
  { value: "autre", label: "Autre demande" },
] as const;

type SupportCategory = (typeof supportCategories)[number]["value"];
type IdentityStatus = "non_verifiee" | "contact_verifie" | "identite_confirmee";

function defaultSupportFormValues(): SupportDraftFormValues {
  return {
    requesterFirstName: "",
    requesterLastName: "",
    beneficiaryFirstName: "",
    beneficiaryLastName: "",
    className: "",
    subjectArea: "",
    schoolTrack: "",
    email: "",
    phone: "",
    preferredChannel: "email",
    languagePreference: "francais_simple",
    fallbackAllowed: true,
    communicationSupport: false,
  };
}

const requesterProfileLabels: Record<string, string> = {
  eleve: "Élève",
  parent: "Parent ou responsable légal",
  professeur: "Professeur",
  personnel: "Personnel",
  autre: "Autre personne",
};

const channelLabels: Record<string, string> = {
  email: "email",
  phone: "téléphone",
  web: "application",
};

const priorityLabels: Record<string, string> = {
  p1: "Critique",
  p2: "Urgente",
  p3: "Normale",
  p4: "Faible",
};

const identityStatusLabels: Record<IdentityStatus, string> = {
  non_verifiee: "Coordonnées déclarées",
  contact_verifie: "Moyen de contact vérifié",
  identite_confirmee: "Identité confirmée par le lycée",
};

const languagePreferenceLabels: Record<string, string> = {
  francais_simple: "Français simple",
  francais: "Français",
  arabe: "Arabe",
  anglais: "Anglais",
  espagnol: "Espagnol",
  portugais: "Portugais",
  turc: "Turc",
  autre: "Autre langue",
};

const supportTeams = [
  { value: "referent_numerique", label: "Référent numérique" },
  { value: "ddfpt", label: "DDFPT" },
  { value: "secretariat", label: "Secrétariat" },
  { value: "vie_scolaire", label: "Vie scolaire" },
  { value: "intendance", label: "Intendance" },
  { value: "direction", label: "Direction" },
  { value: "administration", label: "Administration" },
] as const;

function supportCategoryLabel(value: string): string {
  return supportCategories.find((category) => category.value === value)?.label ?? "Autre demande";
}

function supportTeamLabel(value: string | null): string {
  return supportTeams.find((team) => team.value === value)?.label ?? "À orienter";
}

async function readApiResponse<T>(responseInput: Response | Promise<Response>): Promise<T> {
  return readJsonApiResponse<T>(responseInput);
}

async function uploadSupportFile(publicCode: string, file: File): Promise<void> {
  const reservation = await readApiResponse<unknown>(
    await fetch(`/api/support/requests/${publicCode}/attachments`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        concernsType: "demande",
        documentType: "justificatif",
      }),
    })
  );
  if (!isSupportUploadReservationPayload(reservation)) {
    throw new Error("La réservation du fichier reçue est invalide.");
  }

  const { error: uploadError } = await supabase.storage
    .from(reservation.upload.bucket)
    .uploadToSignedUrl(reservation.upload.path, reservation.upload.token, file, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) throw new Error(`Échec de l'envoi de ${file.name}`);

  const confirmation = await readApiResponse<unknown>(
    await fetch(`/api/support/attachments/${reservation.attachment.id}/confirm`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicCode }),
    })
  );
  if (!isSupportAttachmentConfirmationPayload(confirmation, reservation.attachment.id)) {
    throw new Error("La confirmation du fichier reçue est invalide.");
  }
}

const navigation = [
  { label: "Accueil", icon: Home, view: "home" as View },
  { label: "Mes services", icon: GraduationCap, view: "services" as View },
  { label: "Aide et demandes", icon: LifeBuoy, view: "help" as View },
  { label: "Mes demandes", icon: TicketCheck, view: "requests" as View },
  { label: "Vie du lycée", icon: Newspaper, view: "school" as View },
];

const services = [
  {
    title: "Demander de l’aide",
    detail: "Expliquez librement votre situation",
    icon: MessageCircleMore,
    tone: "blue",
    prompt: "",
  },
  {
    title: "Ordinateur portable",
    detail: "Panne, charge, casse, perte ou connexion",
    icon: Laptop,
    tone: "coral",
    prompt: "J’ai un problème avec l’ordinateur portable prêté par le lycée.",
  },
  {
    title: "Codes de connexion",
    detail: "ENT, EduConnect ou email académique",
    icon: KeyRound,
    tone: "gold",
    prompt: "Je n’ai pas reçu mes codes ou je n’arrive pas à me connecter.",
  },
  {
    title: "Inscription ou dossier",
    detail: "Inscription, réinscription ou pièce manquante",
    icon: FolderCheck,
    tone: "green",
    prompt: "J’ai besoin d’aide pour une inscription ou un dossier incomplet.",
  },
  {
    title: "Classe et rentrée",
    detail: "Affectation, emploi du temps ou information",
    icon: UsersRound,
    tone: "blue",
    prompt: "J’ai une question sur ma classe, mon emploi du temps ou la rentrée.",
  },
];

const specialties = [
  {
    acronym: "HGGSP",
    title: "Histoire-géographie, géopolitique et sciences politiques",
    summary: "Comprendre les rapports de force, les territoires et les grands enjeux contemporains.",
    focus: "Analyser · argumenter · croiser les sources",
    image: "/specialties/hggsp.webp",
  },
  {
    acronym: "HLP",
    title: "Humanités, littérature et philosophie",
    summary: "Explorer les grandes questions humaines par les textes, les idées et la réflexion.",
    focus: "Lire · penser · construire un raisonnement",
    image: "/specialties/hlp.webp",
  },
  {
    acronym: "LLCE",
    title: "Langues, littératures et cultures étrangères",
    summary: "Approfondir une langue et découvrir les cultures, les œuvres et les sociétés qui la portent.",
    focus: "Communiquer · interpréter · s'ouvrir au monde",
    image: "/specialties/llce.webp",
  },
  {
    acronym: "MATHS",
    title: "Mathématiques",
    summary: "Développer l'abstraction, la modélisation et les outils nécessaires aux sciences.",
    focus: "Démontrer · modéliser · résoudre",
    image: "/specialties/mathematiques.webp",
  },
  {
    acronym: "NSI",
    title: "Numérique et sciences informatiques",
    summary: "Comprendre les données, les algorithmes, les réseaux et la programmation.",
    focus: "Coder · concevoir · comprendre le numérique",
    image: "/specialties/nsi.webp",
  },
  {
    acronym: "PHYSIQUE-CHIMIE",
    title: "Physique-chimie",
    summary: "Observer la matière et les phénomènes, expérimenter puis construire des modèles.",
    focus: "Expérimenter · mesurer · expliquer",
    image: "/specialties/physique-chimie.webp",
  },
  {
    acronym: "SVT",
    title: "Sciences de la vie et de la Terre",
    summary: "Étudier le vivant, la planète, la santé et les grands équilibres environnementaux.",
    focus: "Observer · expérimenter · relier les échelles",
    image: "/specialties/svt.webp",
  },
  {
    acronym: "SES",
    title: "Sciences économiques et sociales",
    summary: "Décoder l'économie, les comportements sociaux et les transformations de la société.",
    focus: "Enquêter · interpréter · débattre",
    image: "/specialties/ses.webp",
  },
] as const;

export default function LyceeConnectPrototype() {
  const [view, setView] = useState<View>(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    return ["home", "services", "help", "requests", "school", "news", "agent", "trust"].includes(requested ?? "")
      ? requested as View
      : "home";
  });
  const [message, setMessage] = useState("");
  const [helpMode, setHelpMode] = useState<"chat" | "form">("chat");
  const [menuOpen, setMenuOpen] = useState(false);
  const [ticketCreated, setTicketCreated] = useState<string | null>(null);
  const homeAssistantRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!SUPPORT_API_ENABLED) return;
    const url = new URL(window.location.href);
    const token = url.searchParams.get("support_token");
    if (!token) return;
    readApiResponse<unknown>(
      fetch(`/api/support/access/${encodeURIComponent(token)}`, {
        method: "POST",
        credentials: "include",
      })
    )
      .then((payload) => {
        if (!isSupportMagicAccessPayload(payload)) {
          throw new Error("La confirmation d'accès reçue est invalide.");
        }
        setTicketCreated(payload.request.publicCode);
        setView("requests");
        url.searchParams.delete("support_token");
        window.history.replaceState({}, "", url);
      })
      .catch(() => {
        url.searchParams.delete("support_token");
        window.history.replaceState({}, "", url);
      });
  }, []);

  function changeView(nextView: View) {
    if (nextView !== "help") setHelpMode("chat");
    setView(nextView);
    setMenuOpen(false);
    const url = new URL(window.location.href);
    if (nextView === "home") url.searchParams.delete("view");
    else url.searchParams.set("view", nextView);
    window.history.replaceState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startHelp(prompt = "", mode: "chat" | "form" = "chat") {
    setMessage(prompt);
    setHelpMode(mode);
    changeView("help");
  }

  function focusHomeAssistant() {
    document.getElementById("lycee-assistant-title")?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => homeAssistantRef.current?.focus(), 350);
  }

  return (
    <div className="lycee-connect">
      <aside className="lycee-sidebar">
        <div className="lycee-brand">
          <img src="/blaise-cendrars-portrait.webp" alt="Portrait de Blaise Cendrars" />
          <div>
            <strong>Lycée Blaise Cendrars</strong>
            <span>Sevran · 93</span>
          </div>
        </div>

        <nav aria-label="Navigation principale">
          {navigation.map((item) => (
            <button
              className={view === item.view ? "is-active" : ""}
              type="button"
              key={item.label}
              onClick={() => changeView(item.view)}
            >
              <item.icon aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="lycee-sidebar-tools">
          <a href={LYCEEGEST_URL}><BarChart3 aria-hidden="true" /><span><strong>LyceeGest</strong><small>Stages et Grand Oral</small></span><ChevronRight aria-hidden="true" /></a>
          <a href={WEBMAIL_URL} target="_blank" rel="noreferrer"><Mail aria-hidden="true" /><span><strong>Webmail du lycée</strong><small>Messagerie et diffusion</small></span><ExternalLink aria-hidden="true" /></a>
          <button type="button" onClick={() => changeView("trust")}><ShieldCheck aria-hidden="true" /><span><strong>Confidentialité</strong><small>Protection et utilisation des données</small></span><ChevronRight aria-hidden="true" /></button>
        </div>

        <button className="lycee-agent-link" type="button" onClick={() => changeView("agent")}>
          <Headphones aria-hidden="true" />
          <span>
            <strong>Espace agent</strong>
            <small>Traiter les demandes</small>
          </span>
        </button>

        <div className="lycee-sidebar-status">
          <span className="lycee-live-dot" />
          <div>
            <strong>Application disponible</strong>
            <span>Services du lycée ouverts</span>
          </div>
        </div>
      </aside>

      <div className="lycee-workspace" role="main">
        <header className="lycee-topbar">
          <button
            className="lycee-menu-button"
            type="button"
            aria-label="Ouvrir le menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <Menu aria-hidden="true" />
          </button>
          <div className="lycee-mobile-brand">
            <img src="/blaise-cendrars-portrait.webp" alt="" />
            <div>
              <strong>Blaise Cendrars</strong>
              <span>Lycée polyvalent</span>
            </div>
          </div>
          <div className="lycee-top-actions">
            <button className="lycee-top-tool" type="button" onClick={() => changeView("news")} title="Voir les informations du lycée"><Newspaper aria-hidden="true" /><span>À la une</span></button>
            <a className="lycee-top-tool" href={WEBMAIL_URL} target="_blank" rel="noreferrer" title="Ouvrir le Webmail"><Mail aria-hidden="true" /><span>Webmail</span></a>
            <button className="lycee-profile-button" type="button" aria-label="Ouvrir l’espace agent" onClick={() => changeView("agent")}>
              <CircleUserRound aria-hidden="true" />
              <span>Espace agent</span>
            </button>
          </div>
        </header>

        {menuOpen && (
          <nav className="lycee-mobile-menu" aria-label="Menu mobile">
            {navigation.map((item) => (
              <button type="button" key={item.label} onClick={() => changeView(item.view)}>
                <item.icon aria-hidden="true" />
                {item.label}
              </button>
            ))}
            <button type="button" onClick={() => changeView("trust")}>
              <ShieldCheck aria-hidden="true" />
              Confidentialité et sécurité
            </button>
          </nav>
        )}

        <div className="lycee-service-banner">
          <ShieldCheck aria-hidden="true" />
          <span>Portail numérique officiel du Lycée Blaise Cendrars</span>
          <strong>En ligne</strong>
        </div>

        {view === "home" && (
          <>
        <section className="lycee-hero">
          <img src="/lycee-blaise-hero.webp" alt="Façade du Lycée Blaise Cendrars à Sevran avec le portrait de l’écrivain" />
          <div className="lycee-hero-shade" />
          <div className="lycee-hero-copy">
            <span>Lycée polyvalent · Sevran</span>
            <h1>Blaise Cendrars</h1>
            <p>Un lycée pour construire son parcours, de la voie générale aux formations technologiques et professionnelles.</p>
            <div className="lycee-hero-tracks" role="list" aria-label="Parcours proposés">
              <span role="listitem">Général</span><span role="listitem">Technologique</span><span role="listitem">Professionnel</span><span role="listitem">CAP</span>
            </div>
            <button className="lycee-hero-help" type="button" onClick={focusHomeAssistant}>
              <MessageCircleMore aria-hidden="true" />
              <span><strong>Besoin d’aide&nbsp;?</strong><small>Parler à l’assistant du lycée</small></span>
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </section>

        <div className="lycee-content">
          <section className="lycee-assistant" aria-labelledby="lycee-assistant-title">
            <div className="lycee-assistant-heading">
              <span className="lycee-ai-icon"><Bot aria-hidden="true" /></span>
              <div>
                <span className="lycee-eyebrow">Aide immédiate</span>
                <h2 id="lycee-assistant-title">Posez votre question à l’assistant du lycée</h2>
              </div>
              <span className="lycee-ai-status"><Sparkles aria-hidden="true" /> Disponible</span>
            </div>
            <p>Connexion, ordinateur, inscription, vie scolaire ou document&nbsp;: écrivez simplement votre besoin. L’assistant vous répond ou prépare une demande pour le bon service.</p>
            <div className="lycee-composer">
              <textarea
                ref={homeAssistantRef}
                id="lycee-home-help-message"
                name="helpMessage"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                aria-label="Écrivez votre question ou votre problème"
                placeholder="Écrivez ici votre question ou votre problème…"
              />
              <button
                type="button"
                disabled={!message.trim()}
                onClick={() => startHelp(message)}
              >
                <Send aria-hidden="true" />
                <span>Obtenir de l’aide</span>
              </button>
            </div>
            <button className="lycee-form-shortcut" type="button" onClick={() => startHelp("", "form")}><FileText aria-hidden="true" /> Je préfère remplir un formulaire</button>
            <div className="lycee-trust-row">
              <button type="button" onClick={() => changeView("trust")}><ShieldCheck aria-hidden="true" /> Confidentialité et sécurité</button>
              <span><Users aria-hidden="true" /> Actions sensibles validées par un agent</span>
            </div>
          </section>

          <section className="lycee-core-tools" aria-label="Outils principaux du lycée">
            <button type="button" data-tool="news" onClick={() => changeView("news")}><span><Newspaper aria-hidden="true" /></span><div><strong>À la une</strong><small>Rentrée, formations et informations du lycée</small></div><em>Consulter <ChevronRight aria-hidden="true" /></em></button>
            <a href={WEBMAIL_URL} target="_blank" rel="noreferrer" data-tool="mail"><span><Mail aria-hidden="true" /></span><div><strong>Webmail du lycée</strong><small>Messagerie, contacts et diffusion</small></div><em>Ouvrir <ExternalLink aria-hidden="true" /></em></a>
          </section>

          <section className="lycee-services" aria-labelledby="lycee-services-title">
            <div className="lycee-section-title">
              <div>
                <span className="lycee-eyebrow">Vos services</span>
                <h2 id="lycee-services-title">Accéder rapidement</h2>
              </div>
              <button type="button" onClick={() => changeView("services")}>Tout afficher <ChevronRight aria-hidden="true" /></button>
            </div>
            <div className="lycee-service-grid">
              {services.map((service) => (
                <button type="button" data-tone={service.tone} key={service.title} onClick={() => startHelp(service.prompt)}>
                  <span className="lycee-service-icon"><service.icon aria-hidden="true" /></span>
                  <span className="lycee-service-copy">
                    <strong>{service.title}</strong>
                    <span>{service.detail}</span>
                  </span>
                  <ChevronRight aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>

          <section className="lycee-specialties-preview" aria-labelledby="specialties-preview-title">
            <div className="lycee-section-title">
              <div>
                <span className="lycee-eyebrow">Voie générale</span>
                <h2 id="specialties-preview-title">Choisir parmi 8 spécialités</h2>
              </div>
              <button type="button" onClick={() => changeView("school")}>Toutes les spécialités <ChevronRight aria-hidden="true" /></button>
            </div>
            <div className="lycee-specialties-preview-grid">
              {specialties.slice(0, 4).map((specialty) => (
                <button type="button" key={specialty.acronym} onClick={() => changeView("school")}>
                  <span className="lycee-specialty-preview-image">
                    <img src={specialty.image} alt="" loading="lazy" />
                    <em>{specialty.acronym}</em>
                  </span>
                  <strong>{specialty.title}</strong>
                  <small>{specialty.summary}</small>
                  <ChevronRight aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>

          <section className="lycee-lower-grid">
            <article className="lycee-news">
              <span><BarChart3 aria-hidden="true" /> LyceeGest</span>
              <h2>Stages et Grand Oral</h2>
              <p>Les outils de suivi restent disponibles dans l’application de gestion du lycée.</p>
              <a href={LYCEEGEST_URL}>Ouvrir LyceeGest <ChevronRight aria-hidden="true" /></a>
            </article>
            <article className="lycee-status-panel">
              <a href={ENT_URL} target="_blank" rel="noreferrer" title="Ouvrir ENT Monlycée.net dans un nouvel onglet">
                <span className="lycee-status-icon"><Wifi aria-hidden="true" /></span>
                <span><strong>ENT Monlycée.net</strong><small>Connexion et services</small></span>
                <em>Ouvrir <ExternalLink aria-hidden="true" /></em>
              </a>
              <a href={WEBMAIL_URL} target="_blank" rel="noreferrer" title="Ouvrir le Webmail du lycée dans un nouvel onglet">
                <span className="lycee-status-icon"><Mail aria-hidden="true" /></span>
                <span><strong>Webmail du lycée</strong><small>Messagerie et diffusion</small></span>
                <em>Ouvrir <ExternalLink aria-hidden="true" /></em>
              </a>
            </article>
          </section>

          <section className="lycee-formations-band">
            <div><span className="lycee-eyebrow">Lycée polyvalent</span><h2>Général, technologique et professionnel</h2><p>Des parcours de la seconde au baccalauréat, avec CAP, spécialités générales, STL, STMG, MELEC et PCEPC.</p></div>
            <div className="lycee-track-pills"><span>Voie générale</span><span>STL</span><span>STMG</span><span>Voie pro</span><span>CAP</span></div>
            <button type="button" onClick={() => changeView("school")}>Découvrir toutes les formations <ChevronRight aria-hidden="true" /></button>
          </section>
        </div>
          </>
        )}

        {view === "help" && (
          <HelpDeskView
            initialMessage={message}
            initialClassicForm={helpMode === "form"}
            onBack={() => changeView("home")}
            onTicketCreated={setTicketCreated}
            onTrack={() => changeView("requests")}
          />
        )}
        {view === "requests" && <RequestsView ticketCode={ticketCreated} onBack={() => changeView("home")} />}
        {view === "services" && <ServicesView onHelp={() => startHelp()} onBack={() => changeView("home")} />}
        {view === "school" && <SchoolView onBack={() => changeView("home")} onHelp={startHelp} />}
        {view === "news" && <NewsView onBack={() => changeView("home")} />}
        {view === "agent" && <AgentView onBack={() => changeView("home")} />}
        {view === "trust" && <TrustView onBack={() => changeView("home")} />}

        <nav className="lycee-bottom-nav" aria-label="Navigation mobile">
          {navigation.map((item, index) => (
            <button
              className={view === item.view ? "is-active" : ""}
              type="button"
              key={item.label}
              onClick={() => changeView(item.view)}
            >
              <item.icon aria-hidden="true" />
              <span>{["Accueil", "Services", "Aide", "Suivi", "Lycée"][index]}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function PageIntro({
  eyebrow,
  title,
  description,
  onBack,
}: {
  eyebrow: string;
  title: string;
  description: string;
  onBack: () => void;
}) {
  return (
    <header className="lycee-page-intro">
      <button type="button" onClick={onBack} aria-label="Retour à l’accueil"><ArrowLeft aria-hidden="true" /></button>
      <div>
        <span className="lycee-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}

function NewsView({ onBack }: { onBack: () => void }) {
  const [scope, setScope] = useState<PublicContentScope>("current");
  const [items, setItems] = useState<PublicContent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [moreError, setMoreError] = useState("");
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setItems([]);
    setSelectedId(null);
    setNextCursor(null);
    setLoading(true);
    setError("");
    setMoreError("");
    const url = scope === "expired" ? "/api/content/public?archive=expired" : "/api/content/public";
    fetch(url, { signal: controller.signal })
      .then((response) => readPublicContentPayload(response, scope))
      .then((payload) => {
        const newsItems = payload.items.filter((item) => item.contentType !== "page");
        setItems(newsItems);
        setSelectedId(newsItems[0]?.id ?? null);
        setNextCursor(payload.nextCursor);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(scope === "expired"
          ? "Les archives ne peuvent pas être chargées pour le moment."
          : "Les informations ne peuvent pas être chargées pour le moment.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [scope]);

  const loadMore = async () => {
    if (!nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setMoreError("");
    try {
      const archiveQuery = scope === "expired" ? "archive=expired&" : "";
      const response = await fetch(`/api/content/public?${archiveQuery}cursor=${encodeURIComponent(nextCursor)}`);
      const payload = await readPublicContentPayload(response, scope);
      const newsItems = payload.items.filter((item) => item.contentType !== "page");
      setItems((current) => {
        const knownIds = new Set(current.map((item) => item.id));
        return [...current, ...newsItems.filter((item) => !knownIds.has(item.id))];
      });
      setNextCursor(payload.nextCursor);
    } catch {
      setMoreError("La suite des informations ne peut pas être chargée pour le moment.");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  const categories = publicContentFeedCategories(items);
  const filteredItems = filterPublicContentFeed(items, query, category);
  const selected = filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0];
  const selectedImage = selected?.assets.find((asset) => asset.assetKind === "image" && asset.signedUrl);
  const selectedDocuments = selected?.assets.filter((asset) => asset.assetKind === "document" && asset.signedUrl) ?? [];
  const changeScope = (nextScope: PublicContentScope) => {
    if (nextScope === scope) return;
    setQuery("");
    setCategory("all");
    setScope(nextScope);
  };

  return (
    <div className="lycee-page lycee-news-page">
      <PageIntro
        eyebrow="Vie du lycée"
        title="À la une"
        description="Les informations, événements et documents publiés par le lycée."
        onBack={onBack}
      />
      <div className="lycee-news-scope" role="group" aria-label="Période des informations">
        <button type="button" aria-pressed={scope === "current"} className={scope === "current" ? "is-active" : ""} onClick={() => changeScope("current")}>
          <Newspaper aria-hidden="true" /> En cours
        </button>
        <button type="button" aria-pressed={scope === "expired"} className={scope === "expired" ? "is-active" : ""} onClick={() => changeScope("expired")}>
          <Archive aria-hidden="true" /> Archives
        </button>
      </div>
      {loading ? <div className="lycee-loading-state"><RefreshCw aria-hidden="true" /> Chargement des informations…</div> : null}
      {error ? <div className="lycee-form-error"><CircleAlert aria-hidden="true" />{error}</div> : null}
      {!loading && !error && items.length > 0 ? (
        <section className="lycee-news-controls" aria-label="Rechercher dans les informations du lycée">
          <label>
            <Search aria-hidden="true" />
            <span className="sr-only">Rechercher</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une information" autoComplete="off" />
          </label>
          <label>
            <Filter aria-hidden="true" />
            <span className="sr-only">Filtrer par catégorie</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">Toutes les catégories</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <p aria-live="polite">{filteredItems.length} information{filteredItems.length > 1 ? "s" : ""} affichée{filteredItems.length > 1 ? "s" : ""}</p>
        </section>
      ) : null}
      {!loading && !error && !selected ? (
        <section className="lycee-news-empty">
          <Newspaper aria-hidden="true" />
          <h2>{items.length > 0 ? "Aucune information ne correspond" : scope === "expired" ? "Aucune archive disponible" : "Les prochaines informations seront publiées ici"}</h2>
          <p>{items.length > 0 ? "Modifiez votre recherche ou choisissez une autre catégorie." : scope === "expired" ? "Les publications retirées par la direction ne sont jamais affichées ici." : "Les formations et la présentation du lycée restent disponibles dans « Vie du lycée »."}</p>
          {items.length > 0 ? <button type="button" onClick={() => { setQuery(""); setCategory("all"); }}>Effacer les filtres</button> : null}
        </section>
      ) : null}
      {selected ? (
        <>
          <article className="lycee-news-feature">
            {selectedImage ? <img src={selectedImage.signedUrl ?? ""} alt={selectedImage.altText ?? ""} /> : null}
            <div>
              <span>{scope === "expired" ? "Archive · " : selected.featured ? "À retenir · " : ""}{selected.category}</span>
              <h2>{selected.title}</h2>
              <time dateTime={selected.publishedAt ?? undefined}>{publicContentDateLabel(selected.publishedAt)}</time>
              {selected.summary ? <p className="lycee-news-summary">{selected.summary}</p> : null}
              <div className="lycee-public-markdown"><PublicContentMarkdown>{selected.bodyMarkdown}</PublicContentMarkdown></div>
              {selectedDocuments.length ? <div className="lycee-news-documents">{selectedDocuments.map((asset) => <a key={asset.id} href={asset.signedUrl ?? "#"} target="_blank" rel="noreferrer"><FileText aria-hidden="true" /><span><strong>{asset.label}</strong><small>{asset.originalName}</small></span><ExternalLink aria-hidden="true" /></a>)}</div> : null}
            </div>
          </article>
          {filteredItems.length > 1 ? <section className="lycee-news-list" aria-labelledby="news-list-title"><div className="lycee-section-title"><div><span className="lycee-eyebrow">Toutes les informations</span><h2 id="news-list-title">Publié par le lycée</h2></div></div><div>{filteredItems.map((item) => { const image = item.assets.find((asset) => asset.assetKind === "image" && asset.signedUrl); return <button className={item.id === selected.id ? "is-active" : ""} type="button" key={item.id} onClick={() => { setSelectedId(item.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{image ? <img src={image.signedUrl ?? ""} alt="" /> : <span><Newspaper aria-hidden="true" /></span>}<div><small>{scope === "expired" ? "Archive · " : item.featured ? "À retenir · " : ""}{item.category}</small><strong>{item.title}</strong><time dateTime={item.publishedAt ?? undefined}>{publicContentDateLabel(item.publishedAt)}</time><p>{item.summary}</p></div><ChevronRight aria-hidden="true" /></button>; })}</div></section> : null}
        </>
      ) : null}
      {!loading && !error && nextCursor ? (
        <div className="lycee-news-load-more">
          <button type="button" onClick={loadMore} disabled={loadingMore}>
            <RefreshCw aria-hidden="true" />
            {loadingMore ? "Chargement…" : "Charger plus d’informations"}
          </button>
          {moreError ? <p role="alert">{moreError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function TrustView({ onBack }: { onBack: () => void }) {
  return (
    <div className="lycee-page lycee-trust-page">
      <PageIntro
        eyebrow="Confiance numérique"
        title="Confidentialité et sécurité"
        description="Ce que l'application utilise, ce qu'elle protège et les précautions à respecter pour suivre une demande."
        onBack={onBack}
      />

      <section className="lycee-trust-lead" aria-labelledby="trust-lead-title">
        <ShieldCheck aria-hidden="true" />
        <div>
          <span className="lycee-eyebrow">Préproduction sécurisée</span>
          <h2 id="trust-lead-title">Des informations limitées au traitement de votre demande</h2>
          <p>Cette version sert encore aux essais. Utilisez des données fictives jusqu'à la validation officielle de la direction et du délégué à la protection des données.</p>
        </div>
      </section>

      <div className="lycee-trust-grid">
        <article>
          <span><UserRound aria-hidden="true" /></span>
          <div><h2>Informations demandées</h2><p>Identité, moyen de réponse, description du besoin et, seulement si nécessaire, documents utiles au dossier.</p></div>
        </article>
        <article>
          <span><KeyRound aria-hidden="true" /></span>
          <div><h2>Secrets interdits</h2><p>Ne transmettez jamais votre mot de passe ENT, EduConnect, académique ou personnel. Un agent n'en a pas besoin pour vous aider.</p></div>
        </article>
        <article>
          <span><FileText aria-hidden="true" /></span>
          <div><h2>Documents contrôlés</h2><p>Les fichiers sont déposés dans un espace privé, mis en quarantaine puis accessibles par un lien temporaire après contrôle.</p></div>
        </article>
        <article>
          <span><BadgeCheck aria-hidden="true" /></span>
          <div><h2>Décision humaine</h2><p>L'assistant peut guider, résumer et proposer. Un agent autorisé reste responsable des réponses et des actions sensibles.</p></div>
        </article>
        <article>
          <span><Smartphone aria-hidden="true" /></span>
          <div><h2>Suivi protégé</h2><p>Le suivi reste disponible sur l'appareil. L'email est recommandé pour conserver une trace et reprendre la demande ailleurs.</p></div>
        </article>
        <article>
          <span><Clock3 aria-hidden="true" /></span>
          <div><h2>Conservation encadrée</h2><p>Les durées définitives et la procédure d'exercice des droits seront publiées après validation par la direction et le DPO.</p></div>
        </article>
      </div>

      <section className="lycee-trust-contact" aria-labelledby="trust-contact-title">
        <div>
          <Mail aria-hidden="true" />
          <span>
            <span className="lycee-eyebrow">Données personnelles</span>
            <h2 id="trust-contact-title">Délégué à la protection des données de l'académie</h2>
            <p>Pour une question sur vos droits ou l'utilisation de vos données, consultez les informations officielles de l'académie de Créteil.</p>
          </span>
        </div>
        <div className="lycee-trust-actions">
          <a href="mailto:dpd@ac-creteil.fr">Écrire au DPO <Mail aria-hidden="true" /></a>
          <a href="https://www.ac-creteil.fr/donnees-personnelles-et-cookies-121642" target="_blank" rel="noreferrer">Informations officielles <ExternalLink aria-hidden="true" /></a>
        </div>
      </section>
    </div>
  );
}

type AssistantChatMessage = {
  id: string;
  role: "assistant" | "requester";
  content: string;
  sourceReferences?: AssistantSourceReference[];
};

type AssistantSourceReference = {
  title: string;
  updatedAt: string;
};

type AssistantInsight = {
  reply: string;
  category: SupportCategory;
  requesterType: "eleve" | "parent" | "professeur" | "personnel" | "autre" | "inconnu";
  urgency: "faible" | "normale" | "urgente";
  confidence: "high" | "medium" | "low";
  missingInformation: string[];
  suggestedDocuments: string[];
  readyToCreate: boolean;
  safetyNotice: string | null;
  detectedLanguage: string | null;
  internalSummaryFr: string | null;
  usedAi: boolean;
  scope: AssistantScope;
  action: AssistantPolicyAction;
  turnCount: number;
  remainingTurns: number;
  limitReached: boolean;
  sourceReferences: AssistantSourceReference[];
};

type AssistantApiResult = AssistantInsight & {
  routingReceipt: string | null;
  routingReceiptExpiresAt: string | null;
};

function inferSupportCategory(text: string): SupportCategory {
  if (/\b(inscription|réinscription|reinscription|inscrire)\b/i.test(text)) return "inscription";
  if (/\b(ent|educonnect|connexion|connecter|identifiant|code)\b/i.test(text)) return "ent";
  if (/\b(email|mail|webmail|zimbra|académique|academique)\b/i.test(text)) return "email_academique";
  if (/\b(classe|affectation|emploi du temps|edt|prochain cours|mon cours|quelle salle|dans quelle salle|changement de salle)\b/i.test(text)) return "affectation_classe";
  if (/\b(document|pièce|piece|dossier|justificatif|manque)\b/i.test(text)) return "documents_scolarite";
  if (/\b(pc|ordinateur|portable|tablette|chargeur)\b/i.test(text)) return "ordinateur";
  if (/\b(logiciel|application|wifi|réseau|reseau)\b/i.test(text)) return "logiciel";
  if (/\b(cantine|restauration|bourse|intendance|paiement)\b/i.test(text)) return "restauration_bourse";
  if (/\b(orientation|formation|spécialité|specialite|parcoursup)\b/i.test(text)) return "orientation_formation";
  if (/\b(absence|retard|vie scolaire|cpe|surveillant)\b/i.test(text)) return "vie_scolaire";
  return "autre";
}

function localAssistantFallback(messages: AssistantChatMessage[], files: File[]): AssistantInsight {
  const policy = evaluateConversationPolicy(messages);
  const text = messages.filter((message) => message.role === "requester").map((message) => message.content).join("\n");
  const normalizedText = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const category = inferSupportCategory(text);
  const laptopIntake = policy.deterministicReply ? null : evaluateLaptopIntake(messages, files.length);
  const label = supportCategories.find((item) => item.value === category)?.label ?? "Autre demande";
  const scheduleQuestion = category === "affectation_classe" && /\b(emploi du temps|edt|prochain cours|mon cours|quelle salle|dans quelle salle|changement de salle)\b/i.test(text);
  const requesterType = /\b(parent|mere|pere)\b/.test(normalizedText)
    ? "parent"
    : /\b(prof|professeur|enseignant)\b/.test(normalizedText)
      ? "professeur"
      : /\b(eleve|lyceen|seconde|premiere|terminale|cap)\b/.test(normalizedText)
        ? "eleve"
        : /\b(personnel|agent|administration)\b/.test(normalizedText)
          ? "personnel"
          : "inconnu";
  const readyToCreate = policy.readyToCreate ?? laptopIntake?.readyToCreate ?? text.trim().length >= 35;
  const action = resolveAssistantAction({
    policyAction: laptopIntake?.action ?? policy.action,
    readyToCreate,
    scope: policy.scope,
  });
  return {
    reply: policy.deterministicReply ?? laptopIntake?.reply ?? (scheduleQuestion
      ? "Je peux rechercher votre prochain cours et sa salle, mais une classe écrite librement ne suffit pas pour ouvrir un emploi du temps réel. Le lycée doit d’abord confirmer votre identité scolaire et votre lien avec la classe ou le groupe. La version reçue le 25 août 2026 pourra ensuite être consultée avec sa date de mise à jour ; en cas de doute, la vie scolaire vérifiera avant de répondre."
      : readyToCreate
        ? `J’ai compris. Je classe votre besoin dans « ${label} ». ${files.length ? `Je vois aussi ${files.length} fichier${files.length > 1 ? "s" : ""} à joindre au dossier. ` : ""}La demande est prête : vérifiez vos coordonnées puis transmettez-la au lycée.`
        : `J’ai compris. Je classe votre besoin dans « ${label} ». ${files.length ? `Je vois aussi ${files.length} fichier${files.length > 1 ? "s" : ""} à joindre au dossier. ` : ""}Précisez ce qui bloque et ce que vous avez déjà essayé.`),
    category: policy.category ?? laptopIntake?.category ?? category,
    requesterType,
    urgency: policy.urgency ?? laptopIntake?.urgency ?? (/\b(urgent|aujourd'hui|bloqué|bloque|impossible)\b/i.test(text) ? "urgente" : "normale"),
    confidence: category === "autre" ? "low" : readyToCreate ? "high" : "medium",
    missingInformation: laptopIntake?.missingInformation ?? (scheduleQuestion
      ? ["Identité scolaire confirmée", "Classe ou groupe autorisé"]
      : ["Identité de la personne concernée", "Email ou téléphone de réponse"]),
    suggestedDocuments: laptopIntake?.suggestedDocuments ?? (files.length ? files.map((file) => file.name) : []),
    readyToCreate,
    safetyNotice: policy.safetyNotice ?? laptopIntake?.safetyNotice ?? (scheduleQuestion
      ? "Aucun emploi du temps réel n’est affiché avant la vérification de l’identité scolaire."
      : null),
    detectedLanguage: null,
    internalSummaryFr: null,
    usedAi: false,
    scope: policy.scope,
    action,
    turnCount: policy.turnCount,
    remainingTurns: policy.remainingTurns,
    limitReached: policy.limitReached,
    sourceReferences: [],
  };
}

function HelpDeskView({
  initialMessage,
  initialClassicForm,
  onBack,
  onTicketCreated,
  onTrack,
}: {
  initialMessage: string;
  initialClassicForm: boolean;
  onBack: () => void;
  onTicketCreated: (code: string) => void;
  onTrack: () => void;
}) {
  const welcomeMessage: AssistantChatMessage = {
    id: "welcome",
    role: "assistant",
    content: "Bonjour, je suis l’assistant du lycée. Écrivez simplement ce qui vous arrive, même dans votre langue. Vous pouvez joindre une photo ou un document. Ne donnez jamais votre mot de passe.",
  };
  const [chatMessages, setChatMessages] = useState<AssistantChatMessage[]>(() => [
    welcomeMessage,
    ...(initialMessage.trim()
      ? [{ id: crypto.randomUUID(), role: "requester" as const, content: initialMessage.trim() }]
      : []),
  ]);
  const [chatInput, setChatInput] = useState("");
  const [insight, setInsight] = useState<AssistantInsight | null>(null);
  const [assistantRoutingReceipt, setAssistantRoutingReceipt] = useState<string | null>(null);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [showDetails, setShowDetails] = useState(initialClassicForm);
  const [classicForm, setClassicForm] = useState(initialClassicForm);
  const [profile, setProfile] = useState<RequesterProfile>("");
  const [category, setCategory] = useState<SupportCategory>(() => inferSupportCategory(initialMessage));
  const [classicDescription, setClassicDescription] = useState(initialMessage);
  const [ticketCode, setTicketCode] = useState<string | null>(null);
  const [ticketCopyStatus, setTicketCopyStatus] = useState<"idle" | "copied" | "selected">("idle");
  const [confirmationChannel, setConfirmationChannel] = useState<"email" | "phone">("email");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attachmentWarning, setAttachmentWarning] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [formValues, setFormValues] = useState<SupportDraftFormValues>(defaultSupportFormValues);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const caseFormRef = useRef<HTMLFormElement>(null);
  const ticketCodeRef = useRef<HTMLElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const initialAnalysisStarted = useRef(false);
  const [requestKey, setRequestKey] = useState<string>(() => crypto.randomUUID());
  const [assistantSessionId] = useState(supportAssistantSessionId);
  const [draftReady, setDraftReady] = useState(false);

  const requesterMessages = chatMessages.filter((message) => message.role === "requester");
  const conversationDescription = requesterMessages.map((message) => message.content).join("\n\n").trim();
  const selectedCategory = supportCategories.find((item) => item.value === category);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, assistantBusy]);

  useEffect(() => {
    let active = true;
    if (initialMessage.trim() || initialClassicForm) {
      setDraftReady(true);
      return () => { active = false; };
    }
    void readSupportDeviceDraft<AssistantInsight>().then((draft) => {
      if (!active || !draft) return;
      setRequestKey(draft.requestKey);
      setChatMessages(draft.chatMessages.map((message) => ({ ...message, id: crypto.randomUUID() })));
      setInsight(draft.insight);
      setShowDetails(draft.showDetails);
      setClassicForm(draft.classicForm);
      setProfile(draft.profile as RequesterProfile);
      setCategory(draft.category as SupportCategory);
      setClassicDescription(draft.classicDescription);
      setFormValues(draft.formValues);
      setDraftNotice(
        draft.hadAttachments
          ? "Votre demande inachevée a été retrouvée. Pour votre sécurité, sélectionnez de nouveau les documents à joindre."
          : "Votre demande inachevée a été retrouvée sur cet appareil."
      );
    }).finally(() => {
      if (active) setDraftReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!draftReady || ticketCode || submitting) return;
    const hasDraft =
      chatMessages.some((message) => message.role === "requester") ||
      classicDescription.trim().length > 0 ||
      profile.length > 0 ||
      showDetails;
    if (!hasDraft) {
      void clearSupportDeviceDraft();
      return;
    }
    const timer = window.setTimeout(() => {
      void saveSupportDeviceDraft<AssistantInsight>({
        requestKey,
        chatMessages: chatMessages.map(({ role, content }) => ({ role, content })),
        insight,
        showDetails,
        classicForm,
        profile,
        category,
        classicDescription,
        formValues,
        hadAttachments: files.length > 0,
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    category,
    chatMessages,
    classicDescription,
    classicForm,
    draftReady,
    files.length,
    formValues,
    insight,
    profile,
    requestKey,
    showDetails,
    submitting,
    ticketCode,
  ]);

  useEffect(() => {
    if (!initialMessage.trim() || initialAnalysisStarted.current) return;
    initialAnalysisStarted.current = true;
    void askAssistant(chatMessages);
  }, []);

  useEffect(() => {
    if (!initialClassicForm) return;
    window.requestAnimationFrame(() => caseFormRef.current?.scrollIntoView({ block: "start" }));
  }, []);

  async function askAssistant(nextMessages: AssistantChatMessage[]) {
    setAssistantBusy(true);
    setSubmitError(null);
    let result: AssistantInsight = localAssistantFallback(nextMessages, files);
    let routingReceipt: string | null = null;
    if (AI_ASSISTANT_ENABLED) {
      try {
        const apiResult = await apiFetch<unknown>("support/assistant", {
          method: "POST",
          headers: { "X-Support-Device": assistantSessionId },
          body: JSON.stringify({
            sessionId: assistantSessionId,
            messages: nextMessages.slice(-21).map(({ role, content }) => ({ role, content })),
            attachments: files.map((file) => ({ name: file.name, type: file.type, size: file.size })),
          }),
        });
        if (!isAssistantApiResult(apiResult)) {
          throw new Error("La réponse de l'assistant est invalide.");
        }
        const { routingReceipt: signedReceipt, routingReceiptExpiresAt: _expiresAt, ...assistantResult } = apiResult;
        result = assistantResult;
        routingReceipt = signedReceipt;
      } catch {
        result = localAssistantFallback(nextMessages, files);
      }
    }
    setAssistantRoutingReceipt(routingReceipt);
    setInsight(result);
    setCategory(result.category);
    if (result.requesterType !== "inconnu" && !profile) setProfile(result.requesterType);
    setChatMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.reply,
        sourceReferences: result.sourceReferences,
      },
    ]);
    setAssistantBusy(false);
  }

  function sendChatMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = chatInput.trim();
    if (!content || assistantBusy || insight?.limitReached) return;
    const nextMessages = [
      ...chatMessages,
      { id: crypto.randomUUID(), role: "requester" as const, content },
    ];
    setChatMessages(nextMessages);
    setChatInput("");
    void askAssistant(nextMessages);
  }

  const conversationStopped = insight?.limitReached === true;
  const canCreateRequest =
    insight?.action === "human_transfer" ||
    (insight?.action === "offer_case" && insight.readyToCreate === true);

  function restartConversation() {
    setChatMessages([welcomeMessage]);
    setChatInput("");
    setInsight(null);
    setAssistantRoutingReceipt(null);
    setShowDetails(false);
    setClassicForm(false);
    setProfile("");
    setCategory("autre");
    setClassicDescription("");
    setFiles([]);
    setSubmitError(null);
    setAttachmentWarning(null);
    setDraftNotice(null);
    setFormValues(defaultSupportFormValues());
    setRequestKey(crypto.randomUUID());
    void clearSupportDeviceDraft();
  }

  function updateFormValue<K extends keyof SupportDraftFormValues>(
    field: K,
    value: SupportDraftFormValues[K]
  ) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  function selectFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const invalid = selected.find(
      (file) => !SUPPORT_FILE_TYPES.includes(file.type) || file.size > MAX_SUPPORT_FILE_BYTES
    );
    if (invalid) {
      setSubmitError("Formats acceptés : PDF, image, texte, Word ou Excel, jusqu’à 10 Mo.");
      event.target.value = "";
      return;
    }
    const next = [...files, ...selected].slice(0, MAX_SUPPORT_FILES);
    setFiles(next);
    setSubmitError(
      files.length + selected.length > MAX_SUPPORT_FILES
        ? "Vous pouvez joindre au maximum 5 fichiers."
        : null
    );
    event.target.value = "";
  }

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const description = (classicForm ? classicDescription : conversationDescription).trim();
    if (!profile || !description) {
      setSubmitError("Indiquez votre profil et expliquez votre demande avant de continuer.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    if (!email && !phone) {
      setSubmitError("Indiquez un email ou un téléphone pour recevoir la réponse.");
      return;
    }
    let preferredChannel = String(form.get("preferredChannel") ?? "email");
    if (preferredChannel === "email" && !email) preferredChannel = "phone";
    if (preferredChannel === "phone" && !phone) preferredChannel = "email";

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (!SUPPORT_API_ENABLED) {
        throw new Error("La création de demandes n’est pas activée dans cette démonstration.");
      }
      const response = await fetch("/api/support/requests", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": requestKey,
            "X-Support-Device": assistantSessionId,
          },
          body: JSON.stringify({
            requesterType: profile,
            requesterFirstName: form.get("requesterFirstName"),
            requesterLastName: form.get("requesterLastName"),
            beneficiaryType: profile === "parent" ? "eleve" : "self",
            beneficiaryFirstName: profile === "parent" ? form.get("beneficiaryFirstName") : null,
            beneficiaryLastName: profile === "parent" ? form.get("beneficiaryLastName") : null,
            className: form.get("className"),
            subjectArea: form.get("subjectArea"),
            schoolTrack: form.get("schoolTrack"),
            category,
            subject: selectedCategory?.label ?? "Demande au lycée",
            description: summarizeSupportDescription(description),
            conversation: prepareSupportSubmissionConversation(
              chatMessages.map(({ role, content }) => ({ role, content })),
              description
            ),
            email,
            phone,
            preferredChannel,
            fallbackAllowed: form.get("fallbackAllowed") === "on",
            languagePreference: form.get("languagePreference"),
            communicationSupport: form.get("communicationSupport") === "on",
            detectedLanguage: !classicForm && insight?.usedAi ? insight.detectedLanguage : null,
            internalSummaryFr: !classicForm && insight?.usedAi ? insight.internalSummaryFr : null,
            assistantRoutingReceipt: !classicForm ? assistantRoutingReceipt : null,
            website: form.get("website"),
          }),
        });
      const payload = await readApiResponse<unknown>(response);
      if (!isSupportRequestCreationPayload(payload)) {
        throw new Error("La demande n’a pas pu être confirmée après son enregistrement");
      }
      const publicCode = payload.request.publicCode;
      const persistedCreatedAt = payload.request.createdAt;

      if (files.length > 0) {
        const uploads = await Promise.allSettled(files.map((file) => uploadSupportFile(publicCode, file)));
        const failedCount = uploads.filter((result) => result.status === "rejected").length;
        if (failedCount > 0) {
          setAttachmentWarning(`La demande est enregistrée, mais ${failedCount} fichier${failedCount > 1 ? "s" : ""} n’a pas été joint. Vous pourrez le renvoyer depuis le suivi.`);
        }
      }
      setConfirmationChannel(preferredChannel === "phone" ? "phone" : "email");
      setTicketCode(publicCode);
      void Promise.all([
        clearSupportDeviceDraft(),
        rememberSupportRequests([{
          publicCode,
          subject: selectedCategory?.label ?? "Demande au lycée",
          category,
          status: "nouveau",
          priority: "p3",
          createdAt: persistedCreatedAt,
          updatedAt: persistedCreatedAt,
        }]),
      ]);
      onTicketCreated(publicCode);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyTicketCode() {
    if (!ticketCode) return;
    let copied = false;
    try {
      await navigator.clipboard.writeText(ticketCode);
      copied = true;
    } catch {
      const field = document.createElement("textarea");
      field.value = ticketCode;
      field.readOnly = true;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      copied = document.execCommand("copy");
      field.remove();
    }
    let selected = false;
    if (!copied && ticketCodeRef.current) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(ticketCodeRef.current);
      selection?.removeAllRanges();
      selection?.addRange(range);
      selected = true;
    }
    setTicketCopyStatus(copied ? "copied" : selected ? "selected" : "idle");
    if (copied || selected) window.setTimeout(() => setTicketCopyStatus("idle"), 3000);
  }

  if (ticketCode) {
    return (
      <div className="lycee-page lycee-confirmation-view">
        <div className="lycee-confirmation-mark"><CheckCircle2 aria-hidden="true" /></div>
        <span className="lycee-eyebrow">Demande transmise</span>
        <h1>Votre dossier est créé.</h1>
        <p>La conversation et les documents sont réunis. Un agent du lycée peut maintenant vous répondre sans vous faire recommencer.</p>
        <div className="lycee-ticket-code"><span>Numéro de demande</span><div><strong ref={ticketCodeRef}>{ticketCode}</strong><button type="button" onClick={() => void copyTicketCode()} aria-label={`Copier le numéro ${ticketCode}`}><Copy aria-hidden="true" /> {ticketCopyStatus === "copied" ? "Copié" : ticketCopyStatus === "selected" ? "Sélectionné" : "Copier"}</button></div></div>
        <div className="lycee-confirmation-note"><Smartphone aria-hidden="true" /><span>Le suivi reste disponible sur cet appareil avec votre numéro de demande.</span></div>
        {confirmationChannel === "email"
          ? <div className="lycee-confirmation-note"><Mail aria-hidden="true" /><span>Un lien sécurisé est envoyé par email pour retrouver le dossier depuis un autre appareil et conserver les réponses.</span></div>
          : <div className="lycee-confirmation-note"><Phone aria-hidden="true" /><span>Le lycée utilisera le téléphone indiqué pour vous répondre. Conservez aussi le numéro de demande.</span></div>}
        <div className="lycee-confirmation-note"><BadgeCheck aria-hidden="true" /><span>Pour une demande sensible, le lycée vérifie votre identité avant de transmettre un code ou une donnée personnelle.</span></div>
        {attachmentWarning ? <div className="lycee-form-error" role="alert"><CircleAlert aria-hidden="true" />{attachmentWarning}</div> : null}
        <div className="lycee-confirmation-actions">
          <button className="lycee-primary-action" type="button" onClick={onTrack}>Suivre et continuer <ChevronRight aria-hidden="true" /></button>
          <button className="lycee-secondary-action" type="button" onClick={onBack}>Retour à l’accueil</button>
        </div>
      </div>
    );
  }

  return (
    <div className="lycee-page">
      <PageIntro
        eyebrow="Assistant du lycée"
        title="Dites simplement ce qu’il vous faut"
        description="Écrivez avec vos mots, dans la langue qui vous convient. Vous pourrez enregistrer la demande et suivre la réponse."
        onBack={onBack}
      />

      <div className="lycee-guided-chat">
        <div className="lycee-guided-chat-head"><span><Bot aria-hidden="true" /></span><div><strong>Assistant Blaise</strong><small>Comprend, reformule et transmet au bon agent</small></div><em><span /> Disponible</em></div>
        <div className="lycee-guided-thread" ref={threadRef} aria-live="polite">
          {chatMessages.map((message) => (
            <div data-speaker={message.role} key={message.id}>
              {message.role === "assistant" ? <span><Bot aria-hidden="true" /></span> : null}
              <div className="lycee-chat-message-body">
                <p>{message.content}</p>
                {message.sourceReferences?.length ? (
                  <div className="lycee-agent-sources" aria-label="Sources utilisées">
                    <BookOpenCheck aria-hidden="true" />
                    <span>
                      {message.sourceReferences.map((source) => (
                        <small key={`${source.title}-${source.updatedAt}`}>
                          <strong>{source.title}</strong>
                          Mis à jour le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(source.updatedAt))}
                        </small>
                      ))}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {assistantBusy ? <div data-speaker="assistant" className="is-thinking"><span><Bot aria-hidden="true" /></span><p><i /><i /><i /><b>J’analyse votre demande…</b></p></div> : null}
        </div>

        <div className="lycee-chat-workspace">
          <div className="lycee-language-help"><Languages aria-hidden="true" /><span><strong>Le français est difficile ?</strong><small>Écrivez dans votre langue ou avec des mots simples. L’assistant vous aide sans vous juger.</small></span></div>
          {draftNotice ? <div className="lycee-contact-guidance lycee-draft-guidance" role="status"><CheckCircle2 aria-hidden="true" /><span><strong>Brouillon récupéré</strong><small>{draftNotice}</small></span><button type="button" onClick={restartConversation}><Trash2 aria-hidden="true" /> Effacer</button></div> : null}
          {insight ? (
            <div className="lycee-live-analysis">
              <WandSparkles aria-hidden="true" />
              <span><strong>{selectedCategory?.label}</strong><small>{insight.urgency === "urgente" ? "Blocage ou échéance proche signalé" : "Demande comprise"}</small></span>
              {insight.suggestedDocuments.length > 0 ? <em>{insight.suggestedDocuments.length} {insight.suggestedDocuments.length > 1 ? "pièces suggérées" : "pièce suggérée"}</em> : null}
            </div>
          ) : null}

          {!conversationStopped ? (
            <form className="lycee-chat-composer" onSubmit={sendChatMessage}>
              <textarea id="lycee-chat-message" name="chatMessage" value={chatInput} onChange={(event) => setChatInput(event.target.value)} rows={2} maxLength={1500} placeholder="Écrivez comme si vous parliez à l’accueil du lycée…" aria-label="Votre message" />
              <input id="lycee-support-files" name="supportFiles" aria-label="Documents à joindre" ref={fileInputRef} className="lycee-file-input" type="file" multiple accept={SUPPORT_FILE_TYPES.join(",")} onChange={selectFiles} />
              <button className="lycee-chat-attach" type="button" aria-label="Joindre un document" title="Joindre un document" disabled={files.length >= MAX_SUPPORT_FILES} onClick={() => fileInputRef.current?.click()}><Paperclip aria-hidden="true" /></button>
              <button className="lycee-chat-send" type="submit" aria-label="Envoyer le message" title="Envoyer" disabled={!chatInput.trim() || assistantBusy}><Send aria-hidden="true" /></button>
            </form>
          ) : null}

          {files.length > 0 && !classicForm ? (
            <div className="lycee-selected-files lycee-chat-files" aria-label="Fichiers à envoyer">
              {files.map((file, index) => (
                <div key={`${file.name}-${file.lastModified}`}><FileText aria-hidden="true" /><span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} Mo</small></span><button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>Retirer</button></div>
              ))}
            </div>
          ) : null}

          {requesterMessages.length > 0 && !showDetails ? (
            <div className={`lycee-chat-next${canCreateRequest ? " is-ready" : " is-form-only"}`}>
              {canCreateRequest ? <div className="lycee-case-ready"><CheckCircle2 aria-hidden="true" /><span><strong>{insight?.action === "human_transfer" ? "Un adulte doit reprendre la demande" : "Votre demande est prête"}</strong><small>La conversation et les documents seront réunis dans le même dossier.</small></span></div> : null}
              <div className="lycee-chat-next-actions">
                {canCreateRequest ? <button className="lycee-primary-action" type="button" onClick={() => setShowDetails(true)}>{insight?.action === "human_transfer" ? "Préparer la demande urgente" : "Vérifier et envoyer"} <ChevronRight aria-hidden="true" /></button> : null}
                <button type="button" onClick={() => { setClassicDescription((current) => current.trim() ? current : conversationDescription); setClassicForm(true); setShowDetails(true); }}>Je préfère remplir le formulaire</button>
              </div>
            </div>
          ) : null}

          {conversationStopped && !canCreateRequest ? (
            <div className="lycee-chat-next">
              <button className="lycee-primary-action" type="button" onClick={restartConversation}>Commencer une demande du lycée</button>
            </div>
          ) : null}

          {showDetails ? (
            <form ref={caseFormRef} className="lycee-case-form" onSubmit={submitRequest}>
              <div className="lycee-case-form-head"><span><ShieldCheck aria-hidden="true" /></span><div><h2>{classicForm ? "Formulaire classique" : "Une dernière étape"}</h2><p>{classicForm ? "Tous les champs sont visibles pour ceux qui préfèrent écrire leur demande directement." : "Vos coordonnées permettent au lycée de vous répondre et de retrouver la bonne personne."}</p></div><button type="button" aria-label="Fermer" onClick={() => { setShowDetails(false); setClassicForm(false); }}>Fermer</button></div>
              <div className="lycee-fields-grid">
                <label><span>Vous êtes</span><select id="lycee-requester-profile" name="requesterProfile" value={profile} onChange={(event) => setProfile(event.target.value as RequesterProfile)} required><option value="">Sélectionner</option><option value="eleve">Élève</option><option value="parent">Parent</option><option value="professeur">Professeur</option><option value="personnel">Personnel</option><option value="autre">Autre</option></select></label>
                {classicForm ? <label><span>Votre demande concerne</span><select id="lycee-support-category" name="supportCategory" value={category} onChange={(event) => setCategory(event.target.value as SupportCategory)}>{supportCategories.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label> : null}
                <label><span>Votre prénom</span><input name="requesterFirstName" type="text" autoComplete="given-name" placeholder="Prénom" value={formValues.requesterFirstName} onChange={(event) => updateFormValue("requesterFirstName", event.target.value)} required /></label>
                <label><span>Votre nom</span><input name="requesterLastName" type="text" autoComplete="family-name" placeholder="Nom" value={formValues.requesterLastName} onChange={(event) => updateFormValue("requesterLastName", event.target.value)} required /></label>
                {profile === "parent" ? <><label><span>Prénom de l’élève</span><input name="beneficiaryFirstName" type="text" autoComplete="off" value={formValues.beneficiaryFirstName} onChange={(event) => updateFormValue("beneficiaryFirstName", event.target.value)} required /></label><label><span>Nom de l’élève</span><input name="beneficiaryLastName" type="text" autoComplete="off" value={formValues.beneficiaryLastName} onChange={(event) => updateFormValue("beneficiaryLastName", event.target.value)} required /></label></> : null}
                {profile === "eleve" || profile === "parent" ? <label><span>Classe, si connue</span><input name="className" type="text" autoComplete="off" placeholder="Ex. 2GT4" value={formValues.className} onChange={(event) => updateFormValue("className", event.target.value)} /></label> : null}
                {profile === "professeur" || profile === "personnel" ? <label><span>Matière ou service</span><input name="subjectArea" type="text" autoComplete="organization-title" placeholder="Ex. Mathématiques, intendance" value={formValues.subjectArea} onChange={(event) => updateFormValue("subjectArea", event.target.value)} /></label> : null}
                {profile === "professeur" ? <label><span>Voie</span><select name="schoolTrack" value={formValues.schoolTrack} onChange={(event) => updateFormValue("schoolTrack", event.target.value)}><option value="">Non précisée</option><option value="general">Générale et technologique</option><option value="professionnel">Professionnelle</option><option value="les_deux">Les deux</option></select></label> : null}
                <div className="lycee-contact-requirement is-wide"><strong>Comment le lycée peut-il vous répondre ?</strong><span>Indiquez au moins une adresse email ou un numéro de téléphone.</span></div>
                <label><span>Adresse email recommandée</span><input name="email" type="email" autoComplete="email" placeholder="nom@exemple.fr" value={formValues.email} onChange={(event) => updateFormValue("email", event.target.value)} /><small>Pour garder une trace et retrouver la demande sur un autre appareil.</small></label>
                <label><span>Téléphone</span><input name="phone" type="tel" autoComplete="tel" placeholder="06 00 00 00 00" value={formValues.phone} onChange={(event) => updateFormValue("phone", event.target.value)} /><small>Pour un rappel si l’email ne suffit pas.</small></label>
                <label><span>Moyen de contact principal</span><select name="preferredChannel" value={formValues.preferredChannel} onChange={(event) => updateFormValue("preferredChannel", event.target.value as "email" | "phone")}><option value="email">Email, recommandé</option><option value="phone">Téléphone</option></select></label>
                <label><span>Langue de la réponse du lycée</span><select name="languagePreference" value={formValues.languagePreference} onChange={(event) => updateFormValue("languagePreference", event.target.value)}><option value="francais_simple">Français simple</option><option value="francais">Français</option><option value="arabe">Arabe</option><option value="anglais">Anglais</option><option value="espagnol">Espagnol</option><option value="portugais">Portugais</option><option value="turc">Turc</option><option value="autre">Autre langue, précisée dans le message</option></select></label>
                <label className="lycee-fallback-choice"><input name="fallbackAllowed" type="checkbox" checked={formValues.fallbackAllowed} onChange={(event) => updateFormValue("fallbackAllowed", event.target.checked)} /><span>Utiliser l’autre moyen de contact si nécessaire</span></label>
                <label className="lycee-fallback-choice"><input name="communicationSupport" type="checkbox" checked={formValues.communicationSupport} onChange={(event) => updateFormValue("communicationSupport", event.target.checked)} /><span>J’ai besoin d’un rappel pour mieux comprendre la réponse</span></label>
                {classicForm ? <label className="is-wide"><span>Votre demande</span><textarea id="lycee-classic-description" name="classicDescription" value={classicDescription} onChange={(event) => setClassicDescription(event.target.value)} rows={5} maxLength={5000} placeholder="Expliquez ce dont vous avez besoin." required /></label> : null}
                {classicForm ? <div className="lycee-classic-files is-wide"><button type="button" onClick={() => fileInputRef.current?.click()} disabled={files.length >= MAX_SUPPORT_FILES}><Paperclip aria-hidden="true" /> Joindre un document</button><small>PDF, image, Word ou Excel, jusqu’à 10 Mo.</small>{files.map((file, index) => <div key={`${file.name}-${file.lastModified}`}><FileText aria-hidden="true" /><span>{file.name}</span><button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>Retirer</button></div>)}</div> : null}
                <label className="lycee-honeypot" aria-hidden="true"><span>Site web</span><input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
              </div>
              <div className="lycee-contact-guidance"><Smartphone aria-hidden="true" /><span><strong>Deux moyens pour ne pas perdre la demande</strong><small>Le suivi sur cet appareil est toujours actif. L’email ajoute une copie durable et un accès depuis un autre téléphone ou ordinateur.</small></span></div>
              <div className="lycee-ai-summary"><WandSparkles aria-hidden="true" /><span><strong>{selectedCategory?.label}</strong><small>Conversation et pièces jointes conservées dans le même dossier</small></span></div>
              <div className="lycee-case-security"><BadgeCheck aria-hidden="true" /><span><strong>Vérification adaptée à la demande</strong><small>Le lien reçu par email vérifie votre adresse. Pour un code ENT ou une messagerie académique, un agent confirme aussi votre identité dans la liste officielle du lycée.</small></span></div>
              {submitError ? <div className="lycee-form-error" role="alert"><CircleAlert aria-hidden="true" />{submitError}</div> : null}
              <button className="lycee-primary-action lycee-submit-request" type="submit" disabled={submitting || (!classicForm && !conversationDescription)}>{submitting ? "Enregistrement…" : "Envoyer au lycée"} <Send aria-hidden="true" /></button>
            </form>
          ) : submitError ? <div className="lycee-form-error" role="alert"><CircleAlert aria-hidden="true" />{submitError}</div> : null}
        </div>
      </div>
    </div>
  );
}

type SupportRequestSummary = {
  publicCode: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  identityStatus?: IdentityStatus;
  createdAt: string;
  updatedAt: string;
  rememberedOnly?: boolean;
};

type SupportRequestDetail = {
  request: SupportRequestSummary & {
    requesterType: string;
    beneficiaryType: string;
    preferredChannel: string;
    subjectContext: Record<string, string>;
    identityStatus: IdentityStatus;
    identityMethod: string | null;
    identityVerifiedAt: string | null;
    resolvedAt: string | null;
  };
  messages: Array<{
    id: string;
    direction: string;
    channel: string;
    authorLabel: string | null;
    bodyText: string;
    deliveryStatus: string;
    createdAt: string;
  }>;
  attachments: Array<{
    id: string;
    messageId: string | null;
    direction: "requester" | "agent";
    documentType: string;
    originalName: string;
    detectedMime: string | null;
    sizeBytes: number;
    scanStatus: string;
    createdAt: string;
  }>;
};

const supportStatusLabels: Record<string, string> = {
  nouveau: "Nouvelle demande",
  a_qualifier: "À classer",
  assigne: "Assignée",
  en_cours: "En cours",
  attente_demandeur: "Votre réponse attendue",
  attente_interne: "Vérification interne",
  resolu: "Résolue",
  clos: "Fermée",
  indesirable: "Classée sans suite",
};

const agentStatusLabels: Record<string, string> = {
  ...supportStatusLabels,
  attente_demandeur: "En attente usager",
  attente_interne: "À vérifier",
};

function supportDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function supportSlaLabel(value: string | null): string {
  if (!value) return "Sans échéance";
  const remainingMinutes = Math.round((new Date(value).getTime() - Date.now()) / 60000);
  if (remainingMinutes <= 0) return "Échéance dépassée";
  if (remainingMinutes < 60) return `Échéance dans ${remainingMinutes} min`;
  return `Échéance dans ${Math.ceil(remainingMinutes / 60)} h`;
}

function supportDeliveryLabel(value: string): string {
  const labels: Record<string, string> = {
    stored: "Enregistré",
    queued: "En attente d’envoi",
    sent: "Envoyé",
    delivered: "Distribué",
    deferred: "Envoi différé",
    bounced: "Adresse inaccessible",
    callback_required: "Rappel à effectuer",
  };
  return labels[value] ?? value;
}

function RequestsView({ ticketCode, onBack }: { ticketCode: string | null; onBack: () => void }) {
  if (!SUPPORT_API_ENABLED) return <DemoRequestsView ticketCode={ticketCode} onBack={onBack} />;
  return <ConnectedRequestsView ticketCode={ticketCode} onBack={onBack} />;
}

function ConnectedRequestsView({ ticketCode, onBack }: { ticketCode: string | null; onBack: () => void }) {
  const [requests, setRequests] = useState<SupportRequestSummary[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(ticketCode);
  const [detail, setDetail] = useState<SupportRequestDetail | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [forgettingDevice, setForgettingDevice] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const [followupFiles, setFollowupFiles] = useState<File[]>([]);
  const followupFileInputRef = useRef<HTMLInputElement>(null);
  const requesterReplySubmissionRef = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);
  const notificationsEnabledRef = useRef(false);
  const selectedCodeRef = useRef<string | null>(ticketCode);
  const requestsLoadIdRef = useRef(0);
  const detailLoadIdRef = useRef(0);
  const notificationSnapshotsRef = useRef(new Map<string, ActiveSupportNotificationSnapshot>());
  const detailedCodesRef = useRef(new Set<string>());

  async function showActiveNotification(notification: ActiveSupportNotification) {
    if (
      !notificationsEnabledRef.current ||
      !document.hidden ||
      !("serviceWorker" in navigator) ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(notification.title, {
        body: notification.body,
        tag: notification.tag,
        icon: "/pwa-icon-192.png",
        badge: "/pwa-icon-192.png",
        data: { destination: notification.destination },
      });
    } catch {
      // Le suivi à l'écran et l'email restent les canaux de référence.
    }
  }

  function reconcileNotificationSnapshot(next: ActiveSupportNotificationSnapshot, allowNotification: boolean) {
    const previous = notificationSnapshotsRef.current.get(next.publicCode);
    const result = reconcileActiveSupportNotification(previous, next);
    if (result.snapshot) notificationSnapshotsRef.current.set(next.publicCode, result.snapshot);
    if (allowNotification && result.notification) void showActiveNotification(result.notification);
  }

  async function loadRequests(showLoading = false) {
    const loadId = ++requestsLoadIdRef.current;
    if (showLoading) setLoading(true);
    try {
      const payload = await readApiResponse<unknown>(
        fetch("/api/support/requests", { credentials: "include" })
      );
      if (!isPublicSupportRequestListPayload(payload)) {
        throw new Error("La liste des demandes reçue est invalide.");
      }
      if (loadId !== requestsLoadIdRef.current) return;
      const receivedCodes = new Set(payload.requests.map((request) => request.publicCode));
      for (const request of payload.requests) {
        if (request.publicCode === selectedCodeRef.current) continue;
        const previous = notificationSnapshotsRef.current.get(request.publicCode);
        reconcileNotificationSnapshot({
          publicCode: request.publicCode,
          status: request.status,
          updatedAt: request.updatedAt,
          latestAgentMessageId: previous?.latestAgentMessageId ?? null,
        }, true);
      }
      for (const code of notificationSnapshotsRef.current.keys()) {
        if (!receivedCodes.has(code)) notificationSnapshotsRef.current.delete(code);
      }
      await rememberSupportRequests(payload.requests);
      const remembered = await listRememberedSupportRequests();
      if (loadId !== requestsLoadIdRef.current) return;
      const serverCodes = new Set(payload.requests.map((request) => request.publicCode));
      const merged: SupportRequestSummary[] = [
        ...payload.requests,
        ...remembered
          .filter((request) => !serverCodes.has(request.publicCode))
          .map((request) => ({ ...request, rememberedOnly: true })),
      ];
      setRequests(merged);
      setSelectedCode((current) => current ?? merged[0]?.publicCode ?? null);
      setError(null);
    } catch (requestError) {
      if (loadId !== requestsLoadIdRef.current) return;
      const remembered = await listRememberedSupportRequests();
      if (remembered.length > 0) {
        setRequests(remembered.map((request) => ({ ...request, rememberedOnly: true })));
        setSelectedCode((current) => current ?? remembered[0]?.publicCode ?? null);
      }
      if (showLoading) {
        setError(
          remembered.length > 0
            ? "Les numéros mémorisés sont affichés. Reconnectez-vous à internet ou ouvrez le lien reçu par email pour actualiser les réponses."
            : requestError instanceof Error ? requestError.message : "Impossible de charger les demandes"
        );
      }
    } finally {
      if (loadId === requestsLoadIdRef.current) setLoading(false);
    }
  }

  async function loadDetail(code: string) {
    const loadId = ++detailLoadIdRef.current;
    setDetailLoading(true);
    try {
      const payload = await readApiResponse<unknown>(
        fetch(`/api/support/requests/${code}`, { credentials: "include" })
      );
      if (!isPublicSupportRequestDetailPayload(payload) || payload.request.publicCode !== code) {
        throw new Error("Le dossier reçu est invalide.");
      }
      if (loadId !== detailLoadIdRef.current || selectedCodeRef.current !== code) return;
      const latestAgentMessage = payload.messages
        .filter((message) => message.direction === "outbound")
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
      const hadDetailedBaseline = detailedCodesRef.current.has(code);
      reconcileNotificationSnapshot({
        publicCode: payload.request.publicCode,
        status: payload.request.status,
        updatedAt: payload.request.updatedAt,
        latestAgentMessageId: latestAgentMessage?.id ?? null,
      }, hadDetailedBaseline);
      detailedCodesRef.current.add(code);
      setDetail(payload);
      setDetailError(null);
    } catch (requestError) {
      if (loadId !== detailLoadIdRef.current || selectedCodeRef.current !== code) return;
      setDetailError(requestError instanceof Error ? requestError.message : "Impossible d’actualiser la demande");
    } finally {
      if (loadId === detailLoadIdRef.current && selectedCodeRef.current === code) {
        setDetailLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadRequests(true);
    const timer = window.setInterval(() => {
      if (!document.hidden) void loadRequests();
    }, 20_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    selectedCodeRef.current = selectedCode;
    requesterReplySubmissionRef.current = null;
    detailLoadIdRef.current += 1;
    setDetail(null);
    setDetailError(null);
    if (!selectedCode) {
      setDetailLoading(false);
      return;
    }
    void loadDetail(selectedCode);
    const timer = window.setInterval(() => {
      if (!document.hidden) void loadDetail(selectedCode);
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [selectedCode]);

  async function toggleActiveNotifications() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (notificationsEnabledRef.current) {
      notificationsEnabledRef.current = false;
      setNotificationsEnabled(false);
      return;
    }
    let permission: NotificationPermission;
    try {
      permission = Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    } catch {
      setError("Les alertes ne peuvent pas être activées sur ce navigateur.");
      return;
    }
    setNotificationPermission(permission);
    if (permission !== "granted") {
      setError("Les alertes sont bloquées dans les réglages de ce navigateur.");
      return;
    }
    for (const request of requests) {
      const previous = notificationSnapshotsRef.current.get(request.publicCode);
      notificationSnapshotsRef.current.set(request.publicCode, {
        publicCode: request.publicCode,
        status: request.status,
        updatedAt: request.updatedAt,
        latestAgentMessageId: previous?.latestAgentMessageId ?? null,
      });
    }
    if (detail) {
      const latestAgentMessage = detail.messages
        .filter((message) => message.direction === "outbound")
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
      notificationSnapshotsRef.current.set(detail.request.publicCode, {
        publicCode: detail.request.publicCode,
        status: detail.request.status,
        updatedAt: detail.request.updatedAt,
        latestAgentMessageId: latestAgentMessage?.id ?? null,
      });
      detailedCodesRef.current.add(detail.request.publicCode);
    }
    notificationsEnabledRef.current = true;
    setNotificationsEnabled(true);
    setError(null);
  }

  function selectFollowupFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const invalid = selected.find(
      (file) => !SUPPORT_FILE_TYPES.includes(file.type) || file.size > MAX_SUPPORT_FILE_BYTES
    );
    if (invalid) {
      setError("Formats acceptés : PDF, image, texte, Word ou Excel, jusqu’à 10 Mo.");
      event.target.value = "";
      return;
    }
    const requesterAttachmentCount = detail?.attachments.filter(
      (attachment) => attachment.direction === "requester"
    ).length ?? 0;
    const availableSlots = Math.max(0, MAX_SUPPORT_FILES - requesterAttachmentCount);
    const next = [...followupFiles, ...selected].slice(0, availableSlots);
    setFollowupFiles(next);
    if (followupFiles.length + selected.length > availableSlots) {
      setError("Une demande peut contenir au maximum 5 fichiers.");
    } else {
      setError(null);
    }
    event.target.value = "";
  }

  async function sendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCode || !reply.trim()) return;
    const messageText = reply.trim();
    const submissionFingerprint = JSON.stringify({ publicCode: selectedCode, message: messageText });
    if (requesterReplySubmissionRef.current?.fingerprint !== submissionFingerprint) {
      requesterReplySubmissionRef.current = {
        fingerprint: submissionFingerprint,
        idempotencyKey: crypto.randomUUID(),
      };
    }
    const idempotencyKey = requesterReplySubmissionRef.current.idempotencyKey;
    setReplying(true);
    setError(null);
    try {
      let uploadWarning: string | null = null;
      const payload = await readApiResponse<unknown>(
        await fetch(`/api/support/requests/${selectedCode}/messages`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({ message: messageText }),
        })
      );
      const confirmation = isRecord(payload)
        ? verifySupportRequesterMessageConfirmation({
            expectedPublicCode: selectedCode,
            confirmation: payload.confirmation,
          })
        : null;
      if (!confirmation) {
        throw new Error("La confirmation du message reçue est invalide. Réessayez sans modifier le message.");
      }

      const persistedPayload = await readApiResponse<unknown>(
        fetch(`/api/support/requests/${selectedCode}`, { credentials: "include" })
      );
      if (!isPublicSupportRequestDetailPayload(persistedPayload) || persistedPayload.request.publicCode !== selectedCode) {
        throw new Error("Le message est peut-être enregistré, mais sa relecture a échoué. Réessayez sans modifier le message.");
      }
      const persistedMessage = persistedPayload.messages.find((message) =>
        message.id === confirmation.messageId
        && message.direction === "inbound"
        && message.createdAt === confirmation.messageCreatedAt
      );
      if (!persistedMessage) {
        throw new Error("Le message n'a pas pu être relu après son enregistrement. Réessayez sans le modifier.");
      }

      setReply("");
      requesterReplySubmissionRef.current = null;
      if (followupFiles.length > 0) {
        const uploads = await Promise.allSettled(
          followupFiles.map((file) => uploadSupportFile(selectedCode, file))
        );
        const failedCount = uploads.filter((result) => result.status === "rejected").length;
        if (failedCount > 0) {
          uploadWarning = `Votre message est enregistré, mais ${failedCount} fichier${failedCount > 1 ? "s" : ""} n’a pas été joint.`;
        }
        setFollowupFiles([]);
      }
      await Promise.all([loadDetail(selectedCode), loadRequests()]);
      if (uploadWarning) setError(uploadWarning);
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "Le message n'a pas été envoyé");
    } finally {
      setReplying(false);
    }
  }

  async function openPublicAttachment(id: string) {
    if (!selectedCode) return;
    const popup = window.open("about:blank", "_blank");
    try {
      const payload = await readApiResponse<unknown>(
        fetch(`/api/support/attachments/${id}?code=${encodeURIComponent(selectedCode)}`, {
          credentials: "include",
        })
      );
      if (!isAllowedSupportAttachmentPayload(payload)) {
        throw new Error("Lien temporaire de fichier invalide");
      }
      if (popup) {
        popup.opener = null;
        popup.location.href = payload.url;
      } else {
        window.open(payload.url, "_blank", "noopener,noreferrer");
      }
    } catch (openError) {
      popup?.close();
      setError(openError instanceof Error ? openError.message : "Fichier indisponible");
    }
  }

  async function forgetThisDevice() {
    if (!window.confirm("Retirer de cet appareil l’accès à toutes les demandes suivies ?")) return;
    setForgettingDevice(true);
    setError(null);
    try {
      const confirmation = await readApiResponse<unknown>(
        await fetch("/api/support/session", {
          method: "DELETE",
          credentials: "include",
        })
      );
      if (!isSupportSessionClearPayload(confirmation)) {
        throw new Error("La confirmation de fermeture reçue est invalide.");
      }
      await Promise.all([
        clearSupportDeviceDraft(),
        clearRememberedSupportRequests(),
      ]);
      forgetSupportAssistantDevice();
      setRequests([]);
      setSelectedCode(null);
      requesterReplySubmissionRef.current = null;
      setDetail(null);
      setDetailError(null);
      onBack();
    } catch (forgetError) {
      setError(
        forgetError instanceof Error
          ? forgetError.message
          : "Impossible de fermer l’accès sur cet appareil"
      );
    } finally {
      setForgettingDevice(false);
    }
  }

  const visibleRequests = requests.filter((request) =>
    `${request.publicCode} ${request.subject}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="lycee-page">
      <PageIntro eyebrow="Suivi" title="Mes demandes" description="Retrouvez les réponses sur cet appareil. Le lien reçu par email permet de reprendre depuis un autre téléphone ou ordinateur." onBack={onBack} />
      <div className="lycee-shared-device-action">
        <span><ShieldCheck aria-hidden="true" /><span><strong>Appareil partagé ?</strong><small>Fermez l’accès avant de le quitter.</small></span></span>
        <div className="lycee-device-action-buttons">
          {requests.length > 0 && notificationPermission !== "unsupported" ? <button type="button" aria-pressed={notificationsEnabled} disabled={notificationPermission === "denied"} onClick={() => void toggleActiveNotifications()} title="Alerte uniquement pendant cette session"><Bell aria-hidden="true" />{notificationPermission === "denied" ? "Alertes bloquées" : notificationsEnabled ? "Alertes actives" : "Activer les alertes"}</button> : null}
          <button type="button" disabled={forgettingDevice} onClick={() => void forgetThisDevice()}><LogOut aria-hidden="true" />{forgettingDevice ? "Fermeture…" : "Oublier les demandes"}</button>
        </div>
      </div>
      {error ? <div className="lycee-form-error" role="alert"><CircleAlert aria-hidden="true" />{error}</div> : null}
      {detailError && selectedCode ? <div className="lycee-form-error" role="alert"><CircleAlert aria-hidden="true" /><span>{detailError}</span><button type="button" disabled={detailLoading} onClick={() => void loadDetail(selectedCode)}>{detailLoading ? "Nouvel essai…" : "Réessayer le dossier"}</button></div> : null}
      {loading ? <div className="lycee-loading-state"><Clock3 aria-hidden="true" /> Chargement des demandes…</div> : null}
      {detailLoading && requests.length > 0 ? <div className="lycee-loading-state" role="status" aria-live="polite"><Clock3 aria-hidden="true" /> Chargement du dossier…</div> : null}
      {!loading && requests.length === 0 ? (
        <section className="lycee-empty-state"><TicketCheck aria-hidden="true" /><h2>Aucune demande sur cet appareil</h2><p>Si vous aviez déjà créé une demande ailleurs, ouvrez le lien sécurisé reçu par email.</p><button type="button" onClick={onBack}>Retour à l’accueil</button></section>
      ) : null}
      {requests.length > 0 ? (
        <div className="lycee-track-grid">
          <section className="lycee-ticket-list">
            <div className="lycee-list-toolbar">
              <label><Search aria-hidden="true" /><input id="lycee-request-search" name="requestSearch" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Rechercher une demande" placeholder="Numéro ou objet" /></label>
            </div>
            {visibleRequests.map((request) => (
              <button type="button" className={selectedCode === request.publicCode ? "is-selected" : ""} key={request.publicCode} onClick={() => setSelectedCode(request.publicCode)}>
                <span className="lycee-ticket-icon"><KeyRound aria-hidden="true" /></span>
                <span><strong>{request.subject}</strong><small>{request.publicCode} · {supportDate(request.createdAt)}</small></span>
                <em>{request.rememberedOnly ? "À actualiser" : supportStatusLabels[request.status] ?? request.status}</em>
              </button>
            ))}
          </section>
          {detail ? (
            <article className="lycee-ticket-detail">
              <div className="lycee-ticket-detail-head">
                <div><span>{detail.request.publicCode}</span><h2>{detail.request.subject}</h2></div>
                <div className="lycee-ticket-head-actions"><em>{supportStatusLabels[detail.request.status] ?? detail.request.status}</em><button className="lycee-refresh-button" type="button" onClick={() => selectedCode && void loadDetail(selectedCode)} title="Actualiser la conversation"><RefreshCw aria-hidden="true" /><span>Actualiser</span></button></div>
              </div>
              <div className="lycee-ticket-meta"><span><Users aria-hidden="true" /> {requesterProfileLabels[detail.request.requesterType] ?? detail.request.requesterType}</span><span><Smartphone aria-hidden="true" /> Suivi sur cet appareil</span><span><Mail aria-hidden="true" /> Contact principal : {channelLabels[detail.request.preferredChannel] ?? detail.request.preferredChannel}</span></div>
              <section className="lycee-identity-status" data-status={detail.request.identityStatus}>
                <BadgeCheck aria-hidden="true" />
                <span><strong>{identityStatusLabels[detail.request.identityStatus]}</strong><small>{detail.request.identityStatus === "identite_confirmee" ? "Le lycée a rapproché la personne d’une source officielle." : detail.request.identityStatus === "contact_verifie" ? detail.request.identityMethod === "phone_callback" ? "Un agent a vérifié le numéro de téléphone par rappel, sans confirmer encore l’identité scolaire." : "Le lien sécurisé confirme l’accès à l’adresse email, sans confirmer encore l’identité scolaire." : "La demande est enregistrée. Aucune donnée sensible ne sera transmise avant vérification."}</small></span>
              </section>
              <div className="lycee-conversation" role="log" aria-label="Conversation">
                {detail.messages.map((message) => (
                  <div className={message.authorLabel === "Assistant du lycée" ? "is-assistant" : message.direction === "outbound" ? "is-agent" : "is-requester"} key={message.id}>
                    <span><strong>{message.authorLabel ?? (message.direction === "outbound" ? "Lycée" : "Vous")}</strong><small>{supportDate(message.createdAt)}{message.authorLabel === "Assistant du lycée" ? " · réponse automatique" : ""}</small></span>
                    <p>{message.bodyText}</p>
                  </div>
                ))}
              </div>
              {detail.attachments.length > 0 ? (
                <div className="lycee-tracked-files">
                  {detail.attachments.map((attachment) => (
                    <div key={attachment.id}><FileText aria-hidden="true" /><span><strong>{attachment.originalName}</strong><small>{attachment.direction === "agent" ? "Document du lycée · " : "Votre document · "}{attachment.scanStatus === "clean" ? "vérifié" : attachment.scanStatus === "blocked" ? "refusé" : "contrôle en cours"}</small></span>{attachment.scanStatus === "clean" ? <button type="button" onClick={() => void openPublicAttachment(attachment.id)} aria-label={`Ouvrir ${attachment.originalName}`}><ExternalLink aria-hidden="true" /></button> : null}</div>
                  ))}
                </div>
              ) : null}
              <form className="lycee-followup-form" onSubmit={sendReply}>
                <label><span>Ajouter un message</span><textarea id="lycee-followup-message" name="followupMessage" rows={3} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Précisez votre demande ou répondez à l’agent." maxLength={5000} /></label>
                <input id="lycee-followup-files" name="followupFiles" aria-label="Documents à ajouter au suivi" ref={followupFileInputRef} className="lycee-file-input" type="file" multiple accept={SUPPORT_FILE_TYPES.join(",")} onChange={selectFollowupFiles} />
                {followupFiles.length > 0 ? <div className="lycee-selected-files lycee-followup-files">{followupFiles.map((file, index) => <div key={`${file.name}-${file.lastModified}`}><FileText aria-hidden="true" /><span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} Mo</small></span><button type="button" onClick={() => setFollowupFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>Retirer</button></div>)}</div> : null}
                <div className="lycee-followup-actions"><button className="lycee-secondary-action" type="button" disabled={(detail.attachments.filter((attachment) => attachment.direction === "requester").length + followupFiles.length) >= MAX_SUPPORT_FILES} onClick={() => followupFileInputRef.current?.click()}><Paperclip aria-hidden="true" /> Joindre</button><button className="lycee-primary-action" type="submit" disabled={replying || !reply.trim()}>{replying ? "Envoi…" : "Envoyer"}<Send aria-hidden="true" /></button></div>
              </form>
            </article>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DemoRequestsView({ ticketCode, onBack }: { ticketCode: string | null; onBack: () => void }) {
  const [demoReply, setDemoReply] = useState("");
  const [demoMessages, setDemoMessages] = useState([
    { id: "request", direction: "is-requester", author: "Vous", date: "Aujourd’hui à 09:12", body: "Je n’arrive pas à me connecter et je n’ai pas reçu les codes." },
    { id: "agent", direction: "is-agent", author: "Assistant Blaise", date: "Aujourd’hui à 09:13", body: "Votre demande est enregistrée et classée dans les accès ENT. Un agent du lycée la vérifie maintenant." },
  ]);

  function sendDemoReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = demoReply.trim();
    if (!message) return;
    setDemoMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), direction: "is-requester", author: "Vous", date: "Maintenant", body: message },
      { id: crypto.randomUUID(), direction: "is-agent", author: "Assistant Blaise", date: "Maintenant", body: "Merci, votre précision est ajoutée au dossier. L’agent qui traite la demande la verra immédiatement." },
    ]);
    setDemoReply("");
  }

  return (
    <div className="lycee-page">
      <PageIntro eyebrow="Suivi" title="Mes demandes" description="Consultez l’avancement et les réponses du lycée sans appeler plusieurs services." onBack={onBack} />
      <div className="lycee-track-grid">
        <section className="lycee-ticket-list">
          <div className="lycee-list-toolbar">
            <label><Search aria-hidden="true" /><input aria-label="Rechercher une demande" placeholder="Numéro de demande" /></label>
          </div>
          <button type="button" className="is-selected">
            <span className="lycee-ticket-icon"><KeyRound aria-hidden="true" /></span>
            <span><strong>{ticketCode ? "Accès ENT de mon enfant" : "Je n’arrive plus à accéder à l’ENT"}</strong><small>{ticketCode ?? "BC-2026-000042"} · Aujourd’hui</small></span>
            <em>En cours</em>
          </button>
        </section>
        <article className="lycee-ticket-detail">
          <div className="lycee-ticket-detail-head">
            <div><span>{ticketCode ?? "BC-2026-000042"}</span><h2>{ticketCode ? "Accès ENT de mon enfant" : "Problème de connexion ENT"}</h2></div>
            <em>En cours de traitement</em>
          </div>
          <div className="lycee-ticket-meta"><span><Users aria-hidden="true" /> Parent d’élève</span><span><Mail aria-hidden="true" /> Réponse par email</span></div>
          <div className="lycee-conversation" role="log" aria-label="Conversation de démonstration">
            {demoMessages.map((message) => (
              <div className={message.direction} key={message.id}>
                <span><strong>{message.author}</strong><small>{message.date}</small></span>
                <p>{message.body}</p>
              </div>
            ))}
          </div>
          <form className="lycee-followup-form" onSubmit={sendDemoReply}>
            <label><span>Continuer la conversation</span><textarea rows={3} value={demoReply} onChange={(event) => setDemoReply(event.target.value)} placeholder="Ajoutez une précision ou répondez à l’agent." maxLength={5000} /></label>
            <button className="lycee-primary-action" type="submit" disabled={!demoReply.trim()}>Envoyer <Send aria-hidden="true" /></button>
          </form>
        </article>
      </div>
    </div>
  );
}

function ServicesView({ onHelp, onBack }: { onHelp: () => void; onBack: () => void }) {
  const serviceGroups = [
    { title: "Assistance du lycée", description: "Une conversation libre pour toute question de rentrée, de scolarité ou d’accès", icon: LifeBuoy, color: "coral", progress: "Conversation suivie", action: "Demander de l’aide", help: true },
    { title: "Webmail du lycée", description: "Messagerie, contacts et diffusion lorsque Créteil est perturbé", icon: Mail, color: "green", progress: "Communication disponible", action: "Ouvrir le Webmail", href: WEBMAIL_URL, external: true },
    { title: "Inscriptions et dossiers", description: "Réinscription, pièces manquantes, classe et documents de scolarité", icon: FolderCheck, color: "gold", progress: "Priorité rentrée", action: "Préparer une demande", help: true },
    { title: "Accès ENT et EduConnect", description: "Connexion directe ou demande d’aide pour retrouver son accès", icon: KeyRound, color: "blue", progress: "Service de rentrée", action: "Accéder à l’ENT", href: ENT_URL, external: true },
    { title: "PRONOTE via l’ENT", description: "Notes, emploi du temps et vie scolaire selon les services activés par le lycée", icon: GraduationCap, color: "green", progress: "Accès officiel du lycée", action: "Ouvrir l’ENT", href: ENT_URL, external: true },
    { title: "Scolarité Services", description: "Bourses, inscriptions et démarches proposées aux familles", icon: FileText, color: "coral", progress: "Service national", action: "Comprendre et accéder", href: SCOLARITE_SERVICES_URL, external: true },
    { title: "LyceeGest", description: "Stages, Grand Oral et outils de gestion du lycée", icon: BarChart3, color: "blue", progress: "Application complète", action: "Ouvrir LyceeGest", href: LYCEEGEST_URL },
    { title: "Stages de seconde", description: "Convention, entreprise, livret et suivi du stage", icon: BriefcaseBusiness, color: "gold", progress: "Module LyceeGest", action: "Ouvrir Stages", href: "/stages" },
    { title: "Grand Oral", description: "Questions, validations des professeurs et fiche officielle", icon: Mic2, color: "green", progress: "Module LyceeGest", action: "Ouvrir Grand Oral", href: "/grand-oral" },
  ];
  return (
    <div className="lycee-page">
      <PageIntro eyebrow="Application lycée" title="Mes services" description="Les outils déjà présents dans Gest et les nouveaux services du lycée, réunis au même endroit." onBack={onBack} />
      <div className="lycee-services-catalog">
        {serviceGroups.map((service) => (
          <article data-tone={service.color} key={service.title}>
            <span className="lycee-catalog-icon"><service.icon aria-hidden="true" /></span>
            <div><h2>{service.title}</h2><p>{service.description}</p><small>{service.progress}</small></div>
            {service.help ? <button type="button" onClick={onHelp}>{service.action}<ChevronRight aria-hidden="true" /></button> : <a href={service.href} target={service.external ? "_blank" : undefined} rel={service.external ? "noreferrer" : undefined}>{service.action}{service.external ? <ExternalLink aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}</a>}
          </article>
        ))}
      </div>
      <section className="lycee-mail-bridge">
        <div><Headphones aria-hidden="true" /><span><span className="lycee-eyebrow">Besoin d’aide</span><h2>Une seule conversation jusqu’à la réponse</h2><p>Expliquez le problème, ajoutez vos documents et suivez le traitement sans recommencer.</p></span></div>
        <button type="button" onClick={onHelp}>Parler à l’assistant <MessageCircleMore aria-hidden="true" /></button>
      </section>
    </div>
  );
}

function SchoolView({ onBack, onHelp }: { onBack: () => void; onHelp: (prompt?: string) => void }) {
  const [publishedPages, setPublishedPages] = useState<PublicContent[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/content/public", { signal: controller.signal })
      .then(readPublicContentPayload)
      .then((payload) => setPublishedPages(payload.items.filter((item) => item.contentType === "page")))
      .catch((reason) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) setPublishedPages([]);
      });
    return () => controller.abort();
  }, []);

  const publishedPage = (slug: string) => publishedPages.find((item) => item.slug === slug);
  const pageHref = (slug: string, fallback: string) => publishedPage(slug) ? `/site/${slug}` : fallback;
  const links = [
    { label: "Monlycée.net", href: ENT_URL, icon: GraduationCap },
    { label: "EduConnect", href: "https://educonnect.education.gouv.fr/", icon: KeyRound },
    { label: "Parcoursup", href: "https://parcoursup.gouv.fr", icon: FileText },
    { label: "E-sidoc", href: "https://0932048w.esidoc.fr/", icon: Newspaper },
  ];
  const formations = [
    {
      title: "Voie générale",
      icon: BookOpenCheck,
      description: "Seconde générale et technologique, première et terminale générales.",
      items: "HGGSP, HLP, LLCE, Mathématiques, NSI, Physique-Chimie, SVT et SES",
    },
    {
      title: "Voie technologique",
      icon: GraduationCap,
      description: "Des parcours scientifiques et tertiaires jusqu’au baccalauréat.",
      items: "STL Sciences physiques et chimiques en laboratoire, STMG gestion-finance, mercatique ou RH-communication",
    },
    {
      title: "Voie professionnelle",
      icon: Settings2,
      description: "Des formations concrètes dans l’énergie, les procédés et la maintenance.",
      items: "2de MTNE, 2de MPMIA, Bac pro MELEC et Bac pro PCEPC",
    },
    {
      title: "CAP",
      icon: BriefcaseBusiness,
      description: "Une formation professionnalisante proposée au lycée.",
      items: "CAP Agent de la qualité de l’eau",
    },
  ];
  const detailedPrograms = [
    {
      family: "Voie technologique",
      title: "STMG",
      name: "Sciences et technologies du management et de la gestion",
      description: "Un parcours pour comprendre le fonctionnement des organisations, le management, le droit, l’économie et les sciences de gestion.",
      path: "Après une seconde générale et technologique · première et terminale STMG",
    },
    {
      family: "Voie technologique",
      title: "STL",
      name: "Sciences et technologies de laboratoire",
      description: "Une formation scientifique fondée sur l’expérimentation, les mesures et les sciences physiques et chimiques en laboratoire.",
      path: "Après une seconde générale et technologique · spécialité SPCL",
    },
    {
      family: "Voie professionnelle",
      title: "MELEC",
      name: "Métiers de l’électricité et de ses environnements connectés",
      description: "Préparer, réaliser et maintenir des installations électriques et des équipements communicants dans des environnements variés.",
      path: "Seconde famille MTNE · baccalauréat professionnel en trois ans",
    },
    {
      family: "Voie professionnelle",
      title: "PCEPC",
      name: "Procédés de la chimie, de l’eau et des papiers-cartons",
      description: "Piloter et surveiller des procédés industriels, contrôler la qualité et intervenir dans les domaines de la chimie et de l’eau.",
      path: "Seconde famille MPMIA · baccalauréat professionnel en trois ans",
    },
    {
      family: "Certificat d’aptitude professionnelle",
      title: "CAP AQE",
      name: "Agent de la qualité de l’eau",
      description: "Participer au traitement, au contrôle et à la distribution de l’eau, avec une formation pratique tournée vers les installations.",
      path: "Formation professionnalisante · périodes de formation en entreprise",
    },
  ];
  const schoolLife = [
    {
      title: "CDI et ressources documentaires",
      description: "Rechercher des documents, préparer un travail et accéder au portail documentaire du lycée.",
      detail: "Les horaires 2026-2027 seront publiés après validation du CDI.",
      action: "Ouvrir E-sidoc",
      href: "https://0932048w.esidoc.fr/",
      icon: BookOpenCheck,
    },
    {
      title: "Association sportive et UNSS",
      description: "Découvrir les activités sportives et les modalités d’inscription proposées aux élèves.",
      detail: "Activités, horaires et autorisation parentale en cours de validation pour l’année.",
      action: "Poser une question",
      prompt: "Je souhaite des informations à jour sur l’UNSS et les activités sportives du lycée.",
      icon: UsersRound,
    },
    {
      title: "Mini-stages de découverte",
      description: "Découvrir une formation technologique, professionnelle ou le CAP avant de faire son choix.",
      detail: "Les dates et le formulaire seront publiés après confirmation des équipes responsables.",
      action: "Demander une information",
      prompt: "Je souhaite des informations sur les mini-stages de découverte du lycée.",
      icon: BriefcaseBusiness,
    },
  ];

  function scrollToSchoolSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="lycee-page">
      <PageIntro eyebrow="Lycée polyvalent" title="Blaise Cendrars, Sevran" description="Découvrez les spécialités, les voies de formation et les accès utiles de l'établissement." onBack={onBack} />
      <section className="lycee-school-feature">
        <img src="/blaise-cendrars-portrait.webp" alt="Portrait de Blaise Cendrars" />
        <div><span className="lycee-eyebrow">Une identité, plusieurs parcours</span><h2>Un lycée ouvert sur les sciences, les humanités et les métiers</h2><p>À Sevran, les voies générale, technologique et professionnelle se rencontrent dans un même établissement.</p><button type="button" onClick={() => document.getElementById("specialites")?.scrollIntoView({ behavior: "smooth" })}>Voir les spécialités <ChevronRight aria-hidden="true" /></button></div>
      </section>
      <div className="lycee-school-stats"><div><strong>Polyvalent</strong><span>général, techno et pro</span></div><div><strong>8</strong><span>spécialités générales</span></div><div><strong>15</strong><span>formations référencées</span></div><div><strong>Euro</strong><span>section européenne anglais</span></div></div>
      <nav className="lycee-school-nav" aria-label="Rubriques du lycée">
        <button type="button" onClick={() => scrollToSchoolSection("specialites")}>Spécialités</button>
        <button type="button" onClick={() => scrollToSchoolSection("formations-detaillees")}>Formations</button>
        <button type="button" onClick={() => scrollToSchoolSection("vie-lycee")}>Vie du lycée</button>
        <button type="button" onClick={() => scrollToSchoolSection("infos-pratiques")}>Infos pratiques</button>
      </nav>
      <section className="lycee-specialties" id="specialites" aria-labelledby="specialites-title">
        <div className="lycee-section-title">
          <div><span className="lycee-eyebrow">Première et terminale générales</span><h2 id="specialites-title">Les spécialités proposées</h2></div>
          <a href={pageHref("specialites", "https://lycee-blaise-cendrars-sevran.fr/specialites/")} target={publishedPage("specialites") ? undefined : "_blank"} rel={publishedPage("specialites") ? undefined : "noreferrer"}>Informations détaillées {publishedPage("specialites") ? <ChevronRight aria-hidden="true" /> : <ExternalLink aria-hidden="true" />}</a>
        </div>
        <p className="lycee-specialties-intro">En première, chaque élève choisit trois spécialités puis en conserve deux en terminale. Le choix se construit selon ses goûts, ses points forts et son projet d'études.</p>
        <div className="lycee-specialties-grid">
          {specialties.map((specialty) => (
            <article key={specialty.acronym}>
              <div className="lycee-specialty-image">
                <img src={specialty.image} alt={`Univers de la spécialité ${specialty.title}`} loading="lazy" />
                <span>{specialty.acronym}</span>
              </div>
              <div>
                <h3>{specialty.title}</h3>
                <p>{specialty.summary}</p>
                <small>{specialty.focus}</small>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="lycee-formations" aria-labelledby="formations-title">
        <div className="lycee-section-title"><div><span className="lycee-eyebrow">Choisir son parcours</span><h2 id="formations-title">Les formations du lycée</h2></div><a href={pageHref("formations", "https://lycee-blaise-cendrars-sevran.fr/formations/")} target={publishedPage("formations") ? undefined : "_blank"} rel={publishedPage("formations") ? undefined : "noreferrer"}>Toutes les informations {publishedPage("formations") ? <ChevronRight aria-hidden="true" /> : <ExternalLink aria-hidden="true" />}</a></div>
        <div>{formations.map((formation) => <article key={formation.title}><span><formation.icon aria-hidden="true" /></span><div><h3>{formation.title}</h3><p>{formation.description}</p><small>{formation.items}</small></div></article>)}</div>
      </section>
      {publishedPages.length ? (
        <section className="lycee-published-pages" aria-labelledby="published-pages-title">
          <div className="lycee-section-title"><div><span className="lycee-eyebrow">Pages vérifiées</span><h2 id="published-pages-title">Toutes les informations du lycée</h2></div></div>
          <div className="lycee-published-pages-grid">
            {publishedPages.map((page) => (
              <a href={`/site/${page.slug}`} key={page.id}>
                <span><FileText aria-hidden="true" /></span>
                <div><small>{page.category}</small><strong>{page.title}</strong><p>{page.summary}</p></div>
                <ChevronRight aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>
      ) : null}
      <section className="lycee-programs" id="formations-detaillees" aria-labelledby="programs-title">
        <div className="lycee-section-title"><div><span className="lycee-eyebrow">Technologique, professionnel et CAP</span><h2 id="programs-title">Les parcours en détail</h2></div></div>
        <p className="lycee-specialties-intro">Des formations qui associent enseignements généraux, projets, expérimentation et découverte progressive des métiers.</p>
        <div className="lycee-programs-grid">
          {detailedPrograms.map((program) => (
            <article key={program.title}>
              <span>{program.title}</span>
              <small>{program.family}</small>
              <h3>{program.name}</h3>
              <p>{program.description}</p>
              <strong>{program.path}</strong>
            </article>
          ))}
        </div>
      </section>
      <section className="lycee-school-life" id="vie-lycee" aria-labelledby="school-life-title">
        <div className="lycee-section-title"><div><span className="lycee-eyebrow">Au quotidien</span><h2 id="school-life-title">Vie du lycée</h2></div></div>
        <div className="lycee-school-life-grid">
          {schoolLife.map((item) => (
            <article key={item.title}>
              <span><item.icon aria-hidden="true" /></span>
              <div><h3>{item.title}</h3><p>{item.description}</p><small>{item.detail}</small></div>
              {item.href ? <a href={item.href} target="_blank" rel="noreferrer">{item.action}<ExternalLink aria-hidden="true" /></a> : <button type="button" onClick={() => onHelp(item.prompt)}>{item.action}<ChevronRight aria-hidden="true" /></button>}
            </article>
          ))}
        </div>
      </section>
      <section className="lycee-practical" id="infos-pratiques" aria-labelledby="practical-title">
        <div className="lycee-section-title"><div><span className="lycee-eyebrow">Venir et contacter</span><h2 id="practical-title">Informations pratiques</h2></div></div>
        <div className="lycee-practical-grid">
          <a href="https://maps.app.goo.gl/qoEq5cf4UwTm5diC7" target="_blank" rel="noreferrer"><MapPin aria-hidden="true" /><span><strong>12 avenue Léon Jouhaux</strong><small>93270 Sevran · ouvrir l’itinéraire</small></span><ExternalLink aria-hidden="true" /></a>
          <a href="tel:+33149362050"><Phone aria-hidden="true" /><span><strong>01 49 36 20 50</strong><small>Accueil du lycée</small></span><ChevronRight aria-hidden="true" /></a>
          <a href="mailto:ce.0932048w@ac-creteil.fr"><Mail aria-hidden="true" /><span><strong>ce.0932048w@ac-creteil.fr</strong><small>Adresse académique officielle</small></span><ChevronRight aria-hidden="true" /></a>
          <div><GraduationCap aria-hidden="true" /><span><strong>RER B · Sevran-Livry</strong><small>Bus 618 · arrêt Collège Georges Brassens</small></span></div>
        </div>
        <div className="lycee-publication-note"><BadgeCheck aria-hidden="true" /><span><strong>Informations contrôlées avant publication</strong><small>Les dates, horaires et documents annuels seront ajoutés uniquement après validation du service responsable.</small></span></div>
      </section>
      <section className="lycee-quick-links"><div className="lycee-section-title"><div><span className="lycee-eyebrow">Liens utiles</span><h2>Accès rapides</h2></div></div><div>{links.map((link) => <a href={link.href} target="_blank" rel="noreferrer" key={link.label}><link.icon aria-hidden="true" /><span>{link.label}</span><ExternalLink aria-hidden="true" /></a>)}</div></section>
    </div>
  );
}

const agentRequests = [
  { id: "BC-2026-000042", name: "Nadia Benali", role: "Parent", subject: "Codes ENT non reçus", category: "Accès ENT", priority: "Normal", age: "Il y a 8 min" },
  { id: "BC-2026-000041", name: "M. Laurent", role: "Professeur", subject: "Email académique bloqué", category: "Email", priority: "Urgent", age: "Il y a 14 min" },
  { id: "BC-2026-000040", name: "Yanis K.", role: "Élève · 2GT4", subject: "Ordinateur ne démarre plus", category: "PC portable", priority: "Normal", age: "Il y a 31 min" },
  { id: "BC-2026-000039", name: "Sarah M.", role: "Élève · TSTMG2", subject: "Question Grand Oral", category: "Grand Oral", priority: "Normal", age: "Il y a 1 h" },
];

type AgentRequestCore = {
  publicCode: string;
  requesterType: string;
  requesterFirstName: string;
  requesterLastName: string;
  beneficiaryType: string;
  beneficiaryFirstName: string | null;
  beneficiaryLastName: string | null;
  subjectContext: Record<string, string>;
  category: string;
  subject: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  assignedTeam: string | null;
  slaDueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AgentQueueRequest = AgentRequestCore & {
  callbackPending: boolean;
  duplicatePending: boolean;
};

type AgentRequest = AgentRequestCore & {
  description: string;
  identityStatus: IdentityStatus;
  identityMethod: string | null;
  identityVerifiedAt: string | null;
};

type AgentRequestDetail = {
  request: AgentRequest;
  contacts: Array<{ id: string; channel: string; value: string; isPrimary: boolean; isVerified: boolean }>;
  messages: Array<{ id: string; direction: string; authorLabel: string | null; bodyText: string; deliveryStatus: string; createdAt: string }>;
  attachments: Array<{
    id: string;
    messageId: string | null;
    direction: "requester" | "agent";
    originalName: string;
    scanStatus: string;
    sizeBytes: number;
    releasedAt: string | null;
    createdAt: string;
    canAttachToReply: boolean;
    canRemoveDraft: boolean;
  }>;
  callbacks: Array<{
    id: string;
    phoneContactId: string;
    dueAt: string | null;
    status: "todo" | "in_progress" | "done" | "cancelled";
    outcome: string | null;
    completedAt: string | null;
    createdAt: string;
    assigned: boolean;
    assignedToCurrentAgent: boolean;
  }>;
  duplicateReview: {
    status: "pending" | "confirmed" | "dismissed";
    reason: string;
    decidedAt: string | null;
    candidatePublicCode: string | null;
  } | null;
  routingReview: {
    status: "pending" | "confirmed" | "corrected";
    usedAi: boolean;
    initialCategory: string;
    initialService: string;
    createdAt: string;
    reviewedAt: string | null;
  } | null;
  access: AgentAccess;
};

type AgentQueueStats = { total: number; new: number; qualify: number; urgent: number; active: number; waitingRequester: number; waitingInternal: number; unassigned: number; overdue: number; callbacks: number; duplicates: number };
type AgentQueuePagination = { page: number; pageSize: number; total: number; totalPages: number };
type AgentServiceStats = { service: string | null; open: number; urgent: number; overdue: number; unassigned: number };
type AgentAccess = {
  role: string;
  label: string;
  serviceCodes: string[];
  canViewAll: boolean;
  canRoute: boolean;
  canManageTemplates: boolean;
};

type AgentTranslationDraft = {
  sourceMessage: string;
  translatedText: string;
  backTranslationFr: string;
  warnings: string[];
  targetLanguage: string;
  receipt: string;
  expiresAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value >= 1;
}

function isBoundedString(value: unknown, maxLength: number, allowEmpty = false): value is string {
  return typeof value === "string"
    && value.length <= maxLength
    && (allowEmpty || value.trim().length > 0);
}

function isPublicSupportDate(value: unknown): value is string {
  return isBoundedString(value, 40) && Number.isFinite(Date.parse(value));
}

function isSupportMagicAccessPayload(value: unknown): value is { request: { publicCode: string } } {
  return isRecord(value)
    && isRecord(value.request)
    && typeof value.request.publicCode === "string"
    && /^BC-\d{4}-\d{6}$/.test(value.request.publicCode);
}

function isSupportRequestCreationPayload(value: unknown): value is {
  request: { publicCode: string; status: string; createdAt: string };
  confirmation: unknown;
  duplicate: boolean;
} {
  if (!isRecord(value) || !isRecord(value.request)) return false;
  const publicCode = value.request.publicCode;
  const createdAt = value.request.createdAt;
  if (typeof publicCode !== "string"
    || !/^BC-\d{4}-\d{6}$/.test(publicCode)
    || !Object.hasOwn(supportStatusLabels, String(value.request.status))
    || !isPublicSupportDate(createdAt)
    || typeof value.duplicate !== "boolean") return false;
  const confirmation = verifySupportRequestPersistenceConfirmation({
    expectedPublicCode: publicCode,
    confirmation: value.confirmation,
  });
  if (!confirmation) return false;
  const createdTime = Date.parse(createdAt);
  const confirmedTime = Date.parse(confirmation.confirmedAt);
  return createdTime <= confirmedTime
    && createdTime <= Date.now() + (5 * 60_000)
    && confirmedTime <= Date.now() + (5 * 60_000);
}

function isSupportAttachmentConfirmationPayload(value: unknown, expectedId: string): boolean {
  return isRecord(value)
    && isRecord(value.attachment)
    && value.attachment.id === expectedId
    && ["quarantine", "clean"].includes(String(value.attachment.scanStatus))
    && typeof value.duplicate === "boolean";
}

function isSupportSessionClearPayload(value: unknown): value is { cleared: true } {
  return isRecord(value) && value.cleared === true;
}

function isPublicSupportRequestSummary(value: unknown): value is SupportRequestSummary {
  if (!isRecord(value)) return false;
  const identityStatus = value.identityStatus;
  const rememberedOnly = value.rememberedOnly;
  return typeof value.publicCode === "string"
    && /^BC-\d{4}-\d{6}$/.test(value.publicCode)
    && isBoundedString(value.subject, 180)
    && supportCategories.some((category) => category.value === value.category)
    && Object.hasOwn(supportStatusLabels, String(value.status))
    && Object.hasOwn(priorityLabels, String(value.priority))
    && isPublicSupportDate(value.createdAt)
    && isPublicSupportDate(value.updatedAt)
    && Date.parse(value.createdAt) <= Date.parse(value.updatedAt)
    && (identityStatus === undefined || ["non_verifiee", "contact_verifie", "identite_confirmee"].includes(String(identityStatus)))
    && (rememberedOnly === undefined || typeof rememberedOnly === "boolean");
}

function isPublicSupportRequestListPayload(value: unknown): value is { requests: SupportRequestSummary[] } {
  return isRecord(value)
    && Array.isArray(value.requests)
    && value.requests.length <= 200
    && value.requests.every(isPublicSupportRequestSummary)
    && new Set(value.requests.map((request) => request.publicCode)).size === value.requests.length;
}

function isPublicSupportContext(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= 30
    && entries.every(([key, item]) => isBoundedString(key, 80) && isBoundedString(item, 700, true));
}

function isPublicSupportRequest(value: unknown): value is SupportRequestDetail["request"] {
  if (!isPublicSupportRequestSummary(value)) return false;
  const record = value as Record<string, unknown>;
  return ["eleve", "parent", "professeur", "personnel", "autre"].includes(String(record.requesterType))
    && ["self", "eleve", "professeur", "personnel", "autre"].includes(String(record.beneficiaryType))
    && ["email", "phone", "web"].includes(String(record.preferredChannel))
    && isPublicSupportContext(record.subjectContext)
    && ["non_verifiee", "contact_verifie", "identite_confirmee"].includes(String(record.identityStatus))
    && (record.identityMethod === null || isBoundedString(record.identityMethod, 80))
    && (record.identityVerifiedAt === null || isPublicSupportDate(record.identityVerifiedAt))
    && (record.resolvedAt === null || isPublicSupportDate(record.resolvedAt));
}

function isPublicSupportMessage(value: unknown): value is SupportRequestDetail["messages"][number] {
  return isRecord(value)
    && typeof value.id === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value.id)
    && ["inbound", "outbound"].includes(String(value.direction))
    && ["email", "phone", "web"].includes(String(value.channel))
    && (value.authorLabel === null || isBoundedString(value.authorLabel, 180))
    && isBoundedString(value.bodyText, 5_000)
    && isBoundedString(value.deliveryStatus, 40)
    && isPublicSupportDate(value.createdAt);
}

function isPublicSupportAttachment(value: unknown): value is SupportRequestDetail["attachments"][number] {
  return isRecord(value)
    && typeof value.id === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value.id)
    && (value.messageId === null || (typeof value.messageId === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value.messageId)))
    && ["requester", "agent"].includes(String(value.direction))
    && isBoundedString(value.documentType, 100)
    && isBoundedString(value.originalName, 255)
    && (value.detectedMime === null || isBoundedString(value.detectedMime, 150))
    && isNonNegativeInteger(value.sizeBytes) && value.sizeBytes <= MAX_SUPPORT_FILE_BYTES
    && isBoundedString(value.scanStatus, 40)
    && isPublicSupportDate(value.createdAt);
}

function isPublicSupportRequestDetailPayload(value: unknown): value is SupportRequestDetail {
  if (!isRecord(value)
    || !isPublicSupportRequest(value.request)
    || !Array.isArray(value.messages)
    || value.messages.length > 500
    || !value.messages.every(isPublicSupportMessage)
    || !Array.isArray(value.attachments)
    || value.attachments.length > MAX_SUPPORT_ATTACHMENTS_PER_REQUEST
    || !value.attachments.every(isPublicSupportAttachment)) return false;
  const messageIds = value.messages.map((message) => message.id);
  const attachmentIds = value.attachments.map((attachment) => attachment.id);
  return new Set(messageIds).size === messageIds.length
    && new Set(attachmentIds).size === attachmentIds.length;
}

function isSupportUploadReservationPayload(value: unknown): value is {
  attachment: { id: string };
  upload: { bucket: "support-quarantine"; path: string; token: string };
} {
  if (!isRecord(value) || !isRecord(value.attachment) || !isRecord(value.upload)) return false;
  const attachmentId = value.attachment.id;
  const path = value.upload.path;
  const token = value.upload.token;
  if (typeof attachmentId !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(attachmentId)) return false;
  if (value.upload.bucket !== "support-quarantine" || typeof path !== "string") return false;
  const segments = path.split("/");
  if (segments.length !== 3
    || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(segments[0])
    || segments[1] !== attachmentId
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,89}$/.test(segments[2])) return false;
  return isBoundedString(token, 4_096)
    && /^[A-Za-z0-9._~-]+$/.test(token);
}

async function uploadAgentSupportFile(publicCode: string, file: File): Promise<string> {
  const reservation = await apiFetch<unknown>(`support/agent/requests/${publicCode}/attachments`, {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    }),
  });
  if (!isSupportUploadReservationPayload(reservation)) {
    throw new Error("La réservation du fichier reçue est invalide.");
  }

  const { error: uploadError } = await supabase.storage
    .from(reservation.upload.bucket)
    .uploadToSignedUrl(reservation.upload.path, reservation.upload.token, file, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) throw new Error(`Échec de l'envoi de ${file.name}`);

  const confirmation = await apiFetch<unknown>(
    `support/agent/attachments/${reservation.attachment.id}/confirm`,
    { method: "POST", body: "{}" }
  );
  if (!isSupportAttachmentConfirmationPayload(confirmation, reservation.attachment.id)) {
    throw new Error("La confirmation du fichier reçue est invalide.");
  }
  return reservation.attachment.id;
}

function isAssistantStringList(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length <= 5
    && value.every((item) => isBoundedString(item, 180));
}

function isAssistantSourceReference(value: unknown): value is AssistantSourceReference {
  return isRecord(value)
    && isBoundedString(value.title, 200)
    && isPublicSupportDate(value.updatedAt);
}

function hasValidAssistantRoutingReceipt(value: Record<string, unknown>): boolean {
  if (value.routingReceipt === null && value.routingReceiptExpiresAt === null) return true;
  if (typeof value.routingReceipt !== "string"
    || value.routingReceipt.length < 80
    || value.routingReceipt.length > 2_048
    || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.routingReceipt)
    || !isPublicSupportDate(value.routingReceiptExpiresAt)) return false;
  const expiresAt = Date.parse(value.routingReceiptExpiresAt);
  return expiresAt >= Date.now() - 30_000
    && expiresAt <= Date.now() + (16 * 60_000);
}

function isAssistantApiResult(value: unknown): value is AssistantApiResult {
  if (!isRecord(value)) return false;
  return isBoundedString(value.reply, 1_500)
    && supportCategories.some((category) => category.value === value.category)
    && ["eleve", "parent", "professeur", "personnel", "autre", "inconnu"].includes(String(value.requesterType))
    && ["faible", "normale", "urgente"].includes(String(value.urgency))
    && ["high", "medium", "low"].includes(String(value.confidence))
    && isAssistantStringList(value.missingInformation)
    && isAssistantStringList(value.suggestedDocuments)
    && typeof value.readyToCreate === "boolean"
    && (value.safetyNotice === null || isBoundedString(value.safetyNotice, 500))
    && (value.detectedLanguage === null || isBoundedString(value.detectedLanguage, 60))
    && (value.internalSummaryFr === null || isBoundedString(value.internalSummaryFr, 700))
    && typeof value.usedAi === "boolean"
    && ["school_support", "education_help", "wellbeing", "privacy_request", "out_of_scope", "unknown"].includes(String(value.scope))
    && ["continue", "offer_case", "human_transfer", "stop"].includes(String(value.action))
    && isNonNegativeInteger(value.turnCount)
    && value.turnCount <= 10
    && isNonNegativeInteger(value.remainingTurns)
    && value.remainingTurns <= 10
    && typeof value.limitReached === "boolean"
    && Array.isArray(value.sourceReferences)
    && value.sourceReferences.length <= 20
    && value.sourceReferences.every(isAssistantSourceReference)
    && hasValidAssistantRoutingReceipt(value);
}

function isAgentRequestCore(value: unknown): value is AgentRequestCore {
  if (!isRecord(value) || !isRecord(value.subjectContext)) return false;
  const stringFields = [
    "publicCode",
    "requesterType",
    "requesterFirstName",
    "requesterLastName",
    "beneficiaryType",
    "category",
    "subject",
    "status",
    "priority",
    "createdAt",
    "updatedAt",
  ];
  return stringFields.every((field) => typeof value[field] === "string")
    && isStringOrNull(value.beneficiaryFirstName)
    && isStringOrNull(value.beneficiaryLastName)
    && isStringOrNull(value.assignedTo)
    && isStringOrNull(value.assignedTeam)
    && isStringOrNull(value.slaDueAt)
    && Object.values(value.subjectContext).every((item) => typeof item === "string");
}

function isAgentQueueRequest(value: unknown): value is AgentQueueRequest {
  if (!isAgentRequestCore(value)) return false;
  const record = value as AgentRequestCore & Record<string, unknown>;
  return typeof record.callbackPending === "boolean"
    && typeof record.duplicatePending === "boolean";
}

function isAgentQueueStats(value: unknown): value is AgentQueueStats {
  if (!isRecord(value)) return false;
  return ["total", "new", "qualify", "urgent", "active", "waitingRequester", "waitingInternal", "unassigned", "overdue", "callbacks", "duplicates"]
    .every((field) => isNonNegativeInteger(value[field]));
}

function isAgentServiceStats(value: unknown): value is AgentServiceStats {
  return isRecord(value)
    && isStringOrNull(value.service)
    && ["open", "urgent", "overdue", "unassigned"].every((field) => isNonNegativeInteger(value[field]));
}

function isAgentQueuePagination(value: unknown): value is AgentQueuePagination {
  return isRecord(value)
    && isNonNegativeInteger(value.total)
    && isPositiveInteger(value.page)
    && isPositiveInteger(value.pageSize) && value.pageSize >= 10 && value.pageSize <= 50
    && isPositiveInteger(value.totalPages);
}

function isAgentAccess(value: unknown): value is AgentAccess {
  return isRecord(value)
    && typeof value.role === "string"
    && typeof value.label === "string"
    && Array.isArray(value.serviceCodes)
    && value.serviceCodes.every((service) => typeof service === "string")
    && typeof value.canViewAll === "boolean"
    && typeof value.canRoute === "boolean"
    && typeof value.canManageTemplates === "boolean";
}

function isAgentRequest(value: unknown): value is AgentRequest {
  if (!isAgentRequestCore(value)) return false;
  const record = value as AgentRequestCore & Record<string, unknown>;
  return typeof record.description === "string"
    && ["non_verifiee", "contact_verifie", "identite_confirmee"].includes(String(record.identityStatus))
    && isStringOrNull(record.identityMethod)
    && isStringOrNull(record.identityVerifiedAt);
}

function isAgentContact(value: unknown): value is AgentRequestDetail["contacts"][number] {
  return isRecord(value)
    && ["id", "channel", "value"].every((field) => typeof value[field] === "string")
    && typeof value.isPrimary === "boolean"
    && typeof value.isVerified === "boolean";
}

function isAgentMessage(value: unknown): value is AgentRequestDetail["messages"][number] {
  return isRecord(value)
    && ["id", "direction", "bodyText", "deliveryStatus", "createdAt"].every((field) => typeof value[field] === "string")
    && isStringOrNull(value.authorLabel);
}

function isAgentAttachment(value: unknown): value is AgentRequestDetail["attachments"][number] {
  return isRecord(value)
    && ["id", "originalName", "scanStatus", "createdAt"].every((field) => typeof value[field] === "string")
    && isStringOrNull(value.messageId)
    && ["requester", "agent"].includes(String(value.direction))
    && isStringOrNull(value.releasedAt)
    && typeof value.canAttachToReply === "boolean"
    && typeof value.canRemoveDraft === "boolean"
    && isNonNegativeInteger(value.sizeBytes);
}

function isAgentCallback(value: unknown): value is AgentRequestDetail["callbacks"][number] {
  return isRecord(value)
    && ["id", "phoneContactId", "createdAt"].every((field) => typeof value[field] === "string")
    && isStringOrNull(value.dueAt)
    && ["todo", "in_progress", "done", "cancelled"].includes(String(value.status))
    && isStringOrNull(value.outcome)
    && isStringOrNull(value.completedAt)
    && typeof value.assigned === "boolean"
    && typeof value.assignedToCurrentAgent === "boolean";
}

function isAgentDuplicateReview(value: unknown): value is AgentRequestDetail["duplicateReview"] {
  return value === null || (
    isRecord(value)
    && ["pending", "confirmed", "dismissed"].includes(String(value.status))
    && typeof value.reason === "string"
    && isStringOrNull(value.decidedAt)
    && isStringOrNull(value.candidatePublicCode)
  );
}

function isAgentRoutingReview(value: unknown): value is AgentRequestDetail["routingReview"] {
  return value === null || (
    isRecord(value)
    && ["pending", "confirmed", "corrected"].includes(String(value.status))
    && typeof value.usedAi === "boolean"
    && ["initialCategory", "initialService", "createdAt"].every((field) => typeof value[field] === "string")
    && isStringOrNull(value.reviewedAt)
  );
}

function isAgentQueuePayload(value: unknown): value is {
  requests: AgentQueueRequest[];
  stats: AgentQueueStats;
  serviceStats: AgentServiceStats[];
  pagination: AgentQueuePagination;
  access: AgentAccess;
} {
  return isRecord(value)
    && Array.isArray(value.requests)
    && value.requests.every(isAgentQueueRequest)
    && isAgentQueueStats(value.stats)
    && Array.isArray(value.serviceStats)
    && value.serviceStats.every(isAgentServiceStats)
    && isAgentQueuePagination(value.pagination)
    && isAgentAccess(value.access);
}

function isAgentRequestDetail(value: unknown): value is AgentRequestDetail {
  return isRecord(value)
    && isAgentRequest(value.request)
    && Array.isArray(value.contacts)
    && value.contacts.every(isAgentContact)
    && Array.isArray(value.messages)
    && value.messages.every(isAgentMessage)
    && Array.isArray(value.attachments)
    && value.attachments.every(isAgentAttachment)
    && Array.isArray(value.callbacks)
    && value.callbacks.every(isAgentCallback)
    && isAgentDuplicateReview(value.duplicateReview)
    && isAgentRoutingReview(value.routingReview)
    && isAgentAccess(value.access);
}

async function fetchAgentRequestDetail(code: string): Promise<AgentRequestDetail> {
  const payload = await apiFetch<unknown>(`support/agent/requests/${code}`);
  if (!isAgentRequestDetail(payload)) {
    throw new Error("Réponse invalide du détail de la demande");
  }
  return payload;
}

function isAgentTranslationPayload(value: unknown): value is {
  translation: Omit<AgentTranslationDraft, "sourceMessage">;
} {
  if (!isRecord(value) || !isRecord(value.translation)) return false;
  const translation = value.translation;
  return typeof translation.translatedText === "string"
    && typeof translation.backTranslationFr === "string"
    && Array.isArray(translation.warnings)
    && translation.warnings.every((warning) => typeof warning === "string")
    && typeof translation.targetLanguage === "string"
    && typeof translation.receipt === "string"
    && typeof translation.expiresAt === "string";
}

function isSupportReplyTemplate(value: unknown): value is SupportReplyTemplate {
  if (!isRecord(value)) return false;
  const allowedVariables = ["prenom", "numero", "objet"];
  return typeof value.id === "string" && value.id.length > 0 && value.id.length <= 200
    && typeof value.category === "string" && value.category.length > 0 && value.category.length <= 60
    && typeof value.name === "string" && value.name.length > 0 && value.name.length <= 80
    && typeof value.bodyText === "string" && value.bodyText.length > 0 && value.bodyText.length <= 5_000
    && Array.isArray(value.allowedVariables)
    && value.allowedVariables.length <= allowedVariables.length
    && value.allowedVariables.every((item) => typeof item === "string" && allowedVariables.includes(item))
    && new Set(value.allowedVariables).size === value.allowedVariables.length
    && (value.builtIn === undefined || typeof value.builtIn === "boolean");
}

function isSupportTemplateListPayload(value: unknown): value is { templates: SupportReplyTemplate[] } {
  return isRecord(value)
    && Array.isArray(value.templates)
    && value.templates.every(isSupportReplyTemplate);
}

function isSupportTemplateCreatePayload(value: unknown): value is { template: SupportReplyTemplate } {
  return isRecord(value) && isSupportReplyTemplate(value.template);
}

function isAllowedSupportAttachmentPayload(value: unknown): value is { url: string; expiresIn: number } {
  if (!isRecord(value) || typeof value.url !== "string" || !isPositiveInteger(value.expiresIn) || value.expiresIn > 300) {
    return false;
  }
  const configuredUrl = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
  if (typeof configuredUrl !== "string" || !configuredUrl) return false;
  try {
    const target = new URL(value.url);
    const configured = new URL(configuredUrl);
    return target.protocol === "https:"
      && configured.protocol === "https:"
      && target.origin === configured.origin
      && target.pathname.startsWith("/storage/v1/object/sign/")
      && !target.username
      && !target.password
      && target.hash === "";
  } catch {
    return false;
  }
}

function AgentView({ onBack }: { onBack: () => void }) {
  if (!SUPPORT_API_ENABLED) return <DemoAgentView onBack={onBack} />;
  return <ConnectedAgentView onBack={onBack} />;
}

function ConnectedAgentView({ onBack }: { onBack: () => void }) {
  const [requests, setRequests] = useState<AgentQueueRequest[]>([]);
  const [stats, setStats] = useState<AgentQueueStats>({ total: 0, new: 0, qualify: 0, urgent: 0, active: 0, waitingRequester: 0, waitingInternal: 0, unassigned: 0, overdue: 0, callbacks: 0, duplicates: 0 });
  const [serviceStats, setServiceStats] = useState<AgentServiceStats[]>([]);
  const [pagination, setPagination] = useState<AgentQueuePagination>({ page: 1, pageSize: 30, total: 0, totalPages: 1 });
  const [access, setAccess] = useState<AgentAccess | null>(null);
  const [queueMode, setQueueMode] = useState<"all" | "qualify" | "urgent" | "overdue" | "waiting" | "internal" | "unassigned" | "callbacks" | "duplicates" | "mine">("all");
  const [serviceFilter, setServiceFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentRequestDetail | null>(null);
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [translationDraft, setTranslationDraft] = useState<AgentTranslationDraft | null>(null);
  const [translationValidated, setTranslationValidated] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [agentUploading, setAgentUploading] = useState(false);
  const [agentDeletingAttachmentId, setAgentDeletingAttachmentId] = useState<string | null>(null);
  const [selectedAgentAttachmentIds, setSelectedAgentAttachmentIds] = useState<string[]>([]);
  const [internalNote, setInternalNote] = useState("");
  const [callbackOutcome, setCallbackOutcome] = useState("");
  const [closureReason, setClosureReason] = useState("");
  const [templates, setTemplates] = useState<SupportReplyTemplate[]>(DEFAULT_SUPPORT_REPLY_TEMPLATES);
  const [templateName, setTemplateName] = useState("");
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queueLoadError, setQueueLoadError] = useState<string | null>(null);
  const [detailLoadError, setDetailLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const queueLoadIdRef = useRef(0);
  const detailLoadIdRef = useRef(0);
  const selectedCodeRef = useRef<string | null>(null);
  const agentFileInputRef = useRef<HTMLInputElement>(null);
  const replySubmissionRef = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);
  const internalNoteSubmissionRef = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);
  const callbackCreateSubmissionRef = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);
  const callbackActionSubmissionRef = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);
  const attachmentRemovalSubmissionRef = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);

  async function loadQueue() {
    const loadId = ++queueLoadIdRef.current;
    setQueueLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "30" });
      if (query.trim()) params.set("q", query.trim());
      if (queueMode === "urgent") params.set("urgent", "true");
      if (queueMode === "overdue") params.set("overdue", "true");
      if (queueMode === "qualify") params.set("status", "a_qualifier");
      if (queueMode === "waiting") params.set("status", "attente_demandeur");
      if (queueMode === "internal") params.set("status", "attente_interne");
      if (queueMode === "mine") params.set("assigned", "me");
      if (queueMode === "unassigned") params.set("assigned", "none");
      if (queueMode === "callbacks") params.set("callback", "pending");
      if (queueMode === "duplicates") params.set("duplicate", "pending");
      if (serviceFilter) params.set("service", serviceFilter);
      const payload = await apiFetch<unknown>(`support/agent/requests?${params}`);
      if (!isAgentQueuePayload(payload)) {
        throw new Error("Réponse invalide du service de demandes");
      }
      if (loadId !== queueLoadIdRef.current) return;
      setRequests(payload.requests);
      setStats(payload.stats);
      setServiceStats(payload.serviceStats);
      setPagination(payload.pagination);
      setAccess(payload.access);
      if (
        serviceFilter &&
        !payload.access.canViewAll &&
        !payload.access.serviceCodes.includes(serviceFilter)
      ) {
        setServiceFilter("");
      }
      const currentCode = selectedCodeRef.current;
      const nextCode = payload.requests.some((request) => request.publicCode === currentCode)
        ? currentCode
        : payload.requests[0]?.publicCode ?? null;
      selectedCodeRef.current = nextCode;
      setSelectedCode(nextCode);
      if (!nextCode) setDetail(null);
      setQueueLoadError(null);
    } catch (loadError) {
      if (loadId !== queueLoadIdRef.current) return;
      setQueueLoadError(loadError instanceof Error ? loadError.message : "Impossible de charger les demandes");
    } finally {
      if (loadId === queueLoadIdRef.current) setQueueLoading(false);
    }
  }

  function resetQueueFilters() {
    setQuery("");
    setQueueMode("all");
    setServiceFilter("");
    setPage(1);
  }

  async function loadDetail(code: string) {
    const loadId = ++detailLoadIdRef.current;
    setDetail(null);
    setDetailLoading(true);
    setDetailLoadError(null);
    setError(null);
    setReply("");
    replySubmissionRef.current = null;
    internalNoteSubmissionRef.current = null;
    callbackCreateSubmissionRef.current = null;
    callbackActionSubmissionRef.current = null;
    attachmentRemovalSubmissionRef.current = null;
    setTranslationDraft(null);
    setTranslationValidated(false);
    setSelectedAgentAttachmentIds([]);
    setInternalNote("");
    setCallbackOutcome("");
    setClosureReason("");
    try {
      const payload = await fetchAgentRequestDetail(code);
      if (loadId !== detailLoadIdRef.current || selectedCodeRef.current !== code) return;
      setDetail(payload);
      setDetailLoadError(null);
    } catch (loadError) {
      if (loadId !== detailLoadIdRef.current || selectedCodeRef.current !== code) return;
      setDetailLoadError(loadError instanceof Error ? loadError.message : "Impossible de charger le dossier");
    } finally {
      if (loadId === detailLoadIdRef.current && selectedCodeRef.current === code) {
        setDetailLoading(false);
      }
    }
  }

  useEffect(() => {
    let active = true;
    void supabase.auth.refreshSession().finally(() => {
      if (active) setSessionReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    const timer = window.setTimeout(() => void loadQueue(), 250);
    return () => window.clearTimeout(timer);
  }, [page, query, queueMode, serviceFilter, sessionReady]);
  useEffect(() => {
    selectedCodeRef.current = selectedCode;
    if (!selectedCode) {
      detailLoadIdRef.current += 1;
      setDetail(null);
      setDetailLoading(false);
      setDetailLoadError(null);
      return;
    }
    void loadDetail(selectedCode);
  }, [selectedCode]);

  function changeReply(value: string) {
    setReply(value);
    setTranslationDraft(null);
    setTranslationValidated(false);
  }

  function clearTranslation() {
    setTranslationDraft(null);
    setTranslationValidated(false);
  }

  async function prepareTranslation() {
    const request = detail?.request;
    const code = selectedCode;
    const sourceMessage = request && ["ent", "email_academique"].includes(request.category)
      && request.identityStatus !== "identite_confirmee"
      ? SUPPORT_IDENTITY_VERIFICATION_MESSAGE
      : reply.trim();
    if (!request || !code || !sourceMessage) return;
    setTranslating(true);
    try {
      const payload = await apiFetch<unknown>(`support/agent/requests/${code}/translate`, {
        method: "POST",
        body: JSON.stringify({ sourceMessage }),
      });
      if (!isAgentTranslationPayload(payload)) {
        throw new Error("La proposition de traduction est incomplète");
      }
      if (selectedCodeRef.current !== code) return;
      setTranslationDraft({ ...payload.translation, sourceMessage });
      setTranslationValidated(false);
      setError(null);
    } catch (translationError) {
      setError(translationError instanceof Error ? translationError.message : "Traduction indisponible");
    } finally {
      setTranslating(false);
    }
  }

  useEffect(() => {
    apiFetch<unknown>("support/agent/templates")
      .then((payload) => {
        if (!isSupportTemplateListPayload(payload)) {
          throw new Error("Réponse invalide du service de modèles");
        }
        setTemplates(payload.templates);
      })
      .catch(() => setTemplates(DEFAULT_SUPPORT_REPLY_TEMPLATES));
  }, []);

  async function updateRequest(changes: { status?: string; priority?: string; identityStatus?: IdentityStatus; identityMethod?: string; assignToMe?: boolean; assignedTeam?: string | null; closureReason?: string; duplicateDecision?: "confirmed" | "dismissed"; routingDecision?: "confirmed" }) {
    if (!selectedCode || !detail?.request.updatedAt) return;
    setSaving(true);
    try {
      const payload = await apiFetch<unknown>(`support/agent/requests/${selectedCode}`, {
        method: "PATCH",
        body: JSON.stringify({ ...changes, expectedUpdatedAt: detail.request.updatedAt }),
      });
      const confirmation = verifySupportRequestMutationConfirmation({
        expectedPublicCode: selectedCode,
        expectedPreviousRevision: detail.request.updatedAt,
        confirmation: payload && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).confirmation
          : null,
      });
      if (!confirmation) {
        throw new Error("La modification n'a pas été confirmée par le serveur. Actualisez le dossier.");
      }
      const refreshedDetail = await fetchAgentRequestDetail(selectedCode);
      if (refreshedDetail.request.updatedAt !== confirmation.revision) {
        throw new Error("Ce dossier a été modifié après la confirmation. Il vient d’être actualisé.");
      }
      setDetail(refreshedDetail);
      await loadQueue();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Modification impossible";
      if (/modifié|pris en charge|transféré/i.test(message)) {
        try {
          setDetail(await fetchAgentRequestDetail(selectedCode));
          await loadQueue();
        } catch {
          // Le message de conflit initial reste le plus utile pour l'agent.
        }
      }
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function sendAgentReply() {
    const request = detail?.request;
    const requiresSafeTemplate = Boolean(
      request &&
      ["ent", "email_academique"].includes(request.category) &&
      request.identityStatus !== "identite_confirmee"
    );
    const sourceMessage = requiresSafeTemplate ? SUPPORT_IDENTITY_VERIFICATION_MESSAGE : reply.trim();
    const useTranslation = Boolean(
      translationDraft
      && translationValidated
      && translationDraft.sourceMessage === sourceMessage
    );
    const outgoingMessage = useTranslation ? translationDraft!.translatedText : sourceMessage;
    if (!selectedCode || !request || !outgoingMessage) return;
    const submissionFingerprint = JSON.stringify({
      publicCode: selectedCode,
      message: outgoingMessage,
      attachmentIds: [...selectedAgentAttachmentIds].sort(),
    });
    if (replySubmissionRef.current?.fingerprint !== submissionFingerprint) {
      replySubmissionRef.current = {
        fingerprint: submissionFingerprint,
        idempotencyKey: crypto.randomUUID(),
      };
    }
    const idempotencyKey = replySubmissionRef.current.idempotencyKey;
    setSaving(true);
    try {
      const payload = await apiFetch<unknown>(`support/agent/requests/${selectedCode}/reply`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          message: outgoingMessage,
          expectedUpdatedAt: request.updatedAt,
          ...(requiresSafeTemplate ? { safeTemplate: "identity_verification" } : {}),
          ...(useTranslation && translationDraft ? {
            translation: {
              sourceMessage,
              targetLanguage: translationDraft.targetLanguage,
              receipt: translationDraft.receipt,
              validated: true,
            },
          } : {}),
          attachmentIds: selectedAgentAttachmentIds,
        }),
      });
      const confirmation = verifySupportAgentReplyConfirmation({
        expectedPublicCode: selectedCode,
        confirmation: payload && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).confirmation
          : null,
      });
      if (!confirmation) {
        throw new Error("La réponse n'a pas été confirmée par le serveur. Réessayez sans modifier le message.");
      }
      const refreshedDetail = await fetchAgentRequestDetail(selectedCode);
      const persistedMessage = refreshedDetail.messages.find((message) => (
        message.id === confirmation.messageId
        && message.direction === "outbound"
        && message.createdAt === confirmation.messageCreatedAt
      ));
      if (!persistedMessage) {
        throw new Error("La réponse confirmée n'apparaît pas encore dans le dossier. Réessayez sans modifier le message.");
      }
      setDetail(refreshedDetail);
      replySubmissionRef.current = null;
      setReply("");
      setSelectedAgentAttachmentIds([]);
      clearTranslation();
      await loadQueue();
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Réponse non enregistrée";
      if (/modifié|transféré/i.test(message) && selectedCode) {
        try {
          setDetail(await fetchAgentRequestDetail(selectedCode));
          await loadQueue();
        } catch {
          // Le message de conflit initial reste le plus utile pour l'agent.
        }
      }
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function selectAgentFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const code = selectedCode;
    const request = detail?.request;
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!code || !request || files.length === 0) return;
    const invalid = files.find(
      (file) => !SUPPORT_FILE_TYPES.includes(file.type) || file.size > MAX_SUPPORT_FILE_BYTES
    );
    if (invalid) {
      setError("Formats acceptés : PDF, image, texte, Word ou Excel, jusqu’à 10 Mo.");
      return;
    }
    const pendingCount = detail.attachments.filter(
      (attachment) => attachment.direction === "agent" && attachment.messageId === null
    ).length;
    const acceptedFiles = files.slice(0, Math.max(0, MAX_SUPPORT_FILES - pendingCount));
    if (acceptedFiles.length !== files.length || acceptedFiles.length === 0) {
      setError("Une réponse peut préparer au maximum 5 documents.");
      if (acceptedFiles.length === 0) return;
    }

    setAgentUploading(true);
    try {
      const uploadedIds: string[] = [];
      for (const file of acceptedFiles) {
        uploadedIds.push(await uploadAgentSupportFile(code, file));
      }
      let latest = await fetchAgentRequestDetail(code);
      for (let attempt = 0; attempt < 8; attempt += 1) {
        if (selectedCodeRef.current !== code) return;
        const uploaded = latest.attachments.filter((attachment) => uploadedIds.includes(attachment.id));
        if (uploaded.length === uploadedIds.length && uploaded.every((attachment) => (
          ["clean", "blocked", "scan_error"].includes(attachment.scanStatus)
        ))) break;
        await new Promise((resolve) => window.setTimeout(resolve, 1_500));
        latest = await fetchAgentRequestDetail(code);
      }
      if (selectedCodeRef.current !== code) return;
      setDetail(latest);
      const cleanIds = latest.attachments
        .filter((attachment) => uploadedIds.includes(attachment.id) && attachment.canAttachToReply)
        .map((attachment) => attachment.id);
      setSelectedAgentAttachmentIds((current) => [...new Set([...current, ...cleanIds])]);
      if (cleanIds.length !== uploadedIds.length) {
        setError("Un document est encore en contrôle ou a été refusé. Actualisez avant l’envoi.");
      } else {
        setError(null);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Le document n’a pas été préparé");
      if (selectedCodeRef.current === code) {
        try {
          setDetail(await fetchAgentRequestDetail(code));
        } catch {
          // Le message d'échec du dépôt reste prioritaire.
        }
      }
    } finally {
      setAgentUploading(false);
    }
  }

  function applyReplyTemplate(templateId: string) {
    const template = templates.find((candidate) => candidate.id === templateId);
    const request = detail?.request;
    if (!template || !request) return;
    changeReply(renderSupportReplyTemplate(template.bodyText, {
      prenom: request.requesterFirstName,
      numero: request.publicCode,
      objet: request.subject,
    }));
  }

  async function saveInternalNote() {
    if (!selectedCode || !internalNote.trim()) return;
    const code = selectedCode;
    const noteText = internalNote.trim();
    const submissionFingerprint = JSON.stringify({ publicCode: code, note: noteText });
    if (internalNoteSubmissionRef.current?.fingerprint !== submissionFingerprint) {
      internalNoteSubmissionRef.current = {
        fingerprint: submissionFingerprint,
        idempotencyKey: crypto.randomUUID(),
      };
    }
    const idempotencyKey = internalNoteSubmissionRef.current.idempotencyKey;
    setSaving(true);
    try {
      const payload = await apiFetch<unknown>(`support/agent/requests/${code}/notes`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ note: noteText }),
      });
      const confirmation = verifySupportInternalNoteConfirmation({
        expectedPublicCode: code,
        confirmation: payload && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).confirmation
          : null,
      });
      if (!confirmation) {
        throw new Error("La note n'a pas été confirmée par le serveur. Réessayez sans la modifier.");
      }
      const refreshedDetail = await fetchAgentRequestDetail(code);
      const persistedNote = refreshedDetail.messages.find((message) =>
        message.id === confirmation.messageId
        && message.direction === "internal"
        && message.createdAt === confirmation.messageCreatedAt
      );
      if (!persistedNote) {
        throw new Error("La note est peut-être enregistrée, mais sa relecture a échoué. Réessayez sans la modifier.");
      }
      if (
        selectedCodeRef.current !== code
        || internalNoteSubmissionRef.current?.fingerprint !== submissionFingerprint
        || internalNoteSubmissionRef.current.idempotencyKey !== idempotencyKey
      ) return;
      setInternalNote("");
      internalNoteSubmissionRef.current = null;
      setDetail(refreshedDetail);
      setError(null);
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : "Note interne non enregistrée");
    } finally {
      setSaving(false);
    }
  }

  async function createCallback(phoneContactId: string) {
    if (!selectedCode) return;
    const code = selectedCode;
    const submissionFingerprint = JSON.stringify({ publicCode: code, phoneContactId });
    if (callbackCreateSubmissionRef.current?.fingerprint !== submissionFingerprint) {
      callbackCreateSubmissionRef.current = {
        fingerprint: submissionFingerprint,
        idempotencyKey: crypto.randomUUID(),
      };
    }
    const idempotencyKey = callbackCreateSubmissionRef.current.idempotencyKey;
    setSaving(true);
    try {
      const payload = await apiFetch<unknown>(`support/agent/requests/${code}/callbacks`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ phoneContactId }),
      });
      const confirmation = verifySupportCallbackConfirmation({
        expectedOperation: "support_callback_create",
        expectedPublicCode: code,
        confirmation: payload && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).confirmation
          : null,
      });
      if (!confirmation) {
        throw new Error("La programmation du rappel n'a pas été confirmée. Réessayez sans changer de contact.");
      }
      const refreshedDetail = await fetchAgentRequestDetail(code);
      const persistedCallback = refreshedDetail.callbacks.find((callback) =>
        callback.id === confirmation.callbackId
        && callback.phoneContactId === phoneContactId
        && callback.status === confirmation.callbackStatus
      );
      if (!persistedCallback) {
        throw new Error("Le rappel est peut-être programmé, mais sa relecture a échoué. Réessayez sans changer de contact.");
      }
      if (
        selectedCodeRef.current !== code
        || callbackCreateSubmissionRef.current?.fingerprint !== submissionFingerprint
        || callbackCreateSubmissionRef.current.idempotencyKey !== idempotencyKey
      ) return;
      callbackCreateSubmissionRef.current = null;
      setDetail(refreshedDetail);
      setError(null);
    } catch (callbackError) {
      setError(callbackError instanceof Error ? callbackError.message : "Rappel non programmé");
    } finally {
      setSaving(false);
    }
  }

  async function updateCallback(callbackId: string, action: "claim" | "complete") {
    if (!selectedCode) return;
    const code = selectedCode;
    const outcome = action === "complete" ? callbackOutcome.trim() : "";
    const submissionFingerprint = JSON.stringify({ publicCode: code, callbackId, action, outcome });
    if (callbackActionSubmissionRef.current?.fingerprint !== submissionFingerprint) {
      callbackActionSubmissionRef.current = {
        fingerprint: submissionFingerprint,
        idempotencyKey: crypto.randomUUID(),
      };
    }
    const idempotencyKey = callbackActionSubmissionRef.current.idempotencyKey;
    setSaving(true);
    try {
      const payload = await apiFetch<unknown>(`support/agent/requests/${code}/callbacks`, {
        method: "PATCH",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          callbackId,
          action,
          ...(action === "complete" ? { outcome } : {}),
        }),
      });
      const confirmation = verifySupportCallbackConfirmation({
        expectedOperation: action === "claim" ? "support_callback_claim" : "support_callback_complete",
        expectedPublicCode: code,
        expectedCallbackId: callbackId,
        confirmation: payload && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).confirmation
          : null,
      });
      if (!confirmation) {
        throw new Error("L'action sur le rappel n'a pas été confirmée. Réessayez sans modifier le résultat.");
      }
      const refreshedDetail = await fetchAgentRequestDetail(code);
      const persistedCallback = refreshedDetail.callbacks.find((callback) =>
        callback.id === confirmation.callbackId
        && callback.status === confirmation.callbackStatus
      );
      if (!persistedCallback) {
        throw new Error("Le rappel est peut-être modifié, mais sa relecture a échoué. Actualisez le dossier.");
      }
      if (
        selectedCodeRef.current !== code
        || callbackActionSubmissionRef.current?.fingerprint !== submissionFingerprint
        || callbackActionSubmissionRef.current.idempotencyKey !== idempotencyKey
      ) return;
      if (action === "complete") setCallbackOutcome("");
      callbackActionSubmissionRef.current = null;
      setDetail(refreshedDetail);
      setError(null);
    } catch (callbackError) {
      setError(callbackError instanceof Error ? callbackError.message : "Rappel non modifié");
    } finally {
      setSaving(false);
    }
  }

  async function saveReplyTemplate() {
    const request = detail?.request;
    if (!request || !templateName.trim() || !reply.trim()) return;
    setSaving(true);
    try {
      const payload = await apiFetch<unknown>("support/agent/templates", {
        method: "POST",
        body: JSON.stringify({
          name: templateName,
          bodyText: reply,
          category: request.category,
        }),
      });
      if (!isSupportTemplateCreatePayload(payload)) {
        throw new Error("Réponse invalide du service de modèles");
      }
      setTemplates((current) => [...current, payload.template]);
      setTemplateName("");
      setShowTemplateSave(false);
      setError(null);
    } catch (templateError) {
      setError(templateError instanceof Error ? templateError.message : "Modèle non enregistré");
    } finally {
      setSaving(false);
    }
  }

  async function openAgentAttachment(id: string) {
    const popup = window.open("about:blank", "_blank");
    try {
      const payload = await apiFetch<unknown>(`support/agent/attachments/${id}`);
      if (!isAllowedSupportAttachmentPayload(payload)) {
        throw new Error("Lien temporaire de fichier invalide");
      }
      if (popup) {
        popup.opener = null;
        popup.location.href = payload.url;
      }
      else window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (openError) {
      popup?.close();
      setError(openError instanceof Error ? openError.message : "Fichier indisponible");
    }
  }

  async function removeAgentAttachment(id: string, originalName: string) {
    const code = selectedCode;
    if (!code || !window.confirm(`Retirer « ${originalName} » de cette réponse ?`)) return;
    const submissionFingerprint = `${code}:${id}`;
    if (attachmentRemovalSubmissionRef.current?.fingerprint !== submissionFingerprint) {
      attachmentRemovalSubmissionRef.current = {
        fingerprint: submissionFingerprint,
        idempotencyKey: crypto.randomUUID(),
      };
    }
    const idempotencyKey = attachmentRemovalSubmissionRef.current.idempotencyKey;
    setAgentDeletingAttachmentId(id);
    try {
      const payload = await apiFetch<unknown>(`support/agent/attachments/${id}`, {
        method: "DELETE",
        headers: { "Idempotency-Key": idempotencyKey },
      });
      const confirmation = verifySupportAttachmentRemovalConfirmation({
        expectedPublicCode: code,
        expectedAttachmentId: id,
        confirmation: isRecord(payload) ? payload.confirmation : null,
      });
      if (!confirmation) {
        throw new Error("Confirmation de retrait invalide");
      }
      const refreshedDetail = await fetchAgentRequestDetail(code);
      if (refreshedDetail.attachments.some((attachment) => attachment.id === confirmation.attachmentId)) {
        throw new Error("Le document apparaît encore dans le dossier. Réessayez le retrait.");
      }
      if (
        selectedCodeRef.current !== code
        || attachmentRemovalSubmissionRef.current?.fingerprint !== submissionFingerprint
        || attachmentRemovalSubmissionRef.current.idempotencyKey !== idempotencyKey
      ) return;
      attachmentRemovalSubmissionRef.current = null;
      setSelectedAgentAttachmentIds((current) => current.filter((attachmentId) => attachmentId !== id));
      setDetail(refreshedDetail);
      setError(null);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Document non retiré");
    } finally {
      setAgentDeletingAttachmentId(null);
    }
  }

  const selected = detail?.request;
  const requiresSafeIdentityReply = Boolean(
    selected &&
    ["ent", "email_academique"].includes(selected.category) &&
    selected.identityStatus !== "identite_confirmee"
  );
  const translationTargetLanguage = supportTranslationTargetLanguage(
    selected?.subjectContext.detectedLanguage
  );
  const replySourceMessage = requiresSafeIdentityReply
    ? SUPPORT_IDENTITY_VERIFICATION_MESSAGE
    : reply.trim();
  const translatedReplyReady = Boolean(
    translationDraft
    && translationValidated
    && translationDraft.sourceMessage === replySourceMessage
  );
  const translationNeedsDecision = Boolean(translationDraft && !translationValidated);
  const visibleTemplates = selected
    ? templates.filter((template) => template.category === "all" || template.category === selected.category)
    : templates;
  const availableTeams = access?.canViewAll
    ? supportTeams
    : supportTeams.filter((team) => access?.serviceCodes.includes(team.value));
  const hasQueueFilters = query.trim().length > 0 || queueMode !== "all" || serviceFilter !== "";
  const orderedServiceStats = [
    serviceStats.find((item) => item.service === null),
    ...supportTeams.map((team) => serviceStats.find((item) => item.service === team.value)),
  ].filter((item): item is AgentServiceStats => Boolean(item && item.open > 0));
  const phoneContact = detail?.contacts.find((contact) => contact.channel === "phone") ?? null;
  const activeCallback = detail?.callbacks.find((callback) => ["todo", "in_progress"].includes(callback.status)) ?? null;
  const lastFinishedCallback = [...(detail?.callbacks ?? [])]
    .reverse()
    .find((callback) => ["done", "cancelled"].includes(callback.status)) ?? null;
  const agentDraftAttachments = detail?.attachments.filter(
    (attachment) => attachment.direction === "agent" && attachment.messageId === null
  ) ?? [];
  const agentError = queueLoadError ?? detailLoadError ?? error;
  const needsAgentSecurity = Boolean(
    agentError && /double vérification|vérification renforcée/i.test(agentError)
  );
  const needsAgentLogin = Boolean(agentError && /authentifi|connexion requise/i.test(agentError));

  return (
    <div className="lycee-page lycee-agent-page">
      <PageIntro eyebrow="Espace agent" title="Demandes du lycée" description="Classez, répondez et gardez chaque échange dans le même dossier." onBack={onBack} />
      {agentError ? <div className="lycee-form-error" role="alert"><CircleAlert aria-hidden="true" /><span>{agentError}</span>{needsAgentSecurity ? <a href="/security?returnTo=%2Fprototype%3Fview%3Dagent">Sécuriser le compte</a> : needsAgentLogin ? <a href="/login?returnTo=%2Fprototype%3Fview%3Dagent&mode=staff">Se connecter</a> : queueLoadError ? <button type="button" disabled={queueLoading} onClick={() => void loadQueue()}>{queueLoading ? "Nouvel essai…" : "Réessayer"}</button> : detailLoadError && selectedCode ? <button type="button" disabled={detailLoading} onClick={() => void loadDetail(selectedCode)}>{detailLoading ? "Nouvel essai…" : "Réessayer le dossier"}</button> : null}</div> : null}
      {access ? <section className="lycee-agent-scope"><ShieldCheck aria-hidden="true" /><span><small>Votre périmètre</small><strong>{access.label}</strong><p>{access.canViewAll ? "Toutes les demandes et tous les transferts." : availableTeams.map((team) => team.label).join(" · ")}</p></span><b>{access.canViewAll ? "Vue complète" : "Vue limitée"}</b></section> : null}
      <div className="lycee-agent-stats">
        <div><span><Inbox aria-hidden="true" /></span><strong>{stats.qualify}</strong><small>À classer</small></div>
        <div><span><CircleAlert aria-hidden="true" /></span><strong>{stats.urgent}</strong><small>Urgentes</small></div>
        <div><span><UserRound aria-hidden="true" /></span><strong>{stats.unassigned}</strong><small>Sans responsable</small></div>
        <div><span><Clock3 aria-hidden="true" /></span><strong>{stats.overdue}</strong><small>Échéances dépassées</small></div>
      </div>
      {access?.canViewAll && orderedServiceStats.length > 0 ? <section className="lycee-service-load" aria-label="Charge par service"><div><small>Vue superadministrateur</small><strong>Charge par service</strong></div><nav aria-label="Filtrer par charge de service">{orderedServiceStats.map((item) => { const value = item.service ?? "unassigned"; return <button type="button" aria-pressed={serviceFilter === value} className={serviceFilter === value ? "is-active" : ""} onClick={() => { setServiceFilter(value); setPage(1); }} key={value}><span>{supportTeamLabel(item.service)}</span><strong>{item.open}</strong><small>{item.urgent > 0 ? `${item.urgent} urgente${item.urgent > 1 ? "s" : ""}` : "Aucune urgence"}{item.overdue > 0 ? ` · ${item.overdue} en retard` : ""}</small></button>; })}</nav></section> : null}
      <div className="lycee-agent-workspace">
        <section className="lycee-agent-queue" aria-label="File des demandes">
          <div className="lycee-agent-toolbar"><label><Search aria-hidden="true" /><input aria-label="Rechercher une demande" maxLength={80} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Nom, numéro ou objet" /></label><button className={queueMode === "mine" ? "is-active" : ""} type="button" aria-label="Afficher mes demandes" aria-pressed={queueMode === "mine"} title="Afficher mes demandes" onClick={() => { setQueueMode((current) => current === "mine" ? "all" : "mine"); setPage(1); }}><Filter aria-hidden="true" /></button><button type="button" aria-label="Réinitialiser les filtres" title="Réinitialiser les filtres" disabled={!hasQueueFilters} onClick={resetQueueFilters}><RotateCcw aria-hidden="true" /></button><select aria-label="Filtrer par service" value={serviceFilter} onChange={(event) => { setServiceFilter(event.target.value); setPage(1); }}><option value="">{access?.canViewAll ? "Tous les services" : "Mon périmètre"}</option>{access?.canViewAll ? <option value="unassigned">À orienter</option> : null}{availableTeams.map((team) => <option value={team.value} key={team.value}>{team.label}</option>)}</select></div>
          <div className="lycee-agent-tabs" aria-label="Filtrer les demandes"><button aria-pressed={queueMode === "all"} className={queueMode === "all" ? "is-active" : ""} type="button" onClick={() => { setQueueMode("all"); setPage(1); }}>Toutes <span>{stats.total}</span></button><button aria-pressed={queueMode === "qualify"} className={queueMode === "qualify" ? "is-active" : ""} type="button" onClick={() => { setQueueMode("qualify"); setPage(1); }}>À classer <span>{stats.qualify}</span></button><button aria-pressed={queueMode === "urgent"} className={queueMode === "urgent" ? "is-active" : ""} type="button" onClick={() => { setQueueMode("urgent"); setPage(1); }}>Urgentes <span>{stats.urgent}</span></button><button aria-pressed={queueMode === "overdue"} className={queueMode === "overdue" ? "is-active" : ""} type="button" onClick={() => { setQueueMode("overdue"); setPage(1); }}>En retard <span>{stats.overdue}</span></button><button aria-pressed={queueMode === "waiting"} className={queueMode === "waiting" ? "is-active" : ""} type="button" onClick={() => { setQueueMode("waiting"); setPage(1); }}>En attente <span>{stats.waitingRequester}</span></button><button aria-pressed={queueMode === "internal"} className={queueMode === "internal" ? "is-active" : ""} type="button" onClick={() => { setQueueMode("internal"); setPage(1); }}>À vérifier <span>{stats.waitingInternal}</span></button><button aria-pressed={queueMode === "unassigned"} className={queueMode === "unassigned" ? "is-active" : ""} type="button" onClick={() => { setQueueMode("unassigned"); setPage(1); }}>Sans agent <span>{stats.unassigned}</span></button><button aria-pressed={queueMode === "callbacks"} className={queueMode === "callbacks" ? "is-active" : ""} type="button" onClick={() => { setQueueMode("callbacks"); setPage(1); }}>Rappels <span>{stats.callbacks}</span></button><button aria-pressed={queueMode === "duplicates"} className={queueMode === "duplicates" ? "is-active" : ""} type="button" onClick={() => { setQueueMode("duplicates"); setPage(1); }}>Doublons <span>{stats.duplicates}</span></button></div>
          <div className="lycee-agent-list" aria-busy={queueLoading}>
            {queueLoading ? <div className="lycee-agent-list-loading" role="status" aria-live="polite"><Clock3 aria-hidden="true" /> Mise à jour…</div> : null}
            {requests.map((request) => {
              const queueState = assessSupportQueueItem(request, new Date().toISOString());
              return <button aria-pressed={selectedCode === request.publicCode} className={selectedCode === request.publicCode ? "is-selected" : ""} type="button" key={request.publicCode} onClick={() => setSelectedCode(request.publicCode)}>
                <span className="lycee-request-avatar">{`${request.requesterFirstName[0] ?? ""}${request.requesterLastName[0] ?? ""}`}</span>
                <span><strong>{request.subject}</strong><small>{request.requesterFirstName} {request.requesterLastName} · {requesterProfileLabels[request.requesterType] ?? request.requesterType}</small><em>{supportTeamLabel(request.assignedTeam)} · {supportCategoryLabel(request.category)} · {supportSlaLabel(request.slaDueAt)}</em></span>
                <span className="lycee-request-flags"><b data-kind="status">{agentStatusLabels[request.status] ?? request.status}</b>{["p1", "p2"].includes(request.priority) ? <b>Urgent</b> : null}{request.callbackPending ? <b data-kind="callback">Rappel</b> : null}{request.duplicatePending ? <b data-kind="duplicate">Doublon ?</b> : null}{queueState.unassigned ? <b data-kind="unassigned">Sans agent</b> : null}{queueState.overdue ? <b data-kind="overdue">En retard</b> : null}</span>
              </button>;
            })}
            {!queueLoading && requests.length === 0 ? <div className="lycee-agent-list-empty">Aucune demande ne correspond à ce filtre.</div> : null}
          </div>
          <div className="lycee-agent-pagination"><button type="button" aria-label="Page précédente" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ArrowLeft aria-hidden="true" /></button><span>Page {pagination.page} sur {pagination.totalPages}<small>{pagination.total} {pagination.total > 1 ? "dossiers" : "dossier"}</small></span><button type="button" aria-label="Page suivante" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}><ChevronRight aria-hidden="true" /></button></div>
        </section>
        <article className="lycee-agent-detail" aria-busy={detailLoading}>
          {detailLoading ? <div className="lycee-loading-state" role="status" aria-live="polite"><Clock3 aria-hidden="true" /> Chargement du dossier…</div> : selected && detail ? (
            <>
              <div className="lycee-agent-detail-head"><div><span>{selected.publicCode}</span><h2>{selected.subject}</h2><p>{selected.requesterFirstName} {selected.requesterLastName} · {requesterProfileLabels[selected.requesterType] ?? selected.requesterType}</p></div><div className="lycee-agent-controls"><select aria-label="Priorité" value={selected.priority} disabled={saving} onChange={(event) => void updateRequest({ priority: event.target.value })}><option value="p1">Critique</option><option value="p2">Urgente</option><option value="p3">Normale</option><option value="p4">Faible</option></select><select aria-label="Statut" value={selected.status} disabled={saving || selected.status === "clos"} onChange={(event) => void updateRequest({ status: event.target.value })}><option value="nouveau">Nouvelle demande</option><option value="a_qualifier">À classer</option><option value="assigne">Assignée</option><option value="en_cours">En cours</option><option value="attente_demandeur">En attente de l’utilisateur</option><option value="attente_interne">Vérification interne</option><option value="resolu">Résolue</option>{selected.status === "clos" ? <option value="clos">Fermée</option> : null}</select></div></div>
              <div className="lycee-agent-contact-row">{detail.contacts.map((contact) => <span className={contact.isVerified ? "is-verified" : ""} key={contact.id}>{contact.channel === "email" ? <Mail aria-hidden="true" /> : <Phone aria-hidden="true" />}{contact.value}{contact.isVerified ? " · vérifié" : ""}</span>)}<button type="button" disabled={saving || Boolean(selected.assignedTo)} onClick={() => void updateRequest({ assignToMe: true })}>{selected.assignedTo ? "Déjà attribuée" : "Prendre la demande"}</button></div>
              {phoneContact ? (
                <section className="lycee-agent-callback" data-status={activeCallback?.status ?? lastFinishedCallback?.status ?? "idle"}>
                  <Headphones aria-hidden="true" />
                  <span>
                    <small>Rappel téléphonique</small>
                    <strong>{activeCallback?.status === "todo" ? "Rappel à prendre" : activeCallback?.status === "in_progress" ? "Rappel en cours" : lastFinishedCallback?.status === "done" ? "Dernier rappel terminé" : "Aucun rappel en attente"}</strong>
                    <p>{phoneContact.value}{activeCallback?.dueAt ? ` · demandé le ${supportDate(activeCallback.dueAt)}` : ""}</p>
                    {lastFinishedCallback?.outcome && !activeCallback ? <em>{lastFinishedCallback.outcome}</em> : null}
                  </span>
                  <div>
                    {!activeCallback ? <button type="button" disabled={saving || selected.status === "clos"} onClick={() => void createCallback(phoneContact.id)}>Programmer</button> : null}
                    {activeCallback?.status === "todo" ? <button type="button" disabled={saving} onClick={() => void updateCallback(activeCallback.id, "claim")}>Prendre le rappel</button> : null}
                    {activeCallback?.status === "in_progress" && activeCallback.assignedToCurrentAgent ? <><textarea aria-label="Résultat du rappel" rows={2} maxLength={1000} value={callbackOutcome} disabled={saving} onChange={(event) => setCallbackOutcome(event.target.value)} placeholder="Résultat de l’appel…" /><button type="button" disabled={saving || callbackOutcome.trim().length < 2} onClick={() => void updateCallback(activeCallback.id, "complete")}>Terminer</button></> : null}
                    {activeCallback?.status === "in_progress" && !activeCallback.assignedToCurrentAgent ? <small>Pris en charge par un autre agent</small> : null}
                  </div>
                </section>
              ) : null}
              {detail.routingReview ? <section className="lycee-agent-routing-review" data-status={detail.routingReview.status}><WandSparkles aria-hidden="true" /><span><strong>{detail.routingReview.status === "pending" ? "Classement à confirmer" : detail.routingReview.status === "confirmed" ? "Classement confirmé" : "Classement corrigé"}</strong><small>{supportCategoryLabel(detail.routingReview.initialCategory)} · {supportTeamLabel(detail.routingReview.initialService)} · {detail.routingReview.usedAi ? "proposition IA" : "règles locales"}</small></span>{detail.routingReview.status === "pending" ? <button type="button" disabled={saving || selected.assignedTeam !== detail.routingReview.initialService} onClick={() => void updateRequest({ routingDecision: "confirmed" })}>{selected.assignedTeam === detail.routingReview.initialService ? "Confirmer" : "Transfert à enregistrer"}</button> : <small>Décision humaine enregistrée{detail.routingReview.reviewedAt ? ` le ${supportDate(detail.routingReview.reviewedAt)}` : ""}.</small>}</section> : null}
              <section className="lycee-agent-routing"><ArrowRightLeft aria-hidden="true" /><span><strong>Service responsable</strong><small>{access?.canRoute ? "Le transfert conserve tous les messages et documents. Un changement corrige le classement proposé." : "Le superadministrateur réalise les transferts entre services."}</small></span><select aria-label="Service responsable" value={selected.assignedTeam ?? ""} disabled={saving || selected.status === "clos" || !access?.canRoute} onChange={(event) => void updateRequest({ assignedTeam: event.target.value || null, status: ["nouveau", "a_qualifier"].includes(selected.status) ? "assigne" : selected.status })}><option value="">À orienter</option>{supportTeams.map((team) => <option value={team.value} key={team.value}>{team.label}</option>)}</select></section>
              <section className="lycee-agent-identity" data-sensitive={["ent", "email_academique"].includes(selected.category)}><BadgeCheck aria-hidden="true" /><span><strong>{identityStatusLabels[selected.identityStatus]}</strong><small>{["ent", "email_academique"].includes(selected.category) ? "Demande sensible : ne transmettre aucun identifiant avant rapprochement avec une liste officielle." : "Adaptez le contrôle au niveau de sensibilité de la réponse."}</small></span><select aria-label="Niveau de vérification de l’identité" value={selected.identityStatus} disabled={saving} onChange={(event) => { const identityStatus = event.target.value as IdentityStatus; const identityMethod = identityStatus === "identite_confirmee" ? "official_roster" : identityStatus === "contact_verifie" ? (detail.contacts.some((contact) => contact.channel === "email" && contact.isVerified) ? "email_magic_link" : "phone_callback") : undefined; void updateRequest({ identityStatus, identityMethod }); }}><option value="non_verifiee">Coordonnées déclarées</option><option value="contact_verifie">Contact vérifié</option><option value="identite_confirmee">Identité confirmée dans la liste</option></select></section>
              {detail.duplicateReview ? <section className="lycee-agent-duplicate" data-status={detail.duplicateReview.status}><Copy aria-hidden="true" /><span><strong>{detail.duplicateReview.status === "pending" ? "Possible doublon à vérifier" : detail.duplicateReview.status === "confirmed" ? "Doublon confirmé" : "Dossiers distincts"}</strong><small>Même contact et même catégorie sur sept jours. Aucun dossier n’est fusionné automatiquement.</small></span><div>{detail.duplicateReview.candidatePublicCode ? <button type="button" onClick={() => setSelectedCode(detail.duplicateReview?.candidatePublicCode ?? null)}>Voir {detail.duplicateReview.candidatePublicCode}</button> : null}{detail.duplicateReview.status === "pending" && detail.duplicateReview.candidatePublicCode ? <><button type="button" disabled={saving} onClick={() => void updateRequest({ duplicateDecision: "dismissed" })}>Dossiers distincts</button><button type="button" disabled={saving} onClick={() => void updateRequest({ duplicateDecision: "confirmed" })}>Confirmer</button></> : detail.duplicateReview.status === "pending" ? <small>Validation réservée à un agent autorisé à consulter les deux dossiers.</small> : <small>Décision humaine enregistrée dans l’audit.</small>}</div></section> : null}
              <div className="lycee-agent-thread">{detail.messages.map((message) => <div data-direction={message.direction} data-author={message.authorLabel === "Assistant du lycée" ? "assistant" : undefined} key={message.id}><span><strong>{message.direction === "internal" ? "Note interne" : message.authorLabel ?? "Utilisateur"}</strong><small>{supportDate(message.createdAt)}{message.direction === "internal" ? " · invisible pour l’utilisateur" : message.authorLabel === "Assistant du lycée" ? " · réponse automatique" : ` · ${supportDeliveryLabel(message.deliveryStatus)}`}</small></span><p>{message.bodyText}</p></div>)}</div>
              {detail.attachments.length > 0 ? <div className="lycee-tracked-files">{detail.attachments.map((attachment) => <div key={attachment.id}><FileText aria-hidden="true" /><span><strong>{attachment.originalName}</strong><small>{attachment.direction === "agent" ? attachment.releasedAt ? "Envoyé au demandeur · " : "Préparé par un agent · " : "Reçu du demandeur · "}{attachment.scanStatus === "clean" ? "vérifié" : attachment.scanStatus === "blocked" ? "refusé" : attachment.scanStatus === "scan_error" ? "contrôle indisponible" : "contrôle en cours"}</small></span>{attachment.scanStatus === "clean" ? <button type="button" onClick={() => void openAgentAttachment(attachment.id)} aria-label={`Ouvrir ${attachment.originalName}`}><ExternalLink aria-hidden="true" /></button> : null}</div>)}</div> : null}
              <section className="lycee-agent-ai"><div><WandSparkles aria-hidden="true" /><span><span className="lycee-eyebrow">Aide au traitement</span><h3>{supportCategoryLabel(selected.category)} · priorité {priorityLabels[selected.priority] ?? "Normale"}</h3></span></div><dl><div><dt>Personne</dt><dd>{selected.beneficiaryType === "self" ? "Demandeur" : `${selected.beneficiaryFirstName ?? ""} ${selected.beneficiaryLastName ?? ""}`}</dd></div><div><dt>Canal disponible</dt><dd>{detail.contacts.map((contact) => channelLabels[contact.channel] ?? contact.channel).join(" + ")}</dd></div><div><dt>Langue détectée</dt><dd>{selected.subjectContext.detectedLanguage ?? "Non déterminée"}</dd></div><div><dt>Langue de réponse</dt><dd>{languagePreferenceLabels[selected.subjectContext.languagePreference] ?? "Non précisée"}</dd></div><div><dt>Aide à la compréhension</dt><dd>{selected.subjectContext.communicationSupport ?? "Réponse écrite"}</dd></div><div><dt>Pièces</dt><dd>{detail.attachments.length} {detail.attachments.length > 1 ? "documents" : "document"}</dd></div></dl>{selected.subjectContext.internalSummaryFr ? <div className="lycee-agent-french-summary"><Languages aria-hidden="true" /><span><small>Résumé automatique en français</small><p>{selected.subjectContext.internalSummaryFr}</p><em>À vérifier avec le message original avant toute décision.</em></span></div> : null}</section>
              <section className="lycee-agent-actions"><div><span><StickyNote aria-hidden="true" /><strong>Note interne</strong><small>Visible uniquement par les agents.</small></span><textarea aria-label="Note interne" rows={3} value={internalNote} disabled={saving} onChange={(event) => setInternalNote(event.target.value)} placeholder="Diagnostic, appel effectué ou prochaine action…" maxLength={5000} /><button type="button" disabled={saving || !internalNote.trim()} onClick={() => void saveInternalNote()}>Ajouter la note</button></div><div data-closed={selected.status === "clos"}><span><CheckCircle2 aria-hidden="true" /><strong>{selected.status === "clos" ? "Dossier clôturé" : "Clôturer proprement"}</strong><small>{selected.status === "clos" ? selected.subjectContext.closureReason ?? "Motif enregistré dans l’historique." : requiresSafeIdentityReply ? "Confirmez d’abord l’identité scolaire pour cette demande sensible." : "Un motif est obligatoire et reste dans l’audit."}</small></span>{selected.status === "clos" ? <button type="button" disabled={saving} onClick={() => void updateRequest({ status: "en_cours" })}>Rouvrir le dossier</button> : <><textarea aria-label="Motif de clôture" rows={3} value={closureReason} onChange={(event) => setClosureReason(event.target.value)} placeholder="Solution apportée ou raison de la clôture…" maxLength={500} /><button type="button" disabled={saving || !closureReason.trim() || requiresSafeIdentityReply} onClick={() => void updateRequest({ status: "clos", closureReason })}>Clôturer le dossier</button></>}</div></section>
              <section className="lycee-reply-box">
                <div>
                  <span><Sparkles aria-hidden="true" /> {requiresSafeIdentityReply ? "Consigne de vérification sécurisée" : "Réponse en français"}</span>
                  {requiresSafeIdentityReply ? null : <select aria-label="Choisir un modèle de réponse" defaultValue="" onChange={(event) => { applyReplyTemplate(event.target.value); event.currentTarget.value = ""; }}><option value="">Choisir un modèle</option>{visibleTemplates.map((template) => <option value={template.id} key={template.id}>{template.name}</option>)}</select>}
                </div>
                <textarea aria-label="Réponse à envoyer" rows={5} value={requiresSafeIdentityReply ? SUPPORT_IDENTITY_VERIFICATION_MESSAGE : reply} readOnly={requiresSafeIdentityReply || selected.status === "clos"} onChange={(event) => changeReply(event.target.value)} placeholder="Écrivez une réponse claire. Aucun mot de passe ne doit être demandé." />
                {translationTargetLanguage ? <div className="lycee-translation-command"><Languages aria-hidden="true" /><span><strong>Répondre aussi en {translationTargetLanguage}</strong><small>La version française reste la référence. Vous comparerez les deux textes avant l’envoi.</small></span><button type="button" disabled={translating || saving || selected.status === "clos" || !replySourceMessage} onClick={() => void prepareTranslation()}>{translating ? "Traduction…" : translationDraft ? "Repréparer" : "Préparer"}</button></div> : null}
                {translationDraft ? <div className="lycee-translation-review" aria-live="polite"><div><Languages aria-hidden="true" /><strong>Version en {translationDraft.targetLanguage}</strong><button type="button" title="Abandonner la traduction" onClick={clearTranslation}><Trash2 aria-hidden="true" /><span>Garder le français</span></button></div><p dir="auto">{translationDraft.translatedText}</p><div className="lycee-translation-back"><small>Contrôle du sens en français</small><p>{translationDraft.backTranslationFr}</p></div>{translationDraft.warnings.length > 0 ? <ul>{translationDraft.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}<label><input type="checkbox" checked={translationValidated} onChange={(event) => setTranslationValidated(event.target.checked)} /><span><strong>J’ai comparé les deux versions.</strong><small>J’autorise l’envoi de cette traduction. L’agent humain reste responsable du message.</small></span></label></div> : null}
                <input ref={agentFileInputRef} className="lycee-file-input" type="file" multiple accept={SUPPORT_FILE_TYPES.join(",")} aria-label="Documents à joindre à la réponse" onChange={(event) => void selectAgentFiles(event)} />
                {agentDraftAttachments.length > 0 ? <div className="lycee-agent-reply-files" aria-label="Documents préparés pour la réponse">{agentDraftAttachments.map((attachment) => <div key={attachment.id} data-ready={attachment.canAttachToReply}><label><input type="checkbox" disabled={!attachment.canAttachToReply || saving || agentDeletingAttachmentId === attachment.id} checked={selectedAgentAttachmentIds.includes(attachment.id)} onChange={(event) => setSelectedAgentAttachmentIds((current) => event.target.checked ? [...new Set([...current, attachment.id])] : current.filter((id) => id !== attachment.id))} /><FileText aria-hidden="true" /><span><strong>{attachment.originalName}</strong><small>{attachment.canAttachToReply ? "Prêt à joindre" : attachment.scanStatus === "blocked" ? "Fichier refusé" : attachment.scanStatus === "scan_error" ? "Contrôle indisponible" : attachment.scanStatus === "removal_pending" ? "Retrait à reprendre" : "Contrôle antivirus en cours"}</small></span></label>{attachment.canRemoveDraft ? <button type="button" className="lycee-agent-file-remove" disabled={agentDeletingAttachmentId !== null || saving} title="Retirer ce brouillon" aria-label={`Retirer ${attachment.originalName}`} onClick={() => void removeAgentAttachment(attachment.id, attachment.originalName)}>{agentDeletingAttachmentId === attachment.id ? <RefreshCw className="is-spinning" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}</button> : null}</div>)}</div> : null}
                {showTemplateSave && !requiresSafeIdentityReply && access?.canManageTemplates ? <div className="lycee-template-save"><input aria-label="Nom du nouveau modèle" value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Nom du modèle" maxLength={80} /><button type="button" disabled={saving || !templateName.trim() || !reply.trim()} onClick={() => void saveReplyTemplate()}>Enregistrer</button></div> : null}
                <div>{requiresSafeIdentityReply || !access?.canManageTemplates ? null : <button className="lycee-secondary-action" type="button" disabled={selected.status === "clos"} onClick={() => setShowTemplateSave((current) => !current)}><BookOpenCheck aria-hidden="true" /> Modèle</button>}<button className="lycee-secondary-action" type="button" disabled={selected.status === "clos" || requiresSafeIdentityReply || saving || agentUploading || agentDraftAttachments.length >= MAX_SUPPORT_FILES} onClick={() => agentFileInputRef.current?.click()}><Paperclip aria-hidden="true" /> {agentUploading ? "Contrôle…" : "Joindre"}</button><button className="lycee-primary-action" type="button" disabled={saving || agentUploading || translating || translationNeedsDecision || selected.status === "clos" || (!requiresSafeIdentityReply && !reply.trim())} onClick={() => void sendAgentReply()}><Send aria-hidden="true" /> {saving ? "Enregistrement…" : translatedReplyReady && translationDraft ? `Valider et envoyer en ${translationDraft.targetLanguage}` : "Valider et envoyer"}</button></div>
              </section>
            </>
          ) : <div className="lycee-loading-state"><Clock3 aria-hidden="true" /> Sélectionnez une demande</div>}
        </article>
      </div>
      <section className="lycee-agent-mail"><div><Newspaper aria-hidden="true" /><span><strong>Contenus du site</strong><small>Ajouter une actualité, publier un document ou modifier un modèle.</small></span></div><a href="/admin/contenus">Gérer <ChevronRight aria-hidden="true" /></a></section>
      <section className="lycee-agent-mail"><div><Mail aria-hidden="true" /><span><strong>Communication direction</strong><small>Envoyer une information aux professeurs et personnels depuis la messagerie du lycée.</small></span></div><a href={WEBMAIL_ADMIN_URL} target="_blank" rel="noreferrer">Ouvrir <ExternalLink aria-hidden="true" /></a></section>
    </div>
  );
}

function DemoAgentView({ onBack }: { onBack: () => void }) {
  const [selectedId, setSelectedId] = useState(agentRequests[0].id);
  const [status, setStatus] = useState("Nouveau");
  const [reply, setReply] = useState("Bonjour Madame, votre demande concernant l’accès ENT a bien été prise en charge. Nous vérifions le compte de votre enfant et revenons vers vous aujourd’hui.");
  const selected = agentRequests.find((request) => request.id === selectedId) ?? agentRequests[0];
  return (
    <div className="lycee-page lycee-agent-page">
      <PageIntro eyebrow="Espace agent" title="Demandes du lycée" description="L’IA classe et prépare. Vous gardez la décision et la réponse finale." onBack={onBack} />
      <div className="lycee-agent-stats">
        <div><span><Inbox aria-hidden="true" /></span><strong>8</strong><small>Nouvelles</small></div>
        <div><span><CircleAlert aria-hidden="true" /></span><strong>2</strong><small>Urgentes</small></div>
        <div><span><Clock3 aria-hidden="true" /></span><strong>11</strong><small>En cours</small></div>
        <div><span><CheckCircle2 aria-hidden="true" /></span><strong>27</strong><small>Résolues aujourd’hui</small></div>
      </div>
      <div className="lycee-agent-workspace">
        <section className="lycee-agent-queue">
          <div className="lycee-agent-toolbar"><label><Search aria-hidden="true" /><input placeholder="Rechercher" /></label><button type="button" aria-label="Filtrer"><Filter aria-hidden="true" /></button></div>
          <div className="lycee-agent-tabs"><button className="is-active" type="button">À traiter <span>8</span></button><button type="button">En cours <span>11</span></button></div>
          <div className="lycee-agent-list">
            {agentRequests.map((request) => (
              <button className={selectedId === request.id ? "is-selected" : ""} type="button" key={request.id} onClick={() => { setSelectedId(request.id); setStatus("Nouveau"); }}>
                <span className="lycee-request-avatar">{request.name.split(" ").map((word) => word[0]).join("").slice(0,2)}</span>
                <span><strong>{request.subject}</strong><small>{request.name} · {request.role}</small><em>{request.category} · {request.age}</em></span>
                {request.priority === "Urgent" ? <b>Urgent</b> : null}
              </button>
            ))}
          </div>
        </section>
        <article className="lycee-agent-detail">
          <div className="lycee-agent-detail-head"><div><span>{selected.id}</span><h2>{selected.subject}</h2><p>{selected.name} · {selected.role}</p></div><select aria-label="Statut" value={status} onChange={(event) => setStatus(event.target.value)}><option>Nouveau</option><option>En cours</option><option>En attente</option><option>Résolu</option></select></div>
          <div className="lycee-agent-message"><span className="lycee-request-avatar">{selected.name[0]}</span><p>Bonjour, je n’arrive pas à me connecter et je n’ai pas reçu les codes. Pouvez-vous m’aider rapidement s’il vous plaît&nbsp;?</p></div>
          <section className="lycee-agent-ai"><div><WandSparkles aria-hidden="true" /><span><span className="lycee-eyebrow">Analyse IA</span><h3>Demande claire, priorité normale</h3></span></div><dl><div><dt>Catégorie</dt><dd>{selected.category}</dd></div><div><dt>Action suggérée</dt><dd>Vérifier le compte puis renvoyer le code</dd></div><div><dt>Risque</dt><dd>Aucune donnée sensible détectée</dd></div></dl></section>
          <section className="lycee-reply-box"><div><span><Sparkles aria-hidden="true" /> Réponse proposée</span><button type="button" onClick={() => setReply("Bonjour, votre demande est prise en charge. Nous vérifions votre accès et vous répondrons dans la journée.")}>Régénérer</button></div><textarea rows={5} value={reply} onChange={(event) => setReply(event.target.value)} /><div><button className="lycee-secondary-action" type="button"><Paperclip aria-hidden="true" /> Joindre</button><button className="lycee-primary-action" type="button" onClick={() => setStatus("Résolu")}><Send aria-hidden="true" /> Valider et envoyer</button></div></section>
        </article>
      </div>
      <section className="lycee-agent-mail"><div><Newspaper aria-hidden="true" /><span><strong>Contenus du site</strong><small>Ajouter une actualité, publier un document ou modifier un modèle.</small></span></div><a href="/admin/contenus">Gérer <ChevronRight aria-hidden="true" /></a></section>
      <section className="lycee-agent-mail"><div><Mail aria-hidden="true" /><span><strong>Communication direction</strong><small>Envoyer une information aux professeurs et personnels depuis la messagerie du lycée.</small></span></div><a href={WEBMAIL_ADMIN_URL} target="_blank" rel="noreferrer">Ouvrir <ExternalLink aria-hidden="true" /></a></section>
    </div>
  );
}
