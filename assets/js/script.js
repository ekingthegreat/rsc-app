let stream = null;
let continuousInterval = null;
let isContinuousActive = false;
let lastProcessedResults = null;

document.addEventListener('DOMContentLoaded', function() {
    const stopContinuousBtn = document.getElementById('stopContinuous');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const noCamera = document.getElementById('noCamera');
    const statusIndicator = document.getElementById('statusIndicator');

    // Automatically start camera and continuous recognition on page load
    initializeRecognition();

    stopContinuousBtn.addEventListener('click', stopContinuousRecognition);

    async function initializeRecognition() {
        await startCamera();
        if (stream) {
            await startContinuousRecognition();
        }
    }

    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' }
            });
            video.srcObject = stream;
            video.classList.remove('d-none');
            noCamera.classList.add('d-none');
            return true;
        } catch (err) {
            console.error('Error accessing camera:', err);
            noCamera.classList.remove('d-none');
            statusIndicator.innerHTML = '<span class="status-dot status-dot-inactive"></span><span>Camera not available</span>';
            statusIndicator.className = 'status-indicator status-inactive';
            return false;
        }
    }

    async function startContinuousRecognition() {
        if (isContinuousActive) return;

        const video = document.getElementById('video');
        const canvas = document.getElementById('canvas');
        const resultsDiv = document.getElementById('results');

        if (!stream) {
            alert('Camera is not available');
            return;
        }

        // Update status indicator
        statusIndicator.innerHTML = '<span class="status-dot status-dot-active"></span><span>Recognition Active - Scanning for faces</span>';
        statusIndicator.className = 'status-indicator status-active';

        // Start continuous recognition on the server
        try {
            const startResponse = await fetch('/api/continuous_recognition/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const startData = await startResponse.json();
            if (!startData.success) {
                alert('Failed to start continuous recognition: ' + startData.error);
                statusIndicator.innerHTML = '<span class="status-dot status-dot-inactive"></span><span>Failed to start recognition</span>';
                statusIndicator.className = 'status-indicator status-inactive';
                return;
            }
            console.log('Server continuous recognition started');
        } catch (error) {
            console.error('Error starting continuous recognition:', error);
            statusIndicator.innerHTML = '<span class="status-dot status-dot-inactive"></span><span>Connection error</span>';
            statusIndicator.className = 'status-indicator status-inactive';
            return;
        }

        isContinuousActive = true;
        lastProcessedResults = null;
        resultsDiv.innerHTML = '<div class="alert alert-info recognition-active">Continuous face recognition active. System is scanning for faces...</div>';

        continuousInterval = setInterval(async () => {
            try {
                const context = canvas.getContext('2d');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                canvas.toBlob(async (blob) => {
                    try {
                        const formData = new FormData();
                        formData.append('image', blob, 'frame.jpg');

                        const response = await fetch('/api/continuous_recognition/frame', {
                            method: 'POST',
                            body: formData
                        });

                        // Check if response is OK
                        if (!response.ok) {
                            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                        }

                        const data = await response.json();
                        
                        // Validate the response structure
                        if (data && typeof data === 'object') {
                            if (data.success && Array.isArray(data.results)) {
                                displayContinuousResults(data.results);
                            } else if (data.error) {
                                console.error('Recognition error:', data.error);
                                handleRecognitionError(data.error);
                            } else {
                                console.warn('Unexpected response format:', data);
                                // Don't display anything for unexpected formats
                            }
                        } else {
                            console.error('Invalid response format:', data);
                        }
                    } catch (error) {
                        console.error('Frame processing error:', error);
                        // Don't update the display on network errors
                    }
                }, 'image/jpeg');

            } catch (error) {
                console.error('Continuous recognition error:', error);
            }
        }, 500);
    }

    function handleRecognitionError(error) {
        // If we get "not active" error, try to restart
        if (error && error.includes && error.includes('not active')) {
            console.log('Continuous recognition not active, attempting to restart...');
            // Auto-restart the continuous recognition
            fetch('/api/continuous_recognition/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(restartResponse => restartResponse.json())
            .then(restartData => {
                console.log('Restart attempt result:', restartData);
            })
            .catch(restartError => {
                console.error('Restart failed:', restartError);
            });
        }
    }

    function displayContinuousResults(results) {
        const resultsDiv = document.getElementById('results');
        
        // Check if results are the same as last time to avoid unnecessary updates
        if (JSON.stringify(results) === JSON.stringify(lastProcessedResults)) {
            return;
        }
        
        lastProcessedResults = results;

        // Validate that results is an array
        if (!Array.isArray(results)) {
            console.error('Results is not an array:', results);
            resultsDiv.innerHTML = '<div class="alert alert-warning">System error: Invalid data format</div>';
            return;
        }

        if (results.length === 0) {
            resultsDiv.innerHTML = '<div class="alert alert-info">Scanning... No faces detected yet</div>';
            return;
        }

        let html = '<h4>Live Face Recognition Results:</h4>';
        let validFacesCount = 0;

        results.forEach((result, index) => {
            // Validate each face result object
            if (!isValidFaceResult(result)) {
                console.warn('Invalid face result skipped:', result);
                return; // Skip this invalid result
            }

            validFacesCount++;
            const confidenceClass = result.confidence > 70 ? 'face-known' : 'face-unknown';
            const livenessClass = (result.is_live !== undefined && result.is_live) ? 'text-live' : 'text-suspicious';
            const livenessText = (result.is_live !== undefined && result.is_live) ? 'Live' : 'Suspicious';
            const livenessBorder = (result.is_live !== undefined && result.is_live) ? 'face-live' : 'face-suspicious';

            html += `
                <div class="face-result ${confidenceClass} ${livenessBorder} p-3 mb-2">
                    <h5>Face ${validFacesCount} <small class="${livenessClass}">(${livenessText})</small></h5>
                    <p><strong>Name:</strong> ${escapeHtml(result.name || 'Unknown')}</p>
                    <p><strong>Confidence:</strong> ${result.confidence || 0}%</p>
                    ${result.liveness_score !== undefined ? `<p><strong>Liveness Score:</strong> ${result.liveness_score}</p>` : ''}
                    ${result.location ? `<p><strong>Location:</strong> Top: ${result.location.top || 0}, Left: ${result.location.left || 0}</p>` : ''}
                    ${result.face_id ? `<p><small class="text-muted">ID: ${escapeHtml(result.face_id)}</small></p>` : ''}
                </div>
            `;
        });

        if (validFacesCount === 0) {
            resultsDiv.innerHTML = '<div class="alert alert-warning">No valid face data received</div>';
        } else {
            resultsDiv.innerHTML = html;
        }
    }

    function isValidFaceResult(result) {
        // Basic validation for face result object
        if (!result || typeof result !== 'object') {
            return false;
        }
        
        // Check for required properties with proper types
        if (typeof result.name !== 'string') {
            return false;
        }
        
        if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 100) {
            return false;
        }
        
        // Optional properties validation
        if (result.is_live !== undefined && typeof result.is_live !== 'boolean') {
            return false;
        }
        
        if (result.liveness_score !== undefined && typeof result.liveness_score !== 'number') {
            return false;
        }
        
        if (result.location && typeof result.location !== 'object') {
            return false;
        }
        
        return true;
    }

    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return String(unsafe);
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    async function stopContinuousRecognition() {
        if (!isContinuousActive) return;

        isContinuousActive = false;
        if (continuousInterval) {
            clearInterval(continuousInterval);
            continuousInterval = null;
        }

        // Stop continuous recognition on the server
        try {
            const stopResponse = await fetch('/api/continuous_recognition/stop', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const stopData = await stopResponse.json();
            console.log('Server continuous recognition stopped:', stopData.message);
        } catch (error) {
            console.error('Error stopping continuous recognition:', error);
        }

        // Update status indicator
        statusIndicator.innerHTML = '<span class="status-dot status-dot-inactive"></span><span>Recognition Stopped</span>';
        statusIndicator.className = 'status-indicator status-inactive';

        document.getElementById('results').innerHTML = '<div class="alert alert-warning">Face recognition has been stopped.</div>';
    }
});