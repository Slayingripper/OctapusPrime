#!/usr/bin/env python3
"""
PLC Tool Python Wrapper
Provides a Python interface to the plc_tool C binary for Modbus TCP communication
Part of OctapusPrime ICS/SCADA testing toolkit
"""

import subprocess
import json
import sys
import os
from pathlib import Path

class PLCTool:
    """Python wrapper for plc_tool C binary"""
    
    def __init__(self, plc_tool_path=None):
        """
        Initialize PLCTool wrapper
        
        Args:
            plc_tool_path: Path to plc_tool binary (auto-detected if None)
        """
        if plc_tool_path is None:
            # Try to find plc_tool in PATH or local bin directory
            self.plc_tool_path = self._find_plc_tool()
        else:
            self.plc_tool_path = plc_tool_path
            
        if not self.plc_tool_path or not os.path.exists(self.plc_tool_path):
            raise FileNotFoundError(
                "plc_tool binary not found. Please compile it first using 'make' in the bin directory."
            )
    
    def _find_plc_tool(self):
        """Find plc_tool binary in common locations"""
        # Check if it's in PATH
        try:
            result = subprocess.run(
                ["which", "plc_tool"],
                capture_output=True,
                text=True,
                check=False
            )
            if result.returncode == 0:
                return result.stdout.strip()
        except Exception:
            pass
        
        # Check local bin directory
        bin_dir = Path(__file__).parent
        local_plc_tool = bin_dir / "plc_tool"
        if local_plc_tool.exists():
            return str(local_plc_tool)
        
        # Check /usr/local/bin
        usr_plc_tool = Path("/usr/local/bin/plc_tool")
        if usr_plc_tool.exists():
            return str(usr_plc_tool)
        
        return None
    
    def execute(self, ip, port, operation, address, count_or_value):
        """
        Execute plc_tool command
        
        Args:
            ip: Target PLC IP address
            port: Modbus TCP port (typically 502)
            operation: Operation type ('read', 'read_reg', 'write_coil')
            address: Starting address
            count_or_value: Number of items to read or value to write
            
        Returns:
            dict: Result containing stdout, stderr, and return code
        """
        cmd = [
            self.plc_tool_path,
            str(ip),
            str(port),
            str(operation),
            str(address),
            str(count_or_value)
        ]
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "returncode": result.returncode,
                "command": " ".join(cmd)
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "stdout": "",
                "stderr": "Command timed out after 30 seconds",
                "returncode": -1,
                "command": " ".join(cmd)
            }
        except Exception as e:
            return {
                "success": False,
                "stdout": "",
                "stderr": str(e),
                "returncode": -1,
                "command": " ".join(cmd)
            }
    
    def read_coils(self, ip, port, start_address, count):
        """Read coils from PLC"""
        return self.execute(ip, port, "read", start_address, count)
    
    def read_registers(self, ip, port, start_address, count):
        """Read holding registers from PLC"""
        return self.execute(ip, port, "read_reg", start_address, count)
    
    def write_coil(self, ip, port, address, value):
        """Write single coil to PLC"""
        return self.execute(ip, port, "write_coil", address, 1 if value else 0)


def main():
    """CLI interface for plc_tool wrapper"""
    if len(sys.argv) < 6:
        print("Usage: python plc_tool_wrapper.py <ip> <port> <operation> <address> <count/value>")
        print("Operations: read, read_reg, write_coil")
        print("\nExamples:")
        print("  python plc_tool_wrapper.py 192.168.1.10 502 read 0 10")
        print("  python plc_tool_wrapper.py 192.168.1.10 502 read_reg 0 5")
        print("  python plc_tool_wrapper.py 192.168.1.10 502 write_coil 0 1")
        sys.exit(1)
    
    ip = sys.argv[1]
    port = int(sys.argv[2])
    operation = sys.argv[3]
    address = int(sys.argv[4])
    count_or_value = int(sys.argv[5])
    
    try:
        tool = PLCTool()
        result = tool.execute(ip, port, operation, address, count_or_value)
        
        print(result["stdout"])
        if result["stderr"]:
            print(result["stderr"], file=sys.stderr)
        
        sys.exit(result["returncode"])
        
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        print("\nTo compile plc_tool, run:", file=sys.stderr)
        print("  cd bin && make", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
