# OctapusPrime One‐Touch Pentest Suite 

![Octapus Logo](logo.png)

**OctapusPrime** is a headless pentesting appliance designed to run on a small ARM‐based board (e.g., Neo Pi running DietPi or Debian). It combines a comprehensive suite of proven CLI tools (Nmap, Masscan, Gobuster, Nikto, SQLmap, Hydra, SSLScan, Dirsearch, FFUF, AMASS, and many more) with:

- A **physical GPIO trigger** (push-button + LED) to launch a default scan sequence  
- A flexible, **drag-and-drop web interface** with interactive tooltips and command modals in full dark-mode "hacker" style for building and monitoring custom scan workflows  
- **Scenario saving and loading** for reusable scan configurations
- **Real-time log streaming** over WebSocket so you can see each tool's output as it runs  
- A **thread-safe backend** that runs each scan asynchronously without blocking the web server  
- An **octopus-themed landing page** with circuit board tentacles linking to different sections

With OctapusPrime, you can either press a button to run a preconfigured scan suite, or point your browser at port 8080, drag tools and arguments into a list, click **Start**, and watch the output continuously in collapsible panels.  

---

## Table of Contents

- [OctapusPrime One‐Touch Pentest Suite](#octapusprime-onetouch-pentest-suite)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Architecture Overview](#architecture-overview)
    - [Key Components:](#key-components)
  - [Prerequisites](#prerequisites)
    - [1. Operating System](#1-operating-system)
    - [2. System Packages](#2-system-packages)
    - [3. GPIO Libraries (for physical button - optional)](#3-gpio-libraries-for-physical-button---optional)
    - [4. ZeroTier (for remote access - optional)](#4-zerotier-for-remote-access---optional)
    - [5. Python Dependencies](#5-python-dependencies)
    - [6. Network Configuration](#6-network-configuration)
  - [Installation](#installation)
    - [1. System-Level Dependencies](#1-system-level-dependencies)
    - [2. Cloning \& Directory Layout](#2-cloning--directory-layout)
    - [3. Python Virtual Environment \& Packages](#3-python-virtual-environment--packages)
    - [4. Systemd Services](#4-systemd-services)
    - [5. (Optional) ZeroTier for Remote Access](#5-optional-zerotier-for-remote-access)
  - [Usage](#usage)
    - [Physical Button Mode](#physical-button-mode)
    - [Web UI Mode](#web-ui-mode)
      - [Dashboard Features:](#dashboard-features)
      - [Interactive Features:](#interactive-features)
    - [Viewing Logs \& Outputs](#viewing-logs--outputs)
  - [Folder Structure](#folder-structure)
  - [Customizing \& Troubleshooting](#customizing--troubleshooting)
    - [Adding New Tools](#adding-new-tools)
    - [Common Issues](#common-issues)
    - [Performance Tuning](#performance-tuning)
    - [Debugging](#debugging)
  - [Contributing](#contributing)
  - [License](#license)
  - [Disclaimer](#disclaimer)

---

## Features

- **Comprehensive CLI-Based Scanner Core**  
  - Uses 18+ pentesting tools: Nmap, Masscan, Gobuster, Nikto, SQLmap, Hydra, SSLScan, Dirsearch, Enum4Linux, NBTSCAN, TheHarvester, WPScan, FFUF, AMASS, DNSenum, Subfinder, John, Hashcat  
  - Fully dynamic: drag any combination of tools and arguments into a "scan schedule" from the web UI  
  - Interactive command discovery: double-click any tool to see all available commands with descriptions
  - Preconfigured default scan suite (e.g., Nmap + Masscan over 192.168.1.0/24) triggered by a GPIO button  

- **Advanced Dark-Mode Web Interface**  
  - **Octopus-themed landing page** with animated circuit board tentacles linking to dashboard, scenario maker, settings, logs, help, about, updates, and demo
  - **Tool palette** (left sidebar) with 18+ tools, each containing 6-9 draggable "argument chips"
  - **Interactive tooltips** explaining what each tool does when hovering
  - **Command modal system**: double-click any tool to see comprehensive command examples with descriptions
  - **Scenario management**: save and load reusable scan configurations
  - **Scheduled scan list** (middle panel) with longer input fields for complex arguments
  - **Live, collapsible output panels** showing real-time stdout from each tool, color‐coded  
  - **Auto-detect local network** button for quick CIDR-based scanning
  - Neon-green, monospace styling with subtle animations and responsive design

- **Enhanced Real-Time Features**  
  - Thread-safe `queue.Queue` captures every line of stdout/stderr from all scans  
  - Flask-SocketIO emits each log line over WebSocket to any connected browser  
  - Each tool's output separated into expandable "Output Cards"
  - **Scenario persistence**: JSON-based storage for reusable scan workflows
  - **Live status updates** and progress monitoring

- **Modular, Production-Ready Backend**  
  - `octapus_controller.py` manages GPIO monitoring and scan orchestration  
  - `server.py` hosts Flask app + SocketIO WebSocket server on port 8080  
  - Robust error handling and logging throughout
  - **Scenario API endpoints**: `/save_scenario`, `/load_scenario/<name>`, `/list_scenarios`
  - **Network detection**: `/local_cidr` endpoint for automatic network discovery
  - Clear separation between CLI runner threads, web server threads, and log‐queue management

- **Professional UI/UX Design**  
  - **Responsive tooltip system** with text wrapping for any screen size
  - **Circuit board aesthetic** with animated octopus head and pulsing effects
  - **Multi-page architecture**: dedicated pages for different functions
  - **Enhanced drag-and-drop**: supports both tool dragging and individual argument chips
  - **Professional color scheme**: neon green (#39ff14) on dark backgrounds with subtle gradients

---

## Architecture Overview

```
┌──────────────┐          ┌───────────────────────┐          ┌──────────────────┐
│  Physical    │          │                       │          │  CLI Tools       │
│  Button      │── GPIO ─▶│  octapus_controller   │── Thread ▶│ (nmap, masscan,  │
│ (GPIO 17)    │          │    & Async Runner     │          │  gobuster, nikto,│
└──────────────┘          │                       │          │  sqlmap, hydra, │
                          │  (log_queue: Queue)   │          │  sslscan, ffuf,  │
                          └─────────┬─────────────┘          │  amass, john...) │
                                    │                        └──────────────────┘
                                    │ log_queue.put(...)
                                    ▼
                          ┌───────────────────────┐       ┌─────────────────────┐
                          │   server.py           │◀───┐  │   Browser / UI      │
                          │ (Flask + SocketIO)    │    │  │ ┌─────────────────┐ │
                          │   /                   │    │  │ │ Landing Page    │ │
                          │   /dashboard          │    │  │ │ (Octopus Theme) │ │
                          │   /scenario_maker     │    │  │ └─────────────────┘ │
                          │   /start  /stop       │    │  │ ┌─────────────────┐ │
                          │   /save_scenario      │    └──▶ │ Dashboard       │ │
                          │   /load_scenario      │       │ │ (Drag/Drop UI)  │ │
                          │   /list_scenarios     │       │ └─────────────────┘ │
                          │   /local_cidr         │       │ ┌─────────────────┐ │
                          │   /socket.io          │▶ emit │ │ Real-time Logs  │ │
                          └───────────────────────┘  logs └─────────────────────┘
```

### Key Components:

1. **Landing Page (`landing.html`)**
   - Octopus-themed welcome page with animated circuit board design
   - Eight tentacles linking to different sections: Dashboard, Scenario Maker, Settings, Logs, Help, About, Updates, Demo
   - Responsive SVG graphics with hover effects and tooltips

2. **Dashboard (`index.html`)**  
   - **Tool Palette**: 18+ pentesting tools with draggable argument chips
   - **Interactive Features**: hover tooltips, double-click command modals
   - **Scenario Management**: save/load reusable configurations
   - **Live Output**: real-time tool execution monitoring

3. **Backend Controller**  
   - Hardware GPIO integration for physical button triggering
   - Asynchronous tool execution with real-time log capture
   - RESTful API endpoints for web interface communication
   - Thread-safe queue management for multi-tool coordination

---

## Prerequisites

Before installing OctapusPrime, ensure your system meets the following requirements:

### 1. Operating System
- **DietPi (Debian-based)**, **Debian 12**, or **Ubuntu 24.04**
- Root/sudo privileges for package installation and systemd configuration

### 2. System Packages
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
  hydra \
  sslscan \
  dirb \
  dirsearch \
  enum4linux \
  nbtscan \
  theharvester \
  wpscan \
  ffuf \
  amass \
  dnsenum \
  subfinder \
  john \
  hashcat
```

### 3. GPIO Libraries (for physical button - optional)
```bash
# For Raspberry Pi/compatible boards
sudo apt install -y python3-rpi.gpio

# Alternative: install via pip in virtual environment
pip install RPi.GPIO
```

### 4. ZeroTier (for remote access - optional)
```bash
curl -s https://install.zerotier.com | sudo bash
sudo zerotier-cli join <YOUR_NETWORK_ID>
```

### 5. Python Dependencies
Will be installed in virtual environment during setup:
```bash
# Core web framework
flask
flask-socketio
eventlet

# Utility libraries
requests
psutil
netifaces
```

### 6. Network Configuration
- Ensure device has static IP or discoverable hostname
- Port 8080 accessible for web interface
- GPIO pins 17 (button) and 27 (LED) available if using hardware features

---

## Installation

### 1. System-Level Dependencies
```bash
# Update system and install required packages
sudo apt update && sudo apt upgrade -y

# Install core system packages
sudo apt install -y python3 python3-pip python3-venv python3-dev git curl \
  build-essential libssl-dev libffi-dev

# Install pentesting tools
sudo apt install -y nmap masscan gobuster nikto sqlmap hydra sslscan \
  dirb enum4linux nbtscan theharvester wpscan ffuf john hashcat

# Install additional tools (may require additional repos)
# amass, dnsenum, subfinder, dirsearch - check your distro's availability
```

### 2. Cloning & Directory Layout
```bash
# Clone the repository
git clone https://github.com/slayingripper/OctapusPrime.git
cd OctapusPrime

# Verify directory structure
ls -la
# Should show: bin/, docs/, scenarios/, logs/, README.md, etc.
```

### 3. Python Virtual Environment & Packages
```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Upgrade pip and install dependencies
pip install --upgrade pip
pip install flask flask-socketio eventlet requests psutil netifaces

# If using GPIO features
pip install RPi.GPIO  # or python3-rpi.gpio via apt

# Verify installation
python3 -c "import flask, flask_socketio; print('Dependencies OK')"
```

### 4. Systemd Services
```bash
# Copy service files (adjust paths as needed)
sudo cp systemd/octapus-controller.service /etc/systemd/system/
sudo cp systemd/octapus-web.service /etc/systemd/system/

# Edit service files to match your installation path
sudo nano /etc/systemd/system/octapus-controller.service
sudo nano /etc/systemd/system/octapus-web.service

# Reload systemd and enable services
sudo systemctl daemon-reload
sudo systemctl enable octapus-controller.service
sudo systemctl enable octapus-web.service

# Start services
sudo systemctl start octapus-controller.service
sudo systemctl start octapus-web.service

# Check status
sudo systemctl status octapus-controller.service
sudo systemctl status octapus-web.service
```

### 5. (Optional) ZeroTier for Remote Access
```bash
# Install ZeroTier client
curl -s https://install.zerotier.com | sudo bash

# Join your network (replace with your network ID)
sudo zerotier-cli join YOUR_NETWORK_ID

# Verify connection
sudo zerotier-cli status
sudo zerotier-cli listnetworks
```

---

## Usage

### Physical Button Mode
1. **Hardware Setup**: Connect a momentary push-button to GPIO 17 and LED to GPIO 27
2. **Default Scan**: Press button to trigger preconfigured network scan
3. **LED Feedback**: LED indicates scan progress (blinking = active, solid = complete)

### Web UI Mode
1. **Access Interface**: Navigate to `http://[device-ip]:8080`
2. **Landing Page**: Interactive octopus design with tentacle navigation
3. **Dashboard Access**: Click "DASHBOARD" tentacle or navigate to `/dashboard`

#### Dashboard Features:
- **Tool Selection**: Drag tools from left palette to center dropzone
- **Argument Configuration**: 
  - Drag individual argument chips to tool inputs
  - Double-click tools for comprehensive command reference
  - Type custom arguments directly in input fields
- **Scenario Management**:
  - Save current configuration with custom name
  - Load previously saved scenarios from dropdown
- **Execution Control**: Start/Stop buttons with real-time status
- **Network Discovery**: "Use Local Network" auto-detects CIDR range

#### Interactive Features:
- **Tooltips**: Hover over tools for descriptions
- **Command Modal**: Double-click tools for full command reference
- **Live Output**: Expandable panels showing real-time tool execution
- **Responsive Design**: Adapts to different screen sizes

### Viewing Logs & Outputs
- **Real-time Display**: Tool outputs appear immediately in web interface
- **Expandable Cards**: Click headers to expand/collapse output panels
- **Color Coding**: Different tools have distinct visual styling
- **Scroll Management**: Auto-scroll to latest output when expanded

---

## Folder Structure

```
OctapusPrime/
├── bin/
│   ├── octapus_controller.py    # GPIO controller & scan orchestration
│   └── webapp/
│       ├── server.py            # Flask web server + SocketIO
│       └── frontend/
│           ├── landing.html     # Octopus-themed landing page
│           └── index.html       # Main dashboard interface
├── scenarios/                   # Saved scan configurations (JSON)
├── logs/                       # Historical scan outputs
├── systemd/                    # Service configuration files
├── docs/                       # Additional documentation
├── venv/                       # Python virtual environment
└── README.md                   # This file
```

---

## Customizing & Troubleshooting

### Adding New Tools
1. **Update Tool Palette**: Add new tool card in `index.html` with appropriate tooltip
2. **Add Command Database**: Extend `toolCommands` object with tool's command examples
3. **Update Argument Chips**: Add common arguments as draggable chips
4. **Test Integration**: Verify tool execution through web interface

### Common Issues
- **Port 8080 in use**: Check for conflicting services with `sudo netstat -tlnp | grep 8080`
- **GPIO permissions**: Ensure user has GPIO access or run controller as root
- **Tool not found**: Verify all pentesting tools are installed and in PATH
- **WebSocket connection fails**: Check firewall settings and network connectivity

### Performance Tuning
- **Thread Limits**: Adjust concurrent tool execution in controller
- **Memory Usage**: Monitor with `htop` during large scans
- **Network Bandwidth**: Consider rate limiting for network-intensive tools

### Debugging
```bash
# Check service logs
sudo journalctl -u octapus-web.service -f
sudo journalctl -u octapus-controller.service -f

# Manual testing
cd /path/to/OctapusPrime
source venv/bin/activate
python3 bin/webapp/server.py  # Test web server directly
```

---

## Contributing

OctapusPrime is open-source and welcomes contributions:
- **Bug Reports**: Submit issues via GitHub
- **Feature Requests**: Propose new tools or UI enhancements  
- **Pull Requests**: Follow existing code style and include tests
- **Documentation**: Help improve setup guides and usage examples

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## Disclaimer

OctapusPrime is intended for authorized security testing and educational purposes only. Users are responsible for ensuring compliance with applicable laws and regulations. The developers assume no liability for misuse of this software.