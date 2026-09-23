import { ENT_LOGIN_URL } from './ent-self-service.js';

export type SupportSuggestionEvidence = {
  state: 'unlinked' | 'unavailable' | 'active' | 'inactive';
  code: 'available' | 'review' | 'missing' | 'not_checked';
  checkedAt: string;
};
export type SupportReplySuggestion = {
  publicCode: string;
  revision: string;
  draft: string;
  title: string;
  facts: string[];
  sources: string[];
  checkedAt: string;
};
export const SCHOOL_REQUESTS_URL = 'https://lycee-blaise-cendrars-sevran.fr/?view=requests';
export const SCHOOL_HELP_URL = 'https://lycee-blaise-cendrars-sevran.fr/?view=help';

/** Public navigation only: the personal schedule is read after identity verification in the portal. */
export function suggestScheduleReply() {
  return {
    title: 'Emploi du temps : consultation personnelle',
    draft: `Bonjour,\n\nPour consulter votre emploi du temps, ouvrez le site du lycée, puis « Pour moi, aujourd’hui » ou l’assistant. Confirmez votre identité avec un code envoyé à un contact déjà connu du lycée. Vous pourrez ensuite consulter vos cours et les salles disponibles pour votre profil.\n\nSi votre emploi du temps ne s’affiche pas ou semble incomplet, répondez dans ce même dossier en précisant le jour et la classe concernés. Nous vérifierons les données publiées, sans vous demander de créer une nouvelle demande.\n\nL’équipe du lycée Blaise Cendrars`,
    facts: ['Le dossier ne prouve pas à lui seul l’identité ni la disponibilité de l’emploi du temps. Aucun horaire ou salle personnels ne sont insérés dans ce brouillon.'],
    sources: ['Parcours de consultation personnelle du portail du lycée'],
  };
}

export function suggestPronoteReply() {
  return {
    title: 'Accès à PRONOTE depuis l’ENT',
    draft: `Bonjour,\n\nAu lycée, l’accès à PRONOTE passe par votre compte personnel monlycée.net. Connectez-vous sur ${ENT_LOGIN_URL}, puis ouvrez l’application PRONOTE depuis l’ENT.\n\nSi vous avez perdu votre identifiant ou ne pouvez plus vous connecter, répondez dans ce dossier : nous vous guiderons sans créer une seconde demande.\n\nL’équipe du lycée Blaise Cendrars`,
    facts: ['Procédure publique ; aucun identifiant ni code personnel dans le brouillon.'],
    sources: ['Procédure de connexion monlycée.net du lycée'],
  };
}

/** Public guidance only. The personal identifier and code remain in the OTP-protected display. */
export function suggestPcSessionReply() {
  return {
    title: 'Code de session PC : accès personnel sécurisé',
    draft: `Bonjour,\n\nPour retrouver votre identifiant et votre code personnels sur les ordinateurs du lycée, ouvrez ${SCHOOL_HELP_URL}, puis écrivez « Je veux mes codes de session PC ». Indiquez votre identité et choisissez l’envoi du code de vérification par SMS ou par email sur un contact déjà connu du lycée.\n\nAprès la vérification, la rubrique « Ma session PC » affiche temporairement votre identifiant exact et votre code s’ils sont disponibles. Ne transmettez jamais ce code dans le chat ni à une autre personne.\n\nSi la rubrique indique que les accès ne sont pas disponibles ou s’ils ne fonctionnent pas, répondez dans ce même dossier : le référent numérique vérifiera l’attribution sans vous demander de créer une nouvelle demande.\n\nL’équipe du lycée Blaise Cendrars`,
    facts: ['La consultation du code de session PC exige une identité confirmée et reste limitée dans le temps.', 'Aucun identifiant ni code personnel n’est inséré dans ce brouillon.'],
    sources: ['Parcours sécurisé « Ma session PC » du portail du lycée'],
  };
}

/** Equipment incidents stay in their original case and are handled through the Matériel & SPIE workflow. */
export function suggestEquipmentReply() {
  return {
    title: 'Matériel : prise en charge dans le suivi SPIE',
    draft: `Bonjour,\n\nVotre signalement matériel a bien été enregistré. Le lieu, le numéro d’inventaire et le constat indiqués dans ce dossier seront conservés pour le diagnostic. Le référent numérique qualifie le signalement, puis l’intervenant SPIE prend en charge le diagnostic et la réparation selon le suivi du lycée.\n\nVous n’avez pas besoin de créer une nouvelle demande. Si vous disposez d’une précision ou d’une photo utile, ajoutez-la directement dans ce dossier, sans faire apparaître de mot de passe ni de code personnel.\n\nL’équipe du lycée Blaise Cendrars`,
    facts: ['Le signalement reste dans le suivi « Matériel & SPIE » et conserve les informations déjà fournies.', 'La réponse ne promet ni date de passage ni résolution avant le diagnostic.'],
    sources: ['Procédure interne « Matériel & SPIE » du lycée'],
  };
}

/** A reviewed draft, never a credential delivery or an identity grant. */
export function suggestEntReply(evidence: SupportSuggestionEvidence, recoveryFailed: boolean) {
  const facts: string[] = [];
  let instruction: string;
  const entry = `Retrouvez cette demande dans « Mes demandes » : ${SCHOOL_REQUESTS_URL}\nDans ce dossier, choisissez « Retrouver mon accès ENT ». Confirmez votre identité avec le code reçu par SMS ou email sur un contact connu du lycée. Votre identifiant exact s’affichera dans un espace sécurisé, sans créer une nouvelle demande.`;
  if (evidence.state === 'unlinked') {
    facts.push('Ce dossier n’a pas de lien d’identité exploitable avec l’annuaire actuel.');
    instruction = `${entry}\n\nSi vous connaissez déjà votre identifiant, rendez-vous sur ${ENT_LOGIN_URL} : le bouton « Mot de passe oublié ? » permet de demander un lien de réinitialisation.`;
  } else if (evidence.state === 'unavailable') {
    facts.push('Identité reliée au dossier ; données ENT absentes ou à vérifier.');
    instruction = `Pour vous connecter à l’ENT, ouvrez ${ENT_LOGIN_URL}. Si vous connaissez votre identifiant, utilisez « Mot de passe oublié ? » pour réinitialiser votre mot de passe. Si vous l’avez oublié ou si vos coordonnées ne sont plus à jour, précisez ce qui vous bloque en répondant dans ce dossier, sans transmettre de mot de passe ni de code. Une vérification par le référent numérique est nécessaire.`;
  } else if (evidence.state === 'active') {
    facts.push('Compte actif dans le dernier export ENT.', 'Identifiant exact disponible dans les données protégées.');
    instruction = `Pour retrouver votre accès, ouvrez ${ENT_LOGIN_URL}, choisissez « Mot de passe oublié ? », saisissez votre identifiant exact, puis cliquez sur « Valider ». Suivez ensuite le lien reçu pour choisir votre nouveau mot de passe.\n\nIdentifiant oublié ? ${entry}`;
  } else {
    facts.push('Compte non activé dans le dernier export ENT.', 'Identifiant exact disponible dans les données protégées.');
    if (evidence.code === 'available') {
      facts.push('Une attribution de code est présente dans le coffre ; contrôle final lors de la remise.');
      instruction = `${entry}\n\nPour une première connexion, choisissez « Afficher mon code d’activation », puis ouvrez ${ENT_LOGIN_URL}. Utilisez votre identifiant et le code d’activation dans le champ du mot de passe, puis choisissez votre mot de passe personnel. Si vous avez déjà activé votre compte depuis le dernier export, utilisez « Mot de passe oublié ? ».`;
    } else {
      facts.push(evidence.code === 'review' ? 'Code signalé, utilisé ou remplacé : intervention du référent nécessaire.' : 'Aucun code exploitable confirmé dans le coffre.');
      instruction = `Pour votre première connexion, votre accès doit être vérifié par le référent numérique. Répondez dans ce dossier en précisant le message qui s’affiche, sans transmettre de mot de passe ni de code. Si vous avez déjà activé votre compte, vous pouvez utiliser « Mot de passe oublié ? » sur ${ENT_LOGIN_URL}.`;
    }
  }
  if (recoveryFailed) {
    facts.push('La dernière réponse signale un échec : ne pas répéter la même procédure.');
    instruction = `Vous indiquez que la démarche n’a pas fonctionné. Merci de préciser dans ce dossier le message d’erreur et si vous avez encore accès à l’email ou au téléphone utilisé pour la vérification. Vous pouvez joindre une capture en masquant les codes et mots de passe. Le référent numérique pourra vérifier votre accès et, si nécessaire, les coordonnées à corriger.`;
  }
  return {
    title: recoveryFailed ? 'Reprendre le blocage avec le référent' : 'Accès ENT : démarche adaptée au dossier',
    draft: `Bonjour,\n\n${instruction}\n\nSi vous êtes parent, utilisez votre propre nom, prénom et compte de parent. Si le problème persiste, répondez dans ce même dossier.\n\nL’équipe du lycée Blaise Cendrars`,
    facts,
    sources: evidence.state === 'unlinked' ? ['Procédure de connexion monlycée.net'] : ['Lien d’identité du dossier', 'Dernier import ENT actif', ...(evidence.state === 'inactive' ? ['Attributions du coffre (sans lecture du code)'] : []), 'Procédure de connexion monlycée.net'],
  };
}

export function isSupportReplySuggestion(value: unknown, code: string, revision: string): value is SupportReplySuggestion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 7 && v.publicCode === code && v.revision === revision
    && typeof v.draft === 'string' && v.draft.length > 0 && v.draft.length <= 5000
    && typeof v.title === 'string' && v.title.length <= 160
    && typeof v.checkedAt === 'string' && Number.isFinite(Date.parse(v.checkedAt))
    && [v.facts, v.sources].every(list => Array.isArray(list) && list.length <= 12 && list.every(item => typeof item === 'string' && item.length <= 500));
}

