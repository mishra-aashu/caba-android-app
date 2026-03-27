# 🎨 Chat Wallpaper & Theme System — Complete Documentation

> **Codebase:** `caba-android-app`  
> **Last Updated:** March 2026  
> **Status:** ✅ Fixed & Working

---

## 📁 File Map

```
src/
├── contexts/
│   ├── ChatThemeContext.js        ← Theme definitions + context object
│   └── ChatThemeProvider.jsx      ← State management + DOM sync + DB sync
├── components/chat/
│   ├── ChatBackground.jsx         ← 3-layer background renderer
│   ├── ChatBackground.module.css  ← Layer CSS (gradient / pattern / content)
│   └── ChatScreen.jsx             ← Consumes context, passes props to background
├── styles/
│   └── chat.module.css            ← Global chat UI styles (must stay transparent)
└── utils/
    └── svgColorizer.js            ← SVG → Base64 data URI with color injection
```

---

## 🧱 Architecture Overview

The system is split into **3 responsibilities**:

```
┌─────────────────────────────────────────────────────┐
│  ChatThemeContext.js                                 │
│  (Data Layer)                                        │
│  • Defines all theme objects (colors, gradients)    │
│  • Defines all pattern IDs                          │
│  • Exports context + useChatTheme() hook            │
└───────────────────┬─────────────────────────────────┘
                    │ provides state
┌───────────────────▼─────────────────────────────────┐
│  ChatThemeProvider.jsx                               │
│  (Logic / State Layer)                               │
│  • Holds: themeKey, wallpaperUrl, patternId         │
│  • Reads from: LocalStorage (cache) + Supabase (DB) │
│  • Writes to: :root CSS variables via applyThemeToDom│
│  • Exposes: selectTheme, selectPattern, selectWallpaper│
└───────────────────┬─────────────────────────────────┘
                    │ CSS variables on :root
┌───────────────────▼─────────────────────────────────┐
│  ChatBackground.jsx + ChatBackground.module.css      │
│  (Render Layer)                                      │
│  • 3 absolutely-positioned layers                   │
│  • Reads CSS variables — zero inline styles         │
│  • Purely presentational, no logic                  │
└─────────────────────────────────────────────────────┘
```

---

## 🎭 The 3-Layer DOM Model

`ChatBackground` renders this stack inside `.chat-main-area` (which is `position: relative`):

```
.chat-main-area  (position: relative)
│
└── .chat-background-container  [position: absolute, inset: 0, z-index: 0]
    │   background-color: var(--chat-bg-base)   ← fallback solid colour
    │
    ├── .gradient-layer          [z-index: 1, position: absolute, inset: 0]
    │       background-image: var(--chat-bg-image), var(--chat-bg-gradient)
    │       ↑ Wallpaper photo first, theme gradient second
    │       ↑ When no photo → only gradient shows
    │       ↑ When photo → photo covers, gradient is behind it
    │
    ├── .pattern-layer           [z-index: 2, position: absolute, inset: 0]
    │   (only mounted when showPattern=true)
    │       background-image: var(--pattern-url)   ← SVG Base64 data URI
    │       background-repeat: repeat
    │       opacity: var(--chat-pattern-opacity)   ← 6–11%
    │       mix-blend-mode: var(--chat-pattern-blend)  ← multiply or overlay
    │
    └── .content-layer           [z-index: 3, position: relative]
            background: transparent !important   ← MUST NEVER BE OPAQUE
            │
            └── [all chat UI: header, messages, input]
```

> [!IMPORTANT]
> `.content-layer` and **every element inside it** must be `background: transparent`.
> If any child div has an opaque background, it will completely hide layers 0–2.

---

## 🖌️ CSS Variables Reference

All variables are set on `:root` (`document.documentElement`) by `applyThemeToDom()`.

| Variable | Set By | Used By | Purpose |
|---|---|---|---|
| `--chat-bg-base` | Provider | `.chat-background-container` | Base fallback solid colour |
| `--chat-bg-gradient` | Provider | `.gradient-layer` | Theme linear-gradient |
| `--chat-bg-image` | Provider | `.gradient-layer` | Remote wallpaper photo URL |
| `--pattern-url` | Provider (async) | `.pattern-layer` | SVG Base64 data URI |
| `--chat-pattern-opacity` | Provider | `.pattern-layer` | 0.06 (over photo) / 0.11 (over gradient) |
| `--chat-pattern-blend` | Provider | `.pattern-layer` | `multiply` (light) or `overlay` (dark) |
| `--chat-pattern-size` | Provider | `.pattern-layer` | `420px` |
| `--chat-pattern-color` | Provider | svgColorizer | `#ffffff` or `#000000` |
| `--sent-message-bg` | Provider | Message bubbles | Sent bubble background |
| `--sent-message-text` | Provider | Message bubbles | Sent bubble text |
| `--received-message-bg` | Provider | Message bubbles | Received bubble background |
| `--received-message-text` | Provider | Message bubbles | Received bubble text |
| `--chat-header-bg` | Provider | ChatHeader | Header background |
| `--chat-header-text` | Provider | ChatHeader | Header text/icon |
| `--chat-input-bg` | Provider | MessageInput | Input bar background |
| `--scroll-percentage` | Provider | Scroll effects | Current scroll % (0–1) |

---

## 🗃️ State Model

### The State Object (inside `ChatThemeProvider`)

```js
{
    chatId:      string | null,   // Current open chat's ID
    themeKey:    string,          // Key into chatThemes object
    wallpaperUrl: string | null,  // Remote photo URL (EXCLUSIVE with patternId)
    patternId:   string | null,   // SVG pattern ID e.g. 'pattern', 'pattern-3'
                                  // null = no pattern
                                  // (EXCLUSIVE with wallpaperUrl)
    loading:     boolean,
}
```

> [!WARNING]
> `wallpaperUrl` and `patternId` are **mutually exclusive**.  
> When one is set, the other must be explicitly `null`.  
> If both are non-null simultaneously, both `--chat-bg-image` and `--pattern-url`  
> get set at the same time, causing undefined visual behaviour.

---

## 💾 Persistence Strategy

### LocalStorage Keys

```
digidad_chat_theme_{chatId}      → themeKey string
digidad_chat_wallpaper_{chatId}  → photo URL string   (only when photo is active)
digidad_chat_pattern_{chatId}    → pattern ID string  (only when pattern is active)
```

### Mutual Exclusion Rule (enforced in code)

| Action | Sets | Removes |
|---|---|---|
| `selectWallpaper(url)` | `LOCAL_WALLPAPER_KEY` | `LOCAL_PATTERN_KEY` |
| `selectPattern(id)` | `LOCAL_PATTERN_KEY` | `LOCAL_WALLPAPER_KEY` |

### Supabase Persistence

Both theme and wallpaper/pattern are persisted to Supabase for cross-device sync:

**Table: `chat_themes`**
```
chat_id  + set_by  (unique)
theme_name  → themeKey string
```

**Table: `chat_wallpapers`**
```
chat_id  + set_by  (unique)
custom_url  → photo URL  OR  "pattern:pattern-3"  (pattern prefix convention)
wallpaper_id → foreign key to wallpapers table (optional)
```

> The `"pattern:"` prefix in `custom_url` is the convention for storing  
> the selected pattern ID in the wallpapers table.

---

## 🔄 Data Flow: Loading a Chat

```
setChatId(chatId)
    │
    ├─► 1. readCache(chatId)              ← Synchronous, instant
    │       Reads localStorage
    │       Returns { themeKey, wallpaperUrl, patternId }
    │       setState(cached)  ← UI updates immediately
    │
    └─► 2. refreshTheme(chatId)           ← Async, background
            Fetches from Supabase
            (React Query with 5min stale time)
            setState(fresh values)  ← UI updates again if changed
```

### `readCache()` Logic

```
rawTheme    = localStorage.getItem(LOCAL_THEME_KEY)
rawWallpaper = localStorage.getItem(LOCAL_WALLPAPER_KEY)
rawPattern  = localStorage.getItem(LOCAL_PATTERN_KEY)

if (rawWallpaper exists):
    if starts with "pattern:":
        → patternId = rawWallpaper.replace("pattern:", "")
        → wallpaperUrl = null
        → migrate: move to LOCAL_PATTERN_KEY, remove LOCAL_WALLPAPER_KEY
    else:
        → wallpaperUrl = rawWallpaper
        → patternId = null
else if (rawPattern exists):
    → patternId = rawPattern
    → wallpaperUrl = null
else:
    → patternId = 'pattern'   ← default: show standard pattern
    → wallpaperUrl = null
```

---

## 🎨 Theme System

### A Theme Object

```js
spring_vibes: {
    name: 'Spring Vibes',
    category: 'Seasonal',
    is_pattern: true,         // Hint: this theme looks good with a pattern
    cssOnly: true,            // Doesn't require external assets
    background: 'linear-gradient(160deg, #ecfdf5 0%, #fef3c7 100%)',
    backgroundBase: '#ecfdf5', // Optional fallback solid colour
    sentMessage: {
        background: '#059669',
        text: '#ffffff',
    },
    receivedMessage: {
        background: '#ffffff',
        text: '#065f46',
    },
    // Optional — if absent, defaults are used:
    header: { background, text, iconColor },
    input:  { background, text, iconColor },
}
```

### Available Themes (16 total)

| Key | Name | Category | Has Pattern |
|---|---|---|---|
| `classic_purple` | Classic Purple | Default | ✅ |
| `midnight_amoled` | Midnight AMOLED | Dark | — |
| `electric_dreams` | Electric Dreams | Futuristic | — |
| `ocean_depths` | Ocean Depths | Nature | — |
| `sunset_glow` | Sunset Glow | Colorful | — |
| `forest_mist` | Forest Mist | Nature | — |
| `cyberpunk_neon` | Cyberpunk Neon | Dark | — |
| `telegram_blue` | Telegram Blue | Professional | — |
| `rose_gold` | Rose Gold | Elegant | — |
| `minimal_slate` | Minimal Slate | Professional | — |
| `spring_vibes` | Spring Vibes | Seasonal | ✅ |
| `winter_calm` | Winter Calm | Seasonal | ✅ |
| `cherry_blossom` | Cherry Blossom | Seasonal | ✅ |
| `desert_dunes` | Desert Dunes | Nature | ✅ |
| `custom_background` | Custom Background | Custom | — |
| `pattern_overlay` | Pattern Overlay | Premium | ✅ |

### Default Theme Logic

```js
// Light mode default
standardDefault = 'spring_vibes'

// Dark mode default  
standardDefault = 'cherry_blossom'
```

---

## 🌀 SVG Pattern System

### Available Patterns (10 total)

```
/public/assets/
├── pattern.svg        → 'pattern'    (Original WhatsApp)
├── pattern-1.svg      → 'pattern-1'  (Doodle Mix)
├── pattern-3.svg      → 'pattern-3'  (Botanical)
├── pattern-19.svg     → 'pattern-19' (Micro Dots)
├── pattern-22.svg     → 'pattern-22' (Circuit Board)
├── pattern-23.svg     → 'pattern-23' (Space)
├── pattern-24.svg     → 'pattern-24' (Geometric)
├── pattern-28.svg     → 'pattern-28' (Cityscape)
├── pattern-29.svg     → 'pattern-29' (Nature)
└── pattern-33.svg     → 'pattern-33' (Abstract Lines)
```

### SVG Colorization Flow

```
1. fetch('/assets/pattern-3.svg')          → raw SVG string

2. colorizeSVG(svgText, patternColor)
   ├── Replace all fill/stroke CSS rules
   ├── Replace all fill/stroke attributes
   ├── Replace bare hex colours in text
   ├── Inject <style> tag: svg * { fill: inherit !important }
   ├── Inject fill + stroke attrs on <svg> root element
   └── btoa(encodeURIComponent(svg))       → Base64 data URI

3. setProp('--pattern-url', `url("${dataUri}")`)
   → CSS var is live; .pattern-layer repaints automatically
```

### Pattern Color Selection

```js
effectivelyDark = (theme.category === 'Dark')
               || (isDarkMode)
               || (luminance of background < 0.45)

patternColor  = effectivelyDark ? '#ffffff' : '#000000'
// Pure white/black — opacity handles the subtlety,
// avoiding "double transparency" from alpha in SVG + alpha in CSS
```

---

## 🐛 Bugs Fixed (Root Cause Analysis)

### Bug 1 — Opaque Div Killing the Wallpaper *(Primary)*

**Where:** `chat.module.css` lines 205–226  
**What:** `.chat-main-area-content` had `background-color: var(--surface-color, #1f2c33)` and `.nested-chat-content` had `background-color: var(--bg-color, #0b141a)` — both fully opaque.

```
Layer 3 (content) was painted dark grey/black
→ Layers 0, 1, 2 underneath were completely invisible
→ No wallpaper, no gradient, no pattern ever showed
```

**Fix:** Set both to `background-color: transparent`.

---

### Bug 2 — Wrong CSS Selector for Override Block

**Where:** `chat.module.css` lines 228–234  
**What:** The CSS fallback override used `body[data-chat-theme]` but `applyThemeToDom` sets the attribute on `document.documentElement` (the `<html>` tag).

```css
/* BROKEN — targets <body> but attribute is on <html> */
:global(body[data-chat-theme]) :local(.chat-main-area-content) {
    background-color: transparent !important;
}
```

**Fix:** Changed to `html[data-chat-theme]` (and made it unnecessary by fixing Bug 1).

---

### Bug 3 — Debounce Blocking First Paint

**Where:** `ChatThemeProvider.jsx`  
**What:** `applyThemeToDom` was wrapped in `debounce(..., 100, { leading: true, trailing: true })`. In React StrictMode (double invoke), the leading edge was consumed by the first mount and the actual DOM update was delayed 100ms — meaning the first render always showed wrong colours.

**Fix:** Removed debounce entirely. `applyThemeToDom` is now called directly in the `useEffect`.

---

### Bug 4 — Pattern/Wallpaper Storage Collision

**Where:** `readCache()` in `ChatThemeProvider.jsx`  
**What:**
```js
// OLD — always defaults patternId to 'pattern'
let pattern = rawPattern || 'pattern';
```
When the user selected a photo wallpaper, `LOCAL_PATTERN_KEY` was removed. On next load, `rawPattern` was `null`, so `patternId` defaulted to `'pattern'` — making `showPattern` always `true`, even with a photo wallpaper active.

**Fix:** `patternId` now defaults to `null` unless explicitly stored:
```js
// NEW — explicit mutual exclusion
if (rawWallpaper) {
    wallpaperUrl = rawWallpaper;
    patternId = null;        // ← no pattern when photo is active
} else if (rawPattern) {
    patternId = rawPattern;
} else {
    patternId = 'pattern';   // ← only here do we default
}
```

---

### Bug 5 — `refreshTheme` Not Clearing PatternId

**Where:** `refreshTheme()` in `ChatThemeProvider.jsx`  
**What:** When Supabase returned a real photo URL, the code set `freshWallpaper = wallpaperData` but left `freshPattern = prevState.patternId` unchanged — so both were active simultaneously.

**Fix:**
```js
} else if (wallpaperData) {
    freshWallpaper = wallpaperData;
    freshPattern   = null;   // ← explicitly clear pattern
```

---

## 🔌 Public API (Context Value)

```js
const {
    // State (read-only)
    chatTheme,         // string — current themeKey
    chatWallpaper,     // string | null — current photo URL
    currentPattern,    // string | null — current pattern ID
    loading,           // boolean
    currentChatId,     // string | null
    currentThemeData,  // object — the full theme data for chatTheme

    // Data
    chatThemes,        // Record<string, ThemeObject> — all themes
    chatPatterns,      // Array<{id, name}> — all patterns

    // Actions
    setChatId(chatId),              // Call when entering a chat room
    selectTheme(themeKey),          // User picks a theme
    selectPattern(patternId),       // User picks an SVG pattern
    selectWallpaper(              
        wallpaperId,                // DB wallpaper ID (nullable)
        customUrl,                  // Direct URL (nullable)
        wallpaperUrl,               // Alias for customUrl (nullable)
    ),
    refreshTheme(chatId),           // Force re-fetch from Supabase
    setScrollPercentage(0–100),     // Update --scroll-percentage CSS var
} = useChatTheme();
```

### Usage in ChatScreen

```jsx
// 1. Register the current chat
useEffect(() => {
    if (chatId) setChatId(chatId);
}, [chatId, setChatId]);

// 2. Pass state to ChatBackground
<ChatBackground
    showPattern={Boolean(currentPattern) || Boolean(chatThemes[chatTheme]?.is_pattern)}
>
    {/* chat UI */}
</ChatBackground>
```

---

## ✅ Correct Working Flow (End-to-End)

```
User opens Chat A
    ↓
setChatId('chat-A')
    ↓
readCache('chat-A')  →  { themeKey: 'ocean_depths', wallpaperUrl: null, patternId: 'pattern-3' }
    ↓
setState(cached)
    ↓
useEffect fires → applyThemeToDom({ themeKey, wallpaperUrl: null, patternId: 'pattern-3' })
    ↓
Sets on :root:
    --chat-bg-gradient: linear-gradient(to bottom, #0f172a, #0e7490)
    --chat-bg-base:     #0b141a
    --chat-pattern-opacity: 0.11
    --chat-pattern-blend:   overlay
    --chat-pattern-color:   #ffffff
    (and removes --chat-bg-image since no photo)
    ↓
async: fetch('/assets/pattern-3.svg')
    → colorizeSVG(svgText, '#ffffff')
    → sets --pattern-url: url("data:image/svg+xml;base64,...")
    ↓
ChatBackground renders:
    .gradient-layer  ← shows ocean gradient ✅
    .pattern-layer   ← shows white botanical pattern at 11% opacity ✅
    .content-layer   ← transparent → chat UI visible on top ✅
```

---

## 🚫 Things to Never Do

1. **Never add `background-color` to `.chat-main-area-content`, `.nested-chat-content`, `.messages-container`, or `.chat-input-container`** — it will hide the wallpaper.

2. **Never set both `wallpaperUrl` and `patternId` to non-null values at the same time** — pick one, explicitly null the other.

3. **Never add inline `style={{ background: ... }}` to elements inside `ChatBackground`** — inline styles beat CSS variables and will override the theme.

4. **Never save `"pattern:xxx"` to `LOCAL_WALLPAPER_KEY` for new code** — use `LOCAL_PATTERN_KEY` directly. The `"pattern:"` prefix in `custom_url` is only for Supabase DB storage.

5. **Never set `data-chat-theme` attribute on `document.body`** — it's set on `document.documentElement` (`<html>`). CSS selectors must target `html[data-chat-theme]`.
