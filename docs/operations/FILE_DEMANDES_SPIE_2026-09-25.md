# File des demandes et circuit SPIE — 25 septembre 2026

## Problème constaté

Le filtre « ordinateur » réunissait les signalements de matériel destinés au
circuit SPIE et les demandes numériques ordinaires. La file générale ouvrait
également les dossiers terminés par défaut et le compteur « En cours » ne
possédait pas de filtre correspondant.

Le contrôle agrégé de la base pilote a confirmé quatre signalements
`materiel_lycee` ouverts et une autre demande `ordinateur`. Aucune identité ni
aucun message de dossier n'a été lu pour ce contrôle.

## Correction

- périmètre serveur `equipment` : uniquement catégorie `ordinateur` et
  sous-catégorie `materiel_lycee` ;
- périmètre serveur `digital` : demandes `ordinateur` hors matériel SPIE ;
- la page Matériel & SPIE et son lien vers la file utilisent le périmètre
  `equipment` et uniquement les dossiers ouverts ;
- l'affectation d'un dossier à un passage SPIE refuse désormais une demande
  qui n'est pas `materiel_lycee` ;
- la file de gestion s'ouvre sur « À traiter » et sépare « En cours », « En
  attente » et « Terminées » ;
- les filtres moins fréquents sont regroupés dans « Priorité et suivi » ;
- les vues « Urgentes » et « Sans agent » excluent les dossiers terminés.

## Vérifications

- compilation TypeScript et build Vite réussis ;
- filtres, validation des paramètres, compteurs, accessibilité, délais,
  demandes sans agent, vérifications internes et politique matériel testés ;
- aucun dossier, statut, affectation ou message existant n'a été modifié ;
- aucun envoi email, SMS ou push n'a été déclenché.

