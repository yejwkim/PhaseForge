import json
from pathlib import Path

from app.models.phase2_contracts import (
    FamilyTemplate,
    GeneratedQuestion,
    QuestionVariant,
    VerificationResult,
)


FIXTURE_DIR = Path(__file__).resolve().parents[2] / "shared" / "fixtures" / "phase2"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURE_DIR / name).read_text())


def test_generated_question_fixture_matches_contract() -> None:
    question = GeneratedQuestion.model_validate(load_fixture("generated_question.json"))

    assert question.professor_review_status == "approved"
    assert question.source_chunk_ids


def test_family_template_fixture_matches_contract() -> None:
    family = FamilyTemplate.model_validate(load_fixture("family_template.json"))

    assert family.source_generated_question_id
    assert {requirement.name for requirement in family.verification_requirements} == {
        "answer_matches",
        "same_concept",
        "similar_complexity",
        "within_scope",
        "not_duplicate",
    }


def test_verification_result_fixture_matches_contract() -> None:
    result = VerificationResult.model_validate(load_fixture("verification_result.json"))

    assert result.status == "passed"
    assert result.checks


def test_question_variant_fixture_matches_contract() -> None:
    variant = QuestionVariant.model_validate(load_fixture("question_variant.json"))

    assert variant.verification_status == variant.verification.status
    assert variant.verification.variant_id == variant.variant_id


def test_integration_bundle_keeps_contract_ids_connected() -> None:
    bundle = load_fixture("integration_bundle.json")
    generated = GeneratedQuestion.model_validate(bundle["generated_question"])
    family = FamilyTemplate.model_validate(bundle["family_template"])
    variant = QuestionVariant.model_validate(bundle["question_variant"])

    assert family.source_generated_question_id == generated.generated_question_id
    assert variant.family_id == family.family_id
    assert variant.course_id == generated.course_id == family.course_id
    assert variant.category_id == generated.category_id == family.category_id
    assert variant.verification.family_id == family.family_id
