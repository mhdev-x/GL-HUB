// ========================================================
// OUTILS COMMUNS DE L'ESPACE L2 — GL HUB
// (utilisés par responsable-l2, admin-l2 et espace-l2)
//
//  - détection des liens YouTube (même règle que le trigger SQL)
//  - fichiers autorisés au dépôt (extensions, taille)
//  - ouverture / téléchargement d'un fichier via l'Edge Function
//    l2-resource-access, sur le modèle de acces.js (L1)
//
// Sécurité : le type du fichier affiché dans le navigateur est décidé ICI
// à partir de l'extension (jamais d'après le Content-Type reçu), et
// seuls PDF, images et texte s'ouvrent dans un onglet. Un fichier .html
// ou .js déposé par erreur ne peut donc pas s'exécuter sur le site.
// ========================================================
(function () {

    let EXTENSIONS_AUTORISEES = [
        "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp",
        "txt", "md", "csv", "zip", "rar", "7z",
        "png", "jpg", "jpeg", "gif", "webp",
        "c", "h", "cpp", "java", "py", "js", "css", "sql", "json", "xml", "php", "sh"
    ];

    let TAILLE_MAX_OCTETS = 50 * 1024 * 1024; // même limite que le bucket ressources-l2

    let TYPES_AFFICHABLES = {
        pdf: "application/pdf",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        txt: "text/plain"
    };

    // ---------- YouTube ----------
    // Formats reconnus : watch?v=, youtu.be/, shorts/, embed/, live/
    let REGEX_YOUTUBE = /^https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#/].*)?$/i;

    let extraireIdYoutube = (url) => {
        let resultat = REGEX_YOUTUBE.exec(String(url || "").trim());
        return resultat ? resultat[1] : null;
    };

    // qualite : hqdefault (480x360), mqdefault (320x180, format 16:9 sans bandes noires)
    let urlMiniatureYoutube = (idVideo, qualite = "hqdefault") => `https://img.youtube.com/vi/${idVideo}/${qualite}.jpg`;
    let urlLecteurYoutube = (idVideo) => `https://www.youtube-nocookie.com/embed/${idVideo}?rel=0&autoplay=1`;

    // Vrai si ce format peut s'ouvrir dans un onglet (PDF, images, texte)
    let peutSeLireDansLeNavigateur = (extension) =>
        Object.prototype.hasOwnProperty.call(TYPES_AFFICHABLES, String(extension || "").toLowerCase());

    // ---------- Validations ----------
    let urlValide = (url) => /^https?:\/\/[^\s]+$/i.test(String(url || "").trim());

    let extensionDe = (nomFichier) => {
        let morceaux = String(nomFichier || "").toLowerCase().split(".");
        return morceaux.length > 1 ? morceaux.pop() : "";
    };

    // Retourne un message d'erreur, ou null si le fichier est accepté
    let verifierFichier = (fichier) => {
        if (!fichier) return "Choisis un fichier.";
        let extension = extensionDe(fichier.name);
        if (!EXTENSIONS_AUTORISEES.includes(extension)) {
            return `Ce format n'est pas accepté (.${extension || "?"}). Formats acceptés : PDF, Word, Excel, PowerPoint, archives, images et fichiers de code.`;
        }
        if (fichier.size > TAILLE_MAX_OCTETS) {
            return "Ce fichier dépasse 50 Mo. Compresse-le ou découpe-le.";
        }
        if (fichier.size === 0) return "Ce fichier est vide.";
        return null;
    };

    // Nom proposé au téléchargement : titre de la ressource + extension
    let nomPourTelechargement = (depot) => {
        let base = String(depot.titre || "ressource").replace(/[\\/:*?"<>|]+/g, "-").trim().slice(0, 80) || "ressource";
        let extension = depot.type_fichier || extensionDe(depot.chemin_fichier);
        return extension ? `${base}.${extension}` : base;
    };

    // ---------- Récupérer un fichier via l'Edge Function ----------
    let recupererFichier = async (depotId) => {
        try {
            let { data: sessionData } = await supabaseClient.auth.getSession();
            let session = sessionData.session;
            if (!session) return { erreur: "Connecte-toi pour accéder aux ressources." };

            let urlSupabase = typeof SUPABASE_URL !== "undefined" ? SUPABASE_URL : supabaseClient.supabaseUrl;
            let cleAnon = typeof SUPABASE_ANON_KEY !== "undefined" ? SUPABASE_ANON_KEY : supabaseClient.supabaseKey;

            let reponse = await fetch(`${urlSupabase}/functions/v1/l2-resource-access`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                    "apikey": cleAnon,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ depot_id: depotId })
            });

            if (reponse.ok) {
                return { blob: await reponse.blob() };
            }

            let detail = null;
            try { detail = await reponse.json(); } catch (_) { /* pas de JSON */ }
            console.error(`Fonction l2-resource-access (code ${reponse.status})`, detail);
            return { erreur: (detail && detail.error) || "Impossible d'ouvrir ce fichier pour le moment." };
        } catch (e) {
            console.error(e);
            return { erreur: "Impossible de joindre le serveur. Vérifie ta connexion." };
        }
    };

    // ---------- Ouvrir (lecture) ou télécharger un fichier ----------
    // notifier(texte) : fonction d'affichage des messages propre à la page
    let ouvrirFichier = async (depot, action, notifier) => {
        let extension = depot.type_fichier || extensionDe(depot.chemin_fichier);
        let seLitDansLeNavigateur = Object.prototype.hasOwnProperty.call(TYPES_AFFICHABLES, extension);

        // L'onglet est ouvert tout de suite : sinon certains navigateurs mobiles bloquent la fenêtre
        let fenetre = (action === "lecture" && seLitDansLeNavigateur) ? window.open("", "_blank") : null;

        let resultat = await recupererFichier(depot.id);
        if (resultat.erreur || !resultat.blob) {
            if (fenetre) fenetre.close();
            notifier(resultat.erreur || "Impossible d'ouvrir ce fichier pour le moment.");
            return false;
        }

        let typeFichier = seLitDansLeNavigateur ? TYPES_AFFICHABLES[extension] : "application/octet-stream";
        let adresseLocale = URL.createObjectURL(new Blob([resultat.blob], { type: typeFichier }));

        if (action === "lecture" && seLitDansLeNavigateur) {
            if (fenetre) fenetre.location.href = adresseLocale;
            else window.location.assign(adresseLocale); // popup bloquée : onglet courant
            return true;
        }

        if (fenetre) fenetre.close();
        if (action === "lecture") {
            notifier("Ce format s'ouvre avec ton application : le fichier est téléchargé.");
        }
        let lien = document.createElement("a");
        lien.href = adresseLocale;
        lien.download = nomPourTelechargement(depot);
        document.body.appendChild(lien);
        lien.click();
        lien.remove();
        setTimeout(() => URL.revokeObjectURL(adresseLocale), 60000);
        return true;
    };

    window.L2Outils = Object.freeze({
        EXTENSIONS_AUTORISEES,
        TAILLE_MAX_OCTETS,
        extraireIdYoutube,
        urlMiniatureYoutube,
        urlLecteurYoutube,
        peutSeLireDansLeNavigateur,
        urlValide,
        extensionDe,
        verifierFichier,
        nomPourTelechargement,
        recupererFichier,
        ouvrirFichier
    });
})();
