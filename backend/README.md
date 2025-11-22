# Backend optionnel (PHP + SQLite)

Si tu poses ce dossier sur ton serveur PHP, tu peux activer des compteurs réels.

## Endpoints
- `POST /backend/track.php`  body JSON:
  - `{ "type": "visit" | "tree" | "sponsor", "id": "finom|paypal|lydia" }`
- `GET /backend/stats.php`  -> JSON global

## Installation
1. Copie le dossier `backend/` sur ton site.
2. Assure-toi que PHP peut écrire dans `backend/data.sqlite`.
3. Dans `app.js`, mets `const BACKEND_ENABLED = true;`

Simple, sans dépendance.
