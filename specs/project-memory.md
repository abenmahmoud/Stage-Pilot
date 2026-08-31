# Memoire durable - Portail numerique du Lycee Blaise Cendrars

**Derniere mise a jour** : 31 aout 2026
**Branche de travail** : `codex/lycee-connect-prototype`
**Depot** : `abenmahmoud/Stage-Pilot`
**Dernier jalon de code verifie** : branche de preview Vercel

## Jalon du 30 août 2026 - brouillon depuis transfert autorisé

- Une nouvelle route Brevo reste fermée par défaut et exige un Bearer dédié,
  un expéditeur HMAC autorisé et un alias de collecte HMAC autorisé.
- L'acteur technique doit être un `admin` actif du même établissement ; un UUID
  configuré seul ne suffit pas.
- Un transfert valide crée atomiquement un seul entrant, un brouillon interne,
  sa version et un événement borné. Le rejeu ne crée aucune seconde ligne.
- Le brouillon n'a ni audience, ni livraison, ni tâche ; les données
  personnelles signalées doivent être masquées avant toute aide IA.
- La recette Supabase de preview laisse sept résidus à zéro. T025 est terminé,
  mais le webhook, Gmail, Brevo et toutes les variables restent désactivés.
- Le brief Claude est prêt mais non exécuté faute de modèle exact et de plafond
  de mission ; zéro jeton externe consommé.

## Jalon du 30 août 2026 - classement privé des réponses entrantes

- Le parseur Brevo entrant classe localement retrait, correction de contact,
  question ou réponse libre, puis détruit le texte analysé.
- La base conserve uniquement la catégorie et un état de revue ; aucune
  adresse, aucun sujet et aucun corps ne sont exposés dans l'API navigateur.
- La console Communications dispose d'une file responsive `Réponses reçues`,
  privée, AAL2, cloisonnée par établissement et limitée à cent métadonnées.
- Une recette transactionnelle sur la branche Supabase de preview valide les
  quatre catégories, refuse une catégorie d'action automatique, confirme zéro
  privilège client et laisse quatre résidus à zéro après rollback.
- T024 est terminé. Le webhook, le stockage brut, les pièces jointes et toute
  action automatique restent fermés ; T022 demeure bloqué par l'antivirus.
- L'audit des dépendances livrées retourne zéro vulnérabilité ; les alertes
  transitives des outils de développement Vercel restent suivies sans appliquer
  le correctif majeur cassant proposé par `npm audit --force`.
- Le brief Claude a été étendu mais reste non exécuté : modèle exact et plafond
  de mission non confirmés, zéro jeton externe consommé.

## Jalon du 30 août 2026 - médias Markdown publics verrouillés

- Les deux pages publiques et l'aperçu du gestionnaire utilisent désormais un
  rendu Markdown commun.
- Une image Markdown ne se charge que depuis une URL signée du bucket privé
  `site-content` sur l'origine Supabase configurée ; tout autre média disparaît.
- Les liens restent limités aux chemins internes, aux URL HTTPS sans identifiants
  et aux coordonnées `mailto:`/`tel:` strictes de l'ancien site, avec isolation
  de l'onglet externe.
- La recette Chromium bloque une image sur un projet Supabase tiers à 320 et
  1 440 px, sans requête sortante, débordement ni erreur JavaScript.

## Jalon du 30 août 2026 - client API privé raccordé au lecteur borné

- `apiFetch` applique désormais le même lecteur borné aux succès et erreurs JSON
  de toutes les consoles authentifiées.
- Les réponses `204` ou non JSON attendues restent compatibles ; les corps HTML,
  invalides ou surdimensionnés utilisent seulement les messages publics sûrs.
- La recette Chromium injecte plus de 4 Mio dans l'assistant puis confirme son
  repli local à 320 et 1 440 px, sans afficher le texte injecté.
- Lot preview uniquement : aucun compte réel, appel distant ou environnement de
  production n'a été utilisé ou modifié.

## Jalon du 30 août 2026 - réponses JSON bornées avant analyse

- Le navigateur lit désormais les réponses API par morceaux avec un plafond de
  4 Mio par défaut et interrompt immédiatement tout flux qui le dépasse.
- Le flux éditorial dispose d'un plafond explicite de 16 Mio, cohérent avec son
  contrat maximal de 100 contenus, sans élargir les autres routes.
- Les erreurs et paquets surdimensionnés restent masqués derrière les messages
  publics existants ; la recette « Mes demandes » passe à 320 et 1 440 px.
- Le contrôle est intégré à la barrière permanente. Aucun appel réel, donnée ou
  environnement de production n'a été utilisé ou modifié.

## Jalon du 30 août 2026 - page éditoriale dédiée liée à son adresse

- La route `/site/:slug` utilise désormais le même contrat strict que « À la
  une » et « Vie du lycée » avant de rendre un article ou un document.
- Une réponse contenant plusieurs articles, un curseur inattendu, un autre slug
  ou un média externe est refusée sans charger l'origine injectée.
- La recette Chromium confirme ce refus à 320, 390 et 1 440 px, sans débordement
  ni erreur JavaScript.
- Lot preview uniquement : aucun contenu réel, média distant ou production n'a
  été utilisé ou modifié.

## Jalon du 30 août 2026 - accusés publics validés avant succès local

- Fichier, message de suivi et fermeture de session exigent désormais une
  confirmation serveur complète avant de modifier l'état local.
- Un faux accusé conserve le texte saisi et les demandes mémorisées tout en
  affichant une erreur claire.
- La recette Chromium couvre message et fermeture à 320 et 1 440 px sans
  débordement ni erreur JavaScript.
- Lot preview uniquement : aucun message réel, fichier, session distante ou
  production n'a été utilisé ou modifié.

## Jalon du 30 août 2026 - pages du lycée sur le contrat public unique

- « Vie du lycée » utilise désormais le même validateur que « À la une » avant
  de rendre les pages publiées.
- Une page avec média externe injecté est ignorée sans requête sortante ; la
  présentation statique sûre reste disponible.
- La recette Chromium confirme ce repli à 320 et 1 440 px sans débordement ni
  erreur JavaScript.
- Lot preview uniquement : aucun contenu réel, média distant ou production n'a
  été utilisé ou modifié.

## Jalon du 30 août 2026 - flux « À la une » validé avant rendu

- Le frontend valide désormais chaque article, média, date, audience et curseur
  avant de mettre à jour le flux public.
- Les médias sont limités aux formats autorisés et aux URL HTTPS signées du
  bucket privé `site-content` sur l'origine Supabase configurée.
- La recette Chromium refuse une image externe injectée sans émettre de requête,
  à 320 et 1 440 px sans débordement ni erreur JavaScript.
- Lot preview uniquement : aucun contenu réel, média distant ou production n'a
  été utilisé ou modifié.

## Jalon du 30 août 2026 - création confirmée avant tout effet navigateur

- Le frontend valide désormais le numéro, le statut, les dates, l'idempotence et
  la preuve de persistance avant affichage, mémoire locale ou dépôt de fichier.
- Une confirmation liée à un autre dossier est refusée avec une erreur usager
  claire et sans exposer le faux numéro.
- La recette Chromium confirme ce refus à 320 et 1 440 px sans débordement ni
  erreur JavaScript.
- Lot preview uniquement : aucun dossier réel, envoi, base distante ou
  production n'a été utilisé ou modifié.

## Jalon du 30 août 2026 - échange du lien magique validé côté navigateur

- Le frontend n'ouvre plus un suivi à partir d'une confirmation réseau non
  validée ; seul le format public `BC-AAAA-NNNNNN` est accepté.
- Le jeton à usage unique est retiré de l'URL après succès comme après échec.
- La recette Chromium refuse un numéro injecté à 320 et 1 440 px sans
  débordement ni erreur JavaScript.
- Lot preview uniquement : aucun jeton réel, donnée privée ou production n'a
  été utilisé ou modifié.

## Jalon du 30 août 2026 - réponse de l'assistant validée dans le navigateur

- Le frontend traite désormais toute réponse de l'assistant comme inconnue et
  valide ses vocabulaires, tailles, sources, compteurs et reçu avant affichage.
- Une sortie malformée ou un reçu incohérent déclenche automatiquement l'analyse
  locale déterministe sans montrer le contenu injecté à l'usager.
- La recette Chromium confirme le classement local `ENT ou EduConnect` à 320 et
  1 440 px, sans débordement ni erreur JavaScript.
- Lot preview uniquement : aucun modèle externe, donnée réelle ou environnement
  de production n'a été utilisé ou modifié.

## Jalon du 30 août 2026 - réservation de pièce verrouillée côté navigateur

- Le navigateur n'appelle le stockage qu'après validation du bucket privé
  `support-quarantine`, du chemin à trois segments, de l'identifiant lié et du
  jeton signé borné.
- Une réservation falsifiée visant un bucket public, une traversée de chemin ou
  un jeton inattendu est refusée avant tout transfert d'octet.
- La recette navigateur confirme zéro appel Storage et un avertissement usager
  propre à 320 et 1 440 px, sans débordement ni erreur JavaScript.
- Lot preview uniquement : aucun fichier réel, stockage distant ou production
  n'a été utilisé ou modifié.

## Jalon du 30 août 2026 - détail public validé et sélection stable

- Le suivi public valide la demande, le contexte, jusqu'à 500 messages et cinq
  pièces bornées avant de rendre le dossier.
- Les erreurs de détail restent séparées de la liste et proposent une reprise
  ciblée ; un changement de sélection invalide immédiatement l'ancienne lecture.
- La recette navigateur refuse un message malformé, réussit la reprise puis
  maintient le bon dossier malgré une réponse concurrente retardée, à 320 et
  1 440 px sans débordement ni erreur JavaScript.
- Lot preview uniquement : aucune donnée réelle, production ou intégration
  externe n'a été utilisée ou modifiée.

## Jalon du 30 août 2026 - liste publique validée avant mémoire

- `Mes demandes` valide chaque numéro, libellé, catégorie, statut, priorité et
  date avant affichage, notification ou écriture dans IndexedDB.
- La réponse est limitée à 200 dossiers sans numéro dupliqué ; une actualisation
  obsolète ne peut plus remplacer une liste plus récente.
- La recette navigateur refuse une réponse malformée à 320 et 1 440 px, conserve
  un écran stable sans débordement et la porte de sécurité complète reste verte.
- Lot preview uniquement : aucune donnée réelle, production ou intégration
  externe n'a été utilisée ou modifiée.

## Jalon du 30 août 2026 - extraction locale des présentations PPTX

- Les diapositives et notes PPTX sont extraites localement après antivirus et
  précontrôle ZIP, sans service externe ni OCR.
- Le parseur limite à 300 diapositives, 5 Mo par XML et 40 Mo au total, refuse
  chiffrement, structure invalide, doublons, entités et XML ambigus.
- Les mêmes contrôles de coordonnées, secrets et instructions malveillantes
  suppriment le texte proposé et imposent une relecture humaine.

## Jalon du 30 août 2026 - secrets refusés dans les annuaires

- Les annuaires CSV/XLSX refusent les en-têtes et cellules contenant mot de
  passe, OTP, code ENT/PRONOTE, jeton API ou clé privée.
- Le contrôle intervient après antivirus mais avant empreinte, chiffrement ou
  persistance ; seul le motif générique `secret_forbidden` atteint le worker.
- Une mention sans valeur, telle que « mot de passe oublié », reste acceptée.
  La remise éventuelle de codes demeure un chantier séparé Direction/DPO.

## Jalon du 30 août 2026 - matrices de scénarios des compétences

- Les cinq compétences pilotes possèdent chacune cinq cas positifs, trois cas
  ambigus et trois cas interdits avec un comportement observable attendu.
- Le contrôle `test:skill-scenarios` découvre tous les brouillons de compétence
  et bloque automatiquement une catégorie incomplète, un identifiant dupliqué
  ou un résultat attendu absent.
- Ces scénarios vérifient les limites existantes ; ils ne publient aucune
  procédure locale encore en attente de validation métier.

## Jalon du 30 août 2026 - rotation locale du coffre d'identités

- Une enveloppe AES-256-GCM peut être rechiffrée de vN vers une nouvelle version
  avec l'ancienne clé explicitement conservée pendant la transition.
- La rotation vérifie l'ancien AAD, crée un nonce neuf et refuse la même version,
  une clé source absente, un contexte discordant ou une enveloppe altérée.
- Aucun worker distant, aucune clé réelle et aucune ligne de base n'ont été
  modifiés ; la rotation par lots et le retrait d'ancienne clé restent ouverts.

## Jalon du 30 août 2026 - identité, rôle et autorité séparés

- Le runtime utilise désormais I0-I4 pour la preuve d'identité et conserve le
  rôle d'établissement dans un champ distinct.
- I4 exige une session agent `aal2`; une ancienne valeur ne peut jamais le
  produire par compatibilité.
- Les compétences et plans utilisent A0-A4 pour l'autorité d'action. Les tests
  du registre, des outils et des emplois du temps vérifient l'absence
  d'élargissement implicite des droits.

## Jalon du 30 août 2026 - recette Webmail de masse préparée

- Une recette SQL avec `ROLLBACK` couvre 200 livraisons fictives sans adresse.
- Répartition contractuelle : 160 succès, 20 reprises, 10 échecs définitifs et
  10 attentes.
- Son exécution distante attend une application contrôlée de la migration sur
  la branche Supabase de preview ; aucune migration distante n'a été lancée.

## Jalon du 30 août 2026 - runner Webmail local

- Le runner traite au maximum 20 travaux déjà réclamés avec concurrence bornée.
- Succès et panne empruntent deux persistances explicites ; aucune prose
  fournisseur ne remonte.
- Une panne de base après acceptation reste sous verrou pour la récupération
  différée et ne provoque jamais une seconde tentative immédiate.

## Jalon du 30 août 2026 - destinataires opaques persistés

- Chaque page de résolution signée est liée à la version courante validée sous
  verrou.
- Les conflits idempotents sont relus et comparés avant acceptation.
- Seuls références opaques, empreintes et comptages sont conservés ; aucune
  route Webmail ni liste réelle n'est activée.

## Jalon du 30 août 2026 - états non rappelables corrigés

- `deferred`, `rejected`, `spam` et `unsubscribed` ne sont plus assimilés à une
  livraison annulable avant envoi.
- Une annulation peut arrêter une reprise, mais ne prétend jamais rappeler un
  message déjà accepté par le fournisseur.

## Jalon du 30 août 2026 - annulation d'urgence préparée

- Direction sous MFA et confirmation exacte uniquement.
- L'arrêt d'un travail `pending` ou `retry` reste possible lorsque l'envoi est
  coupé ; un travail `running` attend son point de contrôle.
- La migration est préparée mais non appliquée à distance.

## Jalon du 29 août 2026 - scénarios humains de la charte

- Une urgence affiche le 15/112, le 3114 lorsque pertinent et un recours à un
  adulte, mais affirme qu'aucune alerte n'a été transmise et qu'aucune permanence
  du lycée n'est garantie.
- Une question sur le statut d'une alerte reçoit une négation déterministe. Une
  demande de donnée scolaire concernant un tiers est arrêtée avant l'appel IA.
- Un signal récent de malaise ou de danger reste prioritaire même si la personne
  le minimise ensuite ; la reprise humaine demeure proposée.
- `Mes demandes` permet de fermer un appareil partagé : la session hachée est
  révoquée, le cookie expire et la mémoire locale est effacée sans supprimer les
  dossiers conservés côté serveur.
- 54 contrôles ciblés, la recette de mémoire et le build passent. L'action reste
  lisible sans débordement à 1 440 px et 390 px.
- Lot preview uniquement : aucune donnée réelle, migration, production, DNS,
  VPS, Hostinger, Webmail, ENT ou PRONOTE n'a été modifié.

## Jalon du 29 août 2026 - frontières adverses vérifiées

- Une phrase saisie dans le chat ne peut ni attribuer un rôle, ni confirmer une
  identité, ni autoriser la consultation d'un tiers.
- Le contact vérifié, l'identité scolaire et la relation parent-élève restent
  trois preuves distinctes. Une relation active ne vaut que pour l'élève lié.
- Les sessions publiques sont liées au hash de session, au code et au dossier ;
  les agents sont limités à leurs services dans les files, statistiques, lectures
  et écritures.
- Les rôles proviennent uniquement des métadonnées serveur et la confirmation
  d'identité exige toujours une action humaine avec MFA.
- 47 contrôles ciblés et le build passent. T022A reste ouverte pour les scénarios
  humains complets de la charte.
- Lot preview uniquement : aucune donnée réelle, migration, production, DNS,
  VPS, Hostinger, Webmail, ENT ou PRONOTE n'a été modifié.

## Jalon du 29 août 2026 - limites sans blocage collectif

- Le guichet et l'assistant utilisent désormais des compteurs PostgreSQL
  partagés par appareil, contact haché, compte agent et comportement répété.
- La connexion réseau collective reste seulement un garde-fou très haut. Il
  n'existe plus de clé `network:unknown` commune à tous les usagers et, sur
  Vercel, seul l'en-tête réseau de confiance est accepté.
- Messages, réservations de fichiers, confirmations et écritures de la console
  possèdent aussi leurs propres limites. Les appels IA coûteux conservent leurs
  plafonds par compte déjà existants.
- La migration `20260829205947` est appliquée uniquement à la branche Supabase
  de preview. Les 17 compteurs présents ont été conservés ; l'essai synthétique
  a été annulé et n'a laissé aucun résidu.
- 48 contrôles ciblés et le build passent. RLS est forcée, les clients n'ont
  aucun droit et aucune donnée réelle, production, DNS, VPS, Webmail, ENT ou
  PRONOTE n'a été modifié.
- Les seuils V1 et la suppression progressive des compteurs expirés doivent être
  observés puis validés avec la direction et le DPO avant production.

## Jalon du 29 août 2026 - conservation documentaire fermée par défaut

- La branche Supabase de preview `guichet-lycee-preview` possède désormais les
  états de conservation et de purge. Elle contient toujours zéro document et
  les rôles `anon` et `authenticated` n'ont aucun accès à la table.
- `pending_dpo` est le défaut obligatoire : aucune date de conservation et
  aucune purge ne peuvent être planifiées avant une politique approuvée.
- Les titres, descriptions et noms de fichiers personnels ou sensibles sont
  masqués dans les listes. L'original reste accessible uniquement par une URL
  privée de soixante secondes et chaque ouverture est auditée sans chemin ni nom.
- Un worker par lots utilise `FOR UPDATE SKIP LOCKED`, refuse les documents liés
  à une source et supprime le binaire via l'API Storage avant d'effacer extraits
  et métadonnées. Un interrupteur serveur le maintient désactivé par défaut.
- 45 contrôles documentaires passent avec le build. Les avis Supabase liés aux
  tables privées sans politiques restent informatifs : RLS est forcée et tous
  les droits clients sont révoqués.
- Aucun chiffre de conservation, document réel, production, DNS, VPS, Webmail,
  ENT ou PRONOTE n'a été ajouté, utilisé ou modifié.

## Jalon du 29 août 2026 - proposition documentaire avant validation

- Les documents textuels sans donnée privée, secret ni consigne suspecte
  produisent localement une proposition de connaissance bornée : résumé, points
  clés, règles, interdictions, dates, contradictions possibles et questions.
- Une consigne visant à modifier les règles de l'agent, imiter un rôle ou obtenir
  ses instructions supprime le texte extrait et impose une lecture humaine.
- L'API d'administration ne renvoie que la proposition filtrée. Elle ne renvoie
  ni texte intégral, ni chemin de stockage, ni contenu privé du fichier.
- L'interface rappelle que la proposition ne publie rien. Une personne habilitée
  doit comparer l'original privé et confirmer avec MFA avant de créer la source.
- 36 contrôles ciblés passent avec le build. Les vues protégées redirigent vers
  la connexion sans erreur console ni débordement à 1 440 px et 390 px.
- Lot preview uniquement : aucun modèle externe, document réel, donnée distante,
  production, DNS, VPS, Webmail, ENT ou PRONOTE n'a été utilisé ou modifié.

## Jalon du 29 août 2026 - secrets refusés avant analyse et stockage

- Le guichet refuse désormais les mots de passe, codes reçus par SMS, codes
  ENT/PRONOTE et secrets techniques explicitement fournis. Le contrôle a lieu
  avant l'appel au modèle et avant toute insertion dans la base.
- La règle couvre création, conversation, suivi web, email entrant, note interne,
  modèle, traduction, réponse agent, nom et métadonnées de pièce jointe.
- Une phrase normale comme « j'ai oublié mon mot de passe » ou « mon code ENT est
  perdu » reste acceptée. Le refus explique quoi retirer sans jamais répéter la
  valeur détectée.
- Le binaire des PDF, documents et images reste en quarantaine antivirus mais son
  texte extrait localement est désormais analysé pour les valeurs de secrets.
  Une détection retire le texte proposé et impose une lecture humaine ; une
  simple procédure de réinitialisation sans valeur reste exploitable après MFA.
- Les images et présentations sans extraction fiable restent en lecture humaine,
  sans OCR automatique. Cette limite reste ouverte dans T010B2D/T014C et interdit
  de prétendre que tous les documents sont sûrs.
- 69 contrôles ciblés distincts passent avec le build TypeScript/Vite. Lot preview
  uniquement : aucune production, donnée réelle, base distante, DNS, VPS,
  Webmail, ENT ou PRONOTE n'a été modifié.

## Jalon du 29 août 2026 - doublons signalés et décidés par un humain

- Une nouvelle demande est signalée comme doublon possible lorsque le même
  contact haché a créé une demande de même catégorie dans les sept jours. Le
  texte et les coordonnées en clair ne servent pas à cette recherche.
- Le signal et la décision sont des événements d'audit. L'agent peut confirmer
  ou écarter le rapprochement, mais aucun dossier n'est fusionné, fermé ou
  supprimé automatiquement.
- La file affiche un badge « Doublon ? » et un filtre dédié afin de traiter les
  rapprochements sans ouvrir tous les dossiers.
- Le demandeur ne reçoit aucune métadonnée de doublon ni le numéro d'un autre
  dossier. Un agent doit être autorisé à consulter les deux dossiers avant de
  voir le numéro candidat et d'enregistrer sa décision.
- 39 contrôles ciblés passent avec le build TypeScript/Vite. Le contrôle visuel
  passe à 1440 px et 390 px sans débordement ni erreur console.
- Lot preview uniquement : aucune production, donnée réelle, base distante, DNS,
  VPS, Webmail, ENT ou PRONOTE n'a été modifié.

## Jalon du 29 août 2026 - priorité déterministe à la création

- La catégorie et le texte attribuent déjà le service avant l'IA ; la demande
  enregistre désormais aussi la priorité produite par cette même route.
- La priorité normale reste le défaut. Un risque explicite de protection passe
  en critique et un « incident grave » destiné à la direction passe en urgent.
  Écrire seulement « urgent » n'augmente pas la priorité.
- La surveillance des délais et les relances restent dans T029 : aucun délai
  métier supplémentaire n'a été inventé dans ce lot.
- 32 contrôles ciblés passent avec le build TypeScript/Vite. Ils couvrent le
  routage, la persistance, la file agent, l'accueil multilingue et le parcours
  agent existant.
- Lot preview uniquement : aucune production, donnée réelle, base distante, DNS,
  VPS, Webmail, ENT ou PRONOTE n'a été modifié.

## Jalon du 29 août 2026 - réponse agent multilingue contrôlée

- L'agent peut partir d'une réponse française et préparer une traduction vers la
  langue détectée du dossier. L'interface montre aussi une rétrotraduction en
  français et bloque l'envoi tant que la comparaison humaine n'est pas cochée.
- Les noms connus et coordonnées sont masqués avant le modèle puis seuls les
  marqueurs nominatifs connus sont restaurés. Le modèle fonctionne avec
  `store: false`, une limite par agent et aucune donnée du fil utilisateur.
- Un reçu HMAC de quinze minutes lie le dossier, l'agent, le texte source, la
  traduction exacte et la langue. Une modification, une réutilisation par un
  autre agent ou une expiration est refusée côté serveur.
- Pour ENT et messagerie académique avant identité confirmée, seule la traduction
  du message sécurisé de vérification est autorisée. La validation est inscrite
  dans l'événement d'envoi sans donner d'autorité supplémentaire à l'IA.
- 59 contrôles ciblés passent avec le build TypeScript/Vite. Les scénarios
  couvrent notamment le masquage, l'altération du texte, l'expiration, le mauvais
  agent, les accès de service, la concurrence et la politique de l'assistant.
- Lot preview uniquement : aucune production, donnée réelle, base distante, DNS,
  VPS, Webmail, ENT ou PRONOTE n'a été modifié.

## Jalon du 29 août 2026 - accueil multilingue et traitement français

- L'assistant répond désormais dans la langue principalement détectée et produit
  en parallèle un résumé interne en français clair. Un scénario arabe classe une
  demande ENT et conserve une réponse arabe avec un résumé français distinct.
- Le message original reste intégralement dans le fil du dossier. Le résumé est
  repseudonymisé côté serveur, limité à 700 caractères et marqué
  `automatique_a_verifier` ; l'espace agent rappelle de vérifier l'original.
- La traduction n'entre pas dans le routage déterministe et ne peut augmenter ni
  l'urgence, ni le niveau d'identité, ni les droits. Une conversation de repli ou
  un formulaire classique modifié n'envoie aucun ancien résumé IA.
- 51 contrôles ciblés multilingues, conversation, routage, pseudonymisation et
  politique de l'assistant
  passent avec le build. Aucune donnée réelle, base distante, production, DNS,
  VPS, Webmail, ENT ou PRONOTE n'a été modifié.

## Jalon du 29 août 2026 - recherche usager et sources visibles

- L'agent rapproche maintenant les formulations courantes des domaines validés :
  un « mot de passe perdu » peut retrouver la compétence ENT et un « PC qui ne
  démarre plus » la procédure ordinateur, sans supprimer les contrôles de
  publication, classification, service, établissement, validité et révision.
- Les réponses fondées sur des extraits sélectionnés affichent sous le message le
  titre de la source et sa date de mise à jour. Cette liste est produite par le
  serveur après la réponse structurée ; elle ne peut pas être inventée par le
  modèle et n'expose aucun identifiant, chemin, empreinte ou propriétaire.
- Le journal d'usage reste plus réduit que la réponse publique : il conserve
  seulement les références opaques des versions et sources, le hash de session,
  le modèle et le tour, jamais les titres, messages, coordonnées ou extraits.
- Les tâches T024 et T025 sont closes par 39 contrôles ciblés et un build réussi.
  Aucun document réel, donnée nominative, base de production, domaine, VPS,
  Webmail, ENT ou PRONOTE n'a été modifié. Il faudra publier des compétences
  validées et fictives pour voir ces références lors de la future recette
  utilisateur intégrée.

## Jalon du 29 août 2026 - extraits documentaires minimaux

- Les documents approuvés avec MFA peuvent désormais produire des extraits
  déterministes uniquement lorsqu'ils sont publics ou internes, sans signal de
  donnée privée ni secret. Les classifications personnelles et sensibles restent
  en lecture humaine.
- Le compilateur conserve au plus 40 passages et 30 000 caractères par source,
  puis supprime le texte intégral extrait. Pour une question, le contexte est
  limité à six passages et 4 000 caractères sélectionnés après les contrôles
  d'établissement, rôle, service, publication et validité.
- Les balises réservées sont neutralisées et un extrait ne peut modifier ni les
  droits, ni les outils, ni les règles système. L'espace superadministrateur
  indique le nombre d'extraits utilisables ou « Lecture humaine uniquement ».
- Après une réponse IA réussie, l'audit conserve la version de compétence et les
  références opaques des sources réellement utilisées. Il ne conserve ni la
  question, ni la réponse, ni les coordonnées, ni le texte des extraits.
- Les migrations `20260829034457` et `20260829034714` sont appliquées seulement
  sur la branche Supabase de preview. La table est vide, RLS est forcée, les
  clients n'ont aucun droit et les clés étrangères sont indexées. Aucun document
  réel, VPS, Vercel production ou DNS n'a été modifié.
- La preuve reproductible est dans
  `docs/operations/KNOWLEDGE_EXCERPTS_PREVIEW_2026-08-29.md`. La publication et
  la recette complète d'une première compétence entièrement fictive restent à
  réaliser avant de fermer T014D.

## Jalon du 29 août 2026 - premier coffre chiffré du répertoire

- La preview conserve désormais les noms et coordonnées strictement nécessaires
  dans une table serveur séparée, chiffrés en AES-256-GCM par le worker. Chaque
  fiche utilise un nonce aléatoire et un contexte authentifié lié à
  l'établissement, la version et la référence opaque ; le rapport demeure
  anonymisé et ne contient que les empreintes HMAC.
- La clé `v1` de 32 octets a été générée directement sur le VPS sans être
  affichée. Elle n'est présente ni dans Git, ni dans Supabase, ni dans Vercel.
  Le modèle d'IA et le navigateur n'ont aucun accès au coffre.
- La migration `20260829010855` est appliquée uniquement à Supabase preview.
  RLS est activée et forcée, les rôles clients n'ont aucun droit et la table est
  vide hors recette.
- Approbation et activation refusent un coffre incomplet ; le retrait efface les
  fiches chiffrées. Les tests détectent aussi l'altération, le mauvais contexte
  et la mauvaise clé.
- Les recettes fictives ont validé trois personnes chiffrées, EICAR, deux
  versions, une seule version active, remplacement, retrait et nettoyage à zéro.
  Les quatre timers VPS restent actifs.
- La recherche déterministe, la rotation opérationnelle de clé, la rétention, la
  restauration et la validation Direction/DPO restent obligatoires avant toute
  donnée réelle. La preuve est dans
  `docs/operations/IDENTITY_DIRECTORY_VAULT_PREVIEW_2026-08-29.md`.

## Jalon du 29 août 2026 - cycle de vie du répertoire privé

- La preview gère maintenant le parcours `review` → `approved` → `active` →
  `superseded` → `retired`. L'activation est sérialisée par établissement et
  l'index unique reste la seconde barrière garantissant une seule version active.
- Le retrait exige direction, MFA, confirmation et justification. Une version
  active ou encore référencée par une identité ou une relation ne peut pas être
  retirée. Le fichier privé et les lignes de quarantaine sont supprimés ; seuls
  le motif, l'horodatage, l'acteur et l'audit minimal subsistent.
- Un déclencheur serveur refuse désormais toute nouvelle identité ou relation
  fondée sur une version non active. Le répertoire reste séparé des connaissances
  de l'agent et ne contient toujours aucun mot de passe ni code d'accès.
- Le retour arrière de la migration a été vérifié avant application. La recette
  de preview a utilisé deux versions et un établissement entièrement fictifs,
  puis confirmé une seule version active, le blocage de la source remplacée, la
  suppression du fichier et des lignes, et zéro reste de test.
- La migration `20260829004115` est enregistrée uniquement sur la branche
  Supabase `xijocumlwivhbmffrnlj`. La preuve détaillée est dans
  `docs/operations/IDENTITY_DIRECTORY_LIFECYCLE_PREVIEW_2026-08-29.md`.

## Jalon du 29 août 2026 - analyse documentaire locale et validation humaine

- La preview possède désormais une file privée `knowledge_document_scan` et un
  worker VPS d'une minute exécuté sous `lycee-support`. ClamAV précède toute
  lecture ; PDF, DOCX, XLSX, TXT et CSV sont extraits localement avec des limites
  strictes. PPTX et images restent manuels.
- Les documents personnels/sensibles ou contenant des signaux d'email,
  téléphone, identifiant élève ou codes ne conservent aucun texte extrait. Aucun
  fichier brut n'est transmis à OpenAI, Claude, Kimi ou un autre modèle.
- La recette intégrée a placé un texte fictif en `review`, bloqué et supprimé
  EICAR, puis confirmé zéro document, audit ou travail de test restant. Le second
  passage autonome s'est terminé avec le code `0` ; les autres workers sont
  restés actifs.
- L'écran direction peut ouvrir l'original par un lien privé de 60 secondes,
  ajouter une note et, avec MFA, créer une source en brouillon ou refuser puis
  supprimer le fichier. Une source brouillon n'est ni publiée, ni reliée à une
  compétence, ni utilisée par l'agent.
- La migration `20260828234000` est enregistrée uniquement sur la base de
  preview. Les rôles clients n'ont pas accès à la file. La preuve détaillée est
  dans `docs/operations/KNOWLEDGE_DOCUMENT_WORKER_VPS_2026-08-29.md`.
- Avant des documents réels : validation Direction/DPO, rétention et sauvegardes,
  supervision des 20 Go libres, et migration planifiée du runtime VPS Node 20
  vers une version prise en charge.

## Jalon du 29 août 2026 - worker du répertoire privé sur le VPS de preview

- Après autorisation explicite, le worker d'annuaire a été installé de manière
  additive dans `/opt/lycee-support-preview`, avec secret HMAC généré sur le VPS,
  ClamAV et timer systemd d'une minute. Aucun autre service, domaine ou
  environnement n'a été modifié.
- La recette intégrée a envoyé un CSV de quatre lignes fictives : état `review`,
  preuve antivirus propre et aucune identité brute conservée. EICAR a été bloqué
  et le nettoyage a confirmé zéro import, ligne, audit ou travail restant.
- Les timers du répertoire, de l'email et des pièces jointes sont actifs ; le
  second déclenchement automatique du nouveau worker s'est terminé avec le code
  `0`. L'audit npm du répertoire VPS ne trouve aucune vulnérabilité.
- Le besoin durable est maintenant séparé en deux entrées superadministrateur :
  répertoire privé d'identités et documents de connaissance validés. Les codes
  ENT/PRONOTE, mots de passe et secrets sont interdits dans les deux. Un futur
  coffre chiffré et des outils déterministes seront nécessaires pour consulter
  des noms ou coordonnées sans les transmettre au modèle.
- La preuve détaillée est conservée dans
  `docs/operations/IDENTITY_DIRECTORY_WORKER_VPS_2026-08-29.md`.
- L'écran du répertoire peut générer localement un CSV de test contenant 1 200
  élèves, 700 responsables, 200 personnels et 1 900 relations. Le test passe
  4 000 lignes dans le parseur sans rejet et confirme l'absence de code ou de
  domaine académique réel ; aucun utilisateur fictif n'est créé en base par le
  téléchargement.
- Le dépôt documentaire superadministrateur est désormais séparé du répertoire
  des personnes : plus de type annuaire, ajout du formulaire vierge, service
  responsable, périmètre, date d'effet et échéance de révision obligatoires. La
  migration `20260828232200` est appliquée uniquement à la preview vide ; RLS est
  forcée, les droits clients sont absents, huit tests ciblés et le build passent.

## Jalon du 29 août 2026 - analyse privée du répertoire préparée

- Le format fictif du répertoire, le parseur CSV/XLSX borné à 25 000 lignes et
  le worker ClamAV sont implémentés dans Git. Les formules, macros, colonnes
  libres, signatures incorrectes et valeurs hors contrat sont refusées.
- Les noms et coordonnées ne sont jamais écrits dans les lignes du rapport. Les
  emails et téléphones sont normalisés puis transformés en HMAC-SHA-256 avec un
  secret serveur distinct ; le rapport conserve uniquement références opaques,
  types, périodes et codes d'anomalie.
- Le futur écran de revue distingue l'approbation du rapport et l'activation de
  l'unique version. Les deux actions exigent la session direction avec MFA, une
  justification et un audit. Une version comportant une ligne refusée ne peut
  pas être approuvée.
- La migration de quarantaine est appliquée uniquement à Supabase preview. La
  table et la file sont vides, RLS est forcée, les rôles publics n'ont aucun
  droit et le lint SQL ne remonte aucune erreur. Une insertion de cinq lignes
  fictives a été validée dans une transaction ensuite annulée.
- Le secret et le timer, absents lors de ce premier jalon, ont ensuite été
  installés et testés sur le VPS de preview comme indiqué dans le jalon ci-dessus.
  Aucune donnée réelle n'a été importée et aucun domaine de production n'a été
  modifié.
- Le commit `7cb7a40` est publié sur la preview Vercel
  `lyceegest-1rzm9kjdt-safe-scol.vercel.app` et sur l'alias de branche. L'écran
  administratif et le modèle fictif répondent en HTTP 200 ; rapport,
  approbation et activation répondent en HTTP 401 sans session. La connexion ne
  déborde pas à 390 px ni à 1 440 px.

## Jalon du 29 août 2026 - recette intégrée charge, sécurité et PWA

- Le test nettoyable de preview a créé 200 dossiers, 200 messages, 200 liaisons
  de session et 200 travaux avec concurrence 20 en 1 555 ms, soit 128,6
  créations par seconde. Le nettoyage a laissé zéro dossier, session ou file
  temporaire de charge.
- 135 contrôles ciblés passent, les deux audits npm ne trouvent aucune
  vulnérabilité et le build réussit. Les API d'identités, de santé des demandes
  et de contenus refusent l'anonyme en HTTP 401.
- Le portail ne déborde pas à 320, 390, 768 ou 1 440 px. Le manifeste et le
  service worker sont actifs. Lighthouse mobile obtient 100 en accessibilité et
  navigation agentique ; les scores 92 bonnes pratiques et 66 SEO viennent des
  protections/noindex propres à la preview Vercel.
- Le conseiller performance a fait ajouter les trois index de clés étrangères
  manquants au répertoire ; il n'en signale plus aucun pour ce module. La recette
  complète est conservée dans
  `docs/operations/PREVIEW_INTEGRATED_RECIPE_2026-08-29.md`.

## Jalon du 28 août 2026 - assistant visible dès l'accueil

- Le premier retour de présentation indiquait que l'assistant n'était pas assez
  visible. Il devient le premier outil après la photo, avant les actualités et le
  Webmail, avec un intitulé explicite et un champ demandant directement la
  question ou le problème.
- Un appel « Besoin d'aide ? » dans la photo d'accueil fait défiler la page et
  place le curseur dans le champ. Le formulaire classique reste proposé sans
  obliger à utiliser l'assistant.
- La mise en valeur conserve une interface sobre : contraste renforcé, profondeur
  légère, indicateur de disponibilité et animation neutralisée lorsque la
  réduction des mouvements est demandée.
- Le build réussit. Les contrôles navigateur ordinateur et téléphone confirment
  la visibilité au premier écran, le focus du champ, l'absence de débordement
  horizontal et l'absence d'erreur console.

## Jalon du 28 août 2026 - production Vercel publique

- Le propriétaire a autorisé explicitement la mise en production de la candidate
  afin de pouvoir la présenter sans compte Vercel.
- Le commit `44c744d` a été promu sur la production du projet Vercel `lyceegest`.
  Le domaine durable `gestion.lycee-blaise-cendrars-sevran.fr` répond en public
  sans l'écran d'authentification Vercel.
- Une navigation neuve a chargé `/prototype`, le portail et ses principaux accès
  sans erreur de console. L'API administrative des documents répond toujours
  `401` à une visite anonyme.
- L'ancienne production `dpl_9G4Y8RYfyCh6TtDrJsuRPzS5q9QR` reste identifiée
  comme cible de retour arrière. Le domaine principal Hostinger, son DNS, le VPS
  et le Webmail n'ont pas été modifiés.
- Cette publication rend la candidate présentable ; elle ne prouve pas encore
  la recette fonctionnelle complète des demandes, notifications, données et
  comptes agents, prévue maintenant sur cette version intégrée.

## Décision du 28 août 2026 - recette intégrée et accès de démonstration

- Le propriétaire ne souhaite plus être interrompu pour tester chaque petit lot.
  Codex conserve les contrôles automatiques et de sécurité pendant le
  développement, puis présente une version candidate intégrée pour une seule
  recette utilisateur complète couvrant portail, demandes, suivi, console,
  notifications et données.
- La recette utilisateur n'autorise pas à elle seule une bascule du domaine
  officiel. La production, le DNS et Hostinger restent soumis à une autorisation
  précise, à une sauvegarde vérifiée et à un retour arrière préparé.
- Les adresses Vercel de preview sont actuellement protégées par l'authentification
  de l'équipe. Un lien de partage temporaire peut ouvrir uniquement une
  démonstration ; l'accès public durable devra utiliser un domaine candidat
  explicitement choisi ou une mise en production autorisée.

## Jalon du 28 aout 2026 - memoire appareil et accessibilite

- Le brouillon public est conserve pendant 30 jours dans IndexedDB avec sa cle
  d'idempotence. Une recharge restaure la conversation, le formulaire et les
  coordonnees deja saisies sans creer une nouvelle cle.
- Aucun fichier, mot de passe, cookie, lien magique ou jeton d'acces n'est ecrit
  dans la memoire locale. Si des pieces avaient ete selectionnees, l'interface
  demande de les choisir a nouveau.
- Apres creation, le brouillon est supprime et une liste locale minimale garde
  uniquement numero public, objet, categorie, statut, priorite et dates. Les
  messages et pieces restent exclusivement accessibles par la session serveur.
- La recette navigateur a restaure un dossier fictif apres rechargement avec la
  meme cle, sans erreur console ni debordement horizontal a 390 px. Lighthouse
  mobile obtient 100 en accessibilite, bonnes pratiques et SEO.
- Le build, les tests de memoire, concurrence, acces agent, securite du suivi et
  politique de l'assistant passent. Le detail reproductible se trouve dans
  `docs/operations/DEVICE_MEMORY_RECIPE_2026-08-28.md`.

## Jalon du 28 aout 2026 - audit passwordless et identite

- Une seule revue Claude Sonnet a ete autorisee et executee en lecture seule sur
  une archive isolee de 16 fichiers, sans secret ni donnee reelle. Codex a
  arbitre chaque signal ; le detail est conserve dans
  `docs/audits/CLAUDE_PASSWORDLESS_SECURITY_REVIEW_2026-08-28.md`.
- Un lien magique produit toujours une nouvelle session d'appareil. Les acces
  deja legitimes du navigateur sont recopies, puis l'ancienne session est
  revoquee afin de conserver la continuite sans reutiliser le meme jeton.
- Les liens magiques expirent a 30 minutes et sont consommes atomiquement avant
  tout octroi. Les sessions d'appareil restent distinctes et durent 30 jours.
- Une reponse ne peut plus selectionner un contact desactive. Un journal global
  est reserve a l'administrateur avec MFA ; un auditeur reste borne a ses
  services.
- La confirmation d'une identite scolaire exige maintenant une session agent
  `aal2`, en plus du rapprochement avec une source officielle. Aucun annuaire
  reel n'est importe et l'obligation MFA generale attend encore deux comptes
  nominatifs et une recette de recuperation.
- Les tests cibles passent (5/5 securite des liens, 12/12 identite) ainsi que la
  compilation TypeScript et le build Vite. Un test d'integration concurrent sur
  base de recette reste requis avant production.

## Jalon du 28 août 2026 - reprise de l'ancien site en preview

- Les 28 pages et actualités inventoriées sur le WordPress historique sont
  importées dans la base Supabase isolée de preview comme brouillons à vérifier.
- Les 28 versions initiales et les audits d'import sont présents ; aucun contenu
  repris n'est publié automatiquement.
- 78 des 81 médias accessibles sont copiés dans le stockage privé et 47 liens
  média-contenu sont rattachés. Deux DOCX servis avec un type incorrect et un PDF
  de 49,8 Mo sont refusés ; le détail durable se trouve dans
  `docs/operations/LEGACY_IMPORT_PREVIEW_2026-08-28.md`.
- L'accès temporaire strictement borné à la preview utilisé pour cette copie a
  été retiré du code après l'opération. Hostinger, DNS, VPS et production sont
  restés inchangés.
- L'espace Contenus affiche le nombre de reprises à vérifier, filtre les
  brouillons repris et ouvre directement le prochain élément à relire.
- Le moteur Node déclaré est aligné sur Node 24, réellement utilisé localement
  et par Vercel. Les neuf alertes Supabase `auth_rls_initplan` des anciennes
  politiques MFA ont été supprimées en mettant en cache les valeurs Auth par
  requête, sans modifier les règles d'accès.
- Les messages envoyés au modèle masquent maintenant les emails, téléphones,
  noms explicitement déclarés, adresses, dates de naissance, identifiants élève
  et secrets. Les tests vérifient la non-fuite et la conservation du texte utile
  au classement; l'appel OpenAI reste limité et utilise `store: false`.
- La sortie IA est validée intégralement côté serveur avec des longueurs et des
  listes bornées. Une réponse invalide ou de confiance faible est ignorée au
  profit du classement déterministe; une demande locale ambiguë rejoint la file
  humaine `a_qualifier`. Ces comportements sont couverts par les tests agent et
  routage, y compris quand le fournisseur répond avec un JSON incomplet.
- La conversation et les métadonnées de pièces sont explicitement traitées
  comme données non fiables. Les balises réservées sont neutralisées, les noms
  complets de fichiers et leur contenu ne partent pas vers le modèle, les types
  inattendus sont réduits à `application/octet-stream` et une catégorie IA ne
  peut plus contredire une route locale certaine. Les scénarios d'injection sont
  couverts sans utiliser de donnée réelle.
- La gestion des contenus dispose désormais d'une politique partagée et testée
  pour les rôles éditeur/publicateur, les actions sur contenus archivés, les
  limites de saisie et la lecture publique. Un brouillon jamais publié n'est pas
  exposé; pendant une révision, seule l'ancienne version déjà validée demeure
  lisible. Toutes les tâches `003-gestion-contenus-lycee` sont couvertes.
- Une seconde revue externe bornee a ete contre-verifiee. Claude n'a produit
  aucun rapport apres saturation de contexte et n'a pas ete relance. Kimi a
  permis de confirmer quatre ameliorations publiques : acces direct au
  formulaire sans IA, conservation du debut et de la fin des demandes longues,
  consigne email ou telephone et copie du numero de dossier. Les alertes sur les
  erreurs API et le debordement mobile n'ont pas ete reproduites. Le detail est
  conserve dans `docs/audits/EXTERNAL_REVIEW_2026-08-28.md`.
- Le formulaire classique s'ouvre maintenant depuis l'accueil, accepte les
  pieces jointes et reste utilisable sans modele. Il a ete controle sans
  debordement a 320 px et 1440 px ; la conversation libre reste prioritaire.
- Une recette API fictive a revele que le premier formulaire direct n'envoyait
  aucun tour `requester` et etait refuse par la validation serveur. Le texte du
  formulaire est desormais transforme en message demandeur borne a 1 500
  caracteres tout en gardant le debut et la fin ; une conversation deja saisie
  n'est ni remplacee ni dupliquee.
- La recette en ligne a ensuite cree un dossier entierement fictif sans email,
  confirme le canal telephone et retrouve ce dossier dans le suivi du meme
  navigateur. Cette preuve ne valide pas encore le retour email entrant ni les
  comptes agents nominatifs.

## Decision du 27 aout 2026 - espaces de traitement

- Le proprietaire est superadministrateur et voit toutes les demandes.
- Le pilote prevoit un agent DDFPT, un agent administration et un agent vie
  scolaire, chacun avec compte individuel et double verification.
- Les agents sont cloisonnes cote serveur ; seuls superadmin et direction peuvent
  classer une demande sans service ou la transferer.
- La politique de preview utilise maintenant les adhesions persistees de sa base
  Supabase isolee. Un compte sans adhesion active est refuse sans repli vers les
  metadonnees. La production et la base Supabase principale restent inchangees.
- Lorsqu'un chat devient une demande, le dialogue utile est conserve dans l'ordre
  dans le dossier. Les messages automatiques restent identifies comme tels dans
  le suivi public et la console agent.
- Les modifications agent et les reponses utilisent la revision affichee du
  dossier. Une prise en charge concurrente ou un dossier devenu perime provoque
  un refus puis une actualisation, sans ecraser le travail d'un autre agent.
- Le superadministrateur dispose d'une vue de charge par service : dossiers
  ouverts, urgents, en retard et sans agent, chaque indicateur ouvrant la file
  correspondante sans elargir les droits des agents de service.
- Le lancement Claude autorise pour l'audit cible du 27 aout s'est arrete sans
  rapport exploitable a cause de sa limite de contexte. Aucune conclusion externe
  ni relance n'a ete retenue.
- La revue Kimi autorisee du 28 aout a ete contre-verifiee dans le depot et le
  navigateur. Son alerte d'exposition publique de la console a ete rejetee :
  l'API refuse l'anonyme et une session administration authentifiee ne voit que
  secretariat, intendance et administration. Les seuls constats prouves ont ete
  corriges : bouton inactif retire, vocabulaire public simplifie, canal de
  confirmation exact et priorites lisibles.
- L'editeur de contenus indique maintenant les modifications non enregistrees,
  demande confirmation avant de les abandonner, protege le depart de page et
  fournit des noms accessibles aux commandes d'icones.
- Le jalon `0349530` est publie sur l'alias de preview de la branche. Le portail,
  la session administration et l'etat de brouillon de l'editeur ont ete verifies
  en ligne sans enregistrer de contenu ni modifier un role.
- Le 28 aout, le proprietaire a autorise explicitement son passage en
  superadministrateur sur la preview uniquement. Son role Auth est `superadmin`,
  son adhesion nominative est `admin` active et aucun autre compte n'a ete
  modifie. La console renouvelle desormais la session avant de charger les files
  afin de prendre en compte une autorisation serveur recente.

## 1. Fonction de cette memoire

Ce document donne le contexte necessaire pour reprendre le projet sans dependre
d'une conversation. Il ne remplace pas les specifications :

- `001-guichet-numerique` decrit la demande, son suivi et le travail des agents;
- `002-agent-etablissement-adaptatif` decrit l'agent, les competences et les
  integrations futures;
- `003-gestion-contenus-lycee` decrit les actualites, pages, documents, modeles
  et l'aide a la redaction dans l'espace administratif;
- `004-reprise-site-officiel` decrit l'inventaire, l'import en brouillon et la
  validation humaine de l'ancien site avant toute bascule;
- `005-centre-communications` propose le circuit durable qui transforme une
  information en publication web datee et en notification email individuelle;
- les fichiers `tasks.md` restent la liste detaillee des travaux verificables.

Mettre a jour cette memoire apres chaque jalon important, sans y placer de donnee
personnelle, de mot de passe, de jeton ou de cle API.

Le skill personnel installe est `referent-numerique-lycee`. Sa copie portable et
versionnee se trouve dans `codex-skills/referent-numerique-lycee` pour permettre
une reinstallation controlee sur un autre poste.

## 2. Identite et separation des projets

- Le produit est le portail numerique du **Lycee Blaise Cendrars de Sevran**,
  construit dans le projet existant **LyceeGest**.
- `safe-scol` est seulement l'organisation Vercel qui heberge actuellement
  `lyceegest`. Ce n'est ni le nom ni la marque du produit.
- Le Webmail du Lycee est une application separee, simplement accessible depuis
  le portail et utilisee pour certains flux de communication.
- My Cycle et les autres produits restent entièrement séparés. ESSUF GROUP peut
  devenir le prestataire ou partenaire média du lycée après accord écrit, mais
  ses autres dépôts, données et secrets ne sont jamais mélangés avec ce projet.

## 3. Objectif connu

Construire progressivement une PWA du lycee qui reunit :

1. les informations, formations, specialites et acces utiles du lycee;
2. LyceeGest pour les stages et le Grand Oral;
3. le Webmail du Lycee pour la communication;
4. un guichet public de demandes par conversation libre ou formulaire;
5. un suivi par appareil, email et rappel telephonique;
6. une console agent pour traiter sans perdre les messages ni les documents;
7. un agent d'etablissement fonde sur des competences validees et versionnees.
8. un espace de contenus permettant a la direction de mettre a jour le portail
   sans modifier le code.
9. un centre de communication qui publie une information une seule fois, puis
   la diffuse sans exposer les listes de destinataires.
10. des comptes usagers avec contact vérifié puis identité scolaire confirmée
    pour accéder aux seules informations personnelles autorisées.
11. des réponses sur les cours, groupes, salles et changements depuis des sources
    officielles datées, sans publication de la présence des personnels.

Le proprietaire estime que **89 % de son programme reste encore a expliquer**.
Ce chiffre exprime la part de vision non decrite, pas l'avancement technique du
code. Ne pas inventer ce programme et ne pas annoncer un pourcentage global avant
sa specification.

## 4. Etat reel au 28 aout 2026

### Operationnel dans la preview protegee

- Accueil moderne, navigation Webmail/LyceeGest, pages du lycee, voies et huit
  specialites generales.
- Conversation d'aide en texte libre avec formulaire accessible en alternative.
- La conversation reconnaît les questions de prochain cours ou de salle, les
  classe dans `Classe ou emploi du temps` et explique le contrôle d'identité
  avant de consulter la version réelle reçue le 25 août 2026.
- Creation d'un dossier par API avec idempotence, session d'appareil securisee et
  numero public.
- Suivi sur l'appareil et reprise par lien email; telephone en canal de secours.
- Messages aller-retour dans l'application et ajout de pieces apres creation.
- Depots signes vers une quarantaine, antivirus documente et stockage prive des
  fichiers declares sains.
- File agent paginee, filtres, assignation et verrou d'authentification.
- Routage déterministe des nouvelles demandes vers numérique, secrétariat, vie
  scolaire, intendance, direction ou qualification générale, avec motif,
  confiance, niveau d'identité requis et filtre par service dans la console.
- File agent ordonnée par priorité puis échéance enregistrée, avec une vue
  `À classer`, des compteurs sans responsable et en retard, et des marqueurs
  visibles sur chaque dossier. Aucun délai métier supplémentaire n'est inventé.
- Les liens vers l'espace agent ouvrent directement la connexion du personnel,
  conservent la page demandée et les pages administratives contrôlent maintenant
  le rôle côté interface en plus des contrôles API.
- La récupération de mot de passe par email et l'écran de remplacement sont
  programmés avec message générique, mot de passe fort et déconnexion après
  modification. La branche Supabase de preview autorise l'URL de retour exacte,
  exige 12 caractères au minimum et rejette les mots de passe compromis.
- Traitement agent avec transfert par service, notes internes invisibles pour
  l'usager, cloture motivee, reouverture et modeles de reponse a variables
  limitees.
- Premier pré-triage déterministe des ordinateurs portables : danger matériel,
  perte/vol, dommage, alimentation, réseau et logiciel. Il ne remplace pas la
  procédure locale de réparation, encore attendue.
- Trois niveaux visibles : coordonnees declarees, contact verifie, identite
  confirmee. Les demandes de codes restent bloquees sans confirmation.
- Envoi email sortant durable et enregistrement des evenements de livraison.
- Les alertes internes de nouvelle demande ou de nouveau message sont routées
  vers DDFPT, administration, vie scolaire, numérique ou direction selon le
  service affecté. Une adresse manquante revient à la boîte générale du
  superadministrateur ; aucune adresse réelle n'est conservée dans Git.
- Les rappels téléphoniques sont maintenant des tâches suivies : création dès la
  demande explicite même si un email existe, compteur et filtre dans la file
  agent, prise en charge sans collision, résultat obligatoire et événement
  audité. Un rappel ne vaut pas confirmation d'identité scolaire.
- Assistant de preview avec masquage prealable, limite de debit, `store: false`,
  repli sans IA et validation humaine.
- Politique centrale appliquee avant l'IA : transfert humain pour le danger,
  refus des donnees privees, aide pedagogique limitee a trois reponses, arret au
  troisieme essai hors mission et dix messages utilisateur maximum.
- PWA, interface responsive et absence de debordement horizontal verifiee sur les
  parcours principaux.
- La PWA vérifie explicitement les mises à jour du service worker sans réutiliser
  son cache HTTP et privilégie toujours la navigation en ligne la plus récente ;
  l'ancien écran reste uniquement le repli hors connexion.
- En-tetes HTTP de securite, API sans cache et service worker non fige.
- Audit npm des dependances de production : zero alerte connue au dernier jalon.
- Audit de la branche Supabase de preview : fonctions privilegiees corrigees,
  appels d'identite RLS optimises, index redondants retires, aucune relation de
  support sans index et aucun droit direct `anon`/`authenticated`.
- Relations croisees renforcees : un fichier ne peut pas pointer vers le message
  d'un autre dossier et un rappel ne peut pas pointer vers le contact d'un autre
  dossier.
- Limiteur atomique partage entre les instances Vercel pour l'assistant, la
  creation de demandes et les messages; seules des empreintes HMAC sont stockees.
- Une empreinte reseau n'est plus conservee dans le dossier : elle expire dans
  le limiteur distribue et sert uniquement a contenir les abus.
- Un lien de suivi email ne valide que son adresse destinataire et son usage est
  limite par reseau.
- La confirmation d'identite scolaire exige maintenant un rapprochement reel
  avec un eleve ou un professeur de la liste officielle; avant cela, une demande
  ENT ou email academique ne peut recevoir qu'une consigne de verification sure.
- La reception email est atomique : le reçu, le message, l'evenement et la mise
  en file sont valides ensemble, ce qui permet une reprise apres panne.
- Les trois migrations historiques LyceeGest ont ete recuperees depuis le
  journal Supabase et replacees dans Git, sans aucune donnee utilisateur.
- La migration `institutions` et `institution_memberships` est appliquee sur la
  branche Supabase isolee de preview. Les tables sont forcees en RLS et restent
  inaccessibles directement aux roles `anon` et `authenticated`.
- Quatre comptes fictifs ephemeres ont valide superadministrateur, DDFPT,
  administration et vie scolaire avec MFA `aal2` et adhesion persistante. Ils
  ont ensuite ete supprimes avec toutes leurs adhesions, sans envoi d'email.
- Le registre de connaissances dispose de tables privées versionnées, de sources
  datées, d'évaluations, d'un journal et d'un écran réservé au superadministrateur
  et à la direction. La publication, le retrait et le retour arrière exigent une
  session MFA `aal2`. La migration est appliquée uniquement à la base de preview
  isolée ; les six tables du registre sont vides et aucune donnée réelle n'a été
  importée.

### Concu ou partiellement branche

- Le retour email complet dans le meme fil et les pieces entrantes dependent
  encore de la configuration du domaine entrant et des tests de webhook.
- Le traitement agent, les notes internes, le transfert, la clôture motivée et
  les modèles de réponse sont terminés dans la preview ; il reste à les éprouver
  avec des comptes nominatifs et des scénarios réels contrôlés.
- Les rappels internes et les escalades automatiques ne sont pas activés : la
  direction doit d'abord valider les délais et les responsables à notifier pour
  chaque service.
- Les formations et informations utiles sont partiellement reprises; l'ancien
  site n'est pas integralement migre ni remplace.
- Les workers Brevo et antivirus sont documentes comme installes dans les specs;
  leur etat doit etre recontrole avant chaque mise en service reelle.
- Le rapport complet securite/durabilite/charge est conserve dans
  `docs/operations/SECURITY_DURABILITY_SCALE_AUDIT_2026-08-26.md`.
- L'audit externe Claude et sa contre-verification factuelle sont conserves dans
  `docs/audits/CLAUDE_AUDIT_ADJUDICATION_2026-08-26.md`.
- Le nouveau test de charge nettoyable n'a pas ete relance sur ce poste, faute
  d'URL de connexion directe a la base de preview dans l'environnement local.
- L'agent V2 possede une specification, un plan et des taches. Son registre de
  competences est persiste et administrable ; son orchestrateur consomme
  uniquement les versions publiees, actives, autorisees et encore valides.
- La matrice d'accès V2 est implémentée et testée sur objets fictifs : un contact
  vérifié ne devient jamais une identité scolaire, les relations propres ou
  parent-enfant doivent être actives, les établissements et services sont
  cloisonnés, et un administrateur ne contourne pas son périmètre de contenu.
  Les adhesions agents et leurs RLS sont branchees en preview. Le dépôt privé du
  répertoire, les tables de vérification, d'identité, de relations et d'audit
  sont maintenant appliqués sur la base de preview avec RLS forcée et droits
  publics révoqués. La lecture des lignes, l'OTP usager, le rapprochement et
  l'activation d'une version restent à construire ; aucune donnée réelle ne doit
  dépendre de la matrice fictive seule.
- La politique centrale du registre est branchée sur les tables et l'écran de
  preview : publication refusée sans propriétaire, source actuelle, revue
  indépendante lorsque requise et tests ; accès limité par établissement et
  rôle ; révocation d'une source et retour à une version publiée précédente.
  Le worker quotidien d'expiration est implémenté : il expire les sources,
  désactive les compétences dépendantes ou en retard de revue et journalise une
  action système. L'assistant public consomme maintenant uniquement les versions
  actives, publiques, publiées et valides du bon établissement, avec contexte
  borné et repli statique. Chaque version injectée est auditée après une réponse
  IA réussie sans conserver le texte ni les coordonnées. Les preuves d'identité
  I0 à I4 sont maintenant résolues à partir de preuves persistées : token, email
  confirmé, fiche scolaire liée, adhésion active et session renforcée. Le rôle
  et le service sont contrôlés séparément. Les outils pour
  données personnelles ou sensibles restent à construire.
- Le défaut où l'assistant répondait sans proposer clairement le dossier est
  corrigé localement : une demande scolaire complète passe à `offer_case`,
  affiche « Votre demande est prête » puis demande la vérification des coordonnées.
  La cause ENT reste prioritaire sur l'emploi du temps mentionné, « élève » avec
  accent est reconnu et aucun débordement n'a été observé sur PC ou téléphone.
  Un modèle IA trop prudent ne peut plus annuler l'état prêt établi par le contrôle
  déterministe du serveur.
  Le dossier fictif `BC-2026-000008` a été créé en preview et retrouvé dans le
  suivi avec son dialogue. Cette recette a révélé que le routeur serveur donnait
  encore la priorité aux mots « emploi du temps » sur un blocage ENT ; l'ordre a
  été corrigé et couvert par un test exact. La lecture dans une console agent
  authentifiée a ensuite été prouvée avec `BC-2026-000009` : routage vers le
  référent numérique, prise en charge Superadmin, réponse sécurisée visible côté
  usager, puis retour usager visible côté agent. La recette intégrée T027D est
  fermée. Elle a aussi révélé puis fait corriger deux défauts serveur : quatre
  lectures concurrentes sur une connexion unique qui expiraient après cinq
  minutes (`3edaece`) et une date de révision liée comme objet au lieu d'une
  chaîne ISO (`015e992`). Toutes les données utilisées sont fictives et aucune
  identité n'a été confirmée. Le contrôle des exécutions du worker montre zéro
  livraison fournisseur pour ce dossier réservé aux tests.
- La feuille de route détaillée des comptes, files, compétences, emplois du
  temps, contenu, charge et pilote est dans
  `002-agent-etablissement-adaptatif/execution-roadmap.md`.

### Webmail du Lycee, application separee a recontroler avant modification

- L'application est accessible sous
  `mail.lycee-blaise-cendrars-sevran.fr` et permet a la direction de diffuser des
  messages avec pieces jointes lorsque les services academiques sont perturbes.
- L'historique de ce travail comprend une collecte publique des emails
  personnels, une validation des nouveaux contacts, un classement manuel, ainsi
  que l'ajout, l'import et l'export de contacts.
- Un editeur de message enrichi, l'historique des envois et la conservation des
  pieces jointes ont ete demandes et travailles, ainsi que l'adaptation de la
  liste des contacts aux ecrans ordinateur et telephone.
- Brevo a ete configure pour l'envoi et l'adresse de contact Gmail du lycee a ete
  demandee comme expediteur visible. L'etat exact de la verification d'expediteur
  et des flux entrants doit etre controle avant un nouvel envoi reel.
- Cette memoire n'enregistre volontairement aucun code direction, identifiant,
  cle Brevo, email personnel de contact ou liste nominative.
- Le depot, le VPS et la configuration de production du Webmail doivent etre
  identifies et audites de nouveau avant toute intervention; le feu vert donne
  pour LyceeGest ne vaut pas autorisation sur cette application separee.

### Deploiement

- Preview Vercel protegee :
  `lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app`.
- Le mode `database` des adhesions et le slug de l'etablissement sont configures
  uniquement pour `codex/lycee-connect-prototype`. Le deploiement `ecebadf` les
  prend en compte ; la connexion repond et l'API agent refuse une session non
  authentifiee en HTTP 401 avec cache desactive.
- Le jalon d'accès agent `531eaa8` est publié dans la preview
  `lyceegest-36ldyhuew-safe-scol.vercel.app`. L'accueil, la connexion du
  personnel et la récupération répondent en HTTP 200 ; l'API agent refuse une
  visite non connectée en HTTP 401. La recette contrôlée est documentée dans
  `docs/operations/PILOT_RECIPE_2026-08-27.md`.
- Le jalon de routage par service `57b53be` est publié sur la branche de preview.
  GitHub a confirmé le succès du déploiement Vercel : orientation initiale,
  statut `À qualifier` pour les faibles confiances, filtre de service et nouvelle
  feuille de route V2. Il ne crée encore aucun périmètre d'accès par service ;
  cette barrière attend les comptes nominatifs et les adhésions métier.
- Le durcissement identite/reprise `74ee3e2` a ete publie sur la preview
  `lyceegest-f0lsl9bje-safe-scol.vercel.app`, puis valide par requetes reelles.
- Le site officiel Hostinger, le domaine principal, les DNS et le VPS n'ont pas
  ete modifies par le jalon de securisation `0087fc7`.
- La preview sert aux demonstrations avec des donnees fictives. Elle ne constitue
  pas encore une ouverture publique definitive.

## 5. Regles durables de securite

- Ne jamais demander ni stocker un mot de passe ENT, EduConnect, academique ou
  personnel dans une demande.
- Une preuve de controle d'email ne suffit pas pour communiquer une donnee
  scolaire ou un code d'acces.
- L'IA informe, classe et propose; l'humain valide les actions officielles ou
  sensibles.
- Secrets uniquement cote serveur; pieces privees, mises en quarantaine et
  accessibles par URL temporaire.
- Pas de liste nominative, emploi du temps, contact personnel ou code dans Git,
  les prompts, ce document ou un skill Codex.
- Comptes agents individuels et authentification renforcee avant production.
- La preview contient un ecran TOTP et une protection progressive : des qu'un
  agent enrole son telephone, les prochaines sessions doivent atteindre `aal2`
  dans l'interface, les API et les politiques RLS. L'obligation generale reste
  desactivee jusqu'a la creation d'au moins deux comptes nominatifs et au test
  de recuperation, afin de ne pas bloquer la direction.
- Validation direction/DPO, durees de conservation, sauvegarde restauree et tests
  de securite avant l'utilisation de donnees reelles a grande echelle.
- Aucune action Hostinger, DNS, VPS, import reel ou envoi de masse sans une
  autorisation explicite donnee pour cette action precise.

## 6. Travaux prioritaires deja connus

### Priorite A - Rendre le guichet exploitable en pilote reel

- Déployer le passage assistant vers demande prête, puis terminer un seul scénario
  fictif de bout en bout : création, numéro, suivi, routage et console agent.
- Corriger les alertes Supabase restantes et completer les tests RLS,
  concurrence, idempotence et reprise.
- Les alertes de sécurité techniques visées par le jalon du 26 août, y compris
  la protection des mots de passe compromis, sont fermées dans la preview. Les
  informations RLS restantes concernent les tables volontairement réservées au
  serveur et leurs droits directs restent révoqués.
- Terminer reponse agent, note interne, transfert, cloture motivee et modeles.
- Ajouter le rapprochement agent explicite avec les listes officielles, avec
  journal et controle de concurrence, avant toute remise de code.
- Terminer le domaine email entrant, les reponses email et leurs pieces dans le
  bon dossier.
- Ajouter rappels telephoniques, relances SLA, doublons, tableau de sante et file
  d'echec administrable.
- Mettre en place sauvegarde chiffree et test documente de restauration.
- Le 28 août 2026, le premier jalon d'alimentation documentaire du registre a
  été ajouté uniquement à la preview : dépôt privé TUS reprenable jusqu'à
  50 Mo, explication métier, classification et service propriétaire. Le fichier
  reste hors des connaissances actives tant que l'antivirus, l'extraction,
  l'analyse structurée et la validation humaine ne sont pas terminés.

### Priorite A bis - Clarifier les communications de rentree

- Valider le module `005-centre-communications` et la distinction entre contenu
  public, interne et cible.
- Faire du site la version officielle datee et de l'email une notification
  individuelle qui renvoie vers cette version.
- Interdire l'exposition des destinataires et rattacher les reponses a une boite
  de traitement plutot qu'a la liste collective.
- Tester d'abord avec des contacts fictifs avant toute diffusion reelle.

### Priorite B - Protection des personnes et exploitation

- Creer les comptes nominatifs manquants, enroler au moins deux responsables,
  tester le telephone perdu, puis activer l'obligation generale MFA et completer
  les habilitations par service.
- Mentions definitives, droits, conservations, purge et decision AIPD avec la
  direction et le DPO.
- Tests mobile 320 px, clavier, lecteur d'ecran, charge 200 demandes et securite.
- Notifications PWA et formulaire de collecte des contacts personnels avec
  verification et validation agent.

### Priorite C - Agent d'etablissement V2

- Nommer les responsables metier et inventorier les procedures reelles.
- Faire valider les autorités A0 à A4, les preuves I0 à I4 et les rôles attendus.
- Construire les outils contrôlés avec MFA pour les données personnelles ou
  sensibles, puis valider les responsables des sources.
- Publier progressivement `administration-scolarite`, `referent-numerique` et
  `coordination-etablissement` apres revue humaine.
- Ajouter mesures de qualite, cout, latence, transferts et corrections.
- Enregistrer puis faire valider les premières sources officielles datées pour
  que les réponses de procédure restent à jour ; aucune source réelle n'est
  encore publiée.
- Terminer l'analyse en quarantaine du répertoire, puis construire les comptes
  usagers en séparant strictement OTP de contact et rapprochement d'identité
  scolaire avec une version officielle active.
- Ajouter la compétence `cours-salles-changements`, puis le modèle de lecture
  privé et versionné des créneaux. L'agent affiche la conséquence officielle
  d'un changement, jamais une présence nominative déduite.
- Ordre métier actuel : ordinateur portable, emplois du temps privés, puis codes
  ENT lorsque l'accès administrateur du référent sera ouvert.

### Priorite D - Donnees et integrations

- Importer la liste validee des professeurs et les emplois du temps par un flux
  limite, date, revocable et non public.
- Les exports du 25 aout 2026 ont ete examines localement : 102 pages
  professeurs et 45 pages classes. Le contrat d'import protege est defini dans
  `002-agent-etablissement-adaptatif/schedule-import.md`; aucun fichier reel ni
  nom n'a ete envoye vers Git ou la preview.
- Une politique de lecture d'emploi du temps fonctionne maintenant sur donnees
  entierement fictives : identite scolaire obligatoire, perimetre classe/groupe,
  creneau valide, version active la plus recente, source non perimee, changement
  officiel, refus des contradictions et aucune reference enseignant exposee. Le
  stockage prive, les migrations RLS et l'import reel restent volontairement non
  executes.
- Inventorier la licence et les connecteurs PRONOTE/ENT disponibles avant toute
  integration; utiliser uniquement une voie officielle autorisee.
- Construire la base de connaissances validee par la direction.
- Ajouter SMS ou autre canal seulement apres validation du besoin, du consentement
  et du cout.

### Priorite E - Remplacement progressif du site

- Reprendre, corriger et faire valider toutes les rubriques, documents, liens et
  informations pratiques de l'ancien site.
- L'inventaire reproductible contient 28 contenus et 83 medias annonces, dont
  81 accessibles. Les 28 contenus sont maintenant des brouillons protégés dans
  la base isolée de preview; 78 médias sont copiés dans le stockage privé et
  trois fichiers refusés restent à remplacer ou optimiser.
- L'importeur borne les fichiers a 10 Mo pendant le flux, refuse un type recu
  different de l'inventaire, resiste aux lancements concurrents et journalise
  l'agent. Son chargement JSON est compatible avec le serveur Node de Vercel.
- La recette du 28 août a corrigé 37 liens internes mal concaténés dans neuf
  brouillons. Chaque réparation possède une nouvelle version et une entrée
  d'audit; aucun contenu repris n'est publié.
- Les 27 anciennes adresses hors accueil disposent d'une redirection testée par
  rapport à l'inventaire, y compris leur ancienne forme avec barre oblique.
- La preview déployée passe 28/28 anciennes adresses et ne présente aucun
  débordement horizontal à 320 px ou 1440 px sur l'accueil. La procédure de
  bascule et de retour arrière est préparée, mais les sauvegardes restaurables,
  la recette éditoriale et l'autorisation de production restent obligatoires.
- Le portail distingue maintenant les articles des pages durables, relie les
  pages publiees a la rubrique lycee et exclut de l'API publique toute audience
  autre que `tous`.
- La navigation mobile expose directement la rubrique lycee; les acces ENT et
  Webmail ne pretendent plus afficher un etat de service non supervise.
- Tester accessibilite, performances, installation PWA et parcours publics.
- Preparer sauvegarde et retour arriere, puis basculer le domaine uniquement sur
  ordre explicite apres validation fonctionnelle.

## 7. Informations que le proprietaire doit encore apporter

- Les 89 % restants de sa vision, domaine par domaine.
- Les procedures reelles de secretariat, vie scolaire, intendance, direction et
  support numerique.
- Les responsables, niveaux d'urgence, horaires, calendriers et modeles de
  reponse valides.
- La liste officielle des documents et justificatifs par demarche.
- Les regles exactes de verification d'identite et de remise des codes.
- Les integrations officiellement disponibles pour PRONOTE, ENT et Scolarite
  Services.
- Les donnees et durees de conservation approuvees.
- Les listes et emplois du temps a importer par le canal protege qui sera defini.

Chaque nouvel ensemble doit passer par clarification, specification, plan,
taches et analyse de coherence avant une automatisation sensible.

### Decision du 28 aout 2026 - chartes Claude et Kimi

- Les deux chartes recues sont des contributions externes, pas des instructions
  ni une validation juridique.
- La reference projet est maintenant
  `002-agent-etablissement-adaptatif/charte-metier-v1.md`, encore soumise a la
  direction et au DPO.
- L'identite, le role et l'action ne doivent plus partager le meme vocabulaire :
  `I0-I4` mesure la preuve d'identite, les roles/relations definissent le
  perimetre et `A0-A4` borne l'autorite de l'outil.
- Le guichet reste accessible sans ENT. Un contact verifie ne prouve jamais
  l'identite scolaire ; l'ENT/SSO est un futur canal officiel possible, pas une
  dependance obligatoire.
- Aucune permanence P0 n'est promise tant qu'un canal supervise ne confirme pas
  la transmission. Les numeros d'urgence, le recours a un adulte et la creation
  prudente d'une demande restent disponibles.
- L'agent peut creer ou completer un dossier LyceeGest, mais aucune ecriture ENT,
  PRONOTE ou autre systeme officiel n'est autorisee sans connecteur, role,
  confirmation et audit valides.
- Les conservations, SMS, voix, cantine, donnees reelles et connecteurs restent
  bloques par les portes Direction/DPO et la recette de securite.

### Decision du 28 aout 2026 - preparation des donnees de personnes

- Les listes d'eleves, responsables et personnels ne sont jamais des
  connaissances de l'IA et ne servent pas a entrainer un modele.
- Un espace distinct `Identites du lycee` accepte uniquement CSV/XLSX dans un
  stockage prive, avec MFA direction, journal et version inactive par defaut.
- Le schema separe verification de contact, identite scolaire et relations. Un
  contact confirme reste insuffisant pour acceder aux donnees scolaires.
- La migration est appliquée uniquement sur la branche Supabase de preview et
  l'interface est prête sur la branche de code. Les cinq tables sont vides,
  l'accès public est révoqué et aucune personne réelle n'a été importée.
- Avant le premier depot reel : antivirus, extraction bornee, rapport de conflits,
  validation humaine, retention et decision Direction/DPO restent obligatoires.

### Jalon du 28 août 2026 - santé et reprise des communications

- Un écran direction protégé par MFA rassemble les succès du worker, alertes de
  livraison, webhooks refusés, fichiers encore en quarantaine et échecs définitifs.
- La relance manuelle est réservée aux types d'envoi connus, atomique et auditée.
  Elle ne réutilise jamais l'ancien lien magique : un nouveau jeton de trente
  minutes est créé côté serveur lorsque le demandeur doit être recontacté.
- Les coordonnées et jetons ne sont jamais renvoyés par l'API de supervision.
  Les tests de panne fournisseur et de rejeu sur une base de recette restent à
  exécuter avant de considérer le retour email complètement opérationnel.

### Jalon du 29 août 2026 - consultation contrôlée des identités

- La recherche V1 est réservée à la direction et à la superadministration avec
  MFA `aal2`, motif structuré et justification de 20 à 500 caractères.
- Seules les recherches exactes par email académique, email personnel,
  téléphone ou référence opaque sont autorisées. La recherche par nom,
  l'export et l'accès de l'agent IA sont interdits.
- La requête est chiffrée pour le worker avec RSA-OAEP et AES-256-GCM. Le
  résultat minimal est chiffré avec une clé éphémère conservée dans un reçu de
  cinq minutes lié au compte, à l'établissement et à la requête.
- La table et la file privées sont appliquées uniquement à la branche Supabase
  de preview, vides, avec RLS forcée et sans droit client. Une charge de requête
  disparaît au traitement et le résultat disparaît à l'expiration.
- Le worker et les secrets ne sont pas activés : l'écran l'indique et refuse la
  recherche. Toute intervention VPS ou donnée réelle nécessite une autorisation
  distincte et une recette entièrement fictive.

### Jalon du 29 août 2026 - connaissances autorisées de l'agent

- Une source, un document, un extrait, une compétence et une évaluation tous
  fictifs ont été publiés temporairement sur la branche Supabase de preview.
- L'API Vercel protégée a sélectionné cette connaissance et produit une réponse
  IA sur une demande ENT fictive. Deux audits `consult_public` ont conservé
  uniquement les références opaques, le hash de session, le modèle et le tour.
- La contrainte SQL accepte désormais cet événement via la migration
  `20260829103209`. Aucun message, extrait, contact, URI ou checksum n'entre dans
  l'audit d'usage.
- La recette a supprimé ses sources, documents, extraits, compétences, versions,
  évaluations, liens et audits. Le contrôle final a confirmé un retour à zéro.

### Jalon du 29 août 2026 - coffre des emplois du temps

- Le bucket privé `schedule-ingest` accepte uniquement les PDF de 50 Mo maximum.
  Aucun droit direct n'est accordé à `anon` ou `authenticated`.
- Trois tables serveur versionnent les PDF classes/professeurs, indexent les
  pages par référence opaque et journalisent les actions sans nom de personne.
- L'écran direction `/admin/emplois-du-temps` exige une session agent sous MFA,
  réserve un transfert signé et vérifie la taille et le type exacts reçus.
- Un PDF confirmé reste `uploaded` avec antivirus, indexation et activation
  bloqués. L'interface ne propose pas d'activation prématurée.
- Les migrations `20260829105141`, `20260829105238` et `20260829105632` sont appliquées uniquement
  à la preview. Les tables sont vides. Une recette fictive transactionnelle a
  vérifié l'index de page, l'unicité de la version active et le retour à zéro.
- Les deux PDF réels restent sur le poste jusqu'au worker antivirus, au
  rapprochement humain, aux liens temporaires audités et à la conservation.

### Jalon du 29 août 2026 - file antivirus des emplois du temps

- La preview possède la file privée `schedule_document_scan`. RLS est activée et
  forcée sur la file et son archive ; `anon` et `authenticated` n'ont aucun droit.
- La confirmation d'un PDF le place en quarantaine et envoie le travail dans la
  même transaction. Une reprise d'un ancien état `uploaded` est prévue.
- Le worker versionné lance ClamAV avant toute lecture, vérifie la signature et
  la structure PDF, calcule SHA-256 et compte de 1 à 500 pages. Il n'extrait ni
  nom, ni horaire, ni salle, ni texte et ne contacte aucun modèle d'IA.
- Les fichiers infectés ou structurellement invalides doivent être supprimés du
  stockage avant l'état `rejected`. Un échec de suppression interdit de prétendre
  que l'objet a disparu et provoque une reprise bornée.
- La recette de file fictive est revenue à zéro. Les tests ciblés et le build
  passent. Le worker est préparé mais non installé : aucune action VPS, aucun PDF
  réel et aucune production n'ont été touchés.

### Jalon du 29 août 2026 - rapprochement humain des pages

- L'écran direction des emplois du temps propose un index vertical responsive :
  choix d'une version contrôlée, ouverture privée du PDF pendant 60 secondes,
  référence opaque par page, brouillon puis vérification explicite.
- Les API exigent direction et MFA pour lire, enregistrer, vérifier ou ouvrir le
  PDF. L'ouverture est auditée, non mise en cache et ne produit jamais d'URL
  publique permanente.
- La référence classe/personnel est dérivée du type de source et non choisie par
  le navigateur. Aucune colonne de nom, email, téléphone, horaire ou salle n'est
  ajoutée à l'index.
- La migration `20260829113248` empêche en base les pages hors limites, les
  périmètres incompatibles et les modifications hors état `review`.
- Une recette fictive transactionnelle a vérifié ces trois refus puis le retour
  à zéro. Les tests du contrat, des API et le build passent. L'approbation,
  l'activation, le lien agent limité à une page et la conservation restent à
  construire ; aucun PDF réel n'a été téléversé.

### Jalon du 29 août 2026 - promotion réversible des emplois du temps

- Les actions direction `Approuver`, `Activer` et `Restaurer` exigent MFA,
  justification et confirmation explicite pour les deux actions de mise en
  service. Chaque opération est auditée sans contenu du PDF.
- La migration preview `20260829114151` interdit directement dans PostgreSQL
  l'approbation d'un document non contrôlé ou d'un index incomplet, le saut de
  `review` vers `active` et la coexistence de deux versions actives.
- La migration `20260829114935` refuse explicitement les clés de validation JSON
  absentes, sans dépendre de la sémantique `NULL` de PostgreSQL. Une seconde
  recette a vérifié le refus des clés absentes et l'acceptation des preuves
  complètes, puis a été annulée.
- Les mutations de page et de version partagent des verrous transactionnels.
  L'activation et la restauration verrouillent d'abord le périmètre
  établissement-type-année afin d'éviter les promotions concurrentes.
- La recette fictive a validé six scénarios : approbation complète, refus de
  l'activation directe, refus d'un index incomplet, restauration, audit de la
  restauration et refus d'une seconde version active. La transaction a été
  annulée et les trois tables sont revenues à zéro ligne.
- Le flux est prêt dans la preview mais ne justifie encore aucun import réel :
  l'installation et la recette du worker, le lien agent limité à une page et la
  conservation restent bloquants.

### Jalon du 29 août 2026 - contrat d'orchestration public

- L'ordre serveur est maintenant documenté et couvert : règles déterministes,
  pré-triage ordinateur, registre publié autorisé, modèle sans outil, schéma
  strict puis prochaine action calculée par le serveur.
- Une règle déterministe ou un pré-triage concluant arrête le traitement avant
  toute lecture du registre et tout appel au modèle.
- Une sortie IA incomplète, contradictoire, peu fiable ou prétendant avoir
  réinitialisé, envoyé, transmis ou exécuté une action indisponible est rejetée
  au profit du repli local. Elle ne produit ni référence publique ni journal
  d'usage fictif.
- Ce jalon ne ferme pas la future preuve d'outil T028 : aucune action sensible,
  aucun connecteur ENT/PRONOTE et aucun `confirmed_at` n'ont été activés.

### Jalon du 30 août 2026 - autorisation des futurs outils

- Le contrat central des outils exige une compétence publiée, une liste blanche
  exacte et un schéma d'entrée fermé avant toute exécution.
- Établissement, identité `I0-I4`, rôle, service, relation et MFA sont contrôlés
  séparément. `A4` est refusé sans exception, même pour un superadministrateur.
- Une action `A3` attend une approbation indépendante, non expirée, non consommée
  et liée à l'action, à l'outil et à l'empreinte de l'entrée afin d'empêcher le
  rejeu d'une décision.
- Une réussite future nécessite un résultat correspondant, l'état `succeeded`,
  une date `confirmed_at` cohérente et une référence opaque. La persistance et
  l'affichage restent ouverts dans T018/T028.
- Aucun outil, connecteur, compte, donnée réelle ou environnement de production
  n'a été activé par ce jalon.

### Jalon du 30 août 2026 - persistance A3 anti-rejeu

- Les tables privées `agent_actions`, `agent_approvals` et
  `agent_action_audit` sont appliquées seulement à la branche Supabase de
  preview. Elles sont vides après recette, sous RLS activée et forcée, sans droit
  direct pour `anon` ou `authenticated`.
- L'entrée structurée est assainie puis son empreinte SHA-256 est recalculée côté
  serveur. Une substitution après validation est refusée. `A4` est interdit par
  la politique et par les valeurs acceptées en base.
- Une validation `A3` est liée à l'établissement, l'action, l'outil, l'empreinte
  et au demandeur nominatif. L'approbateur doit être distinct et posséder le rôle
  attendu ; la validation doit être courante et non consommée.
- La fonction `agent_consume_approval` verrouille les lignes dans un ordre fixe,
  consomme la validation puis démarre l'action dans la même transaction. Le rôle
  serveur ne peut supprimer ni action, ni validation, ni audit.
- Une recette entièrement fictive a produit cinq événements, refusé un rejeu,
  puis annulé toutes les écritures. Aucun outil, document réel, production ou
  connecteur officiel n'a été touché.
- T018 est désormais fermée par la boîte de validation ci-dessous. T028 reste
  ouverte pour un adaptateur réel autorisé et l'affichage après preuve.

### Jalon du 30 août 2026 - boîte de validation A3

- L'espace agent possède la route `/admin/validations-agent`, accessible aux
  rôles agents prévus sous MFA et adhésion active persistée.
- Chaque action porte désormais un `service_code` obligatoire et immuable. Un
  valideur ne voit que ses services, sauf direction et superadministration ; sa
  décision exige exactement le rôle attendu et un compte distinct du demandeur.
- `agent_decide_approval` verrouille l'action puis la validation dans une seule
  transaction. Une approbation attend encore la consommation par l'adaptateur ;
  un refus motivé ou une expiration ferme l'action et écrit l'audit.
- `agent_expire_approvals` est appelé avant la lecture de la boîte. Il ferme sous
  verrous les validations périmées du seul établissement et des seuls services
  autorisés, refuse l'action associée et attribue l'audit au système.
- Une approbation déjà accordée peut devenir expirée uniquement si elle n'a pas
  été consommée et si son échéance est atteinte. Ce correctif a été vérifié dans
  la définition SQL installée ; la recette d'expiration en attente a contrôlé
  l'action refusée et l'audit système avant `ROLLBACK` à zéro.
- L'API transforme l'entrée masquée en quelques libellés autorisés. Elle ne
  renvoie ni entrée brute, ni identifiants agents, ni clé technique de l'outil.
- Une recette fictive a validé approbation, refus, mauvais service,
  auto-validation et immutabilité, puis annulé toutes les écritures. `anon` et
  `authenticated` ne peuvent pas exécuter la fonction ; `service_role` seul le
  peut depuis les routes serveur.
- Aucun outil, connecteur, notification, donnée réelle ou environnement de
  production n'a été activé. T028 reste ouverte jusqu'à un adaptateur autorisé et
  une confirmation externe persistée.
- Les deux migrations du lot sont appliquées uniquement à la preview vide. Les
  57 tests ciblés, le build et l'audit npm passent ; le conseiller Supabase ne
  remonte que les avis informatifs attendus des tables privées sans politique
  client et des index encore inutilisés.

### Jalon du 30 août 2026 - mesures techniques de l'agent

- L'assistant public journalise désormais une seule issue technique par passage :
  réponse locale, pré-triage, indisponibilité, sortie invalide, repli de sécurité
  ou réponse IA retenue par les règles. Le journal n'enregistre aucun texte, identité, contact,
  session, pièce jointe, catégorie métier ou erreur brute.
- Les jetons proviennent uniquement du reçu du fournisseur. Le coût est calculé
  en micro-euros seulement si les variables
  `OPENAI_SUPPORT_INPUT_EUR_PER_MILLION_TOKENS` et
  `OPENAI_SUPPORT_OUTPUT_EUR_PER_MILLION_TOKENS` sont toutes les deux définies ;
  aucun tarif instable n'est codé en dur et l'interface parle d'estimation.
- L'écran existant `/admin/sante-demandes` affiche des agrégats sur 7 ou 30
  jours. L'API exige MFA, adhésion persistée, vue globale et rôle direction ou
  superadministration. Aucun enregistrement individuel n'est renvoyé.
- Les migrations `20260830013502` et `20260830014140` sont installées seulement
  sur `guichet-lycee-preview`. Une recette a vérifié l'insertion fictive,
  l'immutabilité et les privilèges, puis `ROLLBACK`; la table reste vide.
- Le contrôle dynamique a révélé puis corrigé les privilèges `UPDATE/DELETE`
  hérités par défaut par `service_role`. Il ne conserve que `SELECT/INSERT`.
  T030 reste ouverte pour la mesure des transferts et corrections humaines.
- Le complément T030B réutilise ensuite les événements `request.updated` déjà
  immuables. Il compte tout changement d'affectation et qualifie de correction
  de routage uniquement le passage d'un service non vide à un autre service non
  vide. Les agrégats ne lisent ni motif, contenu, identité ou identifiant de
  dossier. T030 est désormais fermé.
- Avant T015B1, le calcul des réorientations vérifiait qu'un seul établissement
  était actif ou en pilote. Il filtre désormais l'établissement porté par
  chaque demande. La recette fictive a obtenu deux changements, une
  réorientation puis zéro dossier et événement après `ROLLBACK`.
- T030C corrige la sémantique de l'écran : `model_success` signifie seulement
  que la sortie structurée a franchi les contrôles techniques. Le tableau ne la
  présente plus comme une validation humaine et le rappelle explicitement.
- L'audit externe Claude de ce lot n'a pas été exécuté sans fiche
  d'autorisation courante précisant modèle, périmètre et limite. Le dossier
  d'audit est prêt ; les vérifications Codex, Supabase et tests automatisés ont
  été exécutées sans prétendre remplacer cette revue indépendante.

### Jalon du 30 août 2026 - demandes cloisonnées par établissement

- Chaque `support_request` possède désormais un `institution_id` obligatoire,
  référencé et immuable. Les onze dossiers déjà présents dans la branche de
  preview ont été rattachés au seul établissement actif sans lire leur contenu.
- Création, détection de doublon, sessions, liens de suivi, file agent, détail,
  réponse, note, traduction, rappel, pièce jointe, métriques et reprise d'échec
  filtrent l'établissement du contexte serveur.
- Les clés d'idempotence des demandes sont uniques par établissement et celles
  des messages par dossier. Une empreinte identique dans deux périmètres fictifs
  est acceptée ; sa répétition dans le même périmètre est refusée.
- Les tâches email transportent l'établissement et le worker vérifie la
  correspondance avec le dossier. À ce jalon, webhook, worker et santé
  échouaient encore fermés dès que plusieurs établissements actifs partageaient
  les tables techniques sans `institution_id`; T015B2 a ensuite levé ce verrou
  pour les webhooks et la santé, mais pas encore pour la file email partagée.
- La migration `20260830020355` est appliquée seulement à
  `guichet-lycee-preview`. RLS est forcée, `anon` et `authenticated` ne lisent
  pas les dossiers. Une recette a refusé le déplacement d'un dossier vers un
  autre établissement, vérifié les idempotences composites puis exécuté
  `ROLLBACK` avec zéro résidu synthétique et zéro dossier sans établissement.
- Les tests ciblés et le build passent. L'audit Claude reste non exécuté sans
  modèle et plafond de consommation explicitement autorisés pour cette mission.

### Jalon du 30 août 2026 - journaux techniques cloisonnés

- `support_job_runs`, `support_failed_jobs`, `support_delivery_events` et
  `support_webhook_receipts` portent désormais un `institution_id` obligatoire,
  référencé et immuable sur la branche de preview uniquement.
- Les jobs et échecs ne peuvent référencer qu'une demande du même établissement.
  Les événements de livraison sont contrôlés contre le message et sa demande.
  Les idempotences techniques sont propres à l'établissement.
- Le worker écrit ce périmètre dans ses journaux et échecs. Les webhooks entrant
  et de livraison résolvent l'établissement configuré ; la santé filtre les
  reçus sans verrou global. Le worker antivirus refuse une tâche sans
  établissement et contrôle le dossier, le message et la pièce avant de lire le
  stockage ou Brevo. Seule la file email PGMQ partagée conserve le verrou
  mono-établissement pour éviter qu'un worker ne réclame la tâche d'un autre.
- Les 28 exécutions présentes ont été rattachées par leur dossier ; aucun échec,
  événement ou reçu n'était présent. Toutes les tables ont zéro ligne sans
  établissement, RLS forcée et aucun droit direct `anon` ou `authenticated`.
  La file antivirus de preview ne contenait aucune ancienne tâche à convertir.
- Une transaction fictive a refusé rejeu local, changement d'établissement et
  liens croisés, puis `ROLLBACK` avec zéro résidu. Les conseillers ne signalent
  aucun défaut de sécurité bloquant ni clé étrangère sans index couvrant.
- Le dossier d'audit Claude est préparé mais non exécuté sans modèle et plafond
  de consommation explicitement autorisés.

### Jalon du 30 août 2026 - résilience locale Brevo

- Le test `test:support-resilience` simule le succès Brevo, sa réponse de doublon
  et une indisponibilité 503, sans réseau et uniquement avec des adresses
  réservées. La clé d'idempotence est contrôlée dans la requête simulée.
- Le même test verrouille l'ordre atomique : reçu, message, événement, tâche de
  notification, puis seulement statut `processed`. Un échec avant cinq lectures
  reste reprenable ; la cinquième archive le job dans la file d'échec.
- Une transaction sur la preview a rejoué dix fois le même webhook fictif et a
  obtenu exactement un reçu et un message. Une panne simulée après réservation
  n'a laissé aucun reçu orphelin. Le `ROLLBACK` final laisse zéro reçu et zéro
  message de recette.
- T026 reste ouverte uniquement pour T026B : couper puis rétablir le vrai service
  Brevo après configuration autorisée du domaine entrant. Aucun email réel,
  secret, domaine, production ou VPS n'a été touché dans ce jalon.
- Le dossier d'audit Claude est préparé mais non exécuté sans modèle et plafond
  de consommation explicitement autorisés.

### Jalon du 30 août 2026 - garde-fous du test de charge

- `load-test-support.mjs` est compatible avec l'établissement obligatoire : la
  création, le payload PGMQ, les comptages et le nettoyage sont tous cloisonnés.
- Trois paramètres sont obligatoires avant connexion : confirmation
  `preview-only`, référence exacte du projet et slug d'établissement actif ou en
  pilote. Une file unique par exécution et un préfixe aléatoire bornent toujours
  le nettoyage aux données synthétiques du passage.
- Le test de garde-fous et la syntaxe passent. La tentative réelle des 200
  créations a été stoppée avant connexion, car le `DATABASE_URL` local est un
  placeholder et ne contient pas la référence de preview attendue. Aucun secret
  n'a été affiché et aucun contrôle n'a été contourné.
- La preuve historique des 200 créations reste documentée, mais T012A exige un
  nouveau passage après T015B1 dès qu'une connexion Postgres preview utilisable
  est fournie de façon sûre.

### Jalon du 30 août 2026 - indicateurs de résolution agrégés

- L'espace opérations de la direction mesure désormais l'activité des 30 derniers
  jours : reçues, résolues, taux, stock encore ouvert, délai moyen, p90 et cinq
  catégories fermées les plus fréquentes.
- L'API exige le rôle opérations direction avec MFA et filtre toutes les requêtes
  par l'établissement persistant de l'agent. Les agrégats ne renvoient ni nom,
  ni coordonnées, ni sujet, ni texte libre, ni référence de dossier.
- Une lecture agrégée de la preview a confirmé 11 demandes créées, zéro résolue et
  11 ouvertes. Aucun contenu de demande n'a été lu. Le cas sans résolution est
  présenté comme `Aucune résolution`, sans fabriquer de délai nul.
- Le build et les tests ciblés de métriques, opérations, cloisonnement technique
  et frontières adversariales passent. La revue Claude est préparée mais non
  exécutée sans modèle et plafond de consommation explicitement autorisés.

### Jalon du 30 août 2026 - créneaux d'emploi du temps privés

- La preview possède `schedule_slots`, reliée par clé composite à une version et
  à son établissement. Un créneau contient seulement des références opaques,
  une matière, une salle, des horaires, une confiance de parsing et l'état de
  revue humaine. Les dates de fin de validité et de fraîcheur complètent la source.
- RLS est activée et forcée. `anon` et `authenticated` n'ont aucun droit direct ;
  seul le serveur peut lire ou écrire. L'établissement et la version sont
  immuables, puis tout le créneau est figé lorsque la source devient active.
- Le lecteur serveur accepte au maximum 40 références opaques par périmètre,
  filtre les versions actives et les créneaux approuvés de l'établissement, et
  retourne uniquement le prochain cours autorisé avec une source datée. Il ne
  renvoie jamais la référence du professeur.
- Une transaction fictive a prouvé le refus d'un croisement d'établissement,
  d'un doublon et d'une modification après activation. Le `ROLLBACK` laisse zéro source, zéro
  établissement et zéro créneau de recette. L'auditeur ne signale plus de clé
  étrangère sans index ; les seules remarques propres à la table sont attendues
  pour une table serveur vide et sans politique client.
- L'adaptateur n'est pas encore exposé à l'agent : T042D2 doit résoudre le
  périmètre depuis une identité scolaire confirmée avant son premier appel.
- La revue Claude est préparée mais non exécutée sans modèle et plafond de
  consommation explicitement autorisés.

### Jalon du 30 août 2026 - identité vers périmètre d'emploi du temps

- Le serveur peut désormais résoudre le périmètre d'une identité scolaire
  confirmée sans faire confiance à la conversation ou aux métadonnées du compte.
- L'identité doit être non révoquée et provenir d'un annuaire actif. Les lignes
  de personne et d'appartenance doivent être `valid`, actives à la date courante
  et appartenir au même établissement.
- Une personne consulte sa propre classe et ses groupes. Un personnel ne reçoit
  que sa propre référence opaque. Une cible différente exige une relation
  persistée `guardian_of`, active, datée et issue d'un annuaire encore actif.
- Le résolveur appelle ensuite le lecteur privé. L'assistant l'utilise désormais
  uniquement pour une formulation explicitement personnelle comme « mon prochain
  cours » ; aucune cible tierce n'est transmise depuis la conversation.
- Une réponse positive contient seulement matière, horaire, salle, état utile,
  source et fraîcheur. Identité absente, source périmée, conflit ou panne
  produisent un refus sûr sans appel au modèle et proposent un dossier suivi.
- La recette transactionnelle de preview a créé trois utilisateurs Auth fictifs,
  deux identités élève, une identité responsable, un lien `guardian_of`, deux
  classes, un groupe et deux cours. Elle a prouvé que l'élève A voit exactement
  son cours de groupe, ne voit pas la classe B et que le responsable n'est lié
  qu'à l'élève A. Le `ROLLBACK` a laissé zéro utilisateur, établissement, identité,
  source et créneau de recette. T042D2 est fermé.
- La sélection multi-enfants reste ouverte dans T042D2D : le navigateur ne devra
  jamais choisir ni recevoir une référence scolaire brute. Le libellé minimal
  visible doit être validé par le lycée avant cette interface.

### Jalon du 30 août 2026 - preuve de création du dossier public

- Le formulaire ne fabrique plus un numéro d'exemple lorsque l'API est désactivée.
  Dans ce cas, il affiche une indisponibilité claire sans annoncer de réussite.
- Après la transaction, l'API construit une confirmation avec le numéro public,
  une date issue du serveur et une référence strictement liée au numéro.
- Le navigateur vérifie cette preuve avant de déposer les pièces jointes, de
  mémoriser le dossier sur l'appareil et d'afficher le succès. Une preuve absente,
  discordante ou invalide ferme le parcours en échec.
- Ce lot ferme T028A mais pas T028 : un véritable adaptateur d'action de l'agent
  devra encore persister et relire `agent_actions.confirmed_at`.
- La revue Claude est préparée mais non exécutée tant que le modèle exact et le
  plafond de consommation ne sont pas autorisés.

### Jalon du 30 août 2026 - garde-fous du centre de communications

- Le premier contrat de `005` est purement technique et fermé par défaut. Il
  n'active aucun écran, groupe, contact, publication ou envoi.
- Une communication entre comme brouillon interne. Les seules sources reconnues
  sont texte direct, PDF, DOCX, image et email transféré, avec empreinte SHA-256.
- Les audiences sont des références opaques bornées ; toute chaîne ressemblant
  à une adresse email est refusée. Une visibilité ciblée et une notification
  exigent un groupe explicite.
- Seule une communication explicitement publique peut demander une publication
  sur le site. L'expiration doit suivre la publication ou l'heure serveur.
- `COMMUNICATIONS_ENABLED`, `COMMUNICATION_PUBLICATION_ENABLED` et
  `COMMUNICATION_SEND_ENABLED` restent absentes et donc fausses sur la preview.
  L'envoi et la publication ne peuvent jamais s'activer seuls.

### Jalon du 30 août 2026 - fondation privée des communications

- Huit tables additives sont appliquées uniquement sur la branche Supabase de
  preview : réglages, communications, versions, audiences, livraisons, travaux,
  entrants et événements.
- RLS est forcée et `anon`/`authenticated` n'ont aucun droit direct. L'auditeur
  ne remonte aucun avertissement de sécurité du module au-dessus de `INFO` et
  aucune clé étrangère `communication*` non indexée.
- Les adresses ne sont jamais stockées : seuls des groupes et contacts opaques
  bornés sont admis. Les enfants sont liés à la communication et à sa version
  dans le même établissement par clés composites.
- La base bloque elle-même publication, envoi et progression de livraison quand
  les interrupteurs sont coupés. Une livraison ou un travail opérationnel exige
  une communication et une version déjà validées.
- Les versions sont immuables après validation, les audiences après validation
  et les identités techniques des livraisons/travaux après insertion. L'audit
  est append-only.
- La recette fictive distante a vérifié les refus de fuite, croisement, doublon,
  contournement et mutation, puis a laissé zéro résidu. Aucun groupe, contact,
  contenu, envoi ou paramètre réel n'a été activé.
- La revue Claude est préparée mais non exécutée sans modèle exact et plafond de
  consommation explicitement autorisés.

### Jalon du 30 août 2026 - API de brouillon manuel des communications

- La première route administrative accepte uniquement une saisie directe ; les
  fichiers et emails transférés restent fermés jusqu'à leurs pipelines dédiés.
- L'accès exige l'authentification agent existante, le périmètre persistant de
  l'établissement, un rôle éditeur limité, puis l'interrupteur environnement et
  l'interrupteur base. La preview reste donc inaccessible tant qu'ils sont faux.
- Le navigateur ne fournit aucune empreinte. Le serveur normalise les champs,
  refuse secrets et propriétés inconnues, puis calcule séparément l'empreinte de
  source et celle de la version.
- Racine interne, version 1 et événement minimal sont écrits dans une transaction.
  La contrainte source et `ON CONFLICT` rendent une création concurrente
  idempotente sans dupliquer le brouillon.
- Aucun écran, groupe, contact, publication ou envoi n'est activé par ce lot.

### Jalon du 30 août 2026 - interface fermée des communications

- La route administrative et son entrée de navigation sont codées, mais le
  menu n'apparaît que si `VITE_COMMUNICATIONS_ENABLED` vaut exactement `true`.
  La valeur documentée reste `false` et aucun réglage Vercel n'est changé.
- L'écran est utilisable en pile à 320 px et en deux colonnes sur ordinateur.
  Il permet seulement de lister et déposer un texte comme brouillon interne.
- Les étapes `Vérifier` et `Publier et informer` restent explicitement
  verrouillées. Aucun champ destinataire, groupe ou contact n'est présent.
- L'interface ne peut pas ouvrir seule le module : l'API exige encore son
  interrupteur serveur puis celui de l'établissement en base.

### Jalon du 30 août 2026 - modèles de communication

- Les six modèles prévus sont fournis par un catalogue de code déterministe :
  Hebdo, Urgent, Rentrée, Document, Événement et Rappel.
- Une personnalisation est privée, cloisonnée par établissement, versionnée et
  auditée. L'absence de personnalisation conserve le modèle sûr du catalogue.
- L'administration peut lire les modèles ; seuls superadmin et proviseur
  peuvent les modifier, avec l'authentification renforcée déjà imposée.
- Aucun modèle ne contient de destinataire. Son API ne publie, ne cible et
  n'envoie rien, et reste derrière les deux interrupteurs du module.
- L'écran fermé permet de préremplir un brouillon depuis un modèle actif. La
  direction peut modifier les six modèles sans changer leur clé ni ouvrir une
  action officielle.
- La migration est appliquée uniquement sur la preview. La recette fictive a
  refusé cinq contournements puis laissé quatre compteurs de résidus à zéro ;
  les auditeurs Supabase ne remontent aucun `WARN` ou `ERROR` sur ces tables.

### Jalon du 30 août 2026 - extraction locale des sources de communication

- L'adaptateur de communication accepte uniquement PDF et DOCX et réutilise le
  moteur local éprouvé PDF.js/Mammoth avec précontrôle des archives bureautiques.
- Le texte rendu est limité à 100 000 caractères. Toute coordonnée, tout secret
  ou toute instruction suspecte supprime le texte extrait du résultat et impose
  une relecture humaine.
- Aucun contenu n'est transmis à une IA externe. La réservation de fichier,
  l'antivirus, la file et la persistance restent volontairement ouverts dans
  T011 avant de rendre le dépôt documentaire utilisable.

### Jalon du 30 août 2026 - dépôt privé des sources de communication

- La branche Supabase de preview possède maintenant deux tables privées, un
  bucket non public et la file PGMQ `communication_document_scan`. Aucun rôle
  client ne peut lire les tables, le stockage ou la file.
- L'API administrative réserve un dépôt signé PDF/DOCX de 10 Mo maximum. Elle
  exige le rôle éditeur, l'établissement persistant et les deux interrupteurs
  fermés par défaut ; elle contrôle ensuite taille et type exacts avant la mise
  en quarantaine.
- La liste administrative ne renvoie jamais le chemin privé, l'empreinte ni le
  texte extrait. L'audit lie strictement acteur humain ou système et chaque
  source à son établissement.
- Un worker local est préparé pour ClamAV, l'extraction bornée, le refus des
  menaces et doublons, puis l'état `review`. Il ne peut ni relier la source à une
  communication, ni publier, ni envoyer. Il n'est pas déployé et aucun VPS n'a
  été modifié.
- Une recette fictive a tenté dix contournements de cycle, d'identité, de
  cloisonnement et d'audit. Tous ont été refusés ; le `ROLLBACK` a laissé zéro
  utilisateur, établissement, source, événement et travail de test.
- T011 reste ouvert jusqu'à une preuve antivirus de bout en bout sur un moteur
  explicitement autorisé.
- La revue Claude est préparée mais non exécutée : une mission courante doit
  encore préciser le modèle, le périmètre et la limite de consommation.

### Jalon du 30 août 2026 - interface du dépôt documentaire

- L'écran Communications sait réserver un dépôt PDF/DOCX signé, transférer le
  fichier directement vers le bucket privé, confirmer sa réception et afficher
  seulement le nom, la taille, l'état et l'erreur d'analyse bornée.
- Le navigateur reçoit seulement une coordonnée de dépôt signée, aléatoire et
  sans identifiant de personne ou d'établissement. Les listes n'exposent jamais
  le chemin persistant, l'empreinte ou le texte extrait. La disposition reste en
  pile sur mobile et en ligne sur les écrans plus larges, sans largeur minimale
  qui force un défilement horizontal.
- Deux interrupteurs supplémentaires échouent fermés :
  `COMMUNICATION_DOCUMENT_UPLOAD_ENABLED` côté serveur et
  `VITE_COMMUNICATION_DOCUMENTS_ENABLED` côté interface. Aucun réglage distant
  n'a été ajouté ; le dépôt reste donc indisponible dans la preview publiée.
- La commande `npm run test:communications` regroupe désormais les 65 tests du
  centre. Elle passe, comme les builds avec tous les écrans fermés puis activés
  artificiellement et l'audit npm à zéro vulnérabilité de production.
- T011D1 est terminé. T011D et T011 restent ouverts jusqu'à une recette fictive
  complète sur un moteur ClamAV explicitement autorisé.

### Jalon du 30 août 2026 - assistance structurée et relecture humaine

- L'aide à la rédaction propose seulement de structurer, corriger ou simplifier
  un brouillon direct. Le texte est borné, expurgé, traité avec `store: false`
  et la sortie suit un schéma strict : message, faits, questions et notes.
- Les secrets, champs inconnus et signaux d'injection sont refusés avant appel.
  La proposition ne persiste rien et ne contient ni audience, ni validation, ni
  publication, ni envoi. Un agent humain garde la main sur chaque changement.
- Une correction enregistrée crée une nouvelle version privée au lieu d'écraser
  la précédente. Une communication avec une question ouverte ne peut pas entrer
  en relecture ; le passage exige la confirmation explicite `VERIFIER`.
- Les déclencheurs SQL de preview imposent une séquence de versions continue,
  interdisent les versions détachées et leur suppression, vérifient la cohérence
  différée entre racine et version courante, et figent le contenu dès la
  relecture. Onze tentatives fictives de contournement ont été refusées, puis le
  `ROLLBACK` a laissé quatre compteurs à zéro.
- Soixante-cinq tests du centre, les builds avec module fermé et activé et
  les deux audits npm passent. Les auditeurs Supabase ne signalent aucun
  `WARN` ou `ERROR` lié aux communications après retrait d'un index dupliqué.
- T010C et T012 sont terminées. T010 reste ouvert jusqu'à la publication
  validée ; T011 reste ouvert jusqu'à la preuve antivirus de bout en bout.
- Le brief Claude de ce lot est préparé mais non exécuté, faute de modèle exact
  et de plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - gestion des communications sous volume

- La liste privée se recherche localement par titre, résumé, catégorie ou état
  et se filtre par cycle. Le corps des messages n'est ni chargé pour la liste,
  ni inclus dans l'index de recherche, ni transmis à un service externe.
- Le détail affiche jusqu'à cent métadonnées de versions, de la plus récente à
  la plus ancienne, sans empreinte ni contenu historique. Le message complet
  reste limité à la seule version courante demandée par un agent autorisé.
- Les contrôles s'empilent à 320 px et utilisent des libellés accessibles. Un
  filtre vide affiche un état sans résultat sans modifier la sélection ni les
  données en base.
- T010D est terminé. La commande agrégée compte désormais 65 tests réussis et
  le build avec communications et documents activés artificiellement passe.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - panne et annulation des travaux de communication

- Une politique locale distingue codes temporaires et permanents sans accepter
  de message fournisseur. Les reprises suivent 1, 5, 15, 60 puis 360 minutes et
  une erreur définitive ou un plafond atteint ouvre la future boîte d'échec.
- Seuls les travaux en attente ou en reprise sont annulables directement. Un
  travail en cours attend un point de contrôle ; un email envoyé ou livré est
  explicitement non rappelable.
- Cinq tests dédiés et la compilation complète passent. T020A est terminé ;
  T020 reste ouvert jusqu'au worker transactionnel, à la reprise manuelle et à
  l'interface de boîte d'échec.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - reprise humaine des communications en échec

- La reprise manuelle est réservée au superadmin ou au proviseur sous MFA, sur
  un travail `dead` et après confirmation explicite de la correction.
- L'échec d'origine reste intact. Un successeur idempotent repart à zéro avec
  une clé HMAC cloisonnée ; les erreurs de source et les livraisons terminales
  ne sont pas relancées.
- Six tests dédiés couvrent droits, MFA, confirmation, états terminaux, champs
  refusés et idempotence. T020B est terminé ; la transaction et l'interface de
  preview restent ouvertes dans T020.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - persistance fermée de la délivrabilité

- Une route Brevo désactivée par défaut authentifie, pseudonymise et rattache
  chaque événement à l'établissement configuré, sous verrou de livraison.
- Une empreinte HMAC unique absorbe les rejeux. Les états livrés ne régressent
  pas ; spam et désinscription gardent la priorité et aucun identifiant ne sort
  dans la réponse.
- Sept tests dédiés couvrent transitions, terminaux, schéma, fermeture,
  cloisonnement et minimisation. T019B est terminé ; la migration et la recette
  fictive de preview restent dans T019.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - délivrabilité prouvée sur la preview

- La migration additive `20260830090000` est appliquée uniquement sur la base
  Supabase de preview ; production, Brevo, Webmail et DNS restent inchangés.
- Une transaction fictive a prouvé la déduplication d'un rejeu dans un
  établissement, l'isolation d'un second établissement, les états gouvernés et
  l'absence de droits directs pour `anon` et `authenticated`.
- Le rollback a laissé zéro résidu. L'advisor Supabase ne remonte aucun
  `WARN` ou `ERROR` de sécurité ; ses deux informations RLS correspondent aux
  tables serveur volontairement sans politique cliente.
- T019 et T019C sont terminés. Le webhook demeure fermé faute de variables
  d'activation ; aucun email ni appel fournisseur n'a été effectué.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission ; aucun jeton externe n'a
  été consommé.

### Jalon du 30 août 2026 - récupération des communications prouvée

- L'application de la migration d'annulation sur la preview a révélé qu'elle
  remplaçait les fonctions de garde sans conserver les contrôles d'approbation.
  Aucun transport n'était actif et aucune donnée réelle n'était présente.
- La migration historique est corrigée et la migration additive
  `20260830160000` rétablit les gardes sur la preview.
- Une transaction fictive prouve brouillon refusé, panne `dead/error`, reprise
  unique, annulation d'urgence pré-envoi, refus de `running/sent`, tables
  privées et six compteurs à zéro après rollback.
- Les advisors Supabase ne remontent aucun `WARN` ou `ERROR` de sécurité sur
  la preview. Les informations RLS et index inutilisés sont cohérentes avec des
  tables serveur encore vides.
- T020 et T020J sont terminés. Production, Brevo, Webmail, DNS, worker et
  variables d'activation restent inchangés.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; zéro jeton externe consommé.

### Jalon du 30 août 2026 - 200 livraisons fictives prouvées

- Les migrations `20260830110000` et `20260830120000` sont appliquées
  uniquement sur la branche Supabase de preview.
- La recette T029 a été actualisée pour respecter le cycle brouillon, relecture,
  approbation et le type d'acteur gouverné `provider`.
- Elle prouve 160 succès, 20 reprises temporaires, 10 échecs définitifs et 10
  attentes, ainsi que doublons, rejeu et immutabilité, sans appel réseau.
- Le rollback laisse cinq compteurs à zéro. L'advisor Supabase ne remonte
  aucun `WARN` ou `ERROR` de sécurité.
- T029 et T029G sont terminés. T018 reste ouvert pour l'adaptateur Webmail
  réellement séparé ; aucune diffusion n'est activée.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; zéro jeton externe consommé.

### Jalon du 30 août 2026 - résolution opaque de 200 destinataires

- Une page signée relie les références de contact à l'établissement, la
  communication, la version, l'instantané du registre et les groupes approuvés.
- Seuls des contacts opaques `active_validated_email` sont préparés. Les clés
  HMAC restent stables entre pages et rejeux, sans nom, adresse ou téléphone.
- Six tests simulent 200 livraisons uniques et refusent doublons, contacts
  inactifs, coordonnées, pages invalides et changements de périmètre. T017A et
  T029A sont terminés ; les routes et la recette de file restent ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - ordre individuel vers le Webmail

- LyceeGest prépare un ordre HMAC de cinq minutes contenant un seul contact
  opaque, le texte validé et un chemin canonique sans origine ni jeton.
- Le Webmail séparé reste responsable de revérifier le contact, résoudre
  l'adresse et appeler Brevo. LyceeGest ne reçoit ni adresse ni identifiant
  fournisseur brut.
- Sept tests simulent 200 ordres uniques et refusent lots, coordonnées, liens
  externes, mauvais modes d'accès, contenus excessifs, rejeu hors délai et
  croisement d'établissement. T018A et T027B sont terminés.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - reçu signé du Webmail

- Le Webmail transforme le `message-id` Brevo en HMAC avant de répondre à
  LyceeGest ; l'identifiant fournisseur brut et l'adresse ne sortent pas de son
  périmètre.
- Le reçu de cinq minutes est lié à l'établissement, à la livraison, à
  l'empreinte exacte de commande et à la clé d'idempotence. Il distingue un
  premier envoi accepté d'un doublon sans provoquer un nouvel envoi.
- Sept tests simulent 200 reçus distincts, les doublons et les refus de rejeu,
  altération, expiration, mauvaise clé ou mauvaise commande. T018B et T027C sont
  terminés ; l'endpoint Webmail et la recette fictive restent ouverts.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - reprise transactionnelle Webmail

- Les livraisons disposent désormais de trois champs HMAC : résolution,
  commande et reçu Webmail. Ils sont uniques par établissement et immuables dès
  leur première affectation.
- La base exigera une commande avant `queued`, puis un reçu, une empreinte
  fournisseur et une date avant `sent` ou tout état ultérieur.
- La politique locale refuse les substitutions et travaux non actifs. Elle sait
  terminer un doublon après coupure réseau sans régresser `delivered` ni créer
  une deuxième référence fournisseur.
- Huit tests couvrent transition, reprise, états avancés, incohérences, migration
  et schéma. T018C et T029B sont terminés ; la migration n'est pas appliquée et
  le worker distant reste à réaliser avec des données fictives.

### Jalon du 30 août 2026 - client borné du worker Webmail

- Le futur worker dispose d'un client injecté sans endpoint réel : il vérifie
  l'ordre signé, borne le délai, appelle un transport, vérifie le reçu puis
  produit seulement une décision de complétion.
- Les erreurs HTTP et réseau deviennent des codes fermés ; aucun texte
  fournisseur ne remonte. Une réponse inattendue ou un reçu substitué échoue en
  `scope_invalid`.
- Un lot accepte 500 lignes au maximum et vingt appels simultanés. Six tests
  simulent 200 envois avec une concurrence de dix, un délai, les statuts HTTP et
  les entrées invalides. T018D et T029C sont terminés sans appel distant.

### Jalon du 30 août 2026 - persistance atomique de la complétion

- L'adaptateur Drizzle reverrouille le travail et la livraison dans le même
  établissement, puis recalcule la décision sous verrou.
- Il ajoute un événement idempotent, met à jour la livraison sous statut et
  empreintes attendus, puis termine exactement le travail `running` dans la
  transaction fournie par le futur worker.
- Un conflit sur l'une des lignes lève une erreur et laisse la transaction se
  rabattre intégralement. Le résultat ne contient que les états et le drapeau de
  doublon.
- Cinq tests de structure contrôlent le verrou, le cloisonnement, l'audit, les
  gardes d'écriture et la sortie. T018E et T029D sont terminés sans base distante.

### Jalon du 30 août 2026 - prise durable des travaux Webmail

- Une CTE prend les travaux d'envoi dus dans l'établissement avec
  `FOR UPDATE SKIP LOCKED`, par lot de vingt au maximum, et les passe à
  `running` avec un verrou daté.
- Une seconde opération récupère au plus cent travaux réellement abandonnés ;
  le délai est de cinq minutes par défaut et ne peut pas descendre sous deux.
- L'interruption incrémente l'essai, ferme le verrou, inscrit seulement
  `worker_interrupted`, puis reprogramme à une minute ou place en `dead` au
  cinquième échec.
- Six tests contrôlent périmètre, états, ordre, bornes, reprise et minimisation.
  T020C et T029E sont terminés sans exécuter de travail ni ouvrir de route.

### Jalon du 30 août 2026 - persistance des pannes de communication

- La panne est recalculée après verrou du travail et de sa livraison, puis le
  travail passe à `retry` ou `dead` sous le statut et l'essai observés.
- Une livraison seulement pré-envoi devient `error`. Un état envoyé, livré,
  rejeté, spam ou désinscrit n'est jamais régressé par une erreur tardive.
- L'audit contient uniquement code fermé, essai et échéance. La sortie indique
  seulement si la boîte d'échec doit montrer le travail.
- Cinq tests de structure vérifient verrou, concurrence, non-régression, audit et
  minimisation. T020D est terminé sans exécution ni base distante.

### Jalon du 30 août 2026 - reprise humaine persistée

- La reprise relit sous verrou un travail mort et sa livraison, puis réapplique
  les exigences rôle, MFA, confirmation, cause et état de livraison.
- Le travail mort reste immuable. Un successeur `pending` part à zéro avec une
  clé HMAC unique issue du travail d'origine ; un rejeu ne crée ni ligne ni audit
  supplémentaire.
- L'audit du premier succès conserve l'acteur nominatif, le type de successeur,
  le code fermé d'origine et la date, sans coordonnées ni texte fournisseur.
- Cinq tests de structure contrôlent autorisation, idempotence, immutabilité,
  audit et sortie. T020E est terminé sans route ni base distante.

### Jalon du 30 août 2026 - API privée de boîte d'échec

- Une liste privée retourne au maximum cent échecs d'envoi avec titre, version,
  code fermé, essais et date. Elle n'importe pas le modèle de livraison et ne
  projette aucun contact, HMAC ou identifiant fournisseur.
- Seuls superadmin et proviseur déjà sous MFA peuvent l'ouvrir. La reprise exige
  en plus les interrupteurs global et établissement d'envoi, un secret serveur
  fort et la confirmation exacte de la cause corrigée.
- La route appelle la transaction idempotente et ne renvoie aucun identifiant de
  travail ou livraison.
- Cinq tests dédiés et la matrice d'autorisation étendue couvrent les neuf routes
  privées. T020F est terminé ; l'interface et la recette DB restent ouvertes.

### Jalon du 30 août 2026 - interface de boîte d'échec

- La direction voit une section `Envois à reprendre` avec titre, version, motif
  français, essais et date. Les autres rôles ne chargent pas cette API.
- La reprise demande deux actions distinctes : `Cause corrigée`, puis
  `Confirmer la reprise`. Les boutons font au moins 44 px et la ligne s'empile
  sur petit écran.
- L'échec d'origine reste visible jusqu'au prochain chargement et la confirmation
  rappelle qu'il est conservé.
- Le test de route couvre aussi l'interface et vérifie l'absence de champs de
  livraison ou destinataire. T020G est terminé ; la recette DB reste ouverte.

### Jalon du 30 août 2026 - persistance des reçus entrants

- Le webhook entrant reste fermé par défaut et exige un Bearer fort ainsi que la
  clé HMAC fournisseur. Le lot contient vingt messages au maximum.
- Après le parseur, seules des empreintes et compteurs subsistent. La transaction
  rattache par HMAC sortant exact dans l'établissement, avec deux candidats au
  maximum et sans adresse de secours.
- Une ligne privée idempotente est créée ; un entrant non rattaché garde une
  communication nulle. L'audit d'un rattachement contient seulement compteurs,
  présence de texte et besoin de revue spam.
- Cinq tests de persistance vérifient fermeture, périmètre, minimisation, audit et
  réponse. T022B et T023B sont terminés sans contenu, secret ou appel réel.

### Jalon du 30 août 2026 - contrat de délivrabilité Brevo

- Un vérificateur Bearer commun protège désormais les futurs webhooks entrants
  et de délivrabilité avec secret fort et comparaison en temps constant.
- Le reçu de délivrabilité conserve seulement la HMAC du message, une clé de
  rejeu HMAC, l'état produit et l'heure UTC. Email, objet, motif, IP et tags sont
  ignorés ; ouverture et clic ne sont pas acceptés.
- Cinq tests dédiés et les six tests Brevo entrants passent. T019A est terminé ;
  T019 reste ouvert jusqu'à la route privée, la persistance idempotente et le
  rejeu en preview.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - aperçu éditorial local sûr

- Le composeur privé propose désormais deux modes stables, `Écrire` et
  `Aperçu`, sans changer le brouillon ni appeler un fournisseur externe.
- L'aperçu rend localement le titre, le résumé et le Markdown. Les images
  distantes sont remplacées par un repère sans téléchargement ; les liens
  s'ouvrent dans un nouvel onglet isolé et les tableaux restent contenus sur
  mobile.
- L'écran rappelle qu'il s'agit d'un aperçu interne sans destinataire. Aucun
  champ d'audience, droit de publication ou appel d'envoi n'a été ajouté.
- T021A est terminé avec 65 tests du centre et un build activé réussi. T021
  reste ouvert jusqu'à l'intégration autorisée d'un fournisseur et à une preuve
  de fidélité du message réellement livré.
- Le brief Claude de ce lot est préparé mais non exécuté, faute de modèle exact
  et de plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - autorisation renforcée des communications

- Chaque route privée du centre exige désormais explicitement une session
  `aal2`, même si l'obligation MFA générale de l'environnement n'est pas encore
  activée. La règle commune s'applique aussi aux modèles, documents, aide IA,
  versions et demande de relecture.
- Les rôles d'édition restent limités à superadministration, administration et
  proviseur ; la personnalisation des modèles reste limitée à
  superadministration et proviseur. Le filtre établissement demeure obligatoire
  pour chaque lecture ou écriture persistée.
- Une nouvelle suite contrôle les sept routes, les deux listes de rôles, les
  deux interrupteurs du module et l'absence d'API publique, d'audience, de
  publication ou d'envoi. Le centre compte maintenant 65 tests réussis.
- T028A est terminé. T028 reste ouvert jusqu'à la création autorisée d'une API
  publique et à ses contrôles de visibilité. Aucun réglage distant n'a changé.
- Le brief Claude du lot est préparé mais non exécuté, faute de modèle exact et
  de plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - matrice documentaire de communication

- Les tests extraient réellement un PDF fictif par PDF.js et un DOCX fictif par
  Mammoth, tous deux en mémoire et sans appel réseau ou IA.
- Les images JPEG/PNG et le texte brut sont refusés avant extraction. Un faux
  PDF corrompu est refusé même s'il déclare le bon type MIME ; chemins relatifs,
  extension incohérente, taille excessive et champs inconnus restent bloqués.
- Un PDF fictif contenant une adresse email et un code scolaire termine en
  revue manuelle, avec texte extrait supprimé et signaux bornés seulement.
- T030 est terminé avec 65 tests du centre. T011D et T011 restent ouverts : ce
  lot ne remplace pas la preuve ClamAV de bout en bout sur un moteur autorisé.
- Le brief Claude de ce lot est préparé mais non exécuté, faute de modèle exact
  et de plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - accessibilité du centre de communications

- L'interface privée nomme désormais ses étapes, ses groupes de choix, ses
  formulaires, son chargement, le compteur filtré et la communication active.
  Les documents forment une liste sémantique et les commandes compactes
  atteignent 40 px, sans ouvrir la publication ni l'envoi.
- Le contrat statique T031A est testé. T031 reste ouverte jusqu'à une recette
  sur navigateur authentifié à 320 px et sur ordinateur, au clavier complet et
  avec un lecteur d'écran réel.
- Le brief Claude en lecture seule est préparé mais non exécuté, faute de modèle
  exact et de plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - validation humaine du classement assistant

- Le lot N5ZF signe chaque proposition de classement avec un reçu HMAC de
  quinze minutes lié à l'établissement, la catégorie et le service. Le reçu ne
  contient ni conversation, identité, coordonnées ou document et n'est jamais
  sauvegardé dans le brouillon local.
- Une proposition vérifiée peut être attachée une seule fois au nouveau dossier.
  L'agent la confirme explicitement sous MFA ou la corrige en transférant le
  dossier. La décision est terminale, atomique et auditée sans motif ni contenu.
- La direction obtient des agrégats distincts : propositions, décisions en
  attente, confirmations, corrections, taux de traitement et taux de correction.
  Une sortie IA technique n'est toujours pas présentée comme validation humaine.
- Les tests ciblés, d'autorisation, de cloisonnement, de concurrence, de routage,
  adversariaux, TypeScript et le build passent. `npm audit --omit=dev` signale
  zéro vulnérabilité.
- La migration `20260830090500` est appliquée uniquement à la branche Supabase
  `xijocumlwivhbmffrnlj`. La première recette a révélé un scénario de portée
  masqué par une unicité plus précoce ; le cas a été corrigé avec une seconde
  demande fictive, rejoué avec `ROLLBACK` puis contrôlé à zéro résidu dans les
  quatre tables concernées.
- L'auditeur sécurité ne signale aucun `WARN` ou `ERROR` sur la nouvelle table.
  L'absence de politique RLS est volontaire avec RLS forcée et privilèges client
  retirés ; l'avis d'index composite est écarté car `request_id` est déjà unique.
- `SUPPORT_ASSISTANT_ROUTING_REVIEW_ENABLED=true` est configuré seulement pour
  la preview Vercel de `codex/lycee-connect-prototype`. T030D2 est terminé ; le
  lot parent attend encore une confirmation et une correction applicatives sur
  deux dossiers entièrement fictifs.
- Les recettes T030D3 savent créer un compte éphémère, atteindre MFA `aal2`,
  appeler les API protégées, contrôler les agrégats et nettoyer. Leur première
  exécution a été arrêtée avant les décisions : Vercel remplace huit secrets de
  preview par des marqueurs non utilisables sur ce poste. La tentative SQL de
  diagnostic n'a créé aucune décision ; compte, identité, adhésion, demandes,
  revues, facteurs, sessions et événements ont tous été contrôlés à zéro après
  nettoyage. T030D et T030D3 restent donc ouverts.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - contrat limité du registre Webmail

- Le contrat serveur T016 est défini sans appeler le Webmail : requête HMAC de
  cinq minutes et instantané signé valable au maximum une heure, tous deux liés
  à un établissement unique.
- L'instantané contient au plus 200 références de groupe opaques avec libellé,
  type, état et comptage agrégé. Les coordonnées, listes de membres, champs
  inconnus, doublons, compteurs excessifs, signatures altérées et réponses
  expirées sont refusés.
- LyceeGest ne devient pas le registre nominatif. La résolution des contacts
  actifs restera côté Webmail dans T017 et aucun instantané ne vaut autorisation
  de publier ou d'envoyer.
- Six tests adversariaux passent sans réseau ni donnée réelle. Aucun secret,
  environnement, service distant ou déploiement n'a été modifié à ce stade.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - aperçu email fidèle et fermé

- L'éditeur privé distingue désormais `Écrire`, `Page` et `Email`. Le rendu
  email utilise le même titre, résumé et corps que la communication, avec
  expéditeur institutionnel, objet, pré-en-tête et largeur proche d'un client
  email.
- Aucun destinataire n'est sélectionné et le lien officiel reste explicitement
  en attente de publication. Le modèle retourne toujours `canSend: false` et
  refuse tout champ supplémentaire de destinataire ou de livraison.
- Les images distantes sont neutralisées. Seuls les chemins internes et liens
  HTTPS sans identifiants restent cliquables ; les autres deviennent du texte.
- Les tests ciblés et le build passent sans API, secret, donnée réelle ou
  modification distante. T021 est terminé ; la publication et l'envoi restent
  verrouillés.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - classement local des réponses

- Un classificateur déterministe prépare les quatre catégories déjà autorisées
  par la base : retrait, correction de contact, question et réponse libre. Il ne
  retourne jamais le sujet, le corps ou une coordonnée.
- Les négations explicites empêchent un faux retrait. Des signaux bornés en
  français, anglais, espagnol et arabe sont couverts sans IA externe.
- La présence d'un mot de passe, code ou secret force une revue manuelle
  sécurisée. Toute sortie conserve `requiresHumanReview: true` ; aucune action
  sur un contact n'est exécutée.
- Six tests passent. Le raccordement à un webhook authentifié, à la boîte
  entrante et à l'action agent reste volontairement ouvert dans T022 à T024.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - confidentialité des sorties Communications

- Un test récursif couvre les sept routes actuelles et refuse toute nouvelle
  surface publique, audience, destinataire ou envoi sans mise à jour explicite
  de la preuve de sécurité.
- Les sorties navigateur restent sans adresse, téléphone, référence de contact
  ou liste de membres. Les listes et confirmations documentaires ne retournent
  ni chemin de stockage, texte extrait ou empreinte.
- Le test a identifié trois sélections internes trop larges. Version, relecture
  et confirmation documentaire projettent maintenant chaque colonne nécessaire
  et chaque valeur retournée.
- T027A est terminé. T027 reste honnêtement ouvert jusqu'aux livraisons fictives
  de T017 à T020 ; aucun destinataire ou service distant n'a été utilisé.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - contrat entrant Brevo fermé

- Le futur webhook du centre de communication possède maintenant un contrat
  autonome, distinct de l'ancien webhook du guichet d'aide. Il ne crée encore
  aucune route et reste fermé sans `COMMUNICATION_INBOUND_ENABLED=true`.
- L'authentification attend un unique jeton Bearer fort comparé en temps
  constant. Les lots, références et pièces jointes sont bornés avant toute
  persistance.
- La sortie contient uniquement des HMAC secrets séparés par domaine, des
  compteurs de pièces, un indicateur de message extrait et un score borné. Elle
  exclut sujet, corps, expéditeur, coordonnées, noms et jetons privés.
- T022A est terminé avec six tests locaux. T022 reste ouvert jusqu'à la route,
  au stockage privé atomique et à la preuve de rejeu concurrent. Aucun DNS,
  secret, webhook ou environnement distant n'a été modifié.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - rattachement strict des réponses

- `In-Reply-To` et l'identifiant du message sortant partagent désormais une
  primitive HMAC dédiée. L'identifiant du message entrant conserve un domaine
  distinct afin d'éviter toute confusion de rôle.
- Le rapprochement exige une référence exacte et un candidat du même
  établissement. Il ne se replie jamais sur les adresses et détecte explicitement
  les absences et ambiguïtés.
- La migration additive `20260830110000` impose un HMAC de 64 caractères et une
  unicité sur `(institution_id, provider_message_ref)` ; elle est appliquée
  uniquement sur la preview Supabase.
- Une transaction fictive avec deux établissements prouve unicité locale,
  isolation croisée, rejeu idempotent, inconnu non rattaché, tables privées et
  six compteurs à zéro après rollback.
- T023, T023A, T023B et T023C sont terminés. Le webhook entrant et ses variables
  restent fermés ; aucune donnée réelle ou intégration fournisseur n'est utilisée.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission ; zéro jeton externe consommé.

### Jalon du 30 août 2026 - cibles tactiles de l'accueil

- Une recette réelle du portail à 320 x 800 et 1 440 x 900 ne relève aucun
  débordement horizontal. L'identité du lycée et l'assistant restent visibles
  dans le premier écran mobile ; la navigation ordinateur ne se recouvre pas.
- Trois actions textuelles de 17 à 18 px de haut disposent maintenant d'une
  cible minimale de 40 px : confidentialité, affichage des services et ouverture
  de LyceeGest.
- Un test statique protège les règles mobiles critiques, les cibles et les
  contrôles sémantiques de l'assistant. T048B est terminé ; T048 reste ouvert
  pour les écrans agents authentifiés, le clavier complet et le lecteur d'écran.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - cibles tactiles des vues publiques

- La recette responsive couvre maintenant l'accueil et les six vues publiques
  Services, Aide, Suivi, Lycée, Actualités et Confidentialité à 320 x 800 et
  1 440 x 900.
- Les retours, actions du catalogue, onglets du lycée, liens pratiques, fermeture
  du suivi partagé, recherche des demandes et actions de document mesurent au
  moins 40 px. Aucun débordement horizontal ni journal navigateur en erreur ne
  subsiste dans la recette locale.
- Quatre tests statiques et la compilation complète passent. T048C est terminé ;
  T048 reste ouvert pour les écrans agents authentifiés, la navigation clavier
  complète et le lecteur d'écran.
- Le brief Claude a été élargi à ces vues mais demeure non exécuté, faute de
  modèle exact et de plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - email transféré en brouillon interne

- Un contrat local prépare un email transféré uniquement si sa source est déjà
  autorisée côté serveur. Aucun expéditeur, destinataire, domaine ou filtre
  n'est configuré dans ce lot.
- Les en-têtes techniques, l'ancien fil et les images distantes sont retirés ou
  neutralisés. Secrets et balisages actifs sont refusés ; adresses et téléphones
  imposent un masquage avant toute aide IA.
- Le résultat est toujours `internal` et `draft`, sans publication ni
  notification, avec empreinte anti-doublon et relecture humaine. Cinq tests et
  la compilation complète passent. T025A est terminé ; T025 reste ouvert pour
  la route privée, la persistance et le rejeu.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - preuve locale de restauration chiffrée

- Un format local borné rassemble obligatoirement un extrait fictif de base et
  un fichier Storage fictif. Chaque artefact est chiffré en AES-256-GCM avec un
  nonce neuf ; chemins, types MIME, empreintes et contenu restent chiffrés.
- Le manifeste complet est authentifié avec une clé dérivée. Établissement,
  identifiant de sauvegarde, ordre, nombre, catégorie et taille sont aussi liés
  aux enveloppes pour empêcher retrait, permutation ou mélange de paquets.
- La vérification refuse mauvaise clé, autre établissement, paquet inattendu,
  altération, chemin dangereux, champ inconnu, doublon et dépassement de taille.
  Elle ne retourne les artefacts qu'après contrôle intégral et n'écrit rien.
- T031A est terminé avec 28 contrôles locaux. T031 reste ouverte : aucun export
  distant, planificateur, coffre de clés ou test de restauration isolée réel n'a
  été exécuté.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - rotation locale du coffre par lots

- La primitive du coffre accepte désormais jusqu'à 250 enveloppes anciennes,
  éventuellement sous plusieurs versions, vers une cible unique supérieure.
- Toutes les lignes et enveloppes sont validées strictement. Un doublon, un
  champ inconnu, une ligne déjà à jour, une mauvaise ancienne clé ou un retour
  de version fait échouer le lot sans résultat partiel.
- Chaque personne reçoit un nonce neuf. Le résultat ne contient que les
  enveloppes chiffrées et un bilan agrégé par version source, jamais le clair.
- T010B2C3 est terminé avec 37 contrôles du coffre. T010B2C reste ouverte : la
  sélection SQL `SKIP LOCKED`, la transaction d'écriture, la restauration et le
  retrait réel d'une clé ne sont pas implémentés.
- Le brief Claude est élargi mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - worker de rotation préparé et fermé

- Un worker à exécution unique prépare la rotation transactionnelle d'un seul
  import et d'un seul établissement. Il refuse de démarrer sans interrupteur,
  deux UUID explicites, clé cible versionnée et limite de 1 à 250.
- Les lignes sont verrouillées par `SKIP LOCKED`. Chaque écriture compare encore
  version, nonce, tag et ciphertext sources ; l'audit agrégé appartient à la
  même transaction, donc un échec annule le lot entier.
- La migration ajoute seulement l'index de rotation et l'action d'audit. Elle
  n'accorde aucun droit client et n'a pas été appliquée.
- T010B2C4 est terminé avec 24 contrôles statiques. T010B2C reste ouverte jusqu'à
  la recette fictive isolée, la restauration prouvée et le retrait contrôlé de
  l'ancienne clé.
- Le brief Claude est élargi mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - analyse de cohérence Spec Kit

- Les cinq domaines comptent 377 identifiants uniques : 258 lignes terminées et
  119 ouvertes. Ces nombres restent un inventaire, jamais un pourcentage global.
- Les parents encore ouverts correspondent bien à des preuves absentes :
  opérations distantes, décisions métier/DPO, comptes nominatifs, données
  validées, restauration ou pilote.
- Le domaine `003` est terminé dans son périmètre, sans fermer la migration du
  site `004` ni autoriser une bascule de production.
- Un test automatique protège les numéros de specs, les cases et les identifiants
  de tâches contre les doublons et pertes structurelles.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - versions de migrations rendues uniques

- Deux fichiers partageaient la version `20260830090000` : déduplication des
  événements de communication et revue humaine du classement assistant.
- La revue du classement, documentée comme non appliquée, utilise désormais la
  version `20260830090500`. Son script verrouillé, son test, la tâche et les
  documents pointent tous vers ce nom unique.
- Un contrôle global refuse désormais les versions dupliquées, noms mal formés,
  migrations référencées mais absentes et paires `VERSION`/`NAME` incohérentes.
- T003A est terminé sans appliquer de migration ni accéder à une base distante.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - publication atomique des communications préparée

- La relecture, la validation direction et la publication publique sont trois
  confirmations séparées. La validation et la publication exigent direction,
  MFA, établissement courant et verrou de concurrence.
- La publication exige les interrupteurs environnement et base, une visibilité
  publique et la version courante approuvée. Elle crée dans une transaction la
  page `À la une`, sa version, le rattachement et les audits.
- Questions ouvertes, secrets, emails, téléphones et contenu dépassant les
  limites éditoriales bloquent la publication. Aucune adresse, audience ou
  livraison n'entre dans l'interface ou la réponse publique.
- Les interrupteurs de publication restent fermés. Le code est déployable en
  preview, mais T014 reste ouvert jusqu'à la recette fictive isolée.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - flux public des informations rendu consultable

- `À la une` recherche désormais sans accent dans les métadonnées publiques,
  filtre les catégories, affiche le nombre de résultats et permet de revenir à
  la liste complète sans rechargement.
- Les dates de publication et la priorité éditoriale sont visibles. Le filtrage
  conserve l'ordre épinglé puis daté fourni par le serveur.
- L'API continue de servir uniquement la version publiée, dans sa fenêtre de
  validité, hors archive et avec une limite de 100 éléments.
- Les contrôles passent en une colonne sous 720 px et disposent de libellés et
  d'un compteur annoncés aux technologies d'assistance.
- À ce jalon, T015 restait ouverte pour décider la politique d'archives et
  paginer au-delà de 100 ; la pagination est fermée au jalon suivant. Le brief
  Claude est préparé mais non exécuté, faute de modèle exact et de plafond de
  consommation propres à cette mission.

### Jalon du 30 août 2026 - pagination publique stable

- L'API publique accepte désormais un curseur opaque et au plus 100 contenus
  par page. Le curseur ne contient que priorité, date publiée et identifiant
  technique ; il est borné, strictement validé et ne transporte aucune donnée
  personnelle ni contenu éditorial.
- L'ordre total `priorité, date, identifiant` évite les doublons entre deux
  pages. Chaque appel reconfirme côté SQL puis côté instantané l'audience
  publique, le statut, la publication et l'expiration.
- `À la une` charge la suite à la demande, conserve les éléments déjà visibles,
  élimine les doublons et n'efface pas la page si un chargement suivant échoue.
- T015 reste ouverte uniquement pour la durée de visibilité et le traitement
  public des archives. Le brief Claude est préparé mais non exécuté, faute de
  modèle exact et de plafond de consommation propres à cette mission.

### Jalon du 30 août 2026 - frontières communications/publique rejouées

- Les douze routes d'action du centre restent exclusivement sous
  `api/communications/admin`, avec le garde partagé qui impose compte agent,
  établissement, rôle borné et `aal2`.
- La lecture publique n'importe aucune table de communications. Elle ne lit que
  la version publiée des contenus du site, d'audience `tous`, non archivée et
  dans sa fenêtre de validité.
- La route de publication refuse toute communication dont la visibilité n'est
  pas `public`. Les champs d'approbation, de compte et d'établissement ne font
  pas partie de la réponse publique.
- T028 est fermée par une suite consolidée. Le brief Claude est préparé mais non
  exécuté, faute de modèle exact et de plafond de consommation propres à cette
  mission.

### Jalon du 30 août 2026 - preuves d’évaluation des compétences

- Un brouillon ne peut plus déclarer ses propres tests « réussis ». Les anciens
  résultats déclaratifs sont supprimés lorsque la version est figée pour revue.
- Chaque exécution est enregistrée séparément par un compte direction avec MFA,
  heure serveur, données fictives, scénario, attendu, observé et mode
  d’exécution. Les mots de passe, codes et clés secrètes sont refusés.
- La publication exige désormais cinq cas positifs, trois ambigus et trois
  interdits, tous réussis et exécutés après le gel de la version.
- L’espace superadministrateur permet de constituer ce procès-verbal sans
  modifier le code. T046 reste ouverte tant que les versions publiées n’ont pas
  effectivement passé leur jeu de tests.
- Les cinq domaines comptent maintenant 378 identifiants uniques : 259 lignes
  terminées et 119 ouvertes. Le brief Claude est préparé mais non exécuté, faute
  de modèle exact et de plafond propres à cette mission.

### Jalon du 30 août 2026 - matrice d’évaluation importée localement

- L’espace direction peut ouvrir un document Markdown de compétence et préparer
  successivement ses onze scénarios sans recopier leur texte.
- La lecture reste dans le navigateur : aucun fichier, scénario ou attendu n’est
  transmis pendant l’import. Le parseur borne la taille et le nombre de cas,
  exige cinq positifs, trois ambigus et trois interdits, puis refuse les doublons,
  mauvais préfixes, champs hors limites et secrets.
- Un cas importé reçoit toujours le statut « à revoir », une observation vide et
  une confirmation décochée. Il ne devient une preuve qu’après une exécution
  humaine et l’enregistrement MFA déjà protégé côté serveur.
- T046B est terminée ; T046 reste ouverte jusqu’à l’exécution effective des jeux
  de tests. Les cinq domaines comptent 379 identifiants uniques : 260 lignes
  terminées et 119 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond de consommation propres à cette mission ; aucun jeton externe n’a été
  consommé.

### Jalon du 30 août 2026 - reprise déterministe du worker email

- Le worker Vercel valide désormais chaque travail avant toute recherche en base
  et avant Brevo : charge bornée, établissement obligatoire et identique, UUID,
  type autorisé, message, contact et jeton temporaire selon le canal.
- Un travail empoisonné est archivé dans PGMQ et compté en échec ; il n’est ni
  envoyé ni supprimé définitivement. Un travail valide est retenté après les
  quatre premiers échecs puis copié dans la file d’échec et archivé au cinquième.
- La clé d’idempotence envoyée au fournisseur reste le `job_id` UUID validé. Les
  succès, doublons fournisseur et indisponibilités sont couverts par faux client,
  sans email ni donnée réelle.
- T047B est terminée ; T047 reste ouverte pour une interruption réelle et le p95
  HTTP. Les cinq domaines comptent 380 identifiants uniques : 261 lignes
  terminées et 119 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n’a été consommé.

### Jalon du 30 août 2026 - navigation clavier de l’espace agent

- Le shell authentifié fournit un lien « Aller au contenu principal » vers un
  repère focalisable et une navigation principale nommée.
- Le panneau mobile annonce son ouverture, disparaît de l’arbre d’accessibilité
  quand il est fermé, enferme le focus quand il est modal et se ferme par Échap.
- Fermer rend le focus au bouton d’ouverture ; choisir une rubrique le place sur
  le contenu principal. Le menu se ferme aussi après activation d’un lien.
- T048D est terminée ; T048 reste ouverte pour la recette lecteur d’écran avec
  comptes nominatifs. Les cinq domaines comptent 381 identifiants uniques : 262
  lignes terminées et 119 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n’a été consommé.

### Jalon du 30 août 2026 - matrice de couverture de l'ancien site

- Les 28 contenus WordPress inventoriés figurent maintenant dans une matrice
  versionnée avec leur brouillon, leur destination, leur classement et la
  décision humaine encore attendue.
- Les 27 anciennes adresses hors accueil restent reliées à `/site/<slug>` ;
  l'accueil est explicitement traité comme une future bascule globale et sa
  source demeure consultable dans le brouillon `accueil-historique`.
- Le PDF du voyage à Londres de 49,8 Mo reste isolé comme média bloquant. Les
  deux DOCX refusés ne sont rattachés à aucun des 28 contenus.
- T018A est terminée, mais T018 reste ouverte jusqu'à la comparaison visuelle et
  éditoriale par les responsables. Les cinq domaines comptent 382 identifiants
  uniques : 263 lignes terminées et 119 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - publication atomique des communications

- T014 est terminée sur la branche Supabase de preview avec deux communications
  strictement fictives et le vrai cycle brouillon, relecture, validation.
- Une publication complète crée la page, son instantané, le rattachement et les
  deux audits sans audience, livraison ou travail d'envoi.
- Une panne forcée après les écritures annule intégralement la seconde
  publication ; le rollback final laisse huit compteurs à zéro.
- L'advisor Supabase reste à 60 informations et zéro avertissement ou erreur.
- Aucun interrupteur Vercel, domaine public, donnée réelle ou envoi n'a été
  activé. Le brief Claude est préparé mais non exécuté faute de modèle exact et
  de plafond propres à cette mission ; zéro jeton externe consommé.

### Jalon du 30 août 2026 - archives publiques prudentes

- T015C sépare en preview les publications en cours des publications expirées.
- Un retrait manuel reste exclu des deux flux et ne peut pas être relu par slug.
- Le curseur opaque est lié au mode `current` ou `expired` et la réponse cliente
  doit confirmer le même mode.
- La recette Supabase distingue exactement les trois cas et laisse trois
  résidus à zéro après rollback, sans donnée réelle ni changement de production.
- Chromium valide le contrôle segmenté à 1 440 px et 390 px sans erreur console
  ni débordement ; les deux boutons mesurent 40 px de haut sur téléphone.
- T015 reste ouvert uniquement pour valider la durée de conservation publique
  des expirés. Le brief Claude est préparé mais non exécuté faute de modèle
  exact et de plafond ; zéro jeton externe consommé.

### Jalon du 30 août 2026 - couverture RLS du guichet préparée

- Une migration locale impose la RLS et retire les droits directs sur les seize
  tables privées `support_*` actuellement connues.
- Un test découvre ces tables dans tout l'historique SQL et échoue si une future
  table n'est pas couverte par la migration de durcissement.
- T011A est terminée localement. T011 reste ouverte jusqu'à l'application et à
  la recette RLS/concurrence sur la base de preview autorisée.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - recette navigateur de l'assistant public

- Chrome réel a vérifié l'accueil local à 1 262 px et 390 px sans erreur ni
  débordement horizontal ; les sept images se chargent après défilement.
- Un scénario fictif de panne d'ordinateur atteint l'état `Demande prête` en
  deux réponses puis ouvre le formulaire final, sans envoi ni écriture distante.
- L'unique violation axe A/AA concernait le contraste de `Demande comprise` ;
  la couleur a été assombrie et la taille portée de 8 à 10 px.
- La recette étendue aux cinq autres vues publiques a corrigé les textes
  secondaires trop clairs et donné le rôle `log` aux conversations nommées.
- Après correction, axe ne relève aucune violation WCAG A/AA sur les vues
  publiques. Les contrôles à 320 px ne relèvent aucun débordement horizontal ;
  les textes sur images ou dégradés restent à confirmer manuellement.
- T048G est terminée localement, sans compte, donnée réelle ou création de
  demande distante.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - frontière des méthodes API

- Les 94 routes Vercel inspectent explicitement la méthode HTTP et utilisent la
  réponse `405` partagée pour toute méthode non autorisée.
- Le contrôle est transversal : une future route permissive fera échouer la
  barrière de sécurité de la preview.
- T037AA est terminée localement, sans requête distante ni donnée utilisateur.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - couverture d'accès des routes privées

- Les 65 routes des sept espaces privés appellent une garde `require...` avec
  la requête avant leur traitement.
- Une future route privée sans authentification ou habilitation explicite fera
  échouer la barrière de sécurité de la preview.
- T037AB est terminée localement, sans compte ni appel distant.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - écart du domaine public identifié

- Le domaine `gestion.lycee-blaise-cendrars-sevran.fr` sert encore le commit de
  production `a9cf32e` : la page répond `200`, mais le flux public répond `500`.
- La preview `5430ceb` répond `200` pour la page et le flux de contenus avec un
  accès Vercel temporaire.
- T040A reste ouverte. Aucune promotion, migration, modification d'alias ou de
  DNS n'a été exécutée ; la cause exacte et le retour arrière doivent être
  validés avant toute bascule.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - vérification locale du retrait d'une clé du coffre

- Un lot de 250 enveloppes maximum doit utiliser uniquement la version cible et
  rester déchiffrable avec la nouvelle clé avant tout retrait.
- Le vérificateur refuse une ancienne clé encore chargée et ne restitue que le
  nombre de lignes, les versions retirées et une empreinte agrégée.
- T010B2C5 est terminé sur deux personnes fictives. T010B2C reste ouvert pour la
  vérification exhaustive, la restauration et le retrait effectif en preview.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - worker exhaustif du coffre préparé

- Un worker fermé par défaut parcourt au plus 25 000 enveloppes d'un
  établissement sous une transaction cohérente et en lots de 250 maximum.
- Ingestion, rotation et vérification partagent désormais un verrou consultatif
  transactionnel par établissement.
- T010B2C6 est terminé localement. Le worker n'est ni installé ni exécuté ; la
  restauration et le retrait effectif restent dans T010B2C.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - couverture des commandes sans payload

- Le test transversal couvre maintenant les handlers de mutation qui ne lisent
  aucun corps et exige `bodyParser: false`.
- Les tâches cron du support et de l'expiration des connaissances désactivent le
  parseur tout en conservant leur durée maximale de 60 secondes.
- T037Z est terminée par tests locaux, sans appel de cron, compte distant,
  donnée réelle ou modification Supabase.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - MFA sur les anciens codes d'accès

- Les listes administratives élèves et professeurs qui exposent les anciens
  codes exigent maintenant `aal2` après le contrôle du rôle.
- Les imports historiques qui génèrent encore ces valeurs exigent eux aussi
  `aal2` ; la création massive de comptes demeure neutralisée.
- Aucun compte ou code existant n'est supprimé. Leur retrait complet reste un
  choix métier à traiter avec une migration nominative/OTP.
- T037Y est terminée par tests locaux, sans compte distant, donnée réelle ou
  modification Supabase.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - retrait des comptes professeurs dérivés de codes

- La commande historique qui écrivait directement dans `auth.users` est
  neutralisée et son bouton a été retiré de l'import des professeurs.
- La route exige encore un rôle habilité et `aal2`, puis répond `410` sans
  écriture ; aucun compte existant n'est supprimé ou modifié.
- Le cachet final du Grand Oral exige désormais explicitement `aal2`.
- Les trois dernières commandes sans payload désactivent le parseur Vercel.
- T037X est terminée par analyse statique et tests locaux, sans compte distant,
  donnée réelle ou modification Supabase.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - couverture globale des corps HTTP

- Un test transversal inventorie récursivement toutes les routes TypeScript qui
  lisent `req.body`.
- Chaque route inventoriée doit exporter un plafond `bodyParser.sizeLimit` et ne
  peut pas désactiver le parseur tout en lisant le corps déjà analysé.
- Le contrôle est intégré à la barrière de sécurité de l'aperçu afin de bloquer
  automatiquement toute régression future.
- T037W est terminée par analyse statique et tests locaux, sans donnée réelle,
  compte distant ou modification Supabase.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.
- L'audit npm des dépendances de production est à zéro. L'audit complet signale
  néanmoins trois alertes hautes et six modérées dans la toolchain de
  développement ; aucun `npm audit fix --force` cassant n'a été appliqué.

### Jalon du 30 août 2026 - alertes PWA pour une session active

- L'usager peut activer volontairement une cloche dans `Mes demandes`. Aucune
  permission navigateur n'est demandée au chargement et l'activation n'est pas
  persistée silencieusement d'une session à l'autre.
- Le premier état sert uniquement de référence. Une réponse agent ou un
  changement de statut ultérieur peut produire une notification quand la page
  est en arrière-plan ; les doublons, états plus anciens et valeurs invalides
  sont ignorés.
- Le titre et le corps ne contiennent ni nom, objet, message, catégorie ou
  numéro visible. Le clic ouvre `/prototype?view=requests`, sans identifiant de
  dossier dans l'URL.
- Le rendu a été contrôlé à 1440 x 900 et 320 x 800 : zéro débordement, actions
  empilées sur mobile, aucune erreur console ou overlay. Chromium headless garde
  toutefois la permission système refusée ; la notification native réelle reste
  donc à éprouver sur téléphone.
- Les réponses API non JSON n'exposent plus une erreur technique brute : elles
  deviennent un message français générique et borné.
- T033A est terminée ; T033 reste ouverte pour la recette réelle. Les cinq
  domaines comptent 383 identifiants uniques : 264 lignes terminées et 119
  ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - surveillance des échéances explicites

- Une nouvelle demande ne reçoit plus un délai arbitraire de vingt-quatre
  heures. Le champ d'échéance reste vide tant qu'une règle locale validée ne
  l'alimente pas.
- La file agent accepte un filtre serveur `overdue=true` limité aux dossiers
  ouverts dont l'échéance enregistrée est réellement dépassée. Le cloisonnement
  par établissement et par service reste appliqué avant ce filtre.
- L'onglet `En retard` rend ces dossiers directement accessibles sans lancer de
  rappel, d'email ou d'escalade.
- T029A est terminée ; T029 et T027B2 restent ouvertes jusqu'à validation des
  durées, horaires, responsables et canaux de relance. Les cinq domaines
  comptent 384 identifiants uniques : 265 lignes terminées et 119 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - guichet unique verrouillé

- Le chat et l'alternative formulaire utilisent une seule fonction de création
  et le même endpoint idempotent `/api/support/requests`.
- L'assistant prépare une réponse, un classement et éventuellement un reçu de
  routage court ; il n'écrit aucun dossier et ne possède aucune table de suivi.
- Le suivi demandeur et la console agent relisent les mêmes demandes, messages,
  pièces et événements `support_*` définis par le domaine `001`.
- Un test de contrat échoue désormais si un futur changement sépare le chat, le
  formulaire, le suivi ou la console dans un second système.
- T039 est terminée. Les cinq domaines comptent 384 identifiants uniques : 266
  lignes terminées et 118 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - accès officiels sans adresse inventée

- `Mes services` conserve LyceeGest comme application existante pour les stages
  et le Grand Oral, avec des liens contextuels vers ses deux modules.
- Scolarité Services renvoie vers la page officielle du ministère qui explique
  les démarches et l'accès par EduConnect ou FranceConnect.
- PRONOTE est présenté via Monlycée.net, accès déjà officiel du lycée. Aucune
  adresse directe PRONOTE n'est déduite ou publiée sans confirmation locale.
- T040 et T041A sont terminées ; T041 reste ouverte pour l'adresse directe
  éventuelle. Les cinq domaines comptent 385 identifiants uniques : 268 lignes
  terminées et 117 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - porte de sécurité de preview

- La commande `npm run test:preview-security-gate` agrège les contrôles
  d'en-têtes HTTP, cache, source maps, secrets, limites de débit, sessions, MFA,
  périmètres agents, entrées adversariales, communications et migrations.
- Le contrat d'en-têtes exige CSP sans `unsafe-eval`, anti-cadrage, HSTS,
  `nosniff`, politique de permissions restrictive, API privées sans cache et
  service worker toujours revalidé.
- La porte ne contacte aucun compte, fournisseur, base distante ou donnée
  réelle. Elle ne remplace ni la revue DPO ni une recette avec comptes nominatifs.
- T049A est terminée ; T049 reste ouverte. Les cinq domaines comptent 386
  identifiants uniques : 269 lignes terminées et 117 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - observabilité de l'agent convergée

- Chaque exécution de l'assistant produit une mesure technique append-only :
  résultat fermé, modèle, latence, jetons, sources et nombre de tours.
- Le coût est estimé uniquement avec deux tarifs explicitement configurés ; il
  reste `null` sinon et l'interface le présente comme non configuré.
- Un reçu signé et court relie le modèle ayant proposé le routage au dossier.
  L'agent sous MFA confirme ou corrige ensuite ce classement dans un journal
  distinct, sans confondre réussite technique et validation humaine.
- Les métriques et tableaux agrégés ne lisent ni conversation, identité,
  coordonnées ou nom de pièce. `npm run test:agent-observability` vérifie le
  contrat complet.
- T046 est terminée. Les cinq domaines comptent 386 identifiants uniques : 270
  lignes terminées et 116 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - file d'attente usager

- La console agent possède un onglet `En attente` alimenté par le statut serveur
  `attente_demandeur` et son compteur déjà cloisonné par établissement/service.
- Les dossiers attendant une précision restent séparés de la file active sans
  disparaître de l'historique ni perdre leurs messages ou pièces.
- Le filtre ne déclenche aucune relance, notification, échéance ou changement de
  statut. Les règles d'automatisation restent soumises à validation métier.
- T029B est terminée ; T029 reste ouverte. Les cinq domaines comptent 387
  identifiants uniques : 271 lignes terminées et 116 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - vérification interne

- La console agent possède une file `À vérifier` pour le statut serveur
  `attente_interne`, distincte de l'attente d'une réponse usager.
- Le compteur est calculé dans la même requête cloisonnée par établissement,
  périmètre de service et filtre de service que les autres indicateurs.
- La vue ne crée aucune relance, notification ou échéance. Les règles de délai et
  d'escalade restent bloquées jusqu'à validation des responsables métier.
- T027B3 est terminée ; T027B reste ouverte. Les cinq domaines comptent 388
  identifiants uniques : 272 lignes terminées et 116 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - dossiers sans agent

- Le compteur `Sans responsable` ouvre désormais une file `Sans agent` au lieu
  de rester un simple indicateur.
- L'API applique `assignedTo is null` après le cloisonnement établissement et
  service. Un agent limité ne peut donc pas découvrir les autres files.
- `Sans agent` ne doit pas être confondu avec `À orienter` : le premier signifie
  qu'aucun agent n'a pris le dossier, le second qu'aucun service n'est assigné.
- T027B4 est terminée. Les cinq domaines comptent 389 identifiants uniques : 273
  lignes terminées et 116 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - statut visible dans la file

- Chaque dossier affiche désormais son statut en français sans imposer son
  ouverture : nouvelle demande, à classer, assignée, en cours, en attente usager,
  à vérifier, résolue, fermée ou classée sans suite.
- Le statut reste visuellement distinct des alertes opérationnelles : urgence,
  rappel, doublon, absence d'agent et échéance dépassée.
- T027B5 est terminée. Les cinq domaines comptent 390 identifiants uniques : 274
  lignes terminées et 116 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - filtres de file accessibles

- Le groupe des files porte le nom accessible `Filtrer les demandes`.
- Chaque bouton natif annonce son état sélectionné avec `aria-pressed`, sans
  modifier l'ordre de tabulation ni créer un composant clavier personnalisé.
- T048E est terminée ; T048 reste ouverte pour la recette avec lecteur d'écran
  et comptes nominatifs. Les cinq domaines comptent 391 identifiants uniques :
  275 lignes terminées et 116 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - remise à zéro des filtres

- La barre agent possède une action icône `Réinitialiser les filtres` qui efface
  en une fois recherche, file, service et pagination.
- Le bouton est désactivé dans la vue complète, afin de ne pas produire une
  action inutile ou ambiguë.
- T027B6 est terminée. Les cinq domaines comptent 392 identifiants uniques : 276
  lignes terminées et 116 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - réponses réseau obsolètes

- La console numérote chaque chargement de file et ignore toute réponse ou erreur
  remplacée par une requête plus récente.
- Le dossier sélectionné est mis à jour immédiatement et chaque chargement de
  détail vérifie encore cette référence avant de modifier l'écran.
- T027B7 est terminée. Les cinq domaines comptent 393 identifiants uniques : 277
  lignes terminées et 116 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - validation des filtres de file

- L'API de file refuse désormais tout statut inconnu et toute attribution autre
  que `me` ou `none` avec une réponse `400` explicite.
- Une valeur mal formée ne peut plus être ignorée puis produire une liste plus
  large que celle demandée par l'interface.
- T027B8 est terminée. Les cinq domaines comptent 394 identifiants uniques : 278
  lignes terminées et 116 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - indicateurs de file fermés par défaut

- Les filtres d'urgence, rappel, doublon et échéance n'acceptent que leur valeur
  documentée ; toute autre valeur reçoit une réponse `400`.
- Une clé de requête répétée n'est plus réduite silencieusement à sa première
  valeur : l'API refuse la requête avant la construction SQL.
- T027B9 est terminée. Les cinq domaines comptent 395 identifiants uniques : 279
  lignes terminées et 116 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - chargements explicites de la console

- La file conserve ses lignes pendant une actualisation et annonce son état avec
  `aria-busy` et un statut discret, sans faux écran vide.
- Lors d'un changement de sélection, l'ancien détail disparaît immédiatement et
  le chargement du nouveau dossier est annoncé jusqu'à la dernière réponse.
- La recette Playwright à 320 et 1440 px confirme zéro ancien détail, zéro erreur
  navigateur et aucun débordement horizontal pendant les réponses retardées.
- T027B10 est terminée. Les cinq domaines comptent 396 identifiants uniques : 280
  lignes terminées et 116 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - reprise manuelle de la file agent

- Une panne de chargement de file conserve son propre message et une action
  `Réessayer`, sans effacer ni confondre les erreurs de dossier ou de réponse.
- Une erreur de connexion ou de double vérification ne propose pas de relance
  trompeuse : elle garde le parcours d'authentification adapté.
- La recette Playwright `503` puis succès passe à 320 et 1440 px avec deux
  tentatives, bouton bloqué pendant l'attente et alerte retirée après reprise.
- T027B11 est terminée. Les cinq domaines comptent 397 identifiants uniques :
  281 lignes terminées et 116 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - repères de sélection agent

- La file et la recherche ont un nom accessible explicite.
- Les boutons de charge par service et chaque ligne de dossier annoncent leur
  état actif avec `aria-pressed`, tout en restant des boutons natifs.
- La recette clavier à 320 et 1440 px confirme le focus par nom, l'activation par
  `Espace` et `Entrée`, un seul état actif et aucun débordement.
- T048F est terminée ; T048 reste ouverte pour la recette lecteur d'écran et les
  comptes nominatifs. Les cinq domaines comptent 398 identifiants uniques : 282
  lignes terminées et 116 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - pagination de file bornée

- La page accepte uniquement un entier de 1 à 10 000 et la taille un entier de
  10 à 50 ; les valeurs mal formées ou hors limites reçoivent une réponse `400`.
- La recherche est limitée explicitement à 80 caractères dans l'interface et
  refusée côté serveur au-delà, sans troncature silencieuse.
- La recette Playwright confirme à 320 et 1440 px qu'une saisie de 100 caractères
  produit un champ et une requête de 80 caractères, sans erreur ni débordement.
- T027B12 est terminée. Les cinq domaines comptent 399 identifiants uniques :
  283 lignes terminées et 116 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - contrat de réponse de file

- La console distingue désormais une ligne de file du détail complet d'une
  demande, notamment pour les informations d'identité absentes de la liste.
- Chaque ligne, compteur, statistique de service, valeur de pagination et droit
  est vérifié avant de remplacer la file visible.
- La recette Playwright avec une réponse volontairement partielle passe à 320 et
  1440 px : file précédente conservée, reprise proposée, aucun crash ni débordement.
- T027B13 est terminée. Les cinq domaines comptent 400 identifiants uniques :
  284 lignes terminées et 116 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - contrat du détail agent

- Les contrats de ligne et de détail sont séparés selon les champs réellement
  fournis par les deux routes.
- Demande, accès, contacts, messages, pièces jointes, rappels et revues sont
  contrôlés avant que la colonne de traitement ne soit affichée.
- La recette Playwright avec un second détail incomplet passe à 320 et 1440 px :
  file conservée, ancien détail retiré, aucune donnée partielle ni erreur écran.
- T027B14 est terminée. Les cinq domaines comptent 401 identifiants uniques :
  285 lignes terminées et 116 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - relectures du détail agent

- La sélection initiale et chaque relecture après modification, réponse, note ou
  rappel passent par une fonction unique qui valide le contrat complet.
- Aucun cast `AgentRequestDetail` ne peut désormais remplacer le contrôle à
  l'exécution avant `setDetail`.
- La recette Playwright note acceptée puis relecture incomplète passe à 320 et
  1440 px : état valide conservé, alerte explicite et aucune erreur navigateur.
- T027B15 est terminée. Les cinq domaines comptent 402 identifiants uniques :
  286 lignes terminées et 116 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - réponses auxiliaires agent

- Les modèles de réponse chargés ou créés sont validés et limités aux variables
  connues avant d'atteindre l'interface.
- Les pièces jointes s'ouvrent uniquement via une URL HTTPS signée de l'origine
  Supabase configurée, avec expiration courte et sans accès retour à la console.
- La recette Playwright liste incomplète et lien `javascript:` passe à 320 et
  1440 px : repli intégré, navigation refusée, fenêtre fermée et zéro crash.
- T027B16 est terminée. Les cinq domaines comptent 403 identifiants uniques :
  287 lignes terminées et 116 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - reprise du détail agent

- Les erreurs de file, de détail et d'action sont séparées ; une panne de dossier
  peut être relancée sans perdre la file ni masquer un besoin de connexion ou MFA.
- Un compteur de lecture empêche les réponses concurrentes d'un même dossier ou
  d'une ancienne sélection de modifier l'écran.
- La recette Playwright `503` puis reprise passe à 320 et 1440 px : file visible,
  deux lectures, détail restauré, alerte retirée et aucune erreur navigateur.
- T027B17 est terminée. Les cinq domaines comptent 404 identifiants uniques :
  288 lignes terminées et 116 ouvertes.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

## 8. Prochain ordre recommande

1. Publier et tester le pré-triage ordinateur portable avec des données fictives.
2. Installer puis éprouver le worker d'emplois du temps sur données fictives,
   avant tout dépôt réel ; construire ensuite le lien agent limité à une page.
3. Reprendre le skill ENT après ouverture de l'accès administrateur du référent.
4. Terminer le retour email, la sauvegarde, les tests de charge et les comptes
   agents nominatifs.
5. Migrer le reste du site et envisager la bascule seulement après convergence.

### Jalon du 30 août 2026 - URL signées des médias publics

- Les médias éditoriaux publics acceptent uniquement l'origine Supabase HTTPS
  configurée et les deux formats de stockage réellement produits par le projet.
- Un seul jeton signé borné est accepté ; paramètres parasites, fragments,
  identifiants, encodages et traversées inattendues sont refusés avant rendu.
- T036L est terminée. Le contrôle comportemental reste dans la barrière de
  sécurité permanente et n'utilise que des URL fictives.
- Chromium confirme à 320 et 1 440 px un seul chargement légitime, aucun
  chargement hostile, aucune erreur et aucun débordement horizontal.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - client PDF authentifié

- Les PDF administratifs sont lus en flux avec un plafond de 20 Mo, un type MIME
  PDF obligatoire et une signature `%PDF-` vérifiée avant création du Blob.
- Les erreurs réutilisent le lecteur JSON borné ; les fenêtres sont isolées et
  les liens externes limités au portail HTTPS ou à l'origine Supabase configurée.
- T037I est terminée avec des tests de dépassement annoncé et chunké, de faux
  contenu, d'origine hostile et d'isolation de fenêtre, uniquement sur données
  synthétiques.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - réponses du fournisseur IA bornées

- Les quatre parcours IA partagent un lecteur JSON de 2 Mo : assistant,
  traduction, contenus publics et communications internes.
- Les tailles annoncées excessives sont refusées avant lecture et les flux
  chunkés excessifs sont annulés ; aucun appel fournisseur n'est exécuté par le
  test.
- T037J est terminée et la vérification reste dans la barrière de sécurité.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - téléchargements des workers bornés

- Cinq workers vérifient désormais le volume enregistré, le plafond métier et la
  taille du Blob avant toute copie complète en mémoire.
- Les pièces entrantes Brevo sont lues en flux et annulées au-delà de 10 Mo,
  même sans taille HTTP annoncée.
- T037K est terminée avec des tests synthétiques ; aucun worker, stockage,
  antivirus ou fichier réel n'a été exécuté.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - accusés Brevo bornés

- L'API et le worker email limitent les accusés JSON Brevo à 256 Ko et annulent
  les flux chunkés excessifs.
- Les doublons HTTP 400 restent reconnus comme succès idempotents, sans second
  envoi ; les réponses illisibles restent des erreurs fournisseur.
- T037L est terminée uniquement avec des réponses synthétiques, sans email ni
  consommation fournisseur.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - confirmation de pièce jointe bornée

- La route de confirmation vérifie désormais la taille réelle du Blob et son
  égalité avec la réservation avant toute copie en mémoire.
- Les fichiers vides, surdimensionnés, incohérents ou illisibles passent en
  `blocked` ; seuls les fichiers conformes rejoignent la quarantaine antivirus.
- T037M est terminée avec des Blobs synthétiques, sans stockage ni donnée réelle.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - ancien import administratif borné

- L'ancien écran CSV/Excel refuse désormais plus de 10 Mo ou 5 000 lignes avant
  de poursuivre ; le seuil couvre l'effectif annoncé de 4 200 personnes.
- Les routes élèves et enseignants reconstruisent des lignes bornées depuis une
  liste blanche et limitent leur corps HTTP à 5 Mo.
- T037N est terminée avec des données synthétiques, sans export ni base réelle.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - matrice locale bornée avant lecture

- La matrice Markdown des scénarios est refusée au-delà de 100 Ko avant
  `file.text()`, puis reste soumise aux plafonds et contrôles du parseur.
- T046C est terminée sans upload, stockage, donnée réelle ou appel IA.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - corps des requêtes IA bornés

- L'assistant public est limité à 32 Ko et les deux aides de rédaction à 64 Ko
  avant validation, limite de débit ou appel fournisseur.
- T037O est terminée par analyse statique et tests locaux, sans appel OpenAI.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - mutations agent bornées

- Les décisions, modèles et mises à jour agent ont des plafonds HTTP de 4 ou
  8 Ko ; la reprise technique sans payload désactive le parseur de corps.
- T037P est terminée par tests locaux, sans compte, donnée ou base distante.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - commandes du répertoire des identités bornées

- La réservation d'un fichier est limitée à 8 Ko ; les consultations,
  approbations, activations et retraits sont limités à 4 Ko avant validation.
- La confirmation d'un dépôt ne lit aucun corps HTTP et le fichier de 50 Mo
  maximum continue de transiter directement vers le stockage privé signé.
- T037Q est terminée par analyse statique et tests locaux, sans donnée réelle,
  compte distant ou modification Supabase.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - mutations du centre de communications bornées

- Les brouillons, limités métier à 100 000 caractères, ont un plafond HTTP de
  512 Ko ; les modèles, limités à 20 000 caractères, ont un plafond de 128 Ko.
- Les demandes de vérification, validations, publications et réservations de
  documents sont limitées à 4 Ko avant leur contrôle métier.
- Les fichiers PDF et DOCX continuent de transiter directement vers le stockage
  privé signé ; les rôles rédaction, direction et publication restent séparés.
- T037R est terminée par analyse statique et tests locaux, sans communication,
  donnée réelle, compte distant ou modification Supabase.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - commandes d'emploi du temps bornées

- La réservation d'un PDF est limitée à 8 Ko ; approbation, activation,
  restauration et association de page sont limitées à 4 Ko.
- La confirmation du dépôt et la vérification d'une page n'acceptent aucun
  payload et désactivent le parseur de corps Vercel.
- Le PDF de 50 Mo maximum continue de transiter directement vers le stockage
  privé signé ; le rôle de gestionnaire reste exigé sur les sept commandes.
- T037S est terminée par analyse statique et tests locaux, sans emploi du temps
  réel, compte distant ou modification Supabase.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - mutations du registre de connaissances bornées

- Les créations et versions de compétences sont limitées à 64 Ko, les preuves
  d'évaluation à 32 Ko et les métadonnées documentaires à 16 Ko.
- Les actions et revues sont limitées à 4 Ko ; la confirmation d'un dépôt ne lit
  aucun payload et désactive le parseur de corps Vercel.
- Les documents de 50 Mo maximum continuent de transiter directement vers le
  stockage privé signé ; le rôle de gestionnaire reste exigé partout.
- T037T est terminée par analyse statique et tests locaux, sans document réel,
  appel IA, compte distant ou modification Supabase.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - mutations de gestion éditoriale bornées

- Les contenus et modèles de 30 000 caractères maximum ont un plafond HTTP de
  256 Ko ; les actions sont limitées à 8 Ko.
- Les réservations de média et commandes de reprise sont limitées à 4 Ko ; la
  confirmation sans payload désactive le parseur de corps Vercel.
- Les médias de 10 Mo maximum continuent de transiter directement vers le
  stockage privé signé ; les rôles éditeur et publication restent séparés.
- T037U est terminée par analyse statique et tests locaux, sans publication,
  média réel, compte distant ou modification Supabase.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - mutations historiques bornées

- Les huit routes historiques encore concernées ont désormais un plafond HTTP
  explicite de 8 à 128 Ko selon leur contrat métier.
- Les paramètres établissement passent par une liste blanche validée : les
  champs techniques ou inconnus ne peuvent plus être écrits dans le modèle.
- UAI, email, téléphone, année scolaire et périodes sont normalisés et validés
  avant toute insertion ou modification.
- T037V est terminée par tests locaux, sans donnée réelle, compte distant ou
  modification Supabase.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - RLS et concurrence du guichet prouvées

- La migration `20260830150000_force_support_private_rls.sql` est appliquée
  uniquement sur la branche Supabase de preview. Les seize tables privées
  `support_*` ont la RLS activée et forcée, sans droit direct pour `anon` ou
  `authenticated`.
- Vingt transactions parallèles de dix demandes fictives ont produit exactement
  200 dossiers, messages, contacts, sessions, liaisons et travaux dans une file
  temporaire isolée. Une course de vingt transactions sur la même clé a produit
  un seul gagnant et un seul ensemble de dépendances.
- Le nettoyage contrôlé a ramené dossiers, sessions et tables de file à zéro.
  Le script répétable inclut désormais cette course d'idempotence et conserve ses
  verrous stricts de cible preview.
- T011 et T012A de la spécification 001 sont terminées. Le brief Claude reste
  préparé mais non exécuté faute de modèle exact et de plafond propres à cette
  mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - convergence du pipeline documentaire agent

- Une nouvelle preuve locale passe 51 contrôles sur la réservation privée,
  l'extraction PDF/DOCX/XLSX/PPTX/TXT/CSV, les limites d'archives, les secrets,
  les injections, la validation humaine, les extraits minimaux et la rétention
  fermée par défaut.
- La branche Supabase de preview confirme le bucket `knowledge-ingest` privé et
  limité à 50 Mo, la file `knowledge_document_scan`, la RLS forcée sur les
  documents et l'absence de droit direct pour `anon` et `authenticated`.
- Un document validé sous MFA produit uniquement une source en brouillon. Sa
  publication demeure une action humaine séparée ; l'agent ne reçoit ensuite que
  des extraits publiés, autorisés, datés et bornés, jamais le fichier brut.
- T014C et T019 de la spécification 002 ainsi que T009 de la spécification 005
  sont alignées comme terminées. Aucun document, interrupteur ou environnement
  réel n'a été activé.

### Jalon du 30 août 2026 - dérive de l'ancien site contrôlée

- Une commande en lecture seule compare désormais l'inventaire versionné aux
  pages et articles publics du WordPress officiel, avec origine codée en dur,
  redirections refusées, délai de 15 secondes et réponse limitée à 1 Mo.
- La preuve réelle retrouve 28 contenus sur 28, sans ajout, retrait ni
  modification de titre, date ou adresse. Elle rapproche aussi 81 médias
  accessibles sur 81, conserve l'écart public de 83 déclarés pour 81 accessibles
  et vérifie 9 catégories sur 9, sans télécharger les fichiers.
- T018B de la spécification 004 est terminée. T018 reste ouverte pour la relecture
  visuelle et éditoriale humaine et les trois médias refusés restent bloquants.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - phase 7 du portail convergée

- Les tâches générales du portail sont rapprochées des preuves spécialisées :
  T053A confirme l'inventaire technique et T054A l'import réversible de 28
  brouillons, sans fermer les validations humaines parentes.
- T055 est terminée sur la preuve complète de la spécification 003 : modèles,
  dates, aperçu mobile/ordinateur, programmation, retrait, historique, médias
  privés, droits et flux public testés.
- Aucune page n'est vérifiée ou publiée par cette convergence. Les propriétaires,
  dates de revue et validations des services restent à renseigner.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - documents dans les réponses agent

- L'agent peut préparer cinq documents au maximum dans le bucket privé
  `support-quarantine`. Le dépôt signé reste borné à 10 Mo et aux formats déjà
  admis ; le compte, l'établissement et le service sont contrôlés avant écriture.
- La confirmation compare la taille réservée, vérifie la signature binaire et
  réutilise la file ClamAV. Le document ne devient public que s'il est propre et
  si sa liaison au message, sa date de libération et l'agent validateur sont
  écrits dans la même transaction.
- Un brouillon agent n'est jamais renvoyé par l'API publique. Un document publié
  s'ouvre par une URL privée de 60 secondes ; l'email indique sa présence sans
  joindre le binaire. Les demandes ENT et email académique non confirmées
  interdisent toute pièce sortante.
- La migration `20260830170000_add_agent_reply_attachments.sql` est appliquée
  uniquement sur `guichet-lycee-preview`. Les contraintes sont présentes, la
  RLS reste forcée et `anon`/`authenticated` n'ont aucun droit direct.
- Le build, six tests dédiés et toute la barrière de sécurité passent sur 99
  routes, dont 68 privées. Le brief Claude est préparé mais non exécuté faute de
  modèle exact et de plafond propres à cette mission ; aucun jeton externe n'a
  été consommé.

### Jalon du 30 août 2026 - retrait des brouillons de réponse agent

- Un agent peut retirer uniquement un document qu'il a lui-même préparé, encore
  sans message ni libération, et dont le contrôle est terminé avec `clean`,
  `blocked` ou `scan_error`.
- La route vérifie établissement, service et propriétaire, applique la limite de
  débit, inscrit `removal_pending`, supprime le fichier privé puis la ligne et
  écrit un audit sans nom de fichier. Une panne Storage replace le brouillon en
  erreur reprenable. Un document déjà envoyé ou encore analysé est refusé.
- La réponse et le retrait utilisent le même verrou transactionnel de dossier :
  une course ne peut jamais réussir des deux côtés. L'interface affiche une
  corbeille seulement pour les brouillons déclarés retirables par le serveur.
- La migration `20260830180000` est appliquée uniquement à
  `guichet-lycee-preview`. La contrainte contient `removal_pending`, la RLS reste
  forcée et les rôles clients n'ont aucun droit direct sur la table.
- Le build, les sept tests dédiés et la barrière complète passent sur 99 routes,
  68 routes privées et 79 migrations. Les vues à 1 265 px et 375 px restent sans
  débordement ni erreur de console.
- Le brief Claude est préparé mais non exécuté, faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - supervision des retraits interrompus

- L'écran direction de santé des demandes compte désormais les brouillons agent
  dont le retrait est resté en cours ou a échoué après l'appel au stockage.
- Le calcul filtre l'établissement actif, la direction `agent`, l'absence de
  message et l'absence de libération. La réponse ne contient aucun nom de
  fichier, chemin privé, contenu, numéro de dossier ou identité.
- Un retrait à reprendre rend la santé non nominale, mais n'entraîne aucune
  suppression ni réparation automatique. Seul l'agent propriétaire reprend
  explicitement l'opération depuis son dossier.
- T057A est terminée sans migration, donnée réelle ni action distante. T057
  reste ouverte pour la sauvegarde restaurable, les alertes et la procédure
  d'incident. Le brief Claude est préparé mais non exécuté faute de modèle exact
  et de plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - journal d'accès aux pièces du guichet

- Chaque lien privé délivré à un demandeur ou un agent produit désormais
  `attachment.download_link_issued` après signature réussie et avant la réponse.
- L'accès demandeur exige la session liée au dossier. L'accès agent exige le
  compte, l'établissement et le service. La trace conserve seulement
  l'identifiant opaque de la pièce, sa direction et l'expiration de 60 secondes.
- Le nom, le bucket, le chemin, l'URL signée et le contenu restent exclus. Les
  limites sont de 120 ouvertures par session sur dix minutes et de 600 par
  compte agent sur une heure, avec des clés HMAC pseudonymes.
- La migration `20260830190000` est appliquée uniquement à
  `guichet-lycee-preview`. Les deux portées sont présentes, la contrainte HMAC
  demeure, la RLS est activée et forcée et les rôles clients n'ont aucun droit.
- T034A de la spécification 001 et T020B de la spécification 002 sont terminées.
  Le brief Claude est préparé mais non exécuté faute de modèle exact et de
  plafond propres à cette mission ; aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - accès direct aux demandes pour les agents

- Le shell authentifié affiche désormais une entrée unique `Demandes` pour le
  superadministrateur, l'administration, les agents de service et la direction.
- Cette entrée ouvre la file agent existante sans modifier les pages d'accueil,
  les rôles, l'établissement actif ni les gardes de service côté serveur.
- Le contrat local vérifie la présence unique de la file et des validations, la
  page d'accueil de l'agent, la navigation nommée, Échap et la gestion du focus.
- T056B de la spécification 002 est terminée sans migration, donnée réelle,
  compte distant ni changement de production. Le brief Claude est préparé mais
  non exécuté faute de modèle exact et de plafond propres à cette mission ;
  aucun jeton externe n'a été consommé.

### Jalon du 30 août 2026 - relance confirmée par la transaction

- La relance manuelle d'un échec ne renvoie plus un simple booléen. Elle retourne
  un reçu lié à l'échec, au nouvel essai et à l'événement audité dans la même
  transaction.
- L'horodatage provient de la ligne d'événement retournée par PostgreSQL. La
  console valide l'opération, les UUID, la référence et une fenêtre de cinq
  minutes avant d'afficher que la relance est remise dans la file.
- Une preuve absente, mal formée, discordante, ancienne ou future produit une
  erreur explicite et invite à actualiser, sans inventer de réussite.
- T028B de la spécification 002 est terminée sans migration, compte distant,
  donnée réelle ni production. T028 reste ouverte pour le premier adaptateur
  métier complet du registre d'actions. Le brief Claude est préparé mais non
  exécuté faute de modèle exact et de plafond propres à cette mission ; aucun
  jeton externe n'a été consommé.

### Jalon du 31 août 2026 - modification de dossier confirmée par la transaction

- Toute modification manuelle d'une demande agent produit désormais un reçu à
  partir de l'événement `request.updated` écrit dans la même transaction que le
  dossier.
- Le reçu lie le numéro public, la révision connue avant écriture, la nouvelle
  révision, l'heure PostgreSQL et une corrélation opaque. Une fenêtre de cinq
  minutes borne sa fraîcheur et interdit une révision antérieure.
- L'interface valide d'abord le reçu, relit ensuite le dossier et refuse de le
  rafraîchir si sa révision ne correspond pas exactement à celle annoncée. Une
  ancienne preuve du même dossier ne peut donc pas confirmer une nouvelle action.
- T028C de la spécification 002 est terminée sans migration, compte distant,
  donnée réelle ni production. T028 reste ouverte pour le premier adaptateur
  métier complet du registre d'actions. Le brief Claude est préparé mais non
  exécuté dans l'attente du modèle et du plafond explicitement confirmés ; aucun
  jeton externe n'a été consommé pour ce lot.

### Jalon du 31 août 2026 - réponse agent récupérable et confirmée

- Une réponse agent ne vide plus son éditeur sur le seul succès HTTP. Le reçu
  lie le dossier, le message, le canal, sa création et l'événement transactionnel
  `reply.queued` ou `callback.created`.
- La même composition conserve sa clé d'idempotence après une erreur réseau. Un
  rejeu retrouve le message existant seulement si son texte et ses pièces sont
  identiques et si la trace correspondante est présente ; une clé réutilisée
  pour un autre contenu est refusée.
- L'interface valide le reçu, relit le détail et exige le même identifiant, la
  direction sortante et le même horodatage avant d'effacer texte, traduction et
  sélection de documents. Un reçu invalide conserve donc le travail de l'agent.
- T028D de la spécification 002 est terminée sans envoi, migration, compte
  distant, donnée réelle ni production. T028 reste ouverte pour le premier
  adaptateur complet du registre d'actions. Le brief Claude est préparé mais non
  exécuté dans l'attente de l'autorisation bornée de cette mission.

### Jalon du 31 août 2026 - message demandeur récupérable et confirmé

- Un message de suivi public ne vide plus son éditeur sur un simple succès HTTP.
  Le reçu lie le dossier, le message, sa création et l'événement transactionnel
  `message.received`.
- Une tentative conserve la même clé tant que son dossier et son texte ne
  changent pas. Un rejeu retrouve seulement le même texte et exige la trace
  correspondante ; une clé réutilisée pour un autre contenu est refusée.
- L'interface valide le reçu, relit le dossier et exige le même identifiant, la
  direction entrante et le même horodatage avant d'effacer la saisie. Une panne
  ou une preuve invalide conserve donc le message pour un nouvel essai sûr.
- T028E de la spécification 002 est terminée sans notification, migration,
  donnée réelle ni production. T028 reste ouverte pour le premier adaptateur
  complet du registre d'actions. Le brief Claude est préparé en lecture seule ;
  aucune exécution externe n'est comptée tant que son lancement n'est pas borné.

### Jalon du 31 août 2026 - note interne récupérable et confirmée

- Une note interne ne vide plus son éditeur sur le seul succès HTTP. Le reçu lie
  le dossier, le message, sa création et l'événement transactionnel
  `note.created`, sans exposer le texte ni l'identifiant de l'agent.
- Une tentative conserve la même clé tant que son dossier et son texte ne
  changent pas. Un rejeu retrouve uniquement une note du même auteur avec le
  même texte et exige la trace correspondante.
- La console valide le reçu, relit le dossier et exige le même identifiant, la
  direction interne et le même horodatage avant d'effacer la note. Une coupure
  conserve donc le diagnostic pour un nouvel essai sans doublon.
- T028F de la spécification 002 est terminée sans migration, donnée réelle ni
  production. T028 reste ouverte pour le premier adaptateur complet du registre
  d'actions. Aucun audit externe n'a été exécuté sans autorisation bornée.

### Jalon du 31 août 2026 - cycle des rappels récupérable et confirmé

- Programmer, prendre, terminer ou annuler un rappel exige désormais une clé
  UUID stable et un reçu issu de l'événement exact de la transaction.
- La création produite depuis une réponse téléphonique inscrit aussi
  l'identifiant du rappel dans `callback.created`. Les deux chemins de création
  sont donc reliés au même objet auditable. Si un rappel actif est repris, un
  événement `callback.creation_reused` conserve la nouvelle clé sans créer de
  doublon, y compris si son reçu réseau est perdu puis que son état évolue.
- Après une coupure, un rejeu retrouve l'action par sa corrélation. Il vérifie le
  dossier, le rappel, l'agent, la transition et, pour terminer ou annuler, le
  résultat normalisé. Une clé discordante est refusée.
- La console relit le rappel et son état avant tout succès. Le résultat d'appel
  reste dans l'éditeur tant que la terminaison n'est pas prouvée et relue.
- T028G de la spécification 002 est terminée sans migration, appel réel, donnée
  réelle ni production. T028 reste ouverte pour le premier adaptateur complet
  du registre d'actions. Aucun audit externe n'a été exécuté sans autorisation
  bornée.

### Jalon du 31 août 2026 - retrait de brouillon agent récupérable

- Le retrait d'une pièce préparée par un agent conserve une clé UUID tant que la
  même pièce est affichée, puis exige un reçu issu de l'événement final.
- `attachment.draft_removed` confirme la première suppression et
  `attachment.draft_removal_reused` confirme une reprise concurrente sans créer
  de seconde mutation. Un rejeu avec la même clé reste vérifiable après la
  disparition de la ligne de pièce.
- La console relit le détail du dossier et exige l'absence de l'identifiant avant
  de retirer le brouillon de l'écran. Une preuve invalide ou une relecture en
  échec conserve la même clé pour un nouvel essai.
- Le reçu et les événements de reprise n'exposent ni nom de fichier, ni chemin de
  stockage, ni URL, ni contenu. T028H est terminé sans migration, fichier réel ou
  production ; T028 reste ouverte pour un adaptateur du registre d'actions.

### Jalon du 31 août 2026 - réservation de pièce agent récupérable

- Une réservation de pièce agent possède désormais une clé UUID stable et une
  empreinte SHA-256 des métadonnées déclarées. Le serveur retrouve la même ligne
  seulement pour le même dossier, le même agent et le même fichier.
- Si le dépôt est encore en attente, un rejeu délivre un nouveau jeton privé pour
  le chemin déjà réservé avec écrasement contrôlé. Si le fichier est déjà
  confirmé, aucun nouveau jeton n'est émis.
- La console conserve l'état de chaque fichier d'un lot partiellement réussi.
  Une réponse de réservation perdue reste donc reprenable, même lorsque les cinq
  emplacements du dossier existent déjà côté serveur.
- La confirmation applique une transition conditionnelle de
  `awaiting_upload` vers son état contrôlé. Deux confirmations concurrentes ne
  créent ainsi qu'un événement et qu'un travail antivirus.
- `attachment.draft_reserved` ne conserve ni nom, ni chemin, ni URL, ni jeton,
  ni contenu. T028I est terminé sans migration, fichier réel ou production ;
  T028 reste ouverte pour un adaptateur du registre d'actions. Aucun audit
  externe n'a été exécuté sans autorisation bornée.

### Jalon du 31 août 2026 - réservation de pièce demandeur récupérable

- Chaque pièce jointe du demandeur utilise une clé UUID stable et une empreinte
  SHA-256 de toutes les métadonnées déclarées, y compris le contexte du document.
  Le serveur retrouve la même ligne uniquement pour le même dossier, la même
  session et le même fichier.
- Une réservation en attente peut délivrer un nouveau jeton privé pour le même
  chemin avec écrasement contrôlé. Une réservation déjà confirmée ne délivre
  plus de jeton, et une réutilisation discordante est refusée.
- La confirmation passe atomiquement de `awaiting_upload` à son état contrôlé.
  Deux confirmations concurrentes ne créent qu'un événement et qu'un travail
  antivirus.
- Le navigateur conserve séparément les fichiers d'un lot partiellement réussi.
  Il peut reprendre une tentative connue lorsque les cinq emplacements sont déjà
  réservés et n'envoie pas une seconde fois les fichiers déjà confirmés.
- Le suivi accepte désormais une pièce seule : un parent ou un élève n'est pas
  obligé d'ajouter un nouveau message pour reprendre un dépôt interrompu.
- `attachment.draft_reserved` ne conserve ni nom, ni chemin, ni URL, ni jeton,
  ni contenu. T037AC de la spécification 001 est terminée sans migration, fichier
  réel ou production. Aucun audit externe n'a été exécuté sans autorisation
  bornée.

### Jalon du 31 août 2026 - retrait de brouillon demandeur récupérable

- Le demandeur peut retirer uniquement une pièce qu'il a réservée dans la même
  session et qui est interrompue, refusée, en erreur ou déjà en cours de retrait.
  Un fichier en contrôle ou propre reste dans le dossier et n'est jamais rendu
  supprimable par le navigateur.
- Le serveur marque d'abord la ligne `removal_pending`, retire l'objet du stockage
  privé puis supprime la ligne sous le verrou du dossier. Un échec Storage revient
  à `scan_error`, afin que le retrait puisse être repris sans disparition muette.
- `attachment.draft_removed` confirme la première suppression et
  `attachment.draft_removal_reused` confirme une reprise concurrente. La clé UUID
  est liée au dossier, à la session et à l'identifiant opaque de la pièce.
- Le navigateur conserve la clé jusqu'au reçu puis relit le dossier et exige
  l'absence exacte de la pièce avant de libérer une place. Les états d'un dépôt
  interrompu ne bloquent donc plus définitivement les cinq emplacements.
- Les événements ne contiennent ni nom, ni chemin, ni URL, ni jeton, ni contenu.
  T037AD est terminé sans migration, fichier réel ou production. Le brief Claude
  est seulement préparé ; aucun modèle externe n'a été lancé.

### Jalon du 31 août 2026 - reprise de pièce après redémarrage

- Une tentative de pièce demandeur interrompue survit désormais à une fermeture
  complète du navigateur. La personne sélectionne à nouveau le même fichier et
  l'empreinte SHA-256 locale retrouve la clé UUID et la réservation existante.
- IndexedDB conserve au plus vingt opérations pendant sept jours. Une entrée
  contient seulement l'empreinte, le numéro public, la clé UUID et éventuellement
  l'identifiant opaque de la pièce ; aucun fichier, nom, contenu, chemin, jeton
  ou URL n'est persisté.
- Une confirmation de dépôt, un retrait confirmé et « Oublier les demandes »
  nettoient l'état local. Les entrées invalides, expirées ou excédentaires sont
  purgées automatiquement.
- T037AE est terminé sans migration, fichier réel, donnée réelle ni production.
  Un brief Claude borné est préparé mais non exécuté ; aucun jeton externe n'a
  été consommé.

### Jalon du 31 août 2026 - restauration locale du coffre d'identités

- Un vérificateur local contrôle un lot chiffré borné à 250 lignes, son périmètre
  établissement/import, la forme exacte de chaque enveloppe, sa version de clé
  et son déchiffrement. Son reçu contient seulement un compte, les versions et
  une empreinte SHA-256 agrégée.
- La recette utilise trois personnes strictement fictives, un artefact de base
  et un document Storage fictif. Le paquet de sauvegarde est chiffré avec une
  clé distincte et n'expose ni chemin source, ni contenu, ni identité.
- Après restauration, l'empreinte chiffrée est identique. Toutes les enveloppes
  `v1` et `v2` sont ensuite rechiffrées en `v3`, revérifiées sans charger les
  anciennes clés, puis soumises au contrôle de retrait logique.
- Les clés absentes, lignes supplémentaires en clair, doublons, mauvais
  périmètre, ciphertext altéré, mauvais secret de sauvegarde et lots hors limite
  sont refusés. T010B2C7 est terminé sans accès distant, donnée réelle,
  migration ni production. Le brief Claude est préparé mais non exécuté.

### Jalon du 31 août 2026 - tableau de santé borné et cohérent

- La console direction traite désormais les réponses santé et mesures IA comme
  des données inconnues. Elle valide leur forme exacte, leurs limites et leurs
  relations avant de remplacer l'affichage existant.
- Les compteurs sont entiers et bornés, les dates sont strictes, les catégories
  et résultats sont connus et uniques, les listes respectent les plafonds API et
  les totaux, taux, décisions de classement et séries quotidiennes se recoupent.
- Une réponse santé invalide ferme tout le tableau. Une réponse de mesures IA
  invalide masque uniquement ce module, en conservant la santé opérationnelle.
- Une panne antivirus peut entrer dans la file d'échec mais n'est pas une
  notification relançable. Elle reste visible avec « Intervention manuelle » ;
  seules les quatre notifications idempotentes conservent l'action `Relancer`.
- T057B est terminé sans migration, donnée réelle ou production. Un brief Claude
  borné est préparé mais non exécuté tant que le modèle et le plafond propres à
  cette revue ne sont pas fixés.

### Jalon du 31 août 2026 - conduite à tenir locale

- La santé Direction transforme désormais les compteurs validés en étapes
  courtes pour la file d'échec, la chaîne email, l'antivirus et les retraits de
  brouillons. L'état nominal conserve une seule consigne de surveillance.
- Le résumé technique copiable contient uniquement l'heure serveur et six
  compteurs. Il ne lit ni dossier, ni identité, ni coordonnées, ni message, ni
  erreur détaillée, ni fichier, et la réussite apparaît seulement après la copie.
- Cette aide n'envoie aucune alerte et ne lance aucune réparation, suppression
  ou restauration. Les responsables, seuils métier, canaux externes et la
  restauration distante restent des portes humaines de T057.
- T057C est terminé sans migration, service distant, donnée réelle ou
  production. Le brief Claude est préparé mais non exécuté sans accord borné.

### Jalon du 31 août 2026 - réponses documentaires de communication

- La console Communications valide désormais à l'exécution la liste des
  documents, la réservation signée et la confirmation avant tout effet sensible.
- Le contrat impose les clés exactes, cent documents au plus, des identifiants et
  dates valides, les deux types autorisés, dix mégaoctets maximum et les états
  connus. Il recoupe aussi le rattachement d'une source déjà utilisée.
- La réservation doit reprendre exactement le fichier choisi, le bucket privé
  gouverné et un chemin aléatoire PDF ou DOCX ; le jeton est borné et ne peut
  contenir d'espace ou de caractère de contrôle.
- Une réponse invalide bloque l'accès Storage. Après transfert, seule une
  confirmation du même document dans un état postérieur au dépôt autorise le
  message de quarantaine ; sinon le choix reste visible pour vérification.
- T011D2 est terminé sans activation, téléversement réel, migration, donnée
  réelle ou production. T011D reste ouvert pour la recette ClamAV fictive. Le
  brief Claude est préparé mais non exécuté sans accord borné.

### Jalon du 31 août 2026 - chargement fiable de la console Communications

- Les réponses de communications, modèles, échecs et entrants sont désormais
  lues comme inconnues et validées avec le contrat documentaire avant tout
  remplacement d'état visible.
- Chaque liste est bornée à la projection serveur, triée et sans doublon. Les
  statuts, dates, catégories, versions, slugs, faits et questions sont validés,
  et une publication exige la visibilité, le slug et la date publics cohérents.
- Les six modèles officiels doivent tous être présents. Un modèle local non
  personnalisé doit rester identique au catalogue ; une personnalisation exige
  un identifiant, une version et une date valides.
- Les échecs restent limités aux travaux d'envoi ou de reprise. Un entrant sans
  communication reste sans titre ; un entrant rattaché doit avoir son titre.
  Tout texte révélant un secret ferme le chargement.
- T027D est terminé sans intégration, migration, donnée réelle ou production.
  T027 reste ouvert pour la recette réseau fictive. Le brief Claude est préparé
  mais non exécuté sans autorisation bornée.

### Jalon du 31 août 2026 - confirmations fiables des actions Communications

- La fiche d'une communication et son historique sont désormais lus comme une
  réponse inconnue. L'identifiant doit correspondre à la sélection, les versions
  sont uniques, consécutives et décroissantes, et la version courante concorde
  avec l'état de la communication.
- Création, correction, aide à la rédaction, demande de vérification, validation
  direction, publication, personnalisation d'un modèle et reprise d'un échec ne
  montrent plus de réussite sur la seule présence d'un HTTP 2xx. Chaque réponse
  est validée avant tout effacement, message ou modification d'état visible.
- Une publication exige le même identifiant, l'état publié, la visibilité
  publique, un slug et une date valides. Une validation lie également version et
  date d'approbation. Une reprise confirme exactement création ou idempotence.
- La route de personnalisation d'un modèle ne renvoie plus `institutionId`,
  `createdBy` ou `updatedBy`; seule la projection éditoriale nécessaire revient
  au navigateur.
- T027E est terminé sans intégration distante, migration, donnée réelle ou
  production. T027 reste ouvert pour la recette réseau fictive. Le brief Claude
  est préparé mais non exécuté sans autorisation bornée pour ce lot.

### Jalon du 31 août 2026 - premier adaptateur d'action de l'agent

- `support.create_request` est le premier outil A2 relié au parcours public. Son
  interrupteur serveur reste faux par défaut et aucune variable distante n'a été
  modifiée.
- Le reçu signé lie l'appareil, l'établissement, le routage, la clé d'outil et la
  version active d'une compétence publiée. Une compétence sans cette autorisation
  exacte ne peut pas préparer l'action.
- L'action passe à `running`, puis le dossier et sa preuve `confirmed_at` sont
  écrits dans la même transaction idempotente. Le navigateur refuse le succès si
  la preuve d'action est absente, discordante, ancienne ou future.
- Le registre d'action conserve uniquement catégorie, service, type de demandeur,
  canal et indicateurs booléens. Il exclut identité, coordonnées, objet,
  description, conversation et pièces.
- T028J et T028 sont terminés après la recette runtime de T028K. Aucun audit
  externe n'a été exécuté pour ce lot.

### Jalon du 31 août 2026 - recette runtime de création par l'agent

- La recette a d'abord validé les contraintes directement dans la branche
  Supabase `guichet-lycee-preview`, avec transaction annulée et six compteurs à
  zéro après contrôle indépendant.
- Le vrai code TypeScript a ensuite été exécuté dans un déploiement Vercel isolé,
  protégé par un secret de 128 caractères, limité à `VERCEL_ENV=preview` et avec
  le drapeau activé uniquement pour cette exécution.
- Une compétence et une source publiques fictives ont été sélectionnées. Le reçu
  a été refusé sur un autre appareil, puis l'action A2 et le dossier ont atteint
  `succeeded` avec trois événements d'audit et une preuve `confirmed_at`.
- Le rejeu a retrouvé la même action. Le registre ne contenait que sept champs de
  routage non personnels. La transaction action-dossier a été annulée et la
  compétence supprimée.
- Supabase a confirmé ensuite zéro compétence, source, action et dossier de la
  recette. La route temporaire et six déploiements techniques sans alias ont
  été retirés. Aucun drapeau distant, secret, donnée réelle ou changement de
  production ne subsiste.

### Jalon du 31 août 2026 - priorité opérationnelle des agents

- La console propose désormais une seule priorité lisible à partir des compteurs
  serveur validés : urgence, échéance dépassée enregistrée, classement, absence
  d'agent, vérification interne, rappel, doublon puis file complète.
- Cette proposition ne crée aucun délai, n'attribue aucun dossier et ne déclenche
  ni transfert, réponse, notification ou action IA. Son bouton ouvre uniquement
  le filtre correspondant et retire l'ancien détail de l'écran.
- Une file vide validée est annoncée comme à jour sans bouton d'action. Une panne
  ou l'absence de périmètre masque le guide au lieu d'inventer une file vide. Les
  tests couvrent l'ordre complet, le repli neutre, le clavier et le libellé
  accessible.
- Le rendu Chrome réel passe à 1 440 et 390 px sans erreur navigateur ni
  débordement horizontal. T056C est terminé ; T056 reste ouvert pour les comptes
  individuels et la validation des périmètres réels.

### Jalon du 31 août 2026 - continuité des brouillons agents

- Changer de dossier dans la console ne détruit plus une réponse, une note
  interne, un résultat de rappel ou un motif de clôture en cours. Chaque texte
  est lié au numéro public du dossier et restauré quand l'agent y revient.
- La mémoire reste volontairement limitée à trente dossiers et à la durée de vie
  de l'onglet. Aucun de ces textes n'est écrit dans le stockage persistant du
  navigateur, envoyé à une API ou partagé avec un autre compte avant l'action
  explicite de l'agent.
- Après confirmation serveur et relecture de la donnée attendue, seul le champ
  effectivement enregistré est effacé. Une panne, une réponse invalide ou une
  confirmation absente conserve le brouillon.
- Une recette Chrome avec deux dossiers entièrement fictifs restaure exactement
  le premier texte après un aller-retour, affiche son badge dans la file et ne
  produit ni erreur navigateur ni débordement à 390 px. T056D est terminé.

### Jalon du 31 août 2026 - parcours séquentiel des dossiers agents

- L'agent peut ouvrir le dossier précédent ou suivant sans revenir chercher sa
  ligne dans la file. La navigation reste strictement limitée à la page de trente
  dossiers déjà reçue et validée ; elle ne devine aucun dossier d'une autre page
  et ne déclenche aucune lecture supplémentaire.
- La position `n sur total dans cette page` rend la borne visible. Les deux
  commandes sont indisponibles pendant un chargement, une écriture, un upload ou
  une traduction afin de ne pas masquer une opération en cours.
- Les brouillons volatils restent liés à leur numéro : une recette avec trois
  dossiers fictifs saisit un texte dans le deuxième, ouvre le troisième, revient
  au deuxième et retrouve exactement le texte. Axe confirme zéro violation et
  zéro point incomplet sur l'en-tête ; Chrome confirme zéro débordement à 390 et
  1 440 px. T056E est terminé sans API, stockage ou permission supplémentaire.

### Jalon du 31 août 2026 - file agent non ambiguë

- Le navigateur refuse désormais une réponse de file qui répète un numéro public
  ou un agrégat de service. La sélection, les brouillons et la navigation ne
  peuvent donc pas être associés à deux lignes concurrentes portant la même clé.
- Page, taille, total, nombre de pages et quantité de lignes doivent former un
  ensemble cohérent. Une page vide alors que le total annonce encore des dossiers,
  une page hors limites ou plus de lignes que la taille déclarée produit une
  erreur explicite sans remplacer la file connue.
- Les règles sont isolées dans un helper pur, testées avec des pages pleines,
  finales, vides, dupliquées et contradictoires, puis rejouées par la porte de
  sécurité. T027B18 est terminé sans nouvelle donnée, permission ou requête.

### Jalon du 31 août 2026 - contrat borné de la file agent

- Les lignes de la file ne sont plus acceptées sur leur seule forme générale.
  Numéro public, profils, noms, contexte, catégorie, objet, statut, priorité,
  affectation et dates suivent désormais les formats, nomenclatures et limites
  déjà imposés lors de la création d'une demande.
- Le contexte est limité à vingt clés et à 700 caractères par valeur afin qu'une
  réponse anormale ne puisse pas saturer l'écran. Les services, rôles et listes
  de périmètre sont fermés, bornés et sans doublon.
- Les compteurs doivent être des entiers sûrs. Pour chaque service, urgence,
  retard et absence d'agent ne peuvent pas dépasser le nombre de dossiers
  ouverts. Neuf tests ciblés rejouent les cas valides et les refus. T027B19 est
  terminé sans base distante, donnée réelle, permission ou changement de
  production.

### Jalon du 31 août 2026 - détail agent minimal et borné

- La lecture d'un dossier ne diffuse plus les lignes SQL complètes. La demande
  et les messages sont projetés sur leurs seuls champs visibles ; empreintes
  d'idempotence, références fournisseur, empreinte réseau et identifiants
  techniques inutiles restent exclusivement côté serveur.
- Le navigateur exige la liste exacte des champs autorisés. Il borne à dix
  contacts, cinq cents messages, dix pièces et cent rappels, puis contrôle UUID,
  dates, états, tailles, ordre chronologique, unicité et références entre
  messages, pièces, téléphones et rappels.
- Les combinaisons impossibles sont refusées : identité confirmée sans registre,
  rappel terminé sans résultat, brouillon agent contradictoire ou revue sans date
  de décision. Les valeurs nulles créées légitimement lors d'une remise à zéro
  d'identité restent compatibles avec le contexte borné. Six scénarios ciblés
  passent. T027B20 est terminé sans production, base distante ou donnée réelle.
## 2026-08-31 - Détail agent borné côté serveur

- T027B21 partage les plafonds de contacts, messages, pièces et rappels entre la
  route agent et le validateur d'exécution.
- Les requêtes lisent au plus `plafond + 1` et refusent explicitement le
  dépassement avant de construire une réponse : aucun historique partiel n'est
  présenté comme complet.
- Le lot reste limité à la preview, sans migration, donnée réelle ni modification
  de production.
## 2026-08-31 - Suivi public borné côté serveur

- T016G partage les plafonds de messages et pièces entre la route publique et
  son validateur navigateur.
- L'API lit au plus `plafond + 1`, refuse tout dépassement avant la réponse et
  ne présente jamais une conversation partielle comme complète. La recherche
  d'un contact vérifié s'arrête à la première preuve utile.
- Le lot reste limité à la preview, sans donnée réelle, migration ou production.
## 2026-08-31 - Contexte et historique publics minimisés

- T016H retire du détail public les résumés internes, motifs de routage,
  identifiants d'agent et métadonnées de clôture conservés dans le contexte brut.
- Le navigateur exige désormais un contrat exact partagé : champs connus,
  identité cohérente, états de pièces permis, ordre chronologique, identifiants
  uniques et rattachements à un message visible.
- Le lot reste limité à la preview, sans donnée réelle, migration ni production.
## 2026-09-01 - Liste publique bornée et exacte

- T016I limite la lecture serveur de `Mes demandes` à 201 lignes de détection et
  refuse le dépassement au lieu de présenter 200 dossiers comme une liste complète.
- Le contrat navigateur accepte uniquement sept champs par dossier, des valeurs
  connues, des numéros uniques et un ordre décroissant cohérent avant notification
  ou écriture dans IndexedDB.
- Le lot reste limité à la preview, sans donnée réelle, migration ni production.
