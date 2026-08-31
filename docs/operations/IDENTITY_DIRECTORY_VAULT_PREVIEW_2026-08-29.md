# Coffre chiffré du répertoire - recette preview du 29 août 2026

## Périmètre

- Application : branche `codex/lycee-connect-prototype`.
- Base : Supabase preview `xijocumlwivhbmffrnlj` uniquement.
- Worker : répertoire isolé `/opt/lycee-support-preview` sur le VPS existant.
- Migration : `20260829010855_create_identity_directory_vault`.
- Données : personnes, contacts et relations entièrement fictifs.
- Aucun changement de production, DNS, Hostinger, Webmail, PRONOTE ou ENT.

## Garanties implémentées

- Le parseur normalise les champs en mémoire puis les retire du rapport. Les
  lignes de contrôle conservent seulement des références opaques et des
  empreintes HMAC des coordonnées.
- Le worker chiffre prénom, nom, email académique, email personnel et téléphone
  en AES-256-GCM. Chaque fiche reçoit un nonce aléatoire.
- Les données authentifiées associent le chiffrement à la version de schéma, la
  version de clé, l'établissement, l'import et la référence personne. Une fiche
  déplacée ou altérée ne peut donc pas être déchiffrée silencieusement.
- La clé `v1` de 32 octets est générée et conservée dans le fichier
  d'environnement du worker, lisible par `root` et le groupe
  `lycee-support`. Sa valeur n'a jamais été affichée et n'est pas stockée dans
  Git, Supabase ou Vercel.
- La table `identity_directory_private_rows` ne possède aucune colonne de nom,
  email ou téléphone en clair. RLS est activée et forcée ; `anon` et
  `authenticated` n'ont aucun privilège, tandis que le rôle serveur possède les
  droits nécessaires.
- Une version ne peut être approuvée ou activée si le nombre de fiches chiffrées
  ne correspond pas exactement au nombre de personnes validées. Le retrait
  efface les fiches chiffrées avec les lignes de contrôle.
- Le modèle d'IA, le navigateur et le registre de connaissances n'ont aucun
  accès au coffre.

## Installation et retour arrière

- La migration a d'abord été exécutée dans une transaction volontairement
  annulée ; aucun état n'est resté après le test.
- Une sauvegarde ciblée du worker, du parseur et de l'environnement a été créée
  dans
  `/root/lycee-support-backups/identity-vault-20260829T011057Z`.
- Les empreintes SHA-256 des trois modules installés correspondent aux fichiers
  du dépôt. Le worker a exécuté un passage vide avec le code `0`.
- Les timers annuaire, documents, email et pièces jointes sont restés actifs
  après la recette.

## Preuves

- Tests unitaires : configuration de clé, nonce unique, absence de texte brut,
  aller-retour, mauvais contexte, altération, mauvaise clé et configuration
  invalide.
- Recette worker : trois personnes et une relation fictives en état `review`,
  trois fiches chiffrées, aucune valeur brute dans les tables, déchiffrement
  contrôlé correct.
- Antivirus : EICAR rejeté et fichier supprimé.
- Cycle : deux approbations, une seule version active, remplacement, refus d'une
  source inactive et retrait de l'ancienne avec suppression du fichier, des
  lignes de contrôle et des fiches chiffrées.
- Nettoyage : zéro import, ligne publique, fiche chiffrée, audit, travail de
  file ou établissement de recette restant.
- Contrôle Supabase : table vide hors recette, RLS activée et forcée, aucun droit
  client. L'information « RLS sans policy » est volontaire pour cette table
  exclusivement serveur.

## Limites avant données réelles

- Construire un outil de recherche déterministe, borné au bon établissement et
  au bon rôle, exigeant MFA et justification, avec résultat minimal et audit.
- La rotation locale, la vérification avant retrait et la restauration d'un
  paquet chiffré entièrement fictif sont prouvées. Il reste à exécuter une
  restauration isolée sur une cible distante autorisée, à fixer la conservation
  des anciennes clés et à valider leur révocation réelle.
- Fixer finalités, colonnes, habilitations, rétention, sauvegarde et procédure
  d'incident avec la Direction et le DPO.
- Ajouter un refus automatique plus large des mots de passe, codes ENT/PRONOTE
  et secrets. Ils restent interdits dans tous les fichiers.
- Rejouer l'interface avec deux comptes agents nominatifs et MFA avant tout
  pilote réel.
- Le worker tourne encore sous Node `20.20.2`. Planifier sa migration vers un
  runtime pris en charge avant un pilote réel, sans la mélanger à ce lot de
  chiffrement.
- Le VPS ne disposait plus que d'environ 20 Go libres lors du contrôle final ;
  prévoir supervision et seuil d'alerte avant les imports volumineux.
