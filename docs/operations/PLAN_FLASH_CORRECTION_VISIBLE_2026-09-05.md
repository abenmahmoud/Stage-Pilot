# Plan de travail — une correction se publie, 5 septembre 2026

Quatre lots plus la clôture.

## La régression à réparer

`shared/flash-transitions.ts` : `publiee: ["modifiee"]`, puis `modifiee: []`.
État terminal. La route publique ne sert que `publiee`. **Corriger une
information visible la retire donc du site**, au lieu de la remplacer par sa
version corrigée. C'est l'exact contraire de ce que la règle de correction
cherche à obtenir : elle existe pour que les gens cessent d'avoir une
information fausse, pas pour qu'ils n'aient plus rien.

## La décision d'Adel, à respecter à la lettre

Au moment d'enregistrer une correction, l'écran **rappelle qu'il faut publier**
pour qu'elle prenne effet. Même geste humain que la première parution.

Corollaire : entre l'enregistrement et la publication, la version publiée
précédente **reste affichée**. Périmée, mais c'est ce que les gens ont déjà lu.
La retirer en silence est pire. L'écran doit dire clairement que le public voit
encore l'ancienne version.

## Règles communes

Identiques aux plans précédents : `CLAUDE.md`, jamais de `git push`, aucun
drapeau ouvert, aucun envoi, aucune donnée réelle, migrations sur pile locale
jetable, `npm run build` et la barrière de sécurité avant commit, compte rendu
obligatoire dans `docs/operations/night-logs/CORR-LOTn.md` séparant ce qui est
prouvé de ce qui reste supposé. Réutiliser les modules existants ; ne jamais
réimplémenter une règle déjà écrite.

Pièges déjà payés : colonnes non qualifiées dans une sous-requête corrélée
Drizzle, NULL pris pour un booléen strict, test de schéma pris pour une preuve.

---

## LOT 1 — Ouvrir la transition et protéger l'affichage

- `modifiee` -> `publiee` devient une transition légale, ouverte par le même
  service et le même geste que la première publication.
- La règle de visibilité sert **la dernière version publiée**, même quand une
  version plus récente est en attente de publication. Une information ne
  disparaît jamais du site du fait d'une correction.
- Tests : correction enregistrée puis non publiée (l'ancienne reste servie),
  correction publiée (la nouvelle remplace), correction publiée après
  expiration (rien n'est servi), deux corrections successives.

## LOT 2 — Le rappel à l'enregistrement

- À la confirmation d'une correction, l'écran affiche le rappel : la correction
  est enregistrée, elle n'est **pas** visible, il faut publier.
- Tant qu'elle n'est pas publiée, l'écran indique que le public voit encore
  l'ancienne version, et laquelle.
- Le bouton de publication est immédiatement accessible depuis ce rappel.

## LOT 3 — Choisir l'audience publique depuis l'écran

Aujourd'hui `FLASH_PUBLIC_AUDIENCE_GROUP_REF = "public:site"` n'a aucun chemin
depuis l'interface : aucune flash ne peut atteindre la route publique par un
usage normal. Ajouter ce choix à l'écran de proposition, et le rendre explicite
— « visible par tous sur le site » — plutôt qu'un code technique.

## LOT 4 — Recette

Sur PostgreSQL réel jetable et en navigateur, sans SQL forcé :

- publier, corriger, constater que l'ancienne version reste servie ;
- publier la correction, constater le remplacement ;
- vérifier qu'aucune étape ne laisse la page publique vide ;
- proposer une flash « visible par tous » depuis l'écran, la publier, la voir ;
- captures à 320, 390 et 1 440 px.

## LOT 5 — Clôture

Compte rendu global. Dire ce qui reste avant qu'une information puisse être
envoyée pour de vrai, et ce qu'Adel doit encore trancher.
