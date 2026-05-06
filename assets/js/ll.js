   // Initialize Firebase
    let app;
    try {
      app = firebase.initializeApp(firebaseConfig);
      console.log("Firebase initialized successfully");
    } catch (error) {
      console.error("Firebase initialization error:", error);
    }

    // Reference to the database and auth
    const database = firebase.database();
    const auth = firebase.auth();

    // Multi-user session management
    function setUserSession(userData, userId, rolePath) {
      const userSessionKey = `user_${userId}`;
      const currentUserList = getCurrentUsers();
      
      // Add to current users list if not already there
      if (!currentUserList.includes(userId)) {
        currentUserList.push(userId);
        localStorage.setItem('currentUsers', JSON.stringify(currentUserList));
      }
      
      // Store individual user session data using YOUR EXACT structure
      const userSession = {
        isLoggedIn: 'true',
        userId: userId,
        username: userData.username,
        status: userData.status || 'pending',
        rolePath: rolePath,
        email: userData.email || '',
        fullname: userData.fullname || '',
        role: userData.role || '',
        loginTime: new Date().getTime(),
        sessionExpiration: new Date().getTime() + (8 * 60 * 60 * 1000)
      };
      
      localStorage.setItem(userSessionKey, JSON.stringify(userSession));
      
      // Set active user
      localStorage.setItem('activeUser', userId);
      
      console.log('User session set for:', userData.fullname || userData.username);
    }

    function getActiveUserSession() {
      const activeUserId = localStorage.getItem('activeUser');
      if (!activeUserId) return null;
      
      const userSessionKey = `user_${activeUserId}`;
      const sessionData = localStorage.getItem(userSessionKey);
      
      if (!sessionData) {
        clearUserSession(activeUserId);
        return null;
      }
      
      try {
        const userSession = JSON.parse(sessionData);
        
        // Check if session expired
        if (new Date().getTime() > userSession.sessionExpiration) {
          clearUserSession(activeUserId);
          return null;
        }
        
        return userSession;
      } catch (e) {
        console.error('Error parsing user session:', e);
        return null;
      }
    }

    function getCurrentUsers() {
      try {
        return JSON.parse(localStorage.getItem('currentUsers')) || [];
      } catch (e) {
        return [];
      }
    }

    function clearUserSession(userId) {
      const userSessionKey = `user_${userId}`;
      
      // Remove from localStorage
      localStorage.removeItem(userSessionKey);
      
      // Update current users list
      const currentUsers = getCurrentUsers().filter(id => id !== userId);
      localStorage.setItem('currentUsers', JSON.stringify(currentUsers));
      
      // If this was the active user, clear active user
      const activeUser = localStorage.getItem('activeUser');
      if (activeUser === userId) {
        localStorage.removeItem('activeUser');
        
        // Set another user as active if available
        if (currentUsers.length > 0) {
          localStorage.setItem('activeUser', currentUsers[0]);
        }
      }

      console.log('User session cleared:', userId);
      updateUserList();
    }

    function switchActiveUser(userId) {
      const userSessionKey = `user_${userId}`;
      const sessionData = localStorage.getItem(userSessionKey);
      
      if (!sessionData) {
        console.error('User session not found');
        return false;
      }
      
      try {
        const userSession = JSON.parse(sessionData);
        
        // Check if session expired
        if (new Date().getTime() > userSession.sessionExpiration) {
          clearUserSession(userId);
          return false;
        }
        
        // Set as active user
        localStorage.setItem('activeUser', userId);
        
        // Update UI
        updateUserList();
        
        // Redirect based on PIN status
        redirectBasedOnPINStatus(userSession);
        
        return true;
      } catch (e) {
        console.error('Error switching user:', e);
        return false;
      }
    }

    function logoutAllUsers() {
      const currentUsers = getCurrentUsers();
      currentUsers.forEach(userId => {
        const userSessionKey = `user_${userId}`;
        localStorage.removeItem(userSessionKey);
      });
      localStorage.removeItem('currentUsers');
      localStorage.removeItem('activeUser');
      
      updateUserList();
      hideError();
    }

    function updateUserList() {
      const userList = document.getElementById('userList');
      const userSwitcher = document.getElementById('userSwitcher');
      const currentUsers = getCurrentUsers();
      const activeUser = localStorage.getItem('activeUser');
      
      userList.innerHTML = '';
      
      if (currentUsers.length === 0) {
        userSwitcher.style.display = 'none';
        return;
      }
      
      userSwitcher.style.display = 'block';
      
      currentUsers.forEach(userId => {
        const userSessionKey = `user_${userId}`;
        const sessionData = localStorage.getItem(userSessionKey);
        
        if (sessionData) {
          try {
            const userSession = JSON.parse(sessionData);
            const userBadge = document.createElement('div');
            userBadge.className = `user-badge ${userId === activeUser ? 'active' : ''}`;
            userBadge.onclick = () => switchActiveUser(userId);
            
            const initial = userSession.fullname ? userSession.fullname.charAt(0).toUpperCase() : 'U';
            
            userBadge.innerHTML = `
              <div class="user-avatar">${initial}</div>
              <div class="user-info">
                <div class="user-name">${userSession.fullname || userSession.username}</div>
                <div class="user-role">${userSession.role} • ${userSession.status}</div>
              </div>
            `;
            
            userList.appendChild(userBadge);
          } catch (e) {
            console.error('Error parsing user session for display:', e);
          }
        }
      });
    }

    // Check if user has PIN
    async function checkUserHasPIN(userId) {
      try {
        const snapshot = await database.ref(`user_pins/${userId}`).once('value');
        return snapshot.exists();
      } catch (error) {
        console.error('Error checking PIN:', error);
        return false;
      }
    }

    // Redirect based on PIN status
    async function redirectBasedOnPINStatus(userSession) {
      const hasPIN = await checkUserHasPIN(userSession.userId);
      
      if (userSession.status === "approved") {
        if (!hasPIN) {
          // First login - redirect to create PIN
          window.location.href = "lll.html";
        } else {
          // User has PIN - redirect to PIN verification
          window.location.href = "llll.html";
        }
      } else if (userSession.status === "rejected") {
        alert("Your account has been rejected. Please contact support.");
        clearUserSession(userSession.userId);
      } else {
        window.location.href = "pending.html?userId=" + encodeURIComponent(userSession.userId);
      }
    }

    function togglePassword() {
      const passwordInput = document.getElementById('password');
      const toggleIcon = document.querySelector('.toggle-password i');

      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.classList.remove('fa-eye');
        toggleIcon.classList.add('fa-eye-slash');
      } else {
        passwordInput.type = 'password';
        toggleIcon.classList.remove('fa-eye-slash');
        toggleIcon.classList.add('fa-eye');
      }
    }

    // YOUR ORIGINAL setSession function - now enhanced for multi-user
    function setSession(userData, userId, rolePath) {
      // Store user data in localStorage using YOUR EXACT structure
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userId', userId);
      localStorage.setItem('username', userData.username);
      localStorage.setItem('status', userData.status || 'pending');
      localStorage.setItem('rolePath', rolePath);

      // You can store additional user data as needed
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

      // ALSO store in multi-user system for switching capability
      setUserSession(userData, userId, rolePath);
    }

    // YOUR ORIGINAL checkSession function
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

    // YOUR ORIGINAL clearSession function
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
      
      // Also clear from multi-user system
      const activeUserId = localStorage.getItem('activeUser');
      if (activeUserId) {
        clearUserSession(activeUserId);
      }
    }

    // Show error message
    function showError(message) {
      const errorElement = document.getElementById('errorMessage');
      errorElement.innerHTML = `<strong>Error:</strong> ${message}`;
      errorElement.style.display = 'block';

      // Scroll to error message
      errorElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Hide error message
    function hideError() {
      document.getElementById('errorMessage').style.display = 'none';
    }

    // Show debug info
    function showDebugInfo(info) {
      const debugElement = document.getElementById('debugInfo');
      debugElement.innerHTML = `<strong>Debug Info:</strong> ${info}`;
      debugElement.style.display = 'block';
    }

    // Hide debug info
    function hideDebugInfo() {
      document.getElementById('debugInfo').style.display = 'none';
    }

    // Test Firebase connection
    function testFirebaseConnection() {
      database.ref('.info/connected').once('value')
        .then(() => {
          console.log("Firebase connection test successful");
          document.getElementById('permissionError').style.display = 'none';
        })
        .catch(error => {
          console.error("Firebase connection test failed:", error);
          if (error.code === 'PERMISSION_DENIED') {
            document.getElementById('permissionError').style.display = 'block';
          }
        });
    }

    // Find user data by username in database
    function findUserByUsername(username) {
      return new Promise((resolve, reject) => {
        const roleCategories = ['barangay_captain', 'barangay_official', 'response_team'];
        let checkedCategories = 0;
        let userFound = false;

        roleCategories.forEach(role => {
          database.ref(`users/${role}`).orderByChild('username').equalTo(username).once('value')
            .then(snapshot => {
              checkedCategories++;

              if (snapshot.exists() && !userFound) {
                snapshot.forEach(user => {
                  userFound = true;
                  console.log(`Found user in ${role}:`, user.val());
                  resolve({
                    userData: user.val(),
                    userId: user.key,
                    rolePath: role
                  });
                  return;
                });
              }

              // If we've checked all categories and didn't find the user
              if (checkedCategories === roleCategories.length && !userFound) {
                console.log(`User ${username} not found in any role category`);
                resolve(null);
              }
            })
            .catch(error => {
              checkedCategories++;
              console.error(`Error searching in ${role}:`, error);

              // If we've checked all categories and didn't find the user
              if (checkedCategories === roleCategories.length && !userFound) {
                reject(error);
              }
            });
        });
      });
    }

    // Handle Firebase Authentication login
    function signInWithEmail(email, password) {
      return auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
          // User signed in successfully
          const user = userCredential.user;
          console.log("User signed in:", user.uid);
          return user;
        })
        .catch((error) => {
          console.error("Authentication error:", error);
          throw error;
        });
    }

    // Handle authentication errors - ALL errors now show the same message
    function handleAuthError(error) {
      // Always return the same generic error message for security
      return "Invalid username or password.";
    }

    // Listen for form submit
    document.getElementById("loginForm").addEventListener("submit", async function (e) {
      e.preventDefault();

      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value.trim();
      const submitBtn = this.querySelector('button[type="submit"]');

      if (!username || !password) {
        showError("Please enter both username and password.");
        return;
      }

      // Show loading state
      submitBtn.innerHTML = '<div class="spinner"></div> Signing in...';
      submitBtn.disabled = true;
      hideError();
      hideDebugInfo();

      try {
       
        // Step 1: Find user by username in Realtime Database
        const dbResult = await findUserByUsername(username);
        
        if (!dbResult) {
          console.log("User not found in database");
          showError("Invalid username or password.");
          submitBtn.innerHTML = 'Sign in';
          submitBtn.disabled = false;
          return;
        }

        const { userData, userId, rolePath } = dbResult;
    
        // Step 2: Check if user has password in database
        if (userData.password) {
          console.log("User has password in database, checking...");
          // User has password in database - check if it matches
          if (userData.password === password) {
            console.log("Database password matches!");
            // Password matches in database - proceed with login
            await handleSuccessfulLogin(userData, userId, rolePath);
          } else {
            console.log("Database password does not match");
            showError("Invalid username or password.");
            submitBtn.innerHTML = 'Sign in';
            submitBtn.disabled = false;
          }
        } else {
          console.log("User has no password in database, checking Firebase Authentication...");
          // User has no password in database - check Firebase Authentication
          if (!userData.email) {
            showError("Invalid username or password.");
            submitBtn.innerHTML = 'Sign in';
            submitBtn.disabled = false;
            return;
          }

          try {
            // Try to authenticate with Firebase Auth
            await signInWithEmail(userData.email, password);
            console.log("Firebase Authentication successful!");
            // Authentication successful - proceed with login
            await handleSuccessfulLogin(userData, userId, rolePath);
          } catch (authError) {
            console.error("Firebase Authentication failed:", authError);
            const errorMessage = handleAuthError(authError);
            showError(errorMessage);
            submitBtn.innerHTML = 'Sign in';
            submitBtn.disabled = false;
          }
        }

      } catch (error) {
        console.error("Login process error:", error);
        showError("Invalid username or password.");
        submitBtn.innerHTML = 'Sign in';
        submitBtn.disabled = false;
      }
    });

    // Handle successful login (common for both database and auth)
    async function handleSuccessfulLogin(userData, userId, rolePath) {
      // Check approval status
      const userStatus = userData.status || "pending";

      // Create session for the user using YOUR ORIGINAL structure
      setSession(userData, userId, rolePath);

      // Update user list UI
      updateUserList();

      // Check if user has PIN and redirect accordingly
      const hasPIN = await checkUserHasPIN(userId);

      if (userStatus === "approved") {
        if (!hasPIN) {
          // First login - redirect to create PIN
          alert("Login successful! Please create a PIN for future access.");
          window.location.href = "lll.html";
        } else {
          // User has PIN - redirect to PIN verification
          window.location.href = "llll.html";
        }
      } else if (userStatus === "rejected") {
        alert("Your account has been rejected. Please contact support.");
        // Sign out if we used Firebase Auth
        if (!userData.password) {
          auth.signOut();
        }
        // Clear this user's session
        clearSession();
        // Reset button state
        const submitBtn = document.querySelector('#loginForm button[type="submit"]');
        submitBtn.innerHTML = 'Sign in';
        submitBtn.disabled = false;
      } else {
        alert("Your account is pending approval. You will be redirected to the pending page.");
        window.location.href = "pending.html?userId=" + encodeURIComponent(userId);
      }
    }

    // Check if user is already logged in when page loads
    document.addEventListener('DOMContentLoaded', function () {
      // Test Firebase connection
      testFirebaseConnection();

      // Update user list on load
      updateUserList();

      // Check if there's an active session and redirect accordingly
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

      // Check Firebase Auth state
      auth.onAuthStateChanged((user) => {
        if (user) {
          console.log("User already signed in:", user.uid);
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
        }
      });
    });