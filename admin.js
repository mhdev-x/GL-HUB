document.addEventListener("DOMContentLoaded", async () => {

    let listeEnAttente = document.querySelector("#listeEnAttente");
    let listeHistorique = document.querySelector("#listeHistorique");
    let listeEnLigne = document.querySelector("#listeEnLigne");
    let listeEtudiants = document.querySelector("#listeEtudiants");
    let statEnAttente = document.querySelector("#statEnAttente");
    let statValides = document.querySelector("#statValides");
    let statRevenus = document.querySelector("#statRevenus");
    let boutonDeconnexionAdmin = document.querySelector("#boutonDeconnexionAdmin");

    boutonDeconnexionAdmin.addEventListener("click", async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
    });

    // ---------- Qui est en ligne maintenant (temps réel) ----------
    let canalPresence = supabaseClient.channel("presence-etudiants", {
        config: { private: true }
    });

    let afficherEtudiantsEnLigne = () => {
        let etat = canalPresence.presenceState();
        let etudiantsConnectes = Object.values(etat).flat();

        listeEnLigne.innerHTML = "";

        if (etudiantsConnectes.length === 0) {
            listeEnLigne.innerHTML = `<p class="message-chargement">Aucun étudiant en ligne pour le moment.</p>`;
            return;
        }

        etudiantsConnectes.forEach(etudiant => {
            let carte = document.createElement("div");
            carte.className = "carte-etudiant carte-en-ligne";

            let puce = document.createElement("span");
            puce.className = "puce-en-ligne";

            let infos = document.createElement("div");
            let nomEl = document.createElement("strong");
            nomEl.textContent = etudiant.nom || "Étudiant";
            let pageEl = document.createElement("p");
            pageEl.textContent = etudiant.page || "";

            infos.append(nomEl, pageEl);
            carte.append(puce, infos);
            listeEnLigne.appendChild(carte);
        });
    };

    canalPresence
        .on("presence", { event: "sync" }, afficherEtudiantsEnLigne)
        .subscribe();

    // ---------- Formater une carte de paiement ----------
    let creerCartePaiement = (paiement, avecActions) => {
        let nomEtudiant = (paiement.profils && paiement.profils.nom) || (paiement.profils && paiement.profils.email) || "Étudiant inconnu";
        let titreRessource = (paiement.ressources && paiement.ressources.titre) || "Ressource supprimée";
        let dateFormatee = new Date(paiement.cree_le).toLocaleDateString("fr-FR", {
            day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"

        });

        let carte = document.createElement("div");
        carte.className = "carte-paiement";

        // ---------- Bloc infos : construit avec textContent (jamais innerHTML) ----------
        // pour empêcher qu'un nom d'étudiant contenant du code HTML/JS ne s'exécute
        let blocInfos = document.createElement("div");
        blocInfos.className = "infos-paiement";

        let titreEtudiant = document.createElement("h4");
        titreEtudiant.textContent = nomEtudiant;

        let ligneRessource = document.createElement("p");
        ligneRessource.textContent = titreRessource;

        let ligneMontant = document.createElement("p");
        let spanMontant = document.createElement("span");
        spanMontant.className = "montant";
        spanMontant.textContent = `${paiement.montant} FCFA`;
        ligneMontant.appendChild(spanMontant);
        ligneMontant.append(` — ${dateFormatee}`);

        blocInfos.append(titreEtudiant, ligneRessource, ligneMontant);

        // ---------- Bloc badge/actions : pas de données utilisateur ici, innerHTML sans risque ----------
        let blocDroite = document.createElement("div");
        if (avecActions) {
            blocDroite.innerHTML = `
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
            blocDroite.innerHTML = `<span class="badge-statut ${classeBadge}">${texteBadge}</span>`;
        }

        carte.append(blocInfos, ...blocDroite.children);
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

    // ---------- Charger la liste complète des étudiants inscrits ----------
    let chargerEtudiants = async () => {
        let { data: profils, error } = await supabaseClient
            .from("profils")
            .select("user_id, nom, email, cree_le")
            .order("cree_le", { ascending: false });

        if (error) {
            listeEtudiants.innerHTML = `<p class="message-chargement">Erreur de chargement : ${error.message}</p>`;
            return;
        }

        // On récupère les comptes admin pour les exclure de la liste des étudiants
        let { data: listeAdmins } = await supabaseClient.from("admins").select("user_id");
        let idsAdmins = new Set((listeAdmins || []).map(a => a.user_id));
        let profilsEtudiants = profils.filter(p => !idsAdmins.has(p.user_id));

        let { data: paiementsValides } = await supabaseClient
            .from("paiements")
            .select("user_id, montant")
            .eq("statut", "valide");

        let totalParEtudiant = {};
        (paiementsValides || []).forEach(p => {
            totalParEtudiant[p.user_id] = (totalParEtudiant[p.user_id] || 0) + p.montant;
        });

        listeEtudiants.innerHTML = "";

        if (profilsEtudiants.length === 0) {
            listeEtudiants.innerHTML = `<p class="message-chargement">Aucun étudiant inscrit pour le moment.</p>`;
            return;
        }

        profilsEtudiants.forEach(etudiant => {
            let carte = document.createElement("div");
            carte.className = "carte-etudiant";

            let infos = document.createElement("div");

            let nomEl = document.createElement("strong");
            nomEl.textContent = etudiant.nom || "Nom non renseigné";

            let emailEl = document.createElement("p");
            emailEl.textContent = etudiant.email || "";

            let dateEl = document.createElement("p");
            let dateFormatee = new Date(etudiant.cree_le).toLocaleDateString("fr-FR", {
                day: "2-digit", month: "2-digit", year: "numeric"
            });
            dateEl.textContent = `Inscrit le ${dateFormatee}`;

            infos.append(nomEl, emailEl, dateEl);

            let total = document.createElement("span");
            total.className = "montant-total-etudiant";
            total.textContent = `${totalParEtudiant[etudiant.user_id] || 0} FCFA dépensés`;

            carte.append(infos, total);
            listeEtudiants.appendChild(carte);
        });
    };

    chargerEtudiants();
    chargerPaiements();
});