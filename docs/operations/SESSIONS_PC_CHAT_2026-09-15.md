# Accès personnels aux sessions PC dans le chat — 15 septembre 2026

Adel demande que les professeurs puissent recevoir leur identifiant et leur code
de session PC après vérification d’identité. La remise reste strictement
personnelle ; les règles existantes permettent aussi l’accès propre de l’élève.

## État des données

Contrôle agrégé du coffre utilisé par le site : 1 273 attributions ENT, toutes
avec une valeur chiffrée ; aucune attribution KOXO. Aucun code réel n’a été lu.
Aucune consultation ENT n’est enregistrée au moment du contrôle : la réception
effective par une personne réelle n’est donc pas attestée par cet audit.
L’export KOXO a été demandé à Adel, sans lui demander de copier les secrets
dans la conversation. Il reste nécessaire pour la remise réelle des accès PC.

## Parcours livré

- « Mon code session PC », « Mes codes PC », « Mon accès KOXO », etc. ouvrent un
  parcours dédié, sans appel au modèle et sans renvoi automatique au formulaire.
- Une identité scolaire confirmée par un seul contact connu, email ou SMS,
  permet de consulter la carte « Ma session PC ».
- Le bouton d’affichage remet l’identifiant exact et le code chiffré associés à
  cette personne, sans dériver l’identifiant de son nom ou de son identifiant ENT.
- Si la donnée manque, l’écran le dit et permet une demande au référent. En cas
  d’échec annoncé, le chat propose une intervention humaine, sans boucle.
- « Vérifier à nouveau mon identité » permet de renouveler la preuve dans le
  même échange, sans utiliser le changement de personne.

## Sécurité

`GET/POST /api/identity/device/pc-session` ignore toute cible fournie par le
client : les paramètres et corps autres que `{}` sont rejetés. POST exige JSON.
Le lecteur utilise uniquement la session serveur : établissement, personne,
annuaire actif, preuve OTP reconnue, non-révocation et expirations sont contrôlés
dans la transaction. La preuve doit dater de moins de 30 minutes.

Les parents ne reçoivent pas le compte PC d’un enfant. Une attribution ambiguë,
signalée défectueuse ou remplacée n’est pas divulguée. Le code ne transite ni
dans les messages du chat, ni dans les brouillons, ni dans les appels IA. GET
ne divulgue aucun identifiant/code et ne consomme pas le quota. POST utilise le
point unique de lecture chiffrée et le journal sans valeur secrète.

Trois affichages maximum par jour. Le test PostgreSQL a révélé que le pilote
renvoie une date sous forme d’objet : comparaison erronée avec la chaîne du
jour. Le SELECT renvoie désormais explicitement `display_count_date::text`,
ce qui rétablit le quota pour les parcours utilisant ce helper, y compris ENT.

L’affichage est masqué à la sortie de page, au changement d’identité, lors du
recours au référent et au plus tard à l’expiration de la preuve. Aucune
réinitialisation ou modification automatique de coordonnées n’a été ajoutée.
L’ancienne route `/api/vault/koxo` reste fermée à la lecture car sa phase est
déclarée par le client et ne constitue pas une preuve serveur.

## Import à compléter

Le récepteur privé existant `api/_shared/depot-codes.ts` accepte KOXO dans un
fichier `.enc`, colonnes chiffrées `reference_personne,type_code,identifiant,code,
genere_le`. `reference_personne` doit correspondre exactement à l’annuaire actif.
Ne pas envoyer le CSV brut dans un article ou dans la base de connaissances.
L’import actuel conserve une attribution déjà présente : une mise à jour de
mot de passe existant doit suivre un remplacement humain versionné, pas un
réimport silencieux. Aucun import KOXO réel n’a été effectué dans ce lot.

## Validation et publication

- 5 tests d’intention, identité et contrat PC ; 8 tests ENT : réussis.
- 7 tests du point unique de lecture : réussis.
- 16 contrôles sur PostgreSQL jetable avec chiffrement fictif : remise exacte,
  GET sans code, quota, drapeau fermé, preuve expirée, parent, autre personne,
  autre établissement, ancienne source, révocation, annuaire retiré, défaut et
  valeur manquante. Échec de lecture : transaction annulée, quota conservé.
- Carte réelle testée au navigateur, largeur 390 px sans débordement, affichage,
  recours et états absent/expiré ; aucune erreur JavaScript.
- Build TypeScript/Vite réussi. Aucun OTP, email, SMS ou dossier réel envoyé.

Publié : commit `912f8b0`, déploiement `dpl_BVAxUAAoeXtkj5jakHmoHTfipjAN` READY,
alias principal `lycee-blaise-cendrars-sevran.fr` confirmé. GET et POST anonymes
sur l’API PC sont refusés 401, sans cache. Une demande fictive de code PC au
chat publié renvoie 200, catégorie logiciel, poursuite de la conversation sans
formulaire et sans appel IA, puis demande de vérification d’identité. Aucun
dossier créé et aucune identité réelle usurpée. Le parcours authentifié complet
reste contrôlé sur les données fictives ; la remise KOXO réelle attend l’export.
