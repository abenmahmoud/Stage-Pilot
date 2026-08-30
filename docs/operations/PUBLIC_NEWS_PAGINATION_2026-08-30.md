# Pagination publique des informations

## Contrat

- `GET /api/content/public` retourne au plus 100 éléments et `nextCursor` ;
- `limit` accepte un entier de 1 à 100 ;
- `cursor` est opaque pour le client, limité à 512 caractères et rejeté s'il
  est mal formé ;
- l'ordre total est priorité décroissante, date décroissante puis identifiant
  décroissant ;
- une lecture par `slug` reste limitée à un élément et n'utilise pas le curseur.

## Défense en profondeur

La requête SQL exclut les versions non publiées, archives, audiences restreintes,
publications futures et contenus expirés. L'instantané publié est ensuite relu
avec la même politique avant de préparer les fichiers temporaires.

Le curseur ne contient ni titre, ni texte, ni adresse, ni identifiant de compte.
Ce n'est pas une autorisation : même un curseur valide construit manuellement
reste soumis à tous les filtres publics. Une valeur mal formée reçoit une erreur
400 générique et ne déclenche aucune reprise automatique côté client.

## Interface

Le chargement suivant est explicite. Les identifiants déjà présents sont
éliminés, le bouton est désactivé pendant la requête et une panne n'efface pas
les informations déjà affichées.
