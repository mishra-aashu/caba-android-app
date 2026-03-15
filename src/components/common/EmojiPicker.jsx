import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smile, Search, X } from 'lucide-react';
import { useEmojiStyle } from '../../contexts/EmojiStyleContext';
import KlipyGifPicker from '../chat/GifPicker.jsx';
import './EmojiPicker.css';

const BASIC_EMOJIS = [
  { id: 'smileys', name: 'Smileys & People', emojis: '😀 😃 😄 😁 😆 😅 😂 🤣 🥲 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🫣 🤗 🤔 🫢 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👹 👺 🤡 💩 👻 💀 👽 👾 🤖 🎃 😺 😸 😹 😻 😼 😽 🙀 😿 😾 👋 🤚 🖐 ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦵 🦶 👂 🦻 👃 🧠 🫀 🫁 🦷 骨 👀 👁 👅 👄 💋 🩸'.split(' ') },
  { id: 'animals', name: 'Animals & Nature', emojis: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐽 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🐣 🐥 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🪱 🐛 🦋 🐌 🐞 🐜 🪰 🪲 🪳 🦟 🦗 🕷 🕸 🦂 🐢 🐍 🦎 🦖 🦕 🐙 🦑 🦐 🦞 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🦭 🐊 🐅 🐆 🦓 🦍 🦧 🦣 🐘 🦛 🦏 🐪 🐫 🦒 🦘 🦬 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🦮 🐕‍🦺 🐈 🐈‍⬛ 🐓 🦃 🦤 🦚 🦜 🦢 🦩 🕊 🐇 🦝 🦨 🦡 🦫 🦦 🦥 🐁 🐀 🐿 🦔 🐉 🐲 🌵 🎄 🌲 🌳 🌴 🌱 🌿 ☘️ 🍀 🎍 🪴 🎋 🍃 🍂 🍁 🍄 🐚 🪨 🌾 💐 🌷 🌹 🥀 🌺 🌸 🌼 🌻 🌞 🌝 🌛 🌜 🌚 🌕 🌖 🌗 🌘 🌑 🌒 🌓 🌔 🌙 🌎 🌍 🌏 🪐 💫 ⭐️ 🌟 ✨ ⚡️ ☄️ 💥 🔥 🌪 🌈 ☀️ 🌤 ⛅️ 🌥 ☁️ 🌦 🌧 ⛈ 🌩 🌨 ❄️ ☃️ ⛄️ 🌬 💨 💧 💦 ☔️ ☂️ 🌊 🌫'.split(' ') },
  { id: 'food', name: 'Food & Drink', emojis: '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶 🫑 🌽 🥕 🫒 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🦴 🌭 🍔 🍟 🍕 🫓 🥪 🥙 🧆 🌮 🌯 🫔 🥗 🥘 🫕 🥫 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🦪 🍤 🍙 🍚 🍘 🍥 🥠 🥮 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥜 🍯 🥛 🍼 🫖 ☕️ 🍵 🧃 🥤 🧋 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧉 🍾 🧊 🥄 🍴 🍽 🥣 🥡 🥢 🧂'.split(' ') },
  { id: 'activities', name: 'Activities', emojis: '⚽️ 🏀 🏈 ⚾️ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🪃 🥅 ⛳️ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸ 🥌 🎿 ⛷ 🏂 🪂 🏋️‍♀️ 🏋️ 🏋️‍♂️ 🤼‍♀️ 🤼 🤼‍♂️ 🤸‍♀️ 🤸 🤸‍♂️ ⛹️‍♀️ ⛹️ ⛹️‍♂️ 🤺 🤾‍♀️ 🤾 🤾‍♂️ 🏌️‍♀️ 🏌️ 🏌️‍♂️ 🏇 🧘‍♀️ 🧘 🧘‍♂️ 🏄‍♀️ 🏄 🏄‍♂️ 🏊‍♀️ 🏊 🏊‍♂️ 🤽‍♀️ 🤽 🤽‍♂️ 🚣‍♀️ 🚣 🚣‍♂️ 🧗‍♀️ 🧗 🧗‍♂️ 🚵‍♀️ 🚵 🚵‍♂️ 🚴‍♀️ 🚴 🚴‍♂️ 🏆 🥇 🥈 🥉 🏅 🎖 🏵 🎗 🎫 🎟 🎪 🤹 🤹‍♂️ 🤹‍♀️ 🎭 🩰 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🪘 🎷 🎺 🪗 🎸 🪕 🎻 🎲 ♟ 🎯 🎳 🎮 🎰 🧩'.split(' ') },
  { id: 'objects', name: 'Objects', emojis: '⌚️ 📱 📲 💻 ⌨️ 🖥 🖨 🖱 🖲 🕹 🗜 💽 💾 💿 📀 📼 📷 📸 📹 🎥 📽 🎞 📞 ☎️ 📟 📠 📺 📻 🎙 🎚 🎛 🧭 ⏱ ⏲ ⏰ 🕰 ⌛️ ⏳ 📡 🔋 🔌 💡 🔦 🕯 🪔 🧯 🛢 💸 💵 💴 💶 💷 🪙 💰 💳 💎 ⚖️ 🪜 🧰 🪛 🔧 🔨 ⚒ 🛠 ⛏ 🪚 🔩 ⚙️ 🪤 🧱 ⛓ 🧲 🔫 💣 🧨 🪓 🔪 🗡 ⚔️ 🛡 🚬 ⚰️ 🪦 ⚱️ 🏺 🔮 📿 🧿 💈 ⚗️ 🔭 🔬 🕳 🩹 🩺 💊 💉 🩸 🧬 🦠 🧫 🧪 🌡 🧹 🪠 🧺 🧻 🚽 🚰 🚿 🛁 🛀 🧼 🪥 🪒 🧽 🪣 🧴 🛎 🔑 🗝 🚪 🪑 🛋 🛏 🛌 🧸 🪆 🖼 🪞 🪟 🛍 🛒 🎁 🎈 🎏 🎀 🪄 🪅 🎊 🎉 🎎 🏮 🎐 🧧 ✉️ 📩 📨 📧 💌 📥 📤 📦 🏷 🪧 📪 📫 📬 📭 📮 📯 📜 📃 📄 📑 🧾 📊 📈 📉 🗒 🗓 📆 📅 🗑 📇 🗃 🗳 🗄 📋 📁 📂 🗂 🗞 📰 📓 📔 📒 📕 📗 📘 📙 📚 📖 🔖 🧷 🔗 📎 🖇 📐 📏 🧮 📌 📍 ✂️ 🖊 🖋 ✒️ 🖌 🖍 📝 ✏️ 🔍 🔎 🔏 🔐 🔒 🔓'.split(' ') },
  { id: 'symbols', name: 'Symbols', emojis: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉 ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈️ ♉️ ♊️ ♋️ ♌️ ♍️ ♎️ ♏️ ♐️ ♑️ ♒️ ♓️ 🆔 ⚛️ 🉑 ☢️ ☣️ 📴 📳 🈶 🈚️ 🈸 🈺 🈷️ ✴️ 🆚 💮 🉐 ㊙️ ㊗️ 🈴 🈵 🈹 🈲 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ❌ ⭕️ 🛑 ⛔️ 📛 🚫 💯 💢 ♨️ 🚷 🚯 🚳 🚱 🔞 📵 🚭 ❗️ ❕ ❓ ❔ ‼️ ⁉️ 🔅 🔆 〽️ ⚠️ 🚸 🔱 ⚜️ 🔰 ♻️ ✅ 🈯️ 💹 ❇️ ✳️ ❎ 🌐 💠 Ⓜ️ 🌀 💤 🏧 🚾 ♿️ 🅿️ 🛗 🈳 🈂️ 🛂 🛃 🛄 🛅 🚹 🚺 🚼 ⚧ 🚻 🚮 🎦 📶 🈁 🔣 ℹ️ 🔤 🔡 🔠 🆖 🆗 🆙 🆒 🆕 🆓 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 🔢 #️⃣ *️⃣ ⏏️ ▶️ ⏸ ⏯ ⏹ ⏺ ⏭ ⏮ ⏩ ⏪ ⏫ ⏬ ◀️ 🔼 🔽 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ ↙️ ↖️ ↕️ ↔️ ↪️ ↩️ ⤴️ ⤵️ 🔀 🔁 🔂 🔄 🔃 🎵 🎶 ➕ ➖ ➗ ✖️ ♾ 💲 💱 ™️ ©️ ®️ 〰️ ➰ ➿ 🔚 🔙 🔛 🔝 🔜 ✔️ ☑️ 🔘 🔴 🟠 🟡 🟢 🔵 🟣 ⚫️ ⚪️ 🟤 🔺 🔻 🔸 🔹 🔶 🟦 🟫 ⬛️ ⬜️ 🟥 🟧 🟨 🟩 🟪 🔈 🔇 🔉 🔊 🔔 🔕 📣 📢 👁‍🗨 💬 💭 🗯 ♠️ ♣️ ♥️ ♦️ 🃏 🎴 🀄️ 🕐 🕑 🕒 🕓 🕔 🕕 🕖 🕗 🕘 🕙 🕚 🕛 🕜 🕝 🕞 🕟 🕠 🕡 🕢 🕣 🕤 🕥 🕦 🕧'.split(' ') }
];

const formatHex = (native) => {
    return Array.from(native)
      .map((c) => c.codePointAt(0).toString(16).toLowerCase().padStart(4, '0'))
      .join('-');
};

const ALL_PROCESSED_CATEGORIES = BASIC_EMOJIS.map(cat => ({
    id: cat.id,
    emojis: cat.emojis.map(native => ({
        id: formatHex(native),
        name: native,
        native: native,
        hex: formatHex(native)
    }))
}));

const EmojiPicker = ({
    onEmojiSelect,
    onClose,
    buttonClassName = '',
    showCloseButton = true,
    isOpen: controlledIsOpen,
    onOpenChange,
    showTrigger = true,
    isInline = false
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('emoji');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('smileys');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [renderLevel, setRenderLevel] = useState(0);

    const { emojiStyle } = useEmojiStyle();

    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
    const pickerRef = useRef(null);
    const scrollRef = useRef(null);

    // Initial render level
    useEffect(() => {
        if (isOpen) {
            setRenderLevel(1);
        } else {
            setRenderLevel(0);
        }
    }, [isOpen]);

    // Incremental rendering logic
    useEffect(() => {
        if (isOpen && renderLevel > 0 && renderLevel < ALL_PROCESSED_CATEGORIES.length) {
            const timer = setTimeout(() => {
                setRenderLevel(prev => prev + 1);
            }, 60);
            return () => clearTimeout(timer);
        }
    }, [isOpen, renderLevel]);

    // Filtered emojis based on search
    const filteredEmojis = useMemo(() => {
        if (!searchQuery) return null;
        const query = searchQuery.toLowerCase();
        let matches = [];
        
        for (const cat of ALL_PROCESSED_CATEGORIES) {
            if (cat.name?.toLowerCase().includes(query) || cat.id.toLowerCase().includes(query)) {
                matches.push(...cat.emojis);
            }
        }
        return matches.slice(0, 50);
    }, [searchQuery]);

    const handleEmojiSelect = useCallback((emojiData) => {
        const nativeEmoji = emojiData.native || (emojiData.skins && emojiData.skins[0]?.native);
        onEmojiSelect(nativeEmoji);
    }, [onEmojiSelect]);

    const handleToggle = useCallback(() => {
        if (onOpenChange) {
            onOpenChange(!isOpen);
        } else {
            setInternalIsOpen(!isOpen);
        }
    }, [isOpen, onOpenChange]);

    const scrollToCategory = useCallback((categoryId) => {
        setActiveCategory(categoryId);
        setSearchQuery('');
        const element = document.getElementById(`cat-${categoryId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, []);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target.closest('.emoji-toggle-btn')) return;
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                if (onOpenChange) onOpenChange(false);
                else setInternalIsOpen(false);
                onClose && onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside, true);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, [isOpen, onOpenChange, onClose]);

    return (
        <div 
            className={`emoji-picker-container ${!showTrigger ? 'no-trigger' : ''}`} 
            ref={pickerRef}
        >
            {showTrigger && (
                <button
                    type="button"
                    className={`emoji-picker-btn ${buttonClassName}`}
                    onClick={handleToggle}
                    title="Add emoji"
                >
                    <Smile size={20} />
                </button>
            )}

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className={`emoji-picker-popup ${isOpen ? 'visible' : ''} ${isInline ? 'inline' : ''}`}
                        initial={isInline ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 15 }}
                        animate={isInline ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                        exit={isInline ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 20 }}
                        transition={{
                            type: 'spring',
                            damping: 25,
                            stiffness: 300,
                            duration: 0.2
                        }}
                    >
                        <div className="picker-header">
                            <div className="picker-tabs">
                                <button
                                    className={`tab-btn ${activeTab === 'emoji' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('emoji')}
                                >
                                    Emoji
                                </button>
                                <button
                                    className={`tab-btn ${activeTab === 'gif' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('gif')}
                                >
                                    GIF
                                </button>
                            </div>
                            <div className="header-actions">
                                {activeTab === 'emoji' && (
                                    <button
                                        className={`header-action-btn ${isSearchOpen ? 'active' : ''}`}
                                        onClick={() => {
                                            setIsSearchOpen(!isSearchOpen);
                                            if (isSearchOpen) setSearchQuery('');
                                        }}
                                        title="Search emojis"
                                    >
                                        <Search size={18} />
                                    </button>
                                )}
                                {showCloseButton && (
                                    <button
                                        className="header-close-btn"
                                        onClick={() => {
                                            if (onOpenChange) onOpenChange(false);
                                            else setInternalIsOpen(false);
                                            onClose && onClose();
                                        }}
                                        title="Close"
                                    >
                                        <X size={18} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="picker-body">
                            {activeTab === 'emoji' && (
                                <>
                                    {/* SEARCH BAR (Conditional) */}
                                    {isSearchOpen && (
                                        <div className="gif-search-bar">
                                            <input
                                                type="text"
                                                placeholder="Search emojis..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                autoFocus
                                            />
                                            <Search className="search-icon" size={16} />
                                        </div>
                                    )}

                                    {/* CATEGORY BAR */}
                                    {!searchQuery && (
                                        <div className="emoji-category-bar">
                                            {ALL_PROCESSED_CATEGORIES.map(cat => (
                                                <button
                                                    key={cat.id}
                                                    className={`cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
                                                    onClick={() => scrollToCategory(cat.id)}
                                                    title={cat.id}
                                                >
                                                    {cat.emojis[0]?.native}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* EMOJI GRID - All categories rendered upfront, no lazy loading */}
                                    <div className="emoji-scroll-area" ref={scrollRef}>
                                        {searchQuery ? (
                                            <div className="emoji-grid">
                                                {filteredEmojis.map(emoji => (
                                                    <EmojiItem
                                                        key={emoji.id}
                                                        emoji={emoji}
                                                        style={emojiStyle}
                                                        onSelect={handleEmojiSelect}
                                                    />
                                                ))}
                                                {filteredEmojis.length === 0 && <div className="no-recent">No emojis found</div>}
                                            </div>
                                        ) : (
                                            <>
                                                {/* Incremental Rendering: Only render up to renderLevel categories */}
                                                {ALL_PROCESSED_CATEGORIES.slice(0, renderLevel).map(cat => (
                                                    <div key={cat.id} id={`cat-${cat.id}`} className="category-section">
                                                        <div className="emoji-grid">
                                                            {cat.emojis.map(emoji => (
                                                                <EmojiItem
                                                                    key={emoji.id}
                                                                    emoji={emoji}
                                                                    style={emojiStyle}
                                                                    onSelect={handleEmojiSelect}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Show a skeleton/placeholder for the rest if still rendering */}
                                                {renderLevel < ALL_PROCESSED_CATEGORIES.length && (
                                                    <div className="emoji-loading-placeholder" style={{ height: '300px' }}></div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </>
                            )}

                            {activeTab === 'gif' && (
                                <KlipyGifPicker
                                    onSelectGif={(gifUrl) => onEmojiSelect(gifUrl)}
                                />
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Use memo to prevent re-rendering every emoji on every picker update
const EmojiItem = memo(({ emoji, style, onSelect }) => {
    const [hasError, setHasError] = useState(false);
    const assetPath = `/assets/emojis/${style}/${emoji.hex}.webp`;

    return (
        <div
            className="emoji-item"
            onClick={() => onSelect(emoji)}
            title={emoji.name}
        >
            {(!hasError && style !== 'native') ? (
                <img
                    src={assetPath}
                    alt={emoji.name}
                    onError={() => setHasError(true)}
                    className="emoji-img"
                />
            ) : (
                <span style={{ fontSize: '1em' }}>{emoji.native}</span>
            )}
        </div>
    );
});

export default EmojiPicker;
