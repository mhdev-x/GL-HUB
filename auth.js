document.addEventListener("DOMContentLoaded", () => {

    // ---------- Petite notification stylisée (remplace alert() pour un rendu propre) ----------
    window.afficherToast = (message, icone = "fa-solid fa-circle-check") => {
        let toast = document.createElement("div");
        toast.className = "toast-notification";
        toast.innerHTML = `<i class="${icone}"></i>`;
        toast.append(message); // le texte est ajouté via append (jamais innerHTML) par sécurité

        document.body.appendChild(toast);

        // Petite animation d'entrée, puis disparition automatique après quelques secondes
        requestAnimationFrame(() => toast.classList.add("toast-visible"));
        setTimeout(() => {
            toast.classList.remove("toast-visible");
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    };


    // Nom à afficher : celui saisi à l'inscription, sinon celui fourni par Google
    let nomDe = (utilisateur) => {
        let m = utilisateur.user_metadata || {};
        return m.nom || m.full_name || m.name || "";
    };

    // ---------- Retour d'une connexion Google qui a échoué ----------
    // (Supabase renvoie ici avec "error" et "error_description" dans l'adresse)
    let afficherErreurRetourGoogle = () => {
        let dansLUrl = new URLSearchParams(window.location.search);
        let dansLeHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        let code = dansLUrl.get("error") || dansLeHash.get("error");
        let description = dansLUrl.get("error_description") || dansLeHash.get("error_description");
        if (!code && !description) return;

        let message;
        if (code === "access_denied") {
            message = "Connexion Google annulée.";
        } else if (description && description.includes("Database error saving new user")) {
            message = "Impossible de créer ton compte avec cette adresse Google : un compte GL HUB existe peut-être déjà avec cette adresse. Contacte l'administrateur pour qu'il t'aide à retrouver ton accès.";
        } else if (description && description.includes("Identity is already linked")) {
            message = "Ce compte Google est déjà lié à un autre compte GL HUB.";
        } else {
            message = "Connexion impossible" + (description ? " : " + description : ".");
        }

        afficherToast(message, "fa-solid fa-triangle-exclamation");
        window.history.replaceState({}, document.title, window.location.pathname);
    };
    afficherErreurRetourGoogle();

    // ---------- Compte créé avec Google : on complète la ligne "profils" avec les infos données par Google ----------
    let profilGoogleVerifie = false;
    let completerProfilGoogle = async (utilisateur) => {
        let estGoogle = (utilisateur.identities || []).some(i => i.provider === "google");
        if (!estGoogle || profilGoogleVerifie) return;
        profilGoogleVerifie = true;

        let m = utilisateur.user_metadata || {};
        let nomComplet = m.full_name || m.name || "";

        let { data: profil } = await supabaseClient
            .from("profils")
            .select("nom, prenom, nom_famille, email_personnel")
            .eq("user_id", utilisateur.id)
            .maybeSingle();
        if (!profil) return; // pas de ligne (ou pas de droit de lecture) : on ne force rien

        let majNoms = {};
        if (!profil.nom && nomComplet) majNoms.nom = nomComplet;
        if (!profil.prenom && m.given_name) majNoms.prenom = m.given_name;
        if (!profil.nom_famille && m.family_name) majNoms.nom_famille = m.family_name;

        if (Object.keys(majNoms).length > 0) {
            let { error } = await supabaseClient.from("profils").update(majNoms).eq("user_id", utilisateur.id);
            if (error) console.warn("Profil Google : noms non enregistrés :", error.message);
        }

        // Séparément : cette colonne est unique, un conflit ne doit pas empêcher d'enregistrer les noms
        if (!profil.email_personnel && utilisateur.email) {
            let { error } = await supabaseClient.from("profils").update({ email_personnel: utilisateur.email }).eq("user_id", utilisateur.id);
            if (error) console.warn("Profil Google : adresse personnelle non enregistrée :", error.message);
        }
    };

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
    let fermerModaleAuth = null;      // creees par construireModaleAuth()
    let boutonGoogleAuth = null;
    let erreurGoogleAuth = null;



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

    // Rendue accessible aux autres scripts (les boutons "Se connecter pour accéder" des cartes)
    window.ouvrirModaleAuth = ouvrirModaleAuth;

    let fermerLaModaleAuth = () => {
        voileAuth.classList.remove("visible");
        modaleAuth.classList.remove("visible");
    };

    let attacherBoutonAuth = () => {
        let boutonAuth = document.querySelector("#boutonAuth");
        if (boutonAuth) boutonAuth.addEventListener("click", ouvrirModaleAuth);
    };

    attacherBoutonAuth();
    if (voileAuth) voileAuth.addEventListener("click", fermerLaModaleAuth);

    if (boutonConnexionDepuisPanneau) {
        boutonConnexionDepuisPanneau.addEventListener("click", () => {
            fermerLePanneauMatieres();
            ouvrirModaleAuth();
        });
    }

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

    // ---------- Recherche de cours dans la nav ----------
    let champRecherche = document.querySelector("#rechercheCours");
    let resultatsRecherche = document.querySelector("#resultatsRecherche");

    if (champRecherche && resultatsRecherche) {
        let delaiRecherche = null;

        champRecherche.addEventListener("input", () => {
            clearTimeout(delaiRecherche);
            let terme = champRecherche.value.trim();

            if (!terme) {
                resultatsRecherche.classList.remove("visible");
                return;
            }

            delaiRecherche = setTimeout(() => lancerRecherche(terme), 300);
        });

        document.addEventListener("click", (e) => {
            if (!e.target.closest(".item-recherche")) {
                resultatsRecherche.classList.remove("visible");
            }
        });
    }

    let lancerRecherche = async (terme) => {
        // La recherche est ouverte à tout le monde (visiteurs inclus) : elle passe par la vue
        // "catalogue_public" qui n'expose que le titre de la ressource et sa matière.
        let { data: resultats, error } = await supabaseClient
            .from("catalogue_public")
            .select("id, titre, matiere_nom, matiere_slug")
            .ilike("titre", `%${terme}%`)
            .limit(8);

        resultatsRecherche.innerHTML = "";

        if (error || !resultats || resultats.length === 0) {
            if (error) console.error(error);
            let message = document.createElement("p");
            message.className = "message-recherche";
            message.textContent = error
                ? "La recherche est momentanément indisponible."
                : `Aucun résultat pour "${terme}".`;
            resultatsRecherche.appendChild(message);
            resultatsRecherche.classList.add("visible");
            return;
        }

        resultats.forEach(r => {
            let lien = document.createElement("a");
            lien.href = `${r.matiere_slug}.html`;

            let contenu = document.createElement("span");
            contenu.className = "contenu-resultat";

            let titreEl = document.createElement("span");
            titreEl.textContent = r.titre;

            let matiereEl = document.createElement("span");
            matiereEl.className = "matiere-resultat";
            matiereEl.textContent = r.matiere_nom;

            contenu.append(titreEl, matiereEl);
            lien.appendChild(contenu);
            resultatsRecherche.appendChild(lien);
        });

        resultatsRecherche.classList.add("visible");
    };


    // ---------- Mettre à jour l'interface selon l'état de connexion ----------
    let afficherEtatConnecte = async (utilisateur) => {
        completerProfilGoogle(utilisateur); // sans attendre : n'a aucun effet pour un compte classique

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
            let nom = nomDe(utilisateur) || utilisateur.email;

            zoneAuthNav.innerHTML = `${lienAdmin}<a href="profil.html" class="lien-menu-bouton" id="lienProfil"><i class="fa-solid fa-user"></i></a><button id="boutonDeconnexion" class="lien-menu-bouton" title="Se déconnecter"><i class="fa-solid fa-right-from-bracket"></i></button>`;
            // Le nom est ajouté via textContent (jamais innerHTML) pour empêcher
            // qu'un nom contenant du code HTML/JS ne s'exécute dans la page
            document.querySelector("#lienProfil").append(nom);

            document.querySelector("#boutonDeconnexion").addEventListener("click", async (e) => {
                e.preventDefault();
                await supabaseClient.auth.signOut();
                window.location.href = "index.html";
            });
        }

        // ---------- Message de bienvenue après confirmation d'email ----------
        // On ne l'affiche qu'une seule fois, juste après le clic sur le lien reçu par mail

        // ---------- Signaler sa présence en temps réel (pour l'admin) ----------
        // Un seul canal de présence pour tout le site : quiconque le rejoint apparaît
        // "en ligne" pour l'admin, et disparaît automatiquement en fermant l'onglet
        if (!admin) {
            let nomAffiche = nomDe(utilisateur) || utilisateur.email;
            let canalPresence = supabaseClient.channel("presence-etudiants", {
                config: {
                    private: true,
                    presence: { key: utilisateur.id }
                }
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
        // Les matières sont visibles par tout le monde ; seule la lecture / le téléchargement demande une connexion
        if (matieresVerrouillees) matieresVerrouillees.style.display = "none";
        if (listeMatieres) listeMatieres.style.display = "block";

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

    // ---------- Connexion avec Google (la seule façon de se connecter) ----------
    // Le compte est créé automatiquement à la première connexion : plus de formulaire d'inscription,
    // plus de mot de passe, plus d'adresse institutionnelle à générer.
    let connecterAvecGoogle = async () => {
        if (!boutonGoogleAuth) return;
        let contenuOriginal = Array.from(boutonGoogleAuth.childNodes);
        erreurGoogleAuth.textContent = "";
        boutonGoogleAuth.disabled = true;
        let icone = document.createElement("i");
        icone.className = "fa-solid fa-spinner fa-spin";
        boutonGoogleAuth.replaceChildren(icone, "Redirection vers Google...");

        let { error } = await supabaseClient.auth.signInWithOAuth({
            provider: "google",
            options: {
                // On revient sur la page où l'étudiant se trouvait
                redirectTo: window.location.origin + window.location.pathname,
                // Laisse choisir le compte Google (utile sur un appareil partagé)
                queryParams: { prompt: "select_account" }
            }
        });

        if (error) {
            console.error(error);
            boutonGoogleAuth.disabled = false;
            boutonGoogleAuth.replaceChildren(...contenuOriginal);
            erreurGoogleAuth.textContent = "Connexion avec Google impossible pour le moment. Réessaie dans un instant.";
        }
    };

    // ---------- Contenu de la fenêtre de connexion ----------
    // Construit ici : même si une page HTML contient encore l'ancien formulaire (e-mail, mot de passe,
    // inscription), il est remplacé par le seul bouton "Continuer avec Google".
    let construireModaleAuth = () => {
        if (!modaleAuth) return;

        let creer = (balise, classe, texte) => {
            let element = document.createElement(balise);
            if (classe) element.className = classe;
            if (texte) element.textContent = texte;
            return element;
        };

        fermerModaleAuth = creer("button", "bouton-fermer");
        fermerModaleAuth.id = "fermerModaleAuth";
        fermerModaleAuth.type = "button";
        fermerModaleAuth.setAttribute("aria-label", "Fermer");
        let iconeFermer = document.createElement("i");
        iconeFermer.className = "fa-solid fa-xmark";
        fermerModaleAuth.appendChild(iconeFermer);

        let titre = creer("h3", "titre-connexion", "Connecte-toi à GL HUB");
        titre.id = "titreModaleAuth";
        let introduction = creer("p", "texte-connexion",
            "Un seul clic avec ton compte Google : pas de formulaire à remplir, pas de mot de passe à retenir.");

        boutonGoogleAuth = creer("button", "bouton-google");
        boutonGoogleAuth.id = "boutonGoogleConnexion";
        boutonGoogleAuth.type = "button";
        let iconeGoogle = document.createElement("i");
        iconeGoogle.className = "fa-brands fa-google";
        boutonGoogleAuth.append(iconeGoogle, "Continuer avec Google");
        boutonGoogleAuth.addEventListener("click", connecterAvecGoogle);

        erreurGoogleAuth = creer("p", "message-erreur");
        erreurGoogleAuth.setAttribute("role", "alert");

        let aideNavigateur = creer("p", "aide-connexion",
            "Si Google refuse la connexion (par exemple depuis le navigateur intégré d'une application), ouvre GL HUB dans Chrome ou Safari.");
        let aideDonnees = creer("p", "aide-connexion",
            "GL HUB utilise seulement ton nom et ton adresse e-mail Google pour créer ton profil. Rien n'est publié sur ton compte.");

        modaleAuth.replaceChildren(fermerModaleAuth, titre, introduction, boutonGoogleAuth, erreurGoogleAuth, aideNavigateur, aideDonnees);
        modaleAuth.setAttribute("role", "dialog");
        modaleAuth.setAttribute("aria-modal", "true");
        modaleAuth.setAttribute("aria-labelledby", "titreModaleAuth");
    };

    construireModaleAuth();
    if (fermerModaleAuth) fermerModaleAuth.addEventListener("click", fermerLaModaleAuth);
});