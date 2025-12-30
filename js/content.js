// Qura - Content Script
// Handles floating sidebar for active sessions and YouTube Shorts blocking

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
    if (state.isRunning && state.activeSession) {
      showFloatingButton();
      if (sidebarVisible) {
        updateSidebar();
      }
    } else {
      hideFloatingButton();
      hideSidebar();
    }
  }

  function applyTheme() {
    if (state.settings && state.settings.customTheme) {
      const theme = state.settings.customTheme;
      const root = document.documentElement;
      root.style.setProperty('--qura-bg-dark', theme.bgDark);
      root.style.setProperty('--qura-bg-card', theme.bgCard);
      root.style.setProperty('--qura-bg-elevated', theme.bgElevated);
      root.style.setProperty('--qura-bg-input', theme.bgInput);
      root.style.setProperty('--qura-text-primary', theme.textPrimary);
      root.style.setProperty('--qura-text-secondary', theme.textSecondary);
      root.style.setProperty('--qura-text-muted', theme.textMuted);
      root.style.setProperty('--qura-accent', theme.accent);
      root.style.setProperty('--qura-accent-hover', theme.accentHover);
    }
  }
  
  function showFloatingButton() {
    if (floatingButton) {
      // Update color if needed
      if (state.activeSession?.color) {
        floatingButton.style.background = `linear-gradient(135deg, ${state.activeSession.color}, ${adjustColor(state.activeSession.color, -20)})`;
      }
      return;
    }
    
    floatingButton = document.createElement('div');
    floatingButton.id = 'qura-floating-btn';
    floatingButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12,6 12,12 16,14"/>
      </svg>
    `;
    
    floatingButton.addEventListener('click', toggleSidebar);
    document.body.appendChild(floatingButton);
    
    if (state.activeSession?.color) {
      floatingButton.style.background = `linear-gradient(135deg, ${state.activeSession.color}, ${adjustColor(state.activeSession.color, -20)})`;
    }
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
    sidebar.innerHTML = createSidebarHTML();
    document.body.appendChild(sidebar);
    
    requestAnimationFrame(() => {
      sidebar.classList.add('visible');
    });
    
    attachSidebarEvents();
    startSidebarTimer();
  }
  
  function hideSidebar() {
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
    
    return `
      <div class="qura-sidebar-header" style="border-left: 4px solid ${sessionColor}">
        <div class="qura-session-info">
          <span class="qura-session-name">${escapeHtml(sessionName)}</span>
          <span class="qura-timer" id="qura-sidebar-timer">${formatTime(state.elapsedTime)}</span>
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
      <li class="qura-task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
        <label class="qura-checkbox">
          <input type="checkbox" ${task.completed ? 'checked' : ''} data-action="toggle" />
          <span class="qura-checkmark"></span>
        </label>
        <span class="qura-task-text">${escapeHtml(task.text)}</span>
        <div class="qura-task-actions">
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
      timer.textContent = formatTime(state.elapsedTime);
    }
    
    const taskList = sidebar.querySelector('#qura-task-list');
    const tasks = state.tasks[state.activeSession?.id] || [];
    
    if (taskList) {
      taskList.innerHTML = tasks.map(task => createTaskHTML(task)).join('');
      attachTaskEvents();
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
              timer.textContent = formatTime(response.state.elapsedTime);
            }
          }
        });
      }
    }, 1000);
  }
  
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
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
