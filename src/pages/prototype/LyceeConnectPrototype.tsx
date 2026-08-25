import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleUserRound,
  Clock3,
  ExternalLink,
  FileText,
  Filter,
  GraduationCap,
  Headphones,
  Home,
  Inbox,
  KeyRound,
  Laptop,
  LifeBuoy,
  Mail,
  MapPin,
  Menu,
  MessageCircleMore,
  Mic2,
  Newspaper,
  Paperclip,
  Phone,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  UserRound,
  Users,
  UsersRound,
  WandSparkles,
  Wifi,
} from "lucide-react";
import { supabase } from "../../lib/supabase-browser";
import { apiFetch } from "../../lib/api";
import "./lycee-connect.css";

type View = "home" | "services" | "help" | "requests" | "school" | "agent";
type RequesterProfile = "eleve" | "parent" | "professeur" | "personnel" | "";

const SUPPORT_API_ENABLED = import.meta.env.VITE_SUPPORT_API_ENABLED === "true";
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
    title: "Stages de seconde",
    detail: "Convention, entreprise et suivi",
    icon: BriefcaseBusiness,
    tone: "blue",
    target: "services" as View,
  },
  {
    title: "Grand Oral",
    detail: "Questions, validations et fiche finale",
    icon: Mic2,
    tone: "green",
    target: "services" as View,
  },
  {
    title: "Demander de l'aide",
    detail: "ENT, email, ordinateur ou autre besoin",
    icon: MessageCircleMore,
    tone: "coral",
    target: "help" as View,
  },
  {
    title: "Messagerie du lycée",
    detail: "Communication lorsque le webmail est perturbé",
    icon: Mail,
    tone: "gold",
    target: "services" as View,
  },
];

export default function LyceeConnectPrototype() {
  const [view, setView] = useState<View>("home");
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="lycee-connect">
      <aside className="lycee-sidebar">
        <div className="lycee-brand">
          <img src="/lycee-blaise-logo.png" alt="Lycée Blaise Cendrars" />
          <div>
            <strong>Blaise Cendrars</strong>
            <span>Sevran</span>
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
        </div>

        <button className="lycee-agent-link" type="button" onClick={() => changeView("agent")}>
          <Headphones aria-hidden="true" />
          <span>
            <strong>Espace agent</strong>
            <small>Traiter les demandes</small>
          </span>
          <span className="lycee-agent-count">8</span>
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
            <strong>Blaise Cendrars</strong>
            <span>Mon lycée</span>
          </div>
          <div className="lycee-top-actions">
            <a className="lycee-top-tool" href={LYCEEGEST_URL} title="Ouvrir LyceeGest"><BarChart3 aria-hidden="true" /><span>LyceeGest</span></a>
            <a className="lycee-top-tool" href={WEBMAIL_URL} target="_blank" rel="noreferrer" title="Ouvrir le Webmail"><Mail aria-hidden="true" /><span>Webmail</span></a>
            <button className="lycee-icon-button" type="button" aria-label="Notifications">
              <Bell aria-hidden="true" />
              <span />
            </button>
            <button className="lycee-profile-button" type="button" onClick={() => changeView("agent")}>
              <CircleUserRound aria-hidden="true" />
              <span>Aperçu agent</span>
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
          <img src="/lycee-blaise-facade.png" alt="Façade du Lycée Blaise Cendrars à Sevran" />
          <div className="lycee-hero-shade" />
          <div className="lycee-hero-copy">
            <span>Bonjour</span>
            <h1>Tout votre lycée, dans une seule application.</h1>
            <p>Services scolaires, informations et assistance, sur téléphone comme sur ordinateur.</p>
          </div>
        </section>

        <div className="lycee-content">
          <section className="lycee-core-tools" aria-label="Outils principaux du lycée">
            <a href={LYCEEGEST_URL} data-tool="gest"><span><BarChart3 aria-hidden="true" /></span><div><strong>LyceeGest</strong><small>Stages, Grand Oral et outils de gestion</small></div><em>Ouvrir <ChevronRight aria-hidden="true" /></em></a>
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
                onClick={() => changeView("help")}
              >
                <Send aria-hidden="true" />
                <span>Envoyer</span>
              </button>
            </div>
            <div className="lycee-trust-row">
              <span><ShieldCheck aria-hidden="true" /> Données protégées</span>
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
                <button type="button" data-tone={service.tone} key={service.title} onClick={() => changeView(service.target)}>
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

          <section className="lycee-lower-grid">
            <article className="lycee-news">
              <span><Newspaper aria-hidden="true" /> À la une</span>
              <h2>La rentrée à Blaise Cendrars</h2>
              <p>Horaires, accès rapides et informations importantes du lycée.</p>
              <button type="button" onClick={() => changeView("school")}>Voir les informations <ChevronRight aria-hidden="true" /></button>
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
        {view === "services" && <ServicesView onHelp={() => changeView("help")} onBack={() => changeView("home")} />}
        {view === "school" && <SchoolView onBack={() => changeView("home")} />}
        {view === "agent" && <AgentView onBack={() => changeView("home")} />}

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
  const [profile, setProfile] = useState<RequesterProfile>("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState(initialMessage);
  const [ticketCode, setTicketCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attachmentWarning, setAttachmentWarning] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [requestKey] = useState(() => crypto.randomUUID());

  const profiles = [
    { value: "eleve", label: "Élève", icon: GraduationCap },
    { value: "parent", label: "Parent", icon: UsersRound },
    { value: "professeur", label: "Professeur", icon: UserRound },
    { value: "personnel", label: "Personnel", icon: CircleUserRound },
  ] as const;
  const categories = [
    { value: "ent", label: "Codes ou accès ENT", icon: KeyRound },
    { value: "email_academique", label: "Email académique", icon: Mail },
    { value: "ordinateur", label: "Ordinateur ou logiciel", icon: Laptop },
    { value: "autre", label: "Autre demande", icon: MessageCircleMore },
  ];
  const detectedCategory = /\b(ent|educonnect|connexion|connecter|code|identifiant)\b/i.test(description)
    ? "ent"
    : /\b(email|mail|webmail|zimbra|academique|académique)\b/i.test(description)
      ? "email_academique"
      : /\b(pc|ordinateur|portable|logiciel|wifi)\b/i.test(description)
        ? "ordinateur"
        : "autre";
  const availableCategories = categories.filter(
    (item) => item.value !== "email_academique" || profile === "professeur" || profile === "personnel"
  );
  const suggestedCategory = availableCategories.some((item) => item.value === detectedCategory)
    ? detectedCategory
    : "autre";
  const selectedProfile = profiles.find((item) => item.value === profile);
  const selectedCategory = categories.find((item) => item.value === category);

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !category || !description.trim()) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    if (!email && !phone) {
      setSubmitError("Indiquez un email ou un téléphone pour recevoir la réponse.");
      return;
    }

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
            beneficiaryFirstName:
              profile === "parent" ? form.get("beneficiaryFirstName") : null,
            beneficiaryLastName:
              profile === "parent" ? form.get("beneficiaryLastName") : null,
            className: form.get("className"),
            subjectArea: form.get("subjectArea"),
            schoolTrack: form.get("schoolTrack"),
            category,
            subject: categories.find((item) => item.value === category)?.label,
            description,
            email: form.get("email"),
            phone: form.get("phone"),
            preferredChannel: form.get("preferredChannel"),
            fallbackAllowed: form.get("fallbackAllowed") === "on",
            website: form.get("website"),
          }),
        });
        const payload = (await response.json()) as {
          request?: { publicCode?: string };
          error?: string;
        };
        if (!response.ok || !payload.request?.publicCode) {
          throw new Error(payload.error ?? "La demande n'a pas pu être enregistrée");
        }
        publicCode = payload.request.publicCode;

        if (files.length > 0) {
          const uploads = await Promise.allSettled(
            files.map((file) => uploadSupportFile(publicCode, file))
          );
          const failedCount = uploads.filter((result) => result.status === "rejected").length;
          if (failedCount > 0) {
            setAttachmentWarning(
              `La demande est enregistrée, mais ${failedCount} fichier${failedCount > 1 ? "s" : ""} n'a pas été joint. Vous pourrez le renvoyer depuis le suivi.`
            );
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
        <p>Un agent du lycée va le traiter. Vous pourrez suivre chaque étape avec le numéro ci-dessous.</p>
        <div className="lycee-ticket-code">
          <span>Numéro de demande</span>
          <strong>{ticketCode}</strong>
        </div>
        <div className="lycee-confirmation-note">
          <Mail aria-hidden="true" />
          <span>La confirmation et le lien de suivi seront envoyés par email. Le téléphone reste utilisé seulement si nécessaire.</span>
        </div>
        {attachmentWarning ? <div className="lycee-form-error" role="alert"><CircleAlert aria-hidden="true" />{attachmentWarning}</div> : null}
        <div className="lycee-confirmation-actions">
          <button className="lycee-primary-action" type="button" onClick={onTrack}>Continuer la conversation <ChevronRight aria-hidden="true" /></button>
          <button className="lycee-secondary-action" type="button" onClick={onBack}>Retour à l’accueil</button>
        </div>
      </div>
    );
  }

  return (
    <div className="lycee-page">
      <PageIntro
        eyebrow="Assistant du lycée"
        title="Expliquez, nous nous occupons du reste"
        description="La conversation devient votre dossier. Vous pourrez revenir ici pour lire la réponse et continuer l’échange."
        onBack={onBack}
      />

      <div className="lycee-guided-chat">
        <div className="lycee-guided-chat-head"><span><Bot aria-hidden="true" /></span><div><strong>Assistant Blaise</strong><small>En ligne · réponse suivie par un agent</small></div><em><span /> Disponible</em></div>
        <div className="lycee-guided-thread" aria-live="polite">
          <div data-speaker="assistant"><span><Bot aria-hidden="true" /></span><p>Bonjour. Décrivez votre besoin normalement, sans mot de passe. Je prépare le dossier avec vous et je reste dans cette conversation.</p></div>
          {initialMessage.trim() ? <div data-speaker="requester"><p>{initialMessage.trim()}</p></div> : null}
          <div data-speaker="assistant"><span><Bot aria-hidden="true" /></span><p>{initialMessage.trim() ? "J’ai bien reçu votre message. Pour l’envoyer au bon agent, dites-moi simplement qui vous êtes." : "Commençons par vous identifier pour adapter les questions."}</p></div>
          {profile ? <div data-speaker="requester"><p>Je suis {profile === "eleve" ? "élève" : profile === "professeur" ? "professeur" : profile === "personnel" ? "membre du personnel" : "parent"}.</p></div> : null}
          {profile && !category ? <div data-speaker="assistant"><span><Bot aria-hidden="true" /></span><p>Merci. D’après votre message, je pense à « {categories.find((item) => item.value === suggestedCategory)?.label} ». Confirmez ou choisissez une autre catégorie.</p></div> : null}
          {category ? <><div data-speaker="requester"><p>{selectedCategory?.label}</p></div><div data-speaker="assistant"><span><Bot aria-hidden="true" /></span><p>Parfait. J’ai seulement besoin des coordonnées utiles pour vous répondre et des informations liées à la personne concernée.</p></div></> : null}
        </div>

        <form className="lycee-conversation-form" onSubmit={submitRequest}>
          {!profile ? (
            <fieldset className="lycee-chat-choices">
              <legend>Vous êtes</legend>
              <div className="lycee-profile-grid">
                {profiles.map((item) => (
                  <button type="button" key={item.value} onClick={() => setProfile(item.value)}><item.icon aria-hidden="true" />{item.label}</button>
                ))}
              </div>
            </fieldset>
          ) : null}

          {profile && !category ? (
            <fieldset className="lycee-chat-choices">
              <legend>Votre demande concerne</legend>
              <div className="lycee-category-grid">
                {availableCategories.map((item) => (
                  <button className={item.value === suggestedCategory ? "is-suggested" : ""} type="button" key={item.value} onClick={() => setCategory(item.value)}>
                    <item.icon aria-hidden="true" /><span>{item.label}</span>{item.value === suggestedCategory ? <small>Suggéré</small> : <ChevronRight aria-hidden="true" />}
                  </button>
                ))}
              </div>
              <button className="lycee-chat-change" type="button" onClick={() => setProfile("")}><ArrowLeft aria-hidden="true" /> Modifier mon profil</button>
            </fieldset>
          ) : null}

          {profile && category ? (
          <section className="lycee-chat-details">
            <div className="lycee-chat-selection"><button type="button" onClick={() => { setProfile(""); setCategory(""); }}>{selectedProfile?.label}</button><ChevronRight aria-hidden="true" /><button type="button" onClick={() => setCategory("")}>{selectedCategory?.label}</button></div>
            <div className="lycee-fields-grid">
              <label><span>Votre prénom</span><input name="requesterFirstName" type="text" autoComplete="given-name" placeholder="Votre prénom" disabled={!category} required /></label>
              <label><span>Votre nom</span><input name="requesterLastName" type="text" autoComplete="family-name" placeholder="Votre nom" disabled={!category} required /></label>
              {profile === "parent" ? <><label><span>Prénom de l’élève</span><input name="beneficiaryFirstName" type="text" placeholder="Prénom de l’élève" disabled={!category} required /></label><label><span>Nom de l’élève</span><input name="beneficiaryLastName" type="text" placeholder="Nom de l’élève" disabled={!category} required /></label></> : null}
              {profile === "eleve" || profile === "parent" ? <label><span>Classe</span><input name="className" type="text" placeholder="Ex. 2GT4" disabled={!category} required /></label> : null}
              {profile === "professeur" || profile === "personnel" ? <label><span>Matière ou service</span><input name="subjectArea" type="text" placeholder="Ex. Mathématiques, intendance" disabled={!category} required /></label> : null}
              {profile === "professeur" ? <label><span>Voie</span><select name="schoolTrack" disabled={!category} required><option value="">Sélectionner</option><option value="general">Générale et technologique</option><option value="professionnel">Professionnelle</option><option value="les_deux">Les deux</option></select></label> : null}
              <label><span>Email personnel</span><input name="email" type="email" autoComplete="email" placeholder="nom@exemple.fr" disabled={!category} /></label>
              <label><span>Téléphone</span><input name="phone" type="tel" autoComplete="tel" placeholder="06 00 00 00 00" disabled={!category} /></label>
              <label><span>Réponse souhaitée</span><select name="preferredChannel" disabled={!category} defaultValue="email"><option value="email">Par email</option><option value="phone">Par téléphone</option><option value="web">Dans l’application</option></select></label>
              <label className="lycee-fallback-choice"><input name="fallbackAllowed" type="checkbox" disabled={!category} /><span>Utiliser l’autre moyen de contact si le premier échoue</span></label>
              <label className="is-wide"><span>Expliquez votre demande</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} disabled={!category} placeholder="Décrivez ce qui bloque et ce que vous avez déjà essayé." required /></label>
              <label className="lycee-honeypot" aria-hidden="true"><span>Site web</span><input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
            </div>
            <input
              ref={fileInputRef}
              className="lycee-file-input"
              type="file"
              multiple
              accept={SUPPORT_FILE_TYPES.join(",")}
              onChange={(event) => {
                const selected = Array.from(event.target.files ?? []);
                const invalid = selected.find(
                  (file) => !SUPPORT_FILE_TYPES.includes(file.type) || file.size > MAX_SUPPORT_FILE_BYTES
                );
                if (invalid) {
                  setSubmitError("Formats acceptés : PDF, image, texte, Word ou Excel, jusqu'à 10 Mo.");
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
              }}
            />
            <button className="lycee-attachment-button" type="button" disabled={!category || files.length >= MAX_SUPPORT_FILES} onClick={() => fileInputRef.current?.click()}><Paperclip aria-hidden="true" /> Ajouter une capture ou un document</button>
            {files.length > 0 ? (
              <div className="lycee-selected-files" aria-label="Fichiers à envoyer">
                {files.map((file, index) => (
                  <div key={`${file.name}-${file.lastModified}`}>
                    <FileText aria-hidden="true" />
                    <span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} Mo</small></span>
                    <button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>Retirer</button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
          ) : null}

          {profile && category ? <>
            {description.trim() ? (
              <div className="lycee-ai-summary"><WandSparkles aria-hidden="true" /><span><strong>Dossier prêt à être transmis</strong><small>{selectedCategory?.label} · conversation conservée · réponse dans le suivi</small></span></div>
            ) : null}
            {submitError ? <div className="lycee-form-error" role="alert"><CircleAlert aria-hidden="true" />{submitError}</div> : null}
            <button className="lycee-primary-action lycee-submit-request" type="submit" disabled={submitting || !description.trim()}>
              {submitting ? "Enregistrement…" : "Créer la demande et continuer"} <Send aria-hidden="true" />
            </button>
          </> : null}
        </form>
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
  createdAt: string;
  updatedAt: string;
};

type SupportRequestDetail = {
  request: SupportRequestSummary & {
    requesterType: string;
    beneficiaryType: string;
    preferredChannel: string;
    subjectContext: Record<string, string>;
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
  nouveau: "Nouvelle",
  a_qualifier: "À classer",
  assigne: "Assignée",
  en_cours: "En cours",
  attente_demandeur: "Votre réponse attendue",
  attente_interne: "En attente",
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
  if (remainingMinutes <= 0) return "SLA dépassé";
  if (remainingMinutes < 60) return `SLA ${remainingMinutes} min`;
  return `SLA ${Math.ceil(remainingMinutes / 60)} h`;
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    readApiResponse<{ requests: SupportRequestSummary[] }>(
      fetch("/api/support/requests", { credentials: "include" })
    )
      .then((payload) => {
        if (!active) return;
        setRequests(payload.requests);
        setSelectedCode((current) => current ?? payload.requests[0]?.publicCode ?? null);
      })
      .catch((requestError: Error) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedCode) {
      setDetail(null);
      return;
    }
    let active = true;
    setError(null);
    readApiResponse<SupportRequestDetail>(
      fetch(`/api/support/requests/${selectedCode}`, { credentials: "include" })
    )
      .then((payload) => active && setDetail(payload))
      .catch((requestError: Error) => active && setError(requestError.message));
    return () => { active = false; };
  }, [selectedCode]);

  async function sendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCode || !reply.trim()) return;
    setReplying(true);
    setError(null);
    try {
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
      setDetail(
        await readApiResponse<SupportRequestDetail>(
          await fetch(`/api/support/requests/${selectedCode}`, { credentials: "include" })
        )
      );
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
      <PageIntro eyebrow="Suivi" title="Mes demandes" description="Retrouvez les réponses du lycée et continuez l’échange ici." onBack={onBack} />
      {error ? <div className="lycee-form-error" role="alert"><CircleAlert aria-hidden="true" />{error}</div> : null}
      {loading ? <div className="lycee-loading-state"><Clock3 aria-hidden="true" /> Chargement des demandes…</div> : null}
      {!loading && requests.length === 0 ? (
        <section className="lycee-empty-state"><TicketCheck aria-hidden="true" /><h2>Aucune demande sur cet appareil</h2><p>Une demande apparaîtra ici dès son enregistrement.</p><button type="button" onClick={onBack}>Retour à l’accueil</button></section>
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
                <em>{supportStatusLabels[detail.request.status] ?? detail.request.status}</em>
              </div>
              <div className="lycee-ticket-meta"><span><Users aria-hidden="true" /> {detail.request.requesterType}</span><span><Mail aria-hidden="true" /> Réponse par {detail.request.preferredChannel}</span></div>
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
                <button className="lycee-primary-action" type="submit" disabled={replying || !reply.trim()}>{replying ? "Envoi…" : "Envoyer"}<Send aria-hidden="true" /></button>
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
    { title: "LyceeGest", description: "Stages, Grand Oral et outils de gestion du lycée", icon: BarChart3, color: "blue", progress: "Application complète", action: "Ouvrir LyceeGest", href: LYCEEGEST_URL },
    { title: "Webmail du lycée", description: "Messagerie, contacts et diffusion lorsque Créteil est perturbé", icon: Mail, color: "green", progress: "Communication disponible", action: "Ouvrir le Webmail", href: WEBMAIL_URL, external: true },
    { title: "Stages de seconde", description: "Convention, entreprise, livret et suivi du stage", icon: BriefcaseBusiness, color: "gold", progress: "Module LyceeGest", action: "Ouvrir Stages", href: "/stages" },
    { title: "Grand Oral", description: "Questions, validations des professeurs et fiche officielle", icon: Mic2, color: "green", progress: "Module LyceeGest", action: "Ouvrir Grand Oral", href: "/grand-oral" },
    { title: "Accès ENT et EduConnect", description: "Accès direct et demande de nouveaux codes", icon: KeyRound, color: "blue", progress: "Service externe", action: "Accéder à l’ENT", href: "https://ent.iledefrance.fr/auth/login", external: true },
    { title: "Assistance numérique", description: "Codes, email académique, ordinateur et autres demandes", icon: LifeBuoy, color: "coral", progress: "Conversation suivie", action: "Demander de l’aide", help: true },
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

function SchoolView({ onBack }: { onBack: () => void }) {
  const links = [
    { label: "Monlycée.net", href: "https://ent.iledefrance.fr/auth/login", icon: GraduationCap },
    { label: "EduConnect", href: "https://educonnect.education.gouv.fr/", icon: KeyRound },
    { label: "Parcoursup", href: "https://parcoursup.gouv.fr", icon: FileText },
    { label: "E-sidoc", href: "https://0932048w.esidoc.fr/", icon: Newspaper },
  ];
  return (
    <div className="lycee-page">
      <PageIntro eyebrow="Blaise Cendrars" title="Vie du lycée" description="Les informations essentielles du site du lycée dans une expérience adaptée au téléphone." onBack={onBack} />
      <section className="lycee-school-feature">
        <img src="/lycee-blaise-facade.png" alt="Lycée Blaise Cendrars" />
        <div><span className="lycee-eyebrow">Information importante</span><h2>Organisation de la rentrée</h2><p>Consultez les horaires par niveau et recevez les prochaines mises à jour directement dans l’application.</p><button type="button">Lire l’information <ChevronRight aria-hidden="true" /></button></div>
      </section>
      <div className="lycee-school-stats"><div><strong>1 172</strong><span>élèves</span></div><div><strong>84 %</strong><span>réussite bac général</span></div><div><strong>90 %</strong><span>réussite bac STL</span></div><div><strong>95 %</strong><span>réussite CAP ETL</span></div></div>
      <section className="lycee-quick-links"><div className="lycee-section-title"><div><span className="lycee-eyebrow">Liens utiles</span><h2>Accès rapides</h2></div></div><div>{links.map((link) => <a href={link.href} target="_blank" rel="noreferrer" key={link.label}><link.icon aria-hidden="true" /><span>{link.label}</span><ExternalLink aria-hidden="true" /></a>)}</div></section>
      <section className="lycee-contact-band"><div><MapPin aria-hidden="true" /><span><strong>12 avenue Léon Jouhaux</strong><small>93270 Sevran</small></span></div><div><Phone aria-hidden="true" /><span><strong>01 49 36 20 50</strong><small>Accueil du lycée</small></span></div></section>
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

  async function updateRequest(changes: { status?: string; priority?: string; assignToMe?: boolean }) {
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
    if (!selectedCode || !reply.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`support/agent/requests/${selectedCode}/reply`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ message: reply }),
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

  return (
    <div className="lycee-page lycee-agent-page">
      <PageIntro eyebrow="Espace agent" title="Demandes du lycée" description="Classez, répondez et gardez chaque échange dans le même dossier." onBack={onBack} />
      {error ? <div className="lycee-form-error" role="alert"><CircleAlert aria-hidden="true" />{error}{error.toLowerCase().includes("auth") ? <a href="/login">Se connecter</a> : null}</div> : null}
      <div className="lycee-agent-stats">
        <div><span><Inbox aria-hidden="true" /></span><strong>{stats.new}</strong><small>Nouvelles</small></div>
        <div><span><CircleAlert aria-hidden="true" /></span><strong>{stats.urgent}</strong><small>Urgentes</small></div>
        <div><span><Clock3 aria-hidden="true" /></span><strong>{stats.active}</strong><small>En cours</small></div>
        <div><span><MessageCircleMore aria-hidden="true" /></span><strong>{stats.waitingRequester}</strong><small>Attente usager</small></div>
      </div>
      <div className="lycee-agent-workspace">
        <section className="lycee-agent-queue">
          <div className="lycee-agent-toolbar"><label><Search aria-hidden="true" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Nom, numéro ou objet" /></label><button className={queueMode === "mine" ? "is-active" : ""} type="button" aria-label="Afficher mes demandes" aria-pressed={queueMode === "mine"} title="Afficher mes demandes" onClick={() => { setQueueMode((current) => current === "mine" ? "all" : "mine"); setPage(1); }}><Filter aria-hidden="true" /></button></div>
          <div className="lycee-agent-tabs"><button className={queueMode === "all" ? "is-active" : ""} type="button" onClick={() => { setQueueMode("all"); setPage(1); }}>Toutes <span>{stats.total}</span></button><button className={queueMode === "urgent" ? "is-active" : ""} type="button" onClick={() => { setQueueMode("urgent"); setPage(1); }}>Urgentes <span>{stats.urgent}</span></button></div>
          <div className="lycee-agent-list">
            {requests.map((request) => (
              <button className={selectedCode === request.publicCode ? "is-selected" : ""} type="button" key={request.publicCode} onClick={() => setSelectedCode(request.publicCode)}>
                <span className="lycee-request-avatar">{`${request.requesterFirstName[0] ?? ""}${request.requesterLastName[0] ?? ""}`}</span>
                <span><strong>{request.subject}</strong><small>{request.requesterFirstName} {request.requesterLastName} · {request.requesterType}</small><em>{request.category} · {supportSlaLabel(request.slaDueAt)}</em></span>
                {["p1", "p2"].includes(request.priority) ? <b>Urgent</b> : null}
              </button>
            ))}
            {requests.length === 0 ? <div className="lycee-agent-list-empty">Aucune demande ne correspond à ce filtre.</div> : null}
          </div>
          <div className="lycee-agent-pagination"><button type="button" aria-label="Page précédente" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ArrowLeft aria-hidden="true" /></button><span>Page {pagination.page} sur {pagination.totalPages}<small>{pagination.total} dossier(s)</small></span><button type="button" aria-label="Page suivante" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}><ChevronRight aria-hidden="true" /></button></div>
        </section>
        <article className="lycee-agent-detail">
          {selected && detail ? (
            <>
              <div className="lycee-agent-detail-head"><div><span>{selected.publicCode}</span><h2>{selected.subject}</h2><p>{selected.requesterFirstName} {selected.requesterLastName} · {selected.requesterType}</p></div><div className="lycee-agent-controls"><select aria-label="Priorité" value={selected.priority} disabled={saving} onChange={(event) => void updateRequest({ priority: event.target.value })}><option value="p1">P1 critique</option><option value="p2">P2 urgente</option><option value="p3">P3 normale</option><option value="p4">P4 faible</option></select><select aria-label="Statut" value={selected.status} disabled={saving} onChange={(event) => void updateRequest({ status: event.target.value })}><option value="nouveau">Nouvelle</option><option value="a_qualifier">À classer</option><option value="assigne">Assignée</option><option value="en_cours">En cours</option><option value="attente_demandeur">Attente usager</option><option value="attente_interne">Attente interne</option><option value="resolu">Résolue</option><option value="clos">Fermée</option></select></div></div>
              <div className="lycee-agent-contact-row">{detail.contacts.map((contact) => <span key={contact.id}>{contact.channel === "email" ? <Mail aria-hidden="true" /> : <Phone aria-hidden="true" />}{contact.value}</span>)}<button type="button" disabled={saving || Boolean(selected.assignedTo)} onClick={() => void updateRequest({ assignToMe: true })}>{selected.assignedTo ? "Déjà attribuée" : "Prendre la demande"}</button></div>
              <div className="lycee-agent-thread">{detail.messages.map((message) => <div data-direction={message.direction} key={message.id}><span><strong>{message.authorLabel ?? "Usager"}</strong><small>{supportDate(message.createdAt)} · {message.deliveryStatus}</small></span><p>{message.bodyText}</p></div>)}</div>
              {detail.attachments.length > 0 ? <div className="lycee-tracked-files">{detail.attachments.map((attachment) => <div key={attachment.id}><FileText aria-hidden="true" /><span><strong>{attachment.originalName}</strong><small>{attachment.scanStatus === "clean" ? "Vérifié" : "Contrôle en cours"}</small></span>{attachment.scanStatus === "clean" ? <button type="button" onClick={() => void openAgentAttachment(attachment.id)} aria-label={`Ouvrir ${attachment.originalName}`}><ExternalLink aria-hidden="true" /></button> : null}</div>)}</div> : null}
              <section className="lycee-agent-ai"><div><WandSparkles aria-hidden="true" /><span><span className="lycee-eyebrow">Aide au traitement</span><h3>{selected.category} · priorité {selected.priority.toUpperCase()}</h3></span></div><dl><div><dt>Personne</dt><dd>{selected.beneficiaryType === "self" ? "Demandeur" : `${selected.beneficiaryFirstName ?? ""} ${selected.beneficiaryLastName ?? ""}`}</dd></div><div><dt>Canal disponible</dt><dd>{detail.contacts.map((contact) => contact.channel).join(" + ")}</dd></div><div><dt>Pièces</dt><dd>{detail.attachments.length} document(s)</dd></div></dl></section>
              <section className="lycee-reply-box"><div><span><Sparkles aria-hidden="true" /> Réponse à valider</span><button type="button" onClick={() => setReply("Bonjour, votre demande a bien été prise en charge. Nous revenons vers vous dès que la vérification est terminée.")}>Proposer</button></div><textarea aria-label="Réponse à envoyer" rows={5} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Écrivez une réponse claire. Aucun mot de passe ne doit être demandé." /><div><button className="lycee-secondary-action" type="button" disabled><Paperclip aria-hidden="true" /> Joindre</button><button className="lycee-primary-action" type="button" disabled={saving || !reply.trim()} onClick={() => void sendAgentReply()}><Send aria-hidden="true" /> {saving ? "Enregistrement…" : "Valider et envoyer"}</button></div></section>
            </>
          ) : <div className="lycee-loading-state"><Clock3 aria-hidden="true" /> Sélectionnez une demande</div>}
        </article>
      </div>
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
      <section className="lycee-agent-mail"><div><Mail aria-hidden="true" /><span><strong>Communication direction</strong><small>Envoyer une information aux professeurs et personnels depuis la messagerie du lycée.</small></span></div><a href={WEBMAIL_ADMIN_URL} target="_blank" rel="noreferrer">Ouvrir <ExternalLink aria-hidden="true" /></a></section>
    </div>
  );
}
