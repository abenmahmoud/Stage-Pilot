# Contrats de l'administration des contenus - preview

## Périmètre

Ce lot ferme les réponses de lecture et les actions principales de
`/admin/contenus` sans donnée réelle, upload, publication, email ni accès à la
production.

## Frontières garanties

- `GET /api/content/admin` : 250 résumés, 100 modèles et 250 médias au maximum.
- `GET /api/content/admin/:id` : un brouillon lié à l'UUID demandé, 20 médias
  liés et 100 versions au maximum.
- Création, modification et actions : reçu exact avec ressource, UUID, action,
  statut, version et état de relecture.
- Les identifiants d'acteurs, chemins et buckets de stockage, données d'audit et
  autres colonnes SQL ne sont jamais projetés vers l'écran.
- Un média lié prêt peut porter uniquement un lien signé HTTPS du bucket privé
  `site-content` sur l'origine Supabase configurée.

## Refus vérifiés

- propriété inconnue ou interne ;
- collection surdimensionnée ou UUID dupliqué ;
- détail substitué par un autre contenu ;
- historique désordonné ou dupliqué ;
- URL signée issue d'une autre origine ou chemin privé ajouté ;
- reçu lié à la mauvaise action, au mauvais UUID ou au mauvais statut.

## Vérifications

```powershell
npm run test:site-content-admin-payload
npm run test:site-content
npm run test:public-content-client-payload
npm run test:site-content-request-body-bounds
npm run test:legacy-admin-import-bounds
npm run test:spec-integrity
npm run build
npm run test:preview-security-gate
npm audit --omit=dev
```

Toutes ces vérifications passent, avec 516 tâches Spec Kit cohérentes et aucune
vulnérabilité de dépendance de production détectée.

Le déploiement de preview n'autorise pas une publication officielle. Les
réservations et confirmations de fichiers, modèles, suggestions IA et imports
hérités restent à fermer dans le lot suivant.
