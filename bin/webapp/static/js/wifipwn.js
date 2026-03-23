/**
 * OctapusPrime – WiFi Pwn Module (Frontend)
 */
(function () {
  "use strict";

  // DOM references
  const ifaceSelect  = document.getElementById("wifi-iface");
  const btnRefresh   = document.getElementById("btn-refresh-ifaces");
  const btnMonOn     = document.getElementById("btn-monitor-on");
  const btnMonOff    = document.getElementById("btn-monitor-off");
  const btnScan      = document.getElementById("btn-scan");
  const btnAuto      = document.getElementById("btn-auto");
  const btnStop      = document.getElementById("btn-stop");
  const btnSubmitAll = document.getElementById("btn-submit-all");
  const btnCheckRes  = document.getElementById("btn-check-results");
  const statusDot    = document.getElementById("status-dot");
  const statusText   = document.getElementById("status-text");
  const netBody      = document.getElementById("networks-body");
  const hsBody       = document.getElementById("handshakes-body");
  const logConsole   = document.getElementById("wifi-log");

  let monitorEnabled = false;
  let pollTimer = null;
  let scannedNetworks = [];  // store last scan results for client info

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------
  function log(msg) {
    const now = new Date().toLocaleTimeString();
    const div = document.createElement("div");
    div.className = "log-line";
    div.innerHTML = `<span class="log-time">${now}</span>${escapeHtml(msg)}`;
    logConsole.appendChild(div);
    logConsole.scrollTop = logConsole.scrollHeight;
  }

  function escapeHtml(str) {
    const el = document.createElement("span");
    el.textContent = str;
    return el.innerHTML;
  }

  function setStatus(state, text) {
    statusDot.className = "status-dot " + state;
    statusText.textContent = text;
  }

  async function api(url, opts = {}) {
    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...opts,
      });
      return await res.json();
    } catch (e) {
      log("Request failed: " + e.message);
      return { status: "error", message: e.message };
    }
  }

  // -------------------------------------------------------------------
  // Interfaces
  // -------------------------------------------------------------------
  async function loadInterfaces() {
    const data = await api("/api/wifi/interfaces");
    ifaceSelect.innerHTML = "";
    if (data.status === "success" && data.interfaces.length) {
      data.interfaces.forEach((iface) => {
        const opt = document.createElement("option");
        opt.value = iface;
        opt.textContent = iface;
        ifaceSelect.appendChild(opt);
      });
    } else {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No wireless interfaces found";
      ifaceSelect.appendChild(opt);
    }
  }

  // -------------------------------------------------------------------
  // Monitor Mode
  // -------------------------------------------------------------------
  async function enableMonitor() {
    const iface = ifaceSelect.value;
    if (!iface) { log("Select an interface first"); return; }
    setStatus("running", "Enabling monitor mode...");
    log("Enabling monitor mode on " + iface + "...");
    btnMonOn.disabled = true;

    const data = await api("/api/wifi/monitor", {
      method: "POST",
      body: JSON.stringify({ action: "enable", interface: iface }),
    });

    if (data.status === "success") {
      monitorEnabled = true;
      log("Monitor mode enabled: " + data.monitor_interface);
      setStatus("running", "Monitor: " + data.monitor_interface);
      btnMonOff.disabled = false;
      btnScan.disabled = false;
      btnAuto.disabled = false;
    } else {
      log("Failed: " + (data.message || "unknown error"));
      setStatus("error", "Monitor mode failed");
      btnMonOn.disabled = false;
    }
  }

  async function disableMonitor() {
    setStatus("running", "Disabling monitor mode...");
    const data = await api("/api/wifi/monitor", {
      method: "POST",
      body: JSON.stringify({ action: "disable" }),
    });
    monitorEnabled = false;
    btnMonOn.disabled = false;
    btnMonOff.disabled = true;
    btnScan.disabled = true;
    btnAuto.disabled = true;
    btnStop.disabled = true;
    setStatus("idle", "Idle");
    log("Monitor mode disabled");
  }

  // -------------------------------------------------------------------
  // Scanning
  // -------------------------------------------------------------------
  async function scanNetworks() {
    setStatus("running", "Scanning...");
    btnScan.disabled = true;
    log("Starting network scan...");

    const data = await api("/api/wifi/scan", {
      method: "POST",
      body: JSON.stringify({ duration: 15 }),
    });

    btnScan.disabled = !monitorEnabled;

    if (data.status === "success") {
      scannedNetworks = data.networks || [];
      renderNetworks(scannedNetworks);
      log("Scan complete: " + (data.count || 0) + " networks found");
      setStatus("running", "Monitor active");
    } else {
      log("Scan failed: " + (data.message || ""));
      setStatus("error", "Scan failed");
    }
  }

  function renderNetworks(networks) {
    if (!networks.length) {
      netBody.innerHTML = '<tr><td colspan="6" class="empty-msg">No networks found</td></tr>';
      return;
    }

    // Sort by power (strongest first)
    networks.sort((a, b) => b.power - a.power);

    netBody.innerHTML = networks.map((n, idx) => {
      const enc = (n.encryption || "").toUpperCase();
      const isWPA = enc.includes("WPA");
      const badgeClass = isWPA ? "badge-wpa" : "badge-open";
      const clientCount = Array.isArray(n.clients) ? n.clients.length : 0;
      return `<tr>
        <td>${escapeHtml(n.essid || "<hidden>")}</td>
        <td style="font-size:0.75rem">${escapeHtml(n.bssid)}</td>
        <td>${n.channel}</td>
        <td>${n.power} dBm</td>
        <td><span class="badge ${badgeClass}">${escapeHtml(enc)}</span>${clientCount ? ` <span class="badge badge-yes">${clientCount} client${clientCount > 1 ? "s" : ""}</span>` : ""}</td>
        <td>${isWPA ? `<button class="btn-table" onclick="window._deauth(${idx})">Capture</button>` : "-"}</td>
      </tr>`;
    }).join("");
  }

  // -------------------------------------------------------------------
  // Deauth / Capture
  // -------------------------------------------------------------------
  window._deauth = async function (networkIdx) {
    const n = scannedNetworks[networkIdx];
    if (!n) { log("Network not found"); return; }
    const clientMacs = Array.isArray(n.clients) ? n.clients : [];
    setStatus("capturing", "Capturing handshake...");
    btnStop.disabled = false;
    log("Targeting " + (n.essid || n.bssid) + " on ch " + n.channel +
        (clientMacs.length ? " (deauthing " + clientMacs.length + " clients)" : " (broadcast deauth)"));

    await api("/api/wifi/deauth", {
      method: "POST",
      body: JSON.stringify({
        bssid: n.bssid,
        channel: n.channel,
        essid: n.essid,
        duration: 30,
        clients: clientMacs
      }),
    });

    // Start polling for status updates
    startPolling();
  };

  // -------------------------------------------------------------------
  // Auto Hunt
  // -------------------------------------------------------------------
  async function startAutoHunt() {
    const iface = ifaceSelect.value;
    if (!iface) { log("Select an interface first"); return; }

    setStatus("running", "Auto-hunting...");
    btnAuto.disabled = true;
    btnStop.disabled = false;
    log("Starting auto-hunt mode...");

    await api("/api/wifi/auto", {
      method: "POST",
      body: JSON.stringify({ action: "start", interface: iface }),
    });

    startPolling();
  }

  async function stopAll() {
    log("Sending stop signal...");
    await api("/api/wifi/stop", { method: "POST" });
    setStatus("idle", "Stopped");
    btnStop.disabled = true;
    btnScan.disabled = !monitorEnabled;
    btnAuto.disabled = !monitorEnabled;
    stopPolling();
  }

  // -------------------------------------------------------------------
  // Handshakes
  // -------------------------------------------------------------------
  function renderHandshakes(handshakes) {
    if (!handshakes || !handshakes.length) {
      hsBody.innerHTML = '<tr><td colspan="7" class="empty-msg">No handshakes captured yet</td></tr>';
      btnSubmitAll.disabled = true;
      return;
    }

    const hasUnsubmitted = handshakes.some((h) => !h.submitted);
    btnSubmitAll.disabled = !hasUnsubmitted;

    hsBody.innerHTML = handshakes.map((h) => `<tr>
      <td>${escapeHtml(h.essid || "")}</td>
      <td style="font-size:0.75rem">${escapeHtml(h.bssid)}</td>
      <td>${escapeHtml(h.timestamp)}</td>
      <td><span class="badge ${h.submitted ? "badge-yes" : "badge-no"}">${h.submitted ? "Yes" : "No"}</span></td>
      <td><span class="badge ${h.cracked ? "badge-yes" : "badge-no"}">${h.cracked ? "Yes" : "No"}</span></td>
      <td>${h.password ? escapeHtml(h.password) : "-"}</td>
      <td>${!h.submitted ? `<button class="btn-table" onclick="window._submitHs('${escapeHtml(h.bssid)}')">Submit</button>` : "-"}</td>
    </tr>`).join("");
  }

  window._submitHs = async function (bssid) {
    log("Submitting handshake for " + bssid + "...");
    const data = await api("/api/wifi/submit", {
      method: "POST",
      body: JSON.stringify({ bssid }),
    });
    log(data.message || data.status);
    refreshStatus();
  };

  async function submitAll() {
    log("Submitting all unsubmitted handshakes...");
    const data = await api("/api/wifi/submit", {
      method: "POST",
      body: JSON.stringify({}),
    });
    log(data.message || data.status);
    refreshStatus();
  }

  async function checkResults() {
    log("Checking WPA-SEC for cracked results...");
    const data = await api("/api/wifi/results");
    if (data.success && data.results) {
      data.results.forEach((r) => {
        log("CRACKED: " + r.essid + " → " + r.password);
      });
      if (!data.results.length) log("No cracked results yet.");
    } else {
      log(data.message || "Failed to check results");
    }
    refreshStatus();
  }

  // -------------------------------------------------------------------
  // Polling / Status
  // -------------------------------------------------------------------
  async function refreshStatus() {
    const data = await api("/api/wifi/status");
    if (data.status !== "success") return;

    renderHandshakes(data.handshakes || []);

    if (data.networks && data.networks.length) {
      renderNetworks(data.networks);
    }

    if (data.is_running) {
      const target = data.current_target;
      if (target) {
        setStatus("capturing", "Targeting " + (target.essid || target.bssid));
      } else {
        setStatus("running", "Running");
      }
      btnStop.disabled = false;
    }
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(refreshStatus, 3000);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // -------------------------------------------------------------------
  // Event Listeners
  // -------------------------------------------------------------------
  btnRefresh.addEventListener("click", loadInterfaces);
  btnMonOn.addEventListener("click", enableMonitor);
  btnMonOff.addEventListener("click", disableMonitor);
  btnScan.addEventListener("click", scanNetworks);
  btnAuto.addEventListener("click", startAutoHunt);
  btnStop.addEventListener("click", stopAll);
  btnSubmitAll.addEventListener("click", submitAll);
  btnCheckRes.addEventListener("click", checkResults);

  // -------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------
  loadInterfaces();
  log("WiFi Pwn module loaded");
})();
