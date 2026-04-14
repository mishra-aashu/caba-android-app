import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    resources: {
      en: {
        translation: {
          settings: {
            title: 'Settings',
            language: 'Language',
            profile: 'Profile',
            privacy: 'Privacy',
            security: 'Security',
            help: 'Help Center',
            logout: 'Logout',
            profile_visibility: 'Profile Photo Visibility',
            phone_visibility: 'Phone Number Visibility',
            everyone: 'Everyone',
            contacts: 'Contacts Only',
            nobody: 'Nobody',
            updated_success: 'Settings updated successfully',
            updated_error: 'Failed to update settings'
          }
        }
      },
      hi: {
        translation: {
          settings: {
            title: 'सेटिंग्स',
            language: 'भाषा',
            profile: 'प्रोफ़ाइल',
            privacy: 'प्राइवेसी',
            security: 'सुरक्षा',
            help: 'सहायता केंद्र',
            logout: 'लॉगआउट',
            profile_visibility: 'प्रोफ़ाइल फोटो प्राइवेसी',
            phone_visibility: 'फ़ोन नंबर प्राइवेसी',
            everyone: 'सबके लिए',
            contacts: 'सिर्फ कॉन्टैक्ट्स',
            nobody: 'किसी के लिए नहीं',
            updated_success: 'सेटिंग्स अपडेट हो गईं',
            updated_error: 'सेटिंग्स अपडेट करने में विफल'
          }
        }
      }
    }
  });

export default i18n;
