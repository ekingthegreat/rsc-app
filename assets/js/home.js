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

// Reference to the database
const database = firebase.database();

// DOM elements
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

let currentGalleryImages = [];
let currentGalleryIndex = 0;

// Session check function
function checkSession() {
  const userId = localStorage.getItem('userId');
  return !!userId;
}

// Function to validate image URL
function isValidImageUrl(url) {
  if (!url) return false;

  // Check if it's a data URL (SVG default avatar)
  if (url.startsWith('data:image/svg+xml')) {
    return true;
  }

  // Check if it's a valid URL format
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// Function to create default avatar - ENHANCED VERSION
function getDefaultAvatar(userId) {
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

  // Get user name from session storage or use fallback
  const userName = localStorage.getItem('fullname') ||
    localStorage.getItem('username') ||
    'User';

  // Get first letter of first name, or first character of username
  let userInitial = 'U';
  if (userName && userName.trim() !== '') {
    const nameParts = userName.trim().split(' ');
    userInitial = nameParts[0].charAt(0).toUpperCase();
  }

  // Create SVG avatar with better styling
  const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 45 45">
          <circle cx="22.5" cy="22.5" r="22.5" fill="${color}"/>
          <text x="22.5" y="30" font-family="Arial, sans-serif" font-size="16" font-weight="bold" 
                fill="white" text-anchor="middle" dominant-baseline="middle">${userInitial}</text>
        </svg>
      `;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Function to get user profile image - ENHANCED VERSION
async function getUserProfileImage(userId) {
  try {
    // First, try to get the profile picture from the database
    const userRoles = ['response_team', 'barangay_official', 'barangay_captain', 'admin'];

    for (const role of userRoles) {
      const userRef = database.ref(`users/${role}/${userId}`);
      const snapshot = await userRef.once('value');
      const userData = snapshot.val();

      if (userData && userData.profilePicture && userData.profilePicture.trim() !== '') {
        // Validate the URL before returning
        if (isValidImageUrl(userData.profilePicture)) {
          return userData.profilePicture;
        } else {
          console.warn(`Invalid profile picture URL for user ${userId}:`, userData.profilePicture);
          break; // Break and use default avatar
        }
      }
    }

    // If no valid profile picture found, generate a default avatar
    return getDefaultAvatar(userId);
  } catch (error) {
    console.error('Error fetching profile picture:', error);
    return getDefaultAvatar(userId);
  }
}

// Function to handle image loading errors
function handleImageError(imgElement, userId) {
  imgElement.onerror = null; // Prevent infinite loop
  imgElement.src = getDefaultAvatar(userId);
  imgElement.alt = "Default Avatar";
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

// Display announcements in the feed - ENHANCED VERSION
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

    const userLiked = announcement.likedBy && announcement.likedBy[currentUserId];
    const userViewed = announcement.viewedBy && announcement.viewedBy[currentUserId];

    // GET PROFILE IMAGE WITH ERROR HANDLING
    let profileImageUrl;
    try {
      profileImageUrl = await getUserProfileImage(announcement.createdBy);
    } catch (error) {
      console.error('Error loading profile image:', error);
      profileImageUrl = getDefaultAvatar(announcement.createdBy);
    }

    // Mark as viewed if not already
    if (!userViewed && currentUserId) {
      markAnnouncementAsViewed(announcement.key, currentUserId);
    }

    // Handle both single image (backward compatibility) and multiple images
    const imageUrls = announcement.imageUrls ||
      (announcement.imageUrl ? [announcement.imageUrl] : []);

    let announcementHTML = `
          <div class="post" data-announcement-id="${announcement.id}" data-announcement-key="${announcement.key}">
            <div class="post-header">
              <img src="${profileImageUrl}" alt="Profile" class="post-avatar" 
                   onerror="handleImageError(this, '${announcement.createdBy}')">
              <div class="post-info">
                <div class="post-author">${announcement.createdByName}</div>
                <div class="post-meta">
                  ${formattedDate} | ${displayTime}
                </div>
              </div>
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

// Function to check if an event is expired
function isEventExpired(event) {
  const now = new Date();
  const eventDateTime = new Date(`${event.date}T${event.time}`);

  // Event is expired if it's before the current date/time
  return eventDateTime < now;
}

// Load events from Firebase
function loadEvents() {
  const eventsRef = database.ref('events');

  eventsRef.on('value', (snapshot) => {
    const events = [];
    snapshot.forEach((childSnapshot) => {
      const event = {
        ...childSnapshot.val(),
        key: childSnapshot.key
      };

      // Only include events that are not expired
      if (!isEventExpired(event)) {
        events.push(event);
      }
    });

    // Sort by date (soonest first)
    events.sort((a, b) => {
      const dateA = new Date(a.date + 'T' + a.time);
      const dateB = new Date(b.date + 'T' + b.time);
      return dateA - dateB;
    });

    displayEvents(events);
  });
}

// Display events in the UI
function displayEvents(events) {
  const desktopEventsList = document.getElementById('desktopEventsList');
  const mobileEventsList = document.getElementById('mobileEventsList');

  desktopEventsList.innerHTML = '';
  mobileEventsList.innerHTML = '';

  if (events.length === 0) {
    desktopEventsList.innerHTML = '<p>No upcoming events</p>';
    mobileEventsList.innerHTML = '<p>No upcoming events</p>';
    return;
  }

  events.forEach(event => {
    const eventDate = new Date(event.date);
    const formattedDate = eventDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const displayTime = event.formattedTime || formatTimeToAMPM(event.time);

    let eventHTML = `
          <div class="upcoming-event" data-event-id="${event.id}">
            <h4>${event.title}</h4>
            <p><i class="far fa-calendar"></i> ${formattedDate} • ${displayTime}</p>
            <p><i class="fas fa-map-marker-alt"></i> ${event.location}</p>
            ${event.participant ? `<p><i class="fas fa-users"></i> ${event.participant}</p>` : ''}
            <p><small>Created by: ${event.createdByName || 'Unknown'}</small></p>
          </div>
        `;

    desktopEventsList.innerHTML += eventHTML;
    mobileEventsList.innerHTML += eventHTML;
  });
}

// Initialize page
document.addEventListener('DOMContentLoaded', function () {
  // Session check and role-based navigation
  if (!checkSession()) {
    alert('Please log in to access this page.');
    window.location.href = 'index.html';
    return;
  }

  const userRole = localStorage.getItem('role');
  const captainNavItem = document.getElementById('captain-nav-item');

  if (userRole && userRole.toLowerCase() === 'captain' && captainNavItem) {
    captainNavItem.style.display = 'flex';
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