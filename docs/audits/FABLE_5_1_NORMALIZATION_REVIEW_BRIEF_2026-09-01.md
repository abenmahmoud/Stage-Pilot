# Contre-revue de provenance - mission proposée

## État et budget

Non lancée. L'accord de l'audit applicatif précédent est consommé. Attendre
un accord explicite pour ce passage : Claude Fable 5.1, lecture seule, plafond
2 USD, une exécution sans relance ni sous-agent. Vérifier le modèle réellement
utilisé et le coût ; si le modèle est indisponible, ne pas substituer un autre.

## Mission

Contre-vérifier la fermeture du P2 sur les résumés français sans redéfinir
l'application. Chercher des faux positifs de provenance, un contournement des
droits ou une régression empêchant le dépôt d'une demande. Proposer la correction
minimale et un test reproductible pour chaque constat confirmé.

## Contexte à transmettre

Carte courte de l'application puis diff de onze fichiers de code/tests et
contenu intégral des nouveaux helpers. Ne pas transmettre le fichier TSX entier
ni les logs, dépendances, secrets, variables d'environnement ou données réelles.

- `api/_shared/support-normalization.ts`
- `shared/support-normalization-policy.ts`
- `api/_shared/support.ts`
- `api/support/assistant.ts`
- `api/support/requests/index.ts`
- `shared/support-assistant-payload-policy.ts`
- `src/pages/prototype/LyceeConnectPrototype.tsx` (hunks concernés seulement)
- `scripts/test-support-normalization.mjs`
- `scripts/test-support-assistant-client-payload.mjs`
- `scripts/test-support-audit-regressions.mjs` (diff seulement)
- `scripts/test-support-multilingual.mjs`

Ajouter seulement les contrats nécessaires de conversation, pseudonymisation
et reçu de routage si le diff ne suffit pas. Volume cible : moins de 20 000
tokens d'entrée. Aucun outil, réseau, écriture ou déploiement pour l'auditeur.

## Points de contrôle

1. La preuve signe-t-elle exactement ce que le parseur stocke ?
2. Peut-on substituer messages, résumé, langue, institution, catégorie ou appareil ?
3. Une preuve expirée ou manquante reste-t-elle non bloquante et non vérifiée ?
4. Peut-elle donner un droit, une identité ou se substituer au reçu d'outil ?
5. La confidentialité du reçu, sa durée, sa non-persistance locale et ses tailles
   sont-elles cohérentes ?
6. Les libellés distinguent-ils origine, exactitude et identité sans tromper l'agent ?
7. Les tests exercent-ils réellement les branches critiques du serveur ?

## Livrable et arrêt

Un seul rapport : gravité, scénario, preuve fichier/ligne, correction simple,
test attendu, puis limites de la revue. Ne pas annoncer de sécurité absolue ou
de feu vert production. Codex contre-vérifie chaque constat avant modification.
Arrêt au rapport ou au plafond ; nouvelle permission obligatoire pour relancer.
