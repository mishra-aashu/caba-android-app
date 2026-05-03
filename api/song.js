import { decryptUrl, formatDownloadUrls } from './_utils/crypto.js';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ status: 'error', message: 'ID parameter is required' });
  }

  try {
    const detailsUrl = `https://www.jiosaavn.com/api.php?__call=song.getDetails&_format=json&_marker=0&ctx=web64bit&api_version=4&pids=${id}`;

    const response = await fetch(detailsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.jiosaavn.com/'
      }
    });

    const data = await response.json();
    let rawSong = data[id] || Object.values(data)[0];

    if (!rawSong || typeof rawSong !== 'object') {
      return res.status(404).json({ status: 'error', message: 'Song not found' });
    }

    const encryptedUrl = rawSong.more_info?.encrypted_media_url || 
                        rawSong.encrypted_media_url || 
                        rawSong.rawEncryptedUrl;

    const decryptedUrl = decryptUrl(encryptedUrl);
    const downloadUrl = formatDownloadUrls(decryptedUrl);

    const media_urls = {
        "320_KBPS": downloadUrl.find(d => d.quality === '320kbps')?.link || null,
        "160_KBPS": downloadUrl.find(d => d.quality === '160kbps')?.link || null,
        "96_KBPS": downloadUrl.find(d => d.quality === '96kbps')?.link || null
    };

    // Better artist extraction
    const singers = rawSong.more_info?.singers || 
                    rawSong.more_info?.primary_artists || 
                    rawSong.primary_artists || 
                    rawSong.subtitle || 
                    '';

    const result = {
        id: rawSong.id,
        name: rawSong.title || rawSong.song || rawSong.name || 'Unknown',
        title: rawSong.title || rawSong.song || rawSong.name || 'Unknown',
        album: rawSong.more_info?.album || rawSong.album || 'Single',
        year: rawSong.year || '',
        duration: parseInt(rawSong.more_info?.duration || rawSong.duration || 0),
        singers: singers,
        image: rawSong.image ? rawSong.image.replace('150x150', '500x500').replace('50x50', '500x500') : '',
        downloadUrl: downloadUrl,
        media_urls: media_urls,
        rawEncryptedUrl: encryptedUrl || '',
        decryptedUrl: decryptedUrl || null
    };

    res.status(200).json({
      status: 'success',
      data: [result]
    });

  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
}
