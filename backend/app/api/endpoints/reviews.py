import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.models import Location, Review, User
from app.schemas.schemas import ReplyRequest, ReviewOut, ReviewStats, ReviewsResponse, SyncResponse
from app.services.google_business import GoogleBusinessClient

router = APIRouter(prefix="/reviews", tags=["reviews"])


def _compute_stats(reviews: list[Review]) -> ReviewStats:
    if not reviews:
        return ReviewStats(total=0, average_rating=0.0, distribution={1: 0, 2: 0, 3: 0, 4: 0, 5: 0})
    dist = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    total_stars = 0
    for r in reviews:
        if r.star_rating:
            dist[r.star_rating] = dist.get(r.star_rating, 0) + 1
            total_stars += r.star_rating
    avg = round(total_stars / len(reviews), 2) if reviews else 0.0
    return ReviewStats(total=len(reviews), average_rating=avg, distribution=dist)


def _get_location_or_404(location_id: int, user_id: int, db: Session) -> Location:
    loc = db.query(Location).filter(
        Location.id == location_id,
        Location.user_id == user_id,
    ).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Établissement introuvable")
    return loc


@router.get("/{location_id}", response_model=ReviewsResponse)
def get_reviews(
    location_id: int,
    start_date: Optional[datetime] = Query(None, description="ISO 8601, ex: 2024-01-01T00:00:00Z"),
    end_date: Optional[datetime] = Query(None, description="ISO 8601, ex: 2024-12-31T23:59:59Z"),
    star: Optional[int] = Query(None, ge=1, le=5),
    has_reply: Optional[bool] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retourne les avis en cache, filtrés par date, note et présence de réponse."""
    loc = _get_location_or_404(location_id, current_user.id, db)

    filters = [Review.location_id == location_id]
    if start_date:
        filters.append(Review.create_time >= start_date)
    if end_date:
        filters.append(Review.create_time <= end_date)
    if star:
        filters.append(Review.star_rating == star)
    if has_reply is True:
        filters.append(Review.reply_text.isnot(None))
    elif has_reply is False:
        filters.append(Review.reply_text.is_(None))

    reviews = db.query(Review).filter(and_(*filters)).order_by(Review.create_time.desc()).all()

    return ReviewsResponse(
        reviews=reviews,
        stats=_compute_stats(reviews),
        location=loc,
    )


@router.post("/{location_id}/sync", response_model=SyncResponse)
async def sync_reviews(
    location_id: int,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Synchronise les avis depuis Google Business Profile vers la base de données."""
    loc = _get_location_or_404(location_id, current_user.id, db)

    gbp = GoogleBusinessClient(current_user.access_token)
    try:
        raw_reviews = await gbp.list_reviews(
            loc.location_name,
            start_date=start_date,
            end_date=end_date,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur Google API : {e}")

    count = 0
    for data in raw_reviews:
        existing = db.query(Review).filter(Review.review_id == data["review_id"]).first()
        if existing:
            for k, v in data.items():
                setattr(existing, k, v)
            existing.synced_at = datetime.now(timezone.utc)
        else:
            review = Review(location_id=location_id, **data)
            db.add(review)
            count += 1

    db.commit()

    # Met à jour la date de sync de l'établissement
    loc.synced_at = datetime.now(timezone.utc)
    db.commit()

    return SyncResponse(synced=count, location_name=loc.business_name)


@router.post("/{location_id}/reviews/{review_db_id}/reply")
async def post_reply(
    location_id: int,
    review_db_id: int,
    body: ReplyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poste ou met à jour la réponse à un avis."""
    _get_location_or_404(location_id, current_user.id, db)

    review = db.query(Review).filter(
        Review.id == review_db_id,
        Review.location_id == location_id,
    ).first()
    if not review:
        raise HTTPException(status_code=404, detail="Avis introuvable")

    gbp = GoogleBusinessClient(current_user.access_token)
    try:
        await gbp.post_reply(review.review_id, body.reply_text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur Google API : {e}")

    review.reply_text = body.reply_text
    review.reply_time = datetime.now(timezone.utc)
    db.commit()

    return {"success": True, "reply_text": body.reply_text}


@router.delete("/{location_id}/reviews/{review_db_id}/reply")
async def delete_reply(
    location_id: int,
    review_db_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Supprime la réponse à un avis."""
    _get_location_or_404(location_id, current_user.id, db)

    review = db.query(Review).filter(
        Review.id == review_db_id,
        Review.location_id == location_id,
    ).first()
    if not review:
        raise HTTPException(status_code=404, detail="Avis introuvable")

    gbp = GoogleBusinessClient(current_user.access_token)
    try:
        await gbp.delete_reply(review.review_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur Google API : {e}")

    review.reply_text = None
    review.reply_time = None
    db.commit()

    return {"success": True}


@router.get("/{location_id}/export")
def export_csv(
    location_id: int,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export CSV des avis."""
    _get_location_or_404(location_id, current_user.id, db)

    filters = [Review.location_id == location_id]
    if start_date:
        filters.append(Review.create_time >= start_date)
    if end_date:
        filters.append(Review.create_time <= end_date)

    reviews = db.query(Review).filter(and_(*filters)).order_by(Review.create_time.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Auteur", "Note", "Commentaire", "Réponse", "Date réponse"])
    for r in reviews:
        writer.writerow([
            r.create_time.strftime("%Y-%m-%d %H:%M") if r.create_time else "",
            r.reviewer_name or "",
            r.star_rating or "",
            r.comment or "",
            r.reply_text or "",
            r.reply_time.strftime("%Y-%m-%d %H:%M") if r.reply_time else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=avis_{location_id}.csv"},
    )


@router.post("/{location_id}/import")
async def import_csv(
    location_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Import des avis depuis un fichier CSV.
    Format attendu : Date, Auteur, Note, Commentaire, Réponse, Date réponse
    """
    _get_location_or_404(location_id, current_user.id, db)

    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Le fichier doit être au format .csv")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))

    COL_DATE     = next((c for c in (reader.fieldnames or []) if "date" in c.lower() and "rép" not in c.lower()), None)
    COL_AUTHOR   = next((c for c in (reader.fieldnames or []) if "auteur" in c.lower() or "author" in c.lower()), None)
    COL_RATING   = next((c for c in (reader.fieldnames or []) if "note" in c.lower() or "rating" in c.lower() or "star" in c.lower()), None)
    COL_COMMENT  = next((c for c in (reader.fieldnames or []) if "comment" in c.lower()), None)
    COL_REPLY    = next((c for c in (reader.fieldnames or []) if "réponse" in c.lower() or "reply" in c.lower() or "reponse" in c.lower()), None)
    COL_REPLYD   = next((c for c in (reader.fieldnames or []) if "date" in c.lower() and ("rép" in c.lower() or "reply" in c.lower())), None)

    added = 0
    skipped = 0

    for row in reader:
        raw_date = row.get(COL_DATE, "").strip() if COL_DATE else ""
        create_time: Optional[datetime] = None
        for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d", "%d/%m/%Y %H:%M", "%d/%m/%Y"):
            try:
                create_time = datetime.strptime(raw_date, fmt).replace(tzinfo=timezone.utc)
                break
            except (ValueError, TypeError):
                continue

        raw_rating = row.get(COL_RATING, "").strip() if COL_RATING else ""
        try:
            star_rating = int(float(raw_rating))
            if not 1 <= star_rating <= 5:
                star_rating = None
        except (ValueError, TypeError):
            star_rating = None

        comment = row.get(COL_COMMENT, "").strip() if COL_COMMENT else ""
        reviewer_name = row.get(COL_AUTHOR, "").strip() if COL_AUTHOR else ""
        reply_text = row.get(COL_REPLY, "").strip() if COL_REPLY else ""

        raw_reply_date = row.get(COL_REPLYD, "").strip() if COL_REPLYD else ""
        reply_time: Optional[datetime] = None
        if raw_reply_date:
            for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d", "%d/%m/%Y %H:%M", "%d/%m/%Y"):
                try:
                    reply_time = datetime.strptime(raw_reply_date, fmt).replace(tzinfo=timezone.utc)
                    break
                except (ValueError, TypeError):
                    continue

        if not comment and not star_rating:
            skipped += 1
            continue

        review_id = f"import-{uuid.uuid4().hex[:12]}"
        review = Review(
            location_id=location_id,
            review_id=review_id,
            reviewer_name=reviewer_name or "Anonyme",
            star_rating=star_rating,
            comment=comment or None,
            create_time=create_time,
            reply_text=reply_text or None,
            reply_time=reply_time,
        )
        db.add(review)
        added += 1

    db.commit()
    return {"imported": added, "skipped": skipped}
