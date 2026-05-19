import { decryptUrl, formatDownloadUrls } from './_utils/crypto.js';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ status: 'error', message: 'ID parameter is required' });
  }

  try {
    const API_BASE = Buffer.from('aHR0cHM6Ly93d3cuamlvc2Fhdm4uY29t', 'base64').toString('utf-8');
    const recsUrl = `${API_BASE}/api.php?__call=recommender.getAssetReccomendation&_format=json&_marker=0&ctx=web64bit&api_version=4&type=song&id=${id}`;

    const response = await fetch(recsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': `${API_BASE}/`
      }
    });

    const data = await response.json();
    
    // The recommender API sometimes returns an array directly or wrapped in data
    const rawResults = Array.isArray(data) ? data : (data.results || data.data || []);

    const results = rawResults.map(song => {
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

        const singers = song.more_info?.singers || 
                        song.more_info?.primary_artists || 
                        song.primary_artists || 
                        song.subtitle || 
                        '';

        return {
            id: song.id,
            name: song.title || song.song || song.name,
            title: song.title || song.song || song.name,
            album: song.more_info?.album || song.album || 'Unknown',
            year: song.year || '',
            duration: parseInt(song.more_info?.duration || song.duration || 0),
            singers: singers,
            image: song.image ? song.image.replace('150x150', '500x500').replace('50x50', '500x500') : '',
            downloadUrl: downloadUrl,
            media_urls: media_urls,
            rawEncryptedUrl: encryptedUrl || '',
            decryptedUrl: decryptedUrl || null
        };
    });

    res.status(200).json({
      status: 'success',
      data: results
    });

  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
}
