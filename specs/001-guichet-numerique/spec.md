# Feature 001 - Guichet numérique et agent de support

**Projet** : LyceeGest - Lycée Blaise Cendrars, Sevran
**Statut** : V1 en implémentation, preview disponible
**Date** : 2026-08-25
**Priorité** : rentrée scolaire

## 1. Vision

Créer dans LyceeGest un guichet numérique unique pour les élèves, parents,
professeurs et personnels. Une personne peut demander de l'aide même si son ENT
ou son email académique ne fonctionne plus. Elle reçoit un numéro de dossier,
peut poursuivre la conversation depuis son téléphone ou son ordinateur, joindre
des documents, et être recontactée par le canal qu'elle a choisi.

L'agent du lycée dispose d'une file de travail qui classe, regroupe, assigne et
priorise les demandes. L'IA assiste l'agent, mais n'envoie pas de réponse sensible
et ne clôture pas un dossier sans validation humaine.

## 2. Garanties non négociables

1. Une demande acceptée par l'API est enregistrée avant tout envoi d'email.
2. Un échec Brevo, IA ou réseau ne supprime jamais la demande.
3. Chaque modification importante laisse une trace horodatée et attribuée.
4. Le numéro public d'un dossier ne donne jamais accès aux données personnelles.
5. Aucun mot de passe ENT, académique ou personnel n'est demandé ni stocké.
6. Les pièces jointes restent privées, contrôlées et liées au bon dossier.
7. Les réponses IA sont des propositions visibles et modifiables par un agent.
8. Le service reste utilisable sans IA, sans SMS et pendant une panne du webmail.
9. Les modules Stages, Grand Oral, formations et informations du lycée sont
   conservés. Le guichet s'ajoute à LyceeGest, il ne les remplace pas.
10. Le système doit absorber un pic de 200 créations de demandes sans perte.
11. Le message adressé à l'assistant reçoit une réponse dans le même parcours :
    aucune redirection sèche vers un formulaire séparé et aucune série de cases
    profil/catégorie n'est imposée avant de pouvoir écrire.
12. Le Webmail et les informations de rentrée sont au premier niveau. LyceeGest
    reste accessible depuis la navigation et les services, sans occuper un accès
    rapide destiné aux urgences de rentrée.
13. L'identité de lycée polyvalent et les formations générale, technologique,
    professionnelle et CAP restent visibles dans la PWA.
14. L'accueil met en avant le nom Lycée Blaise Cendrars et utilise le portrait
    historique de l'écrivain avec sa cigarette comme signature visuelle demandée,
    avec l'ancien logo photographique noir dans la navigation, conformément au
    choix de la direction et sans présenter le tabac comme un produit.
15. La vérification comporte trois états visibles et audités : coordonnées
    déclarées, moyen de contact vérifié, puis identité confirmée par rapprochement
    avec une source officielle du lycée.
16. Une demande ENT ou de messagerie académique ne peut pas être résolue et aucun
    identifiant ne peut être envoyé tant que l'identité n'est pas confirmée.
17. Après l'enregistrement, la conversation reste unique : les réponses et pièces
    ajoutées depuis le web ou l'email rejoignent le même dossier sans ressaisie.
18. Les huit spécialités générales proposées par l'établissement sont présentées
    avec leur intitulé, une explication simple, les compétences développées et un
    visuel significatif.
19. Le suivi sur l'appareil est toujours actif. Lorsqu'une adresse email est
    fournie, le lien sécurisé par email constitue un second accès et la trace
    durable recommandée ; le téléphone reste un canal de rappel ou de secours.
20. Une personne peut écrire dans sa langue ou demander un français simple. Ce
    besoin est conservé dans le dossier et visible par l'agent sans diminuer le
    niveau de vérification d'identité.
21. Lorsqu'une conversation avec l'assistant devient une demande, les messages
    utiles du demandeur et de l'assistant sont conservés dans l'ordre dans le fil
    du dossier. L'assistant reste identifié comme tel et ses réponses ne sont pas
    présentées comme une décision validée par un agent humain.
22. Le site officiel ne peut être remplacé qu'après reprise, correction et
    validation de toutes ses rubriques utiles, de ses documents et de ses liens.
23. Une page de confiance explique en langage simple les données demandées, les
    protections réellement actives, les secrets à ne jamais transmettre et le
    caractère de préproduction tant que la direction et le DPO n'ont pas validé
    les mentions définitives et les durées de conservation.

## 3. Acteurs

- **Demandeur public** : élève, parent, professeur ou personnel sans connexion.
- **Utilisateur connecté** : personne déjà authentifiée dans LyceeGest.
- **Bénéficiaire** : personne concernée par le problème, différente du demandeur
  lorsqu'un parent agit pour son enfant ou qu'un personnel aide quelqu'un.
- **Agent** : traite les dossiers et répond.
- **Direction** : supervise, réattribue, consulte les indicateurs et les audits.
- **Administrateur** : configure catégories, modèles, canaux et droits.
- **Assistant IA** : résume et propose, sans autorité de décision.

## 4. Parcours indispensables en V1

### P1 - Créer une demande sans compte

1. La personne décrit son problème avec ses propres mots.
2. L'assistant accuse réception immédiatement et conserve le message dans le fil.
3. Il comprend le profil et la catégorie depuis le texte lorsqu'ils sont présents,
   sans obliger la personne à cliquer dans une grille de choix.
4. Il répond utilement, pose au plus une question importante à la fois, puis
   demande uniquement les coordonnées encore nécessaires à la création.
5. La personne indique si la demande la concerne ou concerne une autre personne.
6. Elle renseigne l'identité scolaire minimale du bénéficiaire.
7. Elle peut déposer jusqu'à cinq fichiers dans le même parcours.
8. Elle fournit au moins un moyen de réponse : email ou téléphone. Le suivi sur
   l'appareil reste actif, l'email est recommandé pour garder une trace et elle
   peut autoriser le téléphone comme canal de secours.
9. L'API crée le dossier, son premier événement et le job de notification dans
   une seule transaction Postgres.
10. L'écran affiche immédiatement un numéro `BC-AAAA-NNNNNN` et propose de
    continuer la conversation.
11. Le système envoie ensuite le lien sécurisé de suivi de manière asynchrone.

### P2 - Reprendre depuis le même appareil

- Le navigateur conserve seulement le numéro public et une session sécurisée.
- La session réelle est portée par un cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- Un brouillon non envoyé est conservé localement et peut être renvoyé après une
  coupure de réseau avec la même clé d'idempotence.
- Les données sensibles et les jetons bruts ne sont jamais écrits dans
  `localStorage`.

### P3 - Reprendre depuis un autre appareil

- La personne ouvre le lien magique reçu par email ou saisit un code ponctuel.
- Le jeton à usage unique est échangé contre une nouvelle session d'appareil.
- L'ouverture du lien prouve le contrôle de l'adresse email, mais ne suffit pas
  pour transmettre un code ENT ou une donnée scolaire personnelle.
- Un numéro de dossier seul ne permet pas d'ouvrir le dossier.
- Après plusieurs tentatives invalides, l'accès est temporairement bloqué.

### P4 - Conversation web et email

- Chaque dossier possède un fil chronologique unique.
- Une réponse de l'agent apparaît dans l'application et part par le canal choisi.
- Le fil s'actualise automatiquement pendant sa consultation et accepte de
  nouvelles pièces jointes dans la limite du dossier.
- Quand la personne répond, un dossier en attente repasse en cours de traitement.
- Chaque email sortant utilise une adresse de réponse propre au dossier.
- Une réponse envoyée depuis Gmail, Outlook ou le webmail est reçue par Brevo,
  ajoutée au fil puis notifiée à l'agent.
- Les pièces jointes d'une réponse email sont placées en quarantaine avant d'être
  visibles ou téléchargeables.
- Les statuts envoyé, livré, différé, rejeté et spam sont enregistrés.

### P5 - Traiter efficacement 200 demandes

- La file affiche les nouvelles demandes, urgences, retards et dossiers assignés.
- Les filtres portent sur profil, catégorie, statut, priorité, classe, agent,
  canal, date et absence de réponse.
- L'agent peut s'assigner un dossier, le transférer et ajouter une note interne.
- L'agent voit le résumé, les informations manquantes et une réponse proposée.
- Les actions répétitives utilisent des modèles avec champs variables.
- Les demandes probablement identiques sont signalées, jamais fusionnées sans
  validation humaine.
- Si deux agents ouvrent le même dossier, une modification plus récente ne peut
  jamais être écrasée silencieusement. Le second agent est invité à actualiser.
- Une prise en charge est atomique : un seul agent obtient le dossier, les autres
  voient immédiatement qu'il est déjà attribué.
- La réponse, le changement de statut et le job durable sont enregistrés dans la
  même transaction avant l'envoi externe.
- Un dossier ne peut être clôturé qu'après une réponse ou un motif explicite.

### P6 - Déposer des documents et photos

- Glisser-déposer, appareil photo mobile et sélecteur de fichiers sont supportés.
- Pour chaque fichier, la personne indique : personne concernée, type de document
  et commentaire facultatif.
- Formats V1 : PDF, JPEG, PNG, HEIC et DOCX.
- Limites V1 : 10 Mo par fichier, cinq fichiers et 30 Mo par demande.
- Les exécutables, archives, macros et types incohérents sont refusés.
- Un fichier est d'abord `en_quarantaine`, puis `sain`, `bloqué` ou `erreur_scan`.
- Les agents ne téléchargent pas un fichier tant qu'il n'est pas déclaré sain.

### P7 - Collecter les contacts personnels manquants

- Un formulaire public distinct collecte nom, prénom, profil, matière ou service,
  voie générale/professionnelle, email personnel et téléphone facultatif.
- L'email personnel reçoit un lien de vérification.
- Un contact non vérifié n'est pas utilisé pour des informations sensibles.
- L'agent rapproche le contact de la fiche professeur/personnel existante.
- Toute validation, correction ou désactivation est auditée.
- Le numéro de téléphone sert au rappel et aux notifications seulement selon le
  choix présenté à la personne.

## 5. Données demandées

### Demandeur

- profil ;
- prénom et nom ;
- email personnel et/ou téléphone ;
- canal préféré ;
- autorisation d'utiliser le canal de secours.

### Bénéficiaire

- soi-même, enfant, élève, professeur, personnel ou autre ;
- prénom, nom et classe pour un élève ;
- matière, service et voie pour un professeur ou personnel ;
- aucun justificatif d'identité demandé par défaut.

### Demande

- catégorie et sous-catégorie ;
- objet ;
- description libre ;
- niveau d'urgence déclaré et raison ;
- service affecté ;
- pièces jointes documentées.

Catégories V1 : inscription, affectation/classe, documents de scolarité,
ENT/EduConnect, email académique, ordinateur, logiciel, restauration/bourse,
orientation/formation, vie scolaire et autre.

## 6. Statuts et priorités

### Statuts

`brouillon`, `nouveau`, `a_qualifier`, `assigne`, `en_cours`,
`attente_demandeur`, `attente_interne`, `resolu`, `clos`, `indesirable`.

### Priorités

- **P1 critique** : incident collectif, sécurité ou blocage direction.
- **P2 urgente** : accès indispensable bloqué avec échéance proche.
- **P3 normale** : aide individuelle sans échéance immédiate.
- **P4 faible** : information ou amélioration.

L'IA peut suggérer la priorité. Seul un agent peut confirmer P1 ou clôturer.

## 7. Notifications

- Email : actif en V1, suivi de délivrabilité obligatoire.
- Notification dans la PWA : active pour les sessions connues.
- Téléphone : création d'une tâche de rappel en V1.
- Une demande explicite de rappel crée la tâche même si un email est aussi
  disponible. La file agent affiche les rappels en attente séparément.
- Un agent prend le rappel avant de le traiter, puis enregistre un résultat pour
  le terminer. Deux agents ne peuvent pas prendre le même rappel simultanément.
- Un rappel terminé ne confirme jamais à lui seul l'identité scolaire.
- SMS Brevo : activable ensuite, avec crédits et consentement adaptés.
- WhatsApp : sert d'abord à diffuser le lien public, pas le contenu d'un dossier.
- Chaque échec crée une relance par un autre canal autorisé ou une alerte agent.
- Une alerte interne est adressée au service actuellement affecté au dossier.
  Si son adresse n'est pas configurée ou si le dossier reste à qualifier, elle
  revient à la boîte générale du superadministrateur afin de ne pas être perdue.
- L'adresse interne destinataire n'est jamais affichée ni transmise au demandeur.

## 8. Règles de l'assistant IA

- Fonctionne derrière un interrupteur global et par fonctionnalité.
- Reçoit un texte pseudonymisé : noms, emails, téléphones et identifiants sont
  retirés avant l'appel externe.
- Ne reçoit aucun contenu de pièce jointe. Seuls un numéro de document,
  l'extension, le type et une taille approximative peuvent être transmis.
- Produit un JSON validé : catégorie, priorité suggérée, résumé, informations
  manquantes, réponse proposée, confiance et drapeaux de risque.
- Si la confiance est faible, le dossier reste `a_qualifier`.
- Ne communique jamais un mot de passe existant.
- Ne change jamais directement un code ENT ou académique.
- Ne répond jamais seul à une demande de sécurité, santé, conflit ou donnée
  sensible.
- Oriente immédiatement une situation de danger vers un adulte et les numéros
  publics adaptés, sans appel au modèle et sans prolonger la conversation.
- Refuse sans appel au modèle les recherches de coordonnées privées, extractions
  de données et listes nominatives.
- Limite une conversation à dix messages utilisateur. L'aide pédagogique est
  limitée à trois réponses courtes et les demandes hors mission s'arrêtent au
  troisième essai.
- Les règles déterministes sont évaluées avant l'appel externe afin de conserver
  la sécurité même si l'IA est indisponible et de limiter le coût.
- Chaque proposition et chaque validation humaine sont conservées dans l'audit.

## 9. Exigences de sécurité et de confidentialité

- MFA obligatoire pour direction et administrateurs.
- Rôles séparés : administrateur, direction, agent, lecture seule.
- Les pages administratives vérifient le rôle dans l'interface et chaque API
  vérifie de nouveau le rôle côté serveur. Masquer un lien ne suffit jamais.
- Un agent peut demander un lien de réinitialisation à son adresse confirmée.
  La réponse reste générique pour ne pas révéler l'existence d'un compte, et le
  retour n'est accepté que sur une URL autorisée par Supabase Auth.
- RLS sur toutes les nouvelles tables exposées.
- Clé `service_role`, clé Brevo et future clé IA uniquement côté serveur.
- Limitation de débit sans bloquer un établissement partageant la même IP.
- Champ piège et défi anti-robot seulement en cas de comportement suspect.
- Journaux techniques sans texte des demandes, email complet ni téléphone complet.
- URLs de fichiers signées et courtes ; bucket Supabase privé.
- Chiffrement en transit ; sauvegardes secondaires chiffrées.
- Mention d'information claire pour les élèves et parents.
- Durées de conservation configurables et purge automatique vérifiable.
- AIPD et validation DPO avant activation de l'IA sur des données d'élèves.
- L'aperçu public masque les emails, téléphones, noms déclarés et secrets avant
  l'appel externe, utilise `store: false` et conserve un repli local sans IA.
- Les réponses du portail définissent une politique de sécurité du contenu,
  interdisent l'intégration dans un autre site, réduisent les informations de
  provenance transmises et désactivent le cache des API et du service worker.

## 10. Durées proposées à valider par la direction et le DPO

- Brouillons locaux : 30 jours.
- Sessions d'appareil public : 30 jours, renouvelables.
- Jetons à usage unique : 30 minutes.
- Dossiers actifs : pendant le traitement.
- Dossiers résolus : 12 mois, puis anonymisation ou suppression.
- Pièces jointes : 90 jours après clôture, sauf conservation justifiée.
- Journaux d'accès et de sécurité : 12 mois.
- Événements de délivrabilité : 6 mois.
- Données IA détaillées : 30 jours ; métriques anonymisées plus longtemps.

## 11. Critères d'acceptation

1. Un test de 200 créations concurrentes produit 200 dossiers uniques.
2. Une double soumission avec la même clé produit un seul dossier.
3. Une panne Brevo laisse le dossier visible et l'envoi passe en relance.
4. Une réponse email arrive dans le bon dossier une seule fois.
5. Un webhook rejoué dix fois ne crée qu'un message.
6. Un jeton expiré ou réutilisé ne donne pas accès au dossier.
7. Un agent non autorisé ne peut pas lire les dossiers d'un autre périmètre.
8. Aucun fichier en quarantaine ne peut être téléchargé.
9. Une perte de connexion conserve le brouillon sur le téléphone.
10. La page reste utilisable à 320 px, 768 px, 1440 px et au clavier.
11. Une demande peut être créée et suivie sans IA.
12. Les modules existants conservent leur comportement après déploiement.
13. Chaque réponse, affectation, export et consultation sensible est auditée.
14. Les alertes de sécurité Supabase existantes sont corrigées avant ouverture.
15. Une personne peut commencer par une phrase libre et joindre un fichier avant
    de renseigner son identité ou une catégorie.
16. Les formations et les priorités de rentrée sont lisibles sur mobile sans
    masquer l'accès au Webmail et au suivi des demandes.
17. Le portrait et les cartes des spécialités restent lisibles sans débordement à
    390 px et 1440 px ; les images sont optimisées et ne provoquent pas de rupture
    de mise en page.

## 12. Hors V1

- Remplacement complet de l'ENT ou du webmail académique.
- Réinitialisation automatique des mots de passe académiques.
- Envoi autonome de réponses sensibles par l'IA.
- WhatsApp bidirectionnel contenant des données scolaires.
- Application mobile native séparée de la PWA.
- CRM généraliste ou centre d'appel complet.
