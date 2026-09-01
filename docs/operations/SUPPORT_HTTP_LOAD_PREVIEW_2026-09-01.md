# Charge HTTP du guichet - preview du 1er septembre 2026

## Périmètre

- Dépôt : `abenmahmoud/Stage-Pilot`.
- Branche : `codex/lycee-connect-prototype`.
- Commit applicatif mesuré : `a316f676dcc12aa5b63f3478399e9af1e3f670f7`.
- Déploiement immuable : `dpl_DPFPymFiGLx6fD9dXwTb7o2hA2c8`.
- Hôte immuable : `lyceegest-68pb1yza8-safe-scol.vercel.app`.
- Région Vercel : `cdg1` ; base Supabase de preview : `eu-west-3`.
- Données : uniquement fictives, adresses `@test.invalid` et marqueur de lot
  `6d3a2c032ce47b72`.
- Aucun email, SMS, appel OpenAI ou autre fournisseur externe n’a été exécuté.

Le jeton temporaire de partage Vercel n’est ni conservé ni reproduit ici.

## Recette

Le client `scripts/load-test-support-http-client.mjs` exige une confirmation
explicite du superviseur Supabase, un hôte de preview immuable et un marqueur de
seize caractères. Il refuse la production, le domaine du lycée et l’alias de
branche. Avant la mesure, vingt lectures concurrentes sans écriture préchauffent
le même niveau de concurrence que le test.

Le lot mesuré enchaîne :

1. 200 créations distinctes à concurrence 20, attendues en HTTP 201.
2. 200 rejeux avec la même clé, le même appareil et le même contenu, attendus en
   HTTP 200 avec le même numéro de dossier.
3. Contrôle SQL des quantités et de l’absence d’envoi fournisseur.
4. Suppression ciblée des dossiers, sessions, travaux et compteurs du lot.
5. Contrôle final de l’absence de résidu ou de travail orphelin.

## Résultats

| Mesure | p50 | p95 | p99 | Maximum |
| --- | ---: | ---: | ---: | ---: |
| Création | 302 ms | 790 ms | 839 ms | 1 434 ms |
| Rejeu idempotent | 318 ms | 852 ms | 940 ms | 945 ms |

- Réponses mesurées : 400.
- Dossiers et clés d’idempotence uniques : 200 / 200.
- Contacts, messages, jetons, sessions et liaisons : 200 chacun.
- Travaux de notification en file : 400, soit deux par dossier.
- Travaux archivés : 0.
- Succès fournisseur externe : 0.
- Compteurs propres aux créations : 1 000 ; compteur réseau partagé : 1.

Le seuil T047C, p95 création inférieur ou égal à 1,5 seconde hors notification
externe, est respecté. Un passage initial à froid a atteint 5 178 ms au p95 et
n’est pas présenté comme une réussite ; il justifie un suivi des démarrages à
froid, des connexions Supavisor et du p95 en exploitation.

## Nettoyage

Après la transaction de nettoyage, les contrôles retournent tous zéro :

- dossier du marqueur ;
- session créée après l’instantané et sans liaison ;
- compteur synthétique ;
- travail en file sans dossier ;
- travail archivé sans dossier.

## Limite restante

T047 n’est pas fermée : l’interruption d’un worker réellement connecté à sa file,
son redémarrage puis la résorption idempotente doivent encore être observés dans
une fenêtre d’exploitation explicitement autorisée.
