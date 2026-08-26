# Modèle de données - Gestion des contenus

## `site_content_templates`

Modèles éditoriaux versionnés : nom, type, description, titre, résumé et corps
par défaut, statut actif, version, auteur et dates.

## `site_content_items`

Contenu courant : type, slug, titre, résumé, corps Markdown, catégorie, public,
statut, modèle source, mise en avant, métadonnées de recherche, dates de
publication et d'expiration, auteurs, valideur et numéro de version.

## `site_content_versions`

Copie immutable du contenu à chaque enregistrement important. Une restauration
copie l'ancienne version dans le contenu courant puis crée une nouvelle version.

## `site_content_assets`

Métadonnées des fichiers privés : chemin de stockage, nom original, type MIME,
taille, nature image/document, titre, texte alternatif, état et auteur.

## `site_content_asset_links`

Liaison ordonnée entre un contenu et ses images ou documents, avec libellé
public et rôle `couverture`, `illustration` ou `document`.

## `site_content_audit`

Action, ressource, auteur, date et résumé non sensible. Le corps complet n'est
pas dupliqué dans cette table.

## Invariants

- slug unique ;
- version strictement positive ;
- un contenu publié possède `approved_by` et `published_at` ;
- date d'expiration postérieure à la date de publication ;
- un fichier n'est lié qu'après confirmation du dépôt ;
- aucune suppression en cascade d'une version publiée.
