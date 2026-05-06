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

    const inputs = document.querySelectorAll('.pin-box');
    const form = document.getElementById('pinForm');
    const submitBtn = document.getElementById('submitBtn');
    const buttonText = document.getElementById('buttonText');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const attemptsWarning = document.getElementById('attemptsWarning');
    const attemptsText = document.getElementById('attemptsText');

    // Track failed attempts
    let failedAttempts = 0;
    const maxAttempts = 5;
    let lockUntil = 0;

    // Session management functions (same as login example)
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

    // Get current user data from session
    function getCurrentUserData() {
      if (!checkSession()) {
        return null;
      }

      const userId = localStorage.getItem('userId');
      const username = localStorage.getItem('username');
      const fullname = localStorage.getItem('fullname');
      const role = localStorage.getItem('role');
      const status = localStorage.getItem('status');
      const rolePath = localStorage.getItem('rolePath');

      if (!userId) {
        return null;
      }

      return {
        userId: userId,
        username: username,
        fullname: fullname,
        role: role,
        status: status,
        rolePath: rolePath
      };
    }

    // Multi-user session management
    function getCurrentUsers() {
      try {
        const sessionUsers = JSON.parse(localStorage.getItem('currentUsers') || '[]');
        return sessionUsers;
      } catch (e) {
        return [];
      }
    }

    function addUserToCurrentUsers(userId) {
      const currentUsers = getCurrentUsers();
      if (!currentUsers.includes(userId)) {
        currentUsers.push(userId);
        localStorage.setItem('currentUsers', JSON.stringify(currentUsers));
      }
    }

    function removeUserFromCurrentUsers(userId) {
      const currentUsers = getCurrentUsers().filter(id => id !== userId);
      localStorage.setItem('currentUsers', JSON.stringify(currentUsers));
    }

    // Verify PIN from Firebase for a specific user
    function verifyPIN(userId, enteredPIN) {
      return database.ref(`user_pins/${userId}`).once('value')
        .then(snapshot => {
          if (snapshot.exists()) {
            const pinData = snapshot.val();
            return pinData.pin === enteredPIN;
          }
          return false;
        });
    }

    // Verify PIN against all logged-in users
    async function verifyPINAgainstUsers(enteredPIN) {
      const currentUsers = getCurrentUsers();
      
      for (const userId of currentUsers) {
        try {
          const isValid = await verifyPIN(userId, enteredPIN);
          if (isValid) {
            // PIN matches this user - get user data
            const userData = await getUserDataFromDatabase(userId);
            if (userData) {
              return {
                success: true,
                userId: userId,
                userData: userData
              };
            }
          }
        } catch (error) {
          console.error(`Error verifying PIN for user ${userId}:`, error);
        }
      }
      
      return { success: false };
    }

    // Get user data from database
    async function getUserDataFromDatabase(userId) {
      const roleCategories = ['barangay_captain', 'barangay_official', 'response_team'];
      
      for (const role of roleCategories) {
        try {
          const snapshot = await database.ref(`users/${role}/${userId}`).once('value');
          if (snapshot.exists()) {
            return {
              ...snapshot.val(),
              rolePath: role
            };
          }
        } catch (error) {
          console.error(`Error getting user data from ${role}:`, error);
        }
      }
      return null;
    }

    // Update last used timestamp
    function updateLastUsed(userId) {
      return database.ref(`user_pins/${userId}/lastUsed`).set(new Date().toISOString());
    }

    // Redirect to appropriate home page based on user role
    function redirectToHomePage(userData, userId, rolePath) {
      // Create session for the user (same as login example)
      setSession(userData, userId, rolePath);

      // Check approval status
      const userStatus = userData.status || "pending";

      if (userStatus === "approved") {
        if (rolePath === "response_team") {
          window.location.href = "responsehome.html";
        } else {
          window.location.href = "home.html";
        }
      } else if (userStatus === "rejected") {
        alert("Your account has been rejected. Please contact support.");
        // Clear session and redirect to login
        clearSession();
        removeUserFromCurrentUsers(userId);
        window.location.href = "login.html";
      } else {
        alert("Your account is pending approval. You will be redirected to the pending page.");
        window.location.href = "pending.html?userId=" + encodeURIComponent(userId);
      }
    }

    // Show error message
    function showError(message) {
      errorText.textContent = message;
      errorMessage.style.display = 'block';
      attemptsWarning.style.display = 'none';
    }

    // Hide error message
    function hideError() {
      errorMessage.style.display = 'none';
    }

    // Show attempts warning
    function showAttemptsWarning(message) {
      attemptsText.textContent = message;
      attemptsWarning.style.display = 'block';
      errorMessage.style.display = 'none';
    }

    // Hide attempts warning
    function hideAttemptsWarning() {
      attemptsWarning.style.display = 'none';
    }

    // Check if account is locked
    function isLocked() {
      return lockUntil > Date.now();
    }

    // Lock account temporarily
    function lockAccount() {
      failedAttempts++;
      if (failedAttempts >= maxAttempts) {
        lockUntil = Date.now() + (5 * 60 * 1000); // 5 minutes
        showAttemptsWarning(`Too many failed attempts. Please try again in 5 minutes.`);
        disableForm();
        
        // Re-enable after lock period
        setTimeout(() => {
          failedAttempts = 0;
          lockUntil = 0;
          enableForm();
          hideAttemptsWarning();
          inputs[0].focus();
        }, 5 * 60 * 1000);
      } else {
        const remaining = maxAttempts - failedAttempts;
        showAttemptsWarning(`Invalid PIN. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
      }
    }

    // Disable form
    function disableForm() {
      inputs.forEach(input => {
        input.disabled = true;
        input.classList.add('disabled');
      });
      submitBtn.disabled = true;
    }

    // Enable form
    function enableForm() {
      inputs.forEach(input => {
        input.disabled = false;
        input.classList.remove('disabled');
      });
      checkFormCompletion();
    }

    // Check if any users are logged in
    function checkAnyUserLoggedIn() {
      const currentUsers = getCurrentUsers();
      return currentUsers.length > 0;
    }

    // Auto-focus first input on load
    window.addEventListener('load', () => {
      // Check if any user is logged in
      if (!checkAnyUserLoggedIn()) {
        alert('Please log in first.');
        window.location.href = 'login.html';
        return;
      }

      inputs[0].focus();
      hideError();
      hideAttemptsWarning();

      // Check if account is locked from previous session
      const storedLock = localStorage.getItem('pinLockUntil');
      if (storedLock && parseInt(storedLock) > Date.now()) {
        lockUntil = parseInt(storedLock);
        disableForm();
        showAttemptsWarning(`Account temporarily locked. Please try again later.`);
        
        setTimeout(() => {
          lockUntil = 0;
          localStorage.removeItem('pinLockUntil');
          enableForm();
          hideAttemptsWarning();
          inputs[0].focus();
        }, lockUntil - Date.now());
      }
    });

    // PIN input handling
    inputs.forEach((input, index) => {
      input.addEventListener('input', () => {
        if (isLocked()) return;
        
        input.value = input.value.replace(/\D/, '');
        
        if (input.value) {
          input.classList.add('entered');
          if (index < inputs.length - 1) {
            inputs[index + 1].focus();
          }
        } else {
          input.classList.remove('entered');
        }
        
        checkFormCompletion();
        hideError();
        hideAttemptsWarning();
      });

      input.addEventListener('keydown', (e) => {
        if (isLocked()) {
          e.preventDefault();
          return;
        }

        const allowedKeys = ['Backspace', 'ArrowLeft', 'ArrowRight', 'Tab', 'Delete'];
        
        if (!allowedKeys.includes(e.key) && !/^\d$/.test(e.key)) {
          e.preventDefault();
          return;
        }

        if (e.key === 'Backspace' && input.value === '' && index > 0) {
          inputs[index - 1].focus();
          inputs[index - 1].value = '';
          inputs[index - 1].classList.remove('entered');
          checkFormCompletion();
        }
        
        if (e.key === 'ArrowLeft' && index > 0) {
          inputs[index - 1].focus();
        }
        
        if (e.key === 'ArrowRight' && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        if (isLocked()) return;
        
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        
        if (/^\d+$/.test(pasted)) {
          const digits = pasted.split('').slice(0, inputs.length);
          digits.forEach((digit, idx) => {
            if (inputs[index + idx]) {
              inputs[index + idx].value = digit;
              inputs[index + idx].classList.add('entered');
            }
          });
          
          const lastFilledIndex = Math.min(index + digits.length - 1, inputs.length - 1);
          inputs[lastFilledIndex].focus();
          checkFormCompletion();
        }
      });

      // Click to focus and select
      input.addEventListener('click', function() {
        if (!isLocked()) {
          this.focus();
          this.select();
        }
      });
    });

    function checkFormCompletion() {
      if (isLocked()) {
        submitBtn.disabled = true;
        return;
      }
      
      const allFilled = Array.from(inputs).every(input => input.value !== '');
      submitBtn.disabled = !allFilled;
    }

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (isLocked()) {
        showAttemptsWarning('Account temporarily locked. Please try again later.');
        return;
      }
      
      // Check if any user is logged in
      if (!checkAnyUserLoggedIn()) {
        showError('No users are logged in. Please sign in first.');
        return;
      }
      
      // Get the complete PIN
      const pin = Array.from(inputs).map(input => input.value).join('');
      
      // Validate PIN
      if (pin.length !== 4) {
        showError('Please enter a valid 4-digit PIN');
        return;
      }

      // Show loading state
      buttonText.innerHTML = '<div class="spinner"></div> Verifying...';
      submitBtn.disabled = true;
      hideError();
      hideAttemptsWarning();
      
      try {
        // Verify PIN against all logged-in users
        const result = await verifyPINAgainstUsers(pin);
        
        if (result.success) {
          // Reset failed attempts on success
          failedAttempts = 0;
          lockUntil = 0;
          localStorage.removeItem('pinLockUntil');
          
          // Update last used timestamp
          await updateLastUsed(result.userId);
          
          // Add user to current users list if not already there
          addUserToCurrentUsers(result.userId);
          
          // Redirect to appropriate home page based on user role
          redirectToHomePage(result.userData, result.userId, result.userData.rolePath);
        } else {
          lockAccount();
          // Clear inputs and focus first
          inputs.forEach(input => {
            input.value = '';
            input.classList.remove('entered');
          });
          inputs[0].focus();
          
          // Store lock state in localStorage
          if (lockUntil > 0) {
            localStorage.setItem('pinLockUntil', lockUntil.toString());
          }
        }
        
      } catch (error) {
        console.error('Error verifying PIN:', error);
        showError('Error verifying PIN. Please try again.');
      } finally {
        // Reset button state
        buttonText.innerHTML = 'Verify PIN';
        checkFormCompletion();
      }
    });

    // Check URL parameters for logout
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('logout') === 'true') {
      // Clear all sessions
      const currentUsers = getCurrentUsers();
      currentUsers.forEach(userId => {
        removeUserFromCurrentUsers(userId);
      });
      clearSession();
      window.location.href = 'login.html';
    }

    // Check if user is already logged in when page loads
    document.addEventListener('DOMContentLoaded', function () {
      // Check session for backward compatibility
      if (checkSession()) {
        const userStatus = localStorage.getItem('status');
        const rolePath = localStorage.getItem('rolePath');

        if (userStatus === "approved") {
          if (rolePath === "response_team") {
            window.location.href = "responsehome.html";
          } else {
            window.location.href = "home.html";
          }
        } else {
          const userId = localStorage.getItem('userId');
          window.location.href = "pending.html?userId=" + encodeURIComponent(userId);
        }
      }
    });