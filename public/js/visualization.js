/**
 * Visualization.js - Håndterer visualisering av telemetri-data med Chart.js
 */

class TelemetryVisualizer {
    constructor() {
        this.charts = {};
    }

    /**
     * Opprett alle grafer
     */
    createCharts(telemetryData, keyEvents) {
        this.destroyCharts(); // Cleanup eksisterende

        // Altitude chart
        this.charts.altitude = this.createAltitudeChart(telemetryData, keyEvents);

        // Velocity chart
        this.charts.velocity = this.createVelocityChart(telemetryData, keyEvents);

        // Acceleration chart
        this.charts.acceleration = this.createAccelerationChart(telemetryData, keyEvents);

        // Trajectory chart (2D path)
        this.charts.trajectory = this.createTrajectoryChart(telemetryData);
    }

    /**
     * Høyde over tid
     */
    createAltitudeChart(data, events) {
        const ctx = document.getElementById('altitudeChart').getContext('2d');

        const annotations = {};

        // Marker apogee
        if (events && events.apogee) {
            annotations.apogee = {
                type: 'point',
                xValue: events.apogee.time,
                yValue: events.apogee.altitude,
                backgroundColor: 'rgba(255, 99, 132, 0.8)',
                radius: 6,
                borderWidth: 2,
                borderColor: 'rgb(255, 99, 132)',
            };
        }

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.time.toFixed(2)),
                datasets: [{
                    label: 'Høyde (m)',
                    data: data.map(d => d.altitude),
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true
                    },
                    annotation: {
                        annotations: annotations
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Tid (s)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Høyde (m)'
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    /**
     * Hastighet over tid
     */
    createVelocityChart(data, events) {
        const ctx = document.getElementById('velocityChart').getContext('2d');

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.time.toFixed(2)),
                datasets: [
                    {
                        label: 'Vertikal hastighet (m/s)',
                        data: data.map(d => d.verticalVelocity || 0),
                        borderColor: 'rgb(34, 197, 94)',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: 'Horisontal hastighet (m/s)',
                        data: data.map(d => d.horizontalVelocity || 0),
                        borderColor: 'rgb(249, 115, 22)',
                        backgroundColor: 'rgba(249, 115, 22, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: 'Total hastighet (m/s)',
                        data: data.map(d => d.totalVelocity || 0),
                        borderColor: 'rgb(168, 85, 247)',
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Tid (s)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Hastighet (m/s)'
                        }
                    }
                }
            }
        });
    }

    /**
     * Akselerasjon over tid
     */
    createAccelerationChart(data, events) {
        const ctx = document.getElementById('accelerationChart').getContext('2d');

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.time.toFixed(2)),
                datasets: [
                    {
                        label: 'Vertikal akselerasjon (m/s²)',
                        data: data.map(d => d.verticalAcceleration || 0),
                        borderColor: 'rgb(239, 68, 68)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: 'Total akselerasjon (m/s²)',
                        data: data.map(d => d.totalAcceleration || 0),
                        borderColor: 'rgb(99, 102, 241)',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Tid (s)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Akselerasjon (m/s²)'
                        }
                    }
                }
            }
        });
    }

    /**
     * Banekurve (2D posisjon)
     */
    createTrajectoryChart(data) {
        const ctx = document.getElementById('trajectoryChart').getContext('2d');

        return new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Rakett-bane',
                    data: data.map(d => ({
                        x: d.horizontalPos,
                        y: d.altitude
                    })),
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    showLine: true,
                    borderWidth: 2,
                    pointRadius: 2,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Horisontal posisjon (m)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Høyde (m)'
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    /**
     * Oppdater statistikk-kort
     */
    updateStatistics(summary) {
        document.getElementById('maxAltitude').textContent = summary.maxAltitude.toFixed(2);
        document.getElementById('maxVelocity').textContent = summary.maxVelocity.toFixed(2);
        document.getElementById('maxAcceleration').textContent = summary.maxAcceleration.toFixed(2);
        document.getElementById('timeToApogee').textContent = summary.timeToApogee.toFixed(2);
    }

    /**
     * Destroy alle charts
     */
    destroyCharts() {
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key]) {
                this.charts[key].destroy();
            }
        });
        this.charts = {};
    }
}
