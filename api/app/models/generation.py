from typing import Any, Literal
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.phase2_contracts import DifficultyBand, QuestionType


class CategoryPlan(BaseModel):
    """How many questions to generate for one topic, per difficulty band."""
    id: UUID
    name: str = Field(min_length=1)
    easy: int = Field(default=0, ge=0, le=50)
    medium: int = Field(default=0, ge=0, le=50)
    hard: int = Field(default=0, ge=0, le=50)

    @property
    def total(self) -> int:
        return self.easy + self.medium + self.hard


class GenerateRequest(BaseModel):
    course_id: UUID
    # One plan per selected topic, each with per-band counts.
    plans: list[CategoryPlan] = Field(min_length=1)
    # Auto-gradable types only — an adaptive exam branches on instant scoring.
    types: list[QuestionType] = Field(default_factory=lambda: ["mcq", "short_answer"])
    instructions: str | None = None
    assessment_id: UUID | None = None

    @property
    def total_questions(self) -> int:
        return sum(plan.total for plan in self.plans)


# NOTE: every field below carries a default. The figure is delivered as a free-form
# JSON string (not a strict structured-output field), so Claude omits whatever a given
# `kind` doesn't need — the server must accept partial specs rather than reject them.
class FigurePoint(BaseModel):
    x: float = 0
    y: float = 0
    label: str = ""  # "" for an unlabeled vertex/point


class TreeNode(BaseModel):
    value: str = ""  # label shown inside the node, e.g. "10"
    left: int = -1  # index of the left child in `nodes`, or -1 if none
    right: int = -1  # index of the right child in `nodes`, or -1 if none
    # Optional n-ary children. If present, these are used instead of left/right,
    # allowing general trees as well as binary trees.
    children: list[int] = Field(default_factory=list)


class PiecewisePart(BaseModel):
    expression: str = ""  # expression in x, e.g. "x^2 - 1"
    x_min: float = 0
    x_max: float = 0
    include_start: bool = True
    include_end: bool = True


# One primitive in a scene, positioned in LOGICAL coordinates (the server maps
# them to pixels). Composing these covers most STEM figures. The original numeric
# fields are kept for backward compatibility; richer primitives use the optional
# expression/pieces/rows/w/h/directed fields.
class FigureElement(BaseModel):
    type: Literal[
        "point", "segment", "ray", "arrow", "circle", "polygon", "text", "func",
        "angle", "right_angle", "expr", "piecewise", "inequality", "table", "matrix",
        "node", "edge",
    ] = "point"
    x: float = 0  # point/text/circle-center/arrow|segment|ray-start
    y: float = 0
    x2: float = 0  # segment/arrow/ray end (ray extends past this toward the border)
    y2: float = 0
    r: float = 0  # circle radius (logical units)
    func_kind: Literal["none", "parabola", "line", "exp", "sin"] = "none"
    a: float = 0  # func coefficients (parabola: a x^2+b x+c; line: a x+b; exp: a b^x+c; sin: a sin(b x+c))
    b: float = 0
    c: float = 0
    # expr/inequality: math expression in x. Supports arithmetic plus common
    # functions like sin, cos, tan, sqrt, log, ln, exp, abs, floor, and ceil.
    expression: str = ""
    pieces: list[PiecewisePart] = Field(default_factory=list)
    relation: Literal["<", "<=", ">", ">="] = "<="
    # polygon vertices; ALSO the 3 points [armA, vertex, armB] for angle/right_angle
    vertices: list[FigurePoint] = Field(default_factory=list)
    closed: bool = False  # polygon closed?
    dashed: bool = False  # draw the segment/ray/func dashed (auxiliary lines, asymptotes)
    ticks: int = 0  # congruence tick marks on a segment (0 = none)
    label: str = ""
    # table/matrix: entries. x/y is the top-left logical coordinate.
    rows: list[list[str]] = Field(default_factory=list)
    w: float = 0  # table/matrix cell width in logical units, or node width
    h: float = 0  # table/matrix cell height in logical units, or node height
    # edge: draw an arrowhead when directed=true; label becomes the edge weight.
    directed: bool = False


# --- Circuits ---------------------------------------------------------------
class CircuitComponent(BaseModel):
    # Axis-aligned: drawn along the segment (x1,y1)->(x2,y2) in logical grid units.
    type: Literal[
        "wire", "resistor", "capacitor", "inductor", "battery", "source",
        "switch", "ground", "lamp",
    ] = "wire"
    x1: float = 0
    y1: float = 0
    x2: float = 0
    y2: float = 0
    label: str = ""  # e.g. "R1 = 10Ω", "5V"


# --- Chemistry (Lewis / skeletal structures) --------------------------------
class Atom(BaseModel):
    element: str = "C"  # "C", "O", "H", ...
    x: float = 0
    y: float = 0
    charge: str = ""  # "", "+", "-", "2+", ...


class Bond(BaseModel):
    a: int = 0  # index into `atoms`
    b: int = 0
    order: int = 1  # 1 single, 2 double, 3 triple


# --- Statics (beams) --------------------------------------------------------
class Support(BaseModel):
    position: float = 0  # along the beam, 0..beam_length
    type: Literal["pin", "roller", "fixed"] = "pin"


class Load(BaseModel):
    position: float = 0
    kind: Literal["point", "distributed", "moment"] = "point"
    end: float = 0  # distributed load: end position (start = position)
    label: str = ""


# Claude describes a figure as DATA; the server renders it deterministically, so
# geometry is always correct and consistently styled — never free-form SVG.
class FigureSpec(BaseModel):
    kind: Literal[
        "none", "scene", "tree", "circuit", "molecule", "punnett", "solid", "beam",
    ] = "none"
    # scene: draw `elements` in a logical window (optionally with coordinate axes)
    axes: bool = False
    x_min: float = -10
    x_max: float = 10
    y_min: float = -10
    y_max: float = 10
    elements: list[FigureElement] = Field(default_factory=list)
    # tree: draw `nodes` as an auto-laid-out binary tree (root is index 0)
    nodes: list[TreeNode] = Field(default_factory=list)
    # circuit: components on a logical grid (wires are components of type "wire")
    components: list[CircuitComponent] = Field(default_factory=list)
    # molecule: atoms + bonds (Lewis / skeletal structures)
    atoms: list[Atom] = Field(default_factory=list)
    bonds: list[Bond] = Field(default_factory=list)
    # punnett square: allele headers + genotype cells (row-major, len = |top|*|side|)
    punnett_top: list[str] = Field(default_factory=list)
    punnett_side: list[str] = Field(default_factory=list)
    punnett_cells: list[str] = Field(default_factory=list)
    # solid: a 3D solid drawn in oblique projection, with size sw x sh x sd
    solid_kind: Literal[
        "none", "cube", "prism", "cylinder", "cone", "sphere", "pyramid"
    ] = "none"
    sw: float = 0
    sh: float = 0
    sd: float = 0
    solid_labels: list[str] = Field(default_factory=list)
    # beam (statics): a horizontal beam with supports + loads
    beam_length: float = 0
    supports: list[Support] = Field(default_factory=list)
    loads: list[Load] = Field(default_factory=list)


# What Claude fills in (the content). IDs/provenance/status are added on persist.
# No min_length here: structured outputs don't always enforce it, and a single
# empty field shouldn't fail a whole batch — to_contract_question fills fallbacks.
class QuestionDraft(BaseModel):
    question_type: QuestionType
    topic: str  # should equal one of the requested topic names
    difficulty: DifficultyBand
    learning_objective: str
    prompt: str
    options: list[str]
    answer: str
    explanation: str
    rubric: list[str]
    # A figure, described as a JSON STRING matching FigureSpec ("" = no figure).
    # Kept as a plain string — not a nested typed field — so the structured-output
    # grammar stays small (the full FigureSpec schema is too large to compile as a
    # strict tool). The server validates it into FigureSpec and renders it.
    figure_spec_json: str = ""


class GeneratedQuestionSet(BaseModel):
    questions: list[QuestionDraft]


class GenerateResponse(BaseModel):
    course_id: UUID
    count: int
    # Each item is a phase2.generated_question.v1 contract object.
    questions: list[dict[str, Any]]


class RegenerateRequest(BaseModel):
    question_id: UUID
    instructions: str | None = None


class ApplyQuestionRequest(BaseModel):
    question_id: UUID
    question_type: QuestionType
    topic: str = Field(min_length=1)
    difficulty: DifficultyBand
    prompt: str
    options: list[str]
    answer: str
    explanation: str
    rubric: list[str]
    learning_objective: str
    figure_svg: str = ""
