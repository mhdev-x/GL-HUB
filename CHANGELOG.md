# Journal des versions

Toutes les évolutions notables de GL HUB sont listées ici, dans l'ordre chronologique réel du dépôt Git.

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) ; les numéros suivent le [versionnage sémantique](https://semver.org/lang/fr/) (MAJEUR.MINEUR.CORRECTIF). Les versions 1.x et 2.x regroupent plusieurs commits proches en une seule entrée, quand ils forment un même ensemble cohérent.

---

## [3.9.0] - 2026-10-18

### Modifié
- **Page d'accueil** : le texte « Bienvenue sur GL HUB » présente désormais les deux classes (L1 et L2) et les fonctionnalités de la plateforme (cours, TD, examens, emploi du temps, discussion). Les statistiques passent de trois à quatre (2 classes, 5 matières en L1, 57 fichiers en L1, 70 % au quiz), rangées en 2 x 2 sur téléphone.
- Le choix de la classe est placé juste après le texte de bienvenue. La carte L1 liste les cinq matières ; la carte L2 présente ses trois fonctions (ressources, emploi du temps, discussion).

### Ajouté
- `DOCUMENTATION.md` : l'histoire du projet, ses étapes, les difficultés rencontrées et un guide pour créer un projet du même genre, avec les remerciements.
- Mise à jour complète du `README.md` (classes, espace L2, installation, guide administrateur et responsable).
- `SECURITY.md` rédigé pour ce projet (le modèle par défaut de GitHub n'avait jamais été rempli).

## [3.8.1] - 2026-10-18

### Corrigé
- **Vocaux illisibles sur les iPad et iPhone anciens.** Deux causes : Safari ancien ne lit pas le WebM, et il refuse de lancer un son après une attente réseau. L'enregistrement se fait désormais en MP4 (AAC) quand le navigateur le permet, les adresses d'écoute sont préparées avant le clic (`play()` est appelé directement dans le clic), et un vocal dans un format illisible est signalé clairement au lieu d'échouer.
- **Un vocal supprimé continuait de jouer.** Le son est maintenant coupé dès la suppression (par l'auteur, par un modérateur ou à la réception de l'événement temps réel), et le fichier est libéré. La liste n'est plus redessinée de façon à orpheliner un vocal en cours de lecture. Les suppressions faites ailleurs sont aussi synchronisées si la connexion temps réel est coupée.

## [3.8.0] - 2026-10-17

### Ajouté
- **Menu « Classes »** dans la barre de navigation, à la place de « Espace L2 » et « Matières » : L1 ouvre le panneau des matières, L2 mène à la connexion, à l'espace de la classe ou à la demande d'accès selon la situation de l'utilisateur. Après une connexion depuis ce menu, l'utilisateur est dirigé tout seul vers la L2.
- **Emploi du temps de la L2** : vue par semaine, prochain cours, résumé des changements. Seuls l'administrateur et le responsable peuvent le modifier (ajout avec répétition hebdomadaire, modification, annulation et rétablissement, suppression, copie de la semaine précédente). Un changement d'horaire, de salle ou d'enseignant marque automatiquement la séance « Modifié », une annulation la marque « Annulé », et les étudiants voient le changement en direct.
- Onglets **Ressources / Emploi du temps / Discussion** en haut de l'espace L2.
- **Modération de la discussion** : l'administrateur et le responsable suppriment n'importe quel message, écrit ou vocal ; chaque étudiant supprime les siens.
- L'administrateur entre dans l'espace L2 directement, sans formulaire ni numéro de téléphone.
- `verifier-nav.py` : vérifie que toutes les barres de navigation sont identiques avant un commit.

### Modifié
- La barre de navigation est identique sur toutes les pages publiques ; les trois pages d'administration partagent le même menu, avec la page courante mise en évidence.
- Qualité des vocaux : voix en mono avec suppression d'écho et de bruit, 48 kbit/s en Opus et 64 kbit/s en AAC (au lieu de 24 kbit/s).

### Corrigé
- Plantage de `acces-l2.js` quand la page HTML correspondante était plus ancienne que le script (élément introuvable).
- Les onglets de l'espace L2 restaient collés en haut de la page à cause de la règle CSS globale appliquée à `nav`.

## [3.7.0] - 2026-10-16

### Ajouté
- **Discussion de la classe L2** : messages écrits (1000 caractères maximum) et vocaux (2 minutes maximum), en temps réel, avec un rafraîchissement de secours toutes les 30 secondes.
- **Fenêtre glissante de 7 jours** : un message de plus de 7 jours n'est plus visible (règle RLS), et une fonction de nettoyage nocturne (`l2-chat-purge`, planifiée avec `pg_cron`) supprime réellement les messages et leurs fichiers audio.
- Anti-spam (20 messages par minute), bucket privé `chat-l2`, et migration `20261014_chat_l2.sql`.

### Corrigé
- Migration de l'espace L2 : elle contient maintenant un bloc de mise à niveau, car `create table if not exists` ne modifie pas une table existante. Cela corrige l'échec de l'envoi d'une demande d'accès et l'erreur « colonne nom_affiche inexistante » sur les bases créées avec une version précédente.
- Le responsable peut supprimer ses propres fichiers (règle de lecture manquante côté Storage), et la structure des tables est rechargée par l'API après la migration.

## [3.6.0] - 2026-10-14

### Ajouté
- **Deux classes** : L1 Génie Logiciel et L2 Génie Logiciel, avec un choix de la classe sur la page d'accueil.
- **Espace L2 réservé à la classe** : demande d'accès avec le numéro WhatsApp (normalisé, unique par classe), validée par l'administrateur qui le compare avec le groupe de la classe. Trois rôles : étudiant, responsable, administrateur.
- **Page responsable** : dépôt de cours, TD, examens, liens et autres fichiers (50 Mo maximum), avec suivi de l'état de chaque dépôt.
- **Page administrateur de la L2** : demandes d'accès, dépôts à valider, matières de la classe, membres, ressources publiées.
- **Page de consultation** : recherche, filtres par matière et par catégorie, badge « Nouveau », lecture ou téléchargement des fichiers. Les liens YouTube affichent leur miniature et se lisent directement sur le site.
- Sécurité : règles RLS et triggers sur toutes les tables, bucket privé `ressources-l2`, Edge Function `l2-resource-access` (aucun lien partageable), migration `20261013_espace_l2.sql`.

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

[3.9.0]: https://github.com/mhdev-x/GL-HUB
[3.8.1]: https://github.com/mhdev-x/GL-HUB
[3.8.0]: https://github.com/mhdev-x/GL-HUB
[3.7.0]: https://github.com/mhdev-x/GL-HUB
[3.6.0]: https://github.com/mhdev-x/GL-HUB
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