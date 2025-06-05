/**
 * OctapusPrime Security Logs Manager
 * Real-time log streaming and management interface
 */

class LogsManager {
  constructor() {
    this.logsDiv = document.getElementById("logs");
    this.searchInput = document.getElementById("search-input");
    this.isPaused = false;
    this.logEntries = [];
    this.currentFilter = 'all';
    this.socket = null;
    this.autoScroll = true;
    this.maxLogEntries = 1000; // Prevent memory issues
    this.stats = {
      total: 0,
      error: 0,
      warning: 0,
      info: 0,
      debug: 0
    };
    
    this.init();
  }

  /**
   * Initialize the logs manager
   */
  init() {
    console.log('Initializing OctapusPrime Logs Manager...');
    
    this.setupEventListeners();
    this.loadHistoricalLogs();
    this.connectWebSocket();
    this.updateConnectionStatus(false);
    
    console.log('Logs Manager initialization complete');
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    // Search functionality with debouncing
    this.searchInput.addEventListener("input", this.debounce(() => {
      this.filterLogs();
    }, 300));

    // Level filter buttons
    document.querySelectorAll('.level-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.handleLevelFilter(e);
      });
    });

    // Control buttons
    document.getElementById('clearLogs').addEventListener('click', () => {
      this.clearLogs();
    });
    
    document.getElementById('exportLogs').addEventListener('click', () => {
      this.exportLogs();
    });
    
    document.getElementById('pauseBtn').addEventListener('click', () => {
      this.togglePause();
    });

    // Auto-scroll management
    const container = this.logsDiv.parentElement;
    container.addEventListener('scroll', () => {
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 10;
      this.autoScroll = isAtBottom;
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });

    // Window visibility change handling
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pausePerformanceIntensiveOperations();
      } else {
        this.resumePerformanceIntensiveOperations();
      }
    });
  }

  /**
   * Handle level filter button clicks
   * @param {Event} e - Click event
   */
  handleLevelFilter(e) {
    // Remove active class from all buttons
    document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
    
    // Add active class to clicked button
    e.target.classList.add('active');
    
    // Update filter and refresh logs
    this.currentFilter = e.target.dataset.level;
    this.filterLogs();
    
    // Add visual feedback
    e.target.style.transform = 'scale(0.95)';
    setTimeout(() => {
      e.target.style.transform = 'scale(1)';
    }, 100);
  }

  /**
   * Handle keyboard shortcuts
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      this.searchInput.focus();
    }
    
    // Ctrl/Cmd + L to clear logs
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
      e.preventDefault();
      this.clearLogs();
    }
    
    // Space to toggle pause
    if (e.key === ' ' && e.target === document.body) {
      e.preventDefault();
      this.togglePause();
    }
    
    // End key to scroll to bottom
    if (e.key === 'End') {
      e.preventDefault();
      this.scrollToBottom();
    }
  }

  /**
   * Load historical logs from server
   */
  async loadHistoricalLogs() {
    try {
      console.log('Loading historical logs...');
      
      const response = await fetch("/fetch_logs");
      const data = await response.json();
      
      // Clear loading message
      this.logsDiv.innerHTML = '';
      
      if (data.status === "error") {
        this.showError(`Error loading logs: ${data.message}`);
        return;
      }

      // Process each log line
      if (data.lines && Array.isArray(data.lines)) {
        data.lines.forEach(line => {
          if (line.trim()) {
            this.processLogLine(line);
          }
        });
      }
      
      this.scrollToBottom();
      this.updateLastUpdate();
      
      console.log(`Loaded ${data.lines?.length || 0} historical log entries`);
      
    } catch (err) {
      console.error('Failed to load historical logs:', err);
      this.showError(`Could not fetch logs: ${err.message}`);
    }
  }

  /**
   * Connect to WebSocket for live log streaming
   */
  connectWebSocket() {
    try {
      console.log('Connecting to WebSocket...');
      
      // Check if Socket.IO is available
      if (typeof io === 'undefined') {
        console.warn('Socket.IO not available, running in polling mode');
        this.setupPollingFallback();
        return;
      }

      this.socket = io();
      
      this.socket.on('connect', () => {
        console.log('WebSocket connected');
        this.updateConnectionStatus(true);
      });

      this.socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
        this.updateConnectionStatus(false);
      });

      this.socket.on("log", (msg) => {
        if (!this.isPaused && msg) {
          const combined = msg.tool ? `[${msg.tool}] ${msg.line}` : msg.line || msg;
          this.processLogLine(combined);
        }
      });

      this.socket.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.updateConnectionStatus(false);
      });

    } catch (err) {
      console.error('WebSocket connection failed:', err);
      this.updateConnectionStatus(false);
      this.setupPollingFallback();
    }
  }

  /**
   * Setup polling fallback for when WebSocket is not available
   */
  setupPollingFallback() {
    console.log('Setting up polling fallback...');
    
    setInterval(async () => {
      if (!this.isPaused) {
        try {
          const response = await fetch('/fetch_latest_logs');
          const data = await response.json();
          
          if (data.status === 'success' && data.lines) {
            data.lines.forEach(line => this.processLogLine(line));
          }
        } catch (err) {
          console.error('Polling failed:', err);
        }
      }
    }, 2000); // Poll every 2 seconds
  }

  /**
   * Process a new log line
   * @param {string} text - Raw log text
   */
  processLogLine(text) {
    if (!text || typeof text !== 'string') {
      return;
    }

    // Create log entry
    const logEntry = this.createLogEntry(text.trim());
    this.logEntries.push(logEntry);
    
    // Manage memory by removing old entries
    if (this.logEntries.length > this.maxLogEntries) {
      const removedEntry = this.logEntries.shift();
      if (removedEntry.element.parentNode) {
        removedEntry.element.remove();
      }
    }
    
    // Add to DOM
    this.logsDiv.appendChild(logEntry.element);
    
    // Update statistics
    this.updateStats(logEntry.level);
    
    // Auto-scroll if needed
    if (this.autoScroll) {
      this.scrollToBottom();
    }
    
    // Highlight new entries
    this.highlightNewEntry(logEntry.element);
    
    this.updateLastUpdate();
    this.filterLogs();
  }

  /**
   * Create a log entry element
   * @param {string} text - Log text
   * @returns {Object} Log entry object
   */
  createLogEntry(text) {
    const entry = document.createElement("div");
    entry.className = "log-entry";
    
    // Parse log level and metadata
    const level = this.detectLogLevel(text);
    const timestamp = new Date().toLocaleTimeString();
    
    entry.dataset.level = level;
    entry.dataset.originalText = text.toLowerCase();
    
    // Parse tool name
    const toolMatch = text.match(/^\[([^\]]+)\]/);
    const tool = toolMatch ? toolMatch[1] : 'SYSTEM';
    const message = toolMatch ? text.substring(toolMatch[0].length).trim() : text;
    
    // Build entry HTML
    entry.innerHTML = `
      <span class="log-timestamp">${timestamp}</span>
      <span class="log-tool">[${this.escapeHtml(tool)}]</span>
      <span class="log-message">${this.escapeHtml(message)}</span>
    `;
    
    // Add click handler for detailed view
    entry.addEventListener('click', () => {
      this.showLogDetails(text, timestamp, tool, message, level);
    });
    
    return {
      element: entry,
      level: level,
      text: text,
      timestamp: timestamp,
      tool: tool,
      message: message
    };
  }

  /**
   * Detect log level from text content
   * @param {string} text - Log text
   * @returns {string} Detected log level
   */
  detectLogLevel(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('error') || lowerText.includes('failed') || 
        lowerText.includes('exception') || lowerText.includes('critical')) {
      return 'error';
    } else if (lowerText.includes('warning') || lowerText.includes('warn')) {
      return 'warning';
    } else if (lowerText.includes('info') || lowerText.includes('started') || 
               lowerText.includes('completed') || lowerText.includes('connected')) {
      return 'info';
    } else if (lowerText.includes('debug') || lowerText.includes('trace')) {
      return 'debug';
    } else if (lowerText.includes('success') || lowerText.includes('ok') || 
               lowerText.includes('passed') || lowerText.includes('done')) {
      return 'success';
    }
    
    return 'info'; // Default level
  }

  /**
   * Highlight a new log entry
   * @param {HTMLElement} element - Log entry element
   */
  highlightNewEntry(element) {
    setTimeout(() => {
      element.classList.add('highlight');
      setTimeout(() => {
        element.classList.remove('highlight');
      }, 1000);
    }, 50);
  }

  /**
   * Filter logs based on search and level
   */
  filterLogs() {
    const query = this.searchInput.value.trim().toLowerCase();
    let visibleCount = 0;
    
    this.logEntries.forEach(logEntry => {
      const element = logEntry.element;
      const matchesSearch = query.length === 0 || 
        logEntry.text.toLowerCase().includes(query) ||
        logEntry.tool.toLowerCase().includes(query);
      const matchesLevel = this.currentFilter === 'all' || logEntry.level === this.currentFilter;
      
      if (matchesSearch && matchesLevel) {
        element.classList.remove("hidden");
        visibleCount++;
      } else {
        element.classList.add("hidden");
      }
    });
    
    document.getElementById('filteredCount').textContent = visibleCount;
    
    // Scroll to first matching entry if searching
    if (query.length > 0 && visibleCount > 0) {
      const firstVisible = this.logEntries.find(entry => 
        !entry.element.classList.contains('hidden')
      );
      if (firstVisible) {
        firstVisible.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  /**
   * Update statistics counters
   * @param {string} level - Log level to increment
   */
  updateStats(level) {
    this.stats.total++;
    if (this.stats[level] !== undefined) {
      this.stats[level]++;
    }
    
    // Update DOM counters
    document.getElementById('totalCount').textContent = this.stats.total;
    document.getElementById('errorCount').textContent = this.stats.error;
    document.getElementById('warningCount').textContent = this.stats.warning;
  }

  /**
   * Clear all logs with confirmation
   */
  clearLogs() {
    if (confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      this.logsDiv.innerHTML = '<div class="empty-logs">Logs cleared</div>';
      this.logEntries = [];
      this.stats = { total: 0, error: 0, warning: 0, info: 0, debug: 0 };
      this.updateStats();
      document.getElementById('filteredCount').textContent = '0';
      
      // Add feedback
      setTimeout(() => {
        this.logsDiv.innerHTML = '<div class="empty-logs">Waiting for new logs...</div>';
      }, 2000);
      
      console.log('Logs cleared by user');
    }
  }

  /**
   * Export filtered logs to file
   */
  exportLogs() {
    try {
      const visibleEntries = this.logEntries.filter(entry => 
        !entry.element.classList.contains('hidden')
      );
      
      if (visibleEntries.length === 0) {
        alert('No logs to export with current filters');
        return;
      }
      
      const logText = visibleEntries
        .map(entry => `${entry.timestamp} [${entry.tool}] ${entry.message}`)
        .join('\n');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `octapus-logs-${timestamp}.txt`;
      
      // Create and download file
      const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      
      console.log(`Exported ${visibleEntries.length} log entries to ${filename}`);
      
      // Show success message
      this.showTemporaryMessage(`Exported ${visibleEntries.length} logs to ${filename}`, 'success');
      
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export logs: ' + err.message);
    }
  }

  /**
   * Toggle pause/resume log streaming
   */
  togglePause() {
    this.isPaused = !this.isPaused;
    const btn = document.getElementById('pauseBtn');
    
    btn.textContent = this.isPaused ? 'Resume' : 'Pause';
    btn.style.background = this.isPaused ? 'var(--warning-color)' : 'var(--secondary-bg)';
    btn.style.color = this.isPaused ? 'var(--primary-bg)' : 'var(--accent-color)';
    
    console.log(`Log streaming ${this.isPaused ? 'paused' : 'resumed'}`);
    
    // Show status message
    this.showTemporaryMessage(
      `Log streaming ${this.isPaused ? 'paused' : 'resumed'}`, 
      this.isPaused ? 'warning' : 'success'
    );
  }

  /**
   * Update connection status indicator
   * @param {boolean} connected - Connection status
   */
  updateConnectionStatus(connected) {
    const dot = document.getElementById('connectionDot');
    const text = document.getElementById('connectionText');
    
    if (connected) {
      dot.classList.remove('disconnected');
      text.textContent = 'Connected';
    } else {
      dot.classList.add('disconnected');
      text.textContent = 'Disconnected';
    }
  }

  /**
   * Update last update timestamp
   */
  updateLastUpdate() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent = 
      `Last updated: ${now.toLocaleTimeString()}`;
  }

  /**
   * Scroll to bottom of logs
   */
  scrollToBottom() {
    const container = this.logsDiv.parentElement;
    container.scrollTop = container.scrollHeight;
  }

  /**
   * Show error message in logs
   * @param {string} message - Error message
   */
  showError(message) {
    const timestamp = new Date().toLocaleTimeString();
    this.logsDiv.innerHTML = `
      <div class="log-entry" data-level="error">
        <span class="log-timestamp">${timestamp}</span>
        <span class="log-tool">[SYSTEM]</span>
        <span class="log-message">${this.escapeHtml(message)}</span>
      </div>
    `;
  }

  /**
   * Show temporary status message
   * @param {string} message - Message to show
   * @param {string} type - Message type (success, warning, error)
   */
  showTemporaryMessage(message, type = 'info') {
    // Create message element
    const msgEl = document.createElement('div');
    msgEl.className = 'temp-message';
    msgEl.textContent = message;
    msgEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--${type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'error'}-color);
      color: var(--primary-bg);
      padding: 10px 20px;
      border-radius: 5px;
      font-family: var(--font-mono);
      font-size: 12px;
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(msgEl);
    
    // Remove after delay
    setTimeout(() => {
      msgEl.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (msgEl.parentNode) {
          msgEl.remove();
        }
      }, 300);
    }, 3000);
  }

  /**
   * Show detailed log information
   * @param {string} text - Full log text
   * @param {string} timestamp - Log timestamp
   * @param {string} tool - Tool name
   * @param {string} message - Log message
   * @param {string} level - Log level
   */
  showLogDetails(text, timestamp, tool, message, level) {
    // This could be expanded to show a modal with full log details
    console.log('Log details:', { text, timestamp, tool, message, level });
  }

  /**
   * Pause performance intensive operations when tab is hidden
   */
  pausePerformanceIntensiveOperations() {
    // Could pause animations, reduce update frequency, etc.
    console.log('Pausing performance intensive operations');
  }

  /**
   * Resume performance intensive operations when tab is visible
   */
  resumePerformanceIntensiveOperations() {
    console.log('Resuming performance intensive operations');
  }

  /**
   * Debounce function to limit function calls
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Add CSS animations for temporary messages
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Initialize the logs manager when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  try {
    new LogsManager();
    console.log('OctapusPrime Logs Manager started successfully');
  } catch (error) {
    console.error('Failed to start Logs Manager:', error);
  }
});

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LogsManager };
}