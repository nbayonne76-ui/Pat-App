"""
Client pour Google Business Profile API v4.
Doc : https://developers.google.com/my-business/reference/rest
"""
from datetime import datetime, timezone
from typing import Optional

import httpx

BUSINESS_API_BASE = "https://mybusiness.googleapis.com/v4"
STAR_MAP = {"ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5}


def _star_to_int(star_str: str) -> int:
    return STAR_MAP.get(star_str, 0)


class GoogleBusinessClient:
    def __init__(self, access_token: str):
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    async def list_accounts(self) -> list[dict]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BUSINESS_API_BASE}/accounts",
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json().get("accounts", [])

    async def list_locations(self, account_name: str) -> list[dict]:
        """account_name = 'accounts/123456789'"""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BUSINESS_API_BASE}/{account_name}/locations",
                headers=self.headers,
                params={"readMask": "name,title,storefrontAddress,phoneNumbers,websiteUri"},
            )
            resp.raise_for_status()
            return resp.json().get("locations", [])

    async def list_reviews(
        self,
        location_name: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> list[dict]:
        """
        Récupère tous les avis d'un établissement, filtrés par fourchette de dates.
        location_name = 'accounts/123/locations/456'
        """
        reviews = []
        page_token = None

        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                params = {"pageSize": 50}
                if page_token:
                    params["pageToken"] = page_token

                resp = await client.get(
                    f"{BUSINESS_API_BASE}/{location_name}/reviews",
                    headers=self.headers,
                    params=params,
                )
                resp.raise_for_status()
                data = resp.json()
                page_reviews = data.get("reviews", [])

                for review in page_reviews:
                    create_time = datetime.fromisoformat(
                        review.get("createTime", "").replace("Z", "+00:00")
                    )
                    # On s'arrête dès qu'on dépasse la borne inférieure (avis triés par date desc)
                    if start_date and create_time < start_date:
                        return reviews

                    if end_date and create_time > end_date:
                        continue

                    reviews.append(self._normalize_review(review))

                page_token = data.get("nextPageToken")
                if not page_token:
                    break

        return reviews

    async def post_reply(self, review_name: str, reply_text: str) -> dict:
        """
        review_name = 'accounts/123/locations/456/reviews/789'
        """
        async with httpx.AsyncClient() as client:
            resp = await client.put(
                f"{BUSINESS_API_BASE}/{review_name}/reply",
                headers=self.headers,
                json={"comment": reply_text},
            )
            resp.raise_for_status()
            return resp.json()

    async def delete_reply(self, review_name: str) -> None:
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{BUSINESS_API_BASE}/{review_name}/reply",
                headers=self.headers,
            )
            resp.raise_for_status()

    def _normalize_review(self, raw: dict) -> dict:
        reply = raw.get("reviewReply")
        create_str = raw.get("createTime", "")
        update_str = raw.get("updateTime", "")

        return {
            "review_id": raw.get("name", ""),
            "reviewer_name": raw.get("reviewer", {}).get("displayName"),
            "reviewer_photo": raw.get("reviewer", {}).get("profilePhotoUrl"),
            "star_rating": _star_to_int(raw.get("starRating", "")),
            "comment": raw.get("comment"),
            "create_time": datetime.fromisoformat(create_str.replace("Z", "+00:00")) if create_str else None,
            "update_time": datetime.fromisoformat(update_str.replace("Z", "+00:00")) if update_str else None,
            "reply_text": reply.get("comment") if reply else None,
            "reply_time": (
                datetime.fromisoformat(reply["updateTime"].replace("Z", "+00:00"))
                if reply and reply.get("updateTime")
                else None
            ),
        }
