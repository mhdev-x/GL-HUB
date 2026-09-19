// ========================================================
// ACCÈS AUX RESSOURCES — GL HUB
// Remplace paywall.js : plus de paiement, le déblocage se fait par quiz.
//
//  - Visiteur : voit toutes les matières, mais doit se connecter
//    pour lire ou télécharger.
//  - Connecté : la 1re ressource de chaque matière est libre.
//    Réussir le quiz d'une ressource (70 % minimum) débloque la suivante.
//
// La vraie protection est côté serveur (Edge Functions quiz-start,
// quiz-submit et resource-access) : ici on ne fait qu'afficher l'interface.
// ========================================================
document.addEventListener("DOMContentLoaded", async () => {

    let slugMatiere = document.body.dataset.matiere;
    if (!slugMatiere) return;

    // ---------- Petits outils pour construire l'interface (jamais d'innerHTML avec du texte venant de la base) ----------
    let el = (balise, classe, texte) => {
        let element = document.createElement(balise);
        if (classe) element.className = classe;
        if (texte !== undefined) element.textContent = texte;
        return element;
    };

    let icone = (classes) => {
        let i = document.createElement("i");
        i.className = classes;
        return i;
    };

    let creerBouton = (classes, classesIcone, texte) => {
        let bouton = el("button", classes);
        bouton.type = "button";
        if (classesIcone) bouton.appendChild(icone(classesIcone));
        bouton.append(texte);
        return bouton;
    };

    let notifier = (message, classesIcone = "fa-solid fa-circle-info") => {
        if (window.afficherToast) window.afficherToast(message, classesIcone);
    };

    let formaterDuree = (secondes) => {
        let minutes = Math.floor(secondes / 60);
        let reste = String(secondes % 60).padStart(2, "0");
        return `${minutes}:${reste}`;
    };

    // ---------- Appeler une Edge Function et récupérer aussi le message d'erreur du serveur ----------
    let appelerFonction = async (nom, corps) => {
        try {
            let { data, error } = await supabaseClient.functions.invoke(nom, { body: corps });
            if (!error) return { data, erreur: null, statut: 200 };

            let statut = 0;
            let detail = null;
            if (error.context && typeof error.context.json === "function") {
                statut = error.context.status;
                try { detail = await error.context.json(); } catch (_) { /* pas de JSON */ }
            }
            console.error(`Fonction ${nom} : ${error.name || "erreur"} (code ${statut || "?"})`, detail || error);

            // 1) Message renvoyé par notre fonction
            if (detail && detail.error) return { data: detail, erreur: detail.error, statut };

            // 2) Message renvoyé par Supabase lui-même (fonction introuvable, JWT refusé, plantage au démarrage...)
            if (detail && (detail.message || detail.msg)) {
                return { data: detail, erreur: `Erreur du serveur : ${detail.message || detail.msg} (code ${statut})`, statut };
            }

            // 3) Pas de réponse exploitable (réseau, CORS...)
            if (error.name === "FunctionsFetchError") {
                return { data: null, erreur: "Impossible de joindre le serveur (réseau ou CORS). Vérifie ta connexion.", statut: 0 };
            }
            return { data: detail, erreur: `Une erreur est survenue (code ${statut || "inconnu"}). Réessaie dans un instant.`, statut };
        } catch (e) {
            console.error(e);
            return { data: null, erreur: "Connexion impossible. Vérifie ton réseau.", statut: 0 };
        }
    };

    // ========================================================
    // LIRE / TÉLÉCHARGER
    // ========================================================
    // Message d'erreur lisible à partir de la réponse du serveur
    let expliquerErreur = (detail, statut) => {
        if (detail && detail.error) return detail.error;
        if (detail && (detail.message || detail.msg)) return `Erreur du serveur : ${detail.message || detail.msg} (code ${statut})`;
        return `Une erreur est survenue (code ${statut || "inconnu"}). Réessaie dans un instant.`;
    };

    // Récupère le fichier lui-même via l'Edge Function : le serveur vérifie ton accès puis renvoie le fichier.
    // Aucun lien partageable n'existe : personne d'autre ne peut ouvrir "ton" lien.
    let recupererFichier = async (ressource, action) => {
        try {
            let { data: sessionData } = await supabaseClient.auth.getSession();
            let session = sessionData.session;
            if (!session) return { erreur: "Connecte-toi pour accéder aux ressources.", statut: 401 };

            let urlSupabase = typeof SUPABASE_URL !== "undefined" ? SUPABASE_URL : supabaseClient.supabaseUrl;
            let cleAnon = typeof SUPABASE_ANON_KEY !== "undefined" ? SUPABASE_ANON_KEY : supabaseClient.supabaseKey;

            let reponse = await fetch(`${urlSupabase}/functions/v1/resource-access`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                    "apikey": cleAnon,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ ressource_id: ressource.id, action })
            });

            if (reponse.ok) {
                return { blob: await reponse.blob(), type: reponse.headers.get("Content-Type") || "" };
            }

            let detail = null;
            try { detail = await reponse.json(); } catch (_) { /* pas de JSON */ }
            console.error(`Fonction resource-access (code ${reponse.status})`, detail);
            return { erreur: expliquerErreur(detail, reponse.status), data: detail, statut: reponse.status };
        } catch (e) {
            console.error(e);
            return { erreur: "Impossible de joindre le serveur (réseau ou CORS). Vérifie ta connexion.", statut: 0 };
        }
    };

    let ouvrirRessource = async (ressource, action, bouton) => {
        let contenuOriginal = Array.from(bouton.childNodes);
        bouton.disabled = true;
        bouton.replaceChildren(icone("fa-solid fa-spinner fa-spin"), "Chargement...");

        // Pour la lecture, on ouvre l'onglet tout de suite (sinon certains navigateurs mobiles bloquent la fenêtre)
        let fenetre = action === "lecture" ? window.open("", "_blank") : null;

        let resultat = await recupererFichier(ressource, action);

        bouton.disabled = false;
        bouton.replaceChildren(...contenuOriginal);

        if (resultat.erreur || !resultat.blob) {
            if (fenetre) fenetre.close();
            let detailAdmin = resultat.data && resultat.data.detail ? ` (${resultat.data.detail})` : "";
            if (detailAdmin) console.error("resource-access :", resultat.data.detail);
            notifier((resultat.erreur || "Impossible d'ouvrir ce fichier pour le moment.") + detailAdmin, "fa-solid fa-triangle-exclamation");
            return;
        }

        // Le fichier est maintenant dans le navigateur : l'adresse "blob:" n'existe que dans CET onglet et ne peut pas être partagée
        let nomFichier = String(ressource.chemin_fichier || "ressource.pdf").split("/").pop();
        let typeFichier = /\.pdf$/i.test(nomFichier) ? "application/pdf" : (resultat.type || "application/octet-stream");
        let adresseLocale = URL.createObjectURL(new Blob([resultat.blob], { type: typeFichier }));

        if (action === "lecture") {
            if (fenetre) fenetre.location.href = adresseLocale;
            else window.location.assign(adresseLocale); // popup bloquée : on ouvre dans l'onglet courant
        } else {
            let lien = document.createElement("a");
            lien.href = adresseLocale;
            lien.download = nomFichier;
            document.body.appendChild(lien);
            lien.click();
            lien.remove();
            setTimeout(() => URL.revokeObjectURL(adresseLocale), 60000);
        }
    };

    // ========================================================
    // QUIZ
    // ========================================================
    let ouvrirQuiz = async (ressource, bouton) => {
        let contenuOriginal = bouton ? Array.from(bouton.childNodes) : null;
        if (bouton) {
            bouton.disabled = true;
            bouton.replaceChildren(icone("fa-solid fa-spinner fa-spin"), "Préparation...");
        }

        let { data, erreur, statut } = await appelerFonction("quiz-start", { ressource_id: ressource.id });

        if (bouton) {
            bouton.disabled = false;
            bouton.replaceChildren(...contenuOriginal);
        }

        if (erreur) {
            if (statut === 429 && data && data.reessayer_dans) {
                notifier(`Patiente encore ${formaterDuree(data.reessayer_dans)} avant de réessayer.`, "fa-solid fa-hourglass-half");
            } else if (statut === 404) {
                notifier("Le quiz de cette ressource n'est pas encore disponible.", "fa-solid fa-circle-info");
            } else {
                notifier(erreur, "fa-solid fa-triangle-exclamation");
            }
            return;
        }

        afficherModaleQuiz(ressource, data);
    };

    let afficherModaleQuiz = (ressource, quiz) => {
        let questions = quiz.questions;
        let reponses = {};      // { id_question: id_option }
        let index = 0;
        let doitRecharger = false;
        let minuteur = null;

        let voile = el("div", "voile visible");
        let modale = el("div", "modale visible modale-quiz");
        document.body.append(voile, modale);

        let fermer = () => {
            clearInterval(minuteur);
            voile.remove();
            modale.remove();
            if (doitRecharger) location.reload(); // met à jour les cadenas et les boutons
        };

        let creerBoutonFermer = () => {
            let bouton = el("button", "bouton-fermer");
            bouton.type = "button";
            bouton.setAttribute("aria-label", "Fermer");
            bouton.appendChild(icone("fa-solid fa-xmark"));
            bouton.addEventListener("click", fermer);
            return bouton;
        };

        let creerEntete = () => {
            let titre = el("h3", "titre-quiz");
            titre.append(icone("fa-solid fa-circle-question"), " Quiz");
            return [creerBoutonFermer(), titre, el("p", "sous-titre-quiz", ressource.titre)];
        };

        // ---------- Une question à la fois ----------
        let afficherQuestion = () => {
            let question = questions[index];
            let derniere = index === questions.length - 1;

            let progression = el("div", "progression-quiz");
            let barre = el("div");
            barre.style.width = `${(index / questions.length) * 100}%`;
            progression.appendChild(barre);

            let boutonSuivant = creerBouton(
                "bouton-accent",
                derniere ? "fa-solid fa-check" : "fa-solid fa-arrow-right",
                derniere ? "Terminer" : "Suivant"
            );
            boutonSuivant.disabled = reponses[question.id] === undefined;
            boutonSuivant.addEventListener("click", () => {
                if (derniere) envoyer();
                else { index++; afficherQuestion(); }
            });

            let liste = el("div", "options-quiz");
            question.options.forEach(option => {
                let boutonOption = el("button", "option-quiz", option.texte);
                boutonOption.type = "button";
                if (reponses[question.id] === option.id) boutonOption.classList.add("selectionnee");
                boutonOption.addEventListener("click", () => {
                    reponses[question.id] = option.id;
                    liste.querySelectorAll(".option-quiz").forEach(b => b.classList.remove("selectionnee"));
                    boutonOption.classList.add("selectionnee");
                    boutonSuivant.disabled = false;
                });
                liste.appendChild(boutonOption);
            });

            let actions = el("div", "actions-quiz");
            if (index > 0) {
                let boutonPrecedent = creerBouton("bouton-secondaire", "fa-solid fa-arrow-left", "Précédent");
                boutonPrecedent.addEventListener("click", () => { index--; afficherQuestion(); });
                actions.appendChild(boutonPrecedent);
            }
            actions.appendChild(boutonSuivant);

            modale.replaceChildren(
                ...creerEntete(),
                progression,
                el("p", "compteur-quiz", `Question ${index + 1} sur ${questions.length}`),
                el("p", "question-quiz", question.question),
                liste,
                actions
            );
        };

        // ---------- Envoi des réponses ----------
        let envoyer = async () => {
            modale.replaceChildren(
                creerBoutonFermer(),
                el("p", "message-quiz-attente")
            );
            let attente = modale.querySelector(".message-quiz-attente");
            attente.append(icone("fa-solid fa-spinner fa-spin"), " Correction en cours...");

            let { data, erreur } = await appelerFonction("quiz-submit", {
                tentative_id: quiz.tentative_id,
                reponses
            });

            if (erreur) {
                let boutonReessayer = creerBouton("bouton-accent", "fa-solid fa-rotate-right", "Réessayer l'envoi");
                boutonReessayer.addEventListener("click", envoyer);
                let boutonAnnuler = creerBouton("bouton-secondaire", "", "Fermer");
                boutonAnnuler.addEventListener("click", fermer);
                let actions = el("div", "actions-quiz");
                actions.append(boutonAnnuler, boutonReessayer);

                modale.replaceChildren(
                    creerBoutonFermer(),
                    el("p", "message-erreur", erreur),
                    actions
                );
                return;
            }

            afficherResultat(data);
        };

        // ---------- Correction (affichée seulement après une réussite) ----------
        let creerCorrection = (correction) => {
            let bloc = el("div", "correction-quiz");
            questions.forEach(question => {
                let ligne = correction.find(c => c.question_id === question.id);
                if (!ligne) return;

                let texteDe = (idOption) => {
                    let option = question.options.find(o => o.id === idOption);
                    return option ? option.texte : "(sans réponse)";
                };

                let element = el("div", "element-correction");
                element.appendChild(el("p", "question-correction", question.question));

                let bonneReponse = el("p", "reponse-juste");
                bonneReponse.append(icone("fa-solid fa-circle-check"), ` ${texteDe(ligne.index_correct)}`);
                element.appendChild(bonneReponse);

                if (reponses[question.id] !== ligne.index_correct) {
                    let tienne = el("p", "reponse-fausse");
                    tienne.append(icone("fa-solid fa-circle-xmark"), ` Ta réponse : ${texteDe(reponses[question.id])}`);
                    element.appendChild(tienne);
                }

                if (ligne.explication) {
                    let explication = el("p", "explication-quiz");
                    explication.append(icone("fa-solid fa-lightbulb"), ` ${ligne.explication}`);
                    element.appendChild(explication);
                }

                bloc.appendChild(element);
            });
            return bloc;
        };

        // ---------- Résultat ----------
        let afficherResultat = (resultat) => {
            doitRecharger = !!resultat.reussi;

            let score = el("div", `score-quiz ${resultat.reussi ? "reussi" : "echoue"}`);
            score.append(
                icone(resultat.reussi ? "fa-solid fa-circle-check" : "fa-solid fa-circle-xmark"),
                ` ${resultat.score_pct} %`
            );

            let detail = el(
                "p",
                "detail-score-quiz",
                `${resultat.bonnes} bonne(s) réponse(s) sur ${resultat.total} — il faut ${resultat.seuil_reussite} % minimum`
            );

            let message = el("p", "message-resultat-quiz");
            let actions = el("div", "actions-quiz");
            let elements = [creerBoutonFermer(), score, detail, message];

            if (resultat.reussi) {
                message.textContent = resultat.ressource_suivante_id
                    ? "Bravo ! La ressource suivante est débloquée."
                    : "Bravo ! Tu as réussi le quiz.";

                if (resultat.correction && resultat.correction.length) {
                    let correction = creerCorrection(resultat.correction);
                    correction.style.display = "none";

                    let boutonCorrection = creerBouton("bouton-secondaire", "fa-solid fa-eye", "Voir la correction");
                    boutonCorrection.addEventListener("click", () => {
                        let ouvert = correction.style.display !== "none";
                        correction.style.display = ouvert ? "none" : "block";
                        boutonCorrection.replaceChildren(
                            icone(ouvert ? "fa-solid fa-eye" : "fa-solid fa-eye-slash"),
                            ouvert ? "Voir la correction" : "Masquer la correction"
                        );
                    });
                    actions.appendChild(boutonCorrection);
                    elements.push(correction);
                }

                let boutonContinuer = creerBouton("bouton-accent", "fa-solid fa-arrow-right", "Continuer");
                boutonContinuer.addEventListener("click", fermer);
                actions.appendChild(boutonContinuer);
            } else {
                message.textContent = "Pas encore ! Relis la ressource, puis réessaie : les questions pourront être différentes.";

                let secondes = resultat.reessayer_dans || 0;
                let boutonReessayer = creerBouton("bouton-accent", "", "");
                let majBouton = () => {
                    boutonReessayer.replaceChildren(
                        icone("fa-solid fa-rotate-right"),
                        secondes > 0 ? `Réessayer dans ${formaterDuree(secondes)}` : "Réessayer"
                    );
                    boutonReessayer.disabled = secondes > 0;
                };
                majBouton();
                if (secondes > 0) {
                    minuteur = setInterval(() => {
                        secondes--;
                        majBouton();
                        if (secondes <= 0) clearInterval(minuteur);
                    }, 1000);
                }
                boutonReessayer.addEventListener("click", () => {
                    fermer();
                    ouvrirQuiz(ressource, null);
                });

                let boutonAnnuler = creerBouton("bouton-secondaire", "", "Fermer");
                boutonAnnuler.addEventListener("click", fermer);
                actions.append(boutonAnnuler, boutonReessayer);
            }

            elements.push(actions);
            modale.replaceChildren(...elements);
        };

        afficherQuestion();
    };

    // ========================================================
    // AFFICHAGE SUR LA PAGE
    // ========================================================

    // On garde le bouton d'origine (caché) et on ajoute à côté une zone d'actions
    let cartes = [];
    document.querySelectorAll("button.bouton-download[data-fichier]").forEach(bouton => {
        let zone = el("div", "actions-ressource");
        bouton.style.display = "none";
        bouton.insertAdjacentElement("afterend", zone);
        cartes.push({ zone, carte: bouton.closest(".card"), chemin: bouton.dataset.fichier });
    });

    let nettoyerCarte = (carte) => {
        if (!carte) return;
        carte.classList.remove("carte-verrouillee");
        carte.querySelectorAll(".badge-etape").forEach(b => b.remove());
    };

    // ---------- Visiteur : tout est visible, mais il faut se connecter ----------
    let afficherModeVisiteur = () => {
        cartes.forEach(({ zone, carte }) => {
            nettoyerCarte(carte);
            let bouton = creerBouton("bouton-download bouton-verrouille", "fa-solid fa-lock", "Se connecter pour accéder");
            bouton.addEventListener("click", () => {
                if (window.ouvrirModaleAuth) window.ouvrirModaleAuth();
                else notifier("Connecte-toi pour accéder aux ressources.", "fa-solid fa-lock");
            });
            zone.replaceChildren(bouton);
        });
    };

    let afficherIndisponible = () => {
        cartes.forEach(({ zone }) => {
            let bouton = creerBouton("bouton-download bouton-verrouille", "fa-solid fa-triangle-exclamation", "Indisponible pour le moment");
            bouton.disabled = true;
            zone.replaceChildren(bouton);
        });
    };

    // ---------- Connecté : lecture, téléchargement, quiz ----------
    let versionAffichage = 0;

    let afficherModeConnecte = async (utilisateur) => {
        let maVersion = ++versionAffichage;

        let { data: adminData } = await supabaseClient
            .from("admins")
            .select("user_id")
            .eq("user_id", utilisateur.id)
            .maybeSingle();
        let estAdmin = !!adminData;

        let { data: matiere } = await supabaseClient
            .from("matieres")
            .select("id")
            .eq("slug", slugMatiere)
            .single();
        if (!matiere) {
            notifier("Matière introuvable dans la base de données.", "fa-solid fa-triangle-exclamation");
            afficherIndisponible();
            return;
        }

        // Un admin a toutes les ressources débloquées d'office : inutile d'aller lire ses déblocages
        let vide = Promise.resolve({ data: [], error: null });

        let [resRessources, resDeblocages, resReussites] = await Promise.all([
            supabaseClient
                .from("ressources")
                .select("id, titre, chemin_fichier, ordre, type")
                .eq("matiere_id", matiere.id)
                .order("ordre", { ascending: true }),
            estAdmin ? vide : supabaseClient
                .from("deblocages")
                .select("ressource_id")
                .eq("user_id", utilisateur.id),
            estAdmin ? vide : supabaseClient
                .from("tentatives_quiz")
                .select("ressource_id")
                .eq("user_id", utilisateur.id)
                .eq("reussi", true)
        ]);

        if (maVersion !== versionAffichage) return; // une version plus récente de l'affichage a pris le relais

        let probleme = resRessources.error || resDeblocages.error || resReussites.error;
        if (probleme) {
            console.error(probleme);
            notifier(`Impossible de charger tes accès (${probleme.message}). Recharge la page.`, "fa-solid fa-triangle-exclamation");
            afficherIndisponible();
            return;
        }

        let ressources = resRessources.data || [];
        let idsDebloques = new Set((resDeblocages.data || []).map(d => d.ressource_id));
        let idsReussis = new Set((resReussites.data || []).map(r => r.ressource_id));

        // Les quiz ne concernent que les COURS : les TD (et TP, projet) sont libres pour tout le monde
        let estCours = (r) => String(r.type || "").trim().toLowerCase() === "cours";
        let cours = ressources.filter(estCours);                 // déjà triés par ordre
        let premierCours = cours.length ? cours[0] : null;       // le premier cours de la matière est libre

        let ressourceParChemin = {};
        ressources.forEach(r => { ressourceParChemin[r.chemin_fichier] = r; });

        cartes.forEach(({ zone, carte, chemin }) => {
            nettoyerCarte(carte);
            let ressource = ressourceParChemin[chemin];

            if (!ressource) {
                let bouton = creerBouton("bouton-download bouton-verrouille", "fa-solid fa-triangle-exclamation", "Indisponible");
                bouton.disabled = true;
                zone.replaceChildren(bouton);
                return;
            }

            let cetteRessourceEstUnCours = estCours(ressource);
            let rangCours = cours.findIndex(c => c.id === ressource.id) + 1; // 0 si ce n'est pas un cours

            // Pastille en haut de la carte : numéro du cours, ou "accès libre" pour un TD
            if (carte) {
                let badge = el("span", "badge-etape");
                if (cetteRessourceEstUnCours) {
                    badge.append(icone("fa-solid fa-list-ol"), ` Cours ${rangCours} sur ${cours.length}`);
                } else {
                    badge.append(icone("fa-solid fa-lock-open"), " Accès libre");
                }
                carte.prepend(badge);
            }

            let accessible = estAdmin
                || !cetteRessourceEstUnCours
                || (premierCours && ressource.id === premierCours.id)
                || idsDebloques.has(ressource.id);

            // ----- Cours verrouillé -----
            if (!accessible) {
                if (carte) carte.classList.add("carte-verrouillee");

                let precedent = cours[rangCours - 2]; // le cours d'avant

                let bouton = creerBouton("bouton-download bouton-verrouille", "fa-solid fa-lock", "Verrouillé");
                bouton.addEventListener("click", () => {
                    notifier(
                        precedent
                            ? `Réussis d'abord le quiz de « ${precedent.titre} » pour débloquer ce cours.`
                            : "Ce cours est verrouillé.",
                        "fa-solid fa-lock"
                    );
                });

                let info = el("p", "info-verrou");
                info.append(icone("fa-solid fa-lock"), ` Débloqué par le quiz de : ${precedent ? precedent.titre : "le cours précédent"}`);

                zone.replaceChildren(bouton, info);
                return;
            }

            // ----- Ressource accessible : Lire + Télécharger -----
            let boutonLire = creerBouton("bouton-download", "fa-solid fa-book-open", "Lire");
            boutonLire.addEventListener("click", () => ouvrirRessource(ressource, "lecture", boutonLire));

            let boutonTelecharger = creerBouton("bouton-download bouton-download-clair", "fa-solid fa-download", "Télécharger");
            boutonTelecharger.addEventListener("click", () => ouvrirRessource(ressource, "telechargement", boutonTelecharger));

            let rangeeActions = el("div", "rangee-actions");
            rangeeActions.append(boutonLire, boutonTelecharger);
            let elements = [rangeeActions];

            // ----- Quiz : seulement sur un COURS, et s'il reste un cours à débloquer après celui-ci -----
            let aUneSuite = cetteRessourceEstUnCours && cours.some(c => c.ordre > ressource.ordre);
            if (aUneSuite) {
                let rangeeQuiz = el("div", "rangee-quiz");

                if (idsReussis.has(ressource.id)) {
                    let statutQuiz = el("span", "statut-quiz");
                    statutQuiz.append(icone("fa-solid fa-circle-check"), " Quiz réussi");
                    let boutonRefaire = creerBouton("bouton-quiz", "fa-solid fa-rotate-right", "Refaire");
                    boutonRefaire.addEventListener("click", () => ouvrirQuiz(ressource, boutonRefaire));
                    rangeeQuiz.append(statutQuiz, boutonRefaire);
                } else {
                    let boutonQuiz = creerBouton("bouton-quiz", "fa-solid fa-circle-question", "Passer le quiz pour débloquer le cours suivant");
                    boutonQuiz.addEventListener("click", () => ouvrirQuiz(ressource, boutonQuiz));
                    rangeeQuiz.appendChild(boutonQuiz);
                }
                elements.push(rangeeQuiz);
            }

            zone.replaceChildren(...elements);
        });
    };

    // ---------- Premier affichage + réaction aux connexions / déconnexions ----------
    let { data: sessionData } = await supabaseClient.auth.getSession();
    let idUtilisateurCourant = sessionData.session ? sessionData.session.user.id : null;

    if (sessionData.session) afficherModeConnecte(sessionData.session.user);
    else afficherModeVisiteur();

    supabaseClient.auth.onAuthStateChange((_evenement, session) => {
        let idNouveau = session ? session.user.id : null;
        if (idNouveau === idUtilisateurCourant) return;
        idUtilisateurCourant = idNouveau;

        // setTimeout : évite d'appeler Supabase directement à l'intérieur de ce rappel
        setTimeout(() => {
            if (session) afficherModeConnecte(session.user);
            else { versionAffichage++; afficherModeVisiteur(); }
        }, 0);
    });
});