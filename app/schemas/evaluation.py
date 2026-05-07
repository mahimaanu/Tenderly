from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class Verdict(str, Enum):
    ELIGIBLE = "eligible"
    NOT_ELIGIBLE = "not_eligible"
    NEEDS_REVIEW = "needs_review"


class EvaluationResponse(BaseModel):
    id: str
    tender_id: str
    bidder_id: str
    overall_verdict: Verdict
    score: Optional[float] = None
    total_criteria: int
    passed_criteria: int
    failed_criteria: int
    review_criteria: int
    requires_manual_review: bool = False
    review_completed: bool = False
    final_verdict: Optional[Verdict] = None
    evaluated_at: datetime

    class Config:
        from_attributes = True


class CriterionEvaluationResponse(BaseModel):
    id: str
    evaluation_id: str
    criterion_id: str
    verdict: Verdict
    confidence: Optional[float] = None
    requirement: str
    bidder_value: Optional[str] = None
    comparison_detail: Optional[str] = None
    source_document: Optional[str] = None
    source_page: Optional[int] = None
    source_excerpt: Optional[str] = None
    reasoning: str
    review_reason: Optional[str] = None
    manually_reviewed: bool = False
    manual_verdict: Optional[Verdict] = None
    reviewer_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ManualReview(BaseModel):
    verdict: Verdict
    reviewer_notes: Optional[str] = None
    reviewed_by: Optional[str] = None