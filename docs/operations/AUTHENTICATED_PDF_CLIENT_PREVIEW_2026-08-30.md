# Ouverture des PDF authentifiés verrouillée - preview

## Comportement livré

- Les erreurs d'API passent par le lecteur JSON borné commun ; aucune réponse
  d'erreur brute n'est injectée dans l'interface.
- Un PDF local est lu en flux avec un plafond de 20 Mo, puis accepté uniquement
  si le serveur annonce `application/pdf` et si les premiers octets sont `%PDF-`.
- Un flux sans taille annoncée est annulé dès qu'il dépasse le plafond.
- Une URL externe doit utiliser HTTPS et appartenir soit au portail courant,
  soit à l'origine Supabase configurée, sans identifiants ni fragment.
- La fenêtre de document ne conserve aucun accès à la fenêtre de l'application.

## Vérifications permanentes

- Le test couvre un PDF valide, un faux type, une fausse signature, une taille
  annoncée excessive et un flux chunké excessif réellement annulé.
- Il couvre également les origines autorisées, une origine tierce, HTTP, des
  identifiants dans l'URL et un fragment.
- Le build, la barrière de sécurité, l'intégrité Spec Kit et l'audit npm doivent
  rester verts avant publication sur la branche de preview.
- Aucun PDF réel, donnée scolaire, production, stockage ou DNS n'est utilisé.
