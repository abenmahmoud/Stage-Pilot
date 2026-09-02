# Alignement et recette de la preview LyceeGest

**Date** : 2 septembre 2026
**Cibles** : branche Supabase `guichet-lycee-preview` et déploiement Vercel de
preview du commit `fdb8f37c770b2ad2320ad7ae720ec86cc443a8d4`
**Production** : inchangée

## Alignement SQL

La comparaison par nom fonctionnel a trouvé cinq écarts entre les 93 migrations
Git et les 88 entrées de la preview :

- `create_knowledge_document_ingestion` ;
- `prepare_identity_vault_rotation` ;
- `create_private_schedule_page_assets` ;
- `add_schedule_retirement_governance` ;
- `add_legacy_editorial_correction_action`.

Le schéma de l'ingestion documentaire existait déjà intégralement sans entrée
d'historique correspondante. Une migration de réconciliation a contrôlé table,
indexes, bucket privé, RLS forcée et trigger avant d'enregistrer son nom. Les
quatre autres migrations additives ont été appliquées dans leur ordre.

Le contrôle final retrouve 93 migrations et confirme la présence des objets
attendus. Les conseillers Supabase ne signalent aucune alerte de sécurité de
niveau avertissement ou erreur : 64 remarques informatives concernent les tables
privées sans politique client, protégées par RLS forcée et accès serveur.

## Recette HTTP fictive

Le déploiement `dpl_cgBtP4aeVQkLddRJ7mWkiyQrkNqp` est `READY`, `target=null`,
région `cdg1`. Les contrôles ont produit :

- portail `/prototype` : HTTP `200` ;
- assistant : HTTP `200`, catégorie `ent`, périmètre `school_support`, confiance
  élevée, action `offer_case` et dossier prêt à créer ;
- création d'une demande fictive : HTTP `201`, confirmation `persisted` ;
- liste liée à l'appareil : dossier retrouvé ;
- détail : même code public et message enregistré ;
- contenu public : HTTP `200` et contrat valide, avec zéro contenu publié dans
  cette preview vide.

La demande utilisait uniquement une identité, un téléphone impossible et un
texte fictifs. Aucun email, SMS ou fournisseur n'a été appelé. La demande, sa
session isolée et sa tâche de file ont été supprimées. Le contrôle final retrouve
zéro dossier et zéro tâche en file ou archivée portant le marqueur de recette.

## Accès agent constaté

La preview contient un seul compte `superadmin` avec une adhésion `admin` active.
Ce rôle possède bien l'accès global aux sept services sans dépendre du tableau
de services de l'adhésion. Aucun facteur MFA n'est encore vérifié. Le portail
redirige donc ce compte vers `/security` après connexion et refuse l'accès aux
dossiers tant que l'enrôlement MFA n'est pas terminé. Aucun compte, rôle ou
facteur n'a été créé ou modifié pendant cette recette.

## Ce que cette preuve ne ferme pas

- validation humaine sur téléphone et ordinateur ;
- enrôlement MFA du superadministrateur, puis comptes agents nominatifs ;
- sauvegarde de production restaurée dans une cible isolée ;
- reprise des contenus publics et des données 2026-2027 ;
- autorisation puis fenêtre de promotion de production.
