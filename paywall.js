document.addEventListener("DOMContentLoaded", async () => {

    let slugMatiere = document.body.dataset.matiere;
    if (!slugMatiere) return;

    // ---------- Récupérer l'utilisateur connecté ----------
    let { data: sessionData } = await supabaseClient.auth.getSession();
    let utilisateur = sessionData.session ? sessionData.session.user : null;
    if (!utilisateur) return;

    // ---------- Vérifier si l'utilisateur est admin ----------
    let { data: adminData } = await supabaseClient
        .from("admins")
        .select("user_id")
        .eq("user_id", utilisateur.id)
        .maybeSingle();

    let estAdmin = !!adminData;

    // ---------- Récupérer la matière ----------
    let { data: matiere } = await supabaseClient
        .from("matieres")
        .select("id")
        .eq("slug", slugMatiere)
        .single();

    if (!matiere) return;

    // ---------- Récupérer toutes les ressources de cette matière ----------
    let { data: ressources } = await supabaseClient
        .from("ressources")
        .select("id, chemin_fichier, prix")
        .eq("matiere_id", matiere.id);

    if (!ressources) return;

    // ---------- Récupérer les paiements de l'étudiant pour ces ressources ----------
    let idsRessources = ressources.map(r => r.id);
    let { data: paiementsEtudiant } = await supabaseClient
        .from("paiements")
        .select("ressource_id, statut, reference_paiement")
        .eq("user_id", utilisateur.id)
        .in("ressource_id", idsRessources);

    let statutParRessource = {};
    (paiementsEtudiant || []).forEach(p => {
        if (p.statut === "en_attente" && !p.reference_paiement) return; // demande jamais aboutie, on ignore
        statutParRessource[p.ressource_id] = p.statut;
    });

    // ---------- Construire un dictionnaire chemin_fichier -> ressource ----------
    let ressourceParChemin = {};
    ressources.forEach(r => {
        ressourceParChemin[r.chemin_fichier] = r;
    });

    // ---------- Télécharger un fichier via un lien signé temporaire ----------
    let telechargerFichier = async (ressourceId, bouton) => {
        let texteOriginal = bouton.innerHTML;
        bouton.disabled = true;
        bouton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>Préparation...`;

        let { data, error } = await supabaseClient.functions.invoke("obtenir-lien-fichier", {
            body: { ressource_id: ressourceId }
        });

        bouton.disabled = false;
        bouton.innerHTML = texteOriginal;

        if (error || !data || !data.url) {
            alert("Impossible de télécharger ce fichier pour le moment. Réessaie dans un instant.");
            return;
        }

        window.open(data.url, "_blank");
    };

    // ---------- Parcourir tous les boutons de la page ----------
    let boutons = document.querySelectorAll("button.bouton-download[data-fichier]");

    boutons.forEach(bouton => {
        let chemin = bouton.dataset.fichier;
        let ressource = ressourceParChemin[chemin];

        if (!ressource) return; // ressource non trouvée en base

        // L'admin télécharge toujours directement
        if (estAdmin) {
            bouton.addEventListener("click", () => telechargerFichier(ressource.id, bouton));
            return;
        }

        let statut = statutParRessource[ressource.id];

        if (statut === "valide") {
            bouton.addEventListener("click", () => telechargerFichier(ressource.id, bouton));
            return;
        }

        if (statut === "en_attente") {
            bouton.innerHTML = `<i class="fa-solid fa-hourglass-half"></i>En attente de validation`;
            bouton.classList.add("bouton-verrouille");
            bouton.disabled = true;
            return;
        }

        // Pas encore payé : bouton verrouillé qui ouvre la modale de paiement
        bouton.innerHTML = `<i class="fa-solid fa-lock"></i>Débloquer — ${ressource.prix} FCFA`;
        bouton.classList.add("bouton-verrouille");
        bouton.addEventListener("click", () => ouvrirModalePaiement(ressource));
    });

    // ---------- Modale de paiement PayDunya ----------
    let ouvrirModalePaiement = (ressource) => {
        let voile = document.createElement("div");
        voile.className = "voile visible";

        let modale = document.createElement("div");
        modale.className = "modale visible modale-paiement";
        modale.innerHTML = `
            <button class="bouton-fermer" aria-label="Fermer">✕</button>
            <h3><i class="fa-solid fa-mobile-screen-button"></i> Débloquer cette ressource</h3>
            <p class="prix-a-payer">${ressource.prix} FCFA</p>
            <p class="instructions-paiement">
                Tu vas être redirigé vers une page sécurisée PayDunya pour payer
                avec <strong>Wave</strong> ou <strong>Orange Money</strong>.
                L'accès se débloque automatiquement une fois le paiement confirmé.
            </p>
            <button class="bouton-accent bouton-pleine-largeur" id="boutonPayer">Payer maintenant</button>
            <p class="message-erreur" id="erreurPaiement"></p>
        `;

        document.body.appendChild(voile);
        document.body.appendChild(modale);

        let fermer = () => {
            voile.remove();
            modale.remove();
        };

        modale.querySelector(".bouton-fermer").addEventListener("click", fermer);
        voile.addEventListener("click", fermer);

        modale.querySelector("#boutonPayer").addEventListener("click", async (e) => {
            e.target.disabled = true;
            e.target.textContent = "Préparation du paiement...";

            let { data, error } = await supabaseClient.functions.invoke("creer-facture", {
                body: { ressource_id: ressource.id }
            });

            if (error || !data || !data.checkout_url) {
                document.querySelector("#erreurPaiement").textContent =
                    "Une erreur est survenue. Contacte-nous sur WhatsApp si ça persiste.";
                e.target.disabled = false;
                e.target.textContent = "Payer maintenant";
                return;
            }

            window.location.href = data.checkout_url;
        });
    };
});