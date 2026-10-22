import {schoolConfig} from './school-config.ts';
// Phone-only entry rules: leave the KakaoTalk in-app browser and play in landscape.

export const isKakaoInApp=(userAgent:string)=>/KAKAOTALK/i.test(userAgent);
const isAndroid=(userAgent:string)=>/Android/i.test(userAgent);

/** KakaoTalk's documented scheme hands a page to the phone's default browser (Chrome, Safari…). */
export function kakaoExternalUrl(href:string) {
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`;
}
/** Android fallback: an intent URL that opens the same address in Chrome. */
export function chromeIntentUrl(href:string) {
  const url=new URL(href);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.replace(':','')};package=com.android.chrome;end`;
}
/** Touch phones and tablets held upright are asked to rotate; desktop windows are never blocked. */
export const needsLandscape=(coarsePointer:boolean,width:number,height:number)=>coarsePointer&&height>width;

/** Shows the browser card when KakaoTalk did not hand the page over, and the rotate notice in portrait. */
export function installDeviceGuards(root:HTMLElement) {
  const userAgent=navigator.userAgent;
  if(isKakaoInApp(userAgent)) {
    // index.html already tried the scheme; if we are still visible shortly after, explain how to leave.
    window.setTimeout(()=>{
      if(document.hidden)return;
      const card=document.createElement('section');card.id='browser-card';card.setAttribute('role','dialog');card.setAttribute('aria-labelledby','browser-card-title');
      card.innerHTML=`<div class="device-card"><span class="device-icon" aria-hidden="true">🌐</span><h2 id="browser-card-title">브라우저로 열어 주세요</h2><p>카카오톡 안에서는 3D 학교가 느리거나 버튼이 가려질 수 있어요.<br>크롬·사파리 같은 휴대폰 브라우저에서 열어 주세요.</p><button class="primary" id="open-browser">브라우저로 열기</button><button class="secondary" id="copy-address">주소 복사하기</button><p class="device-hint">버튼이 동작하지 않으면 화면 ${isAndroid(userAgent)?'오른쪽 위':'오른쪽 아래'} <b>⋮</b> 메뉴에서 <b>‘다른 브라우저로 열기’</b>를 눌러 주세요.</p><button class="quiet" id="stay-in-kakao">카카오톡에서 계속 보기</button></div>`;
      root.append(card);
      card.querySelector<HTMLButtonElement>('#open-browser')!.onclick=()=>{
        location.href=kakaoExternalUrl(location.href);
        if(isAndroid(userAgent))window.setTimeout(()=>{if(!document.hidden)location.href=chromeIntentUrl(location.href);},900);
      };
      card.querySelector<HTMLButtonElement>('#copy-address')!.onclick=async event=>{
        const button=event.currentTarget as HTMLButtonElement;
        try{await navigator.clipboard.writeText(location.href);button.textContent='주소를 복사했어요';}
        catch{button.textContent=location.href;}
      };
      card.querySelector<HTMLButtonElement>('#stay-in-kakao')!.onclick=()=>card.remove();
    },1500);
  }
  const rotate=document.createElement('section');rotate.id='rotate-notice';rotate.setAttribute('role','alertdialog');rotate.setAttribute('aria-labelledby','rotate-title');rotate.hidden=true;
  rotate.innerHTML=`<div class="device-card"><span class="rotate-phone" aria-hidden="true"></span><h2 id="rotate-title">가로로 돌려 주세요</h2><p>${schoolConfig.siteName}은 가로 화면에서 걸어요.<br><b>세로 화면 고정</b>을 끄고 휴대폰을 옆으로 돌리면 바로 시작돼요.</p></div>`;
  root.append(rotate);
  const coarse=matchMedia('(pointer: coarse)');
  const update=()=>{rotate.hidden=!needsLandscape(coarse.matches,innerWidth,innerHeight);};
  for(const name of ['resize','orientationchange'])addEventListener(name,update);
  coarse.addEventListener('change',update);update();
}

type FullscreenDocument=Document&{webkitFullscreenElement?:Element|null;webkitExitFullscreen?:()=>Promise<void>};
type FullscreenElement=HTMLElement&{webkitRequestFullscreen?:()=>Promise<void>};
export const fullscreenSupported=(element:{requestFullscreen?:unknown;webkitRequestFullscreen?:unknown})=>typeof element.requestFullscreen==='function'||typeof element.webkitRequestFullscreen==='function';
const isFullscreen=()=>!!(document.fullscreenElement||(document as FullscreenDocument).webkitFullscreenElement);
const hintKey='cheonghak-fullscreen-hint';

/**
 * Always-visible fullscreen toggle: hides the browser address bar in landscape. iPhone Safari has
 * no page fullscreen, so there the button explains the home-screen shortcut instead.
 */
export function installFullscreen(button:HTMLButtonElement,notify:(message:string)=>void) {
  const root=document.documentElement as FullscreenElement,doc=document as FullscreenDocument;
  const render=()=>{
    const on=isFullscreen();
    button.classList.toggle('active',on);button.setAttribute('aria-pressed',String(on));
    button.setAttribute('aria-label',on?'전체화면 끄기':'전체화면으로 보기');button.title=on?'전체화면 끄기':'전체화면';
  };
  async function enter() {
    if(!fullscreenSupported(root)){notify('iPhone에서는 사파리 공유 버튼 → ‘홈 화면에 추가’로 열면 주소창 없이 볼 수 있어요.');return;}
    try {
      await (root.requestFullscreen?root.requestFullscreen({navigationUI:'hide'}):root.webkitRequestFullscreen!());
      // Android Chrome can also keep the screen sideways while in fullscreen.
      await (screen.orientation as ScreenOrientation&{lock?:(o:string)=>Promise<void>}).lock?.('landscape').catch(()=>{});
    } catch {notify('전체화면을 열지 못했어요. 브라우저 메뉴에서 전체화면을 선택해 주세요.');}
  }
  const toggle=()=>{if(isFullscreen())void (document.exitFullscreen?document.exitFullscreen():doc.webkitExitFullscreen?.());else void enter();};
  button.onclick=toggle;
  for(const name of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(name,render);
  render();
  return {enter};
}

/** First visit on a phone held sideways: dim the page and point at the fullscreen button once per session. */
export function showFullscreenHint(button:HTMLButtonElement,enter:()=>Promise<void>) {
  try{if(sessionStorage.getItem(hintKey))return;}catch{/* storage blocked: show it anyway */}
  if(!matchMedia('(pointer: coarse)').matches||isFullscreen())return;
  const shade=document.createElement('section');shade.id='fullscreen-hint';shade.setAttribute('role','dialog');shade.setAttribute('aria-labelledby','fullscreen-hint-title');
  shade.innerHTML=`<span class="hint-arrow" aria-hidden="true"></span><div class="hint-card"><h2 id="fullscreen-hint-title">전체화면으로 더 넓게 걸어요</h2><p>오른쪽 위 <b>전체화면</b> 버튼을 누르면 주소창이 사라지고<br>학교가 화면 가득 보여요.</p><div class="hint-actions"><button class="primary" id="hint-enter">전체화면으로 보기</button><button class="quiet" id="hint-skip">이대로 볼게요</button></div></div>`;
  document.body.append(shade);button.classList.add('spotlight');
  const place=()=>{
    const r=button.getBoundingClientRect(),arrow=shade.querySelector<HTMLElement>('.hint-arrow')!;
    arrow.style.left=`${r.left+r.width/2-22}px`;arrow.style.top=`${r.bottom+6}px`;
  };
  const close=()=>{
    shade.remove();button.classList.remove('spotlight');removeEventListener('resize',place);
    try{sessionStorage.setItem(hintKey,'1');}catch{/* fine */}
  };
  addEventListener('resize',place);place();
  shade.querySelector<HTMLButtonElement>('#hint-enter')!.onclick=()=>{close();void enter();};
  shade.querySelector<HTMLButtonElement>('#hint-skip')!.onclick=close;
  button.addEventListener('click',close,{once:true});
}
