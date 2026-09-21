# Comptes et services — contrôle du 22 septembre 2026

Adel demande de distinguer le compte superadministrateur des accès des autres services. La page « Équipes et services » ne montrait que des compteurs par service ; un même compte pouvait apparaître sept fois sans que cela soit explicite.

La branche pilote Supabase du portail contient deux adhésions actives pour le lycée : un compte superadmin avec accès global et un compte agent responsable des sept services. Le nombre « 1 compte habilité » dans chaque service désigne donc le même agent polyvalent, et non sept collègues distincts. Ce constat ne constitue pas une décision de conserver ces sept attributions ; aucune habilitation n'a été modifiée.

L'API de lecture exige désormais le rôle direction ou superadmin, une adhésion active au bon établissement et la vérification renforcée applicable. Elle renvoie les seules adresses de connexion professionnelles, les rôles et services actifs à cette page privée. L'interface affiche les comptes uniques et leurs périmètres, sans mot de passe, code, jeton ni donnée d'élève. Aucun compte n'a été créé ou supprimé.

Vérifications locales : build TypeScript/Vite, politique d'accès et portée établissement. À contrôler après publication : rendu avec le compte superadmin sur ordinateur et téléphone, refus sans session et refus pour un agent de service. Les droits du compte polyvalent doivent être revus avec Adel avant toute réduction.
