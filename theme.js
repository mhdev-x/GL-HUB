document.addEventListener("DOMContentLoaded", () => {
    
    // ---------- Gestion du Thème (Clair / Sombre) ----------
    let boutonTheme = document.querySelector("#themeToggle");

    let mettreAJourIcone = (theme) => {
        if (boutonTheme) {
            // Utilise l'icône fa-moon pour le mode sombre et fa-sun (avec classe jaune) pour le mode clair
            let icone = theme === "dark" ? "fa-solid fa-moon" : "fa-solid fa-sun icone-soleil";
            boutonTheme.innerHTML = `<i class="${icone}"></i>`;
        }
    };

    // Récupère le thème sauvegardé ou applique "light" par défaut
    let themeSauvegarde = localStorage.getItem("theme") || "light";
    
    document.body.classList.toggle("dark-theme", themeSauvegarde === "dark");
    mettreAJourIcone(themeSauvegarde);

    if (boutonTheme) {
        boutonTheme.addEventListener("click", () => {
            let darkTheme = document.body.classList.toggle("dark-theme");
            let nouveauTheme = darkTheme ? "dark" : "light";
            
            localStorage.setItem("theme", nouveauTheme);
            mettreAJourIcone(nouveauTheme);
        });
    }

    // ---------- Effet transparent au scroll (nav) ----------
    let elementNav = document.querySelector("nav");
    if (elementNav) {
        window.addEventListener("scroll", () => {
            elementNav.classList.toggle("nav-scrolled", window.scrollY > 20);
        });
    }

    // ---------- Menu hamburger général (mobile) ----------
    let boutonMenuMobile = document.querySelector("#boutonMenuMobile");
    let menuNav = document.querySelector("nav .menu");
    
    if (boutonMenuMobile && menuNav) {
        boutonMenuMobile.addEventListener("click", () => {
            let estOuvert = menuNav.classList.toggle("menu-mobile-ouvert");
            
            // RENDU ROBUSTE : Change l'icône de burger (bars) en croix (xmark) à l'ouverture
            boutonMenuMobile.innerHTML = estOuvert 
                ? '<i class="fa-solid fa-xmark"></i>' 
                : '<i class="fa-solid fa-bars"></i>';
        });

        // RENDU ROBUSTE : Ferme automatiquement le menu mobile lorsqu'un utilisateur clique sur un lien ou bouton du menu
        let elementsMenu = menuNav.querySelectorAll("a, button");
        elementsMenu.forEach(item => {
            item.addEventListener("click", () => {
                menuNav.classList.remove("menu-mobile-ouvert");
                boutonMenuMobile.innerHTML = '<i class="fa-solid fa-bars"></i>';
            });
        });
    }
});