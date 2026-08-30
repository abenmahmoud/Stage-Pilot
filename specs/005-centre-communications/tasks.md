# Tâches - Centre de communication du lycée

## Phase 1 - Validation du fonctionnement

- [ ] T001 Valider les trois visibilités : public, interne et ciblé.
- [ ] T002 Confirmer les rôles autorisés à préparer, valider et envoyer.
- [ ] T003 Inventorier les groupes du Webmail sans importer les contacts dans Git.
- [ ] T004 Valider le texte d'information sur l'usage des emails personnels.

## Phase 2 - Données et règles

- [x] T005 Ajouter les tables, contraintes, index, droits et audit. Les huit
  tables privées sont appliquées sur la preview, sous RLS forcée et sans droit
  client. Une recette fictive transactionnelle a vérifié cloisonnement,
  immutabilité et audit avant nettoyage à zéro.
- [x] T006 Ajouter la file durable et les clés d'idempotence. Travaux et
  livraisons portent une clé unique par établissement, un état, une reprise et
  des limites d'essais. La base refuse toute exécution sans version validée et
  tout envoi ou publication dont l'interrupteur est coupé.
- [x] T007 Construire les validateurs de source, visibilité, audience et dates.
  Le contrat refuse les champs inconnus, les adresses dans l'audience, les
  groupes absents pour une cible, la publication web non publique et les dates
  incohérentes. Les groupes restent des références opaques à valider.
- [x] T008 Ajouter les interrupteurs globaux de publication et d'envoi. Les trois
  interrupteurs serveur sont désactivés par défaut et publication/envoi restent
  impossibles lorsque le module est coupé. Aucune variable Vercel n'est activée.

## Phase 3 - Préparation et publication

- [ ] T009 Ajouter l'entrée `Communications` dans l'espace administratif.
- [x] T009A Ajouter la route et l'entrée de navigation responsive derrière
  `VITE_COMMUNICATIONS_ENABLED=false`. Un accès direct affiche l'état fermé ;
  le menu reste absent tant que le pilote n'est pas autorisé.
- [ ] T010 Construire le parcours `Déposer`, `Vérifier`, `Publier et informer`.
- [x] T010A Ajouter l'API serveur du premier dépôt manuel, derrière les deux
  interrupteurs de module. Elle accepte seulement une saisie directe bornée,
  refuse secrets et champs inconnus, calcule les empreintes côté serveur et
  crée racine, version et audit dans une transaction idempotente cloisonnée.
- [x] T010B Construire l'étape `Déposer` pour le texte direct : liste privée,
  formulaire borné, état de doublon et rendu 320 px. `Vérifier`, publier,
  audience et envoi restent visibles comme étapes verrouillées.
- [x] T010C Ajouter la modification versionnée et la demande de relecture
  humaine. Chaque correction crée une version privée, les questions ouvertes
  bloquent la relecture et la base refuse les états incohérents ou les mutations
  du contenu en revue. Publication, audience et envoi restent verrouillés.
- [ ] T011 Extraire localement le texte des PDF et DOCX autorisés.
- [x] T011A Ajouter l'extracteur local borné PDF/DOCX. Il réutilise le moteur
  PDF.js/Mammoth et les précontrôles d'archives existants, ne contacte aucune IA
  et bascule en relecture manuelle pour coordonnées, secrets ou instructions.
  Le dépôt privé, l'antivirus et la file dédiée restent à relier avant T011.
- [x] T011B Ajouter le dépôt privé et la quarantaine en preview. L'API réserve
  une URL signée PDF/DOCX de 10 Mo maximum, vérifie exactement taille et type,
  cloisonne par établissement et place un travail idempotent dans une file PGMQ
  privée. La liste ne retourne ni chemin de stockage ni texte extrait.
- [x] T011C Préparer le consommateur local de la file. Il exige ClamAV, extrait
  localement, bloque menaces et doublons, conserve zéro texte en présence de
  coordonnées ou secrets et termine toujours en revue humaine. Il n'est pas
  déployé et n'est relié à aucun environnement réel.
- [ ] T011D Relier le dépôt à l'interface fermée puis exécuter une recette de
  bout en bout avec fichiers fictifs sur un moteur ClamAV autorisé. T011 ne sera
  fermé qu'après cette preuve ; aucune activation distante n'est implicite.
- [x] T012 Étendre l'aide IA avec sortie structurée et informations à confirmer.
  L'aide propose uniquement structure, correction ou simplification, avec faits
  bornés et questions ouvertes. Elle fonctionne sans persistance fournisseur,
  refuse secrets et consignes d'injection, et ne peut ni valider ni publier.
- [x] T013 Ajouter les modèles Hebdo, Urgent, Rentrée, Document, Événement et
  Rappel. Le catalogue sûr fonctionne sans donnée persistée ; seuls superadmin
  et proviseur peuvent enregistrer une personnalisation versionnée et auditée,
  sans publication, audience ou envoi. Le choix préremplit le brouillon dans
  l'interface fermée et conserve la référence du modèle.
- [ ] T014 Publier la version validée dans le flux daté du site.
- [ ] T015 Ajouter recherche, filtres, épinglage, expiration et archives publics.

## Phase 4 - Diffusion sécurisée

- [ ] T016 Définir le contrat serveur limité avec le registre du Webmail.
- [ ] T017 Préparer les destinataires par référence de contact, côté serveur.
- [ ] T018 Envoyer individuellement via Brevo avec lien canonique.
- [ ] T019 Enregistrer livré, différé, rejeté, spam et désinscrit.
- [ ] T020 Construire la boîte d'échec, la reprise et l'annulation des travaux.
- [ ] T021 Ajouter un aperçu email fidèle avant validation.

## Phase 5 - Entrants et réponses

- [ ] T022 Construire le webhook entrant authentifié et idempotent.
- [ ] T023 Rattacher chaque réponse à la bonne communication.
- [ ] T024 Classer retrait, correction de contact, question et réponse libre.
- [ ] T025 Créer un brouillon depuis un email transféré autorisé.
- [ ] T026 Configurer le domaine et le filtre Gmail uniquement après autorisation.

## Phase 6 - Validation

- [ ] T027 Tester qu'aucune adresse d'un autre destinataire n'est exposée.
- [ ] T028 Tester rôles, MFA, contenus internes et API publique.
- [ ] T029 Tester doublons, panne Brevo, reprise et 200 destinataires.
- [ ] T030 Vérifier PDF, image, DOCX, fichier invalide et données personnelles.
- [ ] T031 Vérifier 320 px, ordinateur, clavier et lecteur d'écran.
- [ ] T032 Déployer en preview et tester avec des contacts fictifs.
- [ ] T033 Faire valider le pilote avant toute liste réelle ou envoi collectif.
