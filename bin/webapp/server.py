#!/usr/bin/env python3
import os
import sys
import logging
import threading
import json
from queue import Queue
from pathlib import Path
from flask import Flask, send_from_directory, jsonify, request
from flask_socketio import SocketIO

# -----------------------------------------------------
# 1) Determine BASE_DIR and various subdirectories
# -----------------------------------------------------
HERE = Path(__file__).resolve().parent               # .../bin/webapp
BIN  = HERE.parent                                   # .../bin
BASE_DIR = BIN.parent                                # project root, e.g. /opt/octapus
FRONTEND_DIR = BASE_DIR / "frontend"
LOG_DIR  = HERE / "logs" # Changed from BASE_DIR / "logs"
SCENARIO_DIR = BASE_DIR / "scenarios"
OCTAPUS_LOG_FILE = LOG_DIR / "octapus.log"
SETTINGS_FILE = BASE_DIR / "settings.json" # Path for storing settings

# Ensure logs and scenarios directories exist
LOG_DIR.mkdir(parents=True, exist_ok=True)
SCENARIO_DIR.mkdir(parents=True, exist_ok=True)

# Ensure the logs folder and log file exist
if not OCTAPUS_LOG_FILE.exists():
    OCTAPUS_LOG_FILE.write_text("")  # create empty log if missing

# -----------------------------------------------------
# Make sure we can import from octapus_controller
# -----------------------------------------------------
sys.path.insert(0, str(BIN))

from octapus_controller import log_queue, start_scan_thread, start_scenario_thread, get_local_cidr

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
def landing():
    """Serve landing.html as the landing page."""
    return send_from_directory(str(FRONTEND_DIR), "landing.html")

@app.route("/dashboard", methods=["GET"])
def dashboard():
    """Serve the main dashboard/index page."""
    return send_from_directory(str(FRONTEND_DIR), "index.html")

@app.route("/scenario_maker", methods=["GET"])
def scenario_maker():
    """Serve the scenario maker page."""
    return send_from_directory(str(FRONTEND_DIR), "scenario.html")

@app.route("/settings", methods=["GET"])
def settings_page():
    """Serve a placeholder settings page (must create settings.html)."""
    return send_from_directory(str(FRONTEND_DIR), "settings.html")

@app.route("/logs", methods=["GET"])
def logs_page():
    """Serve a placeholder logs page (must create logs.html)."""
    return send_from_directory(str(FRONTEND_DIR), "logs.html")

@app.route("/help", methods=["GET"])
def help_page():
    """Serve a placeholder help page (must create help.html)."""
    return send_from_directory(str(FRONTEND_DIR), "help.html")

@app.route("/about", methods=["GET"])
def about_page():
    """Serve a placeholder about page (must create about.html)."""
    return send_from_directory(str(FRONTEND_DIR), "about.html")

@app.route("/updates", methods=["GET"])
def updates_page():
    """Serve a placeholder updates page (must create updates.html)."""
    return send_from_directory(str(FRONTEND_DIR), "updates.html")

@app.route("/demo", methods=["GET"])
def demo_page():
    """Serve a placeholder demo page (must create demo.html)."""
    return send_from_directory(str(FRONTEND_DIR), "demo.html")

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
    """
    payload = request.get_json(force=True)
    scripts = payload.get("scripts", [])
    if not isinstance(scripts, list) or not scripts:
        return jsonify(status="error", message="No scripts provided"), 400

    # Spawn a thread to run dynamic_scan_sequence(...)
    t = threading.Thread(target=start_scan_thread, args=(scripts,), daemon=True)
    t.start()

    logging.info(f"HTTP /start received. Scheduled dynamic scan: {scripts}")
    return jsonify(status="scan started")

@app.route("/start_scenario", methods=["POST"])
def start_scenario():
    """
    Expects JSON:
      {
        "steps": [
          {
            "tool": "nmap",
            "args": ["-sV", "192.168.1.0/24"],
            "condition": { "type": "always" }
          },
          ...
        ]
      }
    """
    payload = request.get_json(force=True)
    steps = payload.get("steps", [])
    if not isinstance(steps, list) or not steps:
        return jsonify(status="error", message="No steps provided"), 400

    t = threading.Thread(target=start_scenario_thread, args=(steps,), daemon=True)
    t.start()

    logging.info(f"HTTP /start_scenario received. Steps: {steps}")
    return jsonify(status="scenario started")

@app.route("/save_scenario", methods=["POST"])
def save_scenario():
    """
    Save named scenario. Expects JSON:
      {
        "name": "my_scenario",
        "steps": [ {tool, args, condition}, ... ]
      }
    """
    payload = request.get_json(force=True)
    name = payload.get("name", "").strip()
    steps = payload.get("steps", [])
    if not name:
        return jsonify(status="error", message="Scenario name required"), 400
    if not isinstance(steps, list) or not steps:
        return jsonify(status="error", message="No steps provided"), 400

    import json
    sanitized = "".join(c for c in name if c.isalnum() or c in ("-", "_")).rstrip()
    path = SCENARIO_DIR / f"{sanitized}.json"
    try:
        with open(path, "w") as f:
            json.dump({"name": sanitized, "steps": steps}, f, indent=2)
    except Exception as e:
        return jsonify(status="error", message=f"Failed to save: {e}"), 500

    return jsonify(status="saved", name=sanitized)

@app.route("/list_scenarios", methods=["GET"])
def list_scenarios():
    """
    Return a JSON list of all saved scenario names (without .json extension).
    """
    names = []
    for file in SCENARIO_DIR.glob("*.json"):
        names.append(file.stem)
    return jsonify(scenarios=names)  # Changed from 'names' to 'scenarios'

@app.route("/load_scenario/<name>", methods=["GET"])
def load_scenario(name):
    """
    Load scenario by name; returns JSON { scripts: [...] }.
    """
    path = SCENARIO_DIR / f"{name}.json"
    if not path.exists():
        return jsonify(status="error", message="Scenario not found"), 404
    try:
        with open(path, "r") as f:
            data = json.load(f)
        
        # The frontend expects { scripts: [...] } format
        # but your save format might be { name: "...", steps: [...] }
        # Convert steps to scripts format if needed
        if "steps" in data:
            scripts = []
            for step in data["steps"]:
                # Convert step format to script format
                script = {
                    "tool": step.get("tool", ""),
                    "args": step.get("args", [])
                }
                scripts.append(script)
            return jsonify(scripts=scripts)
        elif "scripts" in data:
            return jsonify(scripts=data["scripts"])
        else:
            return jsonify(status="error", message="Invalid scenario format"), 400
            
    except Exception as e:
        logging.error(f"Failed to load scenario {name}: {e}")
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
# New endpoint: Fetch historical lines from octapus.log
@app.route("/fetch_logs", methods=["GET"])
def fetch_logs():
    """
    Reads the entire octapus.log file and returns a JSON array of lines.
    """
    try:
        # Read all lines from octapus.log
        with open(OCTAPUS_LOG_FILE, "r") as f:
            raw_lines = f.readlines()
        # Strip newline characters
        lines = [ln.rstrip("\n") for ln in raw_lines]
        return jsonify(lines=lines)
    except Exception as e:
        return jsonify(status="error", message=f"Could not read logs: {e}"), 500

# -----------------------------------------------------
# API Endpoints for Settings
# -----------------------------------------------------
DEFAULT_SETTINGS = {
    "networkInterface": "eth0",
    "nmapScanType": "intense",
    "logVerbosity": "info"
}

@app.route("/api/settings", methods=["GET"])
def get_settings():
    """
    Load settings from SETTINGS_FILE.
    Returns default settings if file doesn't exist or is invalid.
    """
    if not SETTINGS_FILE.exists():
        return jsonify(status="success", data=DEFAULT_SETTINGS)
    try:
        with open(SETTINGS_FILE, "r") as f:
            settings_data = json.load(f)
        # You might want to merge with defaults to ensure all keys are present
        # current_settings = {**DEFAULT_SETTINGS, **settings_data} 
        return jsonify(status="success", data=settings_data)
    except Exception as e:
        logging.error(f"Failed to load settings: {e}")
        # Fallback to default settings on error
        return jsonify(status="success", data=DEFAULT_SETTINGS, message=f"Error loading settings, defaults returned: {e}")

@app.route("/api/settings", methods=["POST"])
def save_settings():
    """
    Save settings to SETTINGS_FILE.
    Expects JSON payload with settings.
    """
    try:
        new_settings = request.get_json(force=True)
        if not isinstance(new_settings, dict):
            return jsonify(status="error", message="Invalid settings format, expected a JSON object."), 400
        
        # Optional: Validate specific settings keys/values here if needed
        # For example, ensure nmapScanType is one of the allowed values

        with open(SETTINGS_FILE, "w") as f:
            json.dump(new_settings, f, indent=2)
        logging.info(f"Settings saved: {new_settings}")
        return jsonify(status="success", message="Settings saved successfully.")
    except Exception as e:
        logging.error(f"Failed to save settings: {e}")
        return jsonify(status="error", message=f"Failed to save settings: {e}"), 500

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
