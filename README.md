# OctapusPrime One‐Touch Pentest Suite 

![Octapus Logo](logo.png)

**OctapusPrime** is a headless pentesting appliance designed to run on a small ARM‐based board (e.g., Neo Pi running DietPi or Debian). It combines a comprehensive suite of proven CLI tools with an advanced **IFTTT (If-This-Then-That) scenario builder** featuring intelligent conditional execution, dynamic variable extraction, and real-time automation.

**Enhanced Features:**
- **40+ Security Tools** organized by category (Network Discovery, Web Testing, Vulnerability Scanning, etc.)
- **Advanced IFTTT Scenario Builder** with conditional logic and variable extraction
- **Dynamic Variable System** with regex-based data extraction and substitution
- **Enhanced Web Interface** with real-time scenario execution monitoring
- **Example Scenarios Library** with pre-built penetration testing workflows
- **Physical GPIO trigger** (push-button + LED) for remote scan execution
- **Professional dark-mode interface** with octopus-themed design

With OctapusPrime, you can create sophisticated adaptive penetration testing workflows that intelligently respond to scan results and automatically adjust their behavior based on discovered services, open ports, and extracted data.

---

## Table of Contents

- [OctapusPrime One‐Touch Pentest Suite](#octapusprime-onetouch-pentest-suite)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Architecture Overview](#architecture-overview)
    - [Key Components:](#key-components)
  - [Prerequisites](#prerequisites)
    - [1. Operating System](#1-operating-system)
    - [2. Complete Security Tools Installation](#2-complete-security-tools-installation)
    - [3. GPIO Libraries (for physical button - optional)](#3-gpio-libraries-for-physical-button---optional)
    - [4. ZeroTier (for remote access - optional)](#4-zerotier-for-remote-access---optional)
    - [5. Python Dependencies](#5-python-dependencies)
    - [6. Network Configuration](#6-network-configuration)
  - [Installation](#installation)
    - [1. System-Level Dependencies](#1-system-level-dependencies)
    - [2. Complete Security Tools Installation](#2-complete-security-tools-installation-1)
    - [3. Specialized Tools Installation](#3-specialized-tools-installation)
    - [4. Cloning \& Directory Layout](#4-cloning--directory-layout)
    - [5. Python Virtual Environment \& Packages](#5-python-virtual-environment--packages)
    - [6. Systemd Services](#6-systemd-services)
  - [Usage](#usage)
    - [Enhanced Scenario Builder](#enhanced-scenario-builder)
    - [IFTTT Logic System](#ifttt-logic-system)
    - [Variable System](#variable-system)
    - [Physical Button Mode](#physical-button-mode)
    - [Web UI Mode](#web-ui-mode)
      - [Dashboard Features:](#dashboard-features)
      - [Interactive Features:](#interactive-features)
    - [Viewing Logs \& Outputs](#viewing-logs--outputs)
  - [Folder Structure](#folder-structure)
  - [Security Tools Reference](#security-tools-reference)
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

- **Comprehensive 40+ Security Tools Suite**  
  - **Network Discovery:** Nmap, Masscan, Zmap, Amass, Subfinder
  - **Web Application Testing:** Gobuster, FFuF, Feroxbuster, Nikto, WhatWeb, SQLMap, Nuclei
  - **Vulnerability Scanning:** Nuclei, Trivy, TestSSL
  - **Credential Attacks:** Hydra, John the Ripper, Hashcat
  - **Information Gathering:** TheHarvester, Amass, Subfinder, Shodan
  - **Enumeration:** Enum4linux, NBTScan, LDAP Search, SNMP Check, SMB Client
  - **Specialized Tools:** EyeWitness, GitLeaks, and more

- **Advanced IFTTT Scenario Builder**  
  - **Conditional Logic:** IF-THEN execution based on previous step results
  - **Variable Extraction:** Regex-based data capture from tool outputs
  - **Dynamic Substitution:** Real-time variable replacement in arguments
  - **Example Scenarios:** Pre-built workflows for common penetration testing methodologies
  - **Scenario Management:** Save, load, and share complex testing workflows
  - **Validation System:** Real-time argument and variable validation

- **Enhanced Web Interface**  
  - **Modern Dark Theme:** Professional security-focused design
  - **Tool Categories:** Organized tool selection with descriptions
  - **Real-time Execution:** Live progress monitoring and log streaming
  - **Variable Picker:** Visual variable selection and management
  - **Keyboard Shortcuts:** Productivity enhancements for power users
  - **Responsive Design:** Works on desktop, tablet, and mobile devices

- **Professional Backend Architecture**  
  - **Thread-safe Execution:** Parallel tool execution with proper resource management
  - **WebSocket Communication:** Real-time bidirectional communication
  - **RESTful API:** Complete API for automation and integration
  - **Error Handling:** Comprehensive error recovery and reporting
  - **Logging System:** Detailed execution logs and debugging information

---

## Architecture Overview

```
┌──────────────┐          ┌───────────────────────┐          ┌──────────────────┐
│  Physical    │          │                       │          │  40+ CLI Tools   │
│  Button      │── GPIO ─▶│  Enhanced Controller  │── Thread ▶│ Network Discovery│
│ (GPIO 17)    │          │  & IFTTT Engine       │          │ Web Testing     │
└──────────────┘          │                       │          │ Vuln Scanning   │
                          │  Variable Extraction  │          │ Credential Attacks│
                          │  Conditional Logic    │          │ Info Gathering  │
                          └─────────┬─────────────┘          │ Enumeration     │
                                    │                        └──────────────────┘
                                    │ WebSocket + REST API
                                    ▼
                          ┌───────────────────────┐       ┌─────────────────────┐
                          │   Enhanced Server     │◀───┐  │   Enhanced Web UI   │
                          │ (Flask + SocketIO)    │    │  │ ┌─────────────────┐ │
                          │   Scenario Builder    │    │  │ │ IFTTT Builder   │ │
                          │   Variable System     │    │  │ │ Variable System │ │
                          │   Example Library     │    │  │ └─────────────────┘ │
                          │   Real-time Execution │    │  │ ┌─────────────────┐ │
                          │   /api/run_scenario   │    └──▶ │ Live Monitoring │ │
                          │   /load_scenario      │       │ │ Progress Tracking│ │
                          │   /list_scenarios     │       │ └─────────────────┘ │
                          └───────────────────────┘       └─────────────────────┘
```

### Key Components:

1. **Enhanced Scenario Builder**
   - IFTTT conditional logic system
   - Variable extraction with regex patterns
   - Tool templates and argument validation
   - Example scenario library

2. **Variable System**
   - Dynamic parameter substitution
   - Regex-based data extraction
   - Built-in and custom variables
   - Real-time variable validation

3. **Advanced Tool Integration**
   - 40+ categorized security tools
   - Tool-specific templates and examples
   - Intelligent argument completion
   - Performance optimization

---

## Prerequisites

Before installing OctapusPrime, ensure your system meets the following requirements:

### 1. Operating System
- **DietPi (Debian-based)**, **Debian 12**, **Ubuntu 22.04/24.04**, or **Kali Linux**
- Root/sudo privileges for package installation and systemd configuration
- At least 4GB RAM recommended for large scans
- 20GB+ storage for tools and scan results

### 2. Complete Security Tools Installation

**Core System Packages:**
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y \
  python3 \
  python3-pip \
  python3-venv \
  python3-dev \
  git \
  curl \
  wget \
  build-essential \
  libssl-dev \
  libffi-dev \
  software-properties-common \
  apt-transport-https \
  ca-certificates \
  gnupg \
  lsb-release
```

### 3. GPIO Libraries (for physical button - optional)
```bash
# For Raspberry Pi/compatible boards
sudo apt install -y python3-rpi.gpio python3-gpiozero

# Alternative GPIO libraries
sudo apt install -y python3-lgpio
```

### 4. ZeroTier (for remote access - optional)
```bash
curl -s https://install.zerotier.com | sudo bash
sudo zerotier-cli join <YOUR_NETWORK_ID>
```

### 5. Python Dependencies
Will be installed in virtual environment during setup:
```bash
# Core requirements (from requirements.txt)
Flask
Flask-SocketIO
eventlet
python-socketio
python-engineio
aiohttp
gpiozero
lgpio
requests
```

### 6. Network Configuration
- Static IP or discoverable hostname recommended
- Port 8080 accessible for web interface
- GPIO pins 17 (button) and 27 (LED) available if using hardware features
- Internet access for tool updates and vulnerability databases

---

## Installation

### 1. System-Level Dependencies
```bash
# Update system and install core packages
sudo apt update && sudo apt upgrade -y

# Install essential build tools and libraries
sudo apt install -y \
  python3 python3-pip python3-venv python3-dev \
  git curl wget build-essential \
  libssl-dev libffi-dev libxml2-dev libxslt1-dev \
  zlib1g-dev libjpeg-dev libpng-dev \
  software-properties-common apt-transport-https \
  ca-certificates gnupg lsb-release
```

### 2. Complete Security Tools Installation

**Network Discovery & Scanning:**
```bash
# Core network tools
sudo apt install -y nmap masscan zmap

# Advanced discovery tools
sudo apt install -y amass subfinder theharvester

# DNS enumeration
sudo apt install -y dnsutils dnsenum fierce
```

**Web Application Testing:**
```bash
# Directory/file enumeration
sudo apt install -y gobuster dirb dirsearch

# Web fuzzers
sudo apt install -y ffuf feroxbuster

# Web vulnerability scanners
sudo apt install -y nikto whatweb sqlmap

# Template-based scanner
go install -v github.com/projectdiscovery/nuclei/v2/cmd/nuclei@latest
```

**Vulnerability & SSL Testing:**
```bash
# SSL/TLS testing
sudo apt install -y testssl.sh sslscan

# Container vulnerability scanning
sudo apt install -y trivy

# General vulnerability scanning
sudo apt install -y openvas-scanner
```

**Credential Attacks:**
```bash
# Brute force tools
sudo apt install -y hydra medusa patator

# Password cracking
sudo apt install -y john hashcat
```

**Information Gathering:**
```bash
# OSINT tools
sudo apt install -y theharvester maltego-teeth

# Social engineering
sudo apt install -y set

# Shodan CLI
pip3 install shodan
```

**Enumeration Tools:**
```bash
# SMB/NetBIOS enumeration
sudo apt install -y enum4linux nbtscan smbclient

# LDAP enumeration
sudo apt install -y ldap-utils

# SNMP enumeration
sudo apt install -y snmp snmp-mibs-downloader

# Database tools
sudo apt install -y postgresql-client mysql-client
```

### 3. Specialized Tools Installation

**Go-based Tools:**
```bash
# Install Go if not present
sudo apt install -y golang-go

# Install Go-based security tools
go install -v github.com/projectdiscovery/nuclei/v2/cmd/nuclei@latest
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest
go install -v github.com/projectdiscovery/naabu/v2/cmd/naabu@latest
go install -v github.com/tomnomnom/gf@latest
go install -v github.com/tomnomnom/waybackurls@latest

# Add Go bin to PATH
echo 'export PATH=$PATH:~/go/bin' >> ~/.bashrc
source ~/.bashrc
```

**Python-based Tools:**
```bash
# Install additional Python tools
pip3 install --user \
  shodan \
  truffleHog \
  gitpython \
  requests \
  beautifulsoup4 \
  selenium \
  pycryptodome

# EyeWitness dependencies
sudo apt install -y chromium-browser
git clone https://github.com/FortyNorthSecurity/EyeWitness.git /opt/EyeWitness
cd /opt/EyeWitness/Python/setup
sudo ./setup.sh
```

**Additional Specialized Tools:**
```bash
# GitLeaks for secret detection
sudo wget -O /usr/local/bin/gitleaks \
  https://github.com/zricethezav/gitleaks/releases/latest/download/gitleaks_linux_amd64
sudo chmod +x /usr/local/bin/gitleaks

# Feroxbuster (if not in repos)
curl -sL https://raw.githubusercontent.com/epi052/feroxbuster/master/install-nix.sh | bash

# Ensure all tools are in PATH
sudo ln -sf ~/go/bin/* /usr/local/bin/ 2>/dev/null || true
```

**Tool Verification:**
```bash
# Verify installation of key tools
echo "Verifying tool installation..."
for tool in nmap masscan gobuster ffuf nikto sqlmap hydra john hashcat \
            amass subfinder nuclei testssl.sh trivy gitleaks feroxbuster \
            enum4linux nbtscan theharvester whatweb; do
  if command -v $tool >/dev/null 2>&1; then
    echo "✓ $tool installed"
  else
    echo "✗ $tool missing"
  fi
done
```

### 4. Cloning & Directory Layout
```bash
# Clone the repository
git clone https://github.com/slayingripper/OctapusPrime.git
cd OctapusPrime

# Create necessary directories
mkdir -p scenarios logs outputs

# Set appropriate permissions
chmod +x bin/octapus_controller.py
chmod +x bin/webapp/server.py

# Verify directory structure
ls -la
# Should show: bin/, scenarios/, logs/, README.md, requirements.txt, etc.
```

### 5. Python Virtual Environment & Packages
```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Install additional packages for enhanced features
pip install \
  jsonschema \
  python-dateutil \
  psutil \
  netifaces

# If using GPIO features
pip install RPi.GPIO gpiozero lgpio

# Verify installation
python3 -c "
import flask, flask_socketio, requests
print('✓ Core dependencies installed successfully')
"
```

### 6. Systemd Services
```bash
# Create systemd service files
sudo tee /etc/systemd/system/octapus-controller.service > /dev/null <<EOF
[Unit]
Description=OctapusPrime Controller Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)
Environment=PATH=$(pwd)/venv/bin
ExecStart=$(pwd)/venv/bin/python bin/octapus_controller.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/octapus-web.service > /dev/null <<EOF
[Unit]
Description=OctapusPrime Web Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)
Environment=PATH=$(pwd)/venv/bin
ExecStart=$(pwd)/venv/bin/python bin/webapp/server.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

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

**Alternative: Running Without Systemd Services**

For development, testing, or temporary usage, you can run OctapusPrime directly without installing systemd services:

```bash
# Activate virtual environment
source venv/bin/activate

# Run web server directly (will start on http://localhost:8080)
python3 bin/webapp/server.py

# In another terminal, run the GPIO controller (optional)
source venv/bin/activate
python3 bin/octapus_controller.py
```

**Benefits of direct execution:**
- **Quick Testing**: Immediate startup without service configuration
- **Development Mode**: Easy debugging with direct console output
- **Temporary Usage**: No permanent system changes
- **Custom Configuration**: Easy to modify startup parameters

**Note**: Running directly will only be active while your terminal session is open. For production deployments, systemd services are recommended for automatic startup and proper daemon management.
````markdown

## Usage

### Enhanced Scenario Builder
1. **Access Builder**: Navigate to `/scenario` from the main interface
2. **Create Scenarios**: Use the visual IFTTT builder to create complex workflows
3. **Add Steps**: Select tools from categorized dropdown menus
4. **Configure Logic**: Set IF-THEN conditions for adaptive execution
5. **Extract Variables**: Use regex patterns to capture data from tool outputs
6. **Save & Load**: Manage reusable scenario libraries

### IFTTT Logic System
**Condition Types:**
- **Always Execute**: Runs unconditionally
- **Previous Step Contains**: Execute if output contains specific text
- **Previous Step Matches Regex**: Execute if output matches regex pattern
- **Variable Exists**: Execute if a variable has been set
- **Variable Equals**: Execute if variable equals specific value
- **Previous Step Success/Failure**: Execute based on exit status

**Example Workflow:**
```
Step 1: Nmap port scan (Always)
        → Extract web_ports: (\d+)/tcp\s+open\s+http

Step 2: Gobuster directory scan (IF web_ports exists)
        → Use discovered ports for targeted scanning

Step 3: Nuclei vulnerability scan (IF directories found)
        → Focus on discovered web applications
```

### Variable System
**Built-in Variables:**
- `{target}`: Primary scan target
- `{network}`: Network range
- `{timestamp}`: Current timestamp
- `{scan_id}`: Unique scan identifier

**Custom Variables:**
- Extract using regex patterns from tool output
- Use in subsequent tool arguments
- Real-time substitution and validation

### Physical Button Mode
1. **Hardware Setup**: Connect momentary button to GPIO 17, LED to GPIO 27
2. **Default Scan**: Press button to trigger preconfigured scan sequence
3. **LED Feedback**: Visual indication of scan progress and completion

### Web UI Mode
1. **Landing Page**: Navigate to `http://[device-ip]:8080`
2. **Enhanced Dashboard**: Access full tool suite and scenario builder
3. **Real-time Monitoring**: Watch execution progress and extract variables

#### Dashboard Features:
- **40+ Categorized Tools**: Organized by function and use case
- **IFTTT Scenario Builder**: Visual workflow creation
- **Variable Management**: Dynamic parameter system
- **Example Scenarios**: Pre-built penetration testing workflows
- **Real-time Execution**: Live progress monitoring and log streaming

#### Interactive Features:
- **Tool Templates**: Pre-configured argument sets for common tasks
- **Variable Picker**: Visual variable selection and management
- **Condition Builder**: Drag-and-drop IF-THEN logic creation
- **Regex Helper**: Pattern testing and validation tools
- **Keyboard Shortcuts**: Power-user productivity features

### Viewing Logs & Outputs
- **Real-time Display**: Tool outputs stream live to web interface
- **Variable Extraction**: Watch variables being captured from outputs
- **Conditional Execution**: See IF-THEN logic decisions in real-time
- **Historical Logs**: Access previous scan results and extracted data

---

## Folder Structure

```
OctapusPrime/
├── bin/
│   ├── octapus_controller.py       # Enhanced GPIO controller
│   └── webapp/
│       ├── server.py               # Flask server with scenario API
│       ├── static/
│       │   ├── css/               # Enhanced styling
│       │   └── js/                # IFTTT logic and variable system
│       └── frontend/
│           ├── landing.html        # Octopus-themed landing page
│           ├── index.html          # Tool dashboard
│           ├── scenario.html       # IFTTT scenario builder
│           └── help.html           # Comprehensive documentation
├── scenarios/                      # Saved IFTTT scenarios (JSON)
│   ├── examples/                   # Pre-built example scenarios
│   └── user/                       # User-created scenarios
├── logs/                          # Execution logs and outputs
├── outputs/                       # Tool-specific output files
├── templates/                     # Tool argument templates
├── systemd/                       # Enhanced service configurations
├── docs/                          # Additional documentation
├── venv/                          # Python virtual environment
├── requirements.txt               # Python dependencies
└── README.md                      # This comprehensive guide
```

---

## Security Tools Reference

**Network Discovery & Scanning (5 tools):**
- `nmap` - Network exploration and security auditing
- `masscan` - High-speed Internet-scale port scanner
- `zmap` - Fast single-packet Internet scanner
- `amass` - Attack surface mapping and asset discovery
- `subfinder` - Passive subdomain discovery tool

**Web Application Testing (7 tools):**
- `gobuster` - Directory/file/DNS busting tool
- `ffuf` - Fast web fuzzer
- `feroxbuster` - Recursive content discovery
- `nikto` - Web vulnerability scanner
- `whatweb` - Web technology fingerprinting
- `sqlmap` - SQL injection exploitation tool
- `nuclei` - Fast vulnerability scanner with templates

**Vulnerability & SSL Testing (3 tools):**
- `nuclei` - Template-based vulnerability scanner
- `trivy` - Container and dependency vulnerability scanner
- `testssl.sh` - SSL/TLS security assessment tool

**Credential & Authentication (3 tools):**
- `hydra` - Network service brute-forcer
- `john` - Password hash cracking tool
- `hashcat` - Advanced password recovery tool

**Information Gathering (3 tools):**
- `theharvester` - Email and domain intelligence gathering
- `amass` - Comprehensive asset discovery
- `shodan` - Internet-connected device search engine

**Enumeration (5 tools):**
- `enum4linux` - SMB enumeration for Linux/Windows
- `nbtscan` - NetBIOS name scanning
- `ldapsearch` - LDAP directory enumeration
- `snmp-check` - SNMP service enumeration
- `smbclient` - SMB share access and enumeration

**Specialized Tools (6 tools):**
- `eyewitness` - Web application screenshot tool
- `gitleaks` - Git repository secret detection
- `dirsearch` - Web path scanner
- `dirb` - Web content scanner
- `wpscan` - WordPress vulnerability scanner
- `feroxbuster` - Fast content discovery tool

---

## Customizing & Troubleshooting

### Adding New Tools
1. **Update Tool Database**: Add new tool to categorized tool list in JavaScript
2. **Create Templates**: Define argument templates and examples
3. **Add Descriptions**: Include tool descriptions and usage examples
4. **Test Integration**: Verify tool execution and output parsing

### Common Issues
- **Tool not found**: Verify installation and PATH configuration
- **Permission errors**: Check user permissions for tool execution
- **GPIO access denied**: Ensure proper GPIO permissions or run as root
- **WebSocket connection fails**: Verify network configuration and firewall settings
- **Scenario validation errors**: Check variable syntax and tool arguments

### Performance Tuning
- **Concurrent Execution**: Adjust thread limits for system capabilities
- **Memory Management**: Monitor resource usage during large scans
- **Network Optimization**: Configure rate limiting for network-intensive tools
- **Storage Management**: Implement log rotation and output cleanup

### Debugging
```bash
# Check service logs
sudo journalctl -u octapus-web.service -f
sudo journalctl -u octapus-controller.service -f

# Test individual components
source venv/bin/activate
python3 bin/webapp/server.py  # Test web server
python3 bin/octapus_controller.py  # Test controller

# Debug scenario execution
curl -X POST http://localhost:8080/api/run_scenario \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "steps": [{"tool": "nmap", "args": ["-sV", "127.0.0.1"]}]}'

# Verify tool installations
which nmap gobuster sqlmap hydra nuclei

# Test WebSocket connection
python3 -c "
import socketio
sio = socketio.Client()
sio.connect('http://localhost:8080')
print('WebSocket connection successful')
"
```

---

## Contributing

OctapusPrime welcomes contributions to expand the security tool ecosystem:

**Areas for Contribution:**
- **New Tool Integration**: Add support for additional security tools
- **Scenario Templates**: Create pre-built workflows for specific testing scenarios
- **UI/UX Improvements**: Enhance the web interface and user experience
- **Performance Optimization**: Improve execution speed and resource usage
- **Documentation**: Expand guides, tutorials, and tool references
- **Bug Fixes**: Address issues and improve stability

**Development Process:**
1. Fork the repository
2. Create feature branch
3. Follow existing code style
4. Include comprehensive tests
5. Update documentation
6. Submit pull request

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## Disclaimer

**IMPORTANT LEGAL NOTICE:**

OctapusPrime is designed for **authorized security testing and educational purposes only**. This tool should only be used against systems you own or have explicit written permission to test.

**Prohibited Uses:**
- Unauthorized access to computer systems
- Testing systems without proper authorization
- Any illegal or malicious activities

**User Responsibilities:**
- Obtain proper authorization before testing
- Comply with applicable laws and regulations
- Use responsibly and ethically
- Respect privacy and data protection laws

**No Warranty:**
The developers provide this software "as is" without any warranties. Users assume all responsibility and liability for the use of this software.

**By using OctapusPrime, you agree to use it legally and ethically in accordance with all applicable laws and regulations.**