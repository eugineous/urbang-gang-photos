// Urban Gang Moments — Chunked Upload Handler
// Receives small base64 chunks and stores them in GitHub under /chunks/<uploadId>/
// A GitHub Action then assembles them and uploads the final file to GitHub Releases.

import { applyCors, rejectIfBlocked, isAllowedMedia } from './_security.js';

const OWNER = 'eugineous';
const REPO = 'urbang-gang-photos';
const RELEASE_TAG = 'ugc';

function safeSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (rejectIfBlocked(req, res)) return;

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'GitHub token not configured' });

  const {
    uploadId,
    album,
    filename,
    fileType,
    chunkIndex,
    totalChunks,
    content,
    finalize,
    size,
    lastModified,
  } = req.body || {};

  if (!uploadId || !album || !filename) {
    return res.status(400).json({ error: 'Missing required fields: uploadId, album, filename' });
  }

  if (!finalize && !isAllowedMedia(fileType, filename)) {
    return res.status(415).json({ error: 'Unsupported file type' });
  }

  const idx = Number(chunkIndex);
  const total = Number(totalChunks);

  if (!Number.isInteger(idx) || idx < 0) {
    return res.status(400).json({ error: 'Invalid chunkIndex' });
  }
  if (!Number.isInteger(total) || total <= 0) {
    return res.status(400).json({ error: 'Invalid totalChunks' });
  }

  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'Urban-Gang-Moments/1.0',
  };

  const uploadIdSafe = safeSegment(uploadId);
  const albumSafe = safeSegment(album);
  const filenameSafe = safeSegment(filename);

  const baseDir = `chunks/${uploadIdSafe}`;
  const partName = String(idx).padStart(6, '0') + '.part';
  const partPath = `${baseDir}/${partName}`;

  try {
    // Write chunk part (binary chunk stored as a file in the repo).
    if (content) {
      const body = {
        message: `chunk ${idx + 1}/${total} ${filenameSafe} [${albumSafe}]`,
        content,
        committer: { name: 'Urban Gang Moments', email: 'upload@urbangang.com' },
      };

      const put = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${partPath}`,
        { method: 'PUT', headers, body: JSON.stringify(body) }
      );

      const result = await put.json();
      if (!put.ok) {
        return res.status(put.status).json({ error: result.message || 'GitHub chunk upload failed' });
      }
    }

    if (finalize) {
      const manifest = {
        v: 1,
        uploadId: uploadIdSafe,
        album: albumSafe,
        filename: filenameSafe,
        fileType: fileType || '',
        totalChunks: total,
        size: typeof size === 'number' ? size : Number(size) || null,
        lastModified: typeof lastModified === 'number' ? lastModified : Number(lastModified) || null,
        parts: Array.from({ length: total }, (_, i) => `${String(i).padStart(6, '0')}.part`),
        createdAt: Date.now(),
      };

      const manifestPath = `${baseDir}/manifest.json`;
      const manifestBody = {
        message: `finalize ${filenameSafe} [${albumSafe}]`,
        content: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8').toString('base64'),
        committer: { name: 'Urban Gang Moments', email: 'upload@urbangang.com' },
      };

      const putManifest = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${manifestPath}`,
        { method: 'PUT', headers, body: JSON.stringify(manifestBody) }
      );

      const result = await putManifest.json();
      if (!putManifest.ok) {
        return res.status(putManifest.status).json({ error: result.message || 'GitHub finalize failed' });
      }

      const assetName = `release-${albumSafe}--${manifest.createdAt}--${filenameSafe}`;
      const expectedUrl = `https://github.com/${OWNER}/${REPO}/releases/download/${RELEASE_TAG}/${assetName}`;
      return res.status(200).json({
        success: true,
        finalized: true,
        uploadId: uploadIdSafe,
        releaseTag: RELEASE_TAG,
        assetName,
        expectedUrl,
      });
    }

    return res.status(200).json({ success: true, finalized: false, uploadId: uploadIdSafe, chunkIndex: idx });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '4mb' } },
};
