# Routage et priorité déterministes

Date : 29 août 2026
Périmètre : branche `codex/lycee-connect-prototype`, preview uniquement

## Règles livrées

- La catégorie et le texte de la demande déterminent le service avant tout appel
  à l'IA.
- Le service et la priorité sont enregistrés ensemble lors de la création du
  dossier.
- La priorité normale `p3` reste le défaut, y compris lorsque l'utilisateur
  écrit seulement « urgent ».
- Un risque explicite de protection passe en priorité critique `p1` et rejoint la
  vie scolaire.
- Un « incident grave » adressé à la direction passe en priorité urgente `p2`.
- Une demande insuffisamment claire rejoint la qualification humaine sans
  priorité artificiellement élevée.

## Preuves locales

```powershell
npm run test:support-routing
npm run test:support-multilingual
npm run test:support-queue
npm run test:support-agent
npm run build
```

Résultat : 32 contrôles ciblés réussis et build TypeScript/Vite réussi.

## Limites

- Ce lot ne définit pas les délais de réponse ni les relances automatiques. Ces
  décisions restent dans T029 et devront être validées par service.
- Aucun classement produit par l'IA ne remplace ces règles déterministes.
- Aucune production, donnée réelle, base distante, notification, DNS, VPS,
  Webmail, ENT ou PRONOTE n'a été modifié pendant ce lot.
