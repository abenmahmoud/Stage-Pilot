# Incident OTP email — 15 septembre 2026

## Constat et cause reproduite

Adel signale un refus d’envoi lors de la vérification d’un professeur avec son
adresse académique. Trois challenges ont échoué entre 10:10 et 10:32 UTC,
dont deux personnels. L’annuaire avait reconnu les personnes ; les réponses
de `/api/identity/device/select` étaient HTTP 503. Aucun événement Brevo de
ces OTP, tandis que des messages ordinaires du guichet étaient livrés.

Contrôles en lecture seule : abonnement email rechargé, SMTP actif,
expéditeur configuré et actif. Ce n’est pas une preuve de rejet par ac-creteil.fr.

Cause reproduite dans le sandbox officiel Brevo, sans message distribué :
`identity-device-` suivi d’un UUID donne 52 caractères ; Brevo refuse HTTP 400,
code `out_of_range`, message `Idempotency key exceeds char limit`.
L’UUID seul (36 caractères) est accepté HTTP 201.

Source de la recette sans envoi :
https://developers.brevo.com/docs/using-sandbox-mode
Le champ `headers.X-Sib-Sandbox` vaut obligatoirement `drop` lors de cette
recette. Cela valide la requête, jamais la réception physique dans une boîte.

## Correctif

- L’UUID du challenge est utilisé directement comme clé d’idempotence.
- Les deux parcours d’OTP utilisent le même expéditeur partagé ; aucun second
  code généré, aucune modification des verrous anti-double envoi ou des quotas.
- Un incident technique dans l’ancien parcours ne propose plus à tort de
  corriger les coordonnées.
- Un refus Brevo produit un journal limité au canal, au statut HTTP et à un
  code d’erreur autorisé. Aucun nom, contact, OTP, secret ni message libre du
  fournisseur dans ce diagnostic.

## Vérifications

Test de régression exécuté avant correction : échec email `out_of_range`, SMS
réussi. Après correction : email accepté, référence stable au rejeu, distincte
par challenge ; doublon Brevo traité sans erreur ; SMS inchangé ; refus
fournisseur conservé et journal sans donnée personnelle. Tests des bornes de
réponse Brevo et de la politique d’identité réussis. Le véritable modèle HTML/
texte du lycée a aussi été accepté HTTP 201 en sandbox.

Build TypeScript/Vite réussi après un premier manque de mémoire local ; relance
bornée à 1 Go pour Node, sans arrêter les autres applications.

## Publication confirmée

Commit `b8ba46562092097b824bc9a2dfbcfb20ad189041`, déploiement
`dpl_m9pAy7Vg5TkaNiDLSK7KWvymvcT3` READY, domaine principal rattaché.
Contrôle le 15 septembre à 10:56 UTC : URL immuable
`lyceegest-j2m6l9dxi-safe-scol.vercel.app` et domaine principal servent le
bundle `index-C6HLpoBK.js`. Accueil HTTP 200 avec CSP ; sur les deux adresses,
sélection sans preuve refusée 401, injection de contact refusée 400, statut
sans preuve refusé 401, réponses sans cache. Aucun envoi induit par ces contrôles.
Chat chargé dans le navigateur, affichage mobile 390 px contrôlé, brouillon de
l’appareil conservé. La réception réelle d’un OTP reste à confirmer avec Adel.

## Exploitation et suite

Après publication, une tentative déjà échouée doit être recommencée via le
bouton du chat. Aucune relance en masse des anciens OTP expirés. La réception
sur l’adresse académique sera confirmée par un nouvel essai d’Adel.

Adel prépare un export SIECLE complet pour compléter les téléphones. Fichier
pas encore reçu à ce stade. Préserver les références stables et les liens
familiaux ; ne pas écraser un contact renseigné par une valeur vide, ni
attribuer un numéro sur une simple ressemblance de nom. Les conflits doivent
rester visibles pour décision humaine. Aucun annuaire ou numéro modifié par
le présent correctif.

Retour arrière possible vers le déploiement `dpl_eZ5AmodQouvMJHgDn3ffzQmdEhCL`
(`0a03d07`), en sachant qu’il réintroduit le défaut OTP email. Aucun changement
de base, de secret, d’expéditeur ou de configuration DNS pour ce correctif.
