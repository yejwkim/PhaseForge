from typing import Any

from app.models.generation import FigureElement, FigureSpec, PiecewisePart, TreeNode
from app.services.figures import render_figure


def element(kind: str, **overrides: Any) -> FigureElement:
    data: dict[str, Any] = {
        "type": kind,
        "x": 0,
        "y": 0,
        "x2": 0,
        "y2": 0,
        "r": 0,
        "func_kind": "none",
        "a": 0,
        "b": 0,
        "c": 0,
        "vertices": [],
        "closed": False,
        "dashed": False,
        "ticks": 0,
        "label": "",
    }
    data.update(overrides)
    return FigureElement.model_validate(data)


def scene(*elements: FigureElement) -> FigureSpec:
    return FigureSpec(
        kind="scene",
        axes=True,
        x_min=-5,
        x_max=5,
        y_min=-5,
        y_max=5,
        elements=list(elements),
        nodes=[],
    )


def test_renders_expression_and_piecewise_curves() -> None:
    svg = render_figure(
        scene(
            element("expr", expression="log(x + 6) + sin(x)"),
            element(
                "piecewise",
                pieces=[
                    PiecewisePart(expression="-x", x_min=-4, x_max=0, include_end=False),
                    PiecewisePart(expression="x^2 / 2", x_min=0, x_max=3),
                ],
            ),
        )
    )

    assert svg.startswith("<svg")
    assert svg.count("<path") >= 3
    assert 'fill="white" stroke="#2563eb"' in svg


def test_renders_shaded_inequality() -> None:
    svg = render_figure(scene(element("inequality", expression="x^3 - x", relation=">")))

    assert "<polygon" in svg
    assert 'stroke-dasharray="6 4"' in svg


def test_renders_tables_matrices_and_weighted_graphs() -> None:
    svg = render_figure(
        scene(
            element("table", x=-4, y=4, rows=[["x", "f(x)"], ["1", "3"]], w=1, h=0.5),
            element("matrix", x=1, y=4, rows=[["1", "0"], ["0", "1"]], w=0.8, h=0.5),
            element("edge", x=-2, y=-2, x2=2, y2=-2, label="7", directed=True),
            element("node", x=-2, y=-2, label="A", r=0.4),
            element("node", x=2, y=-2, label="B", r=0.4),
        )
    )

    assert "f(x)" in svg
    assert ">7</text>" in svg
    assert 'marker-end="url(#ah)"' in svg
    assert ">A</text>" in svg


def test_renders_multiway_tree() -> None:
    svg = render_figure(
        FigureSpec(
            kind="tree",
            axes=False,
            x_min=0,
            x_max=0,
            y_min=0,
            y_max=0,
            elements=[],
            nodes=[
                TreeNode(value="root", left=-1, right=-1, children=[1, 2, 3]),
                TreeNode(value="a", left=-1, right=-1),
                TreeNode(value="b", left=-1, right=-1),
                TreeNode(value="c", left=-1, right=-1),
            ],
        )
    )

    assert "root" in svg
    assert svg.count("<line") == 3
