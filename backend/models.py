from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator

class VaultItemCreate(BaseModel):
    item_id: str = Field(..., min_length=1, max_length=50, description="Unique vault item identifier, e.g. F-12, R-04")
    kind: Literal["fact", "rule", "terminology", "palette"]
    title: str = Field(..., min_length=1, max_length=200, description="Descriptive title for the vault item")
    text: str = Field(..., min_length=1, max_length=5000, description="Rule text, fact description, or term rule")
    status: Literal["active", "archived"] = "active"

    @field_validator("item_id", "title", "text")
    @classmethod
    def not_empty_str(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Field cannot be empty or blank")
        return value.strip()

class VaultItemUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    text: Optional[str] = Field(None, max_length=5000)
    status: Optional[Literal["active", "archived"]] = None

    @field_validator("title", "text")
    @classmethod
    def not_empty_if_present(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and not value.strip():
            raise ValueError("Updated field cannot be empty or blank")
        return value.strip() if value is not None else None

class DraftCreate(BaseModel):
    brand_id: str = Field(..., description="Target brand UUID")
    title: str = Field(..., min_length=1, max_length=200, description="Draft headline or title")
    body_text: str = Field(..., min_length=1, max_length=10000, description="Primary content body text to review")
    alt_text: Optional[str] = Field(None, max_length=1000, description="Image accessibility alt text")
    image_url: Optional[str] = Field(None, max_length=2000, description="Optional creative image URL")
    created_by_role: Literal["creator", "reviewer", "guest"] = "guest"


    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("title cannot be empty")
        return value.strip()

    @field_validator("body_text")
    @classmethod
    def validate_body_text(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("body_text cannot be empty")
        return value.strip()

class ApplyFixRequest(BaseModel):
    finding_id: str = Field(..., description="UUID of the finding whose suggested_fix will be applied")

class ReviseDraftRequest(BaseModel):
    body_text: str = Field(..., min_length=1, max_length=10000, description="Revised draft content body text")
    alt_text: Optional[str] = Field(None, max_length=1000, description="Optional revised image alt text")

    @field_validator("body_text")
    @classmethod
    def validate_body_text(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("body_text cannot be empty")
        return value.strip()

class RequestApprovalRequest(BaseModel):
    comment: Optional[str] = Field(None, max_length=2000)
    role: Optional[str] = "creator"

class ApproveDraftRequest(BaseModel):
    comment: Optional[str] = Field(None, max_length=2000)
    role: Optional[str] = "demo_reviewer"

class RequestChangesRequest(BaseModel):
    comment: str = Field(..., min_length=1, max_length=2000, description="Reason for requesting changes is required")

    @field_validator("comment")
    @classmethod
    def validate_comment(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Comment cannot be empty when requesting changes")
        return value.strip()

class AddCommentRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    role: Optional[str] = "guest"

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Comment text cannot be empty")
        return value.strip()


class AttachImageRequest(BaseModel):
    image_url: str = Field(..., min_length=1, max_length=2000, description="Public URL of the uploaded creative image")
    alt_text: Optional[str] = Field(None, max_length=1000, description="Image descriptive accessibility alt text")
    logo_confirmed: bool = Field(False, description="Reviewer confirmed approved current logo only (A-02)")

class ReviewDraftRequest(BaseModel):
    logo_confirmed: bool = Field(False, description="Reviewer confirmed current logo (A-02)")
    palette_off: bool = Field(False, description="Client-side canvas sampling detected off-palette colors")
    contrast_ratio: Optional[float] = Field(None, description="Calculated WCAG text contrast ratio")



