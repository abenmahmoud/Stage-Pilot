# Médias et liens Markdown publics verrouillés - preview

## Comportement livré

- Les pages « À la une », `/site/:slug` et l'aperçu du gestionnaire de contenus
  partagent le même composant Markdown.
- Une image est rendue uniquement si son URL HTTPS signée appartient au bucket
  privé `site-content` de l'origine Supabase configurée.
- Les images externes, y compris celles d'un autre projet Supabase autorisé par
  la CSP globale, ne créent aucun élément `img`.
- Les liens acceptés sont des chemins internes, des URL HTTPS sans identifiant,
  une adresse email stricte ou un numéro de téléphone international ; les liens
  web externes utilisent `noopener` et `noreferrer`.

## Vérifications

- Le test permanent exige le composant commun dans les trois consommateurs et
  contrôle la politique de média, le chargement différé et le referrer nul.
- Une recette Chromium injecte une image sur un projet Supabase tiers, un lien
  HTTPS et un lien JavaScript.
- À 320 et 1 440 px, l'image ne déclenche aucune requête, le lien HTTPS reste
  isolé et le lien JavaScript n'est pas cliquable, sans erreur ni débordement.
- Aucun contenu réel, média distant ou production n'a été utilisé ou modifié.
