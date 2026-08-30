# Brief d'audit Claude - contrat du détail agent

## Mission préparée

Vérifier que la console agent refuse tout détail de demande incomplet avant
affichage, sans perdre la file et sans élargir le périmètre d'accès.

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `scripts/test-support-detail-payload-validation.mjs`
- `api/support/agent/requests/[code].ts`

## Questions

1. Chaque champ réellement utilisé par l'interface est-il validé ?
2. Les contrats file et détail correspondent-ils aux réponses serveur réelles ?
3. Une réponse partielle peut-elle encore provoquer un crash ou une confusion ?
4. Le périmètre agent est-il vérifié sans faire confiance au navigateur ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
