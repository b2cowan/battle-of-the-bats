// Board Ready trust close-out 6 (owner 2026-11-18): player documents and templates are typed by their bytes, and filed
// under a cleaned name. The three upload routes share these rules (lib/document-upload.ts).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { sniffDocumentUpload, documentUploadMime, documentDisplayName, documentStoredName, checkDocumentUpload } from '../../lib/document-upload.ts';

const ascii = (s: string) => new TextEncoder().encode(s);
const bytes = (...parts: (number[] | Uint8Array)[]) => {
  const all = parts.flatMap(p => [...p]);
  return new Uint8Array(all);
};

describe('sniffDocumentUpload — what the bytes are', () => {
  test('PDF, JPEG, PNG and a Word .docx are recognised', () => {
    assert.equal(sniffDocumentUpload(ascii('%PDF-1.7\n...')), 'pdf');
    assert.equal(sniffDocumentUpload(bytes(ascii('\n\n  '), ascii('%PDF-1.4'))), 'pdf'); // the header may sit a little in
    assert.equal(sniffDocumentUpload(bytes([0xff, 0xd8, 0xff, 0xe0], ascii('JFIF'))), 'jpeg');
    assert.equal(sniffDocumentUpload(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])), 'png');
    assert.equal(sniffDocumentUpload(bytes([0x50, 0x4b, 0x03, 0x04], ascii('....[Content_Types].xml....word/document.xml'))), 'docx');
  });
  test('anything else is refused, whatever its name or claimed type', () => {
    assert.equal(sniffDocumentUpload(ascii('<html><script>alert(1)</script>')), null);
    assert.equal(sniffDocumentUpload(bytes([0x4d, 0x5a, 0x90, 0x00])), null); // a Windows program
    assert.equal(sniffDocumentUpload(bytes([0x50, 0x4b, 0x03, 0x04], ascii('xl/workbook.xml'))), null); // a zip that isn't Word
    assert.equal(sniffDocumentUpload(new Uint8Array(0)), null);
    assert.equal(sniffDocumentUpload(bytes(new Uint8Array(1100), ascii('%PDF-1.7'))), null); // header past the first 1,024 bytes
  });
  test('the stored type is the checked type', () => {
    assert.equal(documentUploadMime('pdf'), 'application/pdf');
    assert.equal(documentUploadMime('docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });
});

describe('names', () => {
  test('the key name is cleaned and ends in the checked type', () => {
    assert.equal(documentStoredName('../../other-club/waiver.pdf', 'pdf'), 'waiver.pdf');
    assert.equal(documentStoredName('Birth certificate (Sam).pdf', 'pdf'), 'Birth_certificate_Sam.pdf');
    assert.equal(documentStoredName('photo.JPEG', 'jpeg'), 'photo.JPEG');
    assert.equal(documentStoredName('form.exe', 'pdf'), 'form.exe.pdf');
    assert.equal(documentStoredName('', 'png'), 'document.png');
    assert.ok(!/[\\/]/.test(documentStoredName('a\\b/c..\\d.docx', 'docx')));
  });
  test('the shown name keeps the person’s spelling, minus folders and control characters', () => {
    assert.equal(documentDisplayName('Birth certificate (Sam).pdf', 'pdf'), 'Birth certificate (Sam).pdf');
    assert.equal(documentDisplayName('C:\\Users\\x\\Medical form.pdf', 'pdf'), 'Medical form.pdf');
    assert.equal(documentDisplayName('bad\u0000name\u001f.pdf', 'pdf'), 'badname.pdf');
    assert.equal(documentDisplayName('invoice‮fdp.exe', 'pdf'), 'invoicefdp.exe'); // a direction mark can't disguise it

    assert.equal(documentDisplayName('x'.repeat(300) + '.pdf', 'pdf').length, 200);
    // An emoji at the cut is kept whole, never halved (a lone surrogate fails the insert).
    const cut = documentDisplayName('😀'.repeat(250) + '.pdf', 'pdf');
    assert.equal(Array.from(cut).length, 200);
    assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(cut));
  });
});

describe('checkDocumentUpload — the routes’ one call', () => {
  test('a real file: its checked type, cleaned key name and shown name', () => {
    assert.deepEqual(checkDocumentUpload(ascii('%PDF-1.7 ...'), '../Medical form.pdf'),
      { contentType: 'application/pdf', storedName: 'Medical_form.pdf', displayName: 'Medical form.pdf' });
  });
  test('anything else is null; a large zip that is not Word is still refused', () => {
    assert.equal(checkDocumentUpload(ascii('<html>'), 'form.pdf'), null);
    assert.equal(checkDocumentUpload(bytes([0x50, 0x4b, 0x03, 0x04], new Uint8Array(2_000_000).fill(0x77)), 'big.docx'), null);
  });
  test('a door that takes fewer types refuses the rest (the narrowing stays for a future door; permits take all four since P8b)', () => {
    const docx = bytes([0x50, 0x4b, 0x03, 0x04], ascii('....word/document.xml'));
    assert.ok(checkDocumentUpload(docx, 'form.docx'), 'the four-type doors still take it');
    assert.equal(checkDocumentUpload(docx, 'form.pdf', ['pdf', 'jpeg', 'png']), null);
    assert.equal(checkDocumentUpload(ascii('%PDF-1.7'), 'x.pdf', ['pdf', 'jpeg', 'png'])?.contentType, 'application/pdf');
  });
});

describe('guard — a permit’s file checks the bytes too (leftover call 10; Word allowed, owner yes 2026-11-19 P8b, mig 507)', () => {
  test('app/api/admin/org/permits/document/route.ts', () => {
    const src = readFileSync('app/api/admin/org/permits/document/route.ts', 'utf8');
    assert.match(src, /const checked = checkDocumentUpload\(bytes, file\.name\);\s*if \(!checked\) return refusal\(400, 'file_type', PERMIT_FILE_TYPE_REFUSAL\)/);
    assert.match(src, /contentType: checked\.contentType/);
    assert.match(src, /-\$\{checked\.storedName\}`/);
    assert.match(src, /document_name: checked\.displayName/);
    assert.doesNotMatch(src, /file\.type/, 'never trusts the browser’s claim');
  });
});

describe('guard — every rep-team-documents upload checks the bytes', () => {
  const roots = ['app/api'];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name === 'route.ts') files.push(p);
    }
  };
  roots.forEach(walk);
  const uploaders = files.filter(f => /from\(\s*'rep-team-documents'\s*\)\s*\.upload\(/.test(readFileSync(f, 'utf8')));
  test('the three upload routes are found', () => {
    assert.ok(uploaders.length >= 3, `found ${uploaders.length}`);
  });
  for (const f of uploaders) {
    test(f, () => {
      const src = readFileSync(f, 'utf8');
      assert.match(src, /const upload = checkDocumentUpload\(bytes, file\.name\);\s*if \(!upload\)/, 'reads the type from the bytes');
      assert.match(src, /contentType:\s*upload\.contentType\b/, 'stores the checked type');
      assert.match(src, /-\$\{upload\.storedName\}`/, 'files the object under a cleaned name');
      assert.doesNotMatch(src, /contentType:\s*file\.type/, 'never stores the browser’s claim');
      assert.doesNotMatch(src, /\$\{file\.name\}/, 'never puts the raw name in a key');
    });
  }
});
