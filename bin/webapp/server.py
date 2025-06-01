# server.py (placed in webapp/ folder)
#!/usr/bin/env python3
import os
import sys
import logging
import threading
from queue import Queue
from pathlib import Path
from flask import Flask, send_from_directory, jsonify, request
from flask_socketio import SocketIO

# Determine base directory (two levels up from this script)
HERE = Path(__file__).resolve().parent
BIN  = HERE.parent  # where octapus_controller.py lives
BASE_DIR = BIN
LOG_DIR = BASE_DIR / "logs"
SCENARIO_DIR = BASE_DIR / "scenarios"

# Ensure scenario directory exists
if not SCENARIO_DIR.exists():
    SCENARIO_DIR.mkdir(parents=True, exist_ok=True)

# -----------------------------------------------------
# Make sure we can import from octapus_controller
# -----------------------------------------------------
sys.path.insert(0, str(BIN))

from octapus_controller import log_queue, start_scan_thread, get_local_cidr

# -----------------------------------------------------
# Configuration
# -----------------------------------------------------
WEBAPP_DIR   = HERE                              # webapp folder
FRONTEND_DIR = WEBAPP_DIR / "frontend"
LOG_FILE     = LOG_DIR / "webapp.log"

# -----------------------------------------------------
# Logging setup
# -----------------------------------------------------
try:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        filename=str(LOG_FILE),
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
except Exception:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

# -----------------------------------------------------
# Flask + SocketIO setup
# -----------------------------------------------------
app = Flask(__name__, static_folder=str(FRONTEND_DIR), template_folder=str(FRONTEND_DIR))
socketio = SocketIO(app, async_mode="threading")


# -----------------------------------------------------
# Routes & WebSocket handlers
# -----------------------------------------------------
@app.route("/", methods=["GET"])
def index():
    """Serve index.html from the frontend directory."""
    return send_from_directory(str(FRONTEND_DIR), "index.html")


@app.route("/local_cidr", methods=["GET"])
def local_cidr():
    """
    Return local network CIDR as JSON: { "cidr": "192.168.1.0/24" }
    """
    cidr = get_local_cidr()
    if cidr:
        return jsonify(cidr=cidr)
    else:
        return jsonify(error="Unable to detect local network"), 500


@app.route("/start", methods=["POST"])
def start_scan():
    """
    Expects JSON:
      { "scripts": [ { "tool": "...", "args": [...] }, ... ] }
    Or:
      { "scenario": "<name>" }
    """
    payload = request.get_json(force=True)

    # If a scenario is requested, load it
    if "scenario" in payload:
        name = payload["scenario"]
        path = SCENARIO_DIR / f"{name}.json"
        if not path.exists():
            return jsonify(status="error", message="Scenario not found"), 404
        try:
            import json
            with open(path) as f:
                data = json.load(f)
            scripts = data.get("scripts", [])
        except Exception as e:
            return jsonify(status="error", message=f"Failed to load scenario: {e}"), 500
    else:
        scripts = payload.get("scripts", [])

    if not isinstance(scripts, list) or not scripts:
        return jsonify(status="error", message="No scripts provided"), 400

    # Spawn a thread to run dynamic_scan_sequence(...)
    t = threading.Thread(target=start_scan_thread, args=(scripts,), daemon=True)
    t.start()

    logging.info(f"HTTP /start received. Scheduled dynamic scan: {scripts}")
    return jsonify(status="scan started")


@app.route("/stop", methods=["POST"])
def stop_scan():
    """
    Stub for cancellation logic.
    """
    logging.info("HTTP /stop received (stub).")
    return jsonify(status="stopped")


@app.route("/save_scenario", methods=["POST"])
def save_scenario():
    """
    Save named scenario. Expects JSON:
      { "name": "my_scenario", "scripts": [ ... ] }
    """
    payload = request.get_json(force=True)
    name = payload.get("name", "").strip()
    scripts = payload.get("scripts", [])
    if not name:
        return jsonify(status="error", message="Scenario name required"), 400
    if not isinstance(scripts, list) or not scripts:
        return jsonify(status="error", message="No scripts provided"), 400

    import json
    sanitized = "".join(c for c in name if c.isalnum() or c in ("-", "_")).rstrip()
    path = SCENARIO_DIR / f"{sanitized}.json"
    try:
        with open(path, "w") as f:
            json.dump({"name": sanitized, "scripts": scripts}, f, indent=2)
    except Exception as e:
        return jsonify(status="error", message=f"Failed to save: {e}"), 500

    return jsonify(status="saved", name=sanitized)


@app.route("/list_scenarios", methods=["GET"])
def list_scenarios():
    """
    Return a list of saved scenario names.
    """
    files = [f.stem for f in SCENARIO_DIR.glob("*.json")]
    return jsonify(scenarios=files)


@app.route("/load_scenario/<name>", methods=["GET"])
def load_scenario(name):
    """
    Load scenario by name; returns JSON { name, scripts }.
    """
    path = SCENARIO_DIR / f"{name}.json"
    if not path.exists():
        return jsonify(status="error", message="Scenario not found"), 404
    try:
        import json
        with open(path) as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify(status="error", message=f"Failed to load: {e}"), 500


@socketio.on("connect")
def on_connect():
    """
    When a WebSocket client connects, forward log_queue items continuously.
    """
    logging.info("New WebSocket client connected")

    def send_logs():
        while True:
            msg = log_queue.get()
            socketio.emit("log", msg)

    socketio.start_background_task(send_logs)


# -----------------------------------------------------
# Main entrypoint
# -----------------------------------------------------
if __name__ == "__main__":
    print("=== Octapus Web Server starting on 0.0.0.0:8080 ===")
    print("=== Serving frontend from:", FRONTEND_DIR, "===")
    socketio.run(
        app,
        host="0.0.0.0",
        port=8080,
        debug=False
    )
