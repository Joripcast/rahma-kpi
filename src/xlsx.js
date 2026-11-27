/**
 * RAHMA Pure-Node OOXML (.xlsx) Reader & Writer
 * Zero external dependencies — uses built-in node:zlib for DEFLATE/ZIP.
 */

const zlib = require('node:zlib');

// ============================================================================
// CRC32 TABLE & HELPER
// ============================================================================
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXmlEntities(str) {
  return String(str ?? '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function colIndexToLetters(idx) {
  let n = idx + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function colLettersToIndex(letters) {
  let idx = 0;
  const upper = letters.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    idx = idx * 26 + (upper.charCodeAt(i) - 64);
  }
  return idx - 1;
}

// ============================================================================
// MINIMAL ZIP WRITER (STORED / DEFLATED)
// ============================================================================
function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const rawBuf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const compressedBuf = zlib.deflateRawSync(rawBuf);
    const crc = crc32(rawBuf);

    // Local File Header (30 bytes + filename)
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0); // signature
    lfh.writeUInt16LE(20, 4); // version needed
    lfh.writeUInt16LE(0x0800, 6); // UTF-8 flag
    lfh.writeUInt16LE(8, 8); // compression method: deflate
    lfh.writeUInt16LE(0, 10); // mod time
    lfh.writeUInt16LE(0x5421, 12); // mod date
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(compressedBuf.length, 18);
    lfh.writeUInt32LE(rawBuf.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28); // extra len

    localParts.push(lfh, nameBuf, compressedBuf);

    // Central Directory Header (46 bytes + filename)
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4); // version made by
    cdh.writeUInt16LE(20, 6); // version needed
    cdh.writeUInt16LE(0x0800, 8); // UTF-8 flag
    cdh.writeUInt16LE(8, 10); // deflate
    cdh.writeUInt16LE(0, 12);
    cdh.writeUInt16LE(0x5421, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(compressedBuf.length, 20);
    cdh.writeUInt32LE(rawBuf.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32);
    cdh.writeUInt16LE(0, 34);
    cdh.writeUInt16LE(0, 36);
    cdh.writeUInt32LE(0, 38);
    cdh.writeUInt32LE(offset, 42);

    centralParts.push(cdh, nameBuf);
    offset += lfh.length + nameBuf.length + compressedBuf.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

// ============================================================================
// MINIMAL ZIP READER (CENTRAL DIRECTORY BASED — HANDLES DATA DESCRIPTORS)
// ============================================================================
function readZipEntries(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) {
    throw new Error('Berkas bukan arsip .xlsx yang valid.');
  }

  // Locate End of Central Directory (EOCD)
  let eocdOffset = -1;
  const minOffset = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= minOffset; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Struktur ZIP (.xlsx) tidak valid atau korup.');
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  const files = new Map();
  let ptr = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (ptr + 46 > buffer.length || buffer.readUInt32LE(ptr) !== 0x02014b50) {
      throw new Error('Central Directory pada berkas .xlsx rusak.');
    }
    const method = buffer.readUInt16LE(ptr + 10);
    const compSize = buffer.readUInt32LE(ptr + 20);
    const nameLen = buffer.readUInt16LE(ptr + 28);
    const extraLen = buffer.readUInt16LE(ptr + 30);
    const commentLen = buffer.readUInt16LE(ptr + 32);
    const localOffset = buffer.readUInt32LE(ptr + 42);
    const fileName = buffer.slice(ptr + 46, ptr + 46 + nameLen).toString('utf8');
    ptr += 46 + nameLen + extraLen + commentLen;

    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      continue;
    }
    const lNameLen = buffer.readUInt16LE(localOffset + 26);
    const lExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const compSlice = buffer.slice(dataStart, dataStart + compSize);

    let rawData;
    if (method === 0) {
      rawData = compSlice;
    } else if (method === 8) {
      rawData = zlib.inflateRawSync(compSlice);
    } else {
      throw new Error(`Metode kompresi ZIP (${method}) tidak didukung.`);
    }
    files.set(fileName, rawData);
  }

  return files;
}

// ============================================================================
// XLSX WRITER
// ============================================================================
function buildWorksheetXml(rows = [], colWidths = []) {
  const colsXml =
    colWidths.length > 0
      ? `<cols>${colWidths
          .map(
            (w, idx) =>
              `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`
          )
          .join('')}</cols>`
      : '';

  const rowsXml = rows
    .map((row, rIdx) => {
      const rowNum = rIdx + 1;
      const cellsXml = (row || [])
        .map((val, cIdx) => {
          if (val === null || val === undefined || val === '') return '';
          const ref = `${colIndexToLetters(cIdx)}${rowNum}`;
          // Style 1 = Header (blue fill, bold white), Style 2 = Normal wrapped text, Style 0 = Default
          const styleAttr = rIdx === 0 ? ' s="1"' : typeof val === 'number' ? ' s="3"' : ' s="2"';
          if (typeof val === 'number' && Number.isFinite(val)) {
            return `<c r="${ref}"${styleAttr}><v>${val}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${escapeXml(
            String(val)
          )}</t></is></c>`;
        })
        .filter(Boolean)
        .join('');
      return `<row r="${rowNum}"${rIdx === 0 ? ' ht="26" customHeight="1"' : ''}>${cellsXml}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  ${colsXml}
  <sheetData>${rowsXml}</sheetData>
</worksheet>`;
}

function buildXlsxBuffer(sheets = []) {
  const safeSheets = sheets.length > 0 ? sheets : [{ name: 'Sheet1', rows: [] }];

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${safeSheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('\n  ')}
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${safeSheets
      .map(
        (s, i) =>
          `<sheet name="${escapeXml(String(s.name || `Sheet${i + 1}`).slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
      )
      .join('\n    ')}
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${safeSheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    )
    .join('\n  ')}
  <Relationship Id="rId${safeSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF007BC8"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  </cellXfs>
</styleSheet>`;

  const zipEntries = [
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: rootRelsXml },
    { name: 'xl/workbook.xml', data: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRelsXml },
    { name: 'xl/styles.xml', data: stylesXml },
    ...safeSheets.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: buildWorksheetXml(s.rows, s.colWidths || [])
    }))
  ];

  return buildZip(zipEntries);
}

// ============================================================================
// XLSX READER
// ============================================================================
function parseSharedStrings(xmlStr) {
  if (!xmlStr) return [];
  const strings = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let siMatch;
  while ((siMatch = siRegex.exec(xmlStr)) !== null) {
    const inner = siMatch[1];
    const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tMatch;
    let combined = '';
    while ((tMatch = tRegex.exec(inner)) !== null) {
      combined += decodeXmlEntities(tMatch[1]);
    }
    strings.push(combined);
  }
  return strings;
}

function parseWorksheetRows(xmlStr, sharedStrings = []) {
  const rows = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(xmlStr)) !== null) {
    const rowContent = rowMatch[1];
    const rowValues = [];
    const cellRegex = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch;
    let fallbackColIdx = 0;

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const attrs = cellMatch[1] || '';
      const body = cellMatch[2] || '';

      const refMatch = attrs.match(/\br="([A-Za-z]+)[0-9]+"/);
      const colIdx = refMatch ? colLettersToIndex(refMatch[1]) : fallbackColIdx;
      fallbackColIdx = colIdx + 1;

      const typeMatch = attrs.match(/\bt="([^"]+)"/);
      const cellType = typeMatch ? typeMatch[1] : 'n';

      let value = '';
      if (cellType === 'inlineStr') {
        const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
        let tMatch;
        while ((tMatch = tRegex.exec(body)) !== null) {
          value += decodeXmlEntities(tMatch[1]);
        }
      } else {
        const vMatch = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
        const rawVal = vMatch ? decodeXmlEntities(vMatch[1]) : '';
        if (cellType === 's') {
          const sIdx = Number(rawVal);
          value = Number.isInteger(sIdx) && sharedStrings[sIdx] !== undefined ? sharedStrings[sIdx] : '';
        } else if (cellType === 'str' || cellType === 'e') {
          value = rawVal;
        } else if (cellType === 'b') {
          value = rawVal === '1' ? 'TRUE' : 'FALSE';
        } else {
          // Numeric or empty
          value = rawVal === '' ? '' : Number(rawVal);
          if (rawVal !== '' && Number.isNaN(value)) {
            value = rawVal;
          }
        }
      }

      rowValues[colIdx] = value;
    }

    // Fill undefined sparse slots with ''
    for (let i = 0; i < rowValues.length; i++) {
      if (rowValues[i] === undefined) rowValues[i] = '';
    }
    rows.push(rowValues);
  }

  return rows;
}

function parseXlsxBuffer(buffer) {
  const files = readZipEntries(buffer);
  const sharedStringsXml = files.get('xl/sharedStrings.xml')?.toString('utf8') || '';
  const sharedStrings = parseSharedStrings(sharedStringsXml);

  // Resolve first worksheet path from workbook.xml + workbook.xml.rels
  let sheetName = 'Sheet1';
  let sheetPath = 'xl/worksheets/sheet1.xml';

  const workbookXml = files.get('xl/workbook.xml')?.toString('utf8');
  const relsXml = files.get('xl/_rels/workbook.xml.rels')?.toString('utf8');
  if (workbookXml) {
    const firstSheetMatch = workbookXml.match(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/);
    if (firstSheetMatch) {
      sheetName = decodeXmlEntities(firstSheetMatch[1]);
      const rId = firstSheetMatch[2];
      if (relsXml) {
        const relRegex = new RegExp(`<Relationship\\b[^>]*Id="${rId}"[^>]*Target="([^"]+)"`);
        const relMatch = relsXml.match(relRegex);
        if (relMatch) {
          const target = relMatch[1].replace(/^\/+/, '');
          sheetPath = target.startsWith('xl/') ? target : `xl/${target}`;
        }
      }
    }
  }

  const sheetXml = files.get(sheetPath)?.toString('utf8');
  if (!sheetXml) {
    throw new Error('Worksheet utama tidak ditemukan di dalam berkas .xlsx.');
  }

  const rows = parseWorksheetRows(sheetXml, sharedStrings);
  return { sheetName, rows };
}

module.exports = {
  buildXlsxBuffer,
  parseXlsxBuffer
};
