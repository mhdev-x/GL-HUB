document.addEventListener("DOMContentLoaded", async () => {

    let { data: sessionData } = await supabaseClient.auth.getSession();
    let utilisateur = sessionData.session ? sessionData.session.user : null;
    if (!utilisateur) return; // la garde d'accès en haut de page s'en occupe déjà normalement

    let champNom = document.querySelector("#champNom");
    let erreurNom = document.querySelector("#erreurNom");
    let boutonEnregistrerNom = document.querySelector("#boutonEnregistrerNom");

    let champNouveauMdp = document.querySelector("#champNouveauMdp");
    let champConfirmationMdp = document.querySelector("#champConfirmationMdp");
    let erreurMdp = document.querySelector("#erreurMdp");
    let boutonChangerMdp = document.querySelector("#boutonChangerMdp");

    let listeMesRessources = document.querySelector("#listeMesRessources");
    let boutonSupprimerCompte = document.querySelector("#boutonSupprimerCompte");

    // ---------- Pré-remplir le nom actuel ----------
    champNom.value = (utilisateur.user_metadata && utilisateur.user_metadata.nom) || "";

    // ---------- Un admin ne voit jamais l'option de suppression de compte ----------
    let { data: adminData } = await supabaseClient
        .from("admins")
        .select("user_id")
        .eq("user_id", utilisateur.id)
        .maybeSingle();

    if (adminData) {
        let zoneDanger = document.querySelector("#boutonSupprimerCompte").closest("section");
        let titreZoneDanger = zoneDanger.previousElementSibling; // le <h2> juste avant
        zoneDanger.remove();
        if (titreZoneDanger && titreZoneDanger.classList.contains("section-title")) {
            titreZoneDanger.remove();
        }
    }

    // ---------- Afficher l'adresse de connexion actuelle (copiable) ----------
    let champEmailInstitutionnel = document.querySelector("#champEmailInstitutionnel");
    let boutonCopierEmail = document.querySelector("#boutonCopierEmail");
    champEmailInstitutionnel.value = utilisateur.email || "";

    boutonCopierEmail.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(utilisateur.email || "");
            afficherToast("Adresse copiée dans le presse-papiers.");
        } catch (_) {
            champEmailInstitutionnel.select();
        }
    });

    // ---------- Enregistrer le nouveau nom ----------
    boutonEnregistrerNom.addEventListener("click", async () => {
        let nouveauNom = champNom.value.trim();
        if (!nouveauNom) {
            erreurNom.textContent = "Le nom ne peut pas être vide.";
            return;
        }

        erreurNom.textContent = "";
        boutonEnregistrerNom.disabled = true;
        boutonEnregistrerNom.textContent = "Enregistrement...";

        // On met à jour les deux endroits où le nom est stocké :
        // les metadata Supabase Auth, ET la table "profils" (utilisée par l'admin)
        let { error: erreurAuth } = await supabaseClient.auth.updateUser({ data: { nom: nouveauNom } });
        let { error: erreurProfil } = await supabaseClient.from("profils").update({ nom: nouveauNom }).eq("user_id", utilisateur.id);

        boutonEnregistrerNom.disabled = false;
        boutonEnregistrerNom.textContent = "Enregistrer les modifications";

        if (erreurAuth || erreurProfil) {
            erreurNom.textContent = "Une erreur est survenue. Réessaie.";
            return;
        }

        afficherToast("Nom mis à jour avec succès.");
    });

    // ---------- Changer le mot de passe ----------
    boutonChangerMdp.addEventListener("click", async () => {
        let nouveauMdp = champNouveauMdp.value.trim();
        let confirmation = champConfirmationMdp.value.trim();

        if (!nouveauMdp || !confirmation) {
            erreurMdp.textContent = "Merci de remplir les deux champs.";
            return;
        }
        if (nouveauMdp.length < 6) {
            erreurMdp.textContent = "Le mot de passe doit contenir au moins 6 caractères.";
            return;
        }
        if (nouveauMdp !== confirmation) {
            erreurMdp.textContent = "Les deux mots de passe ne correspondent pas.";
            return;
        }

        erreurMdp.textContent = "";
        boutonChangerMdp.disabled = true;
        boutonChangerMdp.textContent = "Changement en cours...";

        let { error } = await supabaseClient.auth.updateUser({ password: nouveauMdp });

        boutonChangerMdp.disabled = false;
        boutonChangerMdp.textContent = "Changer le mot de passe";

        if (error) {
            erreurMdp.textContent = "Une erreur est survenue. Réessaie.";
            return;
        }

        champNouveauMdp.value = "";
        champConfirmationMdp.value = "";
        afficherToast("Mot de passe changé avec succès.");
    });

    // ---------- Charger la liste des ressources téléchargées ----------
    let chargerMesRessources = async () => {
        let { data: paiements, error } = await supabaseClient
            .from("paiements")
            .select("montant, valide_le, ressources ( titre )")
            .eq("user_id", utilisateur.id)
            .eq("statut", "valide")
            .order("valide_le", { ascending: false });

        if (error) {
            listeMesRessources.innerHTML = `<p class="message-chargement">Erreur de chargement.</p>`;
            return;
        }

        if (!paiements || paiements.length === 0) {
            listeMesRessources.innerHTML = `<p class="message-chargement">Tu n'as encore débloqué aucune ressource.</p>`;
            return;
        }

        listeMesRessources.innerHTML = "";
        paiements.forEach(p => {
            let carte = document.createElement("div");
            carte.className = "carte-ressource-perso";

            let titre = document.createElement("strong");
            titre.textContent = (p.ressources && p.ressources.titre) || "Ressource supprimée";

            let details = document.createElement("p");
            let date = p.valide_le ? new Date(p.valide_le).toLocaleDateString("fr-FR") : "";
            details.textContent = `${p.montant} FCFA — débloqué le ${date}`;

            carte.append(titre, details);
            listeMesRessources.appendChild(carte);
        });
    };

    chargerMesRessources();

    // ---------- Supprimer son compte ----------
    boutonSupprimerCompte.addEventListener("click", () => {
        let voile = document.createElement("div");
        voile.className = "voile visible";

        let modale = document.createElement("div");
        modale.className = "modale visible modale-paiement";
        modale.innerHTML = `
            <button class="bouton-fermer" aria-label="Fermer">✕</button>
            <h3><i class="fa-solid fa-triangle-exclamation" style="color:#dc2626;"></i> Confirmer la suppression</h3>
            <p class="instructions-paiement">
                Cette action est <strong>définitive</strong>. Ton compte, ton profil et ton historique de paiements
                seront supprimés pour toujours. Es-tu sûr de vouloir continuer ?
            </p>
            <button class="bouton-danger bouton-pleine-largeur" id="boutonConfirmerSuppression">Oui, supprimer définitivement</button>
            <p class="message-erreur" id="erreurSuppression"></p>
        `;

        document.body.appendChild(voile);
        document.body.appendChild(modale);

        let fermer = () => { voile.remove(); modale.remove(); };
        modale.querySelector(".bouton-fermer").addEventListener("click", fermer);
        voile.addEventListener("click", fermer);

        modale.querySelector("#boutonConfirmerSuppression").addEventListener("click", async (e) => {
            e.target.disabled = true;
            e.target.textContent = "Suppression en cours...";

            let { data, error } = await supabaseClient.functions.invoke("supprimer-mon-compte");

            if (error || !data || !data.succes) {
                document.querySelector("#erreurSuppression").textContent = "Une erreur est survenue. Contacte-nous sur WhatsApp.";
                e.target.disabled = false;
                e.target.textContent = "Oui, supprimer définitivement";
                return;
            }

            await supabaseClient.auth.signOut();
            window.location.href = "index.html";
        });
    });
});