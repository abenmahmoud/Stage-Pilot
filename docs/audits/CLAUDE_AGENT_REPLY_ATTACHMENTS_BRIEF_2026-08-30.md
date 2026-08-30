# Brief Claude - pièces jointes des réponses agent

## État

Préparé mais non exécuté. Le propriétaire a demandé des audits Claude réguliers,
mais n'a pas fixé pour cette mission le modèle exact ni le plafond de jetons.
Aucun quota externe ne doit être consommé sans ces deux paramètres.

## Mission proposée

- Fournisseur : Anthropic.
- Modèle : à confirmer par le propriétaire.
- Mode : lecture seule.
- Volume : moyen, environ 14 fichiers ciblés.
- Limite : à confirmer par le propriétaire.
- Arrêt : rapport unique, sans modification, commande, réseau ni déploiement.

## Périmètre minimal

- Migration `20260830170000_add_agent_reply_attachments.sql` et `db/schema.ts`.
- Routes de réservation et confirmation agent.
- Route de réponse agent et filtres publics de détail/téléchargement.
- Worker email VPS et worker Vercel.
- Contrats du client React et test dédié.

## Questions d'audit

1. Un brouillon agent peut-il être rendu public avant antivirus ou message ?
2. Une pièce peut-elle être déplacée vers un autre dossier, service ou compte ?
3. Une course ou un rejeu peut-il publier deux fois ou libérer une pièce tierce ?
4. Une demande sensible non vérifiée peut-elle recevoir un document ?
5. Le lien signé ou les métadonnées exposent-ils stockage, identité ou secret ?
6. Les limites de taille, nombre, MIME et corps HTTP sont-elles contournables ?

## Livrable attendu

Constats classés par sévérité avec fichier et ligne, scénario de reproduction,
impact, correction minimale et tests manquants. Toute affirmation doit être
revérifiée par Codex avant modification.
