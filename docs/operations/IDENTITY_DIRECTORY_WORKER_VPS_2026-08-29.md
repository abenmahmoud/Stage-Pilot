# Worker du répertoire privé - recette VPS du 29 août 2026

## Périmètre autorisé

- Cible : VPS existant, répertoire isolé `/opt/lycee-support-preview`.
- Base : branche Supabase `guichet-lycee-preview` uniquement.
- Aucun changement Hostinger, DNS, Webmail, production ou autre service VPS.
- Aucune donnée réelle utilisée.

## Installation additive

- Sauvegarde préalable des manifestes dans
  `/root/lycee-support-backups/20260829-identity-worker`.
- Ajout de `xlsx` 0.20.3 aux dépendances existantes, sans vulnérabilité npm.
- Installation du worker, de son parseur, de l'unité systemd et du timer.
- Fichier d'environnement lisible uniquement par `root` et le groupe
  `lycee-support` ; le secret HMAC a été généré sur le VPS et n'a pas été affiché.
- Limites systemd : 512 Mo de mémoire, 5 minutes, utilisateur sans connexion,
  système de fichiers protégé et aucun nouveau privilège.

## Preuves de recette

1. ClamAV 1.5.3 actif et fichier EICAR détecté avec le code attendu.
2. Exécution à vide : zéro travail réclamé, sortie propre et code `0`.
3. CSV fictif de trois personnes et une relation : état `review`, quatre lignes,
   preuve `clamav_clean`, aucun nom, email ou téléphone brut dans le rapport.
4. Fichier EICAR injecté dans la chaîne complète : état `rejected`, motif
   `antivirus_detected_threat` et objet de stockage retiré.
5. Nettoyage du test : zéro import, ligne, audit et message de file restant.
6. Timer actif toutes les minutes et second déclenchement autonome avec code `0`.
7. Workers email et pièces jointes restés actifs pendant toute l'opération.

## Limites restantes

- Le rapport ne constitue pas encore un annuaire opérationnel : les noms et
  coordonnées sont volontairement jetés après création de leurs empreintes.
- L'approbation, l'activation, le remplacement et la suppression doivent encore
  être testés dans l'interface avec une version fictive.
- Aucun fichier réel avant validation Direction/DPO des colonnes, finalités,
  habilitations, durées et procédure d'incident.
- Le disque du VPS disposait d'environ 22 Go libres lors de la recette ; sa
  consommation doit être surveillée avant des dépôts importants.

## Arrêt contrôlé

En cas d'incident, arrêter et désactiver d'abord
`lycee-identity-directory-worker.timer`. Conserver les journaux, contrôler la
file et la base de preview, puis restaurer les manifestes sauvegardés. Ne jamais
supprimer une file ou un import sans identifier précisément son propriétaire et
son état.
