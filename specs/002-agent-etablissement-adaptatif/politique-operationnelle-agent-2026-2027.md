# Politique opérationnelle de l'agent 2026-2027

**État** : décisions métier consolidées, mise en œuvre progressive  
**Révision** : 4 septembre 2026  
**Portée** : portail public, guichet de demandes, connaissances, identité,
documents personnels, codes d'accès, notifications et exploitation multi-établissement

Ce document est la référence de mise en œuvre. Il ne contient aucun code secret,
aucune coordonnée réelle et aucune liste nominative. Une fonction décrite ici ne
doit pas être présentée comme disponible avant le passage de ses critères
d'activation.

## 1. Principes obligatoires

1. L'agent répond directement lorsqu'une source officielle publiée, datée et
   actuelle suffit.
2. Il ouvre un formulaire uniquement lorsqu'une action humaine, une donnée
   personnelle, une vérification ou une information absente est nécessaire.
3. Il n'invente jamais. Il indique clairement qu'une information est inconnue,
   incertaine, contradictoire ou périmée.
4. Une conversation, une demande ou une affirmation d'un visiteur ne devient
   jamais une source officielle, même si l'information paraît vraie.
5. L'agent peut préremplir et reformuler. La personne relit, corrige et confirme
   explicitement avant tout envoi.
6. Une opération sensible exige une identité vérifiée et une autorisation
   serveur. Le navigateur et le modèle ne décident jamais des droits.
7. Une action réussie est annoncée uniquement après confirmation technique du
   système qui l'a réellement exécutée.
8. Les secrets, annuaires et documents personnels restent hors du prompt, hors
   des journaux, hors de Git et hors des contenus publics.

## 2. Cycle de vie des connaissances

Une information suit les états `brouillon -> validée -> publiée -> expirée`.
L'agent public utilise uniquement l'état `publiée` et l'audience autorisée.
Chaque version conserve l'établissement, le titre, la source, le propriétaire
métier, l'auteur, les validateurs, les dates de validation, publication et
expiration, ainsi que l'ancienne et la nouvelle valeur.

La validation ordinaire requiert deux personnes différentes. Le référent
numérique ou la DDFPT participe à la validation ; l'administration peut être le
second validateur. Une modification opérationnelle d'emploi du temps, de salle,
d'absence ou de retard peut être publiée après une validation par
l'administration, la vie scolaire, le référent numérique ou la DDFPT.

Les informations annuelles expirent à la fin de l'année scolaire. Une source
contradictoire suspend la réponse concernée et alerte immédiatement le référent
numérique et la DDFPT. Les contrôles automatiques s'exécutent à 08:00, 13:00 et
18:00, heure de Paris, ainsi qu'après une modification autorisée. Ils restent
silencieux lorsqu'aucun écart n'est trouvé. Les questions inconnues sont
regroupées et dédupliquées ; seules les alertes urgentes sont immédiates.

## 3. Sources documentaires classées

| Source 2026-2027 | Classement | Usage autorisé |
| --- | --- | --- |
| Livret d'accueil | Procédure interne de référence | Règles à rappeler aux élèves et familles après extraction, revue et publication ; les horaires internes des personnels restent exclus |
| Calendrier prévisionnel | Procédure interne et dates opérationnelles | Publication fait par fait après validation ; ne jamais compléter une heure absente |
| Professeurs principaux par classe | Annuaire interne sans codes | Routage et affichage réservé aux personnes autorisées ; jamais une liste publique ni un contexte libre du modèle |
| Exports de l'autre agent ou d'un logiciel métier | Dépôt privé à contrôler | Inventaire, normalisation, dédoublonnage et validation avant tout import |

Fait public déjà confirmé : la rencontre des parents de seconde est prévue le
mardi 22 septembre 2026 au lycée pour présenter le fonctionnement et les codes
ENT. L'heure n'est pas encore communiquée. L'agent doit s'arrêter à cette
formulation tant qu'une heure n'est pas publiée.

## 4. Dialogue, accessibilité et politesse

L'agent accepte les formulations simples, les fautes, le français hésitant et
les langues prises en charge. Il pose une seule question nécessaire à la fois et
passe rapidement au formulaire lorsque le besoin est compris.

Lorsqu'un message est irrespectueux, l'agent reste calme et propose une
reformulation fidèle et polie. Une demande ordinaire n'est transmise qu'après
l'accord de la personne sur cette version. Un problème de grammaire ou de
maîtrise du français ne constitue jamais un refus. Une urgence vitale est
traitée immédiatement quelle que soit la formulation.

## 5. Urgence et SafeScol

Les niveaux sont normal, urgent et critique. Pour une demande urgente, le
guichet enregistre la demande puis recommande d'appeler le lycée au
`01 49 36 20 50`. Il ne promet jamais une réponse immédiate. En cas de danger
immédiat, il affiche d'abord le `112` et recommande de rejoindre un adulte
présent.

Harcèlement, violence, menace, intimidation, racket et discrimination relèvent
exclusivement de SafeScol :

- aucun détail, nom, pièce ou motif n'est collecté dans le chat du lycée ;
- aucun formulaire de support n'est prérempli ou créé ;
- l'agent ouvre uniquement l'application dédiée ;
- l'accès permanent sur l'accueil, les services et près du chat reste fermé
  tant qu'une URL HTTPS officielle et son drapeau d'activation n'ont pas été
  validés ;
- en cas de danger immédiat, le 112 est affiché avant la redirection.

## 6. Identité, appareils et changement de personne

Pour une action personnelle, la personne saisit un email ou un téléphone déjà
présent dans l'annuaire privé. La réponse à une correspondance, une absence ou
un doublon reste identique afin de ne révéler aucune fiche. Un code à six
chiffres est envoyé uniquement par le service autorisé. L'agent ne modifie
jamais les coordonnées : en cas d'écart, il prépare une demande de correction
pour validation humaine.

Sur un appareil personnel, la session peut durer jusqu'à la fin de l'année
scolaire, avec révocation anticipée. Après 15 minutes d'inactivité, l'écran
masque les données et exige une nouvelle preuve pour l'action protégée. Un
appareil partagé ne conserve pas l'identité après l'action.

`Changer de personne` révoque la session serveur de l'appareil et efface les
données affichées ou locales. Les dossiers et certificats archivés restent
attachés à leur bénéficiaire. Les autres appareils restent actifs. La page
`Mes appareils` doit afficher les appareils et leur dernière activité puis
permettre d'en révoquer un ou tous après une preuve récente. Un nouvel appareil
exige toujours un nouveau code et produit une alerte email et push. L'action
`Ce n'est pas moi` révoque toutes les sessions et crée un signalement pour
revue humaine.

Un téléphone peut servir successivement à plusieurs personnes. La première
session est fermée et l'écran vidé avant la vérification de la suivante. Les
quotas et documents sont comptés par personne vérifiée, jamais par téléphone.

## 7. Relations et droits

Un parent ne voit que le prénom et la classe des enfants reliés par une relation
officielle active. Il ne peut pas rechercher un enfant non relié. La remise des
codes d'un enfant à un parent reste désactivée jusqu'à validation de
l'administration ; le guichet peut seulement enregistrer une demande.

| Profil vérifié | Koxo/session lycée | ENT | Cantine |
| --- | --- | --- | --- |
| Élève | Son propre code | Son propre code | Son propre code |
| Professeur | Son propre code | Son propre code | Selon disponibilité validée |
| Professeur principal | Un code élève à la fois dans ses classes validées | Jamais | Un code élève à la fois dans ses classes validées |
| Intendance | Non | Non | Tous dans son établissement |
| Administration | Tous dans son établissement | Tous dans son établissement | Tous dans son établissement |
| DDFPT | Tous dans son établissement | Tous dans son établissement | Tous dans son établissement |
| Référent numérique | Tous dans son établissement | Tous dans son établissement | Tous dans son établissement |
| Superadministration | Selon permissions configurées | Selon permissions configurées | Selon permissions configurées |

Les rôles restent distincts, même lorsqu'une même personne en cumule plusieurs.
La matrice est configurable par établissement et ne contient aucun nom propre.

## 8. Coffre de codes

Les valeurs de Koxo, ENT et cantine sont importées dans un coffre privé séparé
du registre de connaissances. Le modèle reçoit uniquement le type de service,
la disponibilité et l'autorisation, jamais la valeur. Aucune valeur ne figure
dans les traces, exports de diagnostic ou messages ordinaires.

Une contrainte unique lie personne, service, année scolaire et version. Une
transaction garantit que deux demandes concurrentes retournent la même
attribution. Le cycle est `disponible -> réservé -> remis -> utilisé`. Une
consultation ne prouve pas l'usage ; seul un contrôle d'activation réel ou une
validation autorisée peut marquer le code utilisé.

Le code apparaît dans un composant sécurisé séparé du chat, avec copie et
compte à rebours. Il disparaît et devient invalide après 30 minutes. Il n'est
jamais téléchargeable. Une nouvelle vérification d'identité est nécessaire
après expiration. Trois affichages au maximum par personne et par jour sont
autorisés pour un même code ; au-delà, le formulaire prend le relais. Un code
signalé défectueux attend une intervention humaine sans remplacement ou
réactivation automatique.

Après activation ENT, l'agent demande de réinitialiser le mot de passe. Un
problème ultérieur ouvre un formulaire. Le code cantine reste fixe pour l'année
scolaire sauf remplacement humain tracé.

## 9. Certificats et dossier numérique

Une personne vérifiée peut générer un certificat PDF uniquement à partir d'un
modèle officiel et de données de scolarité actives. Le document porte une
référence unique, un QR, une empreinte cryptographique, une date et un statut.
Il n'utilise pas une image de cachet manuel.

La page publique de vérification affiche seulement le nom complet de l'élève,
le type de document, la référence, la date, l'année scolaire et le statut
`authentique`, `annulé` ou `expiré`. L'URL contient un jeton long, aléatoire et
non séquentiel, sans nom. La vérification manuelle demande la référence et le
nom de famille, avec limite de débit et audit.

Un certificat est valable 60 jours. Après expiration, une nouvelle vérification
d'identité et une nouvelle génération sont requises. La limite est de trois
certificats par élève et par jour, puis le formulaire prend le relais. Le PDF
doit être copié ou téléchargé dans les 30 minutes. L'ouverture ou le
téléchargement d'une archive exige toujours un nouveau code, même sur un
appareil reconnu.

L'archive privée conserve les versions, accès et téléchargements. Une future
synchronisation NAS alimente le dossier numérique de l'élève après recette de
sauvegarde et restauration.

## 10. Emploi du temps et déclarations des professeurs

Après identité vérifiée, l'écran mobile affiche aujourd'hui en premier : cours,
heure, salle, modification validée et cours en cours, avec navigation par jour
et option semaine.

Une absence ou un changement de salle publié est envoyé uniquement au public
choisi. L'agent propose la classe, les élèves ou les personnels concernés ; le
service corrige l'audience et les canaux. Les parents ne sont jamais inclus par
défaut et aucune diffusion globale n'est implicite.

Un professeur vérifié peut déclarer dans le chat une absence, un retard ou un
changement de cours. L'agent affiche un récapitulatif et attend une confirmation
explicite. L'administration est alertée pour la mise à jour humaine de PRONOTE.
L'information reste en attente jusqu'à la validation opérationnelle. Le motif
personnel n'est jamais diffusé ; seuls le cours, la date, l'heure, la salle et la
conséquence utile sont visibles.

## 11. Routage et notifications

La réponse directe de l'agent ne produit aucune notification. Une nouvelle
demande produit un événement durable puis une seule notification par
destinataire et par canal. Toute notification comporte le minimum nécessaire.

Le superadministrateur reçoit toutes les demandes. Les autres destinataires
sont :

| Motif | Rôles supplémentaires |
| --- | --- |
| ENT, ordinateur, activation | Référent numérique |
| Badge ou cantine | Administration, intendance |
| Absence ou retard élève | Administration, vie scolaire |
| Certificat, inscription, document | Administration, DDFPT |
| PFMP, stage, convention | DDFPT |
| Orientation | Administration, DDFPT |
| Emploi du temps, salle, cours | Administration, vie scolaire |
| Changement de coordonnées | Administration, DDFPT, référent numérique |

Toutes les demandes apparaissent au tableau de bord et utilisent push et email
pour les services concernés. Une urgence alerte simultanément
superadministration, DDFPT et administration. Les auteurs d'une communication
choisissent séparément push, email et SMS, puis une ou plusieurs personnes,
classes, niveaux ou tout l'établissement. L'interface affiche le nombre de
destinataires, déduplique les contacts partagés et estime le coût. Le SMS reste
réservé aux destinataires sélectionnés ou aux urgences selon consentement.

## 12. Services de connexion prioritaires

Le périmètre de rentrée traite en priorité l'ENT, la cantine, Koxo/session lycée,
la messagerie académique et les emplois du temps. Tant qu'une donnée n'est pas
issue d'une source validée, l'agent explique qu'il ne peut pas la confirmer et
propose le formulaire adapté sans produire de réponse supposée.

Pour un compte ENT inactif, une preuve est envoyée uniquement vers l'email ou le
téléphone déjà enregistré. Après vérification, l'identifiant et le code
d'activation sont présentés dans le composant sécurisé pour monlycee.net. Pour
un compte actif, l'agent guide la réinitialisation du mot de passe ; un échec ou
une coordonnée incorrecte ouvre une demande au référent numérique. L'agent ne
modifie jamais une coordonnée.

Après vérification, le numéro annuel de badge de cantine peut être présenté ;
une erreur est routée vers l'intendance. Le code Koxo, fixe, peut être présenté
dans le même composant sécurisé ; une erreur est routée vers le référent
numérique. Pour la messagerie académique, seul l'email est vérifiable dans la
source disponible ; les autres demandes utilisent le formulaire enrichi. Un
identifiant académique unique reste interne, chiffré et invisible aux usagers.

## 13. Documents, informations flash et dictée

Les documents téléchargeables sont classés, versionnés et validés avant leur
publication. Après remplissage, ils peuvent être retournés depuis l'assistant.
Les voies générale et technologique sont routées vers l'administration ; la
voie professionnelle est routée vers la DDFPT.

Un personnel ou professeur vérifié peut proposer une information flash avec une
expiration obligatoire. Le référent numérique ou la DDFPT valide et peut
modifier, y compris après publication, le texte, le public, l'importance, les
canaux et l'expiration. Chaque modification conserve une version et sa trace de
validation. L'agent propose le niveau, mais l'humain décide :

- normale : affichage sur le site sans notification ;
- importante : push et email facultatif ;
- urgente : push et email, avec SMS seulement pour les personnes choisies.

Le menu de cantine expire après une semaine puis est archivé. Les contenus bac,
orientation et événements possèdent un début et une fin. Les changements de
classe, tests et sorties utilisent une information flash ciblée et expirante.
La règle d'envoi d'une correction après modification reste à valider.

La dictée transforme la parole en texte modifiable dans le chat, les formulaires
et les informations flash. La langue est détectée automatiquement avec un choix
manuel simple. Un segment dure au plus deux minutes et peut être interrompu puis
repris. Le texte doit être relu avant confirmation et l'audio brut n'est pas
conservé. Une option native au navigateur est évaluée en premier ; toute option
payante reste fermée jusqu'à validation du coût.

## 14. Isolation multi-établissement — évolution future

Chaque établissement possède son identifiant, ses sources, ses membres, ses
rôles, ses annuaires, ses secrets, ses modèles, ses audiences, ses journaux et
ses paramètres. Toutes les lectures et écritures appliquent cet identifiant
côté serveur et par politiques RLS. Aucun superadministrateur d'un
établissement ne reçoit implicitement les données d'un autre.

Le produit conserve les rôles séparés et configurables afin qu'un établissement
puisse attribuer ses propres administrateurs sans modifier le code.

Cette capacité prépare une évolution future. Le travail actuel reste limité au
lycée Blaise Cendrars et ne doit pas être retardé par la commercialisation ou le
paramétrage d'autres établissements.

## 15. Critères d'activation restants

Les fonctions suivantes restent fermées tant que leurs éléments ne sont pas
validés et testés :

- URL officielle SafeScol et drapeau d'activation ;
- fournisseur OTP téléphone ; l'email OTP existe mais n'est pas activé en
  production ;
- import réel de l'annuaire et des relations dans le coffre privé ;
- fichier réel de codes contrôlé, chiffré et validé, sans passage par le chat ;
- décision de l'administration sur la remise de codes aux parents ;
- modèle officiel de certificat et données actives de scolarité ;
- page de vérification publique, signature et procédure d'annulation ;
- connecteur NAS avec sauvegarde, restauration et journal d'accès ;
- fournisseurs push, email et SMS, consentements et coûts ;
- source d'emploi du temps et écrans de déclaration professeur ;
- import des documents téléchargeables et routage selon la voie ;
- workflow d'information flash, modification versionnée et règle de correction ;
- dictée navigateur accessible, relecture, langues et absence de conservation audio ;
- relecture des informations pratiques et des propriétaires de chaque source.

L'activation se fait compétence par compétence avec données fictives, contrôle
des droits, tests de concurrence, recette mobile, audit puis validation humaine.
