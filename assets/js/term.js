
        firebase.initializeApp(firebaseConfig);
        const database = firebase.database();

        const defaultPrivacyPolicy = [
            {
                id: 1,
                title: "1. Information We Collect",
                content: `<h3>Personal Information</h3>
                <p>When you register for our emergency disaster response service, we collect:</p>
                <ul>
                  <li><strong>Account Information:</strong> Full name, username, email address, phone number, and role</li>
                  <li><strong>Location Data:</strong> GPS coordinates when reporting incidents</li>
                  <li><strong>Media Content:</strong> Photos and videos you upload as evidence</li>
                  <li><strong>Incident Reports:</strong> Details about emergency situations you report</li>
                </ul>
                
                <h3>Automatically Collected Information</h3>
                <ul>
                  <li>Device information (IP address, browser type, operating system)</li>
                  <li>Usage data and analytics</li>
                  <li>Cookies and similar technologies</li>
                </ul>`,
                lastEditedBy: "System Admin",
                lastEditedAt: new Date().toISOString()
            },
            {
                id: 2,
                title: "2. How We Use Your Information",
                content: `<ul>
                  <li>Provide emergency response services and coordinate rescue efforts</li>
                  <li>Verify user identities and maintain account security</li>
                  <li>Display incident locations on maps for responders</li>
                  <li>Send emergency alerts and notifications</li>
                  <li>Improve our services and user experience</li>
                  <li>Comply with legal obligations</li>
                </ul>`,
                lastEditedBy: "System Admin",
                lastEditedAt: new Date().toISOString()
            }
        ];

        const defaultTermsOfService = [
            {
                id: 1,
                title: "1. Acceptance of Terms",
                content: `<p>By accessing or using the RSC (Ready to Serve the Community) emergency disaster response platform, you agree to be bound by these Terms of Service and our Privacy Policy.</p>`,
                lastEditedBy: "System Admin",
                lastEditedAt: new Date().toISOString()
            },
            {
                id: 2,
                title: "2. Service Description",
                content: `<p>RSC is a web-based emergency response platform that enables:</p>
                <ul>
                  <li>Real-time incident reporting with location tracking</li>
                  <li>Media upload (photos/videos) for evidence</li>
                  <li>Coordination between community members and emergency responders</li>
                  <li>Announcement and event management for authorized users</li>
                  <li>Web mapping for incident visualization</li>
                </ul>`,
                lastEditedBy: "System Admin",
                lastEditedAt: new Date().toISOString()
            }
        ];

        // DOM elements
        const privacyContent = document.getElementById('privacy-content');
        const termsContent = document.getElementById('terms-content');
        const privacyLastUpdated = document.getElementById('privacy-last-updated');
        const termsLastUpdated = document.getElementById('terms-last-updated');
        const backButton = document.getElementById('backButton');

        // Initialize the app
        function init() {
            loadPoliciesFromDatabase();
            setupBackButton();
        }

        // Set up back button functionality
        function setupBackButton() {
            backButton.addEventListener('click', function() {
                // Use browser history to go back
                if (document.referrer && document.referrer.includes(window.location.hostname)) {
                    // If coming from same domain, go back
                    window.history.back();
                } else {
                    // If no history or coming from different domain, go to home/dashboard
                    window.location.href = 'login.html'; // Change to your default page
                }
            });
        }

        // Load policies from Firebase or use defaults
        function loadPoliciesFromDatabase() {
            // Try to load from Firebase
            database.ref('policies/privacy').once('value').then((snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    renderPrivacyPolicy(data.sections);
                    privacyLastUpdated.textContent = `Last Updated: ${formatDate(data.lastUpdated)}`;
                } else {
                    // Use default content
                    renderPrivacyPolicy(defaultPrivacyPolicy);
                }
            }).catch((error) => {
                console.error('Error loading privacy policy:', error);
                renderPrivacyPolicy(defaultPrivacyPolicy);
            });

            database.ref('policies/terms').once('value').then((snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    renderTermsOfService(data.sections);
                    termsLastUpdated.textContent = `Last Updated: ${formatDate(data.lastUpdated)}`;
                } else {
                    // Use default content
                    renderTermsOfService(defaultTermsOfService);
                }
            }).catch((error) => {
                console.error('Error loading terms of service:', error);
                renderTermsOfService(defaultTermsOfService);
            });
        }

        // Render Privacy Policy
        function renderPrivacyPolicy(sections) {
            privacyContent.innerHTML = '';
            
            sections.forEach(section => {
                const sectionElement = createSectionElement(section, 'privacy');
                privacyContent.appendChild(sectionElement);
            });
        }

        // Render Terms of Service
        function renderTermsOfService(sections) {
            termsContent.innerHTML = '';
            
            sections.forEach(section => {
                const sectionElement = createSectionElement(section, 'terms');
                termsContent.appendChild(sectionElement);
            });
        }

        // Create section element - READ ONLY VERSION (no edit controls)
        function createSectionElement(section, policyType) {
            const sectionDiv = document.createElement('div');
            sectionDiv.className = policyType === 'privacy' ? 'policy-section' : 'terms-section';
            sectionDiv.dataset.id = section.id;
            
            // Clean the content by removing any existing admin attributions
            let cleanContent = section.content;
            
            // Remove any existing admin attribution HTML from the content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cleanContent;
            const existingAttributions = tempDiv.querySelectorAll('.last-edited');
            existingAttributions.forEach(attr => attr.remove());
            cleanContent = tempDiv.innerHTML;
            
            // Create admin attribution if available - ONLY ONE per section
            const adminAttribution = section.lastEditedBy ? 
                `<div class="last-edited">
                    <i class="fas fa-user-edit"></i>
                    Last edited by ${section.lastEditedBy} on ${formatDate(section.lastEditedAt)}
                </div>` : '';
            
            sectionDiv.innerHTML = `
                <h2>
                    ${section.title}
                </h2>
                <div class="view-container">
                    ${cleanContent}
                    ${adminAttribution}
                </div>
            `;
            
            return sectionDiv;
        }

        function formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        document.addEventListener('DOMContentLoaded', init);