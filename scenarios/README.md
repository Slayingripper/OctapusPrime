# OctapusPrime Penetration Test Scenarios

This directory contains pre-built penetration testing scenarios based on real-world security assessments conducted by KIOS Research and Innovation Center of Excellence.

## Available Scenarios

### 1. ICS/SCADA PLC Penetration Test
**File:** `ics_scada_plc_pentest.json`
**Target:** Schneider Electric TM241CEC24T PLC and generic Modbus TCP PLCs

Comprehensive testing scenario for industrial PLCs including:
- Modbus TCP port scanning and enumeration
- PLC coil and register manipulation
- Web interface security assessment
- Authentication testing on FTP and HTTP services

**Key Features:**
- Conditional execution based on open ports
- Custom plc_tool integration for direct Modbus communication
- Variable extraction for discovered services
- Automated vulnerability scanning

---

### 2. Smart Meter FDI Attack
**File:** `smart_meter_fdi_attack.json`
**Target:** Janitza UMG604 Smart Meters and IEC 61850 devices

False Data Injection (FDI) attack scenario for smart metering infrastructure:
- Multi-protocol service discovery
- FTP exploitation and anonymous access testing
- Modbus register reading for energy measurement data
- Web interface vulnerability assessment

**Attack Type:** Critical - False Data Injection
**Protocols:** Modbus TCP, FTP, HTTP, Telnet

---

### 3. Moxa Cellular Router Penetration Test
**File:** `moxa_cellular_router_pentest.json`
**Target:** Moxa OnCell G3150A-LTE-EU and industrial IoT routers

Comprehensive IoT router security assessment:
- Full port scanning with aggressive service detection
- Web application security testing (Nikto, Gobuster)
- SSL/TLS configuration analysis
- IoT-specific CVE detection using Nuclei
- Authentication bypass attempts

**Category:** IoT/Industrial Network Devices
**Severity:** High

---

### 4. Fortigate Firewall Penetration Test
**File:** `fortigate_firewall_pentest.json`
**Target:** Fortigate firewalls and FortiOS devices

Enterprise security appliance penetration test:
- Management interface discovery
- Comprehensive SSL/TLS security assessment
- Weak cipher suite detection
- Recent vulnerability scanning (CVE-2023+)
- Admin credential brute forcing
- SNMP enumeration

**Category:** Enterprise Network Security
**Severity:** Critical

---

### 5. Tor & Dark Web Network Monitoring
**File:** `tor_darkweb_monitoring.json`
**Target:** Tor relays, I2P routers, anonymization networks

Network forensics and threat intelligence scenario:
- Tor relay port detection (9001, 9030, 9050, 9051)
- I2P router identification (port 7656)
- Hidden service enumeration
- SSL certificate analysis for operator identification
- Tor connectivity verification
- OSINT gathering on anonymization infrastructure

**Use Cases:** Network monitoring, unauthorized service detection, threat intelligence

---

## Legacy Scenarios

### quick_discovery.json
Fast network discovery using Nmap and Masscan for rapid host enumeration.

### web_audit.json
Standard web application security assessment with directory enumeration, vulnerability scanning, and SQL injection testing.

### full_bruteforce.json
Comprehensive credential testing scenario targeting SSH and FTP services with brute force attacks.

### test.json, testinggg.json, qwen.json
Test scenarios for development and validation purposes.

---

## Using Scenarios

### Via Web Interface

1. Navigate to the **Scenario Builder** page
2. Click **"Load Scenario"** button
3. Select desired scenario from the dropdown
4. Review and modify steps as needed
5. Update target variables (replace `{{TARGET_IP}}` with actual targets)
6. Click **"Run Scenario"** to execute

### Via API

```bash
# Load and run a scenario via REST API
curl -X POST http://localhost:8080/api/run_scenario \
  -H "Content-Type: application/json" \
  -d @scenarios/ics_scada_plc_pentest.json
```

### Manual Execution

```bash
# Parse and execute scenario steps manually
cat scenarios/smart_meter_fdi_attack.json | jq -r '.steps[] | .tool + " " + (.args | join(" "))'
```

---

## Scenario Format

All scenarios follow the OctapusPrime IFTTT (If This Then That) format:

```json
{
  "name": "Scenario Name",
  "description": "Detailed description of what this scenario does",
  "steps": [
    {
      "tool": "nmap",
      "args": ["-p", "502", "{{TARGET_IP}}"],
      "description": "Human-readable description of this step",
      "extract": {
        "variable_name": {
          "pattern": "regex pattern",
          "description": "What this variable captures"
        }
      },
      "condition": {
        "if": "{{variable_name}}",
        "operator": "exists|contains|equals",
        "value": "optional comparison value"
      }
    }
  ],
  "metadata": {
    "category": "ICS/SCADA|IoT|Enterprise|etc",
    "target_devices": ["Device models"],
    "protocols": ["Protocols tested"],
    "severity": "critical|high|medium|low",
    "notes": "Additional information and warnings"
  }
}
```

### Key Features

- **Conditional Execution:** Steps only run if conditions are met
- **Variable Extraction:** Capture data from tool output using regex
- **Variable Substitution:** Use `{{variable_name}}` in subsequent steps
- **Metadata:** Rich scenario documentation and classification

---

## Creating Custom Scenarios

### Basic Template

```json
{
  "name": "My Custom Scenario",
  "description": "Description of what this tests",
  "steps": [
    {
      "tool": "nmap",
      "args": ["-sV", "{{TARGET_IP}}"],
      "description": "Initial port scan"
    },
    {
      "tool": "nikto",
      "args": ["-h", "http://{{TARGET_IP}}"],
      "description": "Web vulnerability scan"
    }
  ],
  "metadata": {
    "category": "Custom",
    "severity": "medium"
  }
}
```

### Advanced Features

**Extract variables from output:**
```json
"extract": {
  "open_ports": {
    "pattern": "(\\d+)/tcp\\s+open",
    "description": "Extract all open TCP ports"
  }
}
```

**Conditional execution:**
```json
"condition": {
  "if": "{{open_ports}}",
  "operator": "contains",
  "value": "80"
}
```

**Multiple arguments:**
```json
"args": ["-sV", "-A", "-p", "1-1000", "{{TARGET_IP}}"]
```

---

## Security Warnings

⚠️ **CRITICAL:** Only use these scenarios against systems you own or have explicit written authorization to test.

- **Authorization Required:** Unauthorized penetration testing is illegal
- **Production Systems:** Never test production ICS/SCADA without proper safety measures
- **Network Impact:** Some tools generate significant traffic
- **Physical Impact:** PLC testing can affect real-world processes
- **Legal Compliance:** Follow all applicable laws and regulations

---

## Scenario Metadata Reference

### Categories
- `ICS/SCADA` - Industrial Control Systems
- `Smart Grid/IoT` - Smart meters and IoT devices
- `IoT/Industrial Network Devices` - Network infrastructure
- `Enterprise Network Security` - Enterprise security appliances
- `Network Forensics/Threat Intelligence` - Security monitoring

### Severity Levels
- `critical` - Can cause immediate security compromise
- `high` - Significant security risk
- `medium` - Moderate risk
- `low` - Minor security concern

### Target Device Examples
- Schneider Electric TM241CEC24T PLCs
- Janitza UMG604 Smart Meters
- Moxa OnCell G3150A-LTE-EU Routers
- Fortigate Firewalls
- Generic Modbus TCP devices

---

## Support & Documentation

- **Main Documentation:** See `README.md` in project root
- **ICS/SCADA Enhancement Guide:** See `ICS_SCADA_ENHANCEMENT.md`
- **Web Interface:** Access at `http://localhost:8080`
- **API Documentation:** See server.py for available endpoints

---

**Based on KIOS Research and Innovation Center of Excellence penetration testing research**

Last Updated: October 2025
