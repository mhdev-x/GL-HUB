// =====================================================================
// GL HUB : cloche de notifications de l'espace L2
//
// A charger sur TOUTES les pages (après supabaseClient.js, avec defer) :
//   <script src="notifications.js" defer></script>
//   <script src="notifications-l2.js" defer></script>
//
// Ce que fait ce fichier, sur n'importe quelle page :
//  1. vérifie que la personne connectée est concernée (admin, membre de la
//     classe, ou demande d'accès en cours) : sinon, il ne se passe rien ;
//  2. ajoute une cloche avec un compteur dans la barre de navigation ;
//  3. écoute la table notifications_l2 en temps réel : un bandeau apparaît
//     dès qu'une notification arrive, sans recharger la page ;
//  4. permet d'effacer ses notifications (les lues d'un coup, ou une par une) ;
//  5. propose dans le panneau d'activer les notifications sur l'appareil
//     (push, même quand le site est fermé) grâce à notifications.js.
//
// Sécurité : tout ce qui vient de la base (noms, messages) est affiché avec
// textContent, jamais innerHTML. Chacun ne reçoit que SES notifications
// (règle RLS côté Supabase).
// =====================================================================
(function () {
    "use strict";

    if (window.GLHubCloche) return;   // évite un double chargement
    window.GLHubCloche = true;

    // ---------- Réglages ----------
    // Clé VAPID PUBLIQUE (npx web-push generate-vapid-keys). Elle n'est pas secrète.
    const CLE_VAPID_PUBLIQUE = "BH1-c_IXrqWs85wE-UjxrFUyBhxxObvoho22LxzqAU0MzoAtEkv-ZWjgoV2tH35cV08mbuHVfBMgDtLRLtDZTd8";

    const MAX_NOTIFICATIONS = 30;       // nombre affiché dans le panneau
    const JOURS_CONSERVES = 30;         // même durée que le ménage côté base
    const DUREE_BANDEAU_MS = 7000;
    const RECHARGE_APRES_MS = 60000;    // retour sur l'onglet : on recharge si c'est plus vieux que ça

    // Ces pages affichent déjà leur contenu en direct : leurs notifications sont lues d'office
    const AUTO_LUES = ["message", "seance"];

    const ICONES = {
        message: "fa-comments",
        seance: "fa-calendar-days",
        ressource: "fa-folder-open",
        demande: "fa-user-plus",
        acces: "fa-circle-check"
    };

    const script = document.currentScript;
    const base = script && script.src ? new URL("./", script.src) : new URL("./", location.href);

    const etat = {
        userId: null,
        monte: false,
        ouvert: false,
        notifs: [],
        canal: null,
        bandeau: null,
        minuteurBandeau: null,
        derniereCharge: 0,
        pushPret: false
    };
    const el = {};   // éléments du DOM créés par ce script

    // ---------- Petits outils ----------
    function creer(balise, classe, texte) {
        const element = document.createElement(balise);
        if (classe) element.className = classe;
        if (texte) element.textContent = texte;
        return element;
    }

    function icone(nom) {
        const i = document.createElement("i");
        i.className = "fa-solid " + nom;
        i.setAttribute("aria-hidden", "true");
        return i;
    }

    function nomDePage(adresse) {
        return String(adresse || "").split(/[?#]/)[0].split("/").pop();
    }

    function pageCourante() {
        return location.pathname.split("/").pop() || "index.html";
    }

    // Titre affiché : les notifications regroupées s'additionnent ("3 nouveaux messages")
    function titreAffiche(n) {
        if (n.nombre > 1) {
            if (n.cle === "discussion") return n.nombre + " nouveaux messages";
            if (n.cle === "edt") return n.nombre + " changements d'emploi du temps";
            if (n.cle === "ressources") return n.nombre + " nouvelles ressources";
            if (n.cle === "demandes") return n.nombre + " nouvelles demandes d'accès";
        }
        return n.titre;
    }

    function ilYA(dateIso) {
        const secondes = Math.max(0, Math.round((Date.now() - new Date(dateIso).getTime()) / 1000));
        if (secondes < 60) return "à l'instant";
        const minutes = Math.floor(secondes / 60);
        if (minutes < 60) return "il y a " + minutes + " min";
        const heures = Math.floor(minutes / 60);
        if (heures < 24) return "il y a " + heures + " h";
        const jours = Math.floor(heures / 24);
        if (jours < 7) return "il y a " + jours + (jours > 1 ? " jours" : " jour");
        return new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    }

    // Charge la feuille de style (sans attendre plus d'1,5 seconde)
    function chargerStyles() {
        return new Promise(function (resolu) {
            const href = new URL("STYLES/notifications-l2.css", base).href;
            if (document.querySelector('link[href="' + href + '"]')) {
                resolu();
                return;
            }
            const lien = document.createElement("link");
            lien.rel = "stylesheet";
            lien.href = href;
            lien.onload = resolu;
            lien.onerror = resolu;
            document.head.appendChild(lien);
            setTimeout(resolu, 1500);
        });
    }

    // ---------- Panneau : ouvrir / fermer ----------
    function ouvrirPanneau() {
        etat.ouvert = true;
        el.panneau.hidden = false;
        el.bouton.setAttribute("aria-expanded", "true");
        rendre();   // met aussi à jour les "il y a 5 min"
    }

    function fermerPanneau() {
        etat.ouvert = false;
        if (el.panneau) el.panneau.hidden = true;
        if (el.bouton) el.bouton.setAttribute("aria-expanded", "false");
    }

    function clicExterieur(evenement) {
        if (etat.ouvert && el.zone && !el.zone.contains(evenement.target)) fermerPanneau();
    }

    function toucheClavier(evenement) {
        if (evenement.key === "Escape" && etat.ouvert) {
            fermerPanneau();
            if (el.bouton) el.bouton.focus();
        }
    }

    // ---------- Construction de la cloche dans la barre de navigation ----------
    function construireInterface() {
        if (el.bouton) return true;

        const nav = document.querySelector(".nav-interieur");
        if (!nav) return false;

        // Zone à droite de la barre : on y range la cloche et le bouton de thème
        let zone = nav.querySelector(".nav-actions");
        if (!zone) {
            zone = creer("div", "nav-actions");
            const bascule = document.getElementById("themeToggle");
            if (bascule && bascule.parentNode === nav) {
                nav.insertBefore(zone, bascule);
                zone.appendChild(bascule);
            } else {
                nav.appendChild(zone);
            }
        }

        const bouton = creer("button", "cloche-bouton");
        bouton.type = "button";
        bouton.id = "clocheBouton";
        bouton.setAttribute("aria-label", "Notifications");
        bouton.setAttribute("aria-haspopup", "dialog");
        bouton.setAttribute("aria-expanded", "false");
        bouton.setAttribute("aria-controls", "clochePanneau");
        const badge = creer("span", "cloche-badge");
        badge.hidden = true;
        bouton.append(icone("fa-bell"), badge);

        const panneau = creer("div", "cloche-panneau");
        panneau.id = "clochePanneau";
        panneau.setAttribute("role", "dialog");
        panneau.setAttribute("aria-label", "Notifications");
        panneau.hidden = true;

        const entete = creer("div", "cloche-entete");
        entete.appendChild(creer("strong", null, "Notifications"));

        // Actions groupées : visibles seulement quand elles ont un sens
        const actions = creer("div", "cloche-actions");
        actions.hidden = true;
        const toutLu = creer("button", "cloche-tout-lu");
        toutLu.type = "button";
        toutLu.append(icone("fa-check-double"), document.createTextNode(" Tout marquer comme lu"));
        const effacerLues = creer("button", "cloche-tout-lu cloche-effacer-lues");
        effacerLues.type = "button";
        effacerLues.append(icone("fa-trash-can"), document.createTextNode(" Effacer les lues"));
        actions.append(toutLu, effacerLues);

        const liste = creer("ul", "cloche-liste");
        const vide = creer("p", "cloche-vide", "Aucune notification pour le moment.");

        const pied = creer("div", "cloche-pied");
        pied.hidden = true;
        const boutonPush = creer("button", "cloche-push");
        boutonPush.type = "button";
        pied.appendChild(boutonPush);

        panneau.append(entete, actions, liste, vide, pied);
        zone.insertBefore(bouton, zone.firstChild);
        zone.appendChild(panneau);

        Object.assign(el, { zone, bouton, badge, panneau, actions, toutLu, effacerLues, liste, vide, pied, boutonPush });

        bouton.addEventListener("click", function () {
            if (etat.ouvert) fermerPanneau(); else ouvrirPanneau();
        });
        toutLu.addEventListener("click", function () { marquerLues(null); });
        effacerLues.addEventListener("click", function () { effacer(null); });
        document.addEventListener("click", clicExterieur);
        document.addEventListener("keydown", toucheClavier);
        return true;
    }

    // ---------- Affichage ----------
    function creerItem(n) {
        const li = document.createElement("li");
        const lien = creer("a", "cloche-item" + (n.lu_le ? "" : " cloche-item-nonlu"));
        lien.href = n.url || "index.html";

        const pastille = creer("span", "cloche-icone");
        pastille.appendChild(icone(ICONES[n.type] || "fa-bell"));

        const texte = creer("span", "cloche-texte");
        texte.appendChild(creer("span", "cloche-titre", titreAffiche(n)));
        if (n.corps) texte.appendChild(creer("span", "cloche-corps", n.corps));
        texte.appendChild(creer("span", "cloche-temps", ilYA(n.cree_le)));

        lien.append(pastille, texte);
        if (!n.lu_le) lien.appendChild(creer("span", "cloche-point"));

        lien.addEventListener("click", function (evenement) {
            // Ctrl, Cmd, Maj ou clic du milieu : le navigateur ouvre un nouvel onglet comme d'habitude
            if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.button === 1) return;
            evenement.preventDefault();
            ouvrirNotification(n);
        });

        const supprimer = creer("button", "cloche-item-supprimer");
        supprimer.type = "button";
        supprimer.title = "Effacer";
        supprimer.setAttribute("aria-label", "Effacer cette notification");
        supprimer.appendChild(icone("fa-xmark"));
        supprimer.addEventListener("click", function (evenement) {
            evenement.stopPropagation();   // la ligne disparaît : le panneau ne doit pas se fermer
            effacer([n.id]);
        });

        li.className = "cloche-ligne";
        li.append(lien, supprimer);
        return li;
    }

    function rendre() {
        if (!el.bouton) return;

        const nonLues = etat.notifs.filter(function (n) { return !n.lu_le; }).length;
        const lues = etat.notifs.length - nonLues;
        el.badge.hidden = nonLues === 0;
        el.badge.textContent = nonLues > 9 ? "9+" : String(nonLues);
        el.bouton.setAttribute(
            "aria-label",
            nonLues === 0 ? "Notifications" : "Notifications : " + nonLues + (nonLues > 1 ? " non lues" : " non lue")
        );
        el.toutLu.hidden = nonLues === 0;
        el.effacerLues.hidden = lues === 0;
        el.actions.hidden = nonLues === 0 && lues === 0;
        el.vide.hidden = etat.notifs.length > 0;
        el.liste.replaceChildren.apply(el.liste, etat.notifs.map(creerItem));
    }

    function secouer() {
        if (!el.bouton) return;
        el.bouton.classList.remove("cloche-secoue");
        void el.bouton.offsetWidth;   // relance l'animation
        el.bouton.classList.add("cloche-secoue");
        setTimeout(function () {
            if (el.bouton) el.bouton.classList.remove("cloche-secoue");
        }, 1000);
    }

    // ---------- Bandeau en direct ----------
    function retirerBandeau() {
        clearTimeout(etat.minuteurBandeau);
        if (etat.bandeau) {
            etat.bandeau.remove();
            etat.bandeau = null;
        }
    }

    function montrerBandeau(ligne) {
        retirerBandeau();

        const bandeau = creer("div", "cloche-bandeau");
        bandeau.setAttribute("role", "status");

        const pastille = creer("span", "cloche-icone");
        pastille.appendChild(icone(ICONES[ligne.type] || "fa-bell"));

        const texte = creer("span", "cloche-texte");
        texte.appendChild(creer("span", "cloche-titre", titreAffiche(ligne)));
        if (ligne.corps) texte.appendChild(creer("span", "cloche-corps", ligne.corps));

        const fermer = creer("button", "cloche-bandeau-fermer");
        fermer.type = "button";
        fermer.setAttribute("aria-label", "Fermer la notification");
        fermer.appendChild(icone("fa-xmark"));

        bandeau.append(pastille, texte, fermer);
        bandeau.addEventListener("click", function (evenement) {
            if (evenement.target.closest(".cloche-bandeau-fermer")) {
                retirerBandeau();
                return;
            }
            retirerBandeau();
            ouvrirNotification(ligne);
        });

        document.body.appendChild(bandeau);
        etat.bandeau = bandeau;
        requestAnimationFrame(function () { bandeau.classList.add("cloche-bandeau-visible"); });
        etat.minuteurBandeau = setTimeout(retirerBandeau, DUREE_BANDEAU_MS);
    }

    // ---------- Lecture ----------
    async function marquerLues(ids) {
        const maintenant = new Date().toISOString();
        etat.notifs.forEach(function (n) {
            if (!n.lu_le && (!ids || ids.indexOf(n.id) !== -1)) n.lu_le = maintenant;
        });
        rendre();

        try {
            const reponse = await supabaseClient.rpc("marquer_notifications_l2_lues", { p_ids: ids });
            if (reponse.error) console.warn("[GL HUB] Notifications non marquées comme lues :", reponse.error.message);
        } catch (erreur) {
            console.warn("[GL HUB] Notifications non marquées comme lues :", erreur);
        }
    }

    // Efface des notifications.
    //   effacer(null)       : toutes les notifications LUES (jamais une non lue par accident)
    //   effacer([id, ...])  : celles indiquées, lues ou non (la croix de chaque ligne)
    async function effacer(ids) {
        const avant = etat.notifs.slice();
        const position = ids ? etat.notifs.findIndex(function (n) { return n.id === ids[0]; }) : -1;

        // L'écran réagit tout de suite ; si le serveur refuse, on remet les notifications
        etat.notifs = etat.notifs.filter(function (n) {
            return ids ? ids.indexOf(n.id) === -1 : !n.lu_le;
        });
        rendre();

        // Le focus clavier ne doit pas se perdre avec la ligne disparue
        if (ids) {
            const restantes = el.liste.querySelectorAll(".cloche-item");
            const suivante = restantes[Math.min(Math.max(position, 0), restantes.length - 1)];
            (suivante || el.bouton).focus();
        } else if (el.effacerLues.hidden) {
            el.bouton.focus();
        }

        try {
            const reponse = await supabaseClient.rpc("effacer_notifications_l2", {
                p_ids: ids,
                p_seulement_lues: !ids
            });
            if (reponse.error) throw reponse.error;
        } catch (erreur) {
            console.warn("[GL HUB] Notifications non effacées :", erreur);
            etat.notifs = avant;
            rendre();
        }
    }

    // Les notifications d'une page déjà ouverte (discussion, emploi du temps) sont lues d'office
    function autoLireSurPageCourante() {
        const ids = etat.notifs
            .filter(function (n) {
                return !n.lu_le && AUTO_LUES.indexOf(n.type) !== -1 && nomDePage(n.url) === pageCourante();
            })
            .map(function (n) { return n.id; });
        if (ids.length > 0) marquerLues(ids);
    }

    async function ouvrirNotification(n) {
        let cible;
        try {
            cible = new URL(n.url || "index.html", location.href);
        } catch (erreur) {
            return;
        }
        if (cible.origin !== location.origin) return;   // on ne quitte jamais GL HUB

        if (!n.lu_le) {
            await Promise.race([
                marquerLues([n.id]),
                new Promise(function (resolu) { setTimeout(resolu, 600); })
            ]);
        }
        window.location.assign(cible.href);
    }

    // ---------- Données ----------
    async function chargerNotifications() {
        const depuis = new Date(Date.now() - JOURS_CONSERVES * 86400000).toISOString();
        const reponse = await supabaseClient
            .from("notifications_l2")
            .select("id, type, titre, corps, url, cle, nombre, cree_le, lu_le")
            .gte("cree_le", depuis)
            .order("cree_le", { ascending: false })
            .limit(MAX_NOTIFICATIONS);

        if (reponse.error) {
            console.warn("[GL HUB] Notifications illisibles :", reponse.error.message);
            return;
        }
        etat.notifs = reponse.data || [];
        etat.derniereCharge = Date.now();
        rendre();
    }

    function integrer(ligne) {
        const position = etat.notifs.findIndex(function (n) { return n.id === ligne.id; });
        if (position === -1) {
            etat.notifs.push(ligne);
        } else {
            etat.notifs[position] = Object.assign({}, etat.notifs[position], ligne);
        }
        etat.notifs.sort(function (a, b) { return new Date(b.cree_le) - new Date(a.cree_le); });
        etat.notifs = etat.notifs.slice(0, MAX_NOTIFICATIONS);
    }

    function annoncer(ligne) {
        const surLaPage = nomDePage(ligne.url) === pageCourante();
        if (AUTO_LUES.indexOf(ligne.type) !== -1 && surLaPage && document.visibilityState === "visible") {
            marquerLues([ligne.id]);
            return;
        }
        secouer();
        montrerBandeau(ligne);
    }

    function traiterChangement(charge) {
        const ligne = charge && charge.new;
        if (!ligne || !ligne.id) return;
        integrer(ligne);
        rendre();
        if (!ligne.lu_le) annoncer(ligne);
    }

    function ouvrirTempsReel(userId) {
        etat.canal = supabaseClient
            .channel("notifications-l2-" + userId)
            .on("postgres_changes",
                { event: "INSERT", schema: "public", table: "notifications_l2", filter: "user_id=eq." + userId },
                traiterChangement)
            .on("postgres_changes",
                { event: "UPDATE", schema: "public", table: "notifications_l2", filter: "user_id=eq." + userId },
                traiterChangement)
            .subscribe();
    }

    // ---------- Notifications sur l'appareil (push) ----------
    function initialiserPush() {
        if (!window.GLHubPush || /^COLLE_ICI/.test(CLE_VAPID_PUBLIQUE)) return;
        el.pied.hidden = false;
        window.GLHubPush.init({ supabase: supabaseClient, clePublique: CLE_VAPID_PUBLIQUE, espace: "l2" });
        window.GLHubPush.lierBouton(el.boutonPush);
        etat.pushPret = true;
    }

    // À la déconnexion, on retire l'abonnement push de cet appareil AVANT de fermer la session
    // (sinon la personne suivante sur le même appareil recevrait les notifications de la précédente).
    // Le clic sur "Se déconnecter" est suspendu le temps du nettoyage, puis relancé.
    function installerSortie() {
        document.addEventListener("click", function (evenement) {
            const cible = evenement.target;
            const bouton = cible && cible.closest ? cible.closest("#boutonDeconnexion, #boutonDeconnexionAdmin") : null;
            if (!bouton || bouton.dataset.pushNettoye === "1" || !etat.pushPret || !window.GLHubPush) return;

            evenement.preventDefault();
            evenement.stopImmediatePropagation();

            Promise.race([
                window.GLHubPush.desactiver({ definitif: false }),
                new Promise(function (resolu) { setTimeout(resolu, 2500); })
            ])
                .catch(function () { /* on se déconnecte quand même */ })
                .then(function () {
                    bouton.dataset.pushNettoye = "1";
                    bouton.click();
                });
        }, true);
    }

    // ---------- Montage / démontage selon la connexion ----------
    async function monter(utilisateur) {
        if (etat.userId === utilisateur.id) return;
        etat.userId = utilisateur.id;

        let accessible = false;
        try {
            const reponse = await supabaseClient.rpc("notifications_l2_accessibles");
            if (reponse.error) {
                console.warn("[GL HUB] Cloche indisponible :", reponse.error.message);
                return;
            }
            accessible = reponse.data === true;
        } catch (erreur) {
            return;
        }
        if (etat.userId !== utilisateur.id || !accessible) return;   // pas concerné : rien à afficher

        await chargerStyles();
        if (etat.userId !== utilisateur.id) return;
        if (!construireInterface()) return;

        etat.monte = true;
        await chargerNotifications();
        autoLireSurPageCourante();
        ouvrirTempsReel(utilisateur.id);
        initialiserPush();
    }

    function demonter() {
        if (etat.canal) {
            supabaseClient.removeChannel(etat.canal);
            etat.canal = null;
        }
        retirerBandeau();
        document.removeEventListener("click", clicExterieur);
        document.removeEventListener("keydown", toucheClavier);
        if (el.bouton) el.bouton.remove();
        if (el.panneau) el.panneau.remove();
        Object.keys(el).forEach(function (cle) { delete el[cle]; });

        etat.userId = null;
        etat.monte = false;
        etat.ouvert = false;
        etat.notifs = [];
        etat.pushPret = false;
    }

    function demarrer() {
        if (typeof supabaseClient === "undefined" || !supabaseClient || !supabaseClient.auth) return;

        installerSortie();

        document.addEventListener("visibilitychange", function () {
            if (document.visibilityState !== "visible" || !etat.monte) return;
            if (Date.now() - etat.derniereCharge > RECHARGE_APRES_MS) {
                chargerNotifications().then(autoLireSurPageCourante);
            } else {
                autoLireSurPageCourante();
            }
        });

        supabaseClient.auth.getSession().then(function (reponse) {
            const session = reponse && reponse.data && reponse.data.session;
            if (session && session.user) monter(session.user);
        });

        // setTimeout : on ne rappelle pas Supabase directement dans ce rappel (risque de blocage)
        supabaseClient.auth.onAuthStateChange(function (_evenement, session) {
            setTimeout(function () {
                const id = session && session.user ? session.user.id : null;
                if (id === etat.userId) return;   // simple renouvellement du jeton
                if (etat.userId) demonter();
                if (id) monter(session.user);
            }, 0);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", demarrer);
    } else {
        demarrer();
    }
})();