// =====================================================================
// GL HUB : service worker (v2)
//
// Ce que fait ce fichier :
//  - installe l'application (précache d'une page « hors connexion » et des icônes) ;
//  - garde en mémoire les pages déjà visitées pour les rouvrir sans réseau ;
//  - reçoit les notifications push et gère le clic dessus.
//
// Principe de prudence : le site n'a pas de build, donc des pages, des scripts et des styles
// qui changent souvent. Ils sont servis RÉSEAU D'ABORD : avec une connexion, on a toujours
// la dernière version ; le cache ne sert qu'en cas de coupure. Rien de ce qui vient d'un autre
// site (Supabase, Google, YouTube, CDN) n'est jamais touché : les connexions, la messagerie
// en temps réel et les fichiers privés passent directement par le réseau.
//
// À CHAQUE modification de ce fichier ou de la liste PRECACHE, change VERSION.
// =====================================================================
const VERSION = "glhub-v2";
const PREFIXE = "glhub-";
const CACHE_FIXE = `${VERSION}-fixe`;        // installé une fois : page hors connexion, icônes
const CACHE_PAGES = `${VERSION}-pages`;      // pages, scripts, styles visités (réseau d'abord)
const CACHE_MEDIAS = `${VERSION}-medias`;    // images et polices (cache d'abord)
const MAX_PAGES = 60;
const MAX_MEDIAS = 80;

const PAGE_HORS_LIGNE = "offline.html";
const PRECACHE = [
    PAGE_HORS_LIGNE,
    "manifest.json",
    "MEDIAS/LOGO-GL-HUB.png",
    "MEDIAS/icons/icon-192.png",
    "MEDIAS/icons/icon-512.png",
    "MEDIAS/icons/badge-96.png"
];

// Jamais mis en cache : pages d'administration, page des anciens comptes, ce fichier lui-même
const JAMAIS_EN_CACHE = [/\/admin[^/]*\.html$/, /\/connexion-ancien-compte\.html$/, /\/sw\.js$/];

const adresse = (chemin) => new URL(chemin, self.registration.scope).href;

// ---------- Installation ----------
// Chaque fichier est ajouté séparément : un fichier manquant (404, majuscule/minuscule
// différente sur Vercel ou GitHub Pages) ne doit JAMAIS empêcher le service worker de s'installer.
self.addEventListener("install", (evenement) => {
    evenement.waitUntil((async () => {
        const cache = await caches.open(CACHE_FIXE);
        const resultats = await Promise.allSettled(PRECACHE.map((chemin) => cache.add(adresse(chemin))));
        resultats.forEach((resultat, i) => {
            if (resultat.status === "rejected") {
                console.warn("[GL HUB] Fichier introuvable pour le précache :", PRECACHE[i]);
            }
        });
        await self.skipWaiting();
    })());
});

// ---------- Activation : on retire les caches des anciennes versions ----------
self.addEventListener("activate", (evenement) => {
    evenement.waitUntil((async () => {
        const gardes = [CACHE_FIXE, CACHE_PAGES, CACHE_MEDIAS];
        const noms = await caches.keys();
        await Promise.all(
            noms.filter((nom) => nom.startsWith(PREFIXE) && !gardes.includes(nom)).map((nom) => caches.delete(nom))
        );
        await self.clients.claim();
    })());
});

// ---------- Outils de cache ----------
const limiter = async (nomCache, maximum) => {
    const cache = await caches.open(nomCache);
    const cles = await cache.keys();
    for (let i = 0; i < cles.length - maximum; i++) await cache.delete(cles[i]);   // les plus anciennes d'abord
};

const reseauDabord = async (requete) => {
    const cache = await caches.open(CACHE_PAGES);
    const url = new URL(requete.url);
    // Une page se retrouve par son chemin, quel que soit ce qui suit le « ? »
    const cle = requete.mode === "navigate" ? new Request(url.origin + url.pathname) : requete;
    try {
        const reponse = await fetch(requete);
        if (reponse && reponse.ok && reponse.type === "basic") {
            cache.put(cle, reponse.clone()).then(() => limiter(CACHE_PAGES, MAX_PAGES)).catch(() => {});
        }
        return reponse;
    } catch (erreur) {
        const enCache = await cache.match(cle);
        if (enCache) return enCache;
        if (requete.mode === "navigate") {
            const horsLigne = await caches.match(adresse(PAGE_HORS_LIGNE));
            if (horsLigne) return horsLigne;
        }
        return Response.error();
    }
};

const cacheDabord = async (requete) => {
    const cache = await caches.open(CACHE_MEDIAS);
    const enCache = await cache.match(requete);
    if (enCache) return enCache;
    try {
        const reponse = await fetch(requete);
        if (reponse && reponse.ok && reponse.type === "basic") {
            cache.put(requete, reponse.clone()).then(() => limiter(CACHE_MEDIAS, MAX_MEDIAS)).catch(() => {});
        }
        return reponse;
    } catch (erreur) {
        return Response.error();
    }
};

// ---------- Requêtes ----------
self.addEventListener("fetch", (evenement) => {
    const requete = evenement.request;
    if (requete.method !== "GET") return;                       // envois, connexions : jamais touchés
    const url = new URL(requete.url);
    if (url.origin !== self.location.origin) return;            // Supabase, Google, YouTube, CDN : jamais touchés
    if (requete.headers.has("range")) return;                   // audio, vidéo, PDF : le navigateur s'en charge
    if (JAMAIS_EN_CACHE.some((motif) => motif.test(url.pathname))) return;

    const estCode = requete.mode === "navigate"
        || requete.destination === "script"
        || requete.destination === "style"
        || /\.(html|js|css|json)$/.test(url.pathname);

    if (estCode) {
        evenement.respondWith(reseauDabord(requete));
    } else if (requete.destination === "image" || requete.destination === "font") {
        evenement.respondWith(cacheDabord(requete));
    }
});

// ---------- Notifications push ----------
self.addEventListener("push", (evenement) => {
    let donnees = {};
    try {
        donnees = evenement.data ? evenement.data.json() : {};
    } catch (erreur) {
        donnees = { body: evenement.data ? evenement.data.text() : "" };
    }

    const titre = donnees.title || "GL HUB";
    const options = {
        body: donnees.body || "",
        icon: adresse("MEDIAS/icons/icon-192.png"),
        badge: adresse("MEDIAS/icons/badge-96.png"),
        tag: donnees.tag || undefined,             // même tag : la nouvelle notification remplace l'ancienne
        renotify: Boolean(donnees.tag),
        data: { url: donnees.url || "index.html" }
    };

    // On affiche TOUJOURS une notification : iOS et Chrome révoquent l'abonnement
    // si un push arrive sans qu'une notification soit montrée.
    evenement.waitUntil(self.registration.showNotification(titre, options));
});

// ---------- Clic sur une notification ----------
self.addEventListener("notificationclick", (evenement) => {
    evenement.notification.close();

    let cible = adresse((evenement.notification.data && evenement.notification.data.url) || "index.html");
    // Le contenu d'un push ne doit jamais pouvoir envoyer ailleurs que sur GL HUB
    if (new URL(cible).origin !== self.location.origin) cible = adresse("index.html");

    evenement.waitUntil((async () => {
        const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const fenetre of fenetres) {
            if (new URL(fenetre.url).origin === self.location.origin && "focus" in fenetre) {
                await fenetre.focus();
                if ("navigate" in fenetre) {
                    try { await fenetre.navigate(cible); } catch (erreur) { /* la fenêtre reste telle quelle */ }
                }
                return;
            }
        }
        await self.clients.openWindow(cible);
    })());
});

// ---------- Messages de la page (mise à jour immédiate si on le demande) ----------
self.addEventListener("message", (evenement) => {
    if (evenement.data && evenement.data.type === "SKIP_WAITING") self.skipWaiting();
});