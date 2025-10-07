/*
 * plc_tool.c - Simple Modbus TCP client for PLC communication
 * Part of OctapusPrime ICS/SCADA penetration testing toolkit
 * 
 * Compile: gcc -o plc_tool plc_tool.c
 * Usage: plc_tool <ip> <port> <operation> <address> <count>
 *        operation: read, write, write_coil
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>

#define MODBUS_PORT 502
#define BUFFER_SIZE 512

// Modbus function codes
#define MODBUS_FC_READ_COILS 0x01
#define MODBUS_FC_READ_DISCRETE_INPUTS 0x02
#define MODBUS_FC_READ_HOLDING_REGISTERS 0x03
#define MODBUS_FC_READ_INPUT_REGISTERS 0x04
#define MODBUS_FC_WRITE_SINGLE_COIL 0x05
#define MODBUS_FC_WRITE_SINGLE_REGISTER 0x06
#define MODBUS_FC_WRITE_MULTIPLE_COILS 0x0F
#define MODBUS_FC_WRITE_MULTIPLE_REGISTERS 0x10

typedef struct {
    unsigned short transaction_id;
    unsigned short protocol_id;
    unsigned short length;
    unsigned char unit_id;
    unsigned char function_code;
} modbus_header_t;

int create_socket(const char *ip, int port) {
    int sock;
    struct sockaddr_in server_addr;

    sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0) {
        perror("Socket creation failed");
        return -1;
    }

    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(port);
    
    if (inet_pton(AF_INET, ip, &server_addr.sin_addr) <= 0) {
        perror("Invalid address");
        close(sock);
        return -1;
    }

    if (connect(sock, (struct sockaddr *)&server_addr, sizeof(server_addr)) < 0) {
        perror("Connection failed");
        close(sock);
        return -1;
    }

    return sock;
}

int read_coils(int sock, int start_address, int count) {
    unsigned char request[12];
    unsigned char response[BUFFER_SIZE];
    int bytes_received;

    // Build Modbus TCP request
    request[0] = 0x00; request[1] = 0x01; // Transaction ID
    request[2] = 0x00; request[3] = 0x00; // Protocol ID
    request[4] = 0x00; request[5] = 0x06; // Length
    request[6] = 0x01; // Unit ID
    request[7] = MODBUS_FC_READ_COILS; // Function code
    request[8] = (start_address >> 8) & 0xFF; // Start address high
    request[9] = start_address & 0xFF; // Start address low
    request[10] = (count >> 8) & 0xFF; // Count high
    request[11] = count & 0xFF; // Count low

    if (send(sock, request, 12, 0) < 0) {
        perror("Send failed");
        return -1;
    }

    bytes_received = recv(sock, response, BUFFER_SIZE, 0);
    if (bytes_received < 0) {
        perror("Receive failed");
        return -1;
    }

    printf("Read %d coils from address %d:\n", count, start_address);
    printf("Response: ");
    for (int i = 0; i < bytes_received; i++) {
        printf("%02X ", response[i]);
    }
    printf("\n");

    // Parse data bytes with bounds checking
    if (bytes_received > 9) {
        int byte_count = response[8];
        // Validate byte_count to prevent buffer overflow
        if (byte_count + 9 > bytes_received || byte_count + 9 > BUFFER_SIZE) {
            fprintf(stderr, "Warning: Invalid byte count in response (%d bytes, received %d)\n", byte_count, bytes_received);
            return -1;
        }
        printf("Data bytes: ");
        for (int i = 0; i < byte_count; i++) {
            printf("%02X ", response[9 + i]);
        }
        printf("\n");
    }

    return 0;
}

int read_registers(int sock, int start_address, int count) {
    unsigned char request[12];
    unsigned char response[BUFFER_SIZE];
    int bytes_received;

    // Build Modbus TCP request
    request[0] = 0x00; request[1] = 0x01; // Transaction ID
    request[2] = 0x00; request[3] = 0x00; // Protocol ID
    request[4] = 0x00; request[5] = 0x06; // Length
    request[6] = 0x01; // Unit ID
    request[7] = MODBUS_FC_READ_HOLDING_REGISTERS; // Function code
    request[8] = (start_address >> 8) & 0xFF;
    request[9] = start_address & 0xFF;
    request[10] = (count >> 8) & 0xFF;
    request[11] = count & 0xFF;

    if (send(sock, request, 12, 0) < 0) {
        perror("Send failed");
        return -1;
    }

    bytes_received = recv(sock, response, BUFFER_SIZE, 0);
    if (bytes_received < 0) {
        perror("Receive failed");
        return -1;
    }

    printf("Read %d holding registers from address %d:\n", count, start_address);
    
    if (bytes_received > 9) {
        int byte_count = response[8];
        // Validate byte_count to prevent buffer overflow
        if (byte_count + 9 > bytes_received || byte_count + 9 > BUFFER_SIZE) {
            fprintf(stderr, "Warning: Invalid byte count in response (%d bytes, received %d)\n", byte_count, bytes_received);
            return -1;
        }
        printf("Register values:\n");
        for (int i = 0; i < byte_count && i + 1 < byte_count; i += 2) {
            int value = (response[9 + i] << 8) | response[9 + i + 1];
            printf("  Register %d: %d (0x%04X)\n", start_address + (i/2), value, value);
        }
    }

    return 0;
}

int write_coil(int sock, int address, int value) {
    unsigned char request[12];
    unsigned char response[BUFFER_SIZE];

    request[0] = 0x00; request[1] = 0x01; // Transaction ID
    request[2] = 0x00; request[3] = 0x00; // Protocol ID
    request[4] = 0x00; request[5] = 0x06; // Length
    request[6] = 0x01; // Unit ID
    request[7] = MODBUS_FC_WRITE_SINGLE_COIL;
    request[8] = (address >> 8) & 0xFF;
    request[9] = address & 0xFF;
    request[10] = value ? 0xFF : 0x00;
    request[11] = 0x00;

    if (send(sock, request, 12, 0) < 0) {
        perror("Send failed");
        return -1;
    }

    int bytes_received = recv(sock, response, BUFFER_SIZE, 0);
    if (bytes_received < 0) {
        perror("Receive failed");
        return -1;
    }

    printf("Wrote coil at address %d with value %d\n", address, value);
    return 0;
}

void print_usage(const char *prog_name) {
    printf("Usage: %s <ip> <port> <operation> <address> <count/value>\n", prog_name);
    printf("Operations:\n");
    printf("  read          - Read coils\n");
    printf("  read_reg      - Read holding registers\n");
    printf("  write_coil    - Write single coil (value: 0 or 1)\n");
    printf("\nExamples:\n");
    printf("  %s 192.168.1.10 502 read 0 10\n", prog_name);
    printf("  %s 192.168.1.10 502 read_reg 0 5\n", prog_name);
    printf("  %s 192.168.1.10 502 write_coil 0 1\n", prog_name);
}

int main(int argc, char *argv[]) {
    if (argc != 6) {
        print_usage(argv[0]);
        return 1;
    }

    const char *ip = argv[1];
    int port = atoi(argv[2]);
    const char *operation = argv[3];
    int address = atoi(argv[4]);
    int count_or_value = atoi(argv[5]);

    // Validate port number
    if (port < 1 || port > 65535) {
        fprintf(stderr, "Error: Invalid port number %d (must be 1-65535)\n", port);
        return 1;
    }

    // Validate address and count
    if (address < 0 || address > 65535) {
        fprintf(stderr, "Error: Invalid address %d (must be 0-65535)\n", address);
        return 1;
    }
    if (count_or_value < 0) {
        fprintf(stderr, "Error: Invalid count/value %d (must be >= 0)\n", count_or_value);
        return 1;
    }

    int sock = create_socket(ip, port);
    if (sock < 0) {
        fprintf(stderr, "Failed to connect to %s:%d\n", ip, port);
        return 1;
    }

    printf("Connected to PLC at %s:%d\n", ip, port);

    int result = 0;
    if (strcmp(operation, "read") == 0) {
        result = read_coils(sock, address, count_or_value);
    } else if (strcmp(operation, "read_reg") == 0) {
        result = read_registers(sock, address, count_or_value);
    } else if (strcmp(operation, "write_coil") == 0) {
        result = write_coil(sock, address, count_or_value);
    } else {
        fprintf(stderr, "Unknown operation: %s\n", operation);
        print_usage(argv[0]);
        close(sock);
        return 1;
    }

    close(sock);
    return result;
}
