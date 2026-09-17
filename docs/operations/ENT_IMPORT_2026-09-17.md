# Export ENT du 17 septembre 2026

## Source et préparation

- Source locale : `Downloads/export_users_20260917_111124.csv`, SHA-256 `37cbd9f3cd041c904b8e76334718b3ad2d19e4d388b617e3d93eba572dd407b0`.
- 3 380 lignes reçues, dont sept doublons stricts ; 3 373 comptes distincts.
- Rapprochement par référence ENT et concordance exacte du profil et des noms pour les références déjà présentes. Aucun rattachement approximatif.
- Annuaire fusionné : 4 550 personnes et 2 430 liens, soit 6 980 lignes contrôlées, zéro rejet. Les personnes absentes de ce seul export sont conservées.
- Les CSV préparés et les codes en clair restent exclusivement dans le dossier privé local `DepotPrive/04-Exports-ENT-bruts/traitement-2026-09-17`. Aucun code ni liste nominative n'entre dans Git ou dans le modèle.

## Import effectif

- Nouvel annuaire déposé, rapport examiné puis version approuvée et activée dans l'administration du lycée. Le contrôle signale 1 797 alertes non bloquantes, principalement des coordonnées partagées et des champs facultatifs absents. Le rapprochement d'identité ne résout pas ces cas par supposition.
- Attributs ENT : 10 119 valeurs reçues depuis le relais VPS, import `ad00259c-3dca-4e55-97cf-dc9b18109e98`, validé et actif le 17 septembre à 12 h 41 (heure de Paris). L'ancienne version de 10 026 valeurs est remplacée.
- Coffre ENT : 1 257 attributions chiffrées proposées ; réponse du point d'import : 33 nouvelles, 1 224 déjà présentes et conservées. Aucune valeur existante n'a été écrasée.
- La zone temporaire utilisée pour le transfert sur le VPS a été supprimée après réception. Le jeton du Dépôt est resté sur le VPS ; seul le fichier chiffré `.enc` y a transporté les codes.

## Chat et publication

- Le chat renvoie une demande de codes ou de récupération PRONOTE vers l'accès personnel Monlycée.net. Une simple question « Comment ouvrir PRONOTE ? » reçoit la procédure publique depuis l'ENT, sans demander d'identité. Le compte parent reste strictement personnel : le nom de l'enfant seul ne donne jamais ses codes.
- Commit `281996f`, neuf tests ciblés réussis et build réussi. La suite plus large `test:support-agent` comporte six échecs sur d'anciens scénarios ENT ; elle n'est pas un contrôle de recette réussi pour ce lot.
- Déploiement Vercel `dpl_AtL8RDfumduTdWLMz4cq8Nt9Qcf7` READY, alias du domaine principal actualisé. Accueil HTTP 200 ; `/api/identity/device/ent` sans session HTTP 401.

## À vérifier en situation réelle

- Une session d'identité créée avant l'activation du nouvel annuaire doit être confirmée à nouveau par OTP.
- Aucun OTP réel ni affichage de code personnel n'a été déclenché par cette opération. Vérifier avec le propriétaire un cas parent inactif et un cas actif, chacun avec son propre contact connu, puis confirmer l'ouverture de PRONOTE depuis l'ENT.
- L'état d'activation reflète l'export manuel du 17 septembre et doit être réactualisé après de nouveaux changements dans l'ENT.

## Accès VPS depuis ce poste

- Le raccourci SSH local `essuf-vps` utilise l'hôte `187.124.50.143`, le compte `root` et la clé SSH déjà configurée. La commande `ssh essuf-vps` a été testée avec succès après le changement de réseau.
- Sur le réseau précédent, le proxy Windows était `10.0.0.1:3128`, et non `10.0.0.0:3128` ; il ne relayait pas SSH sur le port 22. La connexion directe sur ce port ne répondait pas non plus. Aucun paramètre proxy ou SSH du poste n'a été modifié.
