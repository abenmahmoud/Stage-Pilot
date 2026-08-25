# Recherche - Agent d'établissement adaptatif V2

## Résultat principal

PRONOTE couvre déjà une grande partie des opérations scolaires. La V2 ne doit pas le copier ni contourner ses droits d'accès. Elle doit devenir la porte d'entrée conversationnelle du lycée : comprendre une demande, répondre à partir de sources validées, guider vers le bon service, créer un dossier de suivi et préparer une action pour l'agent humain.

L'IA assiste les personnels. Elle ne remplace ni leur responsabilité, ni les décisions officielles, ni les systèmes nationaux et académiques.

## Fonctions PRONOTE utiles à rendre visibles

| Service ou fonction | Valeur pour l'usager | Source de vérité | Comportement V2 | Niveau | Validation humaine |
|---|---|---|---|---|---|
| Certificat de scolarité et attestations | Télécharger un document sans appeler le secrétariat | PRONOTE / établissement | Expliquer le chemin, ouvrir le bon écran, puis permettre une récupération autorisée si un connecteur officiel existe | L1 | Non pour la consultation autorisée |
| Casier numérique | Recevoir certificat, attestation, courrier ou plusieurs pièces jointes | PRONOTE | Signaler qu'un document est disponible et ouvrir le casier | L1 | Non |
| Dépôt de justificatifs | Transmettre assurance, domicile, absence ou autre document | PRONOTE / support lycée | Collecter le strict nécessaire, contrôler format et lisibilité, puis transmettre | L2 | Selon la procédure |
| Signature électronique | Signer bulletin, convention ou document conditionnel | PRONOTE | Préparer et expliquer ; ne jamais signer à la place de l'usager | L3 | Oui |
| Absences et retards | Consulter, justifier et joindre une preuve | PRONOTE vie scolaire | Expliquer, recueillir la demande et suivre son traitement | L2 | Oui pour accepter ou refuser |
| Emploi du temps et remplacements | Voir les changements de dernière minute | PRONOTE | Afficher en lecture seule après authentification officielle | L1 | Non |
| Notes, compétences, bulletins et bilans | Consulter les résultats et documents publiés | PRONOTE | Afficher ou orienter sans interprétation décisionnelle | L1 | Non |
| Orientation | Saisir des voeux et répondre aux propositions | PRONOTE / Scolarité Services | Expliquer les étapes, dates et pièces ; ouvrir le service officiel | L1 | Oui pour toute décision |
| Inscription et réinscription | Mettre à jour les données, options et pièces | Scolarité Services / établissement | Produire une liste personnalisée des pièces et suivre les éléments manquants | L2 | Oui pour valider le dossier |
| Bourses et aides | Comprendre l'éligibilité et suivre la démarche | Scolarité Services / ministère | Guider vers le service officiel et créer un rappel ou une demande d'aide | L1 | Oui pour la décision |
| Discussions, informations et sondages | Communiquer avec les bons destinataires | PRONOTE | Préparer un message et sa liste ; publication après contrôle | L3 | Oui |
| Rendez-vous et convocations | Demander ou organiser un échange | PRONOTE / agenda lycée | Proposer un créneau, créer une demande et notifier | L2-L3 | Oui pour une convocation officielle |
| Listes de diffusion | Joindre une classe, un groupe ou un service | PRONOTE / Webmail Lycée | Préparer le ciblage sans révéler les adresses personnelles | L3 | Oui avant envoi collectif |
| Stages | Entreprises, conventions, signatures et suivi | LycéeGest / PRONOTE | Ouvrir LycéeGest et transmettre le contexte utile, sans dupliquer le module | L1-L2 | Selon l'action |
| Maintenance informatique | Signaler ENT, compte, messagerie, poste ou équipement | Guichet numérique | Diagnostiquer les cas simples, créer et classer une demande | L2 | Non, sauf accès sensible |
| Travaux et matériel | Signaler un local ou réserver une ressource | PRONOTE / intendance | Créer une demande et l'assigner selon les règles du lycée | L2 | Selon le type |
| Vie scolaire et discipline | Suivre incidents, punitions, sanctions et convocations | PRONOTE | Orienter et transmettre seulement ; aucune décision autonome | L4 | Toujours |
| Santé, harcèlement et décrochage | Accéder rapidement au bon professionnel | Services compétents | Détecter l'urgence, limiter les données, alerter un humain | L4 | Toujours et immédiatement |
| Administration des droits | Gérer profils et habilitations détaillés | PRONOTE / annuaire | Créer une demande d'accès ; ne jamais attribuer de droit seul | L4 | Toujours |
| Exports réglementaires | SIECLE, STS Web, LSU/LSL, Parcoursup, Cyclades | Applications officielles | Contrôler une liste de préparation, sans modifier ni soumettre seul | L3-L4 | Toujours |

## Niveaux d'automatisation

- **L0 - Information publique** : réponse automatique depuis une source validée, avec lien et date de mise à jour.
- **L1 - Lecture personnelle** : consultation après authentification et contrôle d'autorisation.
- **L2 - Démarche préparée** : création ou mise à jour d'une demande, avec confirmation et journal d'audit.
- **L3 - Action officielle** : brouillon ou préparation automatique, exécution uniquement après validation humaine.
- **L4 - Action autonome interdite** : décision, divulgation ou modification sensible réservée aux professionnels habilités.

## Services administratifs à intégrer

### Priorité de rentrée

- Inscription, réinscription, changement de coordonnées et pièces manquantes.
- Certificat de scolarité, attestations et documents du casier numérique.
- Compte ENT, mot de passe, adresse académique et équipement numérique.
- Absence, retard, justificatif et demande de rendez-vous.
- Bourse, restauration, internat et orientation vers le bon service.
- Emploi du temps, changement de salle, remplacement et information urgente.
- Demande libre avec photos ou documents et suivi par courriel ou téléphone.

### À connecter plus tard

- Lecture PRONOTE autorisée via connecteur ou export officiel.
- SSO et ouverture contextuelle des services officiels.
- Signature électronique, agenda, SMS et relances planifiées.
- Paquets de compétences activables pour plusieurs établissements.

### Hors périmètre autonome

- Retrouver ou afficher un mot de passe existant.
- Décider d'une sanction, d'une note, d'une orientation, d'une affectation ou d'une bourse.
- Traiter seul une situation médicale, de harcèlement, de violence ou de décrochage.
- Révéler les données d'un autre élève, parent ou personnel.
- Envoyer un message collectif officiel sans validation.

## Intégration PRONOTE

Le pilote utilise des procédures validées et, si nécessaire, des imports CSV limités. La production utilise uniquement les connecteurs, exports ou liens officiels autorisés par la direction. Aucun scraping, aucune API non officielle et aucun partage massif de listes d'élèves avec le modèle d'IA.

Le connecteur officiel PRONOTE permet notamment de choisir les catégories exposées, d'automatiser des exports structurés et de limiter la granularité. La disponibilité exacte dépend de la licence et du dispositif régional ; elle doit être vérifiée avec la direction et l'hébergeur PRONOTE.

## Principes de protection

- Collecter seulement les informations nécessaires à la demande.
- Ne transmettre au modèle que le contexte minimal et autorisé.
- Prévenir l'usager de ne pas écrire de données médicales ou très sensibles dans le champ libre.
- Conserver les fichiers dans un stockage privé avec liens temporaires et journal des accès.
- Séparer information publique, données personnelles et données sensibles.
- Exiger une authentification renforcée pour les agents et toute consultation personnelle.
- Fixer une durée de conservation par catégorie et purger les données expirées.
- Étudier une AIPD avec le DPO avant un traitement à grande échelle de données d'élèves.

## Sources officielles

- [Documentation PRONOTE](https://www.index-education.com/fr/documentation-pronote.php?2=&fm=1)
- [Liste complète des fonctionnalités PRONOTE](https://www.index-education.com/contenu/telechargement/pn/v2024.0/pdf/PRONOTE2024_Plaquette-Fonctionnalites.pdf)
- [Nouveautés PRONOTE 2026](https://docs.index-education.com/docs_fr/fr-pronote-support-fiche-1856-7228-nouveautes-et-evolutions-de-pronote-2026.php)
- [Documents dans l'Espace Parents](https://docs.index-education.com/docs_fr/fr-pronote-support-fiche-1336-4566-mettre-un-document-a-disposition-sur-l-espace-parents.php)
- [Aide officielle Parents](https://docs.index-education.com/docs_fr/fr-support-pronote-parents-pointnet.php)
- [Aide officielle Personnels](https://docs.index-education.com/docs_fr/fr-support-pronote-personnel-pointnet.php)
- [Services d'export PRONOTE](https://maj.index-education.com/fr/pronote-info1420-services-export-de-donnees.php)
- [Scolarité Services](https://www.education.gouv.fr/scolarite-services-un-acces-unique-pour-toutes-les-demarches-scolaires-326158)
- [Inscription au lycée](https://www.education.gouv.fr/l-inscription-au-lycee-11597)
- [Bourses de collège et de lycée](https://www.education.gouv.fr/les-bourses-de-college-et-de-lycee-326728)
- [Cadre d'usage de l'IA en éducation](https://www.education.gouv.fr/cadre-d-usage-de-l-ia-en-education-450647)
- [CNIL - système d'IA dans l'éducation](https://www.cnil.fr/fr/education-mise-en-place-systeme-ia)
- [CNIL - conseils pour les chatbots](https://www.cnil.fr/fr/chatbots-les-conseils-de-la-cnil-pour-respecter-les-droits-des-personnes)
