import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
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
  Mail,
  MapPin,
  Menu,
  MessageCircleMore,
  Mic2,
  Newspaper,
  Paperclip,
  Phone,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Smartphone,
  TicketCheck,
  UserRound,
  Users,
  UsersRound,
  WandSparkles,
  Wifi,
} from "lucide-react";
import { supabase } from "../../lib/supabase-browser";
import { apiFetch } from "../../lib/api";
import {
  evaluateConversationPolicy,
  type AssistantPolicyAction,
  type AssistantScope,
} from "../../../shared/assistant-policy";
import "./lycee-connect.css";

type View = "home" | "services" | "help" | "requests" | "school" | "news" | "agent" | "trust";
type RequesterProfile = "eleve" | "parent" | "professeur" | "personnel" | "autre" | "";

const SUPPORT_API_ENABLED = import.meta.env.VITE_SUPPORT_API_ENABLED === "true";
const AI_ASSISTANT_ENABLED = import.meta.env.VITE_AI_ASSISTANT_ENABLED !== "false";
const LYCEEGEST_URL = "/login";
const WEBMAIL_URL = "https://mail.lycee-blaise-cendrars-sevran.fr/";
const WEBMAIL_ADMIN_URL = `${WEBMAIL_URL}admin`;
const MAX_SUPPORT_FILES = 5;
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

function supportAssistantSessionId(): string {
  const storageKey = "bc_support_assistant_session";
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing && /^[a-zA-Z0-9-]{16,80}$/.test(existing)) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return crypto.randomUUID();
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

function supportCategoryLabel(value: string): string {
  return supportCategories.find((category) => category.value === value)?.label ?? "Autre demande";
}

async function readApiResponse<T>(responseInput: Response | Promise<Response>): Promise<T> {
  const response = await responseInput;
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Le service ne répond pas");
  return payload;
}

async function uploadSupportFile(publicCode: string, file: File): Promise<void> {
  const reservation = await readApiResponse<{
    attachment: { id: string };
    upload: { bucket: string; path: string; token: string };
  }>(
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

  const { error: uploadError } = await supabase.storage
    .from(reservation.upload.bucket)
    .uploadToSignedUrl(reservation.upload.path, reservation.upload.token, file, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) throw new Error(`Échec de l'envoi de ${file.name}`);

  await readApiResponse(
    await fetch(`/api/support/attachments/${reservation.attachment.id}/confirm`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicCode }),
    })
  );
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
    tone: "coral",
    prompt: "J’ai une question sur ma classe, mon emploi du temps ou la rentrée.",
  },
  {
    title: "Codes de connexion",
    detail: "ENT, EduConnect ou email académique",
    icon: KeyRound,
    tone: "gold",
    prompt: "Je n’ai pas reçu mes codes ou je n’arrive pas à me connecter.",
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [ticketCreated, setTicketCreated] = useState<string | null>(null);

  useEffect(() => {
    if (!SUPPORT_API_ENABLED) return;
    const url = new URL(window.location.href);
    const token = url.searchParams.get("support_token");
    if (!token) return;
    readApiResponse<{ request: { publicCode: string } }>(
      fetch(`/api/support/access/${encodeURIComponent(token)}`, {
        method: "POST",
        credentials: "include",
      })
    )
      .then((payload) => {
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
    setView(nextView);
    setMenuOpen(false);
    const url = new URL(window.location.href);
    if (nextView === "home") url.searchParams.delete("view");
    else url.searchParams.set("view", nextView);
    window.history.replaceState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startHelp(prompt = "") {
    setMessage(prompt);
    changeView("help");
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

      <div className="lycee-workspace">
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
            <button className="lycee-icon-button" type="button" aria-label="Notifications">
              <Bell aria-hidden="true" />
              <span />
            </button>
            <button className="lycee-profile-button" type="button" onClick={() => changeView("agent")}>
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
            <div className="lycee-hero-tracks" aria-label="Parcours proposés">
              <span>Général</span><span>Technologique</span><span>Professionnel</span><span>CAP</span>
            </div>
          </div>
        </section>

        <div className="lycee-content">
          <section className="lycee-core-tools" aria-label="Outils principaux du lycée">
            <button type="button" data-tool="news" onClick={() => changeView("news")}><span><Newspaper aria-hidden="true" /></span><div><strong>À la une</strong><small>Rentrée, formations et informations du lycée</small></div><em>Consulter <ChevronRight aria-hidden="true" /></em></button>
            <a href={WEBMAIL_URL} target="_blank" rel="noreferrer" data-tool="mail"><span><Mail aria-hidden="true" /></span><div><strong>Webmail du lycée</strong><small>Messagerie, contacts et diffusion</small></div><em>Ouvrir <ExternalLink aria-hidden="true" /></em></a>
          </section>

          <section className="lycee-assistant" aria-labelledby="lycee-assistant-title">
            <div className="lycee-assistant-heading">
              <span className="lycee-ai-icon"><Bot aria-hidden="true" /></span>
              <div>
                <span className="lycee-eyebrow">Assistant du lycée</span>
                <h2 id="lycee-assistant-title">De quoi avez-vous besoin&nbsp;?</h2>
              </div>
              <span className="lycee-ai-status"><Sparkles aria-hidden="true" /> Assistant actif</span>
            </div>
            <p>Expliquez votre situation avec vos mots. L’assistant vous guide et prépare la demande pour le bon service.</p>
            <div className="lycee-composer">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                aria-label="Décrivez votre besoin"
                placeholder="Exemple : je suis parent et je n’ai pas reçu les codes ENT de mon enfant…"
              />
              <button
                type="button"
                disabled={!message.trim()}
                onClick={() => startHelp(message)}
              >
                <Send aria-hidden="true" />
                <span>Envoyer</span>
              </button>
            </div>
            <div className="lycee-trust-row">
              <button type="button" onClick={() => changeView("trust")}><ShieldCheck aria-hidden="true" /> Confidentialité et sécurité</button>
              <span><Users aria-hidden="true" /> Réponse validée par un agent</span>
            </div>
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
              <div>
                <span className="lycee-status-icon"><Wifi aria-hidden="true" /></span>
                <span><strong>ENT Monlycée.net</strong><small>Connexion et services</small></span>
                <em className="is-ok">Opérationnel</em>
              </div>
              <div>
                <span className="lycee-status-icon"><Mail aria-hidden="true" /></span>
                <span><strong>Webmail académique</strong><small>Communication Créteil</small></span>
                <em className="is-warning">Perturbé</em>
              </div>
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
          {navigation.slice(0, 4).map((item, index) => (
            <button
              className={view === item.view ? "is-active" : ""}
              type="button"
              key={item.label}
              onClick={() => changeView(item.view)}
            >
              <item.icon aria-hidden="true" />
              <span>{["Accueil", "Services", "Aide", "Suivi"][index]}</span>
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

type PublicContent = {
  id: string;
  contentType: "article" | "alerte" | "page" | "document";
  slug: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  category: string;
  audience: string;
  featured: boolean;
  publishedAt: string | null;
  publishAt: string | null;
  assets: Array<{
    id: string;
    assetKind: "image" | "document";
    mimeType: string;
    title: string;
    altText: string | null;
    originalName: string;
    role: "couverture" | "illustration" | "document";
    label: string;
    position: number;
    signedUrl: string | null;
  }>;
};

function NewsView({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<PublicContent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/content/public")
      .then((response) => readApiResponse<{ items: PublicContent[] }>(response))
      .then((payload) => {
        setItems(payload.items);
        setSelectedId(payload.items[0]?.id ?? null);
      })
      .catch(() => setError("Les informations ne peuvent pas être chargées pour le moment."))
      .finally(() => setLoading(false));
  }, []);

  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const selectedImage = selected?.assets.find((asset) => asset.assetKind === "image" && asset.signedUrl);
  const selectedDocuments = selected?.assets.filter((asset) => asset.assetKind === "document" && asset.signedUrl) ?? [];

  return (
    <div className="lycee-page lycee-news-page">
      <PageIntro
        eyebrow="Vie du lycée"
        title="À la une"
        description="Les informations, événements et documents publiés par le lycée."
        onBack={onBack}
      />
      {loading ? <div className="lycee-loading-state"><RefreshCw aria-hidden="true" /> Chargement des informations…</div> : null}
      {error ? <div className="lycee-form-error"><CircleAlert aria-hidden="true" />{error}</div> : null}
      {!loading && !error && !selected ? (
        <section className="lycee-news-empty">
          <Newspaper aria-hidden="true" />
          <h2>Les prochaines informations seront publiées ici</h2>
          <p>Les formations et la présentation du lycée restent disponibles dans « Vie du lycée ».</p>
        </section>
      ) : null}
      {selected ? (
        <>
          <article className="lycee-news-feature">
            {selectedImage ? <img src={selectedImage.signedUrl ?? ""} alt={selectedImage.altText ?? ""} /> : null}
            <div>
              <span>{selected.category}</span>
              <h2>{selected.title}</h2>
              {selected.summary ? <p className="lycee-news-summary">{selected.summary}</p> : null}
              <div className="lycee-public-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.bodyMarkdown}</ReactMarkdown></div>
              {selectedDocuments.length ? <div className="lycee-news-documents">{selectedDocuments.map((asset) => <a key={asset.id} href={asset.signedUrl ?? "#"} target="_blank" rel="noreferrer"><FileText aria-hidden="true" /><span><strong>{asset.label}</strong><small>{asset.originalName}</small></span><ExternalLink aria-hidden="true" /></a>)}</div> : null}
            </div>
          </article>
          {items.length > 1 ? <section className="lycee-news-list" aria-labelledby="news-list-title"><div className="lycee-section-title"><div><span className="lycee-eyebrow">Toutes les informations</span><h2 id="news-list-title">Publié par le lycée</h2></div></div><div>{items.map((item) => { const image = item.assets.find((asset) => asset.assetKind === "image" && asset.signedUrl); return <button className={item.id === selected.id ? "is-active" : ""} type="button" key={item.id} onClick={() => { setSelectedId(item.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{image ? <img src={image.signedUrl ?? ""} alt="" /> : <span><Newspaper aria-hidden="true" /></span>}<div><small>{item.category}</small><strong>{item.title}</strong><p>{item.summary}</p></div><ChevronRight aria-hidden="true" /></button>; })}</div></section> : null}
        </>
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
};

type AssistantInsight = {
  reply: string;
  category: SupportCategory;
  requesterType: "eleve" | "parent" | "professeur" | "personnel" | "autre" | "inconnu";
  urgency: "faible" | "normale" | "urgente";
  missingInformation: string[];
  suggestedDocuments: string[];
  readyToCreate: boolean;
  safetyNotice: string | null;
  usedAi: boolean;
  scope: AssistantScope;
  action: AssistantPolicyAction;
  turnCount: number;
  remainingTurns: number;
  limitReached: boolean;
};

function inferSupportCategory(text: string): SupportCategory {
  if (/\b(inscription|réinscription|reinscription|inscrire)\b/i.test(text)) return "inscription";
  if (/\b(classe|affectation|emploi du temps|edt)\b/i.test(text)) return "affectation_classe";
  if (/\b(document|pièce|piece|dossier|justificatif|manque)\b/i.test(text)) return "documents_scolarite";
  if (/\b(ent|educonnect|connexion|connecter|identifiant|code)\b/i.test(text)) return "ent";
  if (/\b(email|mail|webmail|zimbra|académique|academique)\b/i.test(text)) return "email_academique";
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
  const category = inferSupportCategory(text);
  const label = supportCategories.find((item) => item.value === category)?.label ?? "Autre demande";
  const requesterType = /\b(parent|mère|mere|père|pere)\b/i.test(text)
    ? "parent"
    : /\b(prof|professeur|enseignant)\b/i.test(text)
      ? "professeur"
      : /\b(élève|eleve|lycéen|lyceen)\b/i.test(text)
        ? "eleve"
        : /\b(personnel|agent|administration)\b/i.test(text)
          ? "personnel"
          : "inconnu";
  return {
    reply: policy.deterministicReply ?? `J’ai compris. Je classe votre besoin dans « ${label} ». ${files.length ? `Je vois aussi ${files.length} fichier${files.length > 1 ? "s" : ""} à joindre au dossier. ` : ""}Expliquez-moi ce qui bloque et ce que vous avez déjà essayé. Je préparerai ensuite la demande pour le bon agent.`,
    category: policy.category ?? category,
    requesterType,
    urgency: policy.urgency ?? (/\b(urgent|aujourd'hui|bloqué|bloque|impossible)\b/i.test(text) ? "urgente" : "normale"),
    missingInformation: ["Identité de la personne concernée", "Email ou téléphone de réponse"],
    suggestedDocuments: files.length ? files.map((file) => file.name) : [],
    readyToCreate: policy.readyToCreate ?? text.trim().length >= 35,
    safetyNotice: policy.safetyNotice,
    usedAi: false,
    scope: policy.scope,
    action: policy.action,
    turnCount: policy.turnCount,
    remainingTurns: policy.remainingTurns,
    limitReached: policy.limitReached,
  };
}

function HelpDeskView({
  initialMessage,
  onBack,
  onTicketCreated,
  onTrack,
}: {
  initialMessage: string;
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
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [classicForm, setClassicForm] = useState(false);
  const [profile, setProfile] = useState<RequesterProfile>("");
  const [category, setCategory] = useState<SupportCategory>(() => inferSupportCategory(initialMessage));
  const [classicDescription, setClassicDescription] = useState(initialMessage);
  const [ticketCode, setTicketCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attachmentWarning, setAttachmentWarning] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const initialAnalysisStarted = useRef(false);
  const [requestKey] = useState(() => crypto.randomUUID());
  const [assistantSessionId] = useState(supportAssistantSessionId);

  const requesterMessages = chatMessages.filter((message) => message.role === "requester");
  const conversationDescription = requesterMessages.map((message) => message.content).join("\n\n").trim();
  const selectedCategory = supportCategories.find((item) => item.value === category);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, assistantBusy]);

  useEffect(() => {
    if (!initialMessage.trim() || initialAnalysisStarted.current) return;
    initialAnalysisStarted.current = true;
    void askAssistant(chatMessages);
  }, []);

  async function askAssistant(nextMessages: AssistantChatMessage[]) {
    setAssistantBusy(true);
    setSubmitError(null);
    let result = localAssistantFallback(nextMessages, files);
    if (AI_ASSISTANT_ENABLED) {
      try {
        result = await readApiResponse<AssistantInsight>(
          fetch("/api/support/assistant", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: assistantSessionId,
              messages: nextMessages.slice(-21).map(({ role, content }) => ({ role, content })),
              attachments: files.map((file) => ({ name: file.name, type: file.type, size: file.size })),
            }),
          })
        );
      } catch {
        result = localAssistantFallback(nextMessages, files);
      }
    }
    setInsight(result);
    setCategory(result.category);
    if (result.requesterType !== "inconnu" && !profile) setProfile(result.requesterType);
    setChatMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "assistant", content: result.reply },
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
  const canCreateRequest = insight?.action !== "stop" || insight.readyToCreate;

  function restartConversation() {
    setChatMessages([welcomeMessage]);
    setChatInput("");
    setInsight(null);
    setShowDetails(false);
    setClassicForm(false);
    setCategory("autre");
    setFiles([]);
    setSubmitError(null);
    setAttachmentWarning(null);
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
      let publicCode = "BC-2026-0042";
      if (SUPPORT_API_ENABLED) {
        const response = await fetch("/api/support/requests", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": requestKey,
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
            description,
            email,
            phone,
            preferredChannel,
            fallbackAllowed: form.get("fallbackAllowed") === "on",
            languagePreference: form.get("languagePreference"),
            communicationSupport: form.get("communicationSupport") === "on",
            website: form.get("website"),
          }),
        });
        const payload = (await response.json()) as { request?: { publicCode?: string }; error?: string };
        if (!response.ok || !payload.request?.publicCode) {
          throw new Error(payload.error ?? "La demande n’a pas pu être enregistrée");
        }
        publicCode = payload.request.publicCode;

        if (files.length > 0) {
          const uploads = await Promise.allSettled(files.map((file) => uploadSupportFile(publicCode, file)));
          const failedCount = uploads.filter((result) => result.status === "rejected").length;
          if (failedCount > 0) {
            setAttachmentWarning(`La demande est enregistrée, mais ${failedCount} fichier${failedCount > 1 ? "s" : ""} n’a pas été joint. Vous pourrez le renvoyer depuis le suivi.`);
          }
        }
      }
      setTicketCode(publicCode);
      onTicketCreated(publicCode);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  }

  if (ticketCode) {
    return (
      <div className="lycee-page lycee-confirmation-view">
        <div className="lycee-confirmation-mark"><CheckCircle2 aria-hidden="true" /></div>
        <span className="lycee-eyebrow">Demande transmise</span>
        <h1>Votre dossier est créé.</h1>
        <p>La conversation et les documents sont réunis. Un agent du lycée peut maintenant vous répondre sans vous faire recommencer.</p>
        <div className="lycee-ticket-code"><span>Numéro de demande</span><strong>{ticketCode}</strong></div>
        <div className="lycee-confirmation-note"><Smartphone aria-hidden="true" /><span>Le suivi reste disponible sur cet appareil. Si vous avez indiqué une adresse email, vous recevez aussi un lien sécurisé pour retrouver le dossier depuis un autre appareil.</span></div>
        <div className="lycee-confirmation-note"><Mail aria-hidden="true" /><span>Conservez l’email du lycée : il garde une trace de la demande, du numéro de dossier et des réponses.</span></div>
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
        description="Écrivez avec vos mots, dans la langue qui vous convient. Le lycée garde la conversation jusqu’à la réponse."
        onBack={onBack}
      />

      <div className="lycee-guided-chat">
        <div className="lycee-guided-chat-head"><span><Bot aria-hidden="true" /></span><div><strong>Assistant Blaise</strong><small>Comprend, reformule et transmet au bon agent</small></div><em><span /> Disponible</em></div>
        <div className="lycee-guided-thread" ref={threadRef} aria-live="polite">
          {chatMessages.map((message) => (
            <div data-speaker={message.role} key={message.id}>
              {message.role === "assistant" ? <span><Bot aria-hidden="true" /></span> : null}
              <p>{message.content}</p>
            </div>
          ))}
          {assistantBusy ? <div data-speaker="assistant" className="is-thinking"><span><Bot aria-hidden="true" /></span><p><i /><i /><i /><b>J’analyse votre demande…</b></p></div> : null}
        </div>

        <div className="lycee-chat-workspace">
          <div className="lycee-language-help"><Languages aria-hidden="true" /><span><strong>Le français est difficile ?</strong><small>Écrivez dans votre langue ou avec des mots simples. L’assistant vous aide sans vous juger.</small></span></div>
          {insight ? (
            <div className="lycee-live-analysis">
              <WandSparkles aria-hidden="true" />
              <span><strong>{selectedCategory?.label}</strong><small>Priorité {insight.urgency}{insight.usedAi ? " · analyse IA" : " · analyse locale"}</small></span>
              {insight.suggestedDocuments.length > 0 ? <em>{insight.suggestedDocuments.length} {insight.suggestedDocuments.length > 1 ? "pièces repérées" : "pièce repérée"}</em> : null}
            </div>
          ) : null}

          {!conversationStopped ? (
            <form className="lycee-chat-composer" onSubmit={sendChatMessage}>
              <textarea value={chatInput} onChange={(event) => setChatInput(event.target.value)} rows={2} maxLength={1500} placeholder="Écrivez comme si vous parliez à l’accueil du lycée…" aria-label="Votre message" />
              <input ref={fileInputRef} className="lycee-file-input" type="file" multiple accept={SUPPORT_FILE_TYPES.join(",")} onChange={selectFiles} />
              <button className="lycee-chat-attach" type="button" aria-label="Joindre un document" title="Joindre un document" disabled={files.length >= MAX_SUPPORT_FILES} onClick={() => fileInputRef.current?.click()}><Paperclip aria-hidden="true" /></button>
              <button className="lycee-chat-send" type="submit" aria-label="Envoyer le message" title="Envoyer" disabled={!chatInput.trim() || assistantBusy}><Send aria-hidden="true" /></button>
            </form>
          ) : null}

          {files.length > 0 ? (
            <div className="lycee-selected-files lycee-chat-files" aria-label="Fichiers à envoyer">
              {files.map((file, index) => (
                <div key={`${file.name}-${file.lastModified}`}><FileText aria-hidden="true" /><span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} Mo</small></span><button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>Retirer</button></div>
              ))}
            </div>
          ) : null}

          {requesterMessages.length > 0 && !showDetails && canCreateRequest ? (
            <div className="lycee-chat-next">
              <button className="lycee-primary-action" type="button" onClick={() => setShowDetails(true)}>{insight?.action === "human_transfer" ? "Transmettre à un adulte du lycée" : "Créer ma demande"} <ChevronRight aria-hidden="true" /></button>
              <button type="button" onClick={() => { setClassicForm(true); setShowDetails(true); }}>Je préfère remplir le formulaire</button>
            </div>
          ) : null}

          {conversationStopped && !canCreateRequest ? (
            <div className="lycee-chat-next">
              <button className="lycee-primary-action" type="button" onClick={restartConversation}>Commencer une demande du lycée</button>
            </div>
          ) : null}

          {showDetails ? (
            <form className="lycee-case-form" onSubmit={submitRequest}>
              <div className="lycee-case-form-head"><span><ShieldCheck aria-hidden="true" /></span><div><h2>{classicForm ? "Formulaire classique" : "Une dernière étape"}</h2><p>{classicForm ? "Tous les champs sont visibles pour ceux qui préfèrent écrire leur demande directement." : "Vos coordonnées permettent au lycée de vous répondre et de retrouver la bonne personne."}</p></div><button type="button" aria-label="Fermer" onClick={() => setShowDetails(false)}>Fermer</button></div>
              <div className="lycee-fields-grid">
                <label><span>Vous êtes</span><select value={profile} onChange={(event) => setProfile(event.target.value as RequesterProfile)} required><option value="">Sélectionner</option><option value="eleve">Élève</option><option value="parent">Parent</option><option value="professeur">Professeur</option><option value="personnel">Personnel</option><option value="autre">Autre</option></select></label>
                {classicForm ? <label><span>Votre demande concerne</span><select value={category} onChange={(event) => setCategory(event.target.value as SupportCategory)}>{supportCategories.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label> : null}
                <label><span>Votre prénom</span><input name="requesterFirstName" type="text" autoComplete="given-name" placeholder="Prénom" required /></label>
                <label><span>Votre nom</span><input name="requesterLastName" type="text" autoComplete="family-name" placeholder="Nom" required /></label>
                {profile === "parent" ? <><label><span>Prénom de l’élève</span><input name="beneficiaryFirstName" type="text" required /></label><label><span>Nom de l’élève</span><input name="beneficiaryLastName" type="text" required /></label></> : null}
                {profile === "eleve" || profile === "parent" ? <label><span>Classe, si connue</span><input name="className" type="text" placeholder="Ex. 2GT4" /></label> : null}
                {profile === "professeur" || profile === "personnel" ? <label><span>Matière ou service</span><input name="subjectArea" type="text" placeholder="Ex. Mathématiques, intendance" /></label> : null}
                {profile === "professeur" ? <label><span>Voie</span><select name="schoolTrack"><option value="">Non précisée</option><option value="general">Générale et technologique</option><option value="professionnel">Professionnelle</option><option value="les_deux">Les deux</option></select></label> : null}
                <label><span>Adresse email recommandée</span><input name="email" type="email" autoComplete="email" placeholder="nom@exemple.fr" /><small>Pour garder une trace et retrouver la demande sur un autre appareil.</small></label>
                <label><span>Téléphone</span><input name="phone" type="tel" autoComplete="tel" placeholder="06 00 00 00 00" /><small>Pour un rappel si l’email ne suffit pas.</small></label>
                <label><span>Moyen de contact principal</span><select name="preferredChannel" defaultValue="email"><option value="email">Email, recommandé</option><option value="phone">Téléphone</option></select></label>
                <label><span>Langue souhaitée</span><select name="languagePreference" defaultValue="francais_simple"><option value="francais_simple">Français simple</option><option value="francais">Français</option><option value="arabe">Arabe</option><option value="anglais">Anglais</option><option value="espagnol">Espagnol</option><option value="portugais">Portugais</option><option value="turc">Turc</option><option value="autre">Autre langue, précisée dans le message</option></select></label>
                <label className="lycee-fallback-choice"><input name="fallbackAllowed" type="checkbox" defaultChecked /><span>Utiliser l’autre moyen de contact si nécessaire</span></label>
                <label className="lycee-fallback-choice"><input name="communicationSupport" type="checkbox" /><span>J’ai besoin d’un rappel pour mieux comprendre la réponse</span></label>
                {classicForm ? <label className="is-wide"><span>Votre demande</span><textarea value={classicDescription} onChange={(event) => setClassicDescription(event.target.value)} rows={5} maxLength={5000} placeholder="Expliquez ce dont vous avez besoin." required /></label> : null}
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
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [followupFiles, setFollowupFiles] = useState<File[]>([]);
  const followupFileInputRef = useRef<HTMLInputElement>(null);

  async function loadRequests(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      const payload = await readApiResponse<{ requests: SupportRequestSummary[] }>(
        fetch("/api/support/requests", { credentials: "include" })
      );
      setRequests(payload.requests);
      setSelectedCode((current) => current ?? payload.requests[0]?.publicCode ?? null);
      setError(null);
    } catch (requestError) {
      if (showLoading) setError(requestError instanceof Error ? requestError.message : "Impossible de charger les demandes");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function loadDetail(code: string) {
    try {
      const payload = await readApiResponse<SupportRequestDetail>(
        fetch(`/api/support/requests/${code}`, { credentials: "include" })
      );
      setDetail(payload);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Impossible d’actualiser la demande");
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
    if (!selectedCode) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedCode);
    const timer = window.setInterval(() => {
      if (!document.hidden) void loadDetail(selectedCode);
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [selectedCode]);

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
    const availableSlots = Math.max(0, MAX_SUPPORT_FILES - (detail?.attachments.length ?? 0));
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
    setReplying(true);
    setError(null);
    try {
      let uploadWarning: string | null = null;
      await readApiResponse(
        await fetch(`/api/support/requests/${selectedCode}/messages`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({ message: reply }),
        })
      );
      setReply("");
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

  const visibleRequests = requests.filter((request) =>
    `${request.publicCode} ${request.subject}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="lycee-page">
      <PageIntro eyebrow="Suivi" title="Mes demandes" description="Retrouvez les réponses sur cet appareil. Le lien reçu par email permet de reprendre depuis un autre téléphone ou ordinateur." onBack={onBack} />
      {error ? <div className="lycee-form-error" role="alert"><CircleAlert aria-hidden="true" />{error}</div> : null}
      {loading ? <div className="lycee-loading-state"><Clock3 aria-hidden="true" /> Chargement des demandes…</div> : null}
      {!loading && requests.length === 0 ? (
        <section className="lycee-empty-state"><TicketCheck aria-hidden="true" /><h2>Aucune demande sur cet appareil</h2><p>Si vous aviez déjà créé une demande ailleurs, ouvrez le lien sécurisé reçu par email.</p><button type="button" onClick={onBack}>Retour à l’accueil</button></section>
      ) : null}
      {requests.length > 0 ? (
        <div className="lycee-track-grid">
          <section className="lycee-ticket-list">
            <div className="lycee-list-toolbar">
              <label><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Rechercher une demande" placeholder="Numéro ou objet" /></label>
            </div>
            {visibleRequests.map((request) => (
              <button type="button" className={selectedCode === request.publicCode ? "is-selected" : ""} key={request.publicCode} onClick={() => setSelectedCode(request.publicCode)}>
                <span className="lycee-ticket-icon"><KeyRound aria-hidden="true" /></span>
                <span><strong>{request.subject}</strong><small>{request.publicCode} · {supportDate(request.createdAt)}</small></span>
                <em>{supportStatusLabels[request.status] ?? request.status}</em>
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
              <div className="lycee-conversation" aria-label="Conversation">
                {detail.messages.map((message) => (
                  <div className={message.direction === "outbound" ? "is-agent" : "is-requester"} key={message.id}>
                    <span><strong>{message.authorLabel ?? (message.direction === "outbound" ? "Lycée" : "Vous")}</strong><small>{supportDate(message.createdAt)}</small></span>
                    <p>{message.bodyText}</p>
                  </div>
                ))}
              </div>
              {detail.attachments.length > 0 ? (
                <div className="lycee-tracked-files">
                  {detail.attachments.map((attachment) => (
                    <div key={attachment.id}><FileText aria-hidden="true" /><span><strong>{attachment.originalName}</strong><small>{attachment.scanStatus === "clean" ? "Vérifié" : attachment.scanStatus === "blocked" ? "Refusé" : "Contrôle en cours"}</small></span></div>
                  ))}
                </div>
              ) : null}
              <form className="lycee-followup-form" onSubmit={sendReply}>
                <label><span>Ajouter un message</span><textarea rows={3} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Précisez votre demande ou répondez à l’agent." maxLength={5000} /></label>
                <input ref={followupFileInputRef} className="lycee-file-input" type="file" multiple accept={SUPPORT_FILE_TYPES.join(",")} onChange={selectFollowupFiles} />
                {followupFiles.length > 0 ? <div className="lycee-selected-files lycee-followup-files">{followupFiles.map((file, index) => <div key={`${file.name}-${file.lastModified}`}><FileText aria-hidden="true" /><span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} Mo</small></span><button type="button" onClick={() => setFollowupFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>Retirer</button></div>)}</div> : null}
                <div className="lycee-followup-actions"><button className="lycee-secondary-action" type="button" disabled={(detail.attachments.length + followupFiles.length) >= MAX_SUPPORT_FILES} onClick={() => followupFileInputRef.current?.click()}><Paperclip aria-hidden="true" /> Joindre</button><button className="lycee-primary-action" type="submit" disabled={replying || !reply.trim()}>{replying ? "Envoi…" : "Envoyer"}<Send aria-hidden="true" /></button></div>
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
            <span><strong>{ticketCode ? "Accès ENT de mon enfant" : "Je n’arrive plus à accéder à l’ENT"}</strong><small>{ticketCode ?? "BC-2026-0042"} · Aujourd’hui</small></span>
            <em>En cours</em>
          </button>
        </section>
        <article className="lycee-ticket-detail">
          <div className="lycee-ticket-detail-head">
            <div><span>{ticketCode ?? "BC-2026-0042"}</span><h2>{ticketCode ? "Accès ENT de mon enfant" : "Problème de connexion ENT"}</h2></div>
            <em>En cours de traitement</em>
          </div>
          <div className="lycee-ticket-meta"><span><Users aria-hidden="true" /> Parent d’élève</span><span><Mail aria-hidden="true" /> Réponse par email</span></div>
          <div className="lycee-conversation" aria-label="Conversation de démonstration">
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
    { title: "Accès ENT et EduConnect", description: "Connexion directe ou demande d’aide pour retrouver son accès", icon: KeyRound, color: "blue", progress: "Service de rentrée", action: "Accéder à l’ENT", href: "https://ent.iledefrance.fr/auth/login", external: true },
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
  const links = [
    { label: "Monlycée.net", href: "https://ent.iledefrance.fr/auth/login", icon: GraduationCap },
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
          <a href="https://lycee-blaise-cendrars-sevran.fr/specialites/" target="_blank" rel="noreferrer">Informations officielles <ExternalLink aria-hidden="true" /></a>
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
        <div className="lycee-section-title"><div><span className="lycee-eyebrow">Choisir son parcours</span><h2 id="formations-title">Les formations du lycée</h2></div><a href="https://lycee-blaise-cendrars-sevran.fr/formations/" target="_blank" rel="noreferrer">Site du lycée <ExternalLink aria-hidden="true" /></a></div>
        <div>{formations.map((formation) => <article key={formation.title}><span><formation.icon aria-hidden="true" /></span><div><h3>{formation.title}</h3><p>{formation.description}</p><small>{formation.items}</small></div></article>)}</div>
      </section>
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
  { id: "BC-2026-0042", name: "Nadia Benali", role: "Parent", subject: "Codes ENT non reçus", category: "Accès ENT", priority: "Normal", age: "Il y a 8 min" },
  { id: "BC-2026-0041", name: "M. Laurent", role: "Professeur", subject: "Email académique bloqué", category: "Email", priority: "Urgent", age: "Il y a 14 min" },
  { id: "BC-2026-0040", name: "Yanis K.", role: "Élève · 2GT4", subject: "Ordinateur ne démarre plus", category: "PC portable", priority: "Normal", age: "Il y a 31 min" },
  { id: "BC-2026-0039", name: "Sarah M.", role: "Élève · TSTMG2", subject: "Question Grand Oral", category: "Grand Oral", priority: "Normal", age: "Il y a 1 h" },
];

type AgentRequest = {
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
  identityStatus: IdentityStatus;
  identityMethod?: string | null;
  identityVerifiedAt?: string | null;
  assignedTo: string | null;
  slaDueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AgentRequestDetail = {
  request: AgentRequest & { description: string };
  contacts: Array<{ id: string; channel: string; value: string; isPrimary: boolean; isVerified: boolean }>;
  messages: Array<{ id: string; direction: string; authorLabel: string | null; bodyText: string; deliveryStatus: string; createdAt: string }>;
  attachments: Array<{ id: string; originalName: string; scanStatus: string; sizeBytes: number; createdAt: string }>;
};

type AgentQueueStats = { total: number; new: number; urgent: number; active: number; waitingRequester: number };
type AgentQueuePagination = { page: number; pageSize: number; total: number; totalPages: number };
const IDENTITY_VERIFICATION_REPLY = "Bonjour, pour protéger vos accès, nous devons d’abord confirmer votre identité avec une source officielle du lycée. Ne transmettez aucun mot de passe ni aucun code reçu par SMS. Nous revenons vers vous dès que la vérification est terminée.";

function AgentView({ onBack }: { onBack: () => void }) {
  if (!SUPPORT_API_ENABLED) return <DemoAgentView onBack={onBack} />;
  return <ConnectedAgentView onBack={onBack} />;
}

function ConnectedAgentView({ onBack }: { onBack: () => void }) {
  const [requests, setRequests] = useState<AgentRequest[]>([]);
  const [stats, setStats] = useState<AgentQueueStats>({ total: 0, new: 0, urgent: 0, active: 0, waitingRequester: 0 });
  const [pagination, setPagination] = useState<AgentQueuePagination>({ page: 1, pageSize: 30, total: 0, totalPages: 1 });
  const [queueMode, setQueueMode] = useState<"all" | "urgent" | "mine">("all");
  const [page, setPage] = useState(1);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentRequestDetail | null>(null);
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadQueue() {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "30" });
      if (query.trim()) params.set("q", query.trim());
      if (queueMode === "urgent") params.set("urgent", "true");
      if (queueMode === "mine") params.set("assigned", "me");
      const payload = await apiFetch<{ requests: AgentRequest[]; stats: AgentQueueStats; pagination: AgentQueuePagination }>(`support/agent/requests?${params}`);
      setRequests(payload.requests);
      setStats(payload.stats);
      setPagination(payload.pagination);
      setSelectedCode((current) => payload.requests.some((request) => request.publicCode === current) ? current : payload.requests[0]?.publicCode ?? null);
      if (payload.requests.length === 0) setDetail(null);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les demandes");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadQueue(), 250);
    return () => window.clearTimeout(timer);
  }, [page, query, queueMode]);
  useEffect(() => {
    if (!selectedCode) return;
    apiFetch<AgentRequestDetail>(`support/agent/requests/${selectedCode}`)
      .then((payload) => { setDetail(payload); setError(null); })
      .catch((loadError: Error) => setError(loadError.message));
  }, [selectedCode]);

  async function updateRequest(changes: { status?: string; priority?: string; identityStatus?: IdentityStatus; identityMethod?: string; assignToMe?: boolean }) {
    if (!selectedCode) return;
    setSaving(true);
    try {
      await apiFetch(`support/agent/requests/${selectedCode}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      setDetail(await apiFetch<AgentRequestDetail>(`support/agent/requests/${selectedCode}`));
      await loadQueue();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Modification impossible");
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
    const outgoingMessage = requiresSafeTemplate ? IDENTITY_VERIFICATION_REPLY : reply.trim();
    if (!selectedCode || !outgoingMessage) return;
    setSaving(true);
    try {
      await apiFetch(`support/agent/requests/${selectedCode}/reply`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          message: outgoingMessage,
          ...(requiresSafeTemplate ? { safeTemplate: "identity_verification" } : {}),
        }),
      });
      setReply("");
      setDetail(await apiFetch<AgentRequestDetail>(`support/agent/requests/${selectedCode}`));
      await loadQueue();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Réponse non enregistrée");
    } finally {
      setSaving(false);
    }
  }

  async function openAgentAttachment(id: string) {
    const popup = window.open("about:blank", "_blank");
    try {
      const payload = await apiFetch<{ url: string }>(`support/agent/attachments/${id}`);
      if (popup) popup.location.href = payload.url;
      else window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (openError) {
      popup?.close();
      setError(openError instanceof Error ? openError.message : "Fichier indisponible");
    }
  }

  const selected = detail?.request;
  const requiresSafeIdentityReply = Boolean(
    selected &&
    ["ent", "email_academique"].includes(selected.category) &&
    selected.identityStatus !== "identite_confirmee"
  );

  return (
    <div className="lycee-page lycee-agent-page">
      <PageIntro eyebrow="Espace agent" title="Demandes du lycée" description="Classez, répondez et gardez chaque échange dans le même dossier." onBack={onBack} />
      {error ? <div className="lycee-form-error" role="alert"><CircleAlert aria-hidden="true" />{error}{error.toLowerCase().includes("auth") ? <a href="/login?returnTo=%2Fprototype%3Fview%3Dagent">Se connecter</a> : null}</div> : null}
      <div className="lycee-agent-stats">
        <div><span><Inbox aria-hidden="true" /></span><strong>{stats.new}</strong><small>Nouvelles</small></div>
        <div><span><CircleAlert aria-hidden="true" /></span><strong>{stats.urgent}</strong><small>Urgentes</small></div>
        <div><span><Clock3 aria-hidden="true" /></span><strong>{stats.active}</strong><small>En cours</small></div>
        <div><span><MessageCircleMore aria-hidden="true" /></span><strong>{stats.waitingRequester}</strong><small>Réponse attendue</small></div>
      </div>
      <div className="lycee-agent-workspace">
        <section className="lycee-agent-queue">
          <div className="lycee-agent-toolbar"><label><Search aria-hidden="true" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Nom, numéro ou objet" /></label><button className={queueMode === "mine" ? "is-active" : ""} type="button" aria-label="Afficher mes demandes" aria-pressed={queueMode === "mine"} title="Afficher mes demandes" onClick={() => { setQueueMode((current) => current === "mine" ? "all" : "mine"); setPage(1); }}><Filter aria-hidden="true" /></button></div>
          <div className="lycee-agent-tabs"><button className={queueMode === "all" ? "is-active" : ""} type="button" onClick={() => { setQueueMode("all"); setPage(1); }}>Toutes <span>{stats.total}</span></button><button className={queueMode === "urgent" ? "is-active" : ""} type="button" onClick={() => { setQueueMode("urgent"); setPage(1); }}>Urgentes <span>{stats.urgent}</span></button></div>
          <div className="lycee-agent-list">
            {requests.map((request) => (
              <button className={selectedCode === request.publicCode ? "is-selected" : ""} type="button" key={request.publicCode} onClick={() => setSelectedCode(request.publicCode)}>
                <span className="lycee-request-avatar">{`${request.requesterFirstName[0] ?? ""}${request.requesterLastName[0] ?? ""}`}</span>
                <span><strong>{request.subject}</strong><small>{request.requesterFirstName} {request.requesterLastName} · {requesterProfileLabels[request.requesterType] ?? request.requesterType}</small><em>{supportCategoryLabel(request.category)} · {supportSlaLabel(request.slaDueAt)}</em></span>
                {["p1", "p2"].includes(request.priority) ? <b>Urgent</b> : null}
              </button>
            ))}
            {requests.length === 0 ? <div className="lycee-agent-list-empty">Aucune demande ne correspond à ce filtre.</div> : null}
          </div>
          <div className="lycee-agent-pagination"><button type="button" aria-label="Page précédente" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ArrowLeft aria-hidden="true" /></button><span>Page {pagination.page} sur {pagination.totalPages}<small>{pagination.total} {pagination.total > 1 ? "dossiers" : "dossier"}</small></span><button type="button" aria-label="Page suivante" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}><ChevronRight aria-hidden="true" /></button></div>
        </section>
        <article className="lycee-agent-detail">
          {selected && detail ? (
            <>
              <div className="lycee-agent-detail-head"><div><span>{selected.publicCode}</span><h2>{selected.subject}</h2><p>{selected.requesterFirstName} {selected.requesterLastName} · {requesterProfileLabels[selected.requesterType] ?? selected.requesterType}</p></div><div className="lycee-agent-controls"><select aria-label="Priorité" value={selected.priority} disabled={saving} onChange={(event) => void updateRequest({ priority: event.target.value })}><option value="p1">P1 critique</option><option value="p2">P2 urgente</option><option value="p3">P3 normale</option><option value="p4">P4 faible</option></select><select aria-label="Statut" value={selected.status} disabled={saving} onChange={(event) => void updateRequest({ status: event.target.value })}><option value="nouveau">Nouvelle demande</option><option value="a_qualifier">À classer</option><option value="assigne">Assignée</option><option value="en_cours">En cours</option><option value="attente_demandeur">En attente de l’utilisateur</option><option value="attente_interne">Vérification interne</option><option value="resolu">Résolue</option><option value="clos">Fermée</option></select></div></div>
              <div className="lycee-agent-contact-row">{detail.contacts.map((contact) => <span className={contact.isVerified ? "is-verified" : ""} key={contact.id}>{contact.channel === "email" ? <Mail aria-hidden="true" /> : <Phone aria-hidden="true" />}{contact.value}{contact.isVerified ? " · vérifié" : ""}</span>)}<button type="button" disabled={saving || Boolean(selected.assignedTo)} onClick={() => void updateRequest({ assignToMe: true })}>{selected.assignedTo ? "Déjà attribuée" : "Prendre la demande"}</button></div>
              <section className="lycee-agent-identity" data-sensitive={["ent", "email_academique"].includes(selected.category)}><BadgeCheck aria-hidden="true" /><span><strong>{identityStatusLabels[selected.identityStatus]}</strong><small>{["ent", "email_academique"].includes(selected.category) ? "Demande sensible : ne transmettre aucun identifiant avant rapprochement avec une liste officielle." : "Adaptez le contrôle au niveau de sensibilité de la réponse."}</small></span><select aria-label="Niveau de vérification de l’identité" value={selected.identityStatus} disabled={saving} onChange={(event) => { const identityStatus = event.target.value as IdentityStatus; const identityMethod = identityStatus === "identite_confirmee" ? "official_roster" : identityStatus === "contact_verifie" ? (detail.contacts.some((contact) => contact.channel === "email" && contact.isVerified) ? "email_magic_link" : "phone_callback") : undefined; void updateRequest({ identityStatus, identityMethod }); }}><option value="non_verifiee">Coordonnées déclarées</option><option value="contact_verifie">Contact vérifié</option><option value="identite_confirmee">Identité confirmée dans la liste</option></select></section>
              <div className="lycee-agent-thread">{detail.messages.map((message) => <div data-direction={message.direction} key={message.id}><span><strong>{message.authorLabel ?? "Utilisateur"}</strong><small>{supportDate(message.createdAt)} · {supportDeliveryLabel(message.deliveryStatus)}</small></span><p>{message.bodyText}</p></div>)}</div>
              {detail.attachments.length > 0 ? <div className="lycee-tracked-files">{detail.attachments.map((attachment) => <div key={attachment.id}><FileText aria-hidden="true" /><span><strong>{attachment.originalName}</strong><small>{attachment.scanStatus === "clean" ? "Vérifié" : "Contrôle en cours"}</small></span>{attachment.scanStatus === "clean" ? <button type="button" onClick={() => void openAgentAttachment(attachment.id)} aria-label={`Ouvrir ${attachment.originalName}`}><ExternalLink aria-hidden="true" /></button> : null}</div>)}</div> : null}
              <section className="lycee-agent-ai"><div><WandSparkles aria-hidden="true" /><span><span className="lycee-eyebrow">Aide au traitement</span><h3>{supportCategoryLabel(selected.category)} · priorité {selected.priority.toUpperCase()}</h3></span></div><dl><div><dt>Personne</dt><dd>{selected.beneficiaryType === "self" ? "Demandeur" : `${selected.beneficiaryFirstName ?? ""} ${selected.beneficiaryLastName ?? ""}`}</dd></div><div><dt>Canal disponible</dt><dd>{detail.contacts.map((contact) => channelLabels[contact.channel] ?? contact.channel).join(" + ")}</dd></div><div><dt>Langue souhaitée</dt><dd>{languagePreferenceLabels[selected.subjectContext.languagePreference] ?? "Non précisée"}</dd></div><div><dt>Aide à la compréhension</dt><dd>{selected.subjectContext.communicationSupport ?? "Réponse écrite"}</dd></div><div><dt>Pièces</dt><dd>{detail.attachments.length} {detail.attachments.length > 1 ? "documents" : "document"}</dd></div></dl></section>
              <section className="lycee-reply-box"><div><span><Sparkles aria-hidden="true" /> {requiresSafeIdentityReply ? "Consigne de vérification sécurisée" : "Réponse à valider"}</span>{requiresSafeIdentityReply ? null : <button type="button" onClick={() => setReply("Bonjour, votre demande a bien été prise en charge. Nous revenons vers vous dès que la vérification est terminée.")}>Proposer</button>}</div><textarea aria-label="Réponse à envoyer" rows={5} value={requiresSafeIdentityReply ? IDENTITY_VERIFICATION_REPLY : reply} readOnly={requiresSafeIdentityReply} onChange={(event) => setReply(event.target.value)} placeholder="Écrivez une réponse claire. Aucun mot de passe ne doit être demandé." /><div><button className="lycee-secondary-action" type="button" disabled><Paperclip aria-hidden="true" /> Joindre</button><button className="lycee-primary-action" type="button" disabled={saving || (!requiresSafeIdentityReply && !reply.trim())} onClick={() => void sendAgentReply()}><Send aria-hidden="true" /> {saving ? "Enregistrement…" : "Valider et envoyer"}</button></div></section>
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
