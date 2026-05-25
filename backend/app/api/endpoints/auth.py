from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.models import User
from app.schemas.schemas import UserOut
from app.services.auth import (
    create_app_token,
    exchange_code_for_tokens,
    get_google_auth_url,
    get_google_user_info,
)
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/login")
def login():
    """Redirige vers Google OAuth."""
    return {"auth_url": get_google_auth_url()}


@router.get("/callback")
async def oauth_callback(
    code: str = Query(...),
    db: Session = Depends(get_db),
):
    """Callback OAuth Google — échange le code contre des tokens."""
    try:
        token_data = await exchange_code_for_tokens(code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur échange OAuth : {e}")

    access_token = token_data["access_token"]
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in", 3600)
    token_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    try:
        user_info = await get_google_user_info(access_token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur récupération profil : {e}")

    google_id = user_info["id"]
    user = db.query(User).filter(User.google_id == google_id).first()

    if user:
        user.access_token = access_token
        if refresh_token:
            user.refresh_token = refresh_token
        user.token_expiry = token_expiry
        user.name = user_info.get("name")
        user.picture = user_info.get("picture")
    else:
        user = User(
            google_id=google_id,
            email=user_info["email"],
            name=user_info.get("name"),
            picture=user_info.get("picture"),
            access_token=access_token,
            refresh_token=refresh_token,
            token_expiry=token_expiry,
        )
        db.add(user)

    db.commit()
    db.refresh(user)

    app_token = create_app_token(user.id)
    # Redirige vers le frontend avec le token JWT
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/auth/callback?token={app_token}",
        status_code=302,
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
