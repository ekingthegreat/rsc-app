   function togglePassword(inputId) {
      const passwordInput = document.getElementById(inputId);
      const toggleIcon = document.querySelector(`#${inputId} + .toggle-password i`);
      
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

    // Form submission
    document.getElementById('passwordForm').addEventListener('submit', function(e) {
      e.preventDefault();
      
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const submitBtn = this.querySelector('button');
      
      // Validate passwords match
      if (newPassword !== confirmPassword) {
        alert('Passwords do not match. Please try again.');
        return;
      }
      
      // Validate password strength (basic example)
      if (newPassword.length < 8) {
        alert('Password should be at least 8 characters long.');
        return;
      }
      
      // Show loading state
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
      submitBtn.disabled = true;
      
      // Simulate password change process
      setTimeout(() => {
        alert('Password successfully changed!');
        submitBtn.innerHTML = 'Change Password';
        submitBtn.disabled = false;
        
        // Clear form
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
      }, 1500);
    });