let btn = document.getElementById("themeToggle");

document.addEventListener("DOMContentLoaded", 
    () => {
    let boutonTheme = document.querySelector("#themeToggle");

    let mettreAJourIcone = (theme) => {
        if (boutonTheme) {
            boutonTheme.textContent = theme === "dark" ? "🌝" : "🌚";
        }
    };


    let themeSauvegarde = localStorage.getItem("theme") || "light";
    
    document.body.classList.toggle("dark-theme", themeSauvegarde === "dark");
    mettreAJourIcone(themeSauvegarde);

    if (boutonTheme) {
        boutonTheme.addEventListener("click", 
            () => {
            let estSombre = document.body.classList.toggle("dark-theme");
            
            let nouveauTheme = estSombre ? "dark" : "light";
            
            localStorage.setItem("theme", nouveauTheme);
            mettreAJourIcone(nouveauTheme);
        });
    }
});