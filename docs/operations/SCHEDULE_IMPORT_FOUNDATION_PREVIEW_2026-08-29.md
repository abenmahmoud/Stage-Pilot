# Coffre des emplois du temps en preview

## Etat livre

- `schedule_source_versions` : versions PDF classes/professeurs, date d'effet,
  statut et responsables nominatifs.
- `schedule_page_indexes` : une page vers une reference opaque de classe ou de
  personnel, avec verification humaine obligatoire.
- `schedule_audit` : actions minimales, acteur et date sans identite scolaire ni
  contenu d'emploi du temps.
- `schedule-ingest` : bucket prive, PDF seulement, 50 Mo maximum.
- `/admin/emplois-du-temps` : reservation et confirmation d'un depot sous MFA.

Les migrations de preview sont :

- `20260829105141_create_schedule_import_foundation.sql` ;
- `20260829105238_index_schedule_audit_institution.sql` ;
- `20260829105632_harden_schedule_scope_integrity.sql` ;
- `20260829112115_create_schedule_document_scan_queue.sql` ;
- `20260829113248_enforce_schedule_page_review_bounds.sql` ;
- `20260829114151_enforce_schedule_promotion_integrity.sql` ;
- `20260829114935_harden_schedule_validation_summary.sql`.

## Verifications

- Migration complete creee dans une transaction puis annulee sans reste.
- Trois tables presentes et vides apres application.
- Bucket prive conforme et aucun droit de lecture/ecriture client direct.
- Une version active fictive et une page fictive verifiee acceptees.
- Une deuxieme version active du meme perimetre refusee par la contrainte unique.
- Recette entierement annulee : zero version, page et audit de test.
- Conseiller Supabase : aucun index de cle etrangere manquant pour ces tables.
  Les seuls messages de performance sont des index inutilises, resultat attendu
  sur des tables vides.

## Blocages maintenus

Un PDF reçu est maintenant placé dans une file privée après confirmation, mais
le worker n'est pas installé sur le VPS. Avant toute donnée réelle, il faut
encore :

1. installer le worker puis vérifier PDF sain, EICAR, panne et reprise ;
2. le lien agent limité à la page autorisée ;
3. une durée de conservation validée et des comptes agents nominatifs testés.

La production, Hostinger, le DNS, le VPS, PRONOTE, l'ENT et les deux PDF reels
n'ont pas ete modifies.
