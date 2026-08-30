# Brief d'audit Claude - sémantique des mesures de l'agent

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et la limite
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `src/pages/admin/SupportOperationsPage.tsx`
- `api/support/agent/metrics.ts`
- `shared/agent-runtime-metrics.ts`
- `scripts/test-agent-runtime-metrics.mjs`

## Mission proposée

Auditer en lecture seule la signification des indicateurs IA, routage et
réorientation. Vérifier qu'aucun résultat technique n'est présenté comme une
validation humaine, qu'aucun taux n'implique une causalité non mesurée et que
les agrégats restent sans identité ni contenu de dossier. Ne modifier aucun
fichier, environnement ou déploiement.

## Sortie attendue

- formulations ambiguës classées par gravité avec fichier et ligne ;
- métrique réellement calculée face au libellé affiché ;
- correctif minimal proposé sans nouvelle collecte personnelle ;
- mention explicite si aucune ambiguïté bloquante n'est trouvée.
