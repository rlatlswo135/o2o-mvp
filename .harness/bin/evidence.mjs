import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const MAX_ENTRIES = 100_000;
const MAX_FILE_BYTES = 256 * 1024 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
const ignored = (name, parent, isDirectory = false, isLink = false) => name === '.git' || name === 'node_modules' && (isDirectory || isLink) || parent === '' && (name === '.harness' || name === '.claude' || name === '.pi') || !isDirectory && ['AGENTS.md', 'CLAUDE.md', '.DS_Store', 'Thumbs.db'].includes(name);
const utf8 = b => { const s = b.toString('utf8'); if (!Buffer.from(s).equals(b)) throw new Error('Non-UTF8 product path is unsupported.'); return s; };
const hashFile = file => {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const stat = fs.fstatSync(fd); if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw new Error(`Invalid or oversized product file: ${file}`);
    const h = createHash('sha256'), buf = Buffer.alloc(1024 * 1024); let n, count = 0;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null))) { count += n; if (count > MAX_FILE_BYTES) throw new Error(`Product file grew past size limit: ${file}`); h.update(buf.subarray(0, n)); }
    return h.digest('hex');
  } finally { fs.closeSync(fd); }
};

// paths: the exact file list of a listing-based fingerprint (files-v3, as Buffers); without it the walk applies files-v2 rules.
export function sourceManifest(root, { paths } = {}) {
  root = path.resolve(root); if (!fs.lstatSync(root).isDirectory()) throw new Error('Source root must be a directory.');
  const out = Object.create(null); let total = 0, visited = 0;
  const add = (child, full, st) => {
    if (st.isSymbolicLink()) out[child] = { kind: 'link', target: utf8(fs.readlinkSync(full, { encoding: 'buffer' })) };
    else if (st.isFile()) { total += st.size; if (total > MAX_TOTAL_BYTES) throw new Error('Product manifest size limit exceeded.'); out[child] = { kind: 'file', mode: st.mode & 0o7777, hash: hashFile(full) }; }
    else throw new Error(`Unsupported special product file: ${child}`);
  };
  const walk = (dir, rel = '', depth = 0) => {
    if (depth > 64) throw new Error('Product tree depth limit exceeded.');
    for (const item of fs.readdirSync(dir, { encoding: 'buffer', withFileTypes: true })) {
      const name = utf8(item.name), child = rel ? `${rel}/${name}` : name;
      if (ignored(name, rel, item.isDirectory(), item.isSymbolicLink())) continue;
      if (child.split('/').some(part => part === '.' || part === '..' || part.includes('\\'))) throw new Error('Unsafe product path.');
      if (++visited > MAX_ENTRIES) throw new Error('Product manifest entry limit exceeded.');
      const full = path.join(dir, name), st = fs.lstatSync(full);
      if (st.isDirectory()) walk(full, child, depth + 1);
      else add(child, full, st);
    }
  };
  if (!paths) walk(root);
  else for (const name of paths) {
    const child = utf8(name), parts = child.split('/');
    if (parts.some(part => !part || part === '.' || part === '..' || part.includes('\\'))) throw new Error('Unsafe product path.');
    if (++visited > MAX_ENTRIES) throw new Error('Product manifest entry limit exceeded.');
    let current = root;
    for (const part of parts.slice(0, -1)) { current = path.join(current, part); if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Source path traverses symlink: ${child}`); }
    const full = path.join(root, ...parts);
    let st;
    try { st = fs.lstatSync(full); } catch (error) { if (error.code === 'ENOENT') continue; throw error; } // Deleted after listing.
    add(child, full, st);
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

export function diffManifest(before, after) {
  const a = new Set(Object.keys(before)), b = new Set(Object.keys(after));
  const added = [...b].filter(k => !a.has(k)), removed = [...a].filter(k => !b.has(k));
  const changed = [...b].filter(k => a.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  return { added: added.sort(), removed: removed.sort(), changed: changed.sort() };
}

export function copyProduct(root, destination, manifest) {
  root = path.resolve(root); destination = path.resolve(destination);
  if (!fs.lstatSync(root).isDirectory()) throw new Error('Source root must be a directory, not a symlink.');
  let ancestor = destination, missing = [];
  while (true) {
    try { fs.lstatSync(ancestor); break; }
    catch (e) { if (e.code !== 'ENOENT') throw e; missing.unshift(path.basename(ancestor)); ancestor = path.dirname(ancestor); }
  }
  let checked = path.parse(ancestor).root;
  for (const segment of path.relative(checked, ancestor).split(path.sep).filter(Boolean)) {
    checked = path.join(checked, segment);
    if (fs.lstatSync(checked).isSymbolicLink()) throw new Error('Destination traverses symlink.');
  }
  if (!missing.length) throw new Error('Destination already exists.');
  for (const part of missing) { ancestor = path.join(ancestor, part); }
  destination = ancestor;
  const entries = Object.entries(manifest); let total = 0;
  if (entries.length > MAX_ENTRIES) throw new Error('Product manifest entry limit exceeded.');
  const safePath = key => {
    if (typeof key !== 'string' || !key || key.startsWith('/') || key.includes('\\') || key.split('/').some(p => !p || p === '.' || p === '..') || key.split('/').some((p, i, a) => ignored(p, i === 0 ? '' : a.slice(0, i).join('/'), i < a.length - 1, false))) throw new Error(`Unsafe manifest path: ${key}`);
    return key;
  };
  for (const [key, value] of entries) {
    safePath(key);
    if (value.kind === 'link') {
      if (typeof value.target !== 'string' || path.isAbsolute(value.target) || value.target.includes('\\')) throw new Error(`Unsafe link target: ${key}`);
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(key), value.target));
      if (resolved === '..' || resolved.startsWith('../') || ignored(resolved.split('/')[0], '')) throw new Error(`Link outside product or excluded: ${key}`);
      if (!manifest[resolved] || manifest[resolved].kind === 'link') throw new Error(`Link target is not copied regular file: ${key}`);
    } else if (value.kind !== 'file' || !Number.isInteger(value.mode) || value.mode < 0 || value.mode > 0o777 || !/^[a-f0-9]{64}$/.test(value.hash)) throw new Error(`Invalid manifest entry or privileged mode: ${key}`);
  }
  // Preflight all source paths and links before creating destination or copying bytes.
  for (const [key, value] of entries) {
    let current = root;
    for (const part of key.split('/')) { current = path.join(current, part); const st = fs.lstatSync(current); if (st.isSymbolicLink() && current !== path.join(root, key)) throw new Error(`Source path traverses symlink: ${key}`); }
    const st = fs.lstatSync(path.join(root, key));
    if (value.kind === 'file') { total += st.size; if (total > MAX_TOTAL_BYTES) throw new Error('Product copy size limit exceeded.'); }
    if (value.kind === 'file' && (!st.isFile() || st.size > MAX_FILE_BYTES || (st.mode & 0o7777) !== value.mode || hashFile(path.join(root, key)) !== value.hash)) throw new Error(`Source changed or invalid: ${key}`);
    if (value.kind === 'link' && (!st.isSymbolicLink() || utf8(fs.readlinkSync(path.join(root, key), { encoding: 'buffer' })) !== value.target)) throw new Error(`Source link changed: ${key}`);
  }
  let created = false;
  try {
    fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    fs.mkdirSync(destination, { recursive: false, mode: 0o700 }); created = true;
    for (const [key, value] of entries) {
      const target = path.join(destination, ...key.split('/')); fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      if (value.kind === 'link') fs.symlinkSync(value.target, target);
      else {
        const fd = fs.openSync(path.join(root, key), fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
        let data;
        try {
          const stat = fs.fstatSync(fd); if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw new Error(`Source changed: ${key}`);
          const buffer = Buffer.alloc(stat.size + 1); let offset = 0, n;
          while (offset < buffer.length && (n = fs.readSync(fd, buffer, offset, buffer.length - offset, null))) offset += n;
          if (offset > stat.size) throw new Error(`Source grew during copy: ${key}`);
          data = buffer.subarray(0, offset);
        } finally { fs.closeSync(fd); }
        if (data.length > MAX_FILE_BYTES || createHash('sha256').update(data).digest('hex') !== value.hash) throw new Error(`Source changed during copy: ${key}`);
        fs.writeFileSync(target, data, { flag: 'wx', mode: value.mode }); fs.chmodSync(target, value.mode);
      }
    }
    return destination;
  } catch (error) { if (created) fs.rmSync(destination, { recursive: true, force: true }); throw error; }
}
