# Brief d'audit Claude - client du worker Webmail

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `shared/communication-webmail-client.ts`
- `scripts/test-communication-webmail-client.mjs`
- contrats commande, reçu et complétion appelés par le client

## Mission proposée

Auditer en lecture seule le délai, l'annulation, la concurrence, l'ordre des
résultats, la validation avant/après transport et la classification des erreurs.
Chercher une promesse non maîtrisée, un double appel, un contournement des
limites ou une fuite de texte fournisseur.

Ne modifier aucun fichier, endpoint, secret, environnement, contact, email ou
déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
