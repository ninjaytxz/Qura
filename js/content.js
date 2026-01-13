// Qura - Content Script
// Handles floating sidebar for active sessions and YouTube Shorts blocking

// Inject Montserrat font from local files
(function injectLocalFont() {
  if (document.getElementById('qura-font-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'qura-font-styles';
  style.textContent = `
    @font-face {
      font-family: 'Montserrat';
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
      src: url('${chrome.runtime.getURL('assets/fonts/Montserrat-VariableFont_wght.ttf')}') format('truetype-variations');
    }
    
    @font-face {
      font-family: 'Montserrat';
      font-style: italic;
      font-weight: 100 900;
      font-display: swap;
      src: url('${chrome.runtime.getURL('assets/fonts/Montserrat-Italic-VariableFont_wght.ttf')}') format('truetype-variations');
    }
    
    /* Force Montserrat on sidebar */
    #qura-sidebar,
    #qura-sidebar *,
    #qura-pull-tab,
    #qura-pull-tab * {
      font-family: 'Montserrat', system-ui, -apple-system, BlinkMacSystemFont, sans-serif !important;
    }
  `;
  
  (document.head || document.documentElement).appendChild(style);
})();


(function() {
  'use strict';
  
  let state = {
    isRunning: false,
    isPaused: false,
    activeSession: null,
    elapsedTime: 0,
    tasks: {},
    settings: {}
  };
  
  let sidebarVisible = false;
  let floatingButton = null;
  let sidebar = null;
  let shortsObserver = null;
  let lastTasksJSON = null;
  
  function init() {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
      if (response && response.success) {
        state = response.state;
        updateUI();
        handleYoutubeShorts();
      }
    });
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'STATE_UPDATE') {
        state = message.state;
        updateUI();
        handleYoutubeShorts();
      }
    });
  }
  
  // YouTube Shorts Blocking
  function handleYoutubeShorts() {
    if (!window.location.hostname.includes('youtube.com')) return;
    
    if (state.settings && state.settings.blockYoutubeShorts) {
      blockYoutubeShorts();
      observeYoutubeShorts();
    } else {
      unblockYoutubeShorts();
      if (shortsObserver) {
        shortsObserver.disconnect();
        shortsObserver = null;
      }
    }
  }
  
  function blockYoutubeShorts() {
    // Redirect if on shorts page
    if (window.location.pathname.startsWith('/shorts')) {
      window.location.href = 'https://www.youtube.com';
      return;
    }
    
    // Hide shorts elements
    const style = document.getElementById('qura-shorts-blocker');
    if (!style) {
      const css = document.createElement('style');
      css.id = 'qura-shorts-blocker';
      css.textContent = `
        /* Hide Shorts shelf on home page */
        ytd-rich-shelf-renderer[is-shorts],
        ytd-reel-shelf-renderer,
        /* Hide Shorts tab */
        ytd-mini-guide-entry-renderer[aria-label="Shorts"],
        ytd-guide-entry-renderer:has(a[title="Shorts"]),
        /* Hide Shorts in sidebar */
        ytd-guide-entry-renderer[aria-label="Shorts"],
        /* Hide Shorts in search results */
        ytd-video-renderer:has(a[href*="/shorts/"]),
        /* Hide Shorts on channel pages */
        ytd-tab-renderer[page-subtype="channels"]:has([title="Shorts"]),
        yt-tab-shape[tab-title="Shorts"],
        /* Hide Shorts badge/label */
        ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"],
        /* Hide Shorts in recommendations */
        ytd-compact-video-renderer:has(a[href*="/shorts/"]),
        ytd-grid-video-renderer:has(a[href*="/shorts/"]) {
          display: none !important;
        }
      `;
      document.head.appendChild(css);
    }
  }
  
  function unblockYoutubeShorts() {
    const style = document.getElementById('qura-shorts-blocker');
    if (style) {
      style.remove();
    }
  }
  
  function observeYoutubeShorts() {
    if (shortsObserver) return;
    
    shortsObserver = new MutationObserver(() => {
      if (state.settings && state.settings.blockYoutubeShorts) {
        // Re-check for shorts page navigation (YouTube is SPA)
        if (window.location.pathname.startsWith('/shorts')) {
          window.location.href = 'https://www.youtube.com';
        }
      }
    });
    
    shortsObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  function updateUI() {
    applyTheme();
    
    // Check if we're on the options page
    const isOptionsPage = window.location.href.includes('chrome-extension://') && 
                          window.location.href.includes('options.html');
    
    if (state.isRunning && state.activeSession) {
      showFloatingButton();
      if (sidebarVisible) {
        updateSidebar();
      }
    } else {
      // Fix #4: Show pull tab on options page even without active session
      if (isOptionsPage) {
        showFloatingButton(true); // true = preview mode
      } else {
        hideFloatingButton();
      }
      hideSidebar();
    }
  }

  function applyTheme() {
  if (state.settings && state.settings.customTheme) {
    const theme = state.settings.customTheme;
    const root = document.documentElement;

    // Smart Contrast
    const textOnAccent = getContrastColor(theme.accent);
    
    // Note: Content script variables start with --qura-
    root.style.setProperty('--qura-bg-dark', theme.bgDark);
    root.style.setProperty('--qura-bg-card', theme.bgCard);
    root.style.setProperty('--qura-bg-elevated', theme.bgElevated);
    root.style.setProperty('--qura-bg-input', theme.bgInput);
    root.style.setProperty('--qura-text-primary', theme.textPrimary);
    root.style.setProperty('--qura-text-secondary', theme.textSecondary);
    root.style.setProperty('--qura-text-muted', theme.textMuted);
    root.style.setProperty('--qura-accent', theme.accent);
    root.style.setProperty('--qura-accent-hover', theme.accentHover);
    
    // New Smart Variable
    root.style.setProperty('--qura-text-on-accent', textOnAccent);
  }
}
  
  function showFloatingButton(previewMode = false) {
    if (floatingButton) {
      // Update color if needed
      if (state.activeSession?.color && !previewMode) {
        floatingButton.style.setProperty('--tab-color', state.activeSession.color);
      }
      return;
    }
    
    floatingButton = document.createElement('div');
    floatingButton.id = 'qura-pull-tab';
    floatingButton.className = previewMode ? 'preview-mode' : '';
    floatingButton.innerHTML = `
      <span class="pull-tab-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </span>
    `;
    
    floatingButton.addEventListener('click', () => {
      if (previewMode) {
        // Show a tooltip or message that session needs to be started
        showPreviewTooltip();
      } else {
        toggleSidebar();
      }
    });
    document.body.appendChild(floatingButton);
    
    if (state.activeSession?.color && !previewMode) {
      floatingButton.style.setProperty('--tab-color', state.activeSession.color);
    }
  }
  
  function showPreviewTooltip() {
    // Remove existing tooltip if any
    const existingTooltip = document.querySelector('.qura-preview-tooltip');
    if (existingTooltip) existingTooltip.remove();
    
    const tooltip = document.createElement('div');
    tooltip.className = 'qura-preview-tooltip';
    tooltip.innerHTML = 'Start a session to use the task sidebar';
    document.body.appendChild(tooltip);
    
    setTimeout(() => tooltip.remove(), 2000);
  }
  
  function hideFloatingButton() {
    if (floatingButton) {
      floatingButton.remove();
      floatingButton = null;
    }
  }
  
  function toggleSidebar() {
    if (sidebarVisible) {
      hideSidebar();
    } else {
      showSidebar();
    }
  }
  
  function showSidebar() {
    if (sidebar) return;
    
    sidebarVisible = true;
    
    sidebar = document.createElement('div');
	sidebar.id = 'qura-sidebar';
	sidebar.style.fontFamily = "'Montserrat', system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
	sidebar.innerHTML = createSidebarHTML();
	document.body.appendChild(sidebar);
    
    requestAnimationFrame(() => {
      sidebar.classList.add('visible');
    });
    
    attachSidebarEvents();
    startSidebarTimer();
  }
  
  function hideSidebar() {
	  
	  cleanup();
	  
    if (sidebar) {
      sidebar.classList.remove('visible');
      setTimeout(() => {
        if (sidebar) {
          sidebar.remove();
          sidebar = null;
        }
      }, 300);
    }
    sidebarVisible = false;
  }
  
  function createSidebarHTML() {
  const sessionName = state.activeSession?.name || 'Session';
  const sessionColor = state.activeSession?.color || '#C4A7E7';
  const tasks = state.tasks[state.activeSession?.id] || [];
  
  // Calculate initial timer display (prevent flicker)
  const initialTimerDisplay = state.strictMode && state.strictDuration
    ? formatTime(Math.max(0, (state.strictDuration * 1000) - state.elapsedTime))
    : formatTime(state.elapsedTime);
  
  return `
    <div class="qura-sidebar-header" style="border-left: 4px solid ${sessionColor}">
  <div class="qura-session-info">
    <span class="qura-session-name">${escapeHtml(sessionName)}</span>
    <span class="qura-timer" id="qura-sidebar-timer">${initialTimerDisplay}</span>
    ${state.strictMode ? `
      <div class="qura-strict-badge">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <span>Strict Mode</span>
      </div>
    ` : ''}
  </div>
  <button class="qura-close-btn" id="qura-close-sidebar">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  </button>
</div>
    
    <div class="qura-sidebar-content">
      <div class="qura-tasks-header">
        <h3>Tasks</h3>
        <span class="qura-task-count">${tasks.filter(t => t.completed).length}/${tasks.length}</span>
      </div>
      
      <div class="qura-add-task">
        <input type="text" id="qura-new-task" placeholder="Add a new task..." />
        <button id="qura-add-task-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
      
      <ul class="qura-task-list" id="qura-task-list">
        ${tasks.map(task => createTaskHTML(task)).join('')}
      </ul>
      
      ${tasks.length === 0 ? '<p class="qura-no-tasks">No tasks yet. Add one above!</p>' : ''}
    </div>
    
    <div class="qura-sidebar-footer">
      <div class="qura-status ${state.isPaused ? 'paused' : 'active'}">
        <span class="qura-status-dot"></span>
        <span>${state.isPaused ? 'Paused' : 'Focusing'}</span>
      </div>
    </div>
  `;
}
  
  function createTaskHTML(task) {
    return `
      <li class="qura-task-item ${task.completed ? 'completed' : ''} ${task.pinned ? 'pinned' : ''}" data-task-id="${task.id}">
        <label class="qura-checkbox">
          <input type="checkbox" ${task.completed ? 'checked' : ''} data-action="toggle" />
          <span class="qura-checkmark"></span>
        </label>
        <span class="qura-task-text">${escapeHtml(task.text)}</span>
        <div class="qura-task-actions">
          <button class="qura-pin-btn ${task.pinned ? 'active' : ''}" data-action="pin" title="${task.pinned ? 'Unpin' : 'Pin (keeps after session)'}">
            <svg width="14" height="14" viewBox="0 0 640 640" fill="${task.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="20">
				<path d="M160 96C160 78.3 174.3 64 192 64L448 64C465.7 64 480 78.3 480 96C480 113.7 465.7 128 448 128L418.5 128L428.8 262.1C465.9 283.3 494.6 318.5 507 361.8L510.8 375.2C513.6 384.9 511.6 395.2 505.6 403.3C499.6 411.4 490 416 480 416L160 416C150 416 140.5 411.3 134.5 403.3C128.5 395.3 126.5 384.9 129.3 375.2L133 361.8C145.4 318.5 174 283.3 211.2 262.1L221.5 128L192 128C174.3 128 160 113.7 160 96zM288 464L352 464L352 576C352 593.7 337.7 608 320 608C302.3 608 288 593.7 288 576L288 464z"/>
			</svg>
          </button>
          <button class="qura-edit-btn" data-action="edit" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="qura-delete-btn" data-action="delete" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="m19,6-.867,12.142A2,2,0,0,1,16.138,20H7.862a2,2,0,0,1-1.995-1.858L5,6m5,0V4a1,1,0,0,1,1-1h2a1,1,0,0,1,1,1v2"/>
            </svg>
          </button>
        </div>
      </li>
    `;
  }
  
  function updateSidebar() {
    if (!sidebar) return;
    
    const timer = sidebar.querySelector('#qura-sidebar-timer');
    if (timer) {
      // In strict mode, show countdown instead of elapsed time
      if (state.strictMode && state.strictDuration) {
        const remainingMs = Math.max(0, (state.strictDuration * 1000) - state.elapsedTime);
        timer.textContent = formatTime(remainingMs);
      } else {
        timer.textContent = formatTime(state.elapsedTime);
      }
    }
    
    // Fix #6 - Don't update task list if user is editing a task
    const isEditing = sidebar.querySelector('.qura-edit-input');
    if (isEditing) return; // Skip task list update while editing
    
    const taskList = sidebar.querySelector('#qura-task-list');
    const tasks = state.tasks[state.activeSession?.id] || [];
    
    if (taskList) {
  // Only rebuild if tasks actually changed
  const currentTasksJSON = JSON.stringify(tasks);
  if (currentTasksJSON !== lastTasksJSON) {
    taskList.innerHTML = tasks.map(task => createTaskHTML(task)).join('');
    attachTaskEvents();
    lastTasksJSON = currentTasksJSON;
  }
}
    
    const taskCount = sidebar.querySelector('.qura-task-count');
    if (taskCount) {
      taskCount.textContent = `${tasks.filter(t => t.completed).length}/${tasks.length}`;
    }
    
    const noTasks = sidebar.querySelector('.qura-no-tasks');
    if (noTasks) {
      noTasks.style.display = tasks.length === 0 ? 'block' : 'none';
    }
    
    const status = sidebar.querySelector('.qura-status');
    if (status) {
      status.className = `qura-status ${state.isPaused ? 'paused' : 'active'}`;
      status.querySelector('span:last-child').textContent = state.isPaused ? 'Paused' : 'Focusing';
    }
  }
  
  function attachSidebarEvents() {
    const closeBtn = sidebar.querySelector('#qura-close-sidebar');
    if (closeBtn) {
      closeBtn.addEventListener('click', hideSidebar);
    }
    
    const addTaskBtn = sidebar.querySelector('#qura-add-task-btn');
    const newTaskInput = sidebar.querySelector('#qura-new-task');
    
    if (addTaskBtn && newTaskInput) {
      addTaskBtn.addEventListener('click', () => addTask(newTaskInput));
      newTaskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask(newTaskInput);
      });
    }
    
    attachTaskEvents();
  }
  
  function attachTaskEvents() {
    if (!sidebar) return;
    
    const taskItems = sidebar.querySelectorAll('.qura-task-item');
    
    taskItems.forEach(item => {
      const taskId = item.dataset.taskId;
      
      const checkbox = item.querySelector('input[data-action="toggle"]');
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          toggleTask(taskId, checkbox.checked);
        });
      }
      
      const editBtn = item.querySelector('[data-action="edit"]');
      if (editBtn) {
        editBtn.addEventListener('click', () => editTask(taskId, item));
      }
      
      const deleteBtn = item.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => deleteTask(taskId));
      }
      
      const pinBtn = item.querySelector('[data-action="pin"]');
      if (pinBtn) {
        pinBtn.addEventListener('click', () => togglePinTask(taskId));
      }
    });
  }
  
  function togglePinTask(taskId) {
    if (!state.activeSession) return;
    
    const tasks = state.tasks[state.activeSession.id] || [];
    const task = tasks.find(t => t.id === taskId);
    
    chrome.runtime.sendMessage({
      type: 'UPDATE_TASK',
      sessionId: state.activeSession.id,
      taskId: taskId,
      updates: { pinned: !task?.pinned }
    });
  }
  
  function addTask(input) {
    const text = input.value.trim();
    if (!text || !state.activeSession) return;
    
    chrome.runtime.sendMessage({
      type: 'ADD_TASK',
      sessionId: state.activeSession.id,
      text: text
    }, (response) => {
      if (response && response.success) {
        input.value = '';
      }
    });
  }
  
  function toggleTask(taskId, completed) {
    if (!state.activeSession) return;
    
    chrome.runtime.sendMessage({
      type: 'UPDATE_TASK',
      sessionId: state.activeSession.id,
      taskId: taskId,
      updates: { completed }
    });
  }
  
  function editTask(taskId, item) {
    const textSpan = item.querySelector('.qura-task-text');
    const currentText = textSpan.textContent;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'qura-edit-input';
    
    textSpan.replaceWith(input);
    input.focus();
    input.select();
    
    const saveEdit = () => {
      const newText = input.value.trim();
      if (newText && newText !== currentText) {
        chrome.runtime.sendMessage({
          type: 'UPDATE_TASK',
          sessionId: state.activeSession.id,
          taskId: taskId,
          updates: { text: newText }
        });
      } else {
        const newSpan = document.createElement('span');
        newSpan.className = 'qura-task-text';
        newSpan.textContent = currentText;
        input.replaceWith(newSpan);
      }
    };
    
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') input.blur();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.value = currentText;
        input.blur();
      }
    });
  }
  
  function deleteTask(taskId) {
    if (!state.activeSession) return;
    
    chrome.runtime.sendMessage({
      type: 'DELETE_TASK',
      sessionId: state.activeSession.id,
      taskId: taskId
    });
  }
  
  let timerInterval = null;
  
  function startSidebarTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
      if (sidebar && state.isRunning && !state.isPaused) {
        chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
          if (response && response.success) {
            const timer = sidebar.querySelector('#qura-sidebar-timer');
            if (timer) {
			  // Match the logic in updateSidebar() - respect strict mode
			  if (response.state.strictMode && response.state.strictDuration) {
				const remainingMs = Math.max(0, (response.state.strictDuration * 1000) - response.state.elapsedTime);
				timer.textContent = formatTime(remainingMs);
			  } else {
				timer.textContent = formatTime(response.state.elapsedTime);
			  }
			}

          }
        });
      }
    }, 1000);
  }
  
  
  
  // Cleanup function to prevent memory leaks
function cleanup() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup);
  
  
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
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function adjustColor(color, amount) {
    const clamp = (num) => Math.min(255, Math.max(0, num));
    let hex = color.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const r = clamp(parseInt(hex.substr(0, 2), 16) + amount);
    const g = clamp(parseInt(hex.substr(2, 2), 16) + amount);
    const b = clamp(parseInt(hex.substr(4, 2), 16) + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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
 
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();