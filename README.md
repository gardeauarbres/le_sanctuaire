# Gard Eau Arbres — Sanctuaire Vivant (starter)

Ce dossier est une base **prête à améliorer dans Cursor**.

## ✅ Lancer en local
Le plus simple :
1. Ouvre le dossier dans Cursor / VS Code.
2. Installe une extension de serveur local (Live Server) ou lance :
   - Python : `python -m http.server 5500`
3. Va sur `http://localhost:5500`

> Les fichiers JSON ne se chargent pas correctement via `file://` sans serveur.

## 🗂️ Structure
- `index.html` : app mono‑page (7 étapes)
- `styles.css` : design + responsive
- `app.js` : logique, carte, quêtes, fiches, etc.
- `data/plants.json` : **tes plantes, positions, textes, tags, totems**
- `assets/img/` : mets tes photos (même noms que dans plants.json)
- `assets/audio/` : ambiance + guides vocaux

## ✍️ Ajouter une plante
Dans `data/plants.json`, ajoute un objet :

```json
{
  "id": "unique",
  "name": "Nom commun",
  "latin": "Nom latin",
  "layer": "canopy|subcanopy|shrub|herb|groundcover|rhizosphere|climber",
  "zone": "Prairie / Lande ...",
  "category": "rare|nitro|standard",
  "totem": false,
  "tags": ["mot-clé1","mot-clé2"],
  "intro": "Une phrase punchy.",
  "story": "Petite histoire et usages.",
  "secret": "Indice totem si totem=true",
  "origin": "Origine",
  "hardiness": "-20°C",
  "soil": "Type de sol",
  "water": "Besoin en eau",
  "yield": "Rendement",
  "eco": ["accueil biodiversité","fixation azote", "..."],
  "nursery": "Texte pépinière",
  "image": "assets/img/tonimage.jpg",
  "audio": "assets/audio/tonaudio.mp3",
  "pos": {"x": 800, "y": 400}
}
```

Positions `pos` = coordonnées en pixels dans le SVG (1600×900).

## 🔌 Connexions futures
- **Boutique / inventaire** : relier le bouton "Voir disponibilité"
- **Compteurs réels** : remplacer localStorage par backend (PHP / Supabase / Firebase…)
- **AR** : intégrer un viewer WebXR/8thWall
- **Carte 3D** : remplacer le SVG par Three.js / isometric tiles

## Licence
Libre pour Gard Eau Arbres. 🌿


## 🛠️ Backend optionnel (compteurs réels)
Un dossier `backend/` est inclus (PHP + SQLite).  
Lis `backend/README.md`.  
Dans `app.js`, active :

```js
const BACKEND_ENABLED = true;
```

Puis les clics/visites seront comptés côté serveur.


## 🗺️ Carte pro Thémines
La carte SVG correspond maintenant à ton terrain (lande en pente, zone logistique, prairie en cuvette, potager). Tu peux éditer `mapTemplate()` dans `app.js` pour la raffiner ou la remplacer par Three.js.


## 🚶 Visite guidée + sentiers
- Les sentiers sont dessinés dans le SVG (`mapTemplate()`), avec attributs `data-title` et `data-desc` cliquables.
- L’ordre de visite est dans `data/tour.json` (`order` = liste d'ids de plantes).
- Écran "Visite" accessible via la barre du bas.

## 🧊 Carte isométrique (beta)
- Écran "3D" basé sur un rendu canvas isométrique simple (`iso3d.js`).
- Les points viennent automatiquement de `plants.json`.
- Clique un marqueur pour sélectionner une plante puis "Ouvrir la plante".
- Tu peux remplacer `iso3d.js` par une scène Three.js quand tu veux.


## 🖨️ Plan imprimable A4 (PDF)
- Bouton imprimante dans la carte → ouvre `print.html`.
- Tu peux **Imprimer → Enregistrer en PDF**.
- Styles print dans `print.css`.

## 🔊 Visite audio automatique
- Écran "Visite" → bloc "Visite audio auto".
- Lit les MP3 référencés dans `plants.json` (`audio`).
- Auto‑suivant optionnel.

## 🧠 Three.js full (online)
- Écran 3D → bouton "Passer en Three.js".
- Charge Three.js via CDN (internet requis).
- Remplace `three3d.js` par ta version locale si besoin.
