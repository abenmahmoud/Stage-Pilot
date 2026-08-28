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

## Vérifications réalisées

- migration appliquée au projet Supabase de preview `guichet-lycee-preview` ;
- six tables créées, RLS actif et aucune ligne dans le registre ;
- clés étrangères composites empêchant les liens entre établissements et le
  choix d'une version appartenant à une autre compétence ;
- parseurs stricts pour les versions, sources, dates, empreintes et outils ;
- tests unitaires de publication, expiration, cloisonnement et retour arrière ;
- compilation de production réussie.

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
  sûres continuent de s'appliquer.

## Reste à faire

- recette navigateur avec deux comptes nominatifs et récupération testée ;
- responsables métier, règles de conservation et premières sources validées ;
- lecture authentifiée par niveau L1 à L4, exécution contrôlée des outils et audit
  des versions réellement utilisées dans chaque réponse ;
- aucun passage en production avant ces validations et la décision DPO.
