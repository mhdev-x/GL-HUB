// ========================================================
// ESPACE L2 — consultation des ressources publiées
//
// Réservé aux membres de la classe (et à l'admin). Les ressources sont
// publiées par l'administrateur après dépôt par le responsable.
//
//  - filtres par matière et par catégorie, recherche par titre
//  - fichiers : lecture dans l'onglet (PDF, images, texte) ou téléchargement,
//    via l'Edge Function l2-resource-access (aucun lien partageable)
//  - liens YouTube : miniature, puis lecteur intégré au clic
//  - autres liens : ouverture dans un nouvel onglet
//
// La vraie protection est en base (RLS) : un non-membre ne reçoit aucune
// ressource même s'il appelle Supabase directement.
// Tous les textes affichés passent par textContent (jamais innerHTML).
// ========================================================
document.addEventListener("DOMContentLoaded", () => {

    let SLUG_CLASSE_L2 = "l2-gl-2026-2027";
    let SEPT_JOURS = 7 * 24 * 60 * 60 * 1000;

    let vues = {
        chargement: document.querySelector("#vueChargement"),
        connexion: document.querySelector("#vueConnexion"),
        pasMembre: document.querySelector("#vuePasMembre"),
        erreur: document.querySelector("#vueErreur"),
        espace: document.querySelector("#vueEspace")
    };

    let messageErreurL2 = document.querySelector("#messageErreurL2");
    let champRecherche = document.querySelector("#rechercheL2");
    let lienDeposer = document.querySelector("#lienDeposer");
    let lienGerer = document.querySelector("#lienGerer");
    let filtresMatieres = document.querySelector("#filtresMatieres");
    let filtresCategories = document.querySelector("#filtresCategories");
    let compteurResultats = document.querySelector("#compteurResultats");
    let grilleRessources = document.querySelector("#grilleRessources");
    let aucuneRessource = document.querySelector("#aucuneRessource");

    let modaleVideo = document.querySelector("#modaleVideo");
    let titreModaleVideo = document.querySelector("#titreModaleVideo");
    let conteneurVideo = document.querySelector("#conteneurVideo");
    let lienYoutube = document.querySelector("#lienYoutube");
    let boutonFermerVideo = document.querySelector("#boutonFermerVideo");

    let CATEGORIES = [
        { valeur: "toutes", libelle: "Tout" },
        { valeur: "cours", libelle: "Cours" },
        { valeur: "td", libelle: "TD" },
        { valeur: "examen", libelle: "Examens" },
        { valeur: "lien", libelle: "Liens et vidéos" },
        { valeur: "autre", libelle: "Autres" }
    ];
    let LIBELLES_CATEGORIE = { cours: "Cours", td: "TD", examen: "Examen", lien: "Lien", autre: "Autre" };

    let ICONES_FICHIER = {
        pdf: "fa-file-pdf", doc: "fa-file-word", docx: "fa-file-word", odt: "fa-file-word",
        xls: "fa-file-excel", xlsx: "fa-file-excel", csv: "fa-file-excel", ods: "fa-file-excel",
        ppt: "fa-file-powerpoint", pptx: "fa-file-powerpoint", odp: "fa-file-powerpoint",
        zip: "fa-file-zipper", rar: "fa-file-zipper", "7z": "fa-file-zipper",
        png: "fa-file-image", jpg: "fa-file-image", jpeg: "fa-file-image", gif: "fa-file-image", webp: "fa-file-image",
        txt: "fa-file-lines", md: "fa-file-lines",
        c: "fa-file-code", h: "fa-file-code", cpp: "fa-file-code", java: "fa-file-code", py: "fa-file-code",
        js: "fa-file-code", css: "fa-file-code", sql: "fa-file-code", json: "fa-file-code",
        xml: "fa-file-code", php: "fa-file-code", sh: "fa-file-code"
    };

    let etat = {
        ressources: [],
        matieres: [],
        filtreMatiere: "toutes",
        filtreCategorie: "toutes",
        recherche: ""
    };

    // ---------- Petits utilitaires ----------
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

    let icone = (classes) => {
        let i = document.createElement("i");
        i.className = classes;
        return i;
    };

    // Minuscules et sans accents : "Réseaux" est trouvé en tapant "reseaux"
    let normaliser = (texte) => String(texte || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    let formaterDate = (dateIso) => {
        return new Date(dateIso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    let estRecente = (ressource) => {
        let date = new Date(ressource.publie_le || ressource.cree_le).getTime();
        return Date.now() - date < SEPT_JOURS;
    };

    let nomDeLaMatiere = (ressource) => (ressource.matieres_classe && ressource.matieres_classe.nom) || "Matière";

    // Identifiant YouTube validé : jamais utilisé tel quel s'il n'a pas le bon format
    let idVideoDe = (ressource) => {
        if (ressource.categorie !== "lien") return null;
        let id = ressource.youtube_id || window.L2Outils.extraireIdYoutube(ressource.url);
        return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    };

    // ---------- Lecteur YouTube ----------
    let declencheurVideo = null;

    let ouvrirVideo = (idVideo, titre, declencheur) => {
        declencheurVideo = declencheur;
        titreModaleVideo.textContent = titre;
        lienYoutube.href = `https://www.youtube.com/watch?v=${idVideo}`;

        let iframe = document.createElement("iframe");
        iframe.src = window.L2Outils.urlLecteurYoutube(idVideo);
        iframe.title = titre;
        iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
        iframe.allowFullscreen = true;
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        conteneurVideo.replaceChildren(iframe);

        modaleVideo.hidden = false;
        document.body.classList.add("modale-ouverte");
        boutonFermerVideo.focus();
    };

    let fermerVideo = () => {
        if (modaleVideo.hidden) return;
        conteneurVideo.replaceChildren(); // retirer l'iframe arrête la lecture
        modaleVideo.hidden = true;
        document.body.classList.remove("modale-ouverte");
        if (declencheurVideo) declencheurVideo.focus();
        declencheurVideo = null;
    };

    boutonFermerVideo.addEventListener("click", fermerVideo);
    modaleVideo.addEventListener("click", (e) => {
        if (e.target === modaleVideo) fermerVideo(); // clic sur le fond sombre
    });
    document.addEventListener("keydown", (e) => {
        if (modaleVideo.hidden) return;
        if (e.key === "Escape") {
            fermerVideo();
            return;
        }
        if (e.key === "Tab") {
            // Le focus reste dans la fenêtre vidéo
            let focalisables = Array.from(modaleVideo.querySelectorAll("button, a[href], iframe"));
            let premier = focalisables[0];
            let dernier = focalisables[focalisables.length - 1];
            if (e.shiftKey && document.activeElement === premier) {
                e.preventDefault();
                dernier.focus();
            } else if (!e.shiftKey && document.activeElement === dernier) {
                e.preventDefault();
                premier.focus();
            }
        }
    });

    // ---------- Ouvrir / télécharger un fichier ----------
    let lancerOuverture = async (ressource, action, bouton) => {
        let contenuOriginal = Array.from(bouton.childNodes);
        bouton.disabled = true;
        bouton.replaceChildren(icone("fa-solid fa-spinner fa-spin"), "Chargement...");
        try {
            await window.L2Outils.ouvrirFichier(ressource, action, notifier);
        } finally {
            bouton.disabled = false;
            bouton.replaceChildren(...contenuOriginal);
        }
    };

    let creerBoutonAction = (classes, iconeClasse, texte, auClic) => {
        let bouton = document.createElement("button");
        bouton.type = "button";
        bouton.className = classes;
        bouton.append(icone(iconeClasse), texte);
        bouton.addEventListener("click", auClic);
        return bouton;
    };

    // ---------- Carte d'une ressource ----------
    let creerCarte = (ressource) => {
        let carte = document.createElement("article");
        carte.className = "carte-ressource-l2";

        let idVideo = idVideoDe(ressource);
        let corps = document.createElement("div");
        corps.className = "corps-ressource-l2";

        // Miniature cliquable pour les vidéos YouTube
        if (idVideo) {
            let boutonMiniature = document.createElement("button");
            boutonMiniature.type = "button";
            boutonMiniature.className = "miniature-video-l2";
            boutonMiniature.setAttribute("aria-label", `Lire la vidéo : ${ressource.titre}`);
            let image = document.createElement("img");
            image.src = window.L2Outils.urlMiniatureYoutube(idVideo, "mqdefault");
            image.alt = "";
            image.loading = "lazy";
            image.width = 320;
            image.height = 180;
            let lecture = document.createElement("span");
            lecture.className = "bouton-lecture-l2";
            lecture.appendChild(icone("fa-solid fa-play"));
            boutonMiniature.append(image, lecture);
            boutonMiniature.addEventListener("click", () => ouvrirVideo(idVideo, ressource.titre, boutonMiniature));
            carte.appendChild(boutonMiniature);
        } else {
            let extension = ressource.type_fichier || "";
            let classeIcone = ressource.categorie === "lien" ? "fa-link" : (ICONES_FICHIER[extension] || "fa-file");
            let blocIcone = document.createElement("div");
            blocIcone.className = "icone-fichier-l2";
            blocIcone.appendChild(icone(`fa-solid ${classeIcone}`));
            corps.appendChild(blocIcone);
        }

        let titre = document.createElement("h4");
        titre.textContent = ressource.titre;
        corps.appendChild(titre);

        // Catégorie, matière, date, et badge "Nouveau" pendant 7 jours
        let meta = document.createElement("div");
        meta.className = "meta-ressource-l2";
        let etiquette = document.createElement("span");
        etiquette.className = "etiquette-l2";
        etiquette.textContent = LIBELLES_CATEGORIE[ressource.categorie] || ressource.categorie;
        let matiere = document.createElement("span");
        matiere.textContent = nomDeLaMatiere(ressource);
        let date = document.createElement("span");
        date.textContent = formaterDate(ressource.publie_le || ressource.cree_le);
        meta.append(etiquette, matiere, date);
        if (estRecente(ressource)) {
            let nouveau = document.createElement("span");
            nouveau.className = "etiquette-l2 etiquette-nouveau";
            nouveau.textContent = "Nouveau";
            meta.appendChild(nouveau);
        }
        corps.appendChild(meta);

        if (ressource.description) {
            let description = document.createElement("p");
            description.className = "description-ressource-l2";
            description.textContent = ressource.description;
            corps.appendChild(description);
        }

        // Boutons selon le type de ressource
        let actions = document.createElement("div");
        actions.className = "actions-ressource-l2";

        if (idVideo) {
            let boutonRegarder = creerBoutonAction("bouton-ressource-l2", "fa-solid fa-play", "Regarder", () => {
                ouvrirVideo(idVideo, ressource.titre, boutonRegarder);
            });
            actions.appendChild(boutonRegarder);
        } else if (ressource.categorie === "lien") {
            if (window.L2Outils.urlValide(ressource.url)) {
                let lien = document.createElement("a");
                lien.className = "bouton-ressource-l2";
                lien.href = ressource.url;
                lien.target = "_blank";
                lien.rel = "noopener noreferrer";
                lien.append(icone("fa-solid fa-arrow-up-right-from-square"), "Ouvrir le lien");
                actions.appendChild(lien);
            }
        } else {
            let seLit = window.L2Outils.peutSeLireDansLeNavigateur(ressource.type_fichier);
            if (seLit) {
                let boutonLire = creerBoutonAction("bouton-ressource-l2", "fa-solid fa-eye", "Lire", () => {
                    lancerOuverture(ressource, "lecture", boutonLire);
                });
                actions.appendChild(boutonLire);
            }
            let boutonTelecharger = creerBoutonAction(
                seLit ? "bouton-ressource-l2 secondaire" : "bouton-ressource-l2",
                "fa-solid fa-download",
                "Télécharger",
                () => lancerOuverture(ressource, "telechargement", boutonTelecharger)
            );
            actions.appendChild(boutonTelecharger);
        }

        corps.appendChild(actions);
        carte.appendChild(corps);
        return carte;
    };

    // ---------- Filtrage ----------
    let correspond = (ressource, { ignorerMatiere = false, ignorerCategorie = false } = {}) => {
        if (!ignorerMatiere && etat.filtreMatiere !== "toutes" && ressource.matiere_id !== etat.filtreMatiere) return false;
        if (!ignorerCategorie && etat.filtreCategorie !== "toutes" && ressource.categorie !== etat.filtreCategorie) return false;
        if (etat.recherche) {
            let texte = normaliser(`${ressource.titre} ${ressource.description || ""} ${nomDeLaMatiere(ressource)}`);
            if (!texte.includes(etat.recherche)) return false;
        }
        return true;
    };

    let creerPuceFiltre = (libelle, nombre, actif, auClic) => {
        let puce = document.createElement("button");
        puce.type = "button";
        puce.className = "puce-filtre";
        puce.setAttribute("aria-pressed", actif ? "true" : "false");
        let texte = document.createElement("span");
        texte.textContent = libelle;
        let compteur = document.createElement("span");
        compteur.className = "nombre";
        compteur.textContent = nombre;
        puce.append(texte, compteur);
        puce.addEventListener("click", auClic);
        return puce;
    };

    let afficher = () => {
        // Puces de matières : le nombre tient compte de la catégorie et de la recherche en cours
        let totalMatieres = etat.ressources.filter(r => correspond(r, { ignorerMatiere: true })).length;
        let puces = [creerPuceFiltre("Toutes les matières", totalMatieres, etat.filtreMatiere === "toutes", () => {
            etat.filtreMatiere = "toutes";
            afficher();
        })];
        etat.matieres.forEach(matiere => {
            let nombre = etat.ressources.filter(r => r.matiere_id === matiere.id && correspond(r, { ignorerMatiere: true })).length;
            puces.push(creerPuceFiltre(matiere.nom, nombre, etat.filtreMatiere === matiere.id, () => {
                etat.filtreMatiere = matiere.id;
                afficher();
            }));
        });
        filtresMatieres.replaceChildren(...puces);

        // Puces de catégories : le nombre tient compte de la matière et de la recherche en cours
        filtresCategories.replaceChildren(...CATEGORIES.map(categorie => {
            let nombre = etat.ressources.filter(r =>
                correspond(r, { ignorerCategorie: true }) && (categorie.valeur === "toutes" || r.categorie === categorie.valeur)
            ).length;
            return creerPuceFiltre(categorie.libelle, nombre, etat.filtreCategorie === categorie.valeur, () => {
                etat.filtreCategorie = categorie.valeur;
                afficher();
            });
        }));

        let visibles = etat.ressources.filter(r => correspond(r));
        grilleRessources.replaceChildren(...visibles.map(creerCarte));
        aucuneRessource.hidden = visibles.length > 0;
        aucuneRessource.textContent = etat.ressources.length === 0
            ? "Aucune ressource n'a encore été publiée. Reviens bientôt !"
            : "Aucune ressource ne correspond à ta recherche.";
        compteurResultats.textContent = visibles.length === 0
            ? ""
            : `${visibles.length} ressource${visibles.length > 1 ? "s" : ""}`;
    };

    let minuteurRecherche = null;
    champRecherche.addEventListener("input", () => {
        clearTimeout(minuteurRecherche);
        minuteurRecherche = setTimeout(() => {
            etat.recherche = normaliser(champRecherche.value.trim());
            afficher();
        }, 150);
    });

    // ---------- Charger la page ----------
    let initialiser = async () => {
        montrerVue("chargement");
        fermerVideo();

        try {
            let { data: sessionData } = await supabaseClient.auth.getSession();
            if (!sessionData.session) {
                montrerVue("connexion");
                return;
            }
            let utilisateur = sessionData.session.user;

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

            let [reponseMembre, reponseAdmin] = await Promise.all([
                supabaseClient.from("membres_classe").select("role")
                    .eq("classe_id", classe.id).eq("user_id", utilisateur.id).maybeSingle(),
                supabaseClient.from("admins").select("user_id")
                    .eq("user_id", utilisateur.id).maybeSingle()
            ]);
            if (reponseMembre.error) throw reponseMembre.error;
            if (reponseAdmin.error) throw reponseAdmin.error;

            let estAdmin = !!reponseAdmin.data;
            let estResponsable = !!reponseMembre.data && reponseMembre.data.role === "responsable";

            if (!reponseMembre.data && !estAdmin) {
                montrerVue("pasMembre");
                return;
            }

            lienDeposer.hidden = !(estResponsable || estAdmin);
            lienGerer.hidden = !estAdmin;

            let [reponseRessources, reponseMatieres] = await Promise.all([
                supabaseClient
                    .from("depots")
                    .select("id, matiere_id, titre, description, categorie, type_fichier, chemin_fichier, url, youtube_id, cree_le, publie_le, matieres_classe ( nom, ordre )")
                    .eq("classe_id", classe.id)
                    .eq("statut", "publie")
                    .order("publie_le", { ascending: false }),
                supabaseClient
                    .from("matieres_classe")
                    .select("id, nom, ordre")
                    .eq("classe_id", classe.id)
                    .order("ordre", { ascending: true })
                    .order("nom", { ascending: true })
            ]);
            if (reponseRessources.error) throw reponseRessources.error;
            if (reponseMatieres.error) throw reponseMatieres.error;

            etat.ressources = reponseRessources.data || [];
            etat.matieres = reponseMatieres.data || [];
            etat.filtreMatiere = "toutes";
            etat.filtreCategorie = "toutes";
            etat.recherche = "";
            champRecherche.value = "";

            montrerVue("espace");
            afficher();

        } catch (e) {
            console.error(e);
            montrerErreur("Impossible de charger l'espace L2. Vérifie ta connexion, puis réessaie.");
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
