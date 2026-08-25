# Contrôle de cohérence

**Date** : 2026-08-25
**Résultat** : prêt pour implémentation, sous réserve des paramètres
institutionnels listés dans `research.md`.

## Couverture fonctionnelle

- [x] Demande publique sans ENT ni email académique.
- [x] Profils élève, parent, professeur et personnel.
- [x] Distinction entre demandeur et personne concernée.
- [x] Email personnel, téléphone, canal préféré et canal de secours.
- [x] Conversation web et réponse email bidirectionnelle.
- [x] Jeton secret séparé du numéro public.
- [x] Reprise sur le même appareil et sur un nouvel appareil.
- [x] Brouillon hors-ligne sans cache de données privées.
- [x] Glisser-déposer, photos, documents et contexte par fichier.
- [x] Quarantaine, antivirus et sauvegarde séparée des médias.
- [x] File agent, assignation, SLA, filtres et notes internes.
- [x] Traitement d'un pic de 200 demandes.
- [x] Collecte et vérification des emails personnels.
- [x] Rappel téléphonique et notifications multicanales.
- [x] PWA mobile, tablette et ordinateur.
- [x] Conservation des modules et pages existants.

## Cohérence technique

- [x] Une seule source de vérité : Supabase Postgres.
- [x] Une seule file de jobs : Supabase Basic Queue `pgmq`.
- [x] Demande et job validés dans la même transaction.
- [x] Idempotence à la création, à l'envoi et à la réception des webhooks.
- [x] Traitements externes hors du temps de réponse utilisateur.
- [x] Stockage privé et URLs signées courtes.
- [x] Sauvegarde des objets distincte de la sauvegarde de la base.
- [x] IA facultative avec retour aux règles déterministes.
- [x] Déploiement progressif sans remplacement brutal du site WordPress.

## Sécurité et exploitation

- [x] Aucun mot de passe demandé ou stocké.
- [x] Secrets côté serveur uniquement.
- [x] RLS et rôles explicités.
- [x] Notes internes séparées du fil public.
- [x] Audit append-only.
- [x] Durées de conservation et purge prévues.
- [x] Alertes Supabase préexistantes identifiées avant migration.
- [x] AIPD/DPO placé avant l'activation IA sur données d'élèves.
- [x] Tests de charge, restauration, webhooks rejoués et panne Brevo prévus.

## Décisions opérationnelles encore attendues

- [ ] Liste des agents et périmètres.
- [ ] SLA et horaires officiels.
- [ ] Adresse d'expédition finale.
- [ ] Budget SMS éventuel.
- [ ] Durées de conservation validées par le DPO.
- [ ] Autorisation d'activer l'IA et choix de la clé.

Ces décisions ne bloquent pas le développement du socle, qui fonctionne sans IA
et sans SMS.
