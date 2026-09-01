# Réponses auxiliaires des contenus - preview

## Périmètre

Ce lot ferme les routes auxiliaires de `/admin/contenus` : médias, modèles,
assistance de rédaction et reprise WordPress. Il ne publie aucun contenu,
n'envoie aucun email et n'utilise aucun fichier réel.

## Contrats fermés

- Réservation : métadonnées annoncées, UUID, état `pending`, chemin aléatoire
  privé et jeton signé exacts avant `uploadToSignedUrl`.
- Confirmation : même UUID et mêmes métadonnées, état `ready`, sans chemin,
  bucket, acteur ou ligne SQL complète. Le serveur télécharge au plus 10 Mo et
  refuse une signature réelle incompatible avec le MIME déclaré.
- Bibliothèque : 200 médias prêts au maximum, liens signés limités à l'origine
  Supabase configurée et au bucket privé `site-content`.
- Modèles : 100 au maximum, champs éditoriaux exacts et verrou de version à la
  modification.
- IA : sept champs bornés, listes de cinq éléments uniques au maximum et refus
  des secrets détectables avant affichage ou application.
- Reprise : source et compteurs cohérents en lecture ; progression agrégée en
  écriture, sans erreur, référence ou identifiant individuel côté navigateur.

## Réparation SQL de preview

La contrainte d'audit initiale omettait `reserve_upload` et `reject_upload` alors
que les routes les journalisaient. La migration additive
`20260901060000_fix_site_content_upload_audit_actions.sql` a été appliquée avec
la CLI Supabase explicitement sur `xijocumlwivhbmffrnlj`, référence utilisée par
les variables Vercel de preview.

Une transaction de recette insère trois événements fictifs :
`reserve_upload`, `confirm_upload`, `reject_upload`. Les trois sont acceptés,
puis `ROLLBACK` est exécuté. La lecture suivante confirme `residue = 0`.

## Commandes de vérification

```powershell
npm run test:site-content-admin-aux-payload
npm run test:site-content-file-signature
npm run test:site-content-admin-payload
npm run test:site-content
npm run test:site-content-request-body-bounds
npm run test:legacy-import
npm run test:legacy-admin-import-bounds
npm run test:migration-integrity
npm run test:spec-integrity
npm run build
npm run test:preview-security-gate
npm audit --omit=dev
```

Toutes ces commandes passent le 1er septembre 2026. L'audit des dépendances de
production signale zéro vulnérabilité.

La migration de preview n'autorise ni une bascule de production ni une
publication officielle. Aucun DNS, VPS, Hostinger, ENT, PRONOTE ou webmail n'est
modifié.

## Barrière restante

La signature binaire n'est pas un antivirus. T009C reste ouverte : les fichiers
éditoriaux devront passer par une quarantaine et un worker antivirus avant tout
pilote public avec des documents réels.
