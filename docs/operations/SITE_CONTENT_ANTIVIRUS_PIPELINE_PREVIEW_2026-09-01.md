# Antivirus des contenus - socle preview

## Périmètre livré

- Bucket privé `site-content-quarantine`, limité à 10 Mo et aux six MIME
  éditoriaux autorisés.
- File PostgreSQL dédiée `site_content_file_scan`.
- États bornés : `pending`, `quarantine`, `ready`, `blocked`, `scan_error`,
  `archived`.
- Confirmation serveur avec taille exacte, signature binaire, SHA-256 et envoi
  atomique du travail antivirus.
- Worker versionné : lecture bornée, empreinte identique, ClamAV, contrôle des
  archives Office, copie vers `site-content`, suppression de la quarantaine et
  reçu d'audit minimal.
- Cinq tentatives au maximum ; le cinquième échec devient `scan_error` et le
  message est archivé.
- Le navigateur n'attache jamais un média `quarantine`. Il attend de façon
  bornée puis permet de reprendre le média dans « Fichiers vérifiés ».

## Preuves sur la preview

La migration `20260901073000` est appliquée uniquement à la référence Supabase
`xijocumlwivhbmffrnlj`.

- 78 médias WordPress existants restent `ready` dans `site-content` ; 47 sont
  liés à des brouillons et aucun contenu n'est publié. Aucun média historique
  n'a été supprimé ou modifié.
- Le bucket de quarantaine est privé avec une limite de `10485760` octets.
- La file existe et contenait zéro message après installation.
- La recette fictive
  `docs/operations/recipes/preview-site-content-antivirus-rollback.sql` refuse
  une promotion directe, accepte le cycle prouvé, puis confirme après rollback :
  `asset_residue = 0`, `audit_residue = 0`, `queue_residue = 0`.
- Le build, la barrière de sécurité complète, les 82 migrations, les 522 tâches
  Spec Kit et `npm audit --omit=dev` passent ; zéro vulnérabilité de production.

## Barrière restante

Le service et le timer systemd sont préparés mais n'ont pas été copiés ni
activés sur le VPS. Aucun moteur ClamAV réel n'a traité de fichier dans ce lot.
T009C reste donc ouverte jusqu'à une autorisation VPS précise, une recette EICAR
fictive, une preuve `clean`, une preuve `blocked` et le contrôle rétroactif des
78 médias WordPress.

La migration et le code de preview ne constituent aucune autorisation de
production, DNS, Hostinger, ENT, PRONOTE, webmail, import réel ou envoi externe.
