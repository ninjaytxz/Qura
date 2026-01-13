// Qura - Background Service Worker
// Handles session management, website blocking, and timer functionality

// ============================================
// STATE MANAGEMENT
// ============================================

let state = {
  sessions: [],
  activeSession: null,
  isRunning: false,
  isPaused: false,
  elapsedTime: 0,
  startTime: null,
  pausedTime: 0,
  strictMode: false,
  strictDuration: null,
  statistics: {
    totalTime: 0,
    sessionTimes: {},
    tasksCompleted: 0,
    sessionsCompleted: 0,
    dailyStats: {}
  },
  settings: {
    theme: 'dark',
    accentColor: '#C4A7E7',
    blockedMessage: '',
    blockYoutubeShorts: false,
    customTheme: {
      bgDark: '#0d0d0f',
      bgCard: '#16161a',
      bgElevated: '#1e1e24',
      bgInput: '#252530',
      textPrimary: '#f5f5f7',
      textSecondary: '#9898a6',
      textMuted: '#6b6b78',
      accent: '#C4A7E7',
      accentHover: '#B394D9'
    }
  },
  tasks: {},
  taskHistory: []
};

// ============================================
// INITIALIZATION
// ============================================

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await saveState();
    chrome.tabs.create({ url: 'pages/options.html' });
  } else {
    await loadState();
  }
});

loadState();

// ============================================
// STORAGE FUNCTIONS
// ============================================

async function loadState() {
  try {
    const result = await chrome.storage.local.get(['quraState']);
    if (result.quraState) {
      state = { ...state, ...result.quraState };
      // Ensure settings exist
      if (!state.settings) {
        state.settings = {
          theme: 'dark',
          accentColor: '#C4A7E7',
          blockedMessage: '',
          blockYoutubeShorts: false,
          customTheme: {
            bgDark: '#0d0d0f',
            bgCard: '#16161a',
            bgElevated: '#1e1e24',
            bgInput: '#252530',
            textPrimary: '#f5f5f7',
            textSecondary: '#9898a6',
            textMuted: '#6b6b78',
            accent: '#C4A7E7',
            accentHover: '#B394D9'
          }
        };
      }
      // Ensure blockYoutubeShorts exists for older states
      if (state.settings.blockYoutubeShorts === undefined) {
        state.settings.blockYoutubeShorts = false;
      }
    }
  } catch (error) {
    console.error('Error loading state:', error);
  }
}

async function saveState() {
  try {
    await chrome.storage.local.set({ quraState: state });
  } catch (error) {
    console.error('Error saving state:', error);
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function extractDomain(url) {
  try {
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      return url;
    }
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function isUrlAllowed(url, whitelist) {
	
	// Always allow search engines
  const alwaysAllowed = [
    'google.com', 'google.', 'bing.com', 'duckduckgo.com', 
    'search.brave.com', 'yahoo.com', 'ecosia.org', 'startpage.com'
  ];
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (alwaysAllowed.some(domain => 
		  hostname === domain || hostname.endsWith('.' + domain)
		)) {
		  return true;
	}
  } catch (e) {}
  if (!url) return true;
  
  if (url.startsWith('chrome://') || 
      url.startsWith('chrome-extension://') ||
      url.startsWith('about:') ||
      url.startsWith('edge://') ||
	  url.startsWith('file:///') ||
      url.startsWith('brave://')) {
    return true;
  }
  
  const domain = extractDomain(url);
  
  for (const whitelistedUrl of whitelist) {
    const whitelistedDomain = extractDomain(whitelistedUrl);
    
    if (domain === whitelistedDomain || 
    domain.endsWith('.' + whitelistedDomain)) {
		return true;
	}	
  }
  
  return false;
}

// ============================================
// SESSION MANAGEMENT
// ============================================

function createSession(name, color, websites = []) {
  const session = {
    id: generateId(),
    name: name || 'New Session',
    color: color || '#C4A7E7',
    websites: websites,
    createdAt: Date.now()
  };
  
  state.sessions.push(session);
  state.tasks[session.id] = [];
  
  if (!state.statistics.sessionTimes[session.id]) {
    state.statistics.sessionTimes[session.id] = 0;
  }
  
  saveState();
  return session;
}

function updateSession(sessionId, updates) {
  const index = state.sessions.findIndex(s => s.id === sessionId);
  if (index !== -1) {
    state.sessions[index] = { ...state.sessions[index], ...updates };
    saveState();
    return state.sessions[index];
  }
  return null;
}

function deleteSession(sessionId) {
  if (state.activeSession?.id === sessionId && state.isRunning) {
    return false;
  }
  
  state.sessions = state.sessions.filter(s => s.id !== sessionId);
  delete state.tasks[sessionId];
  
  if (state.activeSession?.id === sessionId) {
    state.activeSession = null;
  }
  
  saveState();
  return true;
}

function duplicateSession(sessionId) {
  const session = state.sessions.find(s => s.id === sessionId);
  if (session) {
    const newSession = {
      id: generateId(),
      name: session.name + ' (Copy)',
      color: session.color,
      websites: [...session.websites],
      createdAt: Date.now()
    };
    
    state.sessions.push(newSession);
    state.tasks[newSession.id] = [];
    state.statistics.sessionTimes[newSession.id] = 0;
    
    saveState();
    return newSession;
  }
  return null;
}


function selectSession(sessionId) {
  const session = state.sessions.find(s => s.id === sessionId);
  if (session && !state.isRunning) {
    state.activeSession = session;
    saveState();
    return session;
  }
  return null;
}

function addWebsiteToSession(sessionId, website) {
  const session = state.sessions.find(s => s.id === sessionId);
  if (session) {
    let domain = website
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/.*$/, '')
      .toLowerCase()
      .trim();
	  
    if (domain && !session.websites.includes(domain)) {
      session.websites.push(domain);
      
      // Also update activeSession if it's the same session
      if (state.activeSession && state.activeSession.id === sessionId) {
        state.activeSession.websites = [...session.websites];
      }
      
      saveState();
      broadcastState();
      
      return true;
    }
  }
  return false;
}

function removeWebsiteFromSession(sessionId, website) {
  const session = state.sessions.find(s => s.id === sessionId);
  if (session) {
    session.websites = session.websites.filter(w => w !== website);
    saveState();
    return true;
  }
  return false;
}

// ============================================
// TIMER MANAGEMENT
// ============================================

function startTimer(strictMode = false, strictDuration = null) {
  if (!state.activeSession) return false;
  
   // Validate strict mode duration (prevent negative, zero, or ridiculously long durations)
	if (strictMode) {
	  if (typeof strictDuration !== 'number' || strictDuration <= 0 || strictDuration > 86400) {
		// Return error message instead of just false
		return { error: 'Invalid duration. Please set between 1 second and 24 hours.' };
	  }
	}
  
  
  if (state.isPaused) {
    state.isPaused = false;
    state.startTime = Date.now();
  } else {
    state.startTime = Date.now();
    state.elapsedTime = 0;
    state.pausedTime = 0;
    state.strictMode = strictMode;
    state.strictDuration = strictDuration;
  }
  
  state.isRunning = true;
  saveState();
  
  chrome.alarms.create('quraTimer', { periodInMinutes: 1/60 });
  
  // Set alarm for strict mode end
  if (strictMode && strictDuration) {
    chrome.alarms.create('quraStrictEnd', { delayInMinutes: strictDuration / 60 });
  }
  
  broadcastState();
  return true;
}

function pauseTimer() {
  // Cannot pause in strict mode
  if (state.strictMode) return false;
  
  if (!state.isRunning) return false;
  
  const now = Date.now();
  state.elapsedTime += (now - state.startTime);
  state.pausedTime = state.elapsedTime;
  
  state.isRunning = false;
  state.isPaused = true;
  
  saveState();
  chrome.alarms.clear('quraTimer');
  broadcastState();
  
  return true;
}

function endTimer() {
  if (!state.activeSession) return false;
  
  if (state.isRunning) {
    state.elapsedTime += (Date.now() - state.startTime);
  }
  
  const sessionId = state.activeSession.id;
  state.statistics.totalTime += state.elapsedTime;
  
  if (!state.statistics.sessionTimes[sessionId]) {
    state.statistics.sessionTimes[sessionId] = 0;
  }
  state.statistics.sessionTimes[sessionId] += state.elapsedTime;
  state.statistics.sessionsCompleted += 1;
  
  const today = new Date().toISOString().split('T')[0];
  if (!state.statistics.dailyStats[today]) {
    state.statistics.dailyStats[today] = { time: 0, sessions: 0, tasks: 0 };
  }
  state.statistics.dailyStats[today].time += state.elapsedTime;
  state.statistics.dailyStats[today].sessions += 1;
  
  
  const sessionTasks = state.tasks[sessionId] || [];
  const completedTasks = sessionTasks.filter(t => t.completed);
  
  if (completedTasks.length > 0) {
    if (!state.taskHistory) state.taskHistory = [];
    completedTasks.forEach(task => {
      state.taskHistory.unshift({
        ...task,
        sessionId: sessionId,
        sessionName: state.activeSession.name,
        completedAt: Date.now()
      });
    });
    // Keep ALL tasks - no limit
  }
  
  // Clear non-pinned tasks (pinned tasks stay with pinned: true)
  // Reset completion state of pinned tasks so they can be re-completed
  state.tasks[sessionId] = sessionTasks.filter(t => t.pinned).map(t => ({
    ...t,
    completed: false
  }));
  
  state.isRunning = false;
  state.isPaused = false;
  state.elapsedTime = 0;
  state.startTime = null;
  state.pausedTime = 0;
  state.strictMode = false;
  state.strictDuration = null;
  
  chrome.alarms.clear('quraTimer');
  chrome.alarms.clear('quraStrictEnd');
  saveState();
  broadcastState();
  
  return true;
}

function getCurrentElapsedTime() {
  if (state.isRunning && state.startTime) {
    return state.elapsedTime + (Date.now() - state.startTime);
  }
  return state.elapsedTime;
}

// ============================================
// TASK MANAGEMENT
// ============================================

function addTask(sessionId, taskText) {
  if (!state.tasks[sessionId]) {
    state.tasks[sessionId] = [];
  }
  
  const task = {
    id: generateId(),
    text: taskText,
    completed: false,
    pinned: false,
    createdAt: Date.now()
  };
  
  state.tasks[sessionId].push(task);
  saveState();
  return task;
}

function updateTask(sessionId, taskId, updates) {
  const tasks = state.tasks[sessionId];
  if (tasks) {
    const index = tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
      const wasCompleted = tasks[index].completed;
      tasks[index] = { ...tasks[index], ...updates };
      
      if (!wasCompleted && updates.completed) {
        state.statistics.tasksCompleted += 1;
        
        const today = new Date().toISOString().split('T')[0];
        if (!state.statistics.dailyStats[today]) {
          state.statistics.dailyStats[today] = { time: 0, sessions: 0, tasks: 0 };
        }
        state.statistics.dailyStats[today].tasks += 1;
      } else if (wasCompleted && updates.completed === false) {
        state.statistics.tasksCompleted = Math.max(0, state.statistics.tasksCompleted - 1);
      }
      
      saveState();
      return tasks[index];
    }
  }
  return null;
}

function deleteTask(sessionId, taskId) {
  const tasks = state.tasks[sessionId];
  if (tasks) {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.completed) {
      state.statistics.tasksCompleted = Math.max(0, state.statistics.tasksCompleted - 1);
    }
    state.tasks[sessionId] = tasks.filter(t => t.id !== taskId);
    saveState();
    return true;
  }
  return false;
}

function getTasks(sessionId) {
  return state.tasks[sessionId] || [];
}

// ============================================
// BLOCKING LOGIC
// ============================================

function shouldBlockUrl(url) {
  if (!state.isRunning || !state.activeSession) {
    return false;
  }
  
  return !isUrlAllowed(url, state.activeSession.websites);
}

// ============================================
// COMMUNICATION
// ============================================

function broadcastState() {
  const currentState = {
    sessions: state.sessions,
    activeSession: state.activeSession,
    isRunning: state.isRunning,
    isPaused: state.isPaused,
    elapsedTime: getCurrentElapsedTime(),
    statistics: state.statistics,
    settings: state.settings,
    tasks: state.tasks,
    strictMode: state.strictMode,
    strictDuration: state.strictDuration,
    taskHistory: state.taskHistory || []
  };
  
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'STATE_UPDATE',
        state: currentState
      }).catch(() => {});
    });
  });
  
  chrome.runtime.sendMessage({
    type: 'STATE_UPDATE',
    state: currentState
  }).catch(() => {});
}

// ============================================
// ALARM HANDLER
// ============================================

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'quraTimer') {
    // Check if strict mode time is up
    if (state.strictMode && state.strictDuration && state.isRunning) {
      const currentElapsed = getCurrentElapsedTime();
      if (currentElapsed >= state.strictDuration * 1000) {
        endTimer();
        return;
      }
    }
    broadcastState();
  }
  
  if (alarm.name === 'quraStrictEnd') {
    if (state.isRunning && state.strictMode) {
      endTimer();
    }
  }
});

// ============================================
// MESSAGE HANDLER
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    await loadState();
    
    switch (message.type) {
      case 'GET_STATE':
        sendResponse({
          success: true,
          state: {
            sessions: state.sessions,
            activeSession: state.activeSession,
            isRunning: state.isRunning,
            isPaused: state.isPaused,
            elapsedTime: getCurrentElapsedTime(),
            statistics: state.statistics,
            settings: state.settings,
            tasks: state.tasks,
            strictMode: state.strictMode,
            strictDuration: state.strictDuration,
            taskHistory: state.taskHistory || []
          }
        });
        break;
        
      case 'CREATE_SESSION':
        const newSession = createSession(message.name, message.color, message.websites);
        sendResponse({ success: true, session: newSession });
        break;
        
      case 'UPDATE_SESSION':
        const updatedSession = updateSession(message.sessionId, message.updates);
        sendResponse({ success: !!updatedSession, session: updatedSession });
        broadcastState();
        break;
        
      case 'DELETE_SESSION':
        const deleted = deleteSession(message.sessionId);
        sendResponse({ success: deleted });
        broadcastState();
        break;
        
		
		
	  case 'DUPLICATE_SESSION':
		const duplicated = duplicateSession(message.sessionId);
		sendResponse({ success: !!duplicated, session: duplicated });
		broadcastState();
		break;	
		
      case 'SELECT_SESSION':
        const selected = selectSession(message.sessionId);
        sendResponse({ success: !!selected, session: selected });
        broadcastState();
        break;
        
      case 'ADD_WEBSITE':
        const added = addWebsiteToSession(message.sessionId, message.website);
        sendResponse({ success: added });
        broadcastState();
        break;
        
      case 'REMOVE_WEBSITE':
        const removed = removeWebsiteFromSession(message.sessionId, message.website);
        sendResponse({ success: removed });
        broadcastState();
        break;
        
      case 'START_TIMER':
	  const started = startTimer(message.strictMode, message.strictDuration);
	  if (started && started.error) {
		sendResponse({ success: false, error: started.error });
	  } else {
		sendResponse({ success: started });
	  }
	  break;
        
      case 'PAUSE_TIMER':
        const paused = pauseTimer();
        sendResponse({ success: paused });
        break;
        
      case 'END_TIMER':
        const ended = endTimer();
        sendResponse({ success: ended });
        break;
        
      case 'CHECK_URL':
        const shouldBlock = shouldBlockUrl(message.url);
        sendResponse({ 
          shouldBlock,
          isRunning: state.isRunning,
          activeSession: state.activeSession,
          settings: state.settings
        });
        break;
        
      case 'ADD_TASK':
        const task = addTask(message.sessionId, message.text);
        sendResponse({ success: true, task });
        broadcastState();
        break;
        
      case 'UPDATE_TASK':
        const updatedTask = updateTask(message.sessionId, message.taskId, message.updates);
        sendResponse({ success: !!updatedTask, task: updatedTask });
        broadcastState();
        break;
        
      case 'DELETE_TASK':
        const taskDeleted = deleteTask(message.sessionId, message.taskId);
        sendResponse({ success: taskDeleted });
        broadcastState();
        break;
        
      case 'GET_TASKS':
        const tasks = getTasks(message.sessionId);
        sendResponse({ success: true, tasks });
        break;
        
      case 'UPDATE_SETTINGS':
        state.settings = { ...state.settings, ...message.settings };
        await saveState();
        sendResponse({ success: true });
        broadcastState();
        break;
        
      case 'UPDATE_THEME':
        state.settings.customTheme = { ...state.settings.customTheme, ...message.theme };
        state.settings.accentColor = message.theme.accent || state.settings.accentColor;
        await saveState();
        sendResponse({ success: true });
        broadcastState();
        break;
        
      case 'UPDATE_BLOCKED_MESSAGE':
        state.settings.blockedMessage = message.message;
        await saveState();
        sendResponse({ success: true });
        broadcastState();
        break;
        
      case 'UPDATE_YOUTUBE_SHORTS':
        state.settings.blockYoutubeShorts = message.enabled;
        await saveState();
        sendResponse({ success: true });
        broadcastState();
        break;
        
      case 'IMPORT_DATA':
        try {
          const importedData = message.data;
          if (importedData.sessions) state.sessions = importedData.sessions;
          if (importedData.statistics) state.statistics = importedData.statistics;
          if (importedData.tasks) state.tasks = importedData.tasks;
          if (importedData.settings) state.settings = { ...state.settings, ...importedData.settings };
          await saveState();
          sendResponse({ success: true });
          broadcastState();
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;
        
      case 'EXPORT_DATA':
        sendResponse({
          success: true,
          data: {
            sessions: state.sessions,
            statistics: state.statistics,
            tasks: state.tasks,
            settings: state.settings,
            taskHistory: state.taskHistory || [],
            exportedAt: Date.now()
          }
        });
        break;
        
      case 'CLEAR_TASK_HISTORY':
        state.taskHistory = [];
        await saveState();
        sendResponse({ success: true });
        broadcastState();
        break;
        
      case 'RESET_DATA':        
        state = {
          sessions: [],
          activeSession: null,
          isRunning: false,
          isPaused: false,
          elapsedTime: 0,
          startTime: null,
          pausedTime: 0,
          statistics: {
            totalTime: 0,
            sessionTimes: {},
            tasksCompleted: 0,
            sessionsCompleted: 0,
            dailyStats: {}
          },
          settings: {
            theme: 'dark',
            accentColor: '#C4A7E7',
            blockedMessage: 'Stay focused! This site is blocked during your focus session.',
            customTheme: {
              bgDark: '#0d0d0f',
              bgCard: '#16161a',
              bgElevated: '#1e1e24',
              bgInput: '#252530',
              textPrimary: '#f5f5f7',
              textSecondary: '#9898a6',
              textMuted: '#6b6b78',
              accent: '#C4A7E7',
              accentHover: '#B394D9'
            }
          },
          tasks: {}
        };
        
        await saveState();
        sendResponse({ success: true });
        broadcastState();
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  })();
  
  return true;
});

// ============================================
// TAB NAVIGATION HANDLER
// ============================================

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    if (shouldBlockUrl(tab.url)) {
      const blockedUrl = chrome.runtime.getURL('pages/blocked.html') + 
        '?url=' + encodeURIComponent(tab.url);
      chrome.tabs.update(tabId, { url: blockedUrl });
    }
  }
});

chrome.webNavigation?.onBeforeNavigate?.addListener((details) => {
  if (details.frameId !== 0) return;
  
  if (shouldBlockUrl(details.url)) {
    const blockedUrl = chrome.runtime.getURL('pages/blocked.html') + 
      '?url=' + encodeURIComponent(details.url);
    chrome.tabs.update(details.tabId, { url: blockedUrl });
  }
});
