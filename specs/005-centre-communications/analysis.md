# Analyse de cohérence - Centre de communication

## Recette responsive du 1er septembre 2026

Une fixture locale temporaire a rendu l'écran Communications avec un compte
direction AAL2 et uniquement des données `example.test`. Elle a été supprimée
après la recette et n'est pas incluse dans le produit. Les vues à 1 440 et
320 px, l'aperçu email rempli et la navigation au clavier ne provoquent aucun
débordement horizontal ni erreur navigateur.

La première passe Axe a détecté un contraste insuffisant dans les étapes de
préparation. Les libellés `Saisie privée` et `Publier et informer` utilisent
maintenant des couleurs lisibles. Les deux passes finales Axe WCAG A/AA
retournent zéro violation et zéro résultat incomplet. Le lecteur d'écran humain
et la session authentifiée de preview restent nécessaires avant de fermer T031.

## Transport HTTP sortant du 1er septembre 2026

Le client abstrait possède désormais un transport HTTP serveur concret, mais
aucun environnement ne l'active. La configuration refuse HTTP, adresses IP,
hôtes locaux, identifiants dans l'URL, paramètres et redirections. Le corps
sortant contient uniquement le jeton opaque déjà signé ; le Bearer reste dans
les en-têtes serveur. Une réponse n'est acceptée qu'en JSON borné à 24 Kio, puis
le reçu signé est encore vérifié contre la commande avant toute décision de
persistance.

La recette injecte un faux Webmail en mémoire : elle contrôle la requête exacte,
le reçu accepté, les statuts HTTP, le délai, les corps trop grands ou inattendus
et une série de 200 livraisons avec concurrence bornée. Elle n'appelle aucun
réseau, ne configure aucun secret et ne ferme pas T027 ou T032 : la preuve
réseau sur une preview déployée reste distincte.

## Recette de file Webmail du 30 août 2026

Une recette transactionnelle prépare désormais 200 livraisons fictives et les
répartit entre succès, reprise, échec définitif et attente. Elle teste aussi le
rejeu d'un reçu, l'unicité d'une commande et son immutabilité. Les migrations
`20260830110000` et `20260830120000` sont maintenant appliquées uniquement sur
la preview et la recette transactionnelle y passe avec cinq compteurs à zéro
après rollback. Deux écarts devenus obsolètes dans la recette ont été corrigés :
elle suit le cycle brouillon, relecture, approbation et utilise l'acteur
gouverné `provider`, sans publier de contenu.

## Runner local du 30 août 2026

Le runner sépare désormais transport et persistance. Une panne de persistance
après acceptation ne relance pas immédiatement le transport : le verrou périmé
et l'idempotence Webmail assurent la reprise. Le lot entier est contrôlé avant
le premier effet et reste limité à vingt travaux.

## Persistance des destinataires du 30 août 2026

La page signée de références opaques possède maintenant une écriture
transactionnelle. La version courante validée est verrouillée et chaque rejeu
est relu après conflit, ce qui ferme le risque d'accepter silencieusement une
ancienne résolution ou une clé idempotente substituée.

## Correction d'annulation du 30 août 2026

Les états `deferred`, `rejected`, `spam` et `unsubscribed` sont désormais
explicitement non rappelables, comme `sent` et `delivered`. Seuls les états
réellement antérieurs à l'envoi peuvent déclencher une annulation de livraison.

L'annulation direction est maintenant persistée sous deux verrous et confirmée
explicitement. Une migration additive maintient seulement les transitions
`pending/retry -> cancelled` et pré-envoi vers `cancelled` quand les
interrupteurs sont coupés. L'audit de son application sur la preview a trouvé
qu'elle remplaçait aussi les contrôles d'approbation hérités. La migration
`20260830160000` les rétablit explicitement, et la migration historique a été
corrigée pour les nouveaux environnements. Une recette transactionnelle prouve
désormais les deux propriétés ensemble.

## Résultat

La proposition est cohérente avec les fonctionnalités `001`, `002`, `003` et
`004`. Aucun fichier, contact ou secret réel n'est requis pour commencer le
prototype en preview.

## Réutilisation

- `003` fournit déjà les contenus, versions, modèles, fichiers, aperçu, aide IA
  et publication dans `À la une`.
- `001` fournit déjà les principes de file durable, idempotence, événements
  Brevo et traitement des réponses email.
- Le Webmail conserve ses contacts et son historique dans son application
  séparée ; `005` doit utiliser un contrat serveur limité.
- `004` reste consacré à la reprise de l'ancien site et n'est pas utilisé pour
  numéroter ou stocker les nouvelles communications.

## Risques fermés par la spécification

- Les adresses ne sont jamais placées dans `À` ou `Cc` d'un envoi collectif.
- Les réponses ne repartent jamais vers toute la liste.
- Une pièce reçue ne devient jamais publique automatiquement.
- Une communication interne ne passe pas dans l'API publique.
- Un échec de Brevo n'annule ni la publication ni la file d'envoi.
- Une correction ne détruit pas la version officielle précédente.

## Points à valider avant données réelles

1. Mentions d'information et durée de conservation des livraisons et réponses.
2. Liste exacte des groupes autorisés et responsable de chaque groupe.
3. État réel de l'expéditeur Brevo, du domaine entrant et des webhooks.
4. Contrat technique et droits minimaux de l'API du Webmail.
5. Test de restauration d'une communication et d'une pièce jointe.

## Ordre recommandé

Construire d'abord le parcours manuel dans la preview avec contacts fictifs,
puis ajouter l'envoi individuel. L'import automatique depuis Gmail vient après
la validation de ce circuit : il accélère l'entrée, mais ne doit jamais devenir
un chemin de publication sans contrôle humain.

## État technique au 30 août 2026

Les validateurs, interrupteurs, tables privées, versions, audiences opaques,
livraisons, file idempotente, entrants et audit sont installés sur la preview et
désactivés. L'API de brouillon, les modèles gouvernés, le dépôt documentaire
privé et la file d'analyse PDF/DOCX sont également présents derrière les deux
interrupteurs fermés. La saisie directe peut maintenant être corrigée par
versions puis transmise en relecture humaine. L'aide IA rend une proposition
structurée sans persistance fournisseur ; elle n'invente pas les informations
manquantes et les laisse comme questions bloquantes. Les gardes SQL imposent la
cohérence entre la racine et sa version courante et figent le contenu en revue.
Les recettes fictives passent et la base ne contient aucun résidu de test. Le
dépôt signé est raccordé à l'interface derrière deux interrupteurs dédiés qui
restent fermés. Le contrat signé du registre Webmail accepte seulement des
groupes opaques et l'éditeur dispose d'aperçus séparés pour la page et l'email,
toujours sans destinataire ni action d'envoi. Le classement local des réponses
est également défini sans webhook : retrait, correction, question et réponse
libre restent des propositions à confirmer. Le prochain lot documentaire est
une preuve antivirus de bout en bout sur fichiers fictifs ; les groupes réels,
la publication et toute diffusion restent bloqués par T001 à T004.

La surface privée actuelle possède en plus un test de confidentialité dynamique.
Chaque route SQL projette ses colonnes explicitement et aucune route navigateur
n'importe encore audience ou livraison. Cette preuve ne remplace pas le test
d'absence d'adresse entre destinataires après implémentation de T017 à T020.

Le contrat préparatoire du webhook Brevo est maintenant séparé de l'ancien flux
entrant du guichet d'aide. Il vérifie un jeton Bearer fort, reste fermé sans
interrupteur exact, borne les lots et réduit chaque événement à des HMAC
et compteurs non identifiants. Il ne crée aucune route et ne stocke encore aucun
message : l'authentification HTTP réelle, la persistance privée et la preuve de
rejeu restent nécessaires pour fermer T022.

Le rattachement T023A ne devine jamais une conversation depuis une adresse. Il
compare le HMAC de `In-Reply-To` au HMAC enregistré sur une livraison du même
établissement et limite la projection SQL à deux candidats afin de détecter une
ambiguïté. Une contrainte additive impose le format HMAC et une unicité partielle
par établissement. La migration `20260830110000` est appliquée uniquement sur
la preview. Une transaction fictive avec deux établissements prouve l'unicité
locale, l'isolation croisée, le rejeu idempotent, l'inconnu non rattaché, les
tables privées et six compteurs à zéro après rollback. T023 est fermé sans
activer le webhook ni ses secrets.

Le contrat T025A prépare l'import d'un email transféré sans ouvrir de boîte ni
de route. L'autorisation de la source est un contexte serveur non fourni par le
message. L'identifiant externe est déjà HMAC et produit une empreinte stable
anti-doublon. Les en-têtes de transport, les anciennes citations et les images
distantes sont retirés ou neutralisés ; secrets et balisages actifs sont
refusés. Les éventuelles données personnelles restent dans le brouillon privé,
sont signalées et interdisent toute aide IA avant rédaction. Aucun public,
groupe, publication ou envoi n'est déduit du message.

Le contrat T019A suit la documentation Brevo des webhooks transactionnels et de
leur authentification Bearer. Il réduit les événements utiles aux cinq états du
produit et refuse les événements de suivi d'ouverture ou de clic. Le même HMAC
de message sortant sert au rapprochement, tandis qu'un domaine HMAC distinct
produit la clé de rejeu à partir du message, de l'état et de l'horodatage UTC en
millisecondes. Aucune adresse, objet, raison, IP ou étiquette fournisseur ne
sort du parseur. La route et l'écriture transactionnelle restent à construire.

T020A rend explicites les décisions du futur worker sans modifier la base. Un
travail ne peut déclarer un échec que lorsqu'il est `running`. Les erreurs
temporaires utilisent une reprise déterministe bornée et les codes permanents
ou tentatives épuisées passent en `dead`, visible dans la boîte d'échec. Aucun
texte fournisseur n'est accepté. Seuls `pending` et `retry` peuvent être
annulés immédiatement ; un travail en cours attend un point de contrôle. Une
livraison déjà envoyée ou livrée reste non rappelable même si un travail local
est ensuite annulé. Le worker, le verrou SQL et la reprise humaine restent à
implémenter.

T020B sépare la reprise humaine de la reprise automatique. Une session MFA de
direction doit confirmer la correction, puis un nouveau travail idempotent est
créé sans réécrire l'échec original. La clé HMAC dépend de l'établissement et
du travail mort ; une même demande ne peut donc pas créer deux successeurs. Les
erreurs exigeant une nouvelle version ou un contact corrigé et les livraisons
terminales sont refusées. La transaction atomique et l'interface restent à
implémenter.

T019B relie le contrat de délivrabilité à une persistance encore fermée. La
route vérifie un Bearer fort, choisit l'établissement côté serveur, verrouille
la livraison et insère l'empreinte d'événement avant toute transition. La
contrainte unique absorbe les rejeux ; les événements hors ordre restent
audités sans faire régresser un état livré. T019C applique la migration additive
uniquement sur la preview et prouve, dans une transaction fictive annulée, le
rejeu, l'isolation entre deux établissements, les contraintes d'état et
l'absence de privilèges clients. Le rollback laisse zéro résidu. Le webhook et
ses secrets restent absents des environnements : aucune réception fournisseur
n'est activée par cette preuve.

T017A précise une ambiguïté du plan : le navigateur et l'API de sélection ne
reçoivent aucun membre, mais le worker validé doit obtenir les références
opaques nécessaires aux lignes `communication_deliveries`. La page signée est
liée à la version, à l'empreinte de registre et aux groupes approuvés. Une clé
HMAC stable par contact absorbe les doublons entre rejeux et pages sans révéler
de coordonnée.

T018A maintient la séparation des dépôts : LyceeGest ne contacte pas Brevo pour
ce centre et ne reçoit pas l'adresse. Il signe un ordre individuel contenant le
texte officiel et un chemin canonique sans origine ; le Webmail résout et
revérifie le contact, construit l'URL depuis sa configuration et envoie. L'appel
fictif entre applications reste à implémenter.

T018B complète le retour minimal : le Webmail signe un reçu lié à l'empreinte
de la commande, à la livraison et à sa clé d'idempotence. Il transforme le
`message-id` Brevo en HMAC avant toute réponse. Une répétition renvoie la même
empreinte avec l'issue `duplicate`; elle ne peut donc pas être confondue avec
une nouvelle livraison. La route distante et sa transaction restent ouvertes.

T018C ajoute les preuves persistantes nécessaires à une reprise : empreintes de
résolution, commande et reçu, toutes bornées et uniques par établissement. La
politique de complétion refuse un travail non `running`, une commande substituée
ou un identifiant fournisseur différent. Un reçu idempotent peut réparer une
coupure après envoi, mais ne fait jamais régresser un état déjà livré.

T018D borne aussi l'exécution : le client vérifie localement l'ordre avant
l'appel, puis le reçu avant toute décision. Les lots comptent au plus 500 lignes
et vingt appels simultanés ; le profil retenu pour 200 destinataires en utilise
dix. Délais et statuts distants deviennent des codes fermés, sans corps d'erreur
fournisseur dans le résultat ou l'audit.

T018E ferme la course locale : l'adaptateur relit et verrouille le travail et sa
livraison dans le même périmètre établissement, puis recalcule la politique avec
la commande et le reçu vérifiés. Audit, livraison et travail partagent la
transaction appelante ; une ligne modifiée entre-temps provoque un conflit et
aucun état partiel n'est conservé.

T020C rend la file partageable entre workers : une CTE verrouille uniquement
les travaux dus de l'établissement et `SKIP LOCKED` empêche la double prise. Un
verrou frais n'est jamais repris. Après cinq minutes, un travail interrompu est
replanifié une minute plus tard avec un code fermé, ou devient `dead` au
cinquième échec.

T020D applique la politique de panne sous verrou et sous statut observé. Le
travail quitte `running` vers `retry` ou `dead`; seule une livraison encore
`prepared`, `queued` ou `error` devient `error`. Les états fournisseur plus
avancés restent intacts. L'événement ne contient qu'un code fermé, le numéro
d'essai et la prochaine échéance.

T020E conserve aussi la preuve humaine : la politique est appliquée après verrou
du travail mort et de sa livraison. L'original n'est jamais modifié. Une HMAC
issue de l'établissement et de l'identifiant du travail rend le successeur
unique ; un double clic n'ajoute ni second travail ni second événement.

T020F expose uniquement une surface direction privée. La liste projette titre,
version, code fermé, essais et date pour cent échecs au plus ; elle n'importe
même pas le modèle de livraison dans la route navigateur. La reprise
est impossible si le module ou l'envoi est coupé, si le secret manque ou si la
confirmation n'est pas exactement vraie. La transaction réapplique ensuite la
politique et le MFA déjà imposé par la porte commune.

T020G garde l'action compréhensible : la direction voit seulement le titre, la
version, une cause française, le nombre d'essais et la date. Un premier bouton
déclare la cause corrigée ; un second confirme réellement la reprise. La liste
s'empile sur téléphone et aucun champ de livraison ne traverse l'API.

T022B et T023B ouvrent seulement le reçu technique, derrière un interrupteur
exact resté faux. Le parseur détruit les coordonnées et le contenu avant la
transaction. La route cherche au plus deux livraisons par HMAC sortant dans le
même établissement, insère une ligne idempotente et audite uniquement des
compteurs. Un entrant sans référence reste non rattaché, sans repli nominatif.

T024B raccorde le classificateur local au même parseur : le texte borné est lu
uniquement en mémoire, puis seule la catégorie rejoint `communication_inbound`.
La boîte privée projette six métadonnées, reste AAL2, cloisonnée par
établissement, en lecture seule et limitée à cent lignes. Les quatre catégories
ont été prouvées dans une transaction de preview annulée ; une catégorie
`automatic_action` est refusée par la contrainte et les rôles clients gardent
zéro privilège. T024 est fermé sans stockage du message, sans webhook actif et
sans action automatique.

T025B ferme le chemin de création depuis un transfert. La route reste absente
par défaut (`COMMUNICATION_FORWARD_ENABLED` faux) et exige quatre preuves
serveur : Bearer dédié, secret HMAC fort, expéditeur autorisé et alias de
collecte autorisé. Le créateur configuré doit être un `admin` actif du même
établissement. Dans une seule transaction, l'empreinte du message absorbe les
rejeux avant de créer un brouillon `internal`, sa version et son audit. La
recette fictive de preview confirme une seule création, aucune audience,
livraison ou tâche, zéro privilège client et sept compteurs nuls après rollback.
T025 est fermé sans configurer Gmail, Brevo ou un environnement.

T014B ferme la preuve de publication dans `À la une`. La recette de preview
rejoue le cycle brouillon, relecture et validation, puis crée atomiquement une
page publique, sa version, le lien retour et les deux traces d'audit. Une
seconde publication provoque une erreur après ses écritures : la sous-
transaction les annule toutes et laisse la communication validée intacte. Le
scénario complet laisse huit compteurs à zéro après rollback, sans audience,
livraison, tâche d'envoi, donnée réelle ou exposition directe des tables.

T015C applique le choix le plus protecteur tant que la durée d'archive n'est pas
validée : seul un contenu expiré mais encore publié peut apparaître dans le mode
Archives. Le statut `archive`, utilisé par la direction pour retirer un contenu,
reste exclu du flux courant, du flux expiré et de l'accès direct par slug. Le
mode est signé par le curseur opaque et contrôlé dans la réponse cliente. Une
recette de preview confirme les trois partitions et laisse trois résidus à zéro.

T011D2 ferme la confiance implicite du navigateur envers l'API documentaire.
La liste, la réservation signée et la confirmation ont trois contrats exacts et
bornés. Le client refuse notamment le mauvais bucket, un chemin non privé, une
extension substituée, un jeton avec espaces ou contrôles, un fichier différent
de celui annoncé et une confirmation sans quarantaine vérifiable. Aucun accès
Storage n'a lieu avant la validation de la réservation et aucun succès n'est
affiché avant la validation de la confirmation. Le dépôt et l'interface restent
fermés par défaut ; la preuve antivirus et l'activation restent dans T011D.

T027D ferme la même confiance implicite pour le chargement principal. Les quatre
réponses de liste sont lues comme `unknown`, validées avec le contrat documentaire
puis appliquées ensemble. Le contrôle recoupe les plafonds SQL, l'unicité, le tri,
les statuts, les relations publication/visibilité, les faits structurés, les six
modèles versionnés, les seuls travaux relançables et les entrants rattachés. Une
altération ou un secret bloque l'ensemble sans état partiel. Cela n'ouvre aucun
destinataire ni échange réseau ; la preuve inter-applications reste dans T027.

T027E ferme les faux succès possibles après une action. La fiche et ses cent
dernières versions sont liées à l'identifiant demandé, ordonnées et cohérentes
avec la version courante. Chaque mutation est relue comme `unknown` puis recoupée
avec l'identifiant, la visibilité, la version et l'état attendus avant de vider
un formulaire, d'afficher une réussite ou de modifier l'écran. L'aide IA repasse
par son parseur strict et la reprise doit confirmer exactement création ou
idempotence. La réponse de personnalisation d'un modèle est réduite à sa
projection éditoriale ; établissement et agents ne sont plus renvoyés. T027
reste ouvert pour la recette réseau fictive, pas pour un autre contrat local.

T027G ferme deux détails du transport HTTP. Un nom DNS avec un point terminal
ne peut plus contourner la détection des suffixes locaux. Toute réponse refusée
pour son statut, son type ou sa longueur annoncée voit aussi son flux annulé
avant le retour d'une erreur fermée, afin de ne pas retenir de ressource sous
des échecs concurrents. La résolution DNS et la recette réseau restent des
preuves distinctes à exécuter seulement sur une preview autorisée.

T010F corrige un écart d'usage dans l'espace Direction : l'indicateur de parcours
ne reste plus toujours sur « Déposer ». Il dérive uniquement de l'état privé déjà
validé et distingue dépôt, relecture, validation, publication et arrêt. Une
publication web ne vaut jamais preuve de diffusion : l'étape finale reste en
cours avec le libellé « Page publiée · diffusion fermée » jusqu'au futur reçu
interapplications. Les états archivés et annulés n'annoncent aucune action
courante. Cette règle est pure, testée sur les six états et n'ouvre aucun
interrupteur, contact, audience ou transport.

La revue indépendante Claude Fable 5 du même lot, bornée à huit fichiers et en
lecture seule, a confirmé l'absence de défaut bloquant puis détecté un angle mort
sur `targeted`. Une communication ciblée ne peut désormais plus être appelée
« Interne » ni « Prête à publier » ; les brouillons internes n'annoncent plus une
activation future. Les trois visibilités et les six états sont testés ensemble.
La cible tactile reste contrôlée, tandis qu'une assertion de couleur purement
cosmétique a été retirée. Le rapport n'a reçu aucun secret ni donnée réelle.

T022C extrait sans changement de politique la transaction réellement appelée
par le webhook entrant. Une recette exécutable et explicitement bornée à la base
Supabase de preview reçoit deux messages fictifs, rejoue exactement le même lot
et réutilise l'une des empreintes dans un second établissement. Le rejeu ajoute
zéro ligne et zéro événement ; le second établissement reste indépendant et les
rôles clients n'ont aucun privilège direct. La transaction est forcée au
rollback, puis six familles de résidus sont contrôlées à zéro. Le webhook reste
fermé et T022 demeure ouvert pour le stockage privé avec antivirus du contenu.
La preuve SQL équivalente a été répétée via le connecteur Supabase sur le projet
de preview `xijocumlwivhbmffrnlj` : utilisateur, établissements,
communications, livraisons, entrants et événements sont tous revenus à zéro.
Le lanceur Node reste disponible pour un environnement sécurisé possédant une
vraie `DATABASE_URL` ; les fichiers locaux Vercel la masquent volontairement.

T022D ajoute le socle de contenu sans ouvrir la réception. Chaque corps ou pièce
jointe possède une référence HMAC cloisonnée, une taille maximale de 10 Mo et un
chemin privé sans nom d'origine. La base impose le passage `reserved` puis
`quarantine` avant une promotion `clean` accompagnée de l'empreinte SHA-256, de
la date du scan et du code exact `clamav_clean`. Les retours en arrière et les
modifications d'identité sont refusés ; les événements restent append-only.

La migration a été appliquée uniquement à la base Supabase de preview
`xijocumlwivhbmffrnlj`. Une recette fictive a prouvé le cycle propre, le refus
d'une promotion sans preuve, le doublon HMAC, le croisement d'établissement, le
retour d'état, la mutation de l'audit, l'absence de privilèges clients et le
caractère privé des deux buckets. Son rollback laisse cinq familles de résidus à
zéro. Les conseillers Supabase ne signalent aucun défaut nouveau : deux avis RLS
sans politique sont intentionnels pour ces tables exclusivement serveur, et les
deux index ne sont pas encore utilisés en l'absence de trafic activé.

Ce lot ne télécharge aucun contenu Brevo, ne démarre aucun worker, ne configure
aucun secret et n'active aucun interrupteur Vercel. T022 reste donc ouvert pour
le raccordement transactionnel, la validation stricte des résumés machine, la
politique de conservation et les preuves ClamAV propre/EICAR.
