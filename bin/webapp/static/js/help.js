function scrollToSection(sectionId) {
  document.getElementById(sectionId).scrollIntoView({ 
    behavior: 'smooth',
    block: 'start'
  });
}

function toggleFAQ(element) {
  const faqItem = element.parentElement;
  const answer = faqItem.querySelector('.faq-answer');
  
  faqItem.classList.toggle('active');
  answer.classList.toggle('active');
}

function searchHelp() {
  const searchTerm = document.getElementById('search-input').value.toLowerCase();
  const sections = document.querySelectorAll('.help-section');
  
  sections.forEach(section => {
    const content = section.textContent.toLowerCase();
    if (content.includes(searchTerm) || searchTerm === '') {
      section.style.display = 'block';
    } else {
      section.style.display = 'none';
    }
  });
}

// Initialize page functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Auto-expand FAQ items based on search
  const searchInput = document.getElementById('search-input');
  
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      const faqItems = document.querySelectorAll('.faq-item');
      
      faqItems.forEach(item => {
        const question = item.querySelector('.faq-question h3').textContent.toLowerCase();
        const answer = item.querySelector('.faq-answer').textContent.toLowerCase();
        
        if ((question.includes(searchTerm) || answer.includes(searchTerm)) && searchTerm !== '') {
          item.classList.add('active');
          item.querySelector('.faq-answer').classList.add('active');
        } else if (searchTerm === '') {
          item.classList.remove('active');
          item.querySelector('.faq-answer').classList.remove('active');
        }
      });
    });
  }

  // Add keyboard navigation for FAQ items
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.classList.contains('faq-question')) {
      toggleFAQ(e.target);
    }
  });

  // Add accessibility attributes to FAQ items
  const faqQuestions = document.querySelectorAll('.faq-question');
  faqQuestions.forEach((question, index) => {
    question.setAttribute('tabindex', '0');
    question.setAttribute('role', 'button');
    question.setAttribute('aria-expanded', 'false');
    question.setAttribute('aria-controls', `faq-answer-${index}`);
    
    const answer = question.parentElement.querySelector('.faq-answer');
    answer.setAttribute('id', `faq-answer-${index}`);
    answer.setAttribute('role', 'region');
  });

  // Update aria-expanded when FAQ is toggled
  const originalToggleFAQ = window.toggleFAQ;
  window.toggleFAQ = function(element) {
    const isActive = element.parentElement.classList.contains('active');
    element.setAttribute('aria-expanded', !isActive);
    originalToggleFAQ(element);
  };
});

// Add smooth scrolling for anchor links
document.addEventListener('click', function(e) {
  if (e.target.matches('a[href^="#"]')) {
    e.preventDefault();
    const targetId = e.target.getAttribute('href').substring(1);
    scrollToSection(targetId);
  }
});

// Add search keyboard shortcuts
document.addEventListener('keydown', function(e) {
  // Ctrl+F or Cmd+F to focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }
  
  // Escape to clear search
  if (e.key === 'Escape') {
    const searchInput = document.getElementById('search-input');
    if (searchInput && document.activeElement === searchInput) {
      searchInput.value = '';
      searchHelp();
      searchInput.blur();
    }
  }
});