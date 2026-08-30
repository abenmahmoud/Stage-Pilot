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

## Interface préparée

- L'écran privé accepte uniquement PDF ou DOCX de 10 Mo maximum.
- Le transfert utilise une coordonnée signée aléatoire qui ne contient aucun
  identifiant de personne ou d'établissement. Les listes ne renvoient jamais le
  chemin persistant, l'empreinte ou le texte extrait.
- Les états de réservation, quarantaine, analyse, revue, refus et échec restent
  visibles sans exposer le contenu du document.
- `COMMUNICATION_DOCUMENT_UPLOAD_ENABLED` et
  `VITE_COMMUNICATION_DOCUMENTS_ENABLED` doivent valoir exactement `true`.
  Ils restent absents des environnements distants et échouent donc fermés.

## Preuves

- Neuf tests d'entrée, interrupteurs, chemins, API, schéma, file et worker
  réussissent.
- Six tests réels d'extraction, de refus de format et de corruption réussissent.
- La régression agrégée du centre compte 65 tests réussis.
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

Le consommateur est codé mais non déployé. L'interface est raccordée mais son
interrupteur dédié reste fermé. Le lot global T011 reste ouvert tant qu'une
recette antivirus fictive de bout en bout n'a pas été validée sur un moteur
explicitement autorisé.

## Matrice de formats vérifiée

- PDF fictif sain : extraction locale PDF.js réussie.
- DOCX fictif sain : extraction locale Mammoth réussie.
- JPEG, PNG et texte brut : refus avant extraction.
- Faux PDF corrompu et type/extension incohérents : refus.
- PDF avec adresse email et code scolaire : revue humaine obligatoire, texte
  extrait supprimé.

Cette matrice ferme T030 mais ne prouve pas l'antivirus distant : T011D reste
ouvert jusqu'à une recette ClamAV fictive de bout en bout explicitement
autorisée.
