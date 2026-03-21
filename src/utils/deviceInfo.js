/**
 * deviceInfo.js
 *
 * Parses device information from browser environment.
 * No external library needed — uses regex on navigator.userAgent.
 *
 * Returns structured device info for session tracking.
 */

/**
 * Get comprehensive device information
 * @returns {Object} Device info for session record
 */
export const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  const platform = navigator.platform || '';

  return {
    deviceName: getDeviceNameFromUA(ua, platform),
    deviceType: getDeviceTypeFromUA(ua),
    deviceIcon: getDeviceIconFromUA(ua),
    browser: getBrowserFromUA(ua),
    os: getOSFromUA(ua, platform),
    appVersion: '2.0.0', // Base APK version
    otaVersion: document.querySelector('meta[name="build-time"]')?.content || null,
  };
};

/**
 * Human-readable device name
 * Examples: "iPhone", "Samsung Galaxy", "Chrome on Windows", "iPad"
 */
function getDeviceNameFromUA(ua, platform) {
  // Specific mobile devices
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/SM-[A-Z]/.test(ua)) return 'Samsung Galaxy';
  if (/Pixel/.test(ua)) return 'Google Pixel';
  if (/ONEPLUS/.test(ua)) return 'OnePlus';
  if (/Xiaomi|Redmi|POCO/.test(ua)) return 'Xiaomi';
  if (/OPPO/.test(ua)) return 'OPPO';
  if (/vivo/.test(ua)) return 'Vivo';
  if (/Huawei/.test(ua)) return 'Huawei';

  // Desktop — combine browser + OS
  const browser = getBrowserShort(ua);
  const os = getOSShort(ua, platform);
  if (browser && os) return `${browser} on ${os}`;

  // Generic fallback
  if (/Android/.test(ua)) return 'Android Device';
  if (/Mac/.test(platform)) return 'Mac';
  if (/Win/.test(platform)) return 'Windows PC';
  if (/Linux/.test(platform)) return 'Linux PC';

  return 'Unknown Device';
}

/**
 * Device type for categorization
 */
function getDeviceTypeFromUA(ua) {
  if (/iPad|tablet/i.test(ua)) return 'tablet';
  if (/iPhone|iPod|Android.*Mobile|webOS|BlackBerry/i.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * Lucide icon name for UI display
 */
function getDeviceIconFromUA(ua) {
  if (/iPad|tablet/i.test(ua)) return 'tablet';
  if (/iPhone|iPod|Android.*Mobile/i.test(ua)) return 'smartphone';
  if (/Mac/.test(ua)) return 'laptop';
  return 'monitor';
}

/**
 * Full browser string
 */
function getBrowserFromUA(ua) {
  if (/Edg\/(\d+)/.test(ua)) return `Edge ${RegExp.$1}`;
  if (/OPR\/(\d+)/.test(ua)) return `Opera ${RegExp.$1}`;
  if (/Chrome\/(\d+)/.test(ua)) return `Chrome ${RegExp.$1}`;
  if (/Firefox\/(\d+)/.test(ua)) return `Firefox ${RegExp.$1}`;
  if (/Version\/(\d+).*Safari/.test(ua)) return `Safari ${RegExp.$1}`;
  if (/CriOS\/(\d+)/.test(ua)) return `Chrome iOS ${RegExp.$1}`;
  if (/FxiOS\/(\d+)/.test(ua)) return `Firefox iOS ${RegExp.$1}`;
  return 'Unknown Browser';
}

function getBrowserShort(ua) {
  if (/Edg/.test(ua)) return 'Edge';
  if (/OPR/.test(ua)) return 'Opera';
  if (/Chrome/.test(ua)) return 'Chrome';
  if (/Firefox/.test(ua)) return 'Firefox';
  if (/Safari/.test(ua)) return 'Safari';
  return null;
}

/**
 * Full OS string
 */
function getOSFromUA(ua, platform) {
  if (/iPhone OS (\d+[_.\d]*)/.test(ua)) return `iOS ${RegExp.$1.replace(/_/g, '.')}`;
  if (/iPad.*OS (\d+[_.\d]*)/.test(ua)) return `iPadOS ${RegExp.$1.replace(/_/g, '.')}`;
  if (/Android (\d+[.\d]*)/.test(ua)) return `Android ${RegExp.$1}`;
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Mac OS X (\d+[_.\d]*)/.test(ua)) return `macOS ${RegExp.$1.replace(/_/g, '.')}`;
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown OS';
}

function getOSShort(ua, platform) {
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  return null;
}

/**
 * Get country flag emoji from country code
 */
export const getCountryFlag = (countryCode) => {
  if (!countryCode || countryCode.length !== 2) return '🌍';
  const codePoints = [...countryCode.toUpperCase()].map(
    char => 0x1F1E6 - 65 + char.charCodeAt(0)
  );
  return String.fromCodePoint(...codePoints);
};

export const getPersistentSessionId = () => {
  let id = localStorage.getItem('caba-session-id');
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('caba-session-id', id);
  }
  return id;
};
