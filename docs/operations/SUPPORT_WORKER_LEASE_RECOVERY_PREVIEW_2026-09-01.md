# Reprise du bail de la file support - preview du 1er septembre 2026

## Périmètre

- Base : branche Supabase de preview `xijocumlwivhbmffrnlj`.
- File : `support_jobs` via PGMQ.
- Marqueur fictif : `7a91c84d2f0e6b35`.
- Type de sonde : `worker_recovery_probe` ; ce type n'est pas une notification.
- Aucun dossier, contact, email, SMS, fournisseur, ENT, PRONOTE ou donnée réelle.

La recette vérifie le mécanisme de bail que le worker utilise. Elle ne prétend
pas reproduire une coupure au milieu d'un appel Brevo et ne modifie aucun
interrupteur d'envoi.

## Préconditions

PGMQ est actif, la file existe et la file comme son archive sont vides. Le test
est exécuté uniquement sur l'identifiant exact de la branche de preview. Le
message contient un marqueur de seize caractères et `test_only: true`.

## Résultat observé

1. Le message sonde reçoit le `msg_id` 3219.
2. Un premier consommateur le réclame avec un bail de trois secondes :
   `read_ct = 1` et bail actif.
3. Cette connexion se termine sans appeler `delete` ou `archive`.
4. Après 4,5 secondes, une seconde connexion réclame le même `msg_id` 3219 :
   `read_ct = 2` et nouveau bail actif.
5. Le second consommateur supprime explicitement le message.
6. Une lecture séparée confirme zéro résidu dans la file, zéro dans l'archive et
   zéro message total dans `support_jobs`.

Le premier contrôle de résidu exécuté dans la même instruction SQL que la
suppression voyait encore l'instantané antérieur de la transaction. La lecture
séparée suivante est la preuve de nettoyage retenue.

## Portée de la preuve

T047B vérifie les décisions du worker : payload obligatoire, reprises bornées,
cinquième échec isolé et `job_id` idempotent. T047C vérifie 200 créations HTTP,
200 rejeux exacts et seulement 400 travaux. La présente recette T047D ajoute la
preuve qu'une prise abandonnée n'est pas perdue et que le même message revient
au consommateur suivant. Ensemble, ces trois preuves ferment T047 sans exécuter
de transport externe.
