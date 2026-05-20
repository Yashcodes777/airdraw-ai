# AirDraw AI

AI-powered virtual air drawing web app using **Python**, **OpenCV**, and **MediaPipe** hand tracking.

## Features

- Draw in the air with index finger gesture
- Color selection (Blue, Green, Red, Yellow)
- Eraser mode
- One-click canvas clear
- Virtual persistent canvas over webcam stream
- Smooth strokes using point interpolation
- Modern lightweight web UI (Flask + HTML/CSS/JS)

## Project structure

```text
airdraw-ai/
├── app/
│   ├── __init__.py
│   ├── airdraw_engine.py
│   ├── drawing_utils.py
│   ├── static/
│   │   ├── css/styles.css
│   │   └── js/app.js
│   └── templates/index.html
├── tests/test_drawing_utils.py
├── run.py
├── requirements.txt
└── Procfile
```

## Local setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

Open `http://localhost:5000`.

## Controls

- **Draw**: keep index finger up, middle finger down
- **Toolbar gesture**: raise index + middle fingers at top bar to pick color or mode
- **UI controls**: use on-screen color/mode buttons
- **Clear**: use the Clear button to wipe the virtual canvas

## Deployment

This repository includes a `Procfile` for easy deployment on platforms supporting Gunicorn process definitions.
