document.addEventListener("DOMContentLoaded", () => {

    // Si le navigateur restaure une page "gelée" (retour en arrière depuis PayDunya
    // par exemple), on force un vrai rechargement pour repartir sur un état propre
    window.addEventListener("pageshow", (evenement) => {
        if (evenement.persisted) {
            window.location.reload();
        }
    });

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

    // ---------- Valider avec la touche Entrée ----------
    // Sur les champs du formulaire de connexion → déclenche le bouton de connexion
    formConnexion.querySelectorAll("input").forEach(champ => {
        champ.addEventListener("keydown", (evenement) => {
            if (evenement.key === "Enter") {
                evenement.preventDefault();
                boutonValiderConnexion.click();
            }
        });
    });

    // Sur les champs du formulaire d'inscription → déclenche le bouton d'inscription
    formInscription.querySelectorAll("input").forEach(champ => {
        champ.addEventListener("keydown", (evenement) => {
            if (evenement.key === "Enter") {
                evenement.preventDefault();
                boutonValiderInscription.click();
            }
        });
    });

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

            zoneAuthNav.innerHTML = `${lienAdmin}<button id="boutonDeconnexion" class="lien-menu-bouton"><i class="fa-solid fa-right-from-bracket"></i></button>`;
            // Le nom est ajouté via textContent (jamais innerHTML) pour empêcher
            // qu'un nom contenant du code HTML/JS ne s'exécute dans la page
            document.querySelector("#boutonDeconnexion").append(nom);

            document.querySelector("#boutonDeconnexion").addEventListener("click", async () => {
                await supabaseClient.auth.signOut();
                window.location.href = "index.html";
            });
        }

        // ---------- Signaler sa présence en temps réel (pour l'admin) ----------
        // Un seul canal de présence pour tout le site : quiconque le rejoint apparaît
        // "en ligne" pour l'admin, et disparaît automatiquement en fermant l'onglet
        if (!admin) {
            let nomAffiche = (utilisateur.user_metadata && utilisateur.user_metadata.nom) || utilisateur.email;
            let canalPresence = supabaseClient.channel("presence-etudiants", {
                config: { presence: { key: utilisateur.id } }
            });

            canalPresence.subscribe(async (statut) => {
                if (statut === "SUBSCRIBED") {
                    await canalPresence.track({
                        nom: nomAffiche,
                        page: document.title || window.location.pathname,
                        depuis: new Date().toISOString()
                    });
                }
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

    // ---------- Revérifier un paiement au retour de PayDunya ----------
    // (succès ou annulation, PayDunya n'appelle pas toujours le webhook dans ce dernier cas)
    let parametresUrl = new URLSearchParams(window.location.search);
    let tokenPaiement = parametresUrl.get("token");
    if (tokenPaiement) {
        supabaseClient.functions.invoke("verifier-paiement", { body: { token: tokenPaiement } })
            .finally(() => {
                // On nettoie l'URL pour éviter de revérifier à chaque rechargement
                let urlPropre = window.location.pathname;
                window.history.replaceState({}, document.title, urlPropre);
            });
    }

    // Réagit en direct si l'utilisateur se connecte/déconnecte (autre onglet, expiration...)
    supabaseClient.auth.onAuthStateChange((_evenement, session) => {
        if (session) {
            afficherEtatConnecte(session.user);
        } else {
            afficherEtatDeconnecte();
        }
    });

    // ---------- Traduire une erreur Supabase en message compréhensible ----------
    // Le détail technique part toujours dans la console (F12) pour le débogage,
    // sans jamais perturber l'étudiant avec du jargon.
    let traduireErreurAuth = (error, contexte) => {
        console.error(`Erreur Supabase (${contexte}) :`, error);

        let message = error.message || "";

        if (message.includes("already registered") || message.includes("already been registered")) {
            return "Cet email est déjà utilisé.";
        }
        if (message.includes("Invalid login credentials")) {
            return "Email ou mot de passe incorrect.";
        }
        if (message.includes("Email not confirmed")) {
            return "Confirme ton email avant de te connecter (vérifie ta boîte mail).";
        }
        if (message.includes("For security purposes") || message.includes("rate limit")) {
            return "Trop de tentatives. Réessaie dans quelques minutes.";
        }
        if (message.includes("Password should be at least")) {
            return "Le mot de passe doit contenir au moins 6 caractères.";
        }
        if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
            return "Problème de connexion internet. Vérifie ta connexion et réessaie.";
        }

        return "Une erreur est survenue. Contacte-nous sur WhatsApp si ça persiste.";
    };

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
            erreurConnexion.textContent = traduireErreurAuth(error, "connexion");
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
            erreurInscription.textContent = traduireErreurAuth(error, "inscription");
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