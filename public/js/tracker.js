/**
 * Tracker.js - Håndterer object tracking med OpenCV.js
 */

class RocketTracker {
    constructor(video, canvas) {
        this.video = video;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
        this.tracker = null;
        this.roi = null;
        this.isTracking = false;
        this.isPaused = false;
        this.currentFrame = 0;
        this.totalFrames = 0;
        this.onProgress = null;
        this.onComplete = null;
        this.onTrackingUpdate = null;
        this.onTrackingLost = null;
        this.trackingData = [];
        this.fps = 30; // Standard, vil bli oppdatert
        this.waitingForManualInput = false;
        this.hasManualPoint = false;
        this.manualPoint = null;
        this.consecutiveFailures = 0;
        this.maxConsecutiveFailures = 5; // Antall feil før vi stopper
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
        // Check pause/stop state immediately
        if (!this.isTracking) {
            return;
        }

        if (this.isPaused) {
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
                        // Reset failure counter
                        this.consecutiveFailures = 0;

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
                        this.consecutiveFailures++;

                        // Hvis for mange feil, stopp og be om manuell input
                        if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
                            this.isPaused = true;
                            this.waitingForManualInput = true;

                            if (this.onTrackingLost) {
                                this.onTrackingLost();
                            }

                            // Stopp videre prosessering til bruker gir manuelt punkt
                            resolve();
                            return;
                        }
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
                        // Sjekk status før vi fortsetter
                        if (this.isTracking && !this.isPaused) {
                            setTimeout(() => this.processNextFrame(), 0);
                        }
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
        console.log('Tracker.pause() called, setting isPaused to true');
        this.isPaused = true;
        console.log('Tracker.pause() completed, isPaused:', this.isPaused);
    }

    /**
     * Resume tracking
     */
    resume() {
        console.log('Tracker.resume() called, isPaused:', this.isPaused);
        if (this.isPaused) {
            this.isPaused = false;
            console.log('Tracker.resume() setting isPaused to false, resuming tracking');
            this.processNextFrame();
        } else {
            console.log('Tracker.resume() called but was not paused');
        }
    }

    /**
     * Stop tracking
     */
    stop() {
        this.isTracking = false;
        this.isPaused = false;

        // Process data collected so far
        if (this.trackingData.length > 0 && this.onComplete) {
            console.log('Stopping tracking and processing', this.trackingData.length, 'frames');
            this.onComplete(this.trackingData);
        }
    }

    /**
     * Sett FPS
     */
    setFPS(fps) {
        this.fps = fps;
    }

    /**
     * Gå til forrige frame (kun når pauset)
     */
    async previousFrame() {
        console.log('previousFrame called, isPaused:', this.isPaused, 'currentFrame:', this.currentFrame);

        if (!this.isPaused) {
            console.warn('Cannot navigate: tracking not paused');
            return;
        }

        if (this.currentFrame > 0) {
            this.currentFrame--;
            console.log('Going to previous frame:', this.currentFrame);
            await this.seekToCurrentFrame();
        } else {
            console.log('Already at first frame');
        }
    }

    /**
     * Gå til neste frame (kun når pauset)
     */
    async nextFrame() {
        console.log('nextFrame called, isPaused:', this.isPaused, 'currentFrame:', this.currentFrame);

        if (!this.isPaused) {
            console.warn('Cannot navigate: tracking not paused');
            return;
        }

        if (this.currentFrame < this.totalFrames - 1) {
            this.currentFrame++;
            console.log('Going to next frame:', this.currentFrame);
            await this.seekToCurrentFrame();
        } else {
            console.log('Already at last frame');
        }
    }

    /**
     * Seek til current frame og vis den
     */
    async seekToCurrentFrame() {
        const targetTime = this.currentFrame / this.fps;
        console.log('seekToCurrentFrame: Seeking to time:', targetTime, 'frame:', this.currentFrame, 'current video time:', this.video.currentTime);

        // Helper function to draw the frame
        const drawFrame = () => {
            console.log('drawFrame: Drawing frame at canvas size', this.canvas.width, 'x', this.canvas.height);

            // Ensure canvas has correct dimensions
            if (this.canvas.width === 0 || this.canvas.height === 0) {
                console.log('drawFrame: Setting canvas dimensions from video:', this.video.videoWidth, 'x', this.video.videoHeight);
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
            }

            // Tegn video frame direkte
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

            // Tegn eksisterende tracking punkt hvis det finnes
            const existingPoint = this.trackingData.find(p => p.frame === this.currentFrame);
            if (existingPoint && existingPoint.roi) {
                console.log('drawFrame: Drawing tracking box at', existingPoint.roi);
                this.drawTrackingBox(existingPoint.roi);
            } else {
                console.log('drawFrame: No tracking point for frame', this.currentFrame);
            }
        };

        return new Promise((resolve, reject) => {
            // Add timeout to prevent hanging
            const timeout = setTimeout(() => {
                console.error('seekToCurrentFrame: Timeout waiting for onseeked event');
                this.video.onseeked = null; // Clean up
                // Try to draw anyway
                drawFrame();
                resolve();
            }, 2000);

            // Check if we're already at the target time (within tolerance)
            const timeDiff = Math.abs(this.video.currentTime - targetTime);
            console.log('seekToCurrentFrame: Time difference:', timeDiff);

            if (timeDiff < 0.001) {
                console.log('seekToCurrentFrame: Already at target time, drawing immediately');
                clearTimeout(timeout);
                drawFrame();
                resolve();
                return;
            }

            // Set up onseeked handler
            this.video.onseeked = () => {
                console.log('seekToCurrentFrame: onseeked event fired');
                clearTimeout(timeout);
                this.video.onseeked = null; // Clean up
                drawFrame();
                resolve();
            };

            // Seek to target time
            console.log('seekToCurrentFrame: Setting video.currentTime to', targetTime);
            this.video.currentTime = targetTime;
        });
    }

    /**
     * Legg til eller oppdater tracking punkt på current frame
     */
    addPointAtCurrentFrame(x, y) {
        if (!this.isPaused) return;

        // Bruk samme størrelse som siste kjente ROI
        const lastData = this.trackingData[this.trackingData.length - 1];
        const width = lastData ? lastData.width : this.roi.width;
        const height = lastData ? lastData.height : this.roi.height;

        const newPoint = {
            frame: this.currentFrame,
            time: this.video.currentTime,
            x: x,
            y: y,
            width: width,
            height: height,
            roi: {
                x: x - width / 2,
                y: y - height / 2,
                width: width,
                height: height
            },
            manual: true
        };

        // Sjekk om punkt allerede eksisterer for denne frame
        const existingIndex = this.trackingData.findIndex(p => p.frame === this.currentFrame);
        if (existingIndex >= 0) {
            // Oppdater eksisterende punkt
            this.trackingData[existingIndex] = newPoint;
        } else {
            // Legg til nytt punkt på riktig posisjon (sortert etter frame)
            let insertIndex = this.trackingData.findIndex(p => p.frame > this.currentFrame);
            if (insertIndex === -1) {
                this.trackingData.push(newPoint);
            } else {
                this.trackingData.splice(insertIndex, 0, newPoint);
            }
        }

        // Tegn punktet
        this.drawTrackingBox(newPoint.roi);

        return newPoint;
    }

    /**
     * Slett tracking punkt på current frame
     */
    deletePointAtCurrentFrame() {
        if (!this.isPaused) return false;

        const index = this.trackingData.findIndex(p => p.frame === this.currentFrame);
        if (index >= 0) {
            this.trackingData.splice(index, 1);

            // Redraw frame uten punktet
            this.ctx.drawImage(this.video, 0, 0);

            return true;
        }

        return false;
    }

    /**
     * Legg til manuelt sporingspunkt
     */
    addManualPoint(x, y) {
        // Bruk samme størrelse som siste kjente ROI
        const lastData = this.trackingData[this.trackingData.length - 1];
        const width = lastData ? lastData.width : this.roi.width;
        const height = lastData ? lastData.height : this.roi.height;

        this.manualPoint = {
            x: x - width / 2,
            y: y - height / 2,
            width: width,
            height: height
        };

        this.hasManualPoint = true;
        console.log('Manuelt punkt satt:', this.manualPoint);

        // Tegn det manuelle punktet
        this.drawTrackingBox(this.manualPoint);
    }

    /**
     * Fortsett tracking etter manuelt punkt
     */
    async continueAfterManual() {
        if (!this.hasManualPoint || !this.manualPoint) {
            console.error('Ingen manuelt punkt å fortsette fra');
            return;
        }

        try {
            // Lagre det manuelle punktet som tracking data
            this.trackingData.push({
                frame: this.currentFrame,
                time: this.video.currentTime,
                x: this.manualPoint.x + this.manualPoint.width / 2,
                y: this.manualPoint.y + this.manualPoint.height / 2,
                width: this.manualPoint.width,
                height: this.manualPoint.height,
                roi: this.manualPoint,
                manual: true // Marker som manuelt punkt
            });

            // Re-initialiser tracker med nytt ROI
            const frame = this.captureFrame();

            if (this.tracker) {
                // Slett gammel tracker
                this.tracker.delete();

                // Opprett ny tracker
                if (cv.TrackerCSRT) {
                    this.tracker = cv.TrackerCSRT.create();
                } else if (cv.legacy && cv.legacy.TrackerCSRT) {
                    this.tracker = cv.legacy.TrackerCSRT.create();
                } else if (cv.TrackerKCF) {
                    this.tracker = cv.TrackerKCF.create();
                } else if (cv.legacy && cv.legacy.TrackerKCF) {
                    this.tracker = cv.legacy.TrackerKCF.create();
                }

                if (this.tracker) {
                    const rect = new cv.Rect(
                        Math.round(this.manualPoint.x),
                        Math.round(this.manualPoint.y),
                        Math.round(this.manualPoint.width),
                        Math.round(this.manualPoint.height)
                    );
                    this.tracker.init(frame, rect);
                }
            } else {
                // Oppdater template for template matching
                const rect = new cv.Rect(
                    Math.round(this.manualPoint.x),
                    Math.round(this.manualPoint.y),
                    Math.round(this.manualPoint.width),
                    Math.round(this.manualPoint.height)
                );

                if (this.template) {
                    this.template.delete();
                }

                this.template = frame.roi(rect);
                this.templateSize = { width: this.manualPoint.width, height: this.manualPoint.height };
            }

            frame.delete();

            // Reset states
            this.waitingForManualInput = false;
            this.hasManualPoint = false;
            this.manualPoint = null;
            this.consecutiveFailures = 0;
            this.isPaused = false;

            // Fortsett til neste frame
            this.currentFrame++;

            // Fortsett tracking
            await this.processNextFrame();
        } catch (error) {
            console.error('Feil ved fortsettelse av tracking:', error);
        }
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
