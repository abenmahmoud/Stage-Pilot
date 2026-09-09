# Accès personnel sans mot de passe

## But

Permettre à un élève, un responsable ou un personnel de prouver son lien avec
le lycée par un email ou un téléphone déjà connu. Le numéro et le code
d'une demande restent une preuve de suivi distincte.

## Parcours cible

1. La personne demande une information ou une action personnelle.
2. La personne indique son profil, son prénom et son nom. Le serveur cherche
   une personne unique dans la version active du répertoire privé.
3. Selon la décision explicite du 9 septembre, les seuls contacts proposés sont
   ceux de cette personne, masqués : SMS ou email, au choix. Un seul choix suffit.
   Aucun code n'est envoyé avant le clic. « Je n’ai plus accès à ces coordonnées »
   ouvre une demande de rectification préremplie à valider par un humain.
4. Sa consommation atomique ouvre une session opaque, rotative et révocable ;
   le cookie ne contient aucun contact ni identifiant scolaire.
5. Chaque service relit côté serveur la personne, les relations, la source
   active, l'établissement, la fraîcheur de la preuve et le droit demandé.
6. Après 15 minutes d'inactivité, les données personnelles sont masquées et une
   preuve récente est exigée pour l'action protégée.

Un appareil personnel peut être reconnu jusqu'à la fin de l'année scolaire,
avec révocation anticipée. Un appareil partagé ferme l'identité après l'action.
`Changer de personne` révoque la session de l'appareil et efface l'écran, sans
supprimer les anciens dossiers. Un nouvel appareil exige toujours un code et
produit une alerte email et push. `Mes appareils` permet de révoquer un appareil
ou tous les appareils après vérification récente.

Un téléphone peut vérifier successivement plusieurs personnes, mais jamais dans
la même session. Les quotas, codes et documents restent attachés à la personne
vérifiée. Un parent ne voit que les enfants reliés dans l'annuaire officiel.

## Services protégés

### Réalisation du choix de contact — 9 septembre 2026

La recherche publique dédiée utilise un index HMAC du nom, puis vérifie le
prénom et le profil dans le worker privé. Les accents, espaces et traits d'union
sont normalisés. Un prénom usuel complet peut correspondre à l'un des prénoms
enregistrés. Plusieurs correspondances ne produisent aucune proposition.

Le résultat chiffré contient les contacts uniquement pour les endpoints privés
de vérification. Le navigateur reçoit leur type, un identifiant de choix et un
libellé masqué. Le serveur ignore toute destination libre et lie le choix au
défi, à l'établissement, au navigateur et à la version active. Le modèle IA ne
reçoit aucun contact ni code provenant de ce parcours.

Une erreur du fournisseur est distinguée d'une demande de rectification.
Les doubles clics sont arbitrés en base : un seul envoi par défi. Le code est
valable dix minutes à compter du choix, avec cinq essais maximum et consommation
unique. Les durées de session existantes ne sont pas modifiées par ce lot.

Le parcours ci-dessus décrit aussi des fonctions cibles (gestion des appareils,
preuves récentes et alertes) dont cette modification ne prouve pas la réalisation.
Preuves de ce lot : `docs/operations/CHOIX_CONTACT_OTP_2026-09-09.md`.

- Les informations générales restent immédiates et anonymes.
- L'emploi du temps propre ou d'un enfant relié exige une identité active et
  une source actuelle.
- Les coordonnées ne sont jamais modifiées par l'agent ; un écart devient une
  demande de correction humaine.
- Les documents archivés exigent un nouveau code à chaque ouverture ou
  téléchargement, même sur appareil reconnu.
- Les codes sont affichés dans un composant séparé du chat, pendant 30 minutes,
  sans téléchargement et avec trois affichages quotidiens au maximum.
- La remise des codes d'un enfant à un parent reste fermée jusqu'à décision de
  l'administration.

La matrice complète des rôles, codes, certificats et sessions figure dans
[politique-operationnelle-agent-2026-2027.md](politique-operationnelle-agent-2026-2027.md).

## Fichiers et vie privée

### Adresses de messagerie ENT — décision du 9 septembre 2026

Adel confirme explicitement la règle du lycée : l'adresse de messagerie ENT est
constituée de l'**identifiant de connexion ENT exact**, suivi de `@monlycee.net`.
Cette confirmation autorise la préparation d'un complément à partir de l'export
officiel ; ne pas reconstruire un identifiant depuis le nom et le prénom.

- Conserver les emails académiques, personnels et téléphones existants. L'email
  ENT constitue un contact supplémentaire pour la même personne, sans nouvelle
  fiche ni perte de relations parent-enfant.
- Distinguer la colonne `Identifiant de connexion` des identifiants techniques
  `ID` et `Id Externe`. Seule la première sert à construire l'adresse.
- Ne pas corriger silencieusement un identifiant ambigu ou une adresse invalide :
  isoler ces lignes pour contrôle, conserver les autres moyens de contact.
- Un seul contact connu choisi par la personne et un seul OTP suffisent selon la
  politique existante. L'email ENT ne devient pas obligatoire et ne remplace pas
  l'option email académique, personnel ou téléphone.
- Conserver les fichiers de correspondance hors Git et les codes ENT hors du
  répertoire d'identité. Aucune valeur secrète n'est transmise au modèle.

**État : règle confirmée ; complément préparé localement.** Le répertoire codé
actuellement possède deux colonnes email (académique et personnelle). La prise
en charge d'un troisième contact ENT dans l'import et la recherche OTP reste à
raccorder puis à vérifier en production. La préparation de ce complément ne
prouve ni son activation ni la réception d'un code.

Tout fichier reste en stockage privé et fermé avant un état antivirus `clean`.
L'agent reçoit un niveau de preuve, un type de personne et un périmètre, jamais
le répertoire complet ni une valeur secrète. Une panne laisse disponible le
formulaire classique.

## Activation

Le parcours email est codé mais reste fermé en production tant que les variables,
le worker privé, l'annuaire approuvé, la livraison, la révocation et les mentions
de protection des données ne sont pas vérifiés. Le canal téléphone reste à
implémenter. Aucun import réel n'est requis pour les tests de preview.
