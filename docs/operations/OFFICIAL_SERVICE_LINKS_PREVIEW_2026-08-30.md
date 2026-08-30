# Accès aux services officiels - preview

## Comportement livré

- LyceeGest reste l'application existante pour les stages et le Grand Oral.
- Les modules Stages et Grand Oral sont ouverts par liens contextuels, sans
  recopier leurs données dans le guichet d'aide.
- Scolarité Services ouvre la page officielle du ministère de l'Éducation
  nationale qui présente les démarches et les modes de connexion.
- PRONOTE est annoncé via l'ENT Monlycée.net déjà connu du portail.
- Aucune adresse PRONOTE propre au lycée n'est inventée.

## Vérifications

- `npm run test:official-service-links` contrôle les destinations et interdit un
  domaine PRONOTE supposé dans le code du portail.
- Les liens externes s'ouvrent avec `rel="noreferrer"`.
- Playwright local à 320 x 800 et 1 440 x 900 confirme les deux cartes visibles,
  sans débordement horizontal, erreur console ou overlay Vite.
- T041 reste ouverte jusqu'à validation d'une éventuelle adresse PRONOTE directe
  par l'établissement.

## Source publique

La page du ministère utilisée est
`https://www.education.gouv.fr/scolarite-services-un-acces-unique-pour-toutes-les-demarches-scolaires-326158`.
