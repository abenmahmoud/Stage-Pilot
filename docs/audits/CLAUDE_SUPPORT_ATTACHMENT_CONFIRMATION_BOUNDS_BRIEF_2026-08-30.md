# Brief d'audit Claude - confirmation des pièces jointes

## Mission préparée

Auditer en lecture seule la confirmation d'une pièce jointe publique, sans
accéder à Supabase, à une donnée réelle ou à un environnement distant.

## Fichiers à examiner

- `shared/bounded-blob.ts`
- `api/support/attachments/[id]/confirm.ts`
- `scripts/test-support-attachment-confirmation-bounds.mjs`

## Questions

1. Un Blob annoncé à plus de 10 Mo peut-il être copié en mémoire ?
2. Un fichier dont la taille diffère de la réservation peut-il atteindre la
   quarantaine antivirus ?
3. Une source mensongère peut-elle contourner la vérification après lecture ?
4. Un échec de lecture peut-il produire un faux succès ou exposer le fichier ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
