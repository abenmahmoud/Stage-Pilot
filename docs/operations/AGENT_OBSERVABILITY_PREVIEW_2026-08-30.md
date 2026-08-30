# Observabilité de l'agent - preview

## Données techniques conservées

- résultat fermé de l'exécution ;
- modèle utilisé ou absence de modèle ;
- latence, jetons d'entrée/sortie et coût estimé conditionnel ;
- nombre de sources et de tours ;
- décision humaine séparée sur le routage : en attente, confirmé ou corrigé.

## Protections

- table de métriques append-only, privée et cloisonnée par établissement ;
- aucun message, nom, email, téléphone, pièce ou identifiant de session ;
- estimation de coût désactivée si les deux tarifs explicites manquent ;
- validation du classement sous MFA, atomique et non rejouable ;
- l'interface distingue « réponse IA retenue par les règles » et validation
  humaine effective.

## Vérification

`npm run test:agent-observability` exécute les mesures, le coût conditionnel, la
résilience du collecteur, les droits de la table, l'agrégation privée, le reçu
signé et la confirmation/correction humaine du classement.
