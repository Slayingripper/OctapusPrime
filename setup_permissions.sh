#!/bin/bash
# ============================================================
# OctapusPrime – Setup Permissions for Bare-Metal (no-sudo)
# ============================================================
# Run this script ONCE with sudo to grant the necessary Linux
# capabilities so that OctapusPrime can manage WiFi interfaces
# and run aircrack-ng tools without requiring sudo at runtime.
#
# Usage:  sudo bash setup_permissions.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}[!] This script must be run as root (sudo).${NC}"
    echo "    Usage: sudo bash setup_permissions.sh"
    exit 1
fi

echo -e "${GREEN}[*] OctapusPrime Permission Setup${NC}"
echo "==========================================="

# --- 1. Add current user to netdev group (for network device access) ---
REAL_USER="${SUDO_USER:-$USER}"
echo -e "${YELLOW}[+] Adding user '${REAL_USER}' to netdev group...${NC}"
usermod -aG netdev "$REAL_USER" 2>/dev/null || true

# --- 2. Set capabilities on aircrack-ng suite binaries ---
TOOLS=(
    airmon-ng
    airodump-ng
    aireplay-ng
    aircrack-ng
    iwconfig
    iw
    macchanger
)

echo -e "${YELLOW}[+] Setting Linux capabilities on network tools...${NC}"
for tool in "${TOOLS[@]}"; do
    TOOL_PATH=$(command -v "$tool" 2>/dev/null || true)
    if [ -n "$TOOL_PATH" ]; then
        # Resolve symlinks to get the real binary
        REAL_PATH=$(readlink -f "$TOOL_PATH")
        # cap_net_raw   – raw packet injection/capture (aireplay, airodump)
        # cap_net_admin – interface config, monitor mode (airmon-ng, iwconfig)
        setcap 'cap_net_raw,cap_net_admin=eip' "$REAL_PATH" 2>/dev/null && \
            echo -e "  ${GREEN}✓${NC} $tool ($REAL_PATH)" || \
            echo -e "  ${RED}✗${NC} $tool – setcap failed (script?)"
    else
        echo -e "  ${YELLOW}-${NC} $tool – not installed, skipping"
    fi
done

# --- 3. airmon-ng is a shell script – it needs to call other binaries ---
#     We handle this by creating a wrapper or using a polkit rule.
#     The simplest portable approach: allow the user to run airmon-ng
#     via a passwordless sudoers entry for just that one command.
SUDOERS_FILE="/etc/sudoers.d/octapusprime"
echo -e "${YELLOW}[+] Creating passwordless sudoers rules for airmon-ng & systemctl...${NC}"
cat > "$SUDOERS_FILE" <<SUDOERS
# OctapusPrime – allow WiFi management without password
${REAL_USER} ALL=(root) NOPASSWD: /usr/sbin/airmon-ng
${REAL_USER} ALL=(root) NOPASSWD: /usr/bin/airmon-ng
${REAL_USER} ALL=(root) NOPASSWD: /sbin/airmon-ng
${REAL_USER} ALL=(root) NOPASSWD: /bin/systemctl start NetworkManager
${REAL_USER} ALL=(root) NOPASSWD: /usr/sbin/iwconfig
${REAL_USER} ALL=(root) NOPASSWD: /sbin/iwconfig
SUDOERS
chmod 0440 "$SUDOERS_FILE"
echo -e "  ${GREEN}✓${NC} Created $SUDOERS_FILE"

# --- 4. Ensure handshakes directory is writable ---
HANDSHAKE_DIR="$(dirname "$0")/bin/webapp/handshakes"
mkdir -p "$HANDSHAKE_DIR"
chown -R "$REAL_USER":"$REAL_USER" "$HANDSHAKE_DIR"
echo -e "  ${GREEN}✓${NC} Handshakes directory owned by ${REAL_USER}"

# --- 5. Ensure log directories are writable ---
for d in "$(dirname "$0")/bin/webapp/logs" "$(dirname "$0")/bin/logs" "$(dirname "$0")/logs"; do
    mkdir -p "$d" 2>/dev/null || true
    chown -R "$REAL_USER":"$REAL_USER" "$d" 2>/dev/null || true
done
echo -e "  ${GREEN}✓${NC} Log directories owned by ${REAL_USER}"

echo ""
echo -e "${GREEN}[✓] Setup complete!${NC}"
echo ""
echo "You can now run OctapusPrime without sudo:"
echo "  cd $(dirname "$0") && python3 bin/webapp/server.py"
echo ""
echo -e "${YELLOW}Note: You may need to log out and back in for group changes to take effect.${NC}"
