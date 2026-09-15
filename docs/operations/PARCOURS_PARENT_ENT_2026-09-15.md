# Parent, enfant absent et accès ENT — 15 septembre 2026

## Demande d’Adel

Un parent doit recevoir une aide utile même lorsque les informations de son
enfant ne sont pas disponibles : lien de connexion, identifiant exact connu du
lycée, code d’activation personnel si disponible après OTP, démarche de
réinitialisation. Ne pas inventer un compte ou confondre parent et enfant.

## Comportement livré

- Informations scolaires de l’enfant indisponibles ou rattachement non confirmé :
  aide administrative maintenue, avec accès direct « Retrouver mon accès ENT ».
  La demande d’accès personnel quitte le parcours enfant ; son nom ne prouve
  jamais un lien familial et ne permet pas de lire un autre compte.
- Consignes générales de connexion/réinitialisation avec lien officiel disponibles
  avant OTP, y compris quand une donnée manque. La question générale « Comment
  réinitialiser… » reste utilisable sans OTP ; retrouver l’identifiant personnel
  se demande ensuite par un bouton.
- Carte privée après identité vérifiée : identifiant exact, chiffres inclus,
  bouton de copie, compte parent clairement identifié, activation en trois étapes
  ou procédure de réinitialisation pour un compte activé.
- Compte absent : aucun identifiant deviné ; lien et procédure restent accessibles,
  avec demande au référent. Le nouvel export SIECLE n’est pas encore reçu.
- Échec de remise du code nécessitant le référent : identifiant conservé tant
  que la preuve reste valable, pas de nouvelle invitation à afficher le code.
  Une réponse 401 efface les informations personnelles ; quitter la page ou
  l’expiration les masque également.
- Le parent utilise son compte personnel. La sélection d’un enfant ne change
  jamais le compte lu dans le coffre. Aucun changement de coordonnées, aucun
  code généré ni réinitialisation exécutée dans l’ENT par ce lot.

## Source publique vérifiée

Page officielle consultée le 15 septembre :
https://www.iledefrance.fr/toutes-les-faq/faq-problemes-de-connexion

Page de connexion réelle ouverte : https://auth.monlycee.net/
Elle propose « Identifiant », « Mot de passe », « Se connecter » et
« Mot de passe oublié ? ». Le formulaire de récupération demande l’identifiant
puis « Valider » pour recevoir un lien. Aucun lien « Identifiant oublié »
observé sur cette version ; ne pas en inventer. Les adresses internes de
réinitialisation comportent une session temporaire : seul le point d’entrée
public stable est enregistré. Aucune donnée saisie ni réinitialisation envoyée.

## Vérification et limites

32 tests ciblés réussis : demandes ENT, réinitialisation et identifiant oublié,
changement vers PRONOTE/messagerie, parent non vérifié, enfant non disponible,
liens familiaux et révocations, consentement avant demande, absence d’appel IA.

Carte réelle testée sur données fictives : compte inactif avec affichage explicite
du code, copie de l’identifiant, compte actif, absence de compte, échec de code
avec identifiant conservé, expiration avec effacement, recours au référent.
Rendu contrôlé à 1440 et 390 pixels. Aucune identité réelle usurpée, aucun OTP,
email, SMS ou demande réelle de test envoyé. Revue React : requêtes annulées au
démontage, sortie de page protégée, état privé sans persistance, vrais boutons et
liens clavier, procédures repliables sur téléphone. Aucun nouveau prestataire.

Build TypeScript/Vite réussi ; publication et contrôles distants à confirmer.
La disponibilité de l’identifiant et du code dépend toujours des exports validés
et de la preuve d’identité. L’absence d’un enfant ne garantit pas que le compte
parent figure lui-même dans l’export. L’activation réelle de l’ENT peut avoir
évolué depuis l’export ; la carte propose alors la connexion/récupération normale.

Retour arrière : déploiement OTP corrigé `dpl_m9pAy7Vg5TkaNiDLSK7KWvymvcT3`
(`b8ba465`). Ce lot ne modifie aucune donnée ni configuration du fournisseur.
