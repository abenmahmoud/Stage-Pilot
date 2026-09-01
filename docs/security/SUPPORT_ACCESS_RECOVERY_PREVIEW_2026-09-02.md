# Recuperation du suivi - preuve locale et livraison de preview

Date : 2 septembre 2026, heure de Paris. Lot T049C7, specification 002.
Base : c549a11, branche codex/lycee-connect-prototype.

## Comportement

- Le demandeur indique le numero de dossier et son email deja fourni.
- Meme reponse 202 pour un contact connu, absent, desactive, ambigu ou d'un
  autre etablissement. Ni coordonnee, ni existence de dossier, ni jeton retournes.
- Aucun acces, verification scolaire ou nouveau dossier par cette operation.
  Seul l'echange ulterieur du lien/code peut ouvrir le suivi I2 du dossier lie.
- L'echec d'un ancien lien n'est plus silencieux : suivi et formulaire de
  recuperation ouvert, si active. L'interface ne pretend jamais que le 202
  prouve une livraison. Le code/email de recuperation ne sont pas stockes
  par ce composant dans la memoire locale.

## Protection et durabilite

- Corps limite a 2 ko ; champs exacts, controles de format et normalisation.
- Compteurs partages avant recherche : 3 essais par paire en 15 minutes,
  12 par email/jour, 1 000 par lycee/heure ; garde reseau existant conserve.
  Cles hachees, espaces de nommage distincts, aucune migration.
- Contact exact support/email actif, joint au dossier et a l'etablissement,
  sous verrou. Un jeton deja cree depuis moins d'une minute evite le doublon.
- Jeton hache en table privee, payload de file privee contenant le jeton opaque,
  et evenement en une transaction. Echec de file ou d'evenement : rollback.
- L'appel anonyme ne revoque pas les liens precedents. Une reprise humaine
  exige MFA/perimetre existant et le contact d'origine actif ; elle fait tourner
  le lien dans la transaction de relance. Aucun repli sur une autre adresse.
- Nouveau job `send_requester_access_link` sans message d'origine necessaire.
  Email minimal commun aux deux workers, sans nom, texte de demande ou piece.
  Idempotence fournisseur par job, reprise et isolation des echecs existantes.
- Les erreurs des transactions portant un jeton ne remontent pas avec leurs
  parametres SQL. Les audits plus larges des journaux restent distincts.

## Preuves executees

1. `node --experimental-strip-types scripts/test-support-contact-access.mjs` :
   92 tests reussis, dont les 52 du lot precedent. Les vrais modules tournent
   avec ORM transactionnel, Auth et email simules. Test du vrai limiteur avec
   empreintes et compteurs observes, exchanges lien/code apres recuperation,
   refus/rejeu, relance sans message, mauvais contact et rollback des pannes.
   Un premier echec de comparaison venait des prototypes d'objets de la VM ;
   les deux instantanes sont maintenant normalises avant comparaison profonde.
2. `npm run test:support-email-job-policy` : 6 tests, dont contrat du nouveau job.
3. `npm run test:support-email-safety` : 3 tests des adresses reservees.
4. `npm run test:preview-security-gate` : reussie apres les corrections finales.
5. `npm run build` : TypeScript et Vite reussis. Avertissement XLSX historique
   de taille de paquet, pas une erreur de compilation.
6. `npm run test:prototype-responsive-contract` : 4 contrats reussis.
7. Vraie page dans le navigateur integre via
   `node scripts/serve-support-recovery-fixture.mjs 5188` :
   module Auth remplace, API fictive locale et connexions limitees a l'origine.
   Aucun fichier .env charge, aucun fournisseur ou base distante utilise.
   Confirmation neutre 202, controls desactives pendant attente, reponse
   malformee et quota 429 sans faux succes, erreur 503, ancien lien 410
   affichant le formulaire. Jeton retire de l'URL. Aucun element du contenu
   hors largeur observe a 320, 390 et 1 440 px ; captures inspectees. Champs
   et commande empiles a 320 px, hauteur 40 px, textes d'erreur visibles.

## Activation et limites

- `SUPPORT_ACCESS_RECOVERY_ENABLED=false` cote serveur et
  `VITE_SUPPORT_ACCESS_RECOVERY_ENABLED=false` cote navigateur par defaut.
  Aucune variable distante changee. La publication du code n'active pas l'envoi.
- Avant activation : verifier cible preview, schema/file existants, worker
  compatible, source email autorisee, suppression des adresses fictives,
  contre-revue et recette concurrente/transport isolee. Ne pas ouvrir la
  production ou utiliser une adresse reelle au titre de cette livraison.
- La source VPS est adaptee mais n'est pas deployee. Aucun Hostinger, DNS,
  Webmail, PRONOTE, ENT ou compte utilisateur modifie.
- Aucun test PostgreSQL concurrent, delivrabilite reelle, Auth/MFA reel ou
  charge distribuee execute dans ce lot. Uniformite du corps/statut testee,
  pas une egalisation temporelle ni une preuve contre tout canal auxiliaire.
- Les trente minutes commencent a la creation du jeton. Une file bloquee
  longtemps peut produire un lien expire ; la relance manuelle genere un
  nouveau jeton. La strategie de renouvellement a la livraison reste a revoir.
- Une session deja emise n'est pas revoquee par la desactivation d'un contact
  dans ce lot. Liaison identite scolaire/dossier et documents personnels ouverts.
- Claude reste en pause a la demande du proprietaire. Aucun appel ni audit
  externe realise ou annonce ; reconfirmer sa mission a la reprise.

T049C7 couvre le code et la verification locale. T049C et l'ouverture du pilote
restent ouvertes. Ce rapport ne certifie pas la securite globale du portail.
