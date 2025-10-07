# Makefile for PLC Tool
# Part of OctapusPrime ICS/SCADA testing toolkit

CC = gcc
CFLAGS = -Wall -O2
TARGET = plc_tool
SRC = plc_tool.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) -o $(TARGET) $(SRC)
	@echo "Build complete: $(TARGET)"
	@echo "Usage: ./$(TARGET) <ip> <port> <operation> <address> <count>"

install: $(TARGET)
	cp $(TARGET) /usr/local/bin/
	chmod +x /usr/local/bin/$(TARGET)
	@echo "Installed to /usr/local/bin/$(TARGET)"

clean:
	rm -f $(TARGET)

test:
	@echo "Testing PLC tool compilation..."
	@$(CC) $(CFLAGS) -o $(TARGET) $(SRC) && echo "Build test passed" || echo "Build test failed"

.PHONY: all install clean test
