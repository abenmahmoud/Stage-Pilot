# LOT 5 — Dossier de bascule pour vendredi

Date : 2026-09-03 (nuit), branche `codex/lycee-connect-prototype`.
Aucune action distante. Rien poussé. Rien publié. Aucun drapeau activé.

## Résultat en un mot

**Dossier écrit, aucune étape exécutée.** Le fichier
`docs/operations/BASCULE_SITE_VENDREDI_2026-09-04.md` détaille la procédure
de bascule vendredi, dans l'ordre : pré-requis, sauvegarde/restauration
test, promotion du schéma (3 → 94), promotion du code, contrôle du flux
public en `200`, contrôle des 27 redirections en ligne, bascule DNS/alias,
contrôle post-bascule, fenêtre et procédure de retour arrière. Chaque étape
indique la commande ou l'action, le contrôle de réussite, le retour arrière,
une durée estimée, et si elle relève du propriétaire seul (accès distant)
ou peut être préparée/automatisée depuis ce dépôt.

## Méthode

Le plan de nuit exige que ce lot ne soit pas « une procédure non fondée » :
rédaction faite uniquement à partir des preuves déjà produites cette nuit
par les LOT 1 à 4, relues avant d'écrire :

- `docs/operations/night-logs/LOT1.md` (94 migrations rejouées sans erreur
  en local, données synthétiques) ;
- `docs/operations/night-logs/LOT2.md` (répétition 3 → 94 sur pile locale
  jetable, code de production `a9cf32e` et code courant testés contre le
  schéma final, cause exacte du `500` identifiée : `site_content_items`
  absente en production réelle, liste ordonnée des opérations de promotion
  et procédure de retour arrière déjà esquissées — reprises et détaillées
  ici) ;
- `docs/operations/night-logs/LOT3.md` et
  `docs/operations/BASCULE_SITE_ETAT_EDITORIAL_2026-09-03.md` (les 28
  contenus WordPress sont non publiables aujourd'hui : verrou T007 pour les
  28, plus 3 blocages techniques qui subsisteraient même après vérification
  direction) ;
- `docs/operations/night-logs/LOT4.md` (27 redirections et liens internes
  au vert, contrat responsive automatisé au vert, mais aucun rendu réel de
  navigateur fait faute d'outil) ;
- `docs/operations/SITE_PRODUCTION_CUTOVER_RUNBOOK.md` et
  `docs/operations/LYCEEGEST_PRODUCTION_PROMOTION_READINESS_2026-09-02.md`
  (procédure de bascule DNS déjà écrite le 28 août, portes obligatoires de
  promotion déjà écrites le 2 septembre — ce lot les combine et les met à
  jour avec les résultats effectifs du LOT 2, au lieu de les dupliquer sans
  lien) ;
- `docs/operations/RECOVERY_ISOLATED_RESTORE_PREVIEW_2026-09-01.md`
  (mécanisme de restauration isolée prouvé sur données fictives, pas encore
  branché sur un export réel de production — noté explicitement comme
  limite) ;
- `package.json` (`grep` ciblé) : confirmation qu'aucun script
  `backup`/`pg_dump`/`restore` n'existe dans ce dépôt, et repérage des
  commandes réutilisables existantes (`recipe:public-pilot-smoke`,
  `test:legacy-routes`, `test:legacy-coverage`, `test:security-headers`,
  `test:preview-security-gate`) citées dans le dossier produit.

Aucune commande n'a été exécutée pour ce lot au-delà de la lecture (`Read`,
`Grep`) : ce lot est une rédaction, pas une recette technique.

## Constat notable

Le dossier produit sépare explicitement deux périmètres qui pourraient être
confondus : la bascule **technique** (schéma + code + DNS), pour laquelle
les LOT 1-2 donnent un GO conditionnel documenté, et la bascule
**éditoriale** (les 28 contenus WordPress), qui reste bloquée par une
décision humaine (T007) indépendamment de l'état technique. Le dossier
précise qu'une bascule vendredi ne peut porter que sur le premier périmètre
tant que le second n'a pas de décision.

## Fichier produit

`docs/operations/BASCULE_SITE_VENDREDI_2026-09-04.md`

## Distinction PROUVÉ / SUPPOSÉ / À FAIRE PAR LE PROPRIÉTAIRE

- **PROUVÉ** (repris des LOT 1-4, non revérifié cette nuit) : rejeu 3 → 94
  sans erreur SQL, code production et code courant compatibles avec le
  schéma final, cause du `500` identifiée, 28 contenus non publiables, 27
  redirections et liens internes au vert.
- **SUPPOSÉ** : que le comportement du CLI Supabase local est représentatif
  du Postgres managé de production (hérité du LOT 2, non retesté ici) ; que
  les commandes citées (`recipe:public-pilot-smoke` notamment) peuvent être
  repointées sur une URL de production réelle sans modification — non
  vérifié cette nuit, signalé explicitement dans le dossier produit.
- **À FAIRE PAR LE PROPRIÉTAIRE** : toutes les actions distantes listées
  dans le tableau « qui fait quoi » du dossier (sauvegarde réelle,
  restauration isolée réelle, promotion réelle du schéma et du code, bascule
  DNS, surveillance post-bascule), plus l'écriture d'un script de sauvegarde
  Supabase (absent du dépôt) et la vérification par rendu réel de
  navigateur laissée ouverte par le LOT 4.

## Portée non couverte par ce lot

Aucune sauvegarde, restauration, migration, déploiement ou changement DNS
n'a été exécuté ce soir — interdit par `CLAUDE.md` et hors périmètre du
LOT 5, qui est une rédaction de procédure, pas une exécution.
