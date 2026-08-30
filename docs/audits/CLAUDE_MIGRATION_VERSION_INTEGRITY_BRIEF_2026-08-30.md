# Brief Claude - intégrité des versions Supabase

## Statut

Brief préparé, non exécuté. Le modèle Claude exact et le plafond de consommation
doivent être autorisés pour cette mission précise.

## Mission proposée

Vérifier en lecture seule que la correction de collision ne réordonne pas une
migration déjà appliquée, que toutes les références sont alignées et que le
nouveau contrôle détecte les collisions futures sans faux positif évident.

## Périmètre minimal

- les deux migrations `20260830090000` et `20260830090500` ;
- `scripts/apply-preview-support-assistant-routing-review.mjs` ;
- `scripts/test-support-assistant-routing-review.mjs` ;
- `scripts/test-migration-version-integrity.mjs` ;
- diff Git du lot.

Aucun accès Supabase, secret, `.env`, donnée réelle ou outil d'écriture.

## Questions

1. La migration renommée est-elle bien celle déclarée non appliquée ?
2. Une référence conserve-t-elle l'ancien nom par erreur ?
3. Le test couvre-t-il les références directes et les scripts `VERSION`/`NAME` ?
4. Une migration ultérieure peut-elle reprendre silencieusement une version ?

## Arrêt

Un rapport court classé par sévérité, avec fichier et correction minimale. Une
seule passe, sans relance ni élargissement.
