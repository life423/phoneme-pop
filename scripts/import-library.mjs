// Loads a folder of cards into the picture library: each image into private Blob Storage and
// one record per card into MongoDB. Signs in to storage with your az login (no keys).
//
//   npm run import-library -- ~/Desktop/mouth-pictures
//
// The folder holds the numbered images and cards.csv, with the columns
// file, order, title, sounds, note, collection. Safe to run again: a card that's already in
// the library (same collection and file) is updated, not added twice.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MongoClient, ObjectId } from 'mongodb';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { imageType } from '../server/index.js';
import { CARDS, CONTAINER, DATABASE } from '../server/library.js';
import { MAX_PICTURE_BYTES } from '../shared/pieces.js';

const QUOTE = String.fromCharCode(34);
const NEWLINE = String.fromCharCode(10);
const RETURN = String.fromCharCode(13);

// A small CSV reader: commas, quoted fields (with doubled quotes inside), either line ending.
function readCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === QUOTE && text[i + 1] === QUOTE) (field += QUOTE), i++;
      else if (c === QUOTE) quoted = false;
      else field += c;
    } else if (c === QUOTE) quoted = true;
    else if (c === ',') row.push(field), (field = '');
    else if (c === NEWLINE || c === RETURN) {
      if (c === RETURN && text[i + 1] === NEWLINE) i++;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  const [header, ...body] = rows;
  const names = header.map((h) => h.trim().toLowerCase());
  return body.map((cells) => Object.fromEntries(names.map((name, i) => [name, (cells[i] ?? '').trim()])));
}

// Width and height from the file itself.
function dimensions(bytes, type) {
  if (type === 'image/png') return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (type === 'image/jpeg') {
    for (let i = 2; i + 9 < bytes.length; ) {
      if (bytes[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = bytes[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
      }
      i += 2 + bytes.readUInt16BE(i + 2);
    }
  }
  return null;
}

const folder = process.argv[2];
const { MONGODB_URI: uri, AZURE_STORAGE_ACCOUNT: account } = process.env;
if (!folder || !uri || !account) {
  console.error('Usage: npm run import-library -- <folder with cards.csv>   (needs MONGODB_URI and AZURE_STORAGE_ACCOUNT in .env)');
  process.exit(1);
}

const cards = readCsv(readFileSync(path.join(folder, 'cards.csv'), 'utf8'));
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000, retryWrites: false });
const container = new BlobServiceClient(`https://${account}.blob.core.windows.net`, new DefaultAzureCredential()).getContainerClient(CONTAINER);
let problems = 0;
try {
  const records = client.db(DATABASE).collection(CARDS);
  for (const card of cards) {
    const label = `${card.file} (${card.title || 'no title'})`;
    const bytes = readFileSync(path.join(folder, card.file));
    const type = imageType(bytes);
    const size = type && dimensions(bytes, type);
    if (!type || !size) {
      console.error(`  skipped ${label}: not a JPEG or PNG this can read`);
      problems++;
      continue;
    }
    if (bytes.length > MAX_PICTURE_BYTES) console.warn(`  note: ${label} is ${(bytes.length / 1e6).toFixed(1)} MB, over the ${MAX_PICTURE_BYTES / 1e6} MB a session accepts`);
    const collection = card.collection || path.basename(folder);
    const existing = await records.findOne({ collection, file: card.file }, { projection: { _id: 1 } });
    const id = existing?._id ?? new ObjectId();
    const blobPath = `pictures/${id}/original.${type === 'image/png' ? 'png' : 'jpg'}`;
    await container.getBlockBlobClient(blobPath).uploadData(bytes, { blobHTTPHeaders: { blobContentType: type } });
    await records.updateOne(
      { _id: id },
      {
        $set: {
          collection,
          file: card.file,
          order: Number(card.order) || 0,
          title: card.title || path.parse(card.file).name,
          sounds: (card.sounds || '').split(',').map((s) => s.trim()).filter(Boolean),
          note: card.note || '',
          image: { path: blobPath, type, width: size.width, height: size.height, bytes: bytes.length },
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    console.log(`  ${existing ? 'updated' : 'added'}  ${label}  ${size.width}x${size.height}  id ${id}`);
  }
  console.log(`Library now has ${await records.countDocuments({})} card(s).${problems ? ` ${problems} skipped.` : ''}`);
} finally {
  await client.close();
}
