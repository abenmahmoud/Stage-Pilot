# Reprise WordPress en preview - 28 août 2026

## Périmètre

- Source publique en lecture seule : `https://lycee-blaise-cendrars-sevran.fr`.
- Cible exclusive : branche Supabase isolée `guichet-lycee-preview`.
- Aucun changement Hostinger, DNS, VPS, Webmail, ENT ou PRONOTE.
- Aucun contenu importé n'a été publié automatiquement.

## Résultat vérifié

| Élément | Inventorié | Importé | État |
| --- | ---: | ---: | --- |
| Pages et actualités | 28 | 28 | Brouillons à vérifier |
| Versions initiales | 28 | 28 | Historique conservé |
| Médias accessibles par WordPress | 81 | 78 | Stockage privé |
| Liens contenu-média | - | 47 | Rattachés aux brouillons |

La requête de contrôle a confirmé :

- `28` contenus avec provenance WordPress ;
- `28` contenus en statut `brouillon` avec `needs_review = true` ;
- `0` contenu importé publié ;
- `78` objets présents dans le bucket privé `site-content` et `78` actifs
  correspondants dans le registre des médias ;
- `47` rattachements média-contenu.

## Échecs isolés

1. Médias WordPress `1222` et `1223`, deux variantes de
   `plaquette_aqe_2022.docx` : la source répond `text/plain` au lieu du type DOCX
   déclaré. Les fichiers sont refusés jusqu'à récupération d'une copie saine.
2. Média WordPress `1168`, `Revue-Voyage-a-Londres-EURO-1.pdf` : taille source
   `49 779 555` octets, supérieure à la limite de sécurité de 10 Mo. Ce document
   est le seul média manquant dans une page reprise. Il doit être optimisé ou
   remplacé par un lien officiel avant publication de la page concernée.
3. L'inventaire signale aussi l'ancienne adresse locale
   `http://localhost/wordpress/wp-content/uploads/2023/05/club.jpg`, qui ne peut
   pas être récupérée depuis le site public.

## Sécurité et réversibilité

- L'import est additif et idempotent ; il ne supprime ni n'écrase une correction.
- Les médias sont privés et ne deviennent lisibles que par lien signé depuis un
  contenu publié et autorisé.
- L'accès de bootstrap limité à cette preview a été retiré du code immédiatement
  après l'import ; son jeton temporaire a été détruit.
- La direction doit encore vérifier chaque brouillon avant publication.

## Prochaine recette

1. Corriger ou remplacer les trois fichiers refusés.
2. Relire les 15 contenus durables, archiver les 7 anciennes actualités et
   décider du sort des 6 contenus à confirmer.
3. Contrôler les liens, le français et le rendu à 320 px et sur ordinateur.
4. Comparer les 28 anciennes adresses avec leurs destinations avant toute
   bascule du domaine.
