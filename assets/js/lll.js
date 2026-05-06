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

    // Encryption key for PIN - Use a secure key in production
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

    const inputs = document.querySelectorAll('.pin-box');
    const form = document.getElementById('pinForm');
    const submitBtn = document.getElementById('submitBtn');
    const buttonText = document.getElementById('buttonText');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const successMessage = document.getElementById('successMessage');

    function getCookie(name) {
      const nameEQ = name + "=";
      const ca = document.cookie.split(';');
      for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
      }
      return null;
    }

    function checkUserLoggedIn() {
      const userId = localStorage.getItem('userId') || getCookie('userId');
      const isLoggedIn = localStorage.getItem('isLoggedIn') || getCookie('isLoggedIn');
      
      if (!isLoggedIn || !userId) {
        alert('Please log in first to set up your PIN.');
        window.location.href = 'login.html';
        return null;
      }
      
      return userId;
    }

    function savePINToFirebase(userId, pin) {
      const encryptedPin = encryptPin(pin);
      
      return database.ref(`user_pins/${userId}`).set({
        pin: encryptedPin, 
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      });
    }

    function showError(message) {
      errorText.textContent = message;
      errorMessage.style.display = 'block';
      successMessage.style.display = 'none';
    }

    function hideError() {
      errorMessage.style.display = 'none';
    }

    function showSuccess() {
      successMessage.style.display = 'block';
      errorMessage.style.display = 'none';
    }

    // Auto-focus first input on load
    window.addEventListener('load', () => {
      inputs[0].focus();
      hideError();
    });

    // Handle skip PIN
    function skipPIN() {
      const userId = checkUserLoggedIn();
      if (!userId) return false;
      
      // Set a flag that user skipped PIN creation
      localStorage.setItem('pinSkipped', 'true');
      return true;
    }

    // PIN input handling
    inputs.forEach((input, index) => {
      input.addEventListener('input', () => {
        // Allow digits only
        input.value = input.value.replace(/\D/, '');
        
        if (input.value) {
          input.classList.add('entered');
          
          // Move to next input if available
          if (index < inputs.length - 1) {
            inputs[index + 1].focus();
          }
        } else {
          input.classList.remove('entered');
        }
        
        // Check if all inputs are filled
        checkFormCompletion();
        hideError();
      });

      input.addEventListener('keydown', (e) => {
        const allowedKeys = ['Backspace', 'ArrowLeft', 'ArrowRight', 'Tab', 'Delete'];
        
        // Prevent non-digit input
        if (!allowedKeys.includes(e.key) && !/^\d$/.test(e.key)) {
          e.preventDefault();
          return;
        }

        // Handle backspace
        if (e.key === 'Backspace' && input.value === '' && index > 0) {
          inputs[index - 1].focus();
          inputs[index - 1].value = '';
          inputs[index - 1].classList.remove('entered');
          checkFormCompletion();
        }
        
        // Handle arrow keys for navigation
        if (e.key === 'ArrowLeft' && index > 0) {
          inputs[index - 1].focus();
        }
        
        if (e.key === 'ArrowRight' && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      });

      // Prevent paste of non-numeric content
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        
        if (/^\d+$/.test(pasted)) {
          // Handle multi-digit paste
          const digits = pasted.split('').slice(0, inputs.length);
          digits.forEach((digit, idx) => {
            if (inputs[index + idx]) {
              inputs[index + idx].value = digit;
              inputs[index + idx].classList.add('entered');
            }
          });
          
          // Focus the last filled input
          const lastFilledIndex = Math.min(index + digits.length - 1, inputs.length - 1);
          inputs[lastFilledIndex].focus();
          checkFormCompletion();
        }
      });

      // Click to focus and select
      input.addEventListener('click', function() {
        this.focus();
        this.select();
      });
    });

    function checkFormCompletion() {
      const allFilled = Array.from(inputs).every(input => input.value !== '');
      submitBtn.disabled = !allFilled;
    }

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const userId = checkUserLoggedIn();
      if (!userId) return;
      
      // Get the complete PIN
      const pin = Array.from(inputs).map(input => input.value).join('');
      
      // Validate PIN
      if (pin.length !== 4) {
        showError('Please enter a valid 4-digit PIN');
        return;
      }

      // Check if PIN is too simple
      if (/(.)\1{3}/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) {
        showError('Please choose a stronger PIN. Avoid repeated digits or sequences.');
        return;
      }

      // Show loading state
      buttonText.innerHTML = '<div class="spinner"></div> Saving PIN...';
      submitBtn.disabled = true;
      
      try {
        // Save encrypted PIN to Firebase
        await savePINToFirebase(userId, pin);
        
        showSuccess();
        
        // Wait a moment before redirecting
        setTimeout(() => {
          // Redirect based on user role
          const rolePath = localStorage.getItem('rolePath');
          if (rolePath === "response_team") {
            window.location.href = "responsehome.html";
          } else {
            window.location.href = "home.html";
          }
        }, 1500);
        
      } catch (error) {
        console.error('Error saving PIN:', error);
        showError('Error saving PIN. Please try again.');
        
        // Reset button state
        buttonText.innerHTML = 'Continue';
        submitBtn.disabled = false;
      }
    });

    // Check if user already has PIN
    document.addEventListener('DOMContentLoaded', function() {
      const userId = checkUserLoggedIn();
      if (userId) {
        database.ref(`user_pins/${userId}`).once('value')
          .then(snapshot => {
            if (snapshot.exists()) {
              // User already has PIN, redirect to verify
              window.location.href = 'verify_pin.html';
            }
          })
          .catch(error => {
            console.error('Error checking existing PIN:', error);
          });
      }
    });