# Recette d'une demande cantine réelle — 7 septembre 2026

## Périmètre

Lecture minimale du dossier signalé par le propriétaire sur la branche Supabase
de preview utilisée par le domaine public. Aucun corps de message, nom,
coordonnée, jeton ou pièce jointe n'a été extrait. Aucune ligne n'a été modifiée,
aucun email n'a été envoyé et aucun déploiement n'a été effectué.

## Constats

- Un seul dossier existe : les trois emails visibles ne correspondent pas à
  trois créations de demande.
- Le dossier contenait cinq messages entrants web et deux réponses automatiques.
- Trois nouveaux messages entrants ont été enregistrés en moins de deux minutes.
- Le journal durable contient trois expéditions d'alerte distinctes pour ces
  trois événements, toutes confirmées `sent`, sans état `uncertain` ou
  `rejected`.
- Il ne s'agit donc pas d'une reprise du même travail par le worker. Le produit
  envoyait volontairement une alerte par message, ce qui est trop bruyant pour
  un échange court.
- La demande mentionnait explicitement la cantine puis employait le verbe
  générique « s'inscrire ». Les fonctions d'inférence testaient l'inscription
  avant la cantine : la catégorie générale gagnait, même si le routeur serveur
  conservait correctement le service Intendance.

## Correction préparée

- Le domaine explicite `cantine` est évalué avant les mots génériques
  `inscription` et `inscrire`, côté serveur et dans le repli du navigateur.
- Les alertes de nouveaux messages partagent désormais une fenêtre persistante
  de cinq minutes par établissement, dossier et type de notification. Chaque
  message reste enregistré ; seul l'appel email supplémentaire est dédupliqué.
- Les anciens travaux sans fenêtre restent acceptés pour permettre une mise à
  jour progressive du worker.
- Les fenêtres sont calculées à partir de la date persistée du message, ce qui
  évite qu'un redémarrage ou deux workers concurrents changent le résultat.

## Vérification locale

- `test:support-agent` ;
- `test:assistant-school-context` ;
- `test:support-routing` ;
- `test:support-email-job-policy` ;
- `test:support-assistant-client-payload` ;
- `test:communication-brevo-inbound` ;
- `test:support-requester-message-confirmation` ;
- build TypeScript et Vite ;
- construction du paquet du worker email ;
- barrière complète `test:preview-security-gate`.

Tous ces contrôles passent. La recette d'intégration PostgreSQL du worker n'a
pas pu être exécutée, car l'instance locale attendue sur le port 54322 et le
moteur Docker Desktop n'étaient pas actifs. Les tests unitaires vérifient la clé
de regroupement, la compatibilité des anciens travaux et la séparation de la
fenêtre suivante ; la recette PostgreSQL reste requise avant mise en ligne.

## Exploitation

La réponse humaine doit être envoyée depuis l'espace agent afin d'être liée au
dossier et journalisée. Le bouton Répondre de la notification Gmail n'est pas le
canal de traitement agent. La correction n'est pas active sur le domaine tant
que le commit n'a pas été intégré, la preview vérifiée et le worker VPS mis à
jour selon sa procédure de livraison.
