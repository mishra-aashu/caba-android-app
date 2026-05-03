import { decryptUrl, formatDownloadUrls } from './_utils/crypto.js';

export default async function handler(req, res) {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ status: 'error', message: 'Query parameter is required' });
  }

  try {
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&n=20&p=1&_marker=0&ctx=web64bit&api_version=4&q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.jiosaavn.com/'
      }
    });

    const data = await response.json();
    const results = (data.results || []).map(song => {
        const encryptedUrl = song.more_info?.encrypted_media_url || 
                            song.encrypted_media_url || 
                            song.rawEncryptedUrl;

        const decryptedUrl = decryptUrl(encryptedUrl);
        const downloadUrl = formatDownloadUrls(decryptedUrl);

        const media_urls = {
            "320_KBPS": downloadUrl.find(d => d.quality === '320kbps')?.link || null,
            "160_KBPS": downloadUrl.find(d => d.quality === '160kbps')?.link || null,
            "96_KBPS": downloadUrl.find(d => d.quality === '96kbps')?.link || null
        };

        return {
            id: song.id,
            name: song.title || song.song || song.name,
            title: song.title || song.song || song.name,
            album: song.more_info?.album || song.album || 'Unknown',
            year: song.year || '',
            duration: parseInt(song.more_info?.duration || song.duration || 0),
            singers: song.more_info?.singers || song.primary_artists || song.singers || '',
            image: song.image ? song.image.replace('150x150', '500x500').replace('50x50', '500x500') : '',
            downloadUrl: downloadUrl,
            media_urls: media_urls,
            rawEncryptedUrl: encryptedUrl || '',
            decryptedUrl: decryptedUrl || null,
            debug: {
                hasEncrypted: !!encryptedUrl,
                hasDecrypted: !!decryptedUrl
            }
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
    res.status(500).json({ status: 'error', message: error.message });
  }
}
