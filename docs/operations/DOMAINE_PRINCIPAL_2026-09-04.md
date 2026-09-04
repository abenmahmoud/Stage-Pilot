# Portail sur le domaine principal — 4 septembre 2026

Adel demande explicitement le portail sur
`https://lycee-blaise-cendrars-sevran.fr/`, puis confirme de continuer.

## Bascule réalisée

- Domaine ajouté au projet Vercel `safe-scol/lyceegest`, identifiant
  `prj_mgYyTk8e2FwUMW5kSG8176Snypy5`, branche `codex/lycee-connect-prototype`.
- Alias initial affecté au déploiement vérifié `dpl_CzbJTUf1MzRFdEJ82GmabM1Hc74f`
  (`e5efc4f`), sans reconstruction ni changement de base.
- Chez Hostinger, `A @` passe de `147.79.112.49` à `76.76.21.21`, valeur demandée
  par Vercel ; TTL 300. L'ancien `AAAA @` vers
  `2a02:4780:27:1522:0:1cb2:99d:2` est retiré pour éviter deux destinations.
- `www` garde son CNAME vers la racine et est ajouté à Vercel avec redirection
  permanente vers le domaine sans www. `mail`, `ftp`, `gestion` et les serveurs
  de noms sont conservés. La zone ne contenait ni MX ni TXT ; aucun n'est ajouté.
- DNS autoritaire Hostinger et résolveur 1.1.1.1 confirment la nouvelle adresse.
  HTTPS sur Vercel répond 200 sans ignorer la validation du certificat.
- Les deux URLs du worker email et de la branche Vercel sont alignées sur la
  racine. La mise à jour Vercel est incorporée au prochain déploiement de ce lot.
- L'affiche A4 et son QR sont mis à jour pour la même URL, sans `/prototype`.

## Portée et retour arrière

Le domaine sert le portail et le pilote Supabase déjà utilisés sur `gestion`,
base `xijocumlwivhbmffrnlj`. La base historique `sfqhxiamhgsbbogluqtq` reste
inchangée. La remise à zéro des demandes a été faite séparément et documentée.

WordPress et ses fichiers sont conservés chez Hostinger. La reprise éditoriale
des anciennes pages reste ouverte : le flux public du nouveau registre renvoie
zéro contenu publié au moment de cette bascule. Les pages WordPress n'ont pas
été publiées automatiquement ni déclarées à jour par ce changement d'adresse.

La zone initiale complète (six enregistrements) et les domaines Vercel sont
sauvegardés localement dans `.vercel/domain-cutover`. Pour revenir au site
WordPress, restaurer uniquement `A @ = 147.79.112.49` et l'ancien `AAAA @`, TTL
1800. Les deux variables URL du VPS sont sauvegardées sous accès root dans
`/root/lycee-support-backups/20260904-domain-cutover`. Aucun changement des
serveurs de noms ni transfert du domaine n'est nécessaire.
