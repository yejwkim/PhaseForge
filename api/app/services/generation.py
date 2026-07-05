import base64
import re
from time import sleep
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import lru_cache
from typing import Any
import pymupdf
from anthropic import Anthropic
from app.core.config import get_settings
from app.models.generation import (
    CategoryPlan,
    GenerateRequest,
    GeneratedQuestionSet,
    QuestionDraft,
)
from app.services.material_files import download_material_file

# Generate in small batches so long exams never hit the output-token ceiling,
# the per-band counts come out exact, and batches run concurrently. Figures are
# now compact JSON specs (not verbose SVG), so batches don't blow the token cap.
MAX_QUESTIONS_PER_CALL = 6
MAX_PARALLEL_CALLS = 5
# Per-batch output cap. Kept under the SDK's ~10-minute non-streaming guard
# (which trips at higher max_tokens) — a 6-question batch fits easily.
BATCH_MAX_TOKENS = 16000

SYSTEM_PROMPT = (
    "You are an expert exam author for university instructors. You write ORIGINAL, "
    "exam-ready questions grounded strictly in the provided course material, each with "
    "a complete answer key.\n"
    "Items labeled 'Example question from the instructor's past exam' are STYLE TEMPLATES. "
    "Study them and produce NEW questions that imitate them closely.\n"
    "IMAGES of the actual exam pages may be attached. Study the figures and layout in them, "
    "and when a question needs a figure, describe an equivalent one as DATA in "
    "`figure_spec_json` (the server draws it).\n"
    "Rules:\n"
    "- MATCH THE EXAMPLES' FORMAT EXACTLY: same structure, length, phrasing conventions, "
    "notation, and answer style. If the examples are single-part multiple-choice with a "
    "single correct answer, your questions must be too. Do NOT invent a different format — "
    "no multi-part (a)/(b) questions, no proofs, and no 'identify the structural feature', "
    "'explain', or 'justify your reasoning' prompts UNLESS the examples themselves do that.\n"
    "- Difficulty is RELATIVE TO THAT FORMAT. A 'Hard' question is a trickier version in the "
    "SAME format (more steps, bigger numbers, common traps/distractors) — NOT a more "
    "conceptual, open-ended, or proof-style question.\n"
    "- Ground every question in the supplied material. Use only concepts, terminology, and "
    "notation that appear in it; do not pull in outside knowledge or invent facts.\n"
    "- Do not copy any example verbatim — produce fresh questions in that same style.\n"
    "- For mcq: put 3-5 plausible choices in `options`, set `answer` to the exact text of "
    "the correct choice, give a one-paragraph `explanation`, and leave `rubric` empty.\n"
    "- For short_answer: leave `options` empty, put a concise model answer in `answer`, "
    "and list concrete grading criteria in `rubric`.\n"
    "- ALWAYS fill `explanation` with a brief non-empty rationale for the answer, for "
    "every question type.\n"
    "- Set `learning_objective` to a one-sentence statement of what the question tests.\n"
    "- `figure_spec_json`: when a question needs ANY figure (function graph, geometry, physics "
    "free-body / vector diagram, number line, tree, table, matrix, weighted graph, etc.) set "
    "this to a JSON OBJECT ENCODED AS A STRING describing the figure as DATA — never write SVG; "
    "the server draws it precisely. Use \"\" (empty string) when no figure is needed. The JSON "
    "object has a `kind` field:\n"
    "    · 'tree' → a rooted tree. List `nodes` with root at index 0. For a binary tree, set "
    "`left`/`right` to child indexes or -1. For a multiway tree, set `children` to child "
    "indexes and set unused `left`/`right` to -1.\n"
    "    · 'scene' → everything else: a list of `elements` placed in a logical window (set "
    "x_min/x_max/y_min/y_max to frame it; `axes`=true for coordinate graphs, false for plain "
    "diagrams). Element `type`s:\n"
    "      - 'func': simple plotted function using `func_kind`: 'parabola' a,b,c / 'line' a,b / "
    "'exp' a·b^x+c / 'sin' a·sin(bx+c).\n"
    "      - 'expr': general y=f(x) graph using `expression`, e.g. \"log(x)\", \"x^3-2*x\", "
    "\"(x^2-1)/(x-2)\", \"sqrt(x)\", \"sin(x)/x\". Supported functions include sin, cos, tan, "
    "sqrt, log/ln, log10, exp, abs, floor, ceil, min, max, and constants pi/e. Use ^ or ** "
    "for powers.\n"
    "      - 'piecewise': set `pieces` to objects with expression, x_min, x_max, include_start, "
    "include_end. Use for piecewise functions and open/closed endpoints.\n"
    "      - 'inequality': shade y relation to `expression`; set `relation` to '<', '<=', '>', "
    "or '>='. Strict inequalities draw dashed boundaries.\n"
    "      - 'point' (x,y,label); 'segment' (x,y→x2,y2); 'ray'; 'arrow' (for vectors/forces); "
    "'circle' (center x,y,r); 'polygon' (vertices; closed=true for filled triangles/rectangles); "
    "'text' (x,y,label); 'angle'; 'right_angle'. Segment/ray/func/expr can be `dashed`; segment "
    "`ticks` draws congruence marks.\n"
    "      - 'table' and 'matrix': set `rows` to a 2D string array; x/y is the top-left; optional "
    "`w`/`h` set cell size.\n"
    "      - 'node' and 'edge': use for weighted/directed graphs and network diagrams. Node uses "
    "x,y,label,r (or w/h). Edge uses x,y,x2,y2,label as the weight/edge label and `directed` "
    "for an arrowhead.\n"
    "    · 'circuit' → an electrical schematic. Set `components`, each with a `type` (wire, "
    "resistor, capacitor, inductor, battery, source, switch, ground, lamp), endpoints "
    "(x1,y1)-(x2,y2) on a small integer grid, and a `label`. Build loops with wires.\n"
    "    · 'molecule' → a Lewis/skeletal structure. Set `atoms` (element, x, y, charge) and "
    "`bonds` (a, b = atom indexes, order = 1/2/3).\n"
    "    · 'punnett' → a Punnett square. Set `punnett_top` and `punnett_side` (allele headers) "
    "and `punnett_cells` (row-major genotypes, length = |top|*|side|).\n"
    "    · 'solid' → a 3D solid in oblique projection. Set `solid_kind` (cube, prism, cylinder, "
    "cone, sphere, pyramid), dimensions `sw`/`sh`/`sd`, and optional `solid_labels`.\n"
    "    · 'beam' → a statics beam diagram. Set `beam_length`, `supports` (position, type = "
    "pin/roller/fixed), and `loads` (position, kind = point/distributed/moment, end for "
    "distributed, label).\n"
    "    · omit the figure entirely (set `figure_spec_json` to \"\") when no figure is needed.\n"
    "  Compose primitives to build whatever the question needs. The DATA MUST match the question "
    "exactly. Only include the fields the chosen `kind` needs; you may omit the rest. "
    "Remember `figure_spec_json` must be a STRING containing valid JSON, e.g. "
    "\"{\\\"kind\\\": \\\"scene\\\", \\\"axes\\\": true, \\\"x_min\\\": -5, ...}\"."
)


@lru_cache
def get_anthropic_client() -> Anthropic:
    settings = get_settings()
    return Anthropic(api_key=settings.anthropic_api_key)


PAGE_MARKER_RE = re.compile(r"\[Page (\d+)\]")
FIGURE_IMAGE_DPI = 110
MAX_FIGURE_IMAGES = 3


def collect_exam_page_images(chunks: list[dict[str, Any]]) -> list[str]:
    """Render the past-exam PDF pages the retrieved chunks came from into PNG
    images (base64), so Claude can SEE the real figures/layout via vision and
    reproduce equivalent figures. Best-effort — never breaks generation."""
    pages_by_path: dict[str, set[int]] = {}
    for chunk in chunks:
        if chunk.get("material_type") != "past_exam":
            continue
        path = chunk.get("material_storage_path")
        if not path:
            continue
        pages = {int(n) for n in PAGE_MARKER_RE.findall(chunk.get("content", ""))}
        pages_by_path.setdefault(path, set()).update(pages or {1})

    images: list[str] = []
    for path, pages in pages_by_path.items():
        if len(images) >= MAX_FIGURE_IMAGES:
            break
        try:
            doc = pymupdf.open(stream=download_material_file(path), filetype="pdf")
            try:
                for page_no in sorted(pages):
                    if len(images) >= MAX_FIGURE_IMAGES:
                        break
                    if page_no < 1 or page_no > doc.page_count:
                        continue
                    pixmap = doc.load_page(page_no - 1).get_pixmap(dpi=FIGURE_IMAGE_DPI)
                    images.append(base64.standard_b64encode(pixmap.tobytes("png")).decode())
            finally:
                doc.close()
        except Exception as exc:  # rendering must never break generation
            print(f"[figures] could not render {path}: {exc}", flush=True)
    return images


def build_context(chunks: list[dict[str, Any]]) -> str:
    blocks: list[str] = []
    for index, chunk in enumerate(chunks, start=1):
        # Past-exam chunks are style exemplars to imitate; the rest is reference.
        if chunk.get("material_type") == "past_exam":
            label = f"Example question from the instructor's past exam #{index}"
        else:
            label = f"Reference material #{index}"
        blocks.append(f"[{label}]\n{chunk['content']}")
    return "\n\n".join(blocks)


def _build_batches(request: GenerateRequest) -> list[tuple[CategoryPlan, str, int]]:
    """Split the request into (topic, difficulty band, count) batches, each no
    larger than MAX_QUESTIONS_PER_CALL."""
    batches: list[tuple[CategoryPlan, str, int]] = []
    for plan in request.plans:
        for band, count in (("Easy", plan.easy), ("Medium", plan.medium), ("Hard", plan.hard)):
            remaining = count
            while remaining > 0:
                n = min(remaining, MAX_QUESTIONS_PER_CALL)
                batches.append((plan, band, n))
                remaining -= n
    return batches


def _build_batch_prompt(
    request: GenerateRequest, plan: CategoryPlan, band: str, count: int, context: str
) -> str:
    types = ", ".join(request.types)
    parts = [
        f"Generate EXACTLY {count} {band}-difficulty exam question(s) on the topic "
        f'"{plan.name}".',
        "Imitate the FORMAT and answer style of the example past-exam questions below as "
        "closely as possible — they define what a question for this course looks like.",
        f"Question types to use (mix across them): {types}.",
        f'Set every question\'s `topic` to "{plan.name}" verbatim and its `difficulty` to '
        f'"{band}".',
    ]
    if request.instructions:
        parts.append(f"Additional instructions: {request.instructions}")
    parts.append("\nCourse material:\n" + context)
    return "\n".join(parts)


def _message_content(text: str, images: list[str]) -> Any:
    """Build a user message: plain text, or text + past-exam page images (as
    vision input) so Claude can see the real figures and reproduce them."""
    if not images:
        return text
    content: list[dict[str, Any]] = [{"type": "text", "text": text}]
    for b64 in images:
        content.append(
            {
                "type": "image",
                "source": {"type": "base64", "media_type": "image/png", "data": b64},
            }
        )
    return content


BATCH_ATTEMPTS = 3  # transient blips (overload / unparseable reply) self-heal on retry


def _generate_batch(
    request: GenerateRequest,
    plan: CategoryPlan,
    band: str,
    count: int,
    context: str,
    images: list[str],
) -> list[QuestionDraft]:
    settings = get_settings()
    client = get_anthropic_client()

    last_error: Exception | None = None
    for attempt in range(BATCH_ATTEMPTS):
        try:
            response = client.messages.parse(
                model=settings.generation_model,
                max_tokens=min(settings.generation_max_tokens, BATCH_MAX_TOKENS),
                thinking={"type": "adaptive"},
                system=SYSTEM_PROMPT,
                messages=[
                    {
                        "role": "user",
                        "content": _message_content(
                            _build_batch_prompt(request, plan, band, count, context), images
                        ),
                    }
                ],
                output_format=GeneratedQuestionSet,
            )

            if response.stop_reason == "refusal":
                # A refusal won't change on retry — fail fast.
                raise RuntimeError("Question generation was refused by the safety system")
            if response.stop_reason == "max_tokens":
                raise RuntimeError(
                    f"Hit the output token limit on {plan.name}/{band} — raise GENERATION_MAX_TOKENS."
                )

            result = response.parsed_output
            if result is None:
                raise RuntimeError(
                    f"Model did not return a parseable batch for {plan.name}/{band}"
                )
            return result.questions
        except Exception as exc:  # noqa: BLE001 — retry transient failures, then give up
            last_error = exc
            if "refused" in str(exc):
                break  # don't burn retries on a safety refusal
            if attempt < BATCH_ATTEMPTS - 1:
                sleep(1.5 * (attempt + 1))  # brief linear backoff between attempts

    raise last_error if last_error else RuntimeError(f"Batch {plan.name}/{band} failed")


def _build_regenerate_prompt(
    question: dict[str, Any], instructions: str | None, context: str
) -> str:
    parts = [
        f'The instructor wants to REPLACE this {question["type"]} question on the topic '
        f'"{question["topic"]}":',
        f'"""\n{question["prompt"]}\n"""',
        "Write a genuinely DIFFERENT question — a different scenario, structure, or "
        "sub-skill. Do NOT just reuse the same setup with different numbers; it should "
        "feel like a distinct problem.",
        f'By default keep the same topic ("{question["topic"]}"), difficulty '
        f'({question["difficulty"]}), and type ({question["type"]}). BUT if the '
        "instructor's guidance asks to change the difficulty or topic, follow it and set "
        "the `difficulty`, `topic`, and `question_type` fields to match what you produced.",
        "Set `difficulty` to one of: Easy, Medium, Hard. Ground the question in the "
        "material below.",
    ]
    if instructions and instructions.strip():
        parts.append(
            "MOST IMPORTANT — follow the instructor's guidance, even if it means a "
            f"different topic, harder difficulty, or different style: {instructions.strip()}"
        )
    parts.append("\nCourse material:\n" + context)
    return "\n".join(parts)


def regenerate_one(
    question: dict[str, Any], instructions: str | None, chunks: list[dict[str, Any]]
) -> QuestionDraft:
    settings = get_settings()
    client = get_anthropic_client()

    # Bounded thinking budget (not adaptive) so a deep rewrite can't consume the
    # whole token cap and truncate the output — one question needs little thinking.
    response = client.messages.parse(
        model=settings.generation_model,
        max_tokens=min(settings.generation_max_tokens, BATCH_MAX_TOKENS),
        thinking={"type": "enabled", "budget_tokens": 4000},
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": _message_content(
                    _build_regenerate_prompt(question, instructions, build_context(chunks)),
                    collect_exam_page_images(chunks),
                ),
            }
        ],
        output_format=QuestionDraft,
    )

    if response.stop_reason == "refusal":
        raise RuntimeError("Question regeneration was refused by the safety system")
    if response.stop_reason == "max_tokens":
        raise RuntimeError("Hit the output token limit — try shorter instructions.")

    result = response.parsed_output
    if result is None:
        raise RuntimeError("Model did not return a parseable question")

    return result


def generate_questions(
    request: GenerateRequest, chunks: list[dict[str, Any]]
) -> GeneratedQuestionSet:
    context = build_context(chunks)
    images = collect_exam_page_images(chunks)
    batches = _build_batches(request)
    if not batches:
        return GeneratedQuestionSet(questions=[])

    # Run batches concurrently. CRUCIAL: isolate failures. Each band is its own
    # Claude call, and a single flaky one (transient 429/500/529, a max_tokens
    # trip, or an unparseable reply) must NOT discard the batches that succeeded —
    # otherwise one bad call zeroes out the whole pool. We keep every success and
    # only come back empty if every batch failed.
    questions: list[QuestionDraft] = []
    failures: list[str] = []
    with ThreadPoolExecutor(max_workers=MAX_PARALLEL_CALLS) as executor:
        future_to_batch = {
            executor.submit(
                _generate_batch, request, b[0], b[1], b[2], context, images
            ): b
            for b in batches
        }
        for future in as_completed(future_to_batch):
            plan, band, _count = future_to_batch[future]
            try:
                questions.extend(future.result())
            except Exception as exc:  # noqa: BLE001 — one batch must not sink the rest
                failures.append(f"{plan.name}/{band}: {exc}")
                print(f"[generate] batch failed — {plan.name}/{band}: {exc}", flush=True)

    if not questions and failures:
        # Everything failed — surface it so run_generation logs a real reason.
        raise RuntimeError("All generation batches failed: " + "; ".join(failures))

    return GeneratedQuestionSet(questions=questions)
