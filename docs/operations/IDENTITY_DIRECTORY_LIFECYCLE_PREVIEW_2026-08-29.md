# Cycle de vie du répertoire privé - recette du 29 août 2026

## Périmètre

- Branche applicative : `codex/lycee-connect-prototype`.
- Base : Supabase preview `xijocumlwivhbmffrnlj` uniquement.
- Migration enregistrée : `20260829004115_add_identity_directory_retirement`.
- Données : établissement, personnes et contacts entièrement fictifs.
- Aucun changement de production, DNS, Hostinger, Webmail, PRONOTE ou ENT.

## Garanties ajoutées

- Une activation prend un verrou de transaction par établissement ; l'index
  unique de la base interdit aussi une seconde version active.
- Une version active doit d'abord être remplacée. Une version référencée par une
  identité ou une relation ne peut pas être retirée.
- Une identité ou une relation ne peut être créée qu'à partir de la version
  active, contrôle imposé par un déclencheur serveur.
- Le retrait exige MFA, confirmation `RETIRER` et justification de 20 à 1 000
  caractères. Il supprime le fichier privé, les lignes de quarantaine et
  l'empreinte du fichier, puis conserve une preuve d'audit minimale.
- Les tables gardent RLS forcée et aucun droit direct pour `public`, `anon` ou
  `authenticated`. Elles ne deviennent jamais une source de connaissance IA.

## Preuves

- Migration exécutée dans une transaction volontairement annulée : aucun état
  persistant après le test de retour arrière.
- Deux rapports fictifs approuvés, puis deux activations successives.
- Résultat : une version active et une version remplacée.
- Tentative de créer une identité depuis la version remplacée : refus SQL
  `23514` attendu.
- Retrait de la version remplacée : fichier absent du bucket, zéro ligne de
  quarantaine, zéro fiche chiffrée, un audit de retrait.
- Nettoyage : zéro établissement et zéro import de recette.
- Les contrôles ciblés passent : 12 règles d'accès, 10 règles d'ingestion,
  8 contrôles parseur, 26 contrôles worker et 9 contrôles du coffre, ainsi que
  TypeScript et le build Vite.
- Conseiller Supabase : aucune nouvelle erreur ou alerte de sécurité. Les seules
  informations du module concernent RLS sans politique, volontaire car les
  privilèges clients sont révoqués, et des index encore inutilisés sur cette
  base de preview sans charge réelle.

## Limites avant données réelles

- Rejouer l'écran complet avec un compte direction nominatif et MFA.
- Valider finalités, rétention, sauvegarde, responsables et procédure d'incident
  avec la Direction et le DPO.
- Le premier jalon du coffre chiffré est construit et vérifié ; il reste à
  ajouter la recherche déterministe, la rotation de clé, la rétention et la
  restauration. Les codes et mots de passe restent interdits.
- Rapprocher les comptes seulement par outil déterministe, jamais par le modèle.
