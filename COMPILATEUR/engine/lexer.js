// =====================================================================
// GL HUB — Compilateur pseudo-code
// Analyseur lexical (lexer)
//
// Conventions relevées dans « Le Guide du Génie Logiciel » (ch. 6 et 7) :
//   - mots-clés insensibles à la casse et aux accents
//     (Écrire / ecrire / ECRIRE, Données / Donnees)
//   - apostrophe typographique (Jusqu’à) tolérée
//   - affectation ← ou <-
//   - inégalité # (aussi <> et !=)
//   - 1..N pour les bornes de tableaux
// =====================================================================

export class AlgoError extends Error {
    constructor(message, line, col, hint) {
        super(message);
        this.name = "AlgoError";
        this.line = line;
        this.col = col;
        this.hint = hint;
    }
}

/** Normalise un mot : sans accents, minuscules, apostrophes et tirets unifiés. */
export function normalizeWord(s) {
    return String(s)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[\u2018\u2019']/g, "")   // « Jusqu’à » → « jusqua »
        .replace(/[\u2013\u2014]/g, "-");
}

// Mots réellement réservés. Volontairement ABSENTS : a, de, pas, allant, par,
// d, r — car « a » est un nom de variable très courant (somme(a, b)) et ces
// mots ne servent que dans un contexte grammatical précis (voir parser.js).
const RESERVED = new Set([
    "programme", "algorithme", "debut", "fin",
    "si", "alors", "sinon", "finsi",
    "tantque", "fintantque", "faire",
    "pour", "finpour",
    "repeter", "jusqua",
    "selon", "cas", "finselon", "autrement",
    "fonction", "procedure", "retourner",
    "var", "const", "type", "structure", "tableau",
    "entier", "reel", "chaine", "booleen", "caractere",
    "vrai", "faux", "et", "ou", "non", "div", "mod",
    "ecrire", "lire", "saisir",
    "donnee", "donnees", "resultat", "resultats"
]);

const LETTER = /[A-Za-zÀ-ÖØ-öø-ÿ_]/;
const DIGIT = /[0-9]/;
const IDENT_PART = /[A-Za-zÀ-ÖØ-öø-ÿ0-9_]/;

export function tokenize(source) {
    // Le livre écrit indifféremment « 1..N », « 1 … N » (ellipse) ou « 1 ... N »,
    // plusieurs flèches d'affectation, et les symboles ≠ ≤ ≥ (p. 47).
    const src = source
        .replace(/\u2026/g, "..")
        .replace(/\.\.\./g, "..")
        .replace(/[\u27F5\u27F6\u21D0\u2B05]/g, "\u2190")
        .replace(/\u2260/g, "!=")
        .replace(/\u2264/g, "<=")
        .replace(/\u2265/g, ">=");
    const toks = [];
    let i = 0;
    let line = 1;
    let col = 1;
    const n = src.length;

    const add = (type, value, raw, l, c) => toks.push({ type, value, raw, line: l, col: c });
    const advance = (k = 1) => { i += k; col += k; };

    while (i < n) {
        const c = src[i];

        if (c === "\n") { i++; line++; col = 1; continue; }
        if (c === " " || c === "\t" || c === "\r") { advance(); continue; }

        // Commentaire ligne : //
        if (c === "/" && src[i + 1] === "/") {
            while (i < n && src[i] !== "\n") advance();
            continue;
        }

        // Commentaire de fin de ligne : ==> (cours Ndacke GUEYE, p. 5 des tableaux)
        if (c === "=" && src.slice(i, i + 3) === "==>") {
            while (i < n && src[i] !== "\n") advance();
            continue;
        }

        // Chaîne entre guillemets français « … » (cours, types composés)
        if (c === "\u00AB") {
            const l = line, cc = col;
            advance();
            let value = "";
            while (i < n && src[i] !== "\u00BB") {
                if (src[i] === "\n") {
                    throw new AlgoError("Chaîne non fermée : il manque « » ».", l, cc);
                }
                value += src[i];
                advance();
            }
            if (i >= n) throw new AlgoError("Chaîne non fermée : il manque « » ».", l, cc);
            advance();
            // Typographie française : « Rouge » → la valeur est « Rouge »
            add("string", value.trim(), value, l, cc);
            continue;
        }

        // Chaîne
        if (c === '"') {
            const l = line, cc = col;
            advance();
            let value = "";
            while (i < n && src[i] !== '"') {
                if (src[i] === "\n") {
                    throw new AlgoError("Chaîne de caractères non fermée : il manque un guillemet.", l, cc);
                }
                value += src[i];
                advance();
            }
            if (i >= n) throw new AlgoError("Chaîne de caractères non fermée : il manque un guillemet.", l, cc);
            advance();
            add("string", value, value, l, cc);
            continue;
        }

        // Caractère entre apostrophes : 'A', 'z', '3' (chapitre 5)
        if (c === "'") {
            const l = line, cc = col;
            advance();
            let value = "";
            while (i < n && src[i] !== "'") {
                if (src[i] === "\n") {
                    throw new AlgoError("Caractère non fermé : il manque une apostrophe.", l, cc);
                }
                value += src[i];
                advance();
            }
            if (i >= n) throw new AlgoError("Caractère non fermé : il manque une apostrophe.", l, cc);
            advance();
            add("string", value, `'${value}'`, l, cc);
            continue;
        }

        // Nombre (1..N ne doit pas avaler le premier point)
        if (DIGIT.test(c)) {
            const l = line, cc = col;
            let raw = "";
            while (i < n && DIGIT.test(src[i])) { raw += src[i]; advance(); }
            let isInt = true;
            if (src[i] === "." && DIGIT.test(src[i + 1] || "")) {
                isInt = false;
                raw += ".";
                advance();
                while (i < n && DIGIT.test(src[i])) { raw += src[i]; advance(); }
            }
            add("number", isInt ? parseInt(raw, 10) : parseFloat(raw), raw, l, cc);
            continue;
        }

        // Identifiant ou mot-clé
        if (LETTER.test(c)) {
            const l = line, cc = col;
            let raw = "";
            while (i < n && (IDENT_PART.test(src[i]) || src[i] === "\u2019" || src[i] === "'")) { raw += src[i]; advance(); }
            const norm = normalizeWord(raw);
            // Synonymes du livre (pages 32 et 38) :
            //   Constante  → Const    Variable(s) → Var    Afficher → Écrire
            let canonical = norm;
            if (norm === "afficher") canonical = "ecrire";
            else if (norm === "constante") canonical = "const";
            else if (norm === "variable" || norm === "variables") canonical = "var";
            if (RESERVED.has(canonical)) add("keyword", canonical, raw, l, cc);
            else add("ident", norm, raw, l, cc);
            continue;
        }

        // Opérateurs à deux caractères
        const two = src.slice(i, i + 2);
        if (two === "<=" || two === ">=" || two === "<>" || two === "!=" || two === "<-" || two === "||") {
            const l = line, cc = col;
            advance(2);
            if (two === "<-") add("op", "assigne", two, l, cc);
            else add("op", two === "<>" || two === "!=" ? "!=" : two, two, l, cc);
            continue;
        }

        // Affectation flèche
        if (c === "\u2190") {           // ←
            const l = line, cc = col;
            advance();
            add("op", "assigne", "←", l, cc);
            continue;
        }

        if ("=#<>+-*/(),:;.[]{}".includes(c)) {
            const l = line, cc = col;
            advance();
            add("op", c, c, l, cc);
            continue;
        }

        throw new AlgoError(
            `Caractère inattendu « ${c} ».`,
            line, col,
            "Seuls les caractères du pseudo-code de cours sont acceptés."
        );
    }

    toks.push({ type: "eof", value: "", raw: "", line, col });
    return toks;
}
