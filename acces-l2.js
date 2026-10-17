// ========================================================
// DEMANDE D'ACCÈS À L'ESPACE L2 — GL HUB
//
// Parcours :
//  - pas connecté           -> invitation à se connecter (modale de auth.js)
//  - déjà membre de la L2   -> lien vers l'espace
//  - demande en attente     -> message d'attente
//  - aucune demande / refusée -> formulaire (numéro WhatsApp)
//
// Le nom et l'email ne sont pas redemandés : ils viennent du compte
// et de la table "profils", ajoutés côté serveur par un trigger.
// La vraie protection est en base (RLS + triggers) : ici on ne fait
// qu'afficher l'interface.
// ========================================================
document.addEventListener("DOMContentLoaded", () => {

    let SLUG_CLASSE_L2 = "l2-gl-2026-2027";

    let vues = {
        chargement: document.querySelector("#vueChargement"),
        connexion: document.querySelector("#vueConnexion"),
        membre: document.querySelector("#vueMembre"),
        attente: document.querySelector("#vueAttente"),
        formulaire: document.querySelector("#vueFormulaire"),
        erreur: document.querySelector("#vueErreur")
    };

    let nomDemandeur = document.querySelector("#nomDemandeur");
    let bandeauRefus = document.querySelector("#bandeauRefus");
    let texteRefus = document.querySelector("#texteRefus");
    let formDemandeL2 = document.querySelector("#formDemandeL2");
    let champTelephone = document.querySelector("#telephoneL2");
    let erreurDemandeL2 = document.querySelector("#erreurDemandeL2");
    let boutonEnvoyerDemande = document.querySelector("#boutonEnvoyerDemande");
    let messageErreurL2 = document.querySelector("#messageErreurL2");

    let utilisateurCourant = null;
    let classeL2 = null;

    // ---------- Afficher une seule vue à la fois ----------
    let montrerVue = (nom) => {
        Object.keys(vues).forEach(cle => {
            vues[cle].hidden = cle !== nom;
        });
    };

    let montrerErreur = (message) => {
        messageErreurL2.textContent = message;
        montrerVue("erreur");
    };

    // ---------- Nombre de chiffres d'un numéro ----------
    let compterChiffres = (texte) => texte.replace(/\D/g, "").length;

    // ---------- Traduire une erreur Supabase en message compréhensible ----------
    let traduireErreurDemande = (error) => {
        console.error("Erreur Supabase (demande d'accès L2) :", error);

        let texte = `${error.message || ""} ${error.details || ""}`;

        if (error.code === "23505") {
            if (texte.includes("demandes_telephone_unique")) {
                return "Ce numéro est déjà utilisé pour une autre demande. Si c'est bien le tien, contacte l'administrateur.";
            }
            if (texte.includes("demandes_une_en_attente")) {
                return "Tu as déjà une demande en attente.";
            }
        }
        if (error.code === "42501") {
            return "Tu n'as pas le droit d'envoyer cette demande. Reconnecte-toi, puis réessaie.";
        }
        if (texte.includes("Numero de telephone invalide")) {
            return "Le numéro de téléphone est invalide.";
        }
        return "La demande n'a pas pu être envoyée. Réessaie dans un instant.";
    };

    // ---------- Nom à afficher pour le demandeur (lu dans "profils") ----------
    let recupererNomDemandeur = async (utilisateur) => {
        let { data: profil } = await supabaseClient
            .from("profils")
            .select("nom, prenom, nom_famille")
            .eq("user_id", utilisateur.id)
            .maybeSingle();

        if (profil) {
            let nomComplet = (profil.nom || "").trim()
                || [profil.prenom, profil.nom_famille].filter(Boolean).join(" ").trim();
            if (nomComplet) return nomComplet;
        }
        return utilisateur.email || "ton compte";
    };

    // ---------- Décider quelle vue afficher ----------
    let initialiser = async () => {
        montrerVue("chargement");

        try {
            let { data: sessionData } = await supabaseClient.auth.getSession();
            if (!sessionData.session) {
                utilisateurCourant = null;
                montrerVue("connexion");
                return;
            }
            utilisateurCourant = sessionData.session.user;

            let { data: classe, error: erreurClasse } = await supabaseClient
                .from("classes")
                .select("id, nom")
                .eq("slug", SLUG_CLASSE_L2)
                .maybeSingle();
            if (erreurClasse) throw erreurClasse;
            if (!classe) {
                montrerErreur("L'espace de la classe est introuvable. Contacte l'administrateur.");
                return;
            }
            classeL2 = classe;

            // L'administrateur entre directement : pas de formulaire, pas de numéro de téléphone
            let { data: admin, error: erreurAdmin } = await supabaseClient
                .from("admins")
                .select("user_id")
                .eq("user_id", utilisateurCourant.id)
                .maybeSingle();
            if (erreurAdmin) throw erreurAdmin;
            if (admin) {
                document.querySelector("#titreMembre").textContent = "Accès administrateur";
                document.querySelector("#lienResponsable").hidden = false;
                montrerVue("membre");
                return;
            }

            let { data: membre, error: erreurMembre } = await supabaseClient
                .from("membres_classe")
                .select("role")
                .eq("classe_id", classe.id)
                .eq("user_id", utilisateurCourant.id)
                .maybeSingle();
            if (erreurMembre) throw erreurMembre;
            if (membre) {
                document.querySelector("#titreMembre").textContent = "Tu fais partie de l'espace L2";
                document.querySelector("#lienResponsable").hidden = membre.role !== "responsable";
                montrerVue("membre");
                return;
            }

            let { data: demande, error: erreurDemande } = await supabaseClient
                .from("demandes_acces")
                .select("statut, motif_refus")
                .eq("classe_id", classe.id)
                .eq("user_id", utilisateurCourant.id)
                .order("cree_le", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (erreurDemande) throw erreurDemande;

            if (demande && demande.statut === "en_attente") {
                montrerVue("attente");
                return;
            }
            if (demande && demande.statut === "accepte") {
                montrerErreur("Ta demande a été acceptée, mais ton accès n'est pas encore actif. Contacte l'administrateur.");
                return;
            }

            if (demande && demande.statut === "refuse") {
                texteRefus.textContent = demande.motif_refus
                    ? `Ta dernière demande a été refusée : ${demande.motif_refus}`
                    : "Ta dernière demande a été refusée. Vérifie ton numéro, puis renvoie une demande.";
                bandeauRefus.hidden = false;
            } else {
                bandeauRefus.hidden = true;
            }

            nomDemandeur.textContent = await recupererNomDemandeur(utilisateurCourant);
            montrerVue("formulaire");

        } catch (e) {
            console.error(e);
            montrerErreur("Impossible de charger la page. Vérifie ta connexion, puis réessaie.");
        }
    };

    // ---------- Envoyer la demande ----------
    formDemandeL2.addEventListener("submit", async (e) => {
        e.preventDefault();
        erreurDemandeL2.textContent = "";

        let telephone = champTelephone.value.trim();
        if (!/^[+()\d\s.-]+$/.test(telephone) || compterChiffres(telephone) < 8) {
            erreurDemandeL2.textContent = "Entre un numéro valide, par exemple +221 77 123 45 67.";
            return;
        }

        boutonEnvoyerDemande.disabled = true;
        boutonEnvoyerDemande.textContent = "Envoi en cours...";

        try {
            let { error } = await supabaseClient.from("demandes_acces").insert({
                classe_id: classeL2.id,
                user_id: utilisateurCourant.id,
                telephone_whatsapp: telephone
            });

            if (error) {
                erreurDemandeL2.textContent = traduireErreurDemande(error);
                return;
            }

            formDemandeL2.reset();
            montrerVue("attente");
            if (window.afficherToast) window.afficherToast("Demande envoyée à l'administrateur.");
        } catch (erreurReseau) {
            console.error(erreurReseau);
            erreurDemandeL2.textContent = "La demande n'a pas pu être envoyée. Vérifie ta connexion, puis réessaie.";
        } finally {
            boutonEnvoyerDemande.disabled = false;
            boutonEnvoyerDemande.textContent = "Envoyer ma demande";
        }
    });

    // ---------- Boutons ----------
    document.querySelector("#boutonConnexionL2").addEventListener("click", () => {
        if (window.ouvrirModaleAuth) window.ouvrirModaleAuth();
    });
    document.querySelector("#boutonActualiser").addEventListener("click", initialiser);
    document.querySelector("#boutonReessayer").addEventListener("click", initialiser);

    // ---------- Réagir à la connexion / déconnexion (modale de auth.js, autre onglet...) ----------
    // On ne relance que si l'utilisateur change : les renouvellements de jeton sont ignorés.
    let dernierIdUtilisateur;
    supabaseClient.auth.onAuthStateChange((_evenement, session) => {
        let idActuel = session ? session.user.id : null;
        if (idActuel === dernierIdUtilisateur) return;
        dernierIdUtilisateur = idActuel;
        // setTimeout : évite d'appeler Supabase pendant le callback d'authentification
        setTimeout(initialiser, 0);
    });
});
