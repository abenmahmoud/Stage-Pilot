# Brief Claude - supervision des retraits interrompus

## État

Préparé mais non exécuté. Le modèle Claude exact et le plafond de jetons propres
à cette mission ne sont pas définis. Aucun quota externe ne doit être consommé
sans ces paramètres.

## Mission proposée

- Lecture seule, sans commande, réseau, modification ni déploiement.
- Périmètre : API de santé des demandes, écran direction, test ciblé,
  spécification et procédure d'exploitation.
- Limite de jetons : à confirmer par le propriétaire.
- Livrable : un rapport unique, classé par sévérité.

## Questions

1. Le compteur peut-il inclure un autre établissement ?
2. Une pièce publiée ou liée à un message peut-elle être comptée ?
3. La réponse ou l'interface révèle-t-elle un nom, chemin, dossier ou compte ?
4. Un état transitoire normal peut-il provoquer une action destructive ?
5. L'absence de réparation automatique et la procédure de reprise sont-elles
   assez explicites ?
6. Un compte sans MFA ou sans rôle direction peut-il lire ce compteur ?

Toute conclusion externe devra être reproduite localement avant correction.
