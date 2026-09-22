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

    // On note tout de suite si l'URL indique une confirmation d'email qui vient
    // d'avoir lieu (avant que Supabase ne nettoie l'URL automatiquement)
    let vientDeConfirmerSonEmail = window.location.hash.includes("type=signup");
    let vientDeReinitialiserSonMdp = window.location.hash.includes("type=recovery");

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
            message = "Impossible de créer ton compte avec cette adresse Google : un compte GL HUB existe peut-être déjà avec cette adresse. Connecte-toi avec ton adresse institutionnelle (@gl.com), ou contacte l'administrateur.";
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

    // ---------- Mot de passe oublié ----------
    let lienMotDePasseOublie = document.querySelector("#lienMotDePasseOublie");
    if (lienMotDePasseOublie) {
        lienMotDePasseOublie.addEventListener("click", (e) => {
            e.preventDefault();
            erreurConnexion.innerHTML = "";
            let message = document.createElement("span");
            message.textContent = "Une adresse @gl.com ne peut pas recevoir d'email. Contacte l'administrateur sur WhatsApp avec ton nom complet pour réinitialiser ton mot de passe : ";
            let lienWhatsapp = document.createElement("a");
            lienWhatsapp.href = "https://wa.me/221771216386";
            lienWhatsapp.target = "_blank";
            lienWhatsapp.textContent = "Ouvrir WhatsApp";
            lienWhatsapp.style.color = "var(--color-accent)";
            lienWhatsapp.style.fontWeight = "700";
            erreurConnexion.append(message, lienWhatsapp);
        });
    }

    // ---------- Traiter le retour après clic sur le lien de réinitialisation ----------
    if (vientDeReinitialiserSonMdp) {
        let voile = document.createElement("div");
        voile.className = "voile visible";

        let modale = document.createElement("div");
        modale.className = "modale visible";
        modale.innerHTML = `
            <h3 style="margin-bottom:20px;color:var(--color-text);"><i class="fa-solid fa-key"></i> Choisis un nouveau mot de passe</h3>
            <div class="formulaire-auth">
                <label for="nouveauMdpRecuperation">Nouveau mot de passe</label>
                <input type="password" id="nouveauMdpRecuperation" placeholder="6 caractères minimum">
                <p id="erreurRecuperation" class="message-erreur"></p>
                <button id="boutonValiderRecuperation" class="bouton-accent bouton-pleine-largeur">Valider le nouveau mot de passe</button>
            </div>
        `;

        document.body.appendChild(voile);
        document.body.appendChild(modale);

        modale.querySelector("#boutonValiderRecuperation").addEventListener("click", async (e) => {
            let nouveauMdp = modale.querySelector("#nouveauMdpRecuperation").value.trim();
            let erreurRecup = modale.querySelector("#erreurRecuperation");

            if (nouveauMdp.length < 6) {
                erreurRecup.textContent = "Le mot de passe doit contenir au moins 6 caractères.";
                return;
            }

            e.target.disabled = true;
            e.target.textContent = "Validation...";

            let { error } = await supabaseClient.auth.updateUser({ password: nouveauMdp });

            if (error) {
                erreurRecup.textContent = "Une erreur est survenue. Réessaie.";
                e.target.disabled = false;
                e.target.textContent = "Valider le nouveau mot de passe";
                return;
            }

            voile.remove();
            modale.remove();
            window.history.replaceState({}, document.title, window.location.pathname);
            afficherToast("Mot de passe changé avec succès !");
        });
    }

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
        if (vientDeConfirmerSonEmail) {
            vientDeConfirmerSonEmail = false; // évite de le réafficher si la fonction est rappelée
            let nomBienvenue = nomDe(utilisateur);
            afficherToast(`Email confirmé ! Bienvenue sur GL HUB${nomBienvenue ? ", " + nomBienvenue : ""}.`);
            // On nettoie l'adresse au cas où Supabase ne l'aurait pas déjà fait
            window.history.replaceState({}, document.title, window.location.pathname);
        }

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

        // Si c'est un compte admin, on le redirige directement vers l'interface admin
        // (uniquement au moment de la connexion, pas à chaque page visitée ensuite)
        let { data: adminConnecte } = await supabaseClient
            .from("admins")
            .select("user_id")
            .eq("user_id", data.user.id)
            .maybeSingle();

        if (adminConnecte && !window.location.pathname.endsWith("admin.html")) {
            window.location.href = "admin.html";
        }
    });

    // ---------- Inscription ----------
    boutonValiderInscription.addEventListener("click", async () => {
        let prenom = document.querySelector("#prenomInscription").value.trim();
        let nomFamille = document.querySelector("#nomInscription").value.trim();
        let dateNaissance = document.querySelector("#dateNaissanceInscription").value;
        let email = document.querySelector("#emailInscription").value.trim();
        let motDePasse = document.querySelector("#motDePasseInscription").value.trim();

        if (!prenom || !nomFamille || !dateNaissance || !email || !motDePasse) {
            erreurInscription.textContent = "Merci de remplir tous les champs.";
            return;
        }

        if (motDePasse.length < 6) {
            erreurInscription.textContent = "Le mot de passe doit contenir au moins 6 caractères.";
            return;
        }

        erreurInscription.textContent = "Vérification de l'email...";
        boutonValiderInscription.disabled = true;

        let { data: verification } = await supabaseClient.functions.invoke("verifier-email-disponible", {
            body: { email: email }
        });

        if (verification && verification.disponible === false) {
            erreurInscription.textContent = "Cet email a déjà été utilisé pour créer un compte. Connecte-toi avec ton adresse institutionnelle (@gl.com), ou contacte l'administrateur si tu l'as oubliée.";
            boutonValiderInscription.disabled = false;
            return;
        }

        erreurInscription.textContent = "Création du compte...";

        let { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: motDePasse,
            options: {
                data: {
                    prenom: prenom,
                    nom_famille: nomFamille,
                    nom: `${prenom} ${nomFamille}`, // nom complet composé, utilisé pour l'affichage
                    date_naissance: dateNaissance
                },
                // On force explicitement la bonne adresse de redirection ici,
                // plutôt que de dépendre uniquement du réglage "Site URL" sur
                // le dashboard Supabase — ça garantit que le lien de
                // confirmation pointe toujours vers la bonne page, peu importe
                // depuis quelle page du site l'étudiant s'est inscrit.
                emailRedirectTo: window.location.origin + window.location.pathname
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

    // ---------- Connexion / inscription avec Google ----------
    // (le compte est créé automatiquement à la première connexion)
    let connecterAvecGoogle = async (bouton) => {
        let contenuOriginal = Array.from(bouton.childNodes);
        bouton.disabled = true;
        let icone = document.createElement("i");
        icone.className = "fa-solid fa-spinner fa-spin";
        bouton.replaceChildren(icone, "Redirection vers Google...");

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
            bouton.disabled = false;
            bouton.replaceChildren(...contenuOriginal);
            afficherToast("Connexion avec Google impossible pour le moment. Réessaie plus tard.", "fa-solid fa-triangle-exclamation");
        }
    };

    // Le séparateur "ou" et le bouton Google sont ajoutés ici, sous les boutons "Se connecter" et
    // "Créer mon compte" : aucune modification des pages HTML n'est nécessaire.
    let ajouterBoutonGoogle = (boutonDeReference, id) => {
        if (!boutonDeReference || document.getElementById(id)) return;

        let separateur = document.createElement("div");
        separateur.className = "separateur-auth";
        let ou = document.createElement("span");
        ou.textContent = "ou";
        separateur.appendChild(ou);

        let boutonGoogle = document.createElement("button");
        boutonGoogle.type = "button";
        boutonGoogle.className = "bouton-google";
        boutonGoogle.id = id;
        let iconeGoogle = document.createElement("i");
        iconeGoogle.className = "fa-brands fa-google";
        boutonGoogle.append(iconeGoogle, "Continuer avec Google");
        boutonGoogle.addEventListener("click", () => connecterAvecGoogle(boutonGoogle));

        boutonDeReference.after(separateur, boutonGoogle);
    };

    ajouterBoutonGoogle(boutonValiderConnexion, "boutonGoogleConnexion");
    ajouterBoutonGoogle(boutonValiderInscription, "boutonGoogleInscription");

    // ---------- Générer l'adresse institutionnelle après confirmation d'email ----------
    let genererAdresseInstitutionnelleSiBesoin = async () => {
        let { data } = await supabaseClient.functions.invoke("generer-email-institutionnel");

        if (!data || !data.email_institutionnel || data.deja_genere) {
            return; // déjà fait, ou échec silencieux (l'étudiant garde son email personnel en secours)
        }

        afficherModaleAdresseInstitutionnelle(data.email_institutionnel);
    };

    let afficherModaleAdresseInstitutionnelle = (adresse) => {
        let voile = document.createElement("div");
        voile.className = "voile visible";

        let modale = document.createElement("div");
        modale.className = "modale visible";
        modale.innerHTML = `
            <h3 style="margin-bottom:16px;color:var(--color-text);"><i class="fa-solid fa-graduation-cap"></i> Ton adresse institutionnelle</h3>
            <p style="color:var(--color-text-secondary);margin-bottom:16px;">
                Voici ton adresse GL HUB officielle, générée définitivement pour ton compte.
            </p>
            <p class="prix-a-payer" id="texteAdresseInstitutionnelle" style="font-size:1.3rem;word-break:break-all;">${adresse}</p>
            <button class="bouton-accent bouton-pleine-largeur" id="boutonCopierAdresse" style="margin-bottom:10px;">
                <i class="fa-solid fa-copy"></i> Copier l'adresse
            </button>
            <div style="background:#fff3cd;border:1px solid #ffe08a;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
                <p style="color:#7a5c00;font-weight:700;font-size:0.9rem;margin-bottom:4px;">
                    <i class="fa-solid fa-triangle-exclamation"></i> Important — garde-la précieusement
                </p>
                <p style="color:#7a5c00;font-size:0.85rem;line-height:1.5;">
                    C'est désormais ta SEULE adresse de connexion à GL HUB, avec le même mot de passe qu'à
                    l'inscription. Ton email personnel ne fonctionnera plus. Cette adresse ne peut recevoir aucun
                    email — si tu l'oublies, seul l'administrateur pourra te la redonner (contact WhatsApp).
                </p>
            </div>
            <button class="bouton-accent bouton-pleine-largeur" id="boutonJaiNoteAdresse">J'ai bien noté et sauvegardé mon adresse</button>
        `;

        document.body.appendChild(voile);
        document.body.appendChild(modale);

        modale.querySelector("#boutonCopierAdresse").addEventListener("click", async (e) => {
            try {
                await navigator.clipboard.writeText(adresse);
                let texteOriginal = e.target.innerHTML;
                e.target.innerHTML = `<i class="fa-solid fa-check"></i> Copié !`;
                setTimeout(() => { e.target.innerHTML = texteOriginal; }, 2000);
            } catch (_) {
                // Le presse-papier peut être indisponible sur certains navigateurs : pas grave,
                // l'adresse reste visible et sélectionnable à la main.
            }
        });

        modale.querySelector("#boutonJaiNoteAdresse").addEventListener("click", () => {
            voile.remove();
            modale.remove();
        });
    };

    if (vientDeConfirmerSonEmail) {
        genererAdresseInstitutionnelleSiBesoin();
    }
});