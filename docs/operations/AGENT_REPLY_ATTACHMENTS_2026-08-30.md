# Documents dans les réponses agent

## Périmètre livré

- Réservation par un agent authentifié et autorisé sur le service du dossier.
- Cinq documents agent en attente au maximum, dix documents au total par dossier.
- Formats PDF, image, texte, DOCX et XLSX, avec plafond de 10 Mo.
- Dépôt signé dans `support-quarantine`, contrôle de signature, empreinte SHA-256
  et passage par la file `support_file_scan` puis ClamAV.
- Publication atomique avec le message agent uniquement si le statut est `clean`.
- Visibilité publique refusée avant `message_id`, `released_at` et `released_by`.
- Téléchargement depuis le suivi par URL privée valable 60 secondes.
- Email sans binaire : il annonce le nombre de documents et renvoie au suivi.

## Barrières de sécurité

- Le compte, l'établissement, le service, le dossier et le propriétaire du dépôt
  sont vérifiés à chaque étape.
- Une pièce agent ne peut être confirmée que par le compte qui l'a réservée.
- Aucun document sortant n'est autorisé pour une demande ENT ou email académique
  tant que l'identité scolaire n'est pas confirmée.
- Les doublons d'identifiants sont refusés et une pièce déjà publiée ne peut pas
  être réutilisée.
- Les brouillons agent ne figurent ni dans le détail public ni dans la route de
  téléchargement publique.
- RLS activée et forcée ; aucun droit direct `anon` ou `authenticated`.

## Vérifications exécutées

- `npm run build`
- `npm run test:support-agent-reply-attachments` : 6/6
- `npm run test:support-public-detail-payload` : 3/3
- `npm run test:support-agent-request-body-bounds` : 3/3
- `npm run test:preview-security-gate` : succès complet
- Couverture : 99 routes HTTP, 68 routes privées, 78 migrations uniques.
- Inspection Supabase preview : quatre colonnes et deux contraintes présentes ;
  RLS forcée et privilèges client absents.

## État distant

La migration est appliquée uniquement au projet preview Supabase
`xijocumlwivhbmffrnlj`. Aucun fichier réel n'a été déposé, aucun email n'a été
envoyé et aucune production n'a été modifiée.

Les avis Supabase restent informatifs : la table privée n'a volontairement
aucune politique client, car toutes les lectures passent par les API serveur. Le
nouvel index est signalé comme inutilisé avant trafic, ce qui est attendu.
