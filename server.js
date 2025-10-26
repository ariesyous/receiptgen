const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const OUTPUT_DIR =
  process.env.RECEIPT_OUTPUT_DIR || path.join(__dirname, 'data', 'receipts');

const ensureDirExists = (targetDir) => {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
};

const slugify = (input = '') =>
  input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'receipt';

ensureDirExists(OUTPUT_DIR);

app.use(
  express.json({
    limit: '15mb',
  })
);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/saved', express.static(OUTPUT_DIR));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    savedDir: OUTPUT_DIR,
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/receipts', async (req, res) => {
  try {
    const { imageData, fileName, meta = {} } = req.body || {};

    if (!imageData) {
      return res.status(400).json({ message: 'imageData is required.' });
    }

    const match = imageData.match(/^data:image\/(png|jpeg);base64,(.+)$/);
    if (!match) {
      return res
        .status(400)
        .json({ message: 'Only base64-encoded PNG or JPEG images are supported.' });
    }

    const [, mime, base64Payload] = match;
    const extension = mime === 'jpeg' ? 'jpg' : mime;
    const buffer = Buffer.from(base64Payload, 'base64');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeBaseName = slugify(fileName || meta.storeName || 'receipt');
    const diskName = `${safeBaseName}-${timestamp}.${extension}`;
    const diskPath = path.join(OUTPUT_DIR, diskName);

    await fs.promises.writeFile(diskPath, buffer);

    return res.status(201).json({
      savedAs: diskName,
      relativePath: `saved/${diskName}`,
      url: `/saved/${diskName}`,
      absolutePath: diskPath,
      size: buffer.length,
    });
  } catch (error) {
    console.error('Failed to persist receipt', error);
    return res.status(500).json({ message: 'Failed to save receipt.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

app.listen(PORT, () => {
  console.log(`Receipt generator listening on http://localhost:${PORT}`);
});
