# Preuve locale du traitement antivirus des documents de communication

Date : 2 septembre 2026

## Périmètre

Cette recette valide le traitement complet de documents PDF et DOCX fictifs
sans joindre la preview distante, la production, le VPS, le Webmail, l'ENT ou
PRONOTE. Aucun secret ni donnée personnelle réelle n'est utilisé.

La pile éphémère comprend les 93 migrations, PostgreSQL, PGMQ, un bucket
Storage privé et l'image officielle ClamAV épinglée. Le scanner reçoit les
octets par l'entrée standard et ne crée aucun fichier de contenu sur disque.

## Scénarios prouvés

1. Un PDF fictif sain est extrait et placé en relecture humaine.
2. Un DOCX fictif contenant EICAR est rejeté et supprimé du stockage.
3. Une indisponibilité du scanner conserve le travail, puis la reprise aboutit.
4. Une panne de suppression est reprise sans événement de rejet en double.
5. Une altération après relecture échoue fermée au cinquième essai, efface le
   texte extrait et archive la tâche.
6. Le nettoyage final retrouve zéro fixture, tâche, objet Storage, fichier
   temporaire et conteneur.

Résultat exact de la recette :

```json
{"migrations":93,"database":"local-postgresql","storage":"local-private","antivirus":"ClamAV 1.5.4","extractedPdf":1,"blockedDocx":1,"scannerRecovery":1,"cleanupRecovery":1,"tamperFailClosed":1,"archivedFailureProof":1,"cleanupResidues":0,"temporaryResidues":0}
```

## Commandes de vérification

```powershell
npm run test:local-real-communication-document-worker-safety
npm run recipe:local-real-communication-document-worker
npm run test:communications
npm run test:preview-security-gate
npm run build
```

Toutes ces commandes passent. La compilation conserve uniquement
l'avertissement de taille XLSX déjà connu.

## Traçabilité

- Commit applicatif : `bd1cfae82090076886ed82d5668ad96a0fb7b7df`
- Déploiement Vercel de preview : `dpl_8XZeSuFvQxgRSmsGsierSPexkxSG`
- État vérifié : `READY`
- Cible Vercel : `target=null`
- Branche : `codex/lycee-connect-prototype`

Cette preuve ne déploie, n'installe ni ne planifie aucun worker distant. Les
deux drapeaux d'activation restent fermés. Un pilote distant exige une
autorisation, une supervision et une recette dédiées.
