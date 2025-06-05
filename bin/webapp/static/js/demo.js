let selectedDemo = null;
let demoRunning = false;

function loadDemo(demoType) {
  // Remove previous selection
  document.querySelectorAll('.demo-card').forEach(card => {
    card.style.borderColor = 'var(--border-color)';
  });

  // Highlight selected card
  event.target.closest('.demo-card').style.borderColor = 'var(--accent-color)';
  selectedDemo = demoType;

  // Update status
  updateStatus('ready', `${demoType.replace('_', ' ')} demo selected`);
}

async function runSelectedDemo() {
  if (!selectedDemo) {
    alert('Please select a demo scenario first');
    return;
  }

  if (demoRunning) {
    alert('Demo already running. Please wait for completion.');
    return;
  }

  demoRunning = true;
  updateStatus('running', `Running ${selectedDemo.replace('_', ' ')} demo...`);

  try {
    // Get demo configuration
    const demoConfig = getDemoConfig(selectedDemo);
    
    // Start the demo
    const response = await fetch('/start_scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: demoConfig })
    });

    const result = await response.json();
    
    if (result.status === 'scenario started') {
      updateOutput(`[SYSTEM] ${selectedDemo.replace('_', ' ')} demo started successfully!\n`);
      updateStatus('running', 'Demo running - check logs page for live output');
      
      // Simulate completion after some time
      setTimeout(() => {
        updateStatus('complete', 'Demo completed successfully');
        demoRunning = false;
      }, 30000);
    } else {
      throw new Error(result.message || 'Failed to start demo');
    }
  } catch (error) {
    updateOutput(`[ERROR] Failed to start demo: ${error.message}\n`);
    updateStatus('ready', 'Demo failed - ready for retry');
    demoRunning = false;
  }
}

function getDemoConfig(demoType) {
  const configs = {
    network_discovery: [
      {
        tool: "nmap",
        args: ["-sV", "-T4", "192.168.1.0/24"],
        condition: { type: "always" }
      },
      {
        tool: "masscan",
        args: ["192.168.1.0/24", "-p1-1000", "--rate=1000"],
        condition: { type: "always" }
      }
    ],
    web_assessment: [
      {
        tool: "gobuster",
        args: ["dir", "-u", "http://192.168.1.1", "-w", "/usr/share/wordlists/dirb/common.txt"],
        condition: { type: "always" }
      },
      {
        tool: "nikto",
        args: ["-h", "http://192.168.1.1"],
        condition: { type: "always" }
      }
    ],
    credential_testing: [
      {
        tool: "hydra",
        args: ["-l", "admin", "-P", "/usr/share/wordlists/rockyou.txt", "-t", "4", "192.168.1.1", "ssh"],
        condition: { type: "always" }
      }
    ],
    full_pipeline: [
      {
        tool: "nmap",
        args: ["-sV", "-T4", "192.168.1.0/24"],
        condition: { type: "always" }
      },
      {
        tool: "gobuster",
        args: ["dir", "-u", "http://192.168.1.1", "-w", "/usr/share/wordlists/dirb/common.txt"],
        condition: { type: "prev_contains", value: "80/tcp open" }
      },
      {
        tool: "hydra",
        args: ["-l", "admin", "-P", "/usr/share/wordlists/rockyou.txt", "-t", "4", "192.168.1.1", "ssh"],
        condition: { type: "prev_contains", value: "22/tcp open" }
      }
    ]
  };
  return configs[demoType] || [];
}

function customizeDemo() {
  if (!selectedDemo) {
    alert('Please select a demo scenario first');
    return;
  }
  
  // Redirect to scenario maker with demo loaded
  window.location.href = `/scenario_maker?demo=${selectedDemo}`;
}

function updateStatus(status, text) {
  const indicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  
  indicator.className = `status-indicator status-${status}`;
  statusText.textContent = text;
}

function updateOutput(text) {
  const output = document.getElementById('demo-output');
  const currentTime = new Date().toLocaleTimeString();
  output.textContent += `[${currentTime}] ${text}`;
  output.scrollTop = output.scrollHeight;
}

function clearOutput() {
  document.getElementById('demo-output').textContent = 'Output cleared - ready for new demo run...';
  updateStatus('ready', 'Ready to run demo');
}

// Initialize page functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Auto-detect network and update demo configs
  fetch('/local_cidr')
    .then(response => response.json())
    .then(data => {
      if (data.cidr) {
        updateOutput(`[SYSTEM] Auto-detected network: ${data.cidr}\n`);
      }
    })
    .catch(error => {
      console.log('Could not auto-detect network:', error);
    });
});