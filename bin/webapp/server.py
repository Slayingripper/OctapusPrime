#!/opt/octapus/venv/bin/python3
import os
import sys
import logging
import threading
from queue import Queue
from pathlib import Path

from flask import Flask, send_from_directory, jsonify, request
from flask_socketio import SocketIO

# -----------------------------------------------------
# Make sure we can import the controller from /opt/octapus/bin
# -----------------------------------------------------
HERE = Path(__file__).parent
BIN  = HERE.parent  # /opt/octapus/bin
sys.path.insert(0, str(BIN))

from octapus_controller import log_queue, start_scan_thread

# -----------------------------------------------------
# Configuration
# -----------------------------------------------------
WEBAPP_DIR   = HERE                             # /opt/octapus/bin/webapp
FRONTEND_DIR = WEBAPP_DIR / "frontend"          # /opt/octapus/bin/webapp/frontend
LOG_FILE     = "/opt/octapus/logs/webapp.log"   # optional

# -----------------------------------------------------
# Logging setup
# -----------------------------------------------------
log_dir = os.path.dirname(LOG_FILE)
if log_dir and not os.path.exists(log_dir):
    try:
        os.makedirs(log_dir, exist_ok=True)
    except PermissionError:
        log_dir = None

if log_dir:
    logging.basicConfig(
        filename=LOG_FILE,
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s"
    )
else:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s"
    )

# -----------------------------------------------------
# Flask + SocketIO setup
# -----------------------------------------------------
app = Flask(
    __name__,
    static_folder=str(FRONTEND_DIR),
    template_folder=str(FRONTEND_DIR)
)
socketio = SocketIO(app, async_mode="threading")  # threading is fine now

# -----------------------------------------------------
# Routes & WebSocket handlers
# -----------------------------------------------------
@app.route("/", methods=["GET"])
def index():
    """
    Serve the main frontend page (index.html under /frontend).
    """
    return send_from_directory(str(FRONTEND_DIR), "index.html")


@app.route("/start", methods=["POST"])
def start_scan():
    """
    Expected JSON request body:
    {
      "scripts": [
        { "tool": "nmap", "args": ["-sV", "192.168.1.0/24"] },
        { "tool": "masscan", "args": ["10.0.0.0/24", "-p22,80"] }
      ]
    }
    """
    payload = request.get_json(force=True)
    scripts = payload.get("scripts", [])
    if not isinstance(scripts, list) or not scripts:
        return jsonify(status="error", message="No scripts provided"), 400

    # Launch scan in a separate thread so Flask doesn't block
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


@socketio.on("connect")
def on_connect():
    """
    When a WebSocket client connects, spawn a thread to forward messages
    from the shared threading.Queue (`log_queue`) to the client.
    """
    logging.info("New WebSocket client connected")

    def send_logs():
        while True:
            msg = log_queue.get()  # blocks until an item is available
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
