from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class TenderStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    EVALUATION = "evaluation"
    COMPLETED = "completed"


class TenderCreate(BaseModel):
    tender_number: str = Field(..., example="CRPF/2024/CONST/001")
    title: str = Field(..., example="Construction Services")
    description: Optional[str] = None
    issuing_authority: Optional[str] = None
    submission_deadline: Optional[datetime] = None
    created_by: Optional[str] = None


class TenderResponse(BaseModel):
    id: str
    tender_number: str
    title: str
    description: Optional[str] = None
    issuing_authority: Optional[str] = None
    submission_deadline: Optional[datetime] = None
    status: TenderStatus
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CriterionType(str, Enum):
    FINANCIAL = "financial"
    TECHNICAL = "technical"
    EXPERIENCE = "experience"
    CERTIFICATION = "certification"
    COMPLIANCE = "compliance"
    DOCUMENTATION = "documentation"


class Priority(str, Enum):
    MANDATORY = "mandatory"
    OPTIONAL = "optional"


class CriterionResponse(BaseModel):
    id: str
    criterion_code: Optional[str] = None
    type: CriterionType
    priority: Priority
    description: str
    original_text: Optional[str] = None
    threshold_value: Optional[str] = None
    threshold_operator: Optional[str] = None
    unit: Optional[str] = None
    source_page: Optional[int] = None
    confidence: Optional[float] = None
    manually_verified: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class CriterionUpdate(BaseModel):
    type: Optional[CriterionType] = None
    priority: Optional[Priority] = None
    description: Optional[str] = None
    threshold_value: Optional[str] = None
    threshold_operator: Optional[str] = None
    unit: Optional[str] = None
    manually_verified: Optional[bool] = None


class TenderDocumentResponse(BaseModel):
    id: str
    filename: str
    file_path: str
    file_hash: Optional[str] = None
    page_count: Optional[int] = None
    processed: bool
    created_at: datetime

    class Config:
        from_attributes = True