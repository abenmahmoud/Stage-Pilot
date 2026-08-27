# Plan - Reprise complète du site officiel

## Architecture proportionnée

- **Source** : API REST et sitemaps publics du WordPress historique, en lecture
  seule.
- **Export** : script versionné produisant un inventaire JSON, un rapport
  Markdown et un paquet d'import normalisé.
- **Conversion** : Turndown transforme le HTML en Markdown ; les embeds et
  scripts sont remplacés par des liens explicites lorsqu'ils sont utiles.
- **Données** : extension additive de `site_content_items` pour la provenance et
  l'état de vérification.
- **Import** : commande réservée à un éditeur habilité, idempotente par clé
  source et ciblée exclusivement sur la base de preview. La vérification de la
  source et la publication restent réservées à la direction.
- **Médias** : copie progressive dans le bucket privé `site-content`, puis liens
  signés pour la lecture publique validée.
- **Lecture** : pages publiques par slug, en réutilisant l'API de contenus et le
  rendu Markdown déjà en place.

## Garde-fous

- Aucun `DELETE`, aucune mutation WordPress et aucun changement DNS.
- L'import ajoute uniquement les éléments absents ; une correction humaine
  existante n'est jamais remplacée silencieusement.
- `needs_review = true` bloque la publication jusqu'à validation direction.
- Les secrets, clés d'embed et données privées ne sont pas migrés.
- Les médias manquants, trop lourds ou non acceptés restent dans le rapport.
- Les anciennes actualités sont classées comme archives ou à confirmer.

## Livraison

1. Générer et examiner l'inventaire local.
2. Appliquer la migration additive à la branche Supabase de preview uniquement.
3. Déployer le code sur la branche Vercel de preview.
4. Importer les brouillons et médias par lots relançables.
5. Vérifier les pages, liens, fichiers et redirections.
6. Faire valider le contenu et le parcours par la direction.
7. Préparer sauvegarde, recette et retour arrière.
8. Basculer le domaine seulement sur une nouvelle autorisation explicite.
