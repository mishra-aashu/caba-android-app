import { decryptUrl, formatMediaUrls } from './_utils/crypto.js';

export default async function handler(req, res) {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ status: 'error', message: 'Query parameter is required' });
  }

  try {
    // JioSaavn Search API V4
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&n=20&p=1&_marker=0&ctx=web64bit&api_version=4&q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.jiosaavn.com/'
      }
    });

    if (!response.ok) {
      throw new Error(`JioSaavn API responded with ${response.status}`);
    }

    const data = await response.json();
    const results = (data.results || []).map(song => {
      // Step 2 & 3: Decrypt and Format URLs
      const rawUrl = song.more_info?.encrypted_media_url || song.encrypted_media_url;
      let mediaUrls = null;
      
      if (rawUrl) {
        const decrypted = decryptUrl(rawUrl);
        mediaUrls = formatMediaUrls(decrypted);
      }

      // Cleanup image URL (swap 150x150 with 500x500 for premium feel)
      const image = (song.image || '').replace('150x150', '500x500');

      return {
        id: song.id,
        name: song.title || song.song,
        title: song.title || song.song,
        album: song.album,
        year: song.year,
        duration: song.duration,
        singers: song.more_info?.singers || song.subtitle,
        image: image,
        media_urls: mediaUrls,
        rawEncryptedUrl: rawUrl
      };
    });

    res.status(200).json({
      status: 'success',
      data: {
        total: data.total || results.length,
        results: results
      }
    });

  } catch (error) {
    console.error('[API Search] Error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
}
