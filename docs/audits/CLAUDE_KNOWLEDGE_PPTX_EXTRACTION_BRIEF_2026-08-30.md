# Brief Claude - extraction locale des PPTX

## Statut

Brief préparé, non exécuté. Le modèle Claude exact et le plafond de consommation
doivent être autorisés pour cette mission précise.

## Mission proposée

Effectuer une revue de sécurité en lecture seule du parseur PPTX local. Rechercher
les bombes ZIP, ambiguïtés XML, entités externes, contournements de limites,
fuites de secrets et publication involontaire.

## Périmètre minimal

- `workers/knowledge-document-extractor.mjs`
- `workers/package.json`
- `scripts/test-knowledge-document-worker.mjs`
- `docs/security/KNOWLEDGE_PPTX_EXTRACTION_2026-08-30.md`
- diff Git du lot

Aucun secret, `.env`, export, document réel, journal, outil d'écriture ou accès
réseau ne doit être transmis.

## Questions

1. Les limites ZIP et XML sont-elles vérifiées avant toute allocation importante ?
2. Les entités, archives chiffrées et structures déguisées sont-elles refusées ?
3. Un XML invalide ou dupliqué peut-il produire un texte partiel accepté ?
4. Les notes suivent-elles les mêmes contrôles de confidentialité que les diapositives ?
5. Une extraction peut-elle publier une source sans validation humaine MFA ?

## Arrêt

Un rapport classé par sévérité, avec fichier, scénario reproductible et
correction minimale. Une seule passe, sans relance ni élargissement du périmètre.
