# Brief Claude - séparation identité, rôle et autorité

## Statut

Brief préparé, non exécuté. Un lancement exige encore le modèle Claude exact et
un plafond de consommation propres à cette mission.

## Mission proposée

Auditer en lecture seule la migration T006B. Chercher uniquement un
élargissement de droits, une élévation I4 injustifiée, une confusion entre rôle
et identité, ou une incompatibilité dangereuse des contrats runtime.

## Périmètre minimal

- `shared/agent-identity-policy.ts`
- `shared/knowledge-actor-policy.ts`
- `shared/skill-registry-policy.ts`
- `shared/public-agent-skill-policy.ts`
- `shared/schedule-policy.ts`
- `shared/support-routing.ts`
- `shared/agent-tool-policy.ts`
- `api/_shared/auth.ts`
- `api/_shared/knowledge-actor.ts`
- tests directement associés et diff Git du lot

Ne transmettre aucun fichier `.env`, secret, journal, donnée réelle, export de
personnes ou contenu utilisateur. Aucun outil d'écriture ou de déploiement.

## Questions d'audit

1. Une combinaison incohérente identité/rôle peut-elle lire une source interne,
   personnelle ou sensible ?
2. I4 peut-il être obtenu sans adhésion active et `aal2` récent ?
3. Un ancien libellé peut-il élargir les droits ou être accepté silencieusement ?
4. Les emplois du temps exigent-ils toujours I3 et une relation autorisée ?
5. Les actions A4 restent-elles bloquées avant tout autre contrôle ?
6. La modification des codes de refus ou métadonnées casse-t-elle un contrat
   persistant ou un consommateur non testé ?

## Livrable attendu

Constats classés par sévérité avec fichier, ligne, scénario reproductible et
correction minimale. Arrêt après la première passe ; aucune relance ni second
lot sans nouvelle autorisation.
