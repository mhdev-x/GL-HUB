// ========================================================
// MENU "CLASSES" — barre de navigation GL HUB
//
//  - L1 Génie Logiciel : ouvre le panneau des matières (connexion demandée
//    par le panneau lui-même si l'utilisateur n'est pas connecté)
//  - L2 Génie Logiciel :
//      · pas connecté        -> ouvre la fenêtre de connexion
//      · membre de la classe -> espace L2
//      · pas encore membre   -> page de demande d'accès
//      · admin               -> espace L2
//
// La vraie protection est en base (RLS) : ce menu ne fait que diriger
// l'utilisateur vers la bonne page.
// ========================================================
(function () {

    let SLUG_CLASSE_L2 = "l2-gl-2026-2027";
    let CLE_REPRISE = "glhubReprendreL2";
    let PAGE_ACCES = "acces-l2.html";
    let PAGE_ESPACE = "espace-l2.html";

    // ---------- Où envoyer l'utilisateur pour la L2 ? ----------
    let destinationL2 = async (utilisateur) => {
        try {
            let { data: classe, error: erreurClasse } = await supabaseClient
                .from("classes").select("id").eq("slug", SLUG_CLASSE_L2).maybeSingle();
            if (erreurClasse || !classe) return PAGE_ACCES;

            let [reponseMembre, reponseAdmin] = await Promise.all([
                supabaseClient.from("membres_classe").select("role")
                    .eq("classe_id", classe.id).eq("user_id", utilisateur.id).maybeSingle(),
                supabaseClient.from("admins").select("user_id")
                    .eq("user_id", utilisateur.id).maybeSingle()
            ]);
            if (reponseMembre.data || reponseAdmin.data) return PAGE_ESPACE;
            return PAGE_ACCES;
        } catch (e) {
            console.error("Menu Classes :", e);
            return PAGE_ACCES;
        }
    };

    let ouvrirL2 = async (evenement) => {
        if (evenement && evenement.preventDefault) evenement.preventDefault();

        let { data } = await supabaseClient.auth.getSession();
        if (!data.session) {
            if (window.ouvrirModaleAuth) {
                // Après la connexion, on reprend le chemin vers la L2 automatiquement
                try { sessionStorage.setItem(CLE_REPRISE, "1"); } catch (_) { /* stockage bloqué : tant pis */ }
                window.ouvrirModaleAuth();
            } else {
                window.location.href = PAGE_ACCES;
            }
            return;
        }
        window.location.href = await destinationL2(data.session.user);
    };

    let ouvrirL1 = () => {
        let boutonMatieres = document.querySelector("#boutonMatieres");
        if (boutonMatieres) boutonMatieres.click();
    };

    window.GLClasses = Object.freeze({ ouvrirL2, ouvrirL1 });

    // ---------- Menu déroulant ----------
    let declencheur = document.querySelector("#declencheurClasses");
    let sousMenu = document.querySelector("#sousMenuClasses");

    if (declencheur && sousMenu) {
        let ouvrirMenu = () => {
            sousMenu.hidden = false;
            declencheur.setAttribute("aria-expanded", "true");
        };
        let fermerMenu = () => {
            sousMenu.hidden = true;
            declencheur.setAttribute("aria-expanded", "false");
        };
        let basculerMenu = () => (sousMenu.hidden ? ouvrirMenu() : fermerMenu());

        declencheur.addEventListener("click", basculerMenu);
        declencheur.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
                e.preventDefault();
                ouvrirMenu();
                let premier = sousMenu.querySelector("button, a");
                if (premier) premier.focus();
            } else if (e.key === "Escape") {
                fermerMenu();
            }
        });

        sousMenu.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                fermerMenu();
                declencheur.focus();
                return;
            }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                let elements = Array.from(sousMenu.querySelectorAll("button, a"));
                let index = elements.indexOf(document.activeElement);
                let suivant = e.key === "ArrowDown" ? index + 1 : index - 1;
                elements[(suivant + elements.length) % elements.length].focus();
            }
        });

        document.addEventListener("click", (e) => {
            if (!sousMenu.hidden && !e.target.closest(".menu-classes")) fermerMenu();
        });

        let choixL1 = document.querySelector("#choixL1");
        let choixL2 = document.querySelector("#choixL2");
        if (choixL1) choixL1.addEventListener("click", () => { fermerMenu(); ouvrirL1(); });
        if (choixL2) choixL2.addEventListener("click", (e) => { fermerMenu(); ouvrirL2(e); });
    }

    // ---------- Reprise après connexion (fenêtre de connexion ou retour de Google) ----------
    let reprendreSiDemande = async (session) => {
        let demande = null;
        try { demande = sessionStorage.getItem(CLE_REPRISE); } catch (_) { return; }
        if (!demande || !session) return;
        try { sessionStorage.removeItem(CLE_REPRISE); } catch (_) { /* rien */ }
        window.location.href = await destinationL2(session.user);
    };

    supabaseClient.auth.onAuthStateChange((evenement, session) => {
        if (evenement === "SIGNED_IN" || evenement === "INITIAL_SESSION") {
            // setTimeout : on n'appelle pas Supabase pendant le callback d'authentification
            setTimeout(() => reprendreSiDemande(session), 0);
        }
    });
})();
