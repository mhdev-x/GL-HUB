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
    let statDepotsL2 = document.querySelector("#statDepotsL2");
    let listeDepots = document.querySelector("#listeDepots");
    let listePublieesL2 = document.querySelector("#listePublieesL2");
    let listeMatieresL2 = document.querySelector("#listeMatieresL2");
    let formMatiere = document.querySelector("#formMatiere");
    let champNomMatiere = document.querySelector("#nomMatiere");
    let boutonAjouterMatiere = document.querySelector("#boutonAjouterMatiere");

    let BUCKET_L2 = "ressources-l2";
    let LIBELLES_CATEGORIE = { cours: "Cours", td: "TD", examen: "Examen", lien: "Lien", autre: "Autre" };

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

    // ---------- Dépôts : publier, refuser, supprimer ----------
    let publierDepot = (depot, boutons) => {
        executerAction(
            boutons,
            () => supabaseClient.from("depots").update({ statut: "publie" }).eq("id", depot.id),
            `« ${depot.titre} » est publié pour toute la classe.`
        );
    };

    let refuserDepot = (depot, motif, boutons) => {
        executerAction(
            boutons,
            () => supabaseClient.from("depots")
                .update({ statut: "refuse", motif_refus: motif.trim() || null })
                .eq("id", depot.id),
            `« ${depot.titre} » a été refusé.`
        );
    };

    let supprimerRessource = (depot, boutons) => {
        if (!confirm(`Supprimer « ${depot.titre} » ?\nLa ressource disparaît pour toute la classe.`)) return;
        executerAction(
            boutons,
            async () => {
                if (depot.chemin_fichier) {
                    let { error: erreurFichier } = await supabaseClient.storage.from(BUCKET_L2).remove([depot.chemin_fichier]);
                    if (erreurFichier) console.error("Suppression du fichier :", erreurFichier);
                }
                return await supabaseClient.from("depots").delete().eq("id", depot.id);
            },
            `« ${depot.titre} » a été supprimé.`
        );
    };

    // ---------- Matières : créer, supprimer ----------
    let fabriquerSlug = (nom) => {
        return nom
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 60);
    };

    formMatiere.addEventListener("submit", async (e) => {
        e.preventDefault();
        let nom = champNomMatiere.value.trim();
        let slug = fabriquerSlug(nom);
        if (!nom || !slug) {
            afficherMessage("Donne un nom à la matière.", "erreur");
            return;
        }

        boutonAjouterMatiere.disabled = true;
        try {
            let { data: dernieres, error: erreurOrdre } = await supabaseClient
                .from("matieres_classe")
                .select("ordre")
                .eq("classe_id", classeL2.id)
                .order("ordre", { ascending: false })
                .limit(1);
            if (erreurOrdre) throw erreurOrdre;
            let ordre = dernieres && dernieres.length > 0 ? dernieres[0].ordre + 1 : 1;

            let { error } = await supabaseClient
                .from("matieres_classe")
                .insert({ classe_id: classeL2.id, nom: nom, slug: slug, ordre: ordre });

            if (error) {
                console.error("Erreur Supabase (matière) :", error);
                afficherMessage(error.code === "23505" ? "Cette matière existe déjà." : `Ajout impossible : ${error.message}`, "erreur");
                return;
            }
            champNomMatiere.value = "";
            afficherMessage(`La matière « ${nom} » a été ajoutée.`, "succes");
            await chargerTout();
        } catch (erreur) {
            console.error(erreur);
            afficherMessage("Erreur réseau. Réessaie dans un instant.", "erreur");
        } finally {
            boutonAjouterMatiere.disabled = false;
        }
    });

    let supprimerMatiere = (matiere, boutons) => {
        if (!confirm(`Supprimer la matière « ${matiere.nom} » ?`)) return;
        executerAction(
            boutons,
            async () => {
                let resultat = await supabaseClient.from("matieres_classe").delete().eq("id", matiere.id);
                if (resultat.error && resultat.error.code === "23503") {
                    return { error: { message: "des ressources utilisent encore cette matière. Supprime-les d'abord." } };
                }
                return resultat;
            },
            `La matière « ${matiere.nom} » a été supprimée.`
        );
    };

    let creerCarteMatiere = (matiere) => {
        let carte = document.createElement("div");
        carte.className = "carte-paiement";

        let blocInfos = document.createElement("div");
        blocInfos.className = "infos-paiement";
        let titre = document.createElement("h4");
        titre.textContent = matiere.nom;
        blocInfos.appendChild(titre);

        let boutonSupprimer = creerBouton("bouton-mini bouton-mini-danger", "fa-solid fa-trash", "Supprimer", () => {
            supprimerMatiere(matiere, [boutonSupprimer]);
        });

        carte.append(blocInfos, boutonSupprimer);
        return carte;
    };

    // ---------- Aperçu d'une ressource (fichier ou lien) ----------
    let creerApercuRessource = (depot) => {
        let bloc = document.createElement("div");
        bloc.className = "apercu-depot";

        if (depot.categorie === "lien") {
            let idVideo = depot.youtube_id || window.L2Outils.extraireIdYoutube(depot.url);
            if (idVideo) {
                let miniature = document.createElement("img");
                miniature.className = "miniature-depot";
                miniature.src = window.L2Outils.urlMiniatureYoutube(idVideo);
                miniature.alt = "Miniature de la vidéo YouTube";
                miniature.width = 120;
                miniature.height = 68;
                bloc.appendChild(miniature);
            }
            // L'adresse est affichée en texte ; le lien n'est créé que pour http(s)
            if (window.L2Outils.urlValide(depot.url)) {
                let lien = document.createElement("a");
                lien.href = depot.url;
                lien.target = "_blank";
                lien.rel = "noopener noreferrer";
                lien.className = "bouton-mini";
                let icone = document.createElement("i");
                icone.className = "fa-solid fa-arrow-up-right-from-square";
                lien.append(icone, "Ouvrir le lien");
                bloc.appendChild(lien);
            }
        } else {
            let boutonVoir = creerBouton("bouton-mini", "fa-solid fa-eye", "Voir le fichier", async () => {
                boutonVoir.disabled = true;
                await window.L2Outils.ouvrirFichier(depot, "lecture", (texte) => afficherMessage(texte, "erreur"));
                boutonVoir.disabled = false;
            });
            bloc.appendChild(boutonVoir);
        }
        return bloc;
    };

    let creerEtiquetteCategorie = (categorie) => {
        let badge = document.createElement("span");
        badge.className = "badge-statut badge-role-etudiant";
        badge.textContent = LIBELLES_CATEGORIE[categorie] || categorie;
        return badge;
    };

    let nomMatiereDe = (depot) => (depot.matieres_classe && depot.matieres_classe.nom) || "Matière supprimée";

    // ---------- Carte d'un dépôt à valider ----------
    let creerCarteDepotAValider = (depot, nomDepose) => {
        let carte = document.createElement("div");
        carte.className = "carte-paiement carte-demande-l2";

        let blocInfos = document.createElement("div");
        blocInfos.className = "infos-paiement";

        let titre = document.createElement("h4");
        titre.textContent = depot.titre;

        let ligneMeta = document.createElement("p");
        ligneMeta.append(creerEtiquetteCategorie(depot.categorie), ` ${nomMatiereDe(depot)} | déposé par ${nomDepose} le ${formaterDate(depot.cree_le)}`);

        blocInfos.append(titre, ligneMeta);

        if (depot.description) {
            let ligneDescription = document.createElement("p");
            ligneDescription.textContent = depot.description;
            blocInfos.appendChild(ligneDescription);
        }
        blocInfos.appendChild(creerApercuRessource(depot));

        let actions = document.createElement("div");
        actions.className = "actions-paiement";
        let boutonPublier, boutonRefuser;

        let zoneRefus = document.createElement("div");
        zoneRefus.className = "zone-refus";
        zoneRefus.hidden = true;

        let champMotif = document.createElement("input");
        champMotif.type = "text";
        champMotif.maxLength = 200;
        champMotif.placeholder = "Motif du refus (facultatif, visible par le responsable)";
        champMotif.setAttribute("aria-label", "Motif du refus");

        let boutonConfirmerRefus = creerBouton("bouton-refuser", "fa-solid fa-xmark", "Confirmer le refus", () => {
            refuserDepot(depot, champMotif.value, [boutonPublier, boutonRefuser, boutonConfirmerRefus, boutonAnnuler]);
        });
        let boutonAnnuler = creerBouton("bouton-mini", "fa-solid fa-rotate-left", "Annuler", () => {
            zoneRefus.hidden = true;
            champMotif.value = "";
        });
        zoneRefus.append(champMotif, boutonConfirmerRefus, boutonAnnuler);

        boutonPublier = creerBouton("bouton-valider", "fa-solid fa-check", "Publier", () => {
            publierDepot(depot, [boutonPublier, boutonRefuser, boutonConfirmerRefus, boutonAnnuler]);
        });
        boutonRefuser = creerBouton("bouton-refuser", "fa-solid fa-xmark", "Refuser", () => {
            zoneRefus.hidden = false;
            champMotif.focus();
        });

        actions.append(boutonPublier, boutonRefuser);
        carte.append(blocInfos, actions, zoneRefus);
        return carte;
    };

    // ---------- Carte d'une ressource publiée ----------
    let creerCarteRessourcePubliee = (depot, nomDepose) => {
        let carte = document.createElement("div");
        carte.className = "carte-paiement";

        let blocInfos = document.createElement("div");
        blocInfos.className = "infos-paiement";

        let titre = document.createElement("h4");
        titre.textContent = depot.titre;

        let ligneMeta = document.createElement("p");
        ligneMeta.append(creerEtiquetteCategorie(depot.categorie), ` ${nomMatiereDe(depot)} | par ${nomDepose}`);

        blocInfos.append(titre, ligneMeta, creerApercuRessource(depot));

        let boutonSupprimer = creerBouton("bouton-mini bouton-mini-danger", "fa-solid fa-trash", "Supprimer", () => {
            supprimerRessource(depot, [boutonSupprimer]);
        });

        carte.append(blocInfos, boutonSupprimer);
        return carte;
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
                    [listeDepots, listeMatieresL2, listeMembres, listePublieesL2, listeHistoriqueL2]
                        .forEach(zone => zone.replaceChildren(messageVide("—")));
                    return;
                }
                classeL2 = classe;
            }

            let [reponseDemandes, reponseMembres, reponseDepots, reponseMatieres] = await Promise.all([
                supabaseClient
                    .from("demandes_acces")
                    .select("id, user_id, nom_affiche, email, telephone_whatsapp, statut, motif_refus, cree_le, traite_le")
                    .eq("classe_id", classeL2.id)
                    .order("cree_le", { ascending: false }),
                supabaseClient
                    .from("membres_classe")
                    .select("id, user_id, role, ajoute_le")
                    .eq("classe_id", classeL2.id)
                    .order("ajoute_le", { ascending: true }),
                supabaseClient
                    .from("depots")
                    .select("id, depose_par, titre, description, categorie, type_fichier, chemin_fichier, url, youtube_id, statut, cree_le, matieres_classe ( nom )")
                    .eq("classe_id", classeL2.id)
                    .in("statut", ["en_attente", "publie"])
                    .order("cree_le", { ascending: false }),
                supabaseClient
                    .from("matieres_classe")
                    .select("id, nom, ordre")
                    .eq("classe_id", classeL2.id)
                    .order("ordre", { ascending: true })
                    .order("nom", { ascending: true })
            ]);
            if (reponseDemandes.error) throw reponseDemandes.error;
            if (reponseMembres.error) throw reponseMembres.error;
            if (reponseDepots.error) throw reponseDepots.error;
            if (reponseMatieres.error) throw reponseMatieres.error;

            let demandes = reponseDemandes.data;
            let membres = reponseMembres.data;
            let depots = reponseDepots.data;
            let matieres = reponseMatieres.data;

            // Noms : lus dans "profils" (membres et auteurs de dépôts)
            let profilsParId = {};
            let idsProfils = [...new Set([...membres.map(m => m.user_id), ...depots.map(d => d.depose_par)])];
            if (idsProfils.length > 0) {
                let { data: profils, error: erreurProfils } = await supabaseClient
                    .from("profils")
                    .select("user_id, nom, email")
                    .in("user_id", idsProfils);
                if (erreurProfils) throw erreurProfils;
                (profils || []).forEach(p => { profilsParId[p.user_id] = p; });
            }
            let nomDe = (idUtilisateur) => {
                let profil = profilsParId[idUtilisateur];
                return (profil && (profil.nom || profil.email)) || "un compte inconnu";
            };

            let enAttente = demandes.filter(d => d.statut === "en_attente");
            let traitees = demandes.filter(d => d.statut !== "en_attente").slice(0, 30);
            let depotsAValider = depots.filter(d => d.statut === "en_attente");
            let ressourcesPubliees = depots.filter(d => d.statut === "publie").slice(0, 50);

            statEnAttenteL2.textContent = enAttente.length;
            statDepotsL2.textContent = depotsAValider.length;
            statMembresL2.textContent = membres.length;
            statResponsablesL2.textContent = membres.filter(m => m.role === "responsable").length;

            // Dépôts à valider (les plus anciens d'abord)
            if (depotsAValider.length === 0) {
                listeDepots.replaceChildren(messageVide("Aucun dépôt à valider pour le moment."));
            } else {
                let plusAnciensDabord = [...depotsAValider].sort((a, b) => new Date(a.cree_le) - new Date(b.cree_le));
                listeDepots.replaceChildren(...plusAnciensDabord.map(d => creerCarteDepotAValider(d, nomDe(d.depose_par))));
            }

            // Demandes d'accès en attente (les plus anciennes d'abord : premier arrivé, premier servi)
            if (enAttente.length === 0) {
                listeDemandes.replaceChildren(messageVide("Aucune demande en attente pour le moment."));
            } else {
                let plusAnciennesDabord = [...enAttente].sort((a, b) => new Date(a.cree_le) - new Date(b.cree_le));
                listeDemandes.replaceChildren(...plusAnciennesDabord.map(creerCarteDemande));
            }

            if (matieres.length === 0) {
                listeMatieresL2.replaceChildren(messageVide("Aucune matière pour le moment : ajoute la première ci-dessus."));
            } else {
                listeMatieresL2.replaceChildren(...matieres.map(creerCarteMatiere));
            }

            if (membres.length === 0) {
                listeMembres.replaceChildren(messageVide("Aucun membre pour le moment."));
            } else {
                listeMembres.replaceChildren(...membres.map(m => creerCarteMembre(m, profilsParId[m.user_id])));
            }

            if (ressourcesPubliees.length === 0) {
                listePublieesL2.replaceChildren(messageVide("Aucune ressource publiée pour le moment."));
            } else {
                listePublieesL2.replaceChildren(...ressourcesPubliees.map(d => creerCarteRessourcePubliee(d, nomDe(d.depose_par))));
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
