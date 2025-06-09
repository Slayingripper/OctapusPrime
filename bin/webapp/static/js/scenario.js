/**
 * OctapusPrime Scenario Manager
 * Advanced "If This Then That" scenario creation and execution management
 */

class ScenarioManager {
  constructor() {
    // grab inputs/buttons/stats/table/body/empty‐state
    this.scenarioNameInput = document.getElementById('scenario-name');
    this.addStepBtn = document.getElementById('add-step-btn');
    this.loadScenarioBtn = document.getElementById('load-scenario-btn');
    this.saveScenarioBtn = document.getElementById('save-scenario-btn');
    this.runScenarioBtn = document.getElementById('run-scenario-btn');
    this.clearScenarioBtn = document.getElementById('clear-scenario-btn');
    this.stepCountEl = document.getElementById('step-count');
    this.toolCountEl = document.getElementById('tool-count');
    this.stepsTableBody = document.getElementById('steps-tbody');
    this.emptyState = document.getElementById('empty-state');

    // core data
    this.scenarioVariables = new Map();
    this.stepResults = new Map();
    this.isRunning = false;
    this.tools = [
      "nmap", "masscan", "gobuster", "nikto", "sqlmap", "hydra",
      "sslscan", "nbtscan", "dnsenum", "john", "hashcat", "dirb",
      "ldapsearch", "snmp-check", "theharvester", "dirsearch",
      "amass", "enum4linux", "trivy", "wpscan", "gobuster-dns",
      "ffuf", "subfinder", "eyewitness", "gitleaks", "shodan",
      "nuclei", "feroxbuster", "whatweb", "testssl", "smbclient"
    ];

    this.conditionTypes = [
      { value: "always", label: "Always Execute", needsValue: false, category: "basic" },
      { value: "never", label: "Never Execute (Skip)", needsValue: false, category: "basic" },

      // Previous step conditions
      { value: "prev_success", label: "If Previous Step Succeeded", needsValue: false, category: "previous" },
      { value: "prev_fail", label: "If Previous Step Failed", needsValue: false, category: "previous" },
      { value: "prev_contains", label: "If Previous Output Contains", needsValue: true, category: "previous" },
      { value: "prev_not_contains", label: "If Previous Output Does NOT Contain", needsValue: true, category: "previous" },
      { value: "prev_regex", label: "If Previous Output Matches Regex", needsValue: true, category: "previous" },
      { value: "prev_exit_code", label: "If Previous Exit Code Equals", needsValue: true, category: "previous" },

      // Output analysis conditions
      { value: "output_contains", label: "If ANY Previous Output Contains", needsValue: true, category: "output" },
      { value: "output_not_contains", label: "If NO Previous Output Contains", needsValue: true, category: "output" },
      { value: "output_regex", label: "If ANY Previous Output Matches Regex", needsValue: true, category: "output" },
      { value: "output_line_count", label: "If Previous Output Line Count", needsValue: true, category: "output" },
      { value: "output_size", label: "If Previous Output Size (bytes)", needsValue: true, category: "output" },

      // File system conditions
      { value: "file_exists", label: "If File Exists", needsValue: true, category: "filesystem" },
      { value: "file_not_exists", label: "If File Does NOT Exist", needsValue: true, category: "filesystem" },
      { value: "file_contains", label: "If File Contains Text", needsValue: true, category: "filesystem" },
      { value: "file_regex", label: "If File Matches Regex", needsValue: true, category: "filesystem" },
      { value: "file_size", label: "If File Size", needsValue: true, category: "filesystem" },
      { value: "dir_exists", label: "If Directory Exists", needsValue: true, category: "filesystem" },

      // Variable conditions
      { value: "var_set", label: "If Variable Is Set", needsValue: true, category: "variables" },
      { value: "var_equals", label: "If Variable Equals", needsValue: true, category: "variables" },
      { value: "var_contains", label: "If Variable Contains", needsValue: true, category: "variables" },
      { value: "var_regex", label: "If Variable Matches Regex", needsValue: true, category: "variables" },

      // Network conditions
      { value: "port_open", label: "If Port Is Open", needsValue: true, category: "network" },
      { value: "port_closed", label: "If Port Is Closed", needsValue: true, category: "network" },
      { value: "host_up", label: "If Host Is Up", needsValue: true, category: "network" },
      { value: "host_down", label: "If Host Is Down", needsValue: true, category: "network" },
      { value: "service_detected", label: "If Service Detected", needsValue: true, category: "network" },

      // Time-based conditions
      { value: "time_after", label: "If Current Time After", needsValue: true, category: "time" },
      { value: "time_before", label: "If Current Time Before", needsValue: true, category: "time" },
      { value: "execution_time", label: "If Previous Step Took Longer Than", needsValue: true, category: "time" },

      // Advanced logical conditions
      { value: "step_result", label: "If Specific Step Result", needsValue: true, category: "advanced" },
      { value: "count_condition", label: "If Count of Matches", needsValue: true, category: "advanced" },
      { value: "custom_script", label: "If Custom Script Returns True", needsValue: true, category: "advanced" }
    ];

    this.operators = [
      { value: "equals", label: "=" },
      { value: "not_equals", label: "!=" },
      { value: "greater", label: ">" },
      { value: "greater_equal", label: ">=" },
      { value: "less", label: "<" },
      { value: "less_equal", label: "<=" },
      { value: "contains", label: "contains" },
      { value: "not_contains", label: "does not contain" },
      { value: "starts_with", label: "starts with" },
      { value: "ends_with", label: "ends with" },
      { value: "regex", label: "matches regex" },
      { value: "not_regex", label: "does not match regex" }
    ];

    this.stepTemplates = {
      "nmap": {
        args: ["-sV", "-A", "-O", "-sS", "-p 1-1000", "{target}"],
        description: "Comprehensive port scan",
        variables: ["target"],
        expectedOutputs: ["open ports", "service versions", "OS detection"]
      },
      "gobuster": {
        args: ["dir", "-u", "{target_url}", "-w", "/usr/share/wordlists/dirb/common.txt", "-x", "php,html,txt"],
        description: "Directory and file enumeration",
        variables: ["target_url"],
        expectedOutputs: ["directories", "files", "status codes"]
      },
      "nikto": {
        args: ["-h", "{target_url}", "-C", "all"],
        description: "Web vulnerability scanner",
        variables: ["target_url"],
        expectedOutputs: ["vulnerabilities", "server info", "security issues"]
      },
      "sqlmap": {
        args: ["-u", "{target_url}", "--batch", "--level=2", "--risk=2"],
        description: "SQL injection testing",
        variables: ["target_url"],
        expectedOutputs: ["injection points", "database info", "data dumps"]
      },
      "hydra": {
        args: ["-l", "{username}", "-P", "/usr/share/wordlists/rockyou.txt", "{service}://{target}"],
        description: "Password brute force attack",
        variables: ["username", "service", "target"],
        expectedOutputs: ["valid credentials", "login attempts", "success rate"]
      },
      "nuclei": {
        args: ["-u", "{target_url}", "-t", "/nuclei-templates/", "-severity", "high,critical"],
        description: "Vulnerability scanner with templates",
        variables: ["target_url"],
        expectedOutputs: ["vulnerabilities", "CVEs", "security issues"]
      }
    };

    // DOM elements
    this.stepsTableBody = document.getElementById("steps-tbody");
    this.scenarioNameInput = document.getElementById("scenario-name");
    this.emptyState = document.getElementById("empty-state");
    this.loadModal = null;

    // State
    this.socket = null;
    this.currentScenarioId = null;
    this.isRunning = false;
    this.runningStepIndex = -1;
    this.scenarioVariables = new Map(); // Store scenario-wide variables
    this.stepResults = new Map(); // Store results from each step

    this.init();
  }

  /**
   * Initialize the scenario manager
   */
  init() {
    try {
      // Initialize empty state if not present
      if (!this.emptyState && this.stepsContainer) {
        this.emptyState = document.createElement('div');
        this.emptyState.className = 'empty-state';
        this.emptyState.innerHTML = `
          <div class="empty-state-icon">📋</div>
          <h3>No Steps Added</h3>
          <p>Click "Add Step" to start building your scenario</p>
        `;
        this.stepsContainer.appendChild(this.emptyState);
      }

      // Set up event listeners
      this.setupEventListeners();

      // Initialize UI
      this.updateUI();

      console.log('Enhanced Scenario Manager initialized successfully');

    } catch (error) {
      console.error('Failed to initialize Enhanced Scenario Manager:', error);
      this.showNotification('Failed to initialize scenario manager', 'error');
    }
  }

  /**
   * Initialize scenario variables
   */
  initializeVariables() {
    // Set default variables
    this.scenarioVariables.set('timestamp', new Date().toISOString());
    this.scenarioVariables.set('date', new Date().toISOString().split('T')[0]);
    this.scenarioVariables.set('time', new Date().toTimeString().split(' ')[0]);
    this.scenarioVariables.set('random', Math.random().toString(36).substring(7));
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    // Existing event listeners
    if (this.addStepBtn) {
      this.addStepBtn.addEventListener('click', () => this.addStep());
    }
    
    if (this.loadScenarioBtn) {
      this.loadScenarioBtn.addEventListener('click', () => this.showLoadModal());
    }
    
    if (this.saveScenarioBtn) {
      this.saveScenarioBtn.addEventListener('click', () => this.saveScenario());
    }
    
    if (this.runScenarioBtn) {
      this.runScenarioBtn.addEventListener('click', () => this.runScenario());
    }
    
    // Clear scenario button
    if (this.clearScenarioBtn) {
      this.clearScenarioBtn.addEventListener('click', () => this.clearScenario());
    }

    // Scenario name input - save on Enter
    if (this.scenarioNameInput) {
      this.scenarioNameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          this.saveScenario();
        }
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });
  }

  /**
   * Update UI elements and statistics
   */
  updateUI() {
    // toggle empty-state
    this.emptyState.style.display = this.stepsTableBody.children.length ? 'none' : 'block';
    // update stats
    this.stepCountEl.textContent = this.stepsTableBody.children.length;
    const tools = new Set(
      Array.from(this.stepsTableBody.children)
        .map(r => r.querySelector('.tool-select').value)
        .filter(v => v)
    );
    this.toolCountEl.textContent = tools.size;
    // enable/disable buttons
    const hasSteps = this.stepsTableBody.children.length > 0;
    this.saveScenarioBtn.disabled = !hasSteps;
    this.runScenarioBtn.disabled = !hasSteps;
    this.clearScenarioBtn.disabled = !hasSteps;
  }

  /**
   * Handle keyboard shortcuts
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyboardShortcuts(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      this.saveScenario();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      this.addStep();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      this.showLoadModal();
    }

    if (e.key === 'Escape') {
      this.hideLoadModal();
    }
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  connectWebSocket() {
    try {
      if (typeof io === 'undefined') {
        console.warn('Socket.IO not available');
        this.updateStatus('No WebSocket', false);
        return;
      }

      this.socket = io();

      this.socket.on('connect', () => {
        console.log('WebSocket connected');
        this.updateStatus('Connected', true);
      });

      this.socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
        this.updateStatus('Disconnected', false);
      });

      this.socket.on('scenario_progress', (data) => {
        this.handleScenarioProgress(data);
      });

      this.socket.on('scenario_completed', (data) => {
        this.handleScenarioCompleted(data);
      });

      this.socket.on('step_result', (data) => {
        this.handleStepResult(data);
      });

      this.socket.on('variable_updated', (data) => {
        this.handleVariableUpdate(data);
      });

      this.socket.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.updateStatus('Error', false);
      });

    } catch (err) {
      console.error('WebSocket connection failed:', err);
      this.updateStatus('Connection Failed', false);
    }
  }

  /**
   * Add a new step to the scenario
   * @param {Object} stepData - Optional step data to populate
   */
  addStep(stepData = null) {
    const stepIndex = this.stepsTableBody.children.length;
    const row = this.createStepRow(stepIndex, stepData); // ✅ Pass both index and stepData

    row.classList.add('step-row-enter');

    this.stepsTableBody.appendChild(row);
    this.updateUI();
    
    if (stepData) {
      this.showNotification('Step loaded from scenario', 'success');
    } else {
      this.showNotification('Enhanced IFTTT step added successfully', 'success');
    }

    if (!stepData) {
      const toolSelect = row.querySelector('.tool-select');
      setTimeout(() => toolSelect && toolSelect.focus(), 100);
    }
  }

  /**
   * Create a step row element with enhanced IFTTT functionality
   * @param {number|Object} index - Step index or stepData if called with single parameter
   * @param {Object} stepData - Optional step data
   * @returns {HTMLElement} Table row element
   */
  createStepRow(index, stepData = null) {
    console.log('createStepRow called with:', { index, stepData }); // Debug
    
    // Handle case where only stepData is passed (no index)
    if (typeof index === 'object' && stepData === null) {
      stepData = index;
      index = this.stepsTableBody ? this.stepsTableBody.children.length : 0;
      console.log('Adjusted parameters:', { index, stepData }); // Debug
    }
    
    const tr = document.createElement("tr");
    tr.dataset.index = index;
    tr.className = "step-row";

    // Step number
    const tdIndex = document.createElement("td");
    tdIndex.className = "step-number";
    tdIndex.textContent = index + 1;
    tr.appendChild(tdIndex);

    // Tool selector (THEN part)
    const tdTool = document.createElement("td");
    const toolContainer = document.createElement("div");
    toolContainer.className = "tool-container";

    const toolLabel = document.createElement("label");
    toolLabel.textContent = "THEN execute:";
    toolLabel.className = "condition-label";

    const selectTool = this.createToolSelect(stepData?.tool);
    toolContainer.appendChild(toolLabel);
    toolContainer.appendChild(selectTool);
    tdTool.appendChild(toolContainer);
    tr.appendChild(tdTool);

    // Arguments input with variable support
    const tdArgs = document.createElement("td");
    const inputArgsContainer = this.createArgumentsInput(stepData); // This returns a container
    tdArgs.appendChild(inputArgsContainer);
    tr.appendChild(tdArgs);

    // Enhanced condition selector (IF part)
    const tdCondition = document.createElement("td");
    const conditionContainer = this.createConditionContainer(stepData);
    tdCondition.appendChild(conditionContainer);
    tr.appendChild(tdCondition);

    // Variables input
    const tdVariables = document.createElement("td");
    const variablesInput = this.createVariablesInput(stepData);
    tdVariables.appendChild(variablesInput);
    tr.appendChild(tdVariables);

    // Timeout input
    const tdTimeout = document.createElement("td");
    const timeoutInput = this.createTimeoutInput(stepData);
    tdTimeout.appendChild(timeoutInput);
    tr.appendChild(tdTimeout);

    // Remove button
    const tdRemove = document.createElement("td");
    const removeBtn = this.createRemoveButton(tr);
    tdRemove.appendChild(removeBtn);
    tr.appendChild(tdRemove);

    console.log('Created step row with stepData:', stepData); // Debug

    return tr;
  }

  /**
   * Create enhanced condition container with IFTTT logic
   * @param {Object} stepData - Step data
   * @returns {HTMLElement} Condition container
   */
  createConditionContainer(stepData = null) {
  const container = document.createElement("div");
  container.className = "condition-container";

  // IF label
  const ifLabel = document.createElement("label");
  ifLabel.textContent = "IF:";
  ifLabel.className = "condition-label if-label";
  container.appendChild(ifLabel);

  // Condition type selector
  const conditionSelect = this.createConditionSelect(stepData);
  container.appendChild(conditionSelect);

  // Operator selector (for conditions that need it)
  const operatorSelect = this.createOperatorSelect(stepData);
  operatorSelect.style.display = "none";
  container.appendChild(operatorSelect);

  // Condition value input with regex support
  const conditionValue = this.createConditionValueInput(stepData, conditionSelect, operatorSelect);
  container.appendChild(conditionValue);

  // Regex helper button
  const regexHelper = document.createElement("button");
  regexHelper.type = "button";
  regexHelper.className = "btn-small regex-helper";
  regexHelper.innerHTML = "📝";
  regexHelper.title = "Regex Helper";
  regexHelper.style.display = "none";
  regexHelper.addEventListener("click", () => this.showRegexHelper(conditionValue));
  container.appendChild(regexHelper);

  // Validation indicator
  const validationIcon = document.createElement("span");
  validationIcon.className = "validation-icon";
  container.appendChild(validationIcon);

  return container;
}

  /**
   * Create enhanced condition selector with categories
   * @param {Object} stepData - Step data
   * @returns {HTMLElement} Select element
   */
  createConditionSelect(stepData = null) {
    const select = document.createElement("select");
    select.className = "form-control condition-select";

    // Group conditions by category
    const categories = {};
    this.conditionTypes.forEach(condType => {
      if (!categories[condType.category]) {
        categories[condType.category] = [];
      }
      categories[condType.category].push(condType);
    });

    // Create optgroups
    Object.keys(categories).forEach(category => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = category.charAt(0).toUpperCase() + category.slice(1);

      categories[category].forEach(condType => {
        const option = document.createElement("option");
        option.value = condType.value;
        option.textContent = condType.label;
        option.dataset.needsValue = condType.needsValue;
        option.dataset.category = condType.category;
        optgroup.appendChild(option);
      });

      select.appendChild(optgroup);
    });

    if (stepData && stepData.condition) {
      select.value = stepData.condition.type;
    }

    // Handle condition type changes
    select.addEventListener("change", (e) => {
      this.handleConditionTypeChange(e.target);
    });

    return select;
  }

  /**
   * Create operator selector for complex conditions
   * @param {Object} stepData - Step data
   * @returns {HTMLElement} Select element
   */
  createOperatorSelect(stepData = null) {
    const select = document.createElement("select");
    select.className = "form-control operator-select";

    this.operators.forEach(op => {
      const option = document.createElement("option");
      option.value = op.value;
      option.textContent = op.label;
      select.appendChild(option);
    });

    if (stepData && stepData.condition && stepData.condition.operator) {
      select.value = stepData.condition.operator;
    }

    return select;
  }

  /**
   * Handle condition type changes
   * @param {HTMLElement} conditionSelect - Condition select element
   */
  handleConditionTypeChange(conditionSelect) {
    const container = conditionSelect.closest('.condition-container');
    const operatorSelect = container.querySelector('.operator-select');
    const valueInput = container.querySelector('.condition-value');
    const regexHelper = container.querySelector('.regex-helper');
    const validationIcon = container.querySelector('.validation-icon');

    const selectedOption = conditionSelect.selectedOptions[0];
    const needsValue = selectedOption ? selectedOption.dataset.needsValue === 'true' : false;
    const conditionType = conditionSelect.value;

    // Show/hide operator selector for complex conditions
    const needsOperator = [
      'output_line_count', 'output_size', 'file_size', 'execution_time',
      'count_condition', 'var_equals', 'var_contains'
    ].includes(conditionType);

    operatorSelect.style.display = needsOperator ? 'block' : 'none';

    // Show/hide value input
    valueInput.style.display = needsValue ? 'block' : 'none';
    valueInput.disabled = !needsValue;

    // Show/hide regex helper
    const isRegexCondition = conditionType.includes('regex') ||
      operatorSelect.value === 'regex' ||
      operatorSelect.value === 'not_regex';
    regexHelper.style.display = isRegexCondition ? 'inline-block' : 'none';

    // Update placeholder and validation
    this.updateConditionPlaceholder(valueInput, conditionType);
    this.validateCondition(container);

    if (!needsValue) {
      valueInput.value = "";
    }
  }

  /**
   * Update condition input placeholder based on condition type
   * @param {HTMLElement} input - Condition value input
   * @param {string} conditionType - Type of condition
   */
  updateConditionPlaceholder(input, conditionType) {
    const placeholders = {
      'prev_contains': 'Text to search for in previous output',
      'prev_regex': 'Regular expression pattern (e.g., \\d+\\.\\d+\\.\\d+\\.\\d+)',
      'prev_exit_code': 'Exit code number (e.g., 0)',
      'output_contains': 'Text to search for in any output',
      'output_regex': 'Regex pattern to match in outputs',
      'output_line_count': 'Number of lines (e.g., >50)',
      'output_size': 'Size in bytes (e.g., >1024)',
      'file_exists': 'File path (e.g., /tmp/results.txt)',
      'file_contains': 'File path and search text (e.g., /tmp/file.txt:error)',
      'file_regex': 'File path and regex (e.g., /tmp/file.txt:\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})',
      'file_size': 'File path and size (e.g., /tmp/file.txt:>1024)',
      'var_set': 'Variable name (e.g., target_ip)',
      'var_equals': 'Variable name and value (e.g., status:success)',
      'var_regex': 'Variable name and regex (e.g., ip_addr:\\d+\\.\\d+\\.d+\\.d+)',
      'port_open': 'Host:port (e.g., 192.168.1.1:80)',
      'service_detected': 'Service name (e.g., ssh, http, mysql)',
      'time_after': 'Time in HH:MM format (e.g., 14:30)',
      'execution_time': 'Seconds (e.g., >30)',
      'step_result': 'Step number:expected_result (e.g., 1:success)',
      'count_condition': 'Pattern and count (e.g., "open port":>5)',
      'custom_script': 'Script path or inline code'
    };

    input.placeholder = placeholders[conditionType] || 'Enter condition value...';
  }

  /**
   * Create enhanced condition value input with validation
   * @param {Object} stepData - Step data
   * @param {HTMLElement} conditionSelect - Condition select element
   * @param {HTMLElement} operatorSelect - Operator select element
   * @returns {HTMLElement} Input element
   */
  createConditionValueInput(stepData = null, conditionSelect, operatorSelect) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-control condition-value";
    input.placeholder = "Enter condition value...";

    if (stepData && stepData.condition && stepData.condition.value) {
      input.value = stepData.condition.value;
    }

    // Add real-time validation
    input.addEventListener('input', () => {
      this.validateCondition(input.closest('.condition-container'));
    });

    input.addEventListener('blur', () => {
      this.validateCondition(input.closest('.condition-container'));
    });

    // Add variable substitution hints
    input.addEventListener('focus', () => {
      this.showVariableHints(input);
    });

    return input;
  }

  /**
   * Validate condition configuration
   * @param {HTMLElement} container - Condition container
   */
  validateCondition(container) {
    const conditionSelect = container.querySelector('.condition-select');
    const operatorSelect = container.querySelector('.operator-select');
    const valueInput = container.querySelector('.condition-value');
    const validationIcon = container.querySelector('.validation-icon');

    const conditionType = conditionSelect.value;
    const value = valueInput.value.trim();

    let isValid = true;
    let errorMessage = '';

    // Check if value is required
    const selectedOption = conditionSelect.selectedOptions[0];
    const needsValue = selectedOption ? selectedOption.dataset.needsValue === 'true' : false;

    if (needsValue && !value) {
      isValid = false;
      errorMessage = 'Value required for this condition';
    }

    // Validate regex patterns
    if (conditionType.includes('regex') && value) {
      try {
        new RegExp(value);
      } catch (e) {
        isValid = false;
        errorMessage = 'Invalid regex pattern';
      }
    }

    // Validate specific formats
    if (isValid && value) {
      switch (conditionType) {
        case 'prev_exit_code':
        case 'execution_time':
          if (!/^\d+$/.test(value) && !/^[<>=]+\d+$/.test(value)) {
            isValid = false;
            errorMessage = 'Must be a number or comparison (e.g., >30)';
          }
          break;

        case 'port_open':
        case 'port_closed':
          if (!/^[\w.-]+:\d+$/.test(value)) {
            isValid = false;
            errorMessage = 'Must be in format host:port';
          }
          break;

        case 'time_after':
        case 'time_before':
          if (!/^\d{2}:\d{2}$/.test(value)) {
            isValid = false;
            errorMessage = 'Must be in HH:MM format';
          }
          break;
      }
    }

    // Update validation icon
    validationIcon.innerHTML = isValid ? '✅' : '❌';
    validationIcon.title = isValid ? 'Valid condition' : errorMessage;
    validationIcon.className = `validation-icon ${isValid ? 'valid' : 'invalid'}`;

    return isValid;
  }

  /**
   * Show regex helper modal
   * @param {HTMLElement} input - Input element to populate
   */
  showRegexHelper(input) {
    const modal = document.createElement('div');
    modal.className = 'modal regex-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Regex Helper</h3>
          <button class="modal-close" type="button">&times;</button>
        </div>
        <div class="modal-body">
          <div class="regex-patterns">
            <h4>Common Patterns:</h4>
            <div class="pattern-grid">
              <button class="pattern-btn" data-pattern="\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}">IP Address</button>
              <button class="pattern-btn" data-pattern="\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b">Email</button>
              <button class="pattern-btn" data-pattern="https?://[\\w.-]+">URL</button>
              <button class="pattern-btn" data-pattern="\\b\\d{1,5}\\b">Port Number</button>
              <button class="pattern-btn" data-pattern="(?i)(password|passwd|pwd)\\s*[:=]\\s*\\S+">Password</button>
              <button class="pattern-btn" data-pattern="\\b[0-9a-fA-F]{32}\\b">MD5 Hash</button>
              <button class="pattern-btn" data-pattern="CVE-\\d{4}-\\d{4,}">CVE ID</button>
              <button class="pattern-btn" data-pattern="(?i)(error|fail|exception)">Error Keywords</button>
            </div>
          </div>
          <div class="regex-tester">
            <h4>Test Your Regex:</h4>
            <input type="text" class="test-input" placeholder="Enter test text...">
            <div class="test-result"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'block';

    // Event listeners
    modal.querySelector('.modal-close').addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    modal.querySelectorAll('.pattern-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        input.value = btn.dataset.pattern;
        this.validateCondition(input.closest('.condition-container'));
        modal.remove();
      });
    });

    // Real-time regex testing
    const testInput = modal.querySelector('.test-input');
    const testResult = modal.querySelector('.test-result');

    const testRegex = () => {
      const pattern = input.value;
      const testText = testInput.value;

      if (!pattern || !testText) {
        testResult.innerHTML = '';
        return;
      }

      try {
        const regex = new RegExp(pattern, 'g');
        const matches = testText.match(regex);

        if (matches) {
          testResult.innerHTML = `<span class="success">✅ ${matches.length} match(es): ${matches.join(', ')}</span>`;
        } else {
          testResult.innerHTML = `<span class="warning">⚠️ No matches found</span>`;
        }
      } catch (e) {
        testResult.innerHTML = `<span class="error">❌ Invalid regex: ${e.message}</span>`;
      }
    };

    input.addEventListener('input', testRegex);
    testInput.addEventListener('input', testRegex);
  }

  /**
   * Show variable hints for input
   * @param {HTMLElement} input - Input element
   */
  showVariableHints(input) {
    // Create tooltip with available variables
    const tooltip = document.createElement('div');
    tooltip.className = 'variable-tooltip';

    const variables = Array.from(this.scenarioVariables.keys());
    const variableList = variables.map(v => `{${v}}`).join(', ');

    tooltip.innerHTML = `
      <strong>Available Variables:</strong><br>
      ${variableList || 'No variables defined yet'}<br>
      <em>Use {variable_name} in your conditions</em>
    `;

    document.body.appendChild(tooltip);

    const rect = input.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.top = (rect.bottom + 5) + 'px';
    tooltip.style.left = rect.left + 'px';
    tooltip.style.zIndex = '1000';

    // Remove tooltip after delay or on focus out
    const removeTooltip = () => {
      if (tooltip.parentNode) {
        tooltip.remove();
      }
    };

    setTimeout(removeTooltip, 5000);
    input.addEventListener('blur', removeTooltip, { once: true });
  }

  /**
   * Create actions container for step
   * @param {Object} stepData - Step data
   * @returns {HTMLElement} Actions container
   */
  createActionsContainer(stepData = null) {
    const container = document.createElement("div");
    container.className = "actions-container";

    // Variable extraction section
    const varSection = document.createElement("div");
    varSection.className = "variable-section";

    const varLabel = document.createElement("label");
    varLabel.textContent = "Extract Variables:";
    varLabel.className = "section-label";

    const varInput = document.createElement("input");
    varInput.type = "text";
    varInput.className = "form-control variable-extract";
    varInput.placeholder = "var_name:regex_pattern";
    varInput.title = "Extract variables from output using regex (e.g., ip_addr:\\d+\\.\\d+\\.d+\\.d+)";

    if (stepData && stepData.variables) {
      varInput.value = Object.entries(stepData.variables).map(([k, v]) => `${k}:${v}`).join(';');
    }

    varSection.appendChild(varLabel);
    varSection.appendChild(varInput);

    // Step timeout
    const timeoutInput = document.createElement("input");
    timeoutInput.type = "number";
    timeoutInput.className = "form-control step-timeout";
    timeoutInput.placeholder = "Timeout (s)";
    timeoutInput.min = "1";
    timeoutInput.max = "3600";
    timeoutInput.value = stepData?.timeout || "300";

    container.appendChild(varSection);
    container.appendChild(timeoutInput);

    return container;
  }

  /**
   * Create enhanced tool selector with templates
   * @param {string} selectedTool - Currently selected tool
   * @returns {HTMLElement} Select element
   */
  createToolSelect(selectedTool = null) {
    console.log('Creating tool select with selectedTool:', selectedTool); // Debug
    
    const select = document.createElement("select");
    select.className = "form-control tool-select";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select a tool...";
    select.appendChild(defaultOption);

    // Group tools by category
    const categories = this.getToolCategories();

    Object.entries(categories).forEach(([category, tools]) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = category;

      tools.forEach(tool => {
        if (this.tools.includes(tool)) {
          const option = document.createElement("option");
          option.value = tool;
          option.textContent = tool;

          if (this.stepTemplates[tool]) {
            option.title = this.stepTemplates[tool].description;
          }

          optgroup.appendChild(option);
        }
      });

      if (optgroup.children.length > 0) { // ✅ Only add if has tools
        select.appendChild(optgroup);
      }
    });

    // ✅ Set the selected tool AFTER all options are added
    if (selectedTool) {
      console.log('Setting tool value to:', selectedTool); // Debug
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        select.value = selectedTool;
        console.log('Tool select value after setting:', select.value); // Debug
        
        // If the value didn't stick, the tool might not be in the list
        if (select.value !== selectedTool) {
          console.warn(`Tool "${selectedTool}" not found in options, adding it manually`);
          const missingOption = document.createElement("option");
          missingOption.value = selectedTool;
          missingOption.textContent = selectedTool;
          select.appendChild(missingOption);
          select.value = selectedTool;
        }
      }, 0);
    }

    select.addEventListener("change", (e) => {
      this.handleToolChange(e.target);
      this.updateUI();
    });

    return select;
  }

  /**
   * Handle tool selection change
   * @param {HTMLElement} toolSelect - Tool select element
   */
  handleToolChange(toolSelect) {
    const selectedTool = toolSelect.value;
    const row = toolSelect.closest('.step-row');
    
    if (!selectedTool || !row) {
      return;
    }

    console.log('Tool changed to:', selectedTool); // Debug

    // Get the arguments input
    const argsContainer = row.querySelector('.input-group');
    const argsInput = argsContainer ? argsContainer.querySelector('.args-input') : row.querySelector('.args-input');
    
    if (!argsInput) {
      console.warn('Could not find args input');
      return;
    }

    // Apply template if available
    if (this.stepTemplates[selectedTool]) {
      const template = this.stepTemplates[selectedTool];
      
      // Only auto-fill if the input is empty
      if (!argsInput.value.trim()) {
        if (Array.isArray(template.args)) {
          argsInput.value = template.args.join(' ');
        } else if (typeof template.args === 'string') {
          argsInput.value = template.args;
        }
        
        console.log('Applied template for', selectedTool, ':', argsInput.value); // Debug
      }

      // Update tool info/tooltip
      if (template.description) {
        toolSelect.title = template.description;
      }

      // Show notification about template
      this.showNotification(`Template applied for ${selectedTool}`, 'info', 2000);
    }

    // Validate the arguments
    this.validateArguments(argsInput);
  }

  /**
   * Update UI elements and statistics
   */
  updateUI() {
    // toggle empty-state
    this.emptyState.style.display = this.stepsTableBody.children.length ? 'none' : 'block';
    // update stats
    this.stepCountEl.textContent = this.stepsTableBody.children.length;
    const tools = new Set(
      Array.from(this.stepsTableBody.children)
        .map(r => r.querySelector('.tool-select').value)
        .filter(v => v)
    );
    this.toolCountEl.textContent = tools.size;
    // enable/disable buttons
    const hasSteps = this.stepsTableBody.children.length > 0;
    this.saveScenarioBtn.disabled = !hasSteps;
    this.runScenarioBtn.disabled = !hasSteps;
    this.clearScenarioBtn.disabled = !hasSteps;
  }

  /**
   * Enhanced notification system with better styling
   * @param {string} message - Notification message
   * @param {string} type - Notification type (success, error, warning, info)
   * @param {number} timeout - Custom timeout in milliseconds
   */
  showNotification(message, type = 'info', timeout = null) {
    // Remove any existing notifications of the same type to prevent spam
    const existingNotifications = document.querySelectorAll(`.notification-${type}`);
    existingNotifications.forEach(notification => {
      if (notification.parentElement) {
        notification.remove();
      }
    });

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.animation = 'slideIn 0.3s ease-out';

    // Create content with proper escaping
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => {
      if (notification.parentElement) {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
          if (notification.parentElement) {
            notification.remove();
          }
        }, 300);
      }
    };

    notification.appendChild(messageSpan);
    notification.appendChild(closeBtn);

    // Add to DOM
    document.body.appendChild(notification);

    // Default timeouts based on type
    const defaultTimeout = {
      'success': 3000,
      'error': 5000,
      'warning': 4000,
      'info': timeout || 5000
    }[type] || 3000;

    // Auto-remove after timeout
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
          if (notification.parentElement) {
            notification.remove();
          }
        }, 300);
      }
    }, timeout || defaultTimeout);
  }

  /**
   * Show hint about customizing variables for example scenarios
   * @param {Object} scenario - Loaded scenario
   */
  showVariableCustomizationHint(scenario) {
    const variables = Object.keys(scenario.variables || {});
    if (variables.length > 0) {
      const variableList = variables.map(v => `• ${v}: ${scenario.variables[v]}`).join('\n');
      const hint = `Remember to customize these variables for your target:\n${variableList}`;

      setTimeout(() => {
        this.showNotification(hint, 'info', 8000);
      }, 1500);
    }
  }

  /**
   * Get key features of a scenario for preview
   * @param {Object} scenario - Scenario object
   * @returns {Array} Array of feature descriptions
   */
  getScenarioFeatures(scenario) {
    const features = [];

    if (scenario.steps) {
      const tools = [...new Set(scenario.steps.map(s => s.tool))];
      features.push(`Uses tools: ${tools.slice(0, 3).join(', ')}${tools.length > 3 ? '...' : ''}`);

      const conditionalSteps = scenario.steps.filter(s => s.condition?.type !== 'always').length;
      if (conditionalSteps > 0) {
        features.push(`${conditionalSteps} conditional steps with IFTTT logic`);
      }

      const variableExtracting = scenario.steps.filter(s => Object.keys(s.variables || {}).length > 0).length;
      if (variableExtracting > 0) {
        features.push(`${variableExtracting} steps extract variables`);
      }

      const regexSteps = scenario.steps.filter(s =>
        s.condition?.type?.includes('regex') ||
        Object.values(s.variables || {}).some(v => v.includes('\\'))
      ).length;
      if (regexSteps > 0) {
        features.push(`Advanced regex pattern matching`);
      }
    }

    return features.slice(0, 4); // Limit to 4 features
  }

  /**
   * Escape HTML for safe display
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // /**
  //  * Create step row element
  //  * @param {Object} stepData - Optional step data to populate
  //  * @returns {HTMLElement} Table row element
  //  */
  // createStepRow(stepData = null) {
  //   const row = document.createElement("tr");
  //   row.className = "step-row";

  //   // Step number
  //   const stepNumCell = document.createElement("td");
  //   const stepNum = this.stepsTableBody ? this.stepsTableBody.children.length + 1 : 1;
  //   stepNumCell.innerHTML = `<span class="step-number">${stepNum}</span>`;

  //   // Tool select
  //   const toolCell = document.createElement("td");
  //   const toolSelect = this.createToolSelect(stepData?.tool);
  //   toolCell.appendChild(toolSelect);

  //   // Arguments input
  //   const argsCell = document.createElement("td");
  //   const argsInput = this.createArgumentsInput(stepData);
  //   argsCell.appendChild(argsInput);

  //   // Condition select
  //   const conditionCell = document.createElement("td");
  //   const conditionContainer = this.createConditionContainer(stepData);
  //   conditionCell.appendChild(conditionContainer);

  //   // Variables input
  //   const variablesCell = document.createElement("td");
  //   const variablesInput = this.createVariablesInput(stepData);
  //   variablesCell.appendChild(variablesInput);

  //   // Timeout input
  //   const timeoutCell = document.createElement("td");
  //   const timeoutInput = this.createTimeoutInput(stepData);
  //   timeoutCell.appendChild(timeoutInput);

  //   // Remove button
  //   const removeCell = document.createElement("td");
  //   const removeBtn = this.createRemoveButton(row);
  //   removeCell.appendChild(removeBtn);

  //   // Append all cells
  //   row.appendChild(stepNumCell);
  //   row.appendChild(toolCell);
  //   row.appendChild(argsCell);
  //   row.appendChild(conditionCell);
  //   row.appendChild(variablesCell);
  //   row.appendChild(timeoutCell);
  //   row.appendChild(removeCell);

  //   return row;
  // }

  /**
   * Create condition container with select and value input
   * @param {Object} stepData - Step data
   * @returns {HTMLElement} Container element
   */
  createConditionContainer(stepData = null) {
    const container = document.createElement("div");
    container.className = "condition-container";

    const select = document.createElement("select");
    select.className = "form-control condition-select";

    // Add condition options
    this.conditionTypes.forEach(condition => {
      const option = document.createElement("option");
      option.value = condition.value;
      option.textContent = condition.label;
      option.dataset.needsValue = condition.needsValue;
      select.appendChild(option);
    });

    // ✅ Set value from stepData BEFORE creating value input
    if (stepData?.condition?.type) {
      select.value = stepData.condition.type;
    }

    const valueInput = document.createElement("input");
    valueInput.type = "text";
    valueInput.className = "form-control condition-value";
    valueInput.placeholder = "Condition value...";
    valueInput.style.marginTop = "5px";

    // ✅ Set value from stepData
    if (stepData?.condition?.value) {
      valueInput.value = stepData.condition.value;
    }

    // Show/hide value input based on condition type
    const updateValueInput = () => {
      const selectedOption = select.selectedOptions[0];
      const needsValue = selectedOption ? selectedOption.dataset.needsValue === 'true' : false;
      valueInput.style.display = needsValue ? 'block' : 'none';
    };

    select.addEventListener('change', updateValueInput);
    updateValueInput(); // ✅ Initialize visibility AFTER setting values

    container.appendChild(select);
    container.appendChild(valueInput);

    return container;
  }

  /**
   * Create variables input for regex extraction
   * @param {Object} stepData - Step data
   * @returns {HTMLElement} Textarea element
   */
  createVariablesInput(stepData = null) {
    const textarea = document.createElement("textarea");
    textarea.className = "form-control variables-input";
    textarea.placeholder = "var_name: regex_pattern\none_per_line";
    textarea.rows = 2;

    // ✅ Fix the variables setting
    if (stepData?.variables && typeof stepData.variables === 'object') {
      const varsText = Object.entries(stepData.variables)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      textarea.value = varsText;
      console.log('Setting variables value:', varsText); // Debug
    }

    return textarea;
  }

  /**
   * Create timeout input
   * @param {Object} stepData - Step data
   * @returns {HTMLElement} Input element
   */
  createTimeoutInput(stepData = null) {
    const input = document.createElement("input");
    input.type = "number";
    input.className = "form-control step-timeout";
    input.placeholder = "Timeout (s)";
    input.min = "1";
    input.max = "3600";
    
    // ✅ Set the timeout value
    const timeoutValue = stepData?.timeout || 300;
    input.value = timeoutValue;
    console.log('Setting timeout value:', timeoutValue); // Debug

    return input;
  }

  /**
   * Create enhanced arguments input with variable support
   * @param {Object} stepData - Step data
   * @returns {HTMLElement} Container with input and button
   */
  createArgumentsInput(stepData = null) {
    console.log('Creating args input with stepData:', stepData); // Debug
    
    const container = document.createElement('div');
    container.className = 'input-group';
    
    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-control args-input";
    input.placeholder = "Tool arguments (use {variable} for substitution)";

    if (stepData && stepData.args) {
      const argsValue = Array.isArray(stepData.args) ? stepData.args.join(" ") : stepData.args;
      console.log('Setting args value:', argsValue); // Debug
      input.value = argsValue; // ✅ This line was missing!
    }

    // Add variable validation and support
    input.addEventListener('input', () => {
      this.validateVariables(input);
    });

    input.addEventListener('blur', () => {
      this.validateArguments(input);
    });

    const varBtn = document.createElement('button');
    varBtn.type = 'button';
    varBtn.className = 'btn btn-small var-picker-btn';
    varBtn.innerHTML = '{}';
    varBtn.title = 'Insert variable';
    varBtn.addEventListener('click', () => this.showVariableSelector(input));
    
    container.appendChild(input);
    container.appendChild(varBtn);

    return container;
  }

  /**
   * Validate arguments input with enhanced checking
   * @param {HTMLElement} input - Arguments input element
   */
  validateArguments(input) {
    const value = input.value.trim();

    // Check for dangerous patterns
    const dangerousPatterns = [
      /<script.*?>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /;\s*rm\s+-rf/i,
      /;\s*sudo/i
    ];

    const hasDangerous = dangerousPatterns.some(pattern => pattern.test(value));

    if (hasDangerous) {
      input.style.borderColor = 'var(--error-color)';
      this.showNotification('Potentially dangerous content detected in arguments', 'error');
    } else {
      input.style.borderColor = 'var(--border-color)';
    }

    // Validate variables
    this.validateVariables(input);
  }

  /**
   * Validate variables in input
   * @param {HTMLElement} input - Input element
   */
  validateVariables(input) {
    const value = input.value;
    const variables = value.match(/\{([^}]+)\}/g);

    if (variables) {
      const undefinedVars = variables.filter(v => {
        const varName = v.slice(1, -1);
        return !this.scenarioVariables.has(varName) &&
          !['target', 'target_url', 'username', 'password', 'service', 'port'].includes(varName);
      });

      if (undefinedVars.length > 0) {
        input.style.borderColor = 'var(--warning-color)';
        input.title = `Undefined variables: ${undefinedVars.join(', ')}`;
      } else {
        input.style.borderColor = 'var(--success-color)';
        input.title = `All variables are valid: ${variables.join(', ')}`;
      }
    } else {
      input.style.borderColor = 'var(--border-color)';
      input.title = '';
    }
  }

  /**
   * Show variable selector modal
   * @param {HTMLElement} input - Input to populate
   */
  showVariableSelector(input) {
    const modal = document.createElement('div');
    modal.className = 'modal variable-modal';

    const availableVars = Array.from(this.scenarioVariables.keys());
    const commonVars = ['target', 'target_url', 'username', 'password', 'service', 'port'];

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Insert Variable</h3>
          <button class="modal-close" type="button">&times;</button>
        </div>
        <div class="modal-body">
          <div class="variable-groups">
            <div class="var-group">
              <h4>Common Variables:</h4>
              ${commonVars.map(v => `<button class="var-btn" data-var="${v}">{${v}}</button>`).join('')}
            </div>
            ${availableVars.length > 0 ? `
              <div class="var-group">
                <h4>Scenario Variables:</h4>
                ${availableVars.map(v => `<button class="var-btn" data-var="${v}">{${v}}</button>`).join('')}
              </div>
            ` : ''}
          </div>
          <div class="custom-var">
            <input type="text" class="custom-var-input" placeholder="Custom variable name...">
            <button class="btn custom-var-btn">Add Custom</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'block';

    // Event listeners
    modal.querySelector('.modal-close').addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    modal.querySelectorAll('.var-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cursorPos = input.selectionStart || 0;
        const textBefore = input.value.substring(0, cursorPos);
        const textAfter = input.value.substring(input.selectionEnd || cursorPos);

        input.value = textBefore + `{${btn.dataset.var}}` + textAfter;
        input.focus();
        input.setSelectionRange(cursorPos + btn.dataset.var.length + 2, cursorPos + btn.dataset.var.length + 2);

        this.validateVariables(input);
        modal.remove();
      });
    });

    const customVarBtn = modal.querySelector('.custom-var-btn');
    if (customVarBtn) {
      customVarBtn.addEventListener('click', () => {
        const customInput = modal.querySelector('.custom-var-input');
        const varName = customInput.value.trim();

        if (varName) {
          const cursorPos = input.selectionStart || 0;
          const textBefore = input.value.substring(0, cursorPos);
          const textAfter = input.value.substring(input.selectionEnd || cursorPos);

          input.value = textBefore + `{${varName}}` + textAfter;
          input.focus();
          input.setSelectionRange(cursorPos + varName.length + 2, cursorPos + varName.length + 2);

          this.validateVariables(input);
          modal.remove();
        }
      });
    }
  }

  /**
   * Show the load scenario modal
   */
  async showLoadModal() {
    // Create modal if it doesn't exist
    if (!this.loadModal) {
      this.createLoadModal();
    }

    if (this.loadModal) {
      this.loadModal.style.display = "block";
      await this.loadAvailableScenarios();
    }
  }

  /**
   * Hide the load scenario modal
   */
  hideLoadModal() {
    if (this.loadModal) {
      this.loadModal.style.display = "none";
    }
  }

  /**
   * Create the load scenario modal
   */
  createLoadModal() {
    // Remove existing modal if present
    const existingModal = document.getElementById('load-scenario-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal HTML
    const modal = document.createElement('div');
    modal.id = 'load-scenario-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Load Scenario</h3>
          <button class="modal-close" type="button">&times;</button>
        </div>
        <div class="modal-body">
          <div id="scenario-list" class="scenario-list">
            <div class="loading">Loading scenarios...</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.loadModal = modal;

    // Add event listeners
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideLoadModal());
    }

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideLoadModal();
      }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'block') {
        this.hideLoadModal();
      }
    });
  }

  /**
   * Load available scenarios list including examples
   */
  async loadAvailableScenarios() {
    const scenarioList = document.getElementById('scenario-list');
    if (!scenarioList) {
      console.error('Scenario list element not found');
      return;
    }

    scenarioList.innerHTML = '<div class="loading">Loading scenarios...</div>';

    try {
      // Load saved scenarios from server
      let savedScenarios = [];
      try {
        const response = await fetch('/list_scenarios');
        const data = await response.json();
        if (data.status === 'success' && data.scenarios) {
          savedScenarios = data.scenarios;
        }
      } catch (err) {
        console.warn('Could not load saved scenarios:', err);
      }

      // Load example scenarios
      let exampleScenarios = [];
      try {
        if (typeof loadExampleScenarios !== 'undefined') {
          exampleScenarios = loadExampleScenarios();
        } else if (typeof ExampleScenarios !== 'undefined') {
          // Fallback to direct access
          exampleScenarios = Object.keys(ExampleScenarios).map(key => ({
            id: key,
            ...ExampleScenarios[key]
          }));
        }
      } catch (err) {
        console.warn('Could not load example scenarios:', err);
      }

      // Combine scenarios
      const allScenarios = [
        ...savedScenarios,
        ...exampleScenarios.map(scenario => ({
          ...scenario,
          isExample: true,
          name: `[Example] ${scenario.name}`
        }))
      ];

      if (allScenarios.length > 0) {
        this.renderScenarioList(allScenarios);
      } else {
        scenarioList.innerHTML = '<p>No scenarios found</p>';
      }
    } catch (err) {
      console.error('Load scenarios error:', err);
      scenarioList.innerHTML = '<p>Error loading scenarios</p>';
    }
  }

  /**
   * Render the scenarios list in the modal
   * @param {Array} scenarios - Array of scenario objects
   */
  renderScenarioList(scenarios) {
    const scenarioList = document.getElementById('scenario-list');
    if (!scenarioList) return;

    scenarioList.innerHTML = '';

    if (scenarios.length === 0) {
      scenarioList.innerHTML = '<p>No scenarios found</p>';
      return;
    }

    // Group scenarios by type
    const savedScenarios = scenarios.filter(s => !s.isExample);
    const exampleScenarios = scenarios.filter(s => s.isExample);

    // Add saved scenarios section
    if (savedScenarios.length > 0) {
      const savedHeader = document.createElement('h4');
      savedHeader.textContent = 'Saved Scenarios';
      savedHeader.className = 'scenario-section-header';
      scenarioList.appendChild(savedHeader);

      savedScenarios.forEach(scenario => {
        scenarioList.appendChild(this.createScenarioItem(scenario));
      });
    }

    // Add example scenarios section
    if (exampleScenarios.length > 0) {
      const exampleHeader = document.createElement('h4');
      exampleHeader.textContent = 'Example Scenarios';
      exampleHeader.className = 'scenario-section-header example-header';
      scenarioList.appendChild(exampleHeader);

      exampleScenarios.forEach(scenario => {
        scenarioList.appendChild(this.createScenarioItem(scenario));
      });
    }
  }

  /**
   * Create a scenario item element
   * @param {Object} scenario - Scenario object
   * @returns {HTMLElement} Scenario item element
   */
  createScenarioItem(scenario) {
    const item = document.createElement('div');
    item.className = `scenario-item ${scenario.isExample ? 'example-scenario' : ''}`;

    const stepsCount = scenario.steps?.length || 0;
    const variableCount = Object.keys(scenario.variables || {}).length;

    item.innerHTML = `
      <h4>${this.escapeHtml(scenario.name)}</h4>
      <div class="scenario-meta">
        <span class="scenario-stat">📋 ${stepsCount} steps</span>
        <span class="scenario-stat">🔧 ${variableCount} variables</span>
        <span class="scenario-stat">📅 ${new Date(scenario.created || Date.now()).toLocaleDateString()}</span>
        ${scenario.isExample ? '<span class="example-badge">Example</span>' : ''}
      </div>
      <p class="scenario-description">${this.escapeHtml(scenario.description || 'No description')}</p>
      ${scenario.isExample ? `
        <div class="scenario-preview">
          <strong>Key Features:</strong>
          <ul>
            ${this.getScenarioFeatures(scenario).map(feature => `<li>${this.escapeHtml(feature)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    `;

    item.addEventListener('click', async () => {
      try {
        // Handle example scenarios differently
        if (scenario.isExample) {
          this.loadScenario(scenario);
          this.hideLoadModal();
          return;
        }

        // For saved scenarios, use the load_name (filename without extension)
        const scenarioName = scenario.load_name || scenario.filename?.replace('.json', '') || scenario.name;
        console.log('Loading saved scenario:', scenarioName);
        
        const response = await fetch(`/load_scenario/${encodeURIComponent(scenarioName)}`);
        const data = await response.json();
        
        if (data.status === 'error') {
          console.error('Failed to load scenario:', data.message);
          this.showNotification(`Failed to load scenario: ${data.message}`, 'error');
          return;
        }

        // The server returns the scenario data directly (not nested)
        // Remove the 'status' field since loadScenario doesn't expect it
        const scenarioData = {
          name: data.name,
          description: data.description,
          steps: data.steps,
          variables: data.variables,
          created: data.created,
          filename: data.filename
        };
        
        console.log('Received scenario data:', scenarioData); // Debug
        
        this.loadScenario(scenarioData);
        this.hideLoadModal();
      } catch (err) {
        console.error('Error loading scenario:', err);
        this.showNotification('Error loading scenario', 'error');
      }
    });


    return item;
  }

  /**
   * Load a scenario into the editor
   * @param {Object} scenario - Scenario object to load
   */
  loadScenario(scenario) {
    try {
      console.log('Loading scenario:', scenario); // Debug

      // Clear existing steps
      if (this.stepsTableBody) {
        this.stepsTableBody.innerHTML = '';
      }

      // Set scenario name
      if (this.scenarioNameInput) {
        this.scenarioNameInput.value = (scenario.name || '').replace('[Example] ', '');
      }

      // Load scenario variables
      if (scenario.variables) {
        this.scenarioVariables.clear();
        Object.entries(scenario.variables).forEach(([key, value]) => {
          this.scenarioVariables.set(key, value);
        });
        console.log('Loaded variables:', this.scenarioVariables); // Debug
      }

      // Load steps
      if (scenario.steps && Array.isArray(scenario.steps)) {
        console.log('Loading steps:', scenario.steps.length); // Debug
        scenario.steps.forEach((stepData, index) => {
          console.log(`Loading step ${index}:`, stepData); // Debug
          this.addStep(stepData); // This should now populate fields correctly
        });
      }

      // Update UI
      this.updateUI();

      // Show success message
      const scenarioType = scenario.isExample ? 'example scenario' : 'scenario';
      this.showNotification(`Loaded ${scenarioType}: ${scenario.name}`, 'success');

      // If it's an example, show variables that need to be customized
      if (scenario.isExample) {
        this.showVariableCustomizationHint(scenario);
      }
    } catch (err) {
      console.error('Error loading scenario:', err);
      this.showNotification('Error loading scenario', 'error');
    }
  }

  /**
   * Clear all steps and reset the scenario
   * @param {boolean} askConfirmation - Whether to ask for confirmation
   */
  clearScenario(askConfirmation = true) {
    if (askConfirmation && !confirm('Are you sure you want to clear all steps? This cannot be undone.')) {
      return;
    }
    
    // Clear the steps table
    if (this.stepsTableBody) {
      this.stepsTableBody.innerHTML = '';
    }

    // Clear scenario name
    if (this.scenarioNameInput) {
      this.scenarioNameInput.value = '';
    }

    // Clear scenario variables
    this.scenarioVariables.clear();
    
    // Clear step results
    if (this.stepResults) {
      this.stepResults.clear();
    }

    // Reset scenario state
    this.currentScenarioId = null;
    this.isRunning = false;
    this.runningStepIndex = -1;

    // Update UI
    this.updateUI();
    
    // Show notification
    if (askConfirmation) {
      this.showNotification('Scenario cleared successfully', 'info');
    }
    
    // Focus on scenario name input
    if (this.scenarioNameInput) {
      setTimeout(() => {
        this.scenarioNameInput.focus();
      }, 100);
    }
  }

  /**
   * Create remove button for step row
   * @param {HTMLElement} row - The row element to remove
   * @returns {HTMLElement} Remove button element
   */
  createRemoveButton(row) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-small btn-danger remove-step-btn";
    button.innerHTML = "🗑️";
    button.title = "Remove this step";
    
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (confirm("Are you sure you want to remove this step?")) {
        // Remove the row with animation
        row.style.animation = "fadeOut 0.3s ease-out";
        setTimeout(() => {
          if (row.parentNode) {
            row.remove();
            this.updateStepNumbers();
            this.updateUI();
            this.showNotification("Step removed", "info");
          }
        }, 300);
      }
    });
    
    return button;
  }

  /**
   * Update step numbers after removing a step
   */
  updateStepNumbers() {
    const rows = this.stepsTableBody.querySelectorAll('.step-row');
    rows.forEach((row, index) => {
      const stepNumberCell = row.querySelector('.step-number');
      if (stepNumberCell) {
        stepNumberCell.textContent = index + 1;
      }
      row.dataset.index = index;
    });
  }

  /**
   * Get available tools grouped by category
   * @returns {Object} Tools grouped by category
   */
  getToolCategories() {
    return {
      "Network Scanning": ["nmap", "masscan", "zmap"],
      "Web Testing": ["gobuster", "nikto", "dirb", "ffuf", "feroxbuster", "whatweb"],
      "Vulnerability Scanning": ["nuclei", "trivy", "testssl"],
      "Exploitation": ["sqlmap", "hydra", "john", "hashcat"],
      "Information Gathering": ["theharvester", "amass", "subfinder", "shodan"],
      "Enumeration": ["enum4linux", "nbtscan", "ldapsearch", "snmp-check"],
      "Other": ["eyewitness", "gitleaks", "smbclient"]
    };
  }
}



document.addEventListener('DOMContentLoaded', () => {
  // Initialize the enhanced scenario manager
  window.scenarioManager = new ScenarioManager();
});
