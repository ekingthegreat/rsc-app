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

const supabaseClient = supabase.createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_KEY
);

const supabaseConfig = {
    bucketName: import.meta.env.VITE_SUPABASE_BUCKET
};

// DOM elements
const newEventBtn = document.getElementById('newEventBtn');
const newAnnouncementBtn = document.getElementById('newAnnouncementBtn');
const announcementForm = document.getElementById('announcementForm');
const eventForm = document.getElementById('eventForm');
const createEventBtn = document.getElementById('createEventBtn');
const updateEventBtn = document.getElementById('updateEventBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const eventFormTitle = document.getElementById('eventFormTitle');
const editingEventId = document.getElementById('editingEventId');
const editingEventKey = document.getElementById('editingEventKey');
const uploadBtn = document.getElementById('uploadBtn');
const imageUpload = document.getElementById('imageUpload');
const imagePreviews = document.getElementById('imagePreviews');
const announcementText = document.getElementById('announcementText');
const publishAnnouncementBtn = document.getElementById('publishAnnouncementBtn');
const postsContainer = document.getElementById('postsContainer');
const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const closeModal = document.querySelector('.close-modal');

// NEW: Gallery modal elements
const galleryModal = document.getElementById('galleryModal');
const galleryClose = document.querySelector('.gallery-close');
const galleryMainImage = document.getElementById('galleryMainImage');
const galleryCount = document.getElementById('galleryCount');
const galleryThumbnails = document.getElementById('galleryThumbnails');
const galleryPrev = document.querySelector('.gallery-prev');
const galleryNext = document.querySelector('.gallery-next');

let selectedImageFiles = [];
let currentGalleryImages = [];
let currentGalleryIndex = 0;

// Initially hide the forms
announcementForm.style.display = 'none';
eventForm.style.display = 'none';

// NEW: Function to generate avatar initials
function getAvatarInitials(fullname) {
    if (!fullname || fullname.trim() === '') {
        return 'U'; // Default for users with no name
    }

    const names = fullname.trim().split(' ');
    if (names.length === 1) {
        return names[0].charAt(0).toUpperCase();
    } else {
        return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    }
}

// NEW: Function to get avatar color based on user ID or name
function getAvatarColor(userId) {
    const colors = [
        '#4a6fa5', '#2c3e50', '#3498db', '#e74c3c',
        '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c',
        '#34495e', '#16a085', '#27ae60', '#2980b9',
        '#8e44ad', '#2c3e50', '#f1c40f', '#e67e22'
    ];
    const index = userId ? userId.charCodeAt(0) % colors.length : 0;
    return colors[index];
}

// ENHANCED: Function to validate image URL
function isValidImageUrl(url) {
    if (!url || url.trim() === '') return false;

    // Check if it's a data URL (SVG default avatar)
    if (url.startsWith('data:image/svg+xml') || url.startsWith('data:image/')) {
        return true;
    }

    // Check if it's a valid URL format and points to an image
    try {
        const parsedUrl = new URL(url);
        const validProtocols = ['http:', 'https:'];
        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
        const validDomains = ['supabase.co', 'ui-avatars.com', 'avatars.githubusercontent.com'];

        if (!validProtocols.includes(parsedUrl.protocol)) {
            return false;
        }

        // Check if domain is in allowed list (optional security check)
        if (!validDomains.some(domain => parsedUrl.hostname.includes(domain))) {
            console.warn('Image URL from untrusted domain:', parsedUrl.hostname);
            // You might want to return false here for security, or true if you trust the source
        }

        // Check file extension
        const pathname = parsedUrl.pathname.toLowerCase();
        if (validExtensions.some(ext => pathname.endsWith(ext))) {
            return true;
        }

        // If no extension but has image in path (like Supabase storage)
        if (pathname.includes('storage') && pathname.includes('object')) {
            return true;
        }

        return false;
    } catch (e) {
        console.warn('Invalid URL format for profile picture:', url);
        return false;
    }
}

// ENHANCED: Function to create default avatar with better styling
function getDefaultAvatar(userId, userName = null) {
    const colors = [
        '#4a6fa5', '#2c3e50', '#3498db', '#e74c3c',
        '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c',
        '#34495e', '#16a085', '#27ae60', '#2980b9',
        '#8e44ad', '#2c3e50', '#f1c40f', '#e67e22'
    ];

    // Use userId hash for consistent color, fallback to random if no userId
    const colorIndex = userId ?
        userId.charCodeAt(0) % colors.length :
        Math.floor(Math.random() * colors.length);

    const color = colors[colorIndex];

    // Get user name from parameter or use fallback
    let userInitial = 'U';
    if (userName && userName.trim() !== '') {
        userInitial = getAvatarInitials(userName);
    } else {
        const currentUserName = localStorage.getItem('fullname') ||
            localStorage.getItem('username') ||
            'User';
        userInitial = getAvatarInitials(currentUserName);
    }

    // Create SVG avatar
    const svg = `
                <svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 45 45">
                    <circle cx="22.5" cy="22.5" r="22.5" fill="${color}"/>
                    <text x="22.5" y="28" font-family="Arial, sans-serif" font-size="18" fill="white" text-anchor="middle" font-weight="bold">
                        ${userInitial}
                    </text>
                </svg>
            `;

    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

// ENHANCED: Function to get user profile image with better error handling and database lookup
async function getUserProfileImage(userId, userName = null) {
    try {
        if (!userId) {
            console.warn('No user ID provided for profile picture');
            return getDefaultAvatar(userId, userName);
        }

        // First, try to get the profile picture from the database
        const userRoles = ['response_team', 'barangay_official', 'barangay_captain', 'admin'];

        for (const role of userRoles) {
            try {
                const userRef = database.ref(`users/${role}/${userId}`);
                const snapshot = await userRef.once('value');
                const userData = snapshot.val();

                if (userData && userData.profilePicture && userData.profilePicture.trim() !== '') {
                    // Validate the URL before returning
                    if (isValidImageUrl(userData.profilePicture)) {
                        console.log(`Found profile picture for ${userId} in ${role}:`, userData.profilePicture);
                        return userData.profilePicture;
                    } else {
                        console.warn(`Invalid profile picture URL for user ${userId}:`, userData.profilePicture);
                        // Continue to next role or use default
                    }
                }
            } catch (error) {
                console.warn(`Error checking ${role} for user ${userId}:`, error);
                // Continue to next role
            }
        }

        // If no valid profile picture found in any role, generate a default avatar
        console.log(`No profile picture found for ${userId}, using default avatar`);
        return getDefaultAvatar(userId, userName);
    } catch (error) {
        console.error('Error fetching profile picture:', error);
        return getDefaultAvatar(userId, userName);
    }
}

// NEW: Function to handle image loading errors
function handleImageError(imgElement, userId, userName = null) {
    console.warn('Image failed to load, using default avatar');
    imgElement.onerror = null; // Prevent infinite loop
    imgElement.src = getDefaultAvatar(userId, userName);
    imgElement.alt = "Default Avatar";

    // Update styling for the fallback
    imgElement.style.objectFit = 'cover';
    imgElement.style.borderRadius = '50%';
}

// ENHANCED: Function to create user avatar element with robust fallback
function createUserAvatar(userId, userName, profilePicture = null) {
    const color = getAvatarColor(userId);
    const initials = getAvatarInitials(userName);

    // If we have a valid profile picture, use it with error handling
    if (profilePicture && isValidImageUrl(profilePicture)) {
        return `
                    <div class="user-avatar">
                        <img src="${profilePicture}" 
                             alt="${userName}" 
                             onerror="this.onerror=null; this.src='${getDefaultAvatar(userId, userName)}';"
                             style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border);">
                    </div>
                `;
    }

    // Otherwise use the default avatar
    return `
                <div class="user-avatar" style="background-color: ${color}; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; margin-right: 10px; font-size: 14px;">
                    ${initials}
                </div>
            `;
}

// NEW: Function to upload multiple images to Supabase
async function uploadImagesToSupabase(files) {
    try {
        const userId = localStorage.getItem('userId');
        const uploadPromises = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileName = `announcements/${userId}_${Date.now()}_${i}.jpg`;

            const uploadPromise = supabaseClient.storage
                .from(supabaseConfig.bucketName)
                .upload(fileName, file);

            uploadPromises.push(uploadPromise);
        }

        const results = await Promise.all(uploadPromises);

        // Check for errors
        for (const result of results) {
            if (result.error) {
                throw new Error(result.error.message);
            }
        }

        // Get public URLs for all uploaded images
        const urlPromises = results.map(result => {
            return supabaseClient.storage
                .from(supabaseConfig.bucketName)
                .getPublicUrl(result.data.path);
        });

        const urlResults = await Promise.all(urlPromises);
        const imageUrls = urlResults.map(result => result.data.publicUrl);

        return imageUrls;
    } catch (error) {
        console.error('Error uploading images:', error);
        throw error;
    }
}

// Function to save announcement to Firebase
async function saveAnnouncementToFirebase(announcementData) {
    try {
        const announcementRef = database.ref('announcements');
        const newAnnouncementRef = announcementRef.push();

        await newAnnouncementRef.set(announcementData);
        return newAnnouncementRef.key;
    } catch (error) {
        console.error('Error saving announcement:', error);
        throw error;
    }
}

// Function to show upload status
function showUploadStatus(message, type) {
    const statusElement = document.createElement('div');
    statusElement.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                padding: 15px 20px;
                border-radius: 5px;
                color: white;
                font-weight: bold;
                z-index: 10000;
                max-width: 80%;
                text-align: center;
                background-color: ${type === 'success' ? '#4CAF50' : '#f44336'};
            `;
    statusElement.textContent = message;
    document.body.appendChild(statusElement);

    setTimeout(() => {
        statusElement.remove();
    }, 3000);
}

// NEW: Function to create image preview
function createImagePreview(file, index) {
    const previewContainer = document.createElement('div');
    previewContainer.className = 'image-preview';
    previewContainer.dataset.index = index;

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-preview';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', () => {
        removeImagePreview(index);
    });

    previewContainer.appendChild(img);
    previewContainer.appendChild(removeBtn);

    return previewContainer;
}

// NEW: Function to remove image preview
function removeImagePreview(index) {
    // Remove from files array
    selectedImageFiles.splice(index, 1);

    // Update previews
    updateImagePreviews();
}

// NEW: Function to update image previews
function updateImagePreviews() {
    imagePreviews.innerHTML = '';

    selectedImageFiles.forEach((file, index) => {
        const preview = createImagePreview(file, index);
        imagePreviews.appendChild(preview);
    });
}

// Image upload functionality
uploadBtn.addEventListener('click', () => {
    imageUpload.click();
});

imageUpload.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);

    if (files.length > 0) {
        // Filter only image files
        const imageFiles = files.filter(file => file.type.startsWith('image/'));

        if (imageFiles.length > 0) {
            selectedImageFiles = selectedImageFiles.concat(imageFiles);
            updateImagePreviews();
        } else {
            alert('Please select valid image files.');
        }
    }
});

// Drag and drop functionality
const uploadSection = document.getElementById('uploadSection');

uploadSection.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadSection.style.backgroundColor = '#f0f0f0';
});

uploadSection.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadSection.style.backgroundColor = '';
});

uploadSection.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadSection.style.backgroundColor = '';

    const files = Array.from(e.dataTransfer.files);

    if (files.length > 0) {
        // Filter only image files
        const imageFiles = files.filter(file => file.type.startsWith('image/'));

        if (imageFiles.length > 0) {
            selectedImageFiles = selectedImageFiles.concat(imageFiles);
            updateImagePreviews();
        } else {
            alert('Please drop valid image files.');
        }
    }
});

// Publish announcement
publishAnnouncementBtn.addEventListener('click', async () => {
    const text = announcementText.value.trim();

    if (!text && selectedImageFiles.length === 0) {
        alert('Please add either text or images to your announcement.');
        return;
    }

    const originalText = publishAnnouncementBtn.innerHTML;

    try {
        publishAnnouncementBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';
        publishAnnouncementBtn.disabled = true;

        let imageUrls = [];

        // Upload images if selected
        if (selectedImageFiles.length > 0) {
            imageUrls = await uploadImagesToSupabase(selectedImageFiles);
        }

        const userId = localStorage.getItem('userId');
        const username = localStorage.getItem('username');
        const fullname = localStorage.getItem('fullname');

        // Get the user's profile picture URL with enhanced error handling
        const profilePicture = await getUserProfileImage(userId, fullname || username);

        const announcementData = {
            id: `announcement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text: text,
            imageUrls: imageUrls, // Now storing array of URLs
            createdBy: userId,
            createdByName: fullname || username || 'Unknown User',
            createdByProfilePicture: profilePicture, // Store profile picture URL
            createdAt: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('en-US', { hour12: false }),
            formattedTime: new Date().toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
            }),
            likes: 0,
            likedBy: {},
            comments: 0,
            views: 0,
            viewedBy: {},
            commentsList: {}
        };

        await saveAnnouncementToFirebase(announcementData);

        showUploadStatus('Announcement published successfully!', 'success');

        // Reset form
        announcementText.value = '';
        selectedImageFiles = [];
        imagePreviews.innerHTML = '';
        imageUpload.value = '';

        // Hide form
        announcementForm.style.display = 'none';
        newAnnouncementBtn.innerHTML = '<i class="fas fa-bullhorn"></i> New Announcement';
        newEventBtn.style.display = 'flex';

    } catch (error) {
        console.error('Error publishing announcement:', error);
        showUploadStatus('Error publishing announcement: ' + error.message, 'error');
    } finally {
        publishAnnouncementBtn.innerHTML = originalText;
        publishAnnouncementBtn.disabled = false;
    }
});

// NEW: Function to display multiple images in a grid layout
function createImagesGrid(imageUrls) {
    if (!imageUrls || imageUrls.length === 0) {
        return '';
    }

    if (imageUrls.length === 1) {
        return `
                    <div class="post-images-container">
                        <img src="${imageUrls[0]}" class="post-image" alt="Announcement Image" 
                             data-images='${JSON.stringify(imageUrls)}' data-index="0">
                    </div>
                `;
    }

    if (imageUrls.length === 2) {
        return `
                    <div class="post-images-grid">
                        ${imageUrls.map((url, index) => `
                            <img src="${url}" class="post-image" alt="Announcement Image" 
                                 data-images='${JSON.stringify(imageUrls)}' data-index="${index}">
                        `).join('')}
                    </div>
                `;
    }

    if (imageUrls.length === 3) {
        return `
                    <div class="post-images-grid three-images">
                        ${imageUrls.map((url, index) => `
                            <img src="${url}" class="post-image" alt="Announcement Image" 
                                 data-images='${JSON.stringify(imageUrls)}' data-index="${index}">
                        `).join('')}
                    </div>
                `;
    }

    // For 4 or more images
    return `
                <div class="post-images-grid four-or-more">
                    ${imageUrls.slice(0, 4).map((url, index) => `
                        <div class="${index === 3 && imageUrls.length > 4 ? 'more-images-overlay' : ''}">
                            <img src="${url}" class="post-image" alt="Announcement Image" 
                                 data-images='${JSON.stringify(imageUrls)}' data-index="${index}">
                            ${index === 3 && imageUrls.length > 4 ? `
                                <div class="more-images-count">+${imageUrls.length - 4}</div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
}

// NEW: Function to open gallery modal
function openGalleryModal(images, startIndex = 0) {
    currentGalleryImages = images;
    currentGalleryIndex = startIndex;

    updateGalleryDisplay();
    galleryModal.style.display = 'flex';
}

// NEW: Function to update gallery display
function updateGalleryDisplay() {
    if (currentGalleryImages.length === 0) return;

    galleryMainImage.src = currentGalleryImages[currentGalleryIndex];
    galleryCount.textContent = `${currentGalleryIndex + 1} / ${currentGalleryImages.length}`;

    // Update thumbnails
    galleryThumbnails.innerHTML = '';
    currentGalleryImages.forEach((image, index) => {
        const thumbnail = document.createElement('img');
        thumbnail.src = image;
        thumbnail.className = `gallery-thumbnail ${index === currentGalleryIndex ? 'active' : ''}`;
        thumbnail.addEventListener('click', () => {
            currentGalleryIndex = index;
            updateGalleryDisplay();
        });
        galleryThumbnails.appendChild(thumbnail);
    });
}

// NEW: Function to navigate gallery
function navigateGallery(direction) {
    if (direction === 'prev') {
        currentGalleryIndex = currentGalleryIndex > 0 ? currentGalleryIndex - 1 : currentGalleryImages.length - 1;
    } else {
        currentGalleryIndex = currentGalleryIndex < currentGalleryImages.length - 1 ? currentGalleryIndex + 1 : 0;
    }
    updateGalleryDisplay();
}

// MODIFIED: Load announcements from Firebase - FILTERS OUT BLOCKED POSTS
function loadAnnouncements() {
    const announcementsRef = database.ref('announcements');

    announcementsRef.on('value', async (snapshot) => {
        const announcements = [];
        snapshot.forEach((childSnapshot) => {
            const announcement = childSnapshot.val();
            // FILTER OUT BLOCKED POSTS - Only add if not blocked
            if (!announcement.blocked) {
                announcements.push({
                    ...announcement,
                    key: childSnapshot.key
                });
            }
        });

        // Sort by creation date (newest first)
        announcements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        await displayAnnouncements(announcements);
    });
}

// ENHANCED: Display announcements in the feed with robust avatar handling
async function displayAnnouncements(announcements) {
    postsContainer.innerHTML = '';

    if (announcements.length === 0) {
        postsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">No announcements yet.</p>';
        return;
    }

    const currentUserId = localStorage.getItem('userId');

    // Process announcements one by one to handle async operations
    for (const announcement of announcements) {
        const announcementDate = new Date(announcement.createdAt);
        const formattedDate = announcementDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const displayTime = announcement.formattedTime ||
            new Date(announcement.createdAt).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
            });

        const isAnnouncementCreator = announcement.createdBy === currentUserId;
        const userLiked = announcement.likedBy && announcement.likedBy[currentUserId];
        const userViewed = announcement.viewedBy && announcement.viewedBy[currentUserId];

        // ENHANCED: Get profile image with better error handling
        let profileImageUrl;
        try {
            profileImageUrl = await getUserProfileImage(
                announcement.createdBy,
                announcement.createdByName
            );
        } catch (error) {
            console.error('Error loading profile image:', error);
            profileImageUrl = getDefaultAvatar(announcement.createdBy, announcement.createdByName);
        }

        // Mark as viewed if not already
        if (!userViewed && currentUserId) {
            markAnnouncementAsViewed(announcement.key, currentUserId);
        }

        // Handle both single image (backward compatibility) and multiple images
        const imageUrls = announcement.imageUrls ||
            (announcement.imageUrl ? [announcement.imageUrl] : []);

        // Create user avatar with the retrieved profile picture
        const userAvatarHTML = createUserAvatar(
            announcement.createdBy,
            announcement.createdByName,
            profileImageUrl
        );

        let announcementHTML = `
                    <div class="post" data-announcement-id="${announcement.id}" data-announcement-key="${announcement.key}">
                        <div class="post-header">
                            ${userAvatarHTML}
                            <div class="post-info">
                                <div class="post-author">${announcement.createdByName}</div>
                                <div class="post-meta">
                                    ${formattedDate} | ${displayTime}
                                </div>
                            </div>
                            ${isAnnouncementCreator ? `
                                <div class="kebab-menu">
                                    <div class="kebab-dots">
                                        <div class="kebab-dot"></div>
                                        <div class="kebab-dot"></div>
                                        <div class="kebab-dot"></div>
                                    </div>
                                    <div class="kebab-dropdown">
                                        <div class="kebab-item edit-announcement-btn" data-announcement-key="${announcement.key}">
                                            <i class="fas fa-edit"></i> Edit
                                        </div>
                                        <div class="kebab-item delete delete-announcement-btn" data-announcement-key="${announcement.key}">
                                            <i class="fas fa-trash"></i> Delete
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                `;

        // Add images grid if there are images
        if (imageUrls.length > 0) {
            announcementHTML += createImagesGrid(imageUrls);
        }

        if (announcement.text) {
            announcementHTML += `
                        <div class="post-body">
                            ${announcement.text}
                        </div>
                    `;
        }

        announcementHTML += `
                        <div class="post-footer">
                            <div class="post-stats">
                                <div class="stat likes ${userLiked ? 'active' : ''}" data-announcement-key="${announcement.key}">
                                    <i class="fas fa-thumbs-up"></i> <span class="like-count">${announcement.likes || 0}</span>
                                </div>
                                <div class="stat comments" data-announcement-key="${announcement.key}">
                                    <i class="fas fa-comment"></i> <span class="comment-count">${announcement.comments || 0}</span>
                                </div>
                                <div class="stat views">
                                    <i class="fas fa-eye"></i> <span class="view-count">${announcement.views || 0}</span>
                                </div>
                            </div>
                        </div>
                        <div class="comments-section" id="comments-${announcement.key}">
                            <div class="comments-list" id="comments-list-${announcement.key}">
                                <!-- Comments will be loaded here -->
                            </div>
                            <div class="comment-input">
                                <input type="text" placeholder="Add a comment..." id="comment-input-${announcement.key}">
                                <button class="submit-comment" data-announcement-key="${announcement.key}">Post</button>
                            </div>
                        </div>
                    </div>
                `;

        postsContainer.innerHTML += announcementHTML;
    }

    // Add all event listeners after all posts are rendered
    // Add click event listeners to images for gallery display
    document.querySelectorAll('.post-image').forEach(img => {
        img.addEventListener('click', (e) => {
            const images = JSON.parse(e.target.getAttribute('data-images'));
            const index = parseInt(e.target.getAttribute('data-index'));
            openGalleryModal(images, index);
        });
    });

    // Add event listeners for like buttons
    document.querySelectorAll('.stat.likes').forEach(likeBtn => {
        likeBtn.addEventListener('click', (e) => {
            const announcementKey = e.currentTarget.getAttribute('data-announcement-key');
            toggleLike(announcementKey);
        });
    });

    // Add event listeners for comment buttons
    document.querySelectorAll('.stat.comments').forEach(commentBtn => {
        commentBtn.addEventListener('click', (e) => {
            const announcementKey = e.currentTarget.getAttribute('data-announcement-key');
            toggleComments(announcementKey);
        });
    });

    // Add event listeners for kebab menus
    document.querySelectorAll('.kebab-menu').forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = menu.querySelector('.kebab-dropdown');
            dropdown.classList.toggle('show');
        });
    });

    // Close dropdowns when clicking elsewhere
    document.addEventListener('click', () => {
        document.querySelectorAll('.kebab-dropdown').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    });

    // Add event listeners for edit buttons
    document.querySelectorAll('.edit-announcement-btn').forEach(editBtn => {
        editBtn.addEventListener('click', (e) => {
            const announcementKey = e.currentTarget.getAttribute('data-announcement-key');
            editAnnouncement(announcementKey);
        });
    });

    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-announcement-btn').forEach(deleteBtn => {
        deleteBtn.addEventListener('click', (e) => {
            const announcementKey = e.currentTarget.getAttribute('data-announcement-key');
            deleteAnnouncement(announcementKey);
        });
    });

    // Add event listeners for comment submission
    document.querySelectorAll('.submit-comment').forEach(button => {
        button.addEventListener('click', (e) => {
            const announcementKey = e.currentTarget.getAttribute('data-announcement-key');
            addComment(announcementKey);
        });
    });

    // Load comments for each announcement
    announcements.forEach(announcement => {
        loadComments(announcement.key);
    });
}

// Function to toggle comments section
function toggleComments(announcementKey) {
    const commentsSection = document.getElementById(`comments-${announcementKey}`);
    commentsSection.classList.toggle('show');
}

// Function to load comments for an announcement
function loadComments(announcementKey) {
    const announcementRef = database.ref('announcements/' + announcementKey + '/commentsList');

    announcementRef.on('value', (snapshot) => {
        const commentsList = document.getElementById(`comments-list-${announcementKey}`);
        commentsList.innerHTML = '';

        const comments = snapshot.val();
        if (comments) {
            Object.keys(comments).forEach(commentId => {
                const comment = comments[commentId];
                const commentElement = document.createElement('div');
                commentElement.className = 'comment';
                commentElement.innerHTML = `
                            <div class="comment-author">${comment.authorName}</div>
                            <div class="comment-text">${comment.text}</div>
                        `;
                commentsList.appendChild(commentElement);
            });
        }
    });
}

// Function to add a comment
function addComment(announcementKey) {
    const commentInput = document.getElementById(`comment-input-${announcementKey}`);
    const commentText = commentInput.value.trim();

    if (!commentText) return;

    const currentUserId = localStorage.getItem('userId');
    const currentUserName = localStorage.getItem('fullname') || localStorage.getItem('username') || 'Anonymous';

    if (!currentUserId) {
        alert('Please log in to comment.');
        return;
    }

    const announcementRef = database.ref('announcements/' + announcementKey);

    announcementRef.once('value').then((snapshot) => {
        const announcement = snapshot.val();
        if (!announcement) return;

        const commentsList = announcement.commentsList || {};
        const commentId = `comment_${Date.now()}`;

        commentsList[commentId] = {
            text: commentText,
            authorId: currentUserId,
            authorName: currentUserName,
            timestamp: new Date().toISOString()
        };

        const commentCount = Object.keys(commentsList).length;

        // Update the database
        announcementRef.update({
            commentsList: commentsList,
            comments: commentCount
        }).then(() => {
            commentInput.value = '';
        });
    });
}

// Function to toggle like on an announcement
function toggleLike(announcementKey) {
    const currentUserId = localStorage.getItem('userId');
    if (!currentUserId) {
        alert('Please log in to like announcements.');
        return;
    }

    const announcementRef = database.ref('announcements/' + announcementKey);

    announcementRef.once('value').then((snapshot) => {
        const announcement = snapshot.val();
        if (!announcement) return;

        const likedBy = announcement.likedBy || {};
        const isLiked = likedBy[currentUserId];
        let newLikes = announcement.likes || 0;

        if (isLiked) {
            // Unlike
            delete likedBy[currentUserId];
            newLikes = Math.max(0, newLikes - 1);
        } else {
            // Like
            likedBy[currentUserId] = true;
            newLikes += 1;
        }

        // Update the database
        announcementRef.update({
            likes: newLikes,
            likedBy: likedBy
        });
    });
}

// Function to mark an announcement as viewed
function markAnnouncementAsViewed(announcementKey, userId) {
    const announcementRef = database.ref('announcements/' + announcementKey);

    announcementRef.once('value').then((snapshot) => {
        const announcement = snapshot.val();
        if (!announcement) return;

        const viewedBy = announcement.viewedBy || {};
        const isViewed = viewedBy[userId];

        if (!isViewed) {
            viewedBy[userId] = true;
            const newViews = (announcement.views || 0) + 1;

            // Update the database
            announcementRef.update({
                views: newViews,
                viewedBy: viewedBy
            });
        }
    });
}

// Function to edit an announcement
function editAnnouncement(announcementKey) {
    const announcementRef = database.ref('announcements/' + announcementKey);

    announcementRef.once('value').then((snapshot) => {
        const announcement = snapshot.val();
        if (!announcement) return;

        // Create a modal for editing
        const editModal = document.createElement('div');
        editModal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0,0,0,0.7);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1001;
                `;

        const editContent = document.createElement('div');
        editContent.style.cssText = `
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    width: 90%;
                    max-width: 500px;
                `;

        editContent.innerHTML = `
                    <h3>Edit Announcement</h3>
                    <textarea id="editAnnouncementText" style="width: 100%; height: 150px; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px;">${announcement.text || ''}</textarea>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button id="cancelEditAnnouncement" style="padding: 8px 15px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">Cancel</button>
                        <button id="saveAnnouncement" style="padding: 8px 15px; background: #4a6fa5; color: white; border: none; border-radius: 5px; cursor: pointer;">Save Changes</button>
                    </div>
                `;

        editModal.appendChild(editContent);
        document.body.appendChild(editModal);

        // Add event listeners
        document.getElementById('cancelEditAnnouncement').addEventListener('click', () => {
            document.body.removeChild(editModal);
        });

        document.getElementById('saveAnnouncement').addEventListener('click', () => {
            const newText = document.getElementById('editAnnouncementText').value.trim();

            if (!newText && !announcement.imageUrl) {
                alert('Announcement must have either text or an image.');
                return;
            }

            // Update the announcement
            announcementRef.update({
                text: newText,
                updatedAt: new Date().toISOString()
            }).then(() => {
                document.body.removeChild(editModal);
                showUploadStatus('Announcement updated successfully!', 'success');
            }).catch(error => {
                console.error('Error updating announcement:', error);
                showUploadStatus('Error updating announcement: ' + error.message, 'error');
            });
        });

        // Close modal when clicking outside
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) {
                document.body.removeChild(editModal);
            }
        });
    });
}

// Function to delete an announcement
function deleteAnnouncement(announcementKey) {
    if (confirm('Are you sure you want to delete this announcement?')) {
        const announcementRef = database.ref('announcements/' + announcementKey);

        announcementRef.remove()
            .then(() => {
                showUploadStatus('Announcement deleted successfully!', 'success');
            })
            .catch(error => {
                console.error('Error deleting announcement:', error);
                showUploadStatus('Error deleting announcement: ' + error.message, 'error');
            });
    }
}

// Close modals when clicking X or outside
closeModal.addEventListener('click', () => {
    imageModal.style.display = 'none';
});

imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) {
        imageModal.style.display = 'none';
    }
});

// NEW: Gallery modal event listeners
galleryClose.addEventListener('click', () => {
    galleryModal.style.display = 'none';
});

galleryModal.addEventListener('click', (e) => {
    if (e.target === galleryModal) {
        galleryModal.style.display = 'none';
    }
});

galleryPrev.addEventListener('click', () => {
    navigateGallery('prev');
});

galleryNext.addEventListener('click', () => {
    navigateGallery('next');
});

// NEW: Keyboard navigation for gallery
document.addEventListener('keydown', (e) => {
    if (galleryModal.style.display === 'flex') {
        if (e.key === 'ArrowLeft') {
            navigateGallery('prev');
        } else if (e.key === 'ArrowRight') {
            navigateGallery('next');
        } else if (e.key === 'Escape') {
            galleryModal.style.display = 'none';
        }
    }
});

// Function to set the minimum date to today
function setMinDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const minDate = `${year}-${month}-${day}`;

    document.getElementById('eventDate').setAttribute('min', minDate);
}

// Function to validate if the selected date is not in the past
function validateDate(selectedDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selected = new Date(selectedDate);

    return selected >= today;
}

// Function to validate if the selected time is not in the past for today's date
function validateDateTime(selectedDate, selectedTime) {
    const now = new Date();
    const selected = new Date(`${selectedDate}T${selectedTime}`);

    return selected >= now;
}

// Function to convert 24-hour time to 12-hour format with AM/PM
function formatTimeToAMPM(timeString) {
    if (!timeString) return '';

    const [hours, minutes] = timeString.split(':');
    let hour = parseInt(hours, 10);
    const minute = parseInt(minutes, 10);

    const period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12;

    const formattedMinutes = minute < 10 ? `0${minute}` : minute;

    return `${hour}:${formattedMinutes} ${period}`;
}

// Toggle between create and edit mode
function toggleEditMode(isEditMode = false, event = null) {
    if (isEditMode && event) {
        // Enter edit mode
        eventForm.classList.add('edit-mode');
        eventFormTitle.textContent = 'Edit Event';
        createEventBtn.style.display = 'none';
        updateEventBtn.style.display = 'block';
        cancelEditBtn.style.display = 'block';

        // Fill form with event data
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventDate').value = event.date;
        document.getElementById('eventTime').value = event.time;
        document.getElementById('eventparticipant').value = event.participant || '';
        document.getElementById('eventLocation').value = event.location;
        editingEventId.value = event.id;
        editingEventKey.value = event.key;
    } else {
        // Exit edit mode
        eventForm.classList.remove('edit-mode');
        eventFormTitle.textContent = 'Create New Event';
        createEventBtn.style.display = 'block';
        updateEventBtn.style.display = 'none';
        cancelEditBtn.style.display = 'none';

        // Clear form
        document.getElementById('eventTitle').value = '';
        document.getElementById('eventDate').value = '';
        document.getElementById('eventTime').value = '';
        document.getElementById('eventparticipant').value = '';
        document.getElementById('eventLocation').value = '';
        editingEventId.value = '';
        editingEventKey.value = '';
    }
}

// Event form visibility toggle
newEventBtn.addEventListener('click', () => {
    if (eventForm.style.display === 'none') {
        eventForm.style.display = 'block';
        announcementForm.style.display = 'none';
        newEventBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
        newAnnouncementBtn.style.display = 'none';

        // Set the minimum date when the form is shown
        setMinDate();
        // Make sure we're in create mode
        toggleEditMode(false);
    } else {
        eventForm.style.display = 'none';
        newEventBtn.innerHTML = '<i class="fas fa-calendar-plus"></i> New Event';
        newAnnouncementBtn.style.display = 'flex';
    }
});

newAnnouncementBtn.addEventListener('click', () => {
    if (announcementForm.style.display === 'none') {
        announcementForm.style.display = 'block';
        eventForm.style.display = 'none';
        newAnnouncementBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
        newEventBtn.style.display = 'none';
    } else {
        announcementForm.style.display = 'none';
        newAnnouncementBtn.innerHTML = '<i class="fas fa-bullhorn"></i> New Announcement';
        newEventBtn.style.display = 'flex';
    }
});

// Cancel edit mode
cancelEditBtn.addEventListener('click', () => {
    toggleEditMode(false);
    eventForm.style.display = 'none';
    newEventBtn.innerHTML = '<i class="fas fa-calendar-plus"></i> New Event';
    newAnnouncementBtn.style.display = 'flex';
});

// Create new event
createEventBtn.addEventListener('click', () => {
    const eventTitle = document.getElementById('eventTitle').value.trim();
    const eventDate = document.getElementById('eventDate').value;
    const eventTime = document.getElementById('eventTime').value;
    const eventParticipant = document.getElementById('eventparticipant').value.trim();
    const eventLocation = document.getElementById('eventLocation').value.trim();

    if (!eventTitle || !eventDate || !eventTime || !eventLocation) {
        alert('Please fill in all required fields');
        return;
    }

    if (!validateDate(eventDate)) {
        alert('Please select a date that is not in the past');
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(eventDate);

    if (selectedDateObj.getTime() === today.getTime() && !validateDateTime(eventDate, eventTime)) {
        alert('Please select a time that is not in the past for today');
        return;
    }

    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');

    if (!userId) {
        alert('User not authenticated. Please log in again.');
        return;
    }

    const newEvent = {
        id: generateEventId(),
        title: eventTitle,
        date: eventDate,
        time: eventTime,
        formattedTime: formatTimeToAMPM(eventTime),
        participant: eventParticipant,
        location: eventLocation,
        createdBy: userId,
        createdByName: username,
        createdAt: new Date().toISOString()
    };

    saveEventToDatabase(newEvent);
});

// Update existing event
updateEventBtn.addEventListener('click', () => {
    const eventTitle = document.getElementById('eventTitle').value.trim();
    const eventDate = document.getElementById('eventDate').value;
    const eventTime = document.getElementById('eventTime').value;
    const eventParticipant = document.getElementById('eventparticipant').value.trim();
    const eventLocation = document.getElementById('eventLocation').value.trim();

    if (!eventTitle || !eventDate || !eventTime || !eventLocation) {
        alert('Please fill in all required fields');
        return;
    }

    if (!validateDate(eventDate)) {
        alert('Please select a date that is not in the past');
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(eventDate);

    if (selectedDateObj.getTime() === today.getTime() && !validateDateTime(eventDate, eventTime)) {
        alert('Please select a time that is not in the past for today');
        return;
    }

    const userId = localStorage.getItem('userId');
    const eventKey = editingEventKey.value;

    if (!userId) {
        alert('User not authenticated. Please log in again.');
        return;
    }

    if (!eventKey) {
        alert('Error: Event key not found');
        return;
    }

    // Show loading state
    updateEventBtn.innerHTML = '<div class="spinner"></div> Updating...';
    updateEventBtn.disabled = true;

    // Get the existing event to preserve some fields
    const eventRef = database.ref('events/' + eventKey);
    eventRef.once('value').then((snapshot) => {
        const existingEvent = snapshot.val();

        const updatedEvent = {
            ...existingEvent,
            title: eventTitle,
            date: eventDate,
            time: eventTime,
            formattedTime: formatTimeToAMPM(eventTime),
            participant: eventParticipant,
            location: eventLocation,
            updatedAt: new Date().toISOString()
        };

        // Update the event in database
        eventRef.update(updatedEvent)
            .then(() => {
                alert('Event updated successfully!');

                // Reset form and exit edit mode
                toggleEditMode(false);
                eventForm.style.display = 'none';
                newEventBtn.innerHTML = '<i class="fas fa-calendar-plus"></i> New Event';
                newAnnouncementBtn.style.display = 'flex';

                // Reset button
                updateEventBtn.innerHTML = '<i class="fas fa-save"></i> Update Event';
                updateEventBtn.disabled = false;
            })
            .catch(error => {
                console.error('Error updating event:', error);
                alert('Error updating event: ' + error.message);

                // Reset button
                updateEventBtn.innerHTML = '<i class="fas fa-save"></i> Update Event';
                updateEventBtn.disabled = false;
            });
    });
});

// Generate a unique event ID
function generateEventId() {
    return 'event_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
}

// Save event to Firebase database
function saveEventToDatabase(event) {
    createEventBtn.innerHTML = '<div class="spinner"></div> Creating...';
    createEventBtn.disabled = true;

    const eventsRef = database.ref('events');

    eventsRef.push(event)
        .then(() => {
            alert('Event created successfully!');

            document.getElementById('eventTitle').value = '';
            document.getElementById('eventDate').value = '';
            document.getElementById('eventTime').value = '';
            document.getElementById('eventparticipant').value = '';
            document.getElementById('eventLocation').value = '';

            eventForm.style.display = 'none';
            newEventBtn.innerHTML = '<i class="fas fa-calendar-plus"></i> New Event';
            newAnnouncementBtn.style.display = 'flex';

            createEventBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Create Event';
            createEventBtn.disabled = false;
        })
        .catch(error => {
            console.error('Error saving event:', error);
            alert('Error creating event: ' + error.message);

            createEventBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Create Event';
            createEventBtn.disabled = false;
        });
}

// Load events from Firebase
function loadEvents() {
    const eventsRef = database.ref('events');

    eventsRef.on('value', (snapshot) => {
        const events = [];
        snapshot.forEach((childSnapshot) => {
            events.push({
                ...childSnapshot.val(),
                key: childSnapshot.key // Store the Firebase key for editing
            });
        });

        events.sort((a, b) => {
            const dateA = new Date(a.date + 'T' + a.time);
            const dateB = new Date(b.date + 'T' + b.time);
            return dateA - dateB;
        });

        displayEvents(events);
    });
}

// Display events in the UI - FIXED TO REMOVE EXPIRED EVENTS
function displayEvents(events) {
    const desktopEventsList = document.getElementById('desktopEventsList');
    const mobileEventsList = document.getElementById('mobileEventsList');
    const currentUserId = localStorage.getItem('userId');

    desktopEventsList.innerHTML = '';
    mobileEventsList.innerHTML = '';

    // FILTER OUT EXPIRED EVENTS
    const now = new Date();
    const upcomingEvents = events.filter(event => {
        const eventDateTime = new Date(event.date + 'T' + event.time);
        return eventDateTime >= now;
    });

    if (upcomingEvents.length === 0) {
        desktopEventsList.innerHTML = '<p>No upcoming events</p>';
        mobileEventsList.innerHTML = '<p>No upcoming events</p>';
        return;
    }

    upcomingEvents.forEach(event => {
        const eventDate = new Date(event.date);
        const formattedDate = eventDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const displayTime = event.formattedTime || formatTimeToAMPM(event.time);
        const isEventCreator = event.createdBy === currentUserId;

        let eventHTML = `
                    <div class="upcoming-event" data-event-id="${event.id}">
                        <h4>${event.title}</h4>
                        <p><i class="far fa-calendar"></i> ${formattedDate} • ${displayTime}</p>
                        <p><i class="fas fa-map-marker-alt"></i> ${event.location}</p>
                        ${event.participant ? `<p><i class="fas fa-users"></i> ${event.participant}</p>` : ''}
                        <p><small>Created by: ${event.createdByName || 'Unknown'}</small></p>
                `;

        // Add edit/delete buttons if user is the creator
        if (isEventCreator) {
            eventHTML += `
                        <div class="event-actions">
                            <button class="edit-event-btn" data-event-key="${event.key}">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="delete-event-btn" data-event-key="${event.key}">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    `;
        }

        eventHTML += `</div>`;

        desktopEventsList.innerHTML += eventHTML;
        mobileEventsList.innerHTML += eventHTML;
    });

    // Add event listeners to edit and delete buttons
    document.querySelectorAll('.edit-event-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const eventKey = e.currentTarget.getAttribute('data-event-key');
            editEvent(eventKey);
        });
    });

    document.querySelectorAll('.delete-event-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const eventKey = e.currentTarget.getAttribute('data-event-key');
            deleteEvent(eventKey);
        });
    });
}

// Edit event function
function editEvent(eventKey) {
    const eventRef = database.ref('events/' + eventKey);

    eventRef.once('value').then((snapshot) => {
        const event = snapshot.val();

        if (event) {
            // Show event form and switch to edit mode
            eventForm.style.display = 'block';
            announcementForm.style.display = 'none';
            newEventBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
            newAnnouncementBtn.style.display = 'none';

            toggleEditMode(true, {
                ...event,
                key: eventKey
            });
        }
    }).catch(error => {
        console.error('Error loading event for editing:', error);
        alert('Error loading event for editing');
    });
}

// Delete event function
function deleteEvent(eventKey) {
    if (confirm('Are you sure you want to delete this event?')) {
        const eventRef = database.ref('events/' + eventKey);

        eventRef.remove()
            .then(() => {
                alert('Event deleted successfully!');
            })
            .catch(error => {
                console.error('Error deleting event:', error);
                alert('Error deleting event: ' + error.message);
            });
    }
}

// Check if user is response team member
function checkUserRole() {
    const rolePath = localStorage.getItem('rolePath');
    return rolePath === 'response_team';
}

// Session check function
function checkSession() {
    const userId = localStorage.getItem('userId');
    return !!userId;
}

// Initialize page
document.addEventListener('DOMContentLoaded', function () {
    // Session check
    if (!checkSession()) {
        alert('Please log in to access this page.');
        window.location.href = 'index.html';
        return;
    }

    setMinDate();

    if (!checkUserRole()) {
        newEventBtn.style.display = 'none';
        newAnnouncementBtn.style.display = 'none';
    }

    loadEvents();
    loadAnnouncements();

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function (e) {
            document.querySelectorAll('.nav-item').forEach(nav => {
                nav.classList.remove('active');
            });
            this.classList.add('active');
        });
    });
});