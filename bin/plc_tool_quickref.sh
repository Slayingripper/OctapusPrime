#!/bin/bash
# PLC Tool Quick Reference & Test Script
# Part of OctapusPrime ICS/SCADA Enhancement

echo "================================"
echo "PLC Tool Quick Reference"
echo "================================"
echo ""

# Check if plc_tool exists
if [ ! -f "./plc_tool" ]; then
    echo "❌ plc_tool binary not found!"
    echo "💡 Run 'make' to compile the tool first"
    exit 1
fi

echo "✓ plc_tool binary found"
echo ""

# Display help
echo "📖 USAGE:"
echo "  ./plc_tool <ip> <port> <operation> <address> <count/value>"
echo ""

echo "🔧 OPERATIONS:"
echo ""
echo "  read          - Read coils (discrete outputs)"
echo "                  Example: ./plc_tool 192.168.1.10 502 read 0 10"
echo "                  Reads 10 coils starting from address 0"
echo ""
echo "  read_reg      - Read holding registers"
echo "                  Example: ./plc_tool 192.168.1.10 502 read_reg 0 5"
echo "                  Reads 5 holding registers starting from address 0"
echo ""
echo "  write_coil    - Write single coil (ON=1, OFF=0)"
echo "                  Example: ./plc_tool 192.168.1.10 502 write_coil 0 1"
echo "                  Writes value 1 (ON) to coil at address 0"
echo ""

echo "🎯 COMMON TARGETS:"
echo "  Port 502      - Standard Modbus TCP port"
echo "  Address 0     - Usually first coil/register"
echo "  Count 10-100  - Typical range for reading multiple values"
echo ""

echo "📋 MODBUS FUNCTION CODES:"
echo "  0x01 - Read Coils (used by 'read')"
echo "  0x03 - Read Holding Registers (used by 'read_reg')"
echo "  0x05 - Write Single Coil (used by 'write_coil')"
echo ""

echo "🔐 SAFETY REMINDERS:"
echo "  ⚠️  Only test systems you own or have permission to test"
echo "  ⚠️  PLC operations can affect physical processes"
echo "  ⚠️  Always understand the target system before testing"
echo "  ⚠️  Use in isolated test environments when possible"
echo ""

echo "🧪 TESTING WITH SIMULATOR:"
echo "  1. Install pymodbus: pip3 install pymodbus"
echo "  2. Start simulator: python3 -m pymodbus.server.simulator"
echo "  3. Test locally: ./plc_tool 127.0.0.1 502 read 0 10"
echo ""

# Optional: Check if user wants to run a test
read -p "Would you like to test against a Modbus simulator on localhost? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Check if pymodbus is installed
    if ! python3 -c "import pymodbus" 2>/dev/null; then
        echo "Installing pymodbus simulator..."
        pip3 install pymodbus
    fi
    
    echo ""
    echo "Starting Modbus simulator on port 502..."
    echo "Press Ctrl+C to stop"
    echo ""
    
    # Start simulator in background
    python3 -m pymodbus.server.simulator --modbus_port 502 &
    SIMULATOR_PID=$!
    
    # Wait for simulator to start
    sleep 2
    
    echo "Running test commands..."
    echo ""
    
    echo "1️⃣ Reading 10 coils from address 0:"
    ./plc_tool 127.0.0.1 502 read 0 10
    echo ""
    
    echo "2️⃣ Reading 5 holding registers from address 0:"
    ./plc_tool 127.0.0.1 502 read_reg 0 5
    echo ""
    
    echo "3️⃣ Writing coil at address 0 (value: 1):"
    ./plc_tool 127.0.0.1 502 write_coil 0 1
    echo ""
    
    echo "4️⃣ Reading back the coil to verify:"
    ./plc_tool 127.0.0.1 502 read 0 1
    echo ""
    
    # Stop simulator
    echo "Stopping simulator..."
    kill $SIMULATOR_PID 2>/dev/null
    
    echo ""
    echo "✅ Test complete!"
fi

echo ""
echo "📚 For more information, see:"
echo "  - ICS_SCADA_ENHANCEMENT.md"
echo "  - scenarios/README.md"
echo ""
echo "================================"
