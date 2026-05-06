const inputs = document.querySelectorAll('.pin-box');
    const form = document.getElementById('pinForm');
    const submitBtn = document.getElementById('submitBtn');

    // Auto-focus first input on load
    window.addEventListener('load', () => {
      inputs[0].focus();
    });

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
    });

    function checkFormCompletion() {
      const allFilled = Array.from(inputs).every(input => input.value !== '');
      submitBtn.disabled = !allFilled;
    }

    // Form submission
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      // Get the complete PIN
      const pin = Array.from(inputs).map(input => input.value).join('');
      
      // Show loading state
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
      submitBtn.disabled = true;
      
      // Simulate processing
      setTimeout(() => {
        alert(`PIN successfully set: ${pin} (In a real application, this would be securely stored)`);
        submitBtn.innerHTML = 'Continue';
        submitBtn.disabled = false;
        
        // Reset form (in a real app, you would redirect instead)
        inputs.forEach(input => {
          input.value = '';
          input.classList.remove('entered');
        });
        inputs[0].focus();
        checkFormCompletion();
      }, 1500);
    });