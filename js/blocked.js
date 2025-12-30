// Qura - Blocked Page Script
// Displays blocked page with timer and motivational quotes

(function() {
  'use strict';

  const motivationalQuotes = [
    "The secret of getting ahead is getting started.",
    "Focus on being productive instead of busy.",
    "Don't watch the clock; do what it does. Keep going.",
    "The only way to do great work is to love what you do.",
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "Believe you can and you're halfway there.",
    "Your limitation—it's only your imagination.",
    "Push yourself, because no one else is going to do it for you.",
    "Great things never come from comfort zones.",
    "Dream it. Wish it. Do it.",
    "Success doesn't just find you. You have to go out and get it.",
    "The harder you work for something, the greater you'll feel when you achieve it.",
    "Don't stop when you're tired. Stop when you're done.",
    "Wake up with determination. Go to bed with satisfaction.",
    "Do something today that your future self will thank you for."
  ];

  function init() {
    // Show random quote
    const quoteEl = document.getElementById('motivation');
    if (quoteEl) {
      quoteEl.textContent = '"' + motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)] + '"';
    }

    // Show blocked URL
    const urlParams = new URLSearchParams(window.location.search);
    const blockedUrl = urlParams.get('url');
    const blockedUrlEl = document.getElementById('blocked-url');
    if (blockedUrl && blockedUrlEl) {
      blockedUrlEl.textContent = blockedUrl;
    }

    // Back button
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', function() {
        history.back();
      });
    }

    // Get state and apply theme
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, function(response) {
      if (response && response.success) {
        applyTheme(response.state.settings);
        updateDisplay(response.state);
      }
    });

    // Start timer update
    setInterval(updateTimer, 1000);
  }

  function applyTheme(settings) {
    if (settings && settings.customTheme) {
      const theme = settings.customTheme;
      const root = document.documentElement;
      root.style.setProperty('--bg-dark', theme.bgDark);
      root.style.setProperty('--bg-card', theme.bgCard);
      root.style.setProperty('--text-primary', theme.textPrimary);
      root.style.setProperty('--text-secondary', theme.textSecondary);
      root.style.setProperty('--text-muted', theme.textMuted);
      root.style.setProperty('--accent', theme.accent);
      root.style.setProperty('--accent-glow', theme.accent + '4D');
    }

    // Apply custom blocked message (use custom if set, otherwise keep default)
    const messageEl = document.getElementById('custom-message');
    if (messageEl && settings && settings.blockedMessage && settings.blockedMessage.trim() !== '') {
      messageEl.textContent = settings.blockedMessage;
    }
    // If no custom message, the default from HTML is used
  }

  function updateDisplay(state) {
    if (state.activeSession) {
      const sessionNameEl = document.getElementById('session-name');
      if (sessionNameEl) {
        sessionNameEl.textContent = state.activeSession.name;
      }
    }

    const timerEl = document.getElementById('timer');
    if (timerEl) {
      timerEl.textContent = formatTime(state.elapsedTime);
    }
  }

  function updateTimer() {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, function(response) {
      if (response && response.success && response.state.isRunning) {
        const timerEl = document.getElementById('timer');
        if (timerEl) {
          timerEl.textContent = formatTime(response.state.elapsedTime);
        }
      }
    });
  }

  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
    }
    return pad(minutes) + ':' + pad(seconds);
  }

  function pad(num) {
    return num.toString().padStart(2, '0');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
