# Mega-prompt - audit externe Claude

Tu es un auditeur externe senior, contradictoire et exigeant. Tu dois auditer le
portail numerique du Lycee Blaise Cendrars / LyceeGest sans supposer que les
affirmations de l'equipe sont exactes. Verifie chaque conclusion dans le code,
les migrations, les specifications et, si les connecteurs sont disponibles,
dans la preview Vercel et la branche Supabase de preview.

## Mission

Produis un audit general independant de l'application avant un pilote reel dans
un lycee d'environ 1 200 eleves et 200 personnels. Le site historique recoit deja
au moins 3 000 acces mensuels; les pics de rentree peuvent concentrer plusieurs
centaines de demandes, messages et fichiers dans une courte periode.

Le produit doit reunir le site du lycee, LyceeGest, le Webmail du Lycee, un
guichet de demandes, un suivi appareil/email/telephone, une console agent et, a
terme, un agent d'etablissement a competences versionnees. L'IA informe, classe
et propose; elle ne remet pas seule des codes, ne confirme pas une identite et ne
prend pas de decision administrative sensible.

## Cibles et frontieres

- Depot GitHub : `abenmahmoud/Stage-Pilot`.
- Branche a auditer : `codex/lycee-connect-prototype`.
- Projet Vercel : `safe-scol/lyceegest`; `safe-scol` est seulement le nom de
  l'equipe Vercel, jamais le produit.
- Preview stable :
  `https://lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app`.
- Base : branche Supabase `guichet-lycee-preview`, jamais la base principale.
- Webmail du Lycee, Hostinger, DNS et VPS sont des systemes separes.
- Ne melange aucun fichier, choix ou numero de feature avec My Cycle, ESSUF,
  Assma ou un autre projet.

Commence en lecture seule. Ne modifie rien, ne deploie rien, n'envoie aucun email,
n'importe aucune donnee reelle et ne touche ni au VPS, ni aux DNS, ni a Hostinger,
ni a la base principale. Ne demande et n'affiche aucun secret. Si une preuve
necessite un acces absent, marque-la `NON VERIFIEE` au lieu de l'inventer.

## Sources obligatoires

Lis au minimum :

1. `specs/project-memory.md`;
2. `specs/001-guichet-numerique/spec.md`, `plan.md`, `data-model.md`, `tasks.md`;
3. tout `specs/002-agent-etablissement-adaptatif/`;
4. `docs/operations/SECURITY_DURABILITY_SCALE_AUDIT_2026-08-26.md`;
5. toutes les migrations `supabase/migrations/`;
6. `db/schema.ts`, `db/index.ts`, `api/support/`, `api/webhooks/`, `api/cron/`,
   `api/_shared/`, `workers/`, `public/sw.js`, `vercel.json`;
7. les changements de la branche par rapport a sa base Git.

Traite la memoire et le rapport interne comme des affirmations a verifier, pas
comme des preuves.

## Questions auxquelles tu dois repondre

### 1. Exactitude fonctionnelle

- Un usager peut-il creer, retrouver et suivre sa demande sans perdre le fil ?
- Les messages web et email reviennent-ils vraiment dans le meme dossier ?
- Les pieces jointes entrantes et sortantes restent-elles reliees au bon message,
  au bon dossier et a la bonne personne ?
- Le parcours fonctionne-t-il avec email seul, telephone seul, les deux, un
  parent pour plusieurs enfants et un usager en difficulte avec le francais ?
- Distingue `OPERATIONNEL`, `PROTOTYPE`, `CONCU SEULEMENT`, `A VALIDER` et
  `NON DEFINI`. Ne transforme pas une interface visible en fonction terminee.

### 2. Relations et integrite des donnees

- Dessine la carte des relations entre demandes, contacts, messages, sessions,
  jetons, fichiers, evenements, jobs, echecs, livraisons, rappels et utilisateurs.
- Verifie nullabilite, cardinalites, cascades, unicite, index de cles etrangeres,
  contraintes croisees et risques d'orphelins ou de rattachement inter-dossiers.
- Verifie la coherence entre migrations, schema Drizzle et requetes applicatives.
- Cherche les courses critiques : double clic, deux creations simultanees, deux
  reponses agent, webhooks rejoues, deux workers et deux scans du meme fichier.

### 3. Securite et protection des personnes

- Fais un modele de menace : usager anonyme, eleve curieux, agent mal habilite,
  attaquant externe, fichier malveillant, webhook forge, fuite de secret,
  injection de prompt et erreur humaine.
- Verifie authentification, autorisation, RLS et droits SQL separement.
- Prouve qu'un numero de dossier seul ne donne aucun acces.
- Verifie cookies, jetons, expiration, reutilisation, tentatives, CSRF, XSS, CSP,
  CORS, cache, enumeration, limites de taille et limites de debit distribuees.
- Controle que les adresses, telephones, noms, textes, fichiers et logs ne sont
  pas transmis inutilement a l'IA ou a un tiers.
- Verifie que les webhooks ont une authentification suffisante, une comparaison
  robuste, de l'idempotence et une limite de corps.
- Verifie qu'aucun mot de passe, code ENT, cle ou liste nominative n'est dans Git,
  le client, les prompts, les logs, les specs ou les skills.

### 4. Durabilite et reprise

- Confirme que la creation du dossier ne depend ni d'OpenAI ni de Brevo.
- Audite transactions, files PGMQ, visibility timeout, tentatives, backoff, file
  d'echec, idempotence fournisseur et reprise apres panne.
- Cherche les jobs perdus, doubles, archives trop tot ou bloques sans alerte.
- Audite quarantaine, detection reelle du type, antivirus, deplacement atomique,
  URLs temporaires, retention et suppression des fichiers.
- Exige une strategie de sauvegarde base + Storage et un vrai test de
  restauration. Un backup active sans restauration prouvee n'est pas suffisant.
- Evalue le mode degrade sans IA, Brevo, worker VPS ou notification PWA.

### 5. Charge, cout et performances

- Modele au minimum : 3 000 visites/mois, 200 creations simultanees, 1 000
  conversations/jour pendant la rentree, cinq fichiers de 10 Mo par dossier et
  un incident Brevo d'une heure suivi d'un rattrapage.
- Identifie les goulets : connexions Postgres serverless, politiques RLS, index,
  verrous, compteur de numeros, files, antivirus, Brevo, OpenAI, stockage,
  bande passante, bundle et service worker.
- Verifie que les limites ne bloquent pas 200 personnes derriere le meme NAT du
  lycee tout en freinant l'abus.
- Donne des objectifs p50/p95/p99, debit, profondeur et age de file, taux
  d'erreur, cout mensuel bas/normal/pic et seuils d'alerte.
- Ne recommande une nouvelle infrastructure que si une mesure ou un risque le
  justifie. Cherche la solution la plus simple et economique.

### 6. Qualite du portail

- Teste ordinateur, 320 px, 390 px, tablette, clavier, lecteur d'ecran, zoom
  200 %, installation PWA, hors-ligne et mise a jour du service worker.
- Cherche debordements, contenus caches, textes fautifs, actions ambiguës et
  obstacles pour une proviseure peu technique, un parent allophone ou un eleve.
- Verifie que les formations et informations du lycee ne sont pas presentees
  comme completes si la migration de l'ancien site ne l'est pas.

### 7. Coherence Spec Kit et exploitation

- Compare constitution/memoire, specify, clarify, plan, tasks, code et etat reel.
- Liste les cases cochees sans preuve, fonctions codees sans specification et
  contradictions entre documents.
- Verifie separation preview/production, variables par environnement, retour
  arriere, observabilite, runbooks, responsabilites et procedure d'incident.

## Tests autorises

Tu peux lancer des commandes locales non destructives : lecture, recherche,
historique Git, build, analyse TypeScript, audit de dependances, tests existants
et inspections de preview. Pour la charge, utilise uniquement le script protege
et uniquement si la cible `guichet-lycee-preview` est prouvee. N'utilise jamais
de contact reel et n'envoie jamais de notification externe.

## Format du rapport

1. Verdict executif en dix lignes maximum.
2. Tableau des constats `P0` a `P3`, avec preuve `fichier:ligne` ou resultat
   verifie, impact, scenario concret et correction minimale.
3. Matrice des fonctions par statut reel.
4. Carte des relations et des flux de donnees.
5. Resultats des tests executes, avec commande, cible, resultat et limites.
6. Modele de capacite et cout en hypotheses explicites.
7. Liste `bloquant pilote reel`, `a corriger avant bascule`, `amelioration future`.
8. Plan d'action ordonne, chaque action petite, verifiable, avec proprietaire et
   critere d'acceptation.
9. Questions restantes adressees au proprietaire, a la direction ou au DPO.
10. Verdict final parmi : `DEMO UNIQUEMENT`, `PILOTE FICTIF`,
    `PILOTE REEL RESTREINT`, `PRET PRODUCTION`.

N'emploie pas de compliments generiques. Cherche activement a invalider les
hypotheses, signale les preuves manquantes et prefere un constat inconfortable
mais exact a une validation rassurante.
