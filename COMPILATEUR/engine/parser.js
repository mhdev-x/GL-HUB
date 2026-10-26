// =====================================================================
// GL HUB — Compilateur pseudo-code
// Analyseur syntaxique (parser) — descente récursive
//
// Grammaire acceptée (d'après le livre de cours) :
//
//   programme      := ("programme"|"algorithme") IDENT? déclaration* module* bloc?
//   déclaration    := const | type | var
//   module         := ("fonction"|"procedure") IDENT "(" params ")" (":" type)? déclaration* bloc
//   bloc           := "début" instruction* "fin"
//   params         := mode? IDENT ("," IDENT)* ":" type
//   type           := "entier"|"reel"|"chaine"|"booleen"|"caractere"
//                   | "tableau" "[" borne ".." borne ("," ...)* "]" type
//                   | "structure" (champ)* "fin"
//                   | IDENT
// =====================================================================

import { tokenize, AlgoError } from "./lexer.js";

const BASIC_TYPES = new Set(["entier", "reel", "chaine", "booleen", "caractere"]);

export function parse(src) {
    const tokens = tokenize(src);
    return new Parser(tokens).parseProgram();
}

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
        this.typeNames = new Set(BASIC_TYPES);
    }

    // ---------- primitives ----------
    peek(k = 0) { return this.tokens[Math.min(this.pos + k, this.tokens.length - 1)]; }
    next() { const t = this.tokens[this.pos]; if (this.pos < this.tokens.length - 1) this.pos++; return t; }
    atEnd() { return this.peek().type === "eof"; }

    isKw(name, k = 0) { const t = this.peek(k); return t.type === "keyword" && t.value === name; }
    isOp(v, k = 0) { const t = this.peek(k); return t.type === "op" && t.value === v; }
    isIdentText(text, k = 0) { const t = this.peek(k); return t.type === "ident" && t.value === text; }

    eatKw(name) { if (this.isKw(name)) { this.next(); return true; } return false; }
    eatOp(v) { if (this.isOp(v)) { this.next(); return true; } return false; }

    expectOp(v, what) {
        const t = this.peek();
        if (t.type === "op" && t.value === v) return this.next();
        this.fail(`il manque « ${what || v} »`, t);
    }

    expectKw(name, what) {
        const t = this.peek();
        if (t.type === "keyword" && t.value === name) return this.next();
        this.fail(`il manque « ${what || name} »`, t);
    }

    expectIdent(what) {
        const t = this.peek();
        if (t.type === "ident") return this.next();
        this.fail(`un nom ${what || "de variable"} est attendu`, t);
    }

    fail(message, tok) {
        const t = tok || this.peek();
        throw new AlgoError(message, t.line, t.col);
    }

    // ---------- programme ----------
    parseProgram() {
        if (this.isKw("programme") || this.isKw("algorithme")) {
            this.next();
            if (this.peek().type === "ident") this.next();
        }

        const declarations = [];
        const modules = [];

        for (;;) {
            // Un en-tête « Programme » peut suivre les modules (cours, p. 7)
            if (this.isKw("programme") || this.isKw("algorithme")) {
                this.next();
                if (this.peek().type === "ident") this.next();
                continue;
            }
            if (this.isKw("const") || this.isKw("type") || this.isKw("var")) {
                declarations.push(...this.parseDeclarations());
            } else if (this.isKw("fonction") || this.isKw("procedure")) {
                modules.push(this.parseModule());
            } else {
                break;
            }
        }

        let main = null;
        if (this.isKw("debut") || this.isOp("{")) main = this.parseBlock();

        if (!this.atEnd()) {
            const t = this.peek();
            throw new AlgoError(
                `Élément inattendu « ${t.raw || t.value} » après la fin du programme.`,
                t.line, t.col,
                "Vérifie qu'il n'y a pas un « Fin » en trop, ou une instruction après « Fin »."
            );
        }

        return { kind: "program", declarations, modules, main };
    }

    // ---------- déclarations ----------
    parseDeclarations() {
        const out = [];
        while (this.isKw("const") || this.isKw("type") || this.isKw("var")) {
            if (this.isKw("const")) {
                this.next();
                for (;;) {
                    const t = this.expectIdent("de constante");
                    this.expectOp("=", "= (ou ←) après le nom de la constante");
                    const value = this.parseExpression();
                    out.push({ kind: "const", name: t.value, raw: t.raw, value, line: t.line });
                    if (this.eatOp(",")) continue;
                    // « Const L = 7 » puis « C = 8 » (cours Ndacke GUEYE, tableaux p. 3)
                    const nxt = this.peek();
                    const nxt2 = this.peek(1);
                    if (nxt.type === "ident" && nxt2.type === "op" && nxt2.value === "=") continue;
                    break;
                }
            } else if (this.isKw("type")) {
                this.next();
                do {
                    const t = this.expectIdent("de type");
                    if (!this.eatOp("=")) this.expectOp(":", "= ou : après le nom du type");
                    const typeAst = this.parseType();
                    this.typeNames.add(t.value);
                    out.push({ kind: "type", name: t.value, raw: t.raw, typeAst, line: t.line });
                } while (this.eatOp(","));
            } else {
                this.next(); // var
                for (;;) {
                    const names = [this.expectIdent("de variable")];
                    while (this.isOp(",") && this.peek(1).type === "ident") {
                        // Virgule suivie d'un nom : nouvelle variable du même groupe,
                        // sauf si c'est la virgule qui sépare deux groupes de « var ».
                        this.next();
                        names.push(this.expectIdent("de variable"));
                        if (this.isOp(":")) break;
                    }
                    let typeAst = null;
                    let init = null;
                    if (this.eatOp(":")) {
                        typeAst = this.parseType();
                    } else if (this.isOp("=")) {
                        this.next();
                        const a = this.peek(), b = this.peek(1), c = this.peek(2);
                        const looksInterval = (a.type === "number" || a.type === "string") &&
                            b.type === "op" && b.value === "." && c && c.type === "op" && c.value === ".";
                        if (this.peek().type === "ident" || this.isKw("tableau") || this.isKw("structure") || looksInterval) {
                            typeAst = this.parseType();     // Var T = tab  /  Var c = 1..31
                        } else {
                            init = this.parseExpression();  // Var x = 5
                        }
                    } else {
                        this.expectOp(":", ": après le nom de la variable");
                    }
                    for (const nm of names) {
                        out.push({ kind: "var", name: nm.value, raw: nm.raw, typeAst, init, line: nm.line });
                    }

                    if (this.eatOp(",")) continue;

                    // Le livre poursuit parfois le bloc Var sans le répéter
                    // (page 219 : « Var Tprod : tabProduit » puis « i : entier »).
                    const nxt = this.peek();
                    const nxt2 = this.peek(1);
                    if (nxt.type === "ident" && nxt2.type === "op" && (nxt2.value === ":" || nxt2.value === ",")) continue;

                    break;
                }
            }
        }
        return out;
    }

    parseType() {
        const t = this.peek();

        if (t.type === "keyword" && t.value === "tableau") {
            this.next();
            const dims = [];
            do {
                this.expectOp("[", "[ après « tableau »");
                do {
                    const lo = this.parseExpression();
                    if (!(this.isOp(".") && this.isOp(".", 1))) {
                        this.fail("une borne de tableau s'écrit « 1..N »", this.peek());
                    }
                    this.next(); this.next();
                    const hi = this.parseExpression();
                    dims.push({ lo, hi });
                } while (this.eatOp(","));
                this.expectOp("]", "] pour fermer les bornes du tableau");
            } while (this.isOp("["));
            const elem = this.parseType();
            return { kind: "array", dims, elem, line: t.line };
        }

        if (t.type === "keyword" && t.value === "structure") {
            this.next();
            this.eatKw("debut"); // tolérance : le livre écrit parfois « structure / Début »
            const fields = [];
            while (!this.isKw("fin") && !this.atEnd()) {
                const names = [this.expectIdent("de champ")];
                while (this.eatOp(",")) names.push(this.expectIdent("de champ"));
                this.expectOp(":", ": après le nom du champ");
                const fieldType = this.parseType();
                for (const nm of names) fields.push({ name: nm.value, raw: nm.raw, typeAst: fieldType, line: nm.line });
            }
            this.expectKw("fin", "Fin pour fermer la structure");
            return { kind: "struct", fields, line: t.line };
        }

        if (t.type === "keyword" && BASIC_TYPES.has(t.value)) {
            this.next();
            // « chaine(10) » (p. 168) : taille maximale, sans effet à l'exécution
            if (t.value === "chaine" && this.eatOp("(")) {
                this.parseExpression();
                this.expectOp(")", ") après la taille de la chaîne");
            }
            return { kind: "basic", name: t.value, line: t.line };
        }

        // Énumérations et intervalles (chapitre 4) :
        //   Type alphabet = 'A'..'Z'      Type couleur = "Rouge", "Vert"
        //   Jour : 1..31                  Genre : "Masculin", "Féminin"
        const intervalAhead = this.isOp(".", 1) && this.isOp(".", 2);
        if (t.type === "ident" && !intervalAhead) {
            this.next();
            this.typeNames.add(t.value);
            return { kind: "named", name: t.value, line: t.line };
        }

        if (t.type === "string" || t.type === "number" || t.type === "ident") {
            const first = this.parseEnumValue();
            if (this.isOp(".") && this.isOp(".", 1)) {
                this.next(); this.next();
                const second = this.parseEnumValue();
                return { kind: "interval", lo: first, hi: second, line: t.line };
            }
            const values = [first];
            while (this.isOp(",")) {
                const nxt = this.peek(1);
                const after = this.peek(2);
                // « Genre : "Masculin", "Féminin" » puis un nouveau champ
                if (nxt.type === "ident" && after && after.type === "op" && after.value === ":") break;
                if (!(nxt.type === "string" || nxt.type === "number")) break;
                this.next();
                values.push(this.parseEnumValue());
            }
            return { kind: "enum", values, line: t.line };
        }

        this.fail("un type est attendu (entier, reel, chaine, booleen, tableau…)", t);
    }

    parseEnumValue() {
        const t = this.peek();
        if (t.type === "number") { this.next(); return { kind: "number", value: t.value, line: t.line }; }
        if (t.type === "string") { this.next(); return { kind: "string", value: t.value, line: t.line }; }
        if (t.type === "ident") { this.next(); return { kind: "string", value: t.raw, line: t.line }; }
        this.fail("une valeur d'énumération est attendue", t);
    }

    // ---------- modules ----------
    parseModule() {
        const kw = this.next(); // fonction | procedure
        const isFunction = kw.value === "fonction";
        const name = this.expectIdent(isFunction ? "de fonction" : "de procédure");
        this.expectOp("(", "( après le nom du module");
        const params = this.parseParams();
        let returnType = null;
        if (this.eatOp(":")) returnType = this.parseType();

        const declarations = [];
        while (this.isKw("const") || this.isKw("type") || this.isKw("var")) {
            declarations.push(...this.parseDeclarations());
        }
        const body = this.parseBlock();

        return {
            kind: isFunction ? "function" : "procedure",
            name: name.value, raw: name.raw,
            params, returnType, declarations, body, line: kw.line
        };
    }

    parseParams() {
        const params = [];
        if (this.eatOp(")")) return params;

        let courant = "donnee";
        for (;;) {
            const explicite = this.parseParamMode();
            if (explicite) courant = explicite;
            const mode = courant;
            const types = [];
            const names = [this.expectIdent("de paramètre")];
            // Avant le « : », toute virgule sépare des noms (« A, B : entier »).
            while (this.isOp(",")) {
                this.next();
                names.push(this.expectIdent("de paramètre"));
            }
            this.expectOp(":", ": après le nom du paramètre");
            const typeAst = this.parseType();
            for (const nm of names) params.push({ name: nm.value, raw: nm.raw, mode, typeAst, line: nm.line });

            if (this.eatOp(",")) {
                if (this.isOp(")")) break;
                continue;
            }
            if (this.isOp(")")) break;
            // Tolérance : le livre omet parfois la virgule entre deux groupes
            // (« Donnees N : entier  Résultat prem : booleen »).
            if (this.peek().type === "ident" || this.isKw("donnee") || this.isKw("donnees") || this.isKw("resultat") || this.isKw("resultats")) {
                continue;
            }
            this.fail("une virgule ou « ) » est attendu entre les paramètres", this.peek());
        }

        this.expectOp(")", ") pour fermer les paramètres");
        return params;
    }

    parseParamMode() {
        const t = this.peek();
        if (t.type === "keyword" && (t.value === "donnee" || t.value === "donnees")) {
            this.next();
            if (this.isOp("/") && this.isKw("resultat", 1)) { this.next(); this.next(); return "dr"; }
            return "donnee";
        }
        if (t.type === "keyword" && (t.value === "resultat" || t.value === "resultats")) {
            this.next();
            return "resultat";
        }
        // « D/R » est écrit en identifiants (d et r ne sont pas réservés)
        if (t.type === "ident" && (t.value === "d" || t.value === "r") &&
            this.isOp("/", 1) && this.peek(2).type === "ident" &&
            (this.peek(2).value === "r" || this.peek(2).value === "d")) {
            this.next(); this.next(); this.next();
            return "dr";
        }
        return null;   // aucun mot-clé : on hérite du mode précédent
    }

    // ---------- instructions ----------
    parseBlock() {
        // Corps entre accolades (cours Ndacke GUEYE, programmation modulaire p. 7)
        if (this.isOp("{")) {
            this.next();
            const body = this.parseStatements(new Set(["}", "fin"]));
            if (!this.isOp("}")) this.fail("il manque « } » pour fermer le bloc", this.peek());
            this.next();
            return { kind: "block", body };
        }
        this.expectKw("debut", "Début");
        const body = this.parseStatements(new Set(["fin"]));
        this.expectKw("fin", "Fin pour fermer le bloc");
        return { kind: "block", body };
    }

    parseStatements(stops) {
        const out = [];
        while (!this.atEnd()) {
            const t = this.peek();
            if (t.type === "keyword" && stops.has(t.value)) break;
            if (t.type === "op" && stops.has(t.value)) break;
            if (t.type === "keyword" && ["finsi", "finpour", "fintantque", "finselon", "sinon", "autrement", "jusqua", "fin"].includes(t.value)) {
                // fin de bloc inattendue : le bloc appelant n'a pas terminé
                throw new AlgoError(
                    `« ${t.raw} » arrive trop tôt : un bloc précédent n'est pas refermé.`,
                    t.line, t.col,
                    `Il manque probablement « ${this.expectedClose(stops)} » avant cette ligne.`
                );
            }
            out.push(this.parseStatement());
            while (this.eatOp(";")) { /* séparateur facultatif */ }
        }
        return out;
    }

    expectedClose(stops) {
        if (stops.has("finsi")) return "FinSi";
        if (stops.has("finpour")) return "FinPour";
        if (stops.has("fintantque")) return "FinTantQue";
        if (stops.has("finselon")) return "FinSelon";
        return "Fin";
    }

    parseStatement() {
        const t = this.peek();

        if (t.type === "keyword") {
            switch (t.value) {
                case "si": return this.parseIf();
                case "tantque": return this.parseWhile();
                case "pour": return this.parseFor();
                case "repeter": return this.parseRepeat();
                case "selon": return this.parseSwitch();
                case "ecrire": return this.parseWrite();
                case "lire":
                case "saisir": return this.parseRead();
                case "retourner": return this.parseReturn();
            }
        }

        // Le livre écrit aussi « Tant que » en deux mots.
        if (t.type === "ident" && t.value === "tant" && this.isIdentText("que", 1)) {
            this.next(); // tant
            this.next(); // que
            return this.parseWhileBody(t);
        }

        // Affectation ou appel
        const target = this.parseDesignator();
        if (this.isOp("assigne")) {
            this.next();
            const value = this.parseExpression();
            return { kind: "assign", target, value, line: t.line };
        }
        if (target.kind === "call") return { kind: "exprstmt", expr: target, line: t.line };

        this.fail("« ← » est attendu pour affecter une valeur (ou un appel de module)", this.peek());
    }

    parseIf() {
        const t = this.next(); // si
        const cond = this.parseExpression();
        this.eatKw("alors");
        const then = this.parseStatements(new Set(["sinon", "finsi"]));
        let otherwise = [];
        if (this.eatKw("sinon")) {
            otherwise = this.parseStatements(new Set(["finsi"]));
        }
        this.expectKw("finsi", "FinSi pour fermer le Si");
        return { kind: "if", cond, then, otherwise, line: t.line };
    }

    parseWhile() {
        const t = this.next(); // tantque
        return this.parseWhileBody(t);
    }

    parseWhileBody(t) {
        const cond = this.parseExpression();
        this.eatKw("faire");
        const body = this.parseStatements(new Set(["fintantque"]));
        this.expectKw("fintantque", "FinTantQue pour fermer la boucle");
        return { kind: "while", cond, body, line: t.line };
    }

    parseFor() {
        const t = this.next(); // pour
        const parenthesized = this.eatOp("(");
        const v = this.expectIdent("de boucle");
        let start;
        if (this.isOp("assigne")) {
            this.next();
            start = this.parseExpression();
        } else if (this.isIdentText("allant")) {
            this.next();
            if (this.isIdentText("de")) this.next();
            start = this.parseExpression();
        } else {
            this.fail("« allant de » ou « ← » est attendu après la variable de boucle", this.peek());
        }

        // « à » est un identifiant (à cause de la variable « a »)
        const sep = this.peek();
        if (!(sep.type === "ident" && sep.value === "a")) {
            this.fail("« à » est attendu entre le début et la fin de la boucle", sep);
        }
        this.next();
        const end = this.parseExpression();

        let step = null;
        if (this.isIdentText("par")) {
            this.next();
            if (this.isIdentText("pas")) this.next();
            if (this.isIdentText("de")) this.next();   // « par pas de -1 » (p. 191)
            step = this.parseExpression();
        }
        if (parenthesized) this.expectOp(")", ") pour fermer l'en-tête du Pour");
        this.eatKw("faire");

        const body = this.parseStatements(new Set(["finpour"]));
        this.expectKw("finpour", "FinPour pour fermer la boucle");
        return { kind: "for", varName: v.value, start, end, step, body, line: t.line };
    }

    parseRepeat() {
        const t = this.next(); // repeter
        const body = this.parseStatements(new Set(["jusqua"]));
        this.expectKw("jusqua", "Jusqu'à pour fermer le Répéter");
        const cond = this.parseExpression();
        return { kind: "repeat", body, cond, line: t.line };
    }

    parseSwitch() {
        const t = this.next(); // selon
        const expr = this.parseExpression();
        const cases = [];
        let otherwise = null;
        while (!this.isKw("finselon") && !this.atEnd()) {
            if (this.eatKw("cas")) {
                const values = [this.parseExpression()];
                while (this.eatOp(",")) values.push(this.parseExpression());
                this.expectOp(":", ": après la valeur du Cas");
                const body = this.parseStatements(new Set(["cas", "autrement", "finselon"]));
                cases.push({ values, body });
            } else if (this.eatKw("autrement")) {
                this.eatOp(":");
                otherwise = this.parseStatements(new Set(["cas", "finselon"]));
            } else {
                this.fail("« Cas » ou « Autrement » est attendu dans un Selon", this.peek());
            }
        }
        this.expectKw("finselon", "FinSelon pour fermer le Selon");
        return { kind: "switch", expr, cases, otherwise, line: t.line };
    }

    parseWrite() {
        const t = this.next(); // ecrire
        const args = this.parseArgList();
        return { kind: "write", args, line: t.line };
    }

    parseRead() {
        const t = this.next(); // lire | saisir
        const args = [];
        if (this.eatOp("(")) {
            if (!this.isOp(")")) {
                do { args.push(this.parseDesignator()); } while (this.eatOp(","));
            }
            this.expectOp(")", ") pour fermer Saisir");
        } else {
            do { args.push(this.parseDesignator()); } while (this.eatOp(","));
        }
        return { kind: "read", args, line: t.line };
    }

    parseArgList() {
        const args = [];
        if (this.eatOp("(")) {
            if (!this.isOp(")")) {
                do { args.push(this.parseExpression()); } while (this.eatOp(","));
            }
            this.expectOp(")", ") pour fermer Écrire");
            return args;
        }
        do { args.push(this.parseExpression()); } while (this.eatOp(","));
        return args;
    }

    parseReturn() {
        const t = this.next(); // retourner
        if (this.isOp("(")) {
            this.next();
            if (this.isOp(")")) { this.next(); return { kind: "return", value: null, line: t.line }; }
            const value = this.parseExpression();
            this.expectOp(")", ") pour fermer Retourner");
            return { kind: "return", value, line: t.line };
        }
        if (this._atStatementBoundary()) return { kind: "return", value: null, line: t.line };
        return { kind: "return", value: this.parseExpression(), line: t.line };
    }

    _atStatementBoundary() {
        const t = this.peek();
        if (t.type === "eof") return true;
        if (t.type === "keyword" && ["fin", "finsi", "finpour", "fintantque", "finselon", "sinon", "autrement", "jusqua"].includes(t.value)) return true;
        return false;
    }

    // ---------- expressions ----------
    parseExpression() { return this.parseOr(); }

    parseOr() {
        let left = this.parseAnd();
        while (this.isKw("ou")) {
            const t = this.next();
            const right = this.parseAnd();
            left = { kind: "binary", op: "ou", left, right, line: t.line };
        }
        return left;
    }

    parseAnd() {
        let left = this.parseNot();
        while (this.isKw("et")) {
            const t = this.next();
            const right = this.parseNot();
            left = { kind: "binary", op: "et", left, right, line: t.line };
        }
        return left;
    }

    parseNot() {
        if (this.isKw("non")) {
            const t = this.next();
            return { kind: "unary", op: "non", operand: this.parseNot(), line: t.line };
        }
        return this.parseComparison();
    }

    parseComparison() {
        const left = this.parseAdditive();
        const t = this.peek();
        if (t.type === "op" && ["=", "!=", "#", "<", ">", "<=", ">="].includes(t.value)) {
            this.next();
            const right = this.parseAdditive();
            return { kind: "binary", op: t.value, left, right, line: t.line };
        }
        return left;
    }

    parseAdditive() {
        let left = this.parseMultiplicative();
        while (this.isOp("+") || this.isOp("-") || this.isOp("||")) {
            const t = this.next();
            const right = this.parseMultiplicative();
            left = { kind: "binary", op: t.value, left, right, line: t.line };
        }
        return left;
    }

    parseMultiplicative() {
        let left = this.parseUnary();
        while (this.isOp("*") || this.isOp("/") || this.isKw("div") || this.isKw("mod")) {
            const t = this.next();
            const op = t.type === "keyword" ? t.value : t.value;
            const right = this.parseUnary();
            left = { kind: "binary", op, left, right, line: t.line };
        }
        return left;
    }

    parseUnary() {
        if (this.isOp("-")) {
            const t = this.next();
            return { kind: "unary", op: "-", operand: this.parseUnary(), line: t.line };
        }
        if (this.isOp("+")) { this.next(); return this.parseUnary(); }
        return this.parsePostfix();
    }

    parsePostfix() {
        let node = this.parsePrimary();
        for (;;) {
            if (this.isOp("[")) {
                const t = this.next();
                const indices = [this.parseExpression()];
                while (this.eatOp(",")) indices.push(this.parseExpression());
                this.expectOp("]", "] pour fermer l'indice");
                node = { kind: "index", target: node, indices, line: t.line };
            } else if (this.isOp("(")) {
                const t = this.next();
                const args = [];
                if (!this.isOp(")")) {
                    do { args.push(this.parseExpression()); } while (this.eatOp(","));
                }
                this.expectOp(")", ") pour fermer l'appel");
                node = { kind: "call", target: node, args, line: t.line };
            } else if (this.isOp(".") && this.peek(1).type === "ident") {
                const t = this.next();
                const field = this.expectIdent("de champ");
                node = { kind: "field", target: node, name: field.value, line: t.line };
            } else {
                break;
            }
        }
        return node;
    }

    parsePrimary() {
        const t = this.peek();

        if (t.type === "number") { this.next(); return { kind: "number", value: t.value, line: t.line }; }
        if (t.type === "string") { this.next(); return { kind: "string", value: t.value, line: t.line }; }

        if (t.type === "keyword" && (t.value === "vrai" || t.value === "faux")) {
            this.next();
            return { kind: "boolean", value: t.value === "vrai", line: t.line };
        }

        if (t.type === "ident") {
            this.next();
            return { kind: "var", name: t.value, raw: t.raw, line: t.line };
        }

        // « Caractere(65) » : le mot est réservé comme type, mais sert aussi
        // de fonction de conversion (page 5.8).
        if (t.type === "keyword" && t.value === "caractere" && this.isOp("(", 1)) {
            this.next();
            return { kind: "var", name: "caractere", raw: t.raw, line: t.line };
        }

        if (this.isOp("(")) {
            this.next();
            const expr = this.parseExpression();
            this.expectOp(")", ") pour fermer la parenthèse");
            return expr;
        }

        this.fail(`une expression est attendue (nombre, chaîne, variable…) au lieu de « ${t.raw || t.value} »`, t);
    }

    parseDesignator() {
        const t = this.peek();
        let node;
        if (t.type === "ident") {
            this.next();
            node = { kind: "var", name: t.value, raw: t.raw, line: t.line };
        } else {
            this.fail("un nom de variable est attendu", t);
        }
        for (;;) {
            if (this.isOp("[")) {
                const at = this.next();
                const indices = [this.parseExpression()];
                while (this.eatOp(",")) indices.push(this.parseExpression());
                this.expectOp("]", "] pour fermer l'indice");
                node = { kind: "index", target: node, indices, line: at.line };
            } else if (this.isOp(".") && this.peek(1).type === "ident") {
                const at = this.next();
                const field = this.expectIdent("de champ");
                node = { kind: "field", target: node, name: field.value, line: at.line };
            } else if (this.isOp("(")) {
                const at = this.next();
                const args = [];
                if (!this.isOp(")")) {
                    do { args.push(this.parseExpression()); } while (this.eatOp(","));
                }
                this.expectOp(")", ") pour fermer l'appel");
                node = { kind: "call", target: node, args, line: at.line };
            } else {
                break;
            }
        }
        return node;
    }
}
