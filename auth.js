document.addEventListener("DOMContentLoaded", () => {

    // ===== Éléments de la modale Connexion/Inscription =====
    let boutonConnexionDepuisPanneau = document.querySelector("#boutonConnexionDepuisPanneau");
    let voileAuth = document.querySelector("#voileAuth");
    let modaleAuth = document.querySelector("#modaleAuth");
    let fermerModaleAuth = document.querySelector("#fermerModaleAuth");

    let ongletConnexion = document.querySelector("#ongletConnexion");
    let ongletInscription = document.querySelector("#ongletInscription");
    let formConnexion = document.querySelector("#formConnexion");
    let formInscription = document.querySelector("#formInscription");

    let boutonValiderConnexion = document.querySelector("#boutonValiderConnexion");
    let boutonValiderInscription = document.querySelector("#boutonValiderInscription");
    let erreurConnexion = document.querySelector("#erreurConnexion");
    let erreurInscription = document.querySelector("#erreurInscription");

    // ===== Éléments du panneau Matières =====
    let boutonMatieres = document.querySelector("#boutonMatieres");
    let voileMatieres = document.querySelector("#voileMatieres");
    let panneauMatieres = document.querySelector("#panneauMatieres");
    let fermerPanneauMatieres = document.querySelector("#fermerPanneauMatieres");
    let matieresVerrouillees = document.querySelector("#matieresVerrouillees");
    let listeMatieres = document.querySelector("#listeMatieres");

    // ===== Zone du bouton Auth dans la nav =====
    let zoneAuthNav = document.querySelector("#zoneAuthNav");

    // ---------- Ouvrir / fermer la modale d'authentification ----------
    let ouvrirModaleAuth = () => {
        voileAuth.classList.add("visible");
        modaleAuth.classList.add("visible");
    };

    let fermerLaModaleAuth = () => {
        voileAuth.classList.remove("visible");
        modaleAuth.classList.remove("visible");
    };

    let attacherBoutonAuth = () => {
        let boutonAuth = document.querySelector("#boutonAuth");
        if (boutonAuth) boutonAuth.addEventListener("click", ouvrirModaleAuth);
    };

    attacherBoutonAuth();
    if (fermerModaleAuth) fermerModaleAuth.addEventListener("click", fermerLaModaleAuth);
    if (voileAuth) voileAuth.addEventListener("click", fermerLaModaleAuth);

    if (boutonConnexionDepuisPanneau) {
        boutonConnexionDepuisPanneau.addEventListener("click", () => {
            fermerLePanneauMatieres();
            ouvrirModaleAuth();
        });
    }

    // ---------- Basculer entre onglet Connexion / Inscription ----------
    let afficherConnexion = () => {
        ongletConnexion.classList.add("actif");
        ongletInscription.classList.remove("actif");
        formConnexion.style.display = "flex";
        formInscription.style.display = "none";
    };

    let afficherInscription = () => {
        ongletInscription.classList.add("actif");
        ongletConnexion.classList.remove("actif");
        formInscription.style.display = "flex";
        formConnexion.style.display = "none";
    };

    if (ongletConnexion) ongletConnexion.addEventListener("click", afficherConnexion);
    if (ongletInscription) ongletInscription.addEventListener("click", afficherInscription);

    // ---------- Ouvrir / fermer le panneau Matières ----------
    let ouvrirLePanneauMatieres = () => {
        voileMatieres.classList.add("visible");
        panneauMatieres.classList.add("ouvert");
    };

    let fermerLePanneauMatieres = () => {
        voileMatieres.classList.remove("visible");
        panneauMatieres.classList.remove("ouvert");
    };

    if (boutonMatieres) boutonMatieres.addEventListener("click", ouvrirLePanneauMatieres);
    if (fermerPanneauMatieres) fermerPanneauMatieres.addEventListener("click", fermerLePanneauMatieres);
    if (voileMatieres) voileMatieres.addEventListener("click", fermerLePanneauMatieres);

    // ---------- Mettre à jour l'interface selon l'état de connexion ----------
    let afficherEtatConnecte = async (utilisateur) => {
        if (matieresVerrouillees) matieresVerrouillees.style.display = "none";
        if (listeMatieres) listeMatieres.style.display = "block";

        // Vérifie si ce compte est admin, pour afficher (ou pas) le raccourci
        let { data: admin } = await supabaseClient
            .from("admins")
            .select("user_id")
            .eq("user_id", utilisateur.id)
            .maybeSingle();

        let lienAdmin = admin ? `<a href="admin.html" class="lien-menu-bouton"><i class="fa-solid fa-user-shield"></i>Admin</a>` : "";

        if (zoneAuthNav) {
            let nom = (utilisateur.user_metadata && utilisateur.user_metadata.nom) || utilisateur.email;
            zoneAuthNav.innerHTML = `${lienAdmin}<button id="boutonDeconnexion" class="lien-menu-bouton"><i class="fa-solid fa-right-from-bracket"></i>${nom}</button>`;
            document.querySelector("#boutonDeconnexion").addEventListener("click", async () => {
                await supabaseClient.auth.signOut();
                window.location.href = "index.html";
            });
        }
    };

    let afficherEtatDeconnecte = () => {
        if (matieresVerrouillees) matieresVerrouillees.style.display = "block";
        if (listeMatieres) listeMatieres.style.display = "none";

        if (zoneAuthNav) {
            zoneAuthNav.innerHTML = `<button id="boutonAuth" class="lien-menu-bouton"><i class="fa-solid fa-user"></i>Se connecter</button>`;
            attacherBoutonAuth();
        }
    };

    // ---------- Vérifier la session au chargement de la page ----------
    let verifierSession = async () => {
        let { data } = await supabaseClient.auth.getSession();
        if (data.session) {
            afficherEtatConnecte(data.session.user);
        } else {
            afficherEtatDeconnecte();
        }
    };

    verifierSession();

    // Réagit en direct si l'utilisateur se connecte/déconnecte (autre onglet, expiration...)
    supabaseClient.auth.onAuthStateChange((_evenement, session) => {
        if (session) {
            afficherEtatConnecte(session.user);
        } else {
            afficherEtatDeconnecte();
        }
    });

    // ---------- Connexion ----------
    boutonValiderConnexion.addEventListener("click", async () => {
        let email = document.querySelector("#emailConnexion").value.trim();
        let motDePasse = document.querySelector("#motDePasseConnexion").value.trim();

        if (!email || !motDePasse) {
            erreurConnexion.textContent = "Merci de remplir tous les champs.";
            return;
        }

        erreurConnexion.textContent = "Connexion en cours...";
        boutonValiderConnexion.disabled = true;

        let { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: motDePasse
        });

        boutonValiderConnexion.disabled = false;

        if (error) {
            erreurConnexion.textContent = "Email ou mot de passe incorrect.";
            return;
        }

        erreurConnexion.textContent = "";
        fermerLaModaleAuth();
        afficherEtatConnecte(data.user);
    });

    // ---------- Inscription ----------
    boutonValiderInscription.addEventListener("click", async () => {
        let nom = document.querySelector("#nomInscription").value.trim();
        let email = document.querySelector("#emailInscription").value.trim();
        let motDePasse = document.querySelector("#motDePasseInscription").value.trim();

        if (!nom || !email || !motDePasse) {
            erreurInscription.textContent = "Merci de remplir tous les champs.";
            return;
        }

        if (motDePasse.length < 6) {
            erreurInscription.textContent = "Le mot de passe doit contenir au moins 6 caractères.";
            return;
        }

        erreurInscription.textContent = "Création du compte...";
        boutonValiderInscription.disabled = true;

        let { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: motDePasse,
            options: {
                data: { nom: nom }
            }
        });

        boutonValiderInscription.disabled = false;

        if (error) {
            erreurInscription.textContent = error.message.includes("already registered")
                ? "Cet email est déjà utilisé."
                : "Une erreur est survenue. Réessaie.";
            return;
        }

        erreurInscription.textContent = "";

        // Si la confirmation par email est activée dans Supabase, il n'y a pas encore de session
        if (data.session) {
            fermerLaModaleAuth();
            afficherEtatConnecte(data.user);
        } else {
            erreurInscription.textContent = "Compte créé ! Vérifie ta boîte mail pour confirmer.";
        }
    });
});