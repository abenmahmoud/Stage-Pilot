# Recherche sécurisée du répertoire - état preview

## État

Le canal applicatif est implémenté au commit à venir, mais volontairement non
activé. Aucune intervention n'a été faite sur le VPS, aucun secret de transport
n'a été créé et aucune variable Vercel n'a été ajoutée.

Deux migrations sont appliquées uniquement à la branche Supabase
`guichet-lycee-preview` :

- `20260829031650_create_identity_directory_lookup` ;
- `20260829031912_minimize_identity_lookup_payloads`.

Après migration et recette transactionnelle : table `0`, file `0`, RLS activée
et forcée, lecture directe refusée à `anon` et `authenticated`.

## Protections implémentées

- direction ou superadministration nominative et MFA `aal2` ;
- coordonnée ou référence exacte, jamais de recherche par nom ;
- catégorie de motif et justification obligatoire ;
- vingt consultations par dix minutes et trois demandes simultanées par agent ;
- requête hybride RSA-OAEP SHA-256 et AES-256-GCM ;
- résultat AES-256-GCM minimal, sans répétition des coordonnées ;
- reçu de cinq minutes lié à l'agent, l'établissement et la requête ;
- aucun reçu dans l'URL, aucune donnée nominative dans l'audit ;
- doublon rendu `ambiguous` sans fiche ;
- charge de requête purgée au traitement et résultat purgé à expiration ;
- aucune dépendance à l'agent conversationnel ou à un modèle externe.

## Vérifications exécutées

- 23 contrôles du nouveau canal cryptographique et de ses contrats ;
- 9 contrôles du coffre AES-GCM existant ;
- 26 contrôles du worker d'import ;
- 10 scénarios d'entrée du répertoire ;
- 12 scénarios de droits d'identité ;
- compilation TypeScript et build Vite réussis ;
- `npm audit --omit=dev` : aucune vulnérabilité ;
- test de retour arrière des deux migrations avant application ;
- cycle fictif `queued -> not_found` dans une transaction annulée, puis contrôle
  à zéro résidu.

Les avis Supabase de type `RLS enabled, no policy` sont attendus ici : la table
est volontairement serveur uniquement, tous les droits clients sont révoqués et
seul `service_role` peut l'utiliser. Les index neufs sont signalés comme non
utilisés parce que la table est vide.

## Activation séparée à autoriser

1. Autoriser explicitement l'intervention sur le VPS de preview pour ce worker.
2. Générer sur le VPS une paire RSA d'au moins 2 048 bits ; la clé privée ne
   quitte jamais le VPS.
3. Installer le worker et son timer séparés, sans modifier le worker d'import.
4. Ajouter uniquement en preview Vercel la version de clé, la clé publique et un
   secret de reçu AES de 32 octets.
5. Recetter avec un répertoire fictif : résultat unique, absent, ambigu,
   altération, mauvais compte, arrêt/reprise du worker et expiration.
6. Vérifier à nouveau table, file, journaux, responsive et absence de donnée
   nominative avant toute discussion sur des données réelles.

Production, DNS, Hostinger, PRONOTE, ENT et données réelles restent hors de ce
lot.
