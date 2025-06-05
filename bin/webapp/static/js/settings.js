class SettingsManager {
  constructor() {
    this.currentSettings = {};
    this.currentGpioConfig = {};
    this.platformInfo = {};
    this.availableInterfaces = {};
    this.socket = null;
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.connectWebSocket();
    this.loadAllConfigs();
  }

  setupEventListeners() {
    // Network settings
    document.getElementById('auto-detect-network').addEventListener('change', () => this.toggleNetworkConfig());
    document.getElementById('test-network-btn').addEventListener('click', () => this.testNetwork());
    
    // GPIO settings
    document.getElementById('manual-override').addEventListener('change', () => this.toggleManualConfig());
    document.getElementById('auto-detect').addEventListener('change', () => this.toggleManualConfig());
    document.getElementById('test-gpio-btn').addEventListener('click', () => this.testGpio());
    document.getElementById('save-gpio-btn').addEventListener('click', () => this.saveGpioConfig());
    
    // System settings
    document.getElementById('save-settings-btn').addEventListener('click', () => this.saveAllSettings());
    document.getElementById('reset-btn').addEventListener('click', () => this.resetToDefaults());
  }

  connectWebSocket() {
    try {
      this.socket = io();
      
      this.socket.on('connect', () => {
        this.updateStatus('Connected', true);
      });

      this.socket.on('disconnect', () => {
        this.updateStatus('Disconnected', false);
      });

    } catch (err) {
      console.error('WebSocket connection failed:', err);
      this.updateStatus('Connection Failed', false);
    }
  }

  async loadAllConfigs() {
    this.showAlert('Loading configurations...', 'info');
    
    try {
      await Promise.all([
        this.loadSettings(),
        this.loadGpioConfig(),
        this.loadNetworkInterfaces()
      ]);
      
      this.showAlert('Configurations loaded successfully', 'success');
    } catch (error) {
      this.showAlert('Failed to load some configurations', 'warning');
    }
  }

  async loadSettings() {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      
      if (data.status === 'success') {
        this.currentSettings = data.data;
        this.populateSettingsForm();
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      throw error;
    }
  }

  async loadGpioConfig() {
    try {
      const response = await fetch('/gpio_config');
      const data = await response.json();
      
      this.currentGpioConfig = data.config;
      this.platformInfo = data.platform_info;
      
      this.updatePlatformInfo();
      this.updateLibraryStatus(data.available_libraries);
      this.populateGpioForm();
      
    } catch (error) {
      console.error('Failed to load GPIO config:', error);
      throw error;
    }
  }

  async loadNetworkInterfaces() {
    try {
      const response = await fetch('/network_interfaces');
      const data = await response.json();
      
      this.availableInterfaces = data.interfaces;
      this.updateInterfaceList();
      this.updateInterfaceDropdown();
      
    } catch (error) {
      console.error('Failed to load network interfaces:', error);
      throw error;
    }
  }

  populateSettingsForm() {
    const s = this.currentSettings;
    
    document.getElementById('auto-detect-network').checked = s.autoDetectNetwork !== false;
    document.getElementById('network-interface').value = s.networkInterface || 'auto';
    document.getElementById('custom-cidr').value = s.customCIDR || '';
    document.getElementById('nmap-scan-type').value = s.nmapScanType || 'intense';
    document.getElementById('default-scan-ports').value = s.defaultScanPorts || '1-1000';
    document.getElementById('masscan-rate').value = s.masscanRate || '1000';
    document.getElementById('thread-count').value = s.threadCount || '10';
    document.getElementById('log-verbosity').value = s.logVerbosity || 'info';
    document.getElementById('auto-update').checked = s.autoUpdate || false;
    document.getElementById('scan-timeout').value = s.scanTimeout || '30';
    
    this.toggleNetworkConfig();
  }

  populateGpioForm() {
    const g = this.currentGpioConfig;
    
    document.getElementById('auto-detect').checked = !g.manual_override;
    document.getElementById('manual-override').checked = g.manual_override || false;
    document.getElementById('gpio-library').value = g.gpio_library || 'auto';
    document.getElementById('button-pin').value = g.button_pin || 17;
    document.getElementById('led-pin').value = g.led_pin || 27;
    document.getElementById('button-pull-up').checked = g.button_pull_up !== false;
    document.getElementById('bounce-time').value = g.button_bounce_time || 0.1;
    document.getElementById('led-active-high').checked = g.led_active_high !== false;
    
    this.toggleManualConfig();
  }

  updatePlatformInfo() {
    const platformName = document.getElementById('platform-name');
    const platformModel = document.getElementById('platform-model');
    const recommendedLib = document.getElementById('recommended-lib');
    
    platformName.textContent = this.platformInfo.platform || 'Unknown';
    platformName.className = 'platform-value';
    
    platformModel.textContent = this.platformInfo.model || 'Unknown';
    platformModel.className = 'platform-value';
    
    recommendedLib.textContent = this.platformInfo.recommended_lib || 'gpiozero';
    recommendedLib.className = 'platform-value';
    
    // Show platform-specific alerts
    if (this.platformInfo.platform === 'nano_pi') {
      this.showAlert('Nano Pi detected! OPi.GPIO library is recommended for best compatibility.', 'info');
    } else if (this.platformInfo.platform === 'orange_pi') {
      this.showAlert('Orange Pi detected! OPi.GPIO library is recommended for best compatibility.', 'info');
    }
  }

  updateLibraryStatus(libraries) {
    const container = document.getElementById('library-status');
    container.innerHTML = '';
    
    for (const [lib, available] of Object.entries(libraries)) {
      const item = document.createElement('div');
      item.className = 'library-item';
      item.innerHTML = `
        <span class="library-name">${lib}</span>
        <span class="${available ? 'library-available' : 'library-unavailable'}">
          ${available ? '✓ Available' : '✗ Not Available'}
        </span>
      `;
      container.appendChild(item);
    }
  }

  updateInterfaceList() {
    const container = document.getElementById('interface-list');
    container.innerHTML = '';
    
    for (const [name, info] of Object.entries(this.availableInterfaces)) {
      const item = document.createElement('div');
      item.className = 'interface-item';
      item.innerHTML = `
        <div>
          <div class="interface-name">${name}</div>
          <div class="interface-details">IP: ${info.ip} | Network: ${info.network}</div>
        </div>
        <div class="interface-status">${info.status}</div>
      `;
      container.appendChild(item);
    }
  }

  updateInterfaceDropdown() {
    const select = document.getElementById('network-interface');
    
    // Remove existing options except auto
    while (select.children.length > 1) {
      select.removeChild(select.lastChild);
    }
    
    // Add interface options
    for (const name of Object.keys(this.availableInterfaces)) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = `${name} (${this.availableInterfaces[name].network})`;
      select.appendChild(option);
    }
  }

  toggleNetworkConfig() {
    const autoDetect = document.getElementById('auto-detect-network').checked;
    const interfaceSelect = document.getElementById('network-interface');
    
    if (autoDetect) {
      interfaceSelect.value = 'auto';
      interfaceSelect.disabled = true;
    } else {
      interfaceSelect.disabled = false;
    }
  }

  toggleManualConfig() {
    const manualOverride = document.getElementById('manual-override').checked;
    const autoDetect = document.getElementById('auto-detect').checked;
    const manualConfig = document.getElementById('manual-config');
    
    if (manualOverride) {
      manualConfig.classList.remove('hidden');
      document.getElementById('auto-detect').checked = false;
    } else {
      manualConfig.classList.add('hidden');
      if (autoDetect) {
        document.getElementById('gpio-library').value = 'auto';
      }
    }
  }

  getSettingsConfig() {
    return {
      networkInterface: document.getElementById('network-interface').value,
      customCIDR: document.getElementById('custom-cidr').value,
      autoDetectNetwork: document.getElementById('auto-detect-network').checked,
      nmapScanType: document.getElementById('nmap-scan-type').value,
      defaultScanPorts: document.getElementById('default-scan-ports').value,
      masscanRate: document.getElementById('masscan-rate').value,
      threadCount: document.getElementById('thread-count').value,
      logVerbosity: document.getElementById('log-verbosity').value,
      autoUpdate: document.getElementById('auto-update').checked,
      scanTimeout: document.getElementById('scan-timeout').value
    };
  }

  getGpioConfig() {
    return {
      auto_detect: document.getElementById('auto-detect').checked,
      manual_override: document.getElementById('manual-override').checked,
      gpio_library: document.getElementById('gpio-library').value,
      button_pin: parseInt(document.getElementById('button-pin').value),
      led_pin: parseInt(document.getElementById('led-pin').value),
      button_pull_up: document.getElementById('button-pull-up').checked,
      button_bounce_time: parseFloat(document.getElementById('bounce-time').value),
      led_active_high: document.getElementById('led-active-high').checked
    };
  }

  async testNetwork() {
    const button = document.getElementById('test-network-btn');
    const originalText = button.innerHTML;
    button.innerHTML = '🔍 Testing...';
    button.disabled = true;
    
    try {
      const response = await fetch('/local_cidr');
      const data = await response.json();
      
      if (data.cidr) {
        this.showToast(`Network test successful! Detected CIDR: ${data.cidr} (Interface: ${data.interface || 'auto'})`, 'success');
      } else {
        this.showToast('Network test failed: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      this.showToast('Network test failed: ' + error.message, 'error');
    } finally {
      button.innerHTML = originalText;
      button.disabled = false;
    }
  }

  async testGpio() {
    const config = this.getGpioConfig();
    
    // Validate pins
    if (config.button_pin === config.led_pin) {
      this.showToast('Button and LED pins must be different', 'error');
      return;
    }
    
    const button = document.getElementById('test-gpio-btn');
    const originalText = button.innerHTML;
    button.innerHTML = '⚡ Testing...';
    button.disabled = true;
    
    try {
      const response = await fetch('/gpio_test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        this.showToast('GPIO test successful! LED should have blinked briefly.', 'success');
      } else {
        this.showToast('GPIO test failed: ' + result.message, 'error');
      }
      
    } catch (error) {
      this.showToast('GPIO test failed: ' + error.message, 'error');
    } finally {
      button.innerHTML = originalText;
      button.disabled = false;
    }
  }

  async saveGpioConfig() {
    const config = this.getGpioConfig();
    
    const button = document.getElementById('save-gpio-btn');
    const originalText = button.innerHTML;
    button.innerHTML = '💾 Saving...';
    button.disabled = true;
    
    try {
      const response = await fetch('/gpio_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      const result = await response.json();
      
      if (result.status === 'saved') {
        this.showToast('GPIO configuration saved successfully! Restart the controller to apply changes.', 'success');
        this.currentGpioConfig = config;
      } else {
        this.showToast('GPIO save failed: ' + result.message, 'error');
      }
      
    } catch (error) {
      this.showToast('GPIO save failed: ' + error.message, 'error');
    } finally {
      button.innerHTML = originalText;
      button.disabled = false;
    }
  }

  async saveAllSettings() {
    const settings = this.getSettingsConfig();
    
    const button = document.getElementById('save-settings-btn');
    const originalText = button.innerHTML;
    button.innerHTML = '💾 Saving...';
    button.disabled = true;
    
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        this.showToast('All settings saved successfully!', 'success');
        this.currentSettings = settings;
      } else {
        this.showToast('Settings save failed: ' + result.message, 'error');
      }
      
    } catch (error) {
      this.showToast('Settings save failed: ' + error.message, 'error');
    } finally {
      button.innerHTML = originalText;
      button.disabled = false;
    }
  }

  resetToDefaults() {
    if (confirm('Reset all settings to defaults? This will overwrite your current configuration.')) {
      // Reset network settings
      document.getElementById('auto-detect-network').checked = true;
      document.getElementById('network-interface').value = 'auto';
      document.getElementById('custom-cidr').value = '';
      document.getElementById('nmap-scan-type').value = 'intense';
      document.getElementById('default-scan-ports').value = '1-1000';
      document.getElementById('masscan-rate').value = '1000';
      document.getElementById('thread-count').value = '10';
      document.getElementById('log-verbosity').value = 'info';
      document.getElementById('auto-update').checked = false;
      document.getElementById('scan-timeout').value = '30';
      
      // Reset GPIO settings
      document.getElementById('auto-detect').checked = true;
      document.getElementById('manual-override').checked = false;
      document.getElementById('gpio-library').value = 'auto';
      document.getElementById('button-pin').value = 17;
      document.getElementById('led-pin').value = 27;
      document.getElementById('button-pull-up').checked = true;
      document.getElementById('bounce-time').value = 0.1;
      document.getElementById('led-active-high').checked = true;
      
      this.toggleNetworkConfig();
      this.toggleManualConfig();
      this.showToast('Configuration reset to defaults. Click Save to apply.', 'warning');
    }
  }

  updateStatus(status, connected) {
    const statusText = document.getElementById('connectionText');
    const statusDot = document.getElementById('connectionDot');
    
    statusText.textContent = status;
    
    if (connected) {
      statusDot.style.background = 'var(--accent-color)';
      statusDot.style.animation = 'statusPulse 2s ease-in-out infinite';
    } else {
      statusDot.style.background = 'var(--error-color)';
      statusDot.style.animation = 'none';
    }
  }

  showAlert(message, type = 'info') {
    const alert = document.getElementById('alert');
    alert.textContent = message;
    alert.className = `alert ${type}`;
    alert.style.display = 'block';
    
    setTimeout(() => {
      alert.style.display = 'none';
    }, 5000);
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast`;
    toast.style.background = type === 'success' ? 'var(--success-color)' : 
                            type === 'error' ? 'var(--error-color)' : 
                            type === 'warning' ? 'var(--warning-color)' : 'var(--info-color)';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Initialize the settings manager when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new SettingsManager();
});