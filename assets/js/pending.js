  try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase initialized');
      } else {
        firebase.app();
        console.log('Using existing Firebase app');
      }
    } catch (err) {
      console.error('Firebase initialization error:', err);
    }

    const database = firebase.database();

    // Function to set session data (consistent with login page)
    function setSession(userData, userId, rolePath) {
      // Store user data in localStorage
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userId', userId);
      localStorage.setItem('username', userData.username);
      localStorage.setItem('status', userData.status || 'pending');
      localStorage.setItem('rolePath', rolePath);

      // Store additional user data as needed
      if (userData.email) {
        localStorage.setItem('email', userData.email);
      }
      if (userData.fullname) {
        localStorage.setItem('fullname', userData.fullname);
      }
      if (userData.role) {
        localStorage.setItem('role', userData.role);
      }

      // Set expiration time (8 hours from now)
      const expirationTime = new Date().getTime() + (8 * 60 * 60 * 1000);
      localStorage.setItem('sessionExpiration', expirationTime.toString());
    }

    // Function to check if session is valid
    function checkSession() {
      const isLoggedIn = localStorage.getItem('isLoggedIn');
      const expirationTime = localStorage.getItem('sessionExpiration');

      if (!isLoggedIn || !expirationTime) {
        return false;
      }

      // Check if session has expired
      if (new Date().getTime() > parseInt(expirationTime)) {
        clearSession();
        return false;
      }

      return true;
    }

    // Function to clear session data (consistent with login page)
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
    }

    // Logout handler - clears session and redirects
    function logout() {
      if (!confirm('Are you sure you want to log out?')) return;
      clearSession();
      window.location.href = 'login.html';
    }

    // Function to redirect based on user role (consistent with login page)
    function redirectBasedOnRole(role, rolePath) {
      // Update session storage with current status
      localStorage.setItem('status', 'approved');
      localStorage.setItem('role', role);
      localStorage.setItem('rolePath', rolePath);
      
      // Redirect based on role
      switch(role) {
        case 'response_team':
          window.location.href = 'responsehome.html';
          break;
        case 'captain':
          window.location.href = 'home.html';
          break;
        case 'official':
          window.location.href = 'home.html';
          break;
        default:
          window.location.href = 'home.html';
      }
    }

    // Function to check approval status periodically
    function startApprovalStatusCheck(userId, currentRolePath) {
      // Check every 30 seconds
      const checkInterval = setInterval(async () => {
        try {
          const snapshot = await database.ref(`users/${currentRolePath}/${userId}`).once('value');
          if (snapshot.exists()) {
            const userData = snapshot.val();
            
            // If user is approved, redirect them
            if (userData.status === 'approved') {
              clearInterval(checkInterval); // Stop checking
              console.log('Account approved! Redirecting...');
              
              // Update session storage with approved status
              setSession(userData, userId, currentRolePath);
              
              // Redirect based on role
              redirectBasedOnRole(userData.role, currentRolePath);
            }
          }
        } catch (err) {
          console.error('Error checking approval status:', err);
        }
      }, 30000); // Check every 30 seconds

      // Store interval ID so we can clear it if needed
      return checkInterval;
    }

    document.addEventListener('DOMContentLoaded', async function() {
      const urlParams = new URLSearchParams(window.location.search);
      const userId = urlParams.get('userId') || localStorage.getItem('userId');

      // Attach logout handler to button (guard in case element missing)
      const logoutBtn = document.querySelector('.logout-btn');
      if (logoutBtn) logoutBtn.addEventListener('click', logout);

      if (!userId) {
        alert('No user information found. Please log in again.');
        clearSession();
        window.location.href = 'login.html';
        return;
      }

      // Fetch user data (search roles) using a reliable async flow
      try {
        const userInfo = await fetchUserData(userId);
        if (!userInfo) {
          alert('User data not found. Please try logging in again.');
          clearSession();
          window.location.href = 'login.html';
          return;
        }

        const userData = userInfo.userData;
        const rolePath = userInfo.rolePath;

        // Check if we need to create a session (user coming from registration)
        if (!checkSession()) {
          console.log('Creating new session for user from registration...');
          setSession(userData, userId, rolePath);
        } else {
          console.log('Updating existing session...');
          setSession(userData, userId, rolePath);
        }

        // Update UI
        updateProfileUI(userData);

        // If user is already approved, redirect them immediately
        if (userData.status === 'approved') {
          console.log('Account already approved. Redirecting...');
          redirectBasedOnRole(userData.role, rolePath);
          return; // Stop further execution
        }

        // If user is pending, start checking for approval status
        if (userData.status === 'pending' || !userData.status) {
          console.log('Account pending. Starting approval status check...');
          startApprovalStatusCheck(userId, rolePath);
        }

      } catch (err) {
        console.error('Error fetching user data:', err);
        alert('An error occurred while loading your profile. Check console for details.');
      }

      // Setup profile upload (only activates when the user is approved and the input exists)
      setupProfileUpload();
    });

    // Fetch user data by checking each role path (returns {userData, rolePath} or null)
    async function fetchUserData(userId) {
      const roleCategories = [ 'barangay_captain', 'barangay_official', 'response_team'];

      for (const role of roleCategories) {
        try {
          const snapshot = await database.ref(`users/${role}/${userId}`).once('value');
          if (snapshot.exists()) {
            return { userData: snapshot.val(), rolePath: role };
          }
        } catch (err) {
          console.error(`Error checking ${role}:`, err);
          // continue to next role
        }
      }

      // not found in any role
      return null;
    }

    // Update the UI based on user data
    function updateProfileUI(userData) {
      document.getElementById('profile-name').textContent = userData.fullname || 'Not provided';
      document.getElementById('profile-contact').textContent = userData.phone || 'Not provided';

      // Format role for display
      let roleDisplay = '';
      switch (userData.role) {
        case 'admin': roleDisplay = 'Admin'; break;
        case 'captain': roleDisplay = 'Barangay Captain'; break;
        case 'official': roleDisplay = 'Barangay Official'; break;
        case 'response_team': roleDisplay = 'Response Team'; break;
        default: roleDisplay = userData.role || 'Not provided';
      }

      document.getElementById('info-member').textContent = roleDisplay;
      document.getElementById('info-username').textContent = userData.username || 'Not provided';
      document.getElementById('info-email').textContent = userData.email || 'Not provided';
      document.getElementById('info-address').textContent = userData.address || 'Not provided';

      const statusBadge = document.getElementById('status-badge');
      const statusMessage = document.getElementById('status-message');
      const uploadSection = document.getElementById('upload-section');

      // Default: hide upload section unless approved
      uploadSection.style.display = 'none';

      // Update based on approval status
      if (userData.status === 'pending' || !userData.status) {
        statusBadge.className = 'status-badge status-pending';
        statusBadge.textContent = 'Pending Approval';
        statusMessage.style.display = 'block';
        uploadSection.style.display = 'none';
      } else if (userData.status === 'approved') {
        statusBadge.className = 'status-badge status-approved';
        statusBadge.textContent = 'Approved';
        statusMessage.style.display = 'none';
        uploadSection.style.display = 'block';

        // If user has a profile picture, show it
        if (userData.profilePicture) {
          const avatarIcon = document.getElementById('avatar-icon');
          if (avatarIcon) avatarIcon.style.display = 'none';

          const profileAvatar = document.getElementById('profile-avatar');
          profileAvatar.style.backgroundImage = `url(${userData.profilePicture})`;
          profileAvatar.style.backgroundSize = 'cover';
          profileAvatar.style.backgroundPosition = 'center';
        }
      } else if (userData.status === 'rejected') {
        statusBadge.className = 'status-badge status-rejected';
        statusBadge.textContent = 'Rejected';
        statusMessage.querySelector('.status-icon i').className = 'fas fa-times-circle';
        statusMessage.querySelector('.status-title').textContent = 'Your account was not approved';
        statusMessage.querySelector('.status-desc').textContent = 'Please contact support for more information about why your account was rejected.';
        statusMessage.style.display = 'block';
        uploadSection.style.display = 'none';
      }
    }

    // Setup profile picture upload functionality
    function setupProfileUpload() {
      const fileInput = document.getElementById('file-input');
      if (!fileInput) return; // nothing to do if input missing

      fileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
          const file = this.files[0];

          // Validate type and size
          if (!file.type.match('image.*')) {
            alert('Please select an image file.');
            return;
          }
          if (file.size > 2 * 1024 * 1024) {
            alert('Please select an image smaller than 2MB.');
            return;
          }

          const reader = new FileReader();
          reader.onload = async function(e) {
            // Show preview locally
            const avatarIcon = document.getElementById('avatar-icon');
            if (avatarIcon) avatarIcon.style.display = 'none';

            const profileAvatar = document.getElementById('profile-avatar');
            profileAvatar.style.backgroundImage = `url(${e.target.result})`;
            profileAvatar.style.backgroundSize = 'cover';
            profileAvatar.style.backgroundPosition = 'center';

            // Update in DB
            const userId = localStorage.getItem('userId');
            if (!userId) {
              alert('User session not found. Please log in again.');
              window.location.href = 'login.html';
              return;
            }

            try {
              const ok = await updateProfilePictureInFirebase(userId, e.target.result);
              if (ok) {
                alert('Profile picture updated successfully!');
              } else {
                alert('Error updating profile picture. User not found in database.');
              }
            } catch (err) {
              console.error('Error updating profile picture:', err);
              alert('Error updating profile picture. Please try again.');
            }
          };

          reader.readAsDataURL(file);
        }
      });
    }

    async function updateProfilePictureInFirebase(userId, imageData) {
      const roleCategories = ['admin', 'barangay_captain', 'barangay_official', 'response_team'];

      for (const role of roleCategories) {
        try {
          const snapshot = await database.ref(`users/${role}/${userId}`).once('value');
          if (snapshot.exists()) {
            await database.ref(`users/${role}/${userId}`).update({ profilePicture: imageData });
            return true;
          }
        } catch (err) {
          console.error(`Error updating profile picture in ${role}:`, err);
 
        }
      }

      return false;
    }