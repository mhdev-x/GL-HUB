// =====================================================================
// GL HUB — Compilateur pseudo-code
// Point d'entrée : compilation + exécution + mise en forme des erreurs
// =====================================================================

import { AlgoError, normalizeWord, tokenize } from "./lexer.js";
import { parse } from "./parser.js";
import { execute } from "./interpreter.js";

export { AlgoError, normalizeWord, tokenize, parse, execute };

/** Compile et exécute un programme pseudo-code. */
export function run(source, options = {}) {
    const ast = parse(source);
    return execute(ast, options);
}

/** Message d'erreur lisible, prêt à afficher dans l'éditeur. */
export function formatError(e) {
    if (!(e instanceof AlgoError)) return { message: String(e && e.message || e), line: 0, col: 0, hint: null };
    return {
        message: e.message,
        line: e.line || 0,
        col: e.col || 0,
        hint: e.hint || null,
        text: e.line ? `Ligne ${e.line}, colonne ${e.col} : ${e.message}` : e.message
    };
}
