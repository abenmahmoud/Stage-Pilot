# Import KOXO — 16 septembre 2026

## Demande et source

Adel demande la remise des identifiants et codes personnels de session PC dans
le chat, puis dépose le pack préparé avec Claude dans le dossier local privé
`DepotPrive/05-Livrables-KOXO`. Archive reçue : `CODES_lycee_pour_codex.zip`.
Empreinte SHA-256 :
`3c22744644dcc5fc293e2f2dcfdb01e663474d087e483b1cb6f9f0e15954bdab`.

Le JSON source est traité localement par programme ; aucun code, identifiant
personnel ou liste nominative n’est recopié dans Git, le chat ou un modèle.
Le pack contient aussi des données ENT : elles ne sont pas réimportées dans ce
lot consacré aux sessions PC.

## Contrôles et sélection

Annuaire actif vérifié : `a3a7aec0-3158-4a2b-a837-539888e02b39`, empreinte
`1809b664099b53d2fdd5dac3e09172b2d33676907e61359a5cbdd5d2edbf3faf`.
Le fichier local comparé est exactement celui de cet annuaire approuvé.

Pour chaque accès : référence ENT exacte et unique, profil personnel, prénom
et nom concordants après normalisation limitée, dates de validité, présence
au dernier export, format du compte PC et absence d’identifiant PC partagé
entre plusieurs références. Aucun rapprochement approximatif par nom.

| Population du pack | Avec KOXO | Importés | Restant |
|---|---:|---:|---|
| 122 enseignants | 98 | 89 | 24 sans KOXO ; 9 absents du dernier export à confirmer |
| 89 personnels | 9 | 9 | 80 sans KOXO dans ce pack |
| Comptes KOXO non rattachés | 57 | 0 | Rattachement humain nécessaire, dont anciens/test selon la notice |

L’absence du dernier export n’est pas assimilée à une radiation. Ces neuf
enseignants restent dans l’annuaire ; seule la nouvelle attribution KOXO est
retenue en attente de confirmation. Aucun compte ou contact n’est modifié.

## Import réellement exécuté

- Chiffrement local LGC1, RSA-OAEP/SHA-256 et AES-256-GCM, clé publique comparée
  à celle du Dépôt existant. Aucun CSV clair supplémentaire produit.
- Envoi du fichier chiffré à l’API existante
  `https://lycee-blaise-cendrars-sevran.fr/api/depot/codes` depuis le relais
  autorisé, avec son jeton existant sans exposition du secret. Aucun changement
  de configuration ou de service sur le VPS.
- Réponse HTTP 202 : `accepted: 98`, `alreadyPresent: 0`, `status: stored`.
- Contrôle base : 98 attributions KOXO, 98 valeurs chiffrées, 98 rattachements
  à un personnel de l’annuaire actif, zéro code défectueux. Les 1 273 valeurs
  ENT précédentes sont conservées.
- RLS et FORCE RLS actifs sur les deux tables du coffre. L’API de remise PC
  anonyme reste refusée 401 et sans cache après l’import.

## Usage et limites

Le parcours publié `912f8b0` est déjà présent sur le domaine principal : demander
son identifiant/code de session PC, confirmer son identité sur un contact connu
par OTP, puis utiliser la carte « Ma session PC ». La remise est personnelle,
le code reste hors des messages et disparaît au plus tard à l’expiration de la
preuve. Le mot de passe n’est ni changé ni envoyé par email dans ce lot.

La première récupération réelle après OTP reste à constater avec Adel ; aucune
session réelle n’a été usurpée pour tester la remise. Aucun email, SMS, push ou
dossier n’a été envoyé/créé pour cet import. Les 24 enseignants sans code, les
9 absents du dernier export et les 57 comptes non rattachés demandent un complément.

Les scripts, le lot chiffré, le reçu et les rapports sont dans le dossier privé
`05-Livrables-KOXO/traitement-2026-09-16` ; le tableau de vérification contient
les neuf enseignants à confirmer, sans mots de passe. Le pack source reste local.
La préparation ne remplace jamais un code existant : les renouvellements
ultérieurs doivent suivre un remplacement humain versionné.

## Contrôle du nouvel export Professeurs.XML

Le fichier KOXO reçu ensuite le 16 septembre contient 165 comptes à identifiant
distinct, avec un champ `Password` renseigné pour chacun. Les 164 identifiants du
pack précédent s'y retrouvent : 98 enseignants, neuf autres personnels et 57
comptes non rattachés. Les 24 enseignants sans KOXO dans le pack n'ont aucune
correspondance nominative exacte dans le XML. Un compte supplémentaire porte le
même nom qu'un enseignant déjà doté, avec un identifiant différent : examen humain
obligatoire avant tout rapprochement. Aucun mot de passe XML n'est importé ou
remplacé ; sa valeur encodée ne prouve pas le fonctionnement d'une connexion.

Les 122 enseignants du précédent export ENT disposent d'un email renseigné,
mais seuls huit ont un téléphone renseigné, dont un seul parmi les 89 comptes
KOXO déjà importés. Vingt enseignants sont absents du dernier export ENT du pack
(neuf avec KOXO, onze sans KOXO). Ces métadonnées ne prouvent pas que l'OTP email
est délivrable. Rapport et compte supplémentaire, sans codes, dans le dossier
privé `outputs/croisement-2026-09-16/`. Aucune remise réelle ni aucun import
supplémentaire n'a été effectué par ce contrôle.
