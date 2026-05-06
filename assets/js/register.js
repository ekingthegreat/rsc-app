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

    function checkPasswordStrength(password) {
      let strength = 0;
      let text = '';

      if (password.length === 0) {
        return { strength: 0, text: '' };
      }

      if (password.length > 5) strength++;
      if (password.length > 8) strength++;

      if (password.match(/([A-Z])/)) strength++;

      if (password.match(/([0-9])/)) strength++;

      if (password.match(/([!,@,#,$,%,^,&,*,?,_,~])/)) strength++;

      if (strength < 3) {
        text = 'Weak';
      } else if (strength < 5) {
        text = 'Medium';
      } else {
        text = 'Strong';
      }

      return { strength, text };
    }

    // Update password strength indicator
    document.getElementById('password').addEventListener('input', function () {
      const password = this.value;
      const strengthBar = document.getElementById('passwordStrengthBar');
      const strengthText = document.getElementById('passwordStrengthText');

      const { strength, text } = checkPasswordStrength(password);

      strengthBar.className = 'password-strength-bar';
      if (text === 'Weak') {
        strengthBar.classList.add('strength-weak');
        strengthText.style.color = 'var(--weak)';
      } else if (text === 'Medium') {
        strengthBar.classList.add('strength-medium');
        strengthText.style.color = 'var(--medium)';
      } else if (text === 'Strong') {
        strengthBar.classList.add('strength-strong');
        strengthText.style.color = 'var(--strong)';
      }

      strengthText.textContent = text;
    });

    // Firebase configuration - ADD YOUR ACTUAL CONFIG HERE
    const firebaseConfig = {
      // Your Firebase config here
         
    };

    // Initialize Firebase
    let app;
    try {
      app = firebase.initializeApp(firebaseConfig);
      console.log("Firebase initialized successfully");
    } catch (error) {
      if (error.code === 'app/duplicate-app') {
        console.log("Firebase app already initialized, using existing app");
        app = firebase.app();
      } else {
        console.error("Firebase initialization error:", error);
        showError("Firebase initialization failed. Check console for details.");
      }
    }

    // Create a reference to your database and auth
    const database = firebase.database();
    const auth = firebase.auth();
    console.log("Database and Auth references created");

    // Global variable to store addresses with approved captains
    let addressesWithCaptains = [];

    // Function to check if username exists in database
    function checkUsernameExists(username, callback) {
      const roleCategories = ['admin', 'barangay_captain', 'barangay_official', 'response_team'];
      let checkedCategories = 0;
      let usernameExists = false;

      roleCategories.forEach(role => {
        database.ref(`users/${role}`).orderByChild('username').equalTo(username).once('value')
          .then(snapshot => {
            checkedCategories++;

            if (snapshot.exists() && !usernameExists) {
              usernameExists = true;
              callback(true);
              return;
            }

            // If we've checked all categories and didn't find the username
            if (checkedCategories === roleCategories.length && !usernameExists) {
              callback(false);
            }
          })
          .catch(error => {
            checkedCategories++;
            console.error(`Error checking username in ${role}:`, error);

            // If we've checked all categories and didn't find the username
            if (checkedCategories === roleCategories.length && !usernameExists) {
              callback(false);
            }
          });
      });
    }

    // Username availability check with debounce
    let usernameCheckTimeout;
    document.getElementById('username').addEventListener('input', function() {
      const username = this.value.trim();
      const availabilityElement = document.getElementById('usernameAvailability');
      
      // Clear previous timeout
      clearTimeout(usernameCheckTimeout);
      
      // Hide availability message if username is empty
      if (username.length === 0) {
        availabilityElement.innerHTML = '';
        availabilityElement.className = 'username-availability';
        return;
      }
      
      // Show checking message
      availabilityElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking availability...';
      availabilityElement.className = 'username-availability checking';
      
      // Debounce the check to avoid too many requests
      usernameCheckTimeout = setTimeout(() => {
        checkUsernameExists(username, (exists) => {
          if (exists) {
            availabilityElement.innerHTML = '<i class="fas fa-times-circle"></i> Username already exists';
            availabilityElement.className = 'username-availability taken';
          } else {
            availabilityElement.innerHTML = '<i class="fas fa-check-circle"></i> Username available';
            availabilityElement.className = 'username-availability available';
          }
        });
      }, 500); // Wait 500ms after user stops typing
    });

    // Function to fetch approved captains and their addresses
    function fetchApprovedCaptains() {
      console.log("Fetching approved captains...");
      
      return database.ref('users/barangay_captain').once('value')
        .then((snapshot) => {
          addressesWithCaptains = [];
          
          if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
              const captainData = childSnapshot.val();
              if (captainData.status === "approved" && captainData.address) {
                addressesWithCaptains.push(captainData.address);
                console.log(`Found approved captain for address: ${captainData.address}`);
              }
            });
          }
          
          console.log("Addresses with approved captains:", addressesWithCaptains);
          return addressesWithCaptains;
        })
        .catch((error) => {
          console.error("Error fetching approved captains:", error);
          return [];
        });
    }

    // Function to update address dropdown based on selected role
    function updateAddressDropdown(selectedRole) {
      const addressDropdown = document.getElementById('address');
      const currentAddress = addressDropdown.value;
      
      // Reset all options first (except the placeholder)
      for (let i = 0; i < addressDropdown.options.length; i++) {
        const option = addressDropdown.options[i];
        
        // Never disable the placeholder option
        if (option.value === "") {
          option.disabled = false;
          option.style.color = '';
          option.text = "Select your address"; // Reset placeholder text
          continue;
        }
        
        option.disabled = false;
        option.style.color = '';
        
        // Add indicator for addresses with existing captains
        if (addressesWithCaptains.includes(option.value)) {
          option.text = option.value + " (Captain assigned)";
        } else {
          // Reset to original text
          option.text = option.value;
        }
      }
      
      // If captain is selected, disable addresses with approved captains
      if (selectedRole === "captain") {
        for (let i = 0; i < addressDropdown.options.length; i++) {
          const option = addressDropdown.options[i];
          
          // Skip placeholder option
          if (option.value === "") continue;
          
          if (addressesWithCaptains.includes(option.value)) {
            option.disabled = true;
            option.style.color = '#999';
          }
        }
        
        // If current selection is now disabled, reset the selection to placeholder
        if (addressesWithCaptains.includes(currentAddress)) {
          addressDropdown.value = "";
          showError("This address already has an approved captain. Please select a different address.");
        }
        
        // Show info message if all addresses are taken
        const availableAddresses = Array.from(addressDropdown.options).filter(opt => 
          !opt.disabled && opt.value !== ""
        );
        
        if (availableAddresses.length === 0) {
          showError("All addresses currently have approved captains. Please contact administration for assistance.");
        }
      }
    }

    // Add event listener for role changes
    document.getElementById('role').addEventListener('change', function() {
      const selectedRole = this.value;
      
      // If captain role is selected, make sure we have the latest data
      if (selectedRole === "captain") {
        // Show loading state for address dropdown
        const addressDropdown = document.getElementById('address');
        const originalValue = addressDropdown.value;
        addressDropdown.innerHTML = '<option value="" disabled selected>Loading addresses...</option>';
        
        fetchApprovedCaptains().then(() => {
          // Restore the original options
          restoreAddressOptions();
          updateAddressDropdown(selectedRole);
        });
      } else {
        // For other roles, just update normally
        updateAddressDropdown(selectedRole);
      }
    });

    // Function to restore address options to original state
    function restoreAddressOptions() {
      const addressDropdown = document.getElementById('address');
      const addresses = [
        "Bacalan", "Bangkerohan", "Buluan", "Caparan", "Domandan", 
        "Don Andres", "Doña Josefa", "Guituan", "Ipil Heights", "Labe", 
        "Logan", "Tirso Babiera (Lower Ipil Heights)", "Lower Taway", 
        "Lumbia", "Maasin", "Magdaup", "Makilas", "Pangi", "Poblacion", 
        "Sanito", "Suclema", "Taway", "Tenan", "Tiayon", "Timalang", 
        "Tomitom", "Upper Pangi", "Veteran's Village"
      ];
      
      // Clear existing options
      addressDropdown.innerHTML = '';
      
      // Add placeholder
      const placeholderOption = document.createElement('option');
      placeholderOption.value = "";
      placeholderOption.disabled = true;
      placeholderOption.selected = true;
      placeholderOption.textContent = "Select your address";
      addressDropdown.appendChild(placeholderOption);
      
      // Add address options
      addresses.forEach(address => {
        const option = document.createElement('option');
        option.value = address;
        option.textContent = address;
        addressDropdown.appendChild(option);
      });
    }

    // Add submit event listener to the form
    document.getElementById('register').addEventListener('submit', submitForm);

    function submitForm(e) {
      e.preventDefault();
      console.log("Form submission started");

      // Get form values
      const fullname = getElementVal('fullname');
      const role = getElementVal('role');
      const username = getElementVal('username');
      const password = getElementVal('password');
      const phone = getElementVal('phone');
      const email = getElementVal('email');
      const address = getElementVal('address');

      console.log("Form values retrieved:", { fullname, role, username, phone, email, address });

      // Check username availability before submitting
      const availabilityElement = document.getElementById('usernameAvailability');
      if (availabilityElement.classList.contains('taken')) {
        showError("Username already exists. Please choose a different username.");
        return;
      }

      // Additional validation for captains
      if (role === "captain") {
        if (!address) {
          showError("Please select an address for your captain role.");
          return;
        }
        
        if (addressesWithCaptains.includes(address)) {
          showError("This address already has an approved captain. Please select a different address.");
          return;
        }
      }

      // Show loading state
      const submitBtn = document.querySelector('button[type="submit"]');
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
      submitBtn.disabled = true;

      // Hide any previous error messages
      hideMessages();

      // Create user with Firebase Authentication
      createUserWithEmailAndPassword(email, password, fullname, role, username, phone, address);
    }

    // Create user with Firebase Authentication
    function createUserWithEmailAndPassword(email, password, fullname, role, username, phone, address) {
      auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
          // User created successfully in Firebase Auth
          const user = userCredential.user;
          console.log("Firebase Auth user created:", user.uid);
          
          // Now save additional user data to Realtime Database
          saveUserToDatabase(user.uid, fullname, role, username, phone, email, address);
        })
        .catch((error) => {
          console.error("Error creating user:", error);
          handleAuthError(error);
          
          // Reset button
          const submitBtn = document.querySelector('button[type="submit"]');
          submitBtn.innerHTML = 'Create Account';
          submitBtn.disabled = false;
        });
    }

    // Save user data to Realtime Database
    function saveUserToDatabase(userId, fullname, role, username, phone, email, address) {
      // Map role to database path
      const rolePath = getRolePath(role);
      
      // Set default status based on role
      let status = "pending";
      if (role === "admin") {
        status = "approved";
      }

      // Create user data object
      const userData = {
        id: userId,
        fullname: fullname,
        role: role,
        status: status,
        username: username,
        phone: phone,
        email: email,
        address: address,
        profilePicture: "", // Default empty
        notifications: {},
        history: {},
        // Add role-specific empty objects
        ...(role === "captain" && { approvals: {} }),
        ...(role === "official" && { reports: {} }),
        ...(role === "response_team" && { missions: {} }),
      };

      // Save to Firebase with the new structure
      database.ref(`users/${rolePath}/${userId}`).set(userData)
        .then(() => {
          console.log("User data saved successfully.");
          
          // Show success modal instead of inline message, pass the userId
          showSuccessModal(userId);
          
          // Reset form after successful submission
          document.getElementById('register').reset();

          // Reset password strength indicator
          document.getElementById('passwordStrengthBar').className = 'password-strength-bar';
          document.getElementById('passwordStrengthText').textContent = '';
        })
        .catch((error) => {
          console.error("Data could not be saved.", error);
          if (error.code === 'PERMISSION_DENIED') {
            showError("Database permission denied. Please check your Firebase security rules.");
          } else {
            showError("There was an error creating your account: " + error.message);
          }
        })
        .finally(() => {
          // Reset button regardless of success or failure
          const submitBtn = document.querySelector('button[type="submit"]');
          submitBtn.innerHTML = 'Create Account';
          submitBtn.disabled = false;
        });
    }

    // Map role to database path
    function getRolePath(role) {
      switch(role) {
        case "captain": return "barangay_captain";
        case "official": return "barangay_official";
        case "response_team": return "response_team";
        default: return role;
      }
    }

    // Handle Firebase Auth errors
    function handleAuthError(error) {
      let errorMessage = "An unknown error occurred.";
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = "This email address is already in use by another account.";
          break;
        case 'auth/invalid-email':
          errorMessage = "The email address is not valid.";
          break;
        case 'auth/operation-not-allowed':
          errorMessage = "Email/password accounts are not enabled. Please contact support.";
          break;
        case 'auth/weak-password':
          errorMessage = "The password is too weak. Please choose a stronger password.";
          break;
        default:
          errorMessage = error.message;
      }
      
      showError(errorMessage);
    }

    const getElementVal = (id) => {
      return document.getElementById(id).value;
    }
    
    // Show error message
    function showError(message) {
      const errorElement = document.getElementById('errorMessage');
      errorElement.innerHTML = `<strong>Error:</strong> ${message}`;
      errorElement.style.display = 'block';
      
      // Scroll to error message
      errorElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    // Show success message
    function showSuccess(message) {
      const successElement = document.getElementById('successMessage');
      successElement.innerHTML = `<strong>Success!</strong> ${message}`;
      successElement.style.display = 'block';
      
      // Scroll to success message
      successElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    // Hide all messages
    function hideMessages() {
      document.getElementById('errorMessage').style.display = 'none';
      document.getElementById('successMessage').style.display = 'none';
    }
    
    // Show success modal and start countdown
    function showSuccessModal(userId) {
      const modal = document.getElementById('successModal');
      const countdownElement = document.getElementById('countdown');
      const modalCountdownElement = document.getElementById('modalCountdown');
      
      // Show the modal
      modal.classList.add('active');
      
      let countdown = 5;
      
      // Update countdown every second
      const countdownInterval = setInterval(() => {
        countdown--;
        countdownElement.textContent = countdown;
        modalCountdownElement.textContent = countdown;
        
        if (countdown <= 0) {
          clearInterval(countdownInterval);
          // Pass the userId to the pending page
          window.location.href = 'pending.html?userId=' + encodeURIComponent(userId);
        }
      }, 1000);
      
      // Update the "Go Now" button to also pass the userId
      document.getElementById('goNowButton').onclick = function() {
        clearInterval(countdownInterval);
        window.location.href = 'pending.html?userId=' + encodeURIComponent(userId);
      };
    }
    
    // Test Firebase connection when page loads
    window.addEventListener('load', () => {
      console.log("Page loaded, testing Firebase connection");
      // Test if we can read from the database (which usually has different permissions)
      database.ref('.info/connected').once('value')
        .then((snapshot) => {
          if (snapshot.val() === true) {
            console.log("Connected to Firebase");
          } else {
            console.log("Not connected to Firebase");
          }
        })
        .catch((error) => {
          console.error("Firebase connection test failed:", error);
          if (error.code === 'PERMISSION_DENIED') {
            showError("Firebase security rules are preventing access. Please update your rules.");
          }
        });
      
      // Fetch approved captains when page loads
      fetchApprovedCaptains();
    });
