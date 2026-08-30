# Memoire durable - Portail numerique du Lycee Blaise Cendrars

**Derniere mise a jour** : 29 aout 2026
**Branche de travail** : `codex/lycee-connect-prototype`
**Depot** : `abenmahmoud/Stage-Pilot`
**Dernier jalon de code verifie** : candidate publiée sur la production Vercel

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
  IA réussie sans conserver le texte ni les coordonnées. Les niveaux
  L0 à L4 sont maintenant résolus à partir de preuves persistées : token, email
  confirmé, fiche scolaire liée ou adhésion active et service. Les outils pour
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
- Definir les niveaux L0 a L4 et les validations attendues.
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
- T018 reste ouverte pour l'interface de validation et son branchement. T028
  reste ouverte pour un adaptateur réel autorisé et l'affichage après preuve.

## 8. Prochain ordre recommande

1. Construire la boîte de validation A3 et ses API sur le socle persistant,
   sans brancher encore de connecteur officiel.
2. Publier et tester le pré-triage ordinateur portable avec des données fictives.
3. Installer puis éprouver le worker d'emplois du temps sur données fictives,
   avant tout dépôt réel ; construire ensuite le lien agent limité à une page.
4. Reprendre le skill ENT après ouverture de l'accès administrateur du référent.
5. Terminer le retour email, la sauvegarde, les tests de charge et les comptes
   agents nominatifs.
6. Migrer le reste du site et envisager la bascule seulement après convergence.
