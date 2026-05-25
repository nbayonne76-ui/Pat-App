from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    google_id = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String)
    picture = Column(String)
    access_token = Column(Text)
    refresh_token = Column(Text)
    token_expiry = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    locations = relationship("Location", back_populates="user", cascade="all, delete-orphan")


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # Google resource names : "accounts/123456789" / "accounts/123456789/locations/987654321"
    account_name = Column(String, nullable=False)
    location_name = Column(String, nullable=False, unique=True)
    business_name = Column(String, nullable=False)
    address = Column(String)
    phone = Column(String)
    website = Column(String)
    synced_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="locations")
    reviews = relationship("Review", back_populates="location", cascade="all, delete-orphan")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), index=True)
    review_id = Column(String, nullable=False, index=True)  # Google review resource name
    reviewer_name = Column(String)
    reviewer_photo = Column(String)
    star_rating = Column(Integer)  # 1-5
    comment = Column(Text)
    create_time = Column(DateTime(timezone=True), index=True)
    update_time = Column(DateTime(timezone=True))
    reply_text = Column(Text)
    reply_time = Column(DateTime(timezone=True))
    synced_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    location = relationship("Location", back_populates="reviews")
