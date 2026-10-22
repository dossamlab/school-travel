import {schoolConfig} from './school-config.ts';
// Two light admission-day games for the creative lounge arcade cabinets.
export type QuizQuestion={statement:string;answer:boolean;explanation:string};
export type QuizRoom={name:string;floor:number};

/** Floor-location O/X questions built from the walkable map, so every answer matches the tour. */
export function makeFloorQuiz(rooms:QuizRoom[],random:()=>number=Math.random,count=5):QuizQuestion[] {
  const floors=new Map<string,Set<number>>();
  for(const room of rooms)floors.set(room.name,(floors.get(room.name)??new Set()).add(room.floor));
  // Names that exist on one floor only, without generic numbered rooms such as 1-3 or 다목적실2.
  const pool=[...floors].filter(([name,set])=>set.size===1&&!/^\d-\d|\d$|화장실|창고|준비실|샤워실/.test(name)).map(([name,set])=>({name,floor:[...set][0]!}));
  const picked:QuizRoom[]=[];
  while(picked.length<Math.min(count,pool.length)) {
    const room=pool.splice(Math.floor(random()*pool.length),1)[0]!;picked.push(room);
  }
  return picked.map(room=>{
    const truth=random()<.5,others=[2,3,4,5].filter(f=>f!==room.floor);
    const shown=truth?room.floor:others[Math.floor(random()*others.length)]!;
    return {statement:`${room.name}은(는) ${shown}층에 있어요.`,answer:truth,explanation:`${room.name}은(는) ${room.floor}층에 있어요.`};
  });
}

export const balloonPoints=(golden:boolean)=>golden?3:1;
export function balloonVerdict(score:number):string {
  if(score>=30)return `풍선 마스터! ${schoolConfig.shortName} 축제의 주인공이에요.`;
  if(score>=18)return '멋져요! 손이 아주 빨라요.';
  if(score>=8)return '좋은 출발이에요. 한 번 더 해 볼까요?';
  return '천천히 해도 괜찮아요. 다시 도전해 봐요!';
}

const colors=['#f77aa0','#fdd14d','#73b5f5','#6cd9a6','#b78ef0','#fd8566'];
// A closed dialog keeps its content, so rounds stop on either detaching or closing.
const alive=(host:HTMLElement)=>host.isConnected&&(host.closest('dialog')?.open??true);
function readBest(key:string){try{return Number(localStorage.getItem(key))||0;}catch{return 0;}}
function writeBest(key:string,value:number){try{localStorage.setItem(key,String(value));}catch{/* private mode: keep the round only */}}

/** 20-second balloon popping round; stops by itself once the host leaves the page. */
export function mountBalloonGame(host:HTMLElement) {
  const bestKey='cheonghak-balloon-best';
  host.innerHTML=`<div class="minigame balloon-game"><div class="minigame-bar"><span>점수 <b data-score>0</b></span><span>남은 시간 <b data-time>20</b>초</span><span>최고 <b data-best>${readBest(bestKey)}</b></span></div><div class="balloon-field" data-field><div class="minigame-start"><p>떠오르는 풍선을 눌러 터뜨려요.<br><b>금색 별 풍선</b>은 3점!</p><button class="primary" data-start>시작하기</button></div></div></div>`;
  const field=host.querySelector<HTMLElement>('[data-field]')!,scoreEl=host.querySelector<HTMLElement>('[data-score]')!,timeEl=host.querySelector<HTMLElement>('[data-time]')!;
  let score=0,running=false;
  function start() {
    score=0;scoreEl.textContent='0';field.replaceChildren();running=true;
    const began=performance.now();let spawned=0;
    const balloons=new Set<{el:HTMLButtonElement;x:number;speed:number;born:number}>();
    function frame(now:number) {
      if(!alive(host)){running=false;return;}
      const elapsed=(now-began)/1000,left=Math.max(0,20-elapsed);
      timeEl.textContent=String(Math.ceil(left));
      while(spawned<elapsed*2.4&&left>0) {
        spawned++;
        const golden=Math.random()<.12,el=document.createElement('button');
        el.className=`game-balloon${golden?' golden':''}`;el.type='button';el.setAttribute('aria-label',golden?'금색 풍선 3점':'풍선 1점');
        el.style.setProperty('--balloon',golden?'#f4c542':colors[spawned%colors.length]!);
        const item={el,x:6+Math.random()*82,speed:.16+Math.random()*.12,born:now};
        el.style.left=`${item.x}%`;
        el.addEventListener('pointerdown',event=>{
          event.preventDefault();if(!running)return;
          score+=balloonPoints(golden);scoreEl.textContent=String(score);
          el.classList.add('popped');el.disabled=true;balloons.delete(item);setTimeout(()=>el.remove(),260);
        });
        balloons.add(item);field.append(el);
      }
      for(const item of balloons) {
        const rise=(now-item.born)/1000*item.speed;
        item.el.style.bottom=`${-18+rise*100}%`;
        if(rise>1.25){item.el.remove();balloons.delete(item);}
      }
      if(left>0)requestAnimationFrame(frame);else finish();
    }
    requestAnimationFrame(frame);
  }
  function finish() {
    running=false;
    const best=Math.max(score,readBest(bestKey));writeBest(bestKey,best);
    host.querySelector<HTMLElement>('[data-best]')!.textContent=String(best);
    field.querySelectorAll('.game-balloon').forEach(el=>el.remove());
    const end=document.createElement('div');end.className='minigame-start';
    end.innerHTML=`<p><b class="big-score">${score}점</b><br>${balloonVerdict(score)}</p><button class="primary" data-start>다시 하기</button>`;
    field.append(end);end.querySelector<HTMLButtonElement>('[data-start]')!.onclick=start;
  }
  host.querySelector<HTMLButtonElement>('[data-start]')!.onclick=start;
}

export function mountQuizGame(host:HTMLElement,rooms:QuizRoom[]) {
  let questions=makeFloorQuiz(rooms),index=0,correct=0;
  function render() {
    if(index>=questions.length) {
      host.innerHTML=`<div class="minigame quiz-game"><p class="quiz-result"><b class="big-score">${questions.length}문제 중 ${correct}개 정답!</b><br>${correct===questions.length?`${schoolConfig.shortName} 길잡이 인증! 입학하면 길 잃을 일 없겠어요.`:'안내도에서 층별 교실을 살펴보고 다시 도전해 봐요.'}</p><div class="dialog-actions"><button class="primary" data-again>다시 풀기</button></div></div>`;
      host.querySelector<HTMLButtonElement>('[data-again]')!.onclick=()=>{questions=makeFloorQuiz(rooms);index=0;correct=0;render();};
      return;
    }
    const q=questions[index]!;
    host.innerHTML=`<div class="minigame quiz-game"><div class="minigame-bar"><span>${index+1} / ${questions.length}</span><span>정답 <b>${correct}</b></span></div><p class="quiz-statement">${q.statement}</p><div class="quiz-choices"><button class="quiz-o" data-answer="true" aria-label="맞아요 O">O</button><button class="quiz-x" data-answer="false" aria-label="아니에요 X">X</button></div><p class="quiz-feedback" role="status"></p></div>`;
    host.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach(button=>button.onclick=()=>{
      const right=(button.dataset.answer==='true')===q.answer;if(right)correct++;
      host.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach(b=>b.disabled=true);
      const feedback=host.querySelector<HTMLElement>('.quiz-feedback')!;
      feedback.textContent=`${right?'정답이에요!':'아쉬워요.'} ${q.explanation}`;feedback.classList.add(right?'right':'wrong');
      setTimeout(()=>{if(alive(host)){index++;render();}},1500);
    });
  }
  render();
}
