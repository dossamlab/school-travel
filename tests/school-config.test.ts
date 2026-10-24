import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {schoolConfig} from '../src/school-config.ts';

test('school config names the school and points at a published share image', () => {
  for(const key of ['schoolName','shortName','siteName','tagline','description','eventTitle'] as const)assert.ok(schoolConfig[key].trim(),key);
  assert.match(schoolConfig.siteUrl,/^https:\/\/.+\/$/,'siteUrl must be an https address ending in /');
  assert.ok(existsSync(new URL(`../public/${schoolConfig.shareImage}`,import.meta.url)),'shareImage must exist in public/');
  assert.match(schoolConfig.themeColor,/^#[0-9a-f]{6}$/i);
  assert.ok(schoolConfig.dataUrl===''||/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(schoolConfig.dataUrl),'dataUrl is empty or an Apps Script web app');
  for(const link of [schoolConfig.about.roomNames,...schoolConfig.about.links])assert.match(link.url,/^https:\/\//,link.label);
});

test('index.html takes its school text from the config', () => {
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,new RegExp(schoolConfig.schoolName),'write %SCHOOL_*% placeholders instead of the school name');
  for(const key of html.matchAll(/%SCHOOL_(\w+)%/g))assert.ok(key[1]==='shareImageUrl'||key[1]! in schoolConfig,key[1]);
});

test('the template credit stays on the welcome card and in the help', async () => {
  const {templateCredit}=await import('../src/template-credit.ts');
  assert.equal(templateCredit.text,'Template by 청학고 도쌤');
  assert.equal(templateCredit.url,'https://github.com/dossamlab/school-travel');
  const main=readFileSync(new URL('../src/school-main.ts',import.meta.url),'utf8');
  assert.match(main,/<small>[^`]*templateCredit\.text[^`]*<\/small>/,'shown on the welcome card');
  // The help credits add it whenever the school's own maker is someone else.
  assert.match(main,/제작: \$\{escape\(about\.maker\)\}\$\{templateCredit\.text\.endsWith\(about\.maker\)\?'':/,'shown in the help credits');
});
