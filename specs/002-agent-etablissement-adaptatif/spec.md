# Spécification - Agent d'établissement adaptatif V2

**Feature** : `002-agent-etablissement-adaptatif`
**Statut** : prototype en développement, validation institutionnelle requise avant pilote réel
**Dépendance fonctionnelle** : le guichet numérique `001` reste le système de suivi des demandes

## Vision

Donner à chaque élève, parent et personnel une entrée unique pour demander de l'aide en langage naturel. L'agent comprend le besoin, répond avec les informations validées du lycée, demande uniquement les précisions indispensables, ouvre le bon service et crée un dossier suivi lorsqu'une intervention humaine est nécessaire.

Pour les agents du lycée, la V2 prépare les réponses, classe les demandes, repère les pièces manquantes et propose la prochaine action. Un humain conserve la responsabilité des décisions et des actions officielles.

## Utilisateurs

- Élève, y compris sans accès ENT fonctionnel.
- Parent ou responsable légal.
- Professeur et personnel.
- Agent d'accueil, secrétariat, vie scolaire, intendance ou support numérique.
- Direction et administrateur habilité.

## Parcours prioritaires

### US1 - Obtenir un document courant

Un parent demande : « Où télécharger le certificat de scolarité de ma fille ? » L'agent identifie le profil et l'élève concerné, explique le chemin officiel puis ouvre PRONOTE. Si une consultation officielle est connectée et autorisée, il affiche le document personnel sans le rendre public.

**Réussite** : une réponse sourcée en moins de deux échanges, sans appel au secrétariat dans le cas nominal.

### US2 - Compléter une inscription

Un parent explique librement sa situation ou dépose une photo du courrier reçu. L'agent identifie la démarche, affiche une liste personnalisée de pièces, distingue reçu, manquant et illisible, puis crée une demande suivie si nécessaire.

**Réussite** : aucune pièce n'est perdue et l'usager reçoit un numéro de suivi.

### US3 - Résoudre un accès numérique

Un élève ou un personnel ne peut plus accéder à l'ENT, à PRONOTE ou à sa messagerie. L'agent fait un diagnostic court, propose les actions sans risque et ouvre une demande au référent numérique. Il ne révèle jamais un ancien mot de passe.

**Réussite** : les incidents connus sont guidés immédiatement ; les autres arrivent dans la bonne file avec les informations utiles.

### US4 - Justifier une absence

Un responsable décrit l'absence et joint un justificatif. L'agent confirme la réception, transmet à la vie scolaire et permet de suivre l'état. Seul un personnel habilité accepte ou refuse le justificatif.

**Réussite** : statut visible et réponse envoyée par le canal choisi.

### US5 - Demander une aide administrative libre

L'usager écrit avec ses propres mots, sans choisir une longue série de cases. L'agent reconnaît inscription, bourse, orientation, certificat, rendez-vous, restauration, internat ou autre demande et peut proposer le formulaire classique.

**Réussite** : au moins 90 % des demandes pilotes sont classées dans le bon service, avec correction simple par un agent.

### US6 - Travailler dans la console agent

L'agent humain voit les demandes prioritaires, le résumé, les coordonnées vérifiées, les pièces, la source utilisée et une réponse proposée. Il corrige, valide, réassigne ou demande une précision. La réponse validée enrichit la procédure de l'établissement après revue, jamais par apprentissage automatique brut.

**Réussite** : un agent peut traiter une demande courante en moins de trois minutes.

### US7 - Créer un compte et confirmer son identité scolaire

Un élève, un parent ou un personnel peut créer un compte avec un moyen de
contact. Un code à usage unique envoyé à une adresse déclarée confirme seulement
que la personne contrôle cette adresse. L'identité scolaire n'est confirmée que
si cette adresse est déjà liée à la personne dans une source officielle du lycée,
ou par un futur SSO officiel.

**Réussite** : aucune donnée scolaire personnelle n'est affichée sur la seule base
d'une adresse librement saisie.

### US8 - Retrouver son cours, sa salle ou un changement

Après confirmation de son identité scolaire, un usager demande « Où est mon
prochain cours ? ». L'agent consulte une version validée de l'emploi du temps et,
si disponible, le flux officiel des changements. Il répond avec la salle, l'heure,
la classe ou le groupe et la date de fraîcheur de la source.

Si une absence modifie le cours, l'élève voit uniquement la conséquence utile :
cours maintenu, déplacé ou annulé. L'agent ne déduit ni ne publie la présence ou
l'absence nominative d'un personnel.

**Réussite** : une réponse personnalisée est exacte, autorisée, sourcée et refuse
proprement lorsque la source est absente ou périmée.

### US9 - Consulter la vie du lycée

Un visiteur trouve sur le même portail les formations, actualités, documents,
contacts et accès rapides du lycée. Un éditeur habilité peut préparer, dater,
prévisualiser et publier ces contenus sans modifier le code.

**Réussite** : le portail reste utile sans compte et les contenus publiés indiquent
leur date, leur responsable et leur état de validité.

## Exigences fonctionnelles

- **FR-001** : l'accueil propose en premier le dialogue libre et garde un formulaire accessible comme alternative.
- **FR-002** : l'agent pose une seule question essentielle à la fois et limite une session à dix échanges avant résolution, création de demande ou transfert humain.
- **FR-003** : toute réponse de procédure indique sa source interne ou officielle et sa date de mise à jour.
- **FR-004** : l'agent ne déclare jamais une action réussie sans confirmation réelle de l'outil concerné.
- **FR-005** : lorsqu'un service n'est pas connecté, l'agent l'annonce clairement et propose une redirection ou une demande suivie.
- **FR-006** : l'agent peut recevoir images et documents, contrôler format, taille, lisibilité et présence probable de la pièce demandée.
- **FR-007** : chaque demande conserve conversation, événements, pièces jointes privées, assignation, priorité, statut et canal de réponse.
- **FR-008** : l'usager peut retrouver sa demande sur le même appareil et via un jeton de suivi ; une consultation personnelle exige une preuve supplémentaire adaptée au risque.
- **FR-009** : les notifications utilisent le canal autorisé disponible : courriel, puis téléphone/SMS lorsque ce canal sera activé.
- **FR-010** : les agents peuvent corriger la catégorie, le service, la priorité et la personne concernée sans perdre l'historique.
- **FR-011** : une boîte de validation regroupe les réponses, publications, documents et actions de niveau L3.
- **FR-012** : les cas L4 sont transférés au service habilité avec un message de sécurité ; aucune décision n'est produite par l'IA.
- **FR-013** : les procédures sont fournies par des paquets de compétences versionnés et configurables par établissement.
- **FR-014** : toute compétence possède un responsable, des sources, une date de révision et des tests.
- **FR-015** : les réponses humaines ne modifient une compétence qu'après proposition, revue et publication d'une nouvelle version.
- **FR-016** : LycéeGest reste le service de référence pour les stages ; l'agent transmet le contexte sans dupliquer ses données.
- **FR-017** : PRONOTE reste la référence pour les données scolaires et de vie scolaire ; seules les intégrations officielles autorisées sont admises.
- **FR-018** : l'administration peut désactiver immédiatement une compétence, une source ou une intégration.
- **FR-019** : toute action et toute consultation sensible sont inscrites dans un journal d'audit.
- **FR-020** : la limitation de charge combine appareil, compte, contact et comportement ; elle ne bloque pas tout le lycée derrière une même adresse réseau.
- **FR-021** : un compte public peut être créé avec un contact vérifié sans donner accès aux données scolaires personnelles.
- **FR-022** : un code à usage unique envoyé à une adresse librement déclarée confirme le contact ; l'identité scolaire exige un rapprochement avec un annuaire officiel préchargé ou un SSO officiel.
- **FR-023** : cours, salles, groupes, documents personnels et état détaillé d'une demande ne sont consultables qu'avec le niveau d'identité et le rôle requis.
- **FR-024** : les personnels utilisent des comptes nominatifs, des rôles limités à leur service et une authentification renforcée.
- **FR-025** : chaque nouvelle demande reçoit un service proposé par une règle déterministe avec motif et niveau de confiance ; un agent peut toujours corriger ce choix sans perdre l'historique.
- **FR-026** : une demande ambiguë ou à faible confiance reste dans une file de qualification humaine et n'est jamais fermée automatiquement.
- **FR-027** : les emplois du temps sont importés dans un stockage privé sous forme de versions datées, validées et révocables ; aucune liste nominative n'est intégrée au code ou au dépôt Git.
- **FR-028** : les réponses sur un cours ou une salle indiquent la source et sa fraîcheur ; une source expirée déclenche une réponse prudente et, si utile, une demande suivie.
- **FR-029** : l'agent ne publie pas la présence ou l'absence nominative d'un personnel ; il affiche seulement, à un usager autorisé, la conséquence officielle pour son cours ou son service.
- **FR-030** : les actualités, formations, pages pratiques et documents du site sont gérés comme des contenus datés avec brouillon, prévisualisation, publication et retrait.
- **FR-031** : toute synchronisation ENT ou PRONOTE expose son dernier succès, son retard et son état ; aucune donnée ancienne n'est présentée comme actuelle.
- **FR-032** : l'agent assiste les AED, CPE, secrétariat, direction et référent numérique ; il ne remplace pas leur responsabilité légale, éducative, disciplinaire ou de protection.
- **FR-033** : une mention d'ESSUF GROUP ou d'un partenariat média n'est publiée qu'après validation écrite du lycée, de l'entreprise et des responsabilités de traitement des données.

## Exigences non fonctionnelles

- **NFR-001** : aucune demande confirmée ne doit être perdue, même pendant une pointe de 200 demandes simultanées.
- **NFR-002** : la création d'une demande répond en moins de deux secondes hors téléversement de fichiers.
- **NFR-003** : l'interface est utilisable sur mobile de 320 px de large et sur ordinateur sans débordement horizontal.
- **NFR-004** : l'application reste installable en PWA et affiche les demandes déjà consultées lors d'une coupure courte.
- **NFR-005** : stockage privé, liens de fichiers temporaires, chiffrement en transit, contrôle d'accès par établissement et rôle.
- **NFR-006** : sauvegardes, reprise, file durable, idempotence et nouvelles tentatives empêchent pertes et doubles envois.
- **NFR-007** : les secrets, listes complètes et fichiers sensibles ne sont jamais intégrés aux instructions du modèle.
- **NFR-008** : coût IA, latence, taux de transfert, erreurs de classement et réponses corrigées sont mesurés.
- **NFR-009** : l'agent fonctionne sans IA pour créer une demande au moyen du formulaire classique.
- **NFR-010** : français clair, langage adapté au profil, accessibilité clavier et messages compréhensibles.
- **NFR-011** : le portail supporte au minimum 3 000 visites mensuelles et les pointes de rentrée sans lier sa disponibilité à celle du fournisseur IA.
- **NFR-012** : une synchronisation défaillante, une source périmée ou un modèle indisponible ne doit jamais supprimer une demande ni bloquer le formulaire classique.

## Règles d'autorité

1. Une règle de sécurité déterministe s'applique avant tout appel au modèle.
2. Les droits de l'utilisateur limitent les sources consultables et les outils disponibles.
3. L'IA peut informer, résumer, classer et préparer.
4. L'humain décide et valide les actions officielles ou sensibles.
5. Le résultat confirmé d'un outil prévaut sur le texte généré.
6. PRONOTE, Scolarité Services, les applications académiques et LycéeGest restent les sources officielles de leurs domaines.
7. Une donnée de présence, d'emploi du temps ou d'identité n'est jamais déduite d'une conversation.

## Critères de réussite du pilote

- 95 % des demandes confirmées possèdent un accusé de réception et un numéro de suivi.
- 90 % des demandes courantes sont dirigées vers le bon service après correction éventuelle.
- 100 % des actions L3 possèdent une validation enregistrée.
- 100 % des cas L4 testés refusent l'action autonome et indiquent la bonne escalade.
- Aucun document privé n'est accessible avec une URL publique permanente.
- 80 % des questions publiques de référence reçoivent une réponse correcte, sourcée et à jour.
- Le test de pointe de 200 créations simultanées ne perd ni ne duplique de dossier.
- 100 % des réponses personnalisées d'emploi du temps indiquent une version de source et respectent le périmètre de l'utilisateur.
- Une panne du modèle laisse disponibles le site public, le formulaire et le suivi des demandes.

## Hors périmètre initial

- Remplacer l'interface complète de PRONOTE ou des téléservices nationaux.
- Modifier notes, absences validées, sanctions, affectations ou décisions de bourse.
- Déployer immédiatement plusieurs établissements avant validation du cloisonnement.
- Entraîner un modèle sur les conversations brutes du lycée.
- Surveiller individuellement les personnels ou publier leur présence en temps réel.
- Remplacer juridiquement un AED, un CPE, un secrétariat ou un membre de direction.
