// Qura - Options Page Script
// Handles sessions management, statistics display, settings, and theme customization

// Truncate long text with dots
function truncateText(text, maxLength = 16) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

document.addEventListener('DOMContentLoaded', () => {
  // Theme presets
  const themePresets = {
    purple: {
      bgDark: '#0d0d0f', bgCard: '#16161a', bgElevated: '#1e1e24', bgInput: '#252530',
      textPrimary: '#f5f5f7', textSecondary: '#9898a6', textMuted: '#6b6b78',
      accent: '#C4A7E7', accentHover: '#B394D9'
    },
    blue: {
      bgDark: '#0a0e14', bgCard: '#111820', bgElevated: '#1a2332', bgInput: '#243044',
      textPrimary: '#f5f5f7', textSecondary: '#8b9caa', textMuted: '#5c6d7e',
      accent: '#89B4FA', accentHover: '#6A9FE8'
    },
    green: {
      bgDark: '#0a0f0d', bgCard: '#111916', bgElevated: '#1a2420', bgInput: '#243530',
      textPrimary: '#f5f5f7', textSecondary: '#8ba69b', textMuted: '#5c7e6d',
      accent: '#A6E3A1', accentHover: '#8DD488'
    },
    orange: {
      bgDark: '#0f0d0a', bgCard: '#1a1611', bgElevated: '#24201a', bgInput: '#353024',
      textPrimary: '#f5f5f7', textSecondary: '#a69b8b', textMuted: '#7e6d5c',
      accent: '#FAB387', accentHover: '#E89F6E'
    },
    pink: {
      bgDark: '#0f0a0d', bgCard: '#1a1116', bgElevated: '#241a20', bgInput: '#352430',
      textPrimary: '#f5f5f7', textSecondary: '#a68b9b', textMuted: '#7e5c6d',
      accent: '#F38BA8', accentHover: '#E0728F'
    }
  };

  let state = {
    sessions: [],
    activeSession: null,
    isRunning: false,
    statistics: { totalTime: 0, sessionTimes: {}, tasksCompleted: 0, sessionsCompleted: 0, dailyStats: {} },
    settings: { theme: 'dark', accentColor: '#C4A7E7', blockedMessage: '', customTheme: themePresets.purple },
    tasks: {}
  };

  let editingSession = null;
  let tempWebsites = [];
  let selectedColor = '#C4A7E7';
  let confirmCallback = null;
  let sortOrder = 'desc'; // 'desc' or 'asc'

  const elements = {
    navTabs: document.querySelectorAll('.nav-tab'),
    sections: document.querySelectorAll('.content-section'),
    sessionsGrid: document.getElementById('sessions-grid'),
    sessionsEmpty: document.getElementById('sessions-empty'),
    createSessionBtn: document.getElementById('create-session-btn'),
    statTotalTime: document.getElementById('stat-total-time'),
    statTasksCompleted: document.getElementById('stat-tasks-completed'),
    statSessionsCompleted: document.getElementById('stat-sessions-completed'),
    sessionBreakdown: document.getElementById('session-breakdown'),
    barChart: document.getElementById('bar-chart'),
    chartArea: document.getElementById('chart-area'),
    accentColor: document.getElementById('accent-color'),
    accentColorValue: document.getElementById('accent-color-value'),
    bgColor: document.getElementById('bg-color'),
    bgColorValue: document.getElementById('bg-color-value'),
    cardColor: document.getElementById('card-color'),
    cardColorValue: document.getElementById('card-color-value'),
    textColor: document.getElementById('text-color'),
    textColorValue: document.getElementById('text-color-value'),
    presetBtns: document.querySelectorAll('.preset-btn'),
    saveThemeBtn: document.getElementById('save-theme-btn'),
    blockedMessage: document.getElementById('blocked-message'),
    saveMessageBtn: document.getElementById('save-message-btn'),
    youtubeShortsToggle: document.getElementById('youtube-shorts-toggle'),
    exportBtn: document.getElementById('export-btn'),
    importInput: document.getElementById('import-input'),
    resetBtn: document.getElementById('reset-btn'),
    sessionModal: document.getElementById('session-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalClose: document.getElementById('modal-close'),
    modalCancel: document.getElementById('modal-cancel'),
    modalSave: document.getElementById('modal-save'),
    sessionId: document.getElementById('session-id'),
    sessionName: document.getElementById('session-name'),
    colorPicker: document.getElementById('color-picker'),
    colorOptions: document.querySelectorAll('.color-option:not(.custom-color-option)'),
    customSessionColor: document.getElementById('custom-session-color'),
    websiteAddInput: document.getElementById('website-add-input'),
    addWebsiteModalBtn: document.getElementById('add-website-modal-btn'),
    websitesList: document.getElementById('websites-list'),
    confirmModal: document.getElementById('confirm-modal'),
    confirmTitle: document.getElementById('confirm-title'),
    confirmMessage: document.getElementById('confirm-message'),
    confirmClose: document.getElementById('confirm-close'),
    confirmCancel: document.getElementById('confirm-cancel'),
    confirmAction: document.getElementById('confirm-action'),
    toastContainer: document.getElementById('toast-container'),
    howItWorksBtn: document.getElementById('how-it-works-btn'),
    howItWorksModal: document.getElementById('how-it-works-modal'),
    howItWorksClose: document.getElementById('how-it-works-close'),
    howItWorksGotIt: document.getElementById('how-it-works-got-it'),
    kofiButton: document.getElementById('kofi-button'),
    taskHistoryList: document.getElementById('task-history-list'),
    taskHistorySearch: document.getElementById('task-history-search'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),
    taskSortBy: document.getElementById('task-sort-by'),
    sortOrderBtn: document.getElementById('sort-order-btn'),
    taskFilterSession: document.getElementById('task-filter-session'),
    dateRangeCheckbox: document.getElementById('date-range-checkbox'),
    enableDateRange: document.getElementById('enable-date-range'),
    dateRangeFilter: document.getElementById('date-range-filter'),
    dateFrom: document.getElementById('date-from'),
    dateTo: document.getElementById('date-to')
  };

  function init() {
    loadState();
    attachEventListeners();
  }

  function loadState() {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
      if (response && response.success) {
        state = response.state;
        applyTheme();
        updateThemeInputs();
        renderAll();
      }
    });
  }

  function applyTheme() {
    if (state.settings && state.settings.customTheme) {
      const theme = state.settings.customTheme;
      const root = document.documentElement;

      // Calculate Smart Contrast Colors
      const textOnAccent = getContrastColor(theme.accent);
      const textOnBg = getContrastColor(theme.bgCard);

      // Apply Standard Variables
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

      // Apply Smart Contrast Variables
      // --text-on-accent: Used for buttons like "New Session"
      root.style.setProperty('--text-on-accent', textOnAccent);
      
      // --smart-text: Overrides primary text if contrast is too low
      // We check if the user's chosen text color matches the contrast requirement. 
      // If not, we force the high-contrast version.
      const userTextColorLum = getLuminance(...Object.values(hexToRgb(theme.textPrimary)));
      const bgLum = getLuminance(...Object.values(hexToRgb(theme.bgCard)));
      
      // If contrast is bad (difference < 0.3), force high contrast
      if (Math.abs(userTextColorLum - bgLum) < 0.3) {
         root.style.setProperty('--text-primary', textOnBg);
      }
    }
  }

  function updateThemeInputs() {
    if (state.settings && state.settings.customTheme) {
      const theme = state.settings.customTheme;
      elements.accentColor.value = theme.accent;
      elements.accentColorValue.textContent = theme.accent;
      elements.bgColor.value = theme.bgDark;
      elements.bgColorValue.textContent = theme.bgDark;
      elements.cardColor.value = theme.bgCard;
      elements.cardColorValue.textContent = theme.bgCard;
      elements.textColor.value = theme.textPrimary;
      elements.textColorValue.textContent = theme.textPrimary;
    }
    if (state.settings && state.settings.blockedMessage) {
      elements.blockedMessage.value = state.settings.blockedMessage;
    }
    if (state.settings && elements.youtubeShortsToggle) {
      elements.youtubeShortsToggle.checked = state.settings.blockYoutubeShorts || false;
    }
    // Update Ko-fi button color
    updateKofiButtonColor();
  }

  function updateKofiButtonColor() {
    if (elements.kofiButton && state.settings && state.settings.customTheme) {
      const accent = state.settings.customTheme.accent;
      elements.kofiButton.style.background = accent;
      elements.kofiButton.style.boxShadow = `0 4px 20px ${accent}4D`;
    }
  }

  function attachEventListeners() {
    elements.navTabs.forEach(tab => {
      tab.addEventListener('click', () => switchSection(tab.dataset.section));
    });

    elements.createSessionBtn.addEventListener('click', () => openModal());

    elements.modalClose.addEventListener('click', closeModal);
    elements.modalCancel.addEventListener('click', closeModal);
    elements.modalSave.addEventListener('click', saveSession);
    elements.sessionModal.addEventListener('click', (e) => {
      if (e.target === elements.sessionModal) closeModal();
    });

    elements.colorOptions.forEach(option => {
      option.addEventListener('click', () => selectColor(option.dataset.color));
    });

    // Custom color picker
    elements.customSessionColor.addEventListener('input', (e) => {
      selectColor(e.target.value);
      e.target.parentElement.style.background = e.target.value;
    });

    elements.addWebsiteModalBtn.addEventListener('click', addWebsiteToTemp);
    elements.websiteAddInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addWebsiteToTemp();
    });

    // Theme inputs
    elements.accentColor.addEventListener('input', (e) => {
      elements.accentColorValue.textContent = e.target.value;
    });
    elements.bgColor.addEventListener('input', (e) => {
      elements.bgColorValue.textContent = e.target.value;
    });
    elements.cardColor.addEventListener('input', (e) => {
      elements.cardColorValue.textContent = e.target.value;
    });
    elements.textColor.addEventListener('input', (e) => {
      elements.textColorValue.textContent = e.target.value;
    });

    elements.presetBtns.forEach(btn => {
      btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
    });

    elements.saveThemeBtn.addEventListener('click', saveTheme);
    elements.saveMessageBtn.addEventListener('click', saveBlockedMessage);
    elements.exportBtn.addEventListener('click', exportData);
    elements.importInput.addEventListener('change', importData);
    elements.resetBtn.addEventListener('click', () => {
      showConfirm('Reset All Data', 'Are you sure you want to reset all data? This cannot be undone.', resetData);
    });

    // YouTube Shorts toggle
    if (elements.youtubeShortsToggle) {
      elements.youtubeShortsToggle.addEventListener('change', (e) => {
        chrome.runtime.sendMessage({
          type: 'UPDATE_YOUTUBE_SHORTS',
          enabled: e.target.checked
        }, (response) => {
          if (response && response.success) {
            showToast(e.target.checked ? 'YouTube Shorts blocking enabled' : 'YouTube Shorts blocking disabled', 'success');
          }
        });
      });
    }

    // How it works modal
    if (elements.howItWorksBtn) {
      elements.howItWorksBtn.addEventListener('click', () => {
        elements.howItWorksModal.classList.add('active');
      });
    }
    if (elements.howItWorksClose) {
      elements.howItWorksClose.addEventListener('click', () => {
        elements.howItWorksModal.classList.remove('active');
      });
    }
    if (elements.howItWorksGotIt) {
      elements.howItWorksGotIt.addEventListener('click', () => {
        elements.howItWorksModal.classList.remove('active');
      });
    }
    if (elements.howItWorksModal) {
      elements.howItWorksModal.addEventListener('click', (e) => {
        if (e.target === elements.howItWorksModal) {
          elements.howItWorksModal.classList.remove('active');
        }
      });
    }

    // Confirm modal
    elements.confirmClose.addEventListener('click', closeConfirmModal);
    elements.confirmCancel.addEventListener('click', closeConfirmModal);
    elements.confirmAction.addEventListener('click', () => {
      if (confirmCallback) confirmCallback();
      closeConfirmModal();
    });
    elements.confirmModal.addEventListener('click', (e) => {
      if (e.target === elements.confirmModal) closeConfirmModal();
    });

    // Task history search
    if (elements.taskHistorySearch) {
      elements.taskHistorySearch.addEventListener('input', (e) => {
        renderTaskHistory(e.target.value);
      });
    }

    // Task sorting
    if (elements.taskSortBy) {
      elements.taskSortBy.addEventListener('change', (e) => {
        const sortBy = e.target.value;
        
        // Clear/disable previous method filters
        if (sortBy === 'session') {
          elements.taskFilterSession.style.display = 'block';
          elements.dateRangeCheckbox.style.display = 'none';
          elements.dateRangeFilter.style.display = 'none';
          if (elements.enableDateRange) elements.enableDateRange.checked = false;
          populateSessionFilter();
        } else if (sortBy === 'date') {
          elements.taskFilterSession.style.display = 'none';
          elements.dateRangeCheckbox.style.display = 'flex';
          // Only show date range if checkbox is checked
          if (elements.enableDateRange && elements.enableDateRange.checked) {
            elements.dateRangeFilter.style.display = 'flex';
          }
        } else if (sortBy === 'name') {
          elements.taskFilterSession.style.display = 'none';
          elements.dateRangeCheckbox.style.display = 'none';
          elements.dateRangeFilter.style.display = 'none';
          if (elements.enableDateRange) elements.enableDateRange.checked = false;
        }
        
        renderTaskHistory();
      });
    }

    // Sort order toggle button
    if (elements.sortOrderBtn) {
      elements.sortOrderBtn.addEventListener('click', () => {
        sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
        updateSortOrderButton();
        renderTaskHistory();
      });
    }

    // Date range checkbox
    if (elements.enableDateRange) {
      elements.enableDateRange.addEventListener('change', (e) => {
        if (e.target.checked) {
          elements.dateRangeFilter.style.display = 'flex';
        } else {
          elements.dateRangeFilter.style.display = 'none';
          // Clear date inputs
          if (elements.dateFrom) elements.dateFrom.value = '';
          if (elements.dateTo) elements.dateTo.value = '';
        }
        renderTaskHistory();
      });
    }

    // Session filter
    if (elements.taskFilterSession) {
      elements.taskFilterSession.addEventListener('change', () => {
        renderTaskHistory();
      });
    }

    // Date range filters
    if (elements.dateFrom) {
      elements.dateFrom.addEventListener('change', () => {
        renderTaskHistory();
      });
    }
    if (elements.dateTo) {
      elements.dateTo.addEventListener('change', () => {
        renderTaskHistory();
      });
    }

    // Clear history button
    if (elements.clearHistoryBtn) {
      elements.clearHistoryBtn.addEventListener('click', () => {
        showConfirm('Clear Task History', 'Are you sure you want to clear all task history? This cannot be undone.', clearTaskHistory);
      });
    }

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'STATE_UPDATE') {
        state = message.state;
        applyTheme();
        renderAll();
      }
    });
  }

  function switchSection(sectionName) {
    elements.navTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.section === sectionName);
    });
    elements.sections.forEach(section => {
      section.classList.toggle('active', section.id === `${sectionName}-section`);
    });
    if (sectionName === 'statistics') {
      renderStatistics();
    }
    if (sectionName === 'tasks') {
      updateSortOrderButton();
      renderTaskHistory();
    }
  }

  function renderAll() {
    renderSessions();
    // Only render statistics if the section is visible
    const statsSection = document.getElementById('statistics-section');
    if (statsSection && statsSection.classList.contains('active')) {
      renderStatistics();
    }
    // Render tasks if visible
    const tasksSection = document.getElementById('tasks-section');
    if (tasksSection && tasksSection.classList.contains('active')) {
      updateSortOrderButton();
      renderTaskHistory();
    }
  }

  function renderSessions() {
    if (state.sessions.length === 0) {
      elements.sessionsGrid.innerHTML = '';
      elements.sessionsEmpty.style.display = 'block';
      return;
    }
    elements.sessionsEmpty.style.display = 'none';
    
    elements.sessionsGrid.innerHTML = state.sessions.map(session => {
      const totalTime = state.statistics.sessionTimes[session.id] || 0;
      const tasks = state.tasks[session.id] || [];
      const completedTasks = tasks.filter(t => t.completed).length;
      const websitesToShow = session.websites.slice(0, 3);
      const moreCount = session.websites.length - 3;

      return `
       <div class="session-card ${state.activeSession?.id === session.id && state.isRunning ? 'active-session' : ''}" style="--session-color: ${session.color}">
          ${state.activeSession?.id === session.id && state.isRunning ? '<div class="active-badge"><span class="active-dot"></span>ACTIVE</div>' : ''}
          <div class="session-card-header">
            <span class="session-name" title="${escapeHtml(session.name)}">${truncateText(escapeHtml(session.name), 16)}</span>
            <div class="session-actions">
              <button class="session-action-btn duplicate" data-id="${session.id}" title="Duplicate">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
              <button class="session-action-btn edit" data-id="${session.id}" title="Edit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="session-action-btn delete" data-id="${session.id}" title="Delete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="m19,6-.867,12.142A2,2,0,0,1,16.138,20H7.862a2,2,0,0,1-1.995-1.858L5,6m5,0V4a1,1,0,0,1,1-1h2a1,1,0,0,1,1,1v2"/>
                </svg>
              </button>
            </div>
          </div>
		  
		  <div class="session-stats">
            <div class="session-stat">
              <svg class="session-stat-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
              <span class="session-stat-value">${formatTimeShort(totalTime)}</span>
              <span class="session-stat-label">Total Time</span>
            </div>
            <div class="session-stat">
              <svg class="session-stat-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              <span class="session-stat-value">${completedTasks}/${tasks.length}</span>
              <span class="session-stat-label">Tasks Done</span>
            </div>
          </div>
		  
          <div class="session-websites">
            ${websitesToShow.map(w => `<span class="website-tag">${escapeHtml(w)}</span>`).join('')}
            ${moreCount > 0 ? `<span class="website-tag website-tag-more">+${moreCount} more</span>` : ''}
            ${session.websites.length === 0 ? '<span class="website-tag">No websites yet</span>' : ''}
          </div>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.session-action-btn.edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const session = state.sessions.find(s => s.id === btn.dataset.id);
        if (session) openModal(session);
      });
    });

    document.querySelectorAll('.session-action-btn.delete').forEach(btn => {
      btn.addEventListener('click', () => {
        showConfirm('Delete Session', 'Are you sure you want to delete this session?', () => deleteSession(btn.dataset.id));
      });
    });

    document.querySelectorAll('.session-action-btn.duplicate').forEach(btn => {
      btn.addEventListener('click', () => {
        chrome.runtime.sendMessage({
          type: 'DUPLICATE_SESSION',
          sessionId: btn.dataset.id
        }, (response) => {
          if (response && response.success) {
            showToast('Session duplicated', 'success');
            loadState();
          }
        });
      });
    });
  }


  function renderStatistics() {
    const totalTime = state.statistics.totalTime || 0;
    const hours = Math.floor(totalTime / 3600000);
    const minutes = Math.floor((totalTime % 3600000) / 60000);
    elements.statTotalTime.textContent = `${hours}h ${minutes}m`;
    elements.statTasksCompleted.textContent = state.statistics.tasksCompleted || 0;
    elements.statSessionsCompleted.textContent = state.statistics.sessionsCompleted || 0;
    renderSessionBreakdown();
    renderChart();
  }

  function renderSessionBreakdown() {
    const sessionTimes = state.statistics.sessionTimes || {};
    const maxTime = Math.max(...Object.values(sessionTimes), 1);

    if (state.sessions.length === 0) {
      elements.sessionBreakdown.innerHTML = '<div class="empty-state" style="padding: 32px;"><p>No session data yet</p></div>';
      return;
    }

    elements.sessionBreakdown.innerHTML = state.sessions.map(session => {
      const time = sessionTimes[session.id] || 0;
      const percentage = (time / maxTime) * 100;
      return `
        <div class="breakdown-item">
          <div class="breakdown-color" style="background: ${session.color}"></div>
          <div class="breakdown-info">
            <div class="breakdown-name">${truncateText(escapeHtml(session.name), 16)}</div>
            <div class="breakdown-bar">
              <div class="breakdown-bar-fill" style="width: ${percentage}%; background: ${session.color}"></div>
            </div>
          </div>
          <div class="breakdown-time">${formatTimeShort(time)}</div>
        </div>
      `;
    }).join('');
  }

  function populateSessionFilter() {
    if (!elements.taskFilterSession) return;
    
    const taskHistory = state.taskHistory || [];
    const uniqueSessions = [...new Set(taskHistory.map(task => task.sessionName).filter(Boolean))];
    
    elements.taskFilterSession.innerHTML = '<option value="all">All Sessions</option>' +
      uniqueSessions.map(sessionName => 
        `<option value="${escapeHtml(sessionName)}" title="${escapeHtml(sessionName)}">${truncateText(escapeHtml(sessionName), 16)}</option>`
      ).join('');
  }

  function updateSortOrderButton() {
    if (!elements.sortOrderBtn) return;
    
    const svg = elements.sortOrderBtn.querySelector('svg');
    if (sortOrder === 'desc') {
      // Descending icon (down arrow on top)
      svg.innerHTML = `
        <path d="m3 16 4 4 4-4"/>
        <path d="M7 20V4"/>
        <path d="m21 8-4-4-4 4"/>
        <path d="M17 4v16"/>
      `;
      elements.sortOrderBtn.title = 'Sort: Newest/Z-A';
    } else {
      // Ascending icon (up arrow on top)
      svg.innerHTML = `
        <path d="m3 8 4-4 4 4"/>
        <path d="M7 4v16"/>
        <path d="m21 16-4 4-4-4"/>
        <path d="M17 20V4"/>
      `;
      elements.sortOrderBtn.title = 'Sort: Oldest/A-Z';
    }
  }

  function renderTaskHistory(searchQuery = '') {
    if (!elements.taskHistoryList) return;
    
    const taskHistory = state.taskHistory || [];
    
    if (taskHistory.length === 0) {
      elements.taskHistoryList.innerHTML = '<p class="empty-history">No completed tasks yet</p>';
      return;
    }
    
    let filteredTasks = [...taskHistory];
    
    // Apply search filter - search ALL tasks when searching
    if (searchQuery) {
      filteredTasks = filteredTasks.filter(task => 
        task.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.sessionName && task.sessionName.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    // Apply session filter
    const sessionFilter = elements.taskFilterSession?.value;
    if (sessionFilter && sessionFilter !== 'all') {
      filteredTasks = filteredTasks.filter(task => task.sessionName === sessionFilter);
    }
    
    // Apply date range filter (only if checkbox is checked)
    const dateRangeEnabled = elements.enableDateRange?.checked;
    if (dateRangeEnabled) {
      const dateFrom = elements.dateFrom?.value;
      const dateTo = elements.dateTo?.value;
      if (dateFrom || dateTo) {
        filteredTasks = filteredTasks.filter(task => {
          const taskDate = new Date(task.completedAt).toISOString().split('T')[0];
          const fromMatch = !dateFrom || taskDate >= dateFrom;
          const toMatch = !dateTo || taskDate <= dateTo;
          return fromMatch && toMatch;
        });
      }
    }
    
    // Apply sorting
    const sortBy = elements.taskSortBy?.value || 'date';
    switch (sortBy) {
      case 'name':
        filteredTasks.sort((a, b) => {
          const comparison = a.text.localeCompare(b.text);
          return sortOrder === 'asc' ? comparison : -comparison;
        });
        break;
      case 'session':
        filteredTasks.sort((a, b) => {
          const sessionA = a.sessionName || '';
          const sessionB = b.sessionName || '';
          const comparison = sessionA.localeCompare(sessionB);
          return sortOrder === 'asc' ? comparison : -comparison;
        });
        break;
      case 'date':
      default:
        // Sort by date
        filteredTasks.sort((a, b) => {
          const comparison = a.completedAt - b.completedAt;
          return sortOrder === 'asc' ? comparison : -comparison;
        });
        break;
    }
    
    if (filteredTasks.length === 0) {
      elements.taskHistoryList.innerHTML = '<p class="empty-history">No tasks matching your search</p>';
      return;
    }
    
    // Show only top 50 UNLESS user is searching (then show all matching results)
    const tasksToDisplay = searchQuery ? filteredTasks : filteredTasks.slice(0, 50);
    
    elements.taskHistoryList.innerHTML = tasksToDisplay.map(task => {
      const completedDate = new Date(task.completedAt);
      const dateStr = completedDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      return `
        <div class="task-history-item">
          <div class="task-history-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
          </div>
          <div class="task-history-info">
            <div class="task-history-text">${escapeHtml(task.text)}</div>
            <div class="task-history-meta">${escapeHtml(task.sessionName || 'Session')} • ${dateStr}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderChart() {
    const barChart = elements.barChart;
    if (!barChart) return;
    
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = [];
    const dates = [];
    
    // Gather last 7 days of data
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayData = state.statistics.dailyStats[dateStr] || { time: 0 };
      data.push(dayData.time / 3600000); // Convert to hours
      dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    
    const maxValue = Math.max(...data, 0.5); // At least 0.5h for scale
    
    // Generate bar chart HTML
    barChart.innerHTML = data.map((value, index) => {
      const percentage = (value / maxValue) * 100;
      const hours = Math.floor(value);
      const minutes = Math.round((value - hours) * 60);
      const timeLabel = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      const dayLabel = labels[(new Date().getDay() - 6 + index + 7) % 7];
      
      // Get actual day name for this bar
      const barDate = new Date();
      barDate.setDate(barDate.getDate() - (6 - index));
      const actualDayLabel = labels[barDate.getDay()];
      
      return `
        <div class="bar-item">
          <div class="bar-wrapper">
            <div class="bar" style="height: ${Math.max(percentage, 3)}%">
              <span class="bar-value">${timeLabel}</span>
            </div>
          </div>
          <span class="bar-label">${actualDayLabel}</span>
          <span class="bar-date">${dates[index]}</span>
        </div>
      `;
    }).join('');
  }

  function clearTaskHistory() {
    chrome.runtime.sendMessage({ type: 'CLEAR_TASK_HISTORY' }, (response) => {
      if (response && response.success) {
        showToast('Task history cleared', 'success');
        renderTaskHistory();
      }
    });
  }

  function openModal(session = null) {
    editingSession = session;
    if (session) {
      elements.modalTitle.textContent = 'Edit Session';
      elements.sessionId.value = session.id;
      elements.sessionName.value = session.name;
      selectedColor = session.color;
      tempWebsites = [...session.websites];
    } else {
      elements.modalTitle.textContent = 'Create Session';
      elements.sessionId.value = '';
      elements.sessionName.value = '';
      selectedColor = '#C4A7E7';
      tempWebsites = [];
    }
    elements.colorOptions.forEach(option => {
      option.classList.toggle('active', option.dataset.color === selectedColor);
    });
    renderTempWebsites();
    elements.sessionModal.classList.add('active');
    elements.sessionName.focus();
  }

  function closeModal() {
    elements.sessionModal.classList.remove('active');
    editingSession = null;
    tempWebsites = [];
  }

  function selectColor(color) {
    selectedColor = color;
    const presetColors = Array.from(elements.colorOptions).map(o => o.dataset.color);
    const isPreset = presetColors.includes(color);
    
    elements.colorOptions.forEach(option => {
      option.classList.toggle('active', option.dataset.color === color);
    });
    
    // Handle custom color option active state
    const customOption = elements.customSessionColor.parentElement;
    if (!isPreset) {
      customOption.classList.add('active');
      customOption.style.background = color;
      elements.customSessionColor.value = color;
    } else {
      customOption.classList.remove('active');
      customOption.style.cssText = 'background: linear-gradient(180deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff, #5f27cd); background-size: 100% 300%; background-position: center;';
    }
  }

  function addWebsiteToTemp() {
    const website = elements.websiteAddInput.value.trim();
    if (!website) return;
    const cleanUrl = website.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '').toLowerCase();
	
	// Validate website format - must contain a TLD (.com, .org, .net, etc)
  const tldRegex = /\.[a-z]{2,}$/i;
  if (!tldRegex.test(cleanUrl)) {
    showToast('Invalid website format. Please include a domain extension (e.g., .com, .org, .net)', 'error');
    return;
  }
  
  // Additional validation - must have at least one dot and no spaces
  if (!cleanUrl.includes('.') || cleanUrl.includes(' ')) {
    showToast('Invalid website format. Example: github.com or docs.google.com', 'error');
    return;
  }
	
    if (!tempWebsites.includes(cleanUrl)) {
      tempWebsites.push(cleanUrl);
      renderTempWebsites();
    }
    elements.websiteAddInput.value = '';
  }

  function removeWebsiteFromTemp(website) {
    tempWebsites = tempWebsites.filter(w => w !== website);
    renderTempWebsites();
  }

  function renderTempWebsites() {
  elements.websitesList.innerHTML = tempWebsites.map((website, index) => `
    <div class="website-tag-edit" data-index="${index}">
      <span class="website-text">${escapeHtml(website)}</span>
      <input type="text" class="website-edit-input" value="${escapeHtml(website)}" style="display: none;">
      <button data-action="edit" title="Edit">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button data-action="delete" data-website="${escapeHtml(website)}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('');
  
  // Delete buttons
  elements.websitesList.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => removeWebsiteFromTemp(btn.dataset.website));
  });
  
  // Edit buttons
  elements.websitesList.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tag = e.target.closest('.website-tag-edit');
      const index = parseInt(tag.dataset.index);
      const textSpan = tag.querySelector('.website-text');
      const input = tag.querySelector('.website-edit-input');
      
      textSpan.style.display = 'none';
      input.style.display = 'block';
      input.focus();
      input.select();
      
      const saveEdit = () => {
        const newValue = input.value.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '').toLowerCase().trim();
        if (newValue && newValue !== tempWebsites[index]) {
          tempWebsites[index] = newValue;
        }
        renderTempWebsites();
      };
      
      input.addEventListener('blur', saveEdit, { once: true });
      input.addEventListener('keypress', (ev) => {
        if (ev.key === 'Enter') input.blur();
      });
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
          input.value = tempWebsites[index];
          input.blur();
        }
      });
    });
  });
}

  function saveSession() {
    const name = elements.sessionName.value.trim();
    if (!name) {
      showToast('Please enter a session name', 'error');
      return;
    }
    if (editingSession) {
      chrome.runtime.sendMessage({
        type: 'UPDATE_SESSION',
        sessionId: editingSession.id,
        updates: { name, color: selectedColor, websites: tempWebsites }
      }, (response) => {
        if (response && response.success) {
          showToast('Session updated successfully', 'success');
          closeModal();
          loadState();
        }
      });
    } else {
      chrome.runtime.sendMessage({
        type: 'CREATE_SESSION',
        name, color: selectedColor, websites: tempWebsites
      }, (response) => {
        if (response && response.success) {
          showToast('Session created successfully', 'success');
          closeModal();
          loadState();
        }
      });
    }
  }

  function deleteSession(sessionId) {
    chrome.runtime.sendMessage({ type: 'DELETE_SESSION', sessionId }, (response) => {
      if (response && response.success) {
        showToast('Session deleted', 'success');
        loadState();
      } else {
        showToast('Cannot delete active session', 'error');
      }
    });
  }

  function applyPreset(presetName) {
    const preset = themePresets[presetName];
    if (preset) {
      elements.accentColor.value = preset.accent;
      elements.accentColorValue.textContent = preset.accent;
      elements.bgColor.value = preset.bgDark;
      elements.bgColorValue.textContent = preset.bgDark;
      elements.cardColor.value = preset.bgCard;
      elements.cardColorValue.textContent = preset.bgCard;
      elements.textColor.value = preset.textPrimary;
      elements.textColorValue.textContent = preset.textPrimary;
    }
  }

  function saveTheme() {
    const theme = {
      bgDark: elements.bgColor.value,
      bgCard: elements.cardColor.value,
      bgElevated: adjustColor(elements.cardColor.value, 10),
      bgInput: adjustColor(elements.cardColor.value, 20),
      textPrimary: elements.textColor.value,
      textSecondary: adjustColor(elements.textColor.value, -40),
      textMuted: adjustColor(elements.textColor.value, -80),
      accent: elements.accentColor.value,
      accentHover: adjustColor(elements.accentColor.value, -15)
    };
    chrome.runtime.sendMessage({ type: 'UPDATE_THEME', theme }, (response) => {
      if (response && response.success) {
        showToast('Theme saved successfully', 'success');
        state.settings.customTheme = theme;
        applyTheme();
        updateKofiButtonColor();
      }
    });
  }

  function saveBlockedMessage() {
    const message = elements.blockedMessage.value.trim();
    chrome.runtime.sendMessage({ type: 'UPDATE_BLOCKED_MESSAGE', message }, (response) => {
      if (response && response.success) {
        showToast('Message saved successfully', 'success');
      }
    });
  }

  function exportData() {
    chrome.runtime.sendMessage({ type: 'EXPORT_DATA' }, (response) => {
      if (response && response.success) {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qura-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Data exported successfully', 'success');
      }
    });
  }

  function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        chrome.runtime.sendMessage({ type: 'IMPORT_DATA', data }, (response) => {
          if (response && response.success) {
            showToast('Data imported successfully', 'success');
            loadState();
          } else {
            showToast('Import failed: ' + (response?.error || 'Unknown error'), 'error');
          }
        });
      } catch (error) {
        showToast('Invalid file format', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function resetData() {
    chrome.runtime.sendMessage({ type: 'RESET_DATA' }, (response) => {
      if (response && response.success) {
        showToast('All data has been reset', 'success');
        loadState();
      }
    });
  }

  function showConfirm(title, message, callback) {
    elements.confirmTitle.textContent = title;
    elements.confirmMessage.textContent = message;
    confirmCallback = callback;
    elements.confirmModal.classList.add('active');
  }

  function closeConfirmModal() {
    elements.confirmModal.classList.remove('active');
    confirmCallback = null;
  }

  function formatTimeShort(ms) {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function adjustColor(color, amount) {
    const clamp = (num) => Math.min(255, Math.max(0, num));
    let hex = color.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = clamp(parseInt(hex.substr(0, 2), 16) + amount);
    const g = clamp(parseInt(hex.substr(2, 2), 16) + amount);
    const b = clamp(parseInt(hex.substr(4, 2), 16) + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">
        ${type === 'success' 
          ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>'
          : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
        }
      </div>
      <span class="toast-message">${escapeHtml(message)}</span>
    `;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

// --- Contrast Helper Functions ---

// 1. Convert Hex to RGB
function hexToRgb(hex) {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// 2. Calculate Luminance (Perceived Brightness)
function getLuminance(r, g, b) {
  const a = [r, g, b].map(function (v) {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

// 3. Get Best Contrast Color (Returns Black or White)
function getContrastColor(hexColor) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return '#ffffff'; // Default to white if invalid
  
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  
  // If background is bright (lum > 0.5), use dark text. Otherwise white.
  return luminance > 0.5 ? '#0d0d0f' : '#ffffff';
}


  init();
});
