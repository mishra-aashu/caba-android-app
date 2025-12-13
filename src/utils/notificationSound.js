class NotificationSound {
  static play(soundName = 'default') {
    try {
      // Map sound names to files
      const soundMap = {
        default: '/assets/audio/nice_ring_tones.mp3',
        message: '/assets/audio/nice_ring_tones.mp3',
        call: '/assets/audio/professional.mp3',
        reminder: '/assets/audio/Sakura-Girl-Wake-Up-chosic.com_.mp3'
      };

      const soundFile = soundMap[soundName] || soundMap.default;
      const audio = new Audio(soundFile);

      // Set volume to reasonable level
      audio.volume = 0.5;

      // Play the sound
      const playPromise = audio.play();

      // Handle promise rejection (browsers require user interaction first)
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log('Audio play failed:', error);
          // Silently fail - this is common when no user interaction has occurred
        });
      }

      return true;
    } catch (error) {
      console.error('Error playing notification sound:', error);
      return false;
    }
  }

  static playMessageNotification() {
    return this.play('message');
  }

  static playCallNotification() {
    return this.play('call');
  }

  static playReminderNotification() {
    return this.play('reminder');
  }
}

export default NotificationSound;