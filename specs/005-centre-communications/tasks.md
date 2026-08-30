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
- [x] T010D Rendre la liste privée exploitable sous volume : recherche locale
  sur les métadonnées, filtre par état, compteur de résultats et historique
  borné des versions. Aucun corps de message n'entre dans la recherche.
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
- [x] T011D1 Relier le dépôt signé PDF/DOCX à l'interface responsive avec suivi
  des états, derrière `COMMUNICATION_DOCUMENT_UPLOAD_ENABLED` et
  `VITE_COMMUNICATION_DOCUMENTS_ENABLED`, tous deux fermés par défaut. La preuve
  ClamAV fictive et l'activation contrôlée restent dans T011D.
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

- [x] T016 Définir le contrat serveur limité avec le registre du Webmail. Le
  contrat HMAC sépare requête et réponse, expire les requêtes en cinq minutes et
  limite les instantanés à une heure. Il ne transporte que des groupes opaques,
  leur libellé, type, état et comptage agrégé ; coordonnées, listes de membres,
  champs inconnus, rejeu hors délai et croisement d'établissement sont refusés.
  Aucune route distante, donnée réelle ou diffusion n'est activée.
- [ ] T017 Préparer les destinataires par référence de contact, côté serveur.
- [x] T017A Définir une résolution signée et paginée, liée à l'établissement, à
  la version, à l'instantané approuvé et aux groupes exacts. Seules des
  références opaques `active_validated_email` deviennent des livraisons
  idempotentes ; une simulation de 200 contacts ne contient aucune coordonnée.
  T017 reste ouvert jusqu'à la route Webmail et l'insertion transactionnelle.
- [x] T017B Persister transactionnellement chaque page vérifiée après verrou de
  la version courante validée. Un conflit est relu et comparé champ par champ ;
  l'audit reste agrégé. T017 reste ouvert jusqu'à la route Webmail séparée.
- [ ] T018 Envoyer individuellement via Brevo avec lien canonique.
- [x] T018A Définir l'ordre signé LyceeGest vers le Webmail : un seul contact
  opaque, texte validé, chemin canonique sans jeton et idempotence de livraison.
  Le Webmail reste seul à résoudre l'adresse et à appeler Brevo. T018 reste
  ouvert jusqu'à l'endpoint séparé et à la recette fictive.
- [x] T018B Définir le reçu signé Webmail vers LyceeGest : il est lié à la
  commande exacte et renvoie seulement l'issue, les empreintes d'idempotence et
  de message fournisseur, ainsi que des dates bornées. Le brut Brevo et les
  coordonnées ne reviennent jamais. T018 reste ouvert jusqu'à l'endpoint séparé
  et à la recette fictive entre applications.
- [x] T018C Persister les trois empreintes de poignée de main et définir la
  transition atomique attendue : seule une commande exacte sous travail
  `running` peut devenir `sent`; un reçu connu préserve tout état plus avancé.
  T018 reste ouvert jusqu'au worker distant et à la recette fictive.
- [x] T018D Ajouter le client local du futur worker : vérification commande et
  reçu, délai borné, concurrence maximale de vingt et erreurs fournisseur
  converties en codes fermés. Aucun endpoint ni appel distant n'est activé.
  T018 reste ouvert jusqu'au raccordement transactionnel.
- [x] T018E Ajouter l'adaptateur de persistance : travail et livraison sont
  reverrouillés, la décision est recalculée, l'audit est idempotent puis les
  deux états sont modifiés dans la transaction appelante. T018 reste ouvert
  jusqu'au worker qui orchestre l'appel distant.
- [x] T018F Orchestrer localement un lot déjà réclamé : validation complète
  avant transport, concurrence bornée, reçu vérifié puis persistance du succès
  ou de la panne. Le runner reste sans Cron, endpoint ou transport par défaut ;
  T018 reste ouvert jusqu'à l'adaptateur Webmail séparé.
- [ ] T019 Enregistrer livré, différé, rejeté, spam et désinscrit.
- [x] T019A Définir le contrat Brevo de délivrabilité avant toute route. Un
  Bearer fort est comparé en temps constant ; seuls les événements documentés
  utiles deviennent `delivered`, `deferred`, `rejected`, `spam` ou
  `unsubscribed`. L'identifiant sortant et la clé de rejeu sont des HMAC
  cloisonnés ; email, objet, motif, IP et tags du fournisseur sont ignorés. La
  fenêtre temporelle est bornée à trente jours avec cinq minutes de tolérance
  future. T019 reste ouvert jusqu'à la route, la persistance idempotente et la
  recette de rejeu sur la preview.
- [x] T019B Ajouter la route et la persistance idempotente, fermées par défaut.
  Le rattachement est cloisonné par l'établissement configuré, chaque événement
  possède un HMAC unique et un verrou empêche les courses. Un état livré ne
  régresse pas ; spam et désinscription restent prioritaires. T019 reste ouvert
  jusqu'à la migration et la recette de rejeu fictive sur la preview.
- [ ] T020 Construire la boîte d'échec, la reprise et l'annulation des travaux.
- [x] T020A Définir le contrat de panne et d'annulation avant le worker. Les
  erreurs sont des codes fermés sans texte fournisseur ; les pannes temporaires
  repartent après 1, 5, 15, 60 puis 360 minutes, tandis qu'une erreur permanente
  ou un plafond atteint ouvre la boîte d'échec. L'annulation directe est limitée
  aux travaux `pending` ou `retry`, un travail `running` attend un point de
  contrôle et un email envoyé ou livré est explicitement non rappelable. T020
  reste ouvert jusqu'au worker transactionnel, à la reprise manuelle et à
  l'interface de boîte d'échec sur la preview.
- [x] T020B Définir la reprise humaine d'un travail mort. Seuls superadmin et
  proviseur sous MFA peuvent confirmer une cause corrigée ; l'échec d'origine
  reste intact et un successeur idempotent repart à zéro. Les erreurs de source
  ainsi que les livraisons absentes ou terminales ne sont jamais relancées.
  T020 reste ouvert jusqu'à la transaction atomique, à la route et à
  l'interface de preview.
- [x] T020C Ajouter la prise atomique des travaux d'envoi avec
  `FOR UPDATE SKIP LOCKED`, lot borné et verrou horodaté. Un travail `running`
  abandonné depuis au moins cinq minutes repart une minute plus tard ou devient
  `dead` au cinquième échec. T020 reste ouvert jusqu'au runner et à la boîte UI.
- [x] T020D Persister une panne sous verrou : la politique choisit reprise ou
  `dead`, le travail et une livraison encore pré-envoi sont modifiés ensemble,
  puis un audit borné est ajouté. Un état déjà envoyé ne régresse jamais. T020
  reste ouvert jusqu'au runner, à la reprise manuelle persistée et à la boîte UI.
- [x] T020E Persister la reprise humaine : le travail `dead` reste intact, un
  successeur `pending` et idempotent est créé uniquement après rôle direction,
  MFA et confirmation. Un rejeu retrouve la même clé sans second travail ni
  second audit. T020 reste ouvert jusqu'à la route privée et à la boîte UI.
- [x] T020F Ajouter la boîte d'échec API et la route de reprise privées : cent
  lignes bornées sans modèle de livraison côté navigateur, direction sous MFA,
  deux interrupteurs d'envoi, secret serveur et confirmation exacte. T020 reste
  ouvert jusqu'à l'interface et à la recette DB de preview.
- [x] T020G Ajouter l'interface direction responsive : échecs lisibles, cause
  fermée, essais, date et reprise confirmée en deux temps. Aucun identifiant ni
  état de livraison n'entre dans le navigateur. T020 reste ouvert jusqu'à la
  recette DB et au runner.
- [x] T020H Laisser un travail accepté mais non persisté sous verrou pour la
  récupération différée, sans seconde tentative immédiate. Le runner propage
  uniquement des codes fermés et T020 reste ouvert jusqu'à la recette DB.
- [x] T020I Persister et exposer l'annulation direction sous MFA. Elle reste
  disponible quand l'envoi est coupé, ne touche directement qu'aux états
  pré-envoi et ne prétend jamais rappeler un message accepté. T020 reste ouvert
  jusqu'à l'application de la migration et à la recette DB de preview.
- [x] T021A Ajouter un aperçu éditorial local sûr avant la relecture : rendu
  Markdown borné, images distantes neutralisées, liens isolés et absence de
  destinataire, publication ou envoi.
- [x] T021 Ajouter un aperçu email fidèle avant validation. Le même modèle
  éditorial borné alimente l'aperçu page et l'aperçu email local. Expéditeur,
  objet, pré-en-tête, corps et état du lien officiel sont visibles, sans adresse
  ni destinataire. Images distantes et liens dangereux sont neutralisés ; le
  rendu ne peut ni valider, ni publier, ni envoyer.

## Phase 5 - Entrants et réponses

- [ ] T022 Construire le webhook entrant authentifié et idempotent.
- [x] T022A Définir le contrat Brevo entrant avant d'ouvrir une route. Le jeton
  Bearer est vérifié en temps constant, l'interrupteur est fermé par défaut et
  le lot est limité à vingt messages. Le contrat produit uniquement des
  HMAC cloisonnés de `Message-ID`, référence de réponse et alias, avec
  des compteurs bornés de pièces jointes. Sujet, corps, expéditeur, adresse,
  nom de fichier et jeton de téléchargement ne sortent jamais du parseur. T022
  reste ouvert jusqu'à la route, la persistance privée et la recette de rejeu.
- [x] T022B Ajouter la route et la persistance de métadonnées, fermées par
  défaut. Le lot est HMAC, idempotent et borné ; aucun expéditeur, sujet, corps,
  nom de fichier ou adresse n'est stocké. T022 reste ouvert jusqu'au stockage
  privé antivirus du contenu et à la recette de rejeu sur la preview.
- [ ] T023 Rattacher chaque réponse à la bonne communication.
- [x] T023A Définir le rattachement strict avant la persistance. La référence
  `In-Reply-To` entrante utilise le même HMAC secret que l'identifiant du message
  sortant. Seule une livraison du même établissement et portant cette référence
  exacte peut être proposée ; absence, ambiguïté, champ de contact ou croisement
  d'établissement sont refusés sans repli sur une adresse. Une migration impose
  l'unicité par établissement mais reste à appliquer sur la preview avant T023.
- [x] T023B Rattacher la route uniquement par HMAC sortant exact dans
  l'établissement configuré, avec deux candidats au maximum et aucun repli
  nominatif. Les entrants non rattachés restent privés avec communication nulle.
  T023 reste ouvert jusqu'à la recette DB de preview.
- [ ] T024 Classer retrait, correction de contact, question et réponse libre.
- [x] T024A Définir et tester le classificateur local avant son raccordement. Il
  produit seulement les quatre catégories prévues, comprend des signaux bornés
  en français, anglais, espagnol et arabe, respecte les négations et force une
  revue sécurisée en présence d'un secret. Toute action reste humaine ; T024
  demeure ouvert jusqu'à la boîte entrante et sa persistance.
- [ ] T025 Créer un brouillon depuis un email transféré autorisé.
- [x] T025A Définir le contrat local avant toute boîte de collecte. Seule une
  source déjà autorisée côté serveur peut produire un brouillon ; l'identifiant
  fournisseur reste un HMAC et devient une empreinte anti-doublon. Les en-têtes
  de transfert, anciens fils et images distantes sont neutralisés, les secrets
  et balisages actifs sont refusés, les données personnelles sont signalées
  avant toute aide IA. Le résultat reste `internal`, `draft`, sans publication,
  audience ni notification, avec relecture humaine obligatoire. T025 reste
  ouvert jusqu'à la route privée, la persistance et la recette de rejeu.
- [ ] T026 Configurer le domaine et le filtre Gmail uniquement après autorisation.

## Phase 6 - Validation

- [ ] T027 Tester qu'aucune adresse d'un autre destinataire n'est exposée.
- [x] T027A Verrouiller la surface actuelle avant l'envoi. Un test découvre les
  sept routes privées, interdit toute nouvelle route publique, audience,
  destinataire ou envoi, contrôle les sorties documentaires et l'interface, et
  exige des projections SQL explicites. T027 reste ouvert jusqu'au test de
  livraisons fictives lorsque T017 à T020 existeront.
- [x] T027B Simuler 200 ordres individuels signés sans adresse, nom, tableau de
  contacts, origine externe ou jeton dans le lien. T027 reste ouvert jusqu'à la
  preuve entre les deux applications sur la preview.
- [x] T027C Simuler 200 reçus de livraison signés, chacun lié à sa commande et
  sans adresse, identifiant Brevo brut ni contenu utilisateur. T027 reste ouvert
  jusqu'à la recette réseau et transactionnelle sur la preview.
- [ ] T028 Tester rôles, MFA, contenus internes et API publique.
- [x] T028A Exiger `aal2` sur toutes les routes privées du centre et vérifier
  les rôles bornés, le cloisonnement établissement, la fermeture du module et
  l'absence d'API publique, d'audience, de publication ou d'envoi. T028 reste
  ouvert jusqu'à l'existence et au test de l'API publique validée.
- [ ] T029 Tester doublons, panne Brevo, reprise et 200 destinataires.
- [x] T029A Simuler localement 200 références opaques : 200 lignes et 200 clés
  uniques, stables au rejeu. Les doublons, contacts inactifs, coordonnées,
  instantanés substitués et pages incohérentes sont refusés. T029 reste ouvert
  jusqu'à la panne et la reprise sur une file de preview.
- [x] T029B Définir la reprise après coupure entre l'appel Brevo et sa réponse :
  le même reçu peut terminer le travail sans remplacer un état livré ni créer
  une seconde identité fournisseur. T029 reste ouvert jusqu'à la recette sur la
  file de preview.
- [x] T029C Simuler 200 appels individuels avec une concurrence de dix, ordre de
  résultat stable, reçus uniques et délai d'abandon. T029 reste ouvert jusqu'à
  la recette avec la file et l'adaptateur Webmail de preview.
- [x] T029D Verrouiller la fenêtre de course à la complétion : les mises à jour
  exigent encore le statut et l'empreinte de commande lus sous verrou, et un
  conflit annule toute la transaction. T029 reste ouvert jusqu'à la recette DB.
- [x] T029E Définir la concurrence de prise : vingt travaux au plus par appel,
  ordre stable, verrous ignorés entre workers et récupération bornée de cent
  travaux interrompus. T029 reste ouvert jusqu'à la recette DB de concurrence.
- [x] T029F Préparer la recette DB fictive de 200 livraisons : 160 succès, 20
  reprises, 10 échecs définitifs et 10 attentes, avec rejeu, immutabilité et
  `ROLLBACK` contrôlé. T029 reste ouvert jusqu'à son exécution sur la branche de
  preview après application contrôlée de la migration de poignée de main.
- [x] T030 Vérifier PDF, image, DOCX, fichier invalide et données personnelles.
  Les PDF/DOCX fictifs sûrs sont extraits localement ; image, faux PDF et type
  incohérent sont refusés. Une adresse ou un code scolaire supprime le texte
  extrait et impose la revue humaine. La preuve antivirus reste dans T011D.
- [ ] T031 Vérifier 320 px, ordinateur, clavier et lecteur d'écran.
- [ ] T032 Déployer en preview et tester avec des contacts fictifs.
- [ ] T033 Faire valider le pilote avant toute liste réelle ou envoi collectif.
