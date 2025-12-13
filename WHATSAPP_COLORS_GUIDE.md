# WhatsApp Authentic Color System - CaBa

## 🎨 Complete Color Reference

### Light Mode Colors

```css
/* Background Colors */
--wa-bg-app: #FFFFFF              /* Main app background (Settings/Lists) */
--wa-bg-chat: #ECE5DD             /* Chat background (Classic beige) */
--wa-input-bg: #F0F2F5            /* Input fields background */

/* Header Colors */
--wa-header: #008069              /* Primary Green Header (Modern WhatsApp) */
--wa-header-dark: #075E54         /* Darker Green (Classic WhatsApp) */

/* Message Bubble Colors */
--wa-bubble-sent: #DCF8C6         /* Your sent messages (Light green) */
--wa-bubble-received: #FFFFFF     /* Received messages (White) */

/* Text Colors */
--wa-text-primary: #111B21        /* Main text (Almost black) */
--wa-text-secondary: #667781      /* Time stamps, subtitles (Grey) */

/* Accent Colors */
--wa-accent: #25D366              /* WhatsApp Logo Green */
--wa-checkmark: #53BDEB           /* Blue checkmarks (Read receipts) */

/* UI Elements */
--wa-border: #E9EDEF              /* Borders and dividers */
--wa-hover: #F5F6F6               /* Hover states */
```

### Dark Mode Colors

```css
/* Background Colors */
--wa-bg-app: #111B21              /* Deep blue-black background */
--wa-bg-chat: #0B141A             /* Chat background (Darker) */
--wa-input-bg: #2A3942            /* Input fields background */

/* Header Colors */
--wa-header: #202C33              /* Top bar / Input area */

/* Message Bubble Colors */
--wa-bubble-sent: #005C4B         /* Your sent messages (Dark green) */
--wa-bubble-received: #202C33     /* Received messages (Dark grey) */

/* Text Colors */
--wa-text-primary: #E9EDEF        /* Main text (Off-white) */
--wa-text-secondary: #8696A0      /* Time stamps (Muted blue-grey) */

/* Accent Colors */
--wa-accent: #00A884              /* Bright green for dark mode */
--wa-checkmark: #53BDEB           /* Blue checkmarks */

/* UI Elements */
--wa-border: #2A3942              /* Borders and dividers */
--wa-hover: #2A3942               /* Hover states */
```

## 📱 Component Usage Examples

### 1. Message Bubbles

```jsx
// Sent Message
<div className="message-bubble message-sent">
  <p className="message-text">Hello! Kaa baa?</p>
  <div className="message-time">
    <span>10:30 AM</span>
    <span className="message-checkmark read">✓✓</span>
  </div>
</div>

// Received Message
<div className="message-bubble message-received">
  <p className="message-text">Sab badhiya! Aap batao?</p>
  <div className="message-time">10:31 AM</div>
</div>
```

### 2. Header Bar

```jsx
<header className="whatsapp-header">
  <div className="whatsapp-header-title">CaBa</div>
  <div className="whatsapp-header-actions">
    <SearchIcon className="whatsapp-header-icon" />
    <MoreVerticalIcon className="whatsapp-header-icon" />
  </div>
</header>
```

### 3. Floating Action Button (FAB)

```jsx
<button className="whatsapp-fab">
  <MessageCircleIcon size={24} />
</button>
```

### 4. Chat List Item

```jsx
<div className="whatsapp-chat-item">
  <div className="whatsapp-avatar">
    <img src={avatar} alt="User" />
  </div>
  <div className="whatsapp-chat-info">
    <div className="whatsapp-chat-name">Rahul Kumar</div>
    <div className="whatsapp-chat-message">Last message preview...</div>
  </div>
  <div className="whatsapp-chat-meta">
    <div className="whatsapp-chat-time">10:30 AM</div>
    <div className="whatsapp-unread-badge">3</div>
  </div>
</div>
```

### 5. Input Area

```jsx
<div className="whatsapp-input-container">
  <button className="whatsapp-icon-btn">
    <SmileIcon size={24} />
  </button>
  <input 
    type="text" 
    className="whatsapp-input" 
    placeholder="Type a message"
  />
  <button className="whatsapp-send-btn">
    <SendIcon size={20} />
  </button>
</div>
```

## 🎯 Key Design Principles

### Typography
- **Font Family**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- **Message Text**: 14px, line-height 19px
- **Time Stamps**: 11px or 12px
- **Chat Names**: 16px, font-weight 500
- **Header Title**: 19px, font-weight 600

### Spacing
- **Message Padding**: 8px 12px
- **Chat Item Padding**: 12px 16px
- **Input Padding**: 10px 16px
- **Icon Button Size**: 40px × 40px
- **FAB Size**: 60px × 60px (56px on mobile)

### Border Radius
- **Message Bubbles**: 8px (with one sharp corner)
- **Input Fields**: 24px (rounded pill shape)
- **Buttons**: 50% (perfect circle)
- **Cards**: 8px to 12px

### Shadows
- **Light Shadow**: `0 1px 0.5px rgba(0,0,0,0.13)`
- **Medium Shadow**: `0 1px 2px rgba(0,0,0,0.15)`
- **Heavy Shadow**: `0 4px 10px rgba(0,0,0,0.3)` (for FAB)

### Transitions
- **Fast**: 0.15s ease (for hovers)
- **Normal**: 0.2s ease (for most interactions)

## 🌓 Dark Mode Implementation

### Automatic Theme Switching

The app uses `[data-theme="dark"]` attribute on the root element:

```javascript
// Toggle dark mode
document.documentElement.setAttribute('data-theme', 'dark');

// Toggle light mode
document.documentElement.setAttribute('data-theme', 'light');
```

All color variables automatically switch based on this attribute.

## 🔧 Customization Tips

### Changing Primary Color
To change the accent color (green), update these variables:
```css
:root {
  --wa-accent: #25D366;  /* Your custom color */
}

[data-theme="dark"] {
  --wa-accent: #00A884;  /* Darker variant for dark mode */
}
```

### Adding Custom Themes
You can create additional theme variations:
```css
[data-theme="blue"] {
  --wa-header: #0088CC;
  --wa-accent: #0088CC;
  --wa-bubble-sent: #D4E8F7;
}
```

## 📦 Files Structure

```
src/styles/
├── global.css                 # Base variables and global styles
├── whatsapp-bubbles.css       # Message bubble styles
└── whatsapp-components.css    # UI components (buttons, inputs, etc.)
```

## ✅ Checklist for WhatsApp-like Feel

- [x] Exact color codes from WhatsApp
- [x] Proper message bubble styling with sharp corners
- [x] Blue checkmarks for read receipts
- [x] Correct font family and sizes
- [x] Authentic shadows and spacing
- [x] Smooth transitions and hover effects
- [x] Dark mode with proper colors
- [x] FAB button with green accent
- [x] Input area with rounded design
- [x] Chat list with proper hierarchy
- [x] Typing indicator animation
- [x] Date dividers in chat
- [x] Mobile responsive design

## 🚀 Quick Start

1. All styles are automatically imported in `main.jsx`
2. Use the CSS classes in your components
3. Toggle dark mode using `data-theme` attribute
4. Colors automatically adapt to theme changes

## 📱 Mobile Optimization

All components are mobile-responsive:
- FAB size reduces on mobile (56px)
- Message bubbles take 80% width on mobile
- Touch-friendly button sizes (minimum 40px)
- Proper spacing for thumb navigation

---

**Note**: These colors are based on WhatsApp Web (2024) and WhatsApp Android/iOS latest versions. The design maintains authenticity while being customizable for your CaBa app.
