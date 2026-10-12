import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const source=resolve(process.argv[2] ?? 'gain-universal-v2');
const target=resolve('packages/engine/assets/live-adaptation-v2');
const names=['model.json','schema.json','reference-predictions.json'];
for(const name of names) if(!existsSync(join(source,name))) {
 console.error('Missing '+join(source,name)+'; extract gain-universal-v2.zip and pass the directory containing all three JSON files.');
 process.exit(1);
}
mkdirSync(target,{recursive:true});
for(const name of names) copyFileSync(join(source,name),join(target,name));
console.log('Copied exact trained v2 model, schema, and reference predictions to '+target);
