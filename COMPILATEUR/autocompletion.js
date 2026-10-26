// ========================================================
// GL HUB — Autocomplétion du pseudo-code (CodeMirror 5)
//
// Trois sources, dans cet ordre :
//   1. les variables réellement déclarées dans le programme ;
//   2. les mots-clés du cours ;
//   3. des modèles de blocs (Si, TantQue, Pour, Répéter…).
//
// Contexte pris en compte :
//   - après « : » on propose les types, pas les variables ;
//   - rien dans un commentaire, une chaîne ou un accès de champ.
// ========================================================
(function () {
    "use strict";

    let TYPES = ["entier", "reel", "chaine", "booleen", "caractere"];

    let MOTS_CLES = [
        "Programme", "Algorithme", "Début", "Fin",
        "Var", "Const", "Constante", "Type", "Structure",
        "Si", "Alors", "Sinon", "FinSi",
        "TantQue", "Faire", "FinTantQue",
        "Pour", "FinPour", "Allant", "Pas",
        "Répéter", "Jusqu'à",
        "Selon", "Cas", "FinSelon", "Autrement",
        "Fonction", "Procédure", "Retourner",
        "Tableau", "Entier", "Réel", "Chaîne", "Booléen", "Caractère",
        "Vrai", "Faux", "Et", "Ou", "Non", "Div", "Mod",
        "Écrire", "Afficher", "Lire", "Saisir",
        "Donnée", "Résultat", "D/R",
        "Longueur", "Long", "Souschaine", "SSChaine", "Concat", "Rang",
        "Code", "Car", "Caractere", "cvChaine", "cvNombre", "Abs", "sqrt", "sqr"
    ];

    let MODELES = [
        {
            mot: "Programme",
            apercu: "Programme … / Var / Début / Fin",
            modele: "Programme \u0000\nVar \nDébut\n    \nFin"
        },
        {
            mot: "Si",
            apercu: "Si … Alors … Sinon … FinSi",
            modele: "Si \u0000 Alors\n    \nSinon\n    \nFinSi"
        },
        {
            mot: "TantQue",
            apercu: "TantQue … Faire … FinTantQue",
            modele: "TantQue \u0000 faire\n    \nFinTantQue"
        },
        {
            mot: "Pour",
            apercu: "Pour i allant de 1 à N … FinPour",
            modele: "Pour i allant de 1 à \u0000 faire\n    \nFinPour"
        },
        {
            mot: "Répéter",
            apercu: "Répéter … Jusqu'à …",
            modele: "Répéter\n    \nJusqu'à \u0000"
        },
        {
            mot: "Selon",
            apercu: "Selon … Cas … FinSelon",
            modele: "Selon \u0000\n    Cas 1 :\n        \n    Autrement :\n        \nFinSelon"
        },
        {
            mot: "Fonction",
            apercu: "Fonction nom(...) : type / Début / Fin",
            modele: "Fonction nom(Donnee X : entier) : entier\nDébut\n    \u0000\nFin"
        },
        {
            mot: "Procédure",
            apercu: "Procédure nom(...) / Début / Fin",
            modele: "Procédure nom(Donnee X : entier)\nDébut\n    \u0000\nFin"
        },
        {
            mot: "Type",
            apercu: "Type nom = structure … Fin",
            modele: "Type nom = structure\nDébut\n    champ : \u0000\nFin"
        },
        {
            mot: "Tableau",
            apercu: "tableau[1..N] type",
            modele: "tableau[1..\u0000] entier"
        }
    ];

    let RESERVES = new Set([
        "programme", "algorithme", "debut", "fin", "si", "alors", "sinon", "finsi",
        "tantque", "fintantque", "faire", "pour", "finpour", "repeter", "jusqua",
        "selon", "cas", "finselon", "autrement", "fonction", "procedure", "retourner",
        "var", "const", "constante", "type", "structure", "tableau", "entier", "reel",
        "chaine", "booleen", "caractere", "vrai", "faux", "et", "ou", "non", "div",
        "mod", "ecrire", "afficher", "lire", "saisir", "donnee", "donnees", "resultat",
        "resultats", "variable", "variables", "allant", "pas", "par"
    ]);

    let normaliser = (texte) => String(texte)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[\u2018\u2019']/g, "");

    // ---------- Variables déclarées ----------
    let extraireVariables = (code) => {
        let noms = new Map();

        let ajouterNom = (nom, type) => {
            let propre = String(nom || "").trim();
            if (!propre) return;
            let cle = normaliser(propre);
            if (!/^[a-z_][a-z0-9_]*$/.test(cle)) return;
            if (RESERVES.has(cle)) return;
            if (!noms.has(cle)) {
                noms.set(cle, { nom: propre, type: String(type || "").trim() });
            }
        };

        let lignes = String(code || "").split("\n");
        let dansStructure = 0;
        let zoneDeclarations = true;

        for (let brute of lignes) {
            let ligne = brute.trim();

            if (/^d[ée]but\b/i.test(ligne) || ligne === "{") zoneDeclarations = false;

            if (/type\s+\w+\s*[=:]\s*structure/i.test(ligne)) { dansStructure++; continue; }
            if (dansStructure > 0) {
                if (/^fin\b/i.test(ligne)) dansStructure--;
                continue;
            }
            if (!zoneDeclarations) continue;

            // « Var nom, prenom : chaine » ou, en continuation, « age : entier »
            let declaration = ligne.match(/^(?:var|variable|variables)\s+([^:]+?)\s*:\s*(.+)$/i)
                || ligne.match(/^([A-Za-z\u00C0-\u00FF_][A-Za-z\u00C0-\u00FF0-9_]*(?:\s*,\s*[A-Za-z\u00C0-\u00FF_][A-Za-z\u00C0-\u00FF0-9_]*)*)\s*:\s*(.+)$/);
            if (declaration) {
                let type = declaration[2].replace(/\s+/g, " ").trim().slice(0, 24);
                declaration[1].split(",").forEach(nom => ajouterNom(nom.replace(/\s+/g, ""), type));
            }

            // « Const N = 150 »
            let constante = ligne.match(/^(?:const|constante)\s+([A-Za-z\u00C0-\u00FF_][A-Za-z\u00C0-\u00FF0-9_]*)/i);
            if (constante) ajouterNom(constante[1], "constante");

            // paramètres de module : « Fonction f(Donnee X:entier, Y:chaine) »
            let module = ligne.match(/^(?:fonction|proc[ée]dure)\s+\w+\s*\((.*)/i);
            if (module) {
                module[1].split(",").forEach((groupe) => {
                    let morceaux = groupe.split(":");
                    let type = (morceaux[1] || "").replace(/[)\s]+$/, "").trim().slice(0, 24);
                    morceaux[0].replace(/\(|\)/g, " ").split(/\s+/)
                        .forEach(nom => ajouterNom(nom, type));
                });
            }
        }

        return Array.from(noms.values());
    };

    // ---------- Insertion d'un modèle ----------
    let insererModele = (cm, modele, from, to) => {
        let indentation = (cm.getLine(from.line).match(/^\s*/) || [""])[0];
        let lignes = modele.split("\n");

        let indente = lignes.map((ligne, index) => {
            if (index === 0 || ligne === "") return ligne;
            return indentation + ligne;
        }).join("\n");

        let position = indente.indexOf("\u0000");
        let texte = indente.replace("\u0000", "");

        cm.replaceRange(texte, from, to);

        if (position >= 0) {
            let avant = indente.slice(0, position);
            let sauts = avant.split("\n");
            let nbLignes = sauts.length - 1;
            let derniere = sauts[sauts.length - 1];
            cm.setCursor({
                line: from.line + nbLignes,
                ch: (nbLignes === 0 ? from.ch : 0) + derniere.length
            });
        }
        cm.focus();
    };

    // ---------- Suggestions ----------
    let installer = (CodeMirror, cm) => {
        CodeMirror.registerHelper("hint", "pseudo", function (editeur) {
            let curseur = editeur.getCursor();
            let ligne = editeur.getLine(curseur.line);
            let avant = ligne.slice(0, curseur.ch);

            // Ni commentaire, ni chaîne, ni accès de champ
            if (/\/\/|==>/.test(avant)) return null;
            if (((avant.match(/"/g) || []).length % 2) === 1) return null;
            if ((avant.match(/\u00AB/g) || []).length > (avant.match(/\u00BB/g) || []).length) return null;
            if (/[A-Za-z\u00C0-\u00FF0-9_\)\]]\.\s*[A-Za-z\u00C0-\u00FF_]*$/.test(avant)) return null;

            let mot = (avant.match(/[A-Za-z\u00C0-\u00FF_][A-Za-z\u00C0-\u00FF0-9_]*$/) || [""])[0];
            let from = { line: curseur.line, ch: curseur.ch - mot.length };
            let to = curseur;
            let prefixe = normaliser(mot);

            let liste = [];
            let vus = new Set();

            let ajouter = (item) => {
                let cle = item.text.toLowerCase();
                if (vus.has(cle)) return;
                if (prefixe && !normaliser(item.text).startsWith(prefixe)) return;
                vus.add(cle);
                liste.push(item);
            };

            // 1) Après « : » → des types, pas des variables
            if (/:\s*[A-Za-z\u00C0-\u00FF_]*$/.test(avant)) {
                TYPES.forEach(type => ajouter({ text: type, displayText: type, className: "cm-sugg-type" }));
                let typesDeclares = (editeur.getValue().match(/type\s+([A-Za-z\u00C0-\u00FF_][A-Za-z\u00C0-\u00FF0-9_]*)/gi) || [])
                    .map(x => x.replace(/^type\s+/i, ""));
                typesDeclares.forEach(type => ajouter({ text: type, displayText: type, className: "cm-sugg-type" }));
                return { list: liste, from, to };
            }

            // 2) Variables du programme (les plus pertinentes)
            extraireVariables(editeur.getValue()).forEach(variable => {
                ajouter({
                    text: variable.nom,
                    displayText: variable.type ? variable.nom + "   " + variable.type : variable.nom,
                    className: "cm-sugg-variable"
                });
            });

            // 3) Modèles de blocs
            MODELES.forEach(modele => {
                if (prefixe && !normaliser(modele.mot).startsWith(prefixe)) return;
                if (vus.has(modele.mot.toLowerCase())) return;
                vus.add(modele.mot.toLowerCase());
                liste.push({
                    text: modele.mot,
                    displayText: modele.apercu,
                    className: "cm-sugg-modele",
                    hint: (editeur2, donnees) => insererModele(editeur2, modele.modele, donnees.from, donnees.to)
                });
            });

            // 4) Mots-clés et fonctions
            MOTS_CLES.forEach(motCle => {
                ajouter({ text: motCle, displayText: motCle, className: "cm-sugg-motcle" });
            });

            return { list: liste, from, to };
        });

        let ouvrir = () => {
            // On passe un wrapper : certains environnements CodeMirror ne
            // reprennent pas correctement une fonction de hint passée telle
            // quelle (le popup ne s'ouvre alors jamais).
            cm.showHint({
                hint: function (editeurCourant, options) {
                    return CodeMirror.hint.pseudo(editeurCourant, options);
                },
                completeSingle: false
            });
        };

        let options = cm.getOption("extraKeys") || {};
        // macOS capture Ctrl+Espace (source de saisie) et Cmd+Espace
        // (Spotlight) : on ajoute Option+Espace, qui reste libre.
        options["Ctrl-Space"] = ouvrir;
        options["Alt-Space"] = ouvrir;
        options["Cmd-Space"] = ouvrir;
        cm.setOption("extraKeys", options);

        // Déclenchement automatique après 2 lettres
        let minuteur = null;
        cm.on("inputRead", function (editeur, changement) {
            if (changement.origin !== "+input") return;
            let texte = changement.text.join("");
            if (!/[A-Za-z\u00C0-\u00FF_]$/.test(texte)) return;
            if (/^\s*(\/\/|==>)/.test(editeur.getLine(changement.from.line))) return;

            clearTimeout(minuteur);
            minuteur = setTimeout(function () {
                let curseur = editeur.getCursor();
                let avant = editeur.getLine(curseur.line).slice(0, curseur.ch);
                let mot = (avant.match(/[A-Za-z\u00C0-\u00FF_][A-Za-z\u00C0-\u00FF0-9_]*$/) || [""])[0];
                if (mot.length < 1) return;
                ouvrir();
            }, 120);
        });
    };

    window.GLHUBAutoCompletion = { installer: installer, extraireVariables: extraireVariables };
})();
