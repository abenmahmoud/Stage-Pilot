import { useState } from "react";
import { BookOpenCheck, ChevronRight, ExternalLink, FileText, FolderCheck, Headphones, ShieldCheck } from "lucide-react";
import { SCHOOL_CONTINUITY, SCHOOL_CONTINUITY_TOOLS as TOOLS } from "../../shared/school-continuity";
import "./SchoolContinuityResources.css";

type Access = "normal" | "blocked" | "limited";

function OfficialLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer">{children} <ExternalLink aria-hidden="true" /></a>;
}

export function SchoolContinuityResources({ onHelp }: { onHelp: (prompt?: string) => void }) {
  const [audience, setAudience] = useState<"families" | "teachers">("families");
  const [access, setAccess] = useState<Access>("normal");
  return (
    <div className="continuity-resources">
      <div className="continuity-choice" role="group" aria-label="Choisir votre parcours">
        <button type="button" aria-pressed={audience === "families"} onClick={() => setAudience("families")}>Élèves et parents</button>
        <button type="button" aria-pressed={audience === "teachers"} onClick={() => setAudience("teachers")}>Professeurs</button>
      </div>

      {audience === "families" ? (
        <>
          <section className="continuity-access" aria-labelledby="continuity-access-title">
            <h2 id="continuity-access-title">Comment accéder à votre travail ?</h2>
            <div className="continuity-choice continuity-choice-secondary" role="group" aria-label="État de votre accès">
              {([
                ["normal", "L’ENT fonctionne"],
                ["blocked", "Mon accès bloque"],
                ["limited", "Ma connexion est faible"],
              ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={access === value} onClick={() => setAccess(value)}>{label}</button>)}
            </div>
            <div className="continuity-access-content" aria-live="polite" aria-atomic="true">
              {access === "normal" && <><h3>Votre parcours habituel</h3><p>Ouvrez MonLycée.net avec votre compte personnel, puis PRONOTE depuis les applications de l’ENT. Consultez les messages, le travail demandé et les liens de vos professeurs.</p><OfficialLink href={SCHOOL_CONTINUITY.entUrl}>Ouvrir MonLycée.net</OfficialLink><p className="continuity-note">Un parent utilise son propre compte pour suivre la scolarité de son enfant.</p></>}
              {access === "blocked" && <><h3>Poursuivre les cours et retrouver votre accès</h3><p>Utilisez les liens de secours transmis par votre professeur : cours en direct, supports et dépôt du travail. Classe Virtuelle et Nuage peuvent être utilisés en dehors de l’ENT.</p><p>Si votre compte est bloqué, expliquez le message affiché pour recevoir une aide adaptée. Lors d’une panne générale, suivez les consignes publiées par le lycée.</p><button type="button" onClick={() => onHelp("Mon accès ENT bloque pendant les cours à distance. Je souhaite retrouver mon accès et savoir comment poursuivre le travail.")}>Obtenir de l’aide <ChevronRight aria-hidden="true" /></button></>}
              {access === "limited" && <><h3>Des supports à garder sous la main</h3><p>Téléchargez la consigne et les documents quand vous avez du réseau. Pendant une visio, coupez votre caméra si la connexion est faible. Sans Internet, signalez votre situation pour organiser avec le lycée un relais adapté.</p><button type="button" onClick={() => onHelp("Ma connexion Internet est trop faible ou indisponible pour suivre les cours à distance. Je souhaite recevoir le travail autrement.")}>Signaler ma difficulté <ChevronRight aria-hidden="true" /></button></>}
            </div>
          </section>

          <section className="school-continuity-grid" aria-label="Suivre le travail à distance">
            <article><span><BookOpenCheck aria-hidden="true" /></span><div><h2>Rejoindre le cours</h2><p>À l’horaire indiqué, ouvrez le lien participant envoyé par votre professeur. Si une salle d’attente apparaît, patientez jusqu’à votre admission.</p></div></article>
            <article><span><FileText aria-hidden="true" /></span><div><h2>Récupérer les supports</h2><p>Consultez les documents partagés par votre professeur. Téléchargez les fiches utiles pour pouvoir travailler à votre rythme.</p></div></article>
            <article><span><FolderCheck aria-hidden="true" /></span><div><h2>Rendre le travail</h2><p>Utilisez le lien de dépôt prévu pour le devoir. Respectez le format, le nom du fichier et l’échéance précisés par le professeur.</p></div></article>
          </section>

          <section className="continuity-faq" aria-labelledby="continuity-faq-title">
            <h2 id="continuity-faq-title">Les réponses pratiques</h2>
            <details><summary>Faut-il installer une application pour la visio ?</summary><p>Classe Virtuelle fonctionne dans un navigateur récent, sur ordinateur ou téléphone. Ouvrez le lien de la séance fourni par votre professeur.</p></details>
            <details><summary>Je ne peux pas utiliser EduConnect.</summary><p>Signalez-le au professeur. Il peut proposer un lien participant invité avec salle d’attente. Saisissez le nom demandé puis attendez son admission. Cette entrée dans le cours ne remplace pas la vérification d’identité pour vos informations personnelles.</p></details>
            <details><summary>Je ne reçois pas le code sur mon email ENT.</summary><p>Lors de la vérification, choisissez un autre moyen de contact déjà connu du lycée s’il est proposé. Si vos coordonnées doivent être corrigées, demandez leur rectification dans le portail.</p><button type="button" onClick={() => onHelp("Je ne peux pas recevoir le code sur ma messagerie ENT. Je souhaite vérifier les autres moyens de contact connus du lycée.")}>Retrouver mon accès <ChevronRight aria-hidden="true" /></button></details>
          </section>
        </>
      ) : (
        <>
          <section className="continuity-access" aria-labelledby="continuity-teacher-title">
            <span className="lycee-eyebrow">Préparer votre classe</span><h2 id="continuity-teacher-title">Une séance, des supports, un dépôt</h2>
            <p>Accédez aux services avec votre identité académique. Préparez les liens utiles et une consigne courte pour vos élèves.</p>
            <div className="continuity-service-links"><OfficialLink href={TOOLS.apps}>Ouvrir apps.education.fr</OfficialLink><OfficialLink href={TOOLS.nuage}>Ouvrir Nuage</OfficialLink></div>
          </section>
          <section className="continuity-teacher-guides" aria-label="Guides de mise en place">
            <details open><summary>1. Créer votre classe virtuelle</summary><ol><li>Sur apps.education.fr, choisissez l’authentification Éducation nationale et votre académie.</li><li>Dans « Ma structure », ouvrez Classe Virtuelle et préparez votre salle et les supports.</li><li>Activez la salle d’attente. Dans « Inviter », récupérez le lien participant adapté : EduConnect ou invité en secours.</li><li>Gardez le lien modérateur privé. Transmettez aux élèves l’horaire et leur lien participant.</li></ol><OfficialLink href={SCHOOL_CONTINUITY.virtualClassUrl}>Ouvrir Classe Virtuelle Île-de-France 2D</OfficialLink><OfficialLink href={TOOLS.classGuide}>Consulter le pas-à-pas officiel</OfficialLink></details>
            <details><summary>2. Partager vos supports avec Nuage</summary><ol><li>Ouvrez Nuage avec l’authentification Éducation nationale.</li><li>Créez un dossier par classe, matière et période ; déposez les fiches et exercices.</li><li>Préparez un partage en lecture seule. Réservez les liens publics aux supports sans données personnelles et adaptez la protection aux documents.</li><li>Transmettez le lien de partage, avec une consigne et une durée d’accès adaptées.</li></ol><OfficialLink href={TOOLS.nuageShareGuide}>Guide du partage Nuage</OfficialLink></details>
            <details><summary>3. Recueillir les devoirs dans un dépôt séparé</summary><p>Dans Nuage, créez une demande de fichier et communiquez son lien. Les élèves déposent leurs productions sans voir les travaux des autres. Précisez la classe, le nommage du fichier et la date de remise ; une rectification du dépôt passe par vous.</p><OfficialLink href={TOOLS.nuageUploadGuide}>Créer une demande de fichier</OfficialLink></details>
            <details><summary>4. Tester le parcours avant le cours</summary><ul><li>Ouvrez le lien participant depuis un téléphone et vérifiez la salle d’attente.</li><li>Vérifiez le téléchargement des supports et un dépôt de fichier fictif.</li><li>Préparez une consigne écrite pour les absents et les élèves à faible débit.</li><li>Ouvrez la séance avant les élèves, puis fermez-la à la fin du cours.</li></ul></details>
            <details><summary>Pour aller plus loin : vidéos pédagogiques</summary><p>Tubes permet aux personnels de publier et partager des vidéos pédagogiques. Une capsule courte peut compléter les fiches et les exercices.</p><OfficialLink href={TOOLS.tubes}>Ouvrir Tubes</OfficialLink><OfficialLink href={TOOLS.tubesGuide}>Consulter le guide Tubes</OfficialLink></details>
            <details><summary>Pour l’administration : prévoir un secours PRONOTE</summary><p>Le parcours du lycée reste MonLycée.net puis PRONOTE. L’administration peut préparer un accès direct de secours avec des comptes PRONOTE distincts, suivant la procédure Index Éducation. Ce parcours se configure et se teste avant sa diffusion aux utilisateurs.</p><OfficialLink href={TOOLS.pronoteGuide}>Procédure officielle Index Éducation</OfficialLink></details>
          </section>
        </>
      )}
      <section className="continuity-safety" aria-label="Identité et aide">
        <ShieldCheck aria-hidden="true" /><p>Chacun utilise ses accès personnels. Ne communiquez jamais votre mot de passe ni un code de vérification dans le chat. Les liens de cours sont transmis par votre professeur.</p>
        <button type="button" onClick={() => onHelp("J’ai besoin d’aide pour suivre les cours à distance.")}><Headphones aria-hidden="true" /> Demander de l’aide</button>
      </section>
      <div className="continuity-references"><span>Guides institutionnels</span><OfficialLink href={TOOLS.classSource}>Classe Virtuelle</OfficialLink><OfficialLink href={TOOLS.nuageShareGuide}>Nuage</OfficialLink><OfficialLink href={SCHOOL_CONTINUITY.draneUrl}>DRANE Île-de-France</OfficialLink></div>
    </div>
  );
}
