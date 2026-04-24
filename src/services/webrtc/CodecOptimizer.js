// src/services/webrtc/CodecOptimizer.js

class CodecOptimizer {
  /**
   * Optimize SDP for better codec performance
   */
  static optimizeSDP(sdp) {
    try {
      let optimized = sdp;

      // 1. Prioritize Opus for audio
      optimized = this.prioritizeAudioCodec(optimized, 'opus');

      // 2. Prioritize VP9/VP8 for video (better than H.264 for web)
      optimized = this.prioritizeVideoCodec(optimized, 'VP9');

      // 3. Enable Opus optimizations
      optimized = this.optimizeOpus(optimized);

      // 4. Enable video optimizations
      optimized = this.optimizeVideo(optimized);

      return optimized;

    } catch (error) {
      console.error('❌ SDP optimization failed:', error);
      return sdp; // Return original if optimization fails
    }
  }

  /**
   * Prioritize audio codec
   */
  static prioritizeAudioCodec(sdp, codecName) {
    const lines = sdp.split('\r\n');
    const audioMLineIndex = lines.findIndex(line => line.startsWith('m=audio'));
    
    if (audioMLineIndex === -1) return sdp;

    // Find codec payload type
    const codecPayload = this.findCodecPayload(lines, codecName, audioMLineIndex);
    if (!codecPayload) return sdp;

    // Reorder m=audio line to prioritize codec
    const mLine = lines[audioMLineIndex];
    const parts = mLine.split(' ');
    const payloads = parts.slice(3);
    
    // Move preferred codec to front
    const reordered = [codecPayload, ...payloads.filter(p => p !== codecPayload)];
    parts.splice(3, payloads.length, ...reordered);
    lines[audioMLineIndex] = parts.join(' ');

    return lines.join('\r\n');
  }

  /**
   * Prioritize video codec
   */
  static prioritizeVideoCodec(sdp, codecName) {
    const lines = sdp.split('\r\n');
    const videoMLineIndex = lines.findIndex(line => line.startsWith('m=video'));
    
    if (videoMLineIndex === -1) return sdp;

    const codecPayload = this.findCodecPayload(lines, codecName, videoMLineIndex);
    if (!codecPayload) return sdp;

    const mLine = lines[videoMLineIndex];
    const parts = mLine.split(' ');
    const payloads = parts.slice(3);
    
    const reordered = [codecPayload, ...payloads.filter(p => p !== codecPayload)];
    parts.splice(3, payloads.length, ...reordered);
    lines[videoMLineIndex] = parts.join(' ');

    return lines.join('\r\n');
  }

  /**
   * Find codec payload type number
   */
  static findCodecPayload(lines, codecName, startIndex) {
    const codecLine = lines.find((line, index) => 
      index > startIndex && 
      line.includes(`rtpmap`) && 
      line.toLowerCase().includes(codecName.toLowerCase())
    );

    if (!codecLine) return null;

    const match = codecLine.match(/a=rtpmap:(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Optimize Opus audio codec
   */
  static optimizeOpus(sdp) {
    const lines = sdp.split('\r\n');
    const opusPayload = this.findCodecPayload(lines, 'opus', 0);
    
    if (!opusPayload) return sdp;

    // Find or create fmtp line for Opus
    const fmtpIndex = lines.findIndex(line => 
      line.startsWith(`a=fmtp:${opusPayload}`)
    );

    const opusParams = [
      'maxaveragebitrate=96000', // Reasonable max for voice
      'stereo=0',                // Mono for calls
      'useinbandfec=1',         // Forward error correction
      'usedtx=1',               // Discontinuous transmission
      'maxplaybackrate=48000',  // High quality playback
      'sprop-maxcapturerate=48000'
    ].join(';');

    if (fmtpIndex !== -1) {
      // Update existing fmtp line
      lines[fmtpIndex] = `a=fmtp:${opusPayload} ${opusParams}`;
    } else {
      // Add new fmtp line after rtpmap
      const rtpmapIndex = lines.findIndex(line => 
        line.startsWith(`a=rtpmap:${opusPayload}`)
      );
      if (rtpmapIndex !== -1) {
        lines.splice(rtpmapIndex + 1, 0, `a=fmtp:${opusPayload} ${opusParams}`);
      }
    }

    return lines.join('\r\n');
  }

  /**
   * Optimize video codec parameters
   */
  static optimizeVideo(sdp) {
    // Enable hardware acceleration hints
    let optimized = sdp.replace(
      /(a=rtpmap:\d+ VP\d\/\d+)/g,
      '$1\r\na=rtcp-fb:* goog-remb\r\na=rtcp-fb:* transport-cc'
    );

    return optimized;
  }

  /**
   * Enable simulcast (multiple quality layers)
   */
  static enableSimulcast(sdp) {
    // This is complex and browser-specific
    // For production, use a library like `sdp-transform`
    // Here's a simplified version:
    
    const lines = sdp.split('\r\n');
    const videoMLineIndex = lines.findIndex(line => line.startsWith('m=video'));
    
    if (videoMLineIndex === -1) return sdp;

    // Add simulcast attribute (Chrome/Firefox format)
    const simulcastLine = 'a=simulcast:send 0;1;2';
    const ridLines = [
      'a=rid:0 send',
      'a=rid:1 send',
      'a=rid:2 send'
    ];

    lines.splice(videoMLineIndex + 1, 0, simulcastLine, ...ridLines);

    return lines.join('\r\n');
  }
}

export default CodecOptimizer;
