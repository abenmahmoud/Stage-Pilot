# Modèles de communication - preuve preview du 30 août 2026

## Périmètre

- Projet Supabase : branche preview `xijocumlwivhbmffrnlj` uniquement.
- Migration : `20260830070000_create_communication_templates.sql`.
- Aucune donnée réelle, aucun réglage de module et aucun envoi.

## Vérifications

La recette `supabase/tests/communication_templates_security.test.sql` a utilisé
un utilisateur et deux établissements fictifs dans une transaction. Elle a
prouvé le refus du doublon, du changement d'établissement, du croisement
d'audit, du saut de version et de la modification d'un événement. Le modèle a
accepté une mise à jour avec incrément exact. Le `ROLLBACK` a laissé quatre
compteurs de résidus à zéro.

Les auditeurs Supabase ne remontent aucun niveau `WARN` ou `ERROR` sur
`communication_templates` et `communication_template_events`. Les seuls
résultats sont `INFO` : tables serveur sans politique cliente et index encore
inutilisés parce que le module reste vide et désactivé. Référence :
https://supabase.com/docs/guides/database/database-linter

## État de fermeture

Les tables sont sous RLS forcée, sans droit `anon` ou `authenticated`. L'API
exige encore l'authentification agent, le périmètre établissement, le rôle
direction pour modifier et les deux interrupteurs de module. Publication et
envoi restent indépendamment coupés.
