 import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSupabase } from './SupabaseContext';

// Complete Chat Themes Data with enhanced visibility and proper naming
const chatThemes = {
  classic_purple: {
    name: 'Classic Purple',
    category: 'Default',
    background: `
      radial-gradient(circle at 25% 75%, rgba(139, 92, 246, 0.15) 0%, transparent 60%),
      radial-gradient(circle at 75% 25%, rgba(168, 85, 247, 0.12) 0%, transparent 55%),
      radial-gradient(circle at 50% 50%, rgba(124, 58, 237, 0.08) 0%, transparent 70%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
      text: '#f8fafc'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
      text: '#0f172a'
    },
    header: {
      background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      text: '#ffffff',
      iconColor: '#f1f5f9'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      text: '#1e293b',
      iconColor: '#8b5cf6'
    },
    buttons: {
      background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  electric_dreams: {
    name: 'Electric Dreams',
    category: 'Futuristic',
    background: `
      radial-gradient(circle at 20% 80%, rgba(6, 182, 212, 0.2) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.25) 0%, transparent 55%),
      radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.15) 0%, transparent 60%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #0c4a6e 0%, #1e40af 50%, #581c87 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
      text: '#f0f9ff'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
      text: '#0c4a6e'
    },
    header: {
      background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
      text: '#ffffff',
      iconColor: '#f0f9ff'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
      text: '#0c4a6e',
      iconColor: '#0ea5e9'
    },
    buttons: {
      background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  dark_professional: {
    name: 'Dark Professional',
    category: 'Dark',
    background: `
      radial-gradient(circle at 30% 70%, rgba(15, 23, 42, 0.4) 0%, transparent 60%),
      radial-gradient(circle at 70% 30%, rgba(30, 41, 59, 0.3) 0%, transparent 55%),
      radial-gradient(circle at 50% 50%, rgba(51, 65, 85, 0.2) 0%, transparent 70%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #0f172a 0%, #1e293b 50%, #334155 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #475569 0%, #64748b 100%)',
      text: '#f8fafc'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
      text: '#e2e8f0'
    },
    header: {
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      text: '#ffffff',
      iconColor: '#e2e8f0'
    },
    input: {
      background: 'linear-gradient(135deg, #334155 0%, #475569 100%)',
      text: '#f8fafc',
      iconColor: '#94a3b8'
    },
    buttons: {
      background: 'linear-gradient(135deg, #475569 0%, #64748b 100%)',
      text: '#f8fafc',
      iconColor: '#f8fafc'
    }
  },
  ocean_depths: {
    name: 'Ocean Depths',
    category: 'Nature',
    background: `
      radial-gradient(circle at 25% 75%, rgba(14, 165, 233, 0.18) 0%, transparent 55%),
      radial-gradient(circle at 75% 25%, rgba(2, 132, 199, 0.22) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.12) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #0c4a6e 0%, #075985 50%, #0369a1 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
      text: '#f0f9ff'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
      text: '#0c4a6e'
    },
    header: {
      background: 'linear-gradient(135deg, #0c4a6e 0%, #075985 100%)',
      text: '#ffffff',
      iconColor: '#f0f9ff'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
      text: '#0c4a6e',
      iconColor: '#0284c7'
    },
    buttons: {
      background: 'linear-gradient(135deg, #0c4a6e 0%, #075985 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  forest_mist: {
    name: 'Forest Mist',
    category: 'Nature',
    background: `
      radial-gradient(circle at 20% 80%, rgba(34, 197, 94, 0.15) 0%, transparent 55%),
      radial-gradient(circle at 80% 20%, rgba(22, 163, 74, 0.18) 0%, transparent 60%),
      radial-gradient(circle at 60% 40%, rgba(74, 222, 128, 0.10) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #14532d 0%, #166534 50%, #15803d 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
      text: '#f0fdf4'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
      text: '#14532d'
    },
    header: {
      background: 'linear-gradient(135deg, #14532d 0%, #166534 100%)',
      text: '#ffffff',
      iconColor: '#f0fdf4'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
      text: '#14532d',
      iconColor: '#16a34a'
    },
    buttons: {
      background: 'linear-gradient(135deg, #14532d 0%, #166534 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  sunset_glow: {
    name: 'Sunset Glow',
    category: 'Colorful',
    background: `
      radial-gradient(circle at 25% 75%, rgba(251, 146, 60, 0.16) 0%, transparent 55%),
      radial-gradient(circle at 75% 25%, rgba(234, 88, 12, 0.20) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(249, 115, 22, 0.12) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #c2410c 0%, #ea580c 50%, #f97316 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)',
      text: '#fff7ed'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)',
      text: '#9a3412'
    },
    header: {
      background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)',
      text: '#ffffff',
      iconColor: '#fff7ed'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)',
      text: '#9a3412',
      iconColor: '#ea580c'
    },
    buttons: {
      background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  cosmic_purple: {
    name: 'Cosmic Purple',
    category: 'Elegant',
    background: `
      radial-gradient(circle at 30% 70%, rgba(147, 51, 234, 0.18) 0%, transparent 55%),
      radial-gradient(circle at 70% 30%, rgba(124, 58, 237, 0.22) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.14) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #581c87 0%, #6b21a8 50%, #7c3aed 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #7c3aed 0%, #6b21a8 100%)',
      text: '#f3e8ff'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)',
      text: '#581c87'
    },
    header: {
      background: 'linear-gradient(135deg, #581c87 0%, #6b21a8 100%)',
      text: '#ffffff',
      iconColor: '#f3e8ff'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)',
      text: '#581c87',
      iconColor: '#8b5cf6'
    },
    buttons: {
      background: 'linear-gradient(135deg, #581c87 0%, #6b21a8 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  golden_hour: {
    name: 'Golden Hour',
    category: 'Colorful',
    background: `
      radial-gradient(circle at 20% 80%, rgba(245, 158, 11, 0.15) 0%, transparent 55%),
      radial-gradient(circle at 80% 20%, rgba(217, 119, 6, 0.18) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.10) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #92400e 0%, #b45309 50%, #d97706 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
      text: '#fffbeb'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)',
      text: '#92400e'
    },
    header: {
      background: 'linear-gradient(135deg, #92400e 0%, #b45309 100%)',
      text: '#ffffff',
      iconColor: '#fffbeb'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)',
      text: '#92400e',
      iconColor: '#d97706'
    },
    buttons: {
      background: 'linear-gradient(135deg, #92400e 0%, #b45309 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  midnight_city: {
    name: 'Midnight City',
    category: 'Dark',
    background: `
      radial-gradient(circle at 30% 70%, rgba(30, 27, 75, 0.25) 0%, transparent 55%),
      radial-gradient(circle at 70% 30%, rgba(49, 46, 129, 0.30) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(79, 70, 229, 0.15) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #0f0f23 0%, #1e1b4b 50%, #312e81 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #4338ca 0%, #3730a3 100%)',
      text: '#e0e7ff'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
      text: '#c7d2fe'
    },
    header: {
      background: 'linear-gradient(135deg, #0f0f23 0%, #1e1b4b 100%)',
      text: '#ffffff',
      iconColor: '#e0e7ff'
    },
    input: {
      background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)',
      text: '#e0e7ff',
      iconColor: '#a5b4fc'
    },
    buttons: {
      background: 'linear-gradient(135deg, #4338ca 0%, #3730a3 100%)',
      text: '#e0e7ff',
      iconColor: '#e0e7ff'
    }
  },
  rose_garden: {
    name: 'Rose Garden',
    category: 'Colorful',
    background: `
      radial-gradient(circle at 25% 75%, rgba(244, 63, 94, 0.16) 0%, transparent 55%),
      radial-gradient(circle at 75% 25%, rgba(219, 39, 119, 0.20) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(236, 72, 153, 0.12) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #be185d 0%, #db2777 50%, #ec4899 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #db2777 0%, #be185d 100%)',
      text: '#fdf2f8'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)',
      text: '#be185d'
    },
    header: {
      background: 'linear-gradient(135deg, #be185d 0%, #db2777 100%)',
      text: '#ffffff',
      iconColor: '#fdf2f8'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)',
      text: '#be185d',
      iconColor: '#ec4899'
    },
    buttons: {
      background: 'linear-gradient(135deg, #be185d 0%, #db2777 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  emerald_forest: {
    name: 'Emerald Forest',
    category: 'Nature',
    background: `
      radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.14) 0%, transparent 55%),
      radial-gradient(circle at 80% 20%, rgba(5, 150, 105, 0.18) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(52, 211, 153, 0.10) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #047857 0%, #059669 50%, #10b981 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      text: '#ecfdf5'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)',
      text: '#14532d'
    },
    header: {
      background: 'linear-gradient(135deg, #047857 0%, #059669 100%)',
      text: '#ffffff',
      iconColor: '#ecfdf5'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)',
      text: '#14532d',
      iconColor: '#10b981'
    },
    buttons: {
      background: 'linear-gradient(135deg, #047857 0%, #059669 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  nebula: {
    name: 'Nebula',
    category: 'Elegant',
    background: `
      radial-gradient(circle at 30% 70%, rgba(236, 72, 153, 0.16) 0%, transparent 55%),
      radial-gradient(circle at 70% 30%, rgba(139, 92, 246, 0.20) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.12) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #831843 0%, #a21caf 50%, #7c3aed 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #a21caf 0%, #7c3aed 100%)',
      text: '#fdf2f8'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)',
      text: '#831843'
    },
    header: {
      background: 'linear-gradient(135deg, #831843 0%, #a21caf 100%)',
      text: '#ffffff',
      iconColor: '#fdf2f8'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)',
      text: '#831843',
      iconColor: '#ec4899'
    },
    buttons: {
      background: 'linear-gradient(135deg, #831843 0%, #a21caf 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  cyberpunk: {
    name: 'Cyberpunk',
    category: 'Dark',
    background: `
      radial-gradient(circle at 25% 75%, rgba(0, 255, 255, 0.08) 0%, transparent 50%),
      radial-gradient(circle at 75% 25%, rgba(255, 0, 255, 0.06) 0%, transparent 55%),
      radial-gradient(circle at 50% 50%, rgba(0, 255, 0, 0.04) 0%, transparent 60%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #000000 0%, #0a0a0a 50%, #1a1a1a 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #00ffff 0%, #0080ff 100%)',
      text: '#000000'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
      text: '#00ff00'
    },
    header: {
      background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
      text: '#00ffff',
      iconColor: '#00ff00'
    },
    input: {
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
      text: '#00ff00',
      iconColor: '#00ffff'
    },
    buttons: {
      background: 'linear-gradient(135deg, #00ffff 0%, #0080ff 100%)',
      text: '#000000',
      iconColor: '#000000'
    }
  },
  telegram_blue: {
    name: 'Telegram Blue',
    category: 'Professional',
    background: `
      radial-gradient(circle at 30% 70%, rgba(0, 136, 204, 0.15) 0%, transparent 55%),
      radial-gradient(circle at 70% 30%, rgba(0, 95, 153, 0.18) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.10) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #003d5b 0%, #0088cc 50%, #3b82f6 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #0088cc 0%, #0369a1 100%)',
      text: '#f0f9ff'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
      text: '#003d5b'
    },
    header: {
      background: 'linear-gradient(135deg, #003d5b 0%, #0088cc 100%)',
      text: '#ffffff',
      iconColor: '#f0f9ff'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
      text: '#003d5b',
      iconColor: '#0088cc'
    },
    buttons: {
      background: 'linear-gradient(135deg, #003d5b 0%, #0088cc 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  spring_vibes: {
    name: 'Spring Vibes',
    category: 'Nature',
    background: `
      radial-gradient(circle at 20% 80%, rgba(255, 222, 233, 0.25) 0%, transparent 55%),
      radial-gradient(circle at 80% 20%, rgba(181, 255, 252, 0.30) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(236, 252, 203, 0.20) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #fce7f3 0%, #ecfdf5 50%, #f0fdfa 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      text: '#ffffff',
      shadow: '0 3px 12px rgba(5, 150, 105, 0.3)',
      border: '1px solid rgba(255,255,255,0.2)'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      text: '#1e293b',
      shadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid rgba(30, 41, 59, 0.1)'
    },
    header: {
      background: 'linear-gradient(135deg, #047857 0%, #059669 100%)',
      text: '#ffffff',
      iconColor: '#ffffff',
      shadow: '0 2px 8px rgba(4, 120, 87, 0.3)'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
      text: '#1e293b',
      iconColor: '#059669',
      border: '1px solid rgba(5, 150, 105, 0.2)',
      shadow: '0 2px 8px rgba(0,0,0,0.1)'
    },
    buttons: {
      background: 'linear-gradient(135deg, #047857 0%, #059669 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  autumn_leaves: {
    name: 'Autumn Leaves',
    category: 'Nature',
    background: `
      radial-gradient(circle at 25% 75%, rgba(234, 88, 12, 0.16) 0%, transparent 55%),
      radial-gradient(circle at 75% 25%, rgba(154, 52, 18, 0.20) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.12) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #7c2d12 0%, #9a3412 50%, #ea580c 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)',
      text: '#fff7ed'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)',
      text: '#7c2d12'
    },
    header: {
      background: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)',
      text: '#ffffff',
      iconColor: '#fff7ed'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)',
      text: '#7c2d12',
      iconColor: '#ea580c'
    },
    buttons: {
      background: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  winter_calm: {
    name: 'Winter Calm',
    category: 'Nature',
    background: `
      radial-gradient(circle at 30% 70%, rgba(137, 247, 254, 0.22) 0%, transparent 55%),
      radial-gradient(circle at 70% 30%, rgba(102, 166, 255, 0.18) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.12) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #e0f2fe 0%, #bae6fd 50%, #7dd3fc 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
      text: '#ffffff',
      shadow: '0 3px 12px rgba(2, 132, 199, 0.3)',
      border: '1px solid rgba(255,255,255,0.2)'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
      text: '#0c4a6e',
      shadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid rgba(12, 74, 110, 0.1)'
    },
    header: {
      background: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)',
      text: '#ffffff',
      iconColor: '#ffffff',
      shadow: '0 2px 8px rgba(12, 74, 110, 0.3)'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
      text: '#0c4a6e',
      iconColor: '#0284c7',
      border: '1px solid rgba(2, 132, 199, 0.2)',
      shadow: '0 2px 8px rgba(0,0,0,0.1)'
    },
    buttons: {
      background: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  desert_dunes: {
    name: 'Desert Dunes',
    category: 'Nature',
    background: `
      radial-gradient(circle at 20% 80%, rgba(253, 230, 138, 0.18) 0%, transparent 55%),
      radial-gradient(circle at 80% 20%, rgba(245, 158, 11, 0.22) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.15) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #fef3c7 0%, #fde68a 50%, #facc15 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #ca8a04 0%, #a16207 100%)',
      text: '#ffffff',
      shadow: '0 3px 12px rgba(202, 138, 4, 0.3)',
      border: '1px solid rgba(255,255,255,0.2)'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)',
      text: '#78350f',
      shadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid rgba(120, 53, 15, 0.1)'
    },
    header: {
      background: 'linear-gradient(135deg, #78350f 0%, #ca8a04 100%)',
      text: '#ffffff',
      iconColor: '#ffffff',
      shadow: '0 2px 8px rgba(120, 53, 15, 0.3)'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)',
      text: '#78350f',
      iconColor: '#ca8a04',
      border: '1px solid rgba(202, 138, 4, 0.2)',
      shadow: '0 2px 8px rgba(0,0,0,0.1)'
    },
    buttons: {
      background: 'linear-gradient(135deg, #78350f 0%, #ca8a04 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  lavender_fields: {
    name: 'Lavender Fields',
    category: 'Nature',
    background: `
      radial-gradient(circle at 25% 75%, rgba(196, 181, 253, 0.18) 0%, transparent 55%),
      radial-gradient(circle at 75% 25%, rgba(139, 92, 246, 0.15) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(167, 139, 250, 0.12) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #ede9fe 0%, #c4b5fd 50%, #a78bfa 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
      text: '#f3e8ff'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)',
      text: '#581c87'
    },
    header: {
      background: 'linear-gradient(135deg, #581c87 0%, #7c3aed 100%)',
      text: '#ffffff',
      iconColor: '#f3e8ff'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)',
      text: '#581c87',
      iconColor: '#8b5cf6'
    },
    buttons: {
      background: 'linear-gradient(135deg, #581c87 0%, #7c3aed 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  cherry_blossom: {
    name: 'Cherry Blossom',
    category: 'Nature',
    background: `
      radial-gradient(circle at 30% 70%, rgba(253, 164, 175, 0.22) 0%, transparent 55%),
      radial-gradient(circle at 70% 30%, rgba(244, 63, 94, 0.18) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(251, 113, 133, 0.14) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #fce7f3 0%, #fda4af 50%, #fb7185 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #e11d48 0%, #be185d 100%)',
      text: '#ffffff',
      shadow: '0 3px 12px rgba(225, 29, 72, 0.3)',
      border: '1px solid rgba(255,255,255,0.2)'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)',
      text: '#9f1239',
      shadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid rgba(159, 18, 57, 0.1)'
    },
    header: {
      background: 'linear-gradient(135deg, #9f1239 0%, #e11d48 100%)',
      text: '#ffffff',
      iconColor: '#ffffff',
      shadow: '0 2px 8px rgba(159, 18, 57, 0.3)'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)',
      text: '#9f1239',
      iconColor: '#f43f5e',
      border: '1px solid rgba(244, 63, 94, 0.2)',
      shadow: '0 2px 8px rgba(0,0,0,0.1)'
    },
    buttons: {
      background: 'linear-gradient(135deg, #9f1239 0%, #e11d48 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  rainy_day: {
    name: 'Rainy Day',
    category: 'Nature',
    background: `
      radial-gradient(circle at 20% 80%, rgba(156, 163, 175, 0.15) 0%, transparent 55%),
      radial-gradient(circle at 80% 20%, rgba(75, 85, 99, 0.18) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(107, 114, 128, 0.12) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #f3f4f6 0%, #d1d5db 50%, #9ca3af 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #4b5563 0%, #374151 100%)',
      text: '#f9fafb'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
      text: '#1f2937'
    },
    header: {
      background: 'linear-gradient(135deg, #1f2937 0%, #4b5563 100%)',
      text: '#ffffff',
      iconColor: '#f9fafb'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
      text: '#1f2937',
      iconColor: '#6b7280'
    },
    buttons: {
      background: 'linear-gradient(135deg, #1f2937 0%, #4b5563 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  sunset_bliss: {
    name: 'Sunset Bliss',
    category: 'Colorful',
    background: `
      radial-gradient(circle at 25% 75%, rgba(251, 146, 60, 0.18) 0%, transparent 55%),
      radial-gradient(circle at 75% 25%, rgba(239, 68, 68, 0.22) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.14) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #fed7aa 0%, #fb923c 50%, #f97316 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
      text: '#fef2f2'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)',
      text: '#9a3412'
    },
    header: {
      background: 'linear-gradient(135deg, #9a3412 0%, #dc2626 100%)',
      text: '#ffffff',
      iconColor: '#fff7ed'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)',
      text: '#9a3412',
      iconColor: '#f97316'
    },
    buttons: {
      background: 'linear-gradient(135deg, #9a3412 0%, #dc2626 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  mint_fresh: {
    name: 'Mint Fresh',
    category: 'Nature',
    background: `
      radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.15) 0%, transparent 55%),
      radial-gradient(circle at 80% 20%, rgba(52, 211, 153, 0.18) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(134, 239, 172, 0.12) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #d1fae5 0%, #86efac 50%, #4ade80 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      text: '#f0fdf4'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
      text: '#14532d'
    },
    header: {
      background: 'linear-gradient(135deg, #14532d 0%, #059669 100%)',
      text: '#ffffff',
      iconColor: '#f0fdf4'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
      text: '#14532d',
      iconColor: '#10b981'
    },
    buttons: {
      background: 'linear-gradient(135deg, #14532d 0%, #059669 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },
  royal_elegance: {
    name: 'Royal Elegance',
    category: 'Elegant',
    background: `
      radial-gradient(circle at 30% 70%, rgba(124, 58, 237, 0.18) 0%, transparent 55%),
      radial-gradient(circle at 70% 30%, rgba(139, 92, 246, 0.22) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.14) 0%, transparent 65%),
      linear-gradient(calc(135deg + var(--scroll-percentage, 0) * 1.8deg), #ede9fe 0%, #c4b5fd 50%, #a78bfa 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #6b21a8 0%, #581c87 100%)',
      text: '#f3e8ff'
    },
    receivedMessage: {
      background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)',
      text: '#581c87'
    },
    header: {
      background: 'linear-gradient(135deg, #581c87 0%, #6b21a8 100%)',
      text: '#ffffff',
      iconColor: '#f3e8ff'
    },
    input: {
      background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)',
      text: '#581c87',
      iconColor: '#8b5cf6'
    },
    buttons: {
      background: 'linear-gradient(135deg, #581c87 0%, #6b21a8 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  }
};

// Create the Chat Theme Context
const ChatThemeContext = createContext();

// Chat Theme Provider Component
export const ChatThemeProvider = ({ children }) => {
  const { supabase } = useSupabase();
  
  // State
  const [currentChatTheme, setCurrentChatTheme] = useState('classic_purple');
  const [currentChatId, setCurrentChatId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scrollPercentage, setScrollPercentage] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--scroll-percentage', scrollPercentage);
  }, [scrollPercentage]);

  // Load chat theme - completely localStorage based to avoid all database errors
  const loadChatTheme = async (chatId) => {
    if (!chatId) {
      setCurrentChatTheme('classic_purple');
      setLoading(false);
      return;
    }

    // Debounce multiple calls for same chat
    const debounceKey = `digidad_theme_debounce_${chatId}`;
    const now = Date.now();
    const lastCall = parseInt(localStorage.getItem(debounceKey) || '0');
    
    if (now - lastCall < 1000) { // 1 second debounce
      setLoading(false);
      return;
    }
    localStorage.setItem(debounceKey, now.toString());

    // Load from localStorage first and only (completely localStorage-based)
    const cachedTheme = localStorage.getItem(`digidad_chat_theme_${chatId}`);
    if (cachedTheme && chatThemes[cachedTheme]) {
      setCurrentChatTheme(cachedTheme);
    } else if (!cachedTheme) {
      setCurrentChatTheme('classic_purple');
      localStorage.setItem(`digidad_chat_theme_${chatId}`, 'classic_purple');
    }

    setLoading(false);
  };

  // Save chat theme - completely localStorage based to avoid all database errors
  const saveChatTheme = async (themeKey, chatId, setByUserId) => {
    if (!chatId) {
      return;
    }

    try {
      // Always save to localStorage (works offline and always)
      localStorage.setItem(`digidad_chat_theme_${chatId}`, themeKey);
      
      // Note: Database sync disabled to avoid permission errors
      // localStorage will handle all theme persistence
    } catch (error) {
      // Fallback to localStorage (should never fail)
      try {
        localStorage.setItem(`digidad_chat_theme_${chatId}`, themeKey);
      } catch (e) {
        // localStorage might be full or disabled
        // Theme will still work for this session
      }
    }
  };

  // Set current chat ID and load theme
  const setChatId = (chatId) => {
    setCurrentChatId(chatId);
    setLoading(true);
    loadChatTheme(chatId);
  };

  // Select and apply theme
  const selectTheme = async (themeKey, chatIdOverride) => {
    if (!chatThemes[themeKey]) return;
    const chatIdToUse = chatIdOverride || currentChatId;
    
    if (!chatIdToUse) {
      console.error('No chat ID available for theme selection');
      return;
    }

    setCurrentChatTheme(themeKey);
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    await saveChatTheme(themeKey, chatIdToUse, currentUser?.id);
    applyTheme(themeKey);
  };

  // Helper function to check if element is inside homescreen/chat list
  const isInHomescreen = (element) => {
    if (!element) return false;
    
    // Check if element or any of its parents have homescreen-related classes
    let current = element;
    while (current && current !== document.body) {
      const className = current.className || '';
      // Convert className to string to handle DOMTokenList objects
      const classNameStr = typeof className === 'string' ? className :
                          (className.toString ? className.toString() : '');
      
      if (classNameStr.includes('home-container') ||
          classNameStr.includes('chat-list') ||
          classNameStr.includes('chat-item') ||
          classNameStr.includes('chat-name') ||
          classNameStr.includes('chat-time') ||
          classNameStr.includes('last-message') ||
          classNameStr.includes('chat-info') ||
          classNameStr.includes('chat-header') ||
          classNameStr.includes('main-content') ||
          classNameStr.includes('sidebar')) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  };

  // Apply theme styles - COMPLETELY EXCLUDE homescreen and chat list
  const applyTheme = (themeKey) => {
    const theme = chatThemes[themeKey];
    if (!theme) return;

    const root = document.documentElement;

    // Apply CSS custom properties for chat theme (these are safe to apply globally)
    root.style.setProperty('--chat-bg-gradient', theme.background);
    root.style.setProperty('--sent-message-bg', theme.sentMessage.background);
    root.style.setProperty('--sent-message-text', theme.sentMessage.text);
    root.style.setProperty('--sent-message-shadow', theme.sentMessage.shadow || '0 2px 8px rgba(0,0,0,0.15)');
    root.style.setProperty('--sent-message-border', theme.sentMessage.border || 'none');
    root.style.setProperty('--received-message-bg', theme.receivedMessage.background);
    root.style.setProperty('--received-message-text', theme.receivedMessage.text);
    root.style.setProperty('--received-message-shadow', theme.receivedMessage.shadow || '0 2px 8px rgba(0,0,0,0.1)');
    root.style.setProperty('--received-message-border', theme.receivedMessage.border || 'none');
    root.style.setProperty('--chat-header-bg', theme.header.background);
    root.style.setProperty('--chat-header-text', theme.header.text);
    root.style.setProperty('--chat-header-icon-color', theme.header.iconColor);
    root.style.setProperty('--chat-header-shadow', theme.header.shadow || '0 2px 8px rgba(0,0,0,0.15)');
    root.style.setProperty('--chat-input-bg', theme.input.background);
    root.style.setProperty('--chat-input-text', theme.input.text);
    root.style.setProperty('--chat-input-icon-color', theme.input.iconColor);
    root.style.setProperty('--chat-input-border', theme.input.border || 'none');
    root.style.setProperty('--chat-input-shadow', theme.input.shadow || '0 2px 8px rgba(0,0,0,0.1)');
    root.style.setProperty('--chat-buttons-bg', theme.buttons.background);
    root.style.setProperty('--chat-buttons-text', theme.buttons.text);
    root.style.setProperty('--chat-buttons-icon-color', theme.buttons.iconColor);

    // Apply to elements ONLY if they're NOT in homescreen/chat list
    const applyToElementIfNotInHomescreen = (selector, styleProperty, styleValue) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (!isInHomescreen(element)) {
          element.style[styleProperty] = styleValue;
        }
      });
    };

    // Apply styles only to elements outside homescreen with enhanced visibility
    applyToElementIfNotInHomescreen('.chat-container', 'background', theme.background);
    applyToElementIfNotInHomescreen('#messagesContainer', 'background', theme.background);
    applyToElementIfNotInHomescreen('.chat-header', 'background', theme.header.background);
    applyToElementIfNotInHomescreen('.chat-header', 'color', theme.header.text);
    applyToElementIfNotInHomescreen('.chat-header', 'boxShadow', theme.header.shadow || '0 2px 8px rgba(0,0,0,0.15)');
    applyToElementIfNotInHomescreen('.chat-header', 'textShadow', '0 1px 2px rgba(0,0,0,0.3)');
    applyToElementIfNotInHomescreen('.message-input-area', 'background', theme.input.background);
    applyToElementIfNotInHomescreen('.message-input-area', 'color', theme.input.text);
    applyToElementIfNotInHomescreen('.message-input-area', 'border', theme.input.border || 'none');
    applyToElementIfNotInHomescreen('.message-input-area', 'boxShadow', theme.input.shadow || '0 2px 8px rgba(0,0,0,0.1)');
    applyToElementIfNotInHomescreen('.input-wrapper', 'background', theme.input.background);
    applyToElementIfNotInHomescreen('.input-wrapper', 'border', theme.input.border || 'none');
    applyToElementIfNotInHomescreen('.input-wrapper', 'boxShadow', theme.input.shadow || '0 2px 8px rgba(0,0,0,0.1)');
    applyToElementIfNotInHomescreen('#messageInput', 'color', theme.input.text);
    applyToElementIfNotInHomescreen('#messageInput', 'textShadow', '0 1px 2px rgba(0,0,0,0.1)');

    // Apply to buttons and icons only if not in homescreen with enhanced styling
    const allElements = document.querySelectorAll('*');
    allElements.forEach(element => {
      if (isInHomescreen(element)) return;
      
      const className = element.className || '';
      // Convert className to string to handle DOMTokenList objects
      const classNameStr = typeof className === 'string' ? className :
                          (className.toString ? className.toString() : '');
      const tagName = element.tagName;
      
      // Only apply to chat-specific elements, never homescreen
      if ((classNameStr.includes('chat') && !classNameStr.includes('chat-list') && !classNameStr.includes('chat-item')) ||
          (tagName === 'BUTTON' && element.closest('.chat-container')) ||
          (classNameStr.includes('message') && element.closest('.chat-container'))) {
         
        if (tagName === 'BUTTON') {
          element.style.background = theme.buttons.background;
          element.style.color = theme.buttons.text;
          element.style.border = 'none';
          element.style.textShadow = '0 1px 2px rgba(0,0,0,0.2)';
          element.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
          element.style.transition = 'all 0.3s ease';
        }
         
        if (element.tagName === 'I' || element.tagName === 'SVG') {
          const parentClass = element.parentElement?.className || '';
          // Convert parentClass to string to handle DOMTokenList objects
          const parentClassStr = typeof parentClass === 'string' ? parentClass :
                                (parentClass.toString ? parentClass.toString() : '');
          if (parentClassStr.includes('chat') && !parentClassStr.includes('chat-list')) {
            element.style.color = theme.header.iconColor;
            element.style.stroke = theme.header.iconColor;
            element.style.filter = 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))';
            element.style.transition = 'all 0.3s ease';
          }
        }
        
        // Enhanced message bubble styling
        if (classNameStr.includes('message-bubble') || classNameStr.includes('message')) {
          if (classNameStr.includes('sent')) {
            element.style.background = theme.sentMessage.background;
            element.style.color = theme.sentMessage.text;
            element.style.border = theme.sentMessage.border || 'none';
            element.style.boxShadow = theme.sentMessage.shadow || '0 2px 8px rgba(0,0,0,0.15)';
            element.style.textShadow = '0 1px 2px rgba(0,0,0,0.2)';
          } else if (classNameStr.includes('received')) {
            element.style.background = theme.receivedMessage.background;
            element.style.color = theme.receivedMessage.text;
            element.style.border = theme.receivedMessage.border || 'none';
            element.style.boxShadow = theme.receivedMessage.shadow || '0 2px 8px rgba(0,0,0,0.1)';
            element.style.textShadow = '0 1px 2px rgba(0,0,0,0.1)';
          }
        }
      }
    });

    // Add theme class to body for CSS targeting
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${themeKey.replace('_', '-')}`);
    
    // Theme applied successfully (completely excludes homescreen)
  };

  // Apply theme when theme or chatId changes
  useEffect(() => {
    if (!loading && currentChatId) {
      applyTheme(currentChatTheme);
    }
  }, [currentChatTheme, currentChatId, loading]);

  // Context value
  const value = {
    chatTheme: currentChatTheme,
    chatThemes,
    selectTheme,
    setChatId,
    loading,
    currentThemeData: chatThemes[currentChatTheme] || chatThemes.classic_purple,
    setScrollPercentage,
    currentChatId
  };

  return (
    <ChatThemeContext.Provider value={value}>
      {children}
    </ChatThemeContext.Provider>
  );
};

// Custom hook to use the Chat Theme Context
export const useChatTheme = () => {
  const context = useContext(ChatThemeContext);
  if (!context) {
    throw new Error('useChatTheme must be used within a ChatThemeProvider');
  }
  return context;
};

export default ChatThemeContext;