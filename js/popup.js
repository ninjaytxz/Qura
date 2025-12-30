// Qura - Popup Script
// Handles popup UI interactions and communication with background

document.addEventListener('DOMContentLoaded', () => {
  // ============================================
  // DOM ELEMENTS
  // ============================================
  const elements = {
    timerDisplay: document.getElementById('timer-display'),
    timerStatus: document.getElementById('timer-status'),
    sessionSelect: document.getElementById('session-select'),
    sessionIndicator: document.getElementById('session-indicator'),
    startBtn: document.getElementById('start-btn'),
    pauseBtn: document.getElementById('pause-btn'),
    endBtn: document.getElementById('end-btn'),
    websiteInput: document.getElementById('website-input'),
    addWebsiteBtn: document.getElementById('add-website-btn'),
    optionsBtn: document.getElementById('options-btn'),
    totalTime: document.getElementById('total-time'),
    tasksDone: document.getElementById('tasks-done'),
    toastContainer: document.getElementById('toast-container')
  };

  // ============================================
  // STATE
  // ============================================
  let state = {
    sessions: [],
    activeSession: null,
    isRunning: false,
    isPaused: false,
    elapsedTime: 0,
    statistics: {
      totalTime: 0,
      tasksCompleted: 0
    },
    settings: {}
  };

  let timerInterval = null;

  // ============================================
  // INITIALIZATION
  // ============================================
  function init() {
    loadState();
    attachEventListeners();
    startTimerUpdate();
  }

  function loadState() {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
      if (response && response.success) {
        state = response.state;
        applyTheme();
        updateUI();
      }
    });
  }

  function applyTheme() {
    if (state.settings && state.settings.customTheme) {
      const theme = state.settings.customTheme;
      const root = document.documentElement;
      
      root.style.setProperty('--bg-dark', theme.bgDark);
      root.style.setProperty('--bg-card', theme.bgCard);
      root.style.setProperty('--bg-elevated', theme.bgElevated);
      root.style.setProperty('--bg-input', theme.bgInput);
      root.style.setProperty('--text-primary', theme.textPrimary);
      root.style.setProperty('--text-secondary', theme.textSecondary);
      root.style.setProperty('--text-muted', theme.textMuted);
      root.style.setProperty('--accent', theme.accent);
      root.style.setProperty('--accent-hover', theme.accentHover);
      root.style.setProperty('--accent-glow', `${theme.accent}4D`);
      root.style.setProperty('--accent-light', `${theme.accent}26`);
    }
  }

  function attachEventListeners() {
    elements.sessionSelect.addEventListener('change', handleSessionChange);
    elements.startBtn.addEventListener('click', handleStart);
    elements.pauseBtn.addEventListener('click', handlePause);
    elements.endBtn.addEventListener('click', handleEnd);
    elements.addWebsiteBtn.addEventListener('click', handleAddWebsite);
    elements.websiteInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleAddWebsite();
    });
    elements.optionsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'STATE_UPDATE') {
        state = message.state;
        applyTheme();
        updateUI();
      }
    });
  }

  // ============================================
  // UI UPDATE
  // ============================================
  function updateUI() {
    updateSessionSelect();
    updateTimer();
    updateControls();
    updateStats();
  }

  function updateSessionSelect() {
    const select = elements.sessionSelect;
    const currentValue = select.value;

    select.innerHTML = '<option value="">-- Select Session --</option>';
    
    state.sessions.forEach(session => {
      const option = document.createElement('option');
      option.value = session.id;
      option.textContent = session.name;
      option.style.color = session.color;
      select.appendChild(option);
    });

    if (state.activeSession) {
      select.value = state.activeSession.id;
      elements.sessionIndicator.style.background = state.activeSession.color;
    } else if (currentValue) {
      select.value = currentValue;
      const session = state.sessions.find(s => s.id === currentValue);
      if (session) {
        elements.sessionIndicator.style.background = session.color;
      }
    } else {
      elements.sessionIndicator.style.background = 'transparent';
    }

    elements.addWebsiteBtn.disabled = !select.value;
  }

  function updateTimer() {
    const time = formatTime(state.elapsedTime);
    elements.timerDisplay.textContent = time;

    elements.timerDisplay.classList.remove('running', 'paused');
    elements.timerStatus.classList.remove('running', 'paused');

    if (state.isRunning) {
      elements.timerDisplay.classList.add('running');
      elements.timerStatus.classList.add('running');
      elements.timerStatus.textContent = 'Focusing...';
    } else if (state.isPaused) {
      elements.timerDisplay.classList.add('paused');
      elements.timerStatus.classList.add('paused');
      elements.timerStatus.textContent = 'Paused';
    } else if (state.activeSession) {
      elements.timerStatus.textContent = `Ready: ${state.activeSession.name}`;
    } else {
      elements.timerStatus.textContent = 'Select a session to begin';
    }
  }

  function updateControls() {
    const hasSession = !!elements.sessionSelect.value || !!state.activeSession;
    
    elements.startBtn.disabled = !hasSession || state.isRunning;
    elements.pauseBtn.disabled = !state.isRunning;
    elements.pauseBtn.querySelector('span').textContent = state.isPaused ? 'Resume' : 'Pause';
    elements.endBtn.disabled = !state.isRunning && !state.isPaused;
    elements.sessionSelect.disabled = state.isRunning || state.isPaused;
    elements.addWebsiteBtn.disabled = !hasSession;
  }

  function updateStats() {
    const totalMs = state.statistics.totalTime || 0;
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    elements.totalTime.textContent = `${hours}h ${minutes}m`;
    elements.tasksDone.textContent = state.statistics.tasksCompleted || 0;
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================
  function handleSessionChange() {
    const sessionId = elements.sessionSelect.value;
    
    if (sessionId) {
      chrome.runtime.sendMessage({
        type: 'SELECT_SESSION',
        sessionId: sessionId
      }, (response) => {
        if (response && response.success) {
          const session = response.session;
          elements.sessionIndicator.style.background = session.color;
        }
      });
    } else {
      elements.sessionIndicator.style.background = 'transparent';
    }
    
    updateControls();
  }

  function handleStart() {
    const sessionId = elements.sessionSelect.value;
    if (!sessionId && !state.activeSession) {
      return;
    }

    if (sessionId && (!state.activeSession || state.activeSession.id !== sessionId)) {
      chrome.runtime.sendMessage({
        type: 'SELECT_SESSION',
        sessionId: sessionId
      }, () => {
        chrome.runtime.sendMessage({ type: 'START_TIMER' });
      });
    } else {
      chrome.runtime.sendMessage({ type: 'START_TIMER' });
    }
  }

  function handlePause() {
    if (state.isPaused) {
      chrome.runtime.sendMessage({ type: 'START_TIMER' });
    } else {
      chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
    }
  }

  function handleEnd() {
    showConfirm('End Session', 'Are you sure you want to end this session?', () => {
      chrome.runtime.sendMessage({ type: 'END_TIMER' });
    });
  }

  function handleAddWebsite() {
    const website = elements.websiteInput.value.trim();
    const sessionId = elements.sessionSelect.value || state.activeSession?.id;

    if (!website || !sessionId) return;

    let cleanUrl = website
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/.*$/, '');

    chrome.runtime.sendMessage({
      type: 'ADD_WEBSITE',
      sessionId: sessionId,
      website: cleanUrl
    }, (response) => {
      if (response && response.success) {
        elements.websiteInput.value = '';
        showToast('Website added to whitelist!', 'success');
      }
    });
  }

  // ============================================
  // TIMER UPDATE
  // ============================================
  function startTimerUpdate() {
    timerInterval = setInterval(() => {
      if (state.isRunning) {
        chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
          if (response && response.success) {
            state.elapsedTime = response.state.elapsedTime;
            elements.timerDisplay.textContent = formatTime(state.elapsedTime);
          }
        });
      }
    }, 1000);
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">
        ${type === 'success' 
          ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>'
          : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
        }
      </div>
      <span class="toast-message">${escapeHtml(message)}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideUp 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function showConfirm(title, message, onConfirm) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-modal">
        <h3 class="confirm-title">${escapeHtml(title)}</h3>
        <p class="confirm-message">${escapeHtml(message)}</p>
        <div class="confirm-actions">
          <button class="confirm-btn cancel">Cancel</button>
          <button class="confirm-btn confirm">Confirm</button>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .confirm-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 3000;
        animation: fadeIn 0.2s ease;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .confirm-modal {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 20px;
        width: 280px;
        animation: scaleIn 0.2s ease;
      }
      @keyframes scaleIn {
        from { transform: scale(0.9); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      .confirm-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 8px;
      }
      .confirm-message {
        font-size: 14px;
        color: var(--text-secondary);
        margin-bottom: 20px;
        line-height: 1.5;
      }
      .confirm-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      .confirm-btn {
        padding: 10px 16px;
        border-radius: var(--radius-sm);
        font-family: var(--font-main);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
      }
      .confirm-btn.cancel {
        background: var(--bg-input);
        color: var(--text-secondary);
      }
      .confirm-btn.cancel:hover {
        background: var(--bg-elevated);
        color: var(--text-primary);
      }
      .confirm-btn.confirm {
        background: var(--danger);
        color: white;
      }
      .confirm-btn.confirm:hover {
        background: var(--danger-hover);
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlay);

    // Event listeners
    overlay.querySelector('.cancel').addEventListener('click', () => {
      overlay.remove();
      style.remove();
    });

    overlay.querySelector('.confirm').addEventListener('click', () => {
      overlay.remove();
      style.remove();
      onConfirm();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        style.remove();
      }
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================
  // START
  // ============================================
  init();
});
