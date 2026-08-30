# Retrait des brouillons de réponse agent

## Règles livrées

- Seul le compte agent ayant réservé le document peut le retirer.
- L'établissement et le service du dossier sont vérifiés avant toute action.
- Seuls les états terminaux `clean`, `blocked` et `scan_error` sont retirables.
- Une pièce liée à un message ou déjà libérée au demandeur est refusée.
- Le retrait inscrit d'abord `removal_pending` sous le même verrou que l'envoi :
  un seul des deux peut réussir.
- Le fichier est ensuite supprimé du bucket privé, puis la ligne est finalisée.
  Une interruption laisse un état bloqué et reprenable, jamais une pièce encore
  envoyable avec un fichier absent.
- L'événement `attachment.draft_removed` conserve uniquement l'identifiant
  opaque, la direction et l'état antivirus.

## Interface

Une icône corbeille apparaît seulement lorsque le serveur déclare le brouillon
retirable. Une confirmation explicite précède l'action. La sélection locale est
nettoyée après la confirmation serveur, puis le dossier est relu.

## Limites volontaires

- Aucun retrait pendant un téléversement ou un contrôle antivirus.
- Aucun retrait d'une pièce préparée par un autre agent, même par visibilité
  globale, afin de conserver une responsabilité claire.
- Un échec Storage replace le brouillon en `scan_error` et garde la possibilité
  de reprendre le retrait.
- Aucun nettoyage de donnée réelle n'a été exécuté pendant ce lot.

## Vérifications

- Build TypeScript et Vite.
- Test dédié des pièces de réponse agent : 7/7.
- Barrières de méthodes, corps HTTP, routes privées et sécurité de preview.
- Vérification du rendu à 1 265 px et 375 px : aucun débordement horizontal,
  aucune erreur de console et titre de page présent.
- Couverture finale : 99 routes HTTP, 68 routes privées et 79 migrations
  uniques. `npm audit --omit=dev --audit-level=high` ne signale rien.

La migration `20260830180000_allow_agent_attachment_removal_pending.sql` étend
uniquement la liste fermée des états antivirus. Elle n'ajoute aucune table,
colonne, politique ou droit client.

Elle est appliquée uniquement à `guichet-lycee-preview`. La contrainte distante
contient le nouvel état, la RLS reste activée et forcée, et `anon` comme
`authenticated` ne possèdent aucun droit direct sur `support_attachments`.
