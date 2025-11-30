/**
 * Tracker.js - Håndterer object tracking med OpenCV.js
 */

class RocketTracker {
    constructor(video, canvas) {
        this.video = video;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tracker = null;
        this.roi = null;
        this.isTracking = false;
        this.isPaused = false;
        this.currentFrame = 0;
        this.totalFrames = 0;
        this.onProgress = null;
        this.onComplete = null;
        this.onTrackingUpdate = null;
        this.trackingData = [];
        this.fps = 30; // Standard, vil bli oppdatert
    }

    /**
     * Initialiser tracker med ROI (Region of Interest)
     */
    initialize(roi) {
        this.roi = roi;

        // Reset video til start
        this.video.currentTime = 0;

        return new Promise((resolve, reject) => {
            this.video.onseeked = () => {
                try {
                    // Opprett OpenCV tracker (CSRT er best for accuracy)
                    // Note: OpenCV.js kan ha begrenset tracker-støtte
                    // Vi må sjekke hva som er tilgjengelig
                    if (typeof cv !== 'undefined') {
                        // Les første ramme
                        const frame = this.captureFrame();

                        // Opprett tracker - sjekk hvilke trackere som er tilgjengelige
                        if (cv.TrackerCSRT) {
                            this.tracker = cv.TrackerCSRT.create();
                        } else if (cv.legacy && cv.legacy.TrackerCSRT) {
                            this.tracker = cv.legacy.TrackerCSRT.create();
                        } else if (cv.TrackerKCF) {
                            this.tracker = cv.TrackerKCF.create();
                        } else if (cv.legacy && cv.legacy.TrackerKCF) {
                            this.tracker = cv.legacy.TrackerKCF.create();
                        } else {
                            // Fallback: Vi må implementere egen enkel tracker
                            console.warn('OpenCV trackers not available, using template matching');
                            this.tracker = null;
                        }

                        if (this.tracker) {
                            // Initialiser tracker med ROI
                            const rect = new cv.Rect(
                                Math.round(roi.x),
                                Math.round(roi.y),
                                Math.round(roi.width),
                                Math.round(roi.height)
                            );

                            this.tracker.init(frame, rect);
                            frame.delete();
                        } else {
                            // Bruk template matching som fallback
                            this.initializeTemplateMatching(frame, roi);
                            frame.delete();
                        }

                        resolve();
                    } else {
                        reject(new Error('OpenCV.js er ikke lastet'));
                    }
                } catch (error) {
                    reject(error);
                }
            };

            this.video.currentTime = 0;
        });
    }

    /**
     * Fallback: Initialiser template matching
     */
    initializeTemplateMatching(frame, roi) {
        // Lagre template (bildet av raketten)
        const rect = new cv.Rect(
            Math.round(roi.x),
            Math.round(roi.y),
            Math.round(roi.width),
            Math.round(roi.height)
        );

        this.template = frame.roi(rect);
        this.templateSize = { width: roi.width, height: roi.height };
    }

    /**
     * Capture en ramme fra video som OpenCV Mat
     */
    captureFrame() {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.ctx.drawImage(this.video, 0, 0);

        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const mat = cv.matFromImageData(imageData);

        return mat;
    }

    /**
     * Track med OpenCV tracker
     */
    trackWithTracker(frame) {
        const rect = new cv.Rect(0, 0, 0, 0);
        const success = this.tracker.update(frame, rect);

        if (success) {
            return {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
            };
        }

        return null;
    }

    /**
     * Track med template matching (fallback)
     */
    trackWithTemplateMatching(frame) {
        const result = new cv.Mat();
        const mask = new cv.Mat();

        try {
            // Konverter til grayscale for bedre matching
            const frameGray = new cv.Mat();
            const templateGray = new cv.Mat();

            cv.cvtColor(frame, frameGray, cv.COLOR_RGBA2GRAY);
            cv.cvtColor(this.template, templateGray, cv.COLOR_RGBA2GRAY);

            // Template matching
            cv.matchTemplate(frameGray, templateGray, result, cv.TM_CCOEFF_NORMED);

            // Finn beste match
            const minMax = cv.minMaxLoc(result);
            const maxLoc = minMax.maxLoc;

            frameGray.delete();
            templateGray.delete();
            result.delete();
            mask.delete();

            // Hvis match er god nok
            if (minMax.maxVal > 0.5) {
                return {
                    x: maxLoc.x,
                    y: maxLoc.y,
                    width: this.templateSize.width,
                    height: this.templateSize.height
                };
            }

            return null;
        } catch (error) {
            console.error('Template matching error:', error);
            result.delete();
            mask.delete();
            return null;
        }
    }

    /**
     * Start tracking
     */
    async startTracking() {
        this.isTracking = true;
        this.isPaused = false;
        this.currentFrame = 0;
        this.trackingData = [];

        // Beregn totalt antall frames
        this.totalFrames = Math.floor(this.video.duration * this.fps);

        // Start fra begynnelsen
        this.video.currentTime = 0;

        await this.processNextFrame();
    }

    /**
     * Prosesser neste ramme
     */
    async processNextFrame() {
        if (!this.isTracking || this.isPaused) {
            return;
        }

        if (this.video.currentTime >= this.video.duration) {
            // Ferdig med tracking
            this.isTracking = false;
            if (this.onComplete) {
                this.onComplete(this.trackingData);
            }
            return;
        }

        return new Promise((resolve) => {
            this.video.onseeked = () => {
                try {
                    // Capture frame
                    const frame = this.captureFrame();

                    // Track
                    let trackedROI;
                    if (this.tracker) {
                        trackedROI = this.trackWithTracker(frame);
                    } else {
                        trackedROI = this.trackWithTemplateMatching(frame);
                    }

                    if (trackedROI) {
                        // Lagre tracking data
                        this.trackingData.push({
                            frame: this.currentFrame,
                            time: this.video.currentTime,
                            x: trackedROI.x + trackedROI.width / 2, // Senter
                            y: trackedROI.y + trackedROI.height / 2,
                            width: trackedROI.width,
                            height: trackedROI.height,
                            roi: trackedROI
                        });

                        // Tegn tracking box
                        this.drawTrackingBox(trackedROI);

                        // Callback for update
                        if (this.onTrackingUpdate) {
                            this.onTrackingUpdate(this.currentFrame, this.totalFrames, trackedROI);
                        }
                    } else {
                        console.warn('Tracking lost at frame', this.currentFrame);
                    }

                    frame.delete();

                    // Progress callback
                    if (this.onProgress) {
                        this.onProgress(this.currentFrame, this.totalFrames);
                    }

                    this.currentFrame++;

                    // Neste ramme
                    const nextTime = this.currentFrame / this.fps;
                    if (nextTime < this.video.duration) {
                        this.video.currentTime = nextTime;
                        resolve();
                        // Fortsett med neste
                        setTimeout(() => this.processNextFrame(), 0);
                    } else {
                        // Ferdig
                        this.isTracking = false;
                        if (this.onComplete) {
                            this.onComplete(this.trackingData);
                        }
                        resolve();
                    }
                } catch (error) {
                    console.error('Error processing frame:', error);
                    this.isTracking = false;
                    resolve();
                }
            };

            // Seek til neste frame
            const nextTime = this.currentFrame / this.fps;
            this.video.currentTime = nextTime;
        });
    }

    /**
     * Tegn tracking box på canvas
     */
    drawTrackingBox(roi) {
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(roi.x, roi.y, roi.width, roi.height);

        // Tegn senter-punkt
        this.ctx.fillStyle = '#ff0000';
        this.ctx.beginPath();
        this.ctx.arc(
            roi.x + roi.width / 2,
            roi.y + roi.height / 2,
            5,
            0,
            2 * Math.PI
        );
        this.ctx.fill();
    }

    /**
     * Pause tracking
     */
    pause() {
        this.isPaused = true;
    }

    /**
     * Resume tracking
     */
    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            this.processNextFrame();
        }
    }

    /**
     * Stop tracking
     */
    stop() {
        this.isTracking = false;
        this.isPaused = false;
    }

    /**
     * Sett FPS
     */
    setFPS(fps) {
        this.fps = fps;
    }

    /**
     * Cleanup
     */
    cleanup() {
        if (this.tracker) {
            this.tracker.delete();
        }
        if (this.template) {
            this.template.delete();
        }
    }
}
