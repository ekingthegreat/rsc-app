  // Initialize Firebase
    let app;
    try {
      app = firebase.initializeApp(firebaseConfig);
    } catch (error) {
      if (error.code === 'app/duplicate-app') {
        app = firebase.app();
      }
    }

    const auth = firebase.auth();

    function togglePassword(fieldId) {
      const passwordInput = document.getElementById(fieldId);
      const toggleIcon = passwordInput.nextElementSibling.querySelector('i');

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

    // Handle password reset
    document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const submitBtn = document.getElementById('submitBtn');
      const errorMessage = document.getElementById('errorMessage');
      const successMessage = document.getElementById('successMessage');
      
      // Hide messages
      errorMessage.style.display = 'none';
      successMessage.style.display = 'none';
      
      // Validate passwords
      if (newPassword !== confirmPassword) {
        errorMessage.textContent = 'Passwords do not match.';
        errorMessage.style.display = 'block';
        return;
      }
      
      if (newPassword.length < 6) {
        errorMessage.textContent = 'Password should be at least 6 characters.';
        errorMessage.style.display = 'block';
        return;
      }
      
      // Show loading
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';
      submitBtn.disabled = true;
      
      try {
        // Get the reset code from URL
        const urlParams = new URLSearchParams(window.location.search);
        const oobCode = urlParams.get('oobCode');
        
        if (!oobCode) {
          throw new Error('Invalid reset link.');
        }
        
        // Verify the reset code and update password
        await auth.verifyPasswordResetCode(oobCode);
        await auth.confirmPasswordReset(oobCode, newPassword);
        
        // Show success message
        successMessage.textContent = 'Password reset successfully! Redirecting to login...';
        successMessage.style.display = 'block';
        
        // Redirect to login page with success parameter after 2 seconds
        setTimeout(() => {
          window.location.href = 'login.html?passwordReset=success';
        }, 2000);
        
      } catch (error) {
        console.error('Password reset error:', error);
        
        let errorMsg = 'Failed to reset password. The link may have expired.';
        
        if (error.code === 'auth/expired-action-code') {
          errorMsg = 'The reset link has expired. Please request a new one.';
        } else if (error.code === 'auth/invalid-action-code') {
          errorMsg = 'The reset link is invalid. Please request a new one.';
        } else if (error.code === 'auth/weak-password') {
          errorMsg = 'Password is too weak. Please choose a stronger password.';
        }
        
        errorMessage.textContent = errorMsg;
        errorMessage.style.display = 'block';
        
        submitBtn.innerHTML = 'Reset Password';
        submitBtn.disabled = false;
      }
    });

    // Add password strength indicator functionality
    document.getElementById('newPassword').addEventListener('input', function() {
      const password = this.value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      
      // Clear any existing error if passwords match
      if (password === confirmPassword && password.length >= 6) {
        document.getElementById('errorMessage').style.display = 'none';
      }
    });

    document.getElementById('confirmPassword').addEventListener('input', function() {
      const password = document.getElementById('newPassword').value;
      const confirmPassword = this.value;
      
      // Clear error if passwords match
      if (password === confirmPassword && password.length >= 6) {
        document.getElementById('errorMessage').style.display = 'none';
      }
    });