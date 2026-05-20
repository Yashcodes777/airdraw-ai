from __future__ import annotations

from typing import Optional

COLOR_MAP = {
    "blue": (255, 0, 0),
    "green": (0, 255, 0),
    "red": (0, 0, 255),
    "yellow": (0, 255, 255),
    "white": (255, 255, 255),
}


def smooth_point(
    prev_point: Optional[tuple[int, int]],
    current_point: tuple[int, int],
    alpha: float = 0.65,
) -> tuple[int, int]:
    if prev_point is None:
        return current_point

    x = int(prev_point[0] * alpha + current_point[0] * (1 - alpha))
    y = int(prev_point[1] * alpha + current_point[1] * (1 - alpha))
    return x, y


def toolbar_action(x: int, width: int) -> tuple[str, str]:
    if width <= 0:
        return "mode", "draw"

    segment = max(width // 6, 1)
    if x < segment:
        return "color", "blue"
    if x < segment * 2:
        return "color", "green"
    if x < segment * 3:
        return "color", "red"
    if x < segment * 4:
        return "color", "yellow"
    if x < segment * 5:
        return "mode", "draw"
    return "mode", "erase"
