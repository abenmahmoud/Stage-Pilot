# Validation des réponses Emplois du temps en preview

## Périmètre

Ce lot ferme la frontière entre les API privées d'administration des emplois du
temps et le navigateur. Il ne déploie pas le worker antivirus, n'importe aucun
PDF réel et ne modifie aucun service de production.

## Garanties

- Les listes sont bornées à 100 versions, ordonnées et sans identifiant en
  double.
- La réservation reprend exactement le PDF annoncé et limite le chemin au coffre
  privé attendu.
- Les confirmations et promotions sont liées à l'identifiant et à l'état
  attendus avant tout message de réussite.
- L'index page-référence impose le périmètre classes ou professeurs, l'ordre,
  l'unicité et une version en cours de révision.
- Le lien PDF exige HTTPS, l'origine Supabase configurée, le coffre privé, un
  seul jeton et une expiration de 60 secondes avant ouverture.
- Les réponses serveur excluent les chemins de stockage, identifiants d'acteurs,
  sommes de contrôle et résumés techniques.

## Vérifications du 1er septembre 2026

```powershell
npm run test:schedule-admin-payload
npm run test:preview-security-gate
npm run build
```

Résultat : 7 tests ciblés réussis, barrière de sécurité complète réussie et
build réussi. Aucun fichier réel, appel fournisseur, envoi d'email, donnée
distante ou changement de production n'a été utilisé.

## Limite restante

T042C2C reste ouverte : il faut installer le worker sur le runtime de preview et
prouver les scénarios PDF fictif, EICAR, panne antivirus et reprise avant toute
autorisation de données réelles.
