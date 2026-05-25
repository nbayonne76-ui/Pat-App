from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.models import Location, User
from app.schemas.schemas import LocationOut
from app.services.google_business import GoogleBusinessClient

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("", response_model=list[LocationOut])
def list_locations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Liste les établissements synchronisés de l'utilisateur."""
    return db.query(Location).filter(Location.user_id == current_user.id).all()


@router.post("/sync", response_model=list[LocationOut])
async def sync_locations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Synchronise les établissements depuis Google Business Profile."""
    gbp = GoogleBusinessClient(current_user.access_token)

    try:
        accounts = await gbp.list_accounts()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur Google API : {e}")

    synced = []
    for account in accounts:
        account_name = account.get("name", "")
        try:
            locations = await gbp.list_locations(account_name)
        except Exception:
            continue

        for loc in locations:
            loc_name = loc.get("name", "")
            address_parts = loc.get("storefrontAddress", {})
            address = ", ".join(
                filter(None, [
                    address_parts.get("addressLines", [""])[0] if address_parts.get("addressLines") else "",
                    address_parts.get("locality", ""),
                    address_parts.get("postalCode", ""),
                ])
            ) or None
            phone_numbers = loc.get("phoneNumbers", {})
            phone = phone_numbers.get("primaryPhone") if phone_numbers else None

            existing = db.query(Location).filter(Location.location_name == loc_name).first()
            if existing:
                existing.business_name = loc.get("title", loc_name)
                existing.address = address
                existing.phone = phone
                existing.website = loc.get("websiteUri")
            else:
                existing = Location(
                    user_id=current_user.id,
                    account_name=account_name,
                    location_name=loc_name,
                    business_name=loc.get("title", loc_name),
                    address=address,
                    phone=phone,
                    website=loc.get("websiteUri"),
                )
                db.add(existing)
            synced.append(existing)

    db.commit()
    for loc in synced:
        db.refresh(loc)

    return synced
