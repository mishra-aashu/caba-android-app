// src/services/webrtc/QualityManager.js

class QualityManager {
  constructor(peerConnection) {
    this.pc = peerConnection;
    this.currentProfile = 'auto';
    this.isAdaptive = true;
    this.lastAppliedProfile = null;
    
    // Quality profiles (adaptive based on network)
    this.profiles = {
      ultra: {
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
          bitrate: { max: 2500000, target: 2000000 }
        },
        audio: {
          bitrate: { max: 128000 }
        },
        minBandwidth: 3000 // Kbps
      },
      high: {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          bitrate: { max: 1500000, target: 1200000 }
        },
        audio: {
          bitrate: { max: 96000 }
        },
        minBandwidth: 1500
      },
      medium: {
        video: {
          width: { ideal: 960 },
          height: { ideal: 540 },
          frameRate: { ideal: 24 },
          bitrate: { max: 800000, target: 600000 }
        },
        audio: {
          bitrate: { max: 64000 }
        },
        minBandwidth: 800
      },
      low: {
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          frameRate: { ideal: 20 },
          bitrate: { max: 400000, target: 300000 }
        },
        audio: {
          bitrate: { max: 48000 }
        },
        minBandwidth: 400
      },
      minimal: {
        video: {
          width: { ideal: 480 },
          height: { ideal: 270 },
          frameRate: { ideal: 15 },
          bitrate: { max: 200000, target: 150000 }
        },
        audio: {
          bitrate: { max: 32000 }
        },
        minBandwidth: 200
      }
    };
  }

  /**
   * Get optimal profile based on network quality
   */
  getOptimalProfile(networkStats) {
    const { quality, bandwidth } = networkStats;

    // Manual profile override
    if (!this.isAdaptive && this.currentProfile !== 'auto') {
      return this.profiles[this.currentProfile] || this.profiles.medium;
    }

    // Adaptive selection
    if (quality === 'excellent' && bandwidth >= 3000) {
      return this.profiles.ultra;
    }
    if (quality === 'good' && bandwidth >= 1500) {
      return this.profiles.high;
    }
    if (quality === 'poor' && bandwidth >= 800) {
      return this.profiles.medium;
    }
    if (quality === 'critical' || bandwidth < 400) {
      return this.profiles.minimal;
    }

    return this.profiles.low;
  }

  /**
   * Apply quality profile to peer connection
   */
  async applyProfile(profile, networkStats) {
    if (!this.pc) return;

    const optimalProfile = this.getOptimalProfile(networkStats);
    const newProfileName = Object.keys(this.profiles)
      .find(key => this.profiles[key] === optimalProfile);

    // Don't reapply the same profile
    if (newProfileName === this.lastAppliedProfile) {
      return;
    }

    console.log(`🎨 Switching quality: ${this.lastAppliedProfile || 'initial'} → ${newProfileName}`);

    try {
      const senders = this.pc.getSenders();

      for (const sender of senders) {
        if (!sender.track) continue;

        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }

        if (sender.track.kind === 'video') {
          // Apply video bitrate
          params.encodings[0].maxBitrate = optimalProfile.video.bitrate.max;
          
          // Apply frame rate (if supported)
          if ('maxFramerate' in params.encodings[0]) {
            params.encodings[0].maxFramerate = optimalProfile.video.frameRate.ideal;
          }

          // Enable adaptive layering (simulcast) if supported
          params.encodings[0].scaleResolutionDownBy = this.getScaleFactor(newProfileName);

        } else if (sender.track.kind === 'audio') {
          // Apply audio bitrate
          params.encodings[0].maxBitrate = optimalProfile.audio.bitrate.max;
        }

        await sender.setParameters(params);
      }

      this.lastAppliedProfile = newProfileName;

    } catch (error) {
      console.error('❌ Error applying quality profile:', error);
    }
  }

  /**
   * Get resolution scale factor for simulcast
   */
  getScaleFactor(profileName) {
    const factors = {
      ultra: 1,
      high: 1,
      medium: 1.5,
      low: 2,
      minimal: 3
    };
    return factors[profileName] || 1;
  }

  /**
   * Set manual quality profile
   */
  setProfile(profileName) {
    if (profileName === 'auto') {
      this.isAdaptive = true;
      this.currentProfile = 'auto';
    } else if (this.profiles[profileName]) {
      this.isAdaptive = false;
      this.currentProfile = profileName;
    }
  }

  /**
   * Get initial constraints for getUserMedia
   */
  getInitialConstraints(callType = 'video', preferredQuality = 'high') {
    const profile = this.profiles[preferredQuality] || this.profiles.high;

    return {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: { ideal: 48000 },
        channelCount: { ideal: 1 }
      },
      video: callType === 'video' ? {
        ...profile.video,
        facingMode: 'user',
        aspectRatio: { ideal: 16/9 }
      } : false
    };
  }
}

export default QualityManager;
