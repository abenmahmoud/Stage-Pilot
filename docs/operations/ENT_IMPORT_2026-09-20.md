# Export ENT du 20 septembre 2026

## Source et contrôle local

- Source reçue : `export_users_20260920_174759.csv`, conservée hors Git dans le dépôt privé ENT.
- Empreinte SHA-256 : `eebd5ed2add4e246f1bd539b85587e35d1b6a56dcec45b0732c4a4bffd41e11c`.
- 3 427 lignes source, cinq doublons stricts et non contradictoires, soit 3 422 comptes distincts.
- Aucun identifiant manquant, aucun profil inconnu et aucun rejet structurel.
- Le rapprochement conserve les références déjà connues, n'efface pas une personne absente de cet export et n'ajoute que les liens responsable–élève réciproques dans l'export officiel.
- Les CSV préparés, les valeurs de codes et les rapports nominatifs restent dans `DepotPrive/04-Exports-ENT-bruts/traitement-2026-09-20`. Aucun secret ni aucune liste nominative n'entre dans Git.

## Annuaire actif

- Version activée : « Annuaire ENT actualisé — 20 septembre 2026 ».
- 7 083 lignes utilisables : 4 604 personnes et 2 479 relations, zéro rejet.
- 1 817 avertissements non bloquants : coordonnées partagées, contacts facultatifs absents, personnels sans service ou élèves sans classe dans l'export.
- Par rapport à la version active du 17 septembre : 54 personnes supplémentaires dans l'annuaire fusionné et 49 nouveaux liens responsables–élèves. Les personnes non revues dans ce seul export sont conservées.
- Une seule version de l'annuaire est active. La version du 17 septembre est marquée remplacée.

## Attributs et coffre

- 10 266 attributs ENT chiffrés ont été reçus puis activés après rapprochement avec l'annuaire du 20 septembre. L'ancien lot de 10 119 attributs est remplacé.
- 1 266 accès ENT inactifs ont été proposés au coffre sous forme chiffrée. Le point d'import a ajouté 45 nouvelles attributions et conservé 1 221 attributions déjà présentes, sans écrasement.
- Après import, le coffre contient 1 351 attributions ENT et 98 attributions KOXO disponibles pour 2026-2027, chacune avec une valeur chiffrée.
- Deux comptes déclarés inactifs dans l'export ne contenaient pas de code exploitable ; l'agent doit donc orienter ces cas vers une demande humaine après vérification d'identité.

## Effet sur le parcours utilisateur

- Les sessions d'identité liées à une version remplacée ne sont plus acceptées par les routes protégées : une nouvelle vérification OTP est demandée au prochain accès personnel.
- Après OTP sur un contact connu, l'agent peut lire l'état ENT autorisé et, pour un compte inactif disposant d'une attribution, remettre temporairement l'identifiant et le code d'activation dans le parcours sécurisé.
- Un compte actif reçoit la procédure de récupération Monlycée.net et son identifiant ENT autorisé. PRONOTE reste présenté comme une application accessible depuis Monlycée.net.
- Un nom d'enfant seul, un visiteur ou un contact non reconnu ne donne jamais accès aux données ni aux codes. Le parcours prépare une demande de rectification sans modifier automatiquement les coordonnées.

## Vérifications réalisées

- Contrôle SQL agrégé : une version d'annuaire active, un lot d'attributs actif, nombres de lignes stockées conformes et valeurs du coffre chiffrées présentes.
- Tests ciblés réussis : dépôt chiffré des codes (3), attributs nominatifs (5), parcours ENT inactif (6) et parcours ENT actif (5).
- Aucun OTP réel, email, SMS, push ou dossier n'a été créé pendant l'import.
- La zone de transfert temporaire du VPS a été supprimée après les contrôles ; le CSV source et les préparations restent dans le dépôt privé local.

## Prochaine extraction

Déposer le nouvel export dans le même dossier privé, refaire le contrôle différentiel, approuver l'annuaire, puis seulement activer les attributs et importer le lot chiffré de codes. Ne jamais supprimer automatiquement les absents, remplacer une valeur déjà présente dans le coffre ou rapprocher une personne par ressemblance de nom.
