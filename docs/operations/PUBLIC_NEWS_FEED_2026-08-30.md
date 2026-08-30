# Consultation publique des informations

## Lot livré

La vue `À la une` permet désormais de rechercher sans accent dans le titre, le
résumé et la catégorie, de filtrer par catégorie et de connaître le nombre de
résultats. Chaque information affiche sa date et les contenus mis en avant
restent prioritaires dans l'ordre fourni par le serveur.

Les contrôles sont utilisables au clavier, possèdent des libellés accessibles et
passent sur une seule colonne sous 720 px. Une recherche vide peut être effacée
sans recharger la page.

## Garanties conservées

- seule la version explicitement publiée est lue ;
- les brouillons et contenus archivés restent absents ;
- la date de début et l'expiration sont contrôlées côté serveur ;
- la recherche ne demande aucune nouvelle API et ne journalise pas la requête ;
- aucun corps de document, contact ou champ interne n'entre dans l'index local.

## Pagination

L'API retourne au plus 100 contenus par appel et fournit un curseur opaque pour
la suite. Le bouton `Charger plus d'informations` ajoute les éléments sans
doublon et conserve la page courante en cas d'échec.

La durée et la visibilité des archives publiques n'ont pas encore été décidées.
T015 reste donc ouverte pour cette politique, sans inventer ces règles dans le
code.
