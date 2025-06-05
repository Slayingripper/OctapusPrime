/**
 * OctapusPrime Example Scenarios
 * Pre-built IFTTT scenarios for demonstration and quick start
 */

const ExampleScenarios = {
  /**
   * Basic Web Application Security Assessment
   */
  webAppScan: {
    name: "Web Application Security Assessment",
    description: "Comprehensive web application security testing with conditional logic",
    version: "2.0",
    type: "ifttt-enhanced",
    created: new Date().toISOString(),
    variables: {
      target_url: "https://example.com",
      wordlist_path: "/usr/share/wordlists/dirb/common.txt",
      scan_depth: "3"
    },
    steps: [
      {
        tool: "whatweb",
        args: ["{target_url}", "-v"],
        condition: {
          type: "always",
          operator: null,
          value: null
        },
        timeout: 60,
        variables: {
          web_tech: "(?i)(wordpress|drupal|joomla|apache|nginx|php|asp\\.net)",
          cms_version: "([0-9]+\\.[0-9]+\\.[0-9]+)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 0
        }
      },
      {
        tool: "nikto",
        args: ["-h", "{target_url}", "-C", "all", "-Format", "txt"],
        condition: {
          type: "prev_success",
          operator: null,
          value: null
        },
        timeout: 300,
        variables: {
          vulnerabilities: "(?i)(vulnerability|exploit|cve-[0-9]{4}-[0-9]+)",
          severity: "(?i)(high|critical|medium)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 1
        }
      },
      {
        tool: "gobuster",
        args: ["dir", "-u", "{target_url}", "-w", "{wordlist_path}", "-x", "php,html,txt,js,css", "-t", "50"],
        condition: {
          type: "prev_contains",
          operator: null,
          value: "200 OK"
        },
        timeout: 600,
        variables: {
          directories: "Status: 200.*?(/[^\\s]+)",
          admin_paths: "(?i)(/admin|/administrator|/wp-admin|/login)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 2
        }
      },
      {
        tool: "sqlmap",
        args: ["-u", "{target_url}", "--batch", "--level=2", "--risk=2", "--random-agent"],
        condition: {
          type: "output_contains",
          operator: null,
          value: "Parameter"
        },
        timeout: 900,
        variables: {
          sql_injectable: "(?i)(injectable|vulnerable)",
          database_type: "(?i)(mysql|postgresql|oracle|mssql)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 3
        }
      },
      {
        tool: "nuclei",
        args: ["-u", "{target_url}", "-t", "/nuclei-templates/", "-severity", "high,critical", "-o", "/tmp/nuclei_results.txt"],
        condition: {
          type: "always",
          operator: null,
          value: null
        },
        timeout: 300,
        variables: {
          critical_vulns: "\\[critical\\].*?\\[(.*?)\\]",
          cve_found: "(CVE-[0-9]{4}-[0-9]+)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 4
        }
      }
    ]
  },

  /**
   * Network Infrastructure Reconnaissance
   */
  networkRecon: {
    name: "Network Infrastructure Reconnaissance",
    description: "Systematic network discovery and service enumeration",
    version: "2.0",
    type: "ifttt-enhanced",
    created: new Date().toISOString(),
    variables: {
      target_network: "192.168.1.0/24",
      target_host: "192.168.1.1",
      output_dir: "/tmp/scan_results"
    },
    steps: [
      {
        tool: "nmap",
        args: ["-sn", "{target_network}"],
        condition: {
          type: "always",
          operator: null,
          value: null
        },
        timeout: 120,
        variables: {
          live_hosts: "Nmap scan report for ([0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3})",
          host_count: "([0-9]+) hosts? up"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 0
        }
      },
      {
        tool: "nmap",
        args: ["-sS", "-sV", "-O", "-A", "--script=default", "{live_hosts}", "-oA", "{output_dir}/detailed_scan"],
        condition: {
          type: "prev_regex",
          operator: null,
          value: "[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+"
        },
        timeout: 1800,
        variables: {
          open_ports: "([0-9]+/tcp)\\s+open",
          services: "([0-9]+/tcp)\\s+open\\s+([^\\s]+)",
          os_info: "OS details: (.*?)$"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 1
        }
      },
      {
        tool: "masscan",
        args: ["{target_network}", "-p", "1-65535", "--rate=1000", "--open"],
        condition: {
          type: "output_line_count",
          operator: "greater",
          value: "10"
        },
        timeout: 600,
        variables: {
          all_open_ports: "Discovered open port ([0-9]+/tcp)",
          high_ports: "Discovered open port ([89][0-9]{3}/tcp)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 2
        }
      },
      {
        tool: "enum4linux",
        args: ["-a", "{target_host}"],
        condition: {
          type: "service_detected",
          operator: null,
          value: "445/tcp"
        },
        timeout: 300,
        variables: {
          smb_shares: "Sharename\\s+Type\\s+Comment\\s+([^\\n]+)",
          domain_info: "Domain Name: ([^\\n]+)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 3
        }
      },
      {
        tool: "snmp-check",
        args: ["{target_host}"],
        condition: {
          type: "port_open",
          operator: null,
          value: "{target_host}:161"
        },
        timeout: 180,
        variables: {
          snmp_info: "System Description: ([^\\n]+)",
          community_string: "Community: ([^\\s]+)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 4
        }
      }
    ]
  },

  /**
   * WordPress Security Assessment
   */
  wordpressScan: {
    name: "WordPress Security Assessment",
    description: "Comprehensive WordPress vulnerability assessment with plugin enumeration",
    version: "2.0",
    type: "ifttt-enhanced",
    created: new Date().toISOString(),
    variables: {
      wp_url: "https://example.com",
      wp_user_list: "/usr/share/wordlists/usernames.txt",
      wp_pass_list: "/usr/share/wordlists/passwords.txt"
    },
    steps: [
      {
        tool: "whatweb",
        args: ["{wp_url}", "-v"],
        condition: {
          type: "always",
          operator: null,
          value: null
        },
        timeout: 60,
        variables: {
          wp_version: "WordPress ([0-9]+\\.[0-9]+\\.[0-9]+)",
          wp_detected: "(?i)(wordpress|wp-content|wp-includes)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 0
        }
      },
      {
        tool: "wpscan",
        args: ["--url", "{wp_url}", "--enumerate", "p,t,u", "--plugins-detection", "aggressive", "--api-token", "YOUR_API_TOKEN"],
        condition: {
          type: "prev_contains",
          operator: null,
          value: "WordPress"
        },
        timeout: 600,
        variables: {
          wp_plugins: "\\[\\+\\] ([^\\n]+plugin[^\\n]+)",
          wp_themes: "\\[\\+\\] ([^\\n]+theme[^\\n]+)",
          wp_users: "\\[\\+\\] ([^\\n]+user[^\\n]+)",
          wp_vulns: "\\[!\\] ([^\\n]+vulnerability[^\\n]+)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 1
        }
      },
      {
        tool: "gobuster",
        args: ["dir", "-u", "{wp_url}", "-w", "/usr/share/wordlists/dirb/wordpress.txt", "-x", "php", "-t", "50"],
        condition: {
          type: "prev_success",
          operator: null,
          value: null
        },
        timeout: 300,
        variables: {
          wp_files: "Status: 200.*?(/wp-[^\\s]+)",
          backup_files: "Status: 200.*?(backup|old|bak)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 2
        }
      },
      {
        tool: "hydra",
        args: ["-L", "{wp_user_list}", "-P", "{wp_pass_list}", "{wp_url}", "http-post-form", "/wp-login.php:log=^USER^&pwd=^PASS^:Invalid username"],
        condition: {
          type: "output_contains",
          operator: null,
          value: "user"
        },
        timeout: 1800,
        variables: {
          valid_creds: "\\[([0-9]+)\\]\\[http-post-form\\] host: [^\\s]+ login: ([^\\s]+) password: ([^\\s]+)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 3
        }
      },
      {
        tool: "nuclei",
        args: ["-u", "{wp_url}", "-t", "/nuclei-templates/technologies/wordpress/", "-severity", "medium,high,critical"],
        condition: {
          type: "always",
          operator: null,
          value: null
        },
        timeout: 240,
        variables: {
          wp_cves: "(CVE-[0-9]{4}-[0-9]+)",
          wp_misconfig: "\\[medium\\].*?(misconfiguration|exposure)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 4
        }
      }
    ]
  },

  /**
   * Cloud Security Assessment
   */
  cloudAssessment: {
    name: "Cloud Security Assessment",
    description: "AWS/Azure cloud infrastructure security assessment",
    version: "2.0",
    type: "ifttt-enhanced",
    created: new Date().toISOString(),
    variables: {
      cloud_target: "example.amazonaws.com",
      cloud_region: "us-east-1",
      bucket_wordlist: "/usr/share/wordlists/s3-buckets.txt"
    },
    steps: [
      {
        tool: "nmap",
        args: ["-sS", "-p", "80,443,8080,8443,22,3389", "{cloud_target}"],
        condition: {
          type: "always",
          operator: null,
          value: null
        },
        timeout: 180,
        variables: {
          cloud_ports: "([0-9]+/tcp)\\s+open",
          ssl_services: "(443/tcp|8443/tcp)\\s+open"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 0
        }
      },
      {
        tool: "testssl",
        args: ["--jsonfile", "/tmp/ssl_results.json", "{cloud_target}:443"],
        condition: {
          type: "port_open",
          operator: null,
          value: "{cloud_target}:443"
        },
        timeout: 300,
        variables: {
          ssl_vulns: "\"severity\":\\s*\"(HIGH|CRITICAL)\"",
          ssl_grade: "\"grade\":\\s*\"([A-F][+-]?)\""
        },
        metadata: {
          created: new Date().toISOString(),
          index: 1
        }
      },
      {
        tool: "gobuster",
        args: ["s3", "-w", "{bucket_wordlist}", "-t", "50"],
        condition: {
          type: "prev_success",
          operator: null,
          value: null
        },
        timeout: 600,
        variables: {
          s3_buckets: "Found: ([^\\s]+\\.s3[^\\s]*)",
          public_buckets: "Found: ([^\\s]+).*?(public|accessible)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 2
        }
      },
      {
        tool: "nuclei",
        args: ["-u", "{cloud_target}", "-t", "/nuclei-templates/cloud/", "-severity", "high,critical"],
        condition: {
          type: "always",
          operator: null,
          value: null
        },
        timeout: 300,
        variables: {
          cloud_misconfig: "\\[(high|critical)\\].*?(misconfiguration|exposure)",
          aws_secrets: "(AKIA[0-9A-Z]{16}|aws_secret_access_key)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 3
        }
      },
      {
        tool: "amass",
        args: ["enum", "-d", "{cloud_target}", "-o", "/tmp/subdomains.txt"],
        condition: {
          type: "prev_contains",
          operator: null,
          value: "amazonaws"
        },
        timeout: 900,
        variables: {
          subdomains: "([^\\s]+\\.{cloud_target})",
          dev_subdomains: "(dev|test|staging|beta)\\.[^\\s]*"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 4
        }
      }
    ]
  },

  /**
   * API Security Testing
   */
  apiSecurityTest: {
    name: "API Security Testing",
    description: "REST API endpoint discovery and vulnerability assessment",
    version: "2.0",
    type: "ifttt-enhanced",
    created: new Date().toISOString(),
    variables: {
      api_base_url: "https://api.example.com",
      api_wordlist: "/usr/share/wordlists/api-endpoints.txt",
      auth_token: "Bearer YOUR_TOKEN_HERE"
    },
    steps: [
      {
        tool: "gobuster",
        args: ["dir", "-u", "{api_base_url}", "-w", "{api_wordlist}", "-x", "json", "-s", "200,201,202,400,401,403,500"],
        condition: {
          type: "always",
          operator: null,
          value: null
        },
        timeout: 300,
        variables: {
          api_endpoints: "Status: ([0-9]+).*?(/api/[^\\s]+)",
          sensitive_endpoints: "Status: [0-9]+.*?(/admin|/internal|/debug|/test)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 0
        }
      },
      {
        tool: "ffuf",
        args: ["-u", "{api_base_url}/api/FUZZ", "-w", "/usr/share/wordlists/api-methods.txt", "-mc", "200,201,400,401,403,500", "-H", "Authorization: {auth_token}"],
        condition: {
          type: "output_contains",
          operator: null,
          value: "/api/"
        },
        timeout: 240,
        variables: {
          api_methods: "Status: ([0-9]+).*?(GET|POST|PUT|DELETE|PATCH)",
          auth_bypass: "Status: 200.*?(admin|user|config)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 1
        }
      },
      {
        tool: "nuclei",
        args: ["-u", "{api_base_url}", "-t", "/nuclei-templates/http/exposures/", "-t", "/nuclei-templates/http/vulnerabilities/"],
        condition: {
          type: "prev_success",
          operator: null,
          value: null
        },
        timeout: 180,
        variables: {
          api_vulns: "\\[(medium|high|critical)\\].*?(exposure|disclosure|injection)",
          info_disclosure: "\\[info\\].*?(version|debug|error)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 2
        }
      },
      {
        tool: "sqlmap",
        args: ["-u", "{api_base_url}/api/users?id=1", "--batch", "--level=3", "--risk=2", "--headers=Authorization: {auth_token}"],
        condition: {
          type: "output_regex",
          operator: null,
          value: "/api/.*\\?.*="
        },
        timeout: 600,
        variables: {
          sql_injection: "(?i)(injectable|vulnerable|payload)",
          db_info: "back-end DBMS: ([^\\n]+)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 3
        }
      }
    ]
  },

  /**
   * Mobile Application Security
   */
  mobileAppScan: {
    name: "Mobile Application Security Assessment",
    description: "Mobile app backend and API security testing",
    version: "2.0",
    type: "ifttt-enhanced",
    created: new Date().toISOString(),
    variables: {
      mobile_api: "https://mobile-api.example.com",
      app_package: "com.example.app",
      device_id: "DEVICE123456"
    },
    steps: [
      {
        tool: "nmap",
        args: ["-sS", "-sV", "-p", "80,443,8080,8443,9000-9999", "{mobile_api}"],
        condition: {
          type: "always",
          operator: null,
          value: null
        },
        timeout: 180,
        variables: {
          mobile_ports: "([0-9]+/tcp)\\s+open",
          api_services: "([0-9]+/tcp)\\s+open\\s+(http|https)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 0
        }
      },
      {
        tool: "gobuster",
        args: ["dir", "-u", "{mobile_api}", "-w", "/usr/share/wordlists/mobile-api.txt", "-x", "json,xml", "-s", "200,400,401,403"],
        condition: {
          type: "port_open",
          operator: null,
          value: "{mobile_api}:443"
        },
        timeout: 300,
        variables: {
          mobile_endpoints: "Status: ([0-9]+).*?(/[^\\s]+)",
          auth_endpoints: "Status: [0-9]+.*?(/auth|/login|/oauth|/token)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 1
        }
      },
      {
        tool: "nuclei",
        args: ["-u", "{mobile_api}", "-t", "/nuclei-templates/http/misconfiguration/", "-severity", "medium,high,critical"],
        condition: {
          type: "prev_contains",
          operator: null,
          value: "200"
        },
        timeout: 240,
        variables: {
          mobile_vulns: "\\[(medium|high|critical)\\].*?(misconfiguration|exposure)",
          api_keys: "(api[_-]?key|access[_-]?token).*?([A-Za-z0-9]{20,})"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 2
        }
      },
      {
        tool: "ffuf",
        args: ["-u", "{mobile_api}/api/v1/FUZZ", "-w", "/usr/share/wordlists/mobile-params.txt", "-mc", "200,400,500", "-H", "User-Agent: MobileApp/{app_package}", "-H", "Device-ID: {device_id}"],
        condition: {
          type: "output_contains",
          operator: null,
          value: "/api/"
        },
        timeout: 300,
        variables: {
          param_injection: "Status: 500.*?(error|exception|stack)",
          sensitive_data: "Status: 200.*?(user|profile|account|payment)"
        },
        metadata: {
          created: new Date().toISOString(),
          index: 3
        }
      }
    ]
  }
};

/**
 * Load example scenarios into the scenario manager
 */
function loadExampleScenarios() {
  return Object.keys(ExampleScenarios).map(key => ({
    id: key,
    ...ExampleScenarios[key]
  }));
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ExampleScenarios, loadExampleScenarios };
}