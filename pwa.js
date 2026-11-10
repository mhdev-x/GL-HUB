// =====================================================================
// GL HUB : enregistrement du service worker (PWA)
// À charger sur TOUTES les pages : <script src="pwa.js" defer></script>
// Ce fichier doit être placé à côté de sw.js (même dossier, la racine du site).
// =====================================================================
(function () {
    "use strict";

    // ---------- Enregistrement du service worker ----------
    if ("serviceWorker" in navigator) {
        const script = document.currentScript;
        const base = script && script.src ? new URL("./", script.src) : new URL("./", location.href);

        window.addEventListener("load", function () {
            navigator.serviceWorker
                .register(new URL("sw.js", base).href)
                .catch(function (erreur) {
                    console.warn("[GL HUB] Le service worker n'a pas pu être enregistré :", erreur);
                });
        });
    }

    // ---------- Bouton « Installer l'application » (Chrome, Edge, Android) ----------
    let invite = null;

    window.addEventListener("beforeinstallprompt", function (evenement) {
        evenement.preventDefault();
        invite = evenement;
        window.dispatchEvent(new CustomEvent("glhub:installable"));
    });

    window.addEventListener("appinstalled", function () {
        invite = null;
        window.dispatchEvent(new CustomEvent("glhub:installee"));
    });

    window.GLHubPWA = {
        // true si le navigateur propose l'installation (Chrome, Edge, Android)
        peutInstaller: function () { return invite !== null; },
        // à appeler depuis un clic sur un bouton
        installer: async function () {
            if (!invite) return false;
            invite.prompt();
            const choix = await invite.userChoice;
            invite = null;
            return choix.outcome === "accepted";
        }
    };
})();