# Mise en service de la double vérification des agents

## Objectif

Chaque membre de la direction ou de l’administration utilise son propre compte.
Après le mot de passe, un code temporaire généré sur son téléphone protège
l’accès aux demandes, aux pièces jointes et aux données scolaires.

## État de la preview au 26 août 2026

- Un compte individuel `administration` existe dans la base de preview.
- Aucun facteur TOTP n’est encore enregistré.
- La page `/security` permet l’activation et la validation du téléphone.
- Dès qu’un agent active TOTP, ses prochaines sessions doivent être en `aal2`.
- L’obligation générale reste désactivée pour éviter un verrouillage accidentel.

## Ordre obligatoire

1. Créer un compte nominatif pour chaque agent autorisé, sans compte partagé.
2. Commencer par deux responsables au minimum pour conserver un accès de secours.
3. Sur chaque compte, ouvrir `/security`, scanner le QR code et vérifier le code
   à six chiffres.
4. Se déconnecter, se reconnecter et confirmer que le code est redemandé.
5. Tester les pages agent, les pièces jointes et une réponse à une demande fictive.
6. Simuler un téléphone perdu sur un compte de test et faire retirer son facteur
   par un administrateur Supabase après vérification d’identité.
7. Quand les deux comptes sont validés, définir ensemble
   `VITE_REQUIRE_AGENT_MFA=true` et `REQUIRE_AGENT_MFA=true` sur l’environnement
   concerné, puis redéployer.
8. Vérifier qu’un agent sans second facteur est dirigé vers `/security` et que
   les API refusent une session `aal1`.

## Règles d’exploitation

- Ne jamais photographier, envoyer ou conserver le QR code dans un dossier.
- Ne jamais demander le code temporaire d’un agent par email ou téléphone.
- Un téléphone perdu entraîne la suspension du compte jusqu’à vérification de
  l’identité et retrait du facteur par une personne habilitée.
- Tout retrait de facteur et toute réactivation doivent être consignés dans le
  registre d’exploitation.
- Ne pas activer l’obligation générale avec un seul compte disponible.
