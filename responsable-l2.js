// ========================================================
// ESPACE RESPONSABLE L2 — dépôt de ressources
//
// Réservé au responsable de classe (et à l'administrateur).
// Une ressource est publiée tout de suite pour toute la classe : l'admin et le responsable
// peuvent aussi corriger une erreur en supprimant la ressource.
//
// Ordre d'un dépôt de fichier :
//   1. on crée la ligne dans "depots" (avec le chemin prévu)
//   2. on envoie le fichier dans le bucket privé "ressources-l2"
//   3. si l'envoi échoue, on supprime la ligne : pas de dépôt fantôme
//
// La vraie protection est en base (RLS + triggers) : ici on ne fait
// qu'afficher l'interface et vérifier les champs pour guider l'utilisateur.
// ========================================================
document.addEventListener("DOMContentLoaded", () => {

    let SLUG_CLASSE_L2 = "l2-gl-2026-2027";
    let BUCKET_L2 = "ressources-l2";

    let vues = {
        chargement: document.querySelector("#vueChargement"),
        connexion: document.querySelector("#vueConnexion"),
        interdit: document.querySelector("#vueInterdit"),
        erreur: document.querySelector("#vueErreur"),
        responsable: document.querySelector("#vueResponsable")
    };

    let texteInterdit = document.querySelector("#texteInterdit");
    let messageErreurL2 = document.querySelector("#messageErreurL2");
    let aucuneMatiere = document.querySelector("#aucuneMatiere");
    let formDepot = document.querySelector("#formDepot");
    let champMatiere = document.querySelector("#matiereDepot");
    let champCategorie = document.querySelector("#categorieDepot");
    let champTitre = document.querySelector("#titreDepot");
    let champDescription = document.querySelector("#descriptionDepot");
    let blocFichier = document.querySelector("#blocFichier");
    let champFichier = document.querySelector("#fichierDepot");
    let blocLien = document.querySelector("#blocLien");
    let champUrl = document.querySelector("#urlDepot");
    let apercuYoutube = document.querySelector("#apercuYoutube");
    let miniatureYoutube = document.querySelector("#miniatureYoutube");
    let erreurDepot = document.querySelector("#erreurDepot");
    let boutonEnvoyerDepot = document.querySelector("#boutonEnvoyerDepot");
    let listeMesDepots = document.querySelector("#listeMesDepots");

    let utilisateurCourant = null;
    let classeL2 = null;
    let estAdmin = false;

    let LIBELLES_CATEGORIE = { cours: "Cours", td: "TD", examen: "Examen", lien: "Lien", autre: "Autre" };
    let LIBELLES_STATUT = { en_attente: "En attente", publie: "Publié", refuse: "Refusé" };
    let CLASSES_STATUT = { en_attente: "etiquette-attente", publie: "etiquette-publie", refuse: "etiquette-refuse" };

    champFichier.accept = window.L2Outils.EXTENSIONS_AUTORISEES.map(e => "." + e).join(",");

    // ---------- Afficher une seule vue à la fois ----------
    let montrerVue = (nom) => {
        Object.keys(vues).forEach(cle => { vues[cle].hidden = cle !== nom; });
    };

    let montrerErreur = (message) => {
        messageErreurL2.textContent = message;
        montrerVue("erreur");
    };

    let notifier = (texte) => {
        if (window.afficherToast) window.afficherToast(texte);
    };

    let formaterDate = (dateIso) => {
        return new Date(dateIso).toLocaleDateString("fr-FR", {
            day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
        });
    };

    let genererIdentifiant = () => {
        if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    };

    let messageVide = (texte) => {
        let p = document.createElement("p");
        p.className = "message-chargement";
        p.textContent = texte;
        return p;
    };

    // ---------- Formulaire : fichier ou lien selon la catégorie ----------
    let mettreAJourChampsSelonCategorie = () => {
        let estLien = champCategorie.value === "lien";
        blocLien.hidden = !estLien;
        blocFichier.hidden = estLien;
    };

    champCategorie.addEventListener("change", mettreAJourChampsSelonCategorie);

    // Le message d'erreur disparaît dès que l'utilisateur corrige un champ
    formDepot.addEventListener("input", () => { erreurDepot.textContent = ""; });

    // ---------- Aperçu de la miniature YouTube ----------
    champUrl.addEventListener("input", () => {
        let idVideo = window.L2Outils.extraireIdYoutube(champUrl.value);
        if (idVideo) {
            miniatureYoutube.src = window.L2Outils.urlMiniatureYoutube(idVideo);
            apercuYoutube.hidden = false;
        } else {
            apercuYoutube.hidden = true;
            miniatureYoutube.removeAttribute("src");
        }
    });

    // ---------- Liste de mes dépôts ----------
    let creerCarteDepot = (depot) => {
        let carte = document.createElement("div");
        carte.className = "carte-depot-liste";

        let infos = document.createElement("div");

        let titre = document.createElement("h5");
        titre.textContent = depot.titre;

        let ligneEtiquettes = document.createElement("p");
        let etiquetteCategorie = document.createElement("span");
        etiquetteCategorie.className = "etiquette";
        etiquetteCategorie.textContent = LIBELLES_CATEGORIE[depot.categorie] || depot.categorie;
        let etiquetteStatut = document.createElement("span");
        etiquetteStatut.className = `etiquette ${CLASSES_STATUT[depot.statut] || ""}`;
        etiquetteStatut.textContent = LIBELLES_STATUT[depot.statut] || depot.statut;
        let nomMatiere = depot.matieres_classe && depot.matieres_classe.nom ? depot.matieres_classe.nom : "Matière supprimée";
        let auteur = depot.depose_par === utilisateurCourant.id ? "par toi" : "par un autre membre";
        ligneEtiquettes.append(etiquetteCategorie, etiquetteStatut, `${nomMatiere} | ${auteur} | ${formaterDate(depot.cree_le)}`);

        infos.append(titre, ligneEtiquettes);

        if (depot.statut === "refuse" && depot.motif_refus) {
            let ligneMotif = document.createElement("p");
            ligneMotif.textContent = `Motif du refus : ${depot.motif_refus}`;
            infos.appendChild(ligneMotif);
        }

        carte.appendChild(infos);

        let actions = document.createElement("div");
        actions.className = "actions-depot";

        // Ancien dépôt resté en attente : le responsable peut le publier lui-même
        if (depot.statut !== "publie") {
            let boutonPublier = document.createElement("button");
            boutonPublier.type = "button";
            boutonPublier.className = "bouton-publier-depot";
            let iconePublier = document.createElement("i");
            iconePublier.className = "fa-solid fa-check";
            boutonPublier.append(iconePublier, "Publier");
            boutonPublier.addEventListener("click", () => publierDepot(depot, boutonPublier));
            actions.appendChild(boutonPublier);
        }

        // Une erreur se corrige en supprimant la ressource, puis en la déposant à nouveau
        let boutonSupprimer = document.createElement("button");
        boutonSupprimer.type = "button";
        boutonSupprimer.className = "bouton-supprimer-depot";
        let icone = document.createElement("i");
        icone.className = "fa-solid fa-trash";
        boutonSupprimer.append(icone, "Supprimer");
        boutonSupprimer.addEventListener("click", () => supprimerDepot(depot, boutonSupprimer));
        actions.appendChild(boutonSupprimer);

        carte.appendChild(actions);
        return carte;
    };

    let chargerMesDepots = async () => {
        let { data: depots, error } = await supabaseClient
            .from("depots")
            .select("id, depose_par, titre, categorie, chemin_fichier, statut, motif_refus, cree_le, matieres_classe ( nom )")
            .eq("classe_id", classeL2.id)
            .order("cree_le", { ascending: false })
            .limit(100);

        if (error) {
            console.error("Erreur Supabase (ressources de la classe) :", error);
            listeMesDepots.replaceChildren(messageVide("Impossible de charger les ressources pour le moment."));
            return;
        }
        if (!depots || depots.length === 0) {
            listeMesDepots.replaceChildren(messageVide("Aucune ressource n'a encore été ajoutée."));
            return;
        }
        listeMesDepots.replaceChildren(...depots.map(creerCarteDepot));
    };

    let supprimerDepot = async (depot, bouton) => {
        if (!confirm(`Supprimer « ${depot.titre} » ?\nElle disparaît pour toute la classe et ne pourra pas être récupérée.`)) return;
        bouton.disabled = true;

        try {
            if (depot.chemin_fichier) {
                let { error: erreurFichier } = await supabaseClient.storage.from(BUCKET_L2).remove([depot.chemin_fichier]);
                if (erreurFichier) console.error("Suppression du fichier :", erreurFichier);
            }
            let { error } = await supabaseClient.from("depots").delete().eq("id", depot.id);
            if (error) {
                console.error("Erreur Supabase (suppression) :", error);
                notifier("Suppression impossible pour le moment.");
                bouton.disabled = false;
                return;
            }
            notifier("Ressource supprimée.");
            await chargerMesDepots();
        } catch (e) {
            console.error(e);
            notifier("Erreur réseau. Réessaie dans un instant.");
            bouton.disabled = false;
        }
    };

    let publierDepot = async (depot, bouton) => {
        bouton.disabled = true;
        try {
            let { error } = await supabaseClient.from("depots").update({ statut: "publie" }).eq("id", depot.id);
            if (error) {
                console.error("Erreur Supabase (publication) :", error);
                notifier("Publication impossible pour le moment.");
                bouton.disabled = false;
                return;
            }
            notifier("Ressource publiée : toute la classe peut la voir.");
            await chargerMesDepots();
        } catch (e) {
            console.error(e);
            notifier("Erreur réseau. Réessaie dans un instant.");
            bouton.disabled = false;
        }
    };

    // ---------- Envoyer un dépôt ----------
    formDepot.addEventListener("submit", async (e) => {
        e.preventDefault();
        erreurDepot.textContent = "";

        let matiereId = champMatiere.value;
        let titre = champTitre.value.trim();
        let description = champDescription.value.trim();
        let categorie = champCategorie.value;
        let estLien = categorie === "lien";

        if (!matiereId) {
            erreurDepot.textContent = "Choisis une matière.";
            return;
        }
        if (!titre) {
            erreurDepot.textContent = "Donne un titre à la ressource.";
            return;
        }

        let donnees = {
            classe_id: classeL2.id,
            matiere_id: matiereId,
            depose_par: utilisateurCourant.id,
            titre: titre,
            description: description || null,
            categorie: categorie
        };

        let fichier = null;
        let cheminFichier = null;

        if (estLien) {
            let url = champUrl.value.trim();
            if (!window.L2Outils.urlValide(url)) {
                erreurDepot.textContent = "Entre une adresse valide, qui commence par https://";
                return;
            }
            donnees.url = url;
        } else {
            fichier = champFichier.files[0];
            let erreurFichier = window.L2Outils.verifierFichier(fichier);
            if (erreurFichier) {
                erreurDepot.textContent = erreurFichier;
                return;
            }
            let extension = window.L2Outils.extensionDe(fichier.name);
            cheminFichier = `${classeL2.id}/${matiereId}/${genererIdentifiant()}.${extension}`;
            donnees.chemin_fichier = cheminFichier;
            donnees.type_fichier = extension;
        }

        // L'admin et le responsable publient directement : plus de validation à attendre
        donnees.statut = "publie";

        boutonEnvoyerDepot.disabled = true;
        boutonEnvoyerDepot.textContent = "Publication en cours...";

        try {
            // 1. Ligne dans "depots"
            let { data: depotCree, error: erreurInsertion } = await supabaseClient
                .from("depots")
                .insert(donnees)
                .select("id")
                .single();

            if (erreurInsertion) {
                console.error("Erreur Supabase (dépôt) :", erreurInsertion);
                erreurDepot.textContent = erreurInsertion.code === "42501"
                    ? "Tu n'as pas le droit de déposer dans cet espace. Reconnecte-toi, puis réessaie."
                    : "Le dépôt n'a pas pu être enregistré. Vérifie les champs, puis réessaie.";
                return;
            }

            // 2. Envoi du fichier
            if (fichier) {
                let { error: erreurEnvoi } = await supabaseClient.storage
                    .from(BUCKET_L2)
                    .upload(cheminFichier, fichier, { contentType: fichier.type || undefined, upsert: false });

                if (erreurEnvoi) {
                    console.error("Erreur Supabase (envoi du fichier) :", erreurEnvoi);
                    // 3. Annulation : on retire la ligne créée à l'étape 1
                    await supabaseClient.from("depots").delete().eq("id", depotCree.id);
                    erreurDepot.textContent = "Le fichier n'a pas pu être envoyé. Réessaie dans un instant.";
                    return;
                }
            }

            formDepot.reset();
            mettreAJourChampsSelonCategorie();
            apercuYoutube.hidden = true;
            notifier("Ressource publiée : toute la classe peut la voir.");
            await chargerMesDepots();

        } catch (erreurReseau) {
            console.error(erreurReseau);
            erreurDepot.textContent = "Erreur réseau. Vérifie ta connexion, puis réessaie.";
        } finally {
            boutonEnvoyerDepot.disabled = false;
            boutonEnvoyerDepot.textContent = "Publier la ressource";
        }
    });

    // ---------- Décider quelle vue afficher ----------
    let initialiser = async () => {
        montrerVue("chargement");

        try {
            let { data: sessionData } = await supabaseClient.auth.getSession();
            if (!sessionData.session) {
                utilisateurCourant = null;
                montrerVue("connexion");
                return;
            }
            utilisateurCourant = sessionData.session.user;

            let { data: classe, error: erreurClasse } = await supabaseClient
                .from("classes")
                .select("id")
                .eq("slug", SLUG_CLASSE_L2)
                .maybeSingle();
            if (erreurClasse) throw erreurClasse;
            if (!classe) {
                montrerErreur("L'espace de la classe est introuvable. Contacte l'administrateur.");
                return;
            }
            classeL2 = classe;

            let [reponseMembre, reponseAdmin] = await Promise.all([
                supabaseClient.from("membres_classe").select("role")
                    .eq("classe_id", classe.id).eq("user_id", utilisateurCourant.id).maybeSingle(),
                supabaseClient.from("admins").select("user_id")
                    .eq("user_id", utilisateurCourant.id).maybeSingle()
            ]);
            if (reponseMembre.error) throw reponseMembre.error;
            if (reponseAdmin.error) throw reponseAdmin.error;

            estAdmin = !!reponseAdmin.data;
            let estResponsable = reponseMembre.data && reponseMembre.data.role === "responsable";

            if (!estAdmin && !estResponsable) {
                texteInterdit.textContent = reponseMembre.data
                    ? "Seul le responsable de la classe peut déposer des ressources. Tu peux consulter l'espace L2 depuis la page d'accès."
                    : "Tu n'es pas encore membre de l'espace L2. Fais d'abord une demande d'accès.";
                montrerVue("interdit");
                return;
            }

            let { data: matieres, error: erreurMatieres } = await supabaseClient
                .from("matieres_classe")
                .select("id, nom")
                .eq("classe_id", classe.id)
                .order("ordre", { ascending: true })
                .order("nom", { ascending: true });
            if (erreurMatieres) throw erreurMatieres;

            champMatiere.replaceChildren(...(matieres || []).map(matiere => {
                let option = document.createElement("option");
                option.value = matiere.id;
                option.textContent = matiere.nom;
                return option;
            }));
            let sansMatiere = !matieres || matieres.length === 0;
            aucuneMatiere.hidden = !sansMatiere;
            Array.from(formDepot.elements).forEach(el => { el.disabled = sansMatiere; });

            mettreAJourChampsSelonCategorie();
            montrerVue("responsable");
            await chargerMesDepots();

        } catch (e) {
            console.error(e);
            montrerErreur("Impossible de charger la page. Vérifie ta connexion, puis réessaie.");
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