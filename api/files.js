// Urban Gang Moments — File Listing Handler
// Lists files from a GitHub repo folder

const OWNER = 'eugineous';
const REPO  = 'urbang-gang-photos';
const RELEASE_TAG = 'ugc';
const MEDIA = /\.(jpg|jpeg|png|gif|webp|heic|mp4|mov|avi|mkv|raw|cr2|nef|arw|dng|pdf|mp3|wav|aac)$/i;

function getType(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','webp','heic'].includes(ext)) return 'photo';
  if (['mp4','mov','avi','mkv'].includes(ext)) return 'video';
  if (['raw','cr2','nef','arw','dng'].includes(ext)) return 'raw';
  if (['mp3','wav','aac'].includes(ext)) return 'audio';
  return 'file';
}

function formatSize(bytes) {
  if (!bytes) return '—';
  const mb = bytes / (1024 * 1024);
  return mb < 1 ? `${(bytes / 1024).toFixed(0)} KB` : mb < 1000 ? `${mb.toFixed(1)} MB` : `${(mb / 1024).toFixed(1)} GB`;
}

function parseReleaseAsset(asset) {
  // Expected: release-<album>--<createdAt>--<filename>
  const name = asset?.name || '';
  if (!name.startsWith('release-')) return null;

  const rest = name.slice('release-'.length);
  const parts = rest.split('--');
  if (parts.length < 3) return null;

  const album = parts[0];
  const filename = parts.slice(2).join('--');

  if (!album || !filename) return null;
  if (!MEDIA.test(filename)) return null;

  return {
    id: asset.id || asset.node_id || name,
    name: filename,
    path: `releases/${RELEASE_TAG}/${name}`,
    album,
    type: getType(filename),
    sz: formatSize(asset.size),
    size: asset.size,
    url: asset.browser_download_url,
    title: filename.replace(/^\d+-/, '').replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
  };
}

async function getReleaseFiles(headers) {
  try {
    const rel = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${RELEASE_TAG}`, { headers });
    if (rel.status === 404) return [];
    if (!rel.ok) return [];
    const relData = await rel.json();
    const assets = Array.isArray(relData?.assets) ? relData.assets : [];
    return assets.map(parseReleaseAsset).filter(Boolean);
  } catch (_) {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'GitHub token not configured' });

  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Urban-Gang-Moments/1.0',
  };

  const { album } = req.query;

  try {
    const releaseFiles = await getReleaseFiles(headers);

    if (album) {
      // List files in a specific album folder
      const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/media/${album}`, { headers });

      if (r.status === 404) return res.json({ files: [] });
      if (!r.ok) { const e = await r.json(); return res.status(r.status).json({ error: e.message }); }

      const data = await r.json();
      const repoFiles = Array.isArray(data)
        ? data
            .filter(f => f.type === 'file' && MEDIA.test(f.name))
            .map(f => ({
              id: f.sha,
              name: f.name,
              path: f.path,
              album,
              type: getType(f.name),
              sz: formatSize(f.size),
              size: f.size,
              url: f.download_url,
              title: f.name.replace(/^\d+-/, '').replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
            }))
        : [];

      const rel = releaseFiles.filter(f => f.album === album);
      return res.json({ files: [...repoFiles, ...rel] });

    } else {
      // List all albums (top-level folders under /media)
      const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/media`, { headers });

      if (r.status === 404) return res.json({ albums: [] });
      if (!r.ok) { const e = await r.json(); return res.status(r.status).json({ error: e.message }); }

      const data = await r.json();
      const albums = Array.isArray(data)
        ? data.filter(d => d.type === 'dir').map(d => ({ id: d.name, name: d.name, path: d.path }))
        : [];

      const releaseAlbums = Array.from(new Set(releaseFiles.map(f => f.album)))
        .map(a => ({ id: a, name: a, path: `releases/${RELEASE_TAG}/${a}` }));

      const merged = [...albums];
      const seen = new Set(merged.map(a => a.id));
      for (const a of releaseAlbums) {
        if (!seen.has(a.id)) merged.push(a);
      }

      return res.json({ albums: merged });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
