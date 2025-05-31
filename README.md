# OctapusPrime One‐Touch Pentest Suite with Dark‐Mode Web UI

![Octapus Logo](logo.png)

**Octapus** is a headless pentesting appliance designed to run on a small ARM‐based board (e.g., Neo Pi running DietPi or Debian). It combines a suite of proven CLI tools (Nmap, Masscan, Gobuster, Nikto, SQLmap, Hydra, etc.) with:

- A **physical GPIO trigger** (push-button + LED) to launch a default scan sequence  
- A flexible, **drag-and-drop web interface** in full dark-mode “hacker” style for building and monitoring custom scan workflows  
- **Real-time log streaming** over WebSocket so you can see each tool’s output as it runs  
- A **thread-safe backend** that runs each scan asynchronously without blocking the web server  

With Octapus, you can either press a button to run a preconfigured scan suite, or point your browser at port 8080, drag tools and arguments into a list, click **Start**, and watch the output continuously in collapsible panels.  

---

## Table of Contents

1. [Features](#features)  
2. [Architecture Overview](#architecture-overview)  
3. [Prerequisites](#prerequisites)  
4. [Installation](#installation)  
   1. [System-Level Dependencies](#system-level-dependencies)  
   2. [Cloning & Directory Layout](#cloning--directory-layout)  
   3. [Python Virtual Environment & Packages](#python-virtual-environment--packages)  
   4. [Systemd Services](#systemd-services)  
   5. [(Optional) ZeroTier for Remote Access](#optional-zerotier-for-remote-access)  
5. [Usage](#usage)  
   1. [Physical Button Mode](#physical-button-mode)  
   2. [Web UI Mode](#web-ui-mode)  
   3. [Viewing Logs & Outputs](#viewing-logs--outputs)  
6. [Folder Structure](#folder-structure)  
7. [Customizing & Troubleshooting](#customizing--troubleshooting)  

---

## Features

- **CLI-Only Scanner Core**  
  - Uses Nmap, Masscan, Gobuster, Nikto, SQLmap, Hydra, etc., invoked via thin Python wrappers  
  - Fully dynamic: drag any combination of tools and arguments into a “scan schedule” from the web UI  
  - Preconfigured default scan suite (e.g., Nmap + Masscan over 192.168.1.0/24) triggered by a GPIO button  

- **Dark-Mode, Hacker-Style Web Interface**  
  - Drag-and-drop tool palette (left sidebar) with prebuilt “argument chips” for each tool  
  - Scheduled scan list (middle panel) where you can reorder, edit, or remove tools/args  
  - Live, collapsible output panels (bottom) showing real-time stdout from each tool, color‐coded  
  - Neon-green, monospace styling and subtle animations for that “terminal underground” feel  

- **Real-Time Log Streaming**  
  - A shared, thread-safe `queue.Queue` captures every line of stdout/stderr from all scans  
  - Flask-SocketIO emits each log line over WebSocket to any connected browser  
  - Each tool’s output is separated into its own “Output Card,” which expands/collapses on click  

- **Modular, Extensible Backend**  
  - `octapus_controller.py` manages GPIO monitoring (button + LED) and scan orchestration  
  - `server.py` hosts the Flask app + SocketIO WebSocket server on port 8080  
  - Clear separation between CLI runner threads, web server threads, and the log‐queue thread  
  - Easily extendable: add new tools to `tool-cards` in the UI and their argument chips, update `scan_sequence`  

- **Headless-Ready & Lightweight**  
  - No heavy web frameworks or databases; everything runs in a Python 3 venv  
  - GPIO access is deferred so the web server can run even on non-GPIO environments (e.g. remote testing)  
  - Minimal prerequisites beyond your standard Debian/DietPi packages + pip  

---

## Architecture Overview


┌──────────────┐          ┌───────────────────────┐          ┌──────────────┐
│  Physical    │          │                       │          │  CLI Tools   │
│  Button      │── GPIO ─▶│  octapus_controller   │── Thread ▶│ (nmap, masscan, │
│ (GPIO 17)    │          │    & Async Runner     │          │  gobuster, …) │
└──────────────┘          │                       │          └──────────────┘
                          │  (log_queue: Queue)   │
                          └─────────┬─────────────┘
                                    │
                                    │ log_queue.put(...)
                                    ▼
                          ┌───────────────────────┐       ┌─────────────────┐
                          │   octapus_web/server  │◀───┐  │   Browser / UI  │
                          │ (Flask + SocketIO)    │    │  │ (Dark-mode UI)  │
                          │   /start  /stop       │    └──▶  Drag/Drop    │
                          │   /socket.io websockets│▶ emit log lines └─────────┘
                          └───────────────────────┘


1. **Hardware Trigger**  
   - A momentary push-button wired to GPIO 17 on the Neo Pi, with internal pull-up.  
   - A status LED on GPIO 27 blinks to indicate an active scan in progress.

2. **Controller (octapus_controller.py)**  
   - Runs as a systemd service (Root user).  
   - In “button mode,” waits for a physical press to launch a default scan suite.  
   - Each scan is run inside its own `asyncio` coroutine via `subprocess.create_subprocess_exec()` to capture stdout.  
   - Every line of output is immediately pushed into a thread‐safe `queue.Queue` called `log_queue`.  

3. **Web Server (server.py)**  
   - Runs as a separate systemd service under a dedicated Python venv.  
   - Exposes:  
     - `GET /` → serves the `index.html` dark-mode UI  
     - `POST /start` → expects `{ "scripts": [ { tool, args }, … ] }`; spawns a new Thread that does `asyncio.run(scan_sequence(...))`  
     - `POST /stop` → stub (for future cancellation support)  
     - `Socket.IO /socket.io/` → a background thread continuously calls `log_queue.get()` and `socketio.emit("log", msg)`  
   - Because we use `async_mode="threading"`, the “emit” can run quickly as soon as a new log line appears.  

4. **Web UI (index.html + plain JS + Socket.IO client)**  
   - **Tool Palette (Sidebar)**: draggable cards for each tool (nmap, masscan, gobuster, nikto, sqlmap, hydra).  
   - **Argument Chips** under each tool: small `<div>`s (e.g. `-sV`, `-A`, `-T4` for Nmap) that can be dragged into a tool’s argument input.  
   - **Scheduled Scans (Middle Panel)**: drop zone where you drop tools; each scheduled item has:  
     - `<div class="tool-label">` showing the tool name  
     - `<input>` to hold arguments (drag-and-dropped chips append their text)  
     - Remove button (✕)  
   - **Controls**: Start (green neon) / Stop (red neon) buttons.  
   - **Output Area (Bottom)**: one “Output Card” per scheduled tool. Each card has:  
     - A neon-green header: `<tool> Output` with a ▶/▼ toggle arrow  
     - A dark scrollable `<div class="output-body">` where log lines appear in neon green font  
     - CSS animations (fadeIn, expand/collapse) to look like a slick hacker console.  

---

## Prerequisites

Before installing Octapus, ensure your Neo Pi (or Debian/DietPi system) meets the following requirements:

1. **Operating System**  
   - **DietPi (Debian-based)** or **Debian 12/Ubuntu 24**.  
   - Must have root/sudo privileges to install packages and configure systemd.

2. **System Packages** (install with `apt`)  
   ```bash
   sudo apt update
   sudo apt install -y \
     python3 \
     python3-pip \
     python3-venv \
     python3-dev \
     git \
     curl \
     build-essential \
     libssl-dev \
     libffi-dev \
     nmap \
     masscan \
     gobuster \
     nikto \
     sqlmap \
     hydra

3 # GPIO Libraries (if using GPIO button)  
   - For DietPi: `sudo apt install -y python3-rpi.gpio`  
   - For Debian/Ubuntu: `sudo apt install -y python3-rpi.gpio` (if available) or use `RPi.GPIO` from PyPI.
   - For other ARM boards, check your GPIO library compatibility.
   - For ZeroTier remote access (optional):
   - Install ZeroTier client:
   ```bash

curl -s https://install.zerotier.com | sudo bash
sudo zerotier-cli join <YOUR_NETWORK_ID>
```

4. **Python Packages**  
   - Install Flask, Flask-SocketIO, and other dependencies in a virtual environment (see below).
   - You can also install them globally, but using a virtual environment is recommended to avoid conflicts.
   - To install the required Python packages, run:
   ```bash
    python3 -m pip install --upgrade pip
    python3 -m pip install flask flask-socketio eventlet
    python3 -m pip install requests
    ```
5. **Network Configuration**
6. - Ensure your Neo Pi has a static IP or is reachable via hostname on your local network.
   - If using ZeroTier, ensure the device is connected to your ZeroTier network.
   - If you want to access the web UI remotely, ensure port 8080 is open in your firewall settings.
   - If using GPIO, ensure the button is connected to GPIO 17 and the LED to GPIO 27 (or modify the code to match your setup).
   - If you want to use the physical button, ensure it is connected to GPIO 17 with an internal pull-up resistor enabled in the code.
   - If you want to use the LED indicator, ensure it is connected to GPIO 27 (or modify the code to match your setup).