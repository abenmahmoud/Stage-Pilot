# Emails du lycée — 9 septembre 2026

Adel demande de vérifier et personnaliser les emails, de corriger les textes et
de limiter les doublons et le risque de classement en spam.

## Constat vérifié

- Un accusé de réception du 8 septembre, lu en métadonnées dans Gmail, est en
  boîte de réception (catégorie mises à jour). SPF, DKIM et DMARC passent.
- L'expéditeur utilise le sous-domaine technique `11197689.brevosend.com` ; le
  Reply-To est une boîte Gmail. Le nom affiché et l'objet manquent d'accents.
- La consultation DNS du domaine du site ne trouve pas de DMARC. Cela ne signifie
  pas que les emails actuels échouent : ils sont authentifiés sur le domaine
  Brevo, comme le montrent les en-têtes du message contrôlé.
- Consultation SQL en lecture seule : 33 réservations de livraison sur sept jours,
  toutes à l'état `sent` ; 25 traitements réussis sur 48 heures, aucune erreur
  dans cette fenêtre et zéro travail en attente. Ces états attestent la remise
  au prestataire, pas la réception de chaque destinataire.

## Correction

Les cinq modèles (identité OTP, confirmation, réponse, reprise et notification
agent) partagent maintenant `shared/school-email-templates.mjs` dans l'API et
le worker VPS. Français corrigé, nom du destinataire, identité visuelle du lycée,
référence visible, un bouton principal, texte brut équivalent, présentation mobile.
Les réponses rédigées par les agents restent inchangées et échappées en HTML.
Les documents restent accessibles dans le suivi sécurisé.

L'OTP d'identité est distinct du code de suivi : 10 minutes pour le premier,
30 minutes et usage unique pour l'accès au dossier. Les textes précisent où saisir
le code et que la demande reste enregistrée après expiration. La reprise contient
le nom du destinataire lié au contact, sans le contenu de la demande ni pièce.
Les sujets et aperçus n'incluent pas de code secret ni de description personnelle.

Le nom d'expéditeur historique « Lycee Blaise Cendrars » est normalisé avec accent.
L'adresse d'envoi existante est conservée. Le Reply-To configuré est aussi utilisé
pour l'OTP. Les URL sont construites avec les paramètres existants et le domaine
principal devient le secours explicite. La notification agent ouvre la vue agent,
au lieu d'annoncer une sélection de dossier que le client ne gère pas.

Aucun pixel, image distante, publicité ou script n'est ajouté aux modèles.
Le réglage éventuel du suivi par Brevo lui-même n'a pas été changé ni vérifié.
Les protections de réservation durable, d'idempotence et de liaison au contact
restent actives. Aucun nouvel email réel n'a été envoyé pour les tests.

## Validation

- 112 tests ciblés réussis : modèles, transport simulé, contact exact, reprise,
  bornage Brevo, adresses de test et politique de file d'envoi.
- Test d'identité passé ; `npm run build` réussi.
- Cinq aperçus fictifs vérifiés dans Chromium à 1 024, 390 et 320 pixels :
  15 vues sans débordement, liens accessibles, aucun appel réseau.
- Aperçus : `../output/emails-lycee-2026-09-09/index.html`.
- Génération reproductible : `node scripts/preview-school-emails.mjs`.

## Livraison et limites

La livraison Web est suivie séparément du worker VPS : un push ne met pas à jour
ce dernier. La connexion SSH `essuf-vps` expire sur le port 22 le 9 septembre.
Ne pas annoncer les confirmations/réponses du VPS comme mises à jour avant
installation et contrôle de son bundle. Le programme existant continue à traiter
la file, selon les succès observés dans la base.

Créer le bundle depuis le commit testé avec `npm run build:support-email-worker`.
Manifeste et SHA-256 : `.vercel/support-email-worker-release`. Procédure de
sauvegarde, installation, contrôle et reprise du timer dans
`SUPPORT_EMAIL_REPAIR_2026-09-04.md`. Ne pas rejouer les emails déjà envoyés.

Le passage à une adresse expéditrice sur le domaine du lycée nécessite le choix
de la boîte et les enregistrements exacts fournis par Brevo (authentification
DKIM/DMARC et vérification du domaine). Aucun DNS ni expéditeur n'a été changé.
Ne pas inventer de sélecteur DKIM, de clé ou de SPF. Le message réel contrôlé
prouve une bonne authentification actuelle ; il ne garantit pas « zéro spam ».

Références :
- https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC
- https://help.brevo.com/hc/en-us/articles/35852083084178-Domain-setup-for-better-email-deliverability
- https://support.google.com/mail/answer/81126?hl=en

Retour arrière Web : commit `895078a`, déploiement
`dpl_52G8sAPkDdnfy5Do6Q615rVov2xv`. Aucun changement de schéma ou de données.
