# Date, réponses et préparation du formulaire — 4 septembre 2026

Adel signale une mauvaise connaissance du jour et de l'année, des horaires
inconnus et un dialogue trop long avant le formulaire. Il demande ensuite de
fixer toutes les informations pratiques dans une revue commune.

## Changements

- Horloge recalculée côté serveur, affichage en Europe/Paris ; les questions
  explicites de date courante reçoivent une réponse déterministe sans appel IA.
- Contexte temporel ajouté à chaque appel au modèle. Les messages des visiteurs
  et les anciennes réponses ne sont jamais présentés comme des sources officielles.
- Sans source sélectionnée, réponse explicite sur l'absence d'horaires validés.
  Aucun horaire réel ajouté ; le jour courant ne suffit pas à déclarer le lycée ouvert.
- Perte de code ENT, badge ou demande de certificat : formulaire proposé dès
  que le besoin est clair. Un incident vague peut recevoir une précision utile.
  La date et les horaires seuls n'ouvrent pas automatiquement un dossier.
- Choix explicite du formulaire reconnu, règles de danger et de confidentialité
  prioritaires. Les impératifs de demande d'annuaire et les apostrophes françaises
  dans les demandes concernant un tiers restent pris en compte.
- Coordonnées recueillies dans le formulaire ; aucune création de dossier ni
  notification avant l'envoi volontaire et sa confirmation serveur.
- Repli navigateur aligné, ancienne date fixe retirée de la réponse d'emploi
  du temps. En panne d'API, le navigateur n'affirme pas connaître l'horloge serveur.

## Vérification

Build final et contrôles de sécurité du portail validés. Le passage complet a
été repris par étapes après des interruptions de processus sur le poste Windows ;
les suites restantes ont toutes réussi. Les nouveaux tests sont ajoutés au script
du moteur et à la barrière de sécurité.

Les 13 scénarios existants du moteur et 11 nouveaux tests passent, ainsi que les
26 tests de politique et de transition. Les nouvelles vérifications couvrent
minuit à Paris en été, le changement d'année en hiver, une fausse année proposée
dans le dialogue, des horaires inventés par un visiteur et les limites de sécurité.

Huit scénarios Chromium à 320 et 1440 px passent avec le vrai moteur local et un
transport HTTP simulé : date, horaires absents, code ENT perdu et une précision
sur incident. Aucun débordement, aucune exception JavaScript, aucune mutation
de dossier ; dix réponses, aucun appel au fournisseur. Les preuves locales sont
dans `.vercel/site-finalisation/agent-context-local-proof.json`.

## Informations à valider ensemble

La [fiche commune](FICHE_REFERENCE_LYCEE_A_VALIDER.md) regroupe identité et accès,
horaires par service, contacts, démarches, documents, dates de validité et
responsables. Elle reste un brouillon jusqu'à la revue avec Adel et les services.
Les pages existantes devront être alignées sur la version approuvée ; cette
fiche ne publie rien et ne constitue pas une synchronisation automatique.

Les données nominatives préparées avec Claude et le circuit de remise des codes
restent distincts. Aucun document, annuaire, code ni horaire réel importé dans ce lot.

## Livraison

La version précédente du domaine principal est `6492faf`, déploiement
`dpl_ZSUccTdNARMtmUzuTpZFExFUnGid`. La publication du présent lot doit être suivie
d'un contrôle du commit servi et de réponses via l'API du domaine principal.
Le retour arrière consiste à réaffecter ce déploiement précédent ; aucune
migration de données ni modification des workers n'est nécessaire pour ce lot.
