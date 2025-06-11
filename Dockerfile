FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive \
    GO_VERSION=1.21.5 \
    PATH=$PATH:/root/go/bin

# Install apt dependencies (tools that are available in repos)
RUN apt-get update && apt-get install -y --no-install-recommends \
      software-properties-common \
      curl wget git build-essential gcc g++ make snap \
      python3 python3-pip python3-dev python3-setuptools \
      libffi-dev libssl-dev libpcap-dev \
      nmap masscan zmap dnsutils dnsenum fierce \
      gobuster dirb ffuf nikto whatweb sqlmap \
      testssl.sh sslscan \
      openvas-scanner hydra medusa patator \
      john hashcat nbtscan \
      samba-common-bin samba-libs \
      ldap-utils \
      snmp snmp-mibs-downloader \
      postgresql-client mysql-client golang chromium-browser && \
    apt-get clean && rm -rf /var/lib/apt/lists/*


# Install Python tools missing from apt repos
RUN pip3 install --no-cache-dir theharvester
COPY requirements.txt /tmp/requirements.txt
RUN pip3 install --upgrade pip && pip3 install -r /tmp/requirements.txt

# Install Feroxbuster (download prebuilt binary)
RUN curl -LO https://github.com/epi052/feroxbuster/releases/latest/download/feroxbuster-linux-x86_64 && \
    chmod +x feroxbuster-linux-x86_64 && mv feroxbuster-linux-x86_64 /usr/local/bin/feroxbuster

# Install Trivy (add official repo and install)
RUN apt-get update && apt-get install -y wget apt-transport-https gnupg lsb-release && \
    wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | apt-key add - && \
    echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | tee /etc/apt/sources.list.d/trivy.list && \
    apt-get update && apt-get install -y trivy && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Clone enum4linux and add to PATH
RUN git clone https://github.com/portcullislabs/enum4linux.git /opt/enum4linux
ENV PATH="/opt/enum4linux:${PATH}"

# Install Go manually
RUN curl -LO https://golang.org/dl/go${GO_VERSION}.linux-amd64.tar.gz && \
    tar -C /usr/local -xzf go${GO_VERSION}.linux-amd64.tar.gz && \
    rm go${GO_VERSION}.linux-amd64.tar.gz && \
    ln -s /usr/local/go/bin/go /usr/local/bin/go

# Install Go-based tools
RUN /usr/local/go/bin/go install github.com/projectdiscovery/nuclei/v2/cmd/nuclei@latest && \
    /usr/local/go/bin/go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest && \
    /usr/local/go/bin/go install github.com/projectdiscovery/httpx/cmd/httpx@latest && \
    /usr/local/go/bin/go install github.com/projectdiscovery/naabu/v2/cmd/naabu@latest && \
    /usr/local/go/bin/go install github.com/tomnomnom/gf@latest && \
    /usr/local/go/bin/go install github.com/tomnomnom/waybackurls@latest && \
    /usr/local/go/bin/go install github.com/owasp-amass/amass/v4/...@master

# Install GitLeaks binary
RUN curl -Lo /usr/local/bin/gitleaks https://github.com/zricethezav/gitleaks/releases/latest/download/gitleaks_linux_amd64 && \
    chmod +x /usr/local/bin/gitleaks

# EyeWitness dependencies (chromium-headless used instead of chromium-browser)
RUN apt-get update && apt-get install -y chromium-driver chromium && \
    git clone https://github.com/FortyNorthSecurity/EyeWitness.git /opt/EyeWitness && \
    cd /opt/EyeWitness/Python/setup && ./setup.sh || true

# Symlink Go binaries so they are on PATH
RUN ln -sf /root/go/bin/* /usr/local/bin/ || true

# Copy your application
WORKDIR /opt/octapusprime
COPY . .

# Expose Flask port
EXPOSE 5000

# Run the Flask server
CMD ["python3", "bin/webapp/server.py"]