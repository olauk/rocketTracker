/**
 * Telemetry.js - Beregner telemetri-data fra tracking-posisisjoner
 */

class TelemetryCalculator {
    constructor(pixelToMeterRatio, fps) {
        this.pixelToMeterRatio = pixelToMeterRatio; // piksler per meter
        this.fps = fps; // frames per sekund
        this.data = [];
        this.launchPoint = null;
    }

    /**
     * Konverterer piksel-koordinater til meter
     */
    pixelsToMeters(pixels) {
        return pixels / this.pixelToMeterRatio;
    }

    /**
     * Setter oppskytningspunktet (reference)
     */
    setLaunchPoint(x, y) {
        this.launchPoint = { x, y };
    }

    /**
     * Legger til tracking-data for en ramme
     */
    addTrackingPoint(frameNumber, x, y, width, height) {
        if (!this.launchPoint) {
            this.launchPoint = { x, y }; // Første punkt er oppskytningspunkt
        }

        const time = frameNumber / this.fps;

        // Beregn posisjon i meter relativt til oppskytningspunkt
        const horizontalPos = this.pixelsToMeters(x - this.launchPoint.x);

        // Y-aksen er invertert i canvas (0 er topp), så vi snur den
        const altitude = this.pixelsToMeters(this.launchPoint.y - y);

        const dataPoint = {
            frame: frameNumber,
            time: time,
            pixelX: x,
            pixelY: y,
            horizontalPos: horizontalPos,
            altitude: altitude,
            width: width,
            height: height
        };

        this.data.push(dataPoint);
    }

    /**
     * Beregner hastighet og akselerasjon
     */
    calculateDerivedMetrics() {
        for (let i = 0; i < this.data.length; i++) {
            const point = this.data[i];

            if (i === 0) {
                // Første punkt
                point.verticalVelocity = 0;
                point.horizontalVelocity = 0;
                point.totalVelocity = 0;
                point.verticalAcceleration = 0;
                point.horizontalAcceleration = 0;
                point.totalAcceleration = 0;
                point.angle = 90; // Vertikal
            } else {
                const prevPoint = this.data[i - 1];
                const dt = point.time - prevPoint.time;

                if (dt > 0) {
                    // Beregn hastighet (m/s)
                    point.verticalVelocity = (point.altitude - prevPoint.altitude) / dt;
                    point.horizontalVelocity = (point.horizontalPos - prevPoint.horizontalPos) / dt;
                    point.totalVelocity = Math.sqrt(
                        Math.pow(point.verticalVelocity, 2) +
                        Math.pow(point.horizontalVelocity, 2)
                    );

                    // Beregn akselerasjon (m/s²)
                    if (i > 1 && prevPoint.verticalVelocity !== undefined) {
                        point.verticalAcceleration = (point.verticalVelocity - prevPoint.verticalVelocity) / dt;
                        point.horizontalAcceleration = (point.horizontalVelocity - prevPoint.horizontalVelocity) / dt;
                        point.totalAcceleration = Math.sqrt(
                            Math.pow(point.verticalAcceleration, 2) +
                            Math.pow(point.horizontalAcceleration, 2)
                        );
                    } else {
                        point.verticalAcceleration = 0;
                        point.horizontalAcceleration = 0;
                        point.totalAcceleration = 0;
                    }

                    // Beregn vinkel fra vertikal (grader)
                    point.angle = Math.atan2(point.horizontalVelocity, point.verticalVelocity) * (180 / Math.PI);
                } else {
                    // Hvis dt er 0, kopier forrige verdier
                    point.verticalVelocity = prevPoint.verticalVelocity || 0;
                    point.horizontalVelocity = prevPoint.horizontalVelocity || 0;
                    point.totalVelocity = prevPoint.totalVelocity || 0;
                    point.verticalAcceleration = prevPoint.verticalAcceleration || 0;
                    point.horizontalAcceleration = prevPoint.horizontalAcceleration || 0;
                    point.totalAcceleration = prevPoint.totalAcceleration || 0;
                    point.angle = prevPoint.angle || 90;
                }
            }
        }

        // Smoothing av data (moving average for å redusere støy)
        this.smoothData();
    }

    /**
     * Beregn ballistisk bane for launch-only modus
     * Brukes når videoen bare viser oppskytningen
     * @param {number} diameter - Rakettens diameter i meter (default 0.05m = 5cm)
     * @param {number} mass - Rakettens masse i kg (default 0.3kg = 300g)
     */
    calculateBallisticTrajectory(diameter = 0.05, mass = 0.3) {
        if (this.data.length === 0) {
            console.error('Ingen data å beregne ballistisk bane fra');
            return;
        }

        // Hent siste datapunkt (slutten av videoen)
        const lastPoint = this.data[this.data.length - 1];
        console.log('Beregner ballistisk bane fra siste punkt:', lastPoint);

        // Konstanter
        const g = 9.81; // Tyngdeakselerasjon (m/s²)
        const rho = 1.225; // Lufttetthet ved havnivå (kg/m³)
        const Cd = 0.4; // Luftmotstandskoeffisient for rakett (typisk 0.3-0.5)
        const A = Math.PI * Math.pow(diameter / 2, 2); // Tverrsnittareal fra brukerens diameter

        console.log(`Rakettparametere for beregning:
            - Diameter: ${(diameter * 100).toFixed(1)} cm
            - Masse: ${(mass * 1000).toFixed(0)} g
            - Tverrsnittareal: ${(A * 10000).toFixed(2)} cm²
        `);

        // Start fra siste kjente punkt
        let currentAltitude = lastPoint.altitude;
        let currentVelocity = lastPoint.verticalVelocity || 0;
        let currentTime = lastPoint.time;
        let currentFrame = lastPoint.frame;

        // Hvis raketten allerede er på vei ned, ikke beregn mer
        if (currentVelocity <= 0) {
            console.log('Raketten er allerede på vei ned, ingen ballistisk beregning nødvendig');
            return;
        }

        console.log(`Start ballistisk beregning:
            - Høyde: ${currentAltitude.toFixed(2)} m
            - Hastighet: ${currentVelocity.toFixed(2)} m/s
            - Tid: ${currentTime.toFixed(2)} s
        `);

        // Timestep for numerisk integrasjon
        const dt = 1 / this.fps; // Samme som video framerate for konsistens

        // Beregn ballistisk bane til apogeum
        const ballisticPoints = [];
        let steps = 0;
        const maxSteps = 1000; // Sikkerhet mot uendelig løkke

        while (currentVelocity > 0 && steps < maxSteps) {
            steps++;
            currentTime += dt;
            currentFrame++;

            // Beregn luftmotstand
            const dragForce = 0.5 * rho * Math.pow(currentVelocity, 2) * Cd * A;
            const dragAcceleration = dragForce / mass;

            // Total akselerasjon (tyngdekraft + luftmotstand)
            const acceleration = -g - dragAcceleration;

            // Oppdater hastighet og posisjon (Euler's method)
            currentVelocity += acceleration * dt;
            currentAltitude += currentVelocity * dt;

            // Lagre datapunkt
            const predictedPoint = {
                frame: currentFrame,
                time: currentTime,
                pixelX: lastPoint.pixelX, // Antar vertikal bevegelse
                pixelY: lastPoint.pixelY,
                horizontalPos: lastPoint.horizontalPos,
                altitude: currentAltitude,
                verticalVelocity: currentVelocity,
                horizontalVelocity: 0, // Antar ingen horisontal bevegelse
                totalVelocity: Math.abs(currentVelocity),
                verticalAcceleration: acceleration,
                horizontalAcceleration: 0,
                totalAcceleration: Math.abs(acceleration),
                angle: 0, // Vertikal
                predicted: true // Marker som predikert data
            };

            ballisticPoints.push(predictedPoint);
        }

        // Legg til predikerte punkter til data
        this.data = this.data.concat(ballisticPoints);

        const predictedApogee = Math.max(...ballisticPoints.map(p => p.altitude));
        console.log(`Ballistisk beregning fullført:
            - Antall predikerte punkter: ${ballisticPoints.length}
            - Predikert apogeum: ${predictedApogee.toFixed(2)} m
            - Tid til apogeum: ${(currentTime - lastPoint.time).toFixed(2)} s ekstra
        `);

        // Enkel beregning uten luftmotstand (for sammenligning)
        const simpleApogee = currentAltitude + Math.pow(lastPoint.verticalVelocity, 2) / (2 * g);
        console.log(`Sammenligning: Apogeum uten luftmotstand = ${simpleApogee.toFixed(2)} m`);
    }

    /**
     * Smooth data med moving average
     */
    smoothData(windowSize = 3) {
        if (this.data.length < windowSize) return;

        const smoothedData = [];
        const halfWindow = Math.floor(windowSize / 2);

        for (let i = 0; i < this.data.length; i++) {
            const point = { ...this.data[i] };

            // Beregn average for vinduet
            const start = Math.max(0, i - halfWindow);
            const end = Math.min(this.data.length - 1, i + halfWindow);
            const window = this.data.slice(start, end + 1);

            if (window.length > 0) {
                point.verticalVelocity = this.average(window.map(p => p.verticalVelocity || 0));
                point.horizontalVelocity = this.average(window.map(p => p.horizontalVelocity || 0));
                point.totalVelocity = Math.sqrt(
                    Math.pow(point.verticalVelocity, 2) +
                    Math.pow(point.horizontalVelocity, 2)
                );

                point.verticalAcceleration = this.average(window.map(p => p.verticalAcceleration || 0));
                point.horizontalAcceleration = this.average(window.map(p => p.horizontalAcceleration || 0));
                point.totalAcceleration = Math.sqrt(
                    Math.pow(point.verticalAcceleration, 2) +
                    Math.pow(point.horizontalAcceleration, 2)
                );
            }

            smoothedData.push(point);
        }

        this.data = smoothedData;
    }

    /**
     * Hjelpefunksjon for gjennomsnitt
     */
    average(arr) {
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    /**
     * Finn nøkkel-hendelser i flyvningen
     */
    findKeyEvents() {
        if (this.data.length === 0) return null;

        // Finn maksimal høyde (apogee)
        let maxAltitude = -Infinity;
        let apogeeIndex = 0;

        for (let i = 0; i < this.data.length; i++) {
            if (this.data[i].altitude > maxAltitude) {
                maxAltitude = this.data[i].altitude;
                apogeeIndex = i;
            }
        }

        // Finn maksimal hastighet
        let maxVelocity = -Infinity;
        let maxVelocityIndex = 0;

        for (let i = 0; i < this.data.length; i++) {
            if (this.data[i].totalVelocity > maxVelocity) {
                maxVelocity = this.data[i].totalVelocity;
                maxVelocityIndex = i;
            }
        }

        // Finn maksimal akselerasjon
        let maxAcceleration = -Infinity;
        let maxAccelerationIndex = 0;

        for (let i = 0; i < this.data.length; i++) {
            if (this.data[i].totalAcceleration > maxAcceleration) {
                maxAcceleration = this.data[i].totalAcceleration;
                maxAccelerationIndex = i;
            }
        }

        // Estimat for motor burnout (når akselerasjonen går kraftig ned)
        let burnoutIndex = 0;
        for (let i = 1; i < Math.min(this.data.length, apogeeIndex); i++) {
            if (this.data[i].totalAcceleration < this.data[i-1].totalAcceleration * 0.5) {
                burnoutIndex = i;
                break;
            }
        }

        return {
            apogee: {
                index: apogeeIndex,
                time: this.data[apogeeIndex].time,
                altitude: maxAltitude
            },
            maxVelocity: {
                index: maxVelocityIndex,
                time: this.data[maxVelocityIndex].time,
                velocity: maxVelocity
            },
            maxAcceleration: {
                index: maxAccelerationIndex,
                time: this.data[maxAccelerationIndex].time,
                acceleration: maxAcceleration
            },
            burnout: burnoutIndex > 0 ? {
                index: burnoutIndex,
                time: this.data[burnoutIndex].time,
                altitude: this.data[burnoutIndex].altitude
            } : null
        };
    }

    /**
     * Eksporter data til CSV
     */
    exportToCSV() {
        const headers = [
            'Frame',
            'Tid (s)',
            'Høyde (m)',
            'Horisontal posisjon (m)',
            'Vertikal hastighet (m/s)',
            'Horisontal hastighet (m/s)',
            'Total hastighet (m/s)',
            'Vertikal akselerasjon (m/s²)',
            'Horisontal akselerasjon (m/s²)',
            'Total akselerasjon (m/s²)',
            'Vinkel fra vertikal (°)',
            'Type'
        ];

        let csv = headers.join(',') + '\n';

        this.data.forEach(point => {
            const row = [
                point.frame,
                point.time.toFixed(3),
                point.altitude.toFixed(3),
                point.horizontalPos.toFixed(3),
                (point.verticalVelocity || 0).toFixed(3),
                (point.horizontalVelocity || 0).toFixed(3),
                (point.totalVelocity || 0).toFixed(3),
                (point.verticalAcceleration || 0).toFixed(3),
                (point.horizontalAcceleration || 0).toFixed(3),
                (point.totalAcceleration || 0).toFixed(3),
                (point.angle || 0).toFixed(2),
                point.predicted ? 'Predikert' : 'Sporet'
            ];
            csv += row.join(',') + '\n';
        });

        return csv;
    }

    /**
     * Få summary statistikk
     */
    getSummary() {
        const events = this.findKeyEvents();

        return {
            totalFrames: this.data.length,
            duration: this.data.length > 0 ? this.data[this.data.length - 1].time : 0,
            maxAltitude: events.apogee.altitude,
            maxVelocity: events.maxVelocity.velocity,
            maxAcceleration: events.maxAcceleration.acceleration,
            timeToApogee: events.apogee.time,
            events: events
        };
    }

    /**
     * Hent alle data
     */
    getData() {
        return this.data;
    }

    /**
     * Reset data
     */
    reset() {
        this.data = [];
        this.launchPoint = null;
    }
}
