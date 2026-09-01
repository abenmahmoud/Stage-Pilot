# Restauration locale isolée d'un paquet fictif

## Périmètre

Cette recette prouve qu'un paquet chiffré DB + Storage déjà authentifié peut
être restauré sur disque sans toucher à Supabase, Vercel, au VPS, au Webmail ou
à une donnée réelle. Le test utilise uniquement des octets fictifs et un
répertoire créé sous le dossier temporaire du système.

Elle ne constitue pas encore une sauvegarde programmée de la preview et ne doit
pas être utilisée comme commande d'import en production.

## Garanties vérifiées

- le nom de restauration est un identifiant simple, jamais un chemin ;
- les segments restaurés refusent les caractères Windows dangereux, les flux
  alternatifs NTFS et les noms de périphériques réservés ;
- le parent doit exister et son chemin réel est résolu avant toute écriture ;
- tout le paquet, son manifeste et tous ses artefacts sont authentifiés avant la
  première création de fichier ;
- un verrou exclusif empêche deux restaurations concurrentes du même nom ;
- une cible existante est refusée et n'est jamais supprimée ou écrasée ;
- chaque fichier est créé avec `wx`, relu puis comparé par taille et SHA-256 ;
- la restauration reste dans un répertoire temporaire aléatoire appartenant au
  parent explicitement fourni ;
- le répertoire temporaire n'est renommé vers la cible qu'après toutes les
  vérifications ;
- en échec, seul ce répertoire temporaire aléatoire peut être supprimé ;
- le reçu final contient uniquement des compteurs, la taille totale et une
  empreinte agrégée, sans chemin ni contenu en clair.

Les artefacts sont séparés sous `database/` et `storage/`. Leur chemin source
validé est ensuite conservé sous cette racine afin d'éviter toute collision
entre catégories.

## Contrôle local

```powershell
npm run test:recovery-sample-bundle
```

Le test couvre la restitution exacte de deux artefacts fictifs, le refus d'une
cible existante, le refus d'un nom traversant et l'absence de résidu après un
paquet altéré. Son parent temporaire est supprimé dans un bloc `finally`.

## Reste à autoriser

La tâche principale `001/T031` reste ouverte. Sa fermeture exige encore une
sauvegarde chiffrée programmée de la base et du Storage de preview, une gestion
des clés validée, une conservation décidée et la restauration isolée du paquet
réellement produit. Aucun de ces accès externes n'est déclenché par ce lot.
