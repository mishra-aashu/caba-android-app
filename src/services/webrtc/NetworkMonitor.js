// src/services/webrtc/NetworkMonitor.js

class NetworkMonitor {
  constructor(peerConnection) {
    this.pc = peerConnection;
    this.stats = {
      bandwidth: 0,
      packetLoss: 0,
      jitter: 0,
      rtt: 0,
      quality: 'excellent' // excellent, good, poor, critical
    };
    this.monitoring = false;
    this.callbacks = [];
    this.previousStats = {};
    this.previousBytesSent = 0;
  }

  /**
   * Start monitoring connection quality
   */
  startMonitoring(intervalMs = 2000) {
    if (this.monitoring) return;
    
    this.monitoring = true;
    this.monitorInterval = setInterval(() => {
      this.collectStats();
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.monitoring = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
  }

  /**
   * Collect WebRTC statistics
   */
  async collectStats() {
    if (!this.pc) return;

    try {
      const stats = await this.pc.getStats();
      let inboundRtp = null;
      let outboundRtp = null;
      let candidatePair = null;

      stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
          inboundRtp = report;
        }
        if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
          outboundRtp = report;
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          candidatePair = report;
        }
      });

      // Calculate metrics
      const newStats = {
        bandwidth: this.calculateBandwidth(outboundRtp),
        packetLoss: this.calculatePacketLoss(inboundRtp),
        jitter: inboundRtp?.jitter || 0,
        rtt: candidatePair?.currentRoundTripTime ? 
             candidatePair.currentRoundTripTime * 1000 : 0,
        timestamp: Date.now()
      };

      // Determine quality level
      newStats.quality = this.determineQuality(newStats);

      // Store previous stats for delta calculations
      this.previousStats = this.stats;
      this.stats = newStats;

      // Notify listeners
      this.notifyListeners(newStats);

    } catch (error) {
      console.error('❌ Error collecting stats:', error);
    }
  }

  /**
   * Calculate available bandwidth (Kbps)
   */
  calculateBandwidth(report) {
    if (!report || !this.previousStats.timestamp) return 0;

    const bytesSent = report.bytesSent || 0;
    const previousBytes = this.previousBytesSent || 0;
    const timeDiff = (Date.now() - this.previousStats.timestamp) / 1000;

    this.previousBytesSent = bytesSent;

    if (timeDiff === 0) return 0;

    const bytesPerSecond = (bytesSent - previousBytes) / timeDiff;
    return Math.round((bytesPerSecond * 8) / 1024); // Convert to Kbps
  }

  /**
   * Calculate packet loss percentage
   */
  calculatePacketLoss(report) {
    if (!report) return 0;

    const packetsLost = report.packetsLost || 0;
    const packetsReceived = report.packetsReceived || 0;
    const totalPackets = packetsLost + packetsReceived;

    if (totalPackets === 0) return 0;

    return Math.round((packetsLost / totalPackets) * 100 * 100) / 100; // 2 decimals
  }

  /**
   * Determine connection quality based on metrics
   */
  determineQuality(stats) {
    const { packetLoss, rtt, jitter } = stats;

    // Critical: Connection is barely usable
    if (packetLoss > 10 || rtt > 500 || jitter > 100) {
      return 'critical';
    }

    // Poor: Noticeable degradation
    if (packetLoss > 5 || rtt > 300 || jitter > 50) {
      return 'poor';
    }

    // Good: Minor issues
    if (packetLoss > 2 || rtt > 150 || jitter > 30) {
      return 'good';
    }

    // Excellent: Optimal conditions
    return 'excellent';
  }

  /**
   * Subscribe to quality changes
   */
  onQualityChange(callback) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all listeners
   */
  notifyListeners(stats) {
    this.callbacks.forEach(callback => {
      try {
        callback(stats);
      } catch (error) {
        console.error('❌ Error in quality callback:', error);
      }
    });
  }

  /**
   * Get current stats
   */
  getCurrentStats() {
    return { ...this.stats };
  }
}

export default NetworkMonitor;
