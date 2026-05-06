// session.js - Persistent session management

// Session configuration
const SESSION_CONFIG = {
  userId: 'userId',
  username: 'username',
  fullname: 'fullname',
  role: 'role',
  email: 'email',
  sessionExpiry: 'sessionExpiry',
  sessionDuration: 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
};

// Initialize session from localStorage
function initializeSession() {
  // Check if session exists and is not expired
  const sessionExpiry = localStorage.getItem(SESSION_CONFIG.sessionExpiry);
  const now = new Date().getTime();
  
  if (sessionExpiry && now > parseInt(sessionExpiry)) {
    // Session expired, clear everything
    clearSession();
    return false;
  }
  
  // Session is valid, populate localStorage from localStorage
  const sessionData = {
    userId: localStorage.getItem(SESSION_CONFIG.userId),
    username: localStorage.getItem(SESSION_CONFIG.username),
    fullname: localStorage.getItem(SESSION_CONFIG.fullname),
    role: localStorage.getItem(SESSION_CONFIG.role),
    email: localStorage.getItem(SESSION_CONFIG.email)
  };
  
  // Only populate if we have a valid userId
  if (sessionData.userId) {
    Object.keys(sessionData).forEach(key => {
      if (sessionData[key]) {
        localStorage.setItem(key, sessionData[key]);
      }
    });
    return true;
  }
  
  return false;
}

// Create or update session
function createSession(userData) {
  if (!userData || !userData.userId) {
    console.error('Invalid user data for session creation');
    return false;
  }
  
  const expiryTime = new Date().getTime() + SESSION_CONFIG.sessionDuration;
  
  // Store in localStorage for persistence
  localStorage.setItem(SESSION_CONFIG.userId, userData.userId);
  localStorage.setItem(SESSION_CONFIG.sessionExpiry, expiryTime.toString());
  
  if (userData.username) {
    localStorage.setItem(SESSION_CONFIG.username, userData.username);
    localStorage.setItem('username', userData.username);
  }
  
  if (userData.fullname) {
    localStorage.setItem(SESSION_CONFIG.fullname, userData.fullname);
    localStorage.setItem('fullname', userData.fullname);
  }
  
  if (userData.role) {
    localStorage.setItem(SESSION_CONFIG.role, userData.role);
    localStorage.setItem('role', userData.role);
  }
  
  if (userData.email) {
    localStorage.setItem(SESSION_CONFIG.email, userData.email);
    localStorage.setItem('email', userData.email);
  }
  
  // Always set in localStorage for immediate access
  localStorage.setItem('userId', userData.userId);
  
  console.log('Session created successfully for user:', userData.userId);
  return true;
}

// Update session data
function updateSession(userData) {
  if (!checkSession()) {
    console.error('No active session to update');
    return false;
  }
  
  if (userData.username) {
    localStorage.setItem(SESSION_CONFIG.username, userData.username);
    localStorage.setItem('username', userData.username);
  }
  
  if (userData.fullname) {
    localStorage.setItem(SESSION_CONFIG.fullname, userData.fullname);
    localStorage.setItem('fullname', userData.fullname);
  }
  
  if (userData.role) {
    localStorage.setItem(SESSION_CONFIG.role, userData.role);
    localStorage.setItem('role', userData.role);
  }
  
  if (userData.email) {
    localStorage.setItem(SESSION_CONFIG.email, userData.email);
    localStorage.setItem('email', userData.email);
  }
  
  console.log('Session updated successfully');
  return true;
}

// Check if session exists and is valid
function checkSession() {
  const userId = localStorage.getItem('userId');
  const sessionExpiry = localStorage.getItem(SESSION_CONFIG.sessionExpiry);
  const now = new Date().getTime();
  
  if (!userId) {
    return false;
  }
  
  if (sessionExpiry && now > parseInt(sessionExpiry)) {
    // Session expired
    clearSession();
    return false;
  }
  
  return true;
}

// Clear session (logout)
// Function to clear session data
function clearSession() {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userId');
  localStorage.removeItem('username');
  localStorage.removeItem('email');
  localStorage.removeItem('fullname');
  localStorage.removeItem('role');
  localStorage.removeItem('status');
  localStorage.removeItem('sessionExpiration');
  localStorage.removeItem('rolePath');
  console.log("Session cleared");
}

// Get session data
function getSessionData() {
  if (!checkSession()) {
    return null;
  }
  
  return {
    userId: localStorage.getItem('userId'),
    username: localStorage.getItem('username'),
    fullname: localStorage.getItem('fullname'),
    role: localStorage.getItem('role'),
    email: localStorage.getItem('email')
  };
}

// Extend session expiry
function extendSession() {
  if (!checkSession()) {
    return false;
  }
  
  const expiryTime = new Date().getTime() + SESSION_CONFIG.sessionDuration;
  localStorage.setItem(SESSION_CONFIG.sessionExpiry, expiryTime.toString());
  
  return true;
}

// Auto-extend session on user activity
function setupSessionAutoExtend() {
  // Extend session on user interactions
  const events = ['click', 'keypress', 'scroll', 'mousemove', 'touchstart'];
  
  events.forEach(event => {
    document.addEventListener(event, () => {
      if (checkSession()) {
        extendSession();
      }
    }, { passive: true });
  });
  
  // Extend session every hour as well
  setInterval(() => {
    if (checkSession()) {
      extendSession();
    }
  }, 60 * 60 * 1000); // 1 hour
}

// Initialize session when script loads
document.addEventListener('DOMContentLoaded', function() {
  initializeSession();
  setupSessionAutoExtend();
  
  // Log session status for debugging
  if (checkSession()) {
    console.log('Session active:', getSessionData());
  } else {
    console.log('No active session');
  }
});

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeSession,
    createSession,
    updateSession,
    checkSession,
    clearSession,
    getSessionData,
    extendSession,
    setupSessionAutoExtend
  };
}