// Original score: a quiet electric-piano melody over soft, slow chords.
function addNote(buffer:AudioBuffer,at:number,midi:number,duration:number,level:number,pan=0,pad=false) {
  const rate=buffer.sampleRate,left=buffer.getChannelData(0),right=buffer.getChannelData(1);
  const frequency=440*2**((midi-69)/12),start=Math.round(at*rate),length=Math.round(duration*rate);
  for(let i=0;i<length;i++) {
    const t=i/rate,phase=2*Math.PI*frequency*t;
    const envelope=pad?Math.sin(Math.PI*i/length)**2:Math.min(1,t/.012)*Math.exp(-t*4/duration)*(1-i/length);
    const tone=pad?(Math.sin(phase)+Math.sin(phase*1.0015))*.5:Math.sin(phase)+.18*Math.sin(phase*2)*Math.exp(-t*6);
    const value=tone*envelope*level,index=(start+i)%buffer.length;
    left[index]+=value*Math.sqrt((1-pan)/2);right[index]+=value*Math.sqrt((1+pan)/2);
  }
}

export function composeMusic(context:BaseAudioContext):AudioBuffer {
  const buffer=context.createBuffer(2,24*24000,24000);
  const chords=[[48,55,59,64],[45,52,55,60],[41,48,52,57],[43,50,55,59]];
  const melody=[[76,79,74,72],[72,76,71,-1],[69,72,76,74],[71,74,79,-1],[79,76,74,72],[76,72,69,-1],[72,76,74,69],[71,74,67,-1]];
  for(let bar=0;bar<8;bar++) {
    const chord=chords[bar%4],at=bar*3;
    chord.forEach((note,i)=>addNote(buffer,at,note,3.5,.025,(i-1.5)*.24,true));
    for(let beat=0;beat<4;beat++) {
      const note=melody[bar][beat];
      if(note>=0)addNote(buffer,at+beat*.75,note,.95,.072,Math.sin(bar+beat)*.3);
    }
    addNote(buffer,at,chord[0]-12,1.8,.07);
    addNote(buffer,at+1.5,chord[1]-12,1.5,.04);
  }
  return buffer;
}

export function composeChime(context:BaseAudioContext):AudioBuffer {
  const buffer=context.createBuffer(2,Math.round(1.8*24000),24000);
  [72,76,79,84].forEach((note,i)=>addNote(buffer,i*.16,note,i===3?1.2:.7,.22,(i-1.5)*.1));
  return buffer;
}

/** An original eight-bar tune for the music-room piano (about 5 s). */
export function composePiano(context:BaseAudioContext):AudioBuffer {
  const buffer=context.createBuffer(2,Math.round(5.6*24000),24000);
  const tune=[72,74,76,79,76,74,72,-1,74,76,77,81,79,77,76,-1,76,79,84,83,81,79,77,76,74,76,74,71,72,-1];
  tune.forEach((note,i)=>{if(note>=0)addNote(buffer,i*.18,note,.6,.16,Math.sin(i)*.25);});
  [48,53,55,48].forEach((note,i)=>addNote(buffer,i*1.35,note,1.6,.08));
  return buffer;
}
/** A short burst of hand claps for a successful shot. */
export function composeClaps(context:BaseAudioContext):AudioBuffer {
  const rate=24000,buffer=context.createBuffer(2,Math.round(1.6*rate),rate);
  for(let clap=0;clap<9;clap++) {
    const start=Math.round((clap*.14+Math.sin(clap*7)*.03+.05)*rate);
    for(const channel of [0,1]) {
      const data=buffer.getChannelData(channel),pan=channel?1+Math.sin(clap)*.3:1-Math.sin(clap)*.3;
      for(let i=0;i<rate*.06&&start+i<data.length;i++)data[start+i]+=(Math.random()*2-1)*Math.exp(-i/(rate*.012))*.32*pan;
    }
  }
  return buffer;
}

export function createSound(onError:()=>void) {
  const settings={music:true,effects:true,volume:.35};
  let context:AudioContext|undefined,master:GainNode,music:GainNode,effects:GainNode,chime:AudioBuffer;
  const cues=new Map<'piano'|'claps',AudioBuffer>();
  let ducked=false;
  const voices=new Set<AudioBufferSourceNode>();
  function apply() {
    if(!context)return;
    master.gain.setTargetAtTime(settings.volume,context.currentTime,.06);
    music.gain.setTargetAtTime(settings.music?(ducked?.3:1):0,context.currentTime,.15);
    effects.gain.setTargetAtTime(settings.effects?1:0,context.currentTime,.015);
  }
  async function activate() {
    if(document.hidden)return;
    try {
      if(!context) {
        context=new AudioContext();
        master=context.createGain();music=context.createGain();effects=context.createGain();
        master.gain.value=0;music.connect(master);effects.connect(master);master.connect(context.destination);
        const source=context.createBufferSource();source.buffer=composeMusic(context);source.loop=true;source.connect(music);source.start();
        chime=composeChime(context);cues.set('piano',composePiano(context));cues.set('claps',composeClaps(context));apply();
      }
      if(context.state!=='running')await context.resume();
    } catch {onError();}
  }
  function play(buffer:AudioBuffer|undefined) {
    if(!context||!buffer||context.state!=='running'||!settings.effects||settings.volume===0||document.hidden)return;
    const voice=context.createBufferSource();voice.buffer=buffer;voice.connect(effects);
    voices.add(voice);voice.onended=()=>{voices.delete(voice);voice.disconnect();};voice.start();
  }
  document.addEventListener('visibilitychange',()=>{
    if(!context)return;
    if(document.hidden){voices.forEach(voice=>voice.stop());void context.suspend().catch(onError);}
    else void activate();
  });
  return {
    settings,activate,
    get state(){return context?.state??'not-started';},
    update(){apply();void activate();},
    duck(value:boolean){if(value!==ducked){ducked=value;apply();}},
    celebrate(){play(chime);},
    /** Short interaction sounds: the music-room piano tune and claps for a free throw. */
    cue(name:'piano'|'claps'){const buffer=cues.get(name);if(buffer)play(buffer);},
  };
}
