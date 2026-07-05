document.addEventListener("DOMContentLoaded", 
    () => {
    let racine = document.documentElement;
    let boutonTheme = document.querySelector("#themeToggle");

    let mettreAJourIcone = (theme) => {
        // ON VÉRIFIE SI LE BOUTON EXISTE AVANT DE CHANGER SON TEXTE
        if (boutonTheme) {
            boutonTheme.textContent = theme === "dark" ? "☀️" : "🌙";
        }
    };

    // Récupère le thème sauvegardé, sinon "light" par défaut
    let themeSauvegarde = localStorage.getItem("theme") || "light";
    racine.setAttribute("data-theme", themeSauvegarde);
    mettreAJourIcone(themeSauvegarde);

    // ON AJOUTE L'ÉCOUTEUR DE CLIC UNIQUEMENT SI LE BOUTON EST PRÉSENT
    if (boutonTheme) {
        boutonTheme.addEventListener("click", 
            () => {
            let themeActuel = racine.getAttribute("data-theme");
            let nouveauTheme = themeActuel === "light" ? "dark" : "light";

            racine.setAttribute("data-theme", nouveauTheme);
            localStorage.setItem("theme", nouveauTheme);
            mettreAJourIcone(nouveauTheme);
        });
    }
});