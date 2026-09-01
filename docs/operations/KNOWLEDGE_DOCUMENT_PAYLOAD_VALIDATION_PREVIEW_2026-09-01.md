# Validation des documents confiés à l'agent en preview

## Périmètre

Ce lot ferme la frontière entre le dépôt documentaire privé, ses API et l'écran
superadmin. Il n'importe aucun document réel, ne publie aucune connaissance et
ne modifie aucun service de production.

## Garanties

- La liste est bornée à 200 documents, ordonnée, sans doublon et sans champ
  interne.
- La réservation TUS reprend exactement le nom, le type et la taille annoncés,
  puis limite le chemin au coffre `knowledge-ingest`.
- La confirmation et la décision humaine sont liées à l'UUID, l'action, l'état
  et la source attendus avant tout message de réussite.
- Les chemins de stockage, checksums, textes extraits et identifiants d'acteurs
  restent côté serveur.
- Le lien de lecture exige HTTPS, l'origine Supabase configurée, le coffre privé,
  un jeton unique et une expiration de 60 secondes.
- L'API ne signe un lien que pour un document `review` ou `ready`, donc après la
  preuve antivirus du pipeline.

## Vérifications du 1er septembre 2026

```powershell
npm run test:knowledge-document-admin-payload
npm run test:knowledge-document-ingestion
npm run test:knowledge-document-review
npm run test:knowledge-document-governance
npm run test:knowledge-document-worker
npm run test:preview-security-gate
npm run build
```

Résultat : 7 tests adverses, 38 recettes documentaires historiques, la barrière
de sécurité complète et le build réussissent. Aucun fichier réel, appel
fournisseur, email, donnée distante ou changement de production n'a été utilisé.
