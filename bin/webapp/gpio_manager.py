#!/usr/bin/env python3
import os
import logging
import json
import subprocess

from pathlib import Path
from typing import Optional, Tuple, Dict, Any

# Base directory for configuration
BASE_DIR = Path(__file__).resolve().parent
CONFIG_FILE = BASE_DIR / "gpio_config.json"

class GPIOManager:
    """
    Manages GPIO configuration and initialization across different SBC platforms.
    Supports Raspberry Pi, Orange Pi, Odroid, Nano Pi, and manual override.
    """
    
    def __init__(self):
        self.config = self.load_config()
        self.gpio_lib = None
        self.button = None
        self.led = None
        self.platform_info = self.detect_platform()
        
    def load_config(self) -> Dict[str, Any]:
        """Load GPIO configuration from file."""
        default_config = {
            "auto_detect": True,
            "manual_override": False,
            "gpio_library": "auto",  # auto, RPi.GPIO, gpiozero, wiringpi, libgpiod
            "button_pin": 17,
            "led_pin": 27,
            "macchanger_pin": 23,
            "button_pull_up": True,
            "macchanger_pull_up": True,
            "button_bounce_time": 0.1,
            "led_active_high": True
        }
        
        try:
            if CONFIG_FILE.exists():
                with open(CONFIG_FILE, 'r') as f:
                    config = json.load(f)
                # Merge with defaults for any missing keys
                for key, value in default_config.items():
                    if key not in config:
                        config[key] = value
                return config
        except Exception as e:
            logging.warning(f"Failed to load GPIO config: {e}")
        
        return default_config
    
    def save_config(self, config: Dict[str, Any]) -> bool:
        """Save GPIO configuration to file."""
        try:
            with open(CONFIG_FILE, 'w') as f:
                json.dump(config, f, indent=2)
            self.config = config
            return True
        except Exception as e:
            logging.error(f"Failed to save GPIO config: {e}")
            return False
    
    def detect_platform(self) -> Dict[str, str]:
        """
        Detect the current Single Board Computer platform.
        Returns platform info with recommended GPIO library.
        """
        platform_info = {
            "platform": "unknown",
            "model": "unknown",
            "recommended_lib": "gpiozero"
        }
        
        try:
            # Check /proc/cpuinfo for platform identification
            if os.path.exists("/proc/cpuinfo"):
                with open("/proc/cpuinfo", "r") as f:
                    cpuinfo = f.read().lower()
                
                if "raspberry pi" in cpuinfo:
                    platform_info["platform"] = "raspberry_pi"
                    platform_info["recommended_lib"] = "gpiozero"
                    
                    # Detect specific Pi model
                    if "pi 4" in cpuinfo:
                        platform_info["model"] = "Raspberry Pi 4"
                    elif "pi 3" in cpuinfo:
                        platform_info["model"] = "Raspberry Pi 3"
                    elif "pi zero" in cpuinfo:
                        platform_info["model"] = "Raspberry Pi Zero"
                    else:
                        platform_info["model"] = "Raspberry Pi"
                        
                elif "allwinner" in cpuinfo or "sun" in cpuinfo:
                    platform_info["platform"] = "orange_pi"
                    platform_info["model"] = "Orange Pi"
                    platform_info["recommended_lib"] = "libgpiod"
                    
                elif "odroid" in cpuinfo or "amlogic" in cpuinfo:
                    platform_info["platform"] = "odroid"
                    platform_info["model"] = "Odroid"
                    platform_info["recommended_lib"] = "libgpiod"
                    
                elif "rockchip" in cpuinfo:
                    platform_info["platform"] = "rock_pi"
                    platform_info["model"] = "Rock Pi"
                    platform_info["recommended_lib"] = "libgpiod"
            
            # Check for device tree model (more reliable on some boards)
            if os.path.exists("/proc/device-tree/model"):
                with open("/proc/device-tree/model", "r") as f:
                    model = f.read().strip('\x00').lower()
                    
                if "friendlyarm" in model or "nanopi" in model:
                    platform_info["platform"] = "nano_pi"
                    platform_info["model"] = "Nano Pi"
                    platform_info["recommended_lib"] = "libgpiod"
                    
        except Exception as e:
            logging.warning(f"Platform detection failed: {e}")
        
        return platform_info
    
    def get_available_libraries(self) -> Dict[str, bool]:
        """Check which GPIO libraries are available on the system."""
        libraries = {}
        
        # Test gpiozero
        try:
            import gpiozero
            libraries["gpiozero"] = True
        except ImportError:
            libraries["gpiozero"] = False
        
        # Test RPi.GPIO
        try:
            import RPi.GPIO
            libraries["RPi.GPIO"] = True
        except ImportError:
            libraries["RPi.GPIO"] = False
        
        # Test wiringpi
        try:
            import wiringpi
            libraries["wiringpi"] = True
        except ImportError:
            libraries["wiringpi"] = False
        
        # Test libgpiod
        try:
            import gpiod
            libraries["libgpiod"] = True
        except ImportError:
            libraries["libgpiod"] = False
        
        # Test lgpio
        try:
            import lgpio
            libraries["lgpio"] = True
        except ImportError:
            libraries["lgpio"] = False
            
        return libraries
    

    def monitor_gpio_pin(self, pin: int, callback, existing_button=None):
        """
        Set up a GPIO pin for monitoring with a callback.
        """
        try:
            available = self.get_available_libraries()
            use_lib = self.config["gpio_library"]
            if self.config["manual_override"]:
                lib_name = use_lib
            else:
                lib_name = self.platform_info["recommended_lib"]
            
            if lib_name == "gpiozero" or (lib_name == "auto" and available.get("gpiozero")):
                from gpiozero import Button
                if existing_button and isinstance(existing_button, Button):
                    existing_button.when_pressed = callback
                    logging.info(f"Monitoring GPIO {pin} with existing gpiozero Button")
                    return existing_button
                else:
                    button = Button(
                        pin,
                        pull_up=self.config["macchanger_pull_up"],
                        bounce_time=self.config["button_bounce_time"]
                    )
                    button.when_pressed = callback
                    logging.info(f"Monitoring GPIO {pin} with new gpiozero Button")
                    return button
            
            elif lib_name == "RPi.GPIO" and available.get("RPi.GPIO"):
                import RPi.GPIO as GPIO
                GPIO.setmode(GPIO.BCM)
                GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP if self.config["macchanger_pull_up"] else GPIO.PUD_DOWN)
                
                class RPiMacchanger:
                    def __init__(self, pin, bounce_time):
                        self.pin = pin
                        self.bounce_time = bounce_time
                        self._when_pressed = None
                    
                    @property
                    def when_pressed(self):
                        return self._when_pressed
                    
                    @when_pressed.setter
                    def when_pressed(self, callback):
                        self._when_pressed = callback
                        GPIO.add_event_detect(
                            self.pin,
                            GPIO.FALLING,
                            callback=lambda x: callback(),
                            bouncetime=int(self.bounce_time * 1000)
                        )
                
                button = RPiMacchanger(pin, self.config["button_bounce_time"])
                button.when_pressed = callback
                logging.info(f"Monitoring GPIO {pin} with RPi.GPIO")
                return button
            
            logging.error(f"GPIO library '{lib_name}' not supported for monitoring GPIO {pin}")
            return None
        
        except Exception as e:
            logging.error(f"Failed to monitor GPIO {pin}: {e}")
            return None
    
    def setup_gpio(self) -> Tuple[Optional[Any], Optional[Any], Optional[Any]]:
        """
        Initialize GPIO button, LED, and macchanger pin based on configuration.
        Returns (button, led, macchanger) objects or (None, None, None) if failed.
        """
        if self.config["manual_override"]:
            lib_name = self.config["gpio_library"]
        else:
            lib_name = self.platform_info["recommended_lib"]
        
        button_pin = self.config["button_pin"]
        led_pin = self.config["led_pin"]
        macchanger_pin = self.config["macchanger_pin"]
        try:
            if lib_name == "gpiozero" or (lib_name == "auto" and self.get_available_libraries().get("gpiozero")):
                return self._setup_gpiozero(button_pin, led_pin, macchanger_pin)
            elif lib_name == "RPi.GPIO":
                return self._setup_rpi_gpio(button_pin, led_pin, macchanger_pin)
            elif lib_name == "libgpiod":
                return self._setup_libgpiod(button_pin, led_pin, macchanger_pin)
            elif lib_name == "lgpio":
                return self._setup_lgpio(button_pin, led_pin, macchanger_pin)
            else:
                logging.error(f"Unsupported GPIO library: {lib_name}")
                return None, None, None
                    
        except Exception as e:
            logging.error(f"GPIO setup failed with {lib_name}: {e}")
            return None, None, None
        
    def _setup_gpiozero(self, button_pin: int, led_pin: int, macchanger_pin: int) -> Tuple[Any, Any, Any]:
        """Setup GPIO using gpiozero library."""
        # ... (existing kernel patch logic) ...
        from gpiozero import Button, LED
        
        button = Button(
            button_pin, 
            pull_up=self.config["button_pull_up"],
            bounce_time=self.config["button_bounce_time"]
        )
        macchanger = Button(
            macchanger_pin, 
            pull_up=self.config["macchanger_pull_up"],
            bounce_time=self.config["button_bounce_time"]
        )
        led = LED(led_pin, active_high=self.config["led_active_high"])
        
        logging.info(f"GPIO setup successful with gpiozero: Button={button_pin}, LED={led_pin}, MACCHANGER={macchanger_pin}")
        return button, led, macchanger
    
    def _setup_rpi_gpio(self, button_pin: int, led_pin: int, macchanger_pin: int) -> Tuple[Any, Any, Any]:
        """Setup GPIO using RPi.GPIO library."""
        import RPi.GPIO as GPIO
        
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(button_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP if self.config["button_pull_up"] else GPIO.PUD_DOWN)
        GPIO.setup(macchanger_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP if self.config["macchanger_pull_up"] else GPIO.PUD_DOWN)
        GPIO.setup(led_pin, GPIO.OUT)
        
        # Create wrapper classes to match gpiozero interface
        class RPiButton:
            def __init__(self, pin):
                self.pin = pin
                self._when_pressed = None
            
            @property
            def when_pressed(self):
                return self._when_pressed
            
            @when_pressed.setter
            def when_pressed(self, callback):
                self._when_pressed = callback
                GPIO.add_event_detect(self.pin, GPIO.FALLING, callback=lambda x: callback(), bouncetime=int(self.config["button_bounce_time"] * 1000))
        
        class RPiMacchanger:
            def __init__(self, pin, bounce_time):
                self.pin = pin
                self.bounce_time = bounce_time
                self._when_pressed = None
            
            @property
            def when_pressed(self):
                return self._when_pressed
            
            @when_pressed.setter
            def when_pressed(self, callback):
                self._when_pressed = callback
                GPIO.add_event_detect(
                    self.pin,
                    GPIO.FALLING,
                    callback=lambda x: callback(),
                    bouncetime=int(self.bounce_time * 1000)
                )

        class RPiLED:
            def __init__(self, pin, active_high=True):
                self.pin = pin
                self.active_high = active_high
                self._blinking = False
            
            def on(self):
                GPIO.output(self.pin, GPIO.HIGH if self.active_high else GPIO.LOW)
            
            def off(self):
                GPIO.output(self.pin, GPIO.LOW if self.active_high else GPIO.HIGH)
            
            def blink(self, on_time=1, off_time=1):
                # Simplified blink - in real implementation you'd use threading
                self._blinking = True
        
        button = RPiButton(button_pin)
        button = RPiMacchanger(macchanger_pin)
        led = RPiLED(led_pin, self.config["led_active_high"])
        
        logging.info(f"GPIO setup successful with RPi.GPIO: Button={button_pin}, LED={led_pin}, MACCHANGER={macchanger_pin}")
        return button, led
    
    def _setup_libgpiod(self, button_pin: int, led_pin: int, macchanger_pin: int) -> Tuple[Any, Any, Any]:
        """Setup GPIO using libgpiod library."""
        import gpiod
        
        # This is a simplified implementation - you'd need to expand for full functionality
        chip = gpiod.Chip('gpiochip0')
        
        button_line = chip.get_line(button_pin)
        macchanger_pin = chip.get_line(macchanger_pin)
        led_line = chip.get_line(led_pin)
        
        button_line.request(consumer="octapus_button", type=gpiod.LINE_REQ_EV_FALLING_EDGE)
        macchanger_pin.request(consumer="octapus_button", type=gpiod.LINE_REQ_EV_FALLING_EDGE)
        led_line.request(consumer="octapus_led", type=gpiod.LINE_REQ_DIR_OUT)
        
        # Create wrapper classes
        class GpiodButton:
            def __init__(self, line):
                self.line = line
                self._when_pressed = None
            
            @property
            def when_pressed(self):
                return self._when_pressed
            
            @when_pressed.setter
            def when_pressed(self, callback):
                self._when_pressed = callback
                # You'd implement event monitoring in a separate thread
        
        class GpiodMacchanger:
            def __init__(self, line):
                self.line = line
                self._when_pressed = None
            
            @property
            def when_pressed(self):
                return self._when_pressed
            
            @when_pressed.setter
            def when_pressed(self, callback):
                self._when_pressed = callback

        class GpiodLED:
            def __init__(self, line, active_high=True):
                self.line = line
                self.active_high = active_high
            
            def on(self):
                self.line.set_value(1 if self.active_high else 0)
            
            def off(self):
                self.line.set_value(0 if self.active_high else 1)
            
            def blink(self, on_time=1, off_time=1):
                pass  # Implement blinking logic
        
        button = GpiodButton(button_line)
        led = GpiodLED(led_line, self.config["led_active_high"])
        
        logging.info(f"GPIO setup successful with libgpiod: Button={button_pin}, LED={led_pin}")
        return button, led
    
    def _setup_lgpio(self, button_pin: int, led_pin: int, macchanger_pin: int) -> Tuple[Any, Any, Any]:
        """Setup GPIO using lgpio library."""
        import lgpio
        
        handle = lgpio.gpiochip_open(0)
        
        # Configure pins
        lgpio.gpio_claim_input(handle, button_pin, lgpio.SET_PULL_UP if self.config["button_pull_up"] else lgpio.SET_PULL_DOWN)
        lgpio.gpio_claim_input(handle, macchanger_pin, lgpio.SET_PULL_UP if self.config["macchanger_pull_up"] else lgpio.SET_PULL_DOWN)
        lgpio.gpio_claim_output(handle, led_pin)
        
        # Create wrapper classes
        class LgpioButton:
            def __init__(self, handle, pin):
                self.handle = handle
                self.pin = pin
                self._when_pressed = None
            
            @property
            def when_pressed(self):
                return self._when_pressed
            
            @when_pressed.setter
            def when_pressed(self, callback):
                self._when_pressed = callback
                # Implement callback registration
        
        class LgpioMacchanger:
            def __init__(self, handle, pin):
                self.handle = handle
                self.pin = pin
                self._when_pressed = None
            
            @property
            def when_pressed(self):
                return self._when_pressed
            
            @when_pressed.setter
            def when_pressed(self, callback):
                self._when_pressed = callback
                # Implement callback registration

        class LgpioLED:
            def __init__(self, handle, pin, active_high=True):
                self.handle = handle
                self.pin = pin
                self.active_high = active_high
            
            def on(self):
                lgpio.gpio_write(self.handle, self.pin, 1 if self.active_high else 0)
            
            def off(self):
                lgpio.gpio_write(self.handle, self.pin, 0 if self.active_high else 1)
            
            def blink(self, on_time=1, off_time=1):
                pass  # Implement blinking
        
        button = LgpioButton(handle, button_pin)
        led = LgpioLED(handle, led_pin, self.config["led_active_high"])
        
        logging.info(f"GPIO setup successful with lgpio: Button={button_pin}, LED={led_pin}")
        return button, led

# Global GPIO manager instance
gpio_manager = GPIOManager()