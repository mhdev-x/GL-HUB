let btn = document.getElementById("themeToggle");

document.addEventListener("DOMContentLoaded", 
    () => {
    let boutonTheme = document.querySelector("#themeToggle");

    let mettreAJourIcone = (theme) => {
        if (boutonTheme) {
            let icone = theme === "dark" ? "fa-solid fa-moon" : "fa-solid fa-sun icone-soleil";
            boutonTheme.innerHTML = `<i class="${icone}"></i>`;
        }
    };


    let themeSauvegarde = localStorage.getItem("theme") || "light";
    
    document.body.classList.toggle("dark-theme", themeSauvegarde === "dark");
    mettreAJourIcone(themeSauvegarde);

    if (boutonTheme) {
        boutonTheme.addEventListener("click", 
            () => {
            let darkTheme = document.body.classList.toggle("dark-theme");
            
            let nouveauTheme = darkTheme ? "dark" : "light";
            
            localStorage.setItem("theme", nouveauTheme);
            mettreAJourIcone(nouveauTheme);
        });
    }
});