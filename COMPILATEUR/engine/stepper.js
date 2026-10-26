// =====================================================================
// GL HUB — Exécution pas à pas
//
// L'interpréteur produit un flux d'instructions (générateurs). Ce module
// le pilote pas à pas et prend un instantané des variables à chaque
// arrêt, pour l'affichage.
//
// Les appels de modules sont exécutés d'un bloc (pas d'entrée dans une
// fonction dans cette version).
// =====================================================================

import { Interpreter } from "./interpreter.js";
import { AlgoError } from "./lexer.js";

const PROFONDEUR_MAX = 4;

function formaterNombre(n) {
    if (Number.isInteger(n)) return String(n);
    return String(Math.round(n * 1e10) / 1e10);
}

function estTableau(v) {
    return !!(v && v.__array);
}

export class Stepper {
    constructor(program, options = {}) {
        this.interpreteur = new Interpreter(program, options);
        this.interpreteur.prepare();
        this.execution = program.main
            ? this.interpreteur.execBlock(program.main, this.interpreteur.global)
            : null;
        this.termine = !this.execution;
        this.historique = [];
        this.index = -1;
        this.historiqueActif = options.historique !== false;
        this.derniere = null;
    }

    get position() {
        return this.historiqueActif ? this.index : (this.derniere ? 0 : -1);
    }

    get total() {
        return this.historiqueActif ? this.historique.length : (this.derniere ? 1 : 0);
    }

    get sortie() {
        return this.interpreteur.output.slice();
    }

    get etapeCourante() {
        if (this.historiqueActif) return this.index >= 0 ? this.historique[this.index] : null;
        return this.derniere;
    }

    /** Décrit une valeur pour l'affichage (type + texte + enfants). */
    decrire(valeur, profondeur = 0) {
        if (typeof valeur === "boolean") {
            return { type: "booléen", texte: valeur ? "vrai" : "faux" };
        }
        if (typeof valeur === "number") {
            return { type: Number.isInteger(valeur) ? "entier" : "réel", texte: formaterNombre(valeur) };
        }
        if (typeof valeur === "string") {
            return { type: "chaîne", texte: `"${valeur}"` };
        }

        if (estTableau(valeur)) {
            let indices = Object.keys(valeur).filter(cle => /^\d+$/.test(cle)).map(Number).sort((a, b) => a - b);
            let enfants = profondeur >= PROFONDEUR_MAX ? [] : indices.map(i => ({
                nom: String(i),
                ...this.decrire(valeur[i], profondeur + 1)
            }));
            return {
                type: "tableau",
                texte: `${indices.length} case${indices.length > 1 ? "s" : ""}`,
                enfants
            };
        }

        if (valeur && typeof valeur === "object") {
            let champs = Object.keys(valeur).filter(cle => cle !== "__type");
            let enfants = profondeur >= PROFONDEUR_MAX ? [] : champs.map(cle => ({
                nom: cle,
                ...this.decrire(valeur[cle], profondeur + 1)
            }));
            return { type: "enregistrement", texte: valeur.__type || "structure", enfants };
        }

        return { type: "?", texte: String(valeur) };
    }

    /** Variables visibles à cet instant (portée courante puis englobantes). */
    instantane(scope) {
        let vues = new Map();
        let courant = scope;
        while (courant) {
            for (let [nom, cellule] of courant.vars) {
                if (vues.has(nom)) continue;
                let valeur;
                try {
                    valeur = cellule.get();
                } catch (erreur) {
                    continue;
                }
                vues.set(nom, this.decrire(valeur));
            }
            courant = courant.parent;
        }
        return Array.from(vues.entries()).map(([nom, description]) => ({ nom, ...description }));
    }

    /** Produit le pas suivant, ou null si le programme est terminé. */
    avancer() {
        if (this.termine) return null;

        let resultat;
        try {
            resultat = this.execution.next();
        } catch (erreur) {
            this.termine = true;
            throw erreur;
        }

        if (resultat.done) {
            this.termine = true;
            return null;
        }

        let { line, scope, pile } = resultat.value;
        let etape = {
            ligne: line,
            pile: pile || [],
            variables: this.instantane(scope),
            sortie: this.sortie
        };

        this.derniere = etape;
        if (this.historiqueActif) {
            this.historique.push(etape);
            this.index = this.historique.length - 1;
        }
        return etape;
    }

    /** Exécute jusqu'au prochain point d'arrêt (ou la fin). */
    continuer(pointsArret = new Set()) {
        let derniere = this.etapeCourante;
        if (!pointsArret || pointsArret.size === 0) {
            // Sans point d'arrêt : on va au bout, en gardant la dernière étape.
            while (true) {
                let etape = this.avancer();
                if (!etape) break;
                derniere = etape;
            }
            return derniere;
        }

        while (true) {
            let etape = this.avancer();
            if (!etape) break;
            derniere = etape;
            if (pointsArret.has(etape.ligne)) break;
        }
        return derniere;
    }

    arreter() {
        this.termine = true;
        if (this.execution && typeof this.execution.return === "function") {
            try { this.execution.return(); } catch (erreur) { /* déjà terminé */ }
        }
    }

    /** Navigation dans l'historique (lecture seule). */
    precedent() {
        if (!this.historiqueActif || this.index <= 0) return null;
        this.index -= 1;
        return this.historique[this.index];
    }

    suivant() {
        if (!this.historiqueActif || this.index >= this.historique.length - 1) return null;
        this.index += 1;
        return this.historique[this.index];
    }

    /** Revenir à l'état le plus récent (avant de reprendre l'exécution). */
    allerEnFin() {
        if (this.historiqueActif) this.index = this.historique.length - 1;
    }
}

export function creerPasAPas(program, options = {}) {
    return new Stepper(program, options);
}

export { AlgoError };
