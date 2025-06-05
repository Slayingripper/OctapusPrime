/**
 * OctapusPrime Landing Page Interactive Elements
 * Enhanced JavaScript for improved interactivity and animations
 */

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeLanding();
});

// Additional initialization on window load
window.addEventListener('load', () => {
  adjustLayoutForScreen();
});

/**
 * Main initialization function
 */
function initializeLanding() {
  console.log('Initializing OctapusPrime Landing Page...');
  
  addInteractiveElements();
  startAnimationSequence();
  setupResponsiveHandling();
  
  console.log('Landing page initialization complete');
}

/**
 * Add interactive elements and event listeners
 */
function addInteractiveElements() {
  setupOctopusHead();
  setupEyeTracking();
  setupTentacleInteractions();
}

/**
 * Setup octopus head animations and interactions
 */
function setupOctopusHead() {
  const head = document.querySelector('.octopus-head');
  if (!head) return;
  
  // Ensure proper transform origin for animations
  head.style.transformOrigin = '50% 50%';
  
  // Add hover effect for head
  head.addEventListener('mouseenter', () => {
    head.style.animationDuration = '1s';
  });
  
  head.addEventListener('mouseleave', () => {
    head.style.animationDuration = '2s';
  });
}

/**
 * Setup eye tracking mouse movement
 */
function setupEyeTracking() {
  const head = document.querySelector('.octopus-head');
  if (!head) return;
  
  document.addEventListener('mousemove', (e) => {
    const rect = head.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // Calculate angle and distance from center
    const angle = Math.atan2(mouseY - centerY, mouseX - centerX);
    const distance = Math.min(
      Math.sqrt(Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2)) / 10, 
      3
    );
    
    // Calculate eye offset
    const offsetX = Math.cos(angle) * distance;
    const offsetY = Math.sin(angle) * distance;
    
    // Update CSS custom properties for eye movement
    document.documentElement.style.setProperty('--eye-offset-x', `${offsetX}px`);
    document.documentElement.style.setProperty('--eye-offset-y', `${offsetY}px`);
  });
  
  // Reset eye position when mouse leaves the window
  document.addEventListener('mouseleave', () => {
    document.documentElement.style.setProperty('--eye-offset-x', '0px');
    document.documentElement.style.setProperty('--eye-offset-y', '0px');
  });
}

/**
 * Setup tentacle hover and click interactions
 */
function setupTentacleInteractions() {
  const tentacles = document.querySelectorAll('.circuit-tentacle');
  
  tentacles.forEach((tentacle, index) => {
    setupSingleTentacle(tentacle, index);
  });
}

/**
 * Setup interactions for a single tentacle
 * @param {Element} tentacle - The tentacle element
 * @param {number} index - Tentacle index for timing
 */
function setupSingleTentacle(tentacle, index) {
  // Mouse enter effects
  tentacle.addEventListener('mouseenter', () => {
    handleTentacleHover(tentacle, true);
  });

  // Mouse leave effects
  tentacle.addEventListener('mouseleave', () => {
    handleTentacleHover(tentacle, false);
  });

  // Click handling with animation
  tentacle.addEventListener('click', (e) => {
    handleTentacleClick(e, tentacle);
  });

  // Touch support for mobile
  tentacle.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleTentacleHover(tentacle, true);
  });

  tentacle.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleTentacleClick(e, tentacle);
    setTimeout(() => handleTentacleHover(tentacle, false), 300);
  });
}

/**
 * Handle tentacle hover effects
 * @param {Element} tentacle - The tentacle element
 * @param {boolean} isHovered - Whether mouse is hovering
 */
function handleTentacleHover(tentacle, isHovered) {
  const path = tentacle.querySelector('.circuit-path');
  if (!path) return;
  
  if (isHovered) {
    // Activate tentacle
    path.style.strokeDasharray = '20, 5';
    path.style.animation = 'pathFlow 0.5s ease-out';
    
    // Add ripple effect
    createRippleEffect(tentacle);
    
    // Add subtle vibration effect
    tentacle.style.filter = 'brightness(1.4) saturate(1.2) drop-shadow(0 0 10px var(--accent-color))';
  } else {
    // Deactivate tentacle
    path.style.strokeDasharray = 'none';
    path.style.animation = 'pathFlow 4s ease-in-out infinite';
    
    tentacle.style.filter = '';
  }
}

/**
 * Handle tentacle click with navigation
 * @param {Event} e - Click event
 * @param {Element} tentacle - The tentacle element
 */
function handleTentacleClick(e, tentacle) {
  e.preventDefault();
  
  // Get the href attribute
  const href = tentacle.getAttribute('href') || tentacle.href?.baseVal || tentacle.href;
  
  if (!href) {
    console.warn('No href found for tentacle:', tentacle);
    return;
  }
  
  // Add click animation
  tentacle.style.transform = 'scale(0.95)';
  tentacle.style.transition = 'transform 0.1s ease';
  
  // Flash effect
  const originalFilter = tentacle.style.filter;
  tentacle.style.filter = 'brightness(2) saturate(2)';
  
  setTimeout(() => {
    tentacle.style.transform = 'scale(1.05)';
    tentacle.style.filter = originalFilter;
    
    setTimeout(() => {
      // Navigate after animation
      console.log(`Navigating to: ${href}`);
      window.location.href = href;
    }, 150);
  }, 100);
}

/**
 * Create ripple effect on tentacle interaction
 * @param {Element} element - Element to add ripple to
 */
function createRippleEffect(element) {
  // Remove existing ripples
  const existingRipples = element.querySelectorAll('.ripple-effect');
  existingRipples.forEach(ripple => ripple.remove());
  
  const ripple = document.createElement('div');
  ripple.className = 'ripple-effect';
  ripple.style.cssText = `
    position: absolute;
    border-radius: 50%;
    background: rgba(57, 255, 20, 0.3);
    transform: scale(0);
    animation: ripple 0.6s linear;
    left: 50%;
    top: 50%;
    width: 100px;
    height: 100px;
    margin-left: -50px;
    margin-top: -50px;
    pointer-events: none;
    z-index: 10;
  `;
  
  element.appendChild(ripple);
  
  // Clean up ripple after animation
  setTimeout(() => {
    if (ripple.parentNode) {
      ripple.remove();
    }
  }, 600);
}

/**
 * Start staggered animation sequence for tentacles
 */
function startAnimationSequence() {
  const tentacles = document.querySelectorAll('.circuit-tentacle');
  
  tentacles.forEach((tentacle, index) => {
    // Initial hidden state
    tentacle.style.opacity = '0';
    tentacle.style.transform = 'scale(0.8)';
    
    // Staggered reveal animation
    setTimeout(() => {
      tentacle.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      tentacle.style.opacity = '1';
      tentacle.style.transform = 'scale(1)';
    }, 1000 + (index * 200));
  });
  
  // Add entrance effects for other elements
  setTimeout(() => {
    addEntranceEffects();
  }, 500);
}

/**
 * Add entrance effects for main elements
 */
function addEntranceEffects() {
  const brandTitle = document.querySelector('.brand-title');
  const statusIndicator = document.querySelector('.status-indicator');
  
  if (brandTitle) {
    brandTitle.style.transform = 'translateY(-20px)';
    brandTitle.style.opacity = '0';
    brandTitle.style.transition = 'all 0.8s ease';
    
    setTimeout(() => {
      brandTitle.style.transform = 'translateY(0)';
      brandTitle.style.opacity = '1';
    }, 200);
  }
  
  if (statusIndicator) {
    statusIndicator.style.transform = 'translateY(20px)';
    statusIndicator.style.opacity = '0';
    statusIndicator.style.transition = 'all 0.8s ease';
    
    setTimeout(() => {
      statusIndicator.style.transform = 'translateY(0)';
      statusIndicator.style.opacity = '1';
    }, 800);
  }
}

/**
 * Setup responsive handling for window changes
 */
function setupResponsiveHandling() {
  // Handle orientation changes and resize events
  window.addEventListener('resize', debounce(adjustLayoutForScreen, 250));
  window.addEventListener('orientationchange', () => {
    setTimeout(adjustLayoutForScreen, 100);
  });
  
  // Handle visibility changes (tab switching)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseAnimations();
    } else {
      resumeAnimations();
    }
  });
}

/**
 * Adjust layout based on screen size
 */
function adjustLayoutForScreen() {
  const container = document.querySelector('.octopus-interface');
  if (!container) return;
  
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };
  
  // Reset any existing transforms
  container.style.transform = '';
  
  // Adjust scaling based on viewport
  let scale = 1;
  
  if (viewport.width < 480 || viewport.height < 600) {
    scale = 0.7;
  } else if (viewport.width < 768) {
    scale = 0.85;
  } else if (viewport.width < 1024) {
    scale = 0.95;
  }
  
  if (scale !== 1) {
    container.style.transform = `scale(${scale})`;
    container.style.transformOrigin = 'center center';
  }
  
  console.log(`Layout adjusted for ${viewport.width}x${viewport.height}, scale: ${scale}`);
}

/**
 * Pause animations when tab is not visible
 */
function pauseAnimations() {
  const animatedElements = document.querySelectorAll('[style*="animation"]');
  animatedElements.forEach(el => {
    el.style.animationPlayState = 'paused';
  });
}

/**
 * Resume animations when tab becomes visible
 */
function resumeAnimations() {
  const animatedElements = document.querySelectorAll('[style*="animation"]');
  animatedElements.forEach(el => {
    el.style.animationPlayState = 'running';
  });
}

/**
 * Debounce function to limit function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Error handling for missing elements
 */
function handleMissingElements() {
  const requiredElements = [
    '.octopus-interface',
    '.octopus-head',
    '.circuit-tentacle'
  ];
  
  const missingElements = requiredElements.filter(selector => 
    !document.querySelector(selector)
  );
  
  if (missingElements.length > 0) {
    console.warn('Missing required elements:', missingElements);
  }
}

// Initialize error handling
handleMissingElements();

// Export functions for testing if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeLanding,
    adjustLayoutForScreen,
    createRippleEffect
  };
}