 // Initialize Firebase
    const app = firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
 let unreadNotificationsCount = 0;
  let currentUserId = null;

  // Update notification badge
  function updateNotificationBadge(count) {
    const notificationNavItem = document.getElementById('notification-nav-item');
    if (!notificationNavItem) return;
    
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

  // Check if notification is for current user
  function isNotificationForCurrentUser(notification) {
    const userId = currentUserId;
    if (!userId) return false;
    
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

  // Load notifications count from Firebase
  function loadNotificationsCount() {
    const notificationsRef = database.ref('notifications');
    currentUserId = localStorage.getItem('userId');
    
    if (!currentUserId) {
      console.log('No user ID found, skipping notification count load');
      return;
    }
    
    notificationsRef.orderByChild('timestamp').limitToLast(100).on('value', (snapshot) => {
      const allNotifications = snapshot.val();
      
      if (allNotifications) {
        // Get user's cleared notifications from localStorage
        const userClearedKey = `clearedNotifications_${currentUserId}`;
        const clearedNotificationIds = JSON.parse(localStorage.getItem(userClearedKey) || '[]');
        
        // Convert to array, filter for current user, and count unread
        const userNotifications = Object.entries(allNotifications)
          .map(([id, notification]) => ({ id, ...notification }))
          .filter(notification => isNotificationForCurrentUser(notification))
          .filter(notification => !clearedNotificationIds.includes(notification.id));
        
        // Count unread notifications
        unreadNotificationsCount = userNotifications.filter(n => n.status === 'unread').length;
        
        // Update the badge
        updateNotificationBadge(unreadNotificationsCount);
        
        console.log(`Notification badge updated: ${unreadNotificationsCount} unread notifications`);
      } else {
        // No notifications found
        unreadNotificationsCount = 0;
        updateNotificationBadge(0);
      }
    }, (error) => {
      console.error('Error loading notification count:', error);
    });
  }

  // Initialize when page loads
  document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const userId = localStorage.getItem('userId');
    
    if (isLoggedIn && userId) {
      loadNotificationsCount();
    } else {
      console.log('User not logged in, notification badge disabled');
    }
  });
    // Global variables
    let map;
    let cameraStream = null;
    let mediaRecorder;
    let recordedChunks = [];
    let capturedPhoto = null;
    let recordedVideo = null;
    let currentEmergencyType = null;
    let userLocation = null;
    let markers = [];
    let currentUser = null;
    let userAddress = null;
    let mapInitialized = false;
    let isUploading = false;
    let currentChatReportId = null;
    let responseTeamMarkers = [];
    let directionsService;
    let directionsRenderer;
    let currentRoute = null;

    // NEW: Variables for response map
    let responseMap = null;
    let responseDirectionsService = null;
    let responseDirectionsRenderer = null;
    let emergencyLocationMarker = null;
    let responseTeamLocationMarker = null;
    let responseMapInitialized = false;

    // Enhanced GPS tracking variables
    let watchPositionId = null;
    let highAccuracyMode = true;
    let bestLocation = null;

    // NEW: Real-time tracking variables
    let responseTeamLocationListener = null;
    let routeUpdateInterval = null;
    const ROUTE_UPDATE_INTERVAL = 2000;

    // NEW: Camera switching variables
    let currentFacingMode = 'environment'; // 'environment' for back camera, 'user' for front
    let availableCameras = [];

    // NEW: Function to create custom pin icon
    function createCustomPinIcon(color) {
      // Create a custom pin icon using SVG
      const svgIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
          <path fill="${color}" d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 25 15 25s15-13.75 15-25c0-8.284-6.716-15-15-15z"/>
          <circle cx="15" cy="15" r="8" fill="#ffffff"/>
        </svg>
      `;
      
      // Convert SVG to data URL
      const svgBlob = new Blob([svgIcon], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      
      return {
        url: svgUrl,
        scaledSize: new google.maps.Size(30, 40),
        anchor: new google.maps.Point(15, 40)
      };
    }

    // Function to check if session is valid
    function checkSession() {
      try {
        const userId = localStorage.getItem('userId');
        const isLoggedIn = localStorage.getItem('isLoggedIn');
        const expirationTime = localStorage.getItem('sessionExpiration');

        console.log('🔍 Session Check:');
        console.log('userId:', userId);
        console.log('isLoggedIn:', isLoggedIn);
        console.log('expirationTime:', expirationTime);

        // Check if user is logged in
        if (!userId || isLoggedIn !== 'true') {
          console.log('❌ Session invalid: User not logged in');
          return false;
        }

        // Check session expiration if it exists
        if (expirationTime) {
          const currentTime = new Date().getTime();
          const expTime = parseInt(expirationTime);

          if (isNaN(expTime)) {
            console.log('⚠️ Invalid expiration time format, continuing with session');
            return true;
          }

          if (currentTime > expTime) {
            console.log('❌ Session expired');
            clearSession();
            return false;
          }
        }

        console.log('✅ Session valid');
        return true;

      } catch (error) {
        console.error('Error checking session:', error);
        return false;
      }
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

    // Function to get current user data
    async function getCurrentUserData() {
      const userId = localStorage.getItem('userId');
      const userRole = localStorage.getItem('role');

      if (!userId || !userRole) {
        console.error('User ID or role not found in session');
        return null;
      }

      try {
        let userPath;
        switch (userRole) {
          case 'admin':
            userPath = `users/admin/${userId}`;
            break;
          case 'captain':
            userPath = `users/barangay_captain/${userId}`;
            break;
          case 'official':
            userPath = `users/barangay_official/${userId}`;
            break;
          case 'response_team':
            userPath = `users/response_team/${userId}`;
            break;
          default:
            console.error('Unknown user role:', userRole);
            return null;
        }

        const snapshot = await database.ref(userPath).once('value');
        const userData = snapshot.val();

        if (userData) {
          currentUser = {
            id: userId,
            role: userRole,
            address: userData.address || '',
            fullname: userData.fullname || '',
            username: userData.username || ''
          };
          userAddress = currentUser.address;
          console.log('Current user loaded:', currentUser);
          return currentUser;
        } else {
          console.error('User data not found for path:', userPath);
          return null;
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        return null;
      }
    }

    // Function to check if user can view a report
    async function canViewReport(reportData) {
      const userRole = currentUser?.role;
      const userId = currentUser?.id;

      console.log('Checking permissions for report:', reportData.id, 'User role:', userRole, 'Report status:', reportData.status);

      if (reportData.userId === userId) {
        console.log('User owns this report - allowing access');
        return true;
      }

      if (userRole === 'admin') {
        console.log('User is admin - allowing access');
        return true;
      }

      if (userRole === 'response_team') {
        console.log('User is response team - allowing access');
        return true;
      }

      if (userRole === 'captain' || userRole === 'official') {
        try {
          const reporterAddress = await getReporterAddress(reportData.userId, reportData.createdBy);
          const canView = reporterAddress === userAddress;
          console.log('Barangay user - address match:', canView, 'User address:', userAddress, 'Reporter address:', reporterAddress);
          return canView;
        } catch (error) {
          console.error('Error checking reporter address:', error);
          return false;
        }
      }

      const canView = reportData.userId === userId;
      console.log('Regular user - owns report:', canView);
      return canView;
    }

    // Function to get reporter's address
    async function getReporterAddress(userId, username) {
      try {
        const userTypes = ['barangay_captain', 'barangay_official', 'response_team'];

        for (const userType of userTypes) {
          const userPath = `users/${userType}/${userId}`;
          const snapshot = await database.ref(userPath).once('value');
          const userData = snapshot.val();

          if (userData) {
            return userData.address || '';
          }
        }

        for (const userType of userTypes) {
          const usersRef = database.ref(`users/${userType}`);
          const snapshot = await usersRef.orderByChild('username').equalTo(username).once('value');
          const users = snapshot.val();

          if (users) {
            const userKey = Object.keys(users)[0];
            return users[userKey].address || '';
          }
        }

        return '';
      } catch (error) {
        console.error('Error getting reporter address:', error);
        return '';
      }
    }

    // Function to get users who should receive notifications
    async function getNotificationRecipients() {
      const recipients = [];
      const currentUserId = currentUser?.id;

      try {
        const adminSnapshot = await database.ref('users/admin').once('value');
        const admins = adminSnapshot.val();
        if (admins) {
          Object.keys(admins).forEach(adminId => {
            if (adminId !== currentUserId) {
              recipients.push({
                id: adminId,
                role: 'admin',
                ...admins[adminId]
              });
            }
          });
        }

        const responseSnapshot = await database.ref('users/response_team').once('value');
        const responseTeams = responseSnapshot.val();
        if (responseTeams) {
          Object.keys(responseTeams).forEach(teamId => {
            if (teamId !== currentUserId && responseTeams[teamId].status === 'approved') {
              recipients.push({
                id: teamId,
                role: 'response_team',
                ...responseTeams[teamId]
              });
            }
          });
        }

        if (userAddress) {
          const captainSnapshot = await database.ref('users/barangay_captain').once('value');
          const captains = captainSnapshot.val();
          if (captains) {
            Object.keys(captains).forEach(captainId => {
              if (captainId !== currentUserId &&
                captains[captainId].address === userAddress &&
                captains[captainId].status === 'approved') {
                recipients.push({
                  id: captainId,
                  role: 'captain',
                  ...captains[captainId]
                });
              }
            });
          }

          const officialSnapshot = await database.ref('users/barangay_official').once('value');
          const officials = officialSnapshot.val();
          if (officials) {
            Object.keys(officials).forEach(officialId => {
              if (officialId !== currentUserId &&
                officials[officialId].address === userAddress &&
                officials[officialId].status === 'approved') {
                recipients.push({
                  id: officialId,
                  role: 'official',
                  ...officials[officialId]
                });
              }
            });
          }
        }

        console.log('Notification recipients (excluding reporter):', recipients);
        return recipients;
      } catch (error) {
        console.error('Error getting notification recipients:', error);
        return recipients;
      }
    }

    // Function to create notification for response teams
    async function createNotificationForResponseTeams(reportData) {
      try {
        const notificationId = `notification_${reportData.id}`;
        const recipients = await getNotificationRecipients();

        const notificationData = {
          id: notificationId,
          title: `${reportData.emergencyType.charAt(0).toUpperCase() + reportData.emergencyType.slice(1)} Reported by ${reportData.createdByName}`,
          message: `An SOS has been triggered regarding a ${reportData.emergencyType} in ${userAddress || 'your area'}`,
          type: reportData.emergencyType,
          location: `Lat: ${reportData.latitude}, Lng: ${reportData.longitude}`,
          reportedBy: reportData.createdByName,
          reportId: reportData.id,
          timestamp: new Date().getTime(),
          formattedTime: new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
          }),
          date: new Date().toISOString().split('T')[0],
          status: 'unread',
          mediaUrl: reportData.mediaUrl,
          mediaType: reportData.mediaType,
          recipientIds: recipients.map(recipient => recipient.id),
          recipientRoles: recipients.map(recipient => recipient.role),
          totalRecipients: recipients.length
        };

        console.log('Creating single notification for', recipients.length, 'recipients');

        await database.ref('notifications/' + notificationId).set(notificationData);

        console.log('Notification created successfully');

        if (Notification.permission === 'granted') {
          showBrowserNotification(
            'Emergency Reported',
            `Your ${reportData.emergencyType} emergency has been reported and notifications sent to response teams.`
          );
        }

      } catch (error) {
        console.error('Error creating notification:', error);
      }
    }

    // Function to create notification for response team when user sends a message
    async function createMessageNotificationForResponseTeam(reportId, messageText) {
      try {
        const notificationId = `notification_${reportId}_message_${Date.now()}`;

        const reportRef = database.ref('reports/' + reportId);
        const snapshot = await reportRef.once('value');
        const reportData = snapshot.val();

        if (!reportData || !reportData.rescueTeams) {
          console.log('No response teams assigned to this report');
          return;
        }

        const currentUserId = localStorage.getItem('userId');
        const userName = localStorage.getItem('fullname') || localStorage.getItem('username');

        Object.entries(reportData.rescueTeams).forEach(async ([teamKey, team]) => {
          if (team.userId === currentUserId) return;

          const teamNotificationId = `${notificationId}_${team.userId}`;

          const notificationData = {
            id: teamNotificationId,
            title: `New Message About ${reportData.emergencyType} Report`,
            message: `${userName} sent a message: "${messageText}"`,
            type: 'message',
            reportId: reportId,
            timestamp: new Date().getTime(),
            formattedTime: new Date().toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: 'numeric',
              hour12: true
            }),
            date: new Date().toISOString().split('T')[0],
            status: 'unread',
            recipientId: team.userId,
            recipientRole: 'response_team',
            senderId: currentUserId,
            senderName: userName,
            emergencyType: reportData.emergencyType
          };

          console.log('Creating message notification for response team:', team.userId);

          await database.ref('notifications/' + teamNotificationId).set(notificationData);

          if (Notification.permission === 'granted') {
            showBrowserNotification(
              'New Message',
              `${userName} sent a message about the ${reportData.emergencyType} emergency`
            );
          }
        });

      } catch (error) {
        console.error('Error creating message notification:', error);
      }
    }

    // Function to listen for response team notifications
    function listenForResponseTeamNotifications() {
      const userId = localStorage.getItem('userId');
      if (!userId) return;

      const notificationsRef = database.ref('notifications');

      notificationsRef.orderByChild('recipientId').equalTo(userId).on('child_added', (snapshot) => {
        const notification = snapshot.val();

        if (notification && notification.actionType &&
          (notification.actionType === 'accepted' || notification.actionType === 'completed')) {

          console.log('Response team notification received:', notification);
          showResponseTeamNotification(notification);
        }
      });

      notificationsRef.orderByChild('recipientRole').equalTo('reporter').on('child_added', (snapshot) => {
        const notification = snapshot.val();
        const currentUserId = localStorage.getItem('userId');

        if (notification && notification.recipientId === currentUserId) {
          console.log('Reporter notification received:', notification);
          showResponseTeamNotification(notification);
        }
      });
    }

    // Function to show response team notification modal
    function showResponseTeamNotification(notification) {
      const modal = document.getElementById('responseNotificationModal');

      document.getElementById('notificationEmergencyType').textContent =
        notification.emergencyType || 'Emergency';
      document.getElementById('notificationReportTime').textContent =
        notification.formattedTime || 'Recently';
      document.getElementById('notificationLocation').textContent =
        notification.location || 'Your reported location';
      document.getElementById('responseTeamName').textContent =
        notification.responseTeamName || 'Response Team';
      document.getElementById('estimatedTime').textContent =
        '15-20 minutes';
      document.getElementById('responseDistance').textContent =
        'Calculating...';

      currentChatReportId = notification.reportId;

      modal.style.display = 'flex';

      initializeResponseMap(notification.reportId);

      startRealTimeUpdates(notification.reportId);
    }

    // Function to initialize response map in the modal
    function initializeResponseMap(reportId) {
      if (!responseMapInitialized) {
        responseDirectionsService = new google.maps.DirectionsService();
        responseDirectionsRenderer = new google.maps.DirectionsRenderer();

        const mapOptions = {
          zoom: 12,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true
        };

        responseMap = new google.maps.Map(document.getElementById('responseMap'), mapOptions);
        responseDirectionsRenderer.setMap(responseMap);
        responseMapInitialized = true;
      }

      database.ref('reports/' + reportId).once('value').then((snapshot) => {
        const reportData = snapshot.val();
        if (reportData) {
          const emergencyLocation = {
            lat: parseFloat(reportData.latitude),
            lng: parseFloat(reportData.longitude)
          };

          if (emergencyLocationMarker) {
            emergencyLocationMarker.setMap(null);
          }

          // Use custom pin icon for emergency location
          emergencyLocationMarker = new google.maps.Marker({
            position: emergencyLocation,
            map: responseMap,
            title: 'Emergency Location',
            icon: createCustomPinIcon('#FF0000') // Red pin for emergency
          });

          responseMap.setCenter(emergencyLocation);
        }
      });
    }

    // Function to update response team location on the map
    function updateResponseTeamLocationOnMap(teamLocation, reportId) {
      if (!responseMap || !responseMapInitialized) return;

      database.ref('reports/' + reportId).once('value').then((snapshot) => {
        const reportData = snapshot.val();
        if (!reportData) return;

        const emergencyLocation = {
          lat: parseFloat(reportData.latitude),
          lng: parseFloat(reportData.longitude)
        };

        if (responseTeamLocationMarker) {
          responseTeamLocationMarker.setMap(null);
        }

        // Use custom pin icon for response team location
        responseTeamLocationMarker = new google.maps.Marker({
          position: teamLocation,
          map: responseMap,
          title: 'Response Team Location',
          icon: createCustomPinIcon('#28a745'), // Green pin for response team
          animation: google.maps.Animation.BOUNCE
        });

        calculateRouteOnResponseMap(teamLocation, emergencyLocation);
      });
    }

    // Function to calculate route on response map
    function calculateRouteOnResponseMap(startLocation, endLocation) {
      if (!responseDirectionsService || !responseDirectionsRenderer) return;

      const request = {
        origin: startLocation,
        destination: endLocation,
        travelMode: 'DRIVING',
        provideRouteAlternatives: true
      };

      responseDirectionsService.route(request, function (result, status) {
        if (status === 'OK') {
          const bestRoute = selectOptimalRoute(result.routes, startLocation, endLocation);

          const bestRouteResult = {
            ...result,
            routes: [bestRoute]
          };

          responseDirectionsRenderer.setDirections(bestRouteResult);

          const route = bestRoute.legs[0];

          document.getElementById('estimatedTime').textContent = route.duration.text;
          document.getElementById('responseDistance').textContent = route.distance.text;

          updateRouteSteps(route.steps);

          const bounds = new google.maps.LatLngBounds();
          bounds.extend(startLocation);
          bounds.extend(endLocation);
          responseMap.fitBounds(bounds);
        }
      });
    }

    // Hybrid Dijkstra's + A* algorithm for optimal route selection
    function selectOptimalRoute(routes, start, end) {
      if (routes.length === 1) return routes[0];

      console.log('Using hybrid algorithm to select optimal route from', routes.length, 'options');

      let bestRoute = routes[0];
      let bestScore = calculateHybridRouteScore(routes[0], start, end);

      for (let i = 1; i < routes.length; i++) {
        const currentScore = calculateHybridRouteScore(routes[i], start, end);
        if (currentScore > bestScore) {
          bestRoute = routes[i];
          bestScore = currentScore;
        }
      }

      console.log('Selected route with score:', bestScore);
      return bestRoute;
    }

    // Calculate hybrid route score using Dijkstra's (distance) and A* (heuristic) principles
    function calculateHybridRouteScore(route, start, end) {
      const leg = route.legs[0];
      let score = 0;

      const distance = leg.distance.value;
      const normalizedDistance = 1 / (distance / 1000);
      score += normalizedDistance * 40;

      const duration = leg.duration.value;
      const normalizedDuration = 1 / (duration / 60);
      score += normalizedDuration * 40;

      const complexityPenalty = Math.min(route.legs[0].steps.length * 0.3, 15);
      score -= complexityPenalty;

      if (leg.duration_in_traffic) {
        const trafficDuration = leg.duration_in_traffic.value;
        const trafficRatio = duration / trafficDuration;
        score += trafficRatio * 5;
      }

      const hasHighway = route.legs[0].steps.some(step =>
        step.instructions.toLowerCase().includes('highway') ||
        step.instructions.toLowerCase().includes('freeway')
      );

      if (distance > 10000 && hasHighway) {
        score += 10;
      } else if (distance <= 5000 && !hasHighway) {
        score += 5;
      }

      return score;
    }

    // FIXED: Function to start real-time updates for ETA and distance
    function startRealTimeUpdates(reportId) {
      // Clear any existing interval
      if (routeUpdateInterval) {
        clearInterval(routeUpdateInterval);
        routeUpdateInterval = null;
      }

      // Clear any existing listener - FIXED: Use proper Firebase unsubscribe
      if (responseTeamLocationListener) {
        responseTeamLocationListener(); // Call the unsubscribe function
        responseTeamLocationListener = null;
      }

      // Listen for response team locations - store the unsubscribe function
      responseTeamLocationListener = database.ref('reports/' + reportId + '/rescueTeams').on('value', (snapshot) => {
        const rescueTeams = snapshot.val();
        if (rescueTeams) {
          Object.entries(rescueTeams).forEach(([teamKey, team]) => {
            if (team.location) {
              const teamLocation = {
                lat: team.location.latitude,
                lng: team.location.longitude
              };

              updateResponseTeamLocationOnMap(teamLocation, reportId);
            }
          });
        }
      });

      // Set up interval for continuous route updates
      routeUpdateInterval = setInterval(() => {
        updateRouteForAllResponseTeams(reportId);
      }, ROUTE_UPDATE_INTERVAL);
    }

    // Function to update route for all response teams
    function updateRouteForAllResponseTeams(reportId) {
      database.ref('reports/' + reportId + '/rescueTeams').once('value').then((snapshot) => {
        const rescueTeams = snapshot.val();
        if (rescueTeams) {
          Object.entries(rescueTeams).forEach(([teamKey, team]) => {
            if (team.location) {
              const teamLocation = {
                lat: team.location.latitude,
                lng: team.location.longitude
              };

              calculateLiveETA(teamLocation, reportId);
            }
          });
        }
      });
    }

    // Function to calculate live ETA and distance
    function calculateLiveETA(teamLocation, reportId) {
      database.ref('reports/' + reportId).once('value').then((snapshot) => {
        const reportData = snapshot.val();
        if (!reportData) return;

        const emergencyLocation = {
          lat: parseFloat(reportData.latitude),
          lng: parseFloat(reportData.longitude)
        };

        const request = {
          origin: teamLocation,
          destination: emergencyLocation,
          travelMode: 'DRIVING',
          provideRouteAlternatives: true
        };

        if (responseDirectionsService) {
          responseDirectionsService.route(request, function (result, status) {
            if (status === 'OK') {
              const bestRoute = selectOptimalRoute(result.routes, teamLocation, emergencyLocation);
              const route = bestRoute.legs[0];

              document.getElementById('estimatedTime').textContent = route.duration.text;
              document.getElementById('responseDistance').textContent = route.distance.text;
            }
          });
        }
      });
    }

    // Function to update route steps in the modal
    function updateRouteSteps(steps) {
      const routeStepsContainer = document.getElementById('routeStepsContainer');
      routeStepsContainer.innerHTML = '';

      steps.slice(0, 5).forEach((step, index) => {
        const stepElement = document.createElement('div');
        stepElement.className = 'route-step';
        stepElement.innerHTML = `
          <div class="step-marker">${index + 1}</div>
          <div class="step-details">
            <div class="step-instruction">${stripHtml(step.instructions)}</div>
            <div class="step-distance">${step.distance.text} · ${step.duration.text}</div>
          </div>
        `;
        routeStepsContainer.appendChild(stepElement);
      });
    }

    // Function to strip HTML from instructions
    function stripHtml(html) {
      const tmp = document.createElement("DIV");
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || "";
    }

    // Function to show browser notification
    function showBrowserNotification(title, body) {
      if (Notification.permission === 'granted') {
        const notification = new Notification(title, {
          body: body,
          icon: 'https://cdn-icons-png.flaticon.com/512/124/124555.png',
          badge: 'https://cdn-icons-png.flaticon.com/512/124/124555.png'
        });

        notification.onclick = function () {
          window.focus();
          notification.close();
        };
      }
    }

    // NEW: Function to get available cameras
    async function getAvailableCameras() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log('Available cameras:', videoDevices);
        return videoDevices;
      } catch (error) {
        console.error('Error enumerating cameras:', error);
        return [];
      }
    }

    // NEW: Function to switch camera
    async function switchCamera() {
      if (!cameraStream) return;

      // Stop current stream
      cameraStream.getTracks().forEach(track => track.stop());

      // Switch facing mode
      currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';

      // Update camera indicator
      document.getElementById('cameraIndicator').textContent =
        `Using: ${currentFacingMode === 'environment' ? 'Back Camera' : 'Front Camera'}`;

      // Start new stream with switched camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: currentFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: true
        });

        cameraStream = stream;

        const photoPreview = document.getElementById('photoPreview');
        const videoPreview = document.getElementById('videoPreview');

        photoPreview.srcObject = stream;
        videoPreview.srcObject = stream;

        console.log(`Switched to ${currentFacingMode} camera`);
      } catch (error) {
        console.error("Error switching camera: ", error);
        alert("Cannot switch camera. Please check your permissions.");
        // Revert to previous facing mode
        currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
      }
    }

    // NEW: Messaging functionality
    function openMessagingModal() {
      if (!currentChatReportId) return;

      document.getElementById('messagingModal').style.display = 'flex';
      document.getElementById('messageInput').focus();

      loadMessages(currentChatReportId);
    }

    function closeMessagingModal() {
      document.getElementById('messagingModal').style.display = 'none';
    }

    function loadMessages(reportId) {
      const messagingBody = document.getElementById('messagingBody');
      messagingBody.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading messages...</div>';

      database.ref('messages/' + reportId).on('value', (snapshot) => {
        const messagesData = snapshot.val();
        messagingBody.innerHTML = '';

        if (messagesData) {
          const messages = Object.values(messagesData).sort((a, b) => a.timestamp - b.timestamp);

          messages.forEach(message => {
            const messageElement = document.createElement('div');
            const isCurrentUser = message.senderId === localStorage.getItem('userId');

            messageElement.className = `message ${isCurrentUser ? 'sent' : 'received'}`;
            messageElement.innerHTML = `
              <div class="message-sender">${message.senderName}</div>
              <div>${message.text}</div>
              <div class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</div>
            `;

            messagingBody.appendChild(messageElement);
          });

          messagingBody.scrollTop = messagingBody.scrollHeight;
        } else {
          messagingBody.innerHTML = '<div class="no-teams">No messages yet. Start the conversation!</div>';
        }
      });
    }

    function sendMessage() {
      if (!currentChatReportId) return;

      const messageInput = document.getElementById('messageInput');
      const messageText = messageInput.value.trim();

      if (!messageText) return;

      const userId = localStorage.getItem('userId');
      const userName = localStorage.getItem('fullname') || localStorage.getItem('username');
      const timestamp = new Date().getTime();
      const messageId = `message_${timestamp}`;

      const messageData = {
        id: messageId,
        text: messageText,
        senderId: userId,
        senderName: userName,
        timestamp: timestamp,
        reportId: currentChatReportId
      };

      database.ref('messages/' + currentChatReportId + '/' + messageId).set(messageData)
        .then(() => {
          console.log('Message sent successfully');
          messageInput.value = '';

          createMessageNotificationForResponseTeam(currentChatReportId, messageText);
        })
        .catch((error) => {
          console.error('Error sending message:', error);
          alert('Error sending message. Please try again.');
        });
    }

    // Enhanced GPS tracking with high accuracy
    function startHighAccuracyTracking() {
      if (!navigator.geolocation) {
        console.error("Geolocation is not supported by this browser.");
        return;
      }

      if (watchPositionId !== null) {
        navigator.geolocation.clearWatch(watchPositionId);
      }

      watchPositionId = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
          };

          console.log(`High-precision location: Lat=${newLocation.lat}, Lng=${newLocation.lng}, Accuracy=${newLocation.accuracy}m`);

          userLocation = newLocation;

          if (!bestLocation || position.coords.accuracy < bestLocation.accuracy) {
            bestLocation = newLocation;
            console.log(`Best location updated: ${bestLocation.accuracy}m accuracy`);
          }

        },
        (error) => {
          console.error("Error getting high accuracy location: ", error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }

    // Check if user is logged in when page loads
    document.addEventListener('DOMContentLoaded', async function () {
      if (!checkSession()) {
        alert('Please log in to access this page.');
        window.location.href = 'index.html';
        return;
      }

      currentUser = await getCurrentUserData();
      if (!currentUser) {
        alert('Error loading user data. Please log in again.');
        window.location.href = 'index.html';
        return;
      }

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

      if (!mapInitialized && typeof google !== 'undefined') {
        initMap();
      }

      listenForResponseTeamNotifications();
    });

    // Function to get marker color based on emergency type
    function getMarkerColor(emergencyType) {
      const colors = {
        fire: '#B80F0A',
        flood: '#007BFF',
        ems: '#28A745',
        landslide: '#834010',
        earthquake: '#FF8C00',
        storm: '#008080'
      };
      return colors[emergencyType] || '#000000';
    }

    // Function to get marker icon based on emergency type
    function getMarkerIcon(emergencyType) {
      const color = getMarkerColor(emergencyType);
      return createCustomPinIcon(color);
    }

    // Function to add marker to map and set up click handler
    function addMarker(reportData) {
      if (!map) {
        console.error('Map not initialized');
        return null;
      }

      const position = {
        lat: parseFloat(reportData.latitude),
        lng: parseFloat(reportData.longitude)
      };

      if (isNaN(position.lat) || isNaN(position.lng)) {
        console.error('Invalid coordinates for report:', reportData);
        return null;
      }

      const marker = new google.maps.Marker({
        position: position,
        map: map,
        title: reportData.title || 'Emergency Report',
        icon: getMarkerIcon(reportData.emergencyType)
      });

      const infoWindowContent = `
        <div style="padding: 10px; max-width: 250px;">
          <h3 style="margin: 0 0 10px 0; color: #333;">${reportData.title || 'Emergency Report'}</h3>
          <p style="margin: 5px 0;"><strong>Type:</strong> ${reportData.emergencyType || 'Unknown'}</p>
          <p style="margin: 5px 0;"><strong>Reported by:</strong> ${reportData.createdByName || 'Unknown'}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${reportData.formattedTime || reportData.time || 'Unknown'}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> ${reportData.status || 'reported'}</p>
          ${reportData.mediaUrl ? `
            <div style="margin-top: 10px;">
              ${reportData.mediaType === 'image' ?
            `<img src="${reportData.mediaUrl}" style="max-width: 100%; height: auto; border-radius: 5px; cursor: pointer;" alt="Emergency photo" onclick="showReportModal('${reportData.id}')">` :
            `<video src="${reportData.mediaUrl}" style="max-width: 100%; height: auto; border-radius: 5px; cursor: pointer;" alt="Emergency video" onclick="showReportModal('${reportData.id}')" controls></video>`
          }
              <p style="margin-top: 5px; font-size: 12px; color: #666;">Click media to view details</p>
            </div>
          ` : ''}
          <button onclick="showReportModal('${reportData.id}')" style="margin-top: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">View Details</button>
        </div>
      `;

      const infoWindow = new google.maps.InfoWindow({
        content: infoWindowContent
      });

      marker.addListener('click', () => {
        markers.forEach(m => {
          if (m.infoWindow) m.infoWindow.close();
        });
        infoWindow.open(map, marker);
        marker.infoWindow = infoWindow;
      });

      marker.reportData = reportData;

      markers.push(marker);
      return marker;
    }
function createBlueBorderPin(fillColor = '#FFFFFF') {
  return {
    url:
      "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent(`
        <svg width="32" height="48" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
          <!-- Outer pin with smooth curve -->
          <path 
            d="M12 1
               C7 1 3 6 3 11
               C3 20 12 35 12 35
               C12 35 21 20 21 11
               C21 6 17 1 12 1Z"
            fill="${fillColor}"
            stroke="#007BFF"
            stroke-width="2"
            stroke-linejoin="round"
          />
          
          <!-- Inner circle highlight -->
          <circle cx="12" cy="11" r="4" fill="white" opacity="0.8"/>
          
          <!-- Subtle shadow / depth -->
          <ellipse cx="12" cy="35" rx="4" ry="1.5" fill="rgba(0,0,0,0.2)"/>
        </svg>
      `),
    scaledSize: new google.maps.Size(32, 48),
  };
}


    // Function to load reports from Firebase and add markers
    function loadReportsFromFirebase() {
      if (!map) {
        console.error('Map not initialized, cannot load reports');
        return;
      }

      const reportsRef = database.ref('reports');

      reportsRef.on('value', async (snapshot) => {
        markers.forEach(marker => marker.setMap(null));
        markers = [];

        const reports = snapshot.val();
        console.log('Loaded reports from Firebase:', reports);

        if (reports) {
          const reportPromises = Object.entries(reports).map(async ([reportId, report]) => {
            report.id = reportId;

            if (report.latitude && report.longitude) {
              try {
                const canView = await canViewReport(report);
                const isPending = report.status === 'pending';

                if (canView && isPending) {
                  console.log('Adding marker for report:', reportId, 'Status:', report.status);
                  addMarker(report);
                } else {
                  if (!canView) {
                    console.log('User cannot view report:', reportId, 'Status:', report.status);
                  } else if (!isPending) {
                    console.log('Report status is not pending, skipping:', reportId, 'Status:', report.status);
                  }
                }
              } catch (error) {
                console.error('Error processing report:', reportId, error);
              }
            } else {
              console.warn('Report missing coordinates:', reportId, report);
            }
          });

          await Promise.all(reportPromises);
          console.log(`Total markers added: ${markers.length}`);
        } else {
          console.log('No reports found in database');
        }
      }, (error) => {
        console.error('Error loading reports:', error);
      });
    }

    // Function to show report modal
    async function showReportModal(reportId) {
      let reportData = null;
      for (let marker of markers) {
        if (marker.reportData && marker.reportData.id === reportId) {
          reportData = marker.reportData;
          break;
        }
      }

      if (!reportData) {
        console.log('Report data not found in markers, checking Firebase...');
        const reportRef = database.ref('reports/' + reportId);
        const snapshot = await reportRef.once('value');
        const data = snapshot.val();
        if (data) {
          const canView = await canViewReport(data);
          if (canView) {
            reportData = data;
          } else {
            alert('You do not have permission to view this report.');
            return;
          }
        } else {
          console.error('Report data not found for ID:', reportId);
          return;
        }
      }

      showReportModalWithData(reportData);
    }

    // Function to show report modal with data
    async function showReportModalWithData(reportData) {
      const modal = document.getElementById('reportModal');
      const mediaContainer = document.getElementById('reportMediaContainer');

      const reporterAddress = await getReporterAddress(reportData.userId, reportData.createdBy);

      document.getElementById('reportTitle').textContent = reportData.title || 'Emergency Report';
      document.getElementById('reportType').textContent = reportData.emergencyType || 'Unknown';
      document.getElementById('reportReporter').textContent = reportData.createdByName || 'Unknown User';
      document.getElementById('reportTime').textContent = reportData.formattedTime || reportData.time || 'Unknown';
      document.getElementById('reportDate').textContent = reportData.date || 'Unknown';
      document.getElementById('reportStatus').textContent = reportData.status || 'reported';

      document.getElementById('reportLocation').textContent =
        `Lat: ${parseFloat(reportData.latitude).toFixed(14)}, Lng: ${parseFloat(reportData.longitude).toFixed(14)}`;

      document.getElementById('reportAddress').textContent = reporterAddress || 'Unknown';

      mediaContainer.innerHTML = '';

      if (reportData.mediaUrl) {
        if (reportData.mediaType === 'image') {
          const img = document.createElement('img');
          img.src = reportData.mediaUrl;
          img.alt = 'Emergency photo';
          mediaContainer.appendChild(img);
        } else if (reportData.mediaType === 'video') {
          const video = document.createElement('video');
          video.src = reportData.mediaUrl;
          video.controls = true;
          video.alt = 'Emergency video';
          mediaContainer.appendChild(video);
        }
      } else {
        mediaContainer.innerHTML = '<p>No media available for this report</p>';
      }

      modal.style.display = 'flex';
    }

    function initMap() {
      console.log('Initializing map...');

      const defaultLocation = { lat: 7.7844, lng: 122.5861 };

      try {
        map = new google.maps.Map(document.getElementById('map'), {
          zoom: 12,
          center: defaultLocation,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'on' }]
            }
          ]
        });

        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
          map: map,
          suppressMarkers: true,
          preserveViewport: false,
          polylineOptions: {
            strokeColor: '#4285f4',
            strokeOpacity: 0.8,
            strokeWeight: 6
          }
        });

        mapInitialized = true;
        console.log('Map initialized successfully');

        startHighAccuracyTracking();

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              };

              bestLocation = userLocation;

              map.setCenter(userLocation);

              // Use custom pin icon for user location
              new google.maps.Marker({
                position: userLocation,
                map: map,
                title: 'Your Current Location',
                icon: createBlueBorderPin('#757574'),
                animation: google.maps.Animation.DROP // Blue pin for user location
              });

              console.log(`Initial high-accuracy location: Lat=${userLocation.lat}, Lng=${userLocation.lng}`);
            },
            (error) => {
              console.error("Error getting location: ", error);
              userLocation = defaultLocation;
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            }
          );
        } else {
          console.error("Geolocation is not supported by this browser.");
          userLocation = defaultLocation;
        }

        loadReportsFromFirebase();

      } catch (error) {
        console.error('Error initializing map:', error);
        document.getElementById('map').innerHTML = `
          <div style="display: flex; justify-content: center; align-items: center; height: 100%; background: #f0f0f0; color: #666; font-family: Arial, sans-serif;">
            <div style="text-align: center;">
              <h3>Map Loading Error</h3>
              <p>Unable to load Google Maps. Please check your API key and internet connection.</p>
              <p>Error: ${error.message}</p>
            </div>
          </div>
        `;
      }
    }

    // Fallback map initialization if callback fails
    setTimeout(function () {
      if (!mapInitialized && typeof google !== 'undefined') {
        console.log('Manual map initialization...');
        initMap();
      } else if (!mapInitialized) {
        console.error('Google Maps API failed to load');
        document.getElementById('map').innerHTML = `
          <div style="display: flex; justify-content: center; align-items: center; height: 100%; background: #f0f0f0; color: #666; font-family: Arial, sans-serif;">
            <div style="text-align: center;">
              <h3>Map Unavailable</h3>
              <p>Google Maps failed to load. Please check your API key configuration.</p>
            </div>
          </div>
        `;
      }
    }, 3000);

    // Function to save data to Firebase with high-precision coordinates
    async function saveToFirebase(mediaUrl, mediaType) {
      try {
        const timestamp = new Date().getTime();
        const eventId = `event_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
        const userId = localStorage.getItem('userId');
        const username = localStorage.getItem('username');
        const fullname = localStorage.getItem('fullname');

        const reportLocation = bestLocation || userLocation;

        const eventData = {
          id: eventId,
          createdAt: new Date().toISOString(),
          createdBy: username || 'unknown',
          createdByName: fullname || 'Unknown User',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          formattedTime: new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
          }),
          title: `${currentEmergencyType.charAt(0).toUpperCase() + currentEmergencyType.slice(1)} Emergency Report`,
          location: `Lat: ${reportLocation.lat}, Lng: ${reportLocation.lng}`,
          updatedAt: new Date().toISOString(),
          mediaUrl: mediaUrl,
          mediaType: mediaType,
          longitude: reportLocation.lng,
          latitude: reportLocation.lat,
          emergencyType: currentEmergencyType,
          userId: userId,
          status: 'pending'
        };

        console.log('Saving to Firebase with high-precision location:', eventData);

        await database.ref('reports/' + eventId).set(eventData);
        console.log('Data saved to Firebase successfully');

        await createNotificationForResponseTeams(eventData);

        return eventId;
      } catch (error) {
        console.error('Error saving to Firebase:', error);
        throw error;
      }
    }

    // Function to show upload status
    function showUploadStatus(message, type) {
      let statusElement = document.getElementById('uploadStatus');
      if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.id = 'uploadStatus';
        statusElement.style.cssText = `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          padding: 15px 20px;
          border-radius: 5px;
          color: white;
          font-weight: bold;
          z-index: 10000;
          max-width: 80%;
          text-align: center;
        `;
        document.body.appendChild(statusElement);
      }

      statusElement.textContent = message;
      statusElement.style.backgroundColor = type === 'success' ? '#4CAF50' : '#f44336';
      statusElement.style.display = 'block';

      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 3000);
    }

    // IMPROVED: Open Camera Modal + Start Camera with better error handling
    function openCameraModal(emergencyType) {
      if (isUploading) {
        showUploadStatus('Please wait, upload in progress...', 'error');
        return;
      }

      currentEmergencyType = emergencyType;
      const modal = document.getElementById('cameraModal');
      modal.style.display = 'flex';

      document.querySelector('.camera-header h3').textContent =
        `Document ${emergencyType.charAt(0).toUpperCase() + emergencyType.slice(1)} Emergency`;

      resetCameraUI();

      // Reset camera to back camera by default
      currentFacingMode = 'environment';
      document.getElementById('cameraIndicator').textContent = 'Using: Back Camera';

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: currentFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: true
        })
          .then(stream => {
            cameraStream = stream;

            const photoPreview = document.getElementById('photoPreview');
            const videoPreview = document.getElementById('videoPreview');

            photoPreview.srcObject = stream;
            videoPreview.srcObject = stream;
          })
          .catch(err => {
            console.error("Error accessing camera: ", err);
            alert("Cannot access camera. Please check your permissions and try again.");
            closeCameraModal();
          });
      } else {
        alert("Your browser doesn't support camera access.");
        closeCameraModal();
      }
    }

    // NEW FUNCTION: Reset camera UI to initial state
    function resetCameraUI() {
      document.getElementById('photoActionButtons').classList.remove('active');
      document.getElementById('videoActionButtons').classList.remove('active');
      document.getElementById('capturePhoto').style.display = 'flex';
      document.getElementById('startRecording').style.display = 'flex';
      document.getElementById('stopRecording').style.display = 'none';
      document.getElementById('stopRecording').disabled = true;
      document.getElementById('startRecording').disabled = false;

      const photoPreview = document.getElementById('photoPreview');
      const videoPreview = document.getElementById('videoPreview');
      photoPreview.style.display = 'block';
      videoPreview.style.display = 'block';
      videoPreview.controls = false;

      const capturedImg = document.querySelector('#photoPreviewContainer img');
      if (capturedImg) capturedImg.remove();

      capturedPhoto = null;
      recordedVideo = null;
      recordedChunks = [];

      document.getElementById('sendPhoto').innerHTML = '<i class="fas fa-paper-plane"></i> Send';
      document.getElementById('sendPhoto').disabled = false;
      document.getElementById('sendVideo').innerHTML = '<i class="fas fa-paper-plane"></i> Send';
      document.getElementById('sendVideo').disabled = false;
    }

    // IMPROVED: Close Camera Modal + Stop Streams with better cleanup
    function closeCameraModal() {
      const modal = document.getElementById('cameraModal');
      modal.style.display = 'none';

      if (cameraStream) {
        cameraStream.getTracks().forEach(track => {
          track.stop();
        });
        cameraStream = null;
      }

      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }

      capturedPhoto = null;
      recordedVideo = null;
      recordedChunks = [];
      currentEmergencyType = null;
      isUploading = false;

      console.log('Camera modal closed and resources cleaned up');
    }

    document.getElementById("capturePhoto").addEventListener("click", () => {
      const video = document.getElementById("photoPreview");
      const canvas = document.getElementById("photoCanvas");
      const ctx = canvas.getContext("2d");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      capturedPhoto = canvas.toDataURL("image/jpeg", 0.8);

      document.getElementById('capturePhoto').style.display = 'none';
      document.getElementById('photoActionButtons').classList.add('active');

      video.style.display = 'none';
      const img = document.createElement('img');
      img.src = capturedPhoto;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      document.getElementById('photoPreviewContainer').prepend(img);
    });

    document.getElementById("retakePhoto").addEventListener("click", () => {
      document.getElementById('photoActionButtons').classList.remove('active');
      document.getElementById('capturePhoto').style.display = 'flex';

      const img = document.querySelector('#photoPreviewContainer img');
      if (img) img.remove();

      const video = document.getElementById("photoPreview");
      video.style.display = 'block';

      capturedPhoto = null;
    });

    // IMPROVED: Send Photo with better error handling and state management
    document.getElementById("sendPhoto").addEventListener("click", async () => {
      if (capturedPhoto && !isUploading) {
        const sendButton = document.getElementById('sendPhoto');

        try {
          isUploading = true;
          sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
          sendButton.disabled = true;

          const response = await fetch(capturedPhoto);
          const blob = await response.blob();

          const userId = localStorage.getItem('userId');
          const fileName = `disaster/${userId}_${Date.now()}.jpg`;

          const file = new File([blob], fileName, { type: 'image/jpeg' });

          const { data, error } = await supabaseClient.storage
            .from(supabaseConfig.bucketName)
            .upload(fileName, file);

          if (error) {
            throw new Error(error.message);
          }

          const { data: urlData } = supabaseClient.storage
            .from(supabaseConfig.bucketName)
            .getPublicUrl(data.path);

          await saveToFirebase(urlData.publicUrl, 'image');

          showUploadStatus('Emergency reported successfully! Notification sent to response teams.', 'success');

          setTimeout(() => {
            closeCameraModal();
          }, 1500);

        } catch (error) {
          console.error('Error uploading file:', error);
          showUploadStatus('Error reporting emergency: ' + error.message, 'error');

          sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> Send';
          sendButton.disabled = false;
          isUploading = false;
        }
      }
    });

    // Start Recording
    document.getElementById("startRecording").addEventListener("click", () => {
      if (!cameraStream || isUploading) return;

      recordedChunks = [];
      mediaRecorder = new MediaRecorder(cameraStream);
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        recordedVideo = new Blob(recordedChunks, { type: "video/webm" });

        document.getElementById('stopRecording').style.display = 'none';
        document.getElementById('videoActionButtons').classList.add('active');

        const videoPreview = document.getElementById("videoPreview");
        videoPreview.srcObject = null;
        videoPreview.src = URL.createObjectURL(recordedVideo);
        videoPreview.controls = true;
      };

      mediaRecorder.start();
      document.getElementById("startRecording").disabled = true;
      document.getElementById("stopRecording").disabled = false;
      document.getElementById("startRecording").style.display = 'none';
      document.getElementById("stopRecording").style.display = 'flex';
    });

    // Stop Recording
    document.getElementById("stopRecording").addEventListener("click", () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        document.getElementById("startRecording").disabled = false;
        document.getElementById("stopRecording").disabled = true;
      }
    });

    // IMPROVED: Send Video with better error handling and state management
    document.getElementById("sendVideo").addEventListener("click", async () => {
      if (recordedVideo && !isUploading) {
        const sendButton = document.getElementById('sendVideo');

        try {
          isUploading = true;
          sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
          sendButton.disabled = true;

          const userId = localStorage.getItem('userId');
          const fileName = `disaster/${userId}_${Date.now()}.webm`;

          const file = new File([recordedVideo], fileName, { type: 'video/webm' });

          const { data, error } = await supabaseClient.storage
            .from(supabaseConfig.bucketName)
            .upload(fileName, file);

          if (error) {
            throw new Error(error.message);
          }

          const { data: urlData } = supabaseClient.storage
            .from(supabaseConfig.bucketName)
            .getPublicUrl(data.path);

          await saveToFirebase(urlData.publicUrl, 'video');

          showUploadStatus('Emergency reported successfully! Notification sent to response teams.', 'success');

          setTimeout(() => {
            closeCameraModal();
          }, 1500);

        } catch (error) {
          console.error('Error uploading file:', error);
          showUploadStatus('Error reporting emergency: ' + error.message, 'error');

          sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> Send';
          sendButton.disabled = false;
          isUploading = false;
        }
      }
    });

    // Cancel Video
    document.getElementById("cancelVideo").addEventListener("click", () => {
      document.getElementById('videoActionButtons').classList.remove('active');
      document.getElementById('startRecording').style.display = 'flex';

      const videoPreview = document.getElementById("videoPreview");
      videoPreview.srcObject = cameraStream;
      videoPreview.controls = false;

      recordedVideo = null;
    });

    // NEW: Switch Camera Button
    document.getElementById('switchCamera').addEventListener('click', switchCamera);

    // FIXED: Close response notification modal
    document.getElementById('closeResponseNotification').addEventListener('click', function () {
      document.getElementById('responseNotificationModal').style.display = 'none';

      // FIXED: Proper Firebase listener cleanup
      if (responseTeamLocationListener) {
        responseTeamLocationListener(); // Call the unsubscribe function
        responseTeamLocationListener = null;
      }
      if (routeUpdateInterval) {
        clearInterval(routeUpdateInterval);
        routeUpdateInterval = null;
      }
    });

    // FIXED: Acknowledge notification
    document.getElementById('acknowledgeNotification').addEventListener('click', function () {
      document.getElementById('responseNotificationModal').style.display = 'none';
      showUploadStatus('Notification acknowledged. Stay safe!', 'success');

      // FIXED: Proper Firebase listener cleanup
      if (responseTeamLocationListener) {
        responseTeamLocationListener(); // Call the unsubscribe function
        responseTeamLocationListener = null;
      }
      if (routeUpdateInterval) {
        clearInterval(routeUpdateInterval);
        routeUpdateInterval = null;
      }
    });

    // FIXED: View emergency details
    document.getElementById('viewEmergencyDetails').addEventListener('click', function () {
      document.getElementById('responseNotificationModal').style.display = 'none';
      alert('Pending');

      // FIXED: Proper Firebase listener cleanup
      if (responseTeamLocationListener) {
        responseTeamLocationListener(); // Call the unsubscribe function
        responseTeamLocationListener = null;
      }
      if (routeUpdateInterval) {
        clearInterval(routeUpdateInterval);
        routeUpdateInterval = null;
      }
    });

    // FIXED: Close response notification when clicking outside
    document.getElementById('responseNotificationModal').addEventListener('click', function (e) {
      if (e.target === this) {
        this.style.display = 'none';

        // FIXED: Proper Firebase listener cleanup
        if (responseTeamLocationListener) {
          responseTeamLocationListener(); // Call the unsubscribe function
          responseTeamLocationListener = null;
        }
        if (routeUpdateInterval) {
          clearInterval(routeUpdateInterval);
          routeUpdateInterval = null;
        }
      }
    });

    // NEW: Open messaging modal
    document.getElementById('openMessagingBtn').addEventListener('click', function () {
      openMessagingModal();
    });

    // NEW: Close messaging modal
    document.getElementById('closeMessagingModal').addEventListener('click', function () {
      closeMessagingModal();
    });

    // NEW: Send message on button click
    document.getElementById('sendMessageBtn').addEventListener('click', function () {
      sendMessage();
    });

    // NEW: Send message on Enter key
    document.getElementById('messageInput').addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });

    // NEW: Close messaging modal when clicking outside
    document.getElementById('messagingModal').addEventListener('click', function (e) {
      if (e.target === this) {
        this.style.display = 'none';
      }
    });

    // Event listeners for emergency buttons
    document.querySelectorAll('.emergency-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const emergencyType = this.getAttribute('data-type');
        openCameraModal(emergencyType);
      });
    });

    // Close modal when clicking the X button
    document.getElementById('closeCamera').addEventListener('click', closeCameraModal);

    // Close modal when clicking outside
    document.getElementById('cameraModal').addEventListener('click', function (e) {
      if (e.target === this && !isUploading) {
        closeCameraModal();
      }
    });

    // Close report modal
    document.getElementById('closeReport').addEventListener('click', function () {
      document.getElementById('reportModal').style.display = 'none';
    });

    // Close report modal when clicking outside
    document.getElementById('reportModal').addEventListener('click', function (e) {
      if (e.target === this) {
        this.style.display = 'none';
      }
    });

    // Request notification permission on page load
    document.addEventListener('DOMContentLoaded', function () {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    });

    // Handle page visibility changes to clean up resources
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          cameraStream = null;
        }
      }
    });

    window.addEventListener('beforeunload', function () {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      if (watchPositionId !== null) {
        navigator.geolocation.clearWatch(watchPositionId);
      }
      if (responseTeamLocationListener) {
        responseTeamLocationListener(); 
        responseTeamLocationListener = null;
      }
      if (routeUpdateInterval) {
        clearInterval(routeUpdateInterval);
        routeUpdateInterval = null;
      }
    });