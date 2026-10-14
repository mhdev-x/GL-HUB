// ========================================================
// ADMIN — ESPACE L2 : demandes d'accès, membres, historique
//
// - Accepter / refuser passe par les fonctions SQL accepter_demande et
//   refuser_demande (elles vérifient côté serveur que tu es admin).
// - Les noms, emails et numéros sont affichés avec textContent
//   (jamais innerHTML) : aucun contenu saisi par un utilisateur
//   ne peut s'exécuter dans cette page.
// - La garde d'accès admin est dans le <head> de admin-l2.html.
// ========================================================
document.addEventListener("DOMContentLoaded", async () => {

    let SLUG_CLASSE_L2 = "l2-gl-2026-2027";

    let listeDemandes = document.querySelector("#listeDemandes");
    let listeMembres = document.querySelector("#listeMembres");
    let listeHistoriqueL2 = document.querySelector("#listeHistoriqueL2");
    let statEnAttenteL2 = document.querySelector("#statEnAttenteL2");
    let statMembresL2 = document.querySelector("#statMembresL2");
    let statResponsablesL2 = document.querySelector("#statResponsablesL2");
    let messageAdminL2 = document.querySelector("#messageAdminL2");
    let boutonActualiserL2 = document.querySelector("#boutonActualiserL2");
    let boutonDeconnexionAdmin = document.querySelector("#boutonDeconnexionAdmin");

    let classeL2 = null;
    let minuteurMessage = null;

    boutonDeconnexionAdmin.addEventListener("click", async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
    });

    // ---------- Message de retour (succès / erreur) ----------
    let afficherMessage = (texte, type) => {
        messageAdminL2.textContent = texte;
        messageAdminL2.className = `message-admin-l2 ${type}`;
        messageAdminL2.hidden = false;
        clearTimeout(minuteurMessage);
        minuteurMessage = setTimeout(() => { messageAdminL2.hidden = true; }, 6000);
    };

    let formaterDate = (dateIso) => {
        return new Date(dateIso).toLocaleDateString("fr-FR", {
            day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
        });
    };

    let messageVide = (texte) => {
        let p = document.createElement("p");
        p.className = "message-chargement";
        p.textContent = texte;
        return p;
    };

    // ---------- Fabrique de boutons (aucune donnée utilisateur dans le HTML) ----------
    let creerBouton = (classe, icone, texte, auClic) => {
        let bouton = document.createElement("button");
        bouton.type = "button";
        bouton.className = classe;
        let i = document.createElement("i");
        i.className = icone;
        bouton.append(i, texte);
        bouton.addEventListener("click", auClic);
        return bouton;
    };

    // ---------- Lien WhatsApp construit uniquement à partir de chiffres ----------
    let construireLienWhatsApp = (telephone) => {
        let chiffres = telephone.replace(/\D/g, "");
        if (chiffres.startsWith("00")) chiffres = chiffres.slice(2);
        if (chiffres.length === 9) chiffres = "221" + chiffres;
        return chiffres.length >= 8 ? `https://wa.me/${chiffres}` : null;
    };

    // ---------- Actions ----------
    let executerAction = async (boutons, action, messageSucces) => {
        boutons.forEach(b => { b.disabled = true; });
        try {
            let { error } = await action();
            if (error) {
                console.error("Erreur Supabase (admin L2) :", error);
                afficherMessage(`Action impossible : ${error.message}`, "erreur");
                boutons.forEach(b => { b.disabled = false; });
                return;
            }
            afficherMessage(messageSucces, "succes");
            await chargerTout();
        } catch (e) {
            console.error(e);
            afficherMessage("Erreur réseau. Réessaie dans un instant.", "erreur");
            boutons.forEach(b => { b.disabled = false; });
        }
    };

    let accepterDemande = (demande, boutons) => {
        executerAction(
            boutons,
            () => supabaseClient.rpc("accepter_demande", { p_demande: demande.id }),
            `${demande.nom_affiche || "Demande"} a été acceptée.`
        );
    };

    let refuserDemande = (demande, motif, boutons) => {
        executerAction(
            boutons,
            () => supabaseClient.rpc("refuser_demande", {
                p_demande: demande.id,
                p_motif: motif.trim() || null
            }),
            `La demande de ${demande.nom_affiche || "cet utilisateur"} a été refusée.`
        );
    };

    let nommerResponsable = (membre, nomMembre, boutons) => {
        if (!confirm(`Nommer ${nomMembre} responsable de la classe ?\nIl pourra déposer des fichiers (que tu devras publier).`)) return;
        executerAction(
            boutons,
            () => supabaseClient.rpc("nommer_responsable", { p_classe: classeL2.id, p_user: membre.user_id }),
            `${nomMembre} est maintenant responsable.`
        );
    };

    let retirerRoleResponsable = (membre, nomMembre, boutons) => {
        if (!confirm(`Retirer le rôle de responsable à ${nomMembre} ? Il restera membre de la classe.`)) return;
        executerAction(
            boutons,
            () => supabaseClient.from("membres_classe").update({ role: "etudiant" }).eq("id", membre.id),
            `${nomMembre} n'est plus responsable.`
        );
    };

    let retirerMembre = (membre, nomMembre, boutons) => {
        if (!confirm(`Retirer ${nomMembre} de l'espace L2 ?\nIl perdra l'accès et devra refaire une demande.`)) return;
        executerAction(
            boutons,
            async () => {
                let { error } = await supabaseClient.from("membres_classe").delete().eq("id", membre.id);
                if (error) return { error };
                // Libère le numéro : l'ancienne demande acceptée passe en "refusée"
                return await supabaseClient
                    .from("demandes_acces")
                    .update({
                        statut: "refuse",
                        motif_refus: "Accès retiré par l'administrateur",
                        traite_le: new Date().toISOString()
                    })
                    .eq("classe_id", classeL2.id)
                    .eq("user_id", membre.user_id)
                    .eq("statut", "accepte");
            },
            `${nomMembre} a été retiré de l'espace L2.`
        );
    };

    // ---------- Carte d'une demande en attente ----------
    let creerCarteDemande = (demande) => {
        let carte = document.createElement("div");
        carte.className = "carte-paiement carte-demande-l2";

        let blocInfos = document.createElement("div");
        blocInfos.className = "infos-paiement";

        let titre = document.createElement("h4");
        titre.textContent = demande.nom_affiche || "Nom non renseigné";

        let ligneEmail = document.createElement("p");
        ligneEmail.textContent = demande.email || "";

        // Numéro mis en évidence pour la comparaison avec le groupe WhatsApp
        let ligneNumero = document.createElement("div");
        ligneNumero.className = "ligne-numero";

        let numero = document.createElement("span");
        numero.className = "numero-whatsapp";
        numero.textContent = demande.telephone_whatsapp;
        ligneNumero.appendChild(numero);

        let boutonCopier = creerBouton("bouton-mini", "fa-regular fa-copy", "Copier", async () => {
            try {
                await navigator.clipboard.writeText(demande.telephone_whatsapp);
                afficherMessage("Numéro copié.", "succes");
            } catch (_) {
                afficherMessage("Impossible de copier automatiquement le numéro.", "erreur");
            }
        });
        ligneNumero.appendChild(boutonCopier);

        let lienWhatsApp = construireLienWhatsApp(demande.telephone_whatsapp);
        if (lienWhatsApp) {
            let lien = document.createElement("a");
            lien.className = "bouton-mini";
            lien.href = lienWhatsApp;
            lien.target = "_blank";
            lien.rel = "noopener noreferrer";
            let iconeLien = document.createElement("i");
            iconeLien.className = "fa-brands fa-whatsapp";
            lien.append(iconeLien, "Ouvrir dans WhatsApp");
            ligneNumero.appendChild(lien);
        }

        let ligneDate = document.createElement("p");
        ligneDate.textContent = `Demande du ${formaterDate(demande.cree_le)}`;

        blocInfos.append(titre, ligneEmail, ligneNumero, ligneDate);

        // Actions
        let actions = document.createElement("div");
        actions.className = "actions-paiement";

        let boutonAccepter, boutonRefuser;

        // Zone de refus (motif facultatif), affichée au clic sur "Refuser"
        let zoneRefus = document.createElement("div");
        zoneRefus.className = "zone-refus";
        zoneRefus.hidden = true;

        let champMotif = document.createElement("input");
        champMotif.type = "text";
        champMotif.maxLength = 200;
        champMotif.placeholder = "Motif du refus (facultatif, visible par l'étudiant)";
        champMotif.setAttribute("aria-label", "Motif du refus");

        let boutonConfirmerRefus = creerBouton("bouton-refuser", "fa-solid fa-xmark", "Confirmer le refus", () => {
            refuserDemande(demande, champMotif.value, [boutonAccepter, boutonRefuser, boutonConfirmerRefus, boutonAnnuler]);
        });
        let boutonAnnuler = creerBouton("bouton-mini", "fa-solid fa-rotate-left", "Annuler", () => {
            zoneRefus.hidden = true;
            champMotif.value = "";
        });
        zoneRefus.append(champMotif, boutonConfirmerRefus, boutonAnnuler);

        boutonAccepter = creerBouton("bouton-valider", "fa-solid fa-check", "Accepter", () => {
            accepterDemande(demande, [boutonAccepter, boutonRefuser, boutonConfirmerRefus, boutonAnnuler]);
        });
        boutonRefuser = creerBouton("bouton-refuser", "fa-solid fa-xmark", "Refuser", () => {
            zoneRefus.hidden = false;
            champMotif.focus();
        });

        actions.append(boutonAccepter, boutonRefuser);
        carte.append(blocInfos, actions, zoneRefus);
        return carte;
    };

    // ---------- Carte d'un membre ----------
    let creerCarteMembre = (membre, profil) => {
        let nomMembre = (profil && (profil.nom || profil.email)) || "Compte sans profil";

        let carte = document.createElement("div");
        carte.className = "carte-paiement";

        let blocInfos = document.createElement("div");
        blocInfos.className = "infos-paiement";

        let titre = document.createElement("h4");
        titre.textContent = nomMembre;

        let ligneEmail = document.createElement("p");
        ligneEmail.textContent = (profil && profil.email) || "";

        let ligneRole = document.createElement("p");
        let badge = document.createElement("span");
        let estResponsable = membre.role === "responsable";
        badge.className = `badge-statut ${estResponsable ? "badge-role-responsable" : "badge-role-etudiant"}`;
        badge.textContent = estResponsable ? "Responsable" : "Étudiant";
        ligneRole.append(badge, ` Membre depuis le ${formaterDate(membre.ajoute_le)}`);

        blocInfos.append(titre, ligneEmail, ligneRole);

        let actions = document.createElement("div");
        actions.className = "actions-membre";
        let boutonRole, boutonRetirer;

        if (estResponsable) {
            boutonRole = creerBouton("bouton-mini", "fa-solid fa-user-minus", "Retirer le rôle de responsable", () => {
                retirerRoleResponsable(membre, nomMembre, [boutonRole, boutonRetirer]);
            });
        } else {
            boutonRole = creerBouton("bouton-mini", "fa-solid fa-user-tie", "Nommer responsable", () => {
                nommerResponsable(membre, nomMembre, [boutonRole, boutonRetirer]);
            });
        }
        boutonRetirer = creerBouton("bouton-mini bouton-mini-danger", "fa-solid fa-user-xmark", "Retirer de la classe", () => {
            retirerMembre(membre, nomMembre, [boutonRole, boutonRetirer]);
        });

        actions.append(boutonRole, boutonRetirer);
        carte.append(blocInfos, actions);
        return carte;
    };

    // ---------- Ligne d'historique ----------
    let creerCarteHistorique = (demande) => {
        let carte = document.createElement("div");
        carte.className = "carte-paiement";

        let blocInfos = document.createElement("div");
        blocInfos.className = "infos-paiement";

        let titre = document.createElement("h4");
        titre.textContent = demande.nom_affiche || "Nom non renseigné";

        let ligneDetail = document.createElement("p");
        let dateTraitement = demande.traite_le ? formaterDate(demande.traite_le) : formaterDate(demande.cree_le);
        ligneDetail.textContent = `${demande.telephone_whatsapp} | traitée le ${dateTraitement}`;

        blocInfos.append(titre, ligneDetail);

        if (demande.statut === "refuse" && demande.motif_refus) {
            let ligneMotif = document.createElement("p");
            ligneMotif.textContent = `Motif : ${demande.motif_refus}`;
            blocInfos.appendChild(ligneMotif);
        }

        let badge = document.createElement("span");
        let accepte = demande.statut === "accepte";
        badge.className = `badge-statut ${accepte ? "badge-valide" : "badge-echoue"}`;
        badge.textContent = accepte ? "Acceptée" : "Refusée";

        carte.append(blocInfos, badge);
        return carte;
    };

    // ---------- Chargement des données ----------
    let chargerTout = async () => {
        try {
            if (!classeL2) {
                let { data: classe, error: erreurClasse } = await supabaseClient
                    .from("classes")
                    .select("id")
                    .eq("slug", SLUG_CLASSE_L2)
                    .maybeSingle();
                if (erreurClasse) throw erreurClasse;
                if (!classe) {
                    listeDemandes.replaceChildren(messageVide("La classe L2 est introuvable : vérifie que la migration SQL a bien été exécutée."));
                    listeMembres.replaceChildren(messageVide("—"));
                    listeHistoriqueL2.replaceChildren(messageVide("—"));
                    return;
                }
                classeL2 = classe;
            }

            let [reponseDemandes, reponseMembres] = await Promise.all([
                supabaseClient
                    .from("demandes_acces")
                    .select("id, user_id, nom_affiche, email, telephone_whatsapp, statut, motif_refus, cree_le, traite_le")
                    .eq("classe_id", classeL2.id)
                    .order("cree_le", { ascending: false }),
                supabaseClient
                    .from("membres_classe")
                    .select("id, user_id, role, ajoute_le")
                    .eq("classe_id", classeL2.id)
                    .order("ajoute_le", { ascending: true })
            ]);
            if (reponseDemandes.error) throw reponseDemandes.error;
            if (reponseMembres.error) throw reponseMembres.error;

            let demandes = reponseDemandes.data;
            let membres = reponseMembres.data;

            // Noms des membres : lus dans "profils" (pas de lien direct depuis membres_classe)
            let profilsParId = {};
            if (membres.length > 0) {
                let { data: profils, error: erreurProfils } = await supabaseClient
                    .from("profils")
                    .select("user_id, nom, email")
                    .in("user_id", membres.map(m => m.user_id));
                if (erreurProfils) throw erreurProfils;
                (profils || []).forEach(p => { profilsParId[p.user_id] = p; });
            }

            let enAttente = demandes.filter(d => d.statut === "en_attente");
            let traitees = demandes.filter(d => d.statut !== "en_attente").slice(0, 30);

            statEnAttenteL2.textContent = enAttente.length;
            statMembresL2.textContent = membres.length;
            statResponsablesL2.textContent = membres.filter(m => m.role === "responsable").length;

            // Demandes en attente (les plus anciennes d'abord : premier arrivé, premier servi)
            if (enAttente.length === 0) {
                listeDemandes.replaceChildren(messageVide("Aucune demande en attente pour le moment."));
            } else {
                let plusAnciennesDabord = [...enAttente].sort((a, b) => new Date(a.cree_le) - new Date(b.cree_le));
                listeDemandes.replaceChildren(...plusAnciennesDabord.map(creerCarteDemande));
            }

            if (membres.length === 0) {
                listeMembres.replaceChildren(messageVide("Aucun membre pour le moment."));
            } else {
                listeMembres.replaceChildren(...membres.map(m => creerCarteMembre(m, profilsParId[m.user_id])));
            }

            if (traitees.length === 0) {
                listeHistoriqueL2.replaceChildren(messageVide("Aucun historique pour le moment."));
            } else {
                listeHistoriqueL2.replaceChildren(...traitees.map(creerCarteHistorique));
            }

        } catch (e) {
            console.error("Erreur de chargement (admin L2) :", e);
            listeDemandes.replaceChildren(messageVide(`Erreur de chargement : ${e.message || "réessaie dans un instant"}`));
        }
    };

    boutonActualiserL2.addEventListener("click", chargerTout);
    await chargerTout();
});
