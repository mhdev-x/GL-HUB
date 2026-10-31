// ========================================================
// ANCIEN COMPTE GL HUB (adresse @gl.com et mot de passe)
//
// GL HUB se connecte désormais uniquement avec Google. Cette page, qui n'est liée nulle part
// dans le site, sert aux étudiants qui avaient un ancien compte : ils s'y connectent une
// dernière fois, puis lient leur compte Google depuis la page Profil pour garder leur
// progression. Aucune inscription n'est possible ici.
// ========================================================
document.addEventListener("DOMContentLoaded", async () => {

    let formAncienCompte = document.querySelector("#formAncienCompte");
    let champEmail = document.querySelector("#champEmailAncien");
    let champMdp = document.querySelector("#champMdpAncien");
    let erreurAncienCompte = document.querySelector("#erreurAncienCompte");
    let boutonAncienCompte = document.querySelector("#boutonAncienCompte");
    let messageDejaConnecte = document.querySelector("#messageDejaConnecte");

    // Déjà connecté : inutile de se reconnecter, on indique la suite
    let { data: sessionData } = await supabaseClient.auth.getSession();
    if (sessionData.session) {
        messageDejaConnecte.textContent = "Tu es déjà connecté. Va sur ta page Profil pour lier ton compte Google.";
        messageDejaConnecte.hidden = false;
    }

    formAncienCompte.addEventListener("submit", async (e) => {
        e.preventDefault();
        erreurAncienCompte.textContent = "";

        let email = champEmail.value.trim().toLowerCase();
        let motDePasse = champMdp.value;
        if (!email || !motDePasse) {
            erreurAncienCompte.textContent = "Renseigne ton adresse e-mail et ton mot de passe.";
            return;
        }

        boutonAncienCompte.disabled = true;
        boutonAncienCompte.textContent = "Connexion...";
        try {
            let { error } = await supabaseClient.auth.signInWithPassword({ email: email, password: motDePasse });
            if (error) {
                console.error(error);
                erreurAncienCompte.textContent = "Adresse e-mail ou mot de passe incorrect.";
                return;
            }
            // Direction le Profil, où se trouve le bouton "Lier mon compte Google"
            window.location.href = "profil.html";
        } catch (erreurReseau) {
            console.error(erreurReseau);
            erreurAncienCompte.textContent = "Connexion impossible pour le moment. Vérifie ta connexion, puis réessaie.";
        } finally {
            boutonAncienCompte.disabled = false;
            boutonAncienCompte.textContent = "Me connecter";
        }
    });
});
