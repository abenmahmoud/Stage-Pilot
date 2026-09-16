import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, CircleHelp, ExternalLink, Laptop, MessageCircleMore, ShieldCheck } from "lucide-react";
import { PublicPortalShell } from "../../components/PublicPortalShell";
import { REGIONAL_DEVICE_SAV, REGIONAL_DEVICE_SAV_UPDATED_AT } from "../../../shared/regional-device-sav";
import "./lycee-connect.css";
import "./chromebook.css";
import "./regional-device-sav.css";

export default function RegionalDeviceSavPage() {
  useEffect(() => { document.title = "Aide et SAV des ordinateurs · Lycée Blaise Cendrars"; }, []);
  return <PublicPortalShell view="services" className="cb-page sav-page">
    <div className="cb-main sav-main">
      <Link to="/?view=services" className="lycee-breadcrumb"><ArrowLeft aria-hidden="true" /> Mes services</Link>
      <header className="sav-hero">
        <p className="cb-eyebrow">Ordinateurs de la Région · Guide 2026-2027</p>
        <h1>Un ordinateur en panne ?</h1>
        <p>Choisissez le modèle pour trouver le bon service. Le lycée vous aide si l’accès ou la démarche vous bloque.</p>
        <div className="sav-hero-actions"><a className="cb-primary" href="#unowhy">PC UNOWHY <ArrowRight aria-hidden="true" /></a><a className="cb-secondary" href="#asus">Chromebook ASUS <ArrowRight aria-hidden="true" /></a></div>
      </header>

      <section className="sav-model-grid" aria-label="Choisir mon ordinateur">
        <a href="#unowhy"><span className="sav-model-icon"><Laptop aria-hidden="true" /></span><small>PC Windows</small><strong>UNOWHY Y13</strong><span>Demande depuis l’ENT avec La Poste SAV</span><ArrowRight aria-hidden="true" /></a>
        <a href="#asus"><span className="sav-model-icon"><Laptop aria-hidden="true" /></span><small>ChromeOS</small><strong>Chromebook ASUS</strong><span>Diagnostic sur le portail de la Région</span><ArrowRight aria-hidden="true" /></a>
      </section>

      <section id="unowhy" className="sav-panel" aria-labelledby="unowhy-title">
        <div className="sav-panel-head"><div><p className="cb-eyebrow">PC UNOWHY · Première, terminale et autres élèves déjà dotés</p><h2 id="unowhy-title">La demande se fait depuis Monlycée.net</h2></div><span className="sav-panel-index">01</span></div>
        <ol className="sav-steps">{REGIONAL_DEVICE_SAV.unowhy.steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol>
        <div className="sav-actions"><a className="cb-primary" href={REGIONAL_DEVICE_SAV.unowhy.officialUrl} target="_blank" rel="noreferrer">Ouvrir Monlycée.net <ExternalLink aria-hidden="true" /></a><a className="cb-secondary" href={REGIONAL_DEVICE_SAV.unowhy.faqUrl} target="_blank" rel="noreferrer">FAQ UNOWHY <ExternalLink aria-hidden="true" /></a></div>
        <p className="sav-note">Le chat UNOWHY est fermé depuis le 30 avril 2026. Pour un élève encore au lycée, utilisez « La Poste SAV » dans l’ENT. Les anciens élèves peuvent consulter <a href={REGIONAL_DEVICE_SAV.unowhy.formerStudentUrl} target="_blank" rel="noreferrer">la page de contact UNOWHY</a> si leur appareil est encore sous garantie.</p>
      </section>

      <section id="asus" className="sav-panel" aria-labelledby="asus-title">
        <div className="sav-panel-head"><div><p className="cb-eyebrow">Chromebook ASUS · Élèves dotés en 2026 et personnels concernés</p><h2 id="asus-title">Commencer par le diagnostic régional</h2></div><span className="sav-panel-index">02</span></div>
        <p className="sav-panel-lead">{REGIONAL_DEVICE_SAV.asus.summary}</p>
        <div className="sav-actions"><a className="cb-primary" href={REGIONAL_DEVICE_SAV.asus.portalUrl} target="_blank" rel="noreferrer">Portail MonOrdi IdF <ExternalLink aria-hidden="true" /></a><Link className="cb-secondary" to="/chromebook#sav">Guide Chromebook <ArrowRight aria-hidden="true" /></Link></div>
        <p className="sav-note">Le lieu de retour et les conditions de prise en charge sont confirmés par le SAV après diagnostic. Ne déposez pas l’appareil au lycée sans consigne.</p>
      </section>

      <section className="sav-help" aria-labelledby="sav-help-title">
        <div><span className="sav-help-icon"><MessageCircleMore aria-hidden="true" /></span><p className="cb-eyebrow">Une aide adaptée</p><h2 id="sav-help-title">Une étape vous bloque ?</h2><p>Expliquez le modèle et ce qui ne fonctionne pas dans le chat. Blaise vous guide. Si une action du lycée est nécessaire, il prépare une demande que vous confirmez, avec les vérifications déjà faites.</p><Link className="cb-primary" to="/?view=help">Demander de l’aide <ArrowUpRight aria-hidden="true" /></Link></div>
        <div className="sav-help-secondary"><CircleHelp aria-hidden="true" /><h3>Si vous ne pouvez pas accéder à l’ENT</h3><p>Indiquez ce qui vous bloque, sans communiquer votre mot de passe ni un code reçu. Le lycée pourra examiner votre accès et vous répondre dans votre dossier.</p></div>
      </section>

      <section className="sav-roles" aria-labelledby="sav-roles-title"><p className="cb-eyebrow">Qui fait quoi ?</p><h2 id="sav-roles-title">Un circuit clair, du début à la fin</h2><div className="sav-role-grid">
        <article><strong>Élève ou famille</strong><p>Choisit le bon parcours, ouvre la demande de SAV auprès du service régional et suit ses consignes.</p></article>
        <article><strong>Assistant du lycée</strong><p>Explique la démarche et prépare un dossier si un accès ou une situation locale bloque. Il ne déclare pas une réparation à votre place.</p></article>
        <article><strong>Coordination numérique du lycée</strong><p>Oriente ponctuellement, suit les blocages récurrents et fait le lien avec les prestataires régionaux. L’accueil individuel se fait sur rendez-vous confirmé par le lycée.</p></article>
      </div><p className="sav-roles-foot">Les questions de pédagogie numérique des enseignants relèvent du RRUPN, une fonction distincte de la coordination régionale. Le lieu de remise des appareils après SAV sera communiqué lorsque l’organisation locale sera confirmée.</p></section>

      <p className="cb-source-note"><ShieldCheck aria-hidden="true" /><span>Sources : <a href={REGIONAL_DEVICE_SAV.unowhy.faqUrl} target="_blank" rel="noreferrer">FAQ UNOWHY</a> et <a href="https://lycees.iledefrance.fr/fr/services-numeriques" target="_blank" rel="noreferrer">services numériques de la Région</a>. Mise à jour : {new Date(`${REGIONAL_DEVICE_SAV_UPDATED_AT}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}. Pour une situation individuelle, seules les consignes du SAV et du lycée confirment la suite.</span></p>
    </div>
  </PublicPortalShell>;
}
