// theme-toggle.js
// A inclure sur toutes les pages, juste avant </body>

document.addEventListener("DOMContentLoaded", () => {
    let racine = document.documentElement;
    let boutonTheme = document.querySelector("#themeToggle");

    let mettreAJourIcone = (theme) => {
        boutonTheme.textContent = theme === "dark" ? "☀️" : "🌙";
    };

    // Recupere le theme sauvegarde, sinon "light" par defaut
    let themeSauvegarde = localStorage.getItem("theme") || "light";
    racine.setAttribute("data-theme", themeSauvegarde);
    mettreAJourIcone(themeSauvegarde);

    boutonTheme.addEventListener("click", () => {
        let themeActuel = racine.getAttribute("data-theme");
        let nouveauTheme = themeActuel === "light" ? "dark" : "light";

        racine.setAttribute("data-theme", nouveauTheme);
        localStorage.setItem("theme", nouveauTheme);
        mettreAJourIcone(nouveauTheme);
    });
});