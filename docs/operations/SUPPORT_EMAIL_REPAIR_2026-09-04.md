# Confirmation répétée et code de suivi absent — 4 septembre 2026

## Incident constaté

Le VPS exécutait encore le worker du 25 août : il envoyait l'email puis
échouait sur `ON CONFLICT (job_id, attempt)`, alors que la base exige désormais
`(institution_id, job_id, attempt)`. Aucun succès ni échec n'était enregistré.
Six travaux restaient en file, avec jusqu'à 1 192 lectures. Le mécanisme
d'idempotence Brevo expire après 30 minutes et ne constitue pas un journal
durable : https://developers.brevo.com/docs/heterogenous-versions-batch-emails.

Cette ancienne version n'incluait pas le code de suivi ; sa configuration
`SUPPORT_ACCESS_CODE_SECRET` était également absente.

## Intervention

- Cible exclusive : pilote Supabase `xijocumlwivhbmffrnlj`, service
  `lycee-support-email-worker` dans `/opt/lycee-support-preview`.
- Arrêt du timer avant correction ; sauvegarde des données du guichet, de la
  file, du programme et de sa configuration dans
  `/root/lycee-support-backups/20260904-email-repair`, accès root uniquement.
  Manifeste de comptes et empreintes SHA-256 ; 13 demandes et six travaux.
- Six travaux anciens archivés et marqués `email_delivery_uncertain`, avec
  une réservation durable empêchant leur réémission. Aucune demande supprimée.
- Migration additive `20260904102111_support_email_dispatch_guard` appliquée
  en local et au pilote. RLS forcée, aucun accès anon/authenticated. Pas de
  contenu, destinataire, code ou jeton dans le journal de livraison.
- Réservation avant transport ; accusé durable avant écriture du journal de
  travail ; concurrence et panne après transport ne libèrent pas la réservation.
  Seul un rejet explicite du fournisseur peut autoriser une nouvelle tentative.
- Transport limité à 15 secondes ; un résultat réseau inconnu est isolé.
  Le VPS réclame chaque travail juste avant son traitement. Vercel limite sa
  prise à cinq travaux. Le compteur de reprises est contrôlé avant l'envoi.
- Le code à six chiffres et le lien sont dans le même email que le numéro.
  Ils utilisent une clé commune VPS/Vercel, renouvelée sans afficher sa valeur,
  dans la branche Vercel `codex/lycee-connect-prototype` exclusivement.
- Bundle VPS autonome ciblant Node 20, avec `postgres` externe. Ne pas recopier
  le fichier source seul : ses modules partagés doivent être embarqués.

## Vérification

- `recipe:local-support-email-dispatch` : 20 assertions PostgreSQL, dont
  concurrence, reprise avec un autre job, rejet explicite, coupure réseau,
  accusé fournisseur suivi d'une panne DB, accès privé et nettoyage.
- `recipe:local-support-email-worker` : vrai bundle exécuté avec PostgreSQL
  local et transport intercepté ; deux travaux, un seul email ; code exact et
  lien présents dans les corps texte/HTML ; démarrage refusé sans clé.
- Tests de contrôle des contacts : 93 cas, dont relance refusée quand le
  résultat d'envoi est incertain, sans modifier le contact ni son lien.
- Build TypeScript/Vite et contrôle de sécurité intégral réussis.
- Déploiement `dpl_GLjs5Nfah15vDCRG5r4jmP1pwW3D`, commit `a8429b5`, READY,
  validé puis affecté à `gestion.lycee-blaise-cendrars-sevran.fr` et à l'alias
  public de la branche. Timer VPS remis en service, sortie 0, file vide.
- Recette HTTP réelle sur cette version : création 201, rejeu sans doublon,
  code dérivé avec la clé VPS accepté une seule fois par Vercel sur un nouvel
  appareil, session limitée au bon dossier, message persistant unique, renvoi
  d'un lien unique puis ouverture. Zéro appel email et zéro dossier fictif
  restant. Preuve : `SUPPORT_EMAIL_LIVE_PROOF_2026-09-04.json`.
- Navigateur du domaine public : formulaire code et renvoi accessibles ;
  pas de débordement à 320 et 390 px. La recette assistant a identifié un
  faux classement : « récupération EduConnect sans résultat » était interprété
  comme la demande de résultats scolaires d'un enfant. L'expression courante
  est désormais distinguée, avec maintien du contrôle des véritables demandes
  de notes, résultats, absences ou bulletins, au singulier et au pluriel.

## Livraison des futurs workers

Un push Git ne met pas à jour le VPS. Exécuter `npm run build:support-email-worker`
depuis le commit testé : le bundle et son manifeste SHA-256 sont générés dans
`.vercel/support-email-worker-release`. Sauvegarder le programme installé,
arrêter le timer, installer le bundle avec les droits `lycee-support:lycee-support`
et `0640`, vérifier son empreinte et la présence des migrations/configurations,
puis lancer le service et contrôler sa sortie avant de remettre le timer.
`recipe:local-support-email-worker` vérifie le vrai bundle avec un transport
fictif ; ne jamais remplacer cette vérification par un envoi réel non autorisé.

## Nettoyage demandé

Inventaire : 13 demandes, dont huit avec adresses réservées aux tests,
trois avec adresses ordinaires et deux sans email. Une pièce jointe appartient
au guichet ; 78 objets du contenu éditorial appartiennent au site.
Adel a confirmé la suppression des 13 demandes. Opération réalisée à 11:29 UTC :
13 demandes, 13 sessions associées, six anciens travaux archivés et une pièce
jointe supprimés. Zéro demande, message, pièce ou travail en attente restant.
Contrôle de 57 ensembles de données avant/après : comptes, répertoire et contenu
conservés, dont les 78 objets du site. Numérotation non réinitialisée.
Nouvelle sauvegarde avant suppression dans
`/root/lycee-support-backups/20260904-support-reset`, sous accès root ; la pièce
avait été sauvegardée et son empreinte a été revérifiée. Suppression physique via
l'API Storage. Timer email remis actif. Preuve : `SUPPORT_RESET_PROOF_2026-09-04.json`.

## Reprise / retour arrière

La remise en service nécessite le nouveau déploiement Web avec la même clé.
En cas d'incident, arrêter le timer ; conserver les demandes et le journal
de livraison. Ne pas relancer le worker du 25 août : son incompatibilité DB
reproduit l'incident. Les fichiers sauvegardés servent au diagnostic.
