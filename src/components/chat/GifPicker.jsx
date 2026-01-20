import React, { useState, useEffect } from 'react';

// Tenor API Configuration (Google's GIF service, used by WhatsApp)
const TENOR_API_KEY = "LIVDSRZULELA";
const CLIENT_KEY = "CaBa_App";

const KlipyGifPicker = ({ onSelectGif }) => {
  const [gifs, setGifs] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Fetch GIFs from Tenor API
  const fetchGifs = async (query) => {
    setLoading(true);
    setError(false);
    try {
      let url = "";
      if (query) {
        url = `https://g.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&client_key=${CLIENT_KEY}&limit=20`;
      } else {
        url = `https://g.tenor.com/v1/trending?key=${TENOR_API_KEY}&client_key=${CLIENT_KEY}&limit=20`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.results) {
        setGifs(data.results);
      } else {
        setGifs([]);
      }
    } catch (err) {
      console.error("Tenor GIF Error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Initial load and search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGifs(search);
    }, 600); // Slightly longer debounce for better UX

    return () => clearTimeout(timer);
  }, [search]);

  // Handle GIF selection
  const handleSelect = (gif) => {
    // Tenor structure: gif.media[0].gif.url for full GIF
    const gifUrl = gif.media[0].gif.url;
    onSelectGif(gifUrl);
  };

  return (
    <div className="gif-picker-container">

      {/* Search Bar */}
      <div className="gif-search-bar">
        <input
          type="text"
          placeholder="Search Tenor GIFs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        {loading && <div className="search-spinner"></div>}
        {!loading && <span className="search-icon">🔍</span>}
      </div>

      {/* GIF Grid */}
      <div className="gif-grid-scroll">
        {loading && gifs.length === 0 ? (
          <div className="loading-container">
            <div className="spinner-big"></div>
            <p>Searching...</p>
          </div>
        ) : error ? (
          <div className="empty-state">❌ Failed to load GIFs. Check connection.</div>
        ) : gifs.length === 0 && !loading ? (
          <div className="empty-state">No GIFs found for "{search}"</div>
        ) : (
          <div className="gif-masonry">
            {gifs.map((gif) => (
              <div key={gif.id} className="gif-item" onClick={() => handleSelect(gif)}>
                <img
                  src={gif.media[0].nanogif.url} // Nano GIF for fast preview
                  alt="gif"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {!loading && <div className="tenor-branding">Via Tenor</div>}
    </div>
  );
};

export default KlipyGifPicker;