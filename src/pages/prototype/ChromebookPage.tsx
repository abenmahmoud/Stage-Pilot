import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, ExternalLink, KeyRound, Laptop, LifeBuoy, MessageCircleMore, Search, ShieldCheck, Smartphone, X } from "lucide-react";
import { CHROMEBOOK_DISTRIBUTION, CHROMEBOOK_PORTAL, CHROMEBOOK_SECTIONS, chromebookAnswers, distributionIsUpcoming, type ChromebookSection } from "../../../shared/chromebook-information";
import { PublicContentMarkdown } from "../../components/PublicContentMarkdown";
import { PublicPortalFooter } from "../../components/PublicPortalFooter";
import { useChromebookDate } from "../../components/ChromebookNotice";
import "./lycee-connect.css";
import "./chromebook.css";

function searchable(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
}

export default function ChromebookPage() {
  const now = useChromebookDate();
  const location = useLocation();
  const answers = chromebookAnswers(now);
  const upcoming = distributionIsUpcoming(now);
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<ChromebookSection | "toutes">("toutes");
  const [opened, setOpened] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Mon Chromebook · Lycée Blaise Cendrars";
    const id = location.hash.slice(1);
    if (chromebookAnswers().some((item) => item.id === id)) {
      setQuery(""); setSection("toutes"); setOpened(id);
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "center" }));
    } else window.scrollTo({ top: 0 });
  }, [location.hash]);

  const words = searchable(query.trim()).split(/\s+/).filter(Boolean);
  const filtered = answers.filter((item) => (section === "toutes" || item.section === section)
    && words.every((word) => searchable(`${item.question} ${item.answer} ${item.keywords.join(" ")}`).includes(word)));
  const openGuide = (next: ChromebookSection) => {
    setSection(next); setQuery(""); setOpened(null);
    requestAnimationFrame(() => document.getElementById("guide")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="lycee-connect lycee-article-page cb-page">
      <a className="lycee-skip-link" href="#chromebook-main">Aller au contenu</a>
      <header className="lycee-article-header">
        <Link to="/" className="lycee-article-brand"><img src="/lycee-blaise-logo.png" alt="" /><span><strong>Blaise Cendrars</strong><small>Lycée polyvalent · Sevran</small></span></Link>
        <Link to="/" className="lycee-article-back"><ArrowLeft aria-hidden="true" /> Accueil</Link>
      </header>
      <main id="chromebook-main" className="cb-main" tabIndex={-1}>
        <section className="cb-hero" aria-labelledby="chromebook-title">
          <div className="cb-hero-copy">
            <p className="cb-eyebrow">Rentrée 2026–2027 · Région Île-de-France</p>
            <h1 id="chromebook-title">Mon Chromebook.<br /><span>Prêt pour l’année.</span></h1>
            <p className="cb-lead">De la première connexion aux travaux de classe : un guide simple, à retrouver quand vous en avez besoin.</p>
            <a className="cb-primary" href="#guide">Trouver ma réponse <ArrowRight aria-hidden="true" /></a>
          </div>
          <div className="cb-device" aria-hidden="true">
            <div className="cb-device-screen"><span className="cb-device-bar"><i /><i /><i /></span><span className="cb-device-school">BLAISE CENDRARS</span><Laptop /><strong>Un outil pour apprendre.</strong><span className="cb-device-check"><Check /> Monlycée.net · Mes cours · Mes projets</span></div><div className="cb-device-base" />
          </div>
        </section>

        {upcoming ? <section className="cb-distribution" aria-labelledby="distribution-title">
          <span className="cb-date-icon"><CalendarDays aria-hidden="true" /></span>
          <div><p className="cb-eyebrow">Distribution · Élèves de seconde</p><h2 id="distribution-title">14 &amp; 15 septembre</h2><p><strong>{CHROMEBOOK_DISTRIBUTION.location}</strong> · {CHROMEBOOK_DISTRIBUTION.planning}</p></div>
          <button type="button" onClick={() => openGuide("preparer")}>Je me prépare <ArrowRight aria-hidden="true" /></button>
        </section> : null}

        <section className="cb-steps" aria-labelledby="steps-title">
          <div className="cb-section-heading"><p className="cb-eyebrow">Pour bien commencer</p><h2 id="steps-title">Trois étapes avant la remise</h2></div>
          <ol>
            <li><span className="cb-step-number">01</span><KeyRound aria-hidden="true" /><h3>J’active mon ENT</h3><p>Je vérifie que mon compte personnel Monlycée.net fonctionne.</p><a href="https://monlycee.net/" target="_blank" rel="noreferrer">Ouvrir Monlycée.net <ExternalLink aria-hidden="true" /></a></li>
            <li><span className="cb-step-number">02</span><Smartphone aria-hidden="true" /><h3>Je prépare mon QR code</h3><p>Dans l’application MonOrdi IdF, je me connecte avec le compte de l’élève et j’accepte la dotation.</p><button type="button" onClick={() => openGuide("preparer")}>Application et QR code <ArrowRight aria-hidden="true" /></button></li>
            <li><span className="cb-step-number">03</span><Laptop aria-hidden="true" /><h3>Je viens avec ma classe</h3><p>Je suis les indications de mon professeur et je présente mon QR code, sur téléphone ou imprimé.</p><span className="cb-step-note"><Check aria-hidden="true" /> Puis, place à la mise en route.</span></li>
          </ol>
        </section>

        <section id="guide" className="cb-guide" aria-labelledby="guide-title">
          <div className="cb-section-heading"><p className="cb-eyebrow">Votre guide, toute l’année</p><h2 id="guide-title">Une question ? La réponse est ici.</h2></div>
          <div className="cb-search"><Search aria-hidden="true" /><input id="chromebook-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wi-Fi, mot de passe, réparation…" aria-label="Rechercher dans le guide Chromebook" />{query ? <button type="button" aria-label="Effacer la recherche" onClick={() => setQuery("")}><X aria-hidden="true" /></button> : null}</div>
          <div className="cb-filters" aria-label="Rubriques du guide"><button type="button" aria-pressed={section === "toutes"} onClick={() => setSection("toutes")}>Tout le guide</button>{CHROMEBOOK_SECTIONS.map((item) => <button key={item.id} type="button" aria-pressed={section === item.id} onClick={() => setSection(item.id)}>{item.shortLabel}</button>)}</div>
          <p className="cb-result-count" aria-live="polite">{filtered.length} réponse{filtered.length !== 1 ? "s" : ""}{query ? ` pour « ${query} »` : " à consulter"}</p>
          <div className="cb-faq">
            {filtered.map((item) => <article className="cb-faq-item" id={item.id} key={item.id}>
              <h3><button type="button" aria-expanded={opened === item.id} aria-controls={`answer-${item.id}`} onClick={() => setOpened(opened === item.id ? null : item.id)}>{item.question}<ChevronDown aria-hidden="true" /></button></h3>
              <div className="cb-faq-answer" id={`answer-${item.id}`} hidden={opened !== item.id}>
                <PublicContentMarkdown>{item.answer}</PublicContentMarkdown>
                <div className="cb-answer-foot"><small>{item.source}</small><Link to="/?view=help" state={{ chromebookQuestion: item.id }}>Continuer dans le chat <ArrowUpRight aria-hidden="true" /></Link></div>
              </div>
            </article>)}
          </div>
          {!filtered.length ? <div className="cb-empty"><p>Aucune réponse ne correspond à cette recherche.</p><button type="button" onClick={() => { setQuery(""); setSection("toutes"); }}>Afficher tout le guide</button><Link to="/?view=help">Poser ma question à l’assistant</Link></div> : null}
        </section>

        <section className="cb-help" aria-label="Besoin d’accompagnement">
          <div className="cb-help-card"><MessageCircleMore aria-hidden="true" /><h2>On vous accompagne.</h2><p>Une question sur le Chromebook ? Le chat vous guide. Si une vérification par le lycée est nécessaire, vous pouvez préparer votre demande au même endroit.</p><Link to="/?view=help" state={{ chromebookQuestion: "preparer" }}>Parler à Blaise <ArrowUpRight aria-hidden="true" /></Link></div>
          <div className="cb-help-card cb-help-card-light"><LifeBuoy aria-hidden="true" /><h2>Le portail de la Région</h2><p>Tutoriels, prise en main et assistance ASUS : retrouvez les ressources du dispositif régional et le point de départ du SAV.</p><a href={CHROMEBOOK_PORTAL} target="_blank" rel="noreferrer">Ouvrir le portail régional <ExternalLink aria-hidden="true" /></a><a className="cb-poster-link" href="/chromebook/affiche-region.jpg" target="_blank" rel="noreferrer">Voir l’affiche MonOrdi IdF et ses QR codes <ExternalLink aria-hidden="true" /></a></div>
        </section>
        <p className="cb-source-note"><ShieldCheck aria-hidden="true" /><span>Informations vérifiées à partir des documents de la Région Île-de-France et de l’organisation du lycée. Mise à jour : 10 septembre 2026. Les horaires de passage et les situations individuelles sont confirmés par l’établissement.</span></p>
      </main>
      <PublicPortalFooter />
    </div>
  );
}
