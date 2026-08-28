# Revue securite passwordless du 28 aout 2026

## Mission autorisee

- Modele : Claude Sonnet, une seule execution.
- Perimetre : archive isolee de 16 fichiers, lecture seule.
- Sortie : 120 lignes maximum.
- Aucun secret, contact, annuaire, emploi du temps ou document reel transmis.
- Aucun acces a Vercel, Supabase, Hostinger, DNS, VPS, Webmail, PRONOTE ou ENT.
- Objectif : second avis sur identite progressive, liens de suivi, sessions,
  cloisonnement des services et acces aux emplois du temps.

Claude a produit un rapport. Codex a ensuite relu le code et les specifications
avant de retenir ou rejeter chaque alerte. Le rapport externe n'a jamais ete
traite comme une preuve suffisante a lui seul.

## Arbitrage Codex

| Signal Claude | Decision Codex | Suite |
| --- | --- | --- |
| Reutilisation d'une session existante apres lien magique, classee P0 | Confirme comme ecart de rotation et de specification, mais severite P0 exageree : le cookie est aleatoire, HttpOnly, Secure en production et emis par le serveur. | Rotation systematique, copie des acces deja autorises vers la nouvelle session, revocation de l'ancienne session et nouveau cookie. |
| Jeton de suivi valable 30 jours au lieu de 30 minutes | Confirme. Une seconde occurrence hors du perimetre Claude a aussi ete trouvee lors de la creation initiale. | Constante unique de 30 minutes appliquee a tous les liens magiques ; la session d'appareil reste a 30 jours. |
| Deux consommations concurrentes possibles du meme jeton | Confirme. Le compteur fixe n'etait pas le coeur du risque ; l'absence de consommation atomique l'etait. | Mise a jour conditionnelle `used_at is null`, increment atomique et refus de la transaction perdante avant tout octroi de session. |
| Un contact desactive pouvait encore etre choisi pour une reponse | Confirme. | Les contacts desactives sont exclus avant la creation du message, du jeton et du travail d'envoi. |
| Un auditeur de service pouvait demander un journal global sans service | Confirme par le contrat de perimetre et un test manquant. | Le journal global est reserve a un administrateur MFA ; l'auditeur reste borne a ses services. |
| Role futur `pp` sans permission | Pas une vulnerabilite. Decision metier encore ouverte. | Aucun droit ajoute implicitement ; conserver le refus par defaut jusqu'a specification du professeur principal. |
| Coordonnees completes visibles par les agents habilites | Risque de minimisation, mais pas fuite inter-service prouvee : le traitement et le rappel exigent actuellement ces coordonnees. | Maintenir T020 : masquage contextuel et journal des consultations avant donnees reelles. |
| Repli sur `x-forwarded-for` hors Vercel | Risque dependant de l'hebergement, non exploitable sur la preview Vercel controlee dans ce perimetre. | Revoir avant tout deploiement sur un autre proxy. |

## Durcissement ajoute par Codex

Le passage d'une demande de `contact_verifie` a `identite_confirmee` exige
maintenant explicitement une session agent `aal2`, en plus du rapprochement avec
un eleve ou professeur present dans une source officielle. Cette action reste
impossible en preview tant que le compte agent n'a pas active sa double
verification, ce qui est volontaire.

## Verification

- Tests securite des liens et sessions : 5/5.
- Tests de politique d'identite et journaux : 12/12.
- Compilation TypeScript et build Vite : reussis.
- Aucun envoi, aucune donnee reelle et aucune modification de production.

## Limites restantes

- Un vrai test d'integration avec deux requetes simultanees doit etre execute sur
  une base de recette isolee avant production.
- L'obligation MFA generale exige deux comptes nominatifs enroles et une recette
  de recuperation ; elle ne doit pas etre activee avec un seul responsable.
- Le futur import des 4 200 identites requiert stockage prive, habilitations,
  journal d'acces, conservation validee et decision DPO/AIPD.
- OTP, passkeys et SSO officiel restent des contrats futurs ; aucun annuaire reel
  ne doit etre importe avant leur specification et leur recette de securite.
