// Urban Gang Moments — Upload Handler
// Receives a base64-encoded file, pushes it to GitHub

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { filename, content, album, title, fileType } = req.body;

  if (!filename || !content || !album) {
    return res.status(400).json({ error: 'Missing required fields: filename, content, album' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'GitHub token not configured' });

  const OWNER = 'eugineous';
  const REPO  = 'urbang-gang-photos';

  // Safe filename with timestamp to avoid collisions
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `media/${album}/${Date.now()}-${safeName}`;

  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'Urban-Gang-Moments/1.0',
  };

  try {
    // Check if file already exists (need SHA for updates)
    let sha;
    const check = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`, { headers });
    if (check.ok) {
      const existing = await check.json();
      sha = existing.sha;
    }

    const body = {
      message: `📸 ${title || safeName} [${album}]`,
      content,
      committer: { name: 'Urban Gang Moments', email: 'upload@urbangang.com' },
    };
    if (sha) body.sha = sha;

    const upload = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`,
      { method: 'PUT', headers, body: JSON.stringify(body) }
    );

    const result = await upload.json();

    if (!upload.ok) {
      return res.status(upload.status).json({ error: result.message || 'GitHub upload failed' });
    }

    return res.status(200).json({
      success: true,
      url: result.content?.download_url,
      path: result.content?.path,
      sha: result.content?.sha,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '60mb' } },
};
