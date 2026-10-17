#!/usr/bin/env python3
# ==========================================================================
# Verifie que la barre de navigation est la meme sur toutes les pages de GL HUB.
#
# Utilisation, depuis la racine du depot :
#     python3 outils/verifier-nav.py
#
# Regles :
#  - pages publiques : la <nav> doit etre identique a celle de acces-l2.html
#    (seule difference admise : la page Contact marque son propre lien "active") ;
#  - pages d'administration (admin*.html) : memes liens, dans le meme ordre.
#
# Code de sortie : 0 si tout est identique, 1 sinon (pratique avant un commit).
# Aucune modification n'est faite : le script ne fait que lire les fichiers.
# ==========================================================================
import difflib
import glob
import os
import re
import sys

DOSSIER = sys.argv[1] if len(sys.argv) > 1 else "."
REFERENCE = "acces-l2.html"


def lire(chemin):
    with open(chemin, encoding="utf-8") as fichier:
        return fichier.read()


def bloc_nav(html):
    m = re.search(r"<nav\b.*?</nav>", html, re.S)
    return m.group(0) if m else ""


def normaliser(texte):
    texte = re.sub(r"<!--.*?-->", "", texte, flags=re.S)       # les commentaires ne comptent pas
    return [re.sub(r"\s+", " ", ligne).strip() for ligne in texte.split("\n") if ligne.strip()]


def liens_menu(html):
    menu = re.search(r'<ul class="menu">(.*?)(?=<li class="item-recherche">|</ul>)', bloc_nav(html), re.S)
    if not menu:
        return []
    return re.findall(r'<(?:a|button)\b[^>]*?(?:href="([^"]+)"|id="([^"]+)")', menu.group(1))


chemin_reference = os.path.join(DOSSIER, REFERENCE)
if not os.path.exists(chemin_reference):
    print(f"Fichier de reference introuvable : {chemin_reference}")
    print("Lance ce script depuis la racine du depot, ou donne le dossier en argument.")
    sys.exit(2)

reference = normaliser(bloc_nav(lire(chemin_reference)))
erreurs = 0

print(f"Reference : {REFERENCE}\n")
print("Pages publiques")
for chemin in sorted(glob.glob(os.path.join(DOSSIER, "*.html"))):
    nom = os.path.basename(chemin)
    if nom.startswith("admin") or nom == REFERENCE:
        continue
    nav = normaliser(bloc_nav(lire(chemin)))
    if nom == "contact.html":
        nav = [ligne.replace(' class="active"', "") for ligne in nav]
    differences = [l for l in difflib.unified_diff(reference, nav, REFERENCE, nom, lineterm="", n=0)
                   if not l.startswith(("---", "+++", "@@"))]
    if differences:
        erreurs += 1
        print(f"  [DIFFERENTE] {nom} : {len(differences)} ligne(s) de nav differente(s)")
        for ligne in differences[:4]:
            print("       ", ligne[:150])
    else:
        print(f"  [ok]         {nom}")

print("\nPages d'administration")
modele = None
for chemin in sorted(glob.glob(os.path.join(DOSSIER, "admin*.html"))):
    nom = os.path.basename(chemin)
    liens = liens_menu(lire(chemin))
    if modele is None:
        modele = (nom, liens)
    if liens != modele[1]:
        erreurs += 1
        print(f"  [DIFFERENTE] {nom} : liens {[l[0] or l[1] for l in liens]} au lieu de {[l[0] or l[1] for l in modele[1]]}")
    else:
        print(f"  [ok]         {nom}")

print()
if erreurs:
    print(f"{erreurs} page(s) a corriger.")
    sys.exit(1)
print("Toutes les barres de navigation sont identiques.")
