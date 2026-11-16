// =====================================================================
// GL HUB : application installable (PWA)
// À charger sur TOUTES les pages : <script src="pwa.js" defer></script>
// Ce fichier doit être placé à côté de sw.js (même dossier, la racine du site).
//
// Ce que fait ce fichier :
//  1. enregistre le service worker (sw.js) ;
//  2. propose « Nouvelle version disponible » quand le site a été mis à jour ;
//  3. ajoute « Installer l'application » dans le menu :
//       - Android et ordinateur : un clic ouvre la fenêtre d'installation du navigateur ;
//       - iPhone et iPad : un clic explique comment l'ajouter à l'écran d'accueil ;
//  4. affiche le nombre de notifications non lues sur l'icône de l'application
//     (nombre sur iPhone, iPad, Windows et Mac ; simple point sur Android, c'est le
//     système qui décide). Le nombre vient de la cloche (événement "glhub:nonlues").
// =====================================================================
(function () {
    "use strict";

    const script = document.currentScript;
    const base = script && script.src ? new URL("./", script.src) : new URL("./", location.href);

    const VERIF_MISE_A_JOUR_MS = 30 * 60 * 1000;   // on cherche une nouvelle version toutes les 30 minutes
    const DELAI_MINIMUM_MS = 5 * 60 * 1000;        // et au plus une fois toutes les 5 minutes au retour sur l'application

    // ---------- Styles (variables du thème, avec des valeurs de secours) ----------
    const STYLES = [
        ".pwa-barre{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2100;",
        "display:flex;align-items:center;gap:12px;width:min(92vw,460px);padding:12px 14px;font:0.9rem/1.35 'Segoe UI',Roboto,Helvetica,Arial,sans-serif;",
        "color:var(--color-text,#0B204C);background:var(--color-card-bg,#fff);border:1px solid var(--color-card-border,#e2e8f0);",
        "border-left:4px solid var(--color-accent,#0B204C);border-radius:12px;box-shadow:0 12px 32px var(--shadow-medium,rgba(0,0,0,.2));}",
        ".pwa-barre-texte{flex:1;font-weight:600;}",
        ".pwa-barre-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}",
        ".pwa-bouton{padding:8px 14px;font:inherit;font-weight:700;color:var(--color-accent-text,#fff);background:var(--color-button-bg,#0B204C);",
        "border:0;border-radius:8px;cursor:pointer;}",
        ".pwa-bouton:disabled{opacity:.65;cursor:default;}",
        ".pwa-bouton-clair{color:var(--color-text-secondary,#64748b);background:none;border:1px solid var(--color-card-border,#e2e8f0);font-weight:600;}",
        ".pwa-bouton:focus-visible{outline:3px solid var(--color-accent,#0B204C);outline-offset:2px;}",
        ".pwa-voile{position:fixed;inset:0;z-index:2200;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.55);}",
        ".pwa-modale{width:min(100%,420px);padding:20px;font:0.95rem/1.5 'Segoe UI',Roboto,Helvetica,Arial,sans-serif;",
        "color:var(--color-text,#0B204C);background:var(--color-card-bg,#fff);border:1px solid var(--color-card-border,#e2e8f0);border-radius:14px;}",
        ".pwa-modale h2{margin:0 0 12px;font-size:1.15rem;}",
        ".pwa-modale ol{margin:0 0 16px;padding-left:22px;}",
        ".pwa-modale li{margin-bottom:8px;}",
        ".pwa-modale .pwa-bouton{width:100%;}"
    ].join("");

    function injecterStyles() {
        if (document.getElementById("glhub-pwa-styles")) return;
        const balise = document.createElement("style");
        balise.id = "glhub-pwa-styles";
        balise.textContent = STYLES;
        document.head.appendChild(balise);
    }

    // ---------- Petits outils ----------
    function creer(balise, classe, texte) {
        const element = document.createElement(balise);
        if (classe) element.className = classe;
        if (texte) element.textContent = texte;
        return element;
    }

    function estInstallee() {
        const standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
        return Boolean(standalone) || window.navigator.standalone === true;
    }

    function estIOS() {
        return /iphone|ipad|ipod/i.test(navigator.userAgent)
            || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    }

    function quandPret(fonction) {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fonction);
        else fonction();
    }

    // =================================================================
    // 1 et 2. Service worker et « Nouvelle version disponible »
    // =================================================================
    let barreMiseAJour = null;
    let miseAJourDemandee = false;
    let derniereVerification = Date.now();

    function proposerMiseAJour(nouveauWorker) {
        if (barreMiseAJour) return;   // déjà affichée, ou refusée avec "Plus tard" sur cette page
        injecterStyles();

        const barre = creer("div", "pwa-barre");
        barre.setAttribute("role", "status");
        barre.appendChild(creer("span", "pwa-barre-texte", "Une nouvelle version de GL HUB est disponible."));

        const actions = creer("div", "pwa-barre-actions");
        const plusTard = creer("button", "pwa-bouton pwa-bouton-clair", "Plus tard");
        plusTard.type = "button";
        const mettreAJour = creer("button", "pwa-bouton", "Mettre à jour");
        mettreAJour.type = "button";
        actions.append(plusTard, mettreAJour);
        barre.appendChild(actions);

        plusTard.addEventListener("click", function () {
            // La barre reste "occupée" : elle ne revient pas tant que la page n'est pas rechargée
            barre.remove();
        });

        mettreAJour.addEventListener("click", function () {
            miseAJourDemandee = true;
            mettreAJour.disabled = true;
            plusTard.disabled = true;
            mettreAJour.textContent = "Mise à jour...";
            nouveauWorker.postMessage({ type: "SKIP_WAITING" });
            // Secours : si le navigateur tarde à changer de version, on recharge quand même
            setTimeout(function () {
                if (miseAJourDemandee) window.location.reload();
            }, 3000);
        });

        document.body.appendChild(barre);
        barreMiseAJour = barre;
    }

    function surveillerMisesAJour(enregistrement) {
        // Une nouvelle version est déjà prête (page ouverte après son téléchargement)
        if (enregistrement.waiting && navigator.serviceWorker.controller) {
            proposerMiseAJour(enregistrement.waiting);
        }

        // Une nouvelle version est trouvée pendant que la page est ouverte
        enregistrement.addEventListener("updatefound", function () {
            const nouveau = enregistrement.installing;
            if (!nouveau) return;
            nouveau.addEventListener("statechange", function () {
                if (nouveau.state === "installed" && navigator.serviceWorker.controller) {
                    proposerMiseAJour(nouveau);
                }
            });
        });

        function chercher() {
            derniereVerification = Date.now();
            enregistrement.update().catch(function () { /* pas de réseau : on réessaiera */ });
        }

        setInterval(chercher, VERIF_MISE_A_JOUR_MS);
        document.addEventListener("visibilitychange", function () {
            if (document.visibilityState === "visible" && Date.now() - derniereVerification > DELAI_MINIMUM_MS) chercher();
        });
    }

    if ("serviceWorker" in navigator) {
        // La nouvelle version a pris la main : on recharge, mais seulement si la personne l'a demandé
        navigator.serviceWorker.addEventListener("controllerchange", function () {
            if (!miseAJourDemandee) return;
            miseAJourDemandee = false;
            window.location.reload();
        });

        window.addEventListener("load", function () {
            navigator.serviceWorker
                .register(new URL("sw.js", base).href)
                .then(surveillerMisesAJour)
                .catch(function (erreur) {
                    console.warn("[GL HUB] Le service worker n'a pas pu être enregistré :", erreur);
                });
        });
    }

    // =================================================================
    // 3. « Installer l'application »
    // =================================================================
    let invite = null;   // fenêtre d'installation proposée par Chrome / Edge (Android et ordinateur)

    function retirerBoutonInstaller() {
        const element = document.getElementById("pwaInstaller");
        if (element) element.remove();
    }

    function ouvrirAideIOS() {
        injecterStyles();
        if (document.getElementById("pwaAideIOS")) return;

        const voile = creer("div", "pwa-voile");
        voile.id = "pwaAideIOS";

        const modale = creer("div", "pwa-modale");
        modale.setAttribute("role", "dialog");
        modale.setAttribute("aria-modal", "true");
        modale.setAttribute("aria-labelledby", "pwaAideTitre");

        const titre = creer("h2", null, "Installer GL HUB sur ton iPhone");
        titre.id = "pwaAideTitre";

        const etapes = creer("ol");
        [
            "Ouvre ce site dans Safari (pas depuis WhatsApp : copie le lien et ouvre-le dans Safari).",
            "Touche le bouton Partager, le carré avec une flèche vers le haut.",
            "Choisis « Sur l'écran d'accueil », puis « Ajouter ».",
            "Ouvre GL HUB depuis son icône : c'est une vraie application."
        ].forEach(function (texte) { etapes.appendChild(creer("li", null, texte)); });

        const fermer = creer("button", "pwa-bouton", "J'ai compris");
        fermer.type = "button";

        function fermerAide() {
            voile.remove();
            document.removeEventListener("keydown", surTouche);
        }
        function surTouche(evenement) {
            if (evenement.key === "Escape") fermerAide();
        }

        fermer.addEventListener("click", fermerAide);
        voile.addEventListener("click", function (evenement) {
            if (evenement.target === voile) fermerAide();
        });
        document.addEventListener("keydown", surTouche);

        modale.append(titre, etapes, fermer);
        voile.appendChild(modale);
        document.body.appendChild(voile);
        fermer.focus();
    }

    async function installer() {
        if (!invite) return false;
        const proposition = invite;
        invite = null;                       // une fenêtre d'installation ne sert qu'une fois
        proposition.prompt();
        const choix = await proposition.userChoice;
        retirerBoutonInstaller();
        return choix.outcome === "accepted";
    }

    async function clicInstaller() {
        if (invite) {
            await installer();
        } else if (estIOS()) {
            ouvrirAideIOS();
        }
    }

    function placerBoutonInstaller() {
        if (estInstallee()) return;                    // déjà installée : rien à proposer
        if (!invite && !estIOS()) return;              // Android et ordinateur : seulement quand le navigateur l'autorise
        if (document.getElementById("pwaInstaller")) return;

        const menu = document.querySelector("ul.menu");
        if (!menu) return;

        const item = document.createElement("li");
        item.id = "pwaInstaller";
        const bouton = creer("button", "lien-menu-bouton");
        bouton.type = "button";
        const icone = document.createElement("i");
        icone.className = "fa-solid fa-download";
        icone.setAttribute("aria-hidden", "true");
        bouton.append(icone, document.createTextNode("Installer l'application"));
        bouton.addEventListener("click", clicInstaller);
        item.appendChild(bouton);

        const zoneConnexion = document.getElementById("zoneAuthNav");
        if (zoneConnexion && zoneConnexion.parentNode === menu) menu.insertBefore(item, zoneConnexion);
        else menu.appendChild(item);
    }

    window.addEventListener("beforeinstallprompt", function (evenement) {
        evenement.preventDefault();
        invite = evenement;
        window.dispatchEvent(new CustomEvent("glhub:installable"));
        quandPret(placerBoutonInstaller);
    });

    window.addEventListener("appinstalled", function () {
        invite = null;
        retirerBoutonInstaller();
        window.dispatchEvent(new CustomEvent("glhub:installee"));
    });

    quandPret(placerBoutonInstaller);   // iPhone et iPad : pas de fenêtre automatique, on explique

    // =================================================================
    // 4. Pastille sur l'icône de l'application
    // =================================================================
    function definirBadge(nombre) {
        const n = Number(nombre) || 0;
        try {
            if (n > 0 && typeof navigator.setAppBadge === "function") {
                Promise.resolve(navigator.setAppBadge(n)).catch(function () { /* non pris en charge ici */ });
            } else if (typeof navigator.clearAppBadge === "function") {
                Promise.resolve(navigator.clearAppBadge()).catch(function () { /* non pris en charge ici */ });
            }
        } catch (erreur) { /* sans conséquence : la cloche reste la référence */ }
    }

    window.addEventListener("glhub:nonlues", function (evenement) {
        definirBadge(evenement.detail && evenement.detail.nombre);
    });

    window.GLHubPWA = {
        peutInstaller: function () { return invite !== null; },
        installer: installer,
        definirBadge: definirBadge
    };
})();