import { readFileSync, writeFileSync } from 'node:fs';
for(const name of ['Domain','Schedule']) {
  const source=readFileSync('src/'+name.toLowerCase()+'.js','utf8').replace('export const '+name,'var '+name);
  writeFileSync('apps-script/'+name+'.gs',source);
}
