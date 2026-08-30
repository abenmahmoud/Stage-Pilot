# Relecture des communications - preuve preview du 30 août 2026

## Périmètre

- Projet Supabase : branche preview `xijocumlwivhbmffrnlj` uniquement.
- Migrations : `20260830080000_harden_communication_review_lifecycle.sql` et
  `20260830081500_remove_duplicate_communication_job_index.sql`, puis
  `20260830082000_retain_and_attach_communication_versions.sql`.
- Aucun contact, document ou compte réel ; aucune publication et aucun envoi.
- Le module reste fermé par défaut dans l'interface et côté serveur.

## Circuit validé

1. Un éditeur autorisé saisit ou corrige un brouillon interne.
2. Toute correction crée une nouvelle version ; la précédente reste conservée.
3. L'aide IA peut structurer, corriger ou simplifier sans inventer un fait.
4. Les faits proposés sont visibles et révocables par l'agent humain.
5. Toute incertitude devient une question ouverte et bloque la relecture.
6. La confirmation `VERIFIER` fige la version courante en relecture humaine.
7. La publication, les destinataires et l'envoi restent indisponibles.

## Preuves

- 58 tests de régression du centre de communication réussis.
- Builds TypeScript/Vite réussis avec le module fermé puis activé.
- Audits npm application et workers : zéro vulnérabilité de production.
- Recette SQL fictive : onze contournements de création, séquence, version
  détachée, suppression, pointeur, mutation et cycle refusés.
- Après `ROLLBACK` : zéro résidu utilisateur, établissement, communication ou
  version de test.
- Les deux déclencheurs de cohérence sont différés et actifs ; les cinq
  fonctions de garde n'accordent aucun droit à `anon` ou `authenticated`.
- Auditeurs Supabase : aucun `WARN` ou `ERROR` lié aux communications. Les avis
  restants sont des `INFO` attendues sur RLS sans politique cliente et index de
  tables de preview encore vides. Référence :
  https://supabase.com/docs/guides/database/database-linter

## Limites volontaires

T010 reste ouvert : aucune approbation finale, publication, audience ou
diffusion n'est activée. T011 reste ouvert jusqu'au raccordement de l'interface
documentaire et à une preuve ClamAV fictive de bout en bout sur un moteur
explicitement autorisé.

## Gestion privée

La liste administrative se recherche uniquement sur titre, résumé, catégorie
et état, puis se filtre localement. Le détail charge la version courante et au
maximum cent lignes d'historique sans empreinte ni ancien corps de message.
Cette ergonomie n'ouvre aucun droit supplémentaire.
