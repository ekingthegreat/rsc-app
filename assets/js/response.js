// Global variables
    let map;
    let userLocation = null;
    let markers = [];
    let reports = {};
    let directionsService;
    let directionsRenderer;
    let currentRouteDestination = null;
    let startMarker = null;
    let endMarker = null;
    let currentInfoWindow = null;
    let currentReportId = null;
    let currentUserHasAccepted = false;
    let locationWatchId = null;
    let isTracking = false;
    let currentMission = null;
    let routeCheckInterval = null;
    let etaUpdateInterval = null;
    let currentChatReportId = null;
    let currentTeamKey = null;
    let locationUpdateInterval = null;
    let lastSavedLocation = null;
    let userLocationMarker = null;
    let reporterLocationMarker = null;
    let currentReporterLocation = null;
    let lastRouteCheckTime = 0;
    let database; // Global database reference
    let filterTimeout = null;
    let mapInitialized = false;

    const MOVEMENT_THRESHOLD = 5; // meters
    const ROUTE_CHECK_INTERVAL = 5000; // Check every 5 seconds
    const LOCATION_ACCURACY_THRESHOLD = 50; // meters - minimum required accuracy

    // Emergency type colors mapping
    const emergencyColors = {
      'landslide': '#834010',
      'fire': '#B80F0A',
      'earthquake': '#FF8C00',
      'flood': '#007BFF',
      'storm': '#20B2AA',
      'ems': '#008080'
    };

    // Emergency type display names
    const emergencyTypeNames = {
      'landslide': 'Landslide',
      'fire': 'Fire',
      'earthquake': 'Earthquake',
      'flood': 'Flood',
      'storm': 'Storm Surge',
      'ems': 'Emergency Medical Services'
    };
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
      const userId = localStorage.getItem('userId');
      return !!userId;
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

    // Function to redirect to login page
    function redirectToLogin() {
      alert('Please log in to access this page.');
      window.location.href = 'index.html';
    }

    // Initialize the application after session check
    function initializeApp() {
      if (!checkSession()) {
        redirectToLogin();
        return;
      }

      // Hide the session check overlay
      document.getElementById('sessionCheckOverlay').style.display = 'none';

      // Set up navigation based on user role
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

      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }

      // Initialize Firebase
      try {
        const app = firebase.initializeApp(firebaseConfig);
        database = firebase.database();
        console.log("Firebase initialized successfully");

        // Load reports immediately even if map isn't ready
        loadReportsFromFirebase();
      } catch (error) {
        console.error("Firebase initialization error:", error);
        alert("Error initializing Firebase. Please refresh the page.");
        return;
      }

      // Initialize map when Google Maps API is loaded
      // The callback parameter in the Google Maps script tag will call initMap
    }

    // Initialize the app when DOM is loaded
    document.addEventListener('DOMContentLoaded', initializeApp);

    function initMap() {
      console.log("Initializing map...");

      const defaultLocation = { lat: 7.7844, lng: 122.5861 };
      map = new google.maps.Map(document.getElementById('map'), {
        zoom: 12,
        center: defaultLocation,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        mapTypeControlOptions: {
          position: google.maps.ControlPosition.TOP_LEFT
        },
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_BOTTOM
        }
      });

      mapInitialized = true;

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

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // Check if accuracy is acceptable
            if (position.coords.accuracy <= LOCATION_ACCURACY_THRESHOLD) {
              userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy
              };
              map.setCenter(userLocation);

              // Add a marker for user's current location with real-time updates
              userLocationMarker = new google.maps.Marker({
                position: userLocation,
                map: map,
                title: 'Your Current Location',
                icon: createBlueBorderPin('#757574'), // white custom pin for user location
                animation: google.maps.Animation.DROP
              });



              // Create info window for hover effect
              const userLocationInfoWindow = new google.maps.InfoWindow({
                content: `
            <div class="info-window-content">
                <div class="info-window-title">Current Location</div>
                <div class="info-window-details"><strong>Your Position</strong></div>
                <div class="info-window-details">Lat: ${userLocation.lat.toFixed(6)}</div>
                <div class="info-window-details">Lng: ${userLocation.lng.toFixed(6)}</div>
               </div>
        `
              });

              // Show info window on mouseover
              userLocationMarker.addListener('mouseover', () => {
                userLocationInfoWindow.open(map, userLocationMarker);
              });

              // Hide info window on mouseout
              userLocationMarker.addListener('mouseout', () => {
                userLocationInfoWindow.close();
              });

              // Add accuracy circle
              const accuracyCircle = new google.maps.Circle({
                center: userLocation,
                radius: position.coords.accuracy,
                map: map,
                fillColor: '#4285F4',
                fillOpacity: 0.2,
                strokeColor: '#4285F4',
                strokeOpacity: 0.5,
                strokeWeight: 1
              });

              console.log('Initial location accuracy:', position.coords.accuracy, 'meters');
            } else {
              console.warn('Initial location accuracy too low:', position.coords.accuracy, 'meters');
              userLocation = defaultLocation;
            }

            // If reports are already loaded, add markers to map
            if (Object.keys(reports).length > 0) {
              addMarkersToMap();
            }
          },
          (error) => {
            console.error("Error getting location: ", error);
            userLocation = defaultLocation;
            // If reports are already loaded, add markers to map
            if (Object.keys(reports).length > 0) {
              addMarkersToMap();
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 15000, // Increased timeout
            maximumAge: 30000 // Accept cached position up to 30 seconds old
          }
        );
      } else {
        console.error("Geolocation is not supported by this browser.");
        userLocation = defaultLocation;
        // If reports are already loaded, add markers to map
        if (Object.keys(reports).length > 0) {
          addMarkersToMap();
        }
      }

      // Initialize rescue dashboard
      initializeRescueDashboard();

      // Start real-time location tracking
      startRealTimeLocationTracking();

      // Add event listeners for route buttons
      document.getElementById('calculateRouteBtn').addEventListener('click', calculateRoute);
      document.getElementById('clearRouteBtn').addEventListener('click', clearRoute);
      document.getElementById('clearRouteMapBtn').addEventListener('click', clearRoute);

      // Add event listeners for rescue buttons
      document.getElementById('acceptRescueBtn').addEventListener('click', acceptRescue);
      document.getElementById('completeRescueBtn').addEventListener('click', completeRescue);

      // Add event listeners for confirmation modal
      document.getElementById('confirmYes').addEventListener('click', confirmAction);
      document.getElementById('confirmNo').addEventListener('click', cancelAction);

      // Add event listeners for filters with debouncing
      document.getElementById('emergencyTypeFilter').addEventListener('change', function () {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(filterReports, 300);
      });
      document.getElementById('statusFilter').addEventListener('change', function () {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(filterReports, 300);
      });

      // Add event listeners for messaging
      document.getElementById('closeMessagingModal').addEventListener('click', closeMessagingModal);
      document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);
      document.getElementById('messageInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
          sendMessage();
        }
      });

      // Close modals when clicking outside
      window.addEventListener('click', function (event) {
        const modal = document.getElementById('reportModal');
        const confirmationModal = document.getElementById('confirmationModal');
        const messagingModal = document.getElementById('messagingModal');

        if (event.target === modal) {
          modal.style.display = 'none';
        }
        if (event.target === confirmationModal) {
          confirmationModal.style.display = 'none';
        }
        if (event.target === messagingModal) {
          messagingModal.style.display = 'none';
        }
      });

      console.log("Map initialization completed");
    }

    // Function to create notification for the user who reported the emergency
    async function createNotificationForReporter(reportData, responseTeamName, actionType) {
      try {
        const notificationId = `notification_${reportData.id}_${Date.now()}`;

        let title, message;

        if (actionType === 'accepted') {
          title = `Your ${reportData.emergencyType} Report Has Been Accepted`;
          message = `Response team member ${responseTeamName} has accepted your ${reportData.emergencyType} emergency report and is on the way to assist.`;
        } else if (actionType === 'completed') {
          title = `Your ${reportData.emergencyType} Report Has Been Completed`;
          message = `Response team member ${responseTeamName} has completed and mapped your ${reportData.emergencyType} emergency report.`;
        } else if (actionType === 'responding') {
          title = `Update on Your ${reportData.emergencyType} Report`;
          message = `Response team member ${responseTeamName} is now responding to your ${reportData.emergencyType} emergency report.`;
        } else if (actionType === 'on_site') {
          title = `Response Team Arrived at Location`;
          message = `Response team member ${responseTeamName} has arrived at the location of your ${reportData.emergencyType} emergency report.`;
        } else if (actionType === 'message') {
          title = `New Message About Your ${reportData.emergencyType} Report`;
          message = `Response team member ${responseTeamName} sent you a message about your emergency report.`;
        }

        const notificationData = {
          id: notificationId,
          title: title,
          message: message,
          type: reportData.emergencyType,
          reportId: reportData.id,
          timestamp: new Date().getTime(),
          formattedTime: new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
          }),
          date: new Date().toISOString().split('T')[0],
          status: 'unread',
          recipientId: reportData.userId, // Send to the user who created the report
          recipientRole: 'reporter', // Special role for the original reporter
          actionType: actionType,
          responseTeamName: responseTeamName,
          emergencyType: reportData.emergencyType
        };

        console.log('Creating notification for reporter:', reportData.userId, notificationData);

        // Save notification to Firebase
        await database.ref('notifications/' + notificationId).set(notificationData);
        console.log('Notification created successfully for reporter');

        // Show browser notification if permission is granted
        if (Notification.permission === 'granted') {
          showBrowserNotification(title, message);
        }

      } catch (error) {
        console.error('Error creating notification for reporter:', error);
      }
    }

    // Function to show browser notification
    function showBrowserNotification(title, body) {
      if (Notification.permission === 'granted') {
        const notification = new Notification(title, {
          body: body,
          icon: 'assets/img/logo.png',
          badge: 'assets/img/logo.png'
        });

        notification.onclick = function () {
          window.focus();
          notification.close();
        };
      }
    }

    function startRealTimeLocationTracking() {
      if (!navigator.geolocation) {
        console.error('Geolocation is not supported by this browser.');
        return;
      }

      locationWatchId = navigator.geolocation.watchPosition(
        (position) => {
          if (position.coords.accuracy > LOCATION_ACCURACY_THRESHOLD) {
            console.warn('Location accuracy too low:', position.coords.accuracy, 'meters. Skipping update.');
            return;
          }

          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          };

          if (hasUserMoved(userLocation, newLocation)) {
            userLocation = newLocation;
            console.log('User location updated with accuracy:', position.coords.accuracy, 'meters');

            if (userLocationMarker) {
              userLocationMarker.setPosition(userLocation);
            } else if (mapInitialized) {
              userLocationMarker = new google.maps.Marker({
                position: userLocation,
                map: map,
                title: 'Your Current Location',
                icon: createCustomPinIcon('#4285F4') // Blue custom pin for user location
              });
            }

            // Save location to database
            saveUserLocationToDatabase();

            // Update rescue team coordinates if on a mission
            if (currentMission) {
              updateRescueTeamCoordinates();

              // Check for route deviation and recalculate if needed
              checkAndRecalculateRoute();
            }

            lastSavedLocation = userLocation;
          }
        },
        (error) => {
          console.error('Error watching location:', error);
          // Handle different error types
          switch (error.code) {
            case error.PERMISSION_DENIED:
              console.error('User denied the request for Geolocation.');
              break;
            case error.POSITION_UNAVAILABLE:
              console.error('Location information is unavailable.');
              break;
            case error.TIMEOUT:
              console.error('The request to get user location timed out.');
              break;
            default:
              console.error('An unknown error occurred.');
              break;
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000, // Increased timeout
          maximumAge: 5000 // Don't use cached position older than 5 seconds
        }
      );

      isTracking = true;
    }

    // Initialize rescue dashboard with stats and actions
    function initializeRescueDashboard() {
      // Set up dashboard stats
      updateDashboardStats();

      // Set up action buttons based on user role
      setupActionButtons();

      // Check if user has an active mission
      checkActiveMission();
    }

    // Update dashboard statistics
    function updateDashboardStats() {
      const statsContainer = document.getElementById('dashboardStats');

      // Calculate stats from reports
      const totalReports = Object.keys(reports).length;
      const activeReports = Object.values(reports).filter(report => report.status !== 'mapped').length;
      const userAcceptedReports = Object.values(reports).filter(report =>
        report.rescueTeams && Object.values(report.rescueTeams).some(team =>
          team.userId === localStorage.getItem('userId')
        )
      ).length;

      statsContainer.innerHTML = `
        <div class="stat-card">
          <div class="stat-value">${totalReports}</div>
          <div class="stat-label">Total Reports</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${activeReports}</div>
          <div class="stat-label">Active Emergencies</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${userAcceptedReports}</div>
          <div class="stat-label">Your Missions</div>
        </div>
      `;
    }

    // Setup action buttons based on user role
    function setupActionButtons() {
      const actionsContainer = document.getElementById('rescueActions');
      const userRole = localStorage.getItem('role');

      let buttonsHTML = '';

      actionsContainer.innerHTML = buttonsHTML;
    }

    // Check if user has an active mission
    function checkActiveMission() {
      const userId = localStorage.getItem('userId');

      // Look for reports where the current user is part of the rescue team
      const userMissions = Object.entries(reports).filter(([reportId, report]) => {
        return report.rescueTeams && Object.values(report.rescueTeams).some(team =>
          team.userId === userId && report.status !== 'mapped'
        );
      });

      if (userMissions.length > 0) {
        // User has an active mission
        const [reportId, report] = userMissions[0];
        currentMission = report;
        currentMission.id = reportId;

        // Find the team key for the current user
        const teamEntry = Object.entries(report.rescueTeams || {}).find(
          ([key, team]) => team.userId === userId
        );

        if (teamEntry) {
          currentTeamKey = teamEntry[0];
        }

        // Update UI to show mission details
        updateMissionUI(report);

        // Start location tracking if not already active
        if (!isTracking) {
          startRealTimeLocationTracking();
        }

        // Start ETA updates
        startETAUpdates();
      } else {
        // No active mission
        currentMission = null;
        currentTeamKey = null;
        document.getElementById('rescueProgress').style.display = 'none';
        document.getElementById('rescueDetails').style.display = 'none';

        // Stop ETA updates
        stopETAUpdates();
      }
    }

    // Update mission UI with current mission details
    function updateMissionUI(report) {
      document.getElementById('rescueProgress').style.display = 'block';
      document.getElementById('rescueDetails').style.display = 'block';

      // Update progress based on status
      let progress = 0;
      switch (report.status) {
        case 'accepted':
          progress = 25;
          break;
        case 'responding':
          progress = 50;
          break;
        case 'on_site':
          progress = 75;
          break;
        case 'mapped':
          progress = 100;
          break;
        default:
          progress = 0;
      }

      document.getElementById('progressFill').style.width = `${progress}%`;

      // Update mission details
      document.getElementById('currentEmergencyType').textContent =
        emergencyTypeNames[report.emergencyType] || report.emergencyType;
      document.getElementById('currentLocation').textContent =
        `${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}`;

      // Calculate distance and ETA if user location is available
      if (userLocation) {
        calculateDistanceAndETA(report);
      }
    }

    // Calculate distance and ETA to mission location
    function calculateDistanceAndETA(report) {
      const destination = {
        lat: parseFloat(report.latitude),
        lng: parseFloat(report.longitude)
      };

      // Wait for user location to be available
      if (!userLocation) {
        console.log('Waiting for user location...');
        setTimeout(() => calculateDistanceAndETA(report), 1000);
        return;
      }

      const request = {
        origin: userLocation, // Always use current GPS location
        destination: destination,
        travelMode: 'DRIVING',
        provideRouteAlternatives: true // Get multiple route options
      };

      directionsService.route(request, function (result, status) {
        if (status === 'OK') {
          // Use hybrid algorithm to select best route
          const bestRoute = selectOptimalRoute(result.routes, userLocation, destination);
          const route = bestRoute.legs[0];

          document.getElementById('currentDistance').textContent = route.distance.text;
          document.getElementById('currentETA').textContent = route.duration.text;

        } else {
          document.getElementById('currentDistance').textContent = 'Calculating...';
          document.getElementById('currentETA').textContent = 'Calculating...';
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

      // Dijkstra's component: Prefer shorter total distance (40% weight)
      const distance = leg.distance.value; // in meters
      const normalizedDistance = 1 / (distance / 1000); // Convert to km and normalize
      score += normalizedDistance * 40;

      // A* component: Consider both distance and heuristic (ETA) (40% weight)
      const duration = leg.duration.value; // in seconds
      const normalizedDuration = 1 / (duration / 60); // Convert to minutes and normalize
      score += normalizedDuration * 40;

      // Route complexity penalty (Dijkstra's principle - fewer segments is better)
      const complexityPenalty = Math.min(route.legs[0].steps.length * 0.3, 15);
      score -= complexityPenalty;

      // Traffic conditions consideration (if available)
      if (leg.duration_in_traffic) {
        const trafficDuration = leg.duration_in_traffic.value;
        const trafficRatio = duration / trafficDuration;
        score += trafficRatio * 5; // Bonus for better traffic conditions
      }

      // Road type preference (A* heuristic - prefer highways for longer routes)
      const hasHighway = route.legs[0].steps.some(step =>
        step.instructions.toLowerCase().includes('highway') ||
        step.instructions.toLowerCase().includes('freeway')
      );

      if (distance > 10000 && hasHighway) { // For routes > 10km, prefer highways
        score += 10;
      } else if (distance <= 5000 && !hasHighway) { // For short routes, avoid highways
        score += 5;
      }

      return score;
    }

    // Start ETA updates
    function startETAUpdates() {
      // Update ETA every 30 seconds
      etaUpdateInterval = setInterval(() => {
        if (currentMission && userLocation) {
          calculateDistanceAndETA(currentMission);
        }
      }, 30000);
    }

    // Stop ETA updates
    function stopETAUpdates() {
      if (etaUpdateInterval) {
        clearInterval(etaUpdateInterval);
        etaUpdateInterval = null;
      }
    }

    // Check if user has moved significantly
    function hasUserMoved(oldLocation, newLocation) {
      if (!oldLocation) return true;

      const distance = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(oldLocation.lat, oldLocation.lng),
        new google.maps.LatLng(newLocation.lat, newLocation.lng)
      );

      return distance >= MOVEMENT_THRESHOLD;
    }

    // Stop location tracking
    function stopLocationTracking() {
      if (!isTracking) {
        return;
      }

      console.log('Stopping location tracking...');

      // Stop watching position
      if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
      }

      isTracking = false;
      lastSavedLocation = null;
    }

    // Update response team coordinates in the rescueTeams node
    function updateRescueTeamCoordinates() {
      if (!currentMission || !currentTeamKey || !userLocation) {
        return;
      }

      const userId = localStorage.getItem('userId');
      const userName = localStorage.getItem('fullname') || localStorage.getItem('username');

      const coordinateData = {
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        timestamp: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userName: userName,
        missionId: currentMission.id,
        speed: userLocation.speed || 0,
        heading: userLocation.heading || 0,
        accuracy: userLocation.accuracy || 0 // Include accuracy information
      };

      // Update coordinates in the rescueTeams node
      database.ref('reports/' + currentMission.id + '/rescueTeams/' + currentTeamKey + '/location')
        .set(coordinateData)
        .then(() => {
          console.log('Rescue team coordinates updated in database');
        })
        .catch((error) => {
          console.error('Error updating rescue team coordinates:', error);
        });
    }

    // Save user location to database
    function saveUserLocationToDatabase() {
      const userId = localStorage.getItem('userId');
      const userName = localStorage.getItem('fullname') || localStorage.getItem('username');

      const locationData = {
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        timestamp: new Date().toISOString(),
        userName: userName,
        missionId: currentMission ? currentMission.id : null,
        status: currentMission ? 'on_mission' : 'available',
        speed: userLocation.speed || 0,
        heading: userLocation.heading || 0,
        accuracy: userLocation.accuracy || 0 // Include accuracy information
      };

      database.ref('user_locations/' + userId).set(locationData)
        .then(() => {
          console.log('User location saved to database');
        })
        .catch((error) => {
          console.error('Error saving user location:', error);
        });
    }

    // Enhanced function to check and recalculate route if needed
    function checkAndRecalculateRoute() {
      const currentTime = new Date().getTime();

      // Only check every 30 seconds to avoid excessive API calls
      if (currentTime - lastRouteCheckTime < 30000) {
        return;
      }

      lastRouteCheckTime = currentTime;

      if (currentRouteDestination && directionsRenderer.getDirections()) {
        checkRouteDeviation();
      }
    }

    // Enhanced route deviation check with automatic recalculation
    function checkRouteDeviation() {
      if (!directionsRenderer.getDirections() || !userLocation) {
        return;
      }

      const route = directionsRenderer.getDirections();
      const path = route.routes[0].overview_path;

      // Find the closest point on the route to the user's current location
      let minDistance = Number.MAX_VALUE;
      let closestPoint = null;

      for (let i = 0; i < path.length; i++) {
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
          userLocation,
          path[i]
        );

        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = path[i];
        }
      }

      // If the user is more than 100 meters from the route, show deviation notice
      if (minDistance > 100) {
        console.log('Route deviation detected:', minDistance, 'meters from route');
        document.getElementById('routeDeviationNotice').style.display = 'block';

        // Auto-recalculate route after 3 seconds
        setTimeout(() => {
          if (currentRouteDestination) {
            document.getElementById('routeRecalculatingNotice').style.display = 'block';
            console.log('Auto-recalculating route due to deviation...');
            calculateRoute();

            // Hide notices after 10 seconds
            setTimeout(() => {
              document.getElementById('routeDeviationNotice').style.display = 'none';
              document.getElementById('routeRecalculatingNotice').style.display = 'none';
            }, 10000);
          }
        }, 3000);
      }
    }

    // Start monitoring for route deviations
    function startRouteDeviationMonitoring() {
      if (routeCheckInterval) {
        clearInterval(routeCheckInterval);
      }

      routeCheckInterval = setInterval(() => {
        if (currentRouteDestination && userLocation) {
          checkRouteDeviation();
        }
      }, ROUTE_CHECK_INTERVAL);
    }

    // Function to get marker icon based on emergency type
    function getMarkerIcon(emergencyType) {
      const color = emergencyColors[emergencyType] || '#000000';
      return createCustomPinIcon(color);
    }

    // Function to add marker to map
    function addMarker(reportData, reportId) {
      // Don't add marker if report is mapped
      if (reportData.status === 'mapped') {
        console.log('Skipping mapped report:', reportData.title);
        return null;
      }

      const position = {
        lat: parseFloat(reportData.latitude),
        lng: parseFloat(reportData.longitude)
      };

      const marker = new google.maps.Marker({
        position: position,
        map: map,
        title: reportData.title,
        icon: getMarkerIcon(reportData.emergencyType)
      });

      // Create info window content
      const createInfoWindowContent = () => {
        let content = `
          <div class="info-window-content">
            <div class="info-window-title">${reportData.title}</div>
            <div class="info-window-details"><strong>Type:</strong> ${emergencyTypeNames[reportData.emergencyType] || reportData.emergencyType}</div>
            <div class="info-window-details"><strong>Reported by:</strong> ${reportData.createdByName || 'Unknown'}</div>
            <div class="info-window-details"><strong>Time:</strong> ${reportData.formattedTime || reportData.time}</div>
            <div class="info-window-details"><strong>Date:</strong> ${reportData.date}</div>
            <div class="info-window-details"><strong>Status:</strong> ${reportData.status || 'reported'}</div>
        `;

        // Add description if available
        if (reportData.description) {
          content += `<div class="info-window-details"><strong>Description:</strong> ${reportData.description}</div>`;
        }

        // Add photo evidence if available
        if (reportData.mediaUrl && reportData.mediaType === 'image') {
          content += `
            <div class="info-window-media">
              <strong>Photo Evidence:</strong><br>
              <img src="${reportData.mediaUrl}" alt="Emergency photo evidence" onclick="this.style.maxHeight=this.style.maxHeight?'none':'500px'">
            </div>
          `;
        }

        content += `
          <button class="action-button" onclick="calculateRouteToLocation(${reportData.latitude}, ${reportData.longitude}, '${reportData.title.replace(/'/g, "\\'")}', '${reportId}', true)">
            <i class="fas fa-route"></i> Get Directions
          </button>
          <button class="action-button" onclick="showReportDetails('${reportId}')" style="background: #28a745; margin-top: 8px;">
            <i class="fas fa-info-circle"></i> View Full Details
          </button>
        </div>
        `;

        return content;
      };

      const infoWindow = new google.maps.InfoWindow({
        content: createInfoWindowContent()
      });

      marker.addListener('click', () => {
        // Close any existing info window
        if (currentInfoWindow) {
          currentInfoWindow.close();
        }
        currentInfoWindow = infoWindow;

        infoWindow.open(map, marker);
      });

      // Store the report ID with the marker for easy reference
      marker.reportId = reportId;
      markers.push(marker);
      return marker;
    }

    // Function to add all markers to the map
    function addMarkersToMap() {
      if (!mapInitialized) return;

      // Clear existing markers
      markers.forEach(marker => marker.setMap(null));
      markers = [];

      // Add markers for all active reports
      Object.entries(reports).forEach(([reportId, report]) => {
        // Check if report has valid coordinates and is not mapped
        if (report.latitude && report.longitude && report.status !== 'mapped') {
          console.log('Adding marker for report:', reportId, report);
          addMarker(report, reportId);
        } else {
          console.log('Report missing coordinates or is mapped:', reportId);
        }
      });
    }

    // Function to load reports from Firebase and add markers
    function loadReportsFromFirebase() {
      console.log('Loading reports from Firebase...');

      if (!database) {
        console.error('Database not initialized');
        document.getElementById('locationsList').innerHTML = '<div class="loading">Error: Database not available</div>';
        return;
      }

      const reportsRef = database.ref('reports');

      reportsRef.on('value', (snapshot) => {
        const reportsData = snapshot.val();
        reports = reportsData || {};

        if (reportsData) {
          console.log(`Found ${Object.keys(reportsData).length} reports`);

          // Convert to array and filter out mapped reports
          const activeReports = Object.entries(reportsData)
            .filter(([reportId, report]) => report.status !== 'mapped')
            .sort(([, a], [, b]) => new Date(b.createdAt) - new Date(a.createdAt));

          console.log(`Active reports (not mapped): ${activeReports.length}`);

          // Add markers to map if map is initialized
          if (mapInitialized) {
            addMarkersToMap();
          }

          // Update locations list with only active reports
          displayLocationsList(activeReports);

          // Update dashboard stats
          updateDashboardStats();

          // Check for active missions
          checkActiveMission();
        } else {
          console.log('No reports found in database');
          document.getElementById('locationsList').innerHTML = '<div class="loading">No emergency reports found</div>';
        }
      }, (error) => {
        console.error('Error loading reports:', error);
        document.getElementById('locationsList').innerHTML = '<div class="loading">Error loading reports</div>';
      });
    }

    // Display locations in the locations list (newest first)
    function displayLocationsList(sortedReports) {
      const locationsList = document.getElementById('locationsList');
      locationsList.innerHTML = '';

      if (sortedReports.length === 0) {
        locationsList.innerHTML = '<div class="loading">No active emergency reports found</div>';
        return;
      }

      sortedReports.forEach(([reportId, report]) => {
        // Only display reports that are not mapped
        if (report.status === 'mapped') return;

        const locationCard = document.createElement('div');
        locationCard.className = 'location-card';

        // Set border color based on emergency type
        const emergencyColor = emergencyColors[report.emergencyType] || '#8B4513';
        locationCard.style.borderLeftColor = emergencyColor;

        // Format date and time for display
        const reportDate = new Date(report.createdAt);
        const formattedDate = reportDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        const formattedTime = reportDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });

        const emergencyType = emergencyTypeNames[report.emergencyType] || report.emergencyType;

        locationCard.innerHTML = `
          <div class="location-name">
            ${report.title}
            <div style="display: flex; gap: 5px;">
              <span class="emergency-badge" style="background-color: ${emergencyColor}">
                ${emergencyType}
              </span>
            </div>
          </div>
          <div class="location-coords">${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}</div>
          <div class="location-date">${formattedDate} • ${formattedTime}</div>
          <div class="location-route-btn" style="margin-top: 8px; display: flex; gap: 8px;">
            <button class="route-btn" style="font-size: 12px; padding: 4px 8px;" onclick="event.stopPropagation(); calculateRouteToLocation(${report.latitude}, ${report.longitude}, '${report.title.replace(/'/g, "\\'")}', '${reportId}', false)">
              <i class="fas fa-route"></i> Get Directions
            </button>
            <button class="route-btn" style="font-size: 12px; padding: 4px 8px; background: #28a745;" onclick="event.stopPropagation(); showReportDetails('${reportId}')">
              <i class="fas fa-info-circle"></i> Details
            </button>
          </div>
        `;

        locationCard.addEventListener('click', function () {
          showReportDetails(reportId);
          // Auto-calculate route when clicking on location card
          calculateRouteToLocation(report.latitude, report.longitude, report.title, reportId, false);
        });

        locationsList.appendChild(locationCard);
      });
    }

    // Filter reports based on selected filters
    function filterReports() {
      const emergencyTypeFilter = document.getElementById('emergencyTypeFilter').value;
      const statusFilter = document.getElementById('statusFilter').value;

      // Hide all markers first
      markers.forEach(marker => marker.setMap(null));

      // Filter reports based on criteria
      const filteredReports = Object.entries(reports).filter(([reportId, report]) => {
        // Skip mapped reports
        if (report.status === 'mapped') return false;

        // Apply emergency type filter
        if (emergencyTypeFilter !== 'all' && report.emergencyType !== emergencyTypeFilter) {
          return false;
        }

        // Apply status filter
        if (statusFilter !== 'all' && report.status !== statusFilter) {
          return false;
        }

        return true;
      });

      // Show filtered markers
      filteredReports.forEach(([reportId, report]) => {
        const marker = markers.find(m => m.reportId === reportId);
        if (marker) {
          marker.setMap(map);
        }
      });

      // Update locations list with filtered reports
      displayLocationsList(filteredReports);
    }

    // Function to remove marker from map
    function removeMarkerFromMap(reportId) {
      // Find and remove the marker
      const markerIndex = markers.findIndex(marker => marker.reportId === reportId);

      if (markerIndex !== -1) {
        // Remove marker from map
        markers[markerIndex].setMap(null);
        // Remove from markers array
        markers.splice(markerIndex, 1);
        console.log('Marker removed from map for report:', reportId);
      }

      // Refresh the locations list to remove the mapped report
      const activeReports = Object.entries(reports)
        .filter(([id, report]) => report.status !== 'mapped')
        .sort(([, a], [, b]) => new Date(b.createdAt) - new Date(a.createdAt));

      displayLocationsList(activeReports);

      // Update dashboard stats
      updateDashboardStats();
    }

    // Calculate route to specific location (called from map markers and list)
    function calculateRouteToLocation(lat, lng, title, reportId, fromInfoWindow = false) {
      currentRouteDestination = {
        lat: parseFloat(lat),
        lng: parseFloat(lng)
      };

      // Add custom markers
      addCustomMarkers(currentRouteDestination, title);

      // Calculate the route
      calculateRoute();

      // Close info window if coming from there
      if (fromInfoWindow && currentInfoWindow) {
        currentInfoWindow.close();
      }
    }

    // Add custom start and end markers
    function addCustomMarkers(destination, title) {
      // Clear existing custom markers
      if (startMarker) startMarker.setMap(null);
      if (endMarker) endMarker.setMap(null);

      // Use current user location as starting point
      const startPoint = userLocation;

      if (!startPoint) {
        console.log('Waiting for GPS location...');
        // Try again in 1 second if GPS location isn't available yet
        setTimeout(() => addCustomMarkers(destination, title), 1000);
        return;
      }

      // Add start marker (User's Current Location)
      startMarker = new google.maps.Marker({
        position: startPoint,
        map: map,
        title: 'Your Current Location - Start Point',
        icon: createCustomPinIcon('#28a745') // Green custom pin for start point
      });

      // Add end marker (Emergency Location)
      endMarker = new google.maps.Marker({
        position: destination,
        map: map,
        title: title + ' - Emergency Location',
        icon: createCustomPinIcon('#B80F0A') // Red custom pin for emergency location
      });
    }

    // Enhanced function to track reporter location in real-time
    function trackReporterLocation(reportId) {
      const report = reports[reportId];
      if (!report || !report.userId) return;

      // Listen for reporter location updates
      const reporterLocationRef = database.ref('user_locations/' + report.userId);

      reporterLocationRef.on('value', (snapshot) => {
        const locationData = snapshot.val();
        if (locationData && locationData.latitude && locationData.longitude) {
          currentReporterLocation = {
            lat: locationData.latitude,
            lng: locationData.longitude
          };

          // Update or create reporter location marker
          if (reporterLocationMarker) {
            reporterLocationMarker.setPosition(currentReporterLocation);
          } else {
            reporterLocationMarker = new google.maps.Marker({
              position: currentReporterLocation,
              map: map,
              title: 'Reporter Location',
              icon: createCustomPinIcon('#20B2AA'), // Teal custom pin for reporter
              animation: google.maps.Animation.BOUNCE
            });
          }

          // If this is the current mission destination, update the route
          if (currentMission && currentMission.id === reportId) {
            currentRouteDestination = currentReporterLocation;

            // Update end marker
            if (endMarker) {
              endMarker.setPosition(currentReporterLocation);
            }

            // Recalculate route if user is already en route
            if (directionsRenderer.getDirections()) {
              setTimeout(() => {
                calculateRoute();
              }, 2000);
            }
          }
        }
      });
    }

    // Show report details in modal
    function showReportDetails(reportId) {
      const report = reports[reportId];
      if (!report) return;

      currentReportId = reportId;

      // Start tracking reporter location
      trackReporterLocation(reportId);

      const modal = document.getElementById('reportModal');
      const modalMediaContainer = document.getElementById('modalMediaContainer');
      const modalTitle = document.getElementById('modalTitle');
      const modalType = document.getElementById('modalType');
      const modalStatus = document.getElementById('modalStatus');
      const modalDate = document.getElementById('modalDate');
      const modalTime = document.getElementById('modalTime');
      const modalLat = document.getElementById('modalLat');
      const modalLng = document.getElementById('modalLng');
      const modalReporter = document.getElementById('modalReporter');
      const modalDescription = document.getElementById('modalDescription');

      // Set modal content
      modalTitle.textContent = report.title;
      modalType.textContent = emergencyTypeNames[report.emergencyType] || report.emergencyType;
      modalType.style.color = emergencyColors[report.emergencyType] || '#8B4513';
      modalStatus.textContent = report.status.charAt(0).toUpperCase() + report.status.slice(1);
      modalDate.textContent = report.date;
      modalTime.textContent = report.formattedTime;
      modalLat.textContent = report.latitude.toFixed(6);
      modalLng.textContent = report.longitude.toFixed(6);
      modalReporter.textContent = report.createdByName;
      modalDescription.textContent = report.description || 'No description provided';

      // Set media
      if (report.mediaUrl && report.mediaType === 'image') {
        modalMediaContainer.innerHTML = `<img id="modalMedia" class="modal-media" src="${report.mediaUrl}" alt="Report Media">`;
      } else if (report.mediaUrl && report.mediaType === 'video') {
        modalMediaContainer.innerHTML = `<video controls class="modal-media"><source src="${report.mediaUrl}" type="video/mp4">Your browser does not support the video tag.</video>`;
      } else {
        modalMediaContainer.innerHTML = '<div class="loading">No media available</div>';
      }

      // Store current destination for route calculation
      currentRouteDestination = {
        lat: parseFloat(report.latitude),
        lng: parseFloat(report.longitude)
      };

      // Update rescue status and buttons
      updateRescueUI(report);

      // Show modal
      modal.style.display = 'flex';

      // Center map on this report
      map.setCenter({ lat: report.latitude, lng: report.longitude });
      map.setZoom(15);
    }

    // Update rescue UI based on report status
    function updateRescueUI(report) {
      const rescueStatus = document.getElementById('rescueStatus');
      const acceptBtn = document.getElementById('acceptRescueBtn');
      const completeBtn = document.getElementById('completeRescueBtn');
      const rescueTeamsSection = document.getElementById('rescueTeamsSection');
      const rescueTeamsList = document.getElementById('rescueTeamsList');

      const currentUserId = localStorage.getItem('userId');
      currentUserHasAccepted = false;

      // Check if current user has already accepted this rescue
      if (report.rescueTeams) {
        const userAcceptance = Object.values(report.rescueTeams).find(
          team => team.userId === currentUserId
        );
        currentUserHasAccepted = !!userAcceptance;
      }

      // Update rescue teams list
      if (report.rescueTeams && Object.keys(report.rescueTeams).length > 0) {
        rescueTeamsSection.style.display = 'block';
        rescueTeamsList.innerHTML = '';

        Object.values(report.rescueTeams).forEach(team => {
          const teamItem = document.createElement('div');
          teamItem.className = 'rescue-team-item';

          // Add message button if current user is part of the team
          const messageBtn = currentUserHasAccepted ?
            `<button class="message-btn" onclick="openMessagingModal('${report.id}', '${report.createdByName}')">
              <i class="fas fa-comment"></i>
            </button>` : '';

          teamItem.innerHTML = `
            <div>
              <strong>${team.userName}</strong> - ${new Date(team.acceptedAt).toLocaleString()}
              ${team.status ? ` - ${team.status.charAt(0).toUpperCase() + team.status.slice(1)}` : ''}
            </div>
            ${messageBtn}
          `;
          rescueTeamsList.appendChild(teamItem);
        });
      } else {
        rescueTeamsSection.style.display = 'none';
        rescueTeamsList.innerHTML = '<div class="no-teams">No response teams assigned yet</div>';
      }

      // Check if rescue is already completed
      if (report.status === 'mapped') {
        rescueStatus.className = 'rescue-status completed';
        rescueStatus.innerHTML = '<i class="fas fa-flag-checkered"></i> Rescue completed and mapped';
        acceptBtn.disabled = true;
        acceptBtn.innerHTML = '<i class="fas fa-check-circle"></i> Mission Completed';
        completeBtn.disabled = true;
        completeBtn.innerHTML = '<i class="fas fa-flag-checkered"></i> Mapped';
      } else if (currentUserHasAccepted) {
        rescueStatus.className = 'rescue-status accepted';
        rescueStatus.innerHTML = '<i class="fas fa-check-circle"></i> You are responding to this rescue mission';
        acceptBtn.disabled = true;
        acceptBtn.innerHTML = '<i class="fas fa-check-circle"></i> Responding';
        completeBtn.disabled = false;
      } else {
        rescueStatus.className = 'rescue-status pending';
        rescueStatus.innerHTML = '<i class="fas fa-info-circle"></i> Rescue mission available';
        acceptBtn.disabled = false;
        acceptBtn.innerHTML = '<i class="fas fa-check-circle"></i> Accept Rescue';
        completeBtn.disabled = true;
      }
    }

    // Accept rescue mission
    function acceptRescue() {
      if (!currentReportId) return;

      showConfirmation(
        'Accept Rescue Mission',
        `Are you sure you want to accept this ${reports[currentReportId].emergencyType} rescue mission?`,
        'accept'
      );
    }

    // Complete rescue mission
    function completeRescue() {
      if (!currentReportId) return;

      showConfirmation(
        'Complete Rescue Mission',
        `Are you sure you have completed the ${reports[currentReportId].emergencyType} rescue mission and want to mark it as mapped?`,
        'complete'
      );
    }

    // Show confirmation modal
    function showConfirmation(title, message, action) {
      const modal = document.getElementById('confirmationModal');
      const titleElement = document.getElementById('confirmationTitle');
      const messageElement = document.getElementById('confirmationMessage');

      titleElement.textContent = title;
      messageElement.textContent = message;

      // Store the action to be performed
      modal.dataset.action = action;

      modal.style.display = 'flex';
    }

    // Confirm action from confirmation modal
    function confirmAction() {
      const modal = document.getElementById('confirmationModal');
      const action = modal.dataset.action;

      if (action === 'accept') {
        addRescueTeam();
      } else if (action === 'complete') {
        markAsMapped();
      }

      modal.style.display = 'none';
    }

    // Cancel action from confirmation modal
    function cancelAction() {
      document.getElementById('confirmationModal').style.display = 'none';
    }

    // Add response team to the rescue mission
    function addRescueTeam() {
      if (!currentReportId) return;

      const reportRef = database.ref('reports/' + currentReportId);
      const rescueTeamsRef = reportRef.child('rescueTeams');

      // Get current user info
      const userId = localStorage.getItem('userId');
      const userName = localStorage.getItem('fullname') || localStorage.getItem('username');

      const newTeam = {
        userId: userId,
        userName: userName,
        acceptedAt: new Date().toISOString(),
        teamRole: 'response_team',
        status: 'responding', // Set status to responding immediately
        location: {
          latitude: userLocation ? userLocation.lat : null,
          longitude: userLocation ? userLocation.lng : null,
          timestamp: new Date().toISOString()
        }
      };

      // Generate a unique key for this team acceptance
      const teamKey = rescueTeamsRef.push().key;

      // Store the team key for location tracking
      currentTeamKey = teamKey;

      // Update both rescue teams and report status
      const updates = {};
      updates['rescueTeams/' + teamKey] = newTeam;
      updates['status'] = 'responding'; // Set report status to responding immediately
      updates['acceptedAt'] = new Date().toISOString();
      updates['respondingAt'] = new Date().toISOString(); // Add responding timestamp

      reportRef.update(updates)
        .then(() => {
          console.log('Rescue mission accepted and responding successfully');

          // Update local reports object
          if (!reports[currentReportId].rescueTeams) {
            reports[currentReportId].rescueTeams = {};
          }
          reports[currentReportId].rescueTeams[teamKey] = newTeam;
          reports[currentReportId].status = 'responding';
          reports[currentReportId].respondingAt = updates.respondingAt;

          // Set as current mission
          currentMission = reports[currentReportId];
          currentMission.id = currentReportId;

          // Update UI
          updateRescueUI(reports[currentReportId]);
          updateMissionUI(reports[currentReportId]);

          // Create notification for the user who reported the emergency
          createNotificationForReporter(
            reports[currentReportId],
            userName,
            'responding'
          );

          // AUTO-START LOCATION TRACKING when mission is accepted
          if (!isTracking) {
            startRealTimeLocationTracking();
            console.log('Automatic location tracking started for mission');
          }

          // Start ETA updates
          startETAUpdates();

          // Show success message with tracking info
          alert('Rescue mission accepted successfully! \n\nAutomatic location tracking has been started. Your coordinates will be updated in real-time when you move.');
        })
        .catch((error) => {
          console.error('Error accepting rescue mission:', error);
          alert('Error accepting rescue mission. Please try again.');
        });
    }

    // Mark rescue as mapped
    function markAsMapped() {
      if (!currentReportId) return;

      const reportRef = database.ref('reports/' + currentReportId);
      const userName = localStorage.getItem('fullname') || localStorage.getItem('username');

      const updates = {
        status: 'mapped',
        mappedAt: new Date().toISOString(),
        mappedBy: localStorage.getItem('userId'),
        mappedByName: userName
      };

      reportRef.update(updates)
        .then(() => {
          console.log('Rescue mission marked as mapped successfully');

          // Update local reports object
          reports[currentReportId].status = 'mapped';
          reports[currentReportId].mappedAt = updates.mappedAt;
          reports[currentReportId].mappedBy = updates.mappedBy;
          reports[currentReportId].mappedByName = updates.mappedByName;

          // Create notification for the user who reported the emergency
          createNotificationForReporter(
            reports[currentReportId],
            userName,
            'completed'
          );

          // Remove marker from map
          removeMarkerFromMap(currentReportId);

          // Clear current mission
          currentMission = null;
          currentTeamKey = null;

          // Update UI
          updateRescueUI(reports[currentReportId]);
          document.getElementById('rescueProgress').style.display = 'none';
          document.getElementById('rescueDetails').style.display = 'none';

          // Stop location tracking
          if (isTracking) {
            stopLocationTracking();
          }

          // Stop ETA updates
          stopETAUpdates();

          // Close the modal
          document.getElementById('reportModal').style.display = 'none';

          // Show success message
          alert('Rescue mission marked as mapped successfully! Location tracking has been stopped.');
        })
        .catch((error) => {
          console.error('Error marking rescue as mapped:', error);
          alert('Error marking rescue as mapped. Please try again.');
        });
    }

    // Enhanced route calculation with hybrid algorithm
    function calculateRoute() {
      if (!currentRouteDestination) {
        document.getElementById('routeInfo').innerHTML = '<div class="route-error">No destination coordinates available.</div>';
        return;
      }

      // Set travel mode to DRIVING by default
      const travelMode = 'DRIVING';

      // Use current user location as starting point - wait for GPS if not available
      if (!userLocation) {
        document.getElementById('routeInfo').innerHTML = '<div class="route-loading"><i class="fas fa-spinner fa-spin"></i> Waiting for GPS location...</div>';

        // Try again in 1 second
        setTimeout(calculateRoute, 1000);
        return;
      }

      const startPoint = userLocation;

      const request = {
        origin: startPoint,
        destination: currentRouteDestination,
        travelMode: travelMode,
        provideRouteAlternatives: true
      };

      // Show loading
      document.getElementById('routeInfo').innerHTML = '<div class="route-loading"><i class="fas fa-spinner fa-spin"></i> Calculating optimal route...</div>';

      directionsService.route(request, function (result, status) {
        if (status === 'OK') {
          // Use hybrid algorithm to select best route
          const bestRoute = selectOptimalRoute(result.routes, startPoint, currentRouteDestination);
          directionsRenderer.setDirections({
            routes: [bestRoute],
            request: request
          });

          const route = bestRoute.legs[0];
          displayRouteInfo(route, startPoint, currentRouteDestination);

          // Fit map to show the entire route
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(startPoint);
          bounds.extend(currentRouteDestination);
          map.fitBounds(bounds);

          // Start route deviation monitoring
          startRouteDeviationMonitoring();

        } else {
          document.getElementById('routeInfo').innerHTML = `<div class="route-error">Error calculating route: ${status}</div>`;
          console.error('Directions request failed:', status);
        }
      });
    }

    // Display route information
    function displayRouteInfo(route, start, end) {
      let html = `
        <div style="margin-bottom: 10px;">
          <strong>Route Information</strong><br>
          <strong>Start:</strong> Your Current Location (${start.lat.toFixed(6)}, ${start.lng.toFixed(6)})<br>
          <strong>End:</strong> Emergency Location (${end.lat.toFixed(6)}, ${end.lng.toFixed(6)})<br>
          <strong>Distance:</strong> ${route.distance.text}<br>
          <strong>Duration:</strong> ${route.duration.text}<br>
          <strong>End Address:</strong> ${route.end_address}
        </div>
        <div>
          <strong>Route Steps:</strong>
      `;

      route.steps.forEach((step, index) => {
        if (index < 10) { // Limit to first 10 steps to avoid overflow
          html += `
            <div class="route-step">
              <strong>Step ${index + 1}:</strong> ${stripHtml(step.instructions)}<br>
              <em>Distance: ${step.distance.text} | Duration: ${step.duration.text}</em>
            </div>
          `;
        }
      });

      if (route.steps.length > 10) {
        html += `<div class="route-step"><em>... and ${route.steps.length - 10} more steps</em></div>`;
      }

      html += '</div>';
      document.getElementById('routeInfo').innerHTML = html;
    }

    // Helper function to strip HTML tags from instructions
    function stripHtml(html) {
      const tmp = document.createElement("DIV");
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || "";
    }

    // Clear route from map
    function clearRoute() {
      directionsRenderer.setDirections({ routes: [] });
      document.getElementById('routeInfo').innerHTML = 'Click on any emergency location to automatically calculate the route from your current location.';

      // Remove custom markers
      if (startMarker) {
        startMarker.setMap(null);
        startMarker = null;
      }
      if (endMarker) {
        endMarker.setMap(null);
        endMarker = null;
      }

      // Close info window
      if (currentInfoWindow) {
        currentInfoWindow.close();
        currentInfoWindow = null;
      }

      currentRouteDestination = null;

      // Stop route deviation monitoring
      if (routeCheckInterval) {
        clearInterval(routeCheckInterval);
        routeCheckInterval = null;
      }
    }

    // Messaging functionality
    function openMessagingModal(reportId, reporterName) {
      currentChatReportId = reportId;
      document.getElementById('messagingTitle').textContent = `Chat with ${reporterName}`;
      document.getElementById('messagingModal').style.display = 'flex';
      document.getElementById('messageInput').focus();

      // Load existing messages
      loadMessages(reportId);
    }

    function closeMessagingModal() {
      document.getElementById('messagingModal').style.display = 'none';
      currentChatReportId = null;
    }

    function loadMessages(reportId) {
      const messagingBody = document.getElementById('messagingBody');
      messagingBody.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading messages...</div>';

      database.ref('messages/' + reportId).on('value', (snapshot) => {
        const messagesData = snapshot.val();
        messagingBody.innerHTML = '';

        if (messagesData) {
          // Convert to array and sort by timestamp
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

          // Scroll to bottom
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

          // Create notification for the reporter
          const report = reports[currentChatReportId];
          if (report) {
            createNotificationForReporter(
              report,
              userName,
              'message'
            );
          }
        })
        .catch((error) => {
          console.error('Error sending message:', error);
          alert('Error sending message. Please try again.');
        });
    }

    // Map control buttons functionality
    document.getElementById('currentLocationBtn').addEventListener('click', function () {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          map.setCenter(pos);
          map.setZoom(15);
        });
      }
    });

    document.getElementById('layersBtn').addEventListener('click', function () {
      const currentType = map.getMapTypeId();
      const newType = currentType === 'satellite' ? 'roadmap' : 'satellite';
      map.setMapTypeId(newType);
    });

    // Modal close functionality
    document.getElementById('closeModal').addEventListener('click', function () {
      document.getElementById('reportModal').style.display = 'none';
    });

    // Placeholder functions for additional features
    function assignTeams() {
      alert('Team assignment feature will be implemented in the next version.');
    }

    function createMission() {
      alert('Mission creation feature will be implemented in the next version.');
    }