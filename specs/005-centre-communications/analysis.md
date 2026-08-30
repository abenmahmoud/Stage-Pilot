# Analyse de cohérence - Centre de communication

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
par établissement. Cette migration n'est pas appliquée à distance dans ce lot ;
T023 restera ouvert jusqu'à la recette transactionnelle du webhook fermé.

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
audités sans faire régresser un état livré. La migration n'est pas appliquée et
l'interrupteur demeure absent des environnements distants.

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
