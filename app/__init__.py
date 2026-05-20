from __future__ import annotations

from flask import Flask, Response, jsonify, render_template, request

from .airdraw_engine import AirDrawEngine


engine = AirDrawEngine()


def create_app() -> Flask:
    app = Flask(__name__)

    @app.get("/")
    def index() -> str:
        return render_template("index.html")

    @app.get("/video_feed")
    def video_feed() -> Response:
        return Response(
            engine.generate_frames(),
            mimetype="multipart/x-mixed-replace; boundary=frame",
        )

    @app.post("/state")
    def set_state() -> Response:
        payload = request.get_json(silent=True) or {}
        color = payload.get("color")
        mode = payload.get("mode")
        clear = bool(payload.get("clear"))

        engine.set_state(color=color, mode=mode)
        if clear:
            engine.request_clear()

        return jsonify(engine.current_state())

    return app
