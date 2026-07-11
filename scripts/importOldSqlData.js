// One-time migration: import the old site's `blog` and `tbl_pages` MySQL
// tables (exported as phpMyAdmin .sql dumps) into the new Mongo collections
// (Blog and CarSeoPage).
//
// Usage:
//   node scripts/importOldSqlData.js --dry-run     # parse + preview only, no DB writes
//   node scripts/importOldSqlData.js                # actually import
//
// Run from the server/ directory so dotenv picks up the right .env.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Blog = require('../src/models/Blog');
const CarSeoPage = require('../src/models/CarSeoPage');

const DRY_RUN = process.argv.includes('--dry-run');

const BLOG_SQL_PATH = path.join(require('os').homedir(), 'Downloads', 'blog.sql');
const PAGES_SQL_PATH = path.join(require('os').homedir(), 'Downloads', 'tbl_pages.sql');

// ─── Minimal MySQL dump VALUES parser ──────────────────────────────────────
// Handles a single `INSERT INTO \`table\` (...) VALUES (...),(...),...;`
// statement as produced by phpMyAdmin: quoted strings with backslash escapes
// and doubled-quote escapes, NULL, and bare numbers.
function parseInsertRows(sql, tableName) {
  const rows = [];
  const marker = `INSERT INTO \`${tableName}\``;
  let searchFrom = 0;

  while (true) {
    const stmtStart = sql.indexOf(marker, searchFrom);
    if (stmtStart === -1) break;
    const valuesKw = sql.indexOf('VALUES', stmtStart);

    // Parse tuples directly off the full string (not a pre-sliced substring)
    // so that ';' or ')' characters embedded inside quoted HTML content
    // (e.g. inline CSS "margin:0;padding:0;") never get mistaken for the
    // statement/tuple boundary.
    let i = valuesKw + 'VALUES'.length;
    while (i < sql.length) {
      while (i < sql.length && /[\s,]/.test(sql[i])) i++;
      if (sql[i] === ';') { i++; break; }
      if (sql[i] !== '(') throw new Error(`Unexpected char '${sql[i]}' at offset ${i} while scanning ${tableName} tuples`);
      i++; // consume '('
      const row = [];
      while (true) {
        while (/\s/.test(sql[i])) i++;
        if (sql.startsWith('NULL', i)) {
          row.push(null);
          i += 4;
        } else if (sql[i] === "'") {
          i++;
          let str = '';
          while (true) {
            if (i >= sql.length) throw new Error(`Unterminated string while parsing ${tableName} (started scanning near offset ${i})`);
            const ch = sql[i];
            if (ch === '\\') {
              const next = sql[i + 1];
              const map = { n: '\n', r: '\r', t: '\t', '0': '\0', "'": "'", '"': '"', '\\': '\\', Z: '\x1a' };
              str += map[next] !== undefined ? map[next] : next;
              i += 2;
            } else if (ch === "'" && sql[i + 1] === "'") {
              str += "'";
              i += 2;
            } else if (ch === "'") {
              i++;
              break;
            } else {
              str += ch;
              i++;
            }
          }
          row.push(str);
        } else {
          const start = i;
          while (i < sql.length && /[0-9.\-]/.test(sql[i])) i++;
          row.push(sql.slice(start, i));
        }
        while (/\s/.test(sql[i])) i++;
        if (sql[i] === ',') { i++; continue; }
        if (sql[i] === ')') { i++; break; }
        throw new Error(`Unexpected char '${sql[i]}' at offset ${i} while parsing ${tableName} row`);
      }
      rows.push(row);
    }
    searchFrom = i;
  }
  return rows;
}

const stripHtml = (html) => (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const slugify = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function importBlogs() {
  const sql = fs.readFileSync(BLOG_SQL_PATH, 'utf8');
  // columns: id, image, title, slug, description, meta_title, meta_key, meta_description, h1_tag
  const rows = parseInsertRows(sql, 'blog');
  console.log(`\n[blog] parsed ${rows.length} rows from ${BLOG_SQL_PATH}`);

  let created = 0, skipped = 0;
  for (const r of rows) {
    const [id, image, title, slugCol, description, metaTitle, metaKey, metaDescription, h1Tag] = r;
    const slug = slugCol || slugify(title);
    const excerpt = stripHtml(description).slice(0, 240) || title;

    if (DRY_RUN) {
      console.log(`  #${id} "${title}" -> slug=${slug}, excerpt="${excerpt.slice(0, 60)}..."`);
      continue;
    }

    const exists = await Blog.findOne({ slug });
    if (exists) { skipped++; continue; }

    await Blog.create({
      title,
      slug,
      excerpt,
      content: description,
      coverImage: image ? `https://veekaycabs.com/${image}` : undefined,
      author: 'Veekay Cabs Team',
      isPublished: true,
      publishedAt: new Date(),
      seoTitle: metaTitle || undefined,
      seoDescription: metaDescription || undefined,
      seoKeywords: metaKey || undefined,
    });
    created++;
  }
  if (!DRY_RUN) console.log(`[blog] created ${created}, skipped ${skipped} (already existed)`);
}

async function importPages() {
  const sql = fs.readFileSync(PAGES_SQL_PATH, 'utf8');
  // columns: id, page_title, slug, short_content, content, images, meta_keyword,
  // meta_description, status, created_on, updated_on, h1_tag, parent, author, robots, meta_title
  const rows = parseInsertRows(sql, 'tbl_pages');
  console.log(`\n[tbl_pages] parsed ${rows.length} rows from ${PAGES_SQL_PATH}`);

  let created = 0, skipped = 0;
  for (const r of rows) {
    const [
      id, pageTitle, slugCol, shortContent, content, images, metaKeyword,
      metaDescription, status, createdOn, updatedOn, h1Tag, parent, author, robots, metaTitle,
    ] = r;
    const slug = slugCol || slugify(pageTitle);

    if (DRY_RUN) {
      console.log(`  #${id} "${pageTitle}" -> slug=${slug}, status=${status}`);
      continue;
    }

    const exists = await CarSeoPage.findOne({ pageSlug: slug });
    if (exists) { skipped++; continue; }

    await CarSeoPage.create({
      pageName: pageTitle,
      pageSlug: slug,
      metaTitle: metaTitle || pageTitle,
      metaKeywords: metaKeyword || undefined,
      metaDescription: metaDescription || pageTitle,
      h1Tag: h1Tag || undefined,
      shortContent: shortContent || undefined,
      content: content || undefined,
      author: author || undefined,
      robots: robots || 'index, follow',
      parent: parent || undefined,
      isActive: status === '1',
    });
    created++;
  }
  if (!DRY_RUN) console.log(`[tbl_pages] created ${created}, skipped ${skipped} (already existed)`);
}

(async () => {
  try {
    if (!DRY_RUN) await connectDB();
    await importBlogs();
    await importPages();
  } catch (err) {
    console.error('Import failed:', err);
    process.exitCode = 1;
  } finally {
    if (!DRY_RUN) await mongoose.disconnect();
  }
})();
