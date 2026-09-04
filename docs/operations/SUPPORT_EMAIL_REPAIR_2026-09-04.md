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
- Build TypeScript/Vite réussi. Vérification publique et identifiants du
  déploiement à compléter après passage du contrôle de sécurité intégral.

## Nettoyage demandé

Inventaire : 13 demandes, dont huit avec adresses réservées aux tests,
trois avec adresses ordinaires et deux sans email. Une pièce jointe appartient
au guichet ; 78 objets du contenu éditorial appartiennent au site.
Le choix entre remise à zéro des 13 demandes et retrait des huit fictives a
été demandé à Adel. Préserver comptes, annuaire, contenus, documents métier et
numérotation des nouvelles demandes. Ne pas réinitialiser la séquence : les
anciens emails doivent continuer à désigner leurs anciens numéros.

## Reprise / retour arrière

La remise en service nécessite le nouveau déploiement Web avec la même clé.
En cas d'incident, arrêter le timer ; conserver les demandes et le journal
de livraison. Ne pas relancer le worker du 25 août : son incompatibilité DB
reproduit l'incident. Les fichiers sauvegardés servent au diagnostic.
