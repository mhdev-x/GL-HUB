// ========================================================
// CHOIX DU NIVEAU (L1 / L2) — page d'accueil GL HUB
//
//  - L1 : ouvre le panneau "Matières" déjà présent dans la navigation
//  - L2 : mène à la page d'accès de l'espace L2
//  - Le dernier choix est mémorisé sur cet appareil : sa carte passe en
//    premier avec un badge "Ton dernier choix".
// Aucune donnée n'est envoyée au serveur.
// ========================================================
document.addEventListener("DOMContentLoaded", () => {

    let CLE_NIVEAU = "niveauGL";

    let lireNiveauMemorise = () => {
        try {
            return localStorage.getItem(CLE_NIVEAU);
        } catch (_) {
            return null; // stockage bloqué (navigation privée...) : on continue sans
        }
    };

    let memoriserNiveau = (niveau) => {
        try {
            localStorage.setItem(CLE_NIVEAU, niveau);
        } catch (_) { /* pas grave : le choix ne sera simplement pas mémorisé */ }
    };

    let niveauMemorise = lireNiveauMemorise();

    document.querySelectorAll(".carte-niveau").forEach(carte => {
        let niveau = carte.dataset.niveau;

        if (niveau === niveauMemorise) {
            carte.classList.add("carte-niveau-active");
            let badge = carte.querySelector(".badge-dernier-choix");
            if (badge) badge.hidden = false;
            carte.parentElement.prepend(carte); // la carte du dernier choix passe en premier
        }

        let bouton = carte.querySelector(".bouton-niveau");
        if (bouton) bouton.addEventListener("click", () => memoriserNiveau(niveau));
    });

    // ---------- L1 : ouvrir le panneau des matières ----------
    let boutonNiveauL1 = document.querySelector("#boutonNiveauL1");
    let boutonMatieres = document.querySelector("#boutonMatieres");
    if (boutonNiveauL1 && boutonMatieres) {
        boutonNiveauL1.addEventListener("click", () => boutonMatieres.click());
    }
});
