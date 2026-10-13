# Tableau des actions pour les équipes — 13 octobre 2026

Adel veut partager le travail avec des collègues qui trouvent la console de
demandes trop complexe. Il doit voir rapidement le problème, la date, le numéro
et ce qu’il faut faire, puis déléguer sans recopier chaque dossier.

## Parcours retenu

Route privée `/gestion/actions`, accès depuis la navigation de gestion et le
manuel. Les lignes proviennent des demandes actuelles, archives exclues par
défaut. Deux vues distinctes : demandes des usagers et matériel/SPIE. Filtres
service, suivi, recherche et pagination explicite. Chaque ligne présente la
date, le numéro, le besoin récent, le service, le statut et la prochaine action.

Une démarche déterministe proposée est clairement distinguée d’une consigne
humaine. La consigne est une note interne versionnée dans l’historique existant,
enregistrée par le vrai compte et confirmée par l’API normale idempotente. Aucune
réponse, changement d’identité, modification de coordonnées ou clôture ne découle
de son enregistrement. Ouvrir le dossier utilise le numéro exact.

Le lien partagé conserve les filtres de service et de suivi, sans identifiant
de connexion, contact, recherche nominative ou jeton. Chaque collègue doit se
connecter avec ses droits existants ; aucun accès anonyme n’est ajouté. Le PDF
est une impression de la page affichée, avec nombre de lignes, pagination et
date de génération. Les noms sont exclus de l’impression par défaut ; les
contacts, codes et fichiers ne font jamais partie du tableau.

## Critères de recette

- Authentification et filtre institution/service identiques à la file existante.
- Séparation SPIE et conservation de l’exclusion des archives côté serveur.
- Texte borné, contacts masqués, secrets détectés exclus et rendu sans HTML brut.
- Ancienne réponse entrante remplacée par le dernier besoin communiqué.
- Confirmation idempotente de note, sans notification ni clôture automatique.
- États de chargement, refus, tableau vide, pagination et liens fonctionnels.
- Lecture ordinateur et téléphone ; impression A4 paysage intelligible.

## Limites

Une démarche proposée ne prouve ni une identité ni une résolution. Le tableau
n’envoie rien à la famille. Le compte utilisateur d’une autre équipe ne reçoit
jamais plus de droits à travers le lien. La copie papier ne se synchronise pas.
