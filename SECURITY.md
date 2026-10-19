# Politique de sécurité

GL HUB est une plateforme éducative utilisée par de vraies classes : la protection des données des étudiants (comptes, numéros de téléphone, messages) est prise au sérieux. Merci de m'aider à la maintenir.

## Versions maintenues

Seule la **dernière version** reçoit des correctifs de sécurité. Le numéro de la version actuelle figure dans le [journal des versions](CHANGELOG.md).

| Version | Maintenue |
| ------- | --------- |
| 3.9.x   | :white_check_mark: |
| < 3.9   | :x: |

## Signaler une vulnérabilité

**Ne publie pas la faille** (ni dans une issue, ni dans un groupe de discussion) avant qu'elle soit corrigée.

Deux moyens de me la signaler en privé :

1. **Depuis GitHub** : sur la page du dépôt, onglet **Security**, puis **Report a vulnerability**. Le signalement n'est visible que par toi et par moi.
2. **Par message** : écris-moi via mon profil GitHub, [@mhdev-x](https://github.com/mhdev-x), en demandant un échange privé.

Si tu es **étudiant** et que tu constates un problème d'accès (par exemple, tu vois le contenu d'une classe dont tu ne fais pas partie, ou tu peux faire une action réservée à l'administrateur), préviens-moi directement, sans partager ta découverte avec les autres.

### Ce qu'il est utile d'indiquer

- la page ou la fonctionnalité concernée ;
- les étapes pour reproduire le problème ;
- ce que tu as pu obtenir ou faire grâce à la faille ;
- ton navigateur et ton appareil.

### Ce que tu peux attendre

Je confirme la réception du signalement dès que possible. Si la faille est confirmée, je la corrige, j'indique la correction dans le journal des versions, et je te remercie si tu le souhaites. Si elle n'est pas confirmée, je t'explique pourquoi.

## Règles pour tester

- Teste uniquement avec **tes propres comptes**, jamais avec ceux d'autres personnes.
- N'accède pas aux données des autres étudiants, et ne les copie pas.
- Ne fais pas de test qui perturbe le service (envoi massif de requêtes, saturation du stockage).
- Ne supprime ni ne modifie des données qui ne sont pas les tiennes.

## Ce qui est couvert

- le site (pages, scripts, styles) ;
- les règles de sécurité de la base de données (RLS et triggers) ;
- les Edge Functions : `quiz-start`, `quiz-submit`, `resource-access`, `l2-resource-access`, `l2-chat-purge` ;
- la configuration des buckets de stockage privés.

Les problèmes qui concernent les plateformes elles-mêmes (Supabase, Vercel, GitHub, Google) sont à signaler directement à ces services.

## Comment la sécurité est conçue

- Les règles d'accès sont dans la **base de données** (RLS et triggers), pas seulement dans l'interface.
- Les fichiers sont dans des **buckets privés** et livrés par des fonctions serveur qui vérifient l'accès à chaque fois : aucun lien partageable.
- Les textes saisis par les utilisateurs sont affichés **comme du texte**, jamais comme du code.
- La clé `service_role` de Supabase n'est **jamais** présente dans le code du navigateur.

Le détail est dans la section « Sécurité » du [README](README.md).
