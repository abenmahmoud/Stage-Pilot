# Brief d'audit Claude - routes de boîte d'échec

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `api/_shared/communications.ts`
- `api/communications/admin/failures/index.ts`
- `api/communications/admin/failures/[id]/retry.ts`
- tests d'autorisation et de routes associés

## Mission proposée

Auditer en lecture seule rôles, MFA, interrupteurs, projections SQL, validation
du corps, secret, statut HTTP et appel transactionnel. Chercher une reprise par
un rôle administration, une fuite d'identifiant ou un contournement lorsque
l'envoi est coupé.

Ne modifier ni appeler aucune route, travail, fichier, secret, base, email ou
déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
