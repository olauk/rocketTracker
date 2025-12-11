/**
 * App.js - Hoved-applikasjon for Rakett Tracker
 */

// Global state
let app = {
    video: null,
    currentSection: 'upload',
    calibration: {
        canvas: null,
        ctx: null,
        startPoint: null,
        endPoint: null,
        isDrawing: false,
        pixelToMeterRatio: null
    },
    roi: {
        canvas: null,
        ctx: null,
        startPoint: null,
        endPoint: null,
        isDrawing: false,
        rect: null
    },
    tracker: null,
    telemetry: null,
    visualizer: null,
    fps: 30
};

// Wait for OpenCV.js to load
function onOpenCvReady() {
    console.log('OpenCV.js er lastet og klar!');
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Rakett Tracker initialiserer...');
    console.log('DOM fully loaded');

    try {
        // Initialize video element
        app.video = document.getElementById('videoElement');
        if (!app.video) {
            console.error('❌ CRITICAL: videoElement not found in DOM!');
            alert('Kritisk feil: Video-element mangler. Sjekk at index.html er korrekt.');
            return;
        }
        console.log('✓ Video element initialized');

        // Initialize visualizer
        try {
            app.visualizer = new TelemetryVisualizer();
            console.log('✓ Visualizer initialized');
        } catch (e) {
            console.error('❌ Error initializing visualizer:', e);
            // Continue anyway - visualizer is only needed for results
        }

        // Setup event listeners
        setupEventListeners();

        // Check if OpenCV is loaded
        if (typeof cv !== 'undefined') {
            if (cv.getBuildInformation) {
                console.log('✓ OpenCV.js er lastet');
                onOpenCvReady();
            } else {
                cv.onRuntimeInitialized = onOpenCvReady;
            }
        } else {
            console.log('⏳ Venter på OpenCV.js...');
            // Set global callback
            window.onOpenCvReady = onOpenCvReady;
        }

        console.log('✅ Rakett Tracker initialization complete!');
    } catch (error) {
        console.error('❌ FATAL ERROR during initialization:', error);
        alert('Kritisk feil ved oppstart: ' + error.message);
    }
});

/**
 * Setup alle event listeners
 */
function setupEventListeners() {
    console.log('Setting up event listeners...');

    // Helper function to safely add event listener
    const addListener = (id, event, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
            console.log(`✓ Event listener added for ${id}`);
        } else {
            console.warn(`⚠ Element not found: ${id}`);
        }
    };

    // Video upload
    addListener('videoInput', 'change', handleVideoUpload);

    // FPS input
    addListener('fpsInput', 'change', handleFPSChange);

    // Calibration
    addListener('resetCalibration', 'click', resetCalibration);
    addListener('confirmCalibration', 'click', confirmCalibration);

    // ROI selection
    addListener('resetROI', 'click', resetROI);
    addListener('startTracking', 'click', startTracking);

    // Tracking controls
    addListener('pauseTracking', 'click', pauseTracking);
    addListener('continueTracking', 'click', continueTracking);
    addListener('undoManualPoint', 'click', undoManualPoint);
    addListener('stopTracking', 'click', stopTracking);

    // Results
    addListener('exportCSV', 'click', exportCSV);
    addListener('exportVideo', 'click', exportVideo);
    addListener('restart', 'click', restart);

    console.log('Event listeners setup complete');
}

/**
 * Handle video upload
 */
function handleVideoUpload(event) {
    console.log('handleVideoUpload called');

    try {
        const file = event.target.files[0];
        if (!file) {
            console.log('No file selected');
            return;
        }

        console.log('File selected:', file.name, file.type, file.size);

        // Check if video element exists
        if (!app.video) {
            console.error('Video element not found!');
            alert('Feil: Video-element ikke funnet. Vennligst refresh siden.');
            return;
        }

        const url = URL.createObjectURL(file);
        app.video.src = url;

        app.video.onerror = function(e) {
            console.error('Video load error:', e);
            alert('Feil ved lasting av video. Sjekk at formatet er støttet (MP4, MOV, WebM).');
        };

        app.video.onloadedmetadata = function() {
            console.log('Video metadata loaded');

            const duration = app.video.duration;
            const width = app.video.videoWidth;
            const height = app.video.videoHeight;

            console.log('Video info:', { duration, width, height });

            // Estimat FPS (standard er 30, men kan prøve å detektere)
            app.fps = 30;

            const fpsInput = document.getElementById('fpsInput');
            if (fpsInput) {
                fpsInput.value = app.fps;
            }

            const videoInfo = document.getElementById('video-info');
            if (videoInfo) {
                videoInfo.innerHTML = `
                    <strong>Video lastet:</strong><br>
                    Oppløsning: ${width}x${height}<br>
                    Varighet: ${duration.toFixed(2)}s
                `;
            }

            // Show FPS config
            const fpsConfig = document.getElementById('fps-config');
            if (fpsConfig) {
                fpsConfig.classList.remove('hidden');
            }

            // Show calibration section
            showSection('calibration');
            initializeCalibration();
        };
    } catch (error) {
        console.error('Error in handleVideoUpload:', error);
        alert('Feil ved opplasting av video: ' + error.message);
    }
}

/**
 * Handle FPS change
 */
function handleFPSChange(event) {
    const fps = parseInt(event.target.value);
    if (fps > 0 && fps <= 240) {
        app.fps = fps;
        console.log('FPS satt til:', app.fps);
    } else {
        alert('FPS må være mellom 1 og 240');
        event.target.value = app.fps;
    }
}

/**
 * Show a specific section
 */
function showSection(section) {
    const sections = ['upload', 'calibration', 'roi', 'tracking', 'results'];
    sections.forEach(s => {
        const el = document.getElementById(`${s}-section`);
        if (el) {
            if (s === section) {
                el.classList.remove('hidden');
            } else {
                // Keep previous sections visible
                const sectionIndex = sections.indexOf(s);
                const currentIndex = sections.indexOf(section);
                if (sectionIndex < currentIndex) {
                    el.classList.remove('hidden');
                }
            }
        }
    });
    app.currentSection = section;
}

/**
 * Initialize calibration canvas
 */
function initializeCalibration() {
    app.calibration.canvas = document.getElementById('calibrationCanvas');
    app.calibration.ctx = app.calibration.canvas.getContext('2d', { willReadFrequently: true });

    // Set canvas size to match video
    app.calibration.canvas.width = app.video.videoWidth;
    app.calibration.canvas.height = app.video.videoHeight;

    // Draw first frame
    app.video.currentTime = 0;
    app.video.onseeked = function() {
        redrawCalibration(); // Use redrawCalibration to preserve the line
    };

    // Setup drawing
    setupCalibrationDrawing();
}

/**
 * Setup calibration drawing (line for reference stick)
 */
function setupCalibrationDrawing() {
    const canvas = app.calibration.canvas;

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);

        app.calibration.isDrawing = true;
        app.calibration.startPoint = { x, y };
        app.calibration.endPoint = { x, y };
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!app.calibration.isDrawing) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);

        app.calibration.endPoint = { x, y };

        // Redraw
        redrawCalibration();
    });

    canvas.addEventListener('mouseup', () => {
        if (app.calibration.isDrawing) {
            app.calibration.isDrawing = false;
            calculateCalibration();
        }
    });
}

/**
 * Redraw calibration canvas
 */
function redrawCalibration() {
    const ctx = app.calibration.ctx;

    // Redraw video frame (video should already be at time 0)
    ctx.drawImage(app.video, 0, 0);

    // Draw line if it exists
    if (app.calibration.startPoint && app.calibration.endPoint) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(app.calibration.startPoint.x, app.calibration.startPoint.y);
        ctx.lineTo(app.calibration.endPoint.x, app.calibration.endPoint.y);
        ctx.stroke();

        // Draw points
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(app.calibration.startPoint.x, app.calibration.startPoint.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(app.calibration.endPoint.x, app.calibration.endPoint.y, 5, 0, 2 * Math.PI);
        ctx.fill();
    }
}

/**
 * Calculate pixel-to-meter ratio
 */
function calculateCalibration() {
    if (!app.calibration.startPoint || !app.calibration.endPoint) return;

    const dx = app.calibration.endPoint.x - app.calibration.startPoint.x;
    const dy = app.calibration.endPoint.y - app.calibration.startPoint.y;
    const pixelLength = Math.sqrt(dx * dx + dy * dy);

    // Get reference length from input
    const referenceLength = parseFloat(document.getElementById('referenceLengthInput').value);

    if (!referenceLength || referenceLength <= 0) {
        alert('Vennligst oppgi en gyldig referanselengde');
        return;
    }

    app.calibration.pixelToMeterRatio = pixelLength / referenceLength;
    app.calibration.referenceLength = referenceLength;

    document.getElementById('calibration-info').innerHTML = `
        <strong>Kalibrering:</strong><br>
        Referanselengde: ${referenceLength.toFixed(2)} meter<br>
        Linje-lengde: ${pixelLength.toFixed(1)} piksler<br>
        Ratio: ${app.calibration.pixelToMeterRatio.toFixed(2)} piksler/meter<br>
        1 piksel = ${(1 / app.calibration.pixelToMeterRatio).toFixed(4)} meter
    `;

    document.getElementById('confirmCalibration').disabled = false;
}

/**
 * Reset calibration
 */
function resetCalibration() {
    app.calibration.startPoint = null;
    app.calibration.endPoint = null;
    app.calibration.pixelToMeterRatio = null;
    document.getElementById('calibration-info').innerHTML = '';
    document.getElementById('confirmCalibration').disabled = true;

    // Redraw
    app.calibration.ctx.drawImage(app.video, 0, 0);
}

/**
 * Confirm calibration and move to ROI selection
 */
function confirmCalibration() {
    if (!app.calibration.pixelToMeterRatio) return;

    showSection('roi');
    initializeROISelection();
}

/**
 * Initialize ROI selection canvas
 */
function initializeROISelection() {
    app.roi.canvas = document.getElementById('roiCanvas');
    app.roi.ctx = app.roi.canvas.getContext('2d', { willReadFrequently: true });

    // Set canvas size
    app.roi.canvas.width = app.video.videoWidth;
    app.roi.canvas.height = app.video.videoHeight;

    // Draw first frame
    app.video.currentTime = 0;
    app.video.onseeked = function() {
        app.roi.ctx.drawImage(app.video, 0, 0);
    };

    // Setup drawing
    setupROIDrawing();
}

/**
 * Setup ROI drawing (rectangle)
 */
function setupROIDrawing() {
    const canvas = app.roi.canvas;

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);

        app.roi.isDrawing = true;
        app.roi.startPoint = { x, y };
        app.roi.endPoint = { x, y };
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!app.roi.isDrawing) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);

        app.roi.endPoint = { x, y };

        // Redraw
        redrawROI();
    });

    canvas.addEventListener('mouseup', () => {
        if (app.roi.isDrawing) {
            app.roi.isDrawing = false;
            calculateROI();
        }
    });
}

/**
 * Redraw ROI canvas
 */
function redrawROI() {
    const ctx = app.roi.ctx;

    // Clear and redraw
    app.video.currentTime = 0;
    ctx.drawImage(app.video, 0, 0);

    // Draw rectangle
    if (app.roi.startPoint && app.roi.endPoint) {
        const x = Math.min(app.roi.startPoint.x, app.roi.endPoint.x);
        const y = Math.min(app.roi.startPoint.y, app.roi.endPoint.y);
        const width = Math.abs(app.roi.endPoint.x - app.roi.startPoint.x);
        const height = Math.abs(app.roi.endPoint.y - app.roi.startPoint.y);

        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);
    }
}

/**
 * Calculate ROI
 */
function calculateROI() {
    if (!app.roi.startPoint || !app.roi.endPoint) return;

    const x = Math.min(app.roi.startPoint.x, app.roi.endPoint.x);
    const y = Math.min(app.roi.startPoint.y, app.roi.endPoint.y);
    const width = Math.abs(app.roi.endPoint.x - app.roi.startPoint.x);
    const height = Math.abs(app.roi.endPoint.y - app.roi.startPoint.y);

    app.roi.rect = { x, y, width, height };

    document.getElementById('startTracking').disabled = false;
}

/**
 * Reset ROI
 */
function resetROI() {
    app.roi.startPoint = null;
    app.roi.endPoint = null;
    app.roi.rect = null;
    document.getElementById('startTracking').disabled = true;

    // Redraw
    app.roi.ctx.drawImage(app.video, 0, 0);
}

/**
 * Start tracking
 */
async function startTracking() {
    if (!app.roi.rect) return;

    showSection('tracking');

    // Initialize tracking canvas
    const trackingCanvas = document.getElementById('trackingCanvas');
    trackingCanvas.width = app.video.videoWidth;
    trackingCanvas.height = app.video.videoHeight;

    // Create tracker
    app.tracker = new RocketTracker(app.video, trackingCanvas);
    app.tracker.setFPS(app.fps);

    // Setup callbacks
    app.tracker.onProgress = (current, total) => {
        const percent = Math.round((current / total) * 100);
        document.getElementById('progressBar').style.width = percent + '%';
        document.getElementById('progressText').textContent = percent + '%';
    };

    app.tracker.onTrackingUpdate = (frame, total, roi) => {
        document.getElementById('tracking-status').innerHTML = `
            <strong>Tracking:</strong> Frame ${frame} / ${total}<br>
            Posisjon: (${Math.round(roi.x)}, ${Math.round(roi.y)})
        `;
    };

    app.tracker.onTrackingLost = () => {
        console.log('Tracking mistet!');
        const manualEnabled = document.getElementById('enableManualTracking').checked;

        if (manualEnabled) {
            // Show manual tracking hint
            document.getElementById('manual-tracking-hint').style.display = 'block';
            document.getElementById('continueTracking').style.display = 'none';
            document.getElementById('undoManualPoint').style.display = 'none';

            // Update status
            document.getElementById('tracking-status').innerHTML = `
                <strong>⚠️ Tracking mistet!</strong><br>
                Klikk på raketten i bildet for å legge til et manuelt sporingspunkt.
            `;
        } else {
            // Just stop tracking
            document.getElementById('tracking-status').innerHTML = `
                <strong>⚠️ Tracking mistet!</strong><br>
                Aktiver "Aktiver manuell tracking" og prøv igjen for å fortsette manuelt.
            `;
        }
    };

    app.tracker.onComplete = (trackingData) => {
        console.log('Tracking fullført!', trackingData);
        processTrackingData(trackingData);
    };

    // Setup manual tracking click handler
    trackingCanvas.addEventListener('click', handleManualTrackingClick);

    // Initialize and start
    try {
        await app.tracker.initialize(app.roi.rect);
        await app.tracker.startTracking();
    } catch (error) {
        console.error('Tracking error:', error);
        alert('Feil under tracking: ' + error.message);
    }
}

/**
 * Pause tracking
 */
function pauseTracking() {
    if (app.tracker) {
        if (app.tracker.isPaused) {
            app.tracker.resume();
            document.getElementById('pauseTracking').textContent = 'Pause';
        } else {
            app.tracker.pause();
            document.getElementById('pauseTracking').textContent = 'Resume';
        }
    }
}

/**
 * Handle manual tracking click
 */
function handleManualTrackingClick(event) {
    if (!app.tracker || !app.tracker.waitingForManualInput) return;

    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);

    console.log('Manuelt sporingspunkt lagt til:', x, y);

    // Add manual point to tracker
    app.tracker.addManualPoint(x, y);

    // Hide manual tracking hint, show action buttons
    document.getElementById('manual-tracking-hint').style.display = 'none';
    document.getElementById('continueTracking').style.display = 'inline-block';
    document.getElementById('undoManualPoint').style.display = 'inline-block';

    // Update status
    document.getElementById('tracking-status').innerHTML = `
        <strong>✓ Manuelt punkt lagt til</strong><br>
        Trykk "Fortsett tracking" for å gjenoppta, eller "Angre" for å prøve på nytt.
    `;
}

/**
 * Continue tracking after manual point
 */
function continueTracking() {
    if (app.tracker && app.tracker.hasManualPoint) {
        document.getElementById('continueTracking').style.display = 'none';
        document.getElementById('undoManualPoint').style.display = 'none';
        app.tracker.continueAfterManual();
    }
}

/**
 * Undo manual tracking point
 */
function undoManualPoint() {
    if (!app.tracker) return;

    console.log('Angrer manuelt punkt');

    // Clear the manual point
    app.tracker.hasManualPoint = false;
    app.tracker.manualPoint = null;

    // Redraw the tracking canvas without the manual point
    const canvas = document.getElementById('trackingCanvas');
    const ctx = canvas.getContext('2d');
    ctx.drawImage(app.video, 0, 0);

    // Hide buttons, show hint again
    document.getElementById('continueTracking').style.display = 'none';
    document.getElementById('undoManualPoint').style.display = 'none';
    document.getElementById('manual-tracking-hint').style.display = 'block';

    // Update status
    document.getElementById('tracking-status').innerHTML = `
        <strong>↩️ Manuelt punkt angret</strong><br>
        Klikk på raketten i bildet for å legge til et nytt sporingspunkt.
    `;
}

/**
 * Stop tracking
 */
function stopTracking() {
    if (app.tracker) {
        app.tracker.stop();
    }
}

/**
 * Process tracking data and calculate telemetry
 */
function processTrackingData(trackingData) {
    // Create telemetry calculator
    app.telemetry = new TelemetryCalculator(app.calibration.pixelToMeterRatio, app.fps);

    // Add all tracking points
    trackingData.forEach(point => {
        app.telemetry.addTrackingPoint(point.frame, point.x, point.y, point.width, point.height);
    });

    // Calculate derived metrics
    app.telemetry.calculateDerivedMetrics();

    // Get summary
    const summary = app.telemetry.getSummary();
    console.log('Telemetri summary:', summary);

    // Show results
    showSection('results');
    displayResults(summary);
}

/**
 * Display results
 */
function displayResults(summary) {
    // Update statistics
    app.visualizer.updateStatistics(summary);

    // Create charts
    const data = app.telemetry.getData();
    app.visualizer.createCharts(data, summary.events);
}

/**
 * Export to CSV
 */
function exportCSV() {
    if (!app.telemetry) return;

    const csv = app.telemetry.exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'rakett_telemetri.csv';
    a.click();

    URL.revokeObjectURL(url);
}

/**
 * Export video with tracking overlay
 */
function exportVideo() {
    alert('Video-eksport er under utvikling. Denne funksjonen vil la deg eksportere videoen med tracking-overlay.');
    // TODO: Implement video export using MediaRecorder API
}

/**
 * Restart analysis
 */
function restart() {
    // Reset everything
    if (app.tracker) {
        app.tracker.cleanup();
    }

    app.calibration = {
        canvas: null,
        ctx: null,
        startPoint: null,
        endPoint: null,
        isDrawing: false,
        pixelToMeterRatio: null
    };

    app.roi = {
        canvas: null,
        ctx: null,
        startPoint: null,
        endPoint: null,
        isDrawing: false,
        rect: null
    };

    app.tracker = null;
    app.telemetry = null;

    app.visualizer.destroyCharts();

    // Hide all sections except upload
    showSection('upload');

    // Reset video input
    document.getElementById('videoInput').value = '';
    document.getElementById('video-info').innerHTML = '';
}
