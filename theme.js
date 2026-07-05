document.addEventListener("DOMContentLoaded", () => {
    let racine = document.documentElement;
    let boutonTheme = document.querySelector("#themeToggle");

    let mettreAJourIcone = (theme) => {
        // Sécurité : On ne change le texte que si le bouton existe sur la page
        if (boutonTheme) {
            boutonTheme.textContent = theme === "dark" ? "☀️" : "🌙";
        }
    };

    // Récupère le thème sauvegardé, sinon "light" par défaut
    let themeSauvegarde = localStorage.getItem("theme") || "light";
    racine.setAttribute("data-theme", themeSauvegarde);
    mettreAJourIcone(themeSauvegarde);

    // Sécurité : On écoute le clic uniquement si le bouton est bien présent
    if (boutonTheme) {
        boutonTheme.addEventListener("click", () => {
            let themeActuel = racine.getAttribute("data-theme");
            let nouveauTheme = themeActuel === "light" ? "dark" : "light";

            racine.setAttribute("data-theme", nouveauTheme);
            localStorage.setItem("theme", nouveauTheme);
            mettreAJourIcone(nouveauTheme);
        });
    }
});