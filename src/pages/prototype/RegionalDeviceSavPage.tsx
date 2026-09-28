import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Box, Check, CircleHelp, Clock3,
  ExternalLink, FileCheck2, HardDrive, Headphones, Laptop, MailCheck,
  MapPinCheck, MessageCircleMore, PackageCheck, ShieldCheck, Wrench,
} from "lucide-react";
import { PublicPortalShell } from "../../components/PublicPortalShell";
import { REGIONAL_DEVICE_SAV, REGIONAL_DEVICE_SAV_UPDATED_AT } from "../../../shared/regional-device-sav";
import "./lycee-connect.css";
import "./chromebook.css";
import "./regional-device-sav.css";

const asusIcons = [Headphones, FileCheck2, Clock3, MapPinCheck, PackageCheck];

export default function RegionalDeviceSavPage() {
  useEffect(() => { document.title = "SAV des ordinateurs Région · Lycée Blaise Cendrars"; }, []);
  return <PublicPortalShell view="services" className="cb-page sav-page">
    <div className="cb-main sav-main">
      <Link to="/?view=services" className="lycee-breadcrumb"><ArrowLeft aria-hidden="true" /> Mes services</Link>

      <header className="sav-hero">
        <div className="sav-hero-copy">
          <p className="cb-eyebrow">Ordinateurs de la Région · Guide officiel</p>
          <h1>Mon ordinateur a un problème</h1>
          <p>Repérez votre appareil. Le site vous indique ensuite le bon service, les éléments à préparer et le moment où vous pouvez vous déplacer.</p>
          <a className="cb-primary" href="#choisir">Choisir mon ordinateur <ArrowRight aria-hidden="true" /></a>
        </div>
        <div className="sav-hero-visual" aria-hidden="true">
          <span className="sav-visual-ring" />
          <Laptop />
          <span className="sav-visual-check"><Check /></span>
        </div>
      </header>

      <section id="choisir" className="sav-choice" aria-labelledby="sav-choice-title">
        <p className="cb-eyebrow">Une seule question</p>
        <h2 id="sav-choice-title">Quel ordinateur utilisez-vous ?</h2>
        <div className="sav-model-grid">
          <a href="#asus" className="sav-model-card sav-model-card-asus">
            <span className="sav-model-icon"><Laptop aria-hidden="true" /></span>
            <small>{REGIONAL_DEVICE_SAV.asus.period}</small>
            <strong>{REGIONAL_DEVICE_SAV.asus.name}</strong>
            <span>Mon Ordi → diagnostic → accord RMA → FNAC partenaire</span>
            <b>Voir la procédure <ArrowRight aria-hidden="true" /></b>
          </a>
          <a href="#unowhy" className="sav-model-card sav-model-card-unowhy">
            <span className="sav-model-icon"><HardDrive aria-hidden="true" /></span>
            <small>{REGIONAL_DEVICE_SAV.unowhy.period}</small>
            <strong>{REGIONAL_DEVICE_SAV.unowhy.name}</strong>
            <span>Monlycée.net → La Poste SAV → dossier → retour au lycée</span>
            <b>Voir la procédure <ArrowRight aria-hidden="true" /></b>
          </a>
        </div>
      </section>

      <section className="sav-prep" aria-labelledby="sav-prep-title">
        <div><span className="sav-prep-icon"><Box aria-hidden="true" /></span><p className="cb-eyebrow">Avant de commencer</p><h2 id="sav-prep-title">Préparez quatre éléments</h2></div>
        <ul>{REGIONAL_DEVICE_SAV.common.prepare.map(item => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul>
      </section>

      <section id="asus" className="sav-panel sav-panel-asus" aria-labelledby="asus-title">
        <div className="sav-panel-head"><div><p className="cb-eyebrow">{REGIONAL_DEVICE_SAV.asus.period}</p><h2 id="asus-title">Chromebook ASUS : commencez sur Mon Ordi</h2></div><span className="sav-device-pill">ASUS</span></div>
        <p className="sav-panel-lead">{REGIONAL_DEVICE_SAV.asus.summary}</p>
        <ol className="sav-flow sav-flow-asus">{REGIONAL_DEVICE_SAV.asus.steps.map((step, index) => {
          const Icon = asusIcons[index];
          return <li key={step}><span className="sav-flow-icon"><Icon aria-hidden="true" /></span><div><small>Étape {index + 1}</small><p>{step}</p></div></li>;
        })}</ol>
        <div className="sav-callout sav-callout-warning"><Clock3 aria-hidden="true" /><p><strong>Attendez l’accord RMA.</strong> Ne vous rendez pas en magasin avant de l’avoir reçu. Les 48 heures ouvrées concernent la validation du dossier, pas la réparation.</p></div>
        <div className="sav-actions"><a className="cb-primary" href={REGIONAL_DEVICE_SAV.asus.portalUrl} target="_blank" rel="noreferrer">Démarrer le SAV ASUS <ExternalLink aria-hidden="true" /></a><Link className="cb-secondary" to="/chromebook#sav">Guide du Chromebook <ArrowRight aria-hidden="true" /></Link></div>
      </section>

      <section id="unowhy" className="sav-panel sav-panel-unowhy" aria-labelledby="unowhy-title">
        <div className="sav-panel-head"><div><p className="cb-eyebrow">{REGIONAL_DEVICE_SAV.unowhy.period}</p><h2 id="unowhy-title">PC UNOWHY : ouvrez le dossier dans l’ENT</h2></div><span className="sav-device-pill">Y13 / Y14</span></div>
        <div className="sav-ent-path" aria-label="Chemin dans Monlycée.net"><span>Monlycée.net</span><ArrowRight /><span>Mes outils pédagogiques</span><ArrowRight /><span>La Poste | SAV</span><ArrowRight /><span>Créer un dossier</span></div>
        <ol className="sav-steps">{REGIONAL_DEVICE_SAV.unowhy.steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol>
        <div className="sav-callout"><MailCheck aria-hidden="true" /><p><strong>Après la réparation :</strong> l’appareil est retourné au lycée. Conservez la référence du dossier et surveillez les messages du SAV.</p></div>
        <div className="sav-actions"><a className="cb-primary" href={REGIONAL_DEVICE_SAV.unowhy.officialUrl} target="_blank" rel="noreferrer">Ouvrir Monlycée.net <ExternalLink aria-hidden="true" /></a><a className="cb-secondary" href={REGIONAL_DEVICE_SAV.unowhy.faqUrl} target="_blank" rel="noreferrer">Consulter la FAQ régionale <ExternalLink aria-hidden="true" /></a></div>
        <p className="sav-note">Vous n’êtes plus scolarisé dans un lycée francilien ? Pour un appareil encore couvert, écrivez à <a href={`mailto:${REGIONAL_DEVICE_SAV.unowhy.formerStudentEmail}`}>{REGIONAL_DEVICE_SAV.unowhy.formerStudentEmail}</a>.</p>
      </section>

      <section className="sav-help" aria-labelledby="sav-help-title">
        <div><span className="sav-help-icon"><MessageCircleMore aria-hidden="true" /></span><p className="cb-eyebrow">Une aide adaptée</p><h2 id="sav-help-title">Une étape vous bloque ?</h2><p>Dites simplement dans le chat : le modèle de l’appareil, ce qui ne fonctionne pas et l’étape déjà essayée. Blaise vous guide sans vous faire recommencer. Si le lycée doit intervenir, il prépare une demande avec ces informations.</p><Link className="cb-primary" to="/?view=help">Demander de l’aide <ArrowUpRight aria-hidden="true" /></Link></div>
        <div className="sav-help-secondary"><CircleHelp aria-hidden="true" /><h3>Problème de compte ou d’accès</h3><p>Ne communiquez jamais votre mot de passe ni le code reçu par email ou SMS. L’assistant peut expliquer la démarche et transmettre le blocage au lycée.</p></div>
      </section>

      <section className="sav-panel" aria-labelledby="school-equipment-title">
        <div className="sav-panel-head"><div><p className="cb-eyebrow">Professeurs · Équipements des salles</p><h2 id="school-equipment-title">Vidéoprojecteur, poste ou imprimante du lycée</h2></div><span className="sav-panel-index"><Wrench aria-hidden="true" /></span></div>
        <p className="sav-panel-lead">Ces équipements utilisent le circuit matériel du lycée, avec suivi du dossier et dates de passage SPIE.</p>
        <div className="sav-actions"><Link className="cb-primary" to="/materiel">Ouvrir l’espace matériel <ArrowRight aria-hidden="true" /></Link></div>
      </section>

      <section className="sav-roles" aria-labelledby="sav-roles-title"><p className="cb-eyebrow">Qui fait quoi ?</p><h2 id="sav-roles-title">Le bon interlocuteur à chaque étape</h2><div className="sav-role-grid">
        <article><strong>Élève ou famille</strong><p>Ouvre le dossier dans le service officiel et suit les messages reçus.</p></article>
        <article><strong>Lycée</strong><p>Aide pour l’accès, les applications et les blocages qui persistent après le diagnostic.</p></article>
        <article><strong>SAV régional</strong><p>Valide la prise en charge, organise la réparation et informe sur le suivi.</p></article>
      </div></section>

      <p className="cb-source-note"><ShieldCheck aria-hidden="true" /><span>Sources : <a href={REGIONAL_DEVICE_SAV.unowhy.faqUrl} target="_blank" rel="noreferrer">FAQ de la Région Île-de-France</a>, <a href={REGIONAL_DEVICE_SAV.asus.portalUrl} target="_blank" rel="noreferrer">assistance Mon Ordi</a> et procédure SAV ASUS–FNAC transmise par la Région. Mise à jour : {new Date(`${REGIONAL_DEVICE_SAV_UPDATED_AT}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.</span></p>
    </div>
  </PublicPortalShell>;
}
