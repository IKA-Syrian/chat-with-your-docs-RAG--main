import { createRequire } from 'module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const buf = fs.readFileSync('C:/Users/i.alshalabi/Downloads/graduation_project.pdf');
const data = await pdfParse(buf);
const out = data.text;
fs.writeFileSync('.tmp-graduation_project.txt', out);
console.log('PAGES:', data.numpages);
console.log('CHARS:', out.length);
console.log('---FIRST 1500 CHARS---');
console.log(out.slice(0, 1500));
