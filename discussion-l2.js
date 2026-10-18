// ========================================================
// DISCUSSION L2 — messages écrits et vocaux
//
// Réservée aux membres de la classe (et à l'admin).
//  - messages écrits : 1000 caractères maximum
//  - vocaux : 2 minutes maximum, voix en mono, enregistrés en MP4 (AAC) quand le navigateur sait le faire,
//    fichiers dans le bucket privé "chat-l2"
//  - suppression : chacun supprime ses messages, l'admin et le responsable tous les messages
//  - fenêtre glissante de 7 jours : les messages plus anciens sont masqués
//    par la base (RLS) et supprimés chaque nuit par l'Edge Function
//    l2-chat-purge
//  - temps réel via Supabase Realtime, avec un rafraîchissement toutes les
//    30 secondes en secours si la connexion temps réel est coupée
//
// La vraie protection est en base (RLS + triggers) : ici on ne fait
// qu'afficher l'interface. Tout texte affiché passe par textContent.
// ========================================================
document.addEventListener("DOMContentLoaded", () => {

    let SLUG_CLASSE_L2 = "l2-gl-2026-2027";
    let BUCKET_CHAT = "chat-l2";
    let DUREE_MAX_VOCAL = 120;                 // secondes
    let TAILLE_MAX_VOCAL = 2 * 1024 * 1024;    // octets, comme le bucket
    let NB_MESSAGES_PAR_PAGE = 100;
    let INTERVALLE_RAFRAICHISSEMENT = 30000;   // millisecondes
    let SEPT_JOURS = 7 * 24 * 60 * 60 * 1000;
    let EXPIRATION_URL_VOCAL = 7200;           // secondes : durée de validité d'une adresse d'écoute
    let COLONNES = "id, classe_id, auteur_id, auteur_nom, type, contenu, chemin_audio, duree_secondes, cree_le";

    let vues = {
        chargement: document.querySelector("#vueChargement"),
        connexion: document.querySelector("#vueConnexion"),
        pasMembre: document.querySelector("#vuePasMembre"),
        erreur: document.querySelector("#vueErreur"),
        chat: document.querySelector("#vueChat")
    };

    let messageErreurL2 = document.querySelector("#messageErreurL2");
    let zoneMessages = document.querySelector("#zoneMessages");
    let listeMessages = document.querySelector("#listeMessages");
    let aucunMessage = document.querySelector("#aucunMessage");
    let boutonPlusAnciens = document.querySelector("#boutonPlusAnciens");
    let boutonNouveaux = document.querySelector("#boutonNouveaux");
    let erreurChat = document.querySelector("#erreurChat");
    let formMessage = document.querySelector("#formMessage");
    let champMessage = document.querySelector("#champMessage");
    let boutonEnvoyer = document.querySelector("#boutonEnvoyer");
    let boutonMicro = document.querySelector("#boutonMicro");
    let zoneEnregistrement = document.querySelector("#zoneEnregistrement");
    let chronoVocal = document.querySelector("#chronoVocal");
    let boutonAnnulerVocal = document.querySelector("#boutonAnnulerVocal");
    let boutonArreterVocal = document.querySelector("#boutonArreterVocal");
    let zoneApercuVocal = document.querySelector("#zoneApercuVocal");
    let lecteurApercu = document.querySelector("#lecteurApercu");
    let boutonSupprimerApercu = document.querySelector("#boutonSupprimerApercu");
    let boutonEnvoyerVocal = document.querySelector("#boutonEnvoyerVocal");

    let etat = {
        utilisateur: null,
        classe: null,
        estAdmin: false,
        peutModerer: false,        // admin et responsable : suppression de n'importe quel message
        messages: [],              // du plus ancien au plus récent
        ids: new Set(),
        plusAnciensDisponibles: false,
        canal: null,
        minuteurRafraichissement: null,
        urlsVocaux: new Map()      // chemin du fichier -> { url, expire } : adresses d'écoute préparées à l'avance
    };

    let lecteurActif = null;           // un seul vocal joue à la fois
    let minuteurErreur = null;

    // ---------- Utilitaires ----------
    let montrerVue = (nom) => {
        Object.keys(vues).forEach(cle => { vues[cle].hidden = cle !== nom; });
    };

    let montrerErreur = (message) => {
        messageErreurL2.textContent = message;
        montrerVue("erreur");
    };

    let afficherErreurChat = (texte) => {
        erreurChat.textContent = texte;
        erreurChat.classList.remove("chat-info");
        erreurChat.hidden = false;
        clearTimeout(minuteurErreur);
        minuteurErreur = setTimeout(() => { erreurChat.hidden = true; }, 7000);
    };

    // Même zone que les erreurs, mais avec un style neutre (conseils, pas de problème)
    let afficherInfoChat = (texte) => {
        afficherErreurChat(texte);
        erreurChat.classList.add("chat-info");
    };

    let effacerErreurChat = () => {
        clearTimeout(minuteurErreur);
        erreurChat.hidden = true;
    };

    let icone = (classes) => {
        let i = document.createElement("i");
        i.className = classes;
        return i;
    };

    let genererIdentifiant = () => {
        if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    };

    let formaterDuree = (secondes) => {
        let total = Math.max(0, Math.round(secondes));
        return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
    };

    let formaterHeure = (dateIso) => {
        return new Date(dateIso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    };

    let libelleDuJour = (dateIso) => {
        let date = new Date(dateIso);
        let aujourdhui = new Date();
        let hier = new Date();
        hier.setDate(aujourdhui.getDate() - 1);
        if (date.toDateString() === aujourdhui.toDateString()) return "Aujourd'hui";
        if (date.toDateString() === hier.toDateString()) return "Hier";
        return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    };

    let limiteSeptJours = () => new Date(Date.now() - SEPT_JOURS).toISOString();

    let estProcheDuBas = () => {
        return zoneMessages.scrollHeight - zoneMessages.scrollTop - zoneMessages.clientHeight < 120;
    };

    let defilerEnBas = () => {
        zoneMessages.scrollTop = zoneMessages.scrollHeight;
        boutonNouveaux.hidden = true;
    };

    zoneMessages.addEventListener("scroll", () => {
        if (estProcheDuBas()) boutonNouveaux.hidden = true;
    });
    boutonNouveaux.addEventListener("click", defilerEnBas);

    let traduireErreur = (error) => {
        console.error("Erreur Supabase (discussion L2) :", error);
        let texte = String(error.message || "");
        if (texte.includes("Trop de messages")) return "Tu envoies trop de messages d'un coup. Attends quelques secondes.";
        if (error.code === "42501") return "Tu n'as plus accès à la discussion. Recharge la page ou contacte l'administrateur.";
        return "Le message n'a pas pu être envoyé. Réessaie dans un instant.";
    };

    // ---------- Adresses d'écoute des vocaux ----------
    // Safari (iPhone, iPad) n'autorise la lecture d'un son que juste après un appui de l'utilisateur,
    // pas après une attente réseau. On prépare donc les adresses AVANT l'appui : au clic, la lecture
    // démarre immédiatement. Une seule requête pour tous les vocaux affichés.
    let preparerUrlsVocaux = async (messages) => {
        let maintenant = Date.now();
        let chemins = [...new Set(
            messages.filter(m => m.type === "vocal" && m.chemin_audio).map(m => m.chemin_audio)
        )].filter(chemin => {
            let entree = etat.urlsVocaux.get(chemin);
            return !entree || entree.expire - maintenant < 10 * 60 * 1000;   // pas encore prête, ou bientôt expirée
        });
        if (chemins.length === 0) return;

        try {
            let { data, error } = await supabaseClient.storage
                .from(BUCKET_CHAT)
                .createSignedUrls(chemins, EXPIRATION_URL_VOCAL);
            if (error || !data) {
                console.error("Adresses des vocaux :", error);
                return;
            }
            data.forEach(element => {
                if (element.signedUrl && !element.error) {
                    etat.urlsVocaux.set(element.path, {
                        url: element.signedUrl,
                        expire: maintenant + (EXPIRATION_URL_VOCAL - 60) * 1000
                    });
                }
            });
        } catch (e) {
            console.error("Adresses des vocaux :", e);
        }
    };

    // Formats que cet appareil sait lire (un iPad ancien ne lit pas le WebM)
    let TYPES_AUDIO = {
        webm: 'audio/webm; codecs="opus"',
        ogg: 'audio/ogg; codecs="opus"',
        mp4: "audio/mp4",
        mp3: "audio/mpeg"
    };
    let sondeAudio = new Audio();

    let formatLisible = (chemin) => {
        let extension = String(chemin || "").split(".").pop().toLowerCase();
        let type = TYPES_AUDIO[extension];
        return !type || sondeAudio.canPlayType(type) !== "";
    };

    let MESSAGE_FORMAT_NON_LISIBLE = "Ce vocal est dans un format que ton appareil ne sait pas lire. Mets à jour ton navigateur ou ton système, ou écoute-le sur un autre appareil.";

    // ---------- Lecteur d'un message vocal ----------
    let creerLecteurVocal = (message) => {
        let conteneur = document.createElement("div");

        let bloc = document.createElement("div");
        bloc.className = "chat-vocal";

        let bouton = document.createElement("button");
        bouton.type = "button";
        bouton.className = "chat-vocal-bouton";

        let piste = document.createElement("div");
        piste.className = "chat-vocal-piste";
        let progression = document.createElement("div");
        progression.className = "chat-vocal-progression";
        piste.appendChild(progression);

        let duree = document.createElement("span");
        duree.className = "chat-vocal-duree";
        duree.textContent = formaterDuree(message.duree_secondes);

        let majBouton = (enLecture) => {
            bouton.replaceChildren(icone(enLecture ? "fa-solid fa-pause" : "fa-solid fa-play"));
            bouton.setAttribute("aria-label", enLecture ? "Mettre le vocal en pause" : "Écouter le message vocal");
        };
        majBouton(false);

        bloc.append(bouton, piste, duree);
        conteneur.appendChild(bloc);

        // Format que cet appareil ne peut pas lire : on le dit tout de suite, sans bouton qui échoue
        if (!formatLisible(message.chemin_audio)) {
            bouton.disabled = true;
            bouton.setAttribute("aria-label", "Vocal non lisible sur cet appareil");
            let note = document.createElement("p");
            note.className = "chat-vocal-note";
            note.textContent = "Format non pris en charge par cet appareil";
            conteneur.appendChild(note);
            return conteneur;
        }

        let audio = null;
        let urlDuLecteur = null;

        let creerAudio = (url) => {
            let lecteur = new Audio();
            lecteur.preload = "auto";
            lecteur.addEventListener("timeupdate", () => {
                let total = message.duree_secondes || lecteur.duration || 1;
                progression.style.width = `${Math.min(1, lecteur.currentTime / total) * 100}%`;
                duree.textContent = formaterDuree(total - lecteur.currentTime);
            });
            lecteur.addEventListener("play", () => majBouton(true));
            lecteur.addEventListener("pause", () => majBouton(false));
            lecteur.addEventListener("ended", () => {
                progression.style.width = "0";
                duree.textContent = formaterDuree(message.duree_secondes);
                majBouton(false);
            });
            lecteur.addEventListener("error", () => {
                let code = lecteur.error ? lecteur.error.code : 0;
                console.error("Lecteur de vocal, code", code);
                afficherErreurChat(code === 4
                    ? MESSAGE_FORMAT_NON_LISIBLE
                    : "Impossible de lire ce message vocal. Vérifie ta connexion, puis réessaie.");
                majBouton(false);
            });
            lecteur.src = url;
            return lecteur;
        };

        // Retourne le lecteur tout de suite, ou null si l'adresse n'est pas encore prête
        let obtenirAudio = () => {
            let entree = etat.urlsVocaux.get(message.chemin_audio);
            if (!entree || entree.expire <= Date.now()) return null;
            // Adresse renouvelée : on change de lecteur, sauf s'il est en train de jouer
            if (audio && audio.paused && urlDuLecteur !== entree.url) audio = null;
            if (!audio) {
                audio = creerAudio(entree.url);
                urlDuLecteur = entree.url;
            }
            return audio;
        };

        bouton.addEventListener("click", () => {
            let lecteur = obtenirAudio();

            if (!lecteur) {
                // Rare : l'adresse n'est pas prête (réseau lent, ou page restée ouverte longtemps).
                // On la prépare, puis il faut appuyer une seconde fois.
                bouton.disabled = true;
                preparerUrlsVocaux([message]).then(() => {
                    bouton.disabled = false;
                    if (etat.urlsVocaux.has(message.chemin_audio)) {
                        afficherInfoChat("Le vocal est prêt : appuie une seconde fois sur lecture.");
                    } else {
                        afficherErreurChat("Ce message vocal n'est plus disponible.");
                    }
                });
                return;
            }

            if (!lecteur.paused) {
                lecteur.pause();
                return;
            }

            if (lecteurActif && lecteurActif !== lecteur) lecteurActif.pause();
            lecteurActif = lecteur;

            // play() est appelé directement dans le clic : c'est ce qu'exige Safari
            let promesse = lecteur.play();
            if (promesse && promesse.catch) {
                promesse.catch((e) => {
                    console.error("Lecture du vocal :", e);
                    if (e && e.name === "NotAllowedError") {
                        afficherInfoChat("Ton navigateur a bloqué la lecture : appuie à nouveau sur lecture.");
                    } else if (e && e.name === "NotSupportedError") {
                        afficherErreurChat(MESSAGE_FORMAT_NON_LISIBLE);
                    } else {
                        afficherErreurChat("Impossible de lire ce message vocal. Vérifie ta connexion, puis réessaie.");
                    }
                });
            }
        });

        return conteneur;
    };

    // ---------- Éléments d'un message ----------
    let creerSeparateurJour = (dateIso) => {
        let separateur = document.createElement("div");
        separateur.className = "chat-jour";
        separateur.textContent = libelleDuJour(dateIso);
        return separateur;
    };

    let creerElementMessage = (message) => {
        let estPropre = message.auteur_id === etat.utilisateur.id;

        let conteneur = document.createElement("article");
        conteneur.className = `chat-message${estPropre ? " chat-message-propre" : ""}`;
        conteneur.dataset.id = message.id;

        if (!estPropre) {
            let auteur = document.createElement("span");
            auteur.className = "chat-auteur";
            auteur.textContent = message.auteur_nom || "Étudiant";
            conteneur.appendChild(auteur);
        }

        let bulle = document.createElement("div");
        bulle.className = "chat-bulle";
        if (message.type === "vocal") {
            bulle.appendChild(creerLecteurVocal(message));
        } else {
            let texte = document.createElement("p");
            texte.className = "chat-texte";
            texte.textContent = message.contenu;
            bulle.appendChild(texte);
        }
        conteneur.appendChild(bulle);

        let infos = document.createElement("div");
        infos.className = "chat-infos";
        let heure = document.createElement("span");
        heure.textContent = formaterHeure(message.cree_le);
        infos.appendChild(heure);

        if (estPropre || etat.peutModerer) {
            let boutonSupprimer = document.createElement("button");
            boutonSupprimer.type = "button";
            boutonSupprimer.className = "chat-supprimer";
            boutonSupprimer.textContent = "Supprimer";
            if (!estPropre) boutonSupprimer.setAttribute("aria-label", `Supprimer le message de ${message.auteur_nom || "cet étudiant"} (modération)`);
            boutonSupprimer.addEventListener("click", () => supprimerMessage(message));
            infos.appendChild(boutonSupprimer);
        }
        conteneur.appendChild(infos);

        return conteneur;
    };

    // Reconstruit toute la liste (chargement initial, messages plus anciens, suppression)
    let rendreListeComplete = () => {
        let elements = [];
        let jourPrecedent = null;
        etat.messages.forEach(message => {
            let jour = new Date(message.cree_le).toDateString();
            if (jour !== jourPrecedent) {
                elements.push(creerSeparateurJour(message.cree_le));
                jourPrecedent = jour;
            }
            elements.push(creerElementMessage(message));
        });
        listeMessages.replaceChildren(...elements);
        aucunMessage.hidden = etat.messages.length > 0;
        boutonPlusAnciens.hidden = !etat.plusAnciensDisponibles;
    };

    // Ajoute un message à la fin, sans toucher aux vocaux en cours de lecture
    let ajouterMessage = (message, forcerDefilement) => {
        if (etat.ids.has(message.id)) return;

        let precedent = etat.messages[etat.messages.length - 1];
        let doitDefiler = forcerDefilement || message.auteur_id === etat.utilisateur.id || estProcheDuBas();

        etat.messages.push(message);
        etat.ids.add(message.id);
        aucunMessage.hidden = true;
        if (message.type === "vocal") preparerUrlsVocaux([message]);

        if (!precedent || new Date(precedent.cree_le).toDateString() !== new Date(message.cree_le).toDateString()) {
            listeMessages.appendChild(creerSeparateurJour(message.cree_le));
        }
        listeMessages.appendChild(creerElementMessage(message));

        if (doitDefiler) {
            defilerEnBas();
        } else {
            boutonNouveaux.hidden = false;
        }
    };

    let retirerMessage = (idMessage) => {
        if (!etat.ids.has(idMessage)) return;
        etat.ids.delete(idMessage);
        etat.messages = etat.messages.filter(m => m.id !== idMessage);
        rendreListeComplete();
    };

    // ---------- Chargement des messages ----------
    let chargerMessages = async () => {
        let { data, error } = await supabaseClient
            .from("messages_l2")
            .select(COLONNES)
            .eq("classe_id", etat.classe.id)
            .gt("cree_le", limiteSeptJours())
            .order("cree_le", { ascending: false })
            .limit(NB_MESSAGES_PAR_PAGE);
        if (error) throw error;

        etat.messages = (data || []).reverse();
        etat.ids = new Set(etat.messages.map(m => m.id));
        etat.plusAnciensDisponibles = (data || []).length === NB_MESSAGES_PAR_PAGE;
        rendreListeComplete();
        defilerEnBas();
        preparerUrlsVocaux(etat.messages);
    };

    let chargerPlusAnciens = async () => {
        if (etat.messages.length === 0) return;
        boutonPlusAnciens.disabled = true;
        try {
            let { data, error } = await supabaseClient
                .from("messages_l2")
                .select(COLONNES)
                .eq("classe_id", etat.classe.id)
                .gt("cree_le", limiteSeptJours())
                .lt("cree_le", etat.messages[0].cree_le)
                .order("cree_le", { ascending: false })
                .limit(NB_MESSAGES_PAR_PAGE);
            if (error) throw error;

            let hauteurAvant = zoneMessages.scrollHeight;
            let nouveaux = (data || []).reverse().filter(m => !etat.ids.has(m.id));
            nouveaux.forEach(m => etat.ids.add(m.id));
            etat.messages = [...nouveaux, ...etat.messages];
            etat.plusAnciensDisponibles = (data || []).length === NB_MESSAGES_PAR_PAGE;
            rendreListeComplete();
            // On garde la position de lecture
            zoneMessages.scrollTop = zoneMessages.scrollHeight - hauteurAvant;
            preparerUrlsVocaux(nouveaux);
        } catch (e) {
            console.error(e);
            afficherErreurChat("Impossible de charger les messages précédents.");
        } finally {
            boutonPlusAnciens.disabled = false;
        }
    };

    boutonPlusAnciens.addEventListener("click", chargerPlusAnciens);

    // Secours si le temps réel est coupé : on va chercher ce qui est arrivé depuis le dernier message
    let chargerNouveaux = async () => {
        if (!etat.classe || !etat.utilisateur) return;
        let dernier = etat.messages[etat.messages.length - 1];
        let requete = supabaseClient
            .from("messages_l2")
            .select(COLONNES)
            .eq("classe_id", etat.classe.id)
            .gt("cree_le", dernier ? dernier.cree_le : limiteSeptJours())
            .order("cree_le", { ascending: true })
            .limit(NB_MESSAGES_PAR_PAGE);
        let { data, error } = await requete;
        if (error) {
            console.error("Rafraîchissement :", error);
            return;
        }
        (data || []).forEach(m => ajouterMessage(m, false));
    };

    // ---------- Temps réel ----------
    let arreterTempsReel = () => {
        clearInterval(etat.minuteurRafraichissement);
        etat.minuteurRafraichissement = null;
        if (etat.canal) {
            supabaseClient.removeChannel(etat.canal);
            etat.canal = null;
        }
    };

    let demarrerTempsReel = () => {
        arreterTempsReel();

        etat.canal = supabaseClient
            .channel(`discussion-l2-${etat.classe.id}`)
            .on("postgres_changes",
                { event: "INSERT", schema: "public", table: "messages_l2", filter: `classe_id=eq.${etat.classe.id}` },
                (charge) => ajouterMessage(charge.new, false))
            .on("postgres_changes",
                { event: "DELETE", schema: "public", table: "messages_l2" },
                (charge) => { if (charge.old && charge.old.id) retirerMessage(charge.old.id); })
            .subscribe();

        etat.minuteurRafraichissement = setInterval(() => {
            if (!document.hidden) {
                chargerNouveaux();
                preparerUrlsVocaux(etat.messages);   // renouvelle les adresses bientôt expirées
            }
        }, INTERVALLE_RAFRAICHISSEMENT);
    };

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) chargerNouveaux();
    });

    // ---------- Supprimer un message ----------
    let supprimerMessage = async (message) => {
        let estPropre = message.auteur_id === etat.utilisateur.id;
        let question = estPropre
            ? "Supprimer ton message ?"
            : `Supprimer le message de ${message.auteur_nom || "cet étudiant"} ? Cette action est définitive.`;
        if (!confirm(question)) return;
        try {
            if (message.type === "vocal" && message.chemin_audio) {
                let { error: erreurFichier } = await supabaseClient.storage.from(BUCKET_CHAT).remove([message.chemin_audio]);
                if (erreurFichier) console.error("Suppression du fichier :", erreurFichier);
            }
            let { error } = await supabaseClient.from("messages_l2").delete().eq("id", message.id);
            if (error) {
                console.error("Erreur Supabase (suppression) :", error);
                afficherErreurChat("Suppression impossible pour le moment.");
                return;
            }
            retirerMessage(message.id);
        } catch (e) {
            console.error(e);
            afficherErreurChat("Erreur réseau. Réessaie dans un instant.");
        }
    };

    // ---------- Envoyer un message écrit ----------
    let ajusterHauteurChamp = () => {
        champMessage.style.height = "auto";
        champMessage.style.height = `${Math.min(champMessage.scrollHeight, 140)}px`;
    };

    champMessage.addEventListener("input", () => {
        ajusterHauteurChamp();
        effacerErreurChat();
    });

    // Sur ordinateur, Entrée envoie (Maj+Entrée = nouvelle ligne). Sur téléphone, Entrée = nouvelle ligne.
    champMessage.addEventListener("keydown", (e) => {
        let ecranTactile = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !ecranTactile) {
            e.preventDefault();
            if (formMessage.requestSubmit) formMessage.requestSubmit();
            else formMessage.dispatchEvent(new Event("submit", { cancelable: true }));
        }
    });

    formMessage.addEventListener("submit", async (e) => {
        e.preventDefault();
        let texte = champMessage.value.trim();
        if (!texte) return;
        if (texte.length > 1000) {
            afficherErreurChat("Ton message dépasse 1000 caractères.");
            return;
        }

        boutonEnvoyer.disabled = true;
        try {
            let { data, error } = await supabaseClient
                .from("messages_l2")
                .insert({
                    classe_id: etat.classe.id,
                    auteur_id: etat.utilisateur.id,
                    type: "texte",
                    contenu: texte
                })
                .select(COLONNES)
                .single();

            if (error) {
                afficherErreurChat(traduireErreur(error));
                return;
            }
            champMessage.value = "";
            ajusterHauteurChamp();
            effacerErreurChat();
            ajouterMessage(data, true);
        } catch (erreurReseau) {
            console.error(erreurReseau);
            afficherErreurChat("Erreur réseau. Vérifie ta connexion, puis réessaie.");
        } finally {
            boutonEnvoyer.disabled = false;
            champMessage.focus();
        }
    });

    // ---------- Message vocal : enregistrement, aperçu, envoi ----------
    let enregistrement = {
        flux: null,
        enregistreur: null,
        morceaux: [],
        debut: 0,
        minuteur: null,
        annule: false,
        blob: null,
        duree: 0,
        urlApercu: null
    };

    let afficherEtatSaisie = (nom) => {
        formMessage.hidden = nom !== "repos";
        zoneEnregistrement.hidden = nom !== "enregistrement";
        zoneApercuVocal.hidden = nom !== "apercu";
    };

    let libererMicro = () => {
        if (enregistrement.flux) {
            enregistrement.flux.getTracks().forEach(piste => piste.stop());
            enregistrement.flux = null;
        }
    };

    let reinitialiserVocal = () => {
        clearInterval(enregistrement.minuteur);
        libererMicro();
        if (enregistrement.urlApercu) URL.revokeObjectURL(enregistrement.urlApercu);
        lecteurApercu.pause();
        lecteurApercu.removeAttribute("src");
        lecteurApercu.load();
        enregistrement.enregistreur = null;
        enregistrement.morceaux = [];
        enregistrement.blob = null;
        enregistrement.urlApercu = null;
        enregistrement.annule = false;
        chronoVocal.textContent = "0:00";
        boutonMicro.disabled = false;
        boutonEnvoyerVocal.disabled = false;
        boutonSupprimerApercu.disabled = false;
        afficherEtatSaisie("repos");
    };

    let choisirTypeMime = () => {
        // MP4 (AAC) en premier : il se lit partout, y compris sur les iPad et iPhone anciens qui ne lisent pas le WebM.
        // Chrome, Edge, Android et Safari récents savent l'enregistrer ; sinon on retombe sur WebM ou Ogg.
        let candidats = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
        return candidats.find(type => window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(type)) || "";
    };

    let terminerEnregistrement = (annuler) => {
        enregistrement.annule = annuler;
        let enregistreur = enregistrement.enregistreur;
        if (enregistreur && enregistreur.state !== "inactive") {
            enregistreur.stop();
        } else {
            reinitialiserVocal();
        }
    };

    let demarrerEnregistrement = async () => {
        effacerErreurChat();

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
            afficherErreurChat("Ton navigateur ne permet pas d'enregistrer un vocal. Essaie avec une version récente de Chrome ou de Safari.");
            return;
        }

        boutonMicro.disabled = true;
        let flux;
        try {
            // Voix seule (mono) avec suppression d'écho et de bruit, pour un son net même dans une salle
            flux = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });
        } catch (e) {
            console.error(e);
            boutonMicro.disabled = false;
            afficherErreurChat(e && e.name === "NotAllowedError"
                ? "Le micro est bloqué. Autorise-le dans les réglages de ton navigateur, puis réessaie."
                : "Aucun micro n'a été trouvé sur cet appareil.");
            return;
        }

        // 48 kbit/s en Opus (Chrome, Android) et 64 kbit/s en AAC (Safari, iPhone) :
        // voix nette, et 2 minutes restent sous 1 Mo
        let type = choisirTypeMime();
        let options = { audioBitsPerSecond: type.includes("mp4") ? 64000 : 48000 };
        if (type) options.mimeType = type;

        let enregistreur;
        try {
            enregistreur = new MediaRecorder(flux, options);
        } catch (_) {
            try {
                enregistreur = new MediaRecorder(flux);
            } catch (e) {
                console.error(e);
                flux.getTracks().forEach(piste => piste.stop());
                boutonMicro.disabled = false;
                afficherErreurChat("L'enregistrement vocal n'est pas disponible sur cet appareil.");
                return;
            }
        }

        enregistrement.flux = flux;
        enregistrement.enregistreur = enregistreur;
        enregistrement.morceaux = [];
        enregistrement.annule = false;

        enregistreur.addEventListener("dataavailable", (evenement) => {
            if (evenement.data && evenement.data.size > 0) enregistrement.morceaux.push(evenement.data);
        });

        enregistreur.addEventListener("stop", () => {
            clearInterval(enregistrement.minuteur);
            libererMicro();

            if (enregistrement.annule) {
                reinitialiserVocal();
                return;
            }

            let dureeMesuree = Math.round((Date.now() - enregistrement.debut) / 1000);
            if (dureeMesuree < 1) {
                reinitialiserVocal();
                afficherErreurChat("Vocal trop court : maintiens l'enregistrement au moins une seconde.");
                return;
            }

            let blob = new Blob(enregistrement.morceaux, { type: enregistreur.mimeType || type || "audio/webm" });
            if (blob.size === 0 || blob.size > TAILLE_MAX_VOCAL) {
                reinitialiserVocal();
                afficherErreurChat(blob.size === 0 ? "L'enregistrement est vide." : "Ce vocal est trop lourd (2 Mo maximum).");
                return;
            }

            enregistrement.blob = blob;
            enregistrement.duree = Math.min(DUREE_MAX_VOCAL, dureeMesuree);
            enregistrement.urlApercu = URL.createObjectURL(blob);
            lecteurApercu.src = enregistrement.urlApercu;
            afficherEtatSaisie("apercu");
        });

        enregistreur.start();
        enregistrement.debut = Date.now();
        chronoVocal.textContent = "0:00";
        afficherEtatSaisie("enregistrement");

        enregistrement.minuteur = setInterval(() => {
            let ecoule = (Date.now() - enregistrement.debut) / 1000;
            chronoVocal.textContent = formaterDuree(Math.floor(ecoule));
            if (ecoule >= DUREE_MAX_VOCAL) {
                terminerEnregistrement(false);
                afficherErreurChat("Durée maximale atteinte (2 minutes) : écoute ton vocal, puis envoie-le.");
            }
        }, 250);
    };

    // Format du fichier selon ce que le navigateur a produit (Chrome : webm, Safari : mp4)
    let deduireFormat = (typeMime) => {
        let type = String(typeMime || "").toLowerCase();
        if (type.includes("mp4") || type.includes("aac")) return { extension: "mp4", typeContenu: "audio/mp4" };
        if (type.includes("ogg")) return { extension: "ogg", typeContenu: "audio/ogg" };
        if (type.includes("mpeg")) return { extension: "mp3", typeContenu: "audio/mpeg" };
        return { extension: "webm", typeContenu: "audio/webm" };
    };

    let envoyerVocal = async () => {
        if (!enregistrement.blob) return;

        boutonEnvoyerVocal.disabled = true;
        boutonSupprimerApercu.disabled = true;
        lecteurApercu.pause();

        let { extension, typeContenu } = deduireFormat(enregistrement.blob.type);
        let chemin = `${etat.classe.id}/${etat.utilisateur.id}/${genererIdentifiant()}.${extension}`;

        try {
            let { error: erreurEnvoi } = await supabaseClient.storage
                .from(BUCKET_CHAT)
                .upload(chemin, enregistrement.blob, { contentType: typeContenu, upsert: false });
            if (erreurEnvoi) {
                console.error("Envoi du vocal :", erreurEnvoi);
                afficherErreurChat("Le vocal n'a pas pu être envoyé. Réessaie dans un instant.");
                boutonEnvoyerVocal.disabled = false;
                boutonSupprimerApercu.disabled = false;
                return;
            }

            let { data, error } = await supabaseClient
                .from("messages_l2")
                .insert({
                    classe_id: etat.classe.id,
                    auteur_id: etat.utilisateur.id,
                    type: "vocal",
                    chemin_audio: chemin,
                    duree_secondes: enregistrement.duree
                })
                .select(COLONNES)
                .single();

            if (error) {
                // Le message n'a pas été créé : on retire le fichier pour ne pas laisser d'orphelin
                await supabaseClient.storage.from(BUCKET_CHAT).remove([chemin]);
                afficherErreurChat(traduireErreur(error));
                boutonEnvoyerVocal.disabled = false;
                boutonSupprimerApercu.disabled = false;
                return;
            }

            reinitialiserVocal();
            ajouterMessage(data, true);
        } catch (e) {
            console.error(e);
            afficherErreurChat("Erreur réseau. Vérifie ta connexion, puis réessaie.");
            boutonEnvoyerVocal.disabled = false;
            boutonSupprimerApercu.disabled = false;
        }
    };

    boutonMicro.addEventListener("click", demarrerEnregistrement);
    boutonAnnulerVocal.addEventListener("click", () => terminerEnregistrement(true));
    boutonArreterVocal.addEventListener("click", () => terminerEnregistrement(false));
    boutonSupprimerApercu.addEventListener("click", reinitialiserVocal);
    boutonEnvoyerVocal.addEventListener("click", envoyerVocal);

    // Si l'utilisateur quitte la page pendant un enregistrement, on coupe le micro
    window.addEventListener("pagehide", () => {
        if (enregistrement.enregistreur && enregistrement.enregistreur.state !== "inactive") {
            terminerEnregistrement(true);
        }
    });

    // ---------- Charger la page ----------
    let initialiser = async () => {
        montrerVue("chargement");
        arreterTempsReel();
        etat.urlsVocaux.clear();
        if (lecteurActif) {
            lecteurActif.pause();
            lecteurActif = null;
        }
        reinitialiserVocal();

        try {
            let { data: sessionData } = await supabaseClient.auth.getSession();
            if (!sessionData.session) {
                etat.utilisateur = null;
                montrerVue("connexion");
                return;
            }
            etat.utilisateur = sessionData.session.user;

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
            etat.classe = classe;

            let [reponseMembre, reponseAdmin] = await Promise.all([
                supabaseClient.from("membres_classe").select("role")
                    .eq("classe_id", classe.id).eq("user_id", etat.utilisateur.id).maybeSingle(),
                supabaseClient.from("admins").select("user_id")
                    .eq("user_id", etat.utilisateur.id).maybeSingle()
            ]);
            if (reponseMembre.error) throw reponseMembre.error;
            if (reponseAdmin.error) throw reponseAdmin.error;

            etat.estAdmin = !!reponseAdmin.data;
            if (!reponseMembre.data && !etat.estAdmin) {
                montrerVue("pasMembre");
                return;
            }
            etat.peutModerer = etat.estAdmin || (!!reponseMembre.data && reponseMembre.data.role === "responsable");

            montrerVue("chat");
            await chargerMessages();
            demarrerTempsReel();

            // La bannière du site est haute : on amène directement la discussion à l'écran
            let titrePage = document.querySelector(".titre-acces-l2");
            if (titrePage && window.scrollY < 600) titrePage.scrollIntoView({ block: "start" });
        } catch (e) {
            console.error(e);
            montrerErreur("Impossible de charger la discussion. Vérifie ta connexion, puis réessaie.");
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