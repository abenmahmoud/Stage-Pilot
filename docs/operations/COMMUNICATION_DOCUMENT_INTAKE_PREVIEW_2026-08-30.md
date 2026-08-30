# Documents de communication - preuve preview du 30 août 2026

## Périmètre

- Projet Supabase : branche preview `xijocumlwivhbmffrnlj` uniquement.
- Migration : `20260830073000_create_communication_document_intake.sql`.
- Formats : PDF et DOCX, 10 Mo maximum.
- Aucun fichier réel, aucun envoi, aucune publication et aucun déploiement VPS.

## Circuit préparé

1. Un agent autorisé réserve un chemin privé et reçoit un jeton de dépôt signé.
2. L'API confirme que l'objet reçu a exactement la taille et le type annoncés.
3. La base passe le document en quarantaine et crée un travail PGMQ privé.
4. Le consommateur préparé exige ClamAV avant toute extraction locale.
5. Un fichier sûr passe en `review`, jamais directement en communication.
6. Coordonnées, secrets, consignes visant l'agent, menace ou doublon bloquent
   l'utilisation automatique et ne laissent aucun texte exploitable.

## Preuves

- Sept tests d'entrée, API, schéma, file et worker réussissent.
- Cinq tests réels d'extraction sur PDF/DOCX fictifs réussissent.
- Build TypeScript/Vite réussi.
- Audits npm application et workers : zéro vulnérabilité de production.
- Recette SQL transactionnelle : création dans un faux état, acteur falsifié,
  croisement d'établissement, doublon, transition arrière, texte hors revue,
  liaison sans communication et modification d'audit tous refusés.
- Après `ROLLBACK` : zéro utilisateur, établissement, document ou événement de
  test restant ; file vide.

Les deux tables sont sous RLS forcée, sans droit `anon` ou `authenticated`. Le
bucket est privé et la file n'est lisible par aucun rôle client. Les auditeurs
Supabase ne signalent aucun `WARN` ou `ERROR` ciblé. Les seuls avis sont de
niveau `INFO` : absence volontaire de politique cliente et index encore non
utilisés sur des tables vides. Référence :
https://supabase.com/docs/guides/database/database-linter

## Limite volontaire

Le consommateur est codé mais non déployé. Le lot global T011 reste ouvert tant
que l'interface fermée et une recette antivirus fictive de bout en bout n'ont
pas été validées sur un moteur explicitement autorisé.
