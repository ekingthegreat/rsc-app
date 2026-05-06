 // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();

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

    // Function to get icon for emergency type
    function getEmergencyIcon(emergencyType) {
      const iconMap = {
        'ems': 'fa-ambulance',
        'flood': 'fa-water',
        'fire': 'fa-fire',
        'earthquake': 'fa-mountain',
        'storm': 'fa-wave-square',
        'landslide': 'fa-mountain'
      };
      
      return iconMap[emergencyType] || 'fa-exclamation-triangle';
    }

    // Function to get CSS class for emergency type
    function getEmergencyClass(emergencyType) {
      const classMap = {
        'ems': 'ems-icon',
        'flood': 'flood-icon',
        'fire': 'fire-icon',
        'earthquake': 'landslide-icon',
        'storm': 'storm-icon',
        'landslide': 'landslide-icon'
      };
      
      return classMap[emergencyType] || 'ems-icon';
    }

    // Function to get display title for emergency type
    function getEmergencyTitle(emergencyType) {
      const titleMap = {
        'ems': 'Emergency Medical Services',
        'flood': 'Flood Report',
        'fire': 'Fire Incident',
        'earthquake': 'Earthquake Alert',
        'storm': 'Storm Surge Warning',
        'landslide': 'Landslide Alert'
      };
      
      return titleMap[emergencyType] || 'Emergency Report';
    }

    // Function to get display message for emergency type
    function getEmergencyMessage(emergencyType, mediaType, address) {
      const emergencyTypeMap = {
        'ems': 'medical emergency',
        'flood': 'flood',
        'fire': 'fire',
        'earthquake': 'earthquake',
        'storm': 'storm',
        'landslide': 'landslide'
      };
      
      const emergencyName = emergencyTypeMap[emergencyType] || 'emergency';
      const mediaText = mediaType === 'video' ? 'video' : 'photo';
      
      // Use "an" for emergency types starting with vowels
      const article = ['earthquake', 'ems'].includes(emergencyType) ? 'an' : 'a';
      
      return `You reported ${article} ${emergencyName} at ${address} with attached ${mediaText} evidence.`;
    }

    // Function to get display message for mapped disaster
    function getMappedMessage(emergencyType, address, mappedByName) {
      const emergencyTypeMap = {
        'ems': 'medical emergency',
        'flood': 'flood',
        'fire': 'fire',
        'earthquake': 'earthquake',
        'storm': 'storm',
        'landslide': 'landslide'
      };
      
      const emergencyName = emergencyTypeMap[emergencyType] || 'emergency';
      const article = ['earthquake', 'ems'].includes(emergencyType) ? 'an' : 'a';
      
      if (mappedByName) {
        return `You successfully resolved ${article} ${emergencyName} at ${address}.`;
      } else {
        return `Successfully resolved ${article} ${emergencyName} at ${address}.`;
      }
    }

    // Function to format date for display
    function formatDate(dateString) {
      const date = new Date(dateString);
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    }

    // Function to format date and time for display
    function formatDateTime(dateString) {
      const date = new Date(dateString);
      const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      return date.toLocaleDateString('en-US', options);
    }

    // Reverse geocoding function from your example
    async function reverseGeocode(lat, lng) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        return data.display_name || "Unknown location";
      } catch (e) {
        return "Unable to fetch address";
      }
    }

    // Function to get address from coordinates
    async function getAddressFromCoordinates(latitude, longitude) {
      try {
        const address = await reverseGeocode(latitude, longitude);
        return address;
      } catch (error) {
        console.error('Error getting address:', error);
        return "Unknown location";
      }
    }

    // Function to extract coordinates from location string
    function extractCoordinates(location) {
      if (!location) return null;
      
      // Check if location contains coordinates in the format "Lat: X, Lng: Y"
      const coordMatch = location.match(/Lat:\s*([\d.-]+),\s*Lng:\s*([\d.-]+)/);
      if (coordMatch) {
        return {
          latitude: parseFloat(coordMatch[1]),
          longitude: parseFloat(coordMatch[2])
        };
      }
      
      return null;
    }

    // Function to fetch user reports and mapped disasters from database
    async function fetchUserHistory() {
      const userId = localStorage.getItem('userId');
      const username = localStorage.getItem('username');
      const userRole = localStorage.getItem('role');
      
      if (!userId || !username) {
        console.error('No user ID or username found in session');
        document.getElementById('loading-indicator').style.display = 'none';
        document.getElementById('empty-reports').style.display = 'flex';
        return;
      }
      
     
      // Show loading indicator
      document.getElementById('loading-indicator').style.display = 'flex';
      document.getElementById('reports-list').innerHTML = '';
      document.getElementById('mapped-list').innerHTML = '';
      
      // Reference to reports in database
      const reportsRef = database.ref('reports');
      
      // Fetch reports
      reportsRef.once('value')
        .then(async (snapshot) => {
          const reports = snapshot.val();
          const userReports = [];
          const mappedDisasters = [];
          
          // Process all reports
          for (const key in reports) {
            if (reports.hasOwnProperty(key)) {
              const report = reports[key];
              
              // Check if the report belongs to the current user (submitted by them)
              if (report.userId === userId || report.createdBy === username) {
                userReports.push({
                  id: key,
                  ...report
                });
              }
              
              // Only check for mapped disasters if user is a response_team
              if (userRole === 'response_team' && report.status === 'resolved') {
                // Check if current user mapped this disaster
                if (report.mappedBy === userId) {
                  mappedDisasters.push({
                    id: key,
                    ...report,
                    userInvolvement: 'resolved'
                  });
                }
                // Check if current user was part of the rescue team
                else if (report.rescueTeams) {
                  const userInTeam = Object.values(report.rescueTeams).some(
                    team => team.userId === userId
                  );
                  if (userInTeam) {
                    mappedDisasters.push({
                      id: key,
                      ...report,
                      userInvolvement: 'team_member'
                    });
                  }
                }
              }
            }
          }
          
          // Sort reports by date (newest first)
          userReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          mappedDisasters.sort((a, b) => new Date(b.mappedAt || b.createdAt) - new Date(a.mappedAt || a.createdAt));
          
          // Process reports to get addresses
          const processedReports = await Promise.all(
            userReports.map(async (report) => {
              const coordinates = extractCoordinates(report.location);
              let address = report.location; // Default to original location
              
              if (coordinates) {
                // If we have coordinates, get the actual address
                address = await getAddressFromCoordinates(coordinates.latitude, coordinates.longitude);
              } else if (report.latitude && report.longitude) {
                // Use coordinates from report if available
                address = await getAddressFromCoordinates(report.latitude, report.longitude);
              }
              
              return {
                ...report,
                address: address
              };
            })
          );
          
          // Process mapped disasters to get addresses (only for response_team)
          let processedMapped = [];
          if (userRole === 'response_team') {
            processedMapped = await Promise.all(
              mappedDisasters.map(async (disaster) => {
                let address = disaster.location; // Default to original location
                
                if (disaster.latitude && disaster.longitude) {
                  // Use coordinates from disaster if available
                  address = await getAddressFromCoordinates(disaster.latitude, disaster.longitude);
                }
                
                return {
                  ...disaster,
                  address: address
                };
              })
            );
          }
          
          // Hide loading indicator
          document.getElementById('loading-indicator').style.display = 'none';
          
          // Display reports or empty state
          if (processedReports.length === 0) {
            document.getElementById('empty-reports').style.display = 'flex';
          } else {
            displayReports(processedReports);
          }
          
          // Display mapped disasters or empty state (only for response_team)
          if (userRole === 'response_team') {
            if (processedMapped.length === 0) {
              document.getElementById('empty-mapped').style.display = 'flex';
            } else {
              displayMappedDisasters(processedMapped);
            }
          }
        })
        .catch((error) => {
          console.error('Error fetching history:', error);
          document.getElementById('loading-indicator').style.display = 'none';
          document.getElementById('empty-reports').style.display = 'flex';
          alert('Error loading your history. Please try again.');
        });
    }

    // Function to display reports in the history list
    function displayReports(reports) {
      const reportsList = document.getElementById('reports-list');
      
      reports.forEach(report => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.setAttribute('data-report-id', report.id);
        
        const iconClass = getEmergencyClass(report.emergencyType);
        const iconName = getEmergencyIcon(report.emergencyType);
        const title = getEmergencyTitle(report.emergencyType);
        const message = getEmergencyMessage(report.emergencyType, report.mediaType, report.address);
        
        historyItem.innerHTML = `
          <div class="history-icon ${iconClass}">
            <i class="fas ${iconName}"></i>
          </div>
          <div class="history-details">
            <div class="history-title">${title}</div>
            <div class="history-message">${message}</div>
            <div class="history-meta">
              <div class="history-date">${formatDate(report.date)}</div>
              <div class="history-time">${report.formattedTime}</div>
            </div>
            <div class="history-actions">
              <button class="history-btn view-details-btn">View Details</button>
            </div>
          </div>
        `;
        
        reportsList.appendChild(historyItem);
      });
      
      // Add event listeners to the new history items
      addHistoryItemListeners();
    }

    // Function to display mapped disasters in the history list
    function displayMappedDisasters(disasters) {
      const mappedList = document.getElementById('mapped-list');
      
      disasters.forEach(disaster => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.setAttribute('data-report-id', disaster.id);
        
        const iconClass = getEmergencyClass(disaster.emergencyType);
        const iconName = getEmergencyIcon(disaster.emergencyType);
        const title = getEmergencyTitle(disaster.emergencyType);
        const message = getMappedMessage(disaster.emergencyType, disaster.address, disaster.mappedByName);
        
        let involvementBadge = '';
        if (disaster.userInvolvement === 'resolved') {
          involvementBadge = '<span class="mapped-badge">You Resolved This</span>';
        } else if (disaster.userInvolvement === 'team_member') {
          involvementBadge = '<span class="mapped-badge">Team Member</span>';
        }
        
        historyItem.innerHTML = `
          <div class="history-icon ${iconClass}">
            <i class="fas ${iconName}"></i>
          </div>
          <div class="history-details">
            <div class="history-title">
              ${title}
              ${involvementBadge}
            </div>
            <div class="history-message">${message}</div>
            <div class="history-meta">
              <div class="history-date">Completed on ${formatDateTime(disaster.mappedAt || disaster.createdAt)}</div>
            </div>
            ${disaster.rescueTeams ? `
              <div class="rescue-team-info">
                <strong>Response Team:</strong> 
                ${Object.values(disaster.rescueTeams).map(team => team.userName).join(', ')}
              </div>
            ` : ''}
            <div class="history-actions">
              <button class="history-btn view-details-btn">View Details</button>
            </div>
          </div>
        `;
        
        mappedList.appendChild(historyItem);
      });
      
      // Add event listeners to the new history items
      addHistoryItemListeners();
    }

    // Function to show media in modal
    function showMediaModal(report) {
      const modal = document.getElementById('media-modal');
      const mediaContainer = document.getElementById('media-container');
      const reportDetails = document.getElementById('report-details');
      
      // Clear previous content
      mediaContainer.innerHTML = '';
      reportDetails.innerHTML = '';
      
      // Add media (image or video)
      if (report.mediaUrl) {
        if (report.mediaType === 'image') {
          const img = document.createElement('img');
          img.src = report.mediaUrl;
          img.alt = 'Report Image';
          img.className = 'report-image';
          mediaContainer.appendChild(img);
        } else if (report.mediaType === 'video') {
          const video = document.createElement('video');
          video.src = report.mediaUrl;
          video.controls = true;
          video.className = 'report-video';
          mediaContainer.appendChild(video);
        }
      } else {
        // No media available
        mediaContainer.innerHTML = `
          <div class="no-media">
            <i class="fas fa-image"></i>
            <p>No media available for this report</p>
          </div>
        `;
      }
      
      // Add report details
      reportDetails.innerHTML = `
        <div class="detail-row">
          <div class="detail-label">Title:</div>
          <div class="detail-value">${report.title || 'Emergency Report'}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Type:</div>
          <div class="detail-value">${getEmergencyTitle(report.emergencyType)}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Date:</div>
          <div class="detail-value">${formatDate(report.date)}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Time:</div>
          <div class="detail-value">${report.formattedTime}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Location:</div>
          <div class="detail-value">${report.location || 'Location not specified'}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Status:</div>
          <div class="detail-value">${report.status || 'reported'}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Reported by:</div>
          <div class="detail-value">${report.createdByName || 'Unknown'}</div>
        </div>
        ${report.mappedByName ? `
          <div class="detail-row">
            <div class="detail-label">Resolved by:</div>
            <div class="detail-value">${report.mappedByName}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Resolved on:</div>
            <div class="detail-value">${formatDateTime(report.mappedAt)}</div>
          </div>
        ` : ''}
        ${report.rescueTeams ? `
          <div class="detail-row">
            <div class="detail-label">Response Team:</div>
            <div class="detail-value">
              ${Object.values(report.rescueTeams).map(team => team.userName).join(', ')}
            </div>
          </div>
        ` : ''}
      `;
      
      // Show modal
      modal.style.display = 'flex';
    }

    // Function to add event listeners to history items
    function addHistoryItemListeners() {
      // Button functionality
      document.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
          e.stopPropagation(); // Prevent triggering the parent item click
          
          const reportId = this.closest('.history-item').getAttribute('data-report-id');
          
          // Fetch the specific report details
          const reportsRef = database.ref('reports/' + reportId);
          reportsRef.once('value')
            .then((snapshot) => {
              const report = snapshot.val();
              if (report) {
                showMediaModal(report);
              } else {
                alert('Report details not found.');
              }
            })
            .catch((error) => {
              console.error('Error fetching report details:', error);
              alert('Error loading report details. Please try again.');
            });
        });
      });
    }

    // Tab switching functionality
    function setupTabs() {
      const tabs = document.querySelectorAll('.history-tab');
      const tabContents = document.querySelectorAll('.tab-content');
      
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const tabId = tab.getAttribute('data-tab');
          
          // Update active tab
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          
          // Show corresponding content
          tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === `${tabId}-list`) {
              content.classList.add('active');
            }
          });
          
          // Hide/show empty states
          if (tabId === 'reports') {
            document.getElementById('empty-reports').style.display = 
              document.getElementById('reports-list').children.length === 0 ? 'flex' : 'none';
            document.getElementById('empty-mapped').style.display = 'none';
          } else {
            document.getElementById('empty-mapped').style.display = 
              document.getElementById('mapped-list').children.length === 0 ? 'flex' : 'none';
            document.getElementById('empty-reports').style.display = 'none';
          }
        });
      });
    }

    // Check if user is logged in when page loads
    document.addEventListener('DOMContentLoaded', function () {
      if (!checkSession()) {
        // User is not logged in, redirect to login page
        alert('Please log in to access this page.');
        window.location.href = 'index.html';
        return;
      }

      // Check user role and setup UI accordingly
      const userRole = localStorage.getItem('role');
      const captainNavItem = document.getElementById('captain-nav-item');
      const responseNavItem = document.getElementById('response-nav-item');
      const homeNavItem = document.getElementById('home-nav-item');
      const responseHomeNavItem = document.getElementById('responsehome-nav-item');
      const completedMissionsTab = document.getElementById('completedMissionsTab');
      const pageSubtitle = document.getElementById('pageSubtitle');

      // Setup navigation based on role
      if (userRole && userRole.toLowerCase() === 'captain' && captainNavItem) {
        captainNavItem.style.display = 'flex';
      }
      if (userRole && userRole.toLowerCase() === 'response_team') {
        if (responseNavItem) responseNavItem.style.display = 'flex';
        if (homeNavItem) homeNavItem.style.display = 'none';
        if (responseHomeNavItem) responseHomeNavItem.style.display = 'flex';
      } else {
        // Hide "Completed Missions" tab for non-response_team users
        if (completedMissionsTab) {
          completedMissionsTab.style.display = 'none';
        }
        // Update page subtitle for non-response_team users
        if (pageSubtitle) {
          pageSubtitle.textContent = 'Review your past emergency reports';
        }
      }

      // Setup tabs
      setupTabs();

      // Fetch and display user history
      fetchUserHistory();

      // Simple navigation active state
      document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function (e) {
          document.querySelectorAll('.nav-item').forEach(nav => {
            nav.classList.remove('active');
          });
          this.classList.add('active');
        });
      });

      // Modal close functionality
      document.getElementById('modal-close').addEventListener('click', function() {
        document.getElementById('media-modal').style.display = 'none';
      });

      // Close modal when clicking outside
      document.getElementById('media-modal').addEventListener('click', function(e) {
        if (e.target === this) {
          this.style.display = 'none';
        }
      });
    });