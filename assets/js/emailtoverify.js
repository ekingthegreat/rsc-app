 // Initialize Firebase
  let app;
  try {
    app = firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully");
  } catch (error) {
    if (error.code === 'app/duplicate-app') {
      app = firebase.app();
    } else {
      console.error("Firebase initialization error:", error);
    }
  }

  const auth = firebase.auth();

  // Form submission
  document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const submitBtn = document.getElementById('submitBtn');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    
    // Hide previous messages
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
    
    // Show loading state
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    submitBtn.disabled = true;
    
    try {
      // Send password reset email
      await auth.sendPasswordResetEmail(email);
      
      // Show success message
      successMessage.textContent = `Password reset link sent to ${email}. Check your inbox and spam folder.`;
      successMessage.style.display = 'block';
      
      // Reset form
      document.getElementById('passwordForm').reset();
      
    } catch (error) {
      console.error('Error:', error);
      
      let errorMsg = 'Failed to send reset email. Please try again.';
      
      if (error.code === 'auth/user-not-found') {
        errorMsg = 'No account found with this email address.';
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = 'Please enter a valid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMsg = 'Too many attempts. Please try again later.';
      }
      
      errorMessage.textContent = errorMsg;
      errorMessage.style.display = 'block';
    } finally {
      // Reset button
      submitBtn.innerHTML = 'Send Reset Link';
      submitBtn.disabled = false;
    }
  });