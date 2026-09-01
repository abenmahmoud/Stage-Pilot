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

## Durcissement complémentaire

Les migrations additives `20260901160000` et `20260901161000` rendent les
preuves de scan immuables à état constant, limitent les résumés d'événements à
1 Ko et imposent un contrat machine exact. Un événement doit aussi correspondre
à l'état réellement lu pour l'objet du même établissement.

Le premier passage distant a détecté l'absence d'une fonction JSON sur la
version PostgreSQL de preview. La seconde migration remplace cette fonction par
un comptage compatible. La recette finale refuse la réécriture d'une preuve
propre, un résumé contenant du texte libre et un faux événement `clean`, puis
confirme de nouveau cinq familles de résidus à zéro.

La migration additive `20260901170000` ferme les écarts confirmés par une revue
indépendante : identifiant et empreinte immuables, preuve terminale conservée
pendant la purge, verrou d'écriture de l'objet pendant l'ajout d'un événement,
unicité des événements réservés, propres, bloqués et purgés, et tailles résumées
entières. La recette contrôle désormais le nom exact de la contrainte ou de
l'erreur attendue. Elle passe sur la preview et revient encore à cinq résidus
nuls. Les migrations `160000`, `161000` et `170000` forment une chaîne additive
ordonnée et ne doivent pas être appliquées isolément.

## Réservation transactionnelle

Le pont serveur réserve maintenant les objets sans conserver le jeton Brevo ni
activer la route. Il verrouille l'entrant parent, recoupe les réservations déjà
présentes et impose les plafonds cumulatifs de vingt-et-un objets et 26 Mo. Une
référence déjà connue n'est réutilisée que si type d'objet, type média, taille et
chemin privé correspondent.

Après une écriture privée vérifiée, la confirmation
exacte enregistre ensemble l'état `quarantine`, l'événement machine et une tâche
PGMQ ne contenant que trois identifiants opaques. Un rejeu identique n'ajoute ni
événement ni tâche. La recette
`supabase/tests/communication_inbound_object_reservation_security.test.sql`
prouve le rejeu, une panne forcée et le rollback à cinq résidus nuls sur la base
de preview.

## Transport privé borné

Le téléchargeur et le dépôt privé sont maintenant implémentés et testés
séparément. L'orchestrateur devra mesurer les octets Brevo avant de réserver la
taille immuable, puis déposer, relire et confirmer. La taille du webhook est
une estimation. Le raccordement n'est pas encore effectué.

Le transport limite chaque objet à 10 Mio, refuse les redirections, interrompt
les échanges bloqués et ne conserve aucun jeton fournisseur. Le dépôt utilise
uniquement le chemin opaque réservé, refuse l'écrasement et compare type média,
taille et SHA-256 à la relecture. Une réponse de dépôt perdue peut être rejouée
sans remplacer le premier objet. Les erreurs ne reprennent aucun texte distant.

La recette `test:communication-inbound-transfer` couvre dix-neuf scénarios
fictifs, dont vingt rejeux simultanés, la substitution à taille égale et un
échange HTTP natif limité à `127.0.0.1`. Elle ne prouve ni le service Brevo réel,
ni un scan ClamAV, ni la capacité globale pour deux cents téléchargements.
L'orchestrateur devra borner sa concurrence et effacer ses tampons après usage.
L'effacement des copies internes n'est pas une garantie d'effacement de toutes
les copies détenues par le runtime, le transport ou l'appelant.

Sources du contrat : [pièces entrantes Brevo](https://developers.brevo.com/reference/get-inbound-email-attachment),
[webhook Brevo et taille estimée](https://developers.brevo.com/docs/inbound-parse-webhooks),
[dépôt standard Supabase](https://supabase.com/docs/guides/storage/uploads/standard-uploads).
Le dépôt standard est utilisé pour ce petit plafond ; une charge réelle et les
grandes pièces nécessitent encore une recette sur l'environnement autorisé.

## Frontières encore fermées

- raccordement du transport à la réservation et à la confirmation transactionnelles ;
- recette de transport sur les services de preview explicitement autorisés ;
- worker ClamAV autorisé et supervision ;
- preuves avec fichier propre et signature EICAR ;
- politique de conservation et purge validée ;
- activation des interrupteurs et secrets de preview.

T022 ne peut être déclarée terminée qu'après ces preuves.
