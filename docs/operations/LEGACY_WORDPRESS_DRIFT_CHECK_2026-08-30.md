# Contrôle de dérive du site WordPress historique

## Portée

Contrôle en lecture seule du site public
`https://lycee-blaise-cendrars-sevran.fr`, comparé à
`content/legacy-site/inventory.json`. Aucune donnée n'est importée, publiée ou
modifiée par cette opération.

## Garde-fous

- origine HTTPS officielle codée en dur ;
- requêtes `GET` uniquement, redirections refusées ;
- délai maximum de 15 secondes par collection ;
- réponse limitée à 1 000 000 octets, y compris sans `Content-Length` ;
- au plus 100 pages et 100 articles ;
- pagination déclarée obligatoire et cohérente, afin de ne masquer aucun contenu ;
- validation stricte du type, du statut publié, des identifiants, adresses,
  titres et dates ;
- aucun secret, paramètre de production ou droit WordPress requis.

## Preuve du 30 août 2026

Commande :

```powershell
npm run legacy:check-drift
```

Résultat :

| Mesure | Valeur |
| --- | ---: |
| Contenus inventoriés | 28 |
| Contenus publics actuels | 28 |
| Ajouts | 0 |
| Retraits | 0 |
| Modifications | 0 |

Les cinq tests locaux prouvent aussi la détection des ajouts, retraits,
modifications, doublons, contenus non publiés et origines étrangères.

## Limite de la preuve

Cette parité porte sur l'identité publique, l'adresse, le titre et la date de
modification des contenus. Elle ne remplace pas la comparaison visuelle et
éditoriale, ni la validation des responsables avant une éventuelle bascule.
