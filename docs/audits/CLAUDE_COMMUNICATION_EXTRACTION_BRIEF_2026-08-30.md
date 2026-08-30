# Brief d'audit Claude - extraction documentaire des communications

## Statut

Préparé le 30 août 2026. Audit non exécuté sans modèle Claude exact et plafond
de consommation propre à cette mission.

## Périmètre strict

- `workers/communication-document-extractor.mjs`
- moteur réutilisé `workers/knowledge-document-extractor.mjs`
- `scripts/test-communication-document-extractor.mjs`

## Mission proposée

Chercher un format contournant la liste PDF/DOCX, une bombe ZIP, un PDF actif,
une fuite de texte après détection de coordonnées ou secret, une sortie non
bornée et tout appel réseau ou modèle externe. Ne modifier aucun fichier et ne
traiter aucun document réel ou nominatif.

## Sortie attendue

- constats classés par sévérité avec fichier et ligne ;
- scénario minimal de reproduction ;
- mention explicite si aucun défaut bloquant n'est trouvé ;
- risques résiduels séparés des défauts confirmés.
