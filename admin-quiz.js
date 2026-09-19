// ========================================================
// ADMIN — GESTION DES QUESTIONS DE QUIZ (GL HUB)
// Les questions vivent dans la table "questions_quiz", lisible et modifiable
// uniquement par les comptes présents dans la table "admins" (règle RLS).
// ========================================================
document.addEventListener("DOMContentLoaded", async () => {

    const TAILLE_QUIZ = 10;        // nombre de questions tirées par quiz (doit rester identique à QUIZ_SIZE côté serveur)
    const BANQUE_CONSEILLEE = 20;  // taille de banque conseillée pour varier les quiz
    const MIN_PROPOSITIONS = 2;
    const MAX_PROPOSITIONS = 6;

    // ---------- Éléments de la page ----------
    let choixMatiere = document.querySelector("#choixMatiere");
    let listeRessourcesEl = document.querySelector("#listeRessources");
    let zoneQuestions = document.querySelector("#zoneQuestions");
    let titreRessourceChoisie = document.querySelector("#titreRessourceChoisie");
    let resumeBanque = document.querySelector("#resumeBanque");
    let titreFormulaire = document.querySelector("#titreFormulaire");
    let champQuestion = document.querySelector("#champQuestion");
    let listeOptionsForm = document.querySelector("#listeOptionsForm");
    let boutonAjouterOption = document.querySelector("#boutonAjouterOption");
    let champExplication = document.querySelector("#champExplication");
    let erreurFormulaire = document.querySelector("#erreurFormulaire");
    let boutonEnregistrer = document.querySelector("#boutonEnregistrerQuestion");
    let boutonAnnulerEdition = document.querySelector("#boutonAnnulerEdition");
    let champImport = document.querySelector("#champImport");
    let resultatImport = document.querySelector("#resultatImport");
    let boutonImporter = document.querySelector("#boutonImporter");
    let compteurQuestions = document.querySelector("#compteurQuestions");
    let listeQuestionsEl = document.querySelector("#listeQuestions");
    let boutonDeconnexionAdmin = document.querySelector("#boutonDeconnexionAdmin");

    // ---------- État ----------
    let ressources = [];               // ressources de la matière choisie (triées par ordre)
    let questionsParRessource = {};    // { id_ressource: [questions] }
    let ressourceChoisie = null;
    let idEnEdition = null;

    // ---------- Petits outils ----------
    // Les quiz ne concernent que les COURS : les TD, TP et projets sont libres
    let estCours = (ressource) => String(ressource.type || "").trim().toLowerCase() === "cours";
    let identifiantDernierCours = () => {
        let cours = ressources.filter(estCours);
        return cours.length ? cours[cours.length - 1].id : null;
    };

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
        if (texte) bouton.append(texte);
        return bouton;
    };

    let normaliser = (texte) => texte
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    // Petite notification (même style que le reste du site)
    let notifier = (message, classesIcone = "fa-solid fa-circle-check") => {
        let toast = el("div", "toast-notification");
        toast.appendChild(icone(classesIcone));
        toast.append(message);
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add("toast-visible"));
        setTimeout(() => {
            toast.classList.remove("toast-visible");
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    };

    boutonDeconnexionAdmin.addEventListener("click", async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
    });

    // ========================================================
    // CHARGEMENT DES DONNÉES
    // ========================================================
    let chargerMatieres = async () => {
        let { data, error } = await supabaseClient
            .from("matieres")
            .select("id, nom")
            .order("nom", { ascending: true });

        if (error || !data || data.length === 0) {
            console.error(error);
            choixMatiere.replaceChildren(el("option", "", "Aucune matière"));
            listeRessourcesEl.replaceChildren(el("p", "message-chargement", "Impossible de charger les matières."));
            return;
        }

        choixMatiere.replaceChildren(...data.map(m => {
            let option = el("option", "", m.nom);
            option.value = m.id;
            return option;
        }));

        chargerMatiere(choixMatiere.value);
    };

    let chargerMatiere = async (idMatiere, idAGarder = null) => {
        listeRessourcesEl.replaceChildren(el("p", "message-chargement", "Chargement..."));

        let { data: lesRessources, error } = await supabaseClient
            .from("ressources")
            .select("id, titre, type, ordre")
            .eq("matiere_id", idMatiere)
            .order("ordre", { ascending: true });

        if (error) {
            console.error(error);
            listeRessourcesEl.replaceChildren(el("p", "message-chargement", "Erreur de chargement des ressources."));
            return;
        }

        ressources = lesRessources || [];
        questionsParRessource = {};

        if (ressources.length > 0) {
            let { data: questions, error: erreurQuestions } = await supabaseClient
                .from("questions_quiz")
                .select("id, ressource_id, question, options, index_correct, explication, actif, cree_le")
                .in("ressource_id", ressources.map(r => r.id))
                .order("cree_le", { ascending: true });

            if (erreurQuestions) {
                console.error(erreurQuestions);
                listeRessourcesEl.replaceChildren(el("p", "message-chargement",
                    "Impossible de lire les questions. As-tu bien lancé le fichier SQL 004 ?"));
                return;
            }

            (questions || []).forEach(q => {
                if (!questionsParRessource[q.ressource_id]) questionsParRessource[q.ressource_id] = [];
                questionsParRessource[q.ressource_id].push(q);
            });
        }

        afficherRessources();

        let aGarder = idAGarder && ressources.find(r => r.id === idAGarder);
        if (aGarder) choisirRessource(aGarder.id, false);
        else {
            ressourceChoisie = null;
            zoneQuestions.style.display = "none";
        }
    };

    choixMatiere.addEventListener("change", () => {
        annulerEdition();
        chargerMatiere(choixMatiere.value);
    });

    // ========================================================
    // LISTE DES RESSOURCES (avec le nombre de questions)
    // ========================================================
    let creerBadgeBanque = (nombreActives, estDerniere, libre = false) => {
        let badge = el("span", "badge-banque");

        if (libre) {
            badge.classList.add("badge-neutre");
            badge.append(icone("fa-solid fa-lock-open"), " Accès libre : pas de quiz");
        } else if (estDerniere && nombreActives === 0) {
            badge.classList.add("badge-neutre");
            badge.append(icone("fa-solid fa-flag-checkered"), " Dernier cours : pas de quiz");
        } else if (nombreActives === 0) {
            badge.classList.add("badge-vide");
            badge.append(icone("fa-solid fa-circle-xmark"), " Aucune question");
        } else if (nombreActives < TAILLE_QUIZ) {
            badge.classList.add("badge-peu");
            badge.append(icone("fa-solid fa-triangle-exclamation"), ` ${nombreActives} question(s) : minimum ${TAILLE_QUIZ}`);
        } else if (nombreActives < BANQUE_CONSEILLEE) {
            badge.classList.add("badge-moyen");
            badge.append(icone("fa-solid fa-circle-info"), ` ${nombreActives} questions : ${BANQUE_CONSEILLEE} conseillées`);
        } else {
            badge.classList.add("badge-ok");
            badge.append(icone("fa-solid fa-circle-check"), ` ${nombreActives} questions`);
        }
        return badge;
    };

    let afficherRessources = () => {
        listeRessourcesEl.replaceChildren();

        if (ressources.length === 0) {
            listeRessourcesEl.appendChild(el("p", "message-chargement", "Aucune ressource dans cette matière."));
            return;
        }

        let dernierCours = identifiantDernierCours();

        ressources.forEach((ressource) => {
            let libre = !estCours(ressource);              // TD, TP, projet : pas de quiz
            let estDernier = ressource.id === dernierCours;
            let actives = (questionsParRessource[ressource.id] || []).filter(q => q.actif).length;

            let ligne = el("div", "ligne-ressource-quiz");
            if (libre) ligne.classList.add("ligne-libre");
            if (ressourceChoisie && ressourceChoisie.id === ressource.id) ligne.classList.add("selectionnee");
            ligne.dataset.id = ressource.id;

            let pastille = el("span", "pastille-ordre", String(ressource.ordre));
            let infos = el("div", "infos-ressource-quiz");
            infos.append(el("strong", "", ressource.titre), el("span", "type-ressource-quiz", ressource.type || ""));

            ligne.append(pastille, infos, creerBadgeBanque(actives, estDernier, libre));
            if (!libre) ligne.addEventListener("click", () => choisirRessource(ressource.id, true));
            listeRessourcesEl.appendChild(ligne);
        });
    };

    let choisirRessource = (idRessource, defiler) => {
        ressourceChoisie = ressources.find(r => r.id === idRessource) || null;
        if (!ressourceChoisie) return;

        annulerEdition();
        afficherRessources();

        titreRessourceChoisie.textContent = ressourceChoisie.titre;
        zoneQuestions.style.display = "block";
        afficherQuestions();

        if (defiler) zoneQuestions.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    // ========================================================
    // LISTE DES QUESTIONS D'UNE RESSOURCE
    // ========================================================
    let afficherResumeBanque = (actives) => {
        let estDerniere = ressourceChoisie.id === identifiantDernierCours();

        if (estDerniere && actives === 0) {
            resumeBanque.textContent = "C'est le dernier cours de la matière : il n'a pas besoin de quiz (il ne débloque rien).";
        } else if (actives === 0) {
            resumeBanque.textContent = "Aucune question active : les étudiants ne pourront pas débloquer le cours suivant tant que tu n'en ajoutes pas.";
        } else if (actives < TAILLE_QUIZ) {
            resumeBanque.textContent = `${actives} question(s) active(s) : ajoutes-en jusqu'à ${TAILLE_QUIZ} au minimum (idéalement ${BANQUE_CONSEILLEE} ou plus).`;
        } else if (actives < BANQUE_CONSEILLEE) {
            resumeBanque.textContent = `${actives} questions actives : ça fonctionne. Avec ${BANQUE_CONSEILLEE} ou plus, les quiz seront plus variés d'un étudiant à l'autre.`;
        } else {
            resumeBanque.textContent = `${actives} questions actives : chaque étudiant reçoit ${TAILLE_QUIZ} questions tirées au hasard.`;
        }
    };

    let afficherQuestions = () => {
        let questions = questionsParRessource[ressourceChoisie.id] || [];
        let actives = questions.filter(q => q.actif).length;

        compteurQuestions.textContent = String(questions.length);
        afficherResumeBanque(actives);
        listeQuestionsEl.replaceChildren();

        if (questions.length === 0) {
            listeQuestionsEl.appendChild(el("p", "message-chargement", "Aucune question pour le moment."));
            return;
        }

        questions.forEach((q, i) => {
            let carte = el("div", "carte-question-admin");
            if (!q.actif) carte.classList.add("question-inactive");

            let entete = el("div", "entete-question-admin");
            entete.appendChild(el("strong", "", `${i + 1}. ${q.question}`));
            if (!q.actif) {
                let badge = el("span", "badge-banque badge-neutre");
                badge.append(icone("fa-solid fa-eye-slash"), " Désactivée");
                entete.appendChild(badge);
            }
            carte.appendChild(entete);

            let options = el("ul", "options-question-admin");
            (q.options || []).forEach((texte, k) => {
                let ligne = el("li", k === q.index_correct ? "option-juste-admin" : "");
                ligne.append(icone(k === q.index_correct ? "fa-solid fa-circle-check" : "fa-regular fa-circle"), ` ${texte}`);
                options.appendChild(ligne);
            });
            carte.appendChild(options);

            if (q.explication) {
                let explication = el("p", "explication-question-admin");
                explication.append(icone("fa-solid fa-lightbulb"), ` ${q.explication}`);
                carte.appendChild(explication);
            }

            // ----- Actions -----
            let actions = el("div", "actions-question-admin");

            let boutonModifier = creerBouton("bouton-petit", "fa-solid fa-pen", "Modifier");
            boutonModifier.addEventListener("click", () => commencerEdition(q));

            let boutonActif = creerBouton(
                "bouton-petit",
                q.actif ? "fa-solid fa-eye-slash" : "fa-solid fa-eye",
                q.actif ? "Désactiver" : "Activer"
            );
            boutonActif.addEventListener("click", () => basculerActif(q, boutonActif));

            let boutonSupprimer = creerBouton("bouton-petit bouton-petit-danger", "fa-solid fa-trash", "Supprimer");
            let minuteurConfirmation = null;
            boutonSupprimer.addEventListener("click", async () => {
                // Deux clics pour supprimer : le premier demande confirmation
                if (!boutonSupprimer.dataset.confirmer) {
                    boutonSupprimer.dataset.confirmer = "oui";
                    boutonSupprimer.replaceChildren(icone("fa-solid fa-triangle-exclamation"), "Confirmer ?");
                    minuteurConfirmation = setTimeout(() => {
                        delete boutonSupprimer.dataset.confirmer;
                        boutonSupprimer.replaceChildren(icone("fa-solid fa-trash"), "Supprimer");
                    }, 3500);
                    return;
                }
                clearTimeout(minuteurConfirmation);
                await supprimerQuestion(q, boutonSupprimer);
            });

            actions.append(boutonModifier, boutonActif, boutonSupprimer);
            carte.appendChild(actions);
            listeQuestionsEl.appendChild(carte);
        });
    };

    let rechargerEtGarderSelection = async () => {
        await chargerMatiere(choixMatiere.value, ressourceChoisie ? ressourceChoisie.id : null);
    };

    let basculerActif = async (question, bouton) => {
        bouton.disabled = true;
        let { error } = await supabaseClient
            .from("questions_quiz")
            .update({ actif: !question.actif })
            .eq("id", question.id);

        if (error) {
            console.error(error);
            notifier("Modification impossible : " + error.message, "fa-solid fa-triangle-exclamation");
            bouton.disabled = false;
            return;
        }
        await rechargerEtGarderSelection();
    };

    let supprimerQuestion = async (question, bouton) => {
        bouton.disabled = true;
        let { error } = await supabaseClient
            .from("questions_quiz")
            .delete()
            .eq("id", question.id);

        if (error) {
            console.error(error);
            notifier("Suppression impossible : " + error.message, "fa-solid fa-triangle-exclamation");
            bouton.disabled = false;
            return;
        }
        if (idEnEdition === question.id) annulerEdition();
        notifier("Question supprimée.", "fa-solid fa-trash");
        await rechargerEtGarderSelection();
    };

    // ========================================================
    // FORMULAIRE (ajout / modification)
    // ========================================================
    let ajouterLigneOption = (texte = "", coche = false) => {
        let ligne = el("div", "option-formulaire");

        let radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "bonneReponse";
        radio.checked = coche;
        radio.setAttribute("aria-label", "Bonne réponse");

        let champ = document.createElement("input");
        champ.type = "text";
        champ.value = texte;
        champ.placeholder = `Proposition ${listeOptionsForm.children.length + 1}`;
        champ.maxLength = 300;

        let boutonRetirer = creerBouton("bouton-retirer-option", "fa-solid fa-xmark", "");
        boutonRetirer.setAttribute("aria-label", "Retirer cette proposition");
        boutonRetirer.addEventListener("click", () => {
            if (listeOptionsForm.children.length <= MIN_PROPOSITIONS) return;
            ligne.remove();
            majBoutonsOptions();
        });

        ligne.append(radio, champ, boutonRetirer);
        listeOptionsForm.appendChild(ligne);
        majBoutonsOptions();
    };

    let majBoutonsOptions = () => {
        let nombre = listeOptionsForm.children.length;
        boutonAjouterOption.style.display = nombre >= MAX_PROPOSITIONS ? "none" : "";
        listeOptionsForm.querySelectorAll(".bouton-retirer-option").forEach(b => {
            b.style.visibility = nombre <= MIN_PROPOSITIONS ? "hidden" : "visible";
        });
    };

    boutonAjouterOption.addEventListener("click", () => {
        if (listeOptionsForm.children.length < MAX_PROPOSITIONS) ajouterLigneOption();
    });

    let reinitialiserFormulaire = () => {
        idEnEdition = null;
        champQuestion.value = "";
        champExplication.value = "";
        erreurFormulaire.textContent = "";
        listeOptionsForm.replaceChildren();
        for (let i = 0; i < 4; i++) ajouterLigneOption();
        titreFormulaire.textContent = "Ajouter une question";
        boutonAnnulerEdition.style.display = "none";
        boutonEnregistrer.replaceChildren(icone("fa-solid fa-floppy-disk"), "Enregistrer la question");
    };

    let annulerEdition = () => reinitialiserFormulaire();
    boutonAnnulerEdition.addEventListener("click", annulerEdition);

    let commencerEdition = (question) => {
        reinitialiserFormulaire();
        idEnEdition = question.id;

        champQuestion.value = question.question;
        champExplication.value = question.explication || "";

        listeOptionsForm.replaceChildren();
        (question.options || []).forEach((texte, k) => ajouterLigneOption(texte, k === question.index_correct));
        while (listeOptionsForm.children.length < MIN_PROPOSITIONS) ajouterLigneOption();

        titreFormulaire.textContent = "Modifier la question";
        boutonAnnulerEdition.style.display = "";
        boutonEnregistrer.replaceChildren(icone("fa-solid fa-floppy-disk"), "Mettre à jour la question");
        champQuestion.scrollIntoView({ behavior: "smooth", block: "center" });
        champQuestion.focus();
    };

    // Lit et vérifie le formulaire
    let lireFormulaire = () => {
        let question = champQuestion.value.trim();
        if (!question) return { erreur: "Écris la question." };

        let options = [];
        let indexCorrect = -1;
        listeOptionsForm.querySelectorAll(".option-formulaire").forEach(ligne => {
            let texte = ligne.querySelector("input[type=text]").value.trim();
            if (!texte) return; // les propositions vides sont ignorées
            if (ligne.querySelector("input[type=radio]").checked) indexCorrect = options.length;
            options.push(texte);
        });

        if (options.length < MIN_PROPOSITIONS) return { erreur: `Il faut au moins ${MIN_PROPOSITIONS} propositions remplies.` };
        if (new Set(options.map(normaliser)).size !== options.length) return { erreur: "Deux propositions sont identiques." };
        if (indexCorrect === -1) return { erreur: "Coche la bonne réponse (sur une proposition remplie)." };

        return {
            question,
            options,
            index_correct: indexCorrect,
            explication: champExplication.value.trim() || null
        };
    };

    boutonEnregistrer.addEventListener("click", async () => {
        if (!ressourceChoisie) return;

        let saisie = lireFormulaire();
        if (saisie.erreur) {
            erreurFormulaire.textContent = saisie.erreur;
            return;
        }
        erreurFormulaire.textContent = "";

        boutonEnregistrer.disabled = true;

        let reponse;
        if (idEnEdition) {
            reponse = await supabaseClient.from("questions_quiz").update(saisie).eq("id", idEnEdition);
        } else {
            reponse = await supabaseClient.from("questions_quiz").insert({ ...saisie, ressource_id: ressourceChoisie.id });
        }

        boutonEnregistrer.disabled = false;

        if (reponse.error) {
            console.error(reponse.error);
            erreurFormulaire.textContent = "Erreur : " + reponse.error.message;
            return;
        }

        notifier(idEnEdition ? "Question mise à jour." : "Question ajoutée.");
        reinitialiserFormulaire();
        await rechargerEtGarderSelection();
        champQuestion.focus();
    });

    // ========================================================
    // IMPORT JSON
    // ========================================================
    let afficherResultatImport = (classe, titre, lignes = []) => {
        resultatImport.replaceChildren();
        resultatImport.className = `resultat-import ${classe}`;
        resultatImport.appendChild(el("strong", "", titre));
        if (lignes.length) {
            let liste = el("ul");
            lignes.slice(0, 12).forEach(texte => liste.appendChild(el("li", "", texte)));
            if (lignes.length > 12) liste.appendChild(el("li", "", `... et ${lignes.length - 12} autre(s).`));
            resultatImport.appendChild(liste);
        }
    };

    boutonImporter.addEventListener("click", async () => {
        if (!ressourceChoisie) return;

        let brut = champImport.value.trim();
        if (!brut) {
            afficherResultatImport("resultat-erreur", "Colle d'abord le JSON à importer.");
            return;
        }

        let donnees;
        try {
            donnees = JSON.parse(brut);
        } catch (e) {
            afficherResultatImport("resultat-erreur", "Le JSON est invalide.", [e.message]);
            return;
        }

        let liste = Array.isArray(donnees) ? donnees : (donnees && Array.isArray(donnees.questions) ? donnees.questions : null);
        if (!liste || liste.length === 0) {
            afficherResultatImport("resultat-erreur", "Le JSON doit être une liste de questions (ou un objet avec une clé \"questions\").");
            return;
        }

        let dejaPresentes = new Set((questionsParRessource[ressourceChoisie.id] || []).map(q => normaliser(q.question)));
        let vuesDansImport = new Set();
        let erreurs = [];
        let lignes = [];
        let ignorees = 0;

        liste.forEach((item, i) => {
            let n = i + 1;
            if (!item || typeof item !== "object") { erreurs.push(`Question ${n} : format invalide.`); return; }

            let question = typeof item.question === "string" ? item.question.trim() : "";
            let options = Array.isArray(item.options) ? item.options.map(o => (typeof o === "string" ? o.trim() : "")) : [];

            if (!question) { erreurs.push(`Question ${n} : le texte de la question est manquant.`); return; }
            if (options.length < MIN_PROPOSITIONS || options.length > MAX_PROPOSITIONS || options.some(o => !o)) {
                erreurs.push(`Question ${n} : il faut entre ${MIN_PROPOSITIONS} et ${MAX_PROPOSITIONS} propositions non vides.`);
                return;
            }
            if (new Set(options.map(normaliser)).size !== options.length) {
                erreurs.push(`Question ${n} : deux propositions sont identiques.`);
                return;
            }

            let indexCorrect = -1;
            if (Number.isInteger(item.index_correct)) {
                indexCorrect = item.index_correct;
            } else if (typeof item.bonne_reponse === "string") {
                let cible = normaliser(item.bonne_reponse);
                let trouvees = options.map((o, k) => k).filter(k => normaliser(options[k]) === cible);
                if (trouvees.length === 1) indexCorrect = trouvees[0];
            }
            if (indexCorrect < 0 || indexCorrect >= options.length) {
                erreurs.push(`Question ${n} : bonne réponse introuvable (écris dans "bonne_reponse" le texte exact d'une proposition).`);
                return;
            }

            let cle = normaliser(question);
            if (dejaPresentes.has(cle) || vuesDansImport.has(cle)) { ignorees++; return; }
            vuesDansImport.add(cle);

            lignes.push({
                ressource_id: ressourceChoisie.id,
                question,
                options,
                index_correct: indexCorrect,
                explication: typeof item.explication === "string" && item.explication.trim() ? item.explication.trim() : null
            });
        });

        if (erreurs.length > 0) {
            afficherResultatImport("resultat-erreur", `Import annulé : ${erreurs.length} problème(s) trouvé(s). Rien n'a été ajouté.`, erreurs);
            return;
        }
        if (lignes.length === 0) {
            afficherResultatImport("resultat-info", `Rien à importer : les ${ignorees} question(s) existent déjà.`);
            return;
        }

        boutonImporter.disabled = true;
        let { error } = await supabaseClient.from("questions_quiz").insert(lignes);
        boutonImporter.disabled = false;

        if (error) {
            console.error(error);
            afficherResultatImport("resultat-erreur", "Erreur pendant l'import. Rien n'a été ajouté.", [error.message]);
            return;
        }

        champImport.value = "";
        afficherResultatImport(
            "resultat-ok",
            `${lignes.length} question(s) importée(s)` + (ignorees ? ` (${ignorees} déjà présente(s), ignorée(s))` : "") + "."
        );
        notifier(`${lignes.length} question(s) importée(s).`);
        await rechargerEtGarderSelection();
    });

    // ---------- Démarrage ----------
    reinitialiserFormulaire();
    chargerMatieres();
});