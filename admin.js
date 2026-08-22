document.addEventListener("DOMContentLoaded", async () => {

    let listeEnAttente = document.querySelector("#listeEnAttente");
    let listeHistorique = document.querySelector("#listeHistorique");
    let statEnAttente = document.querySelector("#statEnAttente");
    let statValides = document.querySelector("#statValides");
    let statRevenus = document.querySelector("#statRevenus");
    let boutonDeconnexionAdmin = document.querySelector("#boutonDeconnexionAdmin");

    boutonDeconnexionAdmin.addEventListener("click", async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
    });

    // ---------- Formater une carte de paiement ----------
    let creerCartePaiement = (paiement, avecActions) => {
        let nomEtudiant = (paiement.profils && paiement.profils.nom) || (paiement.profils && paiement.profils.email) || "Étudiant inconnu";
        let titreRessource = (paiement.ressources && paiement.ressources.titre) || "Ressource supprimée";
        let dateFormatee = new Date(paiement.cree_le).toLocaleDateString("fr-FR", {
            day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
        });

        let carte = document.createElement("div");
        carte.className = "carte-paiement";

        let badgeOuActions = "";
        if (avecActions) {
            badgeOuActions = `
                <div class="actions-paiement">
                    <button class="bouton-valider" data-id="${paiement.id}">
                        <i class="fa-solid fa-check"></i>Valider
                    </button>
                    <button class="bouton-refuser" data-id="${paiement.id}">
                        <i class="fa-solid fa-xmark"></i>Refuser
                    </button>
                </div>`;
        } else {
            let classeBadge = paiement.statut === "valide" ? "badge-valide" : "badge-echoue";
            let texteBadge = paiement.statut === "valide" ? "Validé" : "Refusé";
            badgeOuActions = `<span class="badge-statut ${classeBadge}">${texteBadge}</span>`;
        }

        carte.innerHTML = `
            <div class="infos-paiement">
                <h4>${nomEtudiant}</h4>
                <p>${titreRessource}</p>
                <p><span class="montant">${paiement.montant} FCFA</span> — ${dateFormatee}</p>
            </div>
            ${badgeOuActions}
        `;

        return carte;
    };

    // ---------- Charger tous les paiements ----------
    let chargerPaiements = async () => {
        let { data: paiements, error } = await supabaseClient
            .from("paiements")
            .select(`
                id, user_id, statut, montant, cree_le,
                ressources ( titre )
            `)
            .order("cree_le", { ascending: false });

        if (error) {
            listeEnAttente.innerHTML = `<p class="message-chargement">Erreur de chargement : ${error.message}</p>`;
            return;
        }

        // Récupérer les profils correspondants séparément (pas de relation directe en base)
        let idsUtilisateurs = [...new Set(paiements.map(p => p.user_id))];
        let { data: profils } = await supabaseClient
            .from("profils")
            .select("user_id, nom, email")
            .in("user_id", idsUtilisateurs);

        let profilParUserId = {};
        (profils || []).forEach(p => { profilParUserId[p.user_id] = p; });

        // On rattache chaque paiement à son profil
        paiements.forEach(p => { p.profils = profilParUserId[p.user_id] || null; });

        let enAttente = paiements.filter(p => p.statut === "en_attente");
        let historique = paiements.filter(p => p.statut !== "en_attente");
        let valides = paiements.filter(p => p.statut === "valide");

        // Statistiques
        statEnAttente.textContent = enAttente.length;
        statValides.textContent = valides.length;
        statRevenus.textContent = valides.reduce((total, p) => total + p.montant, 0);

        // Liste "en attente"
        listeEnAttente.innerHTML = "";
        if (enAttente.length === 0) {
            listeEnAttente.innerHTML = `<p class="message-chargement">Aucune demande en attente pour le moment.</p>`;
        } else {
            enAttente.forEach(p => listeEnAttente.appendChild(creerCartePaiement(p, true)));
        }

        // Liste "historique"
        listeHistorique.innerHTML = "";
        if (historique.length === 0) {
            listeHistorique.innerHTML = `<p class="message-chargement">Aucun historique pour le moment.</p>`;
        } else {
            historique.forEach(p => listeHistorique.appendChild(creerCartePaiement(p, false)));
        }

        // Attacher les actions Valider / Refuser
        document.querySelectorAll(".bouton-valider").forEach(bouton => {
            bouton.addEventListener("click", () => mettreAJourStatut(bouton.dataset.id, "valide"));
        });
        document.querySelectorAll(".bouton-refuser").forEach(bouton => {
            bouton.addEventListener("click", () => mettreAJourStatut(bouton.dataset.id, "echoue"));
        });
    };

    // ---------- Valider ou refuser un paiement ----------
    let mettreAJourStatut = async (idPaiement, nouveauStatut) => {
        let { error } = await supabaseClient
            .from("paiements")
            .update({ statut: nouveauStatut, valide_le: new Date().toISOString() })
            .eq("id", idPaiement);

        if (error) {
            alert("Erreur lors de la mise à jour : " + error.message);
            return;
        }

        chargerPaiements();
    };

    chargerPaiements();
});