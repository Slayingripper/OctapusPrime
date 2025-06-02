# octapus_controller.py
#!/usr/bin/env python3
import asyncio
import subprocess
import logging
import os
import sys
import ipaddress
import socket
import xml.etree.ElementTree as ET
from queue import Queue
from threading import Thread
from pathlib import Path
import gpiozero.pins.lgpio
import lgpio

# Determine base directory (where this script lives)
BASE_DIR = Path(__file__).resolve().parent
LOG_DIR = BASE_DIR / "logs"
SCENARIO_DIR = BASE_DIR / "scenarios"

def __patched_init(self, chip=None):
    gpiozero.pins.lgpio.LGPIOFactory.__bases__[0].__init__(self)
    chip = 0  # You can change the chip number if needed
    self._handle = lgpio.gpiochip_open(chip)
    self._chip = chip
    self.pin_class = gpiozero.pins.lgpio.LGPIOPin

gpiozero.pins.lgpio.LGPIOFactory.__init__ = __patched_init

# --- Configuration ---
BUTTON_PIN = 17
LED_PIN    = 27
LOG_FILE   = LOG_DIR / "octapus.log"

# Shared thread-safe queue for real-time log streaming
log_queue = Queue()

# Ensure directories exist
for d in (LOG_DIR, SCENARIO_DIR):
    if not d.exists():
        d.mkdir(parents=True, exist_ok=True)

# --- Setup logging ---
try:
    logging.basicConfig(
        filename=str(LOG_FILE),
        level=logging.INFO,
        format="%(asctime)s %(message)s",
    )
except Exception:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(message)s",
    )

# GPIOZero imports deferred to runtime
def setup_gpio():
    """Initialize GPIO button and LED; returns (button, led)."""
    try:
        from gpiozero import Button, LED
    except (ImportError, RuntimeError):
        return None, None
    try:
        button = Button(BUTTON_PIN, pull_up=True, bounce_time=0.1)
        led = LED(LED_PIN)
    except Exception as e:
        logging.warning(f"GPIO setup failed: {e}")
        return None, None
    return button, led

def log_and_queue(tool, message):
    """Log to file/console and enqueue message for web UI."""
    logging.info(f"[{tool}] {message}")
    try:
        log_queue.put_nowait({"tool": tool, "line": message})
    except Exception:
        pass

def get_local_cidr():
    """
    Determine local IP by opening a UDP socket to an external IP,
    then assume a /24 network for that IP.
    Returns CIDR string like '192.168.1.0/24'.
    """
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        network = ipaddress.IPv4Network(f"{local_ip}/24", strict=False)
        return str(network)
    except Exception as e:
        log_and_queue("octapus", f"Failed to detect local CIDR: {e}")
        return None

def parse_nmap_xml(xml_path):
    """
    Parse an Nmap XML output file to extract:
    - hosts with port 80 or 443 (web)
    - hosts with port 22 (ssh)
    - hosts with port 21 (ftp)
    Return dict:
      {
        'web': ['192.168.1.5', ...],
        'ssh': ['192.168.1.8', ...],
        'ftp': ['192.168.1.9', ...]
      }
    """
    results = {"web": [], "ssh": [], "ftp": []}
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
        for host in root.findall("host"):
            addr_el = host.find("address")
            if addr_el is None:
                continue
            ip = addr_el.get("addr")
            ports = host.find("ports")
            if ports is None:
                continue
            open_ports = [
                int(p.find("portid").text)
                for p in ports.findall("port")
                if p.find("state").get("state") == "open"
            ]
            if any(p in (80, 443) for p in open_ports):
                results["web"].append(ip)
            if 22 in open_ports:
                results["ssh"].append(ip)
            if 21 in open_ports:
                results["ftp"].append(ip)
    except Exception as e:
        log_and_queue("nmap", f"XML parse error: {e}")
    return results

async def run_script(tool, cmd_args, capture_output=None):
    """
    Execute the given CLI command and stream output lines.
    If capture_output is not None, capture lines in a list and return them.
    """
    log_and_queue("octapus", f"Starting {tool}: {' '.join(cmd_args)}")
    proc = await asyncio.create_subprocess_exec(
        *cmd_args,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    captured = [] if capture_output is not None else None
    while True:
        line = await proc.stdout.readline()
        if not line:
            break
        text = line.decode(errors="ignore").rstrip()
        log_and_queue(tool, text)
        if capture_output is not None:
            captured.append(text)
    await proc.wait()
    log_and_queue("octapus", f"Finished {tool}")
    return captured

async def dynamic_scan_sequence(initial_scripts, led):
    """
    Run a dynamic list of scans in sequence, blinking LED while active (if available).
    initial_scripts is a list of dicts: {'tool': '<cmd>', 'args': ['arg1','arg2', ...]}.
    After running nmap, parse results to enqueue dependent scans.
    """
    if led:
        led.blink(on_time=0.2, off_time=0.2)

    queue_list = list(initial_scripts)
    idx = 0

    while idx < len(queue_list):
        entry = queue_list[idx]
        tool = entry.get("tool")
        args = entry.get("args", [])
        if not tool or not isinstance(args, list):
            log_and_queue("octapus", f"Invalid entry, skipping: {entry}")
            idx += 1
            continue

        if tool == "nmap":
            xml_path = str(Path("/tmp") / f"octapus_nmap_{os.getpid()}.xml")
            cmd = ["nmap"] + args + ["-oX", xml_path]
            await run_script(tool, cmd)
            results = parse_nmap_xml(xml_path)
            for host in results["web"]:
                queue_list.append({
                    "tool": "gobuster",
                    "args": ["dir", "-u", f"http://{host}", "-w", "/usr/share/wordlists/dirb/common.txt", "-x", "php,txt"],
                })
                queue_list.append({
                    "tool": "nikto",
                    "args": ["-h", f"http://{host}"],
                })
                queue_list.append({
                    "tool": "sqlmap",
                    "args": ["-u", f"http://{host}/?id=1", "--batch", "--level", "5"],
                })
            for host in results["ssh"]:
                queue_list.append({
                    "tool": "hydra",
                    "args": ["-l", "root", "-P", "/usr/share/wordlists/rockyou.txt", "-t", "4", f"{host}", "ssh"],
                })
            for host in results["ftp"]:
                queue_list.append({
                    "tool": "hydra",
                    "args": ["-l", "anonymous", "-P", "/usr/share/wordlists/rockyou.txt", "-t", "4", f"{host}", "ftp"],
                })
            try:
                os.remove(xml_path)
            except OSError:
                pass
        else:
            await run_script(tool, [tool] + args)

        idx += 1

    if led:
        led.off()
    log_and_queue("octapus", "Full dynamic scan sequence completed")

async def scenario_scan_sequence(steps, led):
    """
    Run a user-defined scenario with conditional steps.
    Each step: {
      'tool': 'nmap',
      'args': ['-sV', '192.168.1.0/24'],
      'condition': { 'type': 'always' }
      OR
               { 'type': 'prev_contains', 'value': '<substring>' }
    }
    If condition is 'always', run unconditionally. If 'prev_contains', only run
    if previous step's captured output lines contain the given substring.
    """
    if led:
        led.blink(on_time=0.2, off_time=0.2)

    prev_output = []  # capture lines from previous tool
    for step in steps:
        tool = step.get("tool")
        args = step.get("args", [])
        cond = step.get("condition", {"type": "always"})

        should_run = False
        if cond.get("type") == "always":
            should_run = True
        elif cond.get("type") == "prev_contains":
            keyword = cond.get("value", "")
            if any(keyword in line for line in prev_output):
                should_run = True

        if not should_run:
            log_and_queue("octapus", f"Skipping {tool} due to condition: {cond}")
            prev_output = []
            continue

        if tool == "nmap":
            xml_path = str(Path("/tmp") / f"octapus_nmap_{os.getpid()}.xml")
            cmd = ["nmap"] + args + ["-oX", xml_path]
            await run_script(tool, cmd)
            prev_output = await run_script(tool, cmd, capture_output=[])
            try:
                os.remove(xml_path)
            except OSError:
                pass
        else:
            prev_output = await run_script(tool, [tool] + args, capture_output=[])

    if led:
        led.off()
    log_and_queue("octapus", "Scenario execution completed")

def start_scan_thread(scripts):
    """
    Helper to launch dynamic_scan_sequence(...) in its own asyncio event loop.
    This function runs in a separate Thread so it does not block Flask.
    """
    try:
        from gpiozero import LED
        led = LED(LED_PIN)
    except Exception:
        led = None
    asyncio.run(dynamic_scan_sequence(scripts, led))

def start_scenario_thread(steps):
    """
    Helper to launch scenario_scan_sequence(...) in its own asyncio event loop.
    """
    try:
        from gpiozero import LED
        led = LED(LED_PIN)
    except Exception:
        led = None
    asyncio.run(scenario_scan_sequence(steps, led))

async def controller():
    """
    Main controller loop: waits for button press to trigger a default scan list.
    """
    default_scripts = []
    cidr = get_local_cidr()
    if cidr:
        default_scripts.append({"tool": "nmap", "args": ["-sV", cidr]})
    default_scripts.append({"tool": "masscan", "args": [cidr or "127.0.0.1/32", "-p1-65535", "--rate=1000"]})

    button, led = setup_gpio()
    if button:
        button.when_pressed = lambda: Thread(target=start_scan_thread, args=(default_scripts,), daemon=True).start()
        log_and_queue("octapus", "Controller started; awaiting button press")
        await asyncio.Event().wait()
    else:
        log_and_queue("octapus", "GPIO not available; cannot run controller.")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "scan":
        default_scripts = []
        cidr = get_local_cidr()
        if cidr:
            default_scripts.append({"tool": "nmap", "args": ["-sV", cidr]})
        default_scripts.append({"tool": "masscan", "args": [cidr or "127.0.0.1/32", "-p1-65535", "--rate=1000"]})
        asyncio.run(dynamic_scan_sequence(default_scripts, None))
    else:
        asyncio.run(controller())
