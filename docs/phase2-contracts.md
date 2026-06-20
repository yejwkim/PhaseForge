# Phase 2 Contracts

> Status: proposed freeze for Phase 2. This contract follows Option B: keep
> Engineer A focused on the shared database/API seam and let Engineer B build the
> generation, variant, and verification pipeline against stable JSON shapes.

## Source Context

The project docs define Phase 2 as the question family pipeline: generated
questions become parameterized templates, each family produces multiple variants,
and each variant is verified for answer correctness, same concept, similar
complexity, comparable difficulty, and course scope. The design doc's data model
maps this to `item_families` and `item_instances`, with IRT calibration stored on
families rather than individual variants.

The current code already has a flat `GeneratedQuestion` for first-pass question
generation. Treat that as the seed object. Phase 2 adds three durable objects:
`FamilyTemplate`, `QuestionVariant`, and `VerificationResult`.

## Contract Decisions

- `GeneratedQuestion` is a professor-reviewable seed from RAG generation. It is
  not yet a reusable family.
- `FamilyTemplate` is the reusable, calibrated unit. It owns the parameterized
  prompt, variable constraints, invariant concept, solution template, verification
  requirements, and IRT prior.
- `QuestionVariant` is one instantiated student-facing item from a family. It
  stores resolved variables, body, answer, solution, and an embedded
  `VerificationResult`.
- `VerificationResult` is immutable evidence for why a variant can be used. It
  should be stored with the variant and can also be logged independently during
  generation attempts.
- Difficulty labels are frozen as `Easy`, `Medium`, `Hard` to match the frontend
  builder and category bands.
- Verification statuses are `passed`, `failed`, and `needs_review`. Only
  `passed` variants should enter the pre-generated assessment buffer.
- Source provenance stays explicit through `source_chunk_ids` so every family can
  be traced back to RAG material.

## Database Shape

Phase 2 should add tables equivalent to:

```text
item_families (
  id,
  course_id,
  category_id,
  source_generated_question_id,
  template_json,
  difficulty_prior,
  irt_a,
  irt_b,
  irt_c,
  calibration_state,
  n_responses,
  created_at
)

item_instances (
  id,
  family_id,
  body,
  answer,
  solution,
  variables_json,
  verification_json,
  verification_status,
  created_at
)
```

RLS should follow the existing ownership pattern: families are owned through
`course_id`; instances are owned through `family_id -> item_families.course_id`.

## Shared Fixtures

Use `shared/fixtures/phase2/` as the cross-team examples:

- `generated_question.json`
- `family_template.json`
- `question_variant.json`
- `verification_result.json`
- `integration_bundle.json`

The API validates these fixtures with `api/tests/test_phase2_contracts.py`.

