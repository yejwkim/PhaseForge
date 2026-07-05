"""Render a FigureSpec (data) into a correct, clean SVG on the server.

Claude supplies only the *data* — a scene of geometric primitives in a logical
coordinate space (or a tree). All coordinate math and drawing happen here, so
figures are always structurally accurate and consistently styled, unlike
free-form SVG. Primitives compose into most STEM figures: function graphs,
geometry, vectors / free-body diagrams, number lines, trees, and so on.
"""

import ast
import math
from typing import Callable

from app.models.generation import (
    Atom,
    Bond,
    CircuitComponent,
    FigureElement,
    FigureSpec,
    Load,
    PiecewisePart,
    Support,
    TreeNode,
)

_W = 460
_H = 460
_PAD = 34
_GRID = "#e5e7eb"
_AXIS = "#111827"
_TICK = "#374151"
_STROKE = "#334155"
_CURVE = "#2563eb"
_POINT = "#dc2626"
_ARROW = "#111827"
_FILL = "#dbeafe"
_NODE_FILL = "#ffffff"
_NODE_STROKE = "#059669"
_NODE_TEXT = "#065f46"
_EDGE = "#94a3b8"
_SHADE = "#60a5fa"


def _fmt(n: float) -> str:
    return str(int(round(n))) if abs(n - round(n)) < 1e-9 else f"{n:g}"


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _ticks(lo: float, hi: float) -> list[float]:
    step = max(1, round((hi - lo) / 10))
    v = math.ceil(lo / step) * step
    out: list[float] = []
    while v <= hi + 1e-9:
        out.append(float(v))
        v += step
    return out


_FUNCS: dict[str, Callable[..., float]] = {
    "abs": abs,
    "acos": math.acos,
    "asin": math.asin,
    "atan": math.atan,
    "ceil": math.ceil,
    "cos": math.cos,
    "exp": math.exp,
    "floor": math.floor,
    "ln": math.log,
    "log": math.log,
    "log10": math.log10,
    "max": max,
    "min": min,
    "pow": pow,
    "sin": math.sin,
    "sqrt": math.sqrt,
    "tan": math.tan,
}
_CONSTS = {"e": math.e, "pi": math.pi}


def _eval_expr(expr: str, x: float) -> float:
    """Safely evaluate a math expression in x without Python eval."""
    normalized = expr.replace("^", "**").replace("−", "-").strip()
    if not normalized:
        raise ValueError("empty expression")
    tree = ast.parse(normalized, mode="eval")

    def walk(node: ast.AST) -> float:
        if isinstance(node, ast.Expression):
            return walk(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, int | float):
            return float(node.value)
        if isinstance(node, ast.Name):
            if node.id == "x":
                return x
            if node.id in _CONSTS:
                return _CONSTS[node.id]
            raise ValueError(f"unknown name {node.id}")
        if isinstance(node, ast.UnaryOp):
            value = walk(node.operand)
            if isinstance(node.op, ast.UAdd):
                return value
            if isinstance(node.op, ast.USub):
                return -value
            raise ValueError("unsupported unary operator")
        if isinstance(node, ast.BinOp):
            left, right = walk(node.left), walk(node.right)
            if isinstance(node.op, ast.Add):
                return left + right
            if isinstance(node.op, ast.Sub):
                return left - right
            if isinstance(node.op, ast.Mult):
                return left * right
            if isinstance(node.op, ast.Div):
                return left / right
            if isinstance(node.op, ast.Pow):
                return left**right
            if isinstance(node.op, ast.Mod):
                return left % right
            raise ValueError("unsupported binary operator")
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            fn = _FUNCS.get(node.func.id)
            if not fn or node.keywords:
                raise ValueError("unsupported function")
            return float(fn(*(walk(arg) for arg in node.args)))
        raise ValueError("unsupported expression")

    result = walk(tree)
    if not math.isfinite(result):
        raise ValueError("non-finite expression result")
    return result


def _eval_func(el: FigureElement, x: float) -> float:
    if el.func_kind == "none" and el.expression:
        return _eval_expr(el.expression, x)
    if el.func_kind == "parabola":
        return el.a * x * x + el.b * x + el.c
    if el.func_kind == "line":
        return el.a * x + el.b
    if el.func_kind == "exp":
        return el.a * (el.b**x) + el.c
    if el.func_kind == "sin":
        return el.a * math.sin(el.b * x + el.c)
    raise ValueError("no func")


def _sample_points(
    f: Callable[[float], float],
    x_min: float,
    x_max: float,
    y_min: float,
    y_max: float,
    count: int = 201,
) -> list[tuple[float, float]]:
    span_y = y_max - y_min
    lo, hi = y_min - span_y, y_max + span_y
    out: list[tuple[float, float]] = []
    prev_y: float | None = None
    for i in range(count):
        x = x_min + (x_max - x_min) * i / (count - 1)
        try:
            y = f(x)
        except Exception:
            prev_y = None
            continue
        if not (lo <= y <= hi):
            prev_y = None
            continue
        if prev_y is not None and abs(y - prev_y) > span_y * 1.25:
            out.append((math.nan, math.nan))
        out.append((x, y))
        prev_y = y
    return out


def _sample_path(
    f: Callable[[float], float],
    x_min: float,
    x_max: float,
    y_min: float,
    y_max: float,
    sx: Callable[[float], float],
    sy: Callable[[float], float],
) -> str:
    span_y = y_max - y_min
    lo, hi = y_min - span_y, y_max + span_y
    d: list[str] = []
    drawing = False
    prev_y: float | None = None
    for i in range(201):
        x = x_min + (x_max - x_min) * i / 200
        try:
            y = f(x)
        except Exception:
            drawing = False
            prev_y = None
            continue
        if not (lo <= y <= hi):
            drawing = False
            prev_y = None
            continue
        if prev_y is not None and abs(y - prev_y) > span_y * 1.25:
            drawing = False
        d.append(f"{'L' if drawing else 'M'}{sx(x):.1f} {sy(y):.1f}")
        drawing = True
        prev_y = y
    return " ".join(d)


def _render_scene(spec: FigureSpec) -> str:
    x_min, x_max = spec.x_min, spec.x_max
    y_min, y_max = spec.y_min, spec.y_max
    if x_max <= x_min:
        x_min, x_max = -10.0, 10.0
    if y_max <= y_min:
        y_min, y_max = -10.0, 10.0

    def sx(x: float) -> float:
        return _PAD + (x - x_min) / (x_max - x_min) * (_W - 2 * _PAD)

    def sy(y: float) -> float:
        return (_H - _PAD) - (y - y_min) / (y_max - y_min) * (_H - 2 * _PAD)

    scale_x = (_W - 2 * _PAD) / (x_max - x_min)
    scale_y = (_H - 2 * _PAD) / (y_max - y_min)

    p: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {_W} {_H}" '
        f'width="{_W}" height="{_H}" font-family="system-ui, sans-serif">',
        f'<rect width="{_W}" height="{_H}" fill="white"/>',
        f'<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" '
        f'markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" '
        f'fill="{_ARROW}"/></marker></defs>',
    ]

    if spec.axes:
        xticks, yticks = _ticks(x_min, x_max), _ticks(y_min, y_max)
        for gx in xticks:
            p.append(
                f'<line x1="{sx(gx):.1f}" y1="{sy(y_min):.1f}" x2="{sx(gx):.1f}" '
                f'y2="{sy(y_max):.1f}" stroke="{_GRID}"/>'
            )
        for gy in yticks:
            p.append(
                f'<line x1="{sx(x_min):.1f}" y1="{sy(gy):.1f}" x2="{sx(x_max):.1f}" '
                f'y2="{sy(gy):.1f}" stroke="{_GRID}"/>'
            )
        show_y = x_min <= 0 <= x_max
        show_x = y_min <= 0 <= y_max
        if show_y:
            p.append(
                f'<line x1="{sx(0):.1f}" y1="{sy(y_min):.1f}" x2="{sx(0):.1f}" '
                f'y2="{sy(y_max):.1f}" stroke="{_AXIS}" stroke-width="1.5"/>'
            )
        if show_x:
            p.append(
                f'<line x1="{sx(x_min):.1f}" y1="{sy(0):.1f}" x2="{sx(x_max):.1f}" '
                f'y2="{sy(0):.1f}" stroke="{_AXIS}" stroke-width="1.5"/>'
            )
        if show_x:
            for gx in xticks:
                if abs(gx) < 1e-9:
                    continue
                p.append(
                    f'<text x="{sx(gx):.1f}" y="{sy(0) + 14:.1f}" font-size="11" '
                    f'fill="{_TICK}" text-anchor="middle">{_fmt(gx)}</text>'
                )
        if show_y:
            for gy in yticks:
                if abs(gy) < 1e-9:
                    continue
                p.append(
                    f'<text x="{sx(0) - 6:.1f}" y="{sy(gy) + 4:.1f}" font-size="11" '
                    f'fill="{_TICK}" text-anchor="end">{_fmt(gy)}</text>'
                )

    def dash(el: FigureElement) -> str:
        return ' stroke-dasharray="6 4"' if el.dashed else ""

    def render_expr(expression: str, dashed: bool = False) -> None:
        d = _sample_path(
            lambda x: _eval_expr(expression, x), x_min, x_max, y_min, y_max, sx, sy
        )
        if d:
            dash_attr = ' stroke-dasharray="6 4"' if dashed else ""
            p.append(
                f'<path d="{d}" fill="none" stroke="{_CURVE}" stroke-width="2.5"{dash_attr}/>'
            )

    def render_piece(part: PiecewisePart, dashed: bool = False) -> None:
        lo, hi = max(x_min, part.x_min), min(x_max, part.x_max)
        if hi <= lo:
            return
        d = _sample_path(
            lambda x: _eval_expr(part.expression, x), lo, hi, y_min, y_max, sx, sy
        )
        if not d:
            return
        dash_attr = ' stroke-dasharray="6 4"' if dashed else ""
        p.append(f'<path d="{d}" fill="none" stroke="{_CURVE}" stroke-width="2.5"{dash_attr}/>')
        for endpoint, included in ((part.x_min, part.include_start), (part.x_max, part.include_end)):
            if x_min <= endpoint <= x_max:
                try:
                    ey = _eval_expr(part.expression, endpoint)
                except Exception:
                    continue
                if y_min <= ey <= y_max:
                    fill = _CURVE if included else "white"
                    p.append(
                        f'<circle cx="{sx(endpoint):.1f}" cy="{sy(ey):.1f}" r="4" '
                        f'fill="{fill}" stroke="{_CURVE}" stroke-width="2"/>'
                    )

    def render_inequality(el: FigureElement) -> None:
        if not el.expression:
            return
        points = _sample_points(
            lambda x: _eval_expr(el.expression, x), x_min, x_max, y_min, y_max
        )
        segments: list[list[tuple[float, float]]] = [[]]
        for pt in points:
            if math.isnan(pt[0]):
                if segments[-1]:
                    segments.append([])
                continue
            segments[-1].append(pt)
        shade_above = el.relation in (">", ">=")
        for segment in [s for s in segments if len(s) >= 2]:
            boundary = [(x, min(max(y, y_min), y_max)) for x, y in segment]
            if shade_above:
                poly = [(boundary[0][0], y_max), (boundary[-1][0], y_max)] + list(reversed(boundary))
            else:
                poly = [(boundary[0][0], y_min), (boundary[-1][0], y_min)] + list(reversed(boundary))
            pts = " ".join(f"{sx(px):.1f},{sy(py):.1f}" for px, py in poly)
            p.append(f'<polygon points="{pts}" fill="{_SHADE}" fill-opacity="0.18"/>')
        render_expr(el.expression, dashed=el.relation in ("<", ">"))

    def render_table(el: FigureElement, matrix: bool = False) -> None:
        if not el.rows:
            return
        row_count = len(el.rows)
        col_count = max((len(row) for row in el.rows), default=0)
        if col_count == 0:
            return
        x0, y0 = sx(el.x), sy(el.y)
        cell_w = el.w * scale_x if el.w > 0 else 64
        cell_h = el.h * scale_y if el.h > 0 else 34
        width, height = col_count * cell_w, row_count * cell_h
        if matrix:
            p.append(
                f'<path d="M{x0 + 8:.1f} {y0:.1f} H{x0:.1f} V{y0 + height:.1f} '
                f'H{x0 + 8:.1f} M{x0 + width - 8:.1f} {y0:.1f} H{x0 + width:.1f} '
                f'V{y0 + height:.1f} H{x0 + width - 8:.1f}" fill="none" '
                f'stroke="{_STROKE}" stroke-width="2"/>'
            )
        else:
            p.append(
                f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{width:.1f}" height="{height:.1f}" '
                f'fill="white" stroke="{_STROKE}" stroke-width="1.5"/>'
            )
            for i in range(1, row_count):
                yy = y0 + i * cell_h
                p.append(
                    f'<line x1="{x0:.1f}" y1="{yy:.1f}" x2="{x0 + width:.1f}" y2="{yy:.1f}" '
                    f'stroke="{_GRID}" stroke-width="1"/>'
                )
            for j in range(1, col_count):
                xx = x0 + j * cell_w
                p.append(
                    f'<line x1="{xx:.1f}" y1="{y0:.1f}" x2="{xx:.1f}" y2="{y0 + height:.1f}" '
                    f'stroke="{_GRID}" stroke-width="1"/>'
                )
        for i, row in enumerate(el.rows):
            for j in range(col_count):
                text = row[j] if j < len(row) else ""
                if text:
                    p.append(
                        f'<text x="{x0 + (j + 0.5) * cell_w:.1f}" '
                        f'y="{y0 + (i + 0.5) * cell_h + 4:.1f}" font-size="13" '
                        f'fill="{_AXIS}" text-anchor="middle">{_esc(text)}</text>'
                    )

    for el in spec.elements:
        if el.type == "func" and el.func_kind != "none":
            d = _sample_path(lambda x: _eval_func(el, x), x_min, x_max, y_min, y_max, sx, sy)
            if d:
                p.append(
                    f'<path d="{d}" fill="none" stroke="{_CURVE}" stroke-width="2.5"{dash(el)}/>'
                )
        elif el.type == "expr":
            render_expr(el.expression, dashed=el.dashed)
        elif el.type == "piecewise":
            if el.pieces:
                for part in el.pieces:
                    render_piece(part, dashed=el.dashed)
            elif el.expression:
                render_expr(el.expression, dashed=el.dashed)
        elif el.type == "inequality":
            render_inequality(el)
        elif el.type == "segment":
            x1, y1, x2v, y2v = sx(el.x), sy(el.y), sx(el.x2), sy(el.y2)
            p.append(
                f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2v:.1f}" y2="{y2v:.1f}" '
                f'stroke="{_STROKE}" stroke-width="2"{dash(el)}/>'
            )
            if el.ticks > 0:  # congruence marks at the midpoint
                length = math.hypot(x2v - x1, y2v - y1) or 1
                ux, uy = (x2v - x1) / length, (y2v - y1) / length
                px, py = -uy, ux
                for j in range(el.ticks):
                    off = (j - (el.ticks - 1) / 2) * 5
                    bx, by = (x1 + x2v) / 2 + ux * off, (y1 + y2v) / 2 + uy * off
                    p.append(
                        f'<line x1="{bx - px * 5:.1f}" y1="{by - py * 5:.1f}" '
                        f'x2="{bx + px * 5:.1f}" y2="{by + py * 5:.1f}" '
                        f'stroke="{_STROKE}" stroke-width="1.5"/>'
                    )
        elif el.type == "ray":
            dx, dy = el.x2 - el.x, el.y2 - el.y
            cand: list[float] = []
            if dx > 1e-9:
                cand.append((x_max - el.x) / dx)
            elif dx < -1e-9:
                cand.append((x_min - el.x) / dx)
            if dy > 1e-9:
                cand.append((y_max - el.y) / dy)
            elif dy < -1e-9:
                cand.append((y_min - el.y) / dy)
            t = min([c for c in cand if c > 1e-9], default=1.0)
            p.append(
                f'<line x1="{sx(el.x):.1f}" y1="{sy(el.y):.1f}" x2="{sx(el.x + dx * t):.1f}" '
                f'y2="{sy(el.y + dy * t):.1f}" stroke="{_STROKE}" stroke-width="2"{dash(el)}/>'
            )
        elif el.type in ("angle", "right_angle") and len(el.vertices) >= 3:
            vx, vy = sx(el.vertices[1].x), sy(el.vertices[1].y)
            a1 = math.atan2(sy(el.vertices[0].y) - vy, sx(el.vertices[0].x) - vx)
            a2 = math.atan2(sy(el.vertices[2].y) - vy, sx(el.vertices[2].x) - vx)
            if el.type == "right_angle":
                s = 14
                p1 = (vx + math.cos(a1) * s, vy + math.sin(a1) * s)
                p3 = (vx + math.cos(a2) * s, vy + math.sin(a2) * s)
                p2 = (p1[0] + math.cos(a2) * s, p1[1] + math.sin(a2) * s)
                p.append(
                    f'<path d="M{p1[0]:.1f} {p1[1]:.1f} L{p2[0]:.1f} {p2[1]:.1f} '
                    f'L{p3[0]:.1f} {p3[1]:.1f}" fill="none" stroke="{_STROKE}" stroke-width="1.5"/>'
                )
            else:
                d = a2 - a1
                while d <= -math.pi:
                    d += 2 * math.pi
                while d > math.pi:
                    d -= 2 * math.pi
                sweep = 1 if d > 0 else 0
                rr = 22
                p.append(
                    f'<path d="M{vx + rr * math.cos(a1):.1f} {vy + rr * math.sin(a1):.1f} '
                    f'A{rr} {rr} 0 0 {sweep} {vx + rr * math.cos(a2):.1f} '
                    f'{vy + rr * math.sin(a2):.1f}" fill="none" stroke="{_STROKE}" stroke-width="1.5"/>'
                )
                if el.label:
                    mid = a1 + d / 2
                    p.append(
                        f'<text x="{vx + (rr + 12) * math.cos(mid):.1f}" '
                        f'y="{vy + (rr + 12) * math.sin(mid) + 4:.1f}" font-size="12" '
                        f'fill="{_STROKE}" text-anchor="middle">{_esc(el.label)}</text>'
                    )
        elif el.type == "arrow":
            p.append(
                f'<line x1="{sx(el.x):.1f}" y1="{sy(el.y):.1f}" x2="{sx(el.x2):.1f}" '
                f'y2="{sy(el.y2):.1f}" stroke="{_ARROW}" stroke-width="2" marker-end="url(#ah)"/>'
            )
            if el.label:
                p.append(
                    f'<text x="{sx(el.x2) + 6:.1f}" y="{sy(el.y2) - 6:.1f}" font-size="12" '
                    f'fill="{_ARROW}">{_esc(el.label)}</text>'
                )
        elif el.type == "edge":
            marker = ' marker-end="url(#ah)"' if el.directed else ""
            p.append(
                f'<line x1="{sx(el.x):.1f}" y1="{sy(el.y):.1f}" x2="{sx(el.x2):.1f}" '
                f'y2="{sy(el.y2):.1f}" stroke="{_EDGE}" stroke-width="2"{dash(el)}{marker}/>'
            )
            if el.label:
                p.append(
                    f'<text x="{(sx(el.x) + sx(el.x2)) / 2:.1f}" '
                    f'y="{(sy(el.y) + sy(el.y2)) / 2 - 6:.1f}" font-size="12" '
                    f'fill="{_AXIS}" text-anchor="middle">{_esc(el.label)}</text>'
                )
        elif el.type == "circle":
            p.append(
                f'<ellipse cx="{sx(el.x):.1f}" cy="{sy(el.y):.1f}" rx="{el.r * scale_x:.1f}" '
                f'ry="{el.r * scale_y:.1f}" fill="none" stroke="{_STROKE}" stroke-width="2"/>'
            )
            if el.label:
                p.append(
                    f'<text x="{sx(el.x):.1f}" y="{sy(el.y) + 4:.1f}" font-size="12" '
                    f'fill="{_STROKE}" text-anchor="middle">{_esc(el.label)}</text>'
                )
        elif el.type == "polygon":
            if el.vertices:
                pts = " ".join(f"{'L' if i else 'M'}{sx(v.x):.1f} {sy(v.y):.1f}" for i, v in enumerate(el.vertices))
                d = pts + (" Z" if el.closed else "")
                fill = _FILL if el.closed else "none"
                p.append(f'<path d="{d}" fill="{fill}" fill-opacity="0.5" stroke="{_STROKE}" stroke-width="2"/>')
                for v in el.vertices:
                    if v.label:
                        p.append(
                            f'<text x="{sx(v.x) + 6:.1f}" y="{sy(v.y) - 6:.1f}" font-size="11" '
                            f'fill="{_STROKE}">{_esc(v.label)}</text>'
                        )
        elif el.type == "node":
            rx = el.w * scale_x / 2 if el.w > 0 else (el.r * scale_x if el.r > 0 else 18)
            ry = el.h * scale_y / 2 if el.h > 0 else (el.r * scale_y if el.r > 0 else 18)
            p.append(
                f'<ellipse cx="{sx(el.x):.1f}" cy="{sy(el.y):.1f}" rx="{rx:.1f}" ry="{ry:.1f}" '
                f'fill="{_NODE_FILL}" stroke="{_NODE_STROKE}" stroke-width="2"/>'
            )
            if el.label:
                p.append(
                    f'<text x="{sx(el.x):.1f}" y="{sy(el.y) + 4:.1f}" font-size="13" '
                    f'fill="{_NODE_TEXT}" text-anchor="middle">{_esc(el.label)}</text>'
                )
        elif el.type == "point":
            p.append(f'<circle cx="{sx(el.x):.1f}" cy="{sy(el.y):.1f}" r="4" fill="{_POINT}"/>')
            if el.label:
                p.append(
                    f'<text x="{sx(el.x) + 8:.1f}" y="{sy(el.y) - 8:.1f}" font-size="12" '
                    f'fill="{_POINT}">{_esc(el.label)}</text>'
                )
        elif el.type == "text":
            if el.label:
                p.append(
                    f'<text x="{sx(el.x):.1f}" y="{sy(el.y):.1f}" font-size="12" '
                    f'fill="{_AXIS}" text-anchor="middle">{_esc(el.label)}</text>'
                )
        elif el.type == "table":
            render_table(el, matrix=False)
        elif el.type == "matrix":
            render_table(el, matrix=True)

    p.append("</svg>")
    return "".join(p)


def _render_tree(nodes: list[TreeNode]) -> str:
    """Draw a rooted tree as circles-with-edges (root at top).

    Binary trees can use left/right. General trees can set children=[...].
    """
    n = len(nodes)
    if n == 0:
        return ""

    pos: dict[int, tuple[float, int]] = {}
    counter = 0.0
    visited: set[int] = set()

    def children_for(i: int) -> list[int]:
        raw = nodes[i].children or [nodes[i].left, nodes[i].right]
        return [child for child in raw if 0 <= child < n]

    def assign(i: int, depth: int) -> None:
        nonlocal counter
        if not (0 <= i < n) or i in visited:
            return
        visited.add(i)
        children = [child for child in children_for(i) if child not in visited]
        if not children:
            pos[i] = (counter, depth)
            counter += 1
            return
        for child in children:
            assign(child, depth + 1)
        child_slots = [pos[child][0] for child in children if child in pos]
        if child_slots:
            pos[i] = (sum(child_slots) / len(child_slots), depth)
        else:
            pos[i] = (counter, depth)
            counter += 1

    assign(0, 0)
    if not pos:
        return ""

    r, x_sp, y_sp, margin = 17, 56, 74, 26
    max_slot = max(s for s, _ in pos.values())
    max_depth = max(d for _, d in pos.values())
    w = margin * 2 + max_slot * x_sp + r * 2
    h = margin * 2 + max_depth * y_sp + r * 2

    def nx(slot: float) -> float:
        return margin + r + slot * x_sp

    def ny(depth: int) -> float:
        return margin + r + depth * y_sp

    p: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
        f'width="{w}" height="{h}" font-family="system-ui, sans-serif">',
        f'<rect width="{w}" height="{h}" fill="white"/>',
    ]
    for i, (slot, depth) in pos.items():
        for child in children_for(i):
            if child in pos:
                cs, cd = pos[child]
                p.append(
                    f'<line x1="{nx(slot):.1f}" y1="{ny(depth):.1f}" x2="{nx(cs):.1f}" '
                    f'y2="{ny(cd):.1f}" stroke="{_EDGE}" stroke-width="1.5"/>'
                )
    for i, (slot, depth) in pos.items():
        cx, cy = nx(slot), ny(depth)
        p.append(
            f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="{_NODE_FILL}" '
            f'stroke="{_NODE_STROKE}" stroke-width="2"/>'
        )
        p.append(
            f'<text x="{cx:.1f}" y="{cy + 4:.1f}" font-size="13" fill="{_NODE_TEXT}" '
            f'text-anchor="middle">{_esc(nodes[i].value)}</text>'
        )
    p.append("</svg>")
    return "".join(p)


def _svg(w: float, h: float, body: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" '
        f'width="{w:.0f}" height="{h:.0f}" font-family="system-ui, sans-serif">'
        f'<rect width="{w:.0f}" height="{h:.0f}" fill="white"/>{body}</svg>'
    )


def _bounds(pts: list[tuple[float, float]], pad: float, scale: float, margin: float):
    xmin = min(x for x, _ in pts)
    xmax = max(x for x, _ in pts)
    ymin = min(y for _, y in pts)
    ymax = max(y for _, y in pts)
    w = (xmax - xmin) * scale + 2 * margin
    h = (ymax - ymin) * scale + 2 * margin

    def px(x: float) -> float:
        return margin + (x - xmin) * scale

    def py(y: float) -> float:
        return h - margin - (y - ymin) * scale  # flip so +y is up

    return w, h, px, py


# --- Circuits ---------------------------------------------------------------
def _render_circuit(comps: list[CircuitComponent]) -> str:
    if not comps:
        return ""
    pts = [(c.x1, c.y1) for c in comps] + [(c.x2, c.y2) for c in comps]
    w, h, px, py = _bounds(pts, 0, 70, 44)
    out: list[str] = []

    def ln(p1: tuple[float, float], p2: tuple[float, float], wd: float = 2) -> str:
        return (
            f'<line x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" x2="{p2[0]:.1f}" y2="{p2[1]:.1f}" '
            f'stroke="{_STROKE}" stroke-width="{wd}"/>'
        )

    for c in comps:
        ax, ay, bx, by = px(c.x1), py(c.y1), px(c.x2), py(c.y2)
        dx, dy = bx - ax, by - ay
        length = math.hypot(dx, dy) or 1
        ux, uy = dx / length, dy / length
        nx, ny = -uy, ux
        cx, cy = (ax + bx) / 2, (ay + by) / 2
        s = 28  # symbol span

        def P(al: float, pe: float) -> tuple[float, float]:
            return (cx + ux * al + nx * pe, cy + uy * al + ny * pe)

        if c.type == "wire":
            out.append(ln((ax, ay), (bx, by)))
        elif c.type == "ground":
            out.append(ln((ax, ay), (bx, by)))
            for i, wdt in enumerate((11, 7, 3)):
                gx, gy = bx + ux * i * 4, by + uy * i * 4
                out.append(ln((gx - nx * wdt, gy - ny * wdt), (gx + nx * wdt, gy + ny * wdt)))
        else:
            out.append(ln((ax, ay), P(-s / 2, 0)))  # stubs
            out.append(ln(P(s / 2, 0), (bx, by)))
            if c.type == "resistor":
                zig = [P(-s / 2, 0)] + [P(-s / 2 + s * i / 6, 5 if i % 2 else -5) for i in range(1, 6)] + [P(s / 2, 0)]
                out.append(f'<polyline points="{" ".join(f"{p[0]:.1f},{p[1]:.1f}" for p in zig)}" fill="none" stroke="{_STROKE}" stroke-width="2"/>')
            elif c.type == "capacitor":
                out.append(ln(P(-4, 9), P(-4, -9)))
                out.append(ln(P(4, 9), P(4, -9)))
            elif c.type == "battery":
                out.append(ln(P(-4, 11), P(-4, -11)))
                out.append(ln(P(4, 6), P(4, -6), wd=3))
            elif c.type in ("source", "lamp"):
                out.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{s / 2:.1f}" fill="white" stroke="{_STROKE}" stroke-width="2"/>')
                if c.type == "source":
                    lp = P(6, 0)
                    out.append(f'<text x="{lp[0]:.1f}" y="{lp[1] - 4:.1f}" font-size="13" fill="{_STROKE}" text-anchor="middle">+</text>')
                else:
                    out.append(ln(P(-9, -9), P(9, 9), wd=1.5))
                    out.append(ln(P(-9, 9), P(9, -9), wd=1.5))
            elif c.type == "switch":
                p0, p1, blade = P(-s / 2, 0), P(s / 2, 0), P(s / 2 - 4, 10)
                out.append(f'<circle cx="{p0[0]:.1f}" cy="{p0[1]:.1f}" r="2.5" fill="{_STROKE}"/>')
                out.append(f'<circle cx="{p1[0]:.1f}" cy="{p1[1]:.1f}" r="2.5" fill="{_STROKE}"/>')
                out.append(ln(p0, blade))
            elif c.type == "inductor":
                start = P(-s / 2, 0)
                path = f'M{start[0]:.1f} {start[1]:.1f}'
                for i in range(4):
                    end = P(-s / 2 + (i + 1) * s / 4, 0)
                    path += f' A6 6 0 0 1 {end[0]:.1f} {end[1]:.1f}'
                out.append(f'<path d="{path}" fill="none" stroke="{_STROKE}" stroke-width="2"/>')
        if c.label:
            out.append(f'<text x="{cx + nx * 18:.1f}" y="{cy + ny * 18 + 4:.1f}" font-size="12" fill="{_AXIS}" text-anchor="middle">{_esc(c.label)}</text>')
    return _svg(w, h, "".join(out))


# --- Chemistry (Lewis / skeletal) -------------------------------------------
def _render_molecule(atoms: list[Atom], bonds: list[Bond]) -> str:
    if not atoms:
        return ""
    w, h, px, py = _bounds([(a.x, a.y) for a in atoms], 0, 70, 44)
    out: list[str] = []
    for bond in bonds:
        if not (0 <= bond.a < len(atoms) and 0 <= bond.b < len(atoms)):
            continue
        ax, ay = px(atoms[bond.a].x), py(atoms[bond.a].y)
        bx, by = px(atoms[bond.b].x), py(atoms[bond.b].y)
        dx, dy = bx - ax, by - ay
        length = math.hypot(dx, dy) or 1
        ux, uy = dx / length, dy / length
        nx, ny = -uy, ux
        ax, ay, bx, by = ax + ux * 12, ay + uy * 12, bx - ux * 12, by - uy * 12  # gap for labels
        offs = {1: [0.0], 2: [-3.0, 3.0], 3: [-5.0, 0.0, 5.0]}.get(bond.order, [0.0])
        for o in offs:
            out.append(f'<line x1="{ax + nx * o:.1f}" y1="{ay + ny * o:.1f}" x2="{bx + nx * o:.1f}" y2="{by + ny * o:.1f}" stroke="{_STROKE}" stroke-width="1.8"/>')
    for a in atoms:
        cx, cy = px(a.x), py(a.y)
        out.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="13" fill="white"/>')
        out.append(f'<text x="{cx:.1f}" y="{cy + 5:.1f}" font-size="15" fill="{_AXIS}" text-anchor="middle">{_esc(a.element)}</text>')
        if a.charge:
            out.append(f'<text x="{cx + 12:.1f}" y="{cy - 8:.1f}" font-size="11" fill="{_POINT}">{_esc(a.charge)}</text>')
    return _svg(w, h, "".join(out))


# --- Biology (Punnett square) -----------------------------------------------
def _render_punnett(top: list[str], side: list[str], cells: list[str]) -> str:
    n, m = len(top), len(side)
    if n == 0 or m == 0:
        return ""
    cell, margin = 56, 20
    w = margin * 2 + (n + 1) * cell
    h = margin * 2 + (m + 1) * cell

    def cx(col: int) -> float:
        return margin + col * cell

    def cy(row: int) -> float:
        return margin + row * cell

    out: list[str] = []
    for j, t in enumerate(top):
        out.append(f'<rect x="{cx(j + 1):.0f}" y="{cy(0):.0f}" width="{cell}" height="{cell}" fill="#eef2ff" stroke="{_STROKE}"/>')
        out.append(f'<text x="{cx(j + 1) + cell / 2:.0f}" y="{cy(0) + cell / 2 + 5:.0f}" font-size="16" fill="{_AXIS}" text-anchor="middle">{_esc(t)}</text>')
    for i, sname in enumerate(side):
        out.append(f'<rect x="{cx(0):.0f}" y="{cy(i + 1):.0f}" width="{cell}" height="{cell}" fill="#eef2ff" stroke="{_STROKE}"/>')
        out.append(f'<text x="{cx(0) + cell / 2:.0f}" y="{cy(i + 1) + cell / 2 + 5:.0f}" font-size="16" fill="{_AXIS}" text-anchor="middle">{_esc(sname)}</text>')
    for i in range(m):
        for j in range(n):
            val = cells[i * n + j] if i * n + j < len(cells) else ""
            out.append(f'<rect x="{cx(j + 1):.0f}" y="{cy(i + 1):.0f}" width="{cell}" height="{cell}" fill="white" stroke="{_STROKE}"/>')
            out.append(f'<text x="{cx(j + 1) + cell / 2:.0f}" y="{cy(i + 1) + cell / 2 + 5:.0f}" font-size="15" fill="{_AXIS}" text-anchor="middle">{_esc(val)}</text>')
    return _svg(w, h, "".join(out))


# --- 3D solids (oblique projection) -----------------------------------------
def _render_solid(kind: str, sw: float, sh: float, sd: float, labels: list[str]) -> str:
    scale = 46.0
    sw, sh, sd = (sw or 2), (sh or 2), (sd or 2)
    dxp, dyp = 0.5 * scale, -0.35 * scale  # depth (z) offset per unit

    def pr(x: float, y: float, z: float) -> tuple[float, float]:
        return (60 + x * scale + z * dxp, 300 - y * scale + z * dyp)

    W = int(80 + sw * scale + sd * dxp)
    H = 340
    out: list[str] = []

    def line(p1, p2, dash=False):
        d = ' stroke-dasharray="5 4"' if dash else ""
        return f'<line x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" x2="{p2[0]:.1f}" y2="{p2[1]:.1f}" stroke="{_STROKE}" stroke-width="1.8"{d}/>'

    if kind in ("cube", "prism", "pyramid"):
        # base corners at y=0, top at y=sh
        b = [pr(0, 0, 0), pr(sw, 0, 0), pr(sw, 0, sd), pr(0, 0, sd)]
        if kind == "pyramid":
            apex = pr(sw / 2, sh, sd / 2)
            out.append(f'<polygon points="{b[0][0]:.1f},{b[0][1]:.1f} {b[1][0]:.1f},{b[1][1]:.1f} {b[2][0]:.1f},{b[2][1]:.1f} {b[3][0]:.1f},{b[3][1]:.1f}" fill="{_FILL}" fill-opacity="0.4" stroke="{_STROKE}" stroke-width="1.8"/>')
            for i in (0, 1, 2, 3):
                out.append(line(b[i], apex, dash=(i == 3)))
        else:
            t = [pr(0, sh, 0), pr(sw, sh, 0), pr(sw, sh, sd), pr(0, sh, sd)]
            faces = [(b[0], b[1], t[1], t[0]), (b[1], b[2], t[2], t[1]), (t[0], t[1], t[2], t[3])]
            for f in faces:
                out.append(f'<polygon points="{" ".join(f"{p[0]:.1f},{p[1]:.1f}" for p in f)}" fill="{_FILL}" fill-opacity="0.35" stroke="{_STROKE}" stroke-width="1.8"/>')
            out.append(line(b[3], b[0], dash=True))
            out.append(line(b[3], b[2], dash=True))
            out.append(line(b[3], t[3], dash=True))
    elif kind == "cylinder":
        rx, ry = sw / 2 * scale, sw / 4 * scale * 0.5 + 8
        cxb = pr(sw / 2, 0, sd / 2)
        cxt = pr(sw / 2, sh, sd / 2)
        out.append(f'<line x1="{cxb[0] - rx:.1f}" y1="{cxb[1]:.1f}" x2="{cxt[0] - rx:.1f}" y2="{cxt[1]:.1f}" stroke="{_STROKE}" stroke-width="1.8"/>')
        out.append(f'<line x1="{cxb[0] + rx:.1f}" y1="{cxb[1]:.1f}" x2="{cxt[0] + rx:.1f}" y2="{cxt[1]:.1f}" stroke="{_STROKE}" stroke-width="1.8"/>')
        out.append(f'<ellipse cx="{cxb[0]:.1f}" cy="{cxb[1]:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="none" stroke="{_STROKE}" stroke-width="1.8" stroke-dasharray="5 4"/>')
        out.append(f'<ellipse cx="{cxt[0]:.1f}" cy="{cxt[1]:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="{_FILL}" fill-opacity="0.35" stroke="{_STROKE}" stroke-width="1.8"/>')
    elif kind == "cone":
        rx, ry = sw / 2 * scale, sw / 4 * scale * 0.5 + 8
        base = pr(sw / 2, 0, sd / 2)
        apex = pr(sw / 2, sh, sd / 2)
        out.append(f'<ellipse cx="{base[0]:.1f}" cy="{base[1]:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="{_FILL}" fill-opacity="0.35" stroke="{_STROKE}" stroke-width="1.8"/>')
        out.append(line((base[0] - rx, base[1]), apex))
        out.append(line((base[0] + rx, base[1]), apex))
    elif kind == "sphere":
        r = sw / 2 * scale
        c = pr(sw / 2, sw / 2, sd / 2)
        out.append(f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="{r:.1f}" fill="{_FILL}" fill-opacity="0.3" stroke="{_STROKE}" stroke-width="1.8"/>')
        out.append(f'<ellipse cx="{c[0]:.1f}" cy="{c[1]:.1f}" rx="{r:.1f}" ry="{r * 0.32:.1f}" fill="none" stroke="{_STROKE}" stroke-width="1.5" stroke-dasharray="5 4"/>')

    for i, lab in enumerate(labels):
        out.append(f'<text x="12" y="{22 + i * 18:.0f}" font-size="12" fill="{_AXIS}">{_esc(lab)}</text>')
    return _svg(W, H, "".join(out))


# --- Statics (beam loading) -------------------------------------------------
def _render_beam(length: float, supports: list[Support], loads: list[Load]) -> str:
    length = length or 10
    scale, M, base_y = 44.0, 50, 150
    W = int(2 * M + length * scale)
    H = 260

    def bx(pos: float) -> float:
        return M + pos * scale

    out = [f'<line x1="{bx(0):.1f}" y1="{base_y}" x2="{bx(length):.1f}" y2="{base_y}" stroke="{_AXIS}" stroke-width="4"/>']
    for s in supports:
        x = bx(s.position)
        if s.type == "pin":
            out.append(f'<polygon points="{x:.1f},{base_y} {x - 12:.1f},{base_y + 20} {x + 12:.1f},{base_y + 20}" fill="none" stroke="{_STROKE}" stroke-width="2"/>')
        elif s.type == "roller":
            out.append(f'<polygon points="{x:.1f},{base_y} {x - 12:.1f},{base_y + 16} {x + 12:.1f},{base_y + 16}" fill="none" stroke="{_STROKE}" stroke-width="2"/>')
            out.append(f'<circle cx="{x - 6:.1f}" cy="{base_y + 21}" r="4" fill="none" stroke="{_STROKE}"/><circle cx="{x + 6:.1f}" cy="{base_y + 21}" r="4" fill="none" stroke="{_STROKE}"/>')
        elif s.type == "fixed":
            out.append(f'<line x1="{x:.1f}" y1="{base_y - 26}" x2="{x:.1f}" y2="{base_y + 26}" stroke="{_STROKE}" stroke-width="3"/>')
            for k in range(6):
                yy = base_y - 26 + k * 10
                out.append(f'<line x1="{x:.1f}" y1="{yy}" x2="{x - 10:.1f}" y2="{yy + 8}" stroke="{_STROKE}" stroke-width="1.5"/>')
    ah = '<defs><marker id="bh" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#111827"/></marker></defs>'
    out.append(ah)
    for ld in loads:
        if ld.kind == "point":
            x = bx(ld.position)
            out.append(f'<line x1="{x:.1f}" y1="{base_y - 50}" x2="{x:.1f}" y2="{base_y - 4}" stroke="{_ARROW}" stroke-width="2" marker-end="url(#bh)"/>')
            if ld.label:
                out.append(f'<text x="{x:.1f}" y="{base_y - 56}" font-size="12" fill="{_AXIS}" text-anchor="middle">{_esc(ld.label)}</text>')
        elif ld.kind == "distributed":
            x1, x2 = bx(ld.position), bx(ld.end or ld.position + 1)
            out.append(f'<line x1="{x1:.1f}" y1="{base_y - 46}" x2="{x2:.1f}" y2="{base_y - 46}" stroke="{_STROKE}" stroke-width="1.5"/>')
            xa = x1
            while xa <= x2 + 0.1:
                out.append(f'<line x1="{xa:.1f}" y1="{base_y - 46}" x2="{xa:.1f}" y2="{base_y - 4}" stroke="{_ARROW}" stroke-width="1.5" marker-end="url(#bh)"/>')
                xa += max(20, (x2 - x1) / 5)
            if ld.label:
                out.append(f'<text x="{(x1 + x2) / 2:.1f}" y="{base_y - 52}" font-size="12" fill="{_AXIS}" text-anchor="middle">{_esc(ld.label)}</text>')
        elif ld.kind == "moment":
            x = bx(ld.position)
            out.append(f'<path d="M{x - 16:.1f} {base_y - 18} A18 18 0 1 1 {x + 16:.1f} {base_y - 18}" fill="none" stroke="{_ARROW}" stroke-width="2" marker-end="url(#bh)"/>')
            if ld.label:
                out.append(f'<text x="{x:.1f}" y="{base_y - 40}" font-size="12" fill="{_AXIS}" text-anchor="middle">{_esc(ld.label)}</text>')
    return _svg(W, H, "".join(out))


def render_figure_json(spec_json: str) -> str:
    """Validate a JSON figure spec (as emitted by the model) into a FigureSpec and
    render it. Best-effort: returns "" for empty input, or anything that fails to
    parse or render — a bad figure must never fail the whole question."""
    text = (spec_json or "").strip()
    if not text:
        return ""
    try:
        spec = FigureSpec.model_validate_json(text)
    except Exception:
        return ""
    try:
        return render_figure(spec)
    except Exception:
        return ""


def render_figure(spec: FigureSpec) -> str:
    """Return an SVG string for the spec, or "" when no figure is needed."""
    if spec.kind == "tree":
        return _render_tree(spec.nodes)
    if spec.kind == "scene":
        return _render_scene(spec)
    if spec.kind == "circuit":
        return _render_circuit(spec.components)
    if spec.kind == "molecule":
        return _render_molecule(spec.atoms, spec.bonds)
    if spec.kind == "punnett":
        return _render_punnett(spec.punnett_top, spec.punnett_side, spec.punnett_cells)
    if spec.kind == "solid":
        return _render_solid(spec.solid_kind, spec.sw, spec.sh, spec.sd, spec.solid_labels)
    if spec.kind == "beam":
        return _render_beam(spec.beam_length, spec.supports, spec.loads)
    return ""
