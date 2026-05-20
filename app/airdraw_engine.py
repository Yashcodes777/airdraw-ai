from __future__ import annotations

import threading
from collections.abc import Generator

from flask import abort

from .drawing_utils import COLOR_MAP, smooth_point, toolbar_action

try:
    import cv2  # type: ignore
    import mediapipe as mp  # type: ignore
    import numpy as np  # type: ignore
except Exception:  # pragma: no cover - dependency import guard
    cv2 = None
    mp = None
    np = None


class AirDrawEngine:
    def __init__(self) -> None:
        self.mode = "draw"
        self.color_name = "blue"
        self.clear_requested = False
        self.lock = threading.Lock()
        self.mp_hands = mp.solutions.hands if mp else None
        self.drawer = mp.solutions.drawing_utils if mp else None

    @property
    def bgr_color(self) -> tuple[int, int, int]:
        return COLOR_MAP.get(self.color_name, COLOR_MAP["blue"])

    def set_state(self, *, color: str | None = None, mode: str | None = None) -> None:
        with self.lock:
            if color in COLOR_MAP:
                self.color_name = color
            if mode in {"draw", "erase"}:
                self.mode = mode

    def request_clear(self) -> None:
        with self.lock:
            self.clear_requested = True

    def consume_clear_request(self) -> bool:
        with self.lock:
            requested = self.clear_requested
            self.clear_requested = False
            return requested

    def clear_canvas(self, canvas) -> None:
        if canvas is not None:
            canvas[:] = 0

    def current_state(self) -> dict[str, str]:
        with self.lock:
            return {"color": self.color_name, "mode": self.mode}

    def _draw_toolbar(self, frame) -> None:
        h, w = frame.shape[:2]
        toolbar_h = 65
        segment = max(w // 6, 1)
        labels = ["BLUE", "GREEN", "RED", "YELLOW", "DRAW", "ERASE"]
        colors = [
            (255, 0, 0),
            (0, 255, 0),
            (0, 0, 255),
            (0, 255, 255),
            (90, 90, 90),
            (40, 40, 40),
        ]

        for i, (label, color) in enumerate(zip(labels, colors, strict=True)):
            x1 = i * segment
            x2 = w if i == 5 else (i + 1) * segment
            cv2.rectangle(frame, (x1, 0), (x2, toolbar_h), color, -1)
            cv2.putText(
                frame,
                label,
                (x1 + 10, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (255, 255, 255),
                2,
                cv2.LINE_AA,
            )

        cv2.putText(
            frame,
            f"Mode: {self.mode.upper()} | Color: {self.color_name.upper()}",
            (20, h - 20),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )

    def _process_hand(self, frame, canvas, hand_landmarks, prev_point):
        h, w = frame.shape[:2]
        landmarks = hand_landmarks.landmark
        index_tip = landmarks[8]
        index_pip = landmarks[6]
        middle_tip = landmarks[12]
        middle_pip = landmarks[10]

        ix, iy = int(index_tip.x * w), int(index_tip.y * h)
        index_up = index_tip.y < index_pip.y
        middle_up = middle_tip.y < middle_pip.y

        if index_up and middle_up and iy < 65:
            action, value = toolbar_action(ix, w)
            if action == "color":
                self.set_state(color=value)
            else:
                self.set_state(mode=value)
            return None

        if index_up and not middle_up:
            point = smooth_point(prev_point, (ix, iy))
            if prev_point is not None:
                if self.mode == "erase":
                    cv2.line(canvas, prev_point, point, (0, 0, 0), 40, cv2.LINE_AA)
                else:
                    cv2.line(canvas, prev_point, point, self.bgr_color, 6, cv2.LINE_AA)
            cv2.circle(frame, point, 8, self.bgr_color if self.mode == "draw" else (0, 0, 0), -1)
            return point

        return None

    def generate_frames(self) -> Generator[bytes, None, None]:
        if cv2 is None or mp is None or np is None:
            abort(500, description="OpenCV/MediaPipe dependencies are not installed")

        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            abort(500, description="Unable to open webcam")

        with self.mp_hands.Hands(
            model_complexity=0,
            min_detection_confidence=0.6,
            min_tracking_confidence=0.6,
            max_num_hands=1,
        ) as hands:
            prev_point = None
            canvas = None

            while True:
                ok, frame = cap.read()
                if not ok:
                    break

                frame = cv2.flip(frame, 1)
                if canvas is None:
                    canvas = np.zeros_like(frame)
                if self.consume_clear_request():
                    self.clear_canvas(canvas)

                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = hands.process(rgb)

                if results.multi_hand_landmarks:
                    for hand_landmarks in results.multi_hand_landmarks:
                        prev_point = self._process_hand(frame, canvas, hand_landmarks, prev_point)
                else:
                    prev_point = None

                gray_canvas = cv2.cvtColor(canvas, cv2.COLOR_BGR2GRAY)
                _, mask = cv2.threshold(gray_canvas, 10, 255, cv2.THRESH_BINARY)
                mask_inv = cv2.bitwise_not(mask)
                frame_bg = cv2.bitwise_and(frame, frame, mask=mask_inv)
                drawing_fg = cv2.bitwise_and(canvas, canvas, mask=mask)
                merged = cv2.add(frame_bg, drawing_fg)

                self._draw_toolbar(merged)

                success, buffer = cv2.imencode(".jpg", merged)
                if not success:
                    continue
                frame_bytes = buffer.tobytes()
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
                )

        cap.release()
