import { register } from 'node:module';

const inlineLoaderCode = `
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve as pathResolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/headers' || specifier === 'next/headers.js') {
    return {
      url: 'data:text/javascript,' + encodeURIComponent(\`
        const cookieJar = new Map();
        export function setTestCookie(k, v) { if (v === null || v === undefined) cookieJar.delete(k); else cookieJar.set(k, v); }
        export function getTestCookieEntry(k) { return cookieJar.get(k); }
        export function clearTestCookies() { cookieJar.clear(); }
        export async function cookies() {
          return {
            get: (k) => {
              if (!cookieJar.has(k)) return undefined;
              const val = cookieJar.get(k);
              return typeof val === 'object' && val !== null && 'value' in val
                ? { name: k, value: val.value }
                : { name: k, value: val };
            },
            set: (k, v, options) => {
              cookieJar.set(k, { value: v, options });
            },
            delete: (k) => cookieJar.delete(k),
          };
        }
        export async function headers() { return new Headers(); }
      \`),
      shortCircuit: true,
    };
  }
  if (specifier === 'next/cache' || specifier === 'next/cache.js') {
    return {
      url: 'data:text/javascript,' + encodeURIComponent(\`
        export function revalidatePath() {}
        export function revalidateTag() {}
      \`),
      shortCircuit: true,
    };
  }
  if (specifier.startsWith('@/')) {
    const rel = specifier.slice(2);
    const basePath = pathResolve(process.cwd(), 'src', rel);
    if (existsSync(basePath + '.ts')) {
      return nextResolve(pathToFileURL(basePath + '.ts').href, context);
    }
    if (existsSync(basePath + '/index.ts')) {
      return nextResolve(pathToFileURL(basePath + '/index.ts').href, context);
    }
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    const parentDir = dirname(fileURLToPath(context.parentURL));
    const targetPath = pathResolve(parentDir, specifier);
    if (existsSync(targetPath + '.ts')) {
      return nextResolve(pathToFileURL(targetPath + '.ts').href, context);
    }
    if (existsSync(targetPath + '/index.ts')) {
      return nextResolve(pathToFileURL(targetPath + '/index.ts').href, context);
    }
  }
  return nextResolve(specifier, context);
}
`;

register('data:text/javascript,' + encodeURIComponent(inlineLoaderCode), import.meta.url);
