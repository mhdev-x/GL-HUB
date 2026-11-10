// =====================================================================
// GL HUB : enregistrement du service worker (PWA, étape 1)
//
// Ce script est chargé dans le <head> de chaque page (voir outils/ajouter-pwa.py).
// Il enregistre sw.js et expose quelques aides pour les étapes suivantes
// (notifications push) : window.GLHubPWA.
// =====================================================================
(function () {
    "use strict";

    // iPhone, iPad (y compris iPadOS qui se présente comme un Mac)
    let estIOS = () =>
        /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    // Vrai quand l'application est lancée depuis l'écran d'accueil (et non dans un onglet)
    let estInstallee = () =>
        window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

    // Les notifications push sont possibles si le navigateur les gère ;
    // sur iPhone et iPad (iOS 16.4 minimum), seulement si l'application est installée.
    let pushPossible = () =>
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window &&
        (!estIOS() || estInstallee());

    window.GLHubPWA = Object.freeze({ estIOS, estInstallee, pushPossible });

    if (!("serviceWorker" in navigator)) return;

    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js")
            .then((enregistrement) => {
                // Cherche une nouvelle version du service worker quand on revient sur l'application
                document.addEventListener("visibilitychange", () => {
                    if (!document.hidden) enregistrement.update().catch(() => {});
                });
            })
            .catch((erreur) => console.error("Service worker :", erreur));
    });
})();
