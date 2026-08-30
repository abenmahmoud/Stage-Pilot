# Surveillance des échéances - preview

## Comportement livré

- Une nouvelle demande est créée sans échéance lorsque le lycée n'a pas encore
  validé de règle de délai.
- L'API agent peut filtrer les demandes ouvertes dont une échéance enregistrée
  est dépassée.
- Le filtre conserve le périmètre de l'établissement, du rôle et du service.
- L'espace agent expose un onglet `En retard` avec le compteur correspondant.
- Aucune relance, escalade, notification ou communication externe n'est lancée.

## Vérifications

- `npm run test:support-queue` : 7 tests réussis.
- `npm run test:support-sla-monitoring` : 3 tests réussis.
- `npm run test:spec-integrity` : 384 tâches uniques, aucune collision.
- Build TypeScript/Vite réussi.
- Playwright local avec dossier fictif à 320 x 800 et 1 440 x 900 : onglet
  activé après clic, zéro débordement horizontal, aucune erreur console et aucun
  overlay Vite.
- Aucune migration, donnée réelle ou variable distante n'a été utilisée.

## Limites assumées

Les délais par priorité et service, les horaires ouvrés, les responsables à
notifier et les règles d'escalade doivent être validés par le lycée. Tant que
ces décisions manquent, T029 reste ouverte et le système ne fabrique aucune
automatisation métier.
