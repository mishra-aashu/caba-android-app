import React, { useState, useEffect } from 'react';

// 👇 Aapki Personal Details (Jo apne di hain)
const API_KEY = "xPPmDczWG59pEi8piP0khLhqbGvDuGUDWstVefb5ZPl4UamEy9DhHSAiKGPP7Kz7";
const APP_NAME = "dzsgggzs";

// Klipy Base URL (Confirm this from their docs, mostly it is this or similar)
const BASE_URL = "https://api.klipy.com/api/v1";

const KlipyGifPicker = ({ onSelectGif }) => {
  const [gifs, setGifs] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // --- 1. Fetch Function ---
  const fetchGifs = async (query) => {
    setLoading(true);
    try {
      // Agar search hai to 'search' endpoint, warna 'trending'
      const endpoint = query ? `/stickers/search` : `/stickers/trending`;

      const url = `${BASE_URL}${endpoint}?key=${API_KEY}&app_name=${APP_NAME}&q=${query}&limit=20`;

      const res = await fetch(url);
      const data = await res.json();

      // Klipy ka response structure check karke ye adjust karna pad sakta hai
      // Usually data.data ya data.results me hota hai
      if (data && data.data) {
        setGifs(data.data);
      }
    } catch (error) {
      console.error("Klipy Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. Initial Load & Search ---
  useEffect(() => {
    // Debounce: User ke rukne ke 500ms baad search karega
    const timer = setTimeout(() => {
      fetchGifs(search);
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  // --- 3. Handle Select (For Earning Tracking) ---
  const handleSelect = (gif) => {
    // ⚠️ IMP FOR EARNING:
    // Klipy aksar ek 'impression_url' deta hai jisko ping karna padta hai jab GIF use ho.
    // Agar response me 'impression_url' ho to usko fetch kar lena.
    if (gif.impression_url) {
      fetch(gif.impression_url, { mode: 'no-cors' });
    }

    // Chat me bhejo
    onSelectGif(gif.url || gif.images.fixed_height.url);
  };

  return (
    <div className="gif-picker-container">
      
      {/* Search Bar */}
      <div className="gif-search-bar">
        <input 
          type="text" 
          placeholder="Search GIFs via Klipy..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <span className="search-icon">🔍</span>
      </div>

      {/* GIF Grid (Masonry Style) */}
      <div className="gif-grid-scroll">
        {loading ? (
          <div className="gif-loading">Loading magic... ✨</div>
        ) : (
          <div className="gif-masonry">
            {gifs.map((gif) => (
              <div key={gif.id} className="gif-item" onClick={() => handleSelect(gif)}>
                <img 
                  src={gif.preview_url || gif.url} // Preview URL (Low quality for fast load)
                  alt="gif" 
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="tenor-branding">Powered by Klipy</div>
    </div>
  );
};

export default KlipyGifPicker;