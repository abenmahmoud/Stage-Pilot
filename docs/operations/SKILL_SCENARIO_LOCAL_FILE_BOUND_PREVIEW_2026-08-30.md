# Matrice de scénarios locale bornée - preview

- Le fichier Markdown est limité à 100 Ko avant l'appel à `file.text()`.
- Le parseur conserve ensuite son plafond de 100 000 caractères, ses 100
  scénarios maximum et ses contrôles de doublons et de secrets.
- Le fichier reste uniquement dans le navigateur : aucun upload, appel IA ou
  stockage distant n'est déclenché.
- `test:skill-scenario-plan` vérifie que le garde de taille précède la lecture
  et fait partie de `test:preview-security-gate`.
