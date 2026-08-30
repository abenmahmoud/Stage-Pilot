# Tâches ordonnées et vérifiables

## Règle de livraison

La V1 doit être utile sans IA. Chaque étape se termine par un commit, un build,
des tests et une vérification visuelle mobile/ordinateur. Aucun changement de
production n'est appliqué directement sans preview et sauvegarde.

État au 25 août 2026 : le socle API, les sessions, le suivi public, la file agent,
les messages et les pièces jointes sont branchés à une base Supabase de preview
isolée. Les workers VPS Brevo et ClamAV tournent chaque minute. Une demande, une
réponse, un email réel et un fichier sain déplacé vers le stockage privé ont été
validés de bout en bout. Les cases encore ouvertes comprennent soit une partie
restante, soit une configuration externe ou une validation par la direction.

## Jour 1 - Socle qui ne perd rien

- [x] **T001A** Corriger `get_role`, `set_updated_at`, les appels RLS par ligne et
  les index redondants sur la branche Supabase de preview.
- [x] **T001B** Activer la protection des mots de passe compromis dans Supabase
  Auth et la confirmer avec un nouveau rapport des conseillers de sécurité.
- [x] **T002** Supprimer le détail brut des erreurs 500 renvoyé par l'API.
- [x] **T003** Ajouter la migration des tables support, index et contraintes, et
  restaurer dans Git les trois migrations historiques LyceeGest présentes dans
  le journal Supabase.
- [x] **T003A** Garantir une version unique pour chaque migration et contrôler
  automatiquement les références des scripts. La collision `20260830090000`
  entre communications et revue du routage a été corrigée sans appliquer de
  migration distante ; la seconde version est désormais `20260830090500`.
- [x] **T004** Créer les buckets privés `support-quarantine` et `support-clean`.
- [x] **T005** Écrire et tester les politiques RLS par rôle.
- [x] **T006** Créer `POST /api/support/requests` avec validation stricte,
  transaction et idempotence.
- [x] **T006A** Valider dans le navigateur la réponse complète de création et sa
  preuve liée avant affichage ou écriture dans la mémoire de l'appareil.
- [x] **T007** Créer l'échange jeton magique vers session HttpOnly, limiter les
  tentatives par réseau et faire vérifier uniquement l'adresse destinataire.
- [x] **T007A** Valider le numéro public renvoyé par l'échange du lien magique
  avant d'ouvrir le suivi, puis retirer le jeton de l'URL en succès comme en échec.
- [x] **T008** Créer `GET /api/support/requests/:code` limité à la session.
- [x] **T009** Créer le dépôt direct signé vers la quarantaine et sérialiser la
  réservation pour empêcher de dépasser cinq fichiers par concurrence.
- [x] **T010** Ajouter le journal append-only et les identifiants de corrélation.
- [ ] **T011** Ajouter tests unitaires, RLS et intégration de création concurrente.
- [x] **T012** Vérifier 200 créations, zéro perte et zéro doublon.
  Le script est désormais isolé par exécution, utilise une file temporaire,
  exige une cible preview explicite et nettoie ses données même après un échec.
- [ ] **T012A** Rejouer les 200 créations après l'ajout obligatoire de
  `institution_id`. Le script est remis à niveau et ses verrous locaux passent,
  mais le fichier d'environnement disponible ne contient pas une URL Postgres
  de preview utilisable ; aucun contrôle de cible n'a été contourné.

### Sortie Jour 1

Un formulaire API peut créer, relire et suivre un vrai dossier avec fichiers en
quarantaine. Une panne d'envoi externe n'affecte pas le dossier.

## Jour 2 - Conversation et travail agent

- [x] **T013** Relier la conversation libre du prototype aux vraies API.
- [x] **T013A** Conserver le dialogue utile demandeur-assistant message par
  message lors de la création du dossier, avec ordre stable, auteur explicite et
  mention visible des réponses automatiques.
- [x] **T014** Ajouter la distinction demandeur/bénéficiaire et le contexte de
  chaque fichier.
- [x] **T015** Ajouter IndexedDB pour brouillons et liste des dossiers du terminal.
  Le brouillon expire apres 30 jours, conserve la cle d'idempotence et les
  champs necessaires a la reprise, mais aucun fichier, jeton, cookie ou mot de
  passe. La liste locale ne contient que le numero public et des metadonnees
  minimales ; la session serveur reste obligatoire pour lire le dossier.
- [x] **T016** Construire la page de suivi sécurisée et le fil de messages.
- [x] **T016A** Actualiser automatiquement le fil et permettre l'ajout de pièces
  jointes après la création du dossier.
- [x] **T016B** Afficher les trois niveaux de vérification, exiger le lien avec
  une liste officielle pour confirmer une identité et bloquer la résolution des
  demandes ENT ou email académique sans cette confirmation.
- [x] **T016C** Valider strictement la liste publique avant affichage, mémoire
  locale ou notification, puis ignorer les actualisations réseau obsolètes.
- [x] **T016D** Valider le dossier public, ses messages et pièces avant rendu,
  isoler ses erreurs et empêcher une ancienne sélection de remplacer la courante.
- [x] **T016E** Refuser toute réservation de pièce dont le bucket, le chemin,
  l'identifiant ou le jeton signé ne respecte pas le contrat de quarantaine.
- [x] **T016F** Valider les confirmations serveur de fichier, message et fermeture
  de session avant tout succès visible ou effacement de mémoire locale.
- [x] **T017** Construire la file agent paginée avec filtres, SLA et assignation.
- [x] **T017A** Protéger les modifications et réponses par révision, rendre la
  prise en charge atomique et actualiser l'écran après un conflit.
- [x] **T018** Ajouter réponses, notes internes, transfert et clôture motivée.
  Les notes internes restent hors du fil public, le transfert conserve le dossier
  complet et une clôture exige un motif audité.
- [x] **T019** Ajouter les modèles de réponse et variables autorisées. Trois
  modèles prudents sont disponibles et les agents peuvent enregistrer un modèle
  limité aux variables `prenom`, `numero` et `objet`.
- [x] **T020** Installer `pgmq`, la Basic Queue transactionnelle, le worker et la
  file d'échec administrable.
- [x] **T021** Implémenter l'envoi Brevo avec idempotence et `Reply-To` dossier.
  La file lie explicitement le destinataire et le jeton au même contact.
- [x] **T022** Recevoir les événements Brevo livré/rejeté/différé/spam.
- [x] **T022A** Router les alertes internes vers le service affecté, avec repli
  vers le superadministrateur si l'adresse de ce service est absente.
- [ ] **T023** Configurer le domaine entrant Brevo et son webhook secret.
- [ ] **T024** Recevoir réponses et pièces jointes email dans le bon dossier.
- [x] **T025** Ajouter tâches de rappel téléphonique et résultat d'appel, avec
  création sur demande explicite, file dédiée, prise en charge atomique et audit.
- [ ] **T026** Tester les rejouements de webhooks et les pannes Brevo. La réception
  est maintenant atomique afin qu'une panne n'enregistre pas un reçu définitif
  avant le message et sa notification.
- [x] **T026A** Simuler localement succès, doublon et indisponibilité Brevo,
  contrôler l'ordre transactionnel du webhook, puis rejouer dix fois la même
  réception fictive sur la preview avec `ROLLBACK` et zéro résidu.
- [ ] **T026B** Après configuration du domaine entrant, couper puis rétablir Brevo
  dans un créneau de recette et vérifier la reprise réelle du webhook, des pièces
  et des notifications sans envoyer vers une adresse non autorisée.

### Sortie Jour 2

Un parent peut créer une demande, recevoir l'email, répondre depuis sa boîte et
voir sa réponse dans le dossier. L'agent traite tout depuis une seule file.

## Jour 3 - Automatisation, PWA et exploitation

- [x] **T027** Ajouter règles déterministes de classement, priorité et attribution.
  Le texte et la catégorie attribuent le service avant l'IA. La priorité reste
  normale par défaut ; seuls un risque explicite de protection passe en critique
  et un « incident grave » adressé à la direction passe en urgent. Le simple mot
  « urgent » ne suffit pas à élever la priorité.
- [x] **T028** Ajouter détection et validation manuelle des doublons.
  Même contact haché, même catégorie et création dans les sept jours produisent
  uniquement un signal agent. Un agent confirme ou écarte le signal ; aucun
  dossier n'est fusionné ou fermé automatiquement et le demandeur ne voit pas le
  numéro du dossier candidat.
- [ ] **T029** Ajouter relances automatiques et surveillance des SLA.
- [x] **T029A** Rendre les échéances explicitement enregistrées actionnables dans
  la file agent : filtre serveur cloisonné aux demandes ouvertes et échues,
  onglet `En retard` et absence de SLA automatique à la création. Aucun délai,
  destinataire, rappel ou niveau d'escalade n'est inventé ; T029 reste ouverte
  jusqu'à validation des règles propres à chaque service.
- [x] **T029B** Isoler dans la console les dossiers `attente_demandeur` avec un
  onglet et un compteur dédiés. Cette vue aide à séparer travail actif et attente
  usager sans envoyer de rappel ni calculer de nouveau délai ; T029 reste ouverte
  pour l'automatisation validée des relances.
- [x] **T030** Installer le worker antivirus VPS et le déplacement quarantine/clean.
- [ ] **T031** Mettre en place la sauvegarde chiffrée DB + Storage et un test de
  restauration.
- [x] **T031A** Éprouver localement le format d'un paquet fictif DB + Storage :
  chiffrement authentifié par artefact, manifeste authentifié, limites avant
  déchiffrement, contrôle établissement/paquet et restitution intégrale sans
  écriture. T031 reste ouverte jusqu'à la sauvegarde programmée et à une vraie
  restauration en environnement isolé.
- [x] **T032** Finaliser PWA : hors-ligne limité, mise à jour, icônes, installation.
- [x] **T032A** Forcer la vérification du service worker et charger les navigations
  en ligne sans cache afin qu'un nouveau déploiement ne reste pas masqué par
  l'ancienne interface PWA.
- [ ] **T033** Ajouter notifications PWA pour les sessions actives.
- [x] **T033A** Ajouter l'activation volontaire des alertes pendant une session
  de suivi ouverte : référence initiale sans notification historique, réponse
  ou changement d'état uniquement, rejet des retours obsolètes, contenu générique
  sans identité et ouverture du suivi sans numéro dans l'URL. T033 reste ouverte
  jusqu'à une recette réelle sur téléphone avec permission accordée.
- [x] **T034** Ajouter tableau de santé, file d'échec et bouton de reprise.
  La direction avec MFA voit les succès, alertes email, fichiers en attente et
  échecs définitifs. Une reprise est atomique et auditée ; les notifications
  destinées à l'usager reçoivent un nouveau lien temporaire.
- [ ] **T035** Ajouter le formulaire de collecte des emails personnels avec double
  vérification et validation agent.
- [x] **T036** Restaurer dans la navigation les formations et informations du lycée.
- [x] **T036A** Rendre le Webmail prioritaire et garder LyceeGest accessible depuis
  la navigation permanente et le catalogue des services.
- [x] **T036B** Remplacer les raccourcis Stages/Grand Oral de l'accueil par les
  besoins de rentrée : aide, inscription, classe, documents et codes d'accès.
- [x] **T036C** Faire du texte libre le parcours principal et conserver le
  formulaire classique comme option secondaire accessible aussi depuis
  l'accueil, sans dependance a l'IA.
- [x] **T036D** Mettre le nom Lycée Blaise Cendrars et le portrait avec cigarette
  au centre de l'identité visuelle de l'accueil.
- [x] **T036E** Présenter les huit spécialités générales avec photos, explications
  et compétences développées sur ordinateur et téléphone.
- [x] **T036F** Rendre le suivi appareil + email explicite, recommander l'email
  comme trace durable et conserver le téléphone comme secours.
- [x] **T036G** Recueillir la langue souhaitée et le besoin de rappel, adapter la
  réponse de l'assistant et rendre ces besoins visibles dans l'espace agent. La
  conversation assistée détecte aussi la langue, répond dans cette langue et
  conserve dans le dossier un résumé français pseudonymisé « automatique, à
  vérifier », sans remplacer l'original ni influencer les droits ou le routage.
- [x] **T036G2** Permettre à l'agent de préparer une réponse traduite avec
  rétrotraduction française, masquage avant IA, reçu signé de quinze minutes et
  validation humaine explicite. Une demande sensible non vérifiée limite la
  traduction au message sécurisé de confirmation d'identité.
- [ ] **T036H** Reprendre et faire valider toutes les rubriques de l'ancien site
  selon `content-migration.md` avant toute bascule du domaine principal.
- [x] **T036I** Ajouter les premières pages détaillées STMG, STL, MELEC, PCEPC et
  CAP, ainsi que les accès CDI, UNSS, mini-stages et informations pratiques.
- [x] **T036J** Valider la réponse de chaque page éditoriale dédiée avec le même
  contrat que les flux publics, puis exiger que l'article corresponde exactement
  à l'adresse demandée avant tout rendu ou chargement de média.
- [x] **T036K** Centraliser le rendu Markdown public, refuser les images qui ne
  viennent pas du bucket privé signé du lycée et neutraliser les liens non HTTPS
  ou non internes dans les pages et leur aperçu administrateur, sauf email et
  téléphone strictement validés.
- [x] **T036L** Vérifier chaque URL de média public selon les deux chemins de
  stockage réellement générés, exiger un unique jeton signé sans paramètre
  parasite et rejeter les traversées ou encodages de chemin inattendus.
- [ ] **T037** Ajouter les mentions d'information, durées et procédure d'exercice
  des droits.
- [x] **T037A** Ajouter la page de confiance de préproduction, le contact DPO, les
  interdictions de partage de mots de passe et les protections HTTP du portail.
- [x] **T037B** Ajouter l’écran de double vérification des comptes agents et
  l’exiger automatiquement après enrôlement dans l’interface, les API et les
  accès directs à la base de preview.
- [ ] **T037C** Enrôler deux comptes nominatifs au minimum, valider la récupération
  en cas de téléphone perdu et activer l’obligation générale MFA.
- [x] **T037D** Protéger les pages administratives par rôle côté interface,
  conserver la destination après connexion et ajouter la récupération du mot de
  passe par email avec écran de remplacement et tests de robustesse.
- [x] **T037E** Faire auditer en lecture seule le parcours passwordless sur une
  archive isolee, contre-verifier les constats, puis corriger la rotation de
  session, la consommation atomique et l'expiration des jetons sans toucher aux
  donnees reelles ni a la production.
- [x] **T037G** Borner la lecture des réponses JSON dans le navigateur, interrompre
  les flux dépassant le plafond même sans taille annoncée et intégrer ce contrôle
  à la barrière de sécurité permanente.
- [x] **T037H** Router les réponses JSON authentifiées de `apiFetch` vers le
  lecteur borné commun pour les succès comme pour les erreurs, sans casser les
  réponses sans contenu.
- [x] **T037I** Borner à 20 Mo les PDF authentifiés ouverts dans le navigateur,
  vérifier leur type et leur signature, isoler la nouvelle fenêtre et refuser
  les URL externes hors des origines HTTPS approuvées.
- [x] **T037J** Borner à 2 Mo les réponses JSON du fournisseur IA pour
  l'assistant, la traduction et les deux aides à la rédaction, puis annuler les
  flux qui dépassent ce plafond sans taille annoncée.
- [x] **T037K** Vérifier la taille déclarée et réelle des fichiers avant leur
  copie en mémoire dans les cinq workers, et lire les pièces jointes Brevo en
  flux interrompu à 10 Mo.
- [x] **T037L** Borner à 256 Ko les accusés JSON Brevo dans l'API et le worker
  email, tout en conservant le traitement idempotent des doublons HTTP 400.
- [x] **T037M** Vérifier la taille réelle d'une pièce jointe publique avant sa
  copie en mémoire et refuser tout écart avec la réservation de dépôt.
- [x] **T037N** Borner l'ancien import administratif à 10 Mo et 5 000 lignes,
  nettoyer ses champs côté serveur et limiter ses deux requêtes à 5 Mo.
- [x] **T037O** Fixer un plafond HTTP explicite avant validation sur l'assistant
  public et les deux aides IA de rédaction, sans modifier leurs limites métier.
- [x] **T037P** Borner les corps des mutations de la console agent et désactiver
  le parseur sur la reprise technique qui n'accepte aucun payload.
- [x] **T037Q** Borner les commandes du répertoire des identités, désactiver le
  parseur sur la confirmation sans payload et conserver le dépôt privé direct.
- [x] **T037R** Borner les mutations du centre de communications selon la taille
  métier et conserver le dépôt direct des documents dans le stockage privé.
- [x] **T037S** Borner les commandes d'emploi du temps, désactiver le parseur sur
  les actions sans payload et conserver le dépôt direct des PDF privés.
- [x] **T037T** Borner les mutations du registre de connaissances, désactiver le
  parseur de confirmation et conserver le dépôt direct des documents privés.
- [x] **T037U** Borner les mutations de gestion éditoriale, désactiver le parseur
  de confirmation et conserver le dépôt direct des médias privés.
- [x] **T037V** Borner les huit mutations historiques restantes et remplacer
  l'écriture de masse des paramètres établissement par une liste blanche validée.
- [x] **T037F** Exclure les contacts desactives des reponses, reserver les
  journaux globaux a un administrateur MFA et exiger `aal2` pour confirmer une
  identite scolaire depuis une source officielle.
- [ ] **T038** Exécuter tests mobile, desktop, clavier, charge et sécurité.
- [x] **T038A** Relire les textes du parcours demandeur et agent, remplacer les
  codes internes par des libellés français et vérifier les principaux écrans.
- [x] **T038B** Vérifier le nouveau parcours d'aide sur ordinateur et téléphone,
  sans débordement horizontal et avec les aides de compréhension visibles.
- [x] **T038C** Contre-verifier la revue externe bornee, corriger uniquement les
  constats reproduits et documenter les alertes rejetees avec leurs preuves.
- [ ] **T039** Déployer une preview Vercel protégée et la faire valider.
- [x] **T039A** Déployer la preview protégée et terminer sa validation technique
  mobile/ordinateur, API, base, email sortant et fichier sain.
- [ ] **T040** Basculer les DNS seulement après validation fonctionnelle.

### Sortie Jour 3

La V1 est installable, surveillée, sauvegardée et exploitable par la direction.
Le support continue à fonctionner si l'IA est coupée.

## Étape IA après décision sur la clé et validation DPO

- [x] **T041** Choisir OpenAI `gpt-5.6-luna` et confirmer la réutilisation de la
  clé existante pour l'aperçu protégé.
- [x] **T042** Ajouter le pseudonymiseur et ses tests de non-fuite. Les emails,
  téléphones, noms explicitement déclarés, adresses, dates de naissance,
  identifiants élève et secrets sont masqués avant l'appel IA. Le besoin utile
  reste disponible pour le classement et l'appel conserve `store: false`.
- [x] **T043** Définir le schéma de sortie classification/réponse/urgence/pièces.
- [x] **T044** Implémenter l'adaptateur IA serveur, `store: false`, avec repli local.
- [x] **T045** Ajouter une confiance `high/medium/low`, valider intégralement la
  sortie structurée côté serveur et revenir aux règles déterministes si la
  sortie est invalide ou de confiance faible. Une route locale de confiance
  faible ouvre le dossier dans la file `a_qualifier`.
- [x] **T046** Journaliser coût, durée, version et validation humaine. Les
  mesures append-only conservent modèle, latence, jetons et coût estimé seulement
  lorsque les tarifs sont configurés. Le reçu de routage lie le modèle au
  dossier, puis une décision humaine MFA confirme ou corrige ce classement ;
  aucune conversation, identité ou coordonnée n'entre dans les métriques.
- [x] **T047** Neutraliser et tester les injections de consignes dans les
  descriptions et métadonnées de fichiers : balises réservées supprimées,
  contenu des fichiers jamais transmis, nom complet omis, type MIME limité et
  contradiction avec une route déterministe certaine refusée.
- [x] **T048** Activer dans l'aperçu public protégé avec masquage préalable,
  limites de débit, aucune action sensible et validation humaine du dossier.
- [x] **T048A** Ajouter la politique déterministe centrale : urgence humaine,
  refus des données privées, trois échanges pédagogiques, trois essais hors
  mission et dix messages utilisateur maximum, avec tests automatisés.

## Après V1

- [ ] **T049** Activer SMS Brevo pour les notifications essentielles.
- [ ] **T050** Ajouter WhatsApp transactionnel seulement après cadrage juridique.
- [ ] **T051** Construire une base de connaissances validée par la direction.
- [x] **T052** Ajouter statistiques de résolution et motifs récurrents. L'écran
  direction affiche sur 30 jours les volumes, le taux, le stock ouvert, les
  délais moyen et p90 et cinq catégories fermées, sans identité ni texte libre.
- [ ] **T053** Migrer progressivement les pages éditoriales WordPress dans la PWA,
  sans interrompre le site actuel.
- [ ] **T054** Ajouter SSO ou rapprochement ENT lorsqu'une intégration officielle
  devient disponible.

## Jeux de tests obligatoires

- création simple pour chaque profil ;
- parent agissant pour deux enfants ;
- professeur sans email académique ;
- demande avec email seulement, téléphone seulement, puis les deux ;
- fichier sain, type falsifié, fichier trop grand et fichier bloqué ;
- double clic et dix renvois réseau identiques ;
- 200 demandes simultanées ;
- Brevo indisponible puis rétabli ;
- réponse email avec et sans pièce jointe ;
- webhook reçu dix fois ;
- jeton expiré, réutilisé et forcé ;
- agent sans droit, agent autorisé et direction ;
- IA indisponible, résultat invalide et confiance faible ;
- restauration d'un dossier et d'un média depuis sauvegarde ;
- écrans 320 px, 390 px, tablette et ordinateur large.
