# Journal des versions

Toutes les évolutions notables de GL HUB sont listées ici, dans l'ordre chronologique réel du dépôt Git.

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) ; les numéros suivent le [versionnage sémantique](https://semver.org/lang/fr/) (MAJEUR.MINEUR.CORRECTIF). Les versions 1.x et 2.x regroupent plusieurs commits proches en une seule entrée, quand ils forment un même ensemble cohérent.

---

## [3.5.0] - 2026-09-22

### Ajouté
- Liaison d'un compte Google à un compte institutionnel existant, depuis la page Profil, pour éviter la création de comptes en double.
- Réécriture complète du README (architecture, installation, guide administrateur).

## [3.4.0] - 2026-09-22

### Ajouté
- Connexion avec Google, en plus de l'adresse institutionnelle classique.

## [3.3.1] - 2026-09-20

### Corrigé
- Rapprochement plus souple entre les fichiers déclarés dans les pages et les ressources de la base, pour tolérer de petites différences d'écriture dans les chemins.
- Les fichiers Word et PowerPoint sont téléchargés (au lieu d'échouer à s'ouvrir dans le navigateur) quand l'étudiant clique sur « Lire ».

## [3.3.0] - 2026-09-19

### Sécurité
- Les fichiers ne sont plus livrés par un lien signé (copiable et partageable), mais par l'Edge Function `resource-access`, qui vérifie l'accès et renvoie le fichier lui-même.

## [3.2.0] - 2026-09-19

### Modifié
- Les quiz ne concernent plus que les **cours** : les TD, TP et le projet d'examen sont désormais libres pour tout le monde (étudiants et admins).

### Ajouté
- Messages d'erreur détaillés pour les Edge Functions, pour diagnostiquer plus vite un problème de déploiement ou de stockage.

## [3.1.1] - 2026-09-19

### Corrigé
- La barre de recherche est isolée du formulaire de connexion, pour empêcher les navigateurs de la confondre avec le champ e-mail.
- Détection automatique du bucket de stockage, et suppression du délai d'attente entre deux quiz pour un compte administrateur.

## [3.1.0] - 2026-09-19

### Ajouté
- Page **Admin → Quiz** : formulaire d'ajout de question, modification, désactivation, suppression, et import de plusieurs questions à la fois via un fichier JSON.
- Recherche de cours ouverte à tous les visiteurs, sans connexion requise (vue `catalogue_public`, sécurisée en `security_invoker`).

## [3.0.0] - 2026-09-19

### Modifié
- **Changement de modèle** : le paiement à l'unité (500 FCFA par ressource) est remplacé par un déblocage progressif via quiz.
- Le premier cours de chaque matière est libre ; chaque cours suivant se débloque en réussissant un quiz (70 % minimum, questions tirées au hasard) sur le cours précédent.
- Les étudiants ayant déjà payé sous l'ancien système gardent l'accès à leurs ressources.

### Ajouté
- Lecture en ligne et téléchargement de chaque ressource.
- Historique personnel des dernières ressources lues et téléchargées, sur la page Profil.
- Ordre pédagogique des ressources par matière (Chapitre 1 avant Chapitre 2, etc.).

---

## [2.1.0] - 2026-08-23 → 2026-09-03

### Ajouté
- Page profil : changer son nom, son mot de passe, consulter son historique de téléchargements, supprimer son compte.
- Mot de passe oublié, avec flux de réinitialisation complet.
- Barre de recherche de cours.
- Adresses institutionnelles `@gl.com`, générées automatiquement après confirmation d'e-mail.
- Suivi de présence en temps réel et liste des étudiants dans l'espace admin.
- Menu hamburger mobile, identité visuelle unifiée sur tout le site, favicon, référencement (SEO / Open Graph).

### Corrigé
- Plusieurs correctifs de sécurité (règles RLS sur les paiements, échappement des noms affichés) et de robustesse (chemins de fichiers désynchronisés, doublons de compte par e-mail personnel).

## [2.0.0] - 2026-08-22

### Ajouté
- **Premier système de comptes** : authentification Supabase (inscription, connexion).
- **Premier modèle économique** : paiement à l'unité par ressource (500 FCFA), intégration PayDunya (Wave / Orange Money), téléchargement par lien temporaire signé.
- Espace administrateur pour la gestion des paiements.

## [1.2.0] - 2026-07-05

### Ajouté
- Thème clair et sombre, avec variables CSS partagées et bouton de bascule.
- Refonte de la page contact.

## [1.1.0] - 2026-05-08

### Modifié
- Renommage du projet en « GL HUB » et changement du logo.
- Premières versions du README et de la licence MIT.

## [1.0.0] - 2026-03-05

### Ajouté
- **Version initiale** : catalogue statique des 5 matières du premier semestre (Algorithmique, Langage C, Base de Données, Systèmes d'Exploitation, Technologies Web), sans compte utilisateur. Née comme projet d'examen de la matière Technologies Web.

---

[3.5.0]: https://github.com/mhdev-x/GL-HUB
[3.4.0]: https://github.com/mhdev-x/GL-HUB
[3.3.1]: https://github.com/mhdev-x/GL-HUB
[3.3.0]: https://github.com/mhdev-x/GL-HUB
[3.2.0]: https://github.com/mhdev-x/GL-HUB
[3.1.1]: https://github.com/mhdev-x/GL-HUB
[3.1.0]: https://github.com/mhdev-x/GL-HUB
[3.0.0]: https://github.com/mhdev-x/GL-HUB
[2.1.0]: https://github.com/mhdev-x/GL-HUB
[2.0.0]: https://github.com/mhdev-x/GL-HUB
[1.2.0]: https://github.com/mhdev-x/GL-HUB
[1.1.0]: https://github.com/mhdev-x/GL-HUB
[1.0.0]: https://github.com/mhdev-x/GL-HUB