// block.js - Modal system for blocked users

// Function to check if user is blocked and show modal
function checkUserBlockStatus() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    // Check all user roles for block status
    const userRoles = ['response_team', 'barangay_official', 'barangay_captain'];
    
    userRoles.forEach(role => {
        const userRef = database.ref(`users/${role}/${userId}`);
        userRef.once('value').then((snapshot) => {
            const userData = snapshot.val();
            if (userData && userData.status === 'blocked') {
                // User is blocked - show modal with admin info
                showBlockedUserModal(userData);
            }
        }).catch(error => {
            console.error(`Error checking block status in ${role}:`, error);
        });
    });
}

// Function to create and show blocked user modal
function showBlockedUserModal(userData) {
    // Remove existing modal if present
    const existingModal = document.getElementById('blockedUserModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create modal HTML
    const modalHTML = `
        <div id="blockedUserModal" class="blocked-user-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        ">
            <div class="modal-content" style="
                background: white;
                padding: 30px;
                border-radius: 12px;
                max-width: 450px;
                width: 90%;
                text-align: center;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                border: 3px solid #b30000;
            ">
                <div class="modal-icon" style="
                    font-size: 48px;
                    color: #b30000;
                    margin-bottom: 20px;
                ">
                    <i class="fas fa-ban"></i>
                </div>
                
                <h2 style="
                    color: #b30000;
                    margin-bottom: 15px;
                    font-size: 1.5rem;
                    font-weight: 600;
                ">
                    Account Blocked
                </h2>
                
                <div class="blocked-message" style="
                    color: #333;
                    margin-bottom: 20px;
                    line-height: 1.5;
                    font-size: 1rem;
                ">
                    <p>Your account has been temporarily suspended.</p>
                    <p style="margin-top: 10px; font-weight: 500;">
                        Blocked by: <span style="color: #b30000;">${userData.blockedBy?.adminName || 'Administrator'}</span>
                    </p>
                </div>
                
                <div class="blocked-details" style="
                    background: #fff5f5;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    text-align: left;
                    border-left: 4px solid #b30000;
                ">
                    <p style="margin: 5px 0; font-size: 0.9rem;">
                        <strong>Reason:</strong> Violation of community guidelines
                    </p>
                    <p style="margin: 5px 0; font-size: 0.9rem;">
                        <strong>Blocked on:</strong> ${userData.blockedBy?.timestamp ? new Date(userData.blockedBy.timestamp).toLocaleDateString() : 'Recently'}
                    </p>
                </div>
                
                <div class="contact-info" style="
                    background: #f8f9fa;
                    padding: 12px;
                    border-radius: 6px;
                    margin-bottom: 20px;
                    font-size: 0.85rem;
                    color: #666;
                ">
                    <p style="margin: 0;">
                        <i class="fas fa-info-circle" style="color: #b30000; margin-right: 5px;"></i>
                        Contact support if you believe this is a mistake
                    </p>
                </div>
           
            </div>
        </div>
    `;

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add event listener for logout button
    document.getElementById('logoutButton').addEventListener('click', function() {
        // Clear session storage
        localStorage.clear();
        // Redirect to login page
        window.location.href = 'index.html';
    });

    // Prevent closing modal by clicking outside
    document.getElementById('blockedUserModal').addEventListener('click', function(e) {
        if (e.target === this) {
            e.preventDefault();
            e.stopPropagation();
        }
    });

    // Prevent keyboard escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
        }
    });

    // Disable all interactive elements on the page
    disablePageInteractions();
}

// Function to disable page interactions when blocked
function disablePageInteractions() {
    // Disable all buttons, inputs, and links
    const interactiveElements = document.querySelectorAll(
        'button, input, textarea, select, a, [onclick], .nav-item, .submit-btn, .kebab-menu'
    );
    
    interactiveElements.forEach(element => {
        element.style.pointerEvents = 'none';
        element.style.opacity = '0.6';
        element.style.cursor = 'not-allowed';
    });
}

// Function to enable page interactions (if needed for unblocking)
function enablePageInteractions() {
    const interactiveElements = document.querySelectorAll(
        'button, input, textarea, select, a, [onclick], .nav-item, .submit-btn, .kebab-menu'
    );
    
    interactiveElements.forEach(element => {
        element.style.pointerEvents = '';
        element.style.opacity = '';
        element.style.cursor = '';
    });
}

// Function to remove blocked user modal
function removeBlockedUserModal() {
    const modal = document.getElementById('blockedUserModal');
    if (modal) {
        modal.remove();
        enablePageInteractions();
        
        // Re-enable keyboard events
        document.removeEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }
}

// Enhanced function to continuously monitor block status
function monitorBlockStatus() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    // Set up real-time listeners for all user roles
    const userRoles = ['response_team', 'barangay_official', 'barangay_captain', 'admin'];
    
    userRoles.forEach(role => {
        const userRef = database.ref(`users/${role}/${userId}`);
        userRef.on('value', (snapshot) => {
            const userData = snapshot.val();
            if (userData) {
                if (userData.status === 'blocked') {
                    showBlockedUserModal(userData);
                } else {
                    removeBlockedUserModal();
                }
            }
        });
    });
}

// Initialize block monitoring when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check block status immediately
    checkUserBlockStatus();
    
    // Set up continuous monitoring
    monitorBlockStatus();
    
    // Also check when user logs in (if using dynamic login)
    window.addEventListener('storage', function(e) {
        if (e.key === 'userId' && e.newValue) {
            setTimeout(checkUserBlockStatus, 1000);
        }
    });
});

// Export functions for use in other files (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        checkUserBlockStatus,
        showBlockedUserModal,
        removeBlockedUserModal,
        monitorBlockStatus
    };
}