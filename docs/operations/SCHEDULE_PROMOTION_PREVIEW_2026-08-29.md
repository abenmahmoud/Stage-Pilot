# Promotion des emplois du temps en preview

## Livré

- Approbation uniquement après contrôle PDF propre et index complet vérifié.
- Activation atomique d'une seule version par établissement, type et année.
- Retour arrière vers une version remplacée, sans suppression de preuve.
- Justification obligatoire, confirmations `ACTIVER` et `RESTAURER`, audit privé.
- Verrous partagés entre modification de page, approbation, activation et
  restauration.
- Barrière PostgreSQL par la migration
  `20260829114151_enforce_schedule_promotion_integrity.sql`, durcie par
  `20260829114935_harden_schedule_validation_summary.sql` pour refuser aussi les
  clés de validation absentes.

## Preuves fictives

La recette transactionnelle de preview a validé :

1. une approbation avec toutes les pages vérifiées ;
2. le refus d'un passage direct de `review` à `active` ;
3. le refus d'un index incomplet ;
4. le passage `active`, `superseded`, puis `active` pour le retour arrière ;
5. l'action d'audit `rollback` ;
6. le refus d'une seconde version active sur le même périmètre.

La recette de durcissement a en plus refusé une validation JSON absente et
accepté la même promotion avec les deux preuves attendues.

Les transactions ont été annulées. Contrôle final : zéro source, zéro page
indexée, zéro audit d'emploi du temps et zéro travail dans la file.

Tests ciblés : sécurité 14/14, promotion 3/3, interface 7/7, référence opaque
3/3, worker 4/4 et saisie d'import 6/6. Le build TypeScript/Vite réussit.
Les conseillers Supabase ne remontent aucun avis de sécurité au-dessus du niveau
informatif pour ce périmètre.

## Limites maintenues

- Aucun PDF réel téléversé.
- Aucun worker installé sur le VPS.
- Aucune activation exécutée avec une donnée réelle.
- Aucun changement en production, sur Hostinger, DNS, VPS, Webmail, PRONOTE ou
  ENT.
- Le futur lien agent limité à une seule page et la règle de conservation ne
  font pas partie de ce lot.
