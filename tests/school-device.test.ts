import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isKakaoInApp,kakaoExternalUrl,chromeIntentUrl,needsLandscape} from '../src/school-device.ts';

const kakaoAndroid='Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 KAKAOTALK/10.8.0';
const kakaoIos='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.0';
const chrome='Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';

test('KakaoTalk links are handed to the phone browser',()=>{
  assert.ok(isKakaoInApp(kakaoAndroid)&&isKakaoInApp(kakaoIos));
  assert.ok(!isKakaoInApp(chrome));
  assert.equal(kakaoExternalUrl('https://ch-travel.vercel.app/?from=kakao'),'kakaotalk://web/openExternal?url=https%3A%2F%2Fch-travel.vercel.app%2F%3Ffrom%3Dkakao');
  assert.equal(chromeIntentUrl('https://ch-travel.vercel.app/?a=1'),'intent://ch-travel.vercel.app/?a=1#Intent;scheme=https;package=com.android.chrome;end');
  // The redirect runs inline before the 3D bundle and matches the module's rule.
  assert.match(readFileSync(new URL('../index.html',import.meta.url),'utf8'),/KAKAOTALK.*kakaotalk:\/\/web\/openExternal\?url=/);
});

test('only touch screens held upright are asked to rotate',()=>{
  assert.ok(needsLandscape(true,390,844));
  assert.ok(!needsLandscape(true,844,390));
  assert.ok(!needsLandscape(false,700,1000),'A tall desktop window is never blocked');
});
