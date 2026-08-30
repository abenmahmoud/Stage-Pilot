# Refus des secrets dans l'annuaire d'identités

## Périmètre

Le parseur privé CSV/XLSX contrôle les en-têtes et les cellules après antivirus,
mais avant normalisation, empreinte, chiffrement ou persistance des lignes.

Sont refusés :

- colonnes de mot de passe, OTP, code ENT, PRONOTE, EduConnect ou académique ;
- clés API, jetons, secrets clients et clés privées ;
- valeurs explicitement étiquetées comme mot de passe ou code d'accès.

Une simple mention d'aide, par exemple « mot de passe oublié », n'est pas une
valeur secrète et ne déclenche pas ce contrôle.

## Comportement fermé

- Le parseur lève uniquement le code `secret_forbidden`.
- Le message et le journal ne contiennent ni la cellule, ni la colonne, ni la
  valeur détectée.
- Aucune ligne, empreinte ou charge chiffrée n'est produite.
- Le worker classe cet échec comme déterministe dans le circuit privé et ne le
  renvoie pas vers l'agent ou un modèle.

## Limites

Les images et formats sans extraction fiable restent en relecture humaine. Une
éventuelle remise de codes d'accès exige un dispositif séparé validé par la
Direction et le DPO ; elle ne doit jamais réutiliser cet import d'annuaire.
