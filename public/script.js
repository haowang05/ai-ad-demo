document.addEventListener('DOMContentLoaded', () => {
    // --- Stages & Elements ---
    const stages = {
        agree: document.getElementById('agree-stage'),
        main: document.getElementById('main-stage'),
    };
    const agreeButton = document.getElementById('agreeButton');
    const videoContainer = document.getElementById('video-container');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const snapshotImage = document.getElementById('snapshot');
    const countdownOverlay = document.getElementById('countdown-overlay');
    const countdownText = document.getElementById('countdown-text');
    const retryButton = document.getElementById('retryButton');
    
    // --- Info Display Elements ---
    const genderBox = document.getElementById('gender-box');
    const ageBox = document.getElementById('age-box');
    const locationBox = document.getElementById('location-box');
    const categoryBox = document.getElementById('category-box');
    const adBox = document.getElementById('ad-box');
    
    let modelsLoaded = false;
    let detectionInterval = null;
    let locationInfo = { city: 'Fetching', country: 'Location...' };

    // --- Initialization ---
    function initialize() {
        stages.agree.classList.add('active');
        stages.main.classList.remove('active');
        loadModels();
    }

    // --- Model Loading ---
    async function loadModels() {
        try {
            updateInfoBox(locationBox, 'Loading AI models...');
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
                faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),
                faceapi.nets.ageGenderNet.loadFromUri('/models'),
            ]);
            modelsLoaded = true;
            updateInfoBox(locationBox, 'Models loaded successfully');
            fetchLocation(); // Fetch location after models are loaded
        } catch (error) {
            console.error("Failed to load models:", error);
            updateInfoBox(locationBox, 'Failed to load models', true);
        }
    }

    // --- Location Fetching ---
    async function fetchLocation() {
        try {
            updateInfoBox(locationBox, 'Fetching location...');
            const response = await fetch('/api/location');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            locationInfo = data;
            updateInfoBox(locationBox, `${data.country}, ${data.city}`);
        } catch (error) {
            console.error('Failed to fetch location:', error);
            updateInfoBox(locationBox, 'Location fetch failed', true);
            locationInfo = { city: 'Unknown', country: 'Unknown' };
        }
    }

    // --- Start after user agrees ---
    agreeButton.addEventListener('click', () => {
        stages.agree.classList.remove('active');
        stages.main.classList.add('active');
        startCameraAndDetection();
    });

    // --- Camera & Detection Logic ---
    async function startCameraAndDetection() {
        if (!modelsLoaded) {
            alert('AI models are not loaded yet, please wait...');
            return;
        }
        resetUI();
        snapshotImage.style.display = 'none';
        video.style.display = 'block';

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
            video.srcObject = stream;
        } catch (err) {
            console.error("Failed to access camera:", err);
            alert('Could not access the camera. Please check permissions.');
        }

        detectionInterval = setInterval(async () => {
            const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withAgeAndGender();
            if (detections) {
                clearInterval(detectionInterval);
                detectionInterval = null;
                startCountdown(detections);
            }
        }, 500);
    }

    // --- Countdown Logic ---
    function startCountdown(detectionData) {
        let count = 3;
        countdownOverlay.style.display = 'flex';
        countdownText.textContent = `Get Ready! ${count}`;
        const countdownInterval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownText.textContent = count;
            } else {
                clearInterval(countdownInterval);
                countdownOverlay.style.display = 'none';
                processUserData(detectionData);
            }
        }, 1000);
    }

    // --- Process Data and Call APIs ---
    async function processUserData(detection) {
        // 1. Take snapshot and stop video stream
        const snapshotCanvas = document.createElement('canvas');
        snapshotCanvas.width = video.videoWidth;
        snapshotCanvas.height = video.videoHeight;
        snapshotCanvas.getContext('2d').drawImage(video, 0, 0);
        snapshotImage.src = snapshotCanvas.toDataURL('image/png');
        snapshotImage.style.display = 'block';
        video.style.display = 'none';
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
        }

        // 2. Update basic info
        const gender = detection.gender === 'male' ? 'Male' : 'Female';
        const age = Math.round(detection.age);
        updateInfoBox(genderBox, gender);
        updateInfoBox(ageBox, `Around ${age} years old`);
        
        const userData = { gender, age, location: `${locationInfo.country}, ${locationInfo.city}` };

        try {
            // 3. Get ad category
            updateInfoBox(categoryBox, 'Analyzing category...');
            const categoryResponse = await fetch('/api/get-category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData),
            });
            if (!categoryResponse.ok) throw new Error('Failed to get category');
            const { category } = await categoryResponse.json();
            updateInfoBox(categoryBox, category);

            // 4. Get ad content
            updateInfoBox(adBox, 'Generating content...');
            const adResponse = await fetch('/api/get-ad', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...userData, category }),
            });
            if (!adResponse.ok) throw new Error('Failed to get ad');
            const { ad } = await adResponse.json();
            updateInfoBox(adBox, ad);

        } catch (error) {
            console.error("API call failed:", error);
            updateInfoBox(categoryBox, "Analysis failed", true);
            updateInfoBox(adBox, "Generation failed", true);
        } finally {
            retryButton.style.display = 'block';
        }
    }
    
    // --- UI Update & Reset ---
    function updateInfoBox(element, text, isError = false) {
        element.textContent = text;
        if (isError) element.classList.add('error');
        else element.classList.remove('error');
    }
    
    function resetUI() {
        const boxes = [genderBox, ageBox, locationBox, categoryBox, adBox];
        boxes.forEach(box => updateInfoBox(box, '---'));
        retryButton.style.display = 'none';
        fetchLocation();
    }

    // --- Retry Button ---
    retryButton.addEventListener('click', startCameraAndDetection);

    // --- Initialize Page ---
    initialize();
});

