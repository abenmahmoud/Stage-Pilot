# SMS du lycée et reprise après vérification — 9 septembre 2026

## Problème constaté

Adel confirme un essai réel avec une responsable : code reçu par SMS, mention
PFMP à remplacer, puis nouvelle demande d'informations dans le parcours.
La base confirme une vérification `directory_phone_otp` réussie. Le journal
Vercel montre ensuite un `DELETE /api/identity/device/session` environ quatorze
secondes après la validation, suivi d'une nouvelle lecture de session. Il ne
s'agit pas d'une expiration automatique. L'origine exacte du clic n'est pas
déduite des journaux.

Le code de l'interface révèle deux défauts indépendants : les nom, prénom,
profil et contact saisis avant l'OTP n'alimentent pas la préparation de demande ;
un remontage du panneau d'identité relance l'assistant même après vérification.

## Correction

- Expéditeur des SMS scolaires : `SCHOOL_SMS_SENDER`, valeur par défaut
  `LycCendrars`. L'ancienne variable `IDENTITY_DEVICE_SMS_SENDER` ne nomme plus
  les SMS du lycée. Les expéditeurs personnalisés restent validés (3 à 11
  caractères alphanumériques).
- Message OTP court mentionnant le Lycée Blaise Cendrars, le code, dix minutes
  de validité et sa confidentialité. Le message fixe tient dans un segment
  Unicode de 70 caractères.
- Après succès de l'OTP, réutilisation locale des informations saisies. Pour
  un parent : enfant concerné, puis relecture. Le contact téléphone reste le
  canal choisi ; aucun email supplémentaire obligatoire.
- La personne garde l'option de modifier ses coordonnées de réponse. Cette
  édition ne modifie jamais l'annuaire et ne confère aucun droit serveur.
- Retour de la relecture vers le chat sans nouvelle analyse ni nouvel OTP
  lorsque l'identité est déjà reconnue dans cette conversation.
- `Changer de personne` explique désormais les effets, avec `Garder mon accès`
  et confirmation explicite de fermeture. Les demandes envoyées sont conservées.

Les durées de session, les contrôles serveur et les règles de remise de données
personnelles ne sont pas modifiés. Le traitement humain d'une demande n'est pas
automatiquement marqué comme identité confirmée par un simple état du navigateur.

## Vérification avant publication

- Build TypeScript et Vite : réussi. Un premier processus Node Windows avait
  échoué pendant sa fermeture après génération ; la relance avec sortie vers
  un fichier se termine normalement, code zéro.
- `test-school-sms-delivery.mjs` : fournisseur simulé, ancien expéditeur PFMP
  ignoré, expéditeur dédié et format vérifiés, aucune livraison réelle.
- Tests existants identité, contrat de réponse de l'assistant (10 tests) et
  réponses Brevo bornées (4 tests) : réussis.
- Playwright local, Browser plugin non disponible :
  `http://127.0.0.1:5189/?view=help`, 1440, 390 et 320 pixels. Nom/prénom/contact,
  OTP fictif, enfant, relecture préremplie, modification possible, retour sans
  relance, annulation de changement puis déconnexion explicite. Une demande de
  code, une vérification, aucune suppression avant confirmation sur chaque vue.
- Page identifiée, contenu non vide, aucun écran d'erreur, aucune erreur console
  ou JavaScript, pas de débordement horizontal, bouton d'envoi accessible à
  l'interaction et captures relues. Aucun dossier ni SMS réels créés par ces tests.
- Recette et captures locales : `../tmp/qa-identity-reuse.mjs` et
  `../tmp/qa-identity-reuse/`.

La CLI Vercel locale rencontre une chaîne de certificats non reconnue. La
vérification TLS n'est pas désactivée. Git HTTPS et le connecteur Vercel restent
utilisables pour publier le code validé et contrôler son déploiement.

## Retour arrière et recette réelle

Le déploiement précédent est `dpl_8GdviVKQGEigxoKPKwqQ2fG9yRZz`, source
`f56b2d8`. Revenir au déploiement précédent restaure le parcours et l'ancien
expéditeur sans mutation de données. Le libellé réellement affiché par
l'opérateur téléphonique sera confirmé au prochain essai choisi par Adel.

## Publication vérifiée

Le commit `895078a8c83d6c113cf3aff5c52612a3bd96ff1c` est publié dans le
déploiement `dpl_52G8sAPkDdnfy5Do6Q615rVov2xv`, état `READY`. Le connecteur
Vercel confirme que `lycee-blaise-cendrars-sevran.fr` pointe vers ce déploiement.
Contrôle HTTP après publication : page d'aide et module JavaScript du chat en
200 ; présence effective de la modification des coordonnées et des deux choix
de confirmation de changement de personne dans le module servi.

Le déploiement Git a actualisé l'alias du domaine principal automatiquement.
La tentative de lecture de l'API Vercel depuis PowerShell a renvoyé 403 ; aucune
mutation distante n'a été tentée par ce canal. Publication et contrôles ont
abouti via Git et le connecteur déjà autorisés.
