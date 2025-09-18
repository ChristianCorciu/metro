
# 03 — Compose + Swagger UI

Objectif: Ajouter Swagger UI comme sidecar pour documenter l'API.

Points clés:
- Le fichier OpenAPI est monté dans le conteneur Swagger et servi à `/openapi/openapi.yaml`.
- Swagger UI est accessible sur http://localhost:8080
- Le bouton “Try it out” peut être bloqué par CORS (on règle cela à l'étape 04).

Commandes:
- `docker compose up -d`
- Ouvrir http://localhost:8080
- API: `curl http://localhost:5000/health`
