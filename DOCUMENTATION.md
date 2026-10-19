# Documentation du projet GL HUB

**Version du document : 3.9.0 (18 octobre 2026)**

Ce document raconte comment GL HUB est né, les étapes que j'ai suivies, les difficultés que j'ai rencontrées et ce que j'en ai appris. Il s'adresse :

- à mes **camarades**, pour comprendre ce qu'il y a derrière le site qu'ils utilisent ;
- à toute personne **curieuse** de savoir comment une plateforme de ce type se construit ;
- à celles et ceux qui veulent **créer un projet du même genre** pour leur propre classe : la section [Guide : créer un projet du même genre](#guide--créer-un-projet-du-même-genre) est faite pour vous.

Les autres documents du projet se complètent :

| Document | À quoi il sert |
|---|---|
| [README.md](README.md) | Présenter le projet, l'installer, l'administrer |
| [CHANGELOG.md](CHANGELOG.md) | Lister toutes les évolutions, version par version |
| [SECURITY.md](SECURITY.md) | Savoir quelles versions sont maintenues et comment signaler une faille |
| **DOCUMENTATION.md** (ce fichier) | Comprendre l'histoire, les choix et les difficultés |

---

## Sommaire

1. [Pourquoi GL HUB existe](#pourquoi-gl-hub-existe)
2. [Comment le projet est né](#comment-le-projet-est-né)
3. [Les grandes étapes](#les-grandes-étapes)
4. [Comment GL HUB est construit](#comment-gl-hub-est-construit)
5. [Octobre 2026 : les classes L1 et L2](#octobre-2026--les-classes-l1-et-l2)
6. [Les difficultés rencontrées](#les-difficultés-rencontrées)
7. [Guide : créer un projet du même genre](#guide--créer-un-projet-du-même-genre)
8. [Pistes pour la suite](#pistes-pour-la-suite)
9. [Remerciements](#remerciements)
10. [Outils et services utilisés](#outils-et-services-utilisés)

---

## Pourquoi GL HUB existe

Dans une classe, les cours, les TD et les examens arrivent de plusieurs côtés : les professeurs les envoient au responsable de classe, qui les transmet ensuite aux étudiants dans un groupe de discussion. Dans ce système, tout se mélange avec le reste des messages : retrouver le TD 3 d'algorithmique deux semaines plus tard, c'est remonter des centaines de messages, et un fichier envoyé il y a longtemps peut même ne plus être disponible.

J'ai voulu un endroit unique où :

- chaque ressource est **rangée par matière** et facile à retrouver ;
- l'accès est **simple** (un navigateur suffit, sur téléphone comme sur ordinateur) ;
- la plateforme reste **gratuite** ;
- les étudiants peuvent **progresser à leur rythme** ;
- et, pour notre classe, l'**emploi du temps** et les **échanges** sont au même endroit que les cours.

---

## Comment le projet est né

### Un projet d'examen

GL HUB est né le **5 mars 2026** comme **projet d'examen de la matière Technologies Web**. La première version était un **catalogue statique** des cinq matières du premier semestre (Algorithmique, Langage C, Base de Données, Systèmes d'Exploitation, Technologies Web), écrit en HTML, CSS et JavaScript, sans compte utilisateur.

Je l'ai présenté à mes camarades lors de l'**examen pratique du premier semestre**. C'est à ce moment-là que l'idée de le faire grandir est devenue naturelle : le catalogue existait, il fallait maintenant qu'il serve vraiment à la classe.

### De catalogue à plateforme

Entre mars et octobre 2026, le projet a changé de nature plusieurs fois :

1. **Un nom et une identité** : le projet est devenu « GL HUB » en mai, avec un logo, un README et une licence MIT.
2. **Des comptes** : en août, avec Supabase, les étudiants ont pu s'inscrire et se connecter.
3. **Un modèle à repenser** : un premier système de paiement par ressource a existé, puis il a été remplacé en septembre par un déblocage progressif grâce à des quiz. La plateforme est devenue 100 % gratuite.
4. **De la sécurité** : les fichiers ne sont plus livrés par des liens copiables, mais par une fonction serveur qui vérifie l'accès à chaque fois.
5. **Plusieurs classes** : en octobre, GL HUB accueille la **L1** et la **L2**, avec pour la L2 un espace privé (ressources, emploi du temps, discussion).

---

## Les grandes étapes

Le détail complet est dans le [journal des versions](CHANGELOG.md). Voici le fil conducteur.

| Version | Date | Ce qui change | Pourquoi c'est important |
|---|---|---|---|
| **1.0.0** | 5 mars 2026 | Catalogue statique des 5 matières | Le point de départ : un projet d'examen |
| **1.1.0** | 8 mai 2026 | Le projet devient « GL HUB », logo, README, licence MIT | Une identité et une base de projet ouvert |
| **1.2.0** | 5 juillet 2026 | Thème clair et sombre | Une interface plus agréable à utiliser |
| **2.0.0** | 22 août 2026 | Premiers comptes (Supabase), paiement par ressource, espace admin | Le passage de site vitrine à vraie plateforme |
| **2.1.0** | 23 août au 3 sept. 2026 | Profil, mot de passe oublié, recherche, menu mobile, présence en temps réel | La plateforme devient complète à l'usage |
| **3.0.0** | 19 sept. 2026 | Le paiement est remplacé par un déblocage par quiz (70 % minimum) | Un modèle gratuit et progressif |
| **3.1 à 3.3** | 19 au 20 sept. 2026 | Gestion des quiz par les admins, recherche publique, fichiers livrés par une fonction serveur | Plus d'outils pour l'admin et une vraie sécurité des fichiers |
| **3.4 et 3.5** | 22 sept. 2026 | Connexion Google, liaison avec un compte existant | Éviter les comptes en double |
| **3.6.0** | 14 oct. 2026 | **Les classes L1 et L2**, espace L2 réservé, dépôt et validation des ressources, vidéos YouTube | GL HUB devient multi-classes |
| **3.7.0** | 16 oct. 2026 | **Discussion** écrite et vocale, supprimée après 7 jours | Un espace d'échange sans alourdir la base |
| **3.8.0** | 17 oct. 2026 | Menu Classes, **emploi du temps**, modération | Tout ce dont la classe a besoin au même endroit |
| **3.8.1** | 18 oct. 2026 | Vocaux lisibles sur les anciens iPad, vocal supprimé coupé | Corriger ce que les vrais appareils ont révélé |
| **3.9.0** | 18 oct. 2026 | Nouvelle page d'accueil, documentation, README | Raconter le projet et le rendre reproductible |

---

## Comment GL HUB est construit

### La pile technique

| Rôle | Choix | Pourquoi |
|---|---|---|
| Interface | HTML, CSS, JavaScript (sans framework) | Je maîtrisais déjà ces trois langages, et le résultat est léger et facile à comprendre pour d'autres étudiants |
| Base de données | PostgreSQL via **Supabase** | Une vraie base relationnelle, avec des règles de sécurité intégrées (RLS) |
| Comptes | Authentification **Supabase** (e-mail et Google) | Éviter de réinventer la gestion des mots de passe |
| Fichiers | **Supabase Storage** (buckets privés) | Des fichiers qui ne sont jamais publics |
| Code serveur | **Edge Functions** Supabase | Vérifier les accès et corriger les quiz côté serveur, là où on ne peut pas tricher |
| Temps réel | **Supabase Realtime** | Messages et emploi du temps qui se mettent à jour sans recharger |
| Tâches planifiées | **pg_cron** | Nettoyer automatiquement la discussion chaque nuit |
| Hébergement | **Vercel** | Un déploiement automatique à chaque envoi sur GitHub |

### Les principes que j'ai suivis

1. **La sécurité est dans la base de données, pas dans l'interface.** Cacher un bouton ne protège rien : quelqu'un peut appeler la base directement. Les règles qui décident qui peut lire ou écrire sont donc écrites en SQL (RLS et triggers), et l'interface ne fait que les refléter.
2. **Le navigateur n'est jamais cru sur parole.** L'auteur d'un message, l'état d'un dépôt ou le nom affiché sont imposés par le serveur.
3. **Un fichier privé reste privé.** Il n'est jamais donné au navigateur sous la forme d'un lien réutilisable : une fonction serveur vérifie l'accès, puis renvoie le fichier lui-même.
4. **Tout ce qui est affiché est traité comme du texte.** Aucun contenu saisi par un utilisateur n'est interprété comme du code (`textContent` plutôt que `innerHTML`).
5. **Des scripts relançables.** Chaque script SQL peut être exécuté plusieurs fois sans casser la base.
6. **Chaque évolution est documentée** dans le journal des versions.

---

## Octobre 2026 : les classes L1 et L2

Passage en deuxième année : la classe a changé, et le projet aussi. L'idée de départ était simple : **remplacer le groupe de discussion** par un espace où le responsable de classe dépose les fichiers, que l'administrateur vérifie puis publie pour toute la classe.

Voici comment cette idée est devenue l'espace L2.

| Besoin | Solution |
|---|---|
| N'accepter que les camarades de la classe | Demande d'accès avec le numéro WhatsApp du groupe, comparé par l'administrateur, qui valide |
| Que le responsable dépose les cours et TD | Page responsable avec catégories (cours, TD, examen, lien, autre) |
| Éviter qu'un fichier erroné soit vu par tous | Chaque dépôt est « en attente » jusqu'à sa publication par l'administrateur |
| Partager des vidéos | Liens YouTube avec miniature et lecteur intégré au site |
| Un emploi du temps qui change en cours de semaine | Une séance par ligne, marquée « Modifié » ou « Annulé » automatiquement, visible en direct |
| Échanger en écrit et en vocal sans alourdir la base | Fenêtre glissante de 7 jours : masquage par la base, puis suppression réelle chaque nuit |
| Que chacun trouve la bonne page | Menu « Classes » : L1, L2, connexion ou demande d'accès selon la situation |

---

## Les difficultés rencontrées

Cette section est la plus utile si vous voulez créer un projet semblable : voici ce qui m'a ralenti, pourquoi, et comment je l'ai résolu. Chaque difficulté suit le même schéma : **le problème, la cause, la solution, la leçon**.

### Avant la version 3.5.0

#### 1. Un modèle économique qui ne convenait plus

- **Problème** : la première plateforme faisait payer chaque ressource (500 FCFA) avec Wave et Orange Money, et livrait les fichiers par des liens temporaires.
- **Solution** : en version 3.0.0, le paiement est remplacé par un déblocage progressif : le premier cours est libre, les suivants se débloquent en réussissant un quiz (70 % minimum). Les étudiants qui avaient déjà payé ont gardé leur accès.
- **Leçon** : un modèle économique n'est pas gravé dans le marbre. Prévoir dès le départ une façon de **migrer les utilisateurs existants** (ici, conserver les accès payés) évite de les pénaliser.

#### 2. Des fichiers « privés » qui pouvaient être partagés

- **Problème** : un lien signé donne accès à un fichier à n'importe qui qui le possède, pendant sa durée de validité. Un étudiant pouvait donc copier et partager le lien.
- **Solution** : en version 3.3.0, une Edge Function vérifie l'accès à chaque lecture, puis renvoie le **fichier lui-même**, jamais un lien.
- **Leçon** : « privé » ne veut pas dire « avec un lien secret ». Si l'accès doit être vérifié à chaque fois, c'est le serveur qui doit servir le fichier.

#### 3. Des chemins de fichiers qui ne correspondaient plus

- **Problème** : des fichiers déclarés dans les pages ne correspondaient pas exactement à ceux de la base, à cause de petites différences d'écriture.
- **Solution** : un rapprochement plus souple des chemins, et un script de correction (`007_corriger_chemins_fichiers.sql`).
- **Leçon** : avoir **une seule source de vérité** pour un nom de fichier (la base), et jamais le recopier à la main à plusieurs endroits.

#### 4. Des fichiers Word et PowerPoint qui « ne s'ouvraient pas »

- **Problème** : le navigateur sait afficher un PDF, mais pas un document Word ou PowerPoint.
- **Solution** : pour ces formats, le bouton « Lire » télécharge le fichier au lieu d'échouer.
- **Leçon** : connaître les limites du navigateur et prévoir une solution de repli plutôt qu'une erreur.

#### 5. Des comptes en double avec Google

- **Problème** : un étudiant qui avait déjà un compte avec son adresse institutionnelle et qui cliquait sur « Continuer avec Google » obtenait un second compte, vide, sans sa progression.
- **Solution** : en version 3.5.0, liaison manuelle d'un compte Google à un compte existant depuis la page Profil.
- **Leçon** : dès qu'on ajoute une deuxième façon de se connecter, on se demande ce qui arrive à ceux qui ont déjà un compte.

#### 6. Un champ de recherche pris pour un champ e-mail

- **Problème** : certains navigateurs remplissaient la barre de recherche avec l'adresse e-mail du formulaire de connexion.
- **Solution** : isoler la recherche du formulaire de connexion (version 3.1.1).
- **Leçon** : les navigateurs « devinent » ce que contiennent les champs. Il faut les structurer pour qu'ils ne se trompent pas.

#### 7. Des règles de sécurité à resserrer

- **Problème** : au fil des versions 2.x, plusieurs règles de sécurité (RLS sur les paiements, échappement des noms affichés) ont dû être corrigées.
- **Leçon** : relire ses règles de sécurité comme le ferait un attaquant, et le faire **régulièrement**, pas une seule fois.

### Pendant la construction de l'espace L2 (octobre 2026)

#### 8. Contrôler qui entre dans la classe

- **Problème** : comment accepter uniquement mes camarades, sans liste d'étudiants officielle ?
- **Solution** : une demande d'accès avec le numéro WhatsApp du groupe de classe. Le numéro est normalisé (sans espaces ni indicatif), il est unique par classe, et c'est l'administrateur qui le compare avec le groupe puis accepte ou refuse.
- **Limite connue** : cette vérification est pratique mais pas infaillible (quelqu'un qui connaît le numéro d'un camarade pourrait le recopier). On la renforce en vérifiant aussi le nom.
- **Leçon** : une bonne sécurité combine **une règle technique** (numéro unique, validation obligatoire) et **un contrôle humain**.

#### 9. Ne jamais faire confiance au navigateur

- **Problème** : un étudiant pourrait appeler la base directement pour s'accepter lui-même, publier un dépôt ou écrire sous le nom d'un autre.
- **Solution** : les règles sont dans la base. Des triggers imposent l'auteur et l'état des données (un dépôt envoyé par le responsable est toujours « en attente », même s'il demande « publié »), et les règles RLS limitent chaque rôle.
- **Comment je m'en suis assuré** : ces règles ont été testées sur un **vrai PostgreSQL**, avec de vrais rôles (étudiant, responsable, administrateur, visiteur), en essayant d'enfreindre chacune. Ces essais ont fait apparaître des défauts : une adresse `javascript:` acceptée dans un dépôt, ou un responsable incapable de supprimer ses propres fichiers.
- **Leçon** : une règle de sécurité qu'on n'a pas essayé de contourner n'est pas vérifiée.

#### 10. `create table if not exists` ne met pas à jour une table

- **Problème** : une première version du script SQL avait créé la table des demandes avec les colonnes `nom` et `prenom`. J'ai ensuite changé de conception (le nom vient du profil, dans `nom_affiche`). Résultat : l'envoi d'une demande échouait, et la page d'administration affichait « la colonne `nom_affiche` n'existe pas ».
- **Cause** : `create table if not exists` ne fait **rien** si la table existe déjà. Elle ne la corrige jamais.
- **Solution** : un bloc de **mise à niveau** (`alter table ... add column if not exists`, `drop column if exists`) dans le même script, qui reste relançable sans risque.
- **Leçon** : quand on change la structure d'une table, il faut écrire **comment passer de l'ancienne à la nouvelle version**, pas seulement la nouvelle version.

```sql
-- Mauvais réflexe : la table existe déjà, rien ne change
create table if not exists demandes (id uuid primary key, nom_affiche text);

-- Bon réflexe : on ajoute ce qui manque, de façon relançable
alter table demandes add column if not exists nom_affiche text;
alter table demandes drop column if exists nom;
```

#### 11. Supprimer une ligne ne supprime pas le fichier

- **Problème** : pour alléger la base, la discussion doit être effacée après 7 jours. Mais supprimer une ligne de la table des fichiers dans la base **ne supprime pas** le vrai fichier stocké.
- **Solution** : une Edge Function de nettoyage, qui passe par l'API de Storage pour retirer d'abord les fichiers, puis les messages. En plus, une règle RLS masque dès maintenant tout message de plus de 7 jours : même si le nettoyage est en panne, personne ne voit un ancien message.
- **Leçon** : quand une donnée existe à deux endroits (la base et le stockage), il faut la supprimer aux **deux** endroits.

#### 12. Supprimer un fichier demande aussi le droit de le lire

- **Problème** : le responsable ne parvenait pas à supprimer ses propres fichiers, sans aucune erreur.
- **Cause** : en SQL, une suppression qui filtre sur les colonnes d'une ligne exige aussi le droit de **lire** cette ligne. Sans règle de lecture, la suppression ne trouvait rien à supprimer.
- **Solution** : une règle de lecture limitée à ses propres fichiers.
- **Leçon** : un échec silencieux est plus difficile à trouver qu'une erreur. D'où l'intérêt de **tester chaque droit** (lire, écrire, modifier, supprimer) pour chaque rôle.

#### 13. Planifier un nettoyage : activer d'abord l'extension

- **Problème** : l'exécution du guide de planification échouait avec « le schéma `cron` n'existe pas ».
- **Cause** : l'extension `pg_cron` doit d'abord être **activée** dans le tableau de bord.
- **Solution** : l'activation est maintenant une étape explicite du guide, avec une requête de vérification, et la création du secret ne crée plus de doublon si on la relance.
- **Leçon** : dans un guide d'installation, **vérifier les prérequis** avant chaque étape.

#### 14. Les vocaux : un navigateur n'est pas un autre

- **Problème** : un vocal enregistré sur un MacBook ne se lisait pas sur un iPad Air 2 (« Impossible de lire ce message vocal »).
- **Causes** : deux, cumulées. Premièrement, Chrome enregistre en **WebM**, un format que Safari sur un iPad ancien ne sait pas lire. Deuxièmement, Safari sur iPhone et iPad n'autorise la lecture d'un son que **juste après un appui** de l'utilisateur, pas après une attente réseau : mon code demandait d'abord l'adresse du fichier au serveur, puis lançait la lecture, et Safari la bloquait.
- **Solution** : enregistrer en **MP4 (AAC)** quand le navigateur le permet (lisible partout), préparer les adresses d'écoute **avant** l'appui pour que `play()` soit appelé directement dans le clic, et afficher un message clair si un vocal est dans un format que l'appareil ne lit pas.
- **Qualité** : les premiers vocaux étaient jugés de mauvaise qualité. Le débit (24 kbit/s) était trop bas : il est passé à 48 kbit/s (64 kbit/s en AAC), avec une prise de son en mono, suppression d'écho et de bruit. Deux minutes de vocal restent sous 1 Mo.
- **Leçon** : **tester sur de vrais appareils**, surtout les plus anciens. Ce qui marche sur son ordinateur peut échouer sur une tablette d'il y a dix ans.

```js
// Safari exige que la lecture démarre directement dans le clic :
bouton.addEventListener("click", () => {
    let lecteur = obtenirAudio();   // adresse déjà préparée, pas d'attente réseau
    lecteur.play();                 // appelé dans le clic : accepté par Safari
});
```

#### 15. Un vocal supprimé continuait de jouer

- **Problème** : en supprimant un vocal pendant qu'on l'écoute, le son continuait.
- **Cause** : le lecteur audio vit en mémoire, indépendamment de ce qui est affiché. Retirer le message de l'écran ne l'arrêtait pas. De même, redessiner la liste pouvait « orpheliner » un vocal en cours de lecture.
- **Solution** : chaque message garde son propre lecteur, qui est coupé et libéré dès que le message est supprimé (par son auteur, par un modérateur, ou à la réception d'un événement temps réel). La liste réutilise les éléments existants au lieu de les recréer, et les suppressions faites ailleurs sont synchronisées si le temps réel est coupé.
- **Leçon** : quand une interface gère un état « vivant » (un son qui joue, une connexion), il faut **gérer sa fin** en même temps que l'élément qui l'affiche.

#### 16. Une barre de navigation recopiée dans seize pages

- **Problème** : la barre de navigation est écrite dans chaque page. Au fil des modifications, certaines pages avaient l'ancienne version, d'autres la nouvelle, et les pages d'administration avaient chacune un menu légèrement différent.
- **Solution** : une barre de référence (celle de `acces-l2.html`) appliquée à toutes les pages, et un script, `verifier-nav.py`, qui compare les barres et signale les pages différentes avant chaque commit.
- **Leçon** : ce qui est **copié** plusieurs fois finit par diverger. Soit on le factorise (un composant partagé), soit on **vérifie automatiquement** que les copies restent identiques.

#### 17. Une règle CSS qui visait trop large

- **Problème** : les onglets de l'espace L2 (Ressources, Emploi du temps, Discussion) restaient collés en haut de la page, par-dessus la barre de navigation.
- **Cause** : ils étaient écrits avec la balise `<nav>`, et la feuille de style contenait une règle globale `nav { position: sticky; top: 0; }` destinée à la barre du site.
- **Solution** : une règle plus précise qui neutralise celle-là pour les onglets.
- **Leçon** : une règle CSS écrite pour une balise s'applique à **toutes** les balises du même nom. Préférer des classes.

#### 18. Un script et une page qui ne vont pas ensemble

- **Problème** : une page plantait avec « Cannot set properties of null » : le nouveau script cherchait un élément qui n'existait pas encore dans l'ancienne page HTML.
- **Solution** : copier les trois fichiers d'une page ensemble (`.html`, `.js`, `.css`), et rendre le script tolérant quand un élément manque.
- **Leçon** : un déploiement partiel produit des erreurs que rien n'annonce. Déployer **par ensembles complets**.

#### 19. Tester sans framework de test

- **Problème** : comment vérifier que tout fonctionne, sur des dizaines de pages et de règles de sécurité, sans outil de test installé dans le projet ?
- **Solution** : les règles de sécurité ont été testées sur un vrai PostgreSQL, rôle par rôle ; les pages ont été testées dans un navigateur automatisé, avec un faux serveur pour simuler Supabase, en versions bureau, mobile et thème sombre, avec un faux micro pour les vocaux.
- **Leçon** : on peut très bien tester un projet sans framework : l'essentiel est de **tester les cas de refus** (ce qui ne doit pas marcher) autant que les cas qui doivent marcher.

---

## Guide : créer un projet du même genre

Vous voulez créer, pour votre classe ou votre école, une plateforme semblable ? Voici la démarche que je suivrais en repartant de zéro, dans l'ordre.

### Étape 1 : partir d'un vrai problème, avec un petit périmètre

Commencez par **un problème précis** (« nos cours sont perdus dans un groupe de discussion ») et par **la plus petite version utile** : un catalogue statique, comme la version 1.0.0 de GL HUB. Elle peut être faite avec du HTML et du CSS, sans comptes, sans base de données. Montrez-la tôt, à ceux qui s'en serviront.

### Étape 2 : choisir une pile simple

Un site en **HTML, CSS et JavaScript**, un service comme **Supabase** (base de données, comptes, stockage, fonctions serveur) et un hébergement comme **Vercel** ou **GitHub Pages** suffisent largement. Pas besoin de framework au début : ce que vous écrirez sera plus facile à comprendre et à maintenir.

### Étape 3 : dessiner les données avant le code

Sur une feuille, listez **ce que le site doit mémoriser** et comment les éléments se relient. Pour GL HUB, par exemple :

- une **classe** a des **membres** et des **matières** ;
- une **matière** a des **ressources** ;
- un **membre** a un **rôle** (étudiant, responsable, administrateur) ;
- un **message** appartient à une classe et à un auteur.

Chaque liste devient une **table**. Prendre ce temps évite de tout refaire plus tard.

### Étape 4 : écrire les règles de sécurité tout de suite

C'est l'étape que l'on repousse le plus souvent, et la plus importante.

1. **Activez RLS sur chaque table** (sans règle, personne ne peut rien lire : c'est le bon point de départ).
2. **Écrivez ce que chaque rôle peut faire**, en SQL.
3. **Imposez les valeurs sensibles côté serveur** avec des triggers (l'auteur, l'état, la date).

```sql
alter table public.depots enable row level security;

-- Qui peut LIRE un dépôt ?
create policy depots_select on public.depots
  for select to authenticated
  using (
    public.est_admin()                                        -- l'administrateur voit tout
    or depose_par = auth.uid()                                -- on voit ses propres dépôts
    or (statut = 'publie' and public.est_membre(classe_id))   -- les membres voient ce qui est publié
  );
```

```sql
-- Imposer l'auteur côté serveur : le navigateur ne peut pas mentir
create function preparer_message() returns trigger language plpgsql as $$
begin
  new.auteur_id := auth.uid();   -- toujours l'utilisateur connecté
  new.cree_le := now();          -- jamais une date envoyée par le navigateur
  return new;
end $$;
```

### Étape 5 : les comptes

Utilisez l'authentification du service choisi plutôt que de la recréer. Pensez dès le départ à **ce qui arrive à ceux qui ont déjà un compte** si vous ajoutez plus tard une autre façon de se connecter (voir la difficulté 5).

### Étape 6 : les fichiers privés

Placez les fichiers dans un **bucket privé**, et ne donnez jamais de lien direct. Une **fonction serveur** vérifie l'accès, puis renvoie le fichier. Côté interface, décidez du type d'un fichier **d'après son extension** et n'ouvrez dans le navigateur que les formats sûrs (PDF, images, texte) : un fichier `.html` déposé par erreur ne doit pas pouvoir s'exécuter sur votre site.

### Étape 7 : une interface simple, cohérente et accessible

- Des **pages courtes**, qui ont chacune une seule responsabilité.
- Un **style partagé** (variables CSS pour les couleurs, thème clair et sombre).
- Une **barre de navigation identique partout** (ou un composant partagé).
- Des **boutons accessibles au clavier**, des textes de remplacement, des contrastes suffisants.
- Une interface **responsive** : la plupart de vos camarades l'ouvriront sur leur téléphone.

### Étape 8 : le temps réel et les tâches planifiées (si besoin)

Pour une discussion ou un emploi du temps qui change, le temps réel évite de recharger la page. Prévoyez toujours un **secours** (un rafraîchissement régulier) au cas où la connexion temps réel est coupée. Pour nettoyer des données chaque nuit, utilisez une tâche planifiée (`pg_cron`) qui appelle une fonction serveur protégée par un secret.

### Étape 9 : tester, y compris ce qui ne doit pas marcher

- **Règles de sécurité** : essayez de les enfreindre, rôle par rôle (voir la difficulté 9).
- **Pages** : testez en version ordinateur, téléphone, thème sombre.
- **Appareils réels** : testez sur le plus ancien appareil que vous avez sous la main (voir la difficulté 14).
- **Scripts de base de données** : exécutez-les **deux fois de suite** pour vérifier qu'ils sont relançables.

### Étape 10 : déployer, versionner et documenter

- Un **dépôt Git**, avec des messages de commit qui expliquent **pourquoi** on change quelque chose, pas seulement quoi.
- Un **journal des versions** (`CHANGELOG.md`) mis à jour à chaque évolution.
- Un **README** qui permet à quelqu'un d'autre de reprendre le projet.
- Surveillez les **quotas** de votre service gratuit (stockage, trafic) : ce sont les fichiers audio et les fichiers lourds qui consomment le plus, pas le texte.

### Checklist avant d'ouvrir à toute la classe

- [ ] Toutes les tables ont RLS activé, avec des règles testées par rôle
- [ ] La clé `service_role` n'apparaît nulle part dans le code du navigateur
- [ ] Aucun fichier privé n'est accessible par un lien direct
- [ ] Les textes saisis par les utilisateurs sont affichés comme du texte, jamais comme du code
- [ ] Les scripts de base de données sont relançables
- [ ] La page a été testée sur téléphone, en thème sombre, et sur un appareil ancien
- [ ] Il existe un moyen de supprimer un contenu abusif (modération)
- [ ] Les utilisateurs savent ce qui est conservé et pendant combien de temps (ici : 7 jours pour la discussion)
- [ ] Le README explique comment installer et administrer le projet

### Erreurs à éviter

- **Mettre la sécurité dans l'interface seulement** : elle doit être dans la base.
- **Recopier la même chose à plusieurs endroits** : tôt ou tard, les copies diffèrent.
- **Changer la structure d'une table sans écrire le chemin de mise à niveau** (difficulté 10).
- **Supposer qu'un navigateur se comporte comme un autre** (difficulté 14).
- **Attendre la fin du projet pour documenter** : on oublie les raisons de ses choix.

---

## Pistes pour la suite

Ce sont des idées, pas des engagements :

- **Notifications** quand une ressource est publiée ou qu'un cours est annulé ;
- **Export de l'emploi du temps** vers un agenda (fichier `.ics`) ;
- **Installation comme application** sur le téléphone ;
- **Statistiques anonymes** pour l'administrateur (ressources les plus consultées) ;
- **Nouvelles classes** (L3, autres filières), sur le modèle de la L2 ;
- **Plus de contributions** d'étudiants : corrections, ressources, traductions.

---

## Remerciements

Ce projet n'aurait pas pris la même forme sans **Mouhamed Diop** et **Mory Ndour**.

Ce sont eux, mes camarades, qui m'ont parlé de **Supabase**, et cette découverte a été décisive : elle m'a permis de gérer, au même endroit, la **base de données**, l'**authentification** et la **partie serveur** de la plateforme (stockage privé, règles de sécurité, fonctions serveur), sans avoir à monter et à maintenir moi-même un serveur. C'est grâce à ce conseil que GL HUB est passé d'un simple catalogue statique à une véritable plateforme avec des comptes, des quiz et, aujourd'hui, un espace complet pour la classe.

Merci à vous deux pour votre inspiration et pour votre générosité dans le partage de vos connaissances. Baarakallahou fiikoum.

Merci aussi à mes camarades de classe, qui ont découvert GL HUB lors de l'examen pratique du premier semestre, et qui l'utilisent et le testent aujourd'hui : vos retours rendent le projet meilleur.

Et si vous lisez ces lignes avec l'envie de créer votre propre plateforme : lancez-vous, commencez petit, et partagez ce que vous apprenez. C'est exactement comme cela que ce projet a grandi.

---

## Outils et services utilisés

| Outil | Usage |
|---|---|
| [Supabase](https://supabase.com) | Base de données PostgreSQL, authentification, stockage, Edge Functions, temps réel |
| [Vercel](https://vercel.com) | Hébergement et déploiement |
| [GitHub](https://github.com) | Hébergement du code, historique et collaboration |
| [Font Awesome](https://fontawesome.com) | Icônes |
| [YouTube](https://www.youtube.com) | Lecteur de vidéos intégré (mode sans cookies) |

---

Auteur : **Mohamed BATHILY**, étudiant en Génie Logiciel ([@mhdev-x](https://github.com/mhdev-x)). Projet sous licence **MIT**, voir [LICENSE](LICENSE).
