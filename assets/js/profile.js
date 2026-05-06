const supabaseClient = supabase.createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_KEY
);

const supabaseConfig = {
    bucketName: import.meta.env.VITE_SUPABASE_BUCKET
};
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

  // Initialize Supabase client
  let supabaseClient;
  try {
    supabaseClient = supabase.createClient(supabaseConfig.url, supabaseConfig.key);
    console.log("Supabase client initialized successfully");
  } catch (error) {
    console.error("Supabase initialization error:", error);
  }

  // DOM elements
  const fileInput = document.getElementById('file-input');
  const uploadStatus = document.getElementById('upload-status');
  
  // Password change modal elements
  const passwordModal = document.getElementById('password-modal');
  const changePasswordItem = document.getElementById('change-password-item');
  const cancelPasswordBtn = document.getElementById('cancel-password');
  const savePasswordBtn = document.getElementById('save-password');
  const currentPasswordInput = document.getElementById('current-password');
  const newPasswordInput = document.getElementById('new-password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const passwordMessage = document.getElementById('password-message');
  const savePasswordSpinner = document.getElementById('save-password-spinner');
  const savePasswordText = document.getElementById('save-password-text');

  // PIN modal elements
  const pinModal = document.getElementById('pin-modal');
  const changePinItem = document.getElementById('change-pin-item');
  const cancelPinBtn = document.getElementById('cancel-pin');
  const savePinBtn = document.getElementById('save-pin');
  const pinMessage = document.getElementById('pin-message');
  const savePinSpinner = document.getElementById('save-pin-spinner');
  
  // Modal text elements
  const pinModalTitle = document.getElementById('pin-modal-title');
  const pinModalSubtitle = document.getElementById('pin-modal-subtitle');
  const pinInstructions = document.getElementById('pin-instructions');
  const newPinLabel = document.getElementById('new-pin-label');
  const confirmPinLabel = document.getElementById('confirm-pin-label');
  const savePinText = document.getElementById('save-pin-text');
  const currentPinSection = document.getElementById('current-pin-section');

  // PIN input elements
  const currentPinInputs = [
    document.getElementById('current-pin-1'),
    document.getElementById('current-pin-2'),
    document.getElementById('current-pin-3'),
    document.getElementById('current-pin-4')
  ];

  const newPinInputs = [
    document.getElementById('new-pin-1'),
    document.getElementById('new-pin-2'),
    document.getElementById('new-pin-3'),
    document.getElementById('new-pin-4')
  ];

  const confirmPinInputs = [
    document.getElementById('confirm-pin-1'),
    document.getElementById('confirm-pin-2'),
    document.getElementById('confirm-pin-3'),
    document.getElementById('confirm-pin-4')
  ];

  // Encryption key for PIN
  const PIN_ENCRYPTION_KEY = "RSC_PIN_SECURE_KEY_2024";

  // Function to encrypt PIN
  function encryptPin(pin) {
    return CryptoJS.AES.encrypt(pin, PIN_ENCRYPTION_KEY).toString();
  }

  // Function to decrypt PIN
  function decryptPin(encryptedPin) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedPin, PIN_ENCRYPTION_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error("Error decrypting PIN:", error);
      return null;
    }
  }

  // Function to get user PIN from Firebase - FIXED FOR YOUR DATABASE STRUCTURE
  async function getUserPin(userId) {
    try {
      const pinRef = database.ref(`user_pins/${userId}`);
      const snapshot = await pinRef.once('value');
      
      if (snapshot.exists()) {
        const pinData = snapshot.val();
        console.log("Found user PIN:", pinData);
        
        // Check if PIN is encrypted or plain text
        let pinValue;
        try {
          // Try to decrypt first (in case it's encrypted)
          const decrypted = decryptPin(pinData.pin);
          if (decrypted && /^\d{4}$/.test(decrypted)) {
            pinValue = decrypted;
            console.log("PIN was encrypted, decrypted to:", pinValue);
          } else {
            // If decryption fails or result is not 4 digits, use as plain text
            pinValue = pinData.pin;
            console.log("PIN is plain text:", pinValue);
          }
        } catch (e) {
          // If decryption fails, use as plain text
          pinValue = pinData.pin;
          console.log("PIN decryption failed, using as plain text:", pinValue);
        }
        
        return {
          pin: pinValue,
          createdAt: pinData.createdAt,
          lastUsed: pinData.lastUsed
        };
      }
      console.log("No PIN found for user:", userId);
      return null;
    } catch (error) {
      console.error("Error getting user PIN:", error);
      return null;
    }
  }

  // Function to save PIN to Firebase - FIXED
  async function saveUserPin(userId, pin) {
    try {
      // Encrypt the PIN before saving
      const encryptedPin = encryptPin(pin);
      const pinData = {
        pin: encryptedPin, // Save encrypted PIN
        lastUsed: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      const pinRef = database.ref(`user_pins/${userId}`);
      await pinRef.set(pinData);
      console.log("PIN saved successfully for user:", userId);
      return true;
    } catch (error) {
      console.error("Error saving PIN:", error);
      return false;
    }
  }

  // Function to update PIN in Firebase - FIXED
  async function updateUserPin(userId, newPin) {
    try {
      // Encrypt the new PIN before saving
      const encryptedPin = encryptPin(newPin);
      const pinData = {
        pin: encryptedPin,
        lastUsed: new Date().toISOString()
      };

      const pinRef = database.ref(`user_pins/${userId}`);
      await pinRef.update(pinData);
      console.log("PIN updated successfully for user:", userId);
      return true;
    } catch (error) {
      console.error("Error updating PIN:", error);
      return false;
    }
  }

  // Function to get PIN from input boxes
  function getPinFromInputs(inputs) {
    return inputs.map(input => input.value).join('');
  }

  // Function to clear PIN inputs
  function clearPinInputs(inputs) {
    inputs.forEach(input => {
      input.value = '';
      input.classList.remove('entered');
    });
  }

  // Function to handle PIN input navigation
  function setupPinInputNavigation(inputs) {
    inputs.forEach((input, index) => {
      input.addEventListener('input', function(e) {
        const value = e.target.value.replace(/[^0-9]/g, '');
        e.target.value = value;
        
        if (value) {
          e.target.classList.add('entered');
          if (index < inputs.length - 1) inputs[index + 1].focus();
        } else {
          e.target.classList.remove('entered');
        }
      });

      input.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
          inputs[index - 1].focus();
        }
      });

      input.addEventListener('paste', function(e) {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 4);
        pastedData.split('').forEach((char, i) => {
          if (inputs[i]) {
            inputs[i].value = char;
            inputs[i].classList.add('entered');
          }
        });
        if (pastedData.length === 4) inputs[3].focus();
      });
    });
  }

  // Show PIN message
  function showPinMessage(message, type) {
    pinMessage.textContent = message;
    pinMessage.className = `pin-message ${type}`;
  }

  // Show password message
  function showPasswordMessage(message, type) {
    passwordMessage.textContent = message;
    passwordMessage.className = `password-message ${type}`;
  }

  // Show loading state for password change
  function setPasswordLoadingState(loading) {
    savePasswordBtn.disabled = loading;
    savePasswordText.style.display = loading ? 'none' : 'inline';
    savePasswordSpinner.style.display = loading ? 'block' : 'none';
  }

  // Show loading state for PIN
  function setPinLoadingState(loading) {
    savePinBtn.disabled = loading;
    savePinText.style.display = loading ? 'none' : 'inline';
    savePinSpinner.style.display = loading ? 'block' : 'none';
  }

  // Show password change modal
  function showPasswordModal() {
    // Clear all inputs and messages
    currentPasswordInput.value = '';
    newPasswordInput.value = '';
    confirmPasswordInput.value = '';
    showPasswordMessage('', '');
    setPasswordLoadingState(false);
    
    passwordModal.style.display = 'flex';
    currentPasswordInput.focus();
  }

  // Hide password change modal
  function hidePasswordModal() {
    passwordModal.style.display = 'none';
  }

  // Show PIN modal - FIXED
  async function showPinModal() {
    const userId = localStorage.getItem('userId');
    console.log("Showing PIN modal for user:", userId);
    
    // Clear all inputs and messages
    clearPinInputs(currentPinInputs);
    clearPinInputs(newPinInputs);
    clearPinInputs(confirmPinInputs);
    showPinMessage('', '');
    setPinLoadingState(false);

    try {
      const userPin = await getUserPin(userId);
      console.log("User PIN data:", userPin);

      if (userPin && userPin.pin) {
        // User has existing PIN - show change PIN flow
        console.log("User has existing PIN, showing change PIN flow");
        pinModalTitle.textContent = 'Change PIN';
        pinModalSubtitle.textContent = 'Update your secure PIN';
        pinInstructions.textContent = 'Enter your current PIN and set a new 4-digit PIN';
        newPinLabel.textContent = 'New PIN';
        confirmPinLabel.textContent = 'Confirm New PIN';
        savePinText.textContent = 'Update PIN';
        currentPinSection.style.display = 'block';
        setTimeout(() => currentPinInputs[0].focus(), 100);
      } else {
        // User doesn't have PIN - show setup flow
        console.log("User has no PIN, showing setup flow");
        pinModalTitle.textContent = 'Set Up PIN';
        pinModalSubtitle.textContent = 'Create a secure PIN for your account';
        pinInstructions.textContent = 'Enter a 4-digit PIN to secure your account';
        newPinLabel.textContent = 'Create PIN';
        confirmPinLabel.textContent = 'Confirm PIN';
        savePinText.textContent = 'Set PIN';
        currentPinSection.style.display = 'none';
        setTimeout(() => newPinInputs[0].focus(), 100);
      }
    } catch (error) {
      console.error("Error checking user PIN:", error);
      // Default to setup flow if there's an error
      pinModalTitle.textContent = 'Set Up PIN';
      pinModalSubtitle.textContent = 'Create a secure PIN for your account';
      pinInstructions.textContent = 'Enter a 4-digit PIN to secure your account';
      newPinLabel.textContent = 'Create PIN';
      confirmPinLabel.textContent = 'Confirm PIN';
      savePinText.textContent = 'Set PIN';
      currentPinSection.style.display = 'none';
      setTimeout(() => newPinInputs[0].focus(), 100);
    }
    
    pinModal.style.display = 'flex';
  }

  // Hide PIN modal
  function hidePinModal() {
    pinModal.style.display = 'none';
  }

  // Validate PIN
  function validatePin(pin) {
    return /^\d{4}$/.test(pin);
  }

  // Validate password
  function validatePassword(password) {
    // Minimum 6 characters for Firebase Auth
    return password && password.length >= 6;
  }

  // Handle password change
  async function handlePasswordChange() {
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Validation
    if (!currentPassword) {
      showPasswordMessage('Please enter your current password', 'error');
      currentPasswordInput.focus();
      return;
    }

    if (!validatePassword(newPassword)) {
      showPasswordMessage('New password must be at least 6 characters', 'error');
      newPasswordInput.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      showPasswordMessage('New passwords do not match', 'error');
      confirmPasswordInput.focus();
      return;
    }

    if (currentPassword === newPassword) {
      showPasswordMessage('New password must be different from current password', 'error');
      newPasswordInput.focus();
      return;
    }

    setPasswordLoadingState(true);
    showPasswordMessage('Updating password...', 'info');

    try {
      // Get current user
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Re-authenticate user with current password
      const credential = firebase.auth.EmailAuthProvider.credential(
        user.email,
        currentPassword
      );

      await user.reauthenticateWithCredential(credential);
      
      // Update password
      await user.updatePassword(newPassword);
      
      showPasswordMessage('Password updated successfully!', 'success');
      
      // Clear inputs and close modal after success
      setTimeout(() => {
        hidePasswordModal();
      }, 1500);
      
    } catch (error) {
      console.error("Error changing password:", error);
      
      let errorMessage = 'Failed to update password. Please try again.';
      
      switch (error.code) {
        case 'auth/wrong-password':
          errorMessage = 'Current password is incorrect';
          break;
        case 'auth/weak-password':
          errorMessage = 'New password is too weak';
          break;
        case 'auth/requires-recent-login':
          errorMessage = 'Please log in again to change your password';
          break;
      }
      
      showPasswordMessage(errorMessage, 'error');
    } finally {
      setPasswordLoadingState(false);
    }
  }

  // Handle PIN change/setup - FIXED
  async function handlePinChange() {
    const userId = localStorage.getItem('userId');
    console.log("Handling PIN change for user:", userId);

    try {
      const userPin = await getUserPin(userId);
      console.log("Current user PIN status:", userPin);
      
      const currentPin = getPinFromInputs(currentPinInputs);
      const newPin = getPinFromInputs(newPinInputs);
      const confirmPin = getPinFromInputs(confirmPinInputs);

      console.log("Inputs - Current:", currentPin, "New:", newPin, "Confirm:", confirmPin);

      // Validation
      if (userPin && userPin.pin) {
        // Changing existing PIN
        if (!validatePin(currentPin)) {
          showPinMessage('Please enter your current 4-digit PIN', 'error');
          currentPinInputs[0].focus();
          return;
        }

        // Verify current PIN for existing users
        if (userPin.pin !== currentPin) {
          showPinMessage('Current PIN is incorrect', 'error');
          clearPinInputs(currentPinInputs);
          currentPinInputs[0].focus();
          return;
        }

        if (newPin === currentPin) {
          showPinMessage('New PIN must be different', 'error');
          clearPinInputs(newPinInputs);
          clearPinInputs(confirmPinInputs);
          newPinInputs[0].focus();
          return;
        }
      }

      if (!validatePin(newPin)) {
        showPinMessage('Please enter a valid 4-digit PIN', 'error');
        newPinInputs[0].focus();
        return;
      }

      if (newPin !== confirmPin) {
        showPinMessage('PINs do not match', 'error');
        confirmPinInputs[0].focus();
        return;
      }

      setPinLoadingState(true);
      showPinMessage(userPin ? 'Updating PIN...' : 'Setting up PIN...', 'info');

      const success = userPin ? 
        await updateUserPin(userId, newPin) : 
        await saveUserPin(userId, newPin);

      if (success) {
        showPinMessage(`PIN ${userPin ? 'updated' : 'created'} successfully!`, 'success');
        setTimeout(() => hidePinModal(), 1500);
      } else {
        throw new Error('Database error');
      }
    } catch (error) {
      console.error("Error in handlePinChange:", error);
      showPinMessage(`Failed to ${userPin ? 'update' : 'create'} PIN. Please try again.`, 'error');
      setPinLoadingState(false);
    }
  }

  // Initialize PIN input navigation
  setupPinInputNavigation(currentPinInputs);
  setupPinInputNavigation(newPinInputs);
  setupPinInputNavigation(confirmPinInputs);

  // Event listeners for password modal
  changePasswordItem.addEventListener('click', showPasswordModal);
  cancelPasswordBtn.addEventListener('click', hidePasswordModal);
  savePasswordBtn.addEventListener('click', handlePasswordChange);

  // Event listeners for PIN modal
  changePinItem.addEventListener('click', showPinModal);
  cancelPinBtn.addEventListener('click', hidePinModal);
  savePinBtn.addEventListener('click', handlePinChange);

  // Allow pressing Enter to save password or PIN
  document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      if (passwordModal.style.display === 'flex') {
        handlePasswordChange();
      } else if (pinModal.style.display === 'flex') {
        handlePinChange();
      }
    }
  });

  // Close modals when clicking outside
  passwordModal.addEventListener('click', function(e) {
    if (e.target === passwordModal) hidePasswordModal();
  });

  pinModal.addEventListener('click', function(e) {
    if (e.target === pinModal) hidePinModal();
  });

  // Upload functionality
  fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      uploadFile(file);
    } else {
      showUploadStatus('Please select a valid image file.', 'error');
    }
  });

  // Upload file to Supabase
  async function uploadFile(file) {
    if (!supabaseClient) {
      showUploadStatus('Error: Supabase client not initialized.', 'error');
      return;
    }

    showUploadStatus('Uploading...', 'uploading');
    
    const uploadBtn = document.querySelector('.upload-btn');
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<span class="loading"></span> Uploading...';
    uploadBtn.style.pointerEvents = 'none';

    try {
      const userId = localStorage.getItem('userId');
      const fileExt = file.name.split('.').pop();
      const fileName = `profile-pictures/${userId}_${Date.now()}.${fileExt}`;

      const { data, error } = await supabaseClient.storage
        .from(supabaseConfig.bucketName)
        .upload(fileName, file);

      if (error) throw new Error(error.message);

      const { data: urlData } = supabaseClient.storage
        .from(supabaseConfig.bucketName)
        .getPublicUrl(data.path);

      await updateProfilePictureInFirebase(urlData.publicUrl);

      showUploadStatus('Profile picture updated successfully!', 'success');
      
      setTimeout(() => {
        uploadBtn.innerHTML = originalText;
        uploadBtn.style.pointerEvents = 'auto';
        uploadStatus.style.display = 'none';
      }, 3000);

    } catch (error) {
      console.error('Error uploading file:', error);
      showUploadStatus('Error uploading file: ' + error.message, 'error');
      
      const uploadBtn = document.querySelector('.upload-btn');
      uploadBtn.innerHTML = '<i class="fas fa-camera"></i> Upload Photo';
      uploadBtn.style.pointerEvents = 'auto';
    }
  }

  function showUploadStatus(message, type) {
    uploadStatus.textContent = message;
    uploadStatus.className = 'upload-status ' + (type === 'uploading' ? 'success' : type);
    uploadStatus.style.display = 'block';
  }

  // Update profile picture in Firebase
  function updateProfilePictureInFirebase(imageUrl) {
    return new Promise((resolve, reject) => {
      const userId = localStorage.getItem('userId');
      const rolePath = localStorage.getItem('rolePath');

      if (!userId || !rolePath) {
        reject(new Error("User ID or role path not found in session"));
        return;
      }

      const userRef = database.ref(`users/${rolePath}/${userId}`);
      userRef.update({
        profilePicture: imageUrl,
        lastUpdated: new Date().toISOString()
      })
      .then(() => {
        console.log("Profile picture updated in Firebase");
        updateProfileAvatar(imageUrl);
        resolve();
      })
      .catch(error => {
        console.error("Error updating profile picture in Firebase:", error);
        reject(error);
      });
    });
  }

  // Update the profile avatar in the UI
  function updateProfileAvatar(imageUrl) {
    const avatarIcon = document.getElementById('avatar-icon');
    if (avatarIcon) avatarIcon.style.display = "none";

    const profileAvatar = document.getElementById('profile-avatar');
    if (profileAvatar) {
      profileAvatar.style.backgroundImage = `url(${imageUrl})`;
      profileAvatar.style.backgroundSize = "cover";
      profileAvatar.style.backgroundPosition = "center";
    }
  }

  // Function to check if session is valid
  function checkSession() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const expirationTime = localStorage.getItem('sessionExpiration');

    if (!isLoggedIn || !expirationTime) {
      return false;
    }

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

  // Update the UI based on user data
  function updateProfileUI(userData) {
    document.getElementById('profile-name').textContent = userData.fullname || "Unknown";
    document.getElementById('profile-contact').textContent = userData.phone || "Not provided";

    document.getElementById('info-member').textContent = getRoleDisplayName(userData.role);
    document.getElementById('info-username').textContent = userData.username || "Unknown";
    document.getElementById('info-email').textContent = userData.email || "Not provided";
    document.getElementById('info-address').textContent = userData.address || "Not provided";

    const statusBadge = document.getElementById('status-badge');
    const statusMessage = document.getElementById('status-message');
    const uploadSection = document.getElementById('upload-section');

    if (userData.status === "approved") {
      statusBadge.className = "status-badge status-approved";
      statusBadge.textContent = "Approved";
      if (statusMessage) statusMessage.style.display = "none";
      if (uploadSection) uploadSection.style.display = "block";
    } else if (userData.status === "pending") {
      statusBadge.className = "status-badge status-pending";
      statusBadge.textContent = "Pending Approval";
      if (statusMessage) {
        statusMessage.style.display = "block";
        document.getElementById('status-message-icon').className = "fas fa-clock";
        document.getElementById('status-message-title').textContent = "Account Pending Approval";
        document.getElementById('status-message-desc').textContent = "Your account is currently under review. You will be notified once your account has been approved.";
      }
      if (uploadSection) uploadSection.style.display = "none";
    } else if (userData.status === "rejected") {
      statusBadge.className = "status-badge status-rejected";
      statusBadge.textContent = "Rejected";
      if (statusMessage) {
        statusMessage.style.display = "block";
        document.getElementById('status-message-icon').className = "fas fa-times-circle";
        document.getElementById('status-message-title').textContent = "Account Rejected";
        document.getElementById('status-message-desc').textContent = "Your account application has been rejected. Please contact support for more information.";
      }
      if (uploadSection) uploadSection.style.display = "none";
    }

    if (userData.profilePicture) {
      updateProfileAvatar(userData.profilePicture);
    }
  }

  // Helper function to get display name for roles
  function getRoleDisplayName(role) {
    const roleMap = {
      'admin': 'Administrator',
      'captain': 'Barangay Captain',
      'official': 'Barangay Official',
      'response_team': 'Response Team Member'
    };
    return roleMap[role] || role;
  }

  // Logout function
  function logout() {
    if (confirm('Are you sure you want to log out?')) {
      auth.signOut().then(() => {
        clearSession();
        window.location.href = "index.html";
      }).catch((error) => {
        console.error('Error signing out:', error);
        clearSession();
        window.location.href = "index.html";
      });
    }
  }

  // Check session and load user data when page loads
  document.addEventListener('DOMContentLoaded', function () {
    if (!checkSession()) {
      alert('Please log in to access this page.');
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

    fetchUserData()
      .then(userData => {
        updateProfileUI(userData);
      })
      .catch(error => {
        console.error("Error loading user data:", error);
        alert('Error loading profile information. Please try again.');
      });

    document.querySelectorAll('.menu-item').forEach(item => {
      if (item.id !== 'change-password-item' && item.id !== 'change-pin-item') {
        item.addEventListener('click', function () {
          const link = this.getAttribute('data-link');
          if (link) {
            window.location.href = link;
          }
        });
      }
    });

    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', logout);
    }
  });