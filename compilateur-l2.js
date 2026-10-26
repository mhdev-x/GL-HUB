// ========================================================
// GL HUB — Compilateur de l'espace L2
// Garde d'accès (membre ou admin) + atelier de programmation
//
// Le moteur de pseudo-code vit dans COMPILATEUR/engine/ et est
// chargé à la demande (import dynamique), pour ne rien télécharger
// tant que l'élève n'a pas ouvert l'atelier.
// ========================================================
(function () {
    "use strict";

    let SLUG_CLASSE_L2 = "l2-gl-2026-2027";

    let vues = {
        chargement: document.querySelector("#vueChargement"),
        connexion: document.querySelector("#vueConnexion"),
        pasMembre: document.querySelector("#vuePasMembre"),
        erreur: document.querySelector("#vueErreur"),
        atelier: document.querySelector("#vueAtelier")
    };

    let messageErreurL2 = document.querySelector("#messageErreurL2");
    let boutonReessayer = document.querySelector("#boutonReessayer");
    let boutonConnexionL2 = document.querySelector("#boutonConnexionL2");

    let champCode = document.querySelector("#code");
    let boutonExecuter = document.querySelector("#boutonExecuter");
    let boutonEffacer = document.querySelector("#boutonEffacer");
    let choixLangage = document.querySelector("#choixLangage");
    let sortie = document.querySelector("#sortie");
    let etatExecution = document.querySelector("#etatExecution");
    let compteurLignes = document.querySelector("#compteurLignes");
    let listeExemples = document.querySelector("#listeExemples");
    let panneauEntrees = document.querySelector("#panneauEntrees");
    let boutonEntrees = document.querySelector("#boutonEntrees");
    let champEntrees = document.querySelector("#entrees");
    let compteurEntrees = document.querySelector("#compteurEntrees");
    let boutonPas = document.querySelector("#boutonPas");
    let boutonContinuer = document.querySelector("#boutonContinuer");
    let boutonStop = document.querySelector("#boutonStop");
    let listeVariables = document.querySelector("#listeVariables");

    let editeur = null;          // instance CodeMirror si disponible
    let moteur = null;           // module du moteur, chargé à la demande

    let execution = null;        // exécution pas à pas en cours (Stepper)
    let pointsArret = new Set(); // numéros de ligne (1-based)
    let ligneSurlignee = null;

    let montrerVue = (nom) => {
        Object.keys(vues).forEach(cle => { vues[cle].hidden = cle !== nom; });
    };

    let montrerErreur = (message) => {
        messageErreurL2.textContent = message;
        montrerVue("erreur");
    };

    // ---------- Exemples du cours ----------
    let EXEMPLES = [
        {
            titre: "Somme de deux entiers",
            detail: "variables, affectation, Écrire",
            code: `Programme Somme
Var a, b, s : entier
Début
    a <- 12
    b <- 30
    s <- a + b
    Ecrire "La somme de ", a, " et ", b, " est ", s
Fin`
        },
        {
            titre: "Factorielle récursive",
            detail: "fonction, Si/Sinon, retourner",
            code: `Fonction facto(Donnee N : entier) : entier
Début
    Si (N = 0 ou N = 1) Alors
        retourner 1
    Sinon
        retourner N * facto(N - 1)
    FinSi
Fin

Programme TestFactorielle
Var n : entier
Début
    n <- 6
    Ecrire "6! = ", facto(n)
Fin`
        },
        {
            titre: "Tri d'un tableau",
            detail: "tableau, boucles imbriquées",
            code: `Const N = 5
Type Tab = tableau[1..N] entier
Var T : Tab
Var i, j, tmp : entier
Début
    T[1] <- 5
    T[2] <- 3
    T[3] <- 8
    T[4] <- 1
    T[5] <- 2
    Pour i allant de 1 à N - 1 faire
        Pour j allant de i + 1 à N faire
            Si T[i] > T[j] Alors
                tmp <- T[i]
                T[i] <- T[j]
                T[j] <- tmp
            FinSi
        FinPour
    FinPour
    Pour i allant de 1 à N faire
        Ecrire T[i]
    FinPour
Fin`
        },
        {
            titre: "Nombre premier",
            detail: "TantQue, div, mod, booléen",
            code: `Fonction premier(Donnee N : entier) : booleen
Var i : entier
Var test : booleen
Début
    i <- 2
    TantQue (i <= N div 2 et N mod i # 0) faire
        i <- i + 1
    FinTantQue
    Si (i > N div 2 et N > 1) Alors
        test <- vrai
    Sinon
        test <- faux
    FinSi
    retourner test
Fin

Programme TestPremier
Début
    Ecrire "7 est premier : ", premier(7)
    Ecrire "8 est premier : ", premier(8)
Fin`
        },
        {
            titre: "Saisie au clavier",
            detail: "Lire, variables, concaténation",
            code: `Programme Saisie
Var prenom, nom : chaine
Var age : entier
Début
    Afficher("Votre prénom ?")
    Lire prenom
    Afficher("Votre nom ?")
    Lire nom
    Afficher("Votre âge ?")
    Lire age
    Afficher("Bonjour ", prenom, " ", nom, ", vous avez ", age, " ans")
Fin`
        },
        {
            titre: "Palindrome",
            detail: "chaînes, Souschaine, Longueur",
            code: `Programme Palindrome
Var mot : chaine
Var i, j : entier
Début
    mot <- "radar"
    i <- 1
    j <- Longueur(mot)
    TantQue (i < j et Souschaine(mot, i, 1) = Souschaine(mot, j, 1)) faire
        i <- i + 1
        j <- j - 1
    FinTantQue
    Si (i >= j) Alors
        Ecrire mot, " est un palindrome"
    Sinon
        Ecrire mot, " n'est pas un palindrome"
    FinSi
Fin`
        }
    ];

    // ---------- Entrées du programme ----------
    let lireEntrees = () => {
        if (!champEntrees) return [];
        return champEntrees.value
            .split(/\r?\n/)
            .map(ligne => ligne.trim())
            .filter(ligne => ligne.length > 0);
    };

    let mettreAJourCompteurEntrees = () => {
        if (!compteurEntrees) return;
        let nombre = lireEntrees().length;
        compteurEntrees.textContent = String(nombre);
        compteurEntrees.hidden = nombre === 0;
        if (boutonEntrees && panneauEntrees) {
            boutonEntrees.setAttribute("aria-expanded", String(!panneauEntrees.hidden));
        }
    };

    let basculerEntrees = (ouvrir) => {
        if (!panneauEntrees) return;
        let etat = typeof ouvrir === "boolean" ? ouvrir : panneauEntrees.hidden;
        panneauEntrees.hidden = !etat;
        if (boutonEntrees) boutonEntrees.setAttribute("aria-expanded", String(etat));
        if (etat && champEntrees) champEntrees.focus();
    };

    // ---------- Sauvegarde locale (le programme survit à un rafraîchissement) ----------
    let CLE_SAUVEGARDE = "glhub.compilateur.v1";
    let minuteurSauvegarde = null;

    let lireSauvegarde = () => {
        try {
            let brut = localStorage.getItem(CLE_SAUVEGARDE);
            if (!brut) return null;
            let donnees = JSON.parse(brut);
            return donnees && typeof donnees === "object" ? donnees : null;
        } catch (erreur) {
            return null;
        }
    };

    let sauvegarder = () => {
        clearTimeout(minuteurSauvegarde);
        minuteurSauvegarde = setTimeout(() => {
            try {
                localStorage.setItem(CLE_SAUVEGARDE, JSON.stringify({
                    code: lireCode(),
                    entrees: champEntrees ? champEntrees.value : ""
                }));
            } catch (erreur) {
                // quota dépassé ou navigation privée : sans gravité
            }
        }, 400);
    };

    // ---------- Console ----------
    let viderConsole = () => {
        sortie.textContent = "";
    };

    let ajouterLigne = (texte, classe) => {
        let ligne = document.createElement("span");
        ligne.className = classe || "ligne-sortie";
        ligne.textContent = texte === "" ? "\u00a0" : texte;
        sortie.appendChild(ligne);
    };

    let afficherErreurMoteur = (erreur, formatError) => {
        let f = formatError(erreur);
        let prefixe = f.line ? `Ligne ${f.line}, colonne ${f.col} : ` : "";
        ajouterLigne(prefixe + f.message, "ligne-erreur");
        if (f.hint) ajouterLigne("→ " + f.hint, "ligne-conseil");
        etatExecution.textContent = "Erreur";
        etatExecution.className = "atelier-etat erreur";
    };

    // ---------- Éditeur ----------
    let definirModePseudo = () => {
        if (typeof CodeMirror === "undefined") return;

        let MOTS = [
            "programme", "algorithme", "debut", "fin", "si", "alors", "sinon", "finsi",
            "tantque", "fintantque", "faire", "pour", "finpour", "repeter", "jusqua",
            "selon", "cas", "finselon", "autrement", "fonction", "procedure", "retourner",
            "var", "const", "type", "structure", "tableau", "entier", "reel", "chaine",
            "caractere", "booleen", "vrai", "faux", "et", "ou", "non", "div", "mod",
            "ecrire", "afficher", "lire", "saisir", "donnee", "donnees", "resultat",
            "resultats", "constante", "variable", "variables", "allant", "de", "pas", "par"
        ];

        let sansAccent = (mot) => String(mot)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();

        let mots = new Set(MOTS);

        CodeMirror.defineMode("pseudo", function () {
            return {
                token: function (stream) {
                    if (stream.eatSpace()) return null;

                    if (stream.match("//") || stream.match("==>")) {
                        stream.skipToEnd();
                        return "comment";
                    }
                    if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return "string";
                    if (stream.match(/^\u00AB[^\u00BB]*\u00BB/)) return "string";
                    if (stream.match(/^'(?:[^'\\]|\\.)*'/)) return "string";
                    if (stream.match(/^\d+(\.\d+)?/)) return "number";
                    if (stream.match(/^(<-|\u2190|\u27F5|<=|>=|<>|!=|\u2260|\u2264|\u2265|[+\-*/=<>#|])/)) return "operator";

                    if (stream.match(/^[A-Za-z\u00C0-\u00FF_][A-Za-z\u00C0-\u00FF0-9_]*/)) {
                        let mot = sansAccent(stream.current());
                        return mots.has(mot) ? "keyword" : "variable";
                    }

                    stream.next();
                    return null;
                }
            };
        });

        CodeMirror.defineMIME("text/x-pseudo", "pseudo");
    };

    let chargerCodeInitial = () => {
        let sauvegarde = lireSauvegarde();
        if (sauvegarde && typeof sauvegarde.code === "string" && sauvegarde.code.trim()) {
            if (typeof sauvegarde.entrees === "string" && champEntrees) {
                champEntrees.value = sauvegarde.entrees;
            }
            return sauvegarde.code;
        }
        return EXEMPLES[0].code;
    };

    let initialiserEditeur = () => {
        if (editeur || !champCode) return;

        if (typeof CodeMirror !== "undefined") {
            definirModePseudo();
            editeur = CodeMirror.fromTextArea(champCode, {
                mode: "text/x-pseudo",
                theme: "darcula",
                lineNumbers: true,
                indentUnit: 4,
                tabSize: 4,
                indentWithTabs: false,
                lineWrapping: true,
                autofocus: false,
                extraKeys: {
                    "Ctrl-Enter": () => executer(),
                    "Cmd-Enter": () => executer(),
                    Tab: (cm) => cm.replaceSelection("    ", "end")
                }
            });
            editeur.setValue(chargerCodeInitial());
            editeur.on("cursorActivity", mettreAJourCompteur);
            editeur.setOption("gutters", ["pointsArret", "CodeMirror-linenumbers"]);

            editeur.on("gutterClick", (editeurClique, numeroLigne) => {
                let ligne = numeroLigne + 1;
                if (pointsArret.has(ligne)) {
                    pointsArret.delete(ligne);
                    editeurClique.setGutterMarker(numeroLigne, "pointsArret", null);
                } else {
                    pointsArret.add(ligne);
                    let marqueur = document.createElement("div");
                    marqueur.className = "point-arret";
                    marqueur.textContent = "\u25CF";
                    editeurClique.setGutterMarker(numeroLigne, "pointsArret", marqueur);
                }
            });

            editeur.on("change", () => {
                if (execution && !execution.termine) {
                    execution.arreter();
                    execution = null;
                    surligner(null);
                }
                sauvegarder();
            });

            // Autocomplétion contextuelle (facultative : l'éditeur reste utilisable sans)
            if (window.GLHUBAutoCompletion && typeof window.GLHUBAutoCompletion.installer === "function") {
                try {
                    window.GLHUBAutoCompletion.installer(CodeMirror, editeur);
                } catch (erreur) {
                    console.warn("Autocomplétion indisponible :", erreur);
                }
            }
        } else {
            champCode.value = chargerCodeInitial();
            champCode.addEventListener("input", sauvegarder);
            champCode.addEventListener("keydown", (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    executer();
                }
            });
        }
        mettreAJourCompteur();
        mettreAJourCompteurEntrees();
    };

    let lireCode = () => editeur ? editeur.getValue() : champCode.value;

    let ecrireCode = (texte) => {
        if (editeur) editeur.setValue(texte);
        else champCode.value = texte;
        mettreAJourCompteur();
        mettreAJourCompteurEntrees();
    };

    let mettreAJourCompteur = () => {
        let code = lireCode();
        let lignes = code ? code.split("\n").length : 0;
        compteurLignes.textContent = lignes + (lignes > 1 ? " lignes" : " ligne");
    };

    // ---------- Exécution ----------
    let chargerMoteur = async () => {
        if (!moteur) moteur = await import("./COMPILATEUR/engine/index.js");
        return moteur;
    };

    let executer = async () => {
        if (choixLangage.value !== "pseudo") return;

        arreterExecution();
        afficherVariables([]);
        etatExecution.textContent = "Exécution...";
        etatExecution.className = "atelier-etat";
        viderConsole();

        let debut = performance.now();
        try {
            let { run, formatError } = await chargerMoteur();
            let resultat = run(lireCode(), { inputs: lireEntrees() });
            let fin = performance.now();

            if (!resultat.output.length) {
                ajouterLigne("Le programme s'est exécuté sans rien afficher.", "ligne-vide");
            } else {
                resultat.output.forEach(ligne => ajouterLigne(ligne));
            }

            let duree = Math.max(1, Math.round(fin - debut));
            etatExecution.textContent = `Terminé en ${duree} ms`;
            etatExecution.className = "atelier-etat succes";
        } catch (erreur) {
            if (erreur && erreur.name === "AlgoError") {
                // Le module est chargé : on réutilise sa mise en forme
                let { formatError } = await chargerMoteur();
                afficherErreurMoteur(erreur, formatError);
                if (/plus de valeur à lire/i.test(erreur.message)) {
                    basculerEntrees(true);
                    ajouterLigne("→ Saisis les valeurs dans le panneau « Entrées », puis relance.", "ligne-conseil");
                }
            } else {
                ajouterLigne("Erreur interne : " + (erreur && erreur.message ? erreur.message : erreur), "ligne-erreur");
                etatExecution.textContent = "Erreur";
                etatExecution.className = "atelier-etat erreur";
            }
        }
    };


    // ---------- Pas à pas ----------
    let surligner = (ligne) => {
        if (!editeur) return;
        if (ligneSurlignee !== null) {
            editeur.removeLineClass(ligneSurlignee - 1, "background", "ligne-courante");
        }
        ligneSurlignee = ligne || null;
        if (ligne) {
            editeur.addLineClass(ligne - 1, "background", "ligne-courante");
            editeur.scrollIntoView({ line: ligne - 1, ch: 0 }, 80);
        }
    };

    let afficherSortie = (lignes) => {
        viderConsole();
        (lignes || []).forEach(ligne => ajouterLigne(ligne));
    };

    let elementVariable = (nom, description) => {
        let li = document.createElement("li");

        let nomEl = document.createElement("span");
        nomEl.className = "var-nom";
        nomEl.textContent = nom;

        let typeEl = document.createElement("span");
        typeEl.className = "var-type";
        typeEl.textContent = description.type;

        let valeurEl = document.createElement("span");
        valeurEl.className = "var-valeur";
        valeurEl.textContent = description.texte;

        let contenu = document.createElement("span");
        contenu.appendChild(nomEl);
        contenu.appendChild(typeEl);
        contenu.appendChild(valeurEl);

        if (description.enfants && description.enfants.length) {
            let details = document.createElement("details");
            let resume = document.createElement("summary");
            resume.appendChild(contenu);
            details.appendChild(resume);

            let sousListe = document.createElement("ul");
            description.enfants.forEach(enfant => sousListe.appendChild(elementVariable(enfant.nom, enfant)));
            details.appendChild(sousListe);
            li.appendChild(details);
        } else {
            li.appendChild(contenu);
        }
        return li;
    };

    let afficherVariables = (variables) => {
        listeVariables.textContent = "";
        if (!variables || !variables.length) {
            let vide = document.createElement("li");
            vide.className = "atelier-vide";
            vide.textContent = "Aucune variable.";
            listeVariables.appendChild(vide);
            return;
        }
        variables.forEach(variable => listeVariables.appendChild(elementVariable(variable.nom, variable)));
    };

    let afficherPile = (pile) => {
        let ancienne = listeVariables.querySelector(".atelier-pile");
        if (ancienne) ancienne.remove();
        if (!pile || !pile.length) return;

        let ligne = document.createElement("li");
        ligne.className = "atelier-pile";
        ligne.textContent = "Pile : " + pile.join(" \u2192 ");
        listeVariables.prepend(ligne);
    };

    let rendreEtape = (etape) => {
        if (!etape) return;
        surligner(etape.ligne);
        afficherVariables(etape.variables);
        afficherPile(etape.pile);
        afficherSortie(etape.sortie);
        etatExecution.textContent = "Ligne " + etape.ligne;
        etatExecution.className = "atelier-etat";
    };

    let arreterExecution = () => {
        if (execution) {
            execution.arreter();
            execution = null;
        }
        surligner(null);
    };

    let preparerPasAPas = async () => {
        let { parse, Stepper } = await chargerMoteur();
        arreterExecution();
        execution = new Stepper(parse(lireCode()), { inputs: lireEntrees() });
        return execution;
    };

    let gererErreurExecution = async (erreur) => {
        let { formatError } = await chargerMoteur();
        arreterExecution();
        afficherErreurMoteur(erreur, formatError);
        if (/plus de valeur à lire/i.test(erreur.message)) {
            basculerEntrees(true);
            ajouterLigne("→ Saisis les valeurs dans le panneau « Entrées », puis relance.", "ligne-conseil");
        }
    };

    let pasAPas = async () => {
        try {
            if (!execution || execution.termine) await preparerPasAPas();
            let etape = execution.avancer();
            if (!etape) {
                afficherSortie(execution.sortie);
                etatExecution.textContent = "Programme terminé";
                etatExecution.className = "atelier-etat succes";
                return;
            }
            rendreEtape(etape);
        } catch (erreur) {
            await gererErreurExecution(erreur);
        }
    };

    let continuerExecution = async () => {
        try {
            if (!execution || execution.termine) await preparerPasAPas();
            let etape = execution.continuer(pointsArret);
            if (etape) rendreEtape(etape);
            afficherSortie(execution.sortie);
            if (etape && pointsArret.has(etape.ligne)) {
                etatExecution.textContent = "Point d'arrêt — ligne " + etape.ligne;
                etatExecution.className = "atelier-etat";
            } else if (execution.termine) {
                etatExecution.textContent = "Programme terminé";
                etatExecution.className = "atelier-etat succes";
            }
        } catch (erreur) {
            await gererErreurExecution(erreur);
        }
    };

    let stopperExecution = () => {
        arreterExecution();
        etatExecution.textContent = "Arrêté";
        etatExecution.className = "atelier-etat";
    };

    // ---------- Exemples ----------
    let construireExemples = () => {
        EXEMPLES.forEach((exemple, index) => {
            let li = document.createElement("li");
            let bouton = document.createElement("button");
            bouton.type = "button";

            let titre = document.createElement("span");
            titre.textContent = exemple.titre;
            let detail = document.createElement("small");
            detail.textContent = exemple.detail;

            bouton.appendChild(titre);
            bouton.appendChild(detail);
            bouton.addEventListener("click", () => {
                ecrireCode(exemple.code);
                viderConsole();
                etatExecution.textContent = "";
                etatExecution.className = "atelier-etat";
                if (editeur) editeur.focus();
            });

            li.appendChild(bouton);
            listeExemples.appendChild(li);
        });
    };

    // ---------- Chargement de la page ----------
    let initialiser = async () => {
        montrerVue("chargement");
        etatExecution.textContent = "";
        etatExecution.className = "atelier-etat";
        viderConsole();

        try {
            let { data: sessionData } = await supabaseClient.auth.getSession();
            if (!sessionData.session) {
                montrerVue("connexion");
                return;
            }

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
                    .eq("classe_id", classe.id).eq("user_id", sessionData.session.user.id).maybeSingle(),
                supabaseClient.from("admins").select("user_id")
                    .eq("user_id", sessionData.session.user.id).maybeSingle()
            ]);
            if (reponseMembre.error) throw reponseMembre.error;
            if (reponseAdmin.error) throw reponseAdmin.error;

            if (!reponseMembre.data && !reponseAdmin.data) {
                montrerVue("pasMembre");
                return;
            }

            montrerVue("atelier");
            initialiserEditeur();

            let titrePage = document.querySelector(".titre-acces-l2");
            if (titrePage && window.scrollY < 600) titrePage.scrollIntoView({ block: "start" });
        } catch (erreur) {
            montrerErreur(erreur && erreur.message ? erreur.message : "Impossible de vérifier ton accès.");
        }
    };

    // ---------- Événements ----------
    if (boutonExecuter) boutonExecuter.addEventListener("click", executer);
    if (boutonPas) boutonPas.addEventListener("click", pasAPas);
    if (boutonContinuer) boutonContinuer.addEventListener("click", continuerExecution);
    if (boutonStop) boutonStop.addEventListener("click", stopperExecution);
    if (boutonEntrees) boutonEntrees.addEventListener("click", () => basculerEntrees());
    if (champEntrees) {
        champEntrees.addEventListener("input", () => { mettreAJourCompteurEntrees(); sauvegarder(); });
    }
    if (boutonEffacer) boutonEffacer.addEventListener("click", viderConsole);

    if (choixLangage) {
        choixLangage.addEventListener("change", () => {
            if (choixLangage.value !== "pseudo") {
                ajouterLigne("Ce langage sera disponible dans une prochaine version.", "ligne-vide");
                choixLangage.value = "pseudo";
            }
        });
    }

    if (boutonConnexionL2) {
        boutonConnexionL2.addEventListener("click", () => {
            let declencheur = document.querySelector("#boutonAuth");
            if (declencheur) declencheur.click();
            else window.location.href = "index.html";
        });
    }

    if (boutonReessayer) boutonReessayer.addEventListener("click", initialiser);

    construireExemples();
    initialiser();
})();
