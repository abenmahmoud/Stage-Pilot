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

## Réparation des liens internes

La recette a détecté `37` liens WordPress concaténés par erreur à l'adresse de
l'accueil dans `9` brouillons. Le convertisseur rapproche désormais une adresse
interne par son chemin complet au lieu de remplacer un préfixe commun.

La base de preview a été réparée sans publication :

- `9` brouillons corrigés, toujours marqués `needs_review = true` ;
- `9` nouvelles versions conservées, soit `37` versions au total ;
- `9` entrées d'audit avec le motif `legacy_internal_link_repair` ;
- `0` lien concaténé restant et `0` contenu importé publié.

Les redirections couvrent les `27` anciennes adresses hors accueil. La
configuration Vercel supprime aussi la barre oblique finale historique avant
d'appliquer la destination `/site/...`.

Après déploiement du commit `48547bd`, la recette en ligne confirme :

- `28/28` anciennes adresses aboutissent à la destination attendue ;
- la forme historique `/bac-general/` est d'abord normalisée en
  `/bac-general`, puis redirigée vers `/site/bac-general` ;
- aucun débordement horizontal à `320 x 800` et `1440 x 900` sur l'accueil ;
- aucune image cassée ni erreur de console sur ce parcours ;
- CSP, HSTS, `X-Frame-Options: DENY` et cache API `no-store` présents.

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

Le rapport `content/legacy-site/editorial-review.md` transforme désormais la
relecture générale en constats adressables par contenu. Il signale notamment la
page Contact vide, l'image locale non récupérable des clubs, trois appels à
l'action concaténés, une adresse publique opaque et les décisions de fraîcheur
ou d'archivage encore humaines. Il ne modifie aucun brouillon.

1. Corriger ou remplacer les trois fichiers refusés.
2. Relire les 15 contenus durables, archiver les 7 anciennes actualités et
   décider du sort des 6 contenus à confirmer.
3. Relire le français et contrôler le rendu à 320 px et sur ordinateur.
4. Vérifier les 28 destinations sur la nouvelle preview après déploiement, puis
   comparer visuellement chaque rubrique avant toute bascule du domaine.
