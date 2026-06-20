from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


QuestionType = Literal["mcq", "short_answer", "essay"]
DifficultyBand = Literal["Easy", "Medium", "Hard"]
VerificationStatus = Literal["passed", "failed", "needs_review"]
VerificationCheckStatus = Literal["passed", "failed", "warning"]


class StrictBaseModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class GeneratedQuestion(StrictBaseModel):
    schema_version: Literal["phase2.generated_question.v1"] = "phase2.generated_question.v1"
    generated_question_id: UUID
    course_id: UUID
    category_id: UUID
    source_chunk_ids: list[UUID]
    question_type: QuestionType
    topic: str = Field(min_length=1)
    difficulty: DifficultyBand
    learning_objective: str = Field(min_length=1)
    prompt: str = Field(min_length=1)
    options: list[str]
    answer: str = Field(min_length=1)
    explanation: str = Field(min_length=1)
    rubric: list[str]
    professor_review_status: Literal["draft", "approved", "rejected"] = "draft"


class TemplateVariable(StrictBaseModel):
    name: str = Field(pattern=r"^[a-z][a-z0-9_]*$")
    kind: Literal["integer", "decimal", "choice", "text"]
    constraints: dict[str, Any]
    role: str = Field(min_length=1)


class VerificationRequirement(StrictBaseModel):
    name: Literal[
        "answer_matches",
        "same_concept",
        "similar_complexity",
        "within_scope",
        "not_duplicate",
    ]
    required: bool = True


class IrtPrior(StrictBaseModel):
    discrimination_a: float = Field(gt=0)
    difficulty_b: float
    guessing_c: float = Field(ge=0, le=1)
    calibration_state: Literal["ai_prior", "calibrating", "calibrated"] = "ai_prior"


class FamilyTemplate(StrictBaseModel):
    schema_version: Literal["phase2.family_template.v1"] = "phase2.family_template.v1"
    family_id: UUID
    course_id: UUID
    category_id: UUID
    source_generated_question_id: UUID
    source_chunk_ids: list[UUID]
    question_type: QuestionType
    topic: str = Field(min_length=1)
    difficulty: DifficultyBand
    learning_objective: str = Field(min_length=1)
    invariant_concept: str = Field(min_length=1)
    template_text: str = Field(min_length=1)
    variables: list[TemplateVariable]
    answer_expression: str = Field(min_length=1)
    solution_template: list[str]
    variant_strategy: str = Field(min_length=1)
    verification_requirements: list[VerificationRequirement]
    difficulty_prior: float = Field(ge=0, le=1)
    irt_prior: IrtPrior


class VerificationCheck(StrictBaseModel):
    name: str = Field(min_length=1)
    status: VerificationCheckStatus
    message: str = Field(min_length=1)
    evidence: dict[str, Any]


class VerificationResult(StrictBaseModel):
    schema_version: Literal["phase2.verification_result.v1"] = (
        "phase2.verification_result.v1"
    )
    verification_id: UUID
    family_id: UUID
    variant_id: UUID
    status: VerificationStatus
    verifier_kind: Literal["sympy", "llm_judge", "hybrid"]
    computed_answer: str = Field(min_length=1)
    reference_solution: list[str]
    complexity_score: float = Field(ge=0)
    checks: list[VerificationCheck]


class QuestionVariant(StrictBaseModel):
    schema_version: Literal["phase2.question_variant.v1"] = "phase2.question_variant.v1"
    variant_id: UUID
    family_id: UUID
    course_id: UUID
    category_id: UUID
    question_type: QuestionType
    body: str = Field(min_length=1)
    variables: dict[str, Any]
    options: list[str]
    correct_answer: str = Field(min_length=1)
    solution: list[str]
    difficulty: DifficultyBand
    verification_status: VerificationStatus
    verification: VerificationResult

