# Persistance du registre de connaissances

**Statut** : socle appliqué uniquement en preview isolée le 28 août 2026
**Données réelles** : aucune

## But

Empêcher l'agent de répondre à partir d'une consigne sans propriétaire, d'un
document périmé ou d'une version non validée. Le registre conserve chaque source,
chaque version de compétence, ses tests et les décisions de publication.

## Tables privées

- `knowledge_sources` : référence, confidentialité, services, dates et empreinte
  exacte du document validé ;
- `agent_skills` : identité stable d'une compétence et version active ;
- `agent_skill_versions` : définition immuable, classification, révision et état ;
- `skill_source_links` : sources obligatoires d'une version ;
- `agent_evaluations` : tests normaux, ambigus et interdits ;
- `agent_skill_audit` : créations, validations, publications, retraits,
  révocations et retours arrière.

Les six tables forcent RLS et n'accordent aucun droit direct à `anon` ou
`authenticated`. Les API serveur vérifient la session, l'adhésion persistée à
l'établissement et le rôle direction. Une publication, une révocation, un
retrait ou un retour arrière exige en plus une session MFA `aal2` actuelle.

## Cycle de validation

1. La direction enregistre une source en brouillon puis la valide.
2. Une compétence ou une nouvelle version référence uniquement des sources du
   même établissement.
3. Les trois familles de tests doivent réussir et la date de révision doit être
   future.
4. La version passe en validation, puis devient active seulement après contrôle.
5. Une source révoquée désactive immédiatement les compétences actives qui en
   dépendent.
6. Une ancienne version publiée et encore valable peut être réactivée.

## Alimentation documentaire administrateur

Le responsable métier doit pouvoir alimenter l'agent sans modifier le code. Le
parcours retenu est :

1. déposer un document dans un bucket privé avec transfert direct et reprenable ;
2. expliquer en français simple son objet, son public, son service propriétaire
   et ce que l'agent doit apprendre ;
3. contrôler le type, la taille, l'intégrité et l'absence de contenu dangereux ;
4. extraire et indexer le document par pages ou segments bornés, sans envoyer un
   très gros fichier entier au modèle ;
5. produire une proposition structurée : résumé, faits, règles, dates, cas
   ambigus, interdictions et questions à trancher ;
6. faire relire la proposition par un humain puis seulement créer une source et
   une version de compétence publiables.

L'explication donnée au dépôt est un contexte métier, pas une preuve officielle.
Un fichier déposé ne devient jamais automatiquement une connaissance active. Les
documents personnels ou sensibles ne sont pas injectés directement dans le
prompt général et nécessitent un outil contrôlé avec journal d'accès.

Le premier jalon utilise un bucket `knowledge-ingest` privé et un enregistrement
`knowledge_documents` distinct du registre publié. La limite applicative est
configurable et reste plafonnée par les limites globales et par bucket du projet
Supabase. Au-delà de 6 Mo, le navigateur utilise TUS avec reprise et progression,
sans faire transiter le fichier par une fonction Vercel.

## Vérifications réalisées

- migration appliquée au projet Supabase de preview `guichet-lycee-preview` ;
- six tables créées, RLS actif et aucune ligne dans le registre ;
- clés étrangères composites empêchant les liens entre établissements et le
  choix d'une version appartenant à une autre compétence ;
- parseurs stricts pour les versions, sources, dates, empreintes et outils ;
- tests unitaires de publication, expiration, cloisonnement et retour arrière ;
- compilation de production réussie.
- premier jalon d'alimentation documentaire appliqué à la base de preview :
  table `knowledge_documents` vide, RLS forcé, aucun droit direct `anon` ou
  `authenticated`, bucket `knowledge-ingest` privé limité à 50 Mo ;
- transfert TUS direct et reprenable, formats bornés, chemin opaque par
  établissement et tests empêchant la création automatique d'une source ;
- 32 suites de tests ordinaires et compilation de production réussies le
  28 août 2026 ; le test de charge, volontairement générateur de demandes, n'a
  pas été rejoué pour ce lot.

## État du worker d'expiration

- le worker quotidien marque les sources publiées arrivées à expiration,
  désactive les compétences qui dépendent d'une source obligatoire expirée ou
  d'une version dont la revue est échue, puis écrit un audit système ;
- la route est protégée par `CRON_SECRET` avant toute transaction et la
  programmation Vercel est quotidienne ; les crons Vercel ne s'exécutent pas
  sur les déploiements de preview ;
- la migration autorisant un acteur système nul est appliquée uniquement à la
  base Supabase isolée de preview. Les six tables restent vides, en RLS forcé et
  sans droit `anon` ou `authenticated` ;
- huit tests ciblés couvrent expiration obligatoire, source facultative, revue
  échue, raisons cumulées, horodatage invalide, ordre d'authentification, audit
  système et déclaration du cron.

## Lecture par l'assistant public

- le niveau visiteur charge uniquement la version active d'une compétence
  `public`, `published`, non échue et appartenant au lycée configuré ;
- chaque source obligatoire doit elle aussi être publique, publiée, dans sa
  période de validité et rattachée au même établissement ; une source facultative
  expirée ne bloque pas une compétence qui conserve ses preuves obligatoires ;
- la sélection est pertinente pour le dernier message et bornée à quatre
  compétences, 3 000 caractères par compétence et 6 000 caractères au total ;
  une instruction trop longue est ignorée entièrement, jamais tronquée ;
- ni URI, ni empreinte, ni propriétaire de source ne sont envoyés au modèle ;
  seuls les instructions validées, la version et les titres/dates des sources
  publiques entrent dans le contexte ;
- les outils déclarés sont présentés comme indisponibles : le modèle ne peut pas
  prétendre les avoir exécutés ;
- en cas d'erreur de lecture, le registre est ignoré et les règles statiques
  sûres continuent de s'appliquer ;
- après une réponse IA structurée réussie, chaque version injectée produit une
  entrée `consult_public` dans l'audit. Elle conserve seulement l'établissement,
  l'UUID de version, un hash de session, le modèle et le numéro de tour ; aucun
  texte de question/réponse ni contact n'est journalisé. Une réponse de repli ou
  un échec OpenAI n'écrit pas de consommation fictive.

## Identité progressive du contexte

- `L0 visiteur` : aucune session ou preuve confirmée, sources publiques seulement ;
- `L1 contact vérifié` : compte Supabase avec email confirmé, sans déduire une
  identité scolaire ; sources publiques seulement ;
- `L2 identité scolaire` : compte relié par `auth_user_id` à une fiche élève ou
  professeur ; les données personnelles restent hors prompt et nécessiteront un
  outil contrôlé ;
- `L3 agent` : adhésion d'établissement active de rôle `agent` ; accès aux
  procédures internes seulement si le service de la source appartient à son
  périmètre ;
- `L4 responsable` : adhésion active `service_manager` ou `admin`, avec le même
  cloisonnement par service. Les actions privilégiées et sources sensibles ne
  sont pas activées sans MFA et outil dédié ;
- une adhésion invitée, désactivée, d'un autre établissement ou de rôle
  `auditor` n'accorde aucun rôle opérationnel ;
- le texte de la conversation et le type de demandeur déclaré ne participent
  jamais à la montée de niveau ;
- le frontend envoie le token Supabase s'il existe via `apiFetch`, mais l'absence
  de session conserve le parcours public L0 sans erreur.

## Reste à faire

- recette navigateur avec deux comptes nominatifs et récupération testée ;
- responsables métier, règles de conservation et premières sources validées ;
- exécution contrôlée des outils pour les données personnelles ou sensibles,
  avec MFA et journal d'accès ;
- aucun passage en production avant ces validations et la décision DPO.
