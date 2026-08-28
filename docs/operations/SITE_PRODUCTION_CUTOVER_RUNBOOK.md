# Bascule progressive du site officiel

**Statut** : procédure préparée, non exécutée
**Date** : 28 août 2026

## 1. Situation vérifiée

- Le domaine principal `lycee-blaise-cendrars-sevran.fr` pointe encore vers
  l'adresse Hostinger `147.79.112.49`.
- `www` est un alias du domaine principal.
- `gestion.lycee-blaise-cendrars-sevran.fr` pointe déjà vers Vercel et reste
  associé au projet `lyceegest`.
- Le site Hostinger, le Webmail, les DNS et la production Supabase ne sont pas
  modifiés par cette procédure tant que l'ordre de bascule n'est pas donné.

## 2. Conditions bloquantes avant bascule

La bascule est interdite tant qu'un point reste non validé :

1. Les 28 contenus repris ont une décision humaine : publier, archiver ou
   remplacer. Aucun brouillon `needs_review` destiné au lancement ne subsiste.
2. Les trois fichiers refusés sont remplacés, optimisés ou retirés avec une
   décision explicite.
3. Les mentions légales, la confidentialité, l'accessibilité et les contacts
   officiels sont relus par la direction et, lorsque nécessaire, le DPO.
4. Les comptes agents sont nominatifs, leurs droits sont contrôlés et le MFA est
   testé. Aucun mot de passe partagé ne sert à la production.
5. La base et le stockage de production sont sauvegardés séparément. Une
   restauration dans une cible isolée a été testée et datée.
6. La recette ordinateur, téléphone, formulaires, authentification, pièces
   jointes, charge et sécurité est signée.
7. La direction autorise par écrit la date, le domaine, le déploiement Vercel et
   la branche Supabase concernés.

## 3. Préparation sans coupure

1. Geler les modifications WordPress pendant la fenêtre annoncée.
2. Exporter la base WordPress et les fichiers Hostinger, puis vérifier que les
   archives sont lisibles. Ne rien supprimer chez Hostinger.
3. Exporter la base Supabase de production et établir un manifeste du stockage.
4. Noter les valeurs DNS existantes, leur TTL et l'heure du relevé.
5. Déployer en production un commit Git précis et noter son identifiant Vercel.
6. Ajouter le domaine dans Vercel sans changer encore le DNS et utiliser
   uniquement les enregistrements alors indiqués par Vercel.
7. Rejouer la recette sur l'adresse Vercel de production avant exposition du
   domaine principal.

## 4. Fenêtre de bascule

Deux personnes habilitées doivent être disponibles : une exécute, l'autre
contrôle et note les preuves.

1. Changer uniquement les enregistrements nécessaires pour le domaine principal
   et `www`. Ne pas modifier `mail`, `gestion` ni un autre sous-domaine.
2. Attendre la résolution DNS et le certificat HTTPS.
3. Vérifier l'accueil, les 28 anciennes adresses, les formations, les documents,
   l'aide, la connexion agent et les en-têtes de sécurité.
4. Garder les envois réels et les automatisations sensibles désactivés jusqu'à
   leur recette distincte.
5. Surveiller les erreurs Vercel, la base et les demandes pendant toute la
   fenêtre.

## 5. Retour arrière

Déclencher le retour si le domaine ne répond pas, si une fonction prioritaire
échoue, si l'authentification expose un risque ou si des erreurs répétées `5xx`
apparaissent.

1. Remettre l'enregistrement principal à `147.79.112.49` et conserver `www`
   comme alias du domaine principal, après vérification que ces valeurs sont
   toujours celles du relevé de départ.
2. Ne pas supprimer le déploiement Vercel : le conserver pour l'analyse.
3. Suspendre les fonctions nouvelles susceptibles d'écrire ou de notifier.
4. Vérifier le retour du site Hostinger et du certificat sur deux réseaux.
5. Documenter l'heure, le symptôme, les journaux et les opérations réalisées.

Le retour DNS ne remplace pas une restauration de données. Toute restauration
de base ou de fichiers suit une procédure séparée, vers une cible isolée, puis
exige une validation avant remplacement.

## 6. Preuves à conserver

- accord de la direction et fenêtre autorisée ;
- commit Git et identifiant du déploiement Vercel ;
- exports et résultat du test de restauration ;
- relevé DNS avant/après ;
- résultats des tests et captures téléphone/ordinateur ;
- journal de bascule ou de retour arrière.
