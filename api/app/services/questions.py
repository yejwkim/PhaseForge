from typing import Any, TypeAlias, cast
from uuid import UUID
from app.core.supabase import get_supabase_client
from app.models.generation import CategoryPlan, GeneratedQuestionSet, QuestionDraft
from app.models.phase2_contracts import GeneratedQuestion
from app.services.figures import render_figure_json

JSON: TypeAlias = str | int | float | bool | None | list["JSON"] | dict[str, "JSON"]


def get_owned_course(course_id: UUID, professor_id: str) -> dict[str, Any] | None:
    supabase = get_supabase_client()
    response = (
        supabase.table("courses")
        .select("id, professor_id, title")
        .eq("id", str(course_id))
        .single()
        .execute()
    )
    course = response.data

    if not course:
        return None

    course_row = cast(dict[str, Any], course)

    if course_row["professor_id"] != professor_id:
        return None

    return course_row


def get_owned_question(question_id: UUID, professor_id: str) -> dict[str, Any] | None:
    supabase = get_supabase_client()
    response = (
        supabase.table("questions")
        .select("*")
        .eq("id", str(question_id))
        .single()
        .execute()
    )
    question = response.data
    if not question:
        return None
    question_row = cast(dict[str, Any], question)
    # Ownership flows through the course.
    if not get_owned_course(question_row["course_id"], professor_id):
        return None
    return question_row


def _resolve_category_for_topic(course_id: str, topic: str, fallback: str | None) -> str | None:
    """Match a (possibly new) topic name to an existing course category so a
    regenerated question lands in the right group; keep the old one if no match."""
    supabase = get_supabase_client()
    cats = (
        supabase.table("categories").select("id, name").eq("course_id", course_id).execute()
    )
    for cat in cast(list[dict[str, Any]], cats.data or []):
        if cat["name"].strip().lower() == topic.strip().lower():
            return str(cat["id"])
    return fallback


def update_question_content(
    question: dict[str, Any], draft: QuestionDraft, figure_svg: str = ""
) -> dict[str, Any]:
    """Overwrite a question from a regenerated/edited draft. The instructor's draft
    can change topic/difficulty/type; category is re-resolved to match the topic.
    ``figure_svg`` is the already-rendered SVG the instructor accepted. Resets
    review status to draft."""
    supabase = get_supabase_client()
    category_id = _resolve_category_for_topic(
        str(question["course_id"]), draft.topic, question.get("category_id")
    )
    _ = (
        supabase.table("questions")
        .update(
            {
                "type": draft.question_type,
                "topic": draft.topic,
                "difficulty": draft.difficulty,
                "category_id": category_id,
                "prompt": draft.prompt,
                "options": cast(JSON, draft.options),
                "answer": draft.answer,
                "explanation": draft.explanation,
                "rubric": cast(JSON, draft.rubric),
                "learning_objective": draft.learning_objective,
                "figure_svg": figure_svg,
                "professor_review_status": "draft",
            }
        )
        .eq("id", str(question["id"]))
        .execute()
    )
    refreshed = (
        supabase.table("questions").select("*").eq("id", str(question["id"])).single().execute()
    )
    return cast(dict[str, Any], refreshed.data)


def _resolve_category_id(topic: str, plans: list[CategoryPlan]) -> str:
    # Claude is told to echo a topic name verbatim; match it back to its category id.
    # Fall back to the first plan so category_id is always set.
    for plan in plans:
        if plan.name.strip().lower() == topic.strip().lower():
            return str(plan.id)
    return str(plans[0].id)


def insert_questions(
    course_id: UUID,
    assessment_id: UUID | None,
    question_set: GeneratedQuestionSet,
    source_chunk_ids: list[str],
    plans: list[CategoryPlan],
) -> list[dict[str, Any]]:
    if not question_set.questions:
        return []

    supabase = get_supabase_client()
    rows: list[JSON] = [
        {
            "course_id": str(course_id),
            "assessment_id": str(assessment_id) if assessment_id else None,
            "category_id": _resolve_category_id(question.topic, plans),
            "type": question.question_type,
            "difficulty": question.difficulty,
            "topic": question.topic,
            "learning_objective": question.learning_objective,
            "prompt": question.prompt,
            "options": cast(JSON, question.options),
            "answer": question.answer,
            "explanation": question.explanation,
            "rubric": cast(JSON, question.rubric),
            "figure_svg": render_figure_json(question.figure_spec_json),
            "source_chunk_ids": cast(JSON, source_chunk_ids),
            "professor_review_status": "draft",
        }
        for question in question_set.questions
    ]

    response = (
        supabase.table("questions")
        .insert(rows)
        .execute()
    )

    return cast(list[dict[str, Any]], response.data or [])


def to_contract_question(row: dict[str, Any]) -> dict[str, Any]:
    """Shape a stored question row into a phase2.generated_question.v1 object.
    The contract requires several fields be non-empty, so fall back where the
    model occasionally returns a blank."""
    topic = (row.get("topic") or "").strip() or "General"
    return GeneratedQuestion(
        generated_question_id=row["id"],
        course_id=row["course_id"],
        category_id=row["category_id"],
        source_chunk_ids=row.get("source_chunk_ids") or [],
        question_type=row["type"],
        topic=topic,
        difficulty=row["difficulty"],
        learning_objective=(row.get("learning_objective") or "").strip()
        or f"Assesses understanding of {topic}.",
        prompt=(row.get("prompt") or "").strip() or "(Question text unavailable.)",
        options=row.get("options") or [],
        answer=(row.get("answer") or "").strip() or "See the rubric.",
        explanation=(row.get("explanation") or "").strip() or "See the answer key.",
        rubric=row.get("rubric") or [],
        professor_review_status=row.get("professor_review_status", "draft"),
    ).model_dump(mode="json")
