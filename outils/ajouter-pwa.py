#!/usr/bin/env python3
# ==========================================================================
# Ajoute les balises PWA (manifeste, couleur, icônes, pwa.js) dans le <head>
# de chaque page HTML de GL HUB.
#
# Depuis la racine du dépôt :
#     python3 outils/ajouter-pwa.py             # ajoute ce qui manque
#     python3 outils/ajouter-pwa.py --verifier  # vérifie seulement (code 1 s'il manque quelque chose)
#
# Relançable sans risque : une page déjà équipée n'est pas modifiée.
# Pense à le relancer quand tu crées une nouvelle page.
# ==========================================================================
import glob
import os
import sys

BLOC = """    <!-- PWA : application installable (manifeste, couleur, icônes, service worker) -->
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#0B204C">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="GL HUB">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <link rel="apple-touch-icon" href="MEDIAS/icons/apple-touch-icon.png">
    <script src="pwa.js" defer></script>
"""

verifier_seulement = "--verifier" in sys.argv
dossier = os.getcwd()
if not os.path.exists(os.path.join(dossier, "index.html")):
    print("Lance ce script depuis la racine du dépôt (le dossier qui contient index.html).")
    sys.exit(2)

a_corriger = 0
for chemin in sorted(glob.glob(os.path.join(dossier, "*.html"))):
    nom = os.path.basename(chemin)
    if nom == "offline.html":
        continue   # page autonome : elle ne charge rien d'externe
    with open(chemin, encoding="utf-8") as fichier:
        html = fichier.read()

    if 'rel="manifest"' in html and "pwa.js" in html:
        print(f"  [ok]      {nom}")
        continue
    if "</head>" not in html:
        print(f"  [IGNORÉ]  {nom} : pas de </head>")
        continue

    a_corriger += 1
    if verifier_seulement:
        print(f"  [MANQUE]  {nom}")
        continue
    with open(chemin, "w", encoding="utf-8") as fichier:
        fichier.write(html.replace("</head>", BLOC + "</head>", 1))
    print(f"  [AJOUTÉ]  {nom}")

print()
if verifier_seulement:
    print("Tout est en place." if not a_corriger else f"{a_corriger} page(s) sans les balises PWA.")
    sys.exit(1 if a_corriger else 0)
print(f"{a_corriger} page(s) modifiée(s).")
