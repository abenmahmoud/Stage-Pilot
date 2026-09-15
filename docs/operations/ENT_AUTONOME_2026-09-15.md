# Accès ENT personnel — 15 septembre 2026

## Résultat et autorisation

Adel a déposé le nouvel export ENT dans Téléchargements et demandé son activation
urgente pour les parents. L’annuaire et les accès doivent permettre une réponse
directe du chat après OTP, sans formulaire imposé lorsque la réponse est disponible.
Les codes restent strictement personnels : le responsable dispose de son compte
ENT propre, même s’il est lié à plusieurs enfants.

## Import effectivement réalisé

- Source : export ENT du 15 septembre, empreinte SHA-256
  `7eb62d5ea00e6cf56b60fe025470c961f34f3dc9fa54e8379db87c1f7e13eff9`.
- 3 353 lignes, 11 doublons strictement identiques, 3 342 personnes ENT distinctes.
- Rapprochement par références stables ; identifiants exacts avec suffixes conservés.
- 2 024 liens familiaux réciproques du nouvel export, dont 625 nouveaux.
- Annuaire fusionné : 4 518 personnes et 2 413 relations, 6 931 lignes valides,
  zéro rejet. Les personnes absentes du nouvel export sont conservées.
- Version active `a3a7aec0-3158-4a2b-a837-539888e02b39`, activée à 09:11:06 UTC.
  Ancienne version conservée : `2bbe790f-f706-4832-8010-c55fe56b3bfc`.
- Attributs actifs `f468369c-a4de-4b02-aaf0-387a5a212781` : 10 026 valeurs chiffrées,
  identifiant ENT, état d’activation et identifiant source, liées au nouvel annuaire.
- 1 273 codes d’activation de comptes inactifs enregistrés dans le coffre chiffré.
  Transport chiffré LGC1/RSA-OAEP/AES-GCM, aucun code initial de compte actif importé.
- Validation antivirus effectuée. L’approbation et les deux activations ont été
  réalisées dans la session superadministrateur existante, puis vérifiées en base.

Les sources, scripts de préparation et rapports agrégés sont dans le Dépôt privé,
sous `04-Exports-ENT-bruts/traitement-2026-09-15`. Aucune liste nominative dans Git.
Les coordonnées partagées, élèves sans classe et personnes sans contact restent
des avertissements de qualité : aucune identité ambiguë n’est résolue par supposition.

## Parcours publié par ce lot

1. La personne demande son accès ENT dans le chat.
2. Le parcours d’identité existant vérifie un contact connu par OTP.
3. « Mon accès ENT » lit les attributs actifs de cette personne seulement.
4. Compte inactif : clic pour afficher le code ; compte actif : identifiant exact
   et consigne « Mot de passe oublié » sur monlycée.net.
5. Si les informations manquent ou la récupération échoue, une demande au référent
   réutilise les coordonnées confirmées, sans répéter le même conseil en boucle.

`GET/POST /api/identity/device/ent` interdit les cibles fournies par le navigateur.
La remise exige une session OTP serveur récente (30 minutes), l’annuaire encore
actif, le même identifiant, une attribution ENT de l’année et les contrôles du
coffre existant. Verrous de publication et transaction empêchent une remise en
concurrence avec une activation. Quota : trois affichages par jour et code.
Le code reste dans un composant privé, hors transcript, brouillon et appel IA ;
affichage sans cache, masqué à l’expiration, au changement d’identité et hors page.

Les anciennes routes `/api/vault/ent-inactif`, `/koxo`, `/cantine` conservent une
lecture désactivée : leur phase fournie par le client n’est pas une preuve OTP.
Le drapeau existant `CODE_VAULT_REVEAL_ENABLED` est activé exclusivement dans
l’environnement preview de `codex/lycee-connect-prototype`, utilisé par le site.
Aucune clé cryptographique ni autre environnement n’est modifié.

## Vérifications

- Build TypeScript/Vite réussi.
- 52 tests ciblés réussis : identité, liens familiaux, intention ENT, matrice du
  coffre et point unique de lecture.
- PostgreSQL jetable/PGlite, données fictives : sept contrôles réussis du lecteur
  chiffré, incluant autre personne, établissement, ancienne source, expiration,
  source non validée et substitution du texte chiffré.
- Navigateur : carte réelle sur données fictives en ordinateur et 390 px,
  affichage explicite du code fictif et bouton de recours testés.
- Aucun OTP réel, email, SMS ou dossier de test envoyé/créé.

## Limites et retour arrière

La réception d’un OTP puis d’un code par un vrai parent reste à constater avec
Adel ; ces tests n’usurpent aucune identité réelle. L’import actif remplace
l’ancienne source : une ancienne session peut demander une nouvelle vérification.
L’état ENT reflète l’export manuel, sans synchronisation d’activation en temps réel.
Les coordonnées ne sont pas modifiées automatiquement ; une correction demande
l’intervention du référent. La correspondance EDT n’est pas étendue par ce lot.

Avant publication, l’alias principal pointait sur `dpl_BQvTXAp3r7NMwrotw33F6ZuBtM69`
(code `954e4ef`). Un retour de l’alias est possible ; le nouvel annuaire reste
actif. Les sources précédentes sont conservées, sans suppression. Un retour de
données doit emprunter une procédure d’import/activation tracée, jamais une
modification silencieuse des liens. Pour suspendre la remise, fermer le drapeau
et redéployer la branche concernée.

## Publication confirmée

Code `0a03d074b40ee73f628e72b2356a8c28344856c0`, déploiement
`dpl_eZ5AmodQouvMJHgDn3ffzQmdEhCL` READY le 15 septembre à 09:32:04 UTC.
Le domaine principal est rattaché automatiquement à ce déploiement. L’adresse
immuable et le domaine principal servent le même bundle `index-c2klZnhZ.js`.
Sur les deux adresses : GET/POST anonyme refusé 401, tentative de cible ou de
phase cliente refusée 400, réponses sans cache ; demande ENT publique répondue
avec vérification d’identité, sans formulaire forcé ni appel au modèle. Accueil
200 et CSP présents, interface publique rechargée dans le navigateur. La
conversation déjà présente sur l’appareil a été conservée.

Brevo vérifié en lecture seule après recharge : compte SMTP actif, 29 995 crédits
email et 442 crédits SMS déclarés par le fournisseur. Ceci confirme la capacité
d’envoi, sans prétendre qu’un OTP de recette a été reçu sur un appareil réel.
