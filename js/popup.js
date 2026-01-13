// Qura - Popup Script
// Handles popup UI interactions and communication with background

// Truncate long text with dots
function truncateText(text, maxLength = 19) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}


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
    toastContainer: document.getElementById('toast-container'),
    strictModeToggle: document.getElementById('strict-mode-toggle'),
    strictModeTimer: document.getElementById('strict-mode-timer'),
    strictModeBadge: document.getElementById('strict-mode-badge'),
    strictHours: document.getElementById('strict-hours'),
    strictMinutes: document.getElementById('strict-minutes'),
    strictSeconds: document.getElementById('strict-seconds'),
    presetBtns: document.querySelectorAll('.preset-btn'),
    strictWarningModal: document.getElementById('strict-warning-modal'),
    strictWarningCancel: document.getElementById('strict-warning-cancel'),
    strictWarningContinue: document.getElementById('strict-warning-continue'),
    disableStrictWarning: document.getElementById('disable-strict-warning')
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
    settings: {},
    tasks: {},
    strictMode: false,
    strictDuration: null
  };

  let timerInterval = null;
  let strictModeEnabled = false;
  let strictDurationSeconds = 1500; // Default 25 minutes
  let strictWarningDisabled = false; // Track if user disabled the warning

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

        // If timer is IDLE (not running/paused), load user preferences
        if (!state.isRunning && !state.isPaused) {
          chrome.storage.local.get(['savedStrictMode', 'savedStrictDuration'], (result) => {
            
            // 1. Restore Toggle & Visibility
            if (result.savedStrictMode !== undefined) {
              strictModeEnabled = result.savedStrictMode;
              state.strictMode = strictModeEnabled; // Sync local state
              
              // FORCE UI UPDATES
              elements.strictModeToggle.checked = strictModeEnabled;
              // This line fixes the "hidden entries" bug:
              elements.strictModeTimer.style.display = strictModeEnabled ? 'block' : 'none';
            }

            // 2. Restore Time Inputs
            if (result.savedStrictDuration) {
              strictDurationSeconds = result.savedStrictDuration;
              setStrictTime(strictDurationSeconds); // Fills the inputs
              
              // Highlight the correct preset button if matches
              elements.presetBtns.forEach(btn => {
                const isMatch = parseInt(btn.dataset.time) === strictDurationSeconds;
                btn.classList.toggle('active', isMatch);
              });
            }
            
            applyTheme();
            updateUI();
          });
        } else {
          // If timer IS running, rely on background state
          strictModeEnabled = state.strictMode;
          elements.strictModeToggle.checked = strictModeEnabled;
          // Ensure visibility matches running state
          elements.strictModeTimer.style.display = strictModeEnabled ? 'block' : 'none';
          
          applyTheme();
          updateUI();
        }
      }
    });
  }
  function applyTheme() {
  if (state.settings && state.settings.customTheme) {
    const theme = state.settings.customTheme;
    const root = document.documentElement;

    // Calculate Smart Colors
    const textOnAccent = getContrastColor(theme.accent);
    const textOnBg = getContrastColor(theme.bgCard);

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
    
    // Apply Smart Contrast Variable
    root.style.setProperty('--text-on-accent', textOnAccent);

    // Auto-adjust text color if contrast against background is too low
    const userTextColorLum = getLuminance(...Object.values(hexToRgb(theme.textPrimary)));
    const bgLum = getLuminance(...Object.values(hexToRgb(theme.bgCard)));
    if (Math.abs(userTextColorLum - bgLum) < 0.3) {
       root.style.setProperty('--text-primary', textOnBg);
    }
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

    // Strict mode toggle
    elements.strictModeToggle.addEventListener('change', (e) => {
      strictModeEnabled = e.target.checked;
      state.strictMode = strictModeEnabled;
      
      // Update visibility immediately
      elements.strictModeTimer.style.display = strictModeEnabled ? 'block' : 'none';
      
      // Save to storage
      chrome.storage.local.set({ savedStrictMode: strictModeEnabled });
      
      updateUI(); 
    });

    // Time inputs
    [elements.strictHours, elements.strictMinutes, elements.strictSeconds].forEach(input => {
      input.addEventListener('input', () => {
        updateStrictDuration();
        clearPresetActive();
      });
    });


	// --- Custom Spinner Logic ---
  document.querySelectorAll('.spinner-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent focus loss issues
      
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      const isUp = btn.classList.contains('up');
      const step = 1;
      let val = parseInt(input.value) || 0;
      const min = parseInt(input.min) || 0;
      const max = parseInt(input.max) || 59;

      if (isUp) {
        val = val >= max ? min : val + step; // Loop around if max reached
      } else {
        val = val <= min ? max : val - step; // Loop around if min reached
      }

      input.value = val;
      
      // Trigger change event so strict mode calculations update
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));
    });
  });


    // Preset buttons
    elements.presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const seconds = parseInt(btn.dataset.time);
        setStrictTime(seconds);
        
        chrome.storage.local.set({ savedStrictDuration: seconds });
        
        elements.presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Strict mode warning modal
    elements.strictWarningCancel.addEventListener('click', () => {
      hideStrictWarning();
    });

    elements.strictWarningContinue.addEventListener('click', () => {
      // Check if user wants to disable warning
      if (elements.disableStrictWarning.checked) {
        strictWarningDisabled = true;
        chrome.storage.local.set({ strictWarningDisabled: true });
      }
      hideStrictWarning();
      proceedWithStart();
    });

    // Load warning preference
    chrome.storage.local.get(['strictWarningDisabled'], (result) => {
      if (result.strictWarningDisabled) {
        strictWarningDisabled = true;
      }
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'STATE_UPDATE') {
        state = message.state;
        applyTheme();
        updateUI();
      }
    });
  }

  function setStrictTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    elements.strictHours.value = hours;
    elements.strictMinutes.value = minutes;
    elements.strictSeconds.value = seconds;
    strictDurationSeconds = totalSeconds;
  }

  function updateStrictDuration() {
    const hours = parseInt(elements.strictHours.value) || 0;
    const minutes = parseInt(elements.strictMinutes.value) || 0;
    const seconds = parseInt(elements.strictSeconds.value) || 0;
    strictDurationSeconds = (hours * 3600) + (minutes * 60) + seconds;
    
    // Save the specific duration to storage
    chrome.storage.local.set({ savedStrictDuration: strictDurationSeconds });
  }

  function clearPresetActive() {
    elements.presetBtns.forEach(b => b.classList.remove('active'));
  }

  // ============================================
  // UI UPDATE
  // ============================================
  function updateUI() {
    updateSessionSelect();
    updateTimer();
    updateControls();
    updateStats();
    updateStrictModeUI();
  }

  function updateSessionSelect() {
    const select = elements.sessionSelect;
    const currentValue = select.value;

    select.innerHTML = '<option value=""> Select Session </option>';
    
    state.sessions.forEach(session => {
      const option = document.createElement('option');
      option.value = session.id;
      option.textContent = truncateText(session.name, 19);
	  option.title = session.name;
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
    // 1. Handle Strict Mode Display
    if (state.strictMode && state.strictDuration && (state.isRunning || state.isPaused)) {
      const remainingMs = Math.max(0, (state.strictDuration * 1000) - state.elapsedTime);
      elements.timerDisplay.textContent = formatTime(remainingMs);
    } else {
      elements.timerDisplay.textContent = formatTime(state.elapsedTime);
    }

    elements.timerDisplay.classList.remove('running', 'paused');
    
    // 2. Determine Status
    let statusText = '';
    let statusClass = '';

    if (state.isRunning) {
      elements.timerDisplay.classList.add('running');
      statusClass = 'running';
      
      if (state.strictMode) {
        const remainingMs = Math.max(0, (state.strictDuration * 1000) - state.elapsedTime);
        const remainingMins = Math.ceil(remainingMs / 60000);
        statusText = remainingMins > 0 ? `${remainingMins}m remaining` : 'Almost done!';
      } else {
        statusText = 'Focusing...';
      }
    } else if (state.isPaused) {
      elements.timerDisplay.classList.add('paused');
      statusClass = 'paused';
      statusText = 'Paused';
    } else if (state.activeSession) {
      statusClass = 'ready'; 
      statusText = `Ready: ${state.activeSession.name}`;
    } else {
      statusClass = 'idle'; 
      statusText = 'Select a session to begin';
    }

    // 3. Render Safe HTML 
    const existingDot = elements.timerStatus.querySelector('.status-dot');
    const existingText = elements.timerStatus.querySelector('.status-text');

    if (statusClass && statusClass !== 'idle') {
      // We want the Dot+Text structure
      if (!existingDot) {
        // If it doesn't exist yet, create it
        elements.timerStatus.innerHTML = `
          <span class="status-dot ${statusClass}"></span>
          <span class="status-text" title="${statusText}">${statusText}</span>
        `;
      } else {
        // If it DOES exist, just update the attributes (Prevents animation reset)
        if (!existingDot.classList.contains(statusClass)) {
            existingDot.className = `status-dot ${statusClass}`;
        }
        if (existingText.textContent !== statusText) {
            existingText.textContent = statusText;
            existingText.title = statusText;
        }
      }
    } else {
      // Fallback for idle state (just text)
      elements.timerStatus.textContent = statusText;
    }
  }

  function updateControls() {
    const hasSession = !!elements.sessionSelect.value || !!state.activeSession;
    const isStrictLocked = state.strictMode && state.isRunning;
    
    elements.startBtn.disabled = !hasSession || state.isRunning;
    
    // In strict mode, pause and end are locked
    elements.pauseBtn.disabled = !state.isRunning || isStrictLocked;
    elements.pauseBtn.classList.toggle('locked', isStrictLocked);
    elements.pauseBtn.querySelector('span').textContent = state.isPaused ? 'Resume' : 'Pause';
    
    elements.endBtn.disabled = (!state.isRunning && !state.isPaused) || isStrictLocked;
    elements.endBtn.classList.toggle('locked', isStrictLocked);
    
    elements.sessionSelect.disabled = state.isRunning || state.isPaused;
    elements.addWebsiteBtn.disabled = !hasSession;
    
    // Disable strict mode controls during session
    elements.strictModeToggle.disabled = state.isRunning || state.isPaused;
    elements.strictHours.disabled = state.isRunning || state.isPaused;
    elements.strictMinutes.disabled = state.isRunning || state.isPaused;
    elements.strictSeconds.disabled = state.isRunning || state.isPaused;
    elements.presetBtns.forEach(btn => btn.disabled = state.isRunning || state.isPaused);
  }

  function updateStats() {
    // Show current session stats
    if (state.isRunning || state.isPaused) {
      const sessionMs = state.elapsedTime || 0;
      const hours = Math.floor(sessionMs / 3600000);
      const minutes = Math.floor((sessionMs % 3600000) / 60000);
      elements.totalTime.textContent = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      
      const sessionTasks = state.tasks[state.activeSession?.id] || [];
      const completedTasks = sessionTasks.filter(t => t.completed).length;
      elements.tasksDone.textContent = `${completedTasks}/${sessionTasks.length}`;
    } else {
      elements.totalTime.textContent = '0m';
      elements.tasksDone.textContent = '0';
    }
  }

  function updateStrictModeUI() {
  if (!elements.strictModeToggle) return;
  
  const strictContainer = document.querySelector('.strict-mode-container');
  
  // Disable everything during active strict mode
  if (state.isRunning && state.strictMode) {
    // Add disabled class to container (for CSS hover removal)
    if (strictContainer) {
      strictContainer.classList.add('disabled');
    }
    
    // Disable toggle
    elements.strictModeToggle.disabled = true;
    const toggleLabel = elements.strictModeToggle.parentElement;
    if (toggleLabel) {
      toggleLabel.style.opacity = '0.5';
      toggleLabel.style.cursor = 'not-allowed';
      toggleLabel.style.pointerEvents = 'none';
    }
    
    // Disable time inputs
    [elements.strictHours, elements.strictMinutes, elements.strictSeconds].forEach(input => {
      if (input) {
        input.disabled = true;
        input.style.opacity = '0.5';
        input.style.cursor = 'not-allowed';
        input.style.pointerEvents = 'none';
      }
    });
    
    // Disable preset buttons
    elements.presetBtns.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.style.pointerEvents = 'none';
    });
    
    // Disable spinner buttons
    document.querySelectorAll('.spinner-btn').forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.style.pointerEvents = 'none';
    });
    
  } else {
    // Re-enable everything
    if (strictContainer) {
      strictContainer.classList.remove('disabled');
    }
    
    elements.strictModeToggle.disabled = false;
    const toggleLabel = elements.strictModeToggle.parentElement;
    if (toggleLabel) {
      toggleLabel.style.opacity = '1';
      toggleLabel.style.cursor = 'pointer';
      toggleLabel.style.pointerEvents = 'auto';
    }
    
    [elements.strictHours, elements.strictMinutes, elements.strictSeconds].forEach(input => {
      if (input) {
        input.disabled = false;
        input.style.opacity = '1';
        input.style.cursor = 'text';
        input.style.pointerEvents = 'auto';
      }
    });
    
    elements.presetBtns.forEach(btn => {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.style.pointerEvents = 'auto';
    });
    
    document.querySelectorAll('.spinner-btn').forEach(btn => {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.style.pointerEvents = 'auto';
    });
  }
  
  // Update badge visibility
  if (elements.strictModeBadge) {
    if (state.strictMode && state.isRunning) {
      elements.strictModeBadge.style.display = 'inline-flex';
    } else {
      elements.strictModeBadge.style.display = 'none';
    }
  }
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
          // 1. Update local state immediately so the name syncs
          state.activeSession = response.session;
          
          // 2. Update visual indicators
          elements.sessionIndicator.style.background = response.session.color;
          
          // 3. Force timer text update to show "Ready: [New Name]"
          updateTimer();
        }
      });
    } else {
      elements.sessionIndicator.style.background = 'transparent';
      state.activeSession = null;
      updateTimer();
    }
    
    updateControls();
  }

  function handleStart() {
    const sessionId = elements.sessionSelect.value;
    if (!sessionId && !state.activeSession) {
      return;
    }

    updateStrictDuration();
    
    // Check for zero values in strict mode
    if (strictModeEnabled && strictDurationSeconds === 0) {
      showToast('Please set a duration for strict mode!', 'error');
      return;
    }
    
    // Show warning if strict mode is enabled and warning not disabled
    if (strictModeEnabled && !strictWarningDisabled) {
      showStrictWarning();
      return;
    }
    
    proceedWithStart();
  }

  function proceedWithStart() {
    const sessionId = elements.sessionSelect.value;
    
    const startData = {
      type: 'START_TIMER',
      strictMode: strictModeEnabled,
      strictDuration: strictModeEnabled ? strictDurationSeconds : null
    };
    
    if (sessionId && (!state.activeSession || state.activeSession.id !== sessionId)) {
      chrome.runtime.sendMessage({
        type: 'SELECT_SESSION',
        sessionId: sessionId
      }, () => {
        chrome.runtime.sendMessage(startData, (response) => { 
          if (response && response.error) {
            showToast(response.error, 'error');
          }
        });
      });
    } else {
      chrome.runtime.sendMessage(startData, (response) => { 
        if (response && response.error) {
          showToast(response.error, 'error');
        }
      });
    }
}

  function showStrictWarning() {
    elements.strictWarningModal.style.display = 'flex';
    // Reset checkbox
    elements.disableStrictWarning.checked = false;
  }

  function hideStrictWarning() {
    elements.strictWarningModal.style.display = 'none';
  }

  function handlePause() {
    if (state.strictMode && state.isRunning) {
      showToast('Cannot pause in strict mode!', 'error');
      return;
    }
    
    if (state.isPaused) {
      chrome.runtime.sendMessage({ type: 'START_TIMER' });
    } else {
      chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
    }
  }

  function handleEnd() {
    if (state.strictMode && state.isRunning) {
      const remainingMs = Math.max(0, (state.strictDuration * 1000) - state.elapsedTime);
      const remainingMins = Math.ceil(remainingMs / 60000);
      showToast(`Stay focused! ${remainingMins}m remaining`, 'error');
      return;
    }
    
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
    .replace(/\/.*$/, '')
    .toLowerCase();

  // Validate website format - must contain a TLD (.com, .org, .net, etc)
  const tldRegex = /\.[a-z]{2,}$/i; // Matches .com, .org, .co.uk, .io, etc
  if (!tldRegex.test(cleanUrl)) {
    showToast('Invalid website format. Please include a domain extension (e.g., .com, .org, .net)', 'error');
    return;
  }
  
  // Additional validation - must have at least one dot and no spaces
  if (!cleanUrl.includes('.') || cleanUrl.includes(' ')) {
    showToast('Invalid website format. Example: github.com or docs.google.com', 'error');
    return;
  }

  // Fix #10 - Show confirmation before adding
  showConfirm(
    'Add to Whitelist',
    `Allow "${cleanUrl}" during focus sessions?`,
    () => {
      chrome.runtime.sendMessage({
        type: 'ADD_WEBSITE',
        sessionId: sessionId,
        website: cleanUrl
      }, (response) => {
        if (response && response.success) {
          elements.websiteInput.value = '';
          showToast('Website added!', 'success');
        }
      });
    }
  );
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
            state.strictMode = response.state.strictMode;
            state.strictDuration = response.state.strictDuration;
            
            // Update timer display
            if (state.strictMode && state.strictDuration) {
              const remainingMs = Math.max(0, (state.strictDuration * 1000) - state.elapsedTime);
              elements.timerDisplay.textContent = formatTime(remainingMs);
            } else {
              elements.timerDisplay.textContent = formatTime(state.elapsedTime);
            }
            
            updateStats();
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
        background: var(--accent);
        color: #1a1a1e;
      }
      .confirm-btn.confirm:hover {
        background: var(--accent-hover);
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlay);

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


// Contrast Helpers
function hexToRgb(hex) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

function getLuminance(r, g, b) {
  const a = [r, g, b].map(function (v) {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrastColor(hexColor) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return '#ffffff';
  return getLuminance(rgb.r, rgb.g, rgb.b) > 0.5 ? '#0d0d0f' : '#ffffff';
}


// Cleanup timer when popup closes
window.addEventListener('beforeunload', () => {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
});


  // ============================================
  // START
  // ============================================
  init();
});
