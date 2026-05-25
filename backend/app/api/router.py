from fastapi import APIRouter

from app.api.endpoints import auth, locations, reviews

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(locations.router)
api_router.include_router(reviews.router)
