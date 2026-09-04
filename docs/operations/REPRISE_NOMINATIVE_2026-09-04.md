# Reprise après Claude — 4 septembre 2026

Point de départ : `ec704a7`, branche `codex/lycee-connect-prototype` propre et
synchronisée avec origin. Passation retrouvée dans les commits et documents
du 3 septembre ; aucun appel à Claude n'a été lancé.

## Vérifications exécutées

- Les 41 tests nominatifs et 13 tests du contexte de l'agent passent.
- Build complet Windows passé, y compris Vite.
- `test:preview-security-gate` passé entièrement sur Windows ; le blocage PDF
  signalé par Claude dans son shell Linux n'est pas reproduit ici.
- 7 nouveaux tests de rapprochement, de mapping et de limites de fichier passent.
- 4 nouveaux tests de chiffrement et de cloisonnement des enveloppes passent.
- Migration `20260904084803_communication_nominative_private_imports` appliquée
  uniquement à Supabase local, port 54322. Aucune donnée réelle importée.
- `recipe:local-nominative-persistence` : 28 assertions, deux livraisons pour
  le même contact, rejeu sans doublon, approbation liée au lot, contact révoqué,
  corps distincts signés, interruption sans renvoi et rollback final vérifié.
- `supabase db advisors --local --type security --level warn --fail-on none` :
  aucun problème signalé.
- Recette navigateur réelle sur le composant dans une fixture locale isolée :
  import, colonnes, bilan, aperçu des deux messages et validation simulée.
  À 320 px, le document mesure 320 px aux étapes bilan, aperçu et validation ;
  le texte de Bruno contient `0043` sans `0042`. Le lot indique 2 messages et
  7 exclusions, toutes les lignes 4 à 10 restant visibles. Capture ordinateur
  à 1440 px. Aucun contrôle de lecteur d'écran humain n'est revendiqué.

Les captures sont dans `docs/operations/screenshots/nominatif-2026-09-04-*`.
La fixture `scripts/fixtures/nominative-ui` ne charge pas de fichier `.env`,
ne modifie aucune route authentifiée et n'est pas incluse dans l'application.

## Travail restant pour terminer le parcours

1. Relier l'import administratif au service avec le répertoire actif résolu
   côté serveur et les contacts autorisés par Webmail.
2. Brancher la remise individuelle et le rapprochement des reçus sur le
   Webmail séparé ; vérifier ses échecs ambigus et sa déduplication durable.
3. Relier l'écran aux routes authentifiées, puis rejouer la recette avec le
   serveur. Le parcours de simulation seul a été vérifié à 320 px et sur ordinateur.
4. Vérifier le parcours intégré avec des fixtures, préparer la mise en service
   et présenter le premier lot concret à l'administration avant tout envoi.

T041 et T042 ne sont pas déclarées terminées. T043 reste une décision sur un
lot réel. L'agent conversationnel n'a pas été modifié dans cette reprise.

Question métier posée au propriétaire : le destinataire de l'information de
cantine doit-il être le responsable désigné, l'élève, ou les deux ? Ce choix
détermine la résolution des relations et, pour plusieurs contacts par élève,
l'évolution de la cardinalité du lot avant raccordement.
