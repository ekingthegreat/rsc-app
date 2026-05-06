  // Initialize Firebase
    const app = firebase.initializeApp(firebaseConfig);
    const database = firebase.database();

    // Global variable to track unread count
    let unreadNotificationsCount = 0;
    let currentNotifications = []; // Store current notifications for display
    let currentUserId = null;

    // Function to check if session is valid
    function checkSession() {
      const isLoggedIn = localStorage.getItem('isLoggedIn');
      const expirationTime = localStorage.getItem('sessionExpiration');

      if (!isLoggedIn || !expirationTime) {
        console.log("Session invalid: Missing isLoggedIn or expirationTime");
        return false;
      }

      // Check if session has expired
      if (new Date().getTime() > parseInt(expirationTime)) {
        console.log("Session invalid: Session expired");
        clearSession();
        return false;
      }

      console.log("Session valid");
      return true;
    }

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

    // Update notification badge
    function updateNotificationBadge(count) {
      const notificationNavItem = document.getElementById('notification-nav-item');
      let badge = notificationNavItem.querySelector('.notification-badge');
      
      // Remove existing badge if count is 0
      if (count === 0 && badge) {
        badge.remove();
        return;
      }
      
      // Create badge if it doesn't exist
      if (!badge && count > 0) {
        badge = document.createElement('span');
        badge.className = 'notification-badge';
        notificationNavItem.appendChild(badge);
      }
      
      // Update badge text
      if (badge) {
        badge.textContent = count > 99 ? '99+' : count.toString();
      }
    }

    // Update Clear All button state
    function updateClearAllButton() {
      const clearAllBtn = document.getElementById('clearAllBtn');
      const hasNotifications = currentNotifications.length > 0;
      
      clearAllBtn.disabled = !hasNotifications;
    }

    // Clear all notifications from display (persistently)
    function clearAllNotifications() {
      const userId = localStorage.getItem('userId');
      if (!userId) return;

      // Get current notification IDs
      const clearedNotificationIds = currentNotifications.map(notification => notification.id);
      
      // Store in localStorage to remember which notifications are cleared
      const userClearedKey = `clearedNotifications_${userId}`;
      const existingCleared = JSON.parse(localStorage.getItem(userClearedKey) || '[]');
      const newCleared = [...new Set([...existingCleared, ...clearedNotificationIds])];
      localStorage.setItem(userClearedKey, JSON.stringify(newCleared));
      
      // Clear the display
      const notificationsList = document.getElementById('notificationsList');
      notificationsList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-bell-slash"></i>
          <h3>No Notifications</h3>
          <p>All notifications have been cleared from view</p>
         
        </div>
      `;
      
      // Reset counters
      unreadNotificationsCount = 0;
      currentNotifications = [];
      
      // Update badge
      updateNotificationBadge(0);
      
      // Update Clear All button
      updateClearAllButton();
      
      console.log('All notifications cleared from display and state saved');
    }

  

    // NEW: Function to check if notification is for current user
    function isNotificationForCurrentUser(notification) {
      const userId = currentUserId;
      
      // Check different notification types and their recipient fields
      if (notification.recipientId === userId) {
        return true;
      }
      
      // Check if user is in recipientIds array
      if (notification.recipientIds && Array.isArray(notification.recipientIds)) {
        return notification.recipientIds.includes(userId);
      }
      
      // Check recipientRoles for specific user types
      if (notification.recipientRoles) {
        const userRole = localStorage.getItem('role');
        
        if (Array.isArray(notification.recipientRoles)) {
          return notification.recipientRoles.includes(userRole);
        } else if (notification.recipientRoles === userRole) {
          return true;
        }
      }
      
      // For reporter notifications
      if (notification.recipientRole === 'reporter' && notification.recipientId === userId) {
        return true;
      }
      
      // For system-wide notifications (no specific recipient)
      if (!notification.recipientId && !notification.recipientIds && !notification.recipientRoles) {
        return true; // Show to all users if no specific recipient
      }
      
      return false;
    }

    // Load notifications from Firebase - UPDATED FOR MULTI-USER
    function loadNotificationsFromFirebase() {
      const notificationsRef = database.ref('notifications');
      currentUserId = localStorage.getItem('userId');
      
      console.log('Loading notifications for user:', currentUserId);
      
      notificationsRef.orderByChild('timestamp').limitToLast(100).on('value', (snapshot) => {
        const allNotifications = snapshot.val();
        const notificationsList = document.getElementById('notificationsList');
        
        // Clear existing notifications
        notificationsList.innerHTML = '';
        
        if (allNotifications) {
          // Get user's cleared notifications from localStorage
          const userClearedKey = `clearedNotifications_${currentUserId}`;
          const clearedNotificationIds = JSON.parse(localStorage.getItem(userClearedKey) || '[]');
          
          // Convert to array, filter for current user, and sort by timestamp (newest first)
          currentNotifications = Object.entries(allNotifications)
            .map(([id, notification]) => ({ id, ...notification }))
            .filter(notification => isNotificationForCurrentUser(notification))
            .filter(notification => !clearedNotificationIds.includes(notification.id)) // Filter out cleared notifications
            .sort((a, b) => b.timestamp - a.timestamp);
          
          console.log(`Found ${currentNotifications.length} notifications for current user (after filtering cleared ones)`);
          
          // Count unread notifications
          unreadNotificationsCount = currentNotifications.filter(n => n.status === 'unread').length;
          
          // Update the badge
          updateNotificationBadge(unreadNotificationsCount);
          
          // Update Clear All button
          updateClearAllButton();
          
          if (currentNotifications.length === 0) {
            showEmptyState();
            return;
          }
          
          currentNotifications.forEach(notification => {
            const notificationElement = createNotificationElement(notification);
            notificationsList.appendChild(notificationElement);
          });
        } else {
          // Show no notifications message
          console.log('No notifications found in database');
          showEmptyState();
          
          // Update badge to show 0
          updateNotificationBadge(0);
          updateClearAllButton();
        }
      }, (error) => {
        console.error('Error loading notifications:', error);
        showErrorState();
      });
    }

    // Show empty state
    function showEmptyState() {
      const notificationsList = document.getElementById('notificationsList');
      const userId = localStorage.getItem('userId');
      const userClearedKey = `clearedNotifications_${userId}`;
      const hasClearedNotifications = localStorage.getItem(userClearedKey);
      
      let restoreButton = '';
      if (hasClearedNotifications) {
        restoreButton = '<button class="restore-btn" onclick="restoreClearedNotifications()"> </button>';
      }
      
      notificationsList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-bell"></i>
          <h3>No Notifications</h3>
          <p>When you receive notifications, they will appear here.</p>
          ${restoreButton}
        </div>
      `;
    }

    // Show error state
    function showErrorState() {
      const notificationsList = document.getElementById('notificationsList');
      notificationsList.innerHTML = `
        <div class="notification-item">
          <div class="notification-details">
            <div class="notification-title">Error loading notifications</div>
            <div class="notification-message">Please check your connection and try again</div>
          </div>
        </div>
      `;
    }

    // Get notification type badge
    function getNotificationTypeBadge(notification) {
      if (notification.recipientRole === 'reporter') {
        return '<span class="notification-type type-reporter">For You</span>';
      } else if (notification.recipientRoles && Array.isArray(notification.recipientRoles)) {
        return '<span class="notification-type type-response">Response Team</span>';
      } else if (notification.recipientId === currentUserId) {
        return '<span class="notification-type type-reporter">Personal</span>';
      } else {
        return '<span class="notification-type type-system">System</span>';
      }
    }

    // Create notification element - UPDATED WITH USER-SPECIFIC INFO
    function createNotificationElement(notification) {
      const notificationItem = document.createElement('div');
      notificationItem.className = `notification-item ${notification.status === 'unread' ? 'unread' : ''}`;
      notificationItem.setAttribute('data-notification-id', notification.id);
      
      // Get appropriate icon based on emergency type
      const iconClass = getNotificationIconClass(notification.type);
      const icon = getNotificationIcon(notification.type);
      const typeBadge = getNotificationTypeBadge(notification);
      
      notificationItem.innerHTML = `
        <div class="notification-icon ${iconClass}">
          <i class="fas ${icon}"></i>
        </div>
        <div class="notification-details">
          <div class="notification-title">
            ${notification.title || 'New Emergency Report'}
            ${typeBadge}
          </div>
          <div class="notification-message">${notification.message || 'Emergency situation reported'}</div>
          <div class="notification-meta">
            <div class="notification-time">${formatTime(notification.timestamp)}</div>
            <div class="notification-actions">
              ${notification.reportId && notification.reportId !== 'undefined' ? 
                `<button class="notification-btn view-details" data-report-id="${notification.reportId}" data-notification-id="${notification.id}">View Details</button>` : 
                ''
              }
              <button class="notification-btn ${notification.status === 'unread' ? 'mark-read' : 'mark-unread'}" data-notification-id="${notification.id}">
                ${notification.status === 'unread' ? 'Mark as Read' : 'Mark as Unread'}
              </button>
            </div>
          </div>
        </div>
      `;
      
      return notificationItem;
    }

    // Helper functions for notifications
    function getNotificationIcon(emergencyType) {
      const icons = {
        fire: 'fa-fire',
        flood: 'fa-water',
        ems: 'fa-ambulance',
        landslide: 'fa-mountain',
        earthquake: 'fa-house-crack',
        storm: 'fa-wave-square'
      };
      return icons[emergencyType] || 'fa-exclamation-triangle';
    }

    function getNotificationIconClass(emergencyType) {
      return `${emergencyType}-icon`;
    }

    function formatTime(timestamp) {
      if (!timestamp) return 'Unknown time';
      
      const now = new Date().getTime();
      const diff = now - timestamp;
      
      if (diff < 60000) { // Less than 1 minute
        return 'Just now';
      } else if (diff < 3600000) { // Less than 1 hour
        const minutes = Math.floor(diff / 60000);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      } else if (diff < 86400000) { // Less than 1 day
        const hours = Math.floor(diff / 3600000);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else {
        const days = Math.floor(diff / 86400000);
        return `${days} day${days > 1 ? 's' : ''} ago`;
      }
    }

    // Mark notification as read/unread
    function toggleNotificationStatus(notificationId, currentStatus) {
      const newStatus = currentStatus === 'unread' ? 'read' : 'unread';
      
      console.log(`Updating notification ${notificationId} to ${newStatus}`);
      
      database.ref('notifications/' + notificationId + '/status').set(newStatus)
        .then(() => {
          console.log(`Notification ${notificationId} marked as ${newStatus}`);
          
          // Update the unread count
          if (newStatus === 'read') {
            unreadNotificationsCount = Math.max(0, unreadNotificationsCount - 1);
          } else {
            unreadNotificationsCount += 1;
          }
          
          // Update the badge
          updateNotificationBadge(unreadNotificationsCount);
          
          // Update the UI immediately
          const notificationElement = document.querySelector(`[data-notification-id="${notificationId}"]`);
          if (notificationElement) {
            if (newStatus === 'read') {
              notificationElement.classList.remove('unread');
            } else {
              notificationElement.classList.add('unread');
            }
            
            // Update the button text
            const button = notificationElement.querySelector('.notification-btn.mark-read, .notification-btn.mark-unread');
            if (button) {
              if (newStatus === 'read') {
                button.textContent = 'Mark as Unread';
                button.classList.remove('mark-read');
                button.classList.add('mark-unread');
              } else {
                button.textContent = 'Mark as Read';
                button.classList.remove('mark-unread');
                button.classList.add('mark-read');
              }
            }
          }
        })
        .catch(error => {
          console.error('Error updating notification status:', error);
          alert('Error updating notification status. Please try again.');
        });
    }

    // Mark notification as read when viewing details
    function markNotificationAsRead(notificationId) {
      console.log(`Marking notification ${notificationId} as read`);
      
      database.ref('notifications/' + notificationId + '/status').set('read')
        .then(() => {
          console.log(`Notification ${notificationId} marked as read`);
          
          // Update the unread count
          unreadNotificationsCount = Math.max(0, unreadNotificationsCount - 1);
          
          // Update the badge
          updateNotificationBadge(unreadNotificationsCount);
          
          // Update the UI immediately
          const notificationElement = document.querySelector(`[data-notification-id="${notificationId}"]`);
          if (notificationElement) {
            notificationElement.classList.remove('unread');
            
            // Update the button text
            const button = notificationElement.querySelector('.notification-btn.mark-read, .notification-btn.mark-unread');
            if (button) {
              button.textContent = 'Mark as Unread';
              button.classList.remove('mark-read');
              button.classList.add('mark-unread');
            }
          }
        })
        .catch(error => {
          console.error('Error marking notification as read:', error);
          // Continue with viewing details even if marking as read fails
        });
    }

    // View report details - UPDATED FUNCTION
    function viewReportDetails(reportId, notificationId) {
      console.log('Viewing report details for:', reportId);
      
      // ALWAYS mark the notification as read first
      if (notificationId) {
        markNotificationAsRead(notificationId);
      }
      
      // Get user role from session storage
      const userRole = localStorage.getItem('role');
      console.log('User role:', userRole);
      
      // Redirect based on user role
      if (userRole && userRole.toLowerCase() === 'response_team') {
        // Response team goes to response page
        console.log('Redirecting response team to response.html');
        window.location.href = `response.html?report=${reportId}`;
      } else {
        // All other users (admin, captain, official, etc.) go to track page
        console.log('Redirecting non-response team user to track.html');
        window.location.href = `track.html?report=${reportId}`;
      }
    }

    // Handle notification actions
    function handleNotificationAction(e) {
      if (e.target.classList.contains('mark-read') || e.target.classList.contains('mark-unread')) {
        const notificationId = e.target.getAttribute('data-notification-id');
        const currentStatus = e.target.classList.contains('mark-read') ? 'unread' : 'read';
        toggleNotificationStatus(notificationId, currentStatus);
      }
      
      if (e.target.classList.contains('view-details')) {
        const reportId = e.target.getAttribute('data-report-id');
        const notificationId = e.target.getAttribute('data-notification-id');
        
        if (reportId && reportId !== 'undefined') {
          viewReportDetails(reportId, notificationId);
        } else {
          alert('Report details not available for this notification.');
        }
      }
    }

    // Check if user is logged in when page loads
    document.addEventListener('DOMContentLoaded', function () {
      if (!checkSession()) {
        // User is not logged in, redirect to login page
        alert('Please log in to access this page.');
        window.location.href = 'index.html';
        return;
      }

      // Check if user has captain role and show the navigation item
      const userRole = localStorage.getItem('role');
      const captainNavItem = document.getElementById('captain-nav-item');
      const responseNavItem = document.getElementById('response-nav-item');
      const homeNavItem = document.getElementById('home-nav-item');
      const responseHomeNavItem = document.getElementById('responsehome-nav-item');

      if (userRole && userRole.toLowerCase() === 'captain' && captainNavItem) {
        captainNavItem.style.display = 'flex';
      }

      if (userRole && userRole.toLowerCase() === 'response_team') {
        if (responseNavItem) responseNavItem.style.display = 'flex';
        if (homeNavItem) homeNavItem.style.display = 'none';
        if (responseHomeNavItem) responseHomeNavItem.style.display = 'flex';
      }

      // Load notifications from Firebase
      loadNotificationsFromFirebase();

      // Add event listener for notification actions using event delegation
      document.getElementById('notificationsList').addEventListener('click', handleNotificationAction);

      // Add event listener for Clear All button
      document.getElementById('clearAllBtn').addEventListener('click', clearAllNotifications);

      // Simple navigation active state
      document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function (e) {
          // Don't prevent default for links
          if (this.getAttribute('href') && this.getAttribute('href') !== '#') {
            return; // Let the link work normally
          }
          e.preventDefault();
          document.querySelectorAll('.nav-item').forEach(nav => {
            nav.classList.remove('active');
          });
          this.classList.add('active');
        });
      });
    });