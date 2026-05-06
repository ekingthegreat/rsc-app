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

        // Modal elements
        const managementModal = document.getElementById('managementModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const cancelBtn = document.getElementById('cancelBtn');
        const confirmActionBtn = document.getElementById('confirmActionBtn');

        // Current user being managed
        let currentUserKey = null;
        let currentRolePath = null;
        let currentAction = null;

        // Function to check if session is valid
        function checkSession() {
            const isLoggedIn = localStorage.getItem('isLoggedIn');
            const expirationTime = localStorage.getItem('sessionExpiration');
            
            if (!isLoggedIn || !expirationTime) {
                console.log("Session invalid: Missing isLoggedIn or expirationTime");
                return false;
            }
            
            // Check if session has expired
            if (new Date().getTime() > parseInt(expirationTime)) {
                console.log("Session invalid: Session expired");
                clearSession();
                return false;
            }
            
            console.log("Session valid");
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
            console.log("Session cleared");
        }

        // Function to check if user is captain
        function isCaptain() {
            const role = localStorage.getItem('role');
            return role && role.toLowerCase() === 'captain';
        }

        // Function to get captain's data from Firebase
        function getCaptainData() {
            return new Promise((resolve, reject) => {
                const userId = localStorage.getItem('userId');
                const rolePath = localStorage.getItem('rolePath');
                
                if (!userId || !rolePath) {
                    reject(new Error("Captain data not found in session"));
                    return;
                }
                
                database.ref(`users/${rolePath}/${userId}`).once('value')
                    .then(snapshot => {
                        if (snapshot.exists()) {
                            const captainData = snapshot.val();
                            resolve(captainData);
                        } else {
                            reject(new Error("Captain data not found in database"));
                        }
                    })
                    .catch(error => {
                        reject(error);
                    });
            });
        }

        // Function to load barangay officials with the same address as captain
        function loadBarangayOfficials(captainAddress) {
            const tableBody = document.getElementById('officialsTableBody');
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Loading barangay officials...</td></tr>';
            
            database.ref('users/barangay_official').once('value')
                .then(snapshot => {
                    if (!snapshot.exists()) {
                        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No barangay officials found.</td></tr>';
                        return;
                    }
                    
                    const officials = [];
                    snapshot.forEach(childSnapshot => {
                        const official = childSnapshot.val();
                        official.key = childSnapshot.key;
                        officials.push(official);
                    });
                    
                    // Filter officials with same address as captain
                    const sameAddressOfficials = officials.filter(official => 
                        official.address && 
                        official.address.toLowerCase() === captainAddress.toLowerCase()
                    );
                    
                    displayBarangayOfficials(sameAddressOfficials, captainAddress);
                })
                .catch(error => {
                    console.error("Error loading barangay officials:", error);
                    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Error loading officials.</td></tr>';
                });
        }

        // Function to display barangay officials in the table
        function displayBarangayOfficials(officials, captainAddress) {
            const tableBody = document.getElementById('officialsTableBody');
            
            if (officials.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 20px;">
                            No barangay officials found with your address.
                            <br><small>Your address: ${captainAddress}</small>
                        </td>
                    </tr>
                `;
                return;
            }
            
            tableBody.innerHTML = '';
            
            officials.forEach(official => {
                const statusClass = official.status === 'approved' ? 'status-approved' : 
                                  official.status === 'rejected' ? 'status-rejected' : 
                                  official.status === 'blocked' ? 'status-blocked' : 'status-pending';
                const statusText = official.status === 'approved' ? 'Approved' : 
                                  official.status === 'rejected' ? 'Rejected' : 
                                  official.status === 'blocked' ? 'Blocked' : 'Pending';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${official.fullname || 'N/A'}</td>
                    <td>${official.phone || 'N/A'}</td>
                    <td>${official.username || 'N/A'}</td>
                    <td>${official.address || 'N/A'}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <div class="action-buttons">
                           
                            ${official.status !== 'blocked' ? 
                                `<button class="block-btn" data-user-key="${official.key}" data-role-path="barangay_official">
                                    <i class="fas fa-ban"></i> Block
                                </button>` :
                                `<button class="unblock-btn" data-user-key="${official.key}" data-role-path="barangay_official">
                                    <i class="fas fa-check-circle"></i> Unblock
                                </button>`
                            }
                        </div>
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
            
            // Add search functionality
            const searchInput = document.getElementById('officialSearch');
            searchInput.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                const rows = tableBody.getElementsByTagName('tr');
                
                for (let row of rows) {
                    const cells = row.getElementsByTagName('td');
                    let found = false;
                    
                    for (let cell of cells) {
                        if (cell.textContent.toLowerCase().includes(searchTerm)) {
                            found = true;
                            break;
                        }
                    }
                    
                    row.style.display = found ? '' : 'none';
                }
            });
            
            // Add event listeners to action buttons
            document.querySelectorAll('.action-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const userKey = this.dataset.userKey;
                    const rolePath = this.dataset.rolePath;
                    manageUser(userKey, rolePath);
                });
            });
            
            // Add event listeners to block buttons
            document.querySelectorAll('.block-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const userKey = this.dataset.userKey;
                    const rolePath = this.dataset.rolePath;
                    showBlockConfirmation(userKey, rolePath);
                });
            });
            
            // Add event listeners to unblock buttons
            document.querySelectorAll('.unblock-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const userKey = this.dataset.userKey;
                    const rolePath = this.dataset.rolePath;
                    showUnblockConfirmation(userKey, rolePath);
                });
            });
        }

        // Function to show block confirmation modal
        function showBlockConfirmation(userKey, rolePath) {
            currentUserKey = userKey;
            currentRolePath = rolePath;
            currentAction = 'block';
            
            modalTitle.textContent = 'Block User';
            modalMessage.textContent = 'Are you sure you want to block this user? They will not be able to access the system until unblocked.';
            confirmActionBtn.textContent = 'Block User';
            confirmActionBtn.className = 'confirm-block-btn';
            
            managementModal.style.display = 'flex';
        }

        // Function to show unblock confirmation modal
        function showUnblockConfirmation(userKey, rolePath) {
            currentUserKey = userKey;
            currentRolePath = rolePath;
            currentAction = 'unblock';
            
            modalTitle.textContent = 'Unblock User';
            modalMessage.textContent = 'Are you sure you want to unblock this user? They will be able to access the system again.';
            confirmActionBtn.textContent = 'Unblock User';
            confirmActionBtn.className = 'confirm-unblock-btn';
            
            managementModal.style.display = 'flex';
        }

        // Function to block/unblock user
        function toggleUserBlock(userKey, rolePath, action) {
            const userRef = database.ref(`users/${rolePath}/${userKey}`);
            const newStatus = action === 'block' ? 'blocked' : 'approved';
            
            userRef.update({ status: newStatus })
                .then(() => {
                    alert(`User ${action}ed successfully!`);
                    closeModal();
                    // Reload the officials list to reflect changes
                    getCaptainData().then(captainData => {
                        loadBarangayOfficials(captainData.address);
                    });
                })
                .catch(error => {
                    console.error(`Error ${action}ing user:`, error);
                    alert(`Error ${action}ing user: ` + error.message);
                    closeModal();
                });
        }

        // Function to close modal
        function closeModal() {
            managementModal.style.display = 'none';
            currentUserKey = null;
            currentRolePath = null;
            currentAction = null;
        }

        // Modal event listeners
        cancelBtn.addEventListener('click', closeModal);
        
        confirmActionBtn.addEventListener('click', function() {
            if (currentUserKey && currentRolePath && currentAction) {
                toggleUserBlock(currentUserKey, currentRolePath, currentAction);
            }
        });
        
        // Close modal when clicking outside
        managementModal.addEventListener('click', function(e) {
            if (e.target === managementModal) {
                closeModal();
            }
        });

        // Function to load pending users with the same address as captain
        function loadPendingUsers() {
            const pendingContainer = document.getElementById('pendingUsersContainer');
            pendingContainer.innerHTML = '<div class="loading-message">Loading pending users...</div>';
            
            // First get captain's data
            getCaptainData()
                .then(captainData => {
                    const captainAddress = captainData.address;
                    
                    if (!captainAddress) {
                        pendingContainer.innerHTML = '<div class="error-message">Your captain account does not have an address set.</div>';
                        return;
                    }
                    
                    // Load barangay officials with the same address
                    loadBarangayOfficials(captainAddress);
                    
                    // Get all users from different roles
                    const roles = ['barangay_official', 'response_team', 'barangay_captain', 'admin'];
                    let allUsers = [];
                    
                    // Fetch users from all roles
                    const promises = roles.map(role => {
                        return database.ref(`users/${role}`).once('value')
                            .then(snapshot => {
                                if (snapshot.exists()) {
                                    snapshot.forEach(childSnapshot => {
                                        const user = childSnapshot.val();
                                        user.rolePath = role;
                                        user.key = childSnapshot.key;
                                        allUsers.push(user);
                                    });
                                }
                            });
                    });
                    
                    // Process users after all data is fetched
                    Promise.all(promises).then(() => {
                        // Filter users with same address and pending status
                        const pendingUsers = allUsers.filter(user => 
                            user.status === 'pending' && 
                            user.address && 
                            user.address.toLowerCase() === captainAddress.toLowerCase() &&
                            user.id !== captainData.id // Exclude the captain themselves
                        );
                        
                        console.log("Pending users found:", pendingUsers.length);
                        displayPendingUsers(pendingUsers, captainAddress);
                    }).catch(error => {
                        console.error("Error loading users:", error);
                        pendingContainer.innerHTML = '<div class="error-message">Error loading pending users.</div>';
                    });
                })
                .catch(error => {
                    console.error("Error getting captain data:", error);
                    pendingContainer.innerHTML = '<div class="error-message">Error loading your captain information.</div>';
                });
        }

        // Function to display pending users
        function displayPendingUsers(users, captainAddress) {
            const pendingContainer = document.getElementById('pendingUsersContainer');
            
            if (users.length === 0) {
                pendingContainer.innerHTML = `
                    <div class="no-pending-users">
                        <p>No pending users with your address.</p>
                        <p><small>Your address: ${captainAddress}</small></p>
                    </div>
                `;
                return;
            }
            
            pendingContainer.innerHTML = '';
            
            users.forEach(user => {
                const userInitials = getUserInitials(user.fullname);
                const userCard = document.createElement('div');
                userCard.className = 'pending-user-card';
                userCard.dataset.userKey = user.key;
                userCard.dataset.rolePath = user.rolePath;
                
                userCard.innerHTML = `
                    <div class="user-info-header">
                        <div class="user-avatar">${userInitials}</div>
                        <div class="user-main-info">
                            <div class="user-name">${user.fullname || 'Unknown'}</div>
                            <span class="user-role">${user.role || 'User'}</span>
                        </div>
                    </div>
                    <div class="user-details">
                        <div class="detail-row">
                            <span class="detail-label">Email:</span>
                            <span class="detail-value">${user.email || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Phone:</span>
                            <span class="detail-value">${user.phone || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Address:</span>
                            <span class="detail-value">${user.address || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Status:</span>
                            <span class="status-badge status-pending">Pending</span>
                        </div>
                    </div>
                    <div class="approval-actions">
                        <button class="approve-btn" data-user-key="${user.key}" data-role-path="${user.rolePath}">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="decline-btn" data-user-key="${user.key}" data-role-path="${user.rolePath}">
                            <i class="fas fa-times"></i> Decline
                        </button>
                    </div>
                `;
                
                pendingContainer.appendChild(userCard);
            });
            
            // Add event listeners to approval buttons
            document.querySelectorAll('.approve-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const userKey = this.dataset.userKey;
                    const rolePath = this.dataset.rolePath;
                    updateUserStatus(userKey, rolePath, 'approved');
                });
            });
            
            document.querySelectorAll('.decline-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const userKey = this.dataset.userKey;
                    const rolePath = this.dataset.rolePath;
                    updateUserStatus(userKey, rolePath, 'rejected');
                });
            });
        }

        // Function to get user initials
        function getUserInitials(fullname) {
            if (!fullname) return 'UU';
            return fullname.split(' ')
                .map(name => name[0])
                .join('')
                .toUpperCase()
                .substring(0, 2);
        }

        // Function to update user status
        function updateUserStatus(userKey, rolePath, status) {
            const userRef = database.ref(`users/${rolePath}/${userKey}`);
            
            userRef.update({ status: status })
                .then(() => {
                    alert(`User ${status} successfully!`);
                    // Remove the user card from UI
                    const userCard = document.querySelector(`.pending-user-card[data-user-key="${userKey}"]`);
                    if (userCard) {
                        userCard.style.transform = 'scale(0.95)';
                        userCard.style.opacity = '0';
                        setTimeout(() => {
                            userCard.remove();
                            // Reload pending users to refresh the list
                            loadPendingUsers();
                        }, 300);
                    }
                })
                .catch(error => {
                    console.error("Error updating user status:", error);
                    alert("Error updating user status: " + error.message);
                });
        }

        // Function to manage user (additional actions)
        function manageUser(userKey, rolePath) {
            // In a real implementation, this would show a modal with more management options
            alert(`Additional management options for user ${userKey} would be available here.`);
        }

        // Initialize page
        document.addEventListener('DOMContentLoaded', function() {
            // Check if user is logged in and is a captain
            if (!checkSession()) {
                alert('Please log in to access this page.');
                window.location.href = 'index.html';
                return;
            }
            
            if (!isCaptain()) {
                alert('You do not have permission to access this page.');
                window.location.href = 'home.html';
                return;
            }
            
            // Load pending users and barangay officials
            loadPendingUsers();
        });