# Brief Claude - frontière des méthodes API

## Statut

Audit externe non exécuté. Zéro jeton externe consommé.

## Mission préparée

Relire le test transversal des 94 routes Vercel. Vérifier qu'il exclut seulement
les modules internes, qu'il détecte une route permissive et qu'il n'accepte pas
une réponse `405` divergente de la fonction partagée.

## Contraintes d'exécution

Le modèle Claude exact et le plafond de jetons propres à cette mission ne sont
pas fixés. Codex exécute donc la revue et les tests localement, sans appel
externe.
