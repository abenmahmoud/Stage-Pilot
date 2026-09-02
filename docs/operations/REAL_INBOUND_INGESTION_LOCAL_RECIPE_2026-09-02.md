# Recette locale réelle de l'orchestrateur entrant

**Date** : 2 septembre 2026
**Périmètre** : PostgreSQL, PGMQ et Storage Supabase strictement locaux
**Tâche** : `005/T022I`, terminée

## Objectif

Exécuter le véritable orchestrateur d'une pièce jointe entrante avec les
93 migrations du dépôt, un téléchargement Brevo simulé et le Storage privé
réel. La route webhook reste fermée et aucun fournisseur n'est joint.

## Garde-fous

- l'option `--local-stack-only` est obligatoire avant toute connexion ;
- PostgreSQL est limité à `127.0.0.1:54322/postgres` ;
- l'API Supabase est limitée à la boucle locale sur un port autorisé ;
- la clé serveur locale reste en mémoire et n'est ni écrite ni affichée ;
- la réponse Brevo est produite par un transport fictif borné ;
- les identifiants, PDF et secrets de référence de la recette sont fictifs ;
- le nettoyage cible uniquement l'établissement fixe de la recette et utilise
  l'API Storage pour supprimer l'objet.

## Scénario vérifié

1. Le téléchargement fictif est mesuré et haché par l'adaptateur réel.
2. Une réservation unique est validée et commitée avant le dépôt privé.
3. Une interruption injectée après la confirmation annule état, événement et
   tâche PGMQ, mais conserve la réservation et l'objet Storage déjà écrit.
4. Le rejeu reprend le même identifiant et vérifie les octets déjà déposés avant
   de confirmer la quarantaine et de créer une seule tâche antivirus.
5. Un troisième rejeu est idempotent. Une substitution de même taille mais de
   contenu différent est refusée sans nouveau dépôt ni nouvelle tâche.
6. La suppression finale retrouve zéro établissement, entrant, objet, événement,
   tâche active, archive et objet Storage de la fixture.

Sortie vérifiée :

```json
{"migrations":93,"database":"local-postgresql","storage":"local-private","reservationRows":1,"interruptionRecovered":1,"duplicateReplays":1,"conflictsRefused":1,"queueJobs":1,"providerCalls":4,"databaseResidues":0,"storageResidues":0}
```

Les seize tests unitaires de l'orchestrateur restent verts et son contrôle
statique rejoint la barrière de sécurité preview.

## Limites conservées

Cette preuve ferme le raccordement local de `T022I`. Elle n'active pas le
webhook, Brevo, le worker distant ou le runtime antivirus. `005/T022` reste
ouverte jusqu'au parcours entrant complet autorisé et `005/T022K` jusqu'à
l'installation supervisée du worker sur un runtime de preview.

Production, Vercel distant, Supabase distant, VPS, Webmail, Brevo, DNS et
données réelles sont inchangés.
