# Happi Google Reviews

Collectez et analysez les avis Google de vos établissements par fourchette de dates.

## Fonctionnalités

- Connexion Google OAuth (Business Profile)
- Multi-établissements
- Filtre par fourchette de dates + presets (7j, 30j, ce mois, 3 mois, 12 mois)
- Filtre par note (1-5 étoiles) et présence de réponse
- Stats agrégées (note moyenne, distribution)
- Cache PostgreSQL + sync depuis Google
- Répondre / modifier / supprimer les réponses aux avis
- Export CSV

## Prérequis

1. Compte [Google Cloud Console](https://console.cloud.google.com)
2. Activer l'API **Business Profile API** et **OAuth 2.0**
3. Créer des identifiants OAuth (type "Application Web")
4. Ajouter `http://localhost:8001/api/auth/callback` dans les URIs de redirection autorisées

## Démarrage rapide

```bash
# 1. Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Remplir GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# 2. Base de données (créée automatiquement au démarrage FastAPI)
# Ou manuellement :
createdb happi_reviews_db

# 3. Frontend
cd ../frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## Stack

- **Backend** : FastAPI + PostgreSQL + SQLAlchemy
- **Frontend** : Next.js 14 + TypeScript + Tailwind CSS
- **Auth** : Google OAuth 2.0 (Business Profile API)
- **API Google** : Business Profile API v4

## Endpoints backend

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/auth/login` | URL de connexion Google |
| GET | `/api/auth/callback` | Callback OAuth |
| GET | `/api/auth/me` | Profil utilisateur |
| GET | `/api/locations` | Liste des établissements |
| POST | `/api/locations/sync` | Sync depuis Google |
| GET | `/api/reviews/{id}` | Avis filtrés (date, note) |
| POST | `/api/reviews/{id}/sync` | Sync avis depuis Google |
| POST | `/api/reviews/{id}/reviews/{rid}/reply` | Poster une réponse |
| DELETE | `/api/reviews/{id}/reviews/{rid}/reply` | Supprimer une réponse |
| GET | `/api/reviews/{id}/export` | Export CSV |
