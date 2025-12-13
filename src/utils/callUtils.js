/**
 * Format call duration to readable string
 */
export function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '00:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get call status text
 */
export function getCallStatusText(status) {
  const statusMap = {
    initiated: 'Calling...',
    ringing: 'Ringing...',
    answered: 'Connected',
    ended: 'Call Ended',
    missed: 'Missed Call',
    rejected: 'Call Declined',
    failed: 'Call Failed',
    busy: 'Line Busy'
  };
  return statusMap[status] || status;
}

/**
 * Check if browser supports WebRTC
 */
export function checkWebRTCSupport() {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    window.RTCPeerConnection
  );
}

/**
 * Request media permissions
 */
export async function requestMediaPermissions(video = true, audio = true) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: video,
      audio: audio
    });
    // Stop tracks immediately - we just wanted to check permissions
    stream.getTracks().forEach(track => track.stop());
    return { video: true, audio: true };
  } catch (error) {
    console.error('Permission error:', error);
    return { video: false, audio: false, error };
  }
}