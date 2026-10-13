# Tableau des actions pour les équipes — 13 octobre 2026

## Besoin et résultat préparé

Adel demande une liste simple et partageable pour déléguer le suivi, avec date,
numéro, problème et prochaine action. Nouvelle route privée `/gestion/actions`,
navigation et manuel. Le tableau utilise la file réelle, filtrée par droits
existants, archives exclues et matériel/SPIE séparé. Aucune migration nécessaire.

Les consignes sont des notes internes explicites, enregistrées par le compte
connecté via le point d’entrée existant, idempotent et journalisé. La confirmation
est vérifiée avant d’afficher une réussite. Aucun email, code, changement de
coordonnées ou clôture automatique. Le dossier complet s’ouvre sur le bon numéro.

Partage du lien filtré avec connexion requise ; impression A4 paysage de la
page visible avec pagination et date. Les coordonnées, liens privés et secrets
sont exclus du tableau ; noms du demandeur masqués dans l’impression par défaut.

## Vérifications locales

- Compilation TypeScript et build Vite réussis.
- Contrôles ciblés de démarche proposée, confidentialité, payload, pagination
  et périmètre réussis. Les validations de la file existante et les confirmations
  idempotentes de notes restent vérifiées.
- Recette sur quatre demandes strictement fictives : consigne enregistrée et
  relue après actualisation, filtre Intendance, séparation SPIE, lien de partage.
- Mobile 390 px : aucune largeur débordante et carte lisible ; aperçu ordinateur
  capturé. L’impression ouvre le dialogue du navigateur ; la sauvegarde d’un
  PDF effectif n’a pas été automatisée. Les styles et bornes d’impression sont
  préparés, sans prétendre avoir réalisé une impression matérielle.
- Un contrôle facultatif du worker d’archives n’a pas démarré, son module
  `@xmldom/xmldom` étant absent sur ce poste ; le worker n’est pas modifié par
  ce lot. Ne pas présenter la suite générale comme réussie.

## Mise à disposition

Publication et recette sur le domaine à confirmer après le déploiement de ce
lot. Les droits des comptes ne sont pas modifiés et aucune invitation n’est
envoyée aux équipes. Les captures et les sorties nominatives restent hors Git.
