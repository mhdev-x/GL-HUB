// =====================================================================
// GL HUB : ajoute automatiquement la PWA et les notifications aux pages HTML
//
// Utilisation (dans le terminal de VS Code, à la racine du site) :
//   1) node ajouter-pwa.js --simulation     (montre ce qui serait modifié, ne touche à rien)
//   2) node ajouter-pwa.js                  (applique les modifications)
//   3) git diff                             (vérifie le résultat avant de commit)
//
// Le script peut être relancé sans risque : il n'ajoute jamais deux fois la même chose.
// Tu peux le supprimer du projet une fois terminé.
// =====================================================================
const fs = require("fs");
const path = require("path");

// ---------- A REMPLIR : ta clé VAPID PUBLIQUE (npx web-push generate-vapid-keys) ----------
const CLE_VAPID_PUBLIQUE = "COLLE_ICI_TA_CLE_VAPID_PUBLIQUE";

const ESPACE = "l2";

// Pages qui reçoivent les notifications (synchronisation silencieuse de l'abonnement)
const PAGES_NOTIFICATIONS = ["discussion-l2.html", "emploi-du-temps-l2.html", "espace-l2.html"];
// Parmi elles, celles qui affichent le bouton « Activer les notifications »
const PAGES_AVEC_BOUTON = ["discussion-l2.html", "espace-l2.html"];
// Pages ignorées
const IGNOREES = ["offline.html"];

const simulation = process.argv.includes("--simulation");
const dossier = process.cwd();

if (!simulation && CLE_VAPID_PUBLIQUE.startsWith("COLLE_ICI")) {
    console.error("Arrêt : remplace d'abord CLE_VAPID_PUBLIQUE en haut de ce fichier par ta clé publique.");
    process.exit(1);
}

// ---------- Blocs à insérer ----------
function blocHead(contenu) {
    const lignes = [];
    if (!/rel=["']manifest["']/i.test(contenu)) lignes.push('<link rel="manifest" href="manifest.json">');
    if (!/name=["']theme-color["']/i.test(contenu)) lignes.push('<meta name="theme-color" content="#0B204C">');
    if (!/rel=["']apple-touch-icon["']/i.test(contenu)) lignes.push('<link rel="apple-touch-icon" href="MEDIAS/icons/icon-192.png">');
    if (!/src=["'][^"']*pwa\.js["']/i.test(contenu)) lignes.push('<script src="pwa.js" defer></script>');
    return lignes;
}

function blocNotifications(avecBouton) {
    const lignes = [];
    if (avecBouton) {
        lignes.push("<style>#btn-notifications:disabled{opacity:.6;cursor:default}</style>");
        lignes.push(
            '<button id="btn-notifications" type="button" style="position:fixed;left:12px;bottom:12px;z-index:900;' +
            "padding:8px 14px;border:0;border-radius:999px;background:#0B204C;color:#fff;font-size:.85rem;" +
            'cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25)"></button>'
        );
    }
    lignes.push('<script src="notifications.js"></script>');
    lignes.push("<script>");
    lignes.push('    window.addEventListener("load", function () {');
    lignes.push('        if (typeof supabaseClient === "undefined") return;');
    lignes.push(`        GLHubPush.init({ supabase: supabaseClient, clePublique: "${CLE_VAPID_PUBLIQUE}", espace: "${ESPACE}" });`);
    lignes.push('        var bouton = document.getElementById("btn-notifications");');
    lignes.push("        if (bouton) GLHubPush.lierBouton(bouton);");
    lignes.push("    });");
    lignes.push("</script>");
    return lignes;
}

function dernierIndex(contenu, regex) {
    const trouves = [...contenu.matchAll(regex)];
    return trouves.length ? trouves[trouves.length - 1].index : -1;
}

// ---------- Traitement des pages ----------
const fichiers = fs.readdirSync(dossier)
    .filter((f) => f.toLowerCase().endsWith(".html") && !IGNOREES.includes(f))
    .sort();

const modifiees = [];
const dejaBonnes = [];
const erreurs = [];
const l2SansNotifications = [];

for (const nom of fichiers) {
    const chemin = path.join(dossier, nom);
    let contenu = fs.readFileSync(chemin, "utf8");
    const eol = contenu.includes("\r\n") ? "\r\n" : "\n";
    const actions = [];

    // 1) Balises PWA dans le <head> de toutes les pages
    const lignesHead = blocHead(contenu);
    if (lignesHead.length) {
        const idx = contenu.search(/<\/head>/i);
        if (idx === -1) {
            erreurs.push(`${nom} : balise </head> introuvable`);
            continue;
        }
        const bloc = "    " + lignesHead.join(eol + "    ") + eol;
        contenu = contenu.slice(0, idx) + bloc + contenu.slice(idx);
        actions.push("PWA dans le head");
    }

    // 2) Notifications sur les pages de l'espace L2
    if (PAGES_NOTIFICATIONS.includes(nom)) {
        if (!/notifications\.js/i.test(contenu)) {
            const idx = dernierIndex(contenu, /<\/body>/gi);
            if (idx === -1) {
                erreurs.push(`${nom} : balise </body> introuvable`);
                continue;
            }
            const bloc = "    " + blocNotifications(PAGES_AVEC_BOUTON.includes(nom)).join(eol + "    ") + eol;
            contenu = contenu.slice(0, idx) + bloc + contenu.slice(idx);
            actions.push(PAGES_AVEC_BOUTON.includes(nom) ? "bouton + notifications" : "notifications (sans bouton)");
        }
    } else if (/l2/i.test(nom)) {
        l2SansNotifications.push(nom);
    }

    if (actions.length === 0) {
        dejaBonnes.push(nom);
        continue;
    }
    if (!simulation) fs.writeFileSync(chemin, contenu, "utf8");
    modifiees.push(`${nom} : ${actions.join(", ")}`);
}

// ---------- Compte rendu ----------
console.log(simulation ? "\n=== SIMULATION (aucun fichier modifié) ===" : "\n=== MODIFICATIONS APPLIQUÉES ===");
if (modifiees.length) modifiees.forEach((m) => console.log("  modifié   " + m));
if (dejaBonnes.length) console.log(`  inchangé  ${dejaBonnes.length} page(s) déjà en ordre : ${dejaBonnes.join(", ")}`);
if (l2SansNotifications.length) {
    console.log("\nPages L2 trouvées SANS notifications (volontaire pour les pages d'accès ou d'administration) :");
    l2SansNotifications.forEach((n) => console.log("  - " + n));
    console.log("Pour en ajouter une, mets son nom dans PAGES_NOTIFICATIONS en haut du script puis relance-le.");
}
if (erreurs.length) {
    console.log("\nErreurs :");
    erreurs.forEach((e) => console.log("  ! " + e));
}
console.log("");