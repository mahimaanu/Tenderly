from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class BidderStatus(str, Enum):
    SUBMITTED = "submitted"
    EVALUATING = "evaluating"
    EVALUATED = "evaluated"
    REVIEWED = "reviewed"


class BidderCreate(BaseModel):
    company_name: str = Field(..., example="ABC Construction Pvt Ltd")
    contact_email: Optional[str] = Field(None, example="contact@abcconstruction.com")
    registration_number: Optional[str] = None


class BidderResponse(BaseModel):
    id: str
    tender_id: str
    company_name: str
    contact_email: Optional[str] = None
    registration_number: Optional[str] = None
    submitted_at: Optional[datetime] = None
    status: BidderStatus
    created_at: datetime

    class Config:
        from_attributes = True


class BidderDocumentResponse(BaseModel):
    id: str
    bidder_id: str
    document_type: Optional[str] = None
    filename: str
    file_path: str
    file_hash: Optional[str] = None
    confidence_score: Optional[float] = None
    needs_review: bool = False
    page_count: Optional[int] = None
    processed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True