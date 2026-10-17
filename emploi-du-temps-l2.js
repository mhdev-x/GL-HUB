// ========================================================
// EMPLOI DU TEMPS L2
//
// Lecture : membres de la classe et admin.
// Modification : admin et responsable de la classe uniquement.
//
// Chaque séance est datée : changer ou annuler un cours en cours de semaine,
// c'est modifier sa ligne. La base marque alors la séance "Modifié" toute
// seule (changement d'horaire, de salle, d'enseignant...) ou "Annulé".
//
// La vraie protection est en base (RLS) : ici on ne fait qu'afficher les
// boutons de modification aux bonnes personnes. Tout texte affiché passe par
// textContent (jamais innerHTML).
// ========================================================
document.addEventListener("DOMContentLoaded", () => {

    let SLUG_CLASSE_L2 = "l2-gl-2026-2027";
    let COLONNES = "id, classe_id, date_seance, heure_debut, heure_fin, intitule, type_seance, enseignant, salle, note, statut, modifie_le";
    let MAX_SEMAINES_REPETITION = 30;
    let INTERVALLE_RAFRAICHISSEMENT = 60000;

    let vues = {
        chargement: document.querySelector("#vueChargement"),
        connexion: document.querySelector("#vueConnexion"),
        pasMembre: document.querySelector("#vuePasMembre"),
        erreur: document.querySelector("#vueErreur"),
        edt: document.querySelector("#vueEdt")
    };

    let messageErreurL2 = document.querySelector("#messageErreurL2");
    let titreSemaine = document.querySelector("#titreSemaine");
    let sousTitreSemaine = document.querySelector("#sousTitreSemaine");
    let boutonSemainePrecedente = document.querySelector("#boutonSemainePrecedente");
    let boutonSemaineSuivante = document.querySelector("#boutonSemaineSuivante");
    let boutonCetteSemaine = document.querySelector("#boutonCetteSemaine");
    let boutonModeEdition = document.querySelector("#boutonModeEdition");
    let boutonCopierSemaine = document.querySelector("#boutonCopierSemaine");
    let bandeauProchain = document.querySelector("#bandeauProchain");
    let resumeChangements = document.querySelector("#resumeChangements");
    let messageEdt = document.querySelector("#messageEdt");
    let grilleSemaine = document.querySelector("#grilleSemaine");
    let semaineVide = document.querySelector("#semaineVide");

    let modaleSeance = document.querySelector("#modaleSeance");
    let formSeance = document.querySelector("#formSeance");
    let titreModaleSeance = document.querySelector("#titreModaleSeance");
    let champDate = document.querySelector("#champDate");
    let champDebut = document.querySelector("#champDebut");
    let champFin = document.querySelector("#champFin");
    let champIntitule = document.querySelector("#champIntitule");
    let listeIntitules = document.querySelector("#listeIntitules");
    let champType = document.querySelector("#champType");
    let champSalle = document.querySelector("#champSalle");
    let champEnseignant = document.querySelector("#champEnseignant");
    let champNote = document.querySelector("#champNote");
    let blocStatut = document.querySelector("#blocStatut");
    let champStatut = document.querySelector("#champStatut");
    let blocRepetition = document.querySelector("#blocRepetition");
    let champRepeter = document.querySelector("#champRepeter");
    let blocRepetitionFin = document.querySelector("#blocRepetitionFin");
    let champRepeterJusqua = document.querySelector("#champRepeterJusqua");
    let erreurSeance = document.querySelector("#erreurSeance");
    let boutonEnregistrerSeance = document.querySelector("#boutonEnregistrerSeance");

    let LIBELLES_TYPE = { cours: "Cours", td: "TD", tp: "TP", examen: "Examen", autre: "Autre" };

    let etat = {
        utilisateur: null,
        classe: null,
        peutModifier: false,
        modeEdition: false,
        lundi: null,          // premier jour de la semaine affichée
        seances: [],
        intitulesConnus: [],
        seanceEnEdition: null,
        canal: null,
        minuteur: null
    };

    let minuteurMessage = null;
    let minuteurRechargement = null;
    let declencheurModale = null;

    // ---------- Dates (toujours en heure locale, jamais en UTC) ----------
    let versCle = (date) => {
        let mois = String(date.getMonth() + 1).padStart(2, "0");
        let jour = String(date.getDate()).padStart(2, "0");
        return `${date.getFullYear()}-${mois}-${jour}`;
    };

    let depuisCle = (cle) => {
        let [annee, mois, jour] = cle.split("-").map(Number);
        return new Date(annee, mois - 1, jour);
    };

    let ajouterJours = (date, nombre) => {
        let copie = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        copie.setDate(copie.getDate() + nombre);
        return copie;
    };

    let lundiDe = (date) => {
        let copie = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        copie.setDate(copie.getDate() - ((copie.getDay() + 6) % 7));
        return copie;
    };

    let memeJour = (a, b) => versCle(a) === versCle(b);

    let formaterHeure = (heure) => String(heure).slice(0, 5);

    let libelleSemaine = (lundi) => {
        let dimanche = ajouterJours(lundi, 6);
        let optionsJour = { day: "numeric" };
        let optionsMois = { day: "numeric", month: "long" };
        let debut = lundi.getMonth() === dimanche.getMonth()
            ? lundi.toLocaleDateString("fr-FR", optionsJour)
            : lundi.toLocaleDateString("fr-FR", optionsMois);
        let fin = dimanche.toLocaleDateString("fr-FR", optionsMois);
        return `Semaine du ${debut} au ${fin} ${dimanche.getFullYear()}`;
    };

    // ---------- Utilitaires d'interface ----------
    let montrerVue = (nom) => {
        Object.keys(vues).forEach(cle => { vues[cle].hidden = cle !== nom; });
    };

    let montrerErreur = (message) => {
        messageErreurL2.textContent = message;
        montrerVue("erreur");
    };

    let afficherMessage = (texte, estErreur) => {
        messageEdt.textContent = texte;
        messageEdt.className = `edt-message${estErreur ? " edt-message-erreur" : ""}`;
        messageEdt.hidden = false;
        clearTimeout(minuteurMessage);
        minuteurMessage = setTimeout(() => { messageEdt.hidden = true; }, 6000);
    };

    let icone = (classes) => {
        let i = document.createElement("i");
        i.className = classes;
        return i;
    };

    // ---------- Chargement de la semaine ----------
    let chargerSemaine = async () => {
        let debut = versCle(etat.lundi);
        let fin = versCle(ajouterJours(etat.lundi, 6));

        let { data, error } = await supabaseClient
            .from("seances_l2")
            .select(COLONNES)
            .eq("classe_id", etat.classe.id)
            .gte("date_seance", debut)
            .lte("date_seance", fin)
            .order("date_seance", { ascending: true })
            .order("heure_debut", { ascending: true });
        if (error) throw error;

        etat.seances = data || [];
        afficherSemaine();
    };

    let rechargerSansBruit = async () => {
        try {
            await chargerSemaine();
        } catch (e) {
            console.error("Rafraîchissement de l'emploi du temps :", e);
        }
    };

    // ---------- Affichage ----------
    let creerCarteSeance = (seance, maintenant) => {
        let carte = document.createElement("article");
        carte.className = `edt-seance edt-type-${seance.type_seance} edt-statut-${seance.statut}`;

        let debut = new Date(`${seance.date_seance}T${seance.heure_debut}`);
        let fin = new Date(`${seance.date_seance}T${seance.heure_fin}`);
        if (seance.statut !== "annule" && maintenant >= debut && maintenant < fin) {
            carte.classList.add("edt-seance-en-cours");
        }

        let heures = document.createElement("div");
        heures.className = "edt-heures";
        heures.textContent = `${formaterHeure(seance.heure_debut)} - ${formaterHeure(seance.heure_fin)}`;

        let titre = document.createElement("h4");
        titre.textContent = seance.intitule;

        let meta = document.createElement("div");
        meta.className = "edt-meta";
        let etiquetteType = document.createElement("span");
        etiquetteType.className = "edt-etiquette";
        etiquetteType.textContent = LIBELLES_TYPE[seance.type_seance] || seance.type_seance;
        meta.appendChild(etiquetteType);
        if (seance.statut === "annule") {
            let etiquette = document.createElement("span");
            etiquette.className = "edt-etiquette edt-etiquette-annule";
            etiquette.textContent = "Annulé";
            meta.appendChild(etiquette);
        } else if (seance.statut === "modifie") {
            let etiquette = document.createElement("span");
            etiquette.className = "edt-etiquette edt-etiquette-modifie";
            etiquette.textContent = "Modifié";
            meta.appendChild(etiquette);
        }

        carte.append(heures, titre, meta);

        if (seance.salle) {
            let ligne = document.createElement("p");
            ligne.className = "edt-detail";
            ligne.append(icone("fa-solid fa-location-dot"), `Salle ${seance.salle}`);
            carte.appendChild(ligne);
        }
        if (seance.enseignant) {
            let ligne = document.createElement("p");
            ligne.className = "edt-detail";
            ligne.append(icone("fa-solid fa-user-tie"), seance.enseignant);
            carte.appendChild(ligne);
        }
        if (seance.note) {
            let note = document.createElement("p");
            note.className = "edt-note";
            note.textContent = seance.note;
            carte.appendChild(note);
        }
        if (seance.statut !== "prevu" && seance.modifie_le) {
            let info = document.createElement("p");
            info.className = "edt-modifie-le";
            let quand = new Date(seance.modifie_le);
            info.textContent = `Mis à jour le ${quand.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} à ${quand.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
            carte.appendChild(info);
        }

        // Outils de modification : visibles seulement en mode édition (admin et responsable)
        if (etat.modeEdition) {
            let actions = document.createElement("div");
            actions.className = "edt-actions";

            let boutonModifier = creerPetitBouton("Modifier", "", () => ouvrirModale(seance, boutonModifier));
            let estAnnule = seance.statut === "annule";
            let boutonStatut = creerPetitBouton(estAnnule ? "Rétablir" : "Annuler le cours", "", () => {
                changerStatut(seance, estAnnule ? "prevu" : "annule", boutonStatut);
            });
            let boutonSupprimer = creerPetitBouton("Supprimer", "edt-danger", () => supprimerSeance(seance, boutonSupprimer));
            actions.append(boutonModifier, boutonStatut, boutonSupprimer);
            carte.appendChild(actions);
        }

        return carte;
    };

    let creerPetitBouton = (texte, classeSupplementaire, auClic) => {
        let bouton = document.createElement("button");
        bouton.type = "button";
        bouton.className = `edt-petit-bouton ${classeSupplementaire}`.trim();
        bouton.textContent = texte;
        bouton.addEventListener("click", auClic);
        return bouton;
    };

    let afficherSemaine = () => {
        let maintenant = new Date();
        let aujourdhui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
        let semaineCourante = memeJour(lundiDe(aujourdhui), etat.lundi);

        titreSemaine.textContent = libelleSemaine(etat.lundi);
        sousTitreSemaine.textContent = semaineCourante ? "Cette semaine" : "";

        // Bandeau "Prochain cours" : seulement pour la semaine en cours
        let prochain = null;
        if (semaineCourante) {
            prochain = etat.seances.find(s =>
                s.statut !== "annule" && new Date(`${s.date_seance}T${s.heure_fin}`) > maintenant
            ) || null;
        }
        if (prochain) {
            let debut = new Date(`${prochain.date_seance}T${prochain.heure_debut}`);
            let enCours = debut <= maintenant;
            let quand = memeJour(depuisCle(prochain.date_seance), aujourdhui)
                ? "aujourd'hui"
                : depuisCle(prochain.date_seance).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
            let detail = `${quand}, de ${formaterHeure(prochain.heure_debut)} à ${formaterHeure(prochain.heure_fin)}`;
            if (prochain.salle) detail += `, salle ${prochain.salle}`;
            bandeauProchain.textContent = `${enCours ? "En cours" : "Prochain cours"} : ${prochain.intitule} (${detail})`;
            bandeauProchain.hidden = false;
        } else {
            bandeauProchain.hidden = true;
        }

        // Résumé des changements de la semaine
        let nbModifiees = etat.seances.filter(s => s.statut === "modifie").length;
        let nbAnnulees = etat.seances.filter(s => s.statut === "annule").length;
        if (nbModifiees + nbAnnulees > 0) {
            let morceaux = [];
            if (nbModifiees > 0) morceaux.push(`${nbModifiees} séance${nbModifiees > 1 ? "s" : ""} modifiée${nbModifiees > 1 ? "s" : ""}`);
            if (nbAnnulees > 0) morceaux.push(`${nbAnnulees} séance${nbAnnulees > 1 ? "s" : ""} annulée${nbAnnulees > 1 ? "s" : ""}`);
            resumeChangements.textContent = `Changements cette semaine : ${morceaux.join(", ")}.`;
            resumeChangements.hidden = false;
        } else {
            resumeChangements.hidden = true;
        }

        // Colonnes : du lundi au samedi, le dimanche seulement s'il y a une séance (ou en mode édition)
        let colonnes = [];
        for (let i = 0; i < 7; i++) {
            let jour = ajouterJours(etat.lundi, i);
            let cle = versCle(jour);
            let seancesDuJour = etat.seances.filter(s => s.date_seance === cle);
            if (i === 6 && seancesDuJour.length === 0 && !etat.modeEdition) continue;

            let colonne = document.createElement("section");
            colonne.className = `edt-jour${memeJour(jour, aujourdhui) ? " edt-jour-aujourdhui" : ""}`;
            colonne.setAttribute("aria-label", jour.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));

            let entete = document.createElement("div");
            entete.className = "edt-jour-entete";
            let nomJour = document.createElement("strong");
            nomJour.textContent = jour.toLocaleDateString("fr-FR", { weekday: "long" });
            let dateJour = document.createElement("span");
            dateJour.textContent = jour.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
            entete.append(nomJour, dateJour);
            if (memeJour(jour, aujourdhui)) {
                let badge = document.createElement("span");
                badge.className = "edt-badge-jour";
                badge.textContent = "Aujourd'hui";
                entete.appendChild(badge);
            }
            colonne.appendChild(entete);

            if (seancesDuJour.length === 0) {
                let vide = document.createElement("p");
                vide.className = "edt-jour-vide";
                vide.textContent = "Pas de séance";
                colonne.appendChild(vide);
            } else {
                seancesDuJour.forEach(s => colonne.appendChild(creerCarteSeance(s, maintenant)));
            }

            if (etat.modeEdition) {
                let boutonAjouter = document.createElement("button");
                boutonAjouter.type = "button";
                boutonAjouter.className = "edt-ajouter";
                boutonAjouter.append(icone("fa-solid fa-plus"), " Ajouter une séance");
                boutonAjouter.addEventListener("click", () => ouvrirModale(null, boutonAjouter, cle));
                colonne.appendChild(boutonAjouter);
            }

            colonnes.push(colonne);
        }
        grilleSemaine.replaceChildren(...colonnes);
        semaineVide.hidden = etat.seances.length > 0 || etat.modeEdition;
    };

    // ---------- Navigation entre les semaines ----------
    let allerALaSemaine = async (lundi) => {
        etat.lundi = lundi;
        try {
            await chargerSemaine();
        } catch (e) {
            console.error(e);
            afficherMessage("Impossible de charger cette semaine.", true);
        }
    };

    boutonSemainePrecedente.addEventListener("click", () => allerALaSemaine(ajouterJours(etat.lundi, -7)));
    boutonSemaineSuivante.addEventListener("click", () => allerALaSemaine(ajouterJours(etat.lundi, 7)));
    boutonCetteSemaine.addEventListener("click", () => allerALaSemaine(lundiDe(new Date())));

    // ---------- Mode édition ----------
    boutonModeEdition.addEventListener("click", () => {
        etat.modeEdition = !etat.modeEdition;
        boutonModeEdition.setAttribute("aria-pressed", String(etat.modeEdition));
        boutonModeEdition.replaceChildren(
            icone(etat.modeEdition ? "fa-solid fa-check" : "fa-solid fa-pen"),
            etat.modeEdition ? "Terminer les modifications" : "Modifier l'emploi du temps"
        );
        boutonCopierSemaine.hidden = !etat.modeEdition;
        afficherSemaine();
    });

    // ---------- Actions sur une séance ----------
    let executer = async (boutons, action, messageSucces) => {
        boutons.forEach(b => { b.disabled = true; });
        try {
            let { error } = await action();
            if (error) {
                console.error("Erreur Supabase (emploi du temps) :", error);
                afficherMessage("Action impossible pour le moment. Réessaie dans un instant.", true);
                boutons.forEach(b => { b.disabled = false; });
                return false;
            }
            if (messageSucces) afficherMessage(messageSucces, false);
            await chargerSemaine();
            return true;
        } catch (e) {
            console.error(e);
            afficherMessage("Erreur réseau. Réessaie dans un instant.", true);
            boutons.forEach(b => { b.disabled = false; });
            return false;
        }
    };

    let changerStatut = (seance, nouveauStatut, bouton) => {
        executer(
            [bouton],
            () => supabaseClient.from("seances_l2").update({ statut: nouveauStatut }).eq("id", seance.id),
            nouveauStatut === "annule" ? `« ${seance.intitule} » est annulé.` : `« ${seance.intitule} » est rétabli.`
        );
    };

    let supprimerSeance = (seance, bouton) => {
        if (!confirm(`Supprimer définitivement « ${seance.intitule} » du ${depuisCle(seance.date_seance).toLocaleDateString("fr-FR")} ?\n(Pour un cours annulé, préfère « Annuler le cours » : la classe verra l'annulation.)`)) return;
        executer(
            [bouton],
            () => supabaseClient.from("seances_l2").delete().eq("id", seance.id),
            "Séance supprimée."
        );
    };

    // ---------- Copier la semaine précédente ----------
    boutonCopierSemaine.addEventListener("click", async () => {
        boutonCopierSemaine.disabled = true;
        try {
            let debutPrecedente = ajouterJours(etat.lundi, -7);
            let { data, error } = await supabaseClient
                .from("seances_l2")
                .select(COLONNES)
                .eq("classe_id", etat.classe.id)
                .gte("date_seance", versCle(debutPrecedente))
                .lte("date_seance", versCle(ajouterJours(debutPrecedente, 6)))
                .order("date_seance", { ascending: true })
                .order("heure_debut", { ascending: true });
            if (error) throw error;

            // Les séances annulées la semaine dernière ne sont pas reprises
            let aCopier = (data || []).filter(s => s.statut !== "annule");
            if (aCopier.length === 0) {
                afficherMessage("La semaine précédente ne contient aucune séance à copier.", true);
                return;
            }
            let avertissement = etat.seances.length > 0
                ? "\n\nAttention : cette semaine contient déjà des séances, elles seront conservées (des doublons sont possibles)."
                : "";
            if (!confirm(`Copier ${aCopier.length} séance${aCopier.length > 1 ? "s" : ""} de la semaine précédente vers cette semaine ?${avertissement}`)) return;

            let lignes = aCopier.map(s => ({
                classe_id: etat.classe.id,
                date_seance: versCle(ajouterJours(depuisCle(s.date_seance), 7)),
                heure_debut: s.heure_debut,
                heure_fin: s.heure_fin,
                intitule: s.intitule,
                type_seance: s.type_seance,
                enseignant: s.enseignant,
                salle: s.salle,
                statut: "prevu"
            }));
            let { error: erreurInsertion } = await supabaseClient.from("seances_l2").insert(lignes);
            if (erreurInsertion) throw erreurInsertion;
            afficherMessage(`${lignes.length} séance${lignes.length > 1 ? "s" : ""} copiée${lignes.length > 1 ? "s" : ""}.`, false);
            await chargerSemaine();
        } catch (e) {
            console.error(e);
            afficherMessage("La copie n'a pas pu être faite. Réessaie dans un instant.", true);
        } finally {
            boutonCopierSemaine.disabled = false;
        }
    });

    // ---------- Fenêtre d'ajout / de modification ----------
    let afficherErreurSeance = (texte) => {
        erreurSeance.textContent = texte;
        erreurSeance.hidden = !texte;
    };

    let ouvrirModale = (seance, declencheur, dateParDefaut) => {
        declencheurModale = declencheur;
        etat.seanceEnEdition = seance;
        afficherErreurSeance("");

        listeIntitules.replaceChildren(...etat.intitulesConnus.map(nom => {
            let option = document.createElement("option");
            option.value = nom;
            return option;
        }));

        if (seance) {
            titreModaleSeance.textContent = "Modifier la séance";
            champDate.value = seance.date_seance;
            champDebut.value = formaterHeure(seance.heure_debut);
            champFin.value = formaterHeure(seance.heure_fin);
            champIntitule.value = seance.intitule;
            champType.value = seance.type_seance;
            champSalle.value = seance.salle || "";
            champEnseignant.value = seance.enseignant || "";
            champNote.value = seance.note || "";
            champStatut.value = seance.statut === "annule" ? "annule" : "prevu";
            blocStatut.hidden = false;
            blocRepetition.hidden = true;
        } else {
            titreModaleSeance.textContent = "Ajouter une séance";
            formSeance.reset();
            champDate.value = dateParDefaut || versCle(etat.lundi);
            champStatut.value = "prevu";
            blocStatut.hidden = true;
            blocRepetition.hidden = false;
            blocRepetitionFin.hidden = true;
        }

        modaleSeance.hidden = false;
        document.body.classList.add("modale-ouverte");
        champIntitule.focus();
    };

    let fermerModale = () => {
        if (modaleSeance.hidden) return;
        modaleSeance.hidden = true;
        document.body.classList.remove("modale-ouverte");
        etat.seanceEnEdition = null;
        if (declencheurModale && document.contains(declencheurModale)) declencheurModale.focus();
        declencheurModale = null;
    };

    document.querySelector("#boutonFermerSeance").addEventListener("click", fermerModale);
    document.querySelector("#boutonAnnulerSeance").addEventListener("click", fermerModale);
    modaleSeance.addEventListener("click", (e) => {
        if (e.target === modaleSeance) fermerModale();
    });
    document.addEventListener("keydown", (e) => {
        if (!modaleSeance.hidden && e.key === "Escape") fermerModale();
    });

    champRepeter.addEventListener("change", () => {
        blocRepetitionFin.hidden = !champRepeter.checked;
        if (champRepeter.checked && !champRepeterJusqua.value && champDate.value) {
            // Par défaut : 8 semaines
            champRepeterJusqua.value = versCle(ajouterJours(depuisCle(champDate.value), 7 * 8));
        }
    });

    formSeance.addEventListener("submit", async (e) => {
        e.preventDefault();
        afficherErreurSeance("");

        let intitule = champIntitule.value.trim();
        if (!champDate.value || !champDebut.value || !champFin.value) {
            afficherErreurSeance("Renseigne la date et les horaires.");
            return;
        }
        if (champFin.value <= champDebut.value) {
            afficherErreurSeance("L'heure de fin doit être après l'heure de début.");
            return;
        }
        if (!intitule) {
            afficherErreurSeance("Indique la matière ou l'intitulé de la séance.");
            return;
        }

        let champs = {
            date_seance: champDate.value,
            heure_debut: champDebut.value,
            heure_fin: champFin.value,
            intitule: intitule,
            type_seance: champType.value,
            salle: champSalle.value.trim() || null,
            enseignant: champEnseignant.value.trim() || null,
            note: champNote.value.trim() || null
        };

        boutonEnregistrerSeance.disabled = true;
        try {
            if (etat.seanceEnEdition) {
                let { error } = await supabaseClient
                    .from("seances_l2")
                    .update({ ...champs, statut: champStatut.value })
                    .eq("id", etat.seanceEnEdition.id);
                if (error) throw error;
                afficherMessage("Séance mise à jour : la classe voit le changement.", false);
            } else {
                let lignes = [];
                let premiereDate = depuisCle(champs.date_seance);
                let derniereDate = premiereDate;
                if (champRepeter.checked) {
                    if (!champRepeterJusqua.value) {
                        afficherErreurSeance("Indique jusqu'à quelle date répéter la séance.");
                        return;
                    }
                    derniereDate = depuisCle(champRepeterJusqua.value);
                    if (derniereDate < premiereDate) {
                        afficherErreurSeance("La date de fin de répétition est avant la première séance.");
                        return;
                    }
                }
                for (let k = 0; k < MAX_SEMAINES_REPETITION; k++) {
                    let date = ajouterJours(premiereDate, 7 * k);
                    if (date > derniereDate) break;
                    lignes.push({ classe_id: etat.classe.id, ...champs, date_seance: versCle(date), statut: "prevu" });
                }
                let { error } = await supabaseClient.from("seances_l2").insert(lignes);
                if (error) throw error;
                afficherMessage(lignes.length > 1 ? `${lignes.length} séances ajoutées.` : "Séance ajoutée.", false);
            }

            if (!etat.intitulesConnus.includes(intitule)) etat.intitulesConnus.push(intitule);
            fermerModale();
            await chargerSemaine();
        } catch (erreur) {
            console.error("Erreur Supabase (enregistrement de la séance) :", erreur);
            afficherErreurSeance("La séance n'a pas pu être enregistrée. Vérifie les champs, puis réessaie.");
        } finally {
            boutonEnregistrerSeance.disabled = false;
        }
    });

    // ---------- Temps réel (secours : rafraîchissement toutes les minutes) ----------
    let arreterTempsReel = () => {
        clearInterval(etat.minuteur);
        etat.minuteur = null;
        if (etat.canal) {
            supabaseClient.removeChannel(etat.canal);
            etat.canal = null;
        }
    };

    let demarrerTempsReel = () => {
        arreterTempsReel();
        etat.canal = supabaseClient
            .channel(`emploi-du-temps-l2-${etat.classe.id}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "seances_l2" }, () => {
                // Plusieurs changements d'affilée : on ne recharge qu'une fois
                clearTimeout(minuteurRechargement);
                minuteurRechargement = setTimeout(rechargerSansBruit, 400);
            })
            .subscribe();
        etat.minuteur = setInterval(() => {
            if (!document.hidden && modaleSeance.hidden) rechargerSansBruit();
        }, INTERVALLE_RAFRAICHISSEMENT);
    };

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && etat.classe && modaleSeance.hidden) rechargerSansBruit();
    });

    // ---------- Charger la page ----------
    let initialiser = async () => {
        montrerVue("chargement");
        arreterTempsReel();
        fermerModale();

        try {
            let { data: sessionData } = await supabaseClient.auth.getSession();
            if (!sessionData.session) {
                etat.utilisateur = null;
                montrerVue("connexion");
                return;
            }
            etat.utilisateur = sessionData.session.user;

            let { data: classe, error: erreurClasse } = await supabaseClient
                .from("classes").select("id").eq("slug", SLUG_CLASSE_L2).maybeSingle();
            if (erreurClasse) throw erreurClasse;
            if (!classe) {
                montrerErreur("L'espace de la classe est introuvable. Contacte l'administrateur.");
                return;
            }
            etat.classe = classe;

            let [reponseMembre, reponseAdmin] = await Promise.all([
                supabaseClient.from("membres_classe").select("role")
                    .eq("classe_id", classe.id).eq("user_id", etat.utilisateur.id).maybeSingle(),
                supabaseClient.from("admins").select("user_id")
                    .eq("user_id", etat.utilisateur.id).maybeSingle()
            ]);
            if (reponseMembre.error) throw reponseMembre.error;
            if (reponseAdmin.error) throw reponseAdmin.error;

            let estAdmin = !!reponseAdmin.data;
            if (!reponseMembre.data && !estAdmin) {
                montrerVue("pasMembre");
                return;
            }

            etat.peutModifier = estAdmin || (!!reponseMembre.data && reponseMembre.data.role === "responsable");
            etat.modeEdition = false;
            boutonModeEdition.hidden = !etat.peutModifier;
            boutonModeEdition.setAttribute("aria-pressed", "false");
            boutonModeEdition.replaceChildren(icone("fa-solid fa-pen"), "Modifier l'emploi du temps");
            boutonCopierSemaine.hidden = true;

            // Suggestions d'intitulés : les matières de la L2
            let { data: matieres } = await supabaseClient
                .from("matieres_classe").select("nom").eq("classe_id", classe.id).order("ordre", { ascending: true });
            etat.intitulesConnus = (matieres || []).map(m => m.nom);

            etat.lundi = lundiDe(new Date());
            montrerVue("edt");
            await chargerSemaine();
            demarrerTempsReel();

            // Sur téléphone, la grille est en colonne : on amène la journée d'aujourd'hui à l'écran
            let colonneAujourdhui = document.querySelector(".edt-jour-aujourdhui");
            if (colonneAujourdhui && window.matchMedia("(max-width: 640px)").matches) {
                colonneAujourdhui.scrollIntoView({ block: "start" });
            }
        } catch (e) {
            console.error(e);
            montrerErreur("Impossible de charger l'emploi du temps. Vérifie ta connexion, puis réessaie.");
        }
    };

    // ---------- Boutons ----------
    document.querySelector("#boutonConnexionL2").addEventListener("click", () => {
        if (window.ouvrirModaleAuth) window.ouvrirModaleAuth();
    });
    document.querySelector("#boutonReessayer").addEventListener("click", initialiser);

    // ---------- Réagir à la connexion / déconnexion ----------
    let dernierIdUtilisateur;
    supabaseClient.auth.onAuthStateChange((_evenement, session) => {
        let idActuel = session ? session.user.id : null;
        if (idActuel === dernierIdUtilisateur) return;
        dernierIdUtilisateur = idActuel;
        setTimeout(initialiser, 0); // évite d'appeler Supabase pendant le callback d'authentification
    });
});
