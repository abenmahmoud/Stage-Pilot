# Paquet fictif de restauration chiffré

## Portée livrée

Le module local construit un petit paquet contenant obligatoirement au moins un
extrait fictif de base et un objet fictif de Storage. Chaque artefact est chiffré
séparément en AES-256-GCM avec un nonce aléatoire. Les chemins, types MIME,
empreintes et octets restent dans la charge chiffrée.

Le manifeste public contient uniquement l'identifiant du paquet, le périmètre
établissement, la version de clé, les catégories d'artefacts et des tailles. Un
MAC dérivé par HKDF authentifie le manifeste complet, y compris les enveloppes.
Chaque enveloppe est aussi liée par AAD à sa position, au nombre total
d'artefacts, au paquet et à l'établissement.

## Refus sûrs

La vérification refuse avant tout résultat :

- mauvaise clé ou mauvaise version de clé ;
- autre établissement ou autre identifiant de sauvegarde attendu ;
- artefact retiré, ajouté, réordonné, dupliqué ou altéré ;
- chemin absolu, traversée de répertoire, champ inconnu ou base64 non canonique ;
- absence de la partie base ou de la partie Storage ;
- dépassement des limites de nombre, taille unitaire ou taille totale ;
- empreinte du contenu différente après déchiffrement.

Tous les artefacts sont authentifiés et déchiffrés en mémoire avant que la
fonction retourne le moindre résultat. Le module n'écrit aucun fichier et ne se
connecte à aucun service : un échec ne peut donc pas produire une restauration
partielle.

## Limites assumées

Ce paquet est un banc d'essai borné à 64 artefacts, 8 Mio par artefact et 32 Mio
au total. Il ne remplace pas :

- l'export complet et programmé de Postgres ;
- la copie incrémentale des objets Storage privés ;
- un coffre de clés et la rotation opérationnelle ;
- la rétention validée par la direction et le DPO ;
- la restauration effective dans une cible isolée et son contrôle métier.

La tâche globale T031 reste donc ouverte.

## Preuve locale

`npm run test:recovery-sample-bundle` exécute 28 contrôles sur un extrait binaire de base et un
fichier fictif, l'absence de contenu clair dans le manifeste, la restitution
octet pour octet et les refus adversariaux ci-dessus.
