# Accès personnel sans mot de passe

## But

Permettre à un élève, un responsable ou un personnel de prouver son lien avec
le lycée par un email ou, à terme, un téléphone déjà connu. Le numéro et le code
d'une demande restent une preuve de suivi distincte.

## Parcours cible

1. La personne demande une information ou une action personnelle.
2. Le serveur cherche une correspondance exacte dans la version active du
   répertoire privé, sans révéler si le contact existe, est partagé ou absent.
3. Un code à six chiffres à durée courte est envoyé par le canal autorisé.
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

Tout fichier reste en stockage privé et fermé avant un état antivirus `clean`.
L'agent reçoit un niveau de preuve, un type de personne et un périmètre, jamais
le répertoire complet ni une valeur secrète. Une panne laisse disponible le
formulaire classique.

## Activation

Le parcours email est codé mais reste fermé en production tant que les variables,
le worker privé, l'annuaire approuvé, la livraison, la révocation et les mentions
de protection des données ne sont pas vérifiés. Le canal téléphone reste à
implémenter. Aucun import réel n'est requis pour les tests de preview.
