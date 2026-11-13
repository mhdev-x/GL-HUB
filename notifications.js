// =====================================================================
// GL HUB : abonnement aux notifications push (côté page)
//
// À charger AVANT notifications-l2.js (la cloche), qui l'utilise pour proposer
// l'activation des notifications dans son panneau :
//   <script src="notifications.js" defer></script>
//   <script src="notifications-l2.js" defer></script>
//
// Utilisation directe possible (sans la cloche) :
//   GLHubPush.init({ supabase: supabaseClient, clePublique: "TA_CLE_VAPID_PUBLIQUE", espace: "l2" });
//   GLHubPush.lierBouton(document.getElementById("btn-notifications"));
// =====================================================================
(function () {
    "use strict";

    const config = { supabase: null, cle: null, espace: "l2" };

    // Si l'utilisateur désactive lui-même les notifications, on s'en souvient :
    // la resynchronisation automatique ne doit pas le réabonner contre son gré.
    const CLE_DESACTIVE = "glhub-push-desactive";

    function desactiveParUtilisateur() {
        try { return localStorage.getItem(CLE_DESACTIVE) === "1"; } catch (erreur) { return false; }
    }

    function memoriserDesactivation(desactive) {
        try {
            if (desactive) localStorage.setItem(CLE_DESACTIVE, "1");
            else localStorage.removeItem(CLE_DESACTIVE);
        } catch (erreur) { /* stockage indisponible : sans conséquence */ }
    }

    // ---------- Outils ----------
    function versUint8(base64) {
        const rembourrage = "=".repeat((4 - (base64.length % 4)) % 4);
        const brut = atob((base64 + rembourrage).replace(/-/g, "+").replace(/_/g, "/"));
        return Uint8Array.from(brut, function (c) { return c.charCodeAt(0); });
    }

    function supporte() {
        return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    }

    function iosNonInstalle() {
        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
            || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        const installee = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
        return ios && !installee;
    }

    // navigator.serviceWorker.ready ne se termine jamais si aucun service worker n'est enregistré :
    // on met une limite de 8 secondes pour ne pas bloquer le bouton indéfiniment.
    function registrationPrete() {
        return Promise.race([
            navigator.serviceWorker.ready,
            new Promise(function (_, rejeter) {
                setTimeout(function () { rejeter(new Error("Service worker non actif")); }, 8000);
            })
        ]);
    }

    async function enregistrer(abonnement) {
        const json = abonnement.toJSON();
        const reponse = await config.supabase.rpc("enregistrer_abonnement_push", {
            p_endpoint: json.endpoint,
            p_p256dh: json.keys.p256dh,
            p_auth: json.keys.auth,
            p_espace: config.espace,
            p_agent: navigator.userAgent.slice(0, 200)
        });
        if (reponse.error) throw reponse.error;
    }

    // ---------- État : non-supporte | ios-installer | refuse | actif | inactif ----------
    async function etat() {
        if (iosNonInstalle()) return "ios-installer";
        if (!supporte()) return "non-supporte";
        if (Notification.permission === "denied") return "refuse";
        try {
            const reg = await registrationPrete();
            const abonnement = await reg.pushManager.getSubscription();
            return abonnement && Notification.permission === "granted" ? "actif" : "inactif";
        } catch (erreur) {
            return "inactif";
        }
    }

    // ---------- Activer (à appeler depuis un clic) ----------
    async function activer() {
        const actuel = await etat();
        if (actuel === "ios-installer" || actuel === "non-supporte" || actuel === "refuse") {
            return { ok: false, raison: actuel };
        }
        try {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                return { ok: false, raison: permission === "denied" ? "refuse" : "ignore" };
            }
            memoriserDesactivation(false);
            const reg = await registrationPrete();
            let abonnement = await reg.pushManager.getSubscription();
            if (!abonnement) {
                abonnement = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: versUint8(config.cle)
                });
            }
            await enregistrer(abonnement);
            return { ok: true };
        } catch (erreur) {
            console.error("[GL HUB] Activation des notifications impossible :", erreur);
            return { ok: false, raison: "erreur", detail: String(erreur && erreur.message || erreur) };
        }
    }

    // ---------- Désactiver ----------
    // desactiver()                        : choix de l'utilisateur, on ne le réabonne pas tout seul
    // desactiver({ definitif: false })    : simple nettoyage (déconnexion), il sera réabonné à sa prochaine visite
    async function desactiver(options) {
        const definitif = !(options && options.definitif === false);
        try {
            if (definitif) memoriserDesactivation(true);
            const reg = await registrationPrete();
            const abonnement = await reg.pushManager.getSubscription();
            if (abonnement) {
                await config.supabase.from("abonnements_push").delete().eq("endpoint", abonnement.endpoint);
                await abonnement.unsubscribe();
            }
            return { ok: true };
        } catch (erreur) {
            console.error("[GL HUB] Désactivation impossible :", erreur);
            return { ok: false, raison: "erreur" };
        }
    }

    // ---------- Resynchronisation silencieuse (à chaque ouverture de la page) ----------
    // Si l'utilisateur a déjà accepté, on s'assure que son abonnement existe toujours
    // et qu'il est bien enregistré dans Supabase (les navigateurs peuvent le renouveler).
    async function synchroniser() {
        try {
            if (!supporte() || iosNonInstalle() || Notification.permission !== "granted") return;
            if (desactiveParUtilisateur()) return;
            const session = await config.supabase.auth.getSession();
            if (!session.data || !session.data.session) return;
            const reg = await registrationPrete();
            let abonnement = await reg.pushManager.getSubscription();
            if (!abonnement) {
                abonnement = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: versUint8(config.cle)
                });
            }
            await enregistrer(abonnement);
        } catch (erreur) {
            console.warn("[GL HUB] Synchronisation des notifications ignorée :", erreur);
        }
    }

    // ---------- Bouton prêt à l'emploi (icônes Font Awesome) ----------
    const LIBELLES = {
        actif: ['fa-bell-slash', "Désactiver les notifications", false],
        inactif: ['fa-bell', "Activer les notifications", false],
        refuse: ['fa-ban', "Notifications bloquées (réglages du navigateur)", true],
        "ios-installer": ['fa-mobile-screen', "Ajoute d'abord GL HUB à l'écran d'accueil", true],
        "non-supporte": ['fa-circle-info', "Notifications indisponibles sur cet appareil", true]
    };

    function lierBouton(bouton) {
        if (!bouton) return;

        async function afficher() {
            const e = await etat();
            const infos = LIBELLES[e] || LIBELLES.inactif;
            bouton.innerHTML = "";
            const icone = document.createElement("i");
            icone.className = "fa-solid " + infos[0];
            bouton.appendChild(icone);
            bouton.appendChild(document.createTextNode(" " + infos[1]));
            bouton.disabled = infos[2];
            bouton.dataset.etat = e;
        }

        bouton.addEventListener("click", async function () {
            bouton.disabled = true;
            if (bouton.dataset.etat === "actif") {
                await desactiver();
            } else {
                const resultat = await activer();
                if (!resultat.ok && resultat.raison === "erreur") {
                    alert("Impossible d'activer les notifications. Réessaie plus tard.");
                }
            }
            await afficher();
        });

        afficher();
    }

    // ---------- Initialisation ----------
    function init(options) {
        config.supabase = options.supabase;
        config.cle = options.clePublique;
        config.espace = options.espace || "l2";
        synchroniser();
    }

    window.GLHubPush = { init: init, etat: etat, activer: activer, desactiver: desactiver, lierBouton: lierBouton };
})();