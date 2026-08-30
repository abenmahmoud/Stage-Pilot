# Brief d'audit Claude - matrice documentaire des communications

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et la limite
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `workers/communication-document-extractor.mjs`
- `shared/communication-document-input.ts`
- `scripts/test-communication-document-extractor.mjs`
- `scripts/test-communication-document-intake.mjs`

## Mission proposée

Auditer en lecture seule la matrice PDF, DOCX, image, fichier corrompu et données
personnelles. Chercher un contournement de type, extension, archive, taille,
extraction ou effacement du texte lorsqu'un signal privé ou secret est détecté.
Ne pas exécuter de fichier fourni, ne pas utiliser de réseau, ne modifier aucun
fichier et ne manipuler aucune donnée réelle.

## Sortie attendue

- constats classés par sévérité avec fichier et ligne ;
- scénario minimal de reproduction ;
- mention explicite si aucun défaut bloquant n'est trouvé ;
- limites antivirus clairement séparées des défauts confirmés.
