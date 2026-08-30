# Navigation clavier de l’espace agent

## Comportement attendu

- Tabulation depuis le début de page : le lien d’évitement devient visible et
  place le focus sur le contenu principal.
- Bouton menu mobile : `aria-expanded` annonce l’état et référence le panneau.
- Ouverture : le bouton de fermeture reçoit le focus et Tab reste dans le
  panneau modal.
- Échap, bouton Fermer ou fond : le menu se ferme et le focus revient au bouton
  d’ouverture.
- Choix d’une rubrique : le menu se ferme et le focus rejoint le contenu.
- Menu fermé : `inert` et `aria-hidden` empêchent d’atteindre la navigation
  mobile dupliquée.

## Vérifications

Le contrat statique dédié et la compilation TypeScript/Vite passent. Cette
preuve ne remplace pas une lecture complète avec NVDA ou VoiceOver sur une
session agent nominative.
