# GL HUB

![GL HUB Logo](MEDIAS/LOGO-GL-HUB.png)

**GL HUB** est une plateforme éducative gratuite, créée par un étudiant en Génie Logiciel pour ses camarades. Elle centralise les ressources pédagogiques du cursus (cours, TD, TP) et fait progresser chaque étudiant à son rythme grâce à des quiz, sans paiement.

[![Website](https://img.shields.io/badge/Website-Live-success)](https://mhdev-x.github.io/GL-HUB/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Table des matières

- [À propos](#à-propos)
- [Fonctionnalités](#fonctionnalités)
- [Comment fonctionne le déblocage par quiz](#comment-fonctionne-le-déblocage-par-quiz)
- [Matières couvertes](#matières-couvertes)
- [Architecture technique](#architecture-technique)
- [Structure du projet](#structure-du-projet)
- [Installer ou reprendre le projet](#installer-ou-reprendre-le-projet)
- [Activer la connexion avec Google](#activer-la-connexion-avec-google)
- [Gérer les quiz (administrateurs)](#gérer-les-quiz-administrateurs)
- [Contribution](#contribution)
- [Auteur](#auteur)
- [Licence](#licence)

---

## À propos

Face à la dispersion des supports de cours et au manque de centralisation des ressources pédagogiques, GL HUB propose un espace unique rassemblant les matières fondamentales du cursus de Génie Logiciel.

**Objectifs**
- Faciliter l'accès aux cours magistraux, TD et projets académiques
- Favoriser l'autonomie et la progression des étudiants
- Devenir une référence durable pour la communauté étudiante
- Encourager le partage, la collaboration et l'excellence

---

## Fonctionnalités

- **5 matières**, 57 ressources pédagogiques (cours, TD, TP, projet d'examen)
- **100 % gratuit** : plus de paiement, on progresse en réussissant des quiz
- **Déblocage progressif des cours** : le premier cours de chaque matière est libre, les suivants se débloquent avec un quiz (70 % minimum). Les **TD sont libres pour tout le monde**
- **Quiz aléatoires** : deux étudiants n'ont pas forcément les mêmes questions
- **Lecture en ligne ou téléchargement** de chaque ressource (utilisateurs connectés)
- **Historique personnel** des dernières ressources lues et téléchargées
- **Connexion avec Google** en un clic, ou avec une adresse institutionnelle classique — avec liaison possible entre les deux comptes
- **Catalogue ouvert à tous** : tout visiteur voit les matières et peut utiliser la recherche ; seules la lecture et le téléchargement demandent un compte
- **Thème clair et sombre**, interface responsive
- **Espace administrateur** pour gérer les étudiants et les questions de quiz

---

## Comment fonctionne le déblocage par quiz

1. **Crée un compte** (gratuit) et connecte-toi.
2. **Les TD, TP et projets sont libres** : tu peux les lire ou les télécharger tout de suite.
3. **Le premier cours** de chaque matière est libre aussi.
4. Pour débloquer le **cours suivant**, passe le **quiz du cours que tu viens de lire** : 10 questions tirées au hasard dans une banque de questions.
5. Il faut **70 % minimum**. En cas d'échec, tu peux réessayer après 2 minutes, avec des questions qui peuvent être différentes.
6. Après une réussite, tu vois la **correction** avec les explications, et le cours suivant est débloqué.
7. Les cours suivent un **ordre pédagogique** (Chapitre 1 avant Chapitre 2...). Chaque carte indique son numéro (« Cours 3 sur 8 ») ou « Accès libre » pour un TD.

Les administrateurs ont accès à toutes les ressources, sans quiz ni délai d'attente. Les étudiants qui avaient déjà payé l'ancien système (500 FCFA par ressource) ont gardé l'accès à leurs ressources.

---

## Matières couvertes

| Matière | Description | Lien |
|---|---|---|
| **Algorithmique** | Notions préliminaires, structures conditionnelles et itératives, types composés, chaînes, tableaux, programmation modulaire | [Accéder →](algo.html) |
| **Langage C** | Généralités, structures conditionnelles et itératives, types composés, chaînes, tableaux, programmation modulaire | [Accéder →](langageC.html) |
| **Base de Données** | Merise et MCD, modèle entité-association, SGBD, introduction au SQL | [Accéder →](basedeDonnees.html) |
| **Systèmes d'Exploitation** | Windows : dossiers et fichiers, utilisateurs locaux, restauration et tâches planifiées, batch, variables d'environnement | [Accéder →](systemedExploitation.html) |
| **Technologies Web** | HTML (listes, médias, liens, formulaires), CSS, JavaScript (DOM, Web Storage) | [Accéder →](technologieWeb.html) |

---

## Architecture technique

- **Front-end** : HTML, CSS et JavaScript (sans framework), hébergé sur **GitHub Pages**. Icônes : Font Awesome.
- **Back-end** : [Supabase](https://supabase.com) (authentification, base PostgreSQL avec RLS, stockage privé, Edge Functions).

**Tables principales**

| Table | Rôle |
|---|---|
| `matieres` | Les 5 matières |
| `ressources` | Les fichiers pédagogiques, avec leur `type` (cours / td / ...) et leur `ordre` dans la matière |
| `questions_quiz` | La banque de questions (lisible uniquement par les administrateurs) |
| `tentatives_quiz` | Chaque passage de quiz : questions tirées, score, réussite |
| `deblocages` | Les cours débloqués par chaque étudiant |
| `evenements_ressources` | L'historique des lectures et téléchargements |
| `profils`, `admins` | Profils des étudiants et comptes administrateurs |
| `paiements`, `liens_temporaires` | Ancien système de paiement, conservé mais plus utilisé |

**Edge Functions**

| Fonction | Rôle |
|---|---|
| `quiz-start` | Vérifie l'accès, tire 10 questions au hasard parmi les questions actives du cours et les envoie **sans les bonnes réponses** |
| `quiz-submit` | Corrige côté serveur, enregistre le score et débloque le cours suivant en cas de réussite (≥ 70 %) |
| `resource-access` | Vérifie l'accès (TD libres, cours débloqués, admin) puis renvoie le **fichier lui-même** : aucun lien partageable n'est donné au navigateur |

**Sécurité**
- Les fichiers sont dans un bucket Storage privé, livrés uniquement par `resource-access`, qui revérifie l'accès à chaque lecture ou téléchargement — le navigateur ne reçoit jamais de lien réutilisable ni partageable.
- Les quiz sont tirés au hasard et corrigés côté serveur ; la table `questions_quiz` est protégée par RLS et invisible pour les étudiants.
- La recherche publique passe par la vue `catalogue_public` (en `security_invoker`), qui n'expose que le titre, le type et la matière : les visiteurs n'ont un droit de lecture que sur ces colonnes, jamais sur le chemin du fichier.
- La connexion Google utilise la liaison manuelle d'identité (`linkIdentity`) pour éviter les comptes en double.

---

## Structure du projet

```text
GL-HUB/
├── index.html, contact.html, profil.html
├── algo.html, langageC.html, basedeDonnees.html
├── systemedExploitation.html, technologieWeb.html
├── admin.html, admin-quiz.html          # espace administrateur
├── supabaseClient.js                    # configuration Supabase (clé publique "anon")
├── auth.js                              # connexion, inscription, Google, recherche
├── acces.js                             # lecture, téléchargement, quiz, déblocage
├── profil.js, admin.js, admin-quiz.js, theme.js
├── STYLES/                              # une feuille par page + theme.css, auth.css, acces.css, admin-quiz.css
├── MEDIAS/
├── supabase/
│   ├── migrations/                      # scripts SQL numérotés, à lancer dans l'ordre
│   └── functions/                       # Edge Functions (fichiers autonomes)
│       ├── quiz-start/index.ts
│       ├── quiz-submit/index.ts
│       └── resource-access/index.ts
├── LICENSE
└── SECURITY.md
```

---

## Installer ou reprendre le projet

1. Crée un projet Supabase et renseigne son URL et sa clé **anon** dans `supabaseClient.js`.
2. Crée les tables `matieres`, `ressources`, `paiements`, `admins` et `profils`, puis ajoute tes matières et tes ressources (avec une colonne `type` : `cours`, `td`, etc.).
3. Dans le **SQL Editor**, lance les scripts de `supabase/migrations/` dans l'ordre :

   | Script | Rôle |
   |---|---|
   | `001_quiz_unlock.sql` | Tables du quiz, règle d'accès, règles RLS |
   | `002_reorganiser_ordre.sql` | Ordre pédagogique des ressources *(spécifique aux titres actuels, à adapter si tu changes les ressources)* |
   | `003_droits_lecture.sql` | Droits de lecture des nouvelles tables |
   | `004_recherche_publique_et_admin_quiz.sql` | Recherche ouverte aux visiteurs, gestion des questions par les admins |
   | `005_vue_catalogue_securisee.sql` | Sécurise la vue de recherche (droits par colonne) |
   | `006_quiz_seulement_pour_les_cours.sql` | Les quiz ne concernent que les cours ; les TD sont libres |
   | `007_corriger_chemins_fichiers.sql` | Corrige des chemins de fichiers *(spécifique aux données de ce projet ; contient deux requêtes de contrôle à lancer même si tu n'as pas ce problème)* |

4. Crée un **bucket privé** dans Storage et envoie-y tes fichiers. Le chemin de chaque fichier doit correspondre à la colonne `chemin_fichier` de `ressources`. Le nom attendu est `ressources-privees` (constante en haut de `supabase/functions/resource-access/index.ts`) ; s'il est différent, la fonction cherche automatiquement le fichier dans les autres buckets.
5. Déploie les trois fonctions de `supabase/functions/` (`supabase functions deploy quiz-start`, etc., ou en collant le code dans le tableau de bord Supabase — chaque fichier est autonome). Désactive **Verify JWT** sur les trois : chaque fonction vérifie elle-même l'identité de l'utilisateur.
6. Ajoute ton compte dans la table `admins` (`user_id` de ton compte) pour accéder à l'espace administrateur.
7. Facultatif : [active la connexion avec Google](#activer-la-connexion-avec-google).

---

## Activer la connexion avec Google

Le bouton « Continuer avec Google » est déjà dans le site. Pour qu'il fonctionne, il faut le configurer une fois :

1. **Google Cloud Console** → *APIs & Services* → *Credentials* → *Create credentials* → *OAuth client ID* (type **Web application**).
   - *Authorized JavaScript origins* : `https://mhdev-x.github.io` (et `http://127.0.0.1:5500` pour tester en local).
   - *Authorized redirect URIs* : `https://<ton-projet>.supabase.co/auth/v1/callback`.
   - Dans *OAuth consent screen*, renseigne le nom « GL HUB » et passe l'application en **production** (sinon seuls les comptes de test peuvent se connecter).
2. **Supabase** → *Authentication* → *Sign In / Providers* → **Google** : active-le et colle le *Client ID* et le *Client Secret*.
3. **Supabase** → *Authentication* → *Sign In / Providers* → active **Allow manual linking of accounts** (nécessaire pour l'étape de liaison ci-dessous).
4. **Supabase** → *Authentication* → *URL Configuration* :
   - *Site URL* : `https://mhdev-x.github.io/GL-HUB/`
   - *Redirect URLs* : `https://mhdev-x.github.io/GL-HUB/**` et `http://127.0.0.1:5500/**`

**Un nouvel étudiant** qui clique sur « Continuer avec Google » obtient un compte créé automatiquement, sans adresse `@gl.com` ni mot de passe GL HUB.

**Un étudiant qui a déjà un compte `@gl.com`** doit d'abord **lier** son compte Google au sien (sinon un second compte, vide, serait créé par erreur) :
1. se connecter normalement avec son adresse `@gl.com` et son mot de passe ;
2. sur sa page **Profil**, cliquer sur **Lier mon compte Google** ;
3. ensuite, le bouton Google du site le connecte directement à ce même compte, avec sa progression.

Un compte Google déjà lié à quelqu'un d'autre ne peut pas être relié une seconde fois : le site l'indique clairement plutôt que de planter.

---

## Gérer les quiz (administrateurs)

Depuis l'espace **Admin → Quiz** (`admin-quiz.html`) :

- choisis une matière, puis un cours : un badge indique combien de questions il possède (**20 questions ou plus** sont conseillées pour varier les quiz, 10 au minimum) ;
- ajoute une question avec le formulaire (2 à 6 propositions, une bonne réponse, une explication facultative), modifie-la, désactive-la ou supprime-la ;
- ou **importe plusieurs questions d'un coup** en collant du JSON :

```json
[
  {
    "question": "Quelle boucle s'exécute au moins une fois ?",
    "options": ["Pour", "Tant que", "Répéter ... jusqu'à", "Aucune"],
    "bonne_reponse": "Répéter ... jusqu'à",
    "explication": "Le test est fait après le premier passage."
  }
]
```

Seuls les **cours** ont un quiz : les TD n'apparaissent qu'avec la mention « Accès libre ». Le dernier cours de chaque matière n'a pas besoin de quiz, puisqu'il ne débloque rien. Un cours sans question bloque le cours suivant : remplis la banque avant d'ouvrir une nouvelle matière au public.

---

## Contribution

Les contributions sont les bienvenues, notamment pour :

- ajouter ou améliorer des ressources pédagogiques
- corriger un bug ou améliorer l'interface
- proposer une nouvelle fonctionnalité

Étapes :

1. **Forker** le projet
2. **Créer une branche** (`git checkout -b feature/amelioration`)
3. **Commit** tes changements (`git commit -m "feat: ..."`)
4. **Pousser** la branche (`git push origin feature/amelioration`)
5. **Ouvrir une Pull Request**

---

## Auteur

**Mohamed BATHILY** – Étudiant en Génie Logiciel

- GitHub : [@mhdev-x](https://github.com/mhdev-x)
- Projet : [GL HUB](https://github.com/mhdev-x/GL-HUB)

---

## Licence

Ce projet est sous licence **MIT** — voir le fichier [LICENSE](LICENSE) pour plus de détails.