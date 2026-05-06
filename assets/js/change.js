
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

    // Function to update password in Firebase
    function updatePassword(newPassword) {
      return new Promise((resolve, reject) => {
        const userId = localStorage.getItem('userId');
        const rolePath = localStorage.getItem('rolePath');

        if (!userId || !rolePath) {
          reject(new Error("User ID or role path not found in session"));
          return;
        }

        // Construct the path based on the user's role
        const userRef = database.ref(`users/${rolePath}/${userId}`);

        userRef.update({ password: newPassword })
          .then(() => {
            console.log("Password updated successfully");
            resolve();
            window.location.href = "profile.html"; // Redirect to profile page after successful update
          })
          .catch(error => {
            console.error("Error updating password:", error);
            reject(error);
          });
      });
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

    // Password toggle functionality
    document.querySelectorAll('.password-toggle').forEach(toggle => {
      toggle.addEventListener('click', function () {
        const input = this.previousElementSibling;
        const icon = this.querySelector('i');

        if (input.type === 'password') {
          input.type = 'text';
          icon.classList.remove('fa-eye');
          icon.classList.add('fa-eye-slash');
        } else {
          input.type = 'password';
          icon.classList.remove('fa-eye-slash');
          icon.classList.add('fa-eye');
        }
      });
    });

    // Password strength meter functionality
    const passwordInput = document.getElementById('newpass');
    const strengthBar = document.getElementById('password-strength-bar');
    const strengthText = document.getElementById('password-strength-text');

    passwordInput.addEventListener('input', function () {
      const password = this.value;
      let strength = 0;
      let message = '';

      // Check password strength
      if (password.length > 0) {
        // Length check
        if (password.length < 6) {
          strength = 1; // Weak
          message = 'Weak - too short';
        } else {
          strength++; // At least 6 characters

          // Check for uppercase, lowercase, numbers, and special characters
          if (/[A-Z]/.test(password)) strength++;
          if (/[0-9]/.test(password)) strength++;
          if (/[^A-Za-z0-9]/.test(password)) strength++;

          // Determine strength level
          if (strength <= 2) {
            message = 'Weak';
          } else if (strength === 3) {
            message = 'Medium';
          } else {
            message = 'Strong';
          }
        }
      } else {
        message = '';
      }

      // Update strength bar and text
      strengthBar.className = 'password-strength-bar';
      if (password.length === 0) {
        strengthBar.style.width = '0';
        strengthText.textContent = '';
      } else if (strength <= 2) {
        strengthBar.classList.add('strength-weak');
        strengthText.textContent = message;
        strengthText.style.color = '#ff4d4f';
      } else if (strength === 3) {
        strengthBar.classList.add('strength-medium');
        strengthText.textContent = message;
        strengthText.style.color = '#faad14';
      } else {
        strengthBar.classList.add('strength-strong');
        strengthText.textContent = message;
        strengthText.style.color = '#52c41a';
      }
    });

    // Save button functionality
    document.getElementById('save-btn').addEventListener('click', function () {
      const saveBtn = this;
      const originalText = saveBtn.textContent;

      const currentPass = document.getElementById('currentpass').value;
      const newPass = document.getElementById('newpass').value;
      const confirmPass = document.getElementById('confirmpass').value;

      if (!currentPass || !newPass || !confirmPass) {
        alert('Please fill in all password fields');
        return;
      }

      if (newPass !== confirmPass) {
        alert('New password and confirmation do not match');
        return;
      }

      if (newPass.length < 6) {
        alert('Password should be at least 6 characters long');
        return;
      }

      // Show loading state
      saveBtn.innerHTML = '<div class="spinner"></div> Saving...';
      saveBtn.disabled = true;

      // First verify current password
      fetchUserData()
        .then(userData => {
          if (userData.password !== currentPass) {
            throw new Error("Current password is incorrect");
          }

          // Update password in Firebase
          return updatePassword(newPass);
        })
        .then(() => {
          alert('Password changed successfully!');
          // Clear form fields
          document.getElementById('currentpass').value = '';
          document.getElementById('newpass').value = '';
          document.getElementById('confirmpass').value = '';
          strengthBar.style.width = '0';
          strengthText.textContent = '';
        })
        .catch(error => {
          console.error("Error changing password:", error);
          if (error.message === "Current password is incorrect") {
            alert('Current password is incorrect. Please try again.');
          } else {
            alert('Error changing password. Please try again.');
          }
        })
        .finally(() => {
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

    // Add event listener to logout button
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', logout);
    }

    // Check session when page loads
    document.addEventListener('DOMContentLoaded', function () {
      if (!checkSession()) {
        // User is not logged in, redirect to login page
        alert('Please log in to access this page.');
        window.location.href = 'index.html';
        return;
      }

      // Fetch user data to verify session is valid
      fetchUserData()
        .then(userData => {
          console.log("User data loaded successfully");
        })
        .catch(error => {
          console.error("Error loading user data:", error);
          alert('Error loading user information. Please log in again.');
          clearSession();
          window.location.href = 'index.html';
        });
    });