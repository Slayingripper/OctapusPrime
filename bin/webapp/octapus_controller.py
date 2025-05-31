#!/usr/bin/env python3
import asyncio
import subprocess
import logging
import os
import sys
from queue import Queue  # <-- use a standard, thread‐safe Queue
from threading import Thread

# --- Configuration ---
BUTTON_PIN = 17
LED_PIN    = 27
LOG_FILE   = '/opt/octapus/logs/octapus.log'

# Shared thread‐safe queue for real-time log streaming
log_queue = Queue()

# --- Setup logging ---
log_dir = os.path.dirname(LOG_FILE)
if not os.path.exists(log_dir):
    try:
        os.makedirs(log_dir, exist_ok=True)
    except PermissionError:
        log_dir = None

if log_dir:
    try:
        logging.basicConfig(
            filename=LOG_FILE,
            level=logging.INFO,
            format='%(asctime)s %(message)s'
        )
    except Exception:
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s %(message)s'
        )
else:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s %(message)s'
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
        log_queue.put_nowait({'tool': tool, 'line': message})
    except Exception:
        pass


async def run_script(tool, cmd_args):
    """
    Execute the given CLI command and stream output lines.
    """
    log_and_queue('octapus', f"Starting {tool}: {' '.join(cmd_args)}")
    proc = await asyncio.create_subprocess_exec(
        *cmd_args,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT
    )
    while True:
        line = await proc.stdout.readline()
        if not line:
            break
        text = line.decode(errors='ignore').rstrip()
        log_and_queue(tool, text)
    await proc.wait()
    log_and_queue('octapus', f"Finished {tool}")


async def scan_sequence(scripts, led):
    """
    Run a dynamic list of scans in sequence, blinking LED while active (if available).
    `scripts` must be a list of dicts: {'tool': '<cmd>', 'args': ['arg1','arg2', ...]}.
    """
    if led:
        led.blink(on_time=0.2, off_time=0.2)

    for entry in scripts:
        tool = entry.get('tool')
        args = entry.get('args', [])
        if not tool or not isinstance(args, list):
            log_and_queue('octapus', f"Invalid script entry: {entry}")
            continue
        try:
            # The actual command run is [tool] + args
            await run_script(tool, [tool] + args)
        except Exception as e:
            log_and_queue(tool, f"Error: {e}")

    if led:
        led.off()
    log_and_queue('octapus', 'Dynamic scan sequence completed')


def start_scan_thread(scripts):
    """
    Helper to launch scan_sequence(...) in its own asyncio event loop.
    This function will be run in a separate Thread so it does not block Flask.
    """
    asyncio.run(scan_sequence(scripts, None))


async def controller():
    """
    Main controller loop: waits for button press to trigger a default scan list.
    """
    # Define your default sequence if the physical button is pressed:
    default_scripts = [
        {'tool': 'nmap', 'args': ['-sV', '192.168.1.0/24']},
        {'tool': 'masscan', 'args': ['192.168.1.0/24', '-p1-65535', '--rate=1000']},
    ]
    button, led = setup_gpio()
    if button:
        button.when_pressed = lambda: Thread(target=asyncio.run, args=(scan_sequence(default_scripts, led),), daemon=True).start()
        log_and_queue('octapus', 'Controller started; awaiting button press')
        await asyncio.Event().wait()
    else:
        log_and_queue('octapus', 'GPIO not available; cannot run controller.')


if __name__ == '__main__':
    # When you run `python octapus_controller.py scan`, it will run the default list
    if len(sys.argv) > 1 and sys.argv[1] == 'scan':
        default_scripts = [
            {'tool': 'nmap', 'args': ['-sV', '192.168.1.0/24']},
            {'tool': 'masscan', 'args': ['192.168.1.0/24', '-p1-65535', '--rate=1000']},
        ]
        asyncio.run(scan_sequence(default_scripts, None))
    else:
        asyncio.run(controller())
