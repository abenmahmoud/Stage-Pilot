# Relations d'identité et cloisonnement des périmètres

## Résultat

La tâche `002/T010C` est terminée sur la preview. Les liens nécessaires sont
définis dans les sources privées et leur utilisation échoue de manière fermée :
un compte ne peut pas choisir librement un enfant, une classe, un groupe, un
service ou un autre établissement.

Cette preuve utilise uniquement des fixtures. Elle ne vaut ni import d'annuaire
réel, ni enrôlement de comptes nominatifs, ni activation de l'OTP ou du SMS.

## Autorités retenues

- **Élève-responsable** : `school_relationships` porte le lien
  `guardian_of`, lié à une identité, un établissement et une version active de
  l'annuaire, avec état et dates de validité.
- **Classe-groupe** : la fiche personne valide porte `class_ref` ; les groupes
  viennent uniquement des lignes `member_of` de la même version active, du même
  établissement et de la même personne.
- **Personnel-service** : `identity_directory_rows.service_code` décrit le
  rattachement issu de l'annuaire. Il ne donne aucun droit d'administration.
  L'accès opérationnel à un service vient exclusivement de
  `institution_memberships.service_codes`, relu côté serveur avec le statut du
  compte et le MFA requis.

Cette séparation empêche qu'un champ d'annuaire, une métadonnée de profil ou une
phrase adressée à l'agent élargisse les droits d'un personnel.

## Preuves rejouées

- `npm run test:schedule-identity-reader` : 20 tests réussis. Ils couvrent le
  responsable lié, deux enfants séparés, l'autre foyer, l'autre établissement,
  les relations révoquées ou périmées, les classes et groupes étrangers, la
  source remplacée et le personnel limité à sa propre référence.
- `npm run test:identity-access` : 14 tests réussis. Ils couvrent le même
  établissement, la relation active et l'interdiction d'un autre service.
- `npm run test:institution-membership-security` : 2 tests réussis. Les
  adhésions et services restent réservés au serveur avec RLS forcée et valeurs
  contraintes.
- `npm run test:agent-security-gates` : 13 tests réussis. Le périmètre persistant
  prévaut sur les services déclarés dans le profil et est relu à chaque requête.
- `npm run test:identity-directory-parser` : 17 contrôles réussis, dont les
  lignes personnel-service et les relations référencées.
- La recette transactionnelle de preview déjà conservée dans
  `docs/operations/SCHEDULE_PRIVATE_READER_PREVIEW_2026-08-30.md` a prouvé avec
  trois comptes Auth fictifs qu'un élève voit son seul groupe, pas l'autre
  classe, et qu'un responsable n'est lié qu'au bon enfant. Son `ROLLBACK` a
  laissé zéro résidu.

## Limites maintenues

- Aucun compte réel, nom, contact, emploi du temps ou relation familiale réelle.
- Le choix visuel entre plusieurs enfants reste dans `T042D2D` et attend un
  libellé minimal validé par le lycée.
- Les comptes usagers, canaux OTP/SMS, rapprochements d'annuaire et imports réels
  restent dans leurs tâches ouvertes.
- Production, DNS, Hostinger, VPS, Webmail, ENT et PRONOTE sont inchangés.
