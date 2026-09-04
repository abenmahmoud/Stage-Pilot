# Finition des parcours publics — 4 septembre 2026

Adel demande de terminer le site pendant qu’il prépare avec Claude sa liste de
données. Ce lot concerne les pages publiques et leur navigation. Le contrôle
initial retrouve le domaine principal sur `13d3c33`, projet Vercel
`prj_mgYyTk8e2FwUMW5kSG8176Snypy5`, base `xijocumlwivhbmffrnlj`.

## Corrections livrées

- Les boutons de navigation utilisent le routeur : précédent/suivant et les
  liens de pied de page changent réellement la rubrique affichée.
- Les sections formations, spécialités, vie du lycée et contact ont des liens
  partageables, avec défilement après navigation ou rechargement.
- Les liens formations/spécialités ne renvoient plus vers des brouillons
  WordPress indisponibles. Les anciennes adresses gardent leur redirection et
  proposent une rubrique publique utile lorsque la page n’est pas publiée.
- Une panne réseau se distingue d’une page non publiée et propose Réessayer.
  Les réponses annulées ne remplacent pas la page courante.
- Pied de page commun : contact et accès, suivi, confidentialité, téléphone.
  Lien d’évitement clavier, fermeture du menu avec Échap, titres de pages.
- L’application installée s’ouvre sur `/`, comme les notifications de suivi.
  Son identifiant de manifeste est conservé pour les installations existantes.

## Vérifications avant publication

- `npm run build` : succès.
- `npm run test:preview-security-gate` : succès, 96 versions de migration uniques.
- Contrats de contenus publics, anciennes redirections, cibles tactiles et
  intégrité Spec Kit : succès.
- Navigateur Chromium : 24 vérifications à 320, 390 et 1440 pixels, aucune
  exception JavaScript, aucun débordement horizontal. Sept vues, précédent et
  suivant, rechargement d’une section et alternatives de trois anciennes pages.
- Recette locale sans envoi : API de lecture simulées avec listes vides ; les
  appels de mutation sont bloqués par le navigateur de test.
- Captures conservées dans `.vercel/site-finalisation/`, dossier ignoré par Git.

## Relecture des contenus préparée séparément

Lecture seule du registre : 28 brouillons WordPress en attente de vérification,
78 médias enregistrés comme `ready`. Aucun contenu n’est marqué vérifié ou publié.
Sept propositions de correction sont préparées localement, dont le corps vide
de la page Contact, à partir des coordonnées de la
[fiche officielle Onisep](https://www.onisep.fr/ressources/structures-enseignement/ile-de-france/seine-saint-denis/lycee-polyvalent-blaise-cendrars),
consultée le 4 septembre 2026.

Le paquet local `.vercel/site-finalisation/relecture-pages.html` contient les
28 textes proposés, leur version source et les points restant à relire. Après
préparation : aucun blocage technique, huit points importants et trente points
de relecture. Ces compteurs ne constituent pas une validation éditoriale.
Les trois médias refusés à l’import initial restent à remplacer ou corriger.

La direction et les services doivent encore confirmer horaires, activités,
responsables, formulaires annuels et archives. Le contrôle de publication
existant reste appliqué ; aucun import d’annuaire, envoi ou remise de code
n’est exécuté par ce lot.

## Publication et retour arrière

La branche `codex/lycee-connect-prototype` est liée au domaine principal. Son
déploiement sera contrôlé après push avec un nouveau passage navigateur en
lecture seule. Le retour du code peut réaffecter le domaine au déploiement
précédent `dpl_4RTACjT343Ljxz87q7g5yTfLHS3d`. Aucune migration de base n’est
nécessaire pour ce lot.
