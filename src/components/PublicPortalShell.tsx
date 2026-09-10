import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BarChart3, ChevronRight, CircleUserRound, Download, ExternalLink, GraduationCap, Headphones, Home, LifeBuoy, Mail, Menu, Newspaper, ShieldCheck, Smartphone, TicketCheck } from "lucide-react";
import { PublicPortalFooter } from "./PublicPortalFooter";
import { FlashPublicBulletin } from "./FlashPublicBulletin";
import type { PublicPortalView as View } from "../../shared/public-portal-navigation";
import "../pages/prototype/lycee-connect.css";
import "../styles/portal-charter.css";

const LYCEEGEST_URL = "/login";
const WEBMAIL_URL = "https://mail.lycee-blaise-cendrars-sevran.fr/";
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const navigation = [
  { label: "Accueil", icon: Home, view: "home" as View },
  { label: "Mes services", icon: GraduationCap, view: "services" as View },
  { label: "Aide et demandes", icon: LifeBuoy, view: "help" as View },
  { label: "Mes demandes", icon: TicketCheck, view: "requests" as View },
  { label: "Vie du lycée", icon: Newspaper, view: "school" as View },
];


/** Shared public navigation. Identity, conversations and data stay in their pages. */
export function PublicPortalShell({view, onNavigate, children, className = ""}: {
  view: View; onNavigate?: (view: View) => void; children: ReactNode; className?: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installAvailable, setInstallAvailable] = useState(false);
  const [installNotice, setInstallNotice] = useState<string | null>(null);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    const mobileDevice = /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);
    setInstallAvailable(!standalone && mobileDevice);
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setInstallAvailable(true);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setInstallAvailable(false);
      setInstallNotice("L’application Blaise Cendrars est installée sur cet appareil.");
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      document.querySelector<HTMLButtonElement>(".lycee-menu-button")?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);


  useEffect(() => { setMenuOpen(false); }, [location.key]);
  function changeView(nextView: View) {
    setMenuOpen(false);
    if (onNavigate) onNavigate(nextView);
    else navigate(nextView === "home" ? "/" : "/?view=" + nextView);
  }
  function openAgentLogin() {
    const returnTo = encodeURIComponent("/prototype?view=agent");
    window.location.assign(`/login?returnTo=${returnTo}&mode=staff`);
  }

  async function installPortalApp() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstallPrompt(null);
        setInstallAvailable(false);
      }
      return;
    }
    const appleDevice = /iPhone|iPad|iPod/i.test(window.navigator.userAgent);
    setInstallNotice(appleDevice
      ? "Sur iPhone ou iPad : ouvrez le menu Partager de Safari, puis choisissez « Sur l’écran d’accueil » et « Ajouter »."
      : "Ouvrez le menu de votre navigateur, puis choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil »."
    );
  }


  return (
    <div className={`lycee-connect ${className}`} data-view={view}>
      <a className="lycee-skip-link" href="#lycee-main">Aller au contenu</a>
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
              aria-current={view === item.view ? "page" : undefined}
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

        <button className="lycee-agent-link" type="button" onClick={openAgentLogin}>
          <Headphones aria-hidden="true" />
          <span>
            <strong>Espace agent</strong>
            <small>Connexion professionnelle</small>
          </span>
        </button>

        <div className="lycee-sidebar-status">
          <span className="lycee-live-dot" />
          <div>
            <strong>Portail du lycée</strong>
            <span>Demandes en ligne · accueil sur rendez-vous</span>
          </div>
        </div>
      </aside>

      <div className="lycee-workspace" role="main" id="lycee-main" tabIndex={-1}>
        <header className="lycee-topbar">
          <button
            className="lycee-menu-button"
            type="button"
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-controls="lycee-mobile-menu"
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
            {installAvailable ? <button className="lycee-top-tool lycee-install-button" type="button" aria-label="Installer l’application du lycée" onClick={() => void installPortalApp()} title="Installer l’application du lycée"><Download aria-hidden="true" /><span>Installer</span></button> : null}
            <a className="lycee-top-tool" href={WEBMAIL_URL} target="_blank" rel="noreferrer" title="Ouvrir le Webmail"><Mail aria-hidden="true" /><span>Webmail</span></a>
            <button className="lycee-profile-button" type="button" aria-label="Se connecter à l’espace agent" onClick={openAgentLogin}>
              <CircleUserRound aria-hidden="true" />
              <span>Espace agent</span>
            </button>
          </div>
        </header>

        {menuOpen && (
          <nav id="lycee-mobile-menu" className="lycee-mobile-menu" aria-label="Menu mobile">
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
            <button type="button" onClick={() => changeView("news")}><Newspaper aria-hidden="true" /> À la une</button>
            <a href={WEBMAIL_URL} target="_blank" rel="noreferrer"><Mail aria-hidden="true" /> Webmail du lycée</a>
            <a href={LYCEEGEST_URL}><BarChart3 aria-hidden="true" /> LyceeGest · Stages et Grand Oral</a>
          </nav>
        )}

        {installNotice ? (
          <div className="lycee-install-notice" role="status">
            <Smartphone aria-hidden="true" />
            <span>{installNotice}</span>
            <button type="button" onClick={() => setInstallNotice(null)}>Fermer</button>
          </div>
        ) : null}

        {view !== "agent" ? <FlashPublicBulletin /> : null}


        {children}
        {view !== "agent" ? <PublicPortalFooter /> : null}

        <nav className="lycee-bottom-nav" aria-label="Navigation mobile">
          {navigation.map((item, index) => (
            <button
              className={view === item.view ? "is-active" : ""}
              aria-current={view === item.view ? "page" : undefined}
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
