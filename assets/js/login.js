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

    // Function to set session data
    function setSession(userData, userId, rolePath) {
      // Store user data in localStorage
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

              if (checkedCategories === roleCategories.length && !userFound) {
                console.log(`User ${username} not found in any role category`);
                resolve(null);
              }
            })
            .catch(error => {
              checkedCategories++;
              console.error(`Error searching in ${role}:`, error);

              if (checkedCategories === roleCategories.length && !userFound) {
                reject(error);
              }
            });
        });
      });
    }

    function signInWithEmail(email, password) {
      return auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
          const user = userCredential.user;
          console.log("User signed in:", user.uid);
          return user;
        })
        .catch((error) => {
          console.error("Authentication error:", error);
          throw error;
        });
    }

    function handleAuthError(error) {
      return "Invalid username or password.";
    }

    document.getElementById("loginForm").addEventListener("submit", async function (e) {
      e.preventDefault();

      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value.trim();
      const submitBtn = this.querySelector('button[type="submit"]');

      if (!username || !password) {
        showError("Please enter both username and password.");
        return;
      }
      submitBtn.innerHTML = '<div class="spinner"></div> Signing in...';
      submitBtn.disabled = true;
      hideError();
      hideDebugInfo();

      try {
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

      // Create session for the user
      setSession(userData, userId, rolePath);

      // Redirect based on approval status and role
      if (userStatus === "approved") {
        if (rolePath === "response_team") {
          alert("Login successful! Redirecting to Response Team Dashboard.");
          window.location.href = "responsehome.html";
        } else {
          alert("Login successful!");
          window.location.href = "home.html";
        }
      } else if (userStatus === "rejected") {
        alert("Your account has been rejected. Please contact support.");
        // Sign out if we used Firebase Auth
        if (!userData.password) {
          auth.signOut();
        }
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

      // Also check session for backward compatibility
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