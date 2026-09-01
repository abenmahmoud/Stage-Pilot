# Fondation de quarantaine des messages entrants

## Statut

Socle appliqué et vérifié uniquement sur la base Supabase de preview
`xijocumlwivhbmffrnlj`. Aucun contenu réel, webhook, téléchargement fournisseur,
worker, secret Vercel ou envoi n'a été activé.

## Composants livrés

- registre privé `communication_inbound_objects` sans coordonnées ni contenu ;
- audit append-only `communication_inbound_object_events` ;
- buckets privés `communication-inbound-quarantine` et
  `communication-inbound-clean`, limités à 10 Mo ;
- file privée PGMQ `communication_inbound_scan` ;
- états fermés et preuve `clamav_clean` obligatoire avant promotion ;
- droits clients révoqués et RLS forcée.

## Preuve exécutée

La recette `supabase/tests/communication_inbound_quarantine_security.test.sql`
utilise uniquement deux établissements et deux entrants fictifs. Elle confirme :

- le cycle `reserved` vers `quarantine` vers `clean` ;
- le refus d'une promotion propre sans preuve ;
- le refus d'une référence HMAC dupliquée ;
- le refus d'un rattachement entre établissements ;
- le refus d'un retour d'état et d'une mutation de l'audit ;
- l'absence de privilèges pour `anon` et `authenticated` ;
- le caractère privé des deux buckets ;
- cinq familles de résidus à zéro après rollback.

Les conseillers Supabase remontent seulement quatre informations attendues pour
ce nouveau socle : deux tables RLS sans politique, car elles sont réservées au
service interne, et deux index encore inutilisés, car aucun trafic n'est activé.

## Frontières encore fermées

- récupération bornée du contenu depuis Brevo ;
- transaction de réservation, stockage et mise en file ;
- worker ClamAV autorisé et supervision ;
- preuves avec fichier propre et signature EICAR ;
- politique de conservation et purge validée ;
- activation des interrupteurs et secrets de preview.

T022 ne peut être déclarée terminée qu'après ces preuves.
