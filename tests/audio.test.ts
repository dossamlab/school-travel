import test from 'node:test';
import assert from 'node:assert/strict';
import { composeMusic,composeChime } from '../src/audio.ts';

const context={createBuffer(channels:number,length:number,sampleRate:number){
  const data=Array.from({length:channels},()=>new Float32Array(length));
  return {length,sampleRate,duration:length/sampleRate,numberOfChannels:channels,getChannelData:(channel:number)=>data[channel]};
}} as unknown as BaseAudioContext;

test('original music and success chime are audible, finite, stereo and do not clip',()=>{
  for(const compose of [composeMusic,composeChime]) {
    const buffer=compose(context);
    let peak=0,energy=0,difference=0;
    const left=buffer.getChannelData(0),right=buffer.getChannelData(1);
    for(let i=0;i<buffer.length;i++) {
      assert.ok(Number.isFinite(left[i])&&Number.isFinite(right[i]));
      peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));energy+=left[i]**2;difference+=Math.abs(left[i]-right[i]);
    }
    assert.ok(peak>.03&&peak<.95,`peak ${peak}`);
    assert.ok(Math.sqrt(energy/buffer.length)>.005);
    assert.ok(difference>1,'stereo score must retain its soft spatial spread');
  }
});

test('music wraps without a waveform jump and the chime ends quietly',()=>{
  const music=composeMusic(context),chime=composeChime(context);
  assert.equal(music.duration,24);
  for(let channel=0;channel<2;channel++) {
    const m=music.getChannelData(channel),c=chime.getChannelData(channel);
    assert.ok(Math.abs(m[0]-m[m.length-1])<.015,'loop seam must not click');
    assert.ok(Math.abs(c[c.length-1])<.001,'success tone must end quietly');
  }
});
