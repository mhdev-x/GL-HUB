// =====================================================================
// GL HUB — Compilateur pseudo-code
// Interpréteur (exécution de l'AST)
// =====================================================================

import { AlgoError } from "./lexer.js";

const BOUNDS = Symbol("bounds");
const MAX_STEPS = 2_000_000;
const MAX_DEPTH = 400;

class ReturnSignal { constructor(value) { this.value = value; } }

class Scope {
    constructor(parent = null) { this.vars = new Map(); this.parent = parent; }
    has(name) { return this.vars.has(name) || (this.parent ? this.parent.has(name) : false); }
    lookup(name) {
        if (this.vars.has(name)) return this.vars.get(name);
        if (this.parent) return this.parent.lookup(name);
        return null;
    }
    declare(name, cell) { this.vars.set(name, cell); return cell; }
}

const cell = (value) => ({ get: () => value, set: (v) => { value = v; }, kind: "value" });

function formatValue(v) {
    if (typeof v === "boolean") return v ? "vrai" : "faux";
    if (typeof v === "number") {
        if (Number.isInteger(v)) return String(v);
        return String(Math.round(v * 1e10) / 1e10);
    }
    if (typeof v === "string") return v;
    if (v && v.__array) return "[tableau]";
    if (v && typeof v === "object") return "[enregistrement]";
    return String(v);
}

function isArray(v) { return !!(v && v.__array); }

function makeArray(dims, elemDefault) {
    const [d, ...rest] = dims;
    const arr = [];
    arr.__array = true;
    arr[BOUNDS] = d;
    for (let i = d.lo; i <= d.hi; i++) {
        arr[i] = rest.length ? makeArray(rest, elemDefault) : deepCopy(elemDefault);
    }
    return arr;
}

function deepCopy(v) {
    if (isArray(v)) {
        const arr = [];
        arr.__array = true;
        arr[BOUNDS] = v[BOUNDS];
        for (let i = v[BOUNDS].lo; i <= v[BOUNDS].hi; i++) arr[i] = deepCopy(v[i]);
        return arr;
    }
    if (v && typeof v === "object") {
        const o = { __type: v.__type };
        for (const k of Object.keys(v)) if (k !== "__type") o[k] = deepCopy(v[k]);
        return o;
    }
    return v;
}

export class Interpreter {
    constructor(program, options = {}) {
        this.program = program;
        this.inputs = (options.inputs || []).slice();
        this.output = [];
        this.steps = 0;
        this.depth = 0;
        this.functions = new Map();
        this.typeDefs = new Map();
        this.global = new Scope();
        this.returnStack = [];
        this.currentLine = 0;
    }

    // ---------- déclarations ----------
    instantiate(typeAst, scope) {
        if (!typeAst) return 0;
        if (typeAst.kind === "basic") {
            switch (typeAst.name) {
                case "entier": return 0;
                case "reel": return 0;
                case "chaine": return "";
                case "caractere": return "";
                case "booleen": return false;
                default: return 0;
            }
        }
        if (typeAst.kind === "enum") {
            const v = typeAst.values[0];
            return v.kind === "number" ? v.value : v.value;
        }
        if (typeAst.kind === "interval") {
            const v = typeAst.lo;
            return v.kind === "number" ? v.value : v.value;
        }
        if (typeAst.kind === "array") {
            const dims = typeAst.dims.map(d => ({
                lo: this.toInt(this.evalExpr(d.lo, scope), d.lo.line),
                hi: this.toInt(this.evalExpr(d.hi, scope), d.hi.line)
            }));
            for (const d of dims) {
                if (d.hi < d.lo) {
                    throw new AlgoError(
                        `Borne de tableau invalide : ${d.lo}..${d.hi}.`,
                        d.lo.line ?? this.currentLine, 1,
                        "La borne inférieure doit être inférieure ou égale à la borne supérieure."
                    );
                }
            }
            const elemDefault = this.instantiate(typeAst.elem, scope);
            return makeArray(dims, elemDefault);
        }
        if (typeAst.kind === "struct") {
            const obj = { __type: "structure" };
            for (const f of typeAst.fields) obj[f.name] = this.instantiate(f.typeAst, scope);
            return obj;
        }
        if (typeAst.kind === "named") {
            const def = this.typeDefs.get(typeAst.name);
            if (!def) {
                throw new AlgoError(`Type inconnu : « ${typeAst.name} ».`, typeAst.line ?? this.currentLine, 1);
            }
            return this.instantiate(def, scope);
        }
        return 0;
    }

    execDeclarations(decls, scope) {
        for (const d of decls) {
            if (d.kind === "const") {
                const v = this.evalExpr(d.value, scope);
                scope.declare(d.name, { get: () => v, set: () => { throw new AlgoError(`Impossible de modifier la constante « ${d.raw} ».`, d.line, 1); }, kind: "const" });
            } else if (d.kind === "type") {
                this.typeDefs.set(d.name, d.typeAst);
            } else if (d.kind === "var") {
                let value;
                if (d.init) value = this.evalExpr(d.init, scope);
                else value = this.instantiate(d.typeAst, scope);
                scope.declare(d.name, cell(value));
            }
        }
    }

    // ---------- exécution ----------
    run() {
        for (const m of this.program.modules) this.functions.set(m.name, m);

        this.execDeclarations(this.program.declarations, this.global);
        if (this.program.main) this.execBlock(this.program.main, this.global);

        return { output: this.output, steps: this.steps };
    }

    tick(line) {
        this.currentLine = line || this.currentLine;
        if (++this.steps > MAX_STEPS) {
            throw new AlgoError(
                "Exécution interrompue : plus de 2 000 000 d'instructions.",
                this.currentLine, 1,
                "Une boucle ne s'arrête probablement jamais. Vérifie sa condition."
            );
        }
    }

    execBlock(block, scope) {
        for (const st of block.body) this.execStatement(st, scope);
    }

    execStatement(st, scope) {
        this.tick(st.line);
        switch (st.kind) {
            case "assign": {
                const value = this.evalExpr(st.value, scope);
                this.assignTo(st.target, value, scope);
                return;
            }
            case "exprstmt": {
                this.evalExpr(st.expr, scope);
                return;
            }
            case "write": {
                const parts = st.args.map(a => formatValue(this.evalExpr(a, scope)));
                this.output.push(parts.join(""));
                return;
            }
            case "read": {
                for (const target of st.args) {
                    const raw = this.inputs.shift();
                    if (raw === undefined) {
                        throw new AlgoError(
                            "Il n'y a plus de valeur à lire : le programme attend une entrée.",
                            st.line, 1,
                            "Fournis les valeurs d'entrée avant de lancer l'exécution."
                        );
                    }
                    const current = this.readLValue(target, scope);
                    this.assignTo(target, this.coerceInput(raw, current), scope);
                }
                return;
            }
            case "if": {
                if (this.toBool(this.evalExpr(st.cond, scope), st.line)) this.execBlock({ body: st.then }, scope);
                else this.execBlock({ body: st.otherwise }, scope);
                return;
            }
            case "while": {
                while (this.toBool(this.evalExpr(st.cond, scope), st.line)) {
                    this.tick(st.line);
                    this.execBlock({ body: st.body }, scope);
                }
                return;
            }
            case "for": {
                const start = this.toInt(this.evalExpr(st.start, scope), st.start.line);
                const end = this.toInt(this.evalExpr(st.end, scope), st.end.line);
                const step = st.step ? this.toInt(this.evalExpr(st.step, scope), st.step.line) : 1;
                if (step === 0) {
                    throw new AlgoError("Le pas d'une boucle Pour ne peut pas être 0.", st.line, 1);
                }
                const name = st.varName;
                if (!scope.has(name)) scope.declare(name, cell(0));
                const indexCell = scope.lookup(name);
                for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
                    indexCell.set(i);
                    this.tick(st.line);
                    this.execBlock({ body: st.body }, scope);
                }
                return;
            }
            case "repeat": {
                do {
                    this.tick(st.line);
                    this.execBlock({ body: st.body }, scope);
                } while (!this.toBool(this.evalExpr(st.cond, scope), st.line));
                return;
            }
            case "switch": {
                const v = this.evalExpr(st.expr, scope);
                let matched = false;
                for (const c of st.cases) {
                    if (c.values.some(x => this.equals(v, this.evalExpr(x, scope)))) {
                        matched = true;
                        this.execBlock({ body: c.body }, scope);
                        break;
                    }
                }
                if (!matched && st.otherwise) this.execBlock({ body: st.otherwise }, scope);
                return;
            }
            case "return": {
                const value = st.value ? this.evalExpr(st.value, scope) : null;
                throw new ReturnSignal(value);
            }
            default:
                throw new AlgoError(`Instruction inconnue : ${st.kind}`, st.line ?? this.currentLine, 1);
        }
    }

    // ---------- affectation ----------
    assignTo(node, value, scope) {
        if (node.kind === "var") {
            const name = node.name;
            const c = scope.lookup(name);
            if (c) {
                if (c.kind === "const") throw new AlgoError(`« ${node.raw} » est une constante : elle ne peut pas être modifiée.`, node.line, 1);
                c.set(value);
            } else {
                scope.declare(name, cell(value));
            }
            // « nomFonction ← expression » : c'est un retour implicite
            const frame = this.returnStack[this.returnStack.length - 1];
            if (frame && frame.name === name) frame.value = value;
            return;
        }
        if (node.kind === "index") {
            const arr = this.evalExpr(node.target, scope);
            if (!isArray(arr)) throw new AlgoError("Cet indice s'applique à une valeur qui n'est pas un tableau.", node.line, 1);
            const indices = node.indices.map(ix => this.toInt(this.evalExpr(ix, scope), ix.line));
            let cur = arr;
            for (let k = 0; k < indices.length; k++) {
                if (!isArray(cur)) throw new AlgoError("Trop d'indices pour ce tableau.", node.line, 1);
                const b = cur[BOUNDS];
                const i = indices[k];
                if (i < b.lo || i > b.hi) {
                    throw new AlgoError(
                        `Indice ${i} hors bornes : le tableau va de ${b.lo} à ${b.hi}.`,
                        node.line, 1,
                        "Au Sénégal comme en cours, les tableaux commencent à 1."
                    );
                }
                if (k === indices.length - 1) cur[i] = value;
                else cur = cur[i];
            }
            return;
        }
        if (node.kind === "field") {
            const obj = this.evalExpr(node.target, scope);
            if (!obj || typeof obj !== "object") throw new AlgoError(`« ${node.name} » ne s'applique pas à cette valeur.`, node.line, 1);
            if (!(node.name in obj)) throw new AlgoError(`Le champ « ${node.name} » n'existe pas.`, node.line, 1);
            obj[node.name] = value;
            return;
        }
        throw new AlgoError("Cette expression ne peut pas recevoir de valeur.", node.line, 1);
    }

    readLValue(node, scope) {
        try { return this.evalExpr(node, scope); } catch { return undefined; }
    }

    coerceInput(raw, current) {
        if (typeof current === "number") {
            const n = Number(String(raw).replace(",", "."));
            if (Number.isNaN(n)) {
                throw new AlgoError(`« ${raw} » n'est pas un nombre valide.`, this.currentLine, 1);
            }
            return Number.isInteger(current) ? Math.trunc(n) : n;
        }
        if (typeof current === "boolean") {
            const s = String(raw).trim().toLowerCase();
            if (["vrai", "true", "1", "oui"].includes(s)) return true;
            if (["faux", "false", "0", "non"].includes(s)) return false;
            throw new AlgoError(`« ${raw} » n'est pas un booléen (attendu : vrai ou faux).`, this.currentLine, 1);
        }
        return String(raw);
    }

    // ---------- expressions ----------
    evalExpr(node, scope) {
        switch (node.kind) {
            case "number": return node.value;
            case "string": return node.value;
            case "boolean": return node.value;
            case "var": {
                const c = scope.lookup(node.name);
                if (!c) {
                    throw new AlgoError(
                        `La variable « ${node.raw} » n'est pas déclarée.`,
                        node.line, 1,
                        "Ajoute-la dans le bloc « Var » avant le Début."
                    );
                }
                return c.get();
            }
            case "index": {
                const arr = this.evalExpr(node.target, scope);
                if (!isArray(arr)) throw new AlgoError("Cet indice s'applique à une valeur qui n'est pas un tableau.", node.line, 1);
                let cur = arr;
                for (const ix of node.indices) {
                    if (!isArray(cur)) throw new AlgoError("Trop d'indices pour ce tableau.", node.line, 1);
                    const b = cur[BOUNDS];
                    const i = this.toInt(this.evalExpr(ix, scope), ix.line);
                    if (i < b.lo || i > b.hi) {
                        throw new AlgoError(
                            `Indice ${i} hors bornes : le tableau va de ${b.lo} à ${b.hi}.`,
                            node.line, 1
                        );
                    }
                    cur = cur[i];
                }
                return cur;
            }
            case "field": {
                const obj = this.evalExpr(node.target, scope);
                if (!obj || typeof obj !== "object") {
                    throw new AlgoError(`« .${node.name} » s'applique à une valeur qui n'est pas un enregistrement.`, node.line, 1);
                }
                if (!(node.name in obj)) {
                    throw new AlgoError(`Le champ « ${node.name} » n'existe pas dans cet enregistrement.`, node.line, 1);
                }
                return obj[node.name];
            }
            case "unary": {
                if (node.op === "non") return !this.toBool(this.evalExpr(node.operand, scope), node.line);
                const v = this.evalExpr(node.operand, scope);
                return -this.toNumber(v, node.line);
            }
            case "binary": return this.evalBinary(node, scope);
            case "call": return this.evalCall(node, scope);
            default:
                throw new AlgoError(`Expression inconnue : ${node.kind}`, node.line ?? this.currentLine, 1);
        }
    }

    evalBinary(node, scope) {
        const op = node.op;

        if (op === "et") {
            const l = this.toBool(this.evalExpr(node.left, scope), node.line);
            return l ? this.toBool(this.evalExpr(node.right, scope), node.line) : false;
        }
        if (op === "ou") {
            const l = this.toBool(this.evalExpr(node.left, scope), node.line);
            return l ? true : this.toBool(this.evalExpr(node.right, scope), node.line);
        }

        const a = this.evalExpr(node.left, scope);
        const b = this.evalExpr(node.right, scope);

        if (op === "=") return this.equals(a, b);
        if (op === "!=" || op === "#") return !this.equals(a, b);

        if (op === "<" || op === ">" || op === "<=" || op === ">=") {
            const cmp = this.compare(a, b, node.line);
            switch (op) {
                case "<": return cmp < 0;
                case ">": return cmp > 0;
                case "<=": return cmp <= 0;
                case ">=": return cmp >= 0;
            }
        }

        if (op === "+" && (typeof a === "string" || typeof b === "string")) {
            return formatValue(a) + formatValue(b);
        }

        if (op === "||") {
            return formatValue(a) + formatValue(b);
        }

        const x = this.toNumber(a, node.line);
        const y = this.toNumber(b, node.line);

        switch (op) {
            case "+": return x + y;
            case "-": return x - y;
            case "*": return x * y;
            case "/":
                if (y === 0) throw new AlgoError("Division par zéro.", node.line, 1);
                return x / y;
            case "div":
                if (y === 0) throw new AlgoError("Division par zéro (div).", node.line, 1);
                return Math.trunc(x / y);
            case "mod":
                if (y === 0) throw new AlgoError("Division par zéro (mod).", node.line, 1);
                return x % y;
            default:
                throw new AlgoError(`Opérateur inconnu : ${op}`, node.line, 1);
        }
    }

    evalCall(node, scope) {
        const target = node.target;
        if (target.kind !== "var") throw new AlgoError("Seul un nom de module peut être appelé.", node.line, 1);
        const name = target.name;

        const builtin = this.builtins[name];
        if (builtin) {
            const args = node.args.map(a => this.evalExpr(a, scope));
            return builtin(args, node.line);
        }

        const fn = this.functions.get(name);
        if (!fn) {
            throw new AlgoError(
                `Le module « ${target.raw} » n'existe pas.`,
                node.line, 1,
                "Vérifie son nom, ou déclare-le avec « Fonction » / « Procédure »."
            );
        }

        if (++this.depth > MAX_DEPTH) {
            throw new AlgoError(
                "Récursion trop profonde (plus de 400 appels).",
                node.line, 1,
                "Il manque sûrement le cas de base qui arrête les appels."
            );
        }

        const local = new Scope(this.global);
        const arity = fn.params.length;
        if (node.args.length !== arity) {
            throw new AlgoError(
                `« ${target.raw} » attend ${arity} argument(s), ${node.args.length} fourni(s).`,
                node.line, 1
            );
        }

        for (let i = 0; i < arity; i++) {
            const p = fn.params[i];
            const argNode = node.args[i];
            if (p.mode === "donnee") {
                local.declare(p.name, cell(deepCopy(this.evalExpr(argNode, scope))));
            } else {
                // Résultat et Donnée/Résultat : la cellule pointe sur l'argument
                // de l'appelant, en lecture comme en écriture.
                const ref = {
                    get: () => this.evalExpr(argNode, scope),
                    set: (v) => this.assignTo(argNode, v, scope),
                    kind: "ref"
                };
                local.declare(p.name, ref);
            }
        }

        this.returnStack.push({ name: fn.name, value: null });
        let returned = undefined;
        try {
            this.execDeclarations(fn.declarations, local);
            this.execBlock(fn.body, local);
            returned = this.returnStack[this.returnStack.length - 1].value;
        } catch (e) {
            if (e instanceof ReturnSignal) {
                returned = e.value !== null && e.value !== undefined
                    ? e.value
                    : this.returnStack[this.returnStack.length - 1].value;
            } else {
                this.returnStack.pop();
                this.depth--;
                throw e;
            }
        }
        this.returnStack.pop();
        this.depth--;

        if (fn.kind === "function" && returned === undefined) returned = 0;
        return returned;
    }

    // ---------- helpers ----------
    get builtins() {
        return {
            rang: (args) => {
                const [s, sub] = args.map(formatValue);
                const i = s.indexOf(sub);
                return i < 0 ? 0 : i + 1;
            },
            longueur: (args) => formatValue(args[0]).length,
            long: (args) => formatValue(args[0]).length,   // alias (p. 177)
            // SSChaine / Souschaine (texte, position, longueur) — p. 178, 190-191
            sschaine: (args) => {
                const s = formatValue(args[0]);
                const pos = this.toInt(args[1], this.currentLine);
                const len = this.toInt(args[2], this.currentLine);
                if (pos < 1 || len <= 0) return "";
                return s.substr(pos - 1, len);
            },
            concat: (args) => args.map(formatValue).join(""),
            souschaine: (args) => {
                const s = formatValue(args[0]);
                const pos = this.toInt(args[1], this.currentLine);
                const len = this.toInt(args[2], this.currentLine);
                if (pos < 1 || len <= 0) return "";
                return s.substr(pos - 1, len);
            },
            cvchaine: (args) => formatValue(args[0]),
            cvnombre: (args) => {
                const n = parseInt(String(formatValue(args[0])).trim(), 10);
                if (Number.isNaN(n)) {
                    throw new AlgoError(`cvNombre : « ${formatValue(args[0])} » n'est pas un nombre.`, this.currentLine, 1);
                }
                return n;
            },
            code: (args) => {
                const s = formatValue(args[0]);
                return s.length ? s.charCodeAt(0) : 0;
            },
            car: (args) => String.fromCharCode(this.toInt(args[0], this.currentLine)),
            caractere: (args) => String.fromCharCode(this.toInt(args[0], this.currentLine)),
            abs: (args) => Math.abs(this.toNumber(args[0], this.currentLine)),
            ent: (args) => Math.trunc(this.toNumber(args[0], this.currentLine)),
            racine: (args) => Math.sqrt(this.toNumber(args[0], this.currentLine)),
            sqrt: (args) => Math.sqrt(this.toNumber(args[0], this.currentLine)),
            sqr: (args) => { const x = this.toNumber(args[0], this.currentLine); return x * x; },
            carre: (args) => { const x = this.toNumber(args[0], this.currentLine); return x * x; },
            not: (args) => !this.toBool(args[0], this.currentLine)
        };
    }

    toNumber(v, line) {
        if (typeof v === "number") return v;
        if (typeof v === "boolean") return v ? 1 : 0;
        throw new AlgoError("Un nombre est attendu dans ce calcul.", line ?? this.currentLine, 1);
    }

    toInt(v, line) {
        const n = this.toNumber(v, line);
        return Math.trunc(n);
    }

    toBool(v, line) {
        if (typeof v === "boolean") return v;
        throw new AlgoError("Une condition (vrai/faux) est attendue ici.", line ?? this.currentLine, 1);
    }

    equals(a, b) {
        if (typeof a === "number" && typeof b === "number") return a === b;
        if (typeof a === "boolean" && typeof b === "boolean") return a === b;
        if (typeof a === "string" || typeof b === "string") return formatValue(a) === formatValue(b);
        return a === b;
    }

    compare(a, b, line) {
        if (typeof a === "number" && typeof b === "number") return a - b;
        if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
        throw new AlgoError("Impossible de comparer ces deux valeurs.", line ?? this.currentLine, 1);
    }
}

export function execute(program, options = {}) {
    return new Interpreter(program, options).run();
}
