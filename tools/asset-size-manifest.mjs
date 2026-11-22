import {readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

export const SIZE_MANIFEST = 'asset-sizes.json';

export function writeAssetSizes(dist, opening = {}, streamed = []) {
  const sizes = {};
  function walk(dir, prefix) {
    for (const entry of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const file = join(dir,entry.name);
      const url = prefix + '/' + encodeURIComponent(entry.name);
      if (entry.isDirectory()) walk(file,url);
      else if (entry.isFile() && entry.name !== SIZE_MANIFEST) sizes[url] = statSync(file).size;
    }
  }
  walk(dist,'');
  const html = readFileSync(join(dist,'index.html'),'utf8');
  const aliases = JSON.parse(html.match(/window\.__assetAliases=(\{[^\n]*?\});/)?.[1] || '{}');
  for (const [source,target] of Object.entries(aliases)) {
    if (sizes[target] !== undefined) sizes[source] = sizes[target];
  }
  const profiles = Object.fromEntries(Object.entries(opening).map(([profile,{requests,models}]) => [
    profile,{
      downloads:[...new Set(requests)].filter(url=>sizes[url]>0).sort(),
      models:[...new Set(models)].filter(url=>sizes[url]>0).sort(),
    },
  ]));
  const openingUrls = new Set(Object.values(profiles).flatMap(profile=>profile.downloads));
  const later = [...new Set(streamed)].filter(url=>sizes[url]>0 && !openingUrls.has(url)).sort();
  const data = {sizes,aliases,opening:profiles,streamed:later};
  writeFileSync(join(dist,SIZE_MANIFEST),JSON.stringify(data)+'\n');
  return data;
}
