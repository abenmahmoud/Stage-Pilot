# Recherche et décisions

## Décisions retenues

- Réutiliser l'authentification, les rôles et la MFA du projet évite un second
  espace de connexion.
- Employer un bucket privé permet de conserver les brouillons réellement privés.
- Utiliser Markdown fournit les outils courants d'écriture sans accepter de HTML
  ou de scripts arbitraires.
- Garder une API publique filtrée évite d'exposer directement les tables de
  gestion au navigateur public.
- L'aide IA utilise la clé OpenAI existante de la preview, confirmée par le
  propriétaire, et ne reçoit que le texte explicitement envoyé par l'éditeur.

## Sources techniques vérifiées

- Supabase Storage Buckets :
  https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase Storage Access Control :
  https://supabase.com/docs/guides/storage/security/access-control
- Changelog Supabase consulté le 26 août 2026 : les nouvelles tables peuvent ne
  plus être exposées automatiquement aux Data APIs. Le module passe donc par les
  API serveur et révoque explicitement les droits directs.
