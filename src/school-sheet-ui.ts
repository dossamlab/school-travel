import {schoolConfig} from './school-config.ts';
type Entry={date:string;nickname:string;message:string};
type Guide={greeting:string;topics:{title:string;text:string}[]};
type RoomGuide={id:string;text:string};
export async function schoolData<T>(action:string,input?:Record<string,unknown>):Promise<T>{
  // Public Apps Script data endpoint; deliberately omit Google account cookies.
  if(!schoolConfig.dataUrl)throw new Error('아직 학교 안내 시트를 연결하지 않았어요.');
  const response=await fetch(`${schoolConfig.dataUrl}?action=${encodeURIComponent(action)}`,{
    method:input?'POST':'GET',credentials:'omit',redirect:'follow',signal:AbortSignal.timeout(25000),
    // A simple text/plain request avoids a CORS preflight unsupported by Apps Script.
    ...(input?{headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...input,action})}:{}),
  });
  if(!response.ok)throw new Error('연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.');
  const result=await response.json();
  if(result.ok!==true)throw new Error(typeof result.error==='string'?result.error:'내용을 불러오지 못했어요.');
  return result.data as T;
}
const element=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
const message=(error:unknown)=>error instanceof Error&&error.name!=='TypeError'&&error.name!=='TimeoutError'?error.message:'연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.';

// A line holding only --- in the sheet text starts a new dialog page.
export const sheetPages=(text:string)=>text.replace(/\r\n?/g,'\n').split(/^[ \t]*-{3,}[ \t]*$/m).map(page=>page.trim()).filter(Boolean);

export function showPrincipalGuide(host:HTMLElement){
  host.classList.add('sheet-content');
  const body=element('div'),refresh=element('button','다시 불러오기','secondary');host.append(body,refresh);
  let turn:((step:number)=>void)|undefined;
  host.onkeydown=event=>{if(turn&&(event.key==='ArrowRight'||event.key==='ArrowLeft')){event.preventDefault();turn(event.key==='ArrowRight'?1:-1);}};
  // Shows one page at a time; the last page adds the choices or the way back to them.
  function paged(title:string|undefined,text:string,{start=0,extra,finish}:{start?:number;extra?:HTMLElement;finish?:HTMLElement}){
    const pages=sheetPages(text);if(!pages.length)pages.push('');
    let index=Math.min(start,pages.length-1);
    const show=()=>{
      const last=index===pages.length-1,actions=element('div','','dialog-actions sheet-pager');
      const previous=element('button','이전','secondary'),next=element('button','다음','primary');
      previous.onclick=()=>turn?.(-1);next.onclick=()=>turn?.(1);
      if(index>0)actions.append(previous);
      if(pages.length>1)actions.append(element('small',`${index+1} / ${pages.length}`,'sheet-page-count'));
      if(!last)actions.append(next);else if(finish)actions.append(finish);
      body.replaceChildren(...(title?[element('h3',title)]:[]),element('p',pages[index],'description sheet-text'),
        ...(last&&extra?[extra]:[]),...(actions.childElementCount?[actions]:[]));
      (last?finish??(index>0?previous:undefined):next)?.focus();
    };
    turn=step=>{const target=index+step;if(target<0||target>=pages.length)return;index=target;show();};
    show();
  }
  async function load(){
    refresh.disabled=true;turn=undefined;body.replaceChildren(element('p','학교 이야기를 불러오고 있어요.','description'));
    try{
      const guide=await schoolData<Guide>('principal');
      const choices=element('div','','sheet-choices');
      const menu=(start=0)=>{
        choices.replaceChildren();
        for(const topic of guide.topics){const button=element('button',topic.title,'secondary');button.onclick=()=>{
          const back=element('button','다른 이야기 듣기','secondary');back.onclick=()=>menu(Infinity);
          paged(topic.title,topic.text,{finish:back});
        };choices.append(button);}
        if(!guide.topics.length)choices.append(element('p','학교 이야기를 준비하고 있어요. 편안하게 둘러보세요.','source-note'));
        paged(undefined,guide.greeting,{start,extra:choices});
      };menu();
    }catch(error){body.replaceChildren(element('p',message(error),'description'));}
    finally{refresh.disabled=false;}
  }
  refresh.onclick=load;void load();
}

export function showRoomGuide(host:HTMLElement,id:string){
  const text=element('p','안내를 불러오고 있어요.','description sheet-text'),retry=element('button','다시 불러오기','quiet');
  host.append(text,retry);
  async function load(){
    retry.disabled=true;
    try{const rows=await schoolData<RoomGuide[]>('rooms');text.textContent=rows.find(row=>row.id===id)?.text??'아직 입력된 내용이 없습니다';}
    catch(error){text.textContent=message(error);}
    finally{retry.disabled=false;}
  }
  retry.onclick=load;void load();
}

export function showGuestbook(host:HTMLElement){
  host.classList.add('sheet-content');
  host.innerHTML=`<p class="sheet-intro">오늘의 산책, 한 줄 남겨 주세요.<br><small>실명·학번·연락처 등 개인정보는 적지 말아 주세요.<br>글은 선생님이 확인하고 승인한 뒤 공개돼요.</small></p>
  <form class="guestbook-form"><label>닉네임 <small>선택 · 20자 이내</small><input name="nickname" maxlength="20" autocomplete="off" placeholder="비워 두면 익명의 산책자"></label><label>방명록<textarea name="message" minlength="2" maxlength="300" required placeholder="학교를 둘러본 소감이나 따뜻한 인사를 남겨 주세요."></textarea></label>
  <label class="sheet-trap" aria-hidden="true">웹사이트<input name="website" tabindex="-1" autocomplete="off"></label>
  <label class="sheet-consent"><input name="consent" type="checkbox" required><span>닉네임과 글이 Google 스프레드시트에 저장되고, 승인 후 사이트에 공개되는 데 동의합니다. 개인정보를 적지 않았습니다.</span></label>
  <div class="dialog-actions"><small class="sheet-count">0 / 300자</small><button type="submit" class="primary">발자국 남기기</button></div></form>
  <p class="sheet-status" role="status" aria-live="polite"></p><div class="sheet-list-heading"><h3>함께 남긴 발자국</h3><button type="button" class="secondary sheet-refresh">새로고침</button></div><div class="sheet-entries" aria-live="polite"></div>`;
  const form=host.querySelector('form')!,input=form.elements.namedItem('message') as HTMLTextAreaElement;
  const status=host.querySelector<HTMLElement>('.sheet-status')!,list=host.querySelector<HTMLElement>('.sheet-entries')!,refresh=host.querySelector<HTMLButtonElement>('.sheet-refresh')!;
  input.oninput=()=>{host.querySelector('.sheet-count')!.textContent=`${input.value.length} / 300자`;};
  async function load(){
    refresh.disabled=true;list.replaceChildren(element('p','발자국을 불러오고 있어요.'));
    try{
      const entries=await schoolData<Entry[]>('guestbook');list.replaceChildren();
      if(!entries.length)list.append(element('p','아직 공개된 글이 없어요. 첫 발자국을 남겨 주세요.'));
      for(const entry of entries){const article=element('article'),header=element('header');header.append(element('strong',entry.nickname),element('time',entry.date));article.append(header,element('p',entry.message,'sheet-text'));list.append(article);}
    }catch(error){list.replaceChildren(element('p',message(error)));}
    finally{refresh.disabled=false;}
  }
  refresh.onclick=load;void load();
  let token='';try{token=localStorage.getItem('school-guestbook-token')??'';}catch{}
  if(!/^[a-zA-Z0-9_-]{16,80}$/.test(token)){token=crypto.randomUUID();try{localStorage.setItem('school-guestbook-token',token);}catch{}}
  form.onsubmit=async event=>{
    event.preventDefault();if(!form.reportValidity())return;
    const submit=form.querySelector<HTMLButtonElement>('button[type=submit]')!;if(submit.disabled)return;
    submit.disabled=true;status.textContent='발자국을 저장하고 있어요.';
    try{
      const data=new FormData(form);
      await schoolData('submit',{nickname:String(data.get('nickname')??''),message:input.value,website:String(data.get('website')??''),consent:data.get('consent')==='on',token});
      form.reset();host.querySelector('.sheet-count')!.textContent='0 / 300자';status.textContent='발자국을 남겼어요. 선생님이 승인하면 공개됩니다.';
    }catch(error){status.textContent=`${message(error)} 입력한 글은 그대로 두었어요. 연결 오류라면 중복 제출 전에 잠시 기다려 주세요.`;}
    finally{submit.disabled=false;}
  };
}
