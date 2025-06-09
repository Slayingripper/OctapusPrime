#!/usr/bin/env python3
import os
import subprocess
import sys
import logging
import threading
import json
import netifaces
import ipaddress
import platform
import re
import asyncio

from queue import Queue
from pathlib import Path
from flask import Flask, send_from_directory, jsonify, request, send_file
from flask_socketio import SocketIO
from platform import release


# -----------------------------------------------------
# 1) Determine BASE_DIR and various subdirectories
# -----------------------------------------------------
HERE = Path(__file__).resolve().parent  # .../bin/webapp
BIN = HERE.parent  # .../bin
BASE_DIR = BIN.parent  # project root, e.g. /opt/octapus
HERE = Path(__file__).resolve().parent  # .../bin/webapp
BIN = HERE.parent  # .../bin
BASE_DIR = BIN.parent  # project root, e.g. /opt/octapus
FRONTEND_DIR = BASE_DIR / "frontend"
LOG_DIR = HERE / "logs"  # Changed from BASE_DIR / "logs"
LOG_DIR = HERE / "logs"  # Changed from BASE_DIR / "logs"
SCENARIO_DIR = BASE_DIR / "scenarios"
OCTAPUS_LOG_FILE = LOG_DIR / "octapus.log"
SETTINGS_FILE = BASE_DIR / "settings.json"  # Path for storing settings
SETTINGS_FILE = BASE_DIR / "settings.json"  # Path for storing settings

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

from octapus_controller import (
    log_queue,
    start_scan_thread,
    start_scenario_thread,
    get_local_cidr,
)
from octapus_controller import (
    log_queue,
    start_scan_thread,
    start_scenario_thread,
    get_local_cidr,
)
from gpio_manager import gpio_manager

loop = asyncio.new_event_loop()

# -----------------------------------------------------
# Configuration
# -----------------------------------------------------
WEBAPP_DIR = HERE  # webapp folder
WEBAPP_DIR = HERE  # webapp folder
FRONTEND_DIR = WEBAPP_DIR / "frontend"
LOG_FILE = LOG_DIR / "webapp.log"
LOG_FILE = LOG_DIR / "webapp.log"

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
app = Flask(__name__, static_folder="static", static_url_path="/static")
app = Flask(__name__, static_folder="static", static_url_path="/static")
socketio = SocketIO(app, async_mode="threading")



# -----------------------------------------------------
# Macchanger Logic
# -----------------------------------------------------
def macchanger_callback():
    """Callback to change MAC address when button is pressed."""
    try:
        # Read network interface from settings or default to 'eth0'
        interface = "eth0"  # Fallback
        if SETTINGS_FILE.exists():
            with open(SETTINGS_FILE, "r") as f:
                settings = json.load(f)
                interface = settings.get("networkInterface", "eth0")
                if interface == "auto":
                    interfaces = get_available_interfaces()
                    interface = next(
                        iter(interfaces), "eth0"
                    )  # First available interface

                    interface = next(
                        iter(interfaces), "eth0"
                    )  # First available interface

        # Run macchanger to randomize MAC address
        subprocess.run(["sudo", "macchanger", "-r", interface], check=True)
        subprocess.run(["sudo", "macchanger", "-r", interface], check=True)
        print(f"MAC address changed for interface {interface}")
        socketio.emit(
            "log", {"message": f"MAC address changed for {interface}", "level": "info"}
        )
        socketio.emit(
            "log", {"message": f"MAC address changed for {interface}", "level": "info"}
        )
    except Exception as e:
        print(f"Failed to change MAC address: {e}")
        socketio.emit(
            "log", {"message": f"Failed to change MAC address: {e}", "level": "error"}
        )
        socketio.emit(
            "log", {"message": f"Failed to change MAC address: {e}", "level": "error"}
        )


async def macchanger_button_press(macchanger, debounce_time=0.5):
    """Continuously check for button press with debounce."""
    while True:
        if macchanger.is_pressed:
            print("Button pressed - changing MAC address")
            macchanger_callback()
            await asyncio.sleep(debounce_time)  # Debounce delay
        await asyncio.sleep(0.1)


def scenario_button_callback():
    """Callback to run a scenario."""
    try:
        # Load scenario JSON
        with open(SCENARIO_DIR, "r") as f:
            scenario = json.load(f)

        print(f"Running scenario: {scenario.get('name', 'Unnamed')}")

        for step in scenario.get("steps", []):
            tool = step.get("tool")
            args = step.get("args", [])
            cmd = [tool] + args

            print(f"Running command: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True)

            if result.returncode == 0:
                print(f"Success:\n{result.stdout}")
            else:
                print(f"Error (code {result.returncode}):\n{result.stderr}")

    except Exception as e:
        print(f"Failed to run scenario: {e}")


async def scenario_button_press(scenario, debounce_time=0.5):
    """Continuously check for button press with debounce."""
    while True:
        if scenario.is_pressed:
            print("Button pressed - changing MAC address")
            macchanger_callback()
            await asyncio.sleep(debounce_time)  # Debounce delay
        await asyncio.sleep(0.1)




def scenario_button_callback():
    """Callback to run a scenario."""
    try:
        # Load scenario JSON
        with open(SCENARIO_DIR, "r") as f:
            scenario = json.load(f)

        print(f"Running scenario: {scenario.get('name', 'Unnamed')}")

        for step in scenario.get("steps", []):
            tool = step.get("tool")
            args = step.get("args", [])
            cmd = [tool] + args

            print(f"Running command: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True)

            if result.returncode == 0:
                print(f"Success:\n{result.stdout}")
            else:
                print(f"Error (code {result.returncode}):\n{result.stderr}")

    except Exception as e:
        print(f"Failed to run scenario: {e}")


async def scenario_button_press(scenario, debounce_time=0.5):
    """Continuously check for button press with debounce."""
    while True:
        if scenario.is_pressed:
            print("Button pressed - changing MAC address")
            macchanger_callback()
            await asyncio.sleep(debounce_time)  # Debounce delay
        await asyncio.sleep(0.1)


def init_gpio():
    """Initialize GPIO pins and set up monitoring for the buttons."""
    """Initialize GPIO pins and set up monitoring for the buttons."""
    try:
        button, led, macchanger = gpio_manager.setup_gpio()
        if button and led and macchanger:
            led.on()
            import time


            time.sleep(0.5)
            led.off()
            logging.info("GPIO initialized successfully")

            macchanger_pin = gpio_manager.config.get("macchanger_pin", 23)
            gpio_manager.monitor_gpio_pin(
                macchanger_pin, macchanger_callback, existing_button=macchanger
            )
            # button_pin = gpio_manager.config.get("button_pin", 17)
            # gpio_manager.monitor_gpio_pin(button_pin, scenario_button_callback, existing_button=button)
            gpio_manager.monitor_gpio_pin(
                macchanger_pin, macchanger_callback, existing_button=macchanger
            )
            # button_pin = gpio_manager.config.get("button_pin", 17)
            # gpio_manager.monitor_gpio_pin(button_pin, scenario_button_callback, existing_button=button)

            # Start the event loop in a separate thread
            asyncio.set_event_loop(loop)
            loop.create_task(macchanger_button_press(macchanger))
            threading.Thread(target=loop.run_forever, daemon=True).start()

            print("GPIO setup and monitoring started")
        else:
            print("GPIO initialization failed")
            socketio.emit(
                "log", {"message": "GPIO initialization failed", "level": "error"}
            )
            socketio.emit(
                "log", {"message": "GPIO initialization failed", "level": "error"}
            )
    except Exception as e:
        print(f"GPIO setup failed: {e}")
        socketio.emit("log", {"message": f"GPIO setup failed: {e}", "level": "error"})



# -----------------------------------------------------
# GPIO PATCH
# -----------------------------------------------------
def apply_lgpio_patch_if_needed():
    """Check kernel version and apply lgpio patch for Raspberry Pi 6.6.45+ if needed."""
    try:
        kernel_version = platform.release()
        # Extract version part, e.g. "6.12.25" from "6.12.25+rpt-rpi-2712"
        match = re.match(r"(\d+)\.(\d+)\.(\d+)", kernel_version)
        if not match:
            return False

        major, minor, patch = map(int, match.groups())
        print(
            f"Parsed: {kernel_version} -> major={major}, minor={minor}, patch={patch}"
        )
        print(
            f"Parsed: {kernel_version} -> major={major}, minor={minor}, patch={patch}"
        )

        # Check if kernel version is >= 6.6.45
        if (
            (major > 6)
            or (major == 6 and minor > 6)
            or (major == 6 and minor == 6 and patch >= 45)
        ):
        if (
            (major > 6)
            or (major == 6 and minor > 6)
            or (major == 6 and minor == 6 and patch >= 45)
        ):
            try:
                import gpiozero.pins.lgpio
                import lgpio

                def __patched_init(self, chip=None):
                    gpiozero.pins.lgpio.LGPIOFactory.__bases__[0].__init__(self)
                    chip = 0  # Modify chip if necessary
                    self._handle = lgpio.gpiochip_open(chip)
                    self._chip = chip
                    self.pin_class = gpiozero.pins.lgpio.LGPIOPin

                gpiozero.pins.lgpio.LGPIOFactory.__init__ = __patched_init
                print(f"Applied lgpio patch for kernel {kernel_version}")
                return True

            except ImportError:
                print("lgpio patch needed but libraries not available")
            except Exception as e:
                print(f"Error applying lgpio patch: {e}")

    except Exception as e:
        print(f"Error checking kernel version: {e}")

    return False




# -----------------------------------------------------
# Network Interface Helper Functions
# -----------------------------------------------------
def get_available_interfaces():
    """Get all available network interfaces with their IP addresses."""
    interfaces = {}
    try:
        for iface in netifaces.interfaces():
            addrs = netifaces.ifaddresses(iface)
            if netifaces.AF_INET in addrs:
                for addr_info in addrs[netifaces.AF_INET]:
                    ip = addr_info.get("addr")
                    netmask = addr_info.get("netmask")
                    if ip and ip != "127.0.0.1":  # Skip localhost
                    ip = addr_info.get("addr")
                    netmask = addr_info.get("netmask")
                    if ip and ip != "127.0.0.1":  # Skip localhost
                        try:
                            # Calculate network CIDR
                            network = ipaddress.IPv4Network(
                                f"{ip}/{netmask}", strict=False
                            )
                            network = ipaddress.IPv4Network(
                                f"{ip}/{netmask}", strict=False
                            )
                            interfaces[iface] = {
                                "ip": ip,
                                "netmask": netmask,
                                "network": str(network),
                                "status": (
                                    "up" if iface in netifaces.interfaces() else "down"
                                ),
                                "ip": ip,
                                "netmask": netmask,
                                "network": str(network),
                                "status": (
                                    "up" if iface in netifaces.interfaces() else "down"
                                ),
                            }
                        except Exception:
                            interfaces[iface] = {
                                "ip": ip,
                                "netmask": netmask,
                                "network": f"{ip}/24",  # fallback
                                "status": "up",
                                "ip": ip,
                                "netmask": netmask,
                                "network": f"{ip}/24",  # fallback
                                "status": "up",
                            }
    except Exception as e:
        logging.error(f"Failed to get network interfaces: {e}")


    return interfaces



def get_cidr_for_interface(interface_name):
    """Get the CIDR notation for a specific network interface."""
    try:
        interfaces = get_available_interfaces()
        if interface_name in interfaces:
            return interfaces[interface_name]["network"]
            return interfaces[interface_name]["network"]
        else:
            # Fallback to auto-detection
            return get_local_cidr()
    except Exception as e:
        logging.error(f"Failed to get CIDR for interface {interface_name}: {e}")
        return get_local_cidr()



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
    Uses the configured network interface if available.
    """
    try:
        # Try to get settings to see if user has configured a specific interface
        if SETTINGS_FILE.exists():
            with open(SETTINGS_FILE, "r") as f:
                settings = json.load(f)
                interface_name = settings.get("networkInterface", "auto")


                if interface_name != "auto":
                    cidr = get_cidr_for_interface(interface_name)
                    if cidr:
                        return jsonify(cidr=cidr, interface=interface_name)
    except Exception as e:
        logging.warning(f"Failed to use configured interface: {e}")


    # Fallback to auto-detection
    cidr = get_local_cidr()
    if cidr:
        return jsonify(cidr=cidr, interface="auto")
    else:
        return jsonify(error="Unable to detect local network"), 500



@app.route("/network_interfaces", methods=["GET"])
def network_interfaces():
    """
    Return available network interfaces with their IP information.
    """
    interfaces = get_available_interfaces()
    return jsonify(interfaces=interfaces)


@app.route("/run_scenario", methods=["POST"])
def run_scenario():
    data = request.get_json()

    try:
        steps = data["steps"]
        results = []

        for step in steps:
            tool = step["tool"]
            args = step.get("args", [])

            cmd = [tool] + args

            print(f"Running command: {' '.join(cmd)}")

            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=step.get("timeout", 60)
            )

            results.append(
                {
                    "command": cmd,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "returncode": result.returncode,
                }
            )

        return jsonify({"status": "success", "results": results}), 200

    except Exception as e:
        print("Error running scenario:", e)
        return jsonify({"status": "error", "message": str(e)}), 500



@app.route("/run_scenario", methods=["POST"])
def run_scenario():
    data = request.get_json()

    try:
        steps = data["steps"]
        results = []

        for step in steps:
            tool = step["tool"]
            args = step.get("args", [])

            cmd = [tool] + args

            print(f"Running command: {' '.join(cmd)}")

            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=step.get("timeout", 60)
            )

            results.append(
                {
                    "command": cmd,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "returncode": result.returncode,
                }
            )

        return jsonify({"status": "success", "results": results}), 200

    except Exception as e:
        print("Error running scenario:", e)
        return jsonify({"status": "error", "message": str(e)}), 500


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
    payload = request.get_json(force=True)
    name = payload.get("name", "").strip()
    steps = payload.get("steps", [])


    if not name:
        return jsonify(status="error", message="Scenario name required"), 400
    if not isinstance(steps, list) or not steps:
        return jsonify(status="error", message="No steps provided"), 400

    sanitized = "".join(c for c in name if c.isalnum() or c in ("-", "_")).rstrip()
    if not sanitized:
        return (
            jsonify(status="error", message="Invalid scenario name after sanitization"),
            400,
        )

    if not sanitized:
        return (
            jsonify(status="error", message="Invalid scenario name after sanitization"),
            400,
        )

    path = SCENARIO_DIR / f"{sanitized}.json"


    try:
        from pathlib import Path

        temp_path = path.with_suffix(".json.tmp")

        temp_path.parent.mkdir(parents=True, exist_ok=True)

        with temp_path.open("w") as f:
        from pathlib import Path

        temp_path = path.with_suffix(".json.tmp")

        temp_path.parent.mkdir(parents=True, exist_ok=True)

        with temp_path.open("w") as f:
            json.dump({"name": sanitized, "steps": steps}, f, indent=2)

        temp_path.rename(path)
        print(f"File saved successfully to {path}")

        temp_path.rename(path)
        print(f"File saved successfully to {path}")
    except Exception as e:
        return jsonify(status="error", message=f"Failed to save: {e}"), 500

    return jsonify(status="success", name=sanitized)

    return jsonify(status="success", name=sanitized)


@app.route("/list_scenarios", methods=["GET"])
def list_scenarios():
    try:
        scenarios_dir = 'scenarios'
        scenarios = []
        
        if os.path.exists(scenarios_dir):
            for filename in os.listdir(scenarios_dir):
                if filename.endswith('.json'):
                    filepath = os.path.join(scenarios_dir, filename)
                    try:
                        with open(filepath, 'r') as f:
                            scenario_data = json.load(f)
                            # Add both filename and sanitized name for loading
                            scenario_data['filename'] = filename
                            scenario_data['load_name'] = filename[:-5]  # Remove .json extension
                            scenarios.append(scenario_data)
                    except Exception as e:
                        print(f"Error loading scenario {filename}: {e}")
        
        return jsonify({
            "status": "success",
            "scenarios": scenarios
        })
        
    except Exception as e:
        return jsonify({
            "status": "error", 
            "message": str(e)
        }), 500


@app.route("/load_scenario/<name>", methods=["GET"])
def load_scenario(name):
    """
    Load scenario by name; returns JSON with scenario data.
    """
    print(f"Loading scenario: {name}")  # Debug
    
    # Try the exact name first
    path = SCENARIO_DIR / f"{name}.json"
    
    # If not found, try the sanitized version
    if not path.exists():
        sanitized = "".join(c for c in name if c.isalnum() or c in ("-", "_")).rstrip()
        path = SCENARIO_DIR / f"{sanitized}.json"
        print(f"Trying sanitized path: {path}")  # Debug
    
    # If still not found, return 404
    if not path.exists():
        print(f"Scenario file not found: {path}")  # Debug
        return jsonify(status="error", message="Scenario not found"), 404
    
    try:
        with open(path, "r") as f:
            data = json.load(f)

        print(f"Loaded scenario data: {data}")  # Debug
        
        # Return the scenario data at the root level
        scenario_data = {
            "status": "success",
            "name": data.get("name", name),
            "description": data.get("description", ""),
            "steps": data.get("steps", []),
            "variables": data.get("variables", {}),
            "created": data.get("created", ""),
            "filename": path.name
        }
        
        print(f"Returning scenario data: {scenario_data}")  # Debug
        return jsonify(scenario_data)

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
    "networkInterface": "auto",
    "customCIDR": "",
    "nmapScanType": "intense",
    "logVerbosity": "info",
    "autoDetectNetwork": True,
    "defaultScanPorts": "1-1000",
    "masscanRate": "1000",
    "threadCount": "10",
    "threadCount": "10",
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
        # Merge with defaults to ensure all keys are present
        current_settings = {**DEFAULT_SETTINGS, **settings_data}
        current_settings = {**DEFAULT_SETTINGS, **settings_data}
        return jsonify(status="success", data=current_settings)
    except Exception as e:
        logging.error(f"Failed to load settings: {e}")
        # Fallback to default settings on error
        return jsonify(
            status="success",
            data=DEFAULT_SETTINGS,
            message=f"Error loading settings, defaults returned: {e}",
        )

        return jsonify(
            status="success",
            data=DEFAULT_SETTINGS,
            message=f"Error loading settings, defaults returned: {e}",
        )


@app.route("/api/settings", methods=["POST"])
def save_settings():
    """
    Save settings to SETTINGS_FILE.
    Expects JSON payload with settings.
    """
    try:
        new_settings = request.get_json(force=True)
        if not isinstance(new_settings, dict):
            return (
                jsonify(
                    status="error",
                    message="Invalid settings format, expected a JSON object.",
                ),
                400,
            )

            return (
                jsonify(
                    status="error",
                    message="Invalid settings format, expected a JSON object.",
                ),
                400,
            )

        # Validate specific settings
        valid_scan_types = ["intense", "quick", "comprehensive", "stealth", "custom"]
        if (
            "nmapScanType" in new_settings
            and new_settings["nmapScanType"] not in valid_scan_types
        ):
            return (
                jsonify(
                    status="error",
                    message=f"Invalid scan type. Must be one of: {', '.join(valid_scan_types)}",
                ),
                400,
            )

        if (
            "nmapScanType" in new_settings
            and new_settings["nmapScanType"] not in valid_scan_types
        ):
            return (
                jsonify(
                    status="error",
                    message=f"Invalid scan type. Must be one of: {', '.join(valid_scan_types)}",
                ),
                400,
            )

        valid_log_levels = ["debug", "info", "warning", "error"]
        if (
            "logVerbosity" in new_settings
            and new_settings["logVerbosity"] not in valid_log_levels
        ):
            return (
                jsonify(
                    status="error",
                    message=f"Invalid log level. Must be one of: {', '.join(valid_log_levels)}",
                ),
                400,
            )

        if (
            "logVerbosity" in new_settings
            and new_settings["logVerbosity"] not in valid_log_levels
        ):
            return (
                jsonify(
                    status="error",
                    message=f"Invalid log level. Must be one of: {', '.join(valid_log_levels)}",
                ),
                400,
            )

        # Validate network interface if not auto
        if (
            "networkInterface" in new_settings
            and new_settings["networkInterface"] != "auto"
        ):
        if (
            "networkInterface" in new_settings
            and new_settings["networkInterface"] != "auto"
        ):
            available_interfaces = get_available_interfaces()
            if new_settings["networkInterface"] not in available_interfaces:
                return (
                    jsonify(
                        status="error",
                        message=f"Invalid network interface. Available interfaces: {', '.join(available_interfaces.keys())}",
                    ),
                    400,
                )

                return (
                    jsonify(
                        status="error",
                        message=f"Invalid network interface. Available interfaces: {', '.join(available_interfaces.keys())}",
                    ),
                    400,
                )

        # Validate custom CIDR if provided
        if "customCIDR" in new_settings and new_settings["customCIDR"]:
            try:
                ipaddress.IPv4Network(new_settings["customCIDR"], strict=False)
            except ValueError:
                return (
                    jsonify(
                        status="error",
                        message="Invalid CIDR format. Use format like 192.168.1.0/24",
                    ),
                    400,
                )
                return (
                    jsonify(
                        status="error",
                        message="Invalid CIDR format. Use format like 192.168.1.0/24",
                    ),
                    400,
                )

        with open(SETTINGS_FILE, "w") as f:
            json.dump(new_settings, f, indent=2)
        logging.info(f"Settings saved: {new_settings}")
        return jsonify(status="success", message="Settings saved successfully.")
    except Exception as e:
        logging.error(f"Failed to save settings: {e}")
        return jsonify(status="error", message=f"Failed to save settings: {e}"), 500



# -----------------------------------------------------
# GPIO Configuration Endpoints
# -----------------------------------------------------
@app.route("/gpio_config", methods=["GET"])
def get_gpio_config():
    """Get current GPIO configuration and platform info."""
    return jsonify(
        {
            "config": gpio_manager.config,
            "platform_info": gpio_manager.platform_info,
            "available_libraries": gpio_manager.get_available_libraries(),
        }
    )

    return jsonify(
        {
            "config": gpio_manager.config,
            "platform_info": gpio_manager.platform_info,
            "available_libraries": gpio_manager.get_available_libraries(),
        }
    )


@app.route("/gpio_config", methods=["POST"])
def update_gpio_config():
    """Update GPIO configuration."""
    try:
        new_config = request.get_json(force=True)


        # Validate configuration
        required_fields = [
            "button_pin",
            "led_pin",
            "macchanger",
            "gpio_library",
            "manual_override",
        ]
        required_fields = [
            "button_pin",
            "led_pin",
            "macchanger",
            "gpio_library",
            "manual_override",
        ]
        for field in required_fields:
            if field not in new_config:
                return (
                    jsonify({"status": "error", "message": f"Missing field: {field}"}),
                    400,
                )

                return (
                    jsonify({"status": "error", "message": f"Missing field: {field}"}),
                    400,
                )

        # Validate GPIO library
        valid_libraries = [
            "auto",
            "gpiozero",
            "RPi.GPIO",
            "OPi.GPIO",
            "libgpiod",
            "lgpio",
            "wiringpi",
        ]
        valid_libraries = [
            "auto",
            "gpiozero",
            "RPi.GPIO",
            "OPi.GPIO",
            "libgpiod",
            "lgpio",
            "wiringpi",
        ]
        if new_config["gpio_library"] not in valid_libraries:
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": f"Invalid GPIO library. Must be one of: {', '.join(valid_libraries)}",
                    }
                ),
                400,
            )

            return (
                jsonify(
                    {
                        "status": "error",
                        "message": f"Invalid GPIO library. Must be one of: {', '.join(valid_libraries)}",
                    }
                ),
                400,
            )

        # Validate pin numbers
        if not (0 <= new_config["button_pin"] <= 40):
            return (
                jsonify(
                    {"status": "error", "message": "Button pin must be between 0-40"}
                ),
                400,
            )
            return (
                jsonify(
                    {"status": "error", "message": "Button pin must be between 0-40"}
                ),
                400,
            )
        if not (0 <= new_config["led_pin"] <= 40):
            return (
                jsonify({"status": "error", "message": "LED pin must be between 0-40"}),
                400,
            )
            return (
                jsonify({"status": "error", "message": "LED pin must be between 0-40"}),
                400,
            )
        if not (0 <= new_config["macchanger_pin"] <= 40):
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Macchanger button pin must be between 0-40",
                    }
                ),
                400,
            )
        if (
            new_config["button_pin"] == new_config["led_pin"]
            or new_config["button_pin"] == new_config["macchanger_pin"]
            or new_config["macchanger_pin"] == new_config["led_pin"]
        ):
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Button, LED and Macchanger pins must be different",
                    }
                ),
                400,
            )

            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Macchanger button pin must be between 0-40",
                    }
                ),
                400,
            )
        if (
            new_config["button_pin"] == new_config["led_pin"]
            or new_config["button_pin"] == new_config["macchanger_pin"]
            or new_config["macchanger_pin"] == new_config["led_pin"]
        ):
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Button, LED and Macchanger pins must be different",
                    }
                ),
                400,
            )

        # Save configuration
        if gpio_manager.save_config(new_config):
            logging.info(f"GPIO configuration updated: {new_config}")
            return jsonify(
                {
                    "status": "saved",
                    "message": "GPIO configuration updated successfully",
                }
            )
            return jsonify(
                {
                    "status": "saved",
                    "message": "GPIO configuration updated successfully",
                }
            )
        else:
            return (
                jsonify({"status": "error", "message": "Failed to save configuration"}),
                500,
            )

            return (
                jsonify({"status": "error", "message": "Failed to save configuration"}),
                500,
            )

    except Exception as e:
        logging.error(f"Failed to update GPIO config: {e}")
        return (
            jsonify({"status": "error", "message": f"Invalid configuration: {e}"}),
            400,
        )

        return (
            jsonify({"status": "error", "message": f"Invalid configuration: {e}"}),
            400,
        )


@app.route("/gpio_test", methods=["POST"])
def test_gpio():
    """Test GPIO configuration without saving."""
    try:
        test_config = request.get_json(force=True)


        # Temporarily update config
        original_config = gpio_manager.config.copy()
        gpio_manager.config.update(test_config)


        try:
            button, led, macchanger = gpio_manager.setup_gpio()
            if button and led and macchanger:
                # Test LED briefly
                led.on()
                import time


                time.sleep(0.5)
                led.off()


                result = {"status": "success", "message": "GPIO test successful"}
            else:
                result = {"status": "error", "message": "GPIO initialization failed"}
        finally:
            # Restore original config
            gpio_manager.config = original_config


        return jsonify(result)


    except Exception as e:
        logging.error(f"GPIO test failed: {e}")
        return jsonify({"status": "error", "message": f"GPIO test failed: {e}"}), 500


# -----------------------------------------------------
# Uncomment for GPIO testing without GPIOs


# -----------------------------------------------------
# Uncomment for GPIO testing without GPIOs
# -----------------------------------------------------
# from gpiozero.pins.mock import MockFactory
# from gpiozero import Device

# Device.pin_factory = MockFactory()

# from gpiozero import Button

# button = Button(17)

# def on_press():
#     print("Button pressed!")
# @app.route('/simulate')

# def simulate_press():
#     import time
#     button.pin.drive_high()
#     time.sleep(0.2)
#     button.pin.drive_low()
#     return "Simulated button press!"def on_press():
#     print("Button pressed!")
# @app.route('/simulate')

# # -----------------------------------------------------
# from gpiozero.pins.mock import MockFactory
# from gpiozero import Device

# Device.pin_factory = MockFactory()

# from gpiozero import Button

# button = Button(17)

# def on_press():
#     print("Button pressed!")
# @app.route('/simulate')

# def simulate_press():
#     import time
#     button.pin.drive_high()
#     time.sleep(0.2)
#     button.pin.drive_low()
#     return "Simulated button press!"def on_press():
#     print("Button pressed!")
# @app.route('/simulate')

# # -----------------------------------------------------
# Main entrypoint
# -----------------------------------------------------
if __name__ == "__main__":
    print("=== Octapus Web Server starting on 0.0.0.0:8080 ===")
    print("=== Serving frontend from:", FRONTEND_DIR, "===")


    apply_lgpio_patch_if_needed()


    init_gpio()

    socketio.run(app, host="0.0.0.0", port=8080, debug=False)

    socketio.run(app, host="0.0.0.0", port=8080, debug=False)
