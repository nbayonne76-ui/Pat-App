from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import User
from app.services.auth import decode_app_token, refresh_access_token

bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_app_token(credentials.credentials)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur introuvable")

    # Renouvelle le token Google si expiré
    if user.token_expiry and user.token_expiry < datetime.now(timezone.utc):
        if user.refresh_token:
            try:
                token_data = await refresh_access_token(user.refresh_token)
                user.access_token = token_data["access_token"]
                expires_in = token_data.get("expires_in", 3600)
                user.token_expiry = datetime.now(timezone.utc).replace(
                    second=datetime.now(timezone.utc).second + expires_in
                )
                db.commit()
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session Google expirée, veuillez vous reconnecter",
                )

    return user
