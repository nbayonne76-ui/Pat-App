from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserOut(BaseModel):
    id: int
    email: str
    name: Optional[str]
    picture: Optional[str]

    class Config:
        from_attributes = True


class LocationOut(BaseModel):
    id: int
    location_name: str
    account_name: str
    business_name: str
    address: Optional[str]
    phone: Optional[str]
    website: Optional[str]
    synced_at: Optional[datetime]

    class Config:
        from_attributes = True


class ReviewOut(BaseModel):
    id: int
    review_id: str
    reviewer_name: Optional[str]
    reviewer_photo: Optional[str]
    star_rating: Optional[int]
    comment: Optional[str]
    create_time: Optional[datetime]
    update_time: Optional[datetime]
    reply_text: Optional[str]
    reply_time: Optional[datetime]

    class Config:
        from_attributes = True


class ReviewStats(BaseModel):
    total: int
    average_rating: float
    distribution: dict[int, int]  # {1: count, 2: count, ...}


class ReviewsResponse(BaseModel):
    reviews: list[ReviewOut]
    stats: ReviewStats
    location: LocationOut


class ReplyRequest(BaseModel):
    reply_text: str


class SyncResponse(BaseModel):
    synced: int
    location_name: str
