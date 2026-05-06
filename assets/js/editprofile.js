 // Initialize Firebase
    let app;
    try {
      app = firebase.initializeApp(firebaseConfig);
      console.log("Firebase initialized successfully");
    } catch (error) {
      console.error("Firebase initialization error:", error);
    }

    // Reference to the database
    const database = firebase.database();

    // Function to check if session is valid
    function checkSession() {
      const isLoggedIn = localStorage.getItem('isLoggedIn');
      const expirationTime = localStorage.getItem('sessionExpiration');

      // Display session info in console for debugging
   
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
    }

    // Function to fetch user data from Firebase
    function fetchUserData() {
      return new Promise((resolve, reject) => {
        const userId = localStorage.getItem('userId');
        const rolePath = localStorage.getItem('rolePath');

        if (!userId || !rolePath) {
          reject(new Error("User ID or role path not found in session"));
          return;
        }

        // Construct the path based on the user's role
        const userRef = database.ref(`users/${rolePath}/${userId}`);

        userRef.once('value')
          .then(snapshot => {
            if (snapshot.exists()) {
              const userData = snapshot.val();
              resolve(userData);
            } else {
              reject(new Error("User data not found in database"));
            }
          })
          .catch(error => {
            console.error("Error fetching user data:", error);
            reject(error);
          });
      });
    }

    // Function to update user data in Firebase
    function updateUserData(updatedData) {
      return new Promise((resolve, reject) => {
        const userId = localStorage.getItem('userId');
        const rolePath = localStorage.getItem('rolePath');

        if (!userId || !rolePath) {
          reject(new Error("User ID or role path not found in session"));
          return;
        }

        // Construct the path based on the user's role
        const userRef = database.ref(`users/${rolePath}/${userId}`);

        userRef.update(updatedData)
          .then(() => {
            console.log("User data updated successfully");
            resolve();
          })
          .catch(error => {
            console.error("Error updating user data:", error);
            reject(error);
          });
      });
    }

    // Update the UI based on user data
    function updateProfileUI(userData) {
      // Update profile information
      document.getElementById('profile-name').textContent = userData.fullname || "Unknown";

      // Update form fields
      document.getElementById('username').value = userData.username || "";
      document.getElementById('fullname').value = userData.fullname || "";
      document.getElementById('contact').value = userData.phone || "";
      document.getElementById('email').value = userData.email || "";
      document.getElementById('address').value = userData.address || "";

      // Profile picture related code removed since the element is gone
    }

    // Back button functionality
    document.querySelector('.back-btn').addEventListener('click', function () {
      window.history.back();
    });

    // Hamburger menu functionality
    const hamburgerBtn = document.querySelector('.hamburger-btn');
    const hamburgerMenu = document.querySelector('.hamburger-menu');

    hamburgerBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      hamburgerMenu.classList.toggle('active');
    });

    // Close menu when clicking elsewhere
    document.addEventListener('click', function (e) {
      if (hamburgerMenu.classList.contains('active') &&
        !hamburgerMenu.contains(e.target) &&
        e.target !== hamburgerBtn) {
        hamburgerMenu.classList.remove('active');
      }
    });

    // Prevent menu from closing when clicking inside it
    hamburgerMenu.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    // Save button functionality
    document.getElementById('save-btn').addEventListener('click', function () {
      const saveBtn = this;
      const originalText = saveBtn.textContent;

      // Get updated values from form
      const updatedData = {
        username: document.getElementById('username').value.trim(),
        fullname: document.getElementById('fullname').value.trim(),
        phone: document.getElementById('contact').value.trim(),
        email: document.getElementById('email').value.trim(),
        address: document.getElementById('address').value.trim()
      };

      // Validate required fields
      if (!updatedData.username || !updatedData.fullname || !updatedData.email) {
        alert('Please fill in all required fields (Username, Full Name, Email)');
        return;
      }

      // Show loading state
      saveBtn.innerHTML = '<div class="spinner"></div> Saving...';
      saveBtn.disabled = true;

      // Update user data in Firebase
      updateUserData(updatedData)
        .then(() => {
          // Update session storage with new values
          localStorage.setItem('username', updatedData.username);
          localStorage.setItem('fullname', updatedData.fullname);
          localStorage.setItem('email', updatedData.email);

          alert('Profile updated successfully!');
          saveBtn.textContent = originalText;
          saveBtn.disabled = false;
          window.location.href = "profile.html"; // Redirect to profile page
        })
        .catch(error => {
          console.error("Error updating profile:", error);
          alert('Error updating profile. Please try again.');
          saveBtn.textContent = originalText;
          saveBtn.disabled = false;
        });
    });

    // Logout function
    function logout() {
      if (confirm('Are you sure you want to log out?')) {
        clearSession();
        window.location.href = "index.html";
      }
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

    if (userRole.toLowerCase() === 'response_team') {
      if (responseNavItem) responseNavItem.style.display = 'flex';
      if (homeNavItem) homeNavItem.style.display = 'none';
      if (responseHomeNavItem) responseHomeNavItem.style.display = 'flex';
    }
    // Add event listener to logout button
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', logout);
    }

    // Camera icon functionality removed since the element is gone

    // Check session and load user data when page loads
    document.addEventListener('DOMContentLoaded', function () {
      if (!checkSession()) {
        // User is not logged in, redirect to login page
        alert('Please log in to access this page.');
        window.location.href = 'index.html';
        return;
      }

      // Fetch user data from Firebase
      fetchUserData()
        .then(userData => {
          // Update UI with user data
          updateProfileUI(userData);
        })
        .catch(error => {
          console.error("Error loading user data:", error);
          alert('Error loading profile information. Please try again.');
        });
    });