# Recette navigateur du centre de communications

## Portée

La recette utilise une page locale temporaire, un rôle direction AAL2 fictif et
des réponses API injectées en mémoire. Elle ne crée aucun compte, ne lit aucune
base distante et ne déclenche ni publication, ni Webmail, ni Brevo.

La fixture contient deux communications, une réponse et un échec, tous marqués
comme fictifs. Elle est supprimée du dépôt de travail après les contrôles.

## Résultats

| Contrôle | 1 440 px | 320 px |
| --- | --- | --- |
| Débordement du document | aucun | aucun |
| Débordement de l'aperçu email | aucun | aucun |
| Axe WCAG A/AA final | 0 violation, 0 incomplet | 0 violation, 0 incomplet |
| Erreurs navigateur | 0 | 0 |

Le parcours au clavier atteint les commandes, la recherche, les deux
communications, les champs et les modes de message. Le contrôle actif conserve
un anneau de focus visible et reste entièrement dans le viewport mobile.

## Correction issue de la recette

La première passe Axe signalait le sous-titre blanc translucide de l'étape 1 et
les deux textes gris de l'étape 3. Ils utilisent maintenant du blanc opaque et
des gris `slate-600`/`slate-500`. Les passes finales sont propres.

## Preuves visuelles locales

- `C:\Users\adelb\AppData\Local\Temp\lyceegest-communications-desktop.png`
- `C:\Users\adelb\AppData\Local\Temp\lyceegest-communications-mobile.png`

T031 reste ouverte jusqu'à un test humain avec lecteur d'écran et une session
authentifiée de preview autorisée.
