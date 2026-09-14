import { readFileSync, writeFileSync } from 'node:fs';
const source=readFileSync('src/domain.js','utf8').replace('export const Domain','var Domain');
writeFileSync('apps-script/Domain.gs', source);
