import { useState } from "react";
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
import "./lycee-connect.css";

type View = "home" | "services" | "help" | "requests" | "school" | "agent";
type RequesterProfile = "eleve" | "parent" | "professeur" | "personnel" | "";

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
  const [ticketCreated, setTicketCreated] = useState(false);

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
          <section className="lycee-assistant" aria-labelledby="lycee-assistant-title">
            <div className="lycee-assistant-heading">
              <span className="lycee-ai-icon"><Bot aria-hidden="true" /></span>
              <div>
                <span className="lycee-eyebrow">Assistant du lycée</span>
                <h2 id="lycee-assistant-title">De quoi avez-vous besoin&nbsp;?</h2>
              </div>
              <span className="lycee-ai-status"><Sparkles aria-hidden="true" /> IA active</span>
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
                <span>Commencer</span>
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
            onTicketCreated={() => setTicketCreated(true)}
            onTrack={() => changeView("requests")}
          />
        )}
        {view === "requests" && <RequestsView ticketCreated={ticketCreated} onBack={() => changeView("home")} />}
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
  onTicketCreated: () => void;
  onTrack: () => void;
}) {
  const [profile, setProfile] = useState<RequesterProfile>("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState(initialMessage);
  const [submitted, setSubmitted] = useState(false);

  const profiles = [
    { value: "eleve", label: "Élève", icon: GraduationCap },
    { value: "parent", label: "Parent", icon: UsersRound },
    { value: "professeur", label: "Professeur", icon: UserRound },
    { value: "personnel", label: "Personnel", icon: CircleUserRound },
  ] as const;
  const categories = [
    { value: "ent", label: "Codes ou accès ENT", icon: KeyRound },
    { value: "mail", label: "Email académique", icon: Mail },
    { value: "pc", label: "Ordinateur ou logiciel", icon: Laptop },
    { value: "other", label: "Autre demande", icon: MessageCircleMore },
  ];

  function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !category || !description.trim()) return;
    setSubmitted(true);
    onTicketCreated();
  }

  if (submitted) {
    return (
      <div className="lycee-page lycee-confirmation-view">
        <div className="lycee-confirmation-mark"><CheckCircle2 aria-hidden="true" /></div>
        <span className="lycee-eyebrow">Demande transmise</span>
        <h1>Votre dossier est créé.</h1>
        <p>Un agent du lycée va le traiter. Vous pourrez suivre chaque étape avec le numéro ci-dessous.</p>
        <div className="lycee-ticket-code">
          <span>Numéro de demande</span>
          <strong>BC-2026-0042</strong>
        </div>
        <div className="lycee-confirmation-note">
          <Mail aria-hidden="true" />
          <span>La confirmation et le lien de suivi seront envoyés par email. Le téléphone reste utilisé seulement si nécessaire.</span>
        </div>
        <div className="lycee-confirmation-actions">
          <button className="lycee-primary-action" type="button" onClick={onTrack}>Suivre ma demande <ChevronRight aria-hidden="true" /></button>
          <button className="lycee-secondary-action" type="button" onClick={onBack}>Retour à l’accueil</button>
        </div>
      </div>
    );
  }

  return (
    <div className="lycee-page">
      <PageIntro
        eyebrow="Guichet numérique"
        title="Obtenir de l’aide simplement"
        description="Répondez à quelques questions. L’assistant prépare une demande claire et l’envoie au bon agent."
        onBack={onBack}
      />

      <div className="lycee-help-layout">
        <aside className="lycee-help-ai">
          <div className="lycee-help-ai-title"><Bot aria-hidden="true" /><span><strong>Assistant Blaise</strong><small>Disponible maintenant</small></span></div>
          <div className="lycee-chat-bubble">Bonjour, je vais vous aider. Aucun mot de passe ne vous sera demandé.</div>
          {profile ? <div className="lycee-chat-bubble">Très bien, vous êtes {profile === "eleve" ? "élève" : profile}. Quel service faut-il contacter&nbsp;?</div> : null}
          {category ? <div className="lycee-chat-bubble is-highlight">J’ai classé votre besoin dans «&nbsp;{categories.find((item) => item.value === category)?.label}&nbsp;».</div> : null}
          <div className="lycee-ai-guardrail"><ShieldCheck aria-hidden="true" /><span><strong>Réponse humaine</strong><small>L’IA organise. Un agent valide la réponse.</small></span></div>
        </aside>

        <form className="lycee-request-form" onSubmit={submitRequest}>
          <section>
            <div className="lycee-form-heading"><span>1</span><div><h2>Qui êtes-vous&nbsp;?</h2><p>Pour adapter les informations demandées.</p></div></div>
            <div className="lycee-profile-grid">
              {profiles.map((item) => (
                <button className={profile === item.value ? "is-selected" : ""} type="button" key={item.value} onClick={() => setProfile(item.value)}>
                  <item.icon aria-hidden="true" />{item.label}
                </button>
              ))}
            </div>
          </section>

          <section className={!profile ? "is-muted" : ""}>
            <div className="lycee-form-heading"><span>2</span><div><h2>Quel est votre besoin&nbsp;?</h2><p>Choisissez la catégorie la plus proche.</p></div></div>
            <div className="lycee-category-grid">
              {categories
                .filter((item) => item.value !== "mail" || profile === "professeur" || profile === "personnel")
                .map((item) => (
                  <button className={category === item.value ? "is-selected" : ""} disabled={!profile} type="button" key={item.value} onClick={() => setCategory(item.value)}>
                    <item.icon aria-hidden="true" /><span>{item.label}</span><CheckCircle2 aria-hidden="true" />
                  </button>
                ))}
            </div>
          </section>

          <section className={!category ? "is-muted" : ""}>
            <div className="lycee-form-heading"><span>3</span><div><h2>Vos informations</h2><p>Seulement ce qui permet de vous répondre.</p></div></div>
            <div className="lycee-fields-grid">
              <label><span>Prénom</span><input type="text" placeholder="Votre prénom" disabled={!category} required /></label>
              <label><span>Nom</span><input type="text" placeholder="Votre nom" disabled={!category} required /></label>
              {profile === "eleve" ? <label><span>Classe</span><input type="text" placeholder="Ex. 2GT4" disabled={!category} required /></label> : null}
              <label><span>Email</span><input type="email" placeholder="nom@exemple.fr" disabled={!category} /></label>
              <label><span>Téléphone</span><input type="tel" placeholder="06 00 00 00 00" disabled={!category} /></label>
              <label className="is-wide"><span>Expliquez votre demande</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} disabled={!category} placeholder="Décrivez ce qui bloque et ce que vous avez déjà essayé." required /></label>
            </div>
            <button className="lycee-attachment-button" type="button" disabled={!category}><Paperclip aria-hidden="true" /> Ajouter une capture ou un document</button>
          </section>

          {profile && category && description.trim() ? (
            <div className="lycee-ai-summary"><WandSparkles aria-hidden="true" /><span><strong>Résumé automatique prêt</strong><small>{categories.find((item) => item.value === category)?.label} · demande standard · réponse par email</small></span></div>
          ) : null}

          <button className="lycee-primary-action lycee-submit-request" type="submit" disabled={!profile || !category || !description.trim()}>
            Envoyer ma demande <Send aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
}

function RequestsView({ ticketCreated, onBack }: { ticketCreated: boolean; onBack: () => void }) {
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
            <span><strong>{ticketCreated ? "Accès ENT de mon enfant" : "Je n’arrive plus à accéder à l’ENT"}</strong><small>BC-2026-0042 · Aujourd’hui</small></span>
            <em>En cours</em>
          </button>
        </section>
        <article className="lycee-ticket-detail">
          <div className="lycee-ticket-detail-head">
            <div><span>BC-2026-0042</span><h2>{ticketCreated ? "Accès ENT de mon enfant" : "Problème de connexion ENT"}</h2></div>
            <em>En cours de traitement</em>
          </div>
          <div className="lycee-ticket-meta"><span><Users aria-hidden="true" /> Parent d’élève</span><span><Mail aria-hidden="true" /> Réponse par email</span></div>
          <div className="lycee-timeline">
            <div className="is-done"><span><CheckCircle2 aria-hidden="true" /></span><div><strong>Demande reçue</strong><small>Aujourd’hui à 09:12</small><p>Votre demande a bien été enregistrée.</p></div></div>
            <div className="is-current"><span><Sparkles aria-hidden="true" /></span><div><strong>Classée automatiquement</strong><small>Aujourd’hui à 09:13</small><p>Catégorie : accès ENT · priorité normale.</p></div></div>
            <div><span><Clock3 aria-hidden="true" /></span><div><strong>Traitement par un agent</strong><small>En cours</small><p>Une réponse est en préparation.</p></div></div>
            <div><span><Mail aria-hidden="true" /></span><div><strong>Réponse envoyée</strong><small>À venir</small></div></div>
          </div>
          <div className="lycee-ticket-message"><Bot aria-hidden="true" /><span><strong>Vous n’avez rien à refaire.</strong><p>Vous recevrez une notification dès que l’agent aura répondu.</p></span></div>
        </article>
      </div>
    </div>
  );
}

function ServicesView({ onHelp, onBack }: { onHelp: () => void; onBack: () => void }) {
  const serviceGroups = [
    { title: "Stages de seconde", description: "Convention et suivi du stage du 15 au 26 juin 2026", icon: BriefcaseBusiness, color: "blue", progress: "68 % complétés", action: "Ouvrir Stages" },
    { title: "Grand Oral", description: "Questions, validations des professeurs et fiche officielle", icon: Mic2, color: "green", progress: "42 % finalisés", action: "Ouvrir Grand Oral" },
    { title: "Accès ENT et EduConnect", description: "Liens directs et demande de nouveaux codes", icon: KeyRound, color: "gold", progress: "Service disponible", action: "Accéder à l’ENT" },
    { title: "Assistance numérique", description: "Codes, email académique, ordinateur et logiciels", icon: LifeBuoy, color: "coral", progress: "Réponse suivie", action: "Demander de l’aide" },
  ];
  return (
    <div className="lycee-page">
      <PageIntro eyebrow="Application lycée" title="Mes services" description="Les outils déjà présents dans Gest et les nouveaux services du lycée, réunis au même endroit." onBack={onBack} />
      <div className="lycee-services-catalog">
        {serviceGroups.map((service, index) => (
          <article data-tone={service.color} key={service.title}>
            <span className="lycee-catalog-icon"><service.icon aria-hidden="true" /></span>
            <div><h2>{service.title}</h2><p>{service.description}</p><small>{service.progress}</small></div>
            <button type="button" onClick={index === 3 ? onHelp : undefined}>{service.action}<ChevronRight aria-hidden="true" /></button>
          </article>
        ))}
      </div>
      <section className="lycee-mail-bridge">
        <div><Mail aria-hidden="true" /><span><span className="lycee-eyebrow">Direction</span><h2>Messagerie du lycée</h2><p>Diffuser une information aux personnels même lorsque le webmail académique est indisponible.</p></span></div>
        <a href="https://mail.lycee-blaise-cendrars-sevran.fr/admin" target="_blank" rel="noreferrer">Ouvrir la messagerie <ExternalLink aria-hidden="true" /></a>
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

function AgentView({ onBack }: { onBack: () => void }) {
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
      <section className="lycee-agent-mail"><div><Mail aria-hidden="true" /><span><strong>Communication direction</strong><small>Envoyer une information aux professeurs et personnels depuis la messagerie du lycée.</small></span></div><a href="https://mail.lycee-blaise-cendrars-sevran.fr/admin" target="_blank" rel="noreferrer">Ouvrir <ExternalLink aria-hidden="true" /></a></section>
    </div>
  );
}
