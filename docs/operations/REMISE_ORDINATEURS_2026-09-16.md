# Suivi privé de remise des ordinateurs — 16 septembre 2026

## Source et périmètre

Le document remis pour la « liste des absents » (`doc03277120260916123544.pdf`) contient 31 pages d'anciennes impressions remises par l'administration. Adel a précisé que les « A » non effacés indiquent les absents, à rapprocher du nom et de la classe de chaque page. La précédente conclusion fondée sur les dates et les cases de signature était erronée ; elle ne doit plus être utilisée. Les 31 pages ont été relues visuellement le 16 septembre : 45 « A » lisibles et deux mentions « Absent » non effacées ont été retenus ; les marques raturées ont été exclues. Les 47 lignes correspondantes ont été ajoutées au suivi privé comme PC à remettre, sans les marquer remis. La transcription avec références de pages et le fichier de réimport sont conservés uniquement dans le Dépôt Lycée privé, dossier `07-Suivi-ordinateurs`.

Le suivi est manuel et privé, dans `/gestion/remise-ordinateurs`. L'ajout unitaire ou par lot (texte/CSV `Nom Prénom ; Classe`, 100 lignes maximum) ne s'active qu'après contrôle des « A » non effacés, des noms et des classes. La saisie est relue à l'écran ; le fichier choisi reste dans le navigateur jusqu'à l'envoi volontaire des lignes. Aucune diffusion aux familles, aucun email ou push n'est déclenché.

## Utilisation

1. Connectez-vous en superadministrateur avec la double vérification.
2. Ajoutez les élèves confirmés en attente. Une même combinaison de nom et classe est ignorée lors d'un second ajout ; le bilan affiche les doublons.
3. À la venue de l'élève, vérifiez son identité et recherchez sa ligne. Une fois le PC effectivement remis, cliquez sur « Marquer remis ».
4. La date et le compte qui a validé la remise sont conservés. « Corriger » réouvre une remise enregistrée par erreur. Une ligne en attente ajoutée par erreur peut être retirée.

Le registre ne contient ni numéro de série, ni code de session, ni motif d'absence. Les actions `created`, `delivered`, `reopened` et `removed` restent dans une table d'audit privée. Les tables sont sous RLS forcée ; seuls le service serveur et le superadmin habilité accèdent à l'API, avec contrôle d'établissement et AAL2. Le PDF source et les noms des élèves ne sont pas dans Git.

## Validation

- Migration `20260916191413_regional_device_handoffs.sql` appliquée à la branche Supabase active du portail `xijocumlwivhbmffrnlj` ; contrôle initial `handoffs_ready=true`, `audit_ready=true`, `rls_forced=true`, `rows=0`.
- Build TypeScript/Vite : réussi.
- API anonyme : refus 401 contrôlé lors de la mise en ligne.
- Compte superadmin connecté : ajout de 47 lignes en un lot confirmé par le site (« 47 élèves ajoutés », compteur 47 « À remettre », 0 « Remis »). La recherche, la remise et la correction restent à essayer lors d'une remise réelle.
