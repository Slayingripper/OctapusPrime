// Application state
const AppState = {
  socket: null,
  outputCards: {},
  isScanning: false,
  tools: {},
  scheduledTools: new Map()
};

// Tool categories and definitions
const TOOL_CATEGORIES = {
  'Network Discovery': {
    nmap: {
      name: 'Nmap',
      description: 'Network exploration tool and security scanner',
      args: ['-sV', '-A', '-O', '-T4', '-p 1-1000', '-sS', '-sU', '--script vuln', '-oN output.txt']
    },
    masscan: {
      name: 'Masscan',
      description: 'Fast port scanner for large networks',
      args: ['-p1-65535', '--rate 1000', '--ping', '-e eth0', '--banners', '-oX output.xml']
    },
    zmap: {
      name: 'Zmap',
      description: 'Internet-wide network scanner',
      args: ['-p 80', '-B 10M', '-c 1000', '-o results.csv']
    }
  },
  'Web Application': {
    gobuster: {
      name: 'Gobuster',
      description: 'Directory/file & DNS busting tool',
      args: ['dir -u http://target', '-w /usr/share/wordlists/dirb/common.txt', '-x php,txt,html', '-t 50', '-s 200,204,301,302']
    },
    nikto: {
      name: 'Nikto',
      description: 'Web vulnerability scanner',
      args: ['-h http://target', '-Tuning x', '-Display V', '-ssl', '-port 443', '-output nikto.txt']
    },
    sqlmap: {
      name: 'SQLmap',
      description: 'SQL injection detection and exploitation',
      args: ['-u http://target?id=1', '--batch', '--level 5', '--risk 3', '--dbs', '--tables', '--dump']
    },
    ffuf: {
      name: 'FFUF',
      description: 'Fast web fuzzer written in Go',
      args: ['-u http://target/FUZZ', '-w /usr/share/wordlists/common.txt', '-t 100', '-mc 200,204,301,302', '-fc 404']
    },
    wpscan: {
      name: 'WPScan',
      description: 'WordPress security scanner',
      args: ['--url http://target/', '--enumerate p', '--enumerate u', '--enumerate t', '--api-token TOKEN']
    }
  },
  'Credential Testing': {
    hydra: {
      name: 'Hydra',
      description: 'Login cracker supporting numerous protocols',
      args: ['-l admin', '-P /usr/share/wordlists/rockyou.txt', '-t 4', 'ssh://target', 'ftp://target', '-f', '-V']
    },
    john: {
      name: 'John',
      description: 'Password cracker',
      args: ['--wordlist=/usr/share/wordlists/rockyou.txt', '--format=raw-md5', 'hashes.txt', '--rules', '--show']
    },
    hashcat: {
      name: 'Hashcat',
      description: 'Advanced password recovery',
      args: ['-m 0', '-a 0', 'hashes.txt wordlist.txt', '--force', '-O', '--show']
    }
  },
  'Network Analysis': {
    enum4linux: {
      name: 'Enum4Linux',
      description: 'SMB enumeration tool for Linux',
      args: ['-a', '-u user', '-p password', '-S', '-U', '-G']
    },
    nbtscan: {
      name: 'NBTSCAN',
      description: 'NetBIOS name network scanner',
      args: ['-r', '-v', '-s :', '-h', '-m']
    },
    sslscan: {
      name: 'SSLScan',
      description: 'SSL/TLS configuration scanner',
      args: ['--no-failed', '--show-supported', '--reuse', '--xml=ssl.xml', '--ipv4']
    }
  },
  'Information Gathering': {
    theharvester: {
      name: 'TheHarvester',
      description: 'E-mail, subdomain and people names harvester',
      args: ['-d example.com', '-b google', '-b bing', '-l 500', '-f results.xml']
    },
    amass: {
      name: 'AMASS',
      description: 'In-depth DNS enumeration and network mapping',
      args: ['enum -d example.com', '-active', '-passive', '-brute', '-o amass.txt', '-ip']
    },
    subfinder: {
      name: 'Subfinder',
      description: 'Subdomain discovery tool',
      args: ['-d example.com', '-silent', '-o subdomains.txt', '-all', '-t 10', '-v']
    },
    dnsenum: {
      name: 'DNSenum',
      description: 'DNS enumeration tool',
      args: ['example.com', '--threads 5', '--dnsserver 8.8.8.8', '--enum', '-f dns.txt']
    }
  }
};

// Command database for detailed help
const TOOL_COMMANDS = {
  nmap: [
    { cmd: "-sV", desc: "Version detection" },
    { cmd: "-A", desc: "Aggressive scan (OS detection, version detection, script scanning)" },
    { cmd: "-O", desc: "OS detection" },
    { cmd: "-sS", desc: "TCP SYN scan (stealth)" },
    { cmd: "-sU", desc: "UDP scan" },
    { cmd: "-sC", desc: "Default script scan" },
    { cmd: "-T4", desc: "Timing template (aggressive)" },
    { cmd: "-T1", desc: "Timing template (slow/stealthy)" },
    { cmd: "-p 1-1000", desc: "Scan ports 1-1000" },
    { cmd: "-p-", desc: "Scan all 65535 ports" },
    { cmd: "--script vuln", desc: "Vulnerability detection scripts" },
    { cmd: "--script auth", desc: "Authentication bypass scripts" },
    { cmd: "-sn", desc: "Ping scan (no port scan)" },
    { cmd: "-Pn", desc: "Skip host discovery" },
    { cmd: "-oN output.txt", desc: "Normal output to file" },
    { cmd: "-oX output.xml", desc: "XML output to file" },
    { cmd: "-v", desc: "Verbose output" },
    { cmd: "--reason", desc: "Show reason for port state" }
  ],
  masscan: [
    { cmd: "-p1-65535", desc: "Scan all 65535 ports" },
    { cmd: "-p80,443,8080", desc: "Scan specific ports" },
    { cmd: "--rate 1000", desc: "Set packet transmission rate" },
    { cmd: "--rate 10000", desc: "Fast scan (10k packets/sec)" },
    { cmd: "--ping", desc: "ICMP ping sweep" },
    { cmd: "-e eth0", desc: "Specify network interface" },
    { cmd: "--banners", desc: "Grab service banners" },
    { cmd: "--source-port 40000", desc: "Use specific source port" },
    { cmd: "--max-rate 100000", desc: "Maximum transmission rate" },
    { cmd: "-oX output.xml", desc: "XML output format" },
    { cmd: "-oJ output.json", desc: "JSON output format" },
    { cmd: "--excludefile exclude.txt", desc: "Exclude IPs from file" },
    { cmd: "--include-file include.txt", desc: "Include IPs from file" },
    { cmd: "--top-ports 100", desc: "Scan top 100 ports" },
    { cmd: "--wait 0", desc: "Don't wait for responses" },
    { cmd: "--offline", desc: "Don't transmit packets" }
  ],
  gobuster: [
    { cmd: "dir -u http://target", desc: "Directory enumeration mode" },
    { cmd: "dns -d domain.com", desc: "DNS subdomain enumeration" },
    { cmd: "vhost -u http://target", desc: "Virtual host enumeration" },
    { cmd: "-w /usr/share/wordlists/dirb/common.txt", desc: "Common wordlist" },
    { cmd: "-w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt", desc: "Medium wordlist" },
    { cmd: "-x php,txt,html,js,css", desc: "File extensions to search" },
    { cmd: "-x asp,aspx,jsp,do", desc: "Web app extensions" },
    { cmd: "-t 50", desc: "Number of concurrent threads" },
    { cmd: "-t 10", desc: "Slower scan (10 threads)" },
    { cmd: "-s 200,204,301,302,307", desc: "HTTP status codes to show" },
    { cmd: "-b 404,403", desc: "HTTP status codes to hide" },
    { cmd: "-k", desc: "Skip SSL certificate verification" },
    { cmd: "-r", desc: "Follow redirects" },
    { cmd: "-f", desc: "Append / to directory names" },
    { cmd: "-e", desc: "Show extended output" },
    { cmd: "-q", desc: "Quiet mode" },
    { cmd: "-o output.txt", desc: "Save output to file" },
    { cmd: "-a 'Mozilla/5.0'", desc: "Set User-Agent string" },
    { cmd: "--timeout 10s", desc: "HTTP request timeout" }
  ],
  nikto: [
    { cmd: "-h http://target", desc: "Target host/URL" },
    { cmd: "-h https://target:8443", desc: "HTTPS target with custom port" },
    { cmd: "-Tuning x", desc: "All scan types" },
    { cmd: "-Tuning 1", desc: "Interesting files" },
    { cmd: "-Tuning 2", desc: "Misconfiguration" },
    { cmd: "-Tuning 3", desc: "Information disclosure" },
    { cmd: "-Tuning 4", desc: "Injection attacks" },
    { cmd: "-Tuning 5", desc: "Remote file retrieval" },
    { cmd: "-Tuning 6", desc: "Denial of service" },
    { cmd: "-Display V", desc: "Verbose display" },
    { cmd: "-Display 1", desc: "Show redirects" },
    { cmd: "-Display 2", desc: "Show cookies" },
    { cmd: "-ssl", desc: "Force SSL/HTTPS" },
    { cmd: "-port 443,8443", desc: "Specify ports" },
    { cmd: "-timeout 10", desc: "Request timeout" },
    { cmd: "-output nikto.txt", desc: "Save output to file" },
    { cmd: "-Format txt", desc: "Text output format" },
    { cmd: "-Format xml", desc: "XML output format" },
    { cmd: "-useragent 'Custom Agent'", desc: "Custom User-Agent" },
    { cmd: "-id user:pass", desc: "HTTP authentication" }
  ],
  sqlmap: [
    { cmd: "-u 'http://target?id=1'", desc: "Target URL with parameter" },
    { cmd: "-r request.txt", desc: "Load request from file" },
    { cmd: "--data 'id=1&name=test'", desc: "POST data" },
    { cmd: "--cookie 'PHPSESSID=abc123'", desc: "HTTP cookies" },
    { cmd: "--batch", desc: "Non-interactive mode" },
    { cmd: "--level 5", desc: "Test level (1-5)" },
    { cmd: "--risk 3", desc: "Risk level (1-3)" },
    { cmd: "--dbs", desc: "Enumerate databases" },
    { cmd: "--tables", desc: "Enumerate tables" },
    { cmd: "--columns", desc: "Enumerate columns" },
    { cmd: "--dump", desc: "Dump table data" },
    { cmd: "--dump-all", desc: "Dump all databases" },
    { cmd: "-D database", desc: "Target specific database" },
    { cmd: "-T table", desc: "Target specific table" },
    { cmd: "-C column", desc: "Target specific column" },
    { cmd: "--os-shell", desc: "Interactive OS shell" },
    { cmd: "--sql-shell", desc: "Interactive SQL shell" },
    { cmd: "--technique B", desc: "Boolean-based blind" },
    { cmd: "--technique T", desc: "Time-based blind" },
    { cmd: "--technique U", desc: "Union query" },
    { cmd: "--random-agent", desc: "Random User-Agent" },
    { cmd: "--threads 5", desc: "Number of threads" },
    { cmd: "--delay 1", desc: "Delay between requests" }
  ],
  hydra: [
    { cmd: "-l admin", desc: "Single username" },
    { cmd: "-L users.txt", desc: "Username list from file" },
    { cmd: "-p password", desc: "Single password" },
    { cmd: "-P /usr/share/wordlists/rockyou.txt", desc: "Password list (rockyou)" },
    { cmd: "-P /usr/share/wordlists/fasttrack.txt", desc: "Password list (fasttrack)" },
    { cmd: "-t 4", desc: "Number of parallel tasks" },
    { cmd: "-t 16", desc: "Aggressive parallel tasks" },
    { cmd: "ssh://target", desc: "SSH brute force" },
    { cmd: "ftp://target", desc: "FTP brute force" },
    { cmd: "http-post-form://target/login.php", desc: "HTTP POST form" },
    { cmd: "http-get://target/admin", desc: "HTTP Basic Auth" },
    { cmd: "rdp://target", desc: "RDP brute force" },
    { cmd: "smb://target", desc: "SMB brute force" },
    { cmd: "-f", desc: "Stop after first success" },
    { cmd: "-F", desc: "Stop after first success per host" },
    { cmd: "-V", desc: "Verbose output" },
    { cmd: "-v", desc: "Show login attempts" },
    { cmd: "-s 2222", desc: "Custom port" },
    { cmd: "-o results.txt", desc: "Save output to file" },
    { cmd: "-R", desc: "Restore previous session" },
    { cmd: "-I", desc: "Ignore restore file" }
  ],
  sslscan: [
    { cmd: "--targets=target", desc: "Single target" },
    { cmd: "--no-failed", desc: "Hide failed cipher tests" },
    { cmd: "--show-supported", desc: "Show supported ciphers only" },
    { cmd: "--xml=ssl.xml", desc: "XML output file" },
    { cmd: "--ipv4", desc: "Force IPv4" }
  ],
  john: [
    { cmd: "--wordlist=/usr/share/wordlists/rockyou.txt", desc: "Use rockyou wordlist" },
    { cmd: "--format=raw-md5", desc: "MD5 hash format" },
    { cmd: "--rules", desc: "Apply word mangling rules" },
    { cmd: "--show", desc: "Show cracked passwords" }
  ],
  hashcat: [
    { cmd: "-m 0", desc: "MD5 hash mode" },
    { cmd: "-a 0", desc: "Dictionary attack" },
    { cmd: "--force", desc: "Ignore warnings" },
    { cmd: "--show", desc: "Show cracked passwords" }
  ]
};

// Utility functions (must be defined early)
function findToolByKey(toolKey) {
  for (const category of Object.values(TOOL_CATEGORIES)) {
    if (category[toolKey]) {
      return category[toolKey];
    }
  }
  return null;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setupButtonListener(id, handler) {
  const button = document.getElementById(id);
  if (button) {
    button.addEventListener('click', handler);
    console.log(`Event listener added for: ${id}`);
  } else {
    console.warn(`Button not found: ${id}`);
  }
}

function filterTools(searchTerm) {
  const toolCards = document.querySelectorAll('.tool-card');
  const categories = document.querySelectorAll('.tool-category');
  
  toolCards.forEach(card => {
    const toolName = card.querySelector('.tool-name');
    const toolDesc = card.querySelector('.tool-description');
    
    if (toolName && toolDesc) {
      const nameMatch = toolName.textContent.toLowerCase().includes(searchTerm);
      const descMatch = toolDesc.textContent.toLowerCase().includes(searchTerm);
      const visible = nameMatch || descMatch || searchTerm === '';
      
      card.style.display = visible ? 'block' : 'none';
    }
  });

  // Hide empty categories
  categories.forEach(category => {
    const visibleTools = category.querySelectorAll('.tool-card[style="display: block;"], .tool-card:not([style*="none"])');
    category.style.display = visibleTools.length > 0 ? 'block' : 'none';
  });
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing app...');
  initializeApp();
});

function initializeApp() {
  console.log('Initializing app...');
  console.log('TOOL_CATEGORIES:', TOOL_CATEGORIES);
  
  initializeSocket();
  renderToolPalette();
  setupEventListeners();
  loadScenarios();
  
  console.log('App initialization complete');
}

// Socket.IO initialization
function initializeSocket() {
  if (typeof io === 'undefined') {
    console.warn('Socket.IO not available, running in standalone mode');
    updateConnectionStatus(false);
    return;
  }

  AppState.socket = io();
  
  AppState.socket.on('connect', () => {
    updateConnectionStatus(true);
  });

  AppState.socket.on('disconnect', () => {
    updateConnectionStatus(false);
  });

  AppState.socket.on('log', (data) => {
    handleLogMessage(data);
  });

  AppState.socket.on('scan_complete', (data) => {
    handleScanComplete(data);
  });
}

function updateConnectionStatus(connected) {
  const statusDot = document.getElementById('connection-status');
  const statusText = document.getElementById('connection-text');
  
  if (statusDot && statusText) {
    if (connected) {
      statusDot.classList.add('connected');
      statusText.textContent = 'Connected';
    } else {
      statusDot.classList.remove('connected');
      statusText.textContent = 'Disconnected';
    }
  }
}

// Render tool palette
function renderToolPalette() {
  console.log('Rendering tool palette...');
  const container = document.getElementById('tool-categories');
  
  if (!container) {
    console.error('Tool categories container not found!');
    return;
  }
  
  console.log('Container found:', container);
  container.innerHTML = '';

  Object.entries(TOOL_CATEGORIES).forEach(([category, tools]) => {
    console.log(`Rendering category: ${category}`, tools);
    
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'tool-category';
    
    const categoryTitle = document.createElement('h4');
    categoryTitle.className = 'category-title';
    categoryTitle.textContent = category;
    categoryDiv.appendChild(categoryTitle);

    Object.entries(tools).forEach(([toolKey, tool]) => {
      console.log(`Creating tool card for: ${toolKey}`, tool);
      const toolCard = createToolCard(toolKey, tool);
      categoryDiv.appendChild(toolCard);
    });

    container.appendChild(categoryDiv);
  });
  
  console.log('Tool palette rendering complete');
}

function createToolCard(toolKey, tool) {
  const card = document.createElement('div');
  card.className = 'tool-card';
  card.draggable = true;
  card.dataset.tool = toolKey;

  const header = document.createElement('div');
  header.className = 'tool-header';
  
  const name = document.createElement('div');
  name.className = 'tool-name';
  name.textContent = tool.name;
  
  const helpBtn = document.createElement('button');
  helpBtn.className = 'tool-help-btn';
  helpBtn.textContent = '?';
  helpBtn.title = 'Show commands';
  helpBtn.onclick = (e) => {
    e.stopPropagation();
    showCommandModal(toolKey);
  };

  header.appendChild(name);
  header.appendChild(helpBtn);

  const description = document.createElement('div');
  description.className = 'tool-description';
  description.textContent = tool.description;

  const argPalette = document.createElement('div');
  argPalette.className = 'arg-palette';
  
  tool.args.slice(0, 6).forEach(arg => {
    const chip = document.createElement('div');
    chip.className = 'arg-chip';
    chip.textContent = arg;
    chip.draggable = true;
    chip.dataset.arg = arg;
    chip.dataset.tool = toolKey;
    argPalette.appendChild(chip);
  });

  card.appendChild(header);
  card.appendChild(description);
  card.appendChild(argPalette);

  // Add drag event listeners
  setupDragEvents(card, toolKey);

  return card;
}

// Setup drag and drop
function setupDragEvents(element, toolKey) {
  element.addEventListener('dragstart', (e) => {
    console.log(`Dragging tool: ${toolKey}`);
    e.dataTransfer.setData('text/plain', toolKey);
  });

  // Handle argument chip dragging
  element.querySelectorAll('.arg-chip').forEach(chip => {
    chip.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      console.log(`Dragging arg: ${chip.dataset.arg} for tool: ${chip.dataset.tool}`);
      const data = {
        tool: chip.dataset.tool,
        arg: chip.dataset.arg
      };
      e.dataTransfer.setData('application/json', JSON.stringify(data));
    });
  });

  // Double-click to show commands
  element.addEventListener('dblclick', () => {
    showCommandModal(toolKey);
  });
}

// Setup drop zone
function setupDropZone() {
  const dropZone = document.getElementById('drop-zone');
  if (!dropZone) {
    console.error('Drop zone not found');
    return;
  }
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    let data;
    try {
      // Try to parse as argument data
      data = JSON.parse(e.dataTransfer.getData('application/json'));
      addArgumentToTool(data.tool, data.arg);
    } catch {
      // Handle as tool name
      const toolName = e.dataTransfer.getData('text/plain');
      if (toolName) {
        addScheduledTool(toolName);
      }
    }
  });
}

// Add scheduled tool
function addScheduledTool(toolKey) {
  if (AppState.scheduledTools.has(toolKey)) {
    return; // Tool already added
  }

  const tool = findToolByKey(toolKey);
  if (!tool) return;

  const placeholder = document.getElementById('drop-placeholder');
  if (placeholder) {
    placeholder.style.display = 'none';
  }

  const item = createScheduledItem(toolKey, tool);
  const dropZone = document.getElementById('drop-zone');
  if (dropZone) {
    dropZone.appendChild(item);
  }
  
  AppState.scheduledTools.set(toolKey, {
    tool: toolKey,
    args: []
  });

  // Create output card
  createOutputCard(toolKey);
}

function createScheduledItem(toolKey, tool) {
  const item = document.createElement('div');
  item.className = 'scheduled-item';
  item.dataset.tool = toolKey;

  const icon = document.createElement('div');
  icon.className = 'item-icon';
  icon.textContent = tool.name.charAt(0).toUpperCase();

  const content = document.createElement('div');
  content.className = 'item-content';

  const title = document.createElement('div');
  title.className = 'item-title';
  title.textContent = tool.name;

  const input = document.createElement('input');
  input.className = 'item-input';
  input.type = 'text';
  input.placeholder = 'Enter command arguments...';
  input.value = tool.args.slice(0, 3).join(' '); // Default args

  content.appendChild(title);
  content.appendChild(input);

  const actions = document.createElement('div');
  actions.className = 'item-actions';

  const removeBtn = document.createElement('button');
  removeBtn.className = 'item-btn btn-remove';
  removeBtn.textContent = '×';
  removeBtn.onclick = () => removeScheduledTool(toolKey);

  actions.appendChild(removeBtn);

  item.appendChild(icon);
  item.appendChild(content);
  item.appendChild(actions);

  return item;
}

function removeScheduledTool(toolKey) {
  const item = document.querySelector(`[data-tool="${toolKey}"]`);
  if (item) {
    item.remove();
  }

  AppState.scheduledTools.delete(toolKey);

  // Remove output card
  if (AppState.outputCards[toolKey]) {
    AppState.outputCards[toolKey].remove();
    delete AppState.outputCards[toolKey];
  }

  // Show placeholder if no tools
  if (AppState.scheduledTools.size === 0) {
    const placeholder = document.getElementById('drop-placeholder');
    if (placeholder) {
      placeholder.style.display = 'block';
    }
  }
}

function addArgumentToTool(toolKey, arg) {
  const item = document.querySelector(`.scheduled-item[data-tool="${toolKey}"]`);
  if (!item) {
    addScheduledTool(toolKey);
    setTimeout(() => addArgumentToTool(toolKey, arg), 100);
    return;
  }

  const input = item.querySelector('.item-input');
  if (input) {
    const current = input.value.trim();
    if (!current.includes(arg)) {
      input.value = current ? `${current} ${arg}` : arg;
    }
  }
}

// Output cards management
function createOutputCard(toolKey) {
  console.log(`Creating output card for: ${toolKey}`);
  
  if (AppState.outputCards[toolKey]) {
    console.log(`Output card already exists for: ${toolKey}`);
    return AppState.outputCards[toolKey];
  }

  const tool = findToolByKey(toolKey);
  if (!tool) {
    console.error(`Tool not found: ${toolKey}`);
    return null;
  }

  const outputContainer = document.getElementById('output-container');
  if (!outputContainer) {
    console.error('Output container not found');
    return null;
  }

  // Hide the "no output" message
  const noOutputMessage = document.getElementById('no-output-message');
  if (noOutputMessage) {
    noOutputMessage.style.display = 'none';
  }

  const card = document.createElement('div');
  card.className = 'output-card';
  card.dataset.tool = toolKey;

  const header = document.createElement('div');
  header.className = 'card-header';
  
  const title = document.createElement('div');
  title.className = 'card-title';
  title.innerHTML = `
    <div class="tool-status" id="status-${toolKey}"></div>
    <span>${tool.name} Output</span>
  `;

  const toggle = document.createElement('button');
  toggle.className = 'card-toggle';
  toggle.textContent = '▶';
  toggle.title = 'Toggle output visibility';

  header.appendChild(title);
  header.appendChild(toggle);

  const body = document.createElement('div');
  body.className = 'card-body';

  const content = document.createElement('div');
  content.className = 'card-content';
  content.innerHTML = '<div class="log-line">Waiting for tool output...</div>';
  body.appendChild(content);

  card.appendChild(header);
  card.appendChild(body);

  // Toggle functionality
  header.addEventListener('click', () => {
    const expanded = body.classList.toggle('expanded');
    header.classList.toggle('expanded', expanded);
    toggle.textContent = expanded ? '▼' : '▶';
    
    if (expanded) {
      body.scrollTop = body.scrollHeight;
    }
  });

  outputContainer.appendChild(card);
  AppState.outputCards[toolKey] = card;
  
  console.log(`Output card created successfully for: ${toolKey}`);
  return card;
}

function handleLogMessage(data) {
  console.log('Received log message:', data);
  
  const { tool, line } = data;
  
  // Make sure we have an output card for this tool
  if (!AppState.outputCards[tool]) {
    console.log(`Creating output card for new tool: ${tool}`);
    createOutputCard(tool);
  }
  
  const card = AppState.outputCards[tool];
  if (!card) {
    console.error(`No output card found for tool: ${tool}`);
    return;
  }

  const content = card.querySelector('.card-content');
  if (!content) {
    console.error(`No content area found for tool: ${tool}`);
    return;
  }

  // Clear the "waiting" message if it's the first real output
  if (content.innerHTML.includes('Waiting for tool output...')) {
    content.innerHTML = '';
  }

  const logLine = document.createElement('div');
  logLine.className = 'log-line';
  
  // Color code different types of output
  if (line.includes('ERROR') || line.includes('FAILED') || line.includes('error')) {
    logLine.classList.add('error');
  } else if (line.includes('WARNING') || line.includes('WARN') || line.includes('warning')) {
    logLine.classList.add('warning');
  } else if (line.includes('SUCCESS') || line.includes('FOUND') || line.includes('Open')) {
    logLine.classList.add('success');
  }
  
  // Add timestamp
  const timestamp = new Date().toLocaleTimeString();
  logLine.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${escapeHtml(line)}`;
  content.appendChild(logLine);

  // Auto-scroll if expanded
  const body = card.querySelector('.card-body');
  if (body && body.classList.contains('expanded')) {
    body.scrollTop = body.scrollHeight;
  }

  // Update tool status
  updateToolStatus(tool, 'running');
  
  console.log(`Log message added to ${tool}: ${line.substring(0, 50)}...`);
}

function updateToolStatus(toolKey, status) {
  const statusElement = document.getElementById(`status-${toolKey}`);
  if (statusElement) {
    statusElement.className = `tool-status ${status}`;
  }
}

function handleScanComplete(data) {
  const { tool, success } = data;
  updateToolStatus(tool, success ? 'complete' : 'error');
}

// Modal functionality
function showCommandModal(toolKey) {
  console.log(`Showing commands for: ${toolKey}`);
  
  const modal = document.getElementById('command-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  
  if (!modal || !title || !body) {
    console.error('Modal elements not found');
    return;
  }

  const tool = findToolByKey(toolKey);
  if (!tool) {
    console.error(`Tool not found: ${toolKey}`);
    return;
  }

  title.textContent = `${tool.name} Commands`;
  
  const commands = TOOL_COMMANDS[toolKey] || [];
  if (commands.length === 0) {
    body.innerHTML = '<p>No detailed commands available for this tool yet.</p>';
  } else {
    const grid = document.createElement('div');
    grid.className = 'command-grid';
    
    commands.forEach(command => {
      const item = document.createElement('div');
      item.className = 'command-item';
      item.onclick = () => {
        addArgumentToTool(toolKey, command.cmd);
        closeModal();
      };
      
      item.innerHTML = `
        <div class="command-cmd">${escapeHtml(command.cmd)}</div>
        <div class="command-desc">${escapeHtml(command.desc)}</div>
      `;
      
      grid.appendChild(item);
    });
    
    body.innerHTML = '';
    body.appendChild(grid);
  }
  
  modal.style.display = 'block';
}

function closeModal() {
  const modal = document.getElementById('command-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Output management functions
function clearAllOutput() {
  console.log('Clearing all output...');
  Object.values(AppState.outputCards).forEach(card => {
    const content = card.querySelector('.card-content');
    if (content) {
      content.innerHTML = '<div class="log-line">Output cleared...</div>';
    }
    
    // Reset tool status
    const toolKey = card.dataset.tool;
    if (toolKey) {
      updateToolStatus(toolKey, 'idle');
    }
  });
}

function expandAllOutput() {
  console.log('Expanding all output...');
  Object.values(AppState.outputCards).forEach(card => {
    const header = card.querySelector('.card-header');
    const body = card.querySelector('.card-body');
    const toggle = card.querySelector('.card-toggle');
    
    if (header && body && toggle) {
      body.classList.add('expanded');
      header.classList.add('expanded');
      toggle.textContent = '▼';
    }
  });
}

function clearAllTools() {
  console.log('Clearing all tools...');
  // Clear scheduled tools
  AppState.scheduledTools.clear();
  
  // Remove all scheduled items from DOM
  document.querySelectorAll('.scheduled-item').forEach(item => item.remove());
  
  // Show placeholder
  const placeholder = document.getElementById('drop-placeholder');
  if (placeholder) {
    placeholder.style.display = 'block';
  }
  
  // Clear output cards
  Object.values(AppState.outputCards).forEach(card => card.remove());
  AppState.outputCards = {};
  
  // Show no-output message
  const noOutputMessage = document.getElementById('no-output-message');
  if (noOutputMessage) {
    noOutputMessage.style.display = 'block';
  }
}

// Add a test output function
function testOutput() {
  console.log('Testing output...');
  
  // First, make sure we have some tools
  if (AppState.scheduledTools.size === 0) {
    addScheduledTool('nmap');
    setTimeout(() => {
      testOutput();
    }, 500);
    return;
  }

  // Simulate some log messages
  const testMessages = [
    { tool: 'nmap', line: 'Starting Nmap scan...' },
    { tool: 'nmap', line: 'Nmap scan report for 192.168.1.1' },
    { tool: 'nmap', line: 'Host is up (0.001s latency).' },
    { tool: 'nmap', line: 'PORT     STATE SERVICE' },
    { tool: 'nmap', line: '22/tcp   open  ssh' },
    { tool: 'nmap', line: '80/tcp   open  http' },
    { tool: 'nmap', line: '443/tcp  open  https' },
    { tool: 'nmap', line: 'Nmap done: 1 IP address (1 host up) scanned' }
  ];

  testMessages.forEach((msg, index) => {
    setTimeout(() => {
      handleLogMessage(msg);
    }, index * 500);
  });

  // Mark as complete after all messages
  setTimeout(() => {
    handleScanComplete({ tool: 'nmap', success: true });
  }, testMessages.length * 500 + 1000);
}

// Scan operations
function startScan() {
  console.log('Starting scan...');
  if (AppState.scheduledTools.size === 0) {
    alert('No tools scheduled. Please add some tools first.');
    return;
  }

  const scripts = [];
  AppState.scheduledTools.forEach((data, toolKey) => {
    const item = document.querySelector(`.scheduled-item[data-tool="${toolKey}"]`);
    if (item) {
      const input = item.querySelector('.item-input');
      if (input) {
        const args = input.value.trim().split(/\s+/).filter(arg => arg);
        scripts.push({
          tool: toolKey,
          args: args
        });
      }
    }
  });

  // Clear existing output
  clearAllOutput();

  // Update UI
  AppState.isScanning = true;
  const startBtn = document.getElementById('start-scan-btn');
  const stopBtn = document.getElementById('stop-scan-btn');
  
  if (startBtn) startBtn.disabled = true;
  if (stopBtn) stopBtn.disabled = false;

  // Start scan
  fetch('/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scripts })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Scan started:', data);
  })
  .catch(error => {
    console.error('Failed to start scan:', error);
    alert('Failed to start scan: ' + error.message);
    resetScanUI();
  });
}

function stopScan() {
  console.log('Stopping scan...');
  fetch('/stop', { method: 'POST' })
    .then(() => {
      console.log('Scan stopped');
      resetScanUI();
    })
    .catch(error => {
      console.error('Failed to stop scan:', error);
    });
}

function resetScanUI() {
  AppState.isScanning = false;
  const startBtn = document.getElementById('start-scan-btn');
  const stopBtn = document.getElementById('stop-scan-btn');
  
  if (startBtn) startBtn.disabled = false;
  if (stopBtn) stopBtn.disabled = true;
}

function detectNetwork() {
  const btn = document.getElementById('detect-network-btn');
  if (!btn) return;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Detecting...';

  fetch('/local_cidr')
    .then(response => response.json())
    .then(data => {
      if (data.cidr) {
        // Add nmap with detected network
        addScheduledTool('nmap');
        setTimeout(() => {
          addArgumentToTool('nmap', data.cidr);
        }, 100);
        
        alert(`Network detected: ${data.cidr}`);
      } else {
        alert('Failed to detect local network');
      }
    })
    .catch(error => {
      console.error('Network detection failed:', error);
      alert('Network detection failed: ' + error.message);
    })
    .finally(() => {
      btn.disabled = false;
      btn.innerHTML = 'Auto-Detect Network';
    });
}

// Scenario management
function saveScenario() {
  console.log('Saving scenario...');
  const nameInput = document.getElementById('scenario-name');
  if (!nameInput) {
    alert('Scenario name input not found');
    return;
  }

  const name = nameInput.value.trim();
  if (!name) {
    alert('Please enter a scenario name');
    return;
  }

  if (AppState.scheduledTools.size === 0) {
    alert('No tools to save in this scenario');
    return;
  }

  const scripts = [];
  AppState.scheduledTools.forEach((data, toolKey) => {
    const item = document.querySelector(`.scheduled-item[data-tool="${toolKey}"]`);
    if (item) {
      const input = item.querySelector('.item-input');
      if (input) {
        const args = input.value.trim().split(/\s+/).filter(arg => arg);
        scripts.push({
          tool: toolKey,
          args: args
        });
      }
    }
  });

  const scenario = { name, scripts };

  // Try to save to server first, fallback to localStorage
  fetch('/save_scenario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Scenario saved to server:', data);
    alert(`Scenario "${name}" saved successfully`);
    nameInput.value = '';
    loadScenarios();
  })
  .catch(error => {
    console.warn('Failed to save to server:', error.message);
    
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem('octapus_scenarios') || '{}';
      const scenarios = JSON.parse(stored);
      scenarios[name] = scenario;
      localStorage.setItem('octapus_scenarios', JSON.stringify(scenarios));
      
      alert(`Scenario "${name}" saved locally`);
      nameInput.value = '';
      loadScenarios();
    } catch (localError) {
      console.error('Failed to save to localStorage:', localError);
      alert('Failed to save scenario: ' + localError.message);
    }
  });
}

function loadScenario(event) {
  const scenarioName = event.target.value;
  if (!scenarioName) return;

  console.log(`Loading scenario: ${scenarioName}`);

  // Try to load from server first
  fetch(`/load_scenario/${encodeURIComponent(scenarioName)}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.status === 'error') {
        throw new Error(data.message);
      }
      
      loadScenarioData(data);
      alert(`Scenario "${scenarioName}" loaded from server`);
    })
    .catch(error => {
      console.warn('Failed to load from server:', error.message);
      
      // Fallback to localStorage
      try {
        const stored = localStorage.getItem('octapus_scenarios');
        if (stored) {
          const scenarios = JSON.parse(stored);
          if (scenarios[scenarioName]) {
            loadScenarioData(scenarios[scenarioName]);
            alert(`Scenario "${scenarioName}" loaded from local storage`);
          } else {
            alert(`Scenario "${scenarioName}" not found`);
          }
        } else {
          alert('No scenarios found in local storage');
        }
      } catch (localError) {
        console.error('Failed to load from localStorage:', localError);
        alert('Failed to load scenario: ' + localError.message);
      }
    });
}

// Helper function to load scenario data
function loadScenarioData(scenarioData) {
  // Clear current tools
  clearAllTools();

  // Load scenario tools
  const scripts = scenarioData.scripts || scenarioData.tools || [];
  scripts.forEach(script => {
    addScheduledTool(script.tool);
    setTimeout(() => {
      const item = document.querySelector(`.scheduled-item[data-tool="${script.tool}"]`);
      if (item) {
        const input = item.querySelector('.item-input');
        if (input && script.args) {
          input.value = Array.isArray(script.args) ? script.args.join(' ') : script.args;
        }
      }
    }, 100);
  });
}

function loadScenarios() {
  console.log('Loading scenarios...');
  const scenarioList = document.getElementById('scenario-list');
  if (!scenarioList) {
    console.warn('Scenario list element not found');
    return;
  }

  // Clear existing options except the default
  scenarioList.innerHTML = '<option value="">-- Load Scenario --</option>';

  // Try to load from server, fallback to localStorage
  fetch('/list_scenarios')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }
      return response.json();
    })
    .then(data => {
      console.log('Scenarios loaded from server:', data);
      
      if (data.scenarios && Array.isArray(data.scenarios)) {
        data.scenarios.forEach(scenarioName => {
          const option = document.createElement('option');
          option.value = scenarioName;
          option.textContent = scenarioName;
          scenarioList.appendChild(option);
        });
      }
    })
    .catch(error => {
      console.warn('Failed to load scenarios from server:', error.message);
      
      // Fallback to localStorage
      try {
        const stored = localStorage.getItem('octapus_scenarios');
        if (stored) {
          const scenarios = JSON.parse(stored);
          Object.keys(scenarios).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            scenarioList.appendChild(option);
          });
          console.log('Scenarios loaded from localStorage');
        }
      } catch (localError) {
        console.warn('Failed to load from localStorage:', localError.message);
      }
    });
}

// Add debug info and test functions
window.debugApp = function() {
  console.log('AppState:', AppState);
  console.log('Scheduled Tools:', AppState.scheduledTools);
  console.log('Output Cards:', AppState.outputCards);
  console.log('TOOL_CATEGORIES:', TOOL_CATEGORIES);
};

window.testAddTool = function(toolName = 'nmap') {
  console.log(`Testing add tool: ${toolName}`);
  addScheduledTool(toolName);
};

// Add to global scope for testing
window.testOutput = testOutput;
window.simulateLog = function(tool, message) {
  handleLogMessage({ tool: tool || 'nmap', line: message || 'Test message' });
};

// Test to verify script is loading
console.log('Index.js loaded successfully');
console.log('Available test functions: debugApp(), testAddTool(), testOutput(), simulateLog()');

// Export functions for global access
window.closeModal = closeModal;
window.debugApp = debugApp;
window.testAddTool = testAddTool;

// Add the missing setupEventListeners function
function setupEventListeners() {
  console.log('Setting up event listeners...');
  
  // Tool search functionality
  const searchInput = document.getElementById('tool-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filterTools(e.target.value.toLowerCase());
    });
  }

  // Button event listeners
  setupButtonListener('start-scan-btn', startScan);
  setupButtonListener('stop-scan-btn', stopScan);
  setupButtonListener('detect-network-btn', detectNetwork);
  setupButtonListener('save-scenario-btn', saveScenario);
  setupButtonListener('clear-scenario-btn', clearAllTools);
  setupButtonListener('clear-output-btn', clearAllOutput);
  setupButtonListener('expand-all-btn', expandAllOutput);
  setupButtonListener('test-output-btn', testOutput);

  // Scenario list change event
  const scenarioList = document.getElementById('scenario-list');
  if (scenarioList) {
    scenarioList.addEventListener('change', loadScenario);
  }

  // Setup drop zone
  setupDropZone();

  // Modal close on background click
  const modal = document.getElementById('command-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  console.log('Event listeners setup complete');
}
