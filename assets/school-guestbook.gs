// Google Apps Script. The spreadsheet is private; only approved entries leave the server.
// A standalone script keeps its sheet in SHEET_ID. A copy of the template sheet carries this
// script bound to it and never stores SHEET_ID, so each copy reads only its own sheet.
function book_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function setupGuestbook_() {
  let book = book_();
  if (!book) {
    book = SpreadsheetApp.create('학교 여행 · 방명록 관리');
    PropertiesService.getScriptProperties().setProperty('SHEET_ID', book.getId());
  }
  if (book.getSheetByName('방명록')) return;
  const sheet = book.insertSheet('방명록', 0);
  sheet.appendRow(['작성 시각', '닉네임', '방명록', '공개 승인']);
  sheet.setFrozenRows(1);
  sheet.getRange('A1:D1').setBackground('#e4ead8').setFontWeight('bold');
  sheet.setColumnWidth(1, 165); sheet.setColumnWidth(2, 140); sheet.setColumnWidth(3, 500); sheet.setColumnWidth(4, 105);
  sheet.getRange('D1').setNote('이 열의 체크박스를 선택한 글만 사이트에 공개됩니다. 선택을 해제하면 비공개로 바뀝니다.');
  book.setSpreadsheetTimeZone('Asia/Seoul');
}

function guestbookSheet_() {
  const book = book_();
  const sheet = book && book.getSheetByName('방명록');
  if (!sheet) throw new Error('방명록을 준비 중입니다. 잠시 후 다시 방문해 주세요.');
  return sheet;
}

function validateEntry_(input) {
  if (!input || typeof input.message !== 'string' || typeof input.nickname !== 'string' || input.consent !== true) {
    throw new Error('안내를 확인하고 글을 입력해 주세요.');
  }
  const nickname = input.nickname.normalize('NFC').trim();
  const message = input.message.normalize('NFC').trim();
  if (nickname.length > 20 || message.length < 2 || message.length > 300) {
    throw new Error('닉네임은 20자 이내, 글은 2~300자로 적어 주세요.');
  }
  if (input.website || !/^[a-zA-Z0-9_-]{16,80}$/.test(input.token || '')) throw new Error('잠시 후 다시 시도해 주세요.');
  return {nickname: nickname || '익명의 산책자', message: message};
}

function submitEntry(input) {
  const entry = validateEntry_(input);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(4000)) throw new Error('다른 글을 저장 중이에요. 잠시 후 다시 시도해 주세요.');
  try {
    const cache = CacheService.getScriptCache();
    const key = 'guestbook:' + input.token;
    if (cache.get(key)) throw new Error('방금 글을 남기셨어요. 1분 후 다시 남길 수 있어요.');
    const props = PropertiesService.getScriptProperties();
    const day = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    const count = props.getProperty('COUNT_DAY') === day ? Number(props.getProperty('COUNT') || '0') : 0;
    if (count >= 300) throw new Error('오늘의 방명록 접수가 마감됐어요. 내일 다시 방문해 주세요.');
    const sheet = guestbookSheet_();
    if (sheet.getLastRow() >= 10001) throw new Error('방명록을 정리 중이에요. 나중에 다시 방문해 주세요.');
    const row = sheet.getLastRow() + 1;
    // Rich text writes literal strings, including text starting with =, +, - or @.
    sheet.getRange(row, 2, 1, 2).setRichTextValues([[
      SpreadsheetApp.newRichTextValue().setText(entry.nickname).build(),
      SpreadsheetApp.newRichTextValue().setText(entry.message).build(),
    ]]);
    sheet.getRange(row, 1).setValue(new Date()).setNumberFormat('yyyy-MM-dd HH:mm');
    sheet.getRange(row, 3).setWrap(true);
    sheet.getRange(row, 4).insertCheckboxes().setValue(false);
    SpreadsheetApp.flush();
    cache.put(key, '1', 60);
    props.setProperties({COUNT_DAY: day, COUNT: String(count + 1)});
    return {ok: true};
  } finally { lock.releaseLock(); }
}

function getApprovedEntries() {
  const sheet = guestbookSheet_();
  const count = sheet.getLastRow() - 1;
  if (count <= 0) return [];
  return sheet.getRange(2, 1, Math.min(count, 10000), 4).getValues()
    .filter(function(row) { return row[3] === true && row[0] instanceof Date; })
    .reverse().slice(0, 30).map(function(row) {
      return {date: Utilities.formatDate(row[0], 'Asia/Seoul', 'yyyy.MM.dd'), nickname: String(row[1]), message: String(row[2])};
    });
}

function setupSchoolGuide_() {
  const book = book_();
  if (book.getSheetByName('학교 안내')) return;
  const sheet = book.insertSheet('학교 안내');
  sheet.getRange(1, 1, 5, 4).setValues([
    ['종류', '선택지 제목', '소개 문구', '공개'],
    ['환영인사', '교장선생님의 환영 인사', '우리 학교에 오신 여러분을 환영합니다! 천천히 학교를 둘러보시고, 궁금한 이야기를 골라 주세요.', true],
    ['소개', '학교 연혁', '', false],
    ['소개', '학교의 장점', '', false],
    ['소개', '학교생활 안내', '', false],
  ]);
  sheet.setFrozenRows(1);
  sheet.getRange('A1:D1').setBackground('#e4ead8').setFontWeight('bold');
  sheet.setColumnWidth(1, 100); sheet.setColumnWidth(2, 210); sheet.setColumnWidth(3, 650); sheet.setColumnWidth(4, 80);
  sheet.getRange('C2:C1000').setWrap(true);
  sheet.getRange('D2:D1000').insertCheckboxes();
  sheet.getRange('D2').setValue(true);
  sheet.getRange('A2:A1000').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['환영인사', '소개'], true).setAllowInvalid(false).build());
  sheet.getRange('A1').setNote('환영인사는 공개된 첫 행을 사용합니다. 선택지를 늘리려면 새 행의 종류를 소개로 선택하세요.');
  sheet.getRange('C1').setNote('방문자에게 보여줄 문구를 입력하세요. 빈 문구는 표시되지 않습니다. 개인정보는 입력하지 마세요.');
  sheet.getRange('D1').setNote('체크한 행만 공개됩니다. 저장 후 게임에서 대화를 다시 열거나 새로고침하면 반영됩니다. 방명록에는 영향을 주지 않습니다.');
}

function getSchoolGuide() {
  const book = book_();
  const sheet = book.getSheetByName('학교 안내');
  const fallback = '우리 학교에 오신 여러분을 환영합니다! 편안하게 학교를 둘러보세요.';
  if (!sheet || sheet.getLastRow() < 2) return {greeting: fallback, topics: []};
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues()
    .filter(function(row) { return row[3] === true && String(row[2]).trim(); });
  const greeting = rows.find(function(row) { return row[0] === '환영인사'; });
  return {greeting: greeting ? String(greeting[2]) : fallback, topics: rows
    .filter(function(row) { return row[0] === '소개' && String(row[1]).trim(); })
    .map(function(row) { return {title: String(row[1]), text: String(row[2])}; })};
}

function doGet(event) {
  const action = event && event.parameter && event.parameter.action;
  if (action) return apiResponse_(function() {
    if (action === 'guestbook') return getApprovedEntries();
    if (action === 'principal') return getSchoolGuide();
    if (action === 'rooms') return getRoomGuide_();
    throw new Error('지원하지 않는 요청입니다.');
  });
  const principal = event && event.parameter && event.parameter.view === 'principal';
  return HtmlService.createHtmlOutput(principal ? SCHOOL_GUIDE_HTML_ : GUESTBOOK_HTML_).setTitle(principal ? '학교 여행 · 교장선생님의 학교 소개' : '학교 여행 · 방명록')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function apiResponse_(read) {
  let result;
  try { result = {ok: true, data: read()}; }
  catch (error) { result = {ok: false, error: String(error.message || '잠시 후 다시 시도해 주세요.')}; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(event) {
  return apiResponse_(function() {
    if (!event || !event.postData || event.postData.contents.length > 5000) throw new Error('올바르지 않은 요청입니다.');
    const input = JSON.parse(event.postData.contents);
    if (input.action !== 'submit') throw new Error('지원하지 않는 요청입니다.');
    return submitEntry(input);
  });
}

function getRoomGuide_() {
  const book = book_();
  const sheet = book.getSheetByName('공간 안내');
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues()
    .filter(function(row) { return row[4] === true && String(row[0]).trim() && String(row[3]).trim(); })
    .map(function(row) { return {id: String(row[0]), text: String(row[3])}; });
}

function setupRoomGuide_() {
  const book = book_();
  if (book.getSheetByName('공간 안내')) return;
  const sheet = book.insertSheet('공간 안내');
  const rows = [["west-passage",1,"서쪽통로","",false],["west-entrance",1,"서쪽현관","",false],["stair-3.333333333333333-7.629032258064516",1,"계단","",false],["corridor-3.333333333333333-8.35483870967742",1,"복도","",false],["individual",1,"개별화교육지원실","",false],["principal",1,"교장실","",false],["admin",1,"행정실","",false],["entrance",1,"중앙로비","",false],["corridor-24.333333333333336-7.629032258064516",1,"복도","",false],["open-library",1,"열린도서관","",false],["library",1,"도서관","",false],["east-passage",1,"동편출입구","",false],["stair-38.33333333333333-6.903225806451614",1,"계단","",false],["north-passage",1,"통로","",false],["stair-24.333333333333336-3.1612903225806455",1,"계단","",false],["corridor-24.333333333333336-3.9838709677419355",1,"북편 출입홀","",false],["dining",1,"급식실","",false],["north-passage-2",1,"통로","",false],["stair-20.444444444444443-6.419354838709678",1,"계단","",false],["basketball",1,"농구장","",false],["night-duty",1,"당직실","",false],["north-passage-3",1,"통로","",false],["staff-toilet",1,"교직원화장실(남)","",false],["accessible-toilet",1,"장애인화장실","",false],["men-toilet",1,"화장실(남)","",false],["women-toilet",1,"화장실(여)","",false],["storage",1,"창고","",false],["elevator-hall",1,"엘리베이터홀","",false],["north-passage-4",1,"통로","",false],["shop",1,"매점","",false],["parking",1,"필로티주차장","",false],["parking-2",1,"필로티주차장","",false],["parking-entry",1,"필로티진입부","",false],["court-door",1,"농구장 유리문","",false],["north-parking-door",1,"북편 주차장 출입문","",false],["east-parking-door",1,"동편 주차장 출입문","",false],["dining-door",1,"급식실 정문 · 유리문","",false],["dining-exit",1,"급식실 외부 출입문","",false],["north-secondary-parking-door",1,"북편 주차장 출입문","",false],["dining-side-door",1,"급식실 측문","",false],["floor-2-room-0",2,"진로진학상담부","",false],["floor-2-room-1",2,"Wee Class","",false],["floor-2-room-2",2,"교무실","",false],["floor-2-room-3",2,"C.B.S(방송실)","",false],["floor-2-room-4",2,"시설관리실","",false],["floor-2-room-5",2,"서버실","",false],["floor-2-room-6",2,"보건실","",false],["floor-2-room-7",2,"평가관리실","",false],["floor-2-room-8",2,"온라인학습실","",false],["floor-2-room-9",2,"학생안전부","",false],["floor-2-room-10",2,"학부모실","",false],["floor-2-room-11",2,"생명과학실","",false],["floor-2-room-12",2,"물리/지학실","",false],["floor-2-room-13",2,"준비실","",false],["floor-2-room-14",2,"회의실","",false],["floor-2-room-15",2,"세미나실","",false],["floor-2-room-16",2,"화학실","",false],["floor-2-room-17",2,"준비실","",false],["floor-2-room-18",2,"시청각실 (송천홀)","",false],["floor-2-room-19",2,"교직원화장실(여)","",false],["floor-2-room-20",2,"남학생화장실","",false],["floor-2-room-21",2,"여학생화장실","",false],["floor-2-room-22",2,"화장실(남)","",false],["floor-2-room-23",2,"화장실(여)","",false],["floor-2-room-24",2,"학생회실","",false],["floor-2-room-25",2,"남직원휴게실","",false],["floor-2-room-26",2,"여직원휴게실","",false],["floor-2-room-27",2,"체력단련실","",false],["floor-3-room-0",3,"진학상담실1","",false],["floor-3-room-1",3,"다목적실1","",false],["floor-3-room-2",3,"1-7","",false],["floor-3-room-3",3,"1-6","",false],["floor-3-room-4",3,"1-5","",false],["floor-3-room-5",3,"1-4","",false],["floor-3-room-6",3,"1-3","",false],["floor-3-room-7",3,"1-2","",false],["floor-3-room-8",3,"1-1","",false],["floor-3-room-9",3,"1학년교무실","",false],["floor-3-room-10",3,"물품보관실","",false],["floor-3-room-11",3,"컴퓨터실","",false],["floor-3-room-12",3,"스마트AI교실","",false],["floor-3-room-13",3,"교무실","",false],["floor-3-room-14",3,"미술준비실","",false],["floor-3-room-15",3,"미술실","",false],["floor-3-room-16",3,"음악실","",false],["floor-3-room-17",3,"음악준비실","",false],["floor-3-room-18",3,"샤워실(남)","",false],["floor-3-room-19",3,"비품창고","",false],["floor-3-room-20",3,"남학생화장실","",false],["floor-3-room-21",3,"여학생화장실","",false],["floor-3-room-22",3,"교직원화장실(남)","",false],["floor-3-room-23",3,"교직원화장실(여)","",false],["floor-3-room-24",3,"창의상상라운지","",false],["floor-3-room-25",3,"인문학교실","",false],["floor-4-room-0",4,"진학상담실2","",false],["floor-4-room-1",4,"2-7","",false],["floor-4-room-2",4,"2-6","",false],["floor-4-room-3",4,"2-5","",false],["floor-4-room-4",4,"2-4","",false],["floor-4-room-5",4,"2-3","",false],["floor-4-room-6",4,"2-2","",false],["floor-4-room-7",4,"2-1","",false],["floor-4-room-8",4,"다목적실2","",false],["floor-4-room-9",4,"2학년교무실","",false],["floor-4-room-10",4,"송학관(체육관)","",false],["floor-4-room-11",4,"샤워실(남)","",false],["floor-4-room-12",4,"샤워실(여)","",false],["floor-4-room-13",4,"남학생화장실","",false],["floor-4-room-14",4,"여학생화장실","",false],["floor-4-room-15",4,"화장실(남)","",false],["floor-4-room-16",4,"화장실(여)","",false],["floor-4-room-17",4,"자기주도학습실1","",false],["floor-4-room-18",4,"청학스터디존","",false],["floor-4-room-19",4,"여교사화장실","",false],["floor-5-room-0",5,"진학상담실3","",false],["floor-5-room-1",5,"3-6","",false],["floor-5-room-2",5,"3-5","",false],["floor-5-room-3",5,"3-4","",false],["floor-5-room-4",5,"3-3","",false],["floor-5-room-5",5,"3-2","",false],["floor-5-room-6",5,"3-1","",false],["floor-5-room-7",5,"다목적실4","",false],["floor-5-room-8",5,"다목적실3","",false],["floor-5-room-9",5,"3학년교무실","",false],["floor-5-room-10",5,"교무실","",false],["floor-5-room-11",5,"송학관 관람석","",false],["floor-5-room-12",5,"남학생화장실","",false],["floor-5-room-13",5,"여학생화장실","",false],["floor-5-room-14",5,"화장실(남)","",false],["floor-5-room-15",5,"화장실(여)","",false],["floor-5-room-16",5,"자기주도학습실2","",false],["floor-5-room-17",5,"공감교실","",false],["floor-5-room-18",5,"교구보관실","",false],["floor-5-room-19",5,"협의실","",false]];
  sheet.getRange(1, 1, 1, 5).setValues([['장소 ID (수정 금지)', '층', '장소명', '소개 문구', '공개']]);
  sheet.getRange(2, 1, rows.length, 5).setValues(rows);
  sheet.setFrozenRows(1); sheet.setFrozenColumns(3);
  sheet.getRange('A1:E1').setBackground('#e4ead8').setFontWeight('bold');
  sheet.setColumnWidth(1, 170); sheet.setColumnWidth(2, 60); sheet.setColumnWidth(3, 200); sheet.setColumnWidth(4, 600); sheet.setColumnWidth(5, 80);
  sheet.getRange('D2:D1000').setWrap(true); sheet.getRange('E2:E1000').insertCheckboxes();
  sheet.getRange('A1').setNote('장소를 연결하는 고유번호입니다. 이 열은 수정하지 마세요. 같은 이름의 공간도 층과 ID로 구분됩니다.');
  sheet.getRange('D1').setNote('이 공간을 소개할 문구를 직접 입력하세요. 학생·교사 개인정보는 입력하지 마세요.');
  sheet.getRange('E1').setNote('체크한 문구만 공개됩니다. 체크 해제 또는 빈 문구는 게임에서 아직 입력된 내용이 없습니다로 표시됩니다.');
  sheet.getRange(1, 1, rows.length + 1, 5).createFilter();
}

const GUESTBOOK_HTML_ = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
:root{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#344b40;background:#fffdf2;font-size:14px}*{box-sizing:border-box}body{margin:0;padding:18px 18px 26px}p{line-height:1.7;margin:0 0 14px}h2{font-size:18px;margin:26px 0 14px}label{display:block;font-size:13px;font-weight:bold;margin:14px 0 7px}input,textarea,button{font:inherit}input[type=text],textarea{width:100%;padding:12px;border:1px solid #cbd5c1;border-radius:12px;background:#fffefa;color:#344b40}textarea{resize:vertical;min-height:105px;line-height:1.6}button{border:0;border-radius:12px;cursor:pointer;color:#fffdf2;background:#597863;padding:12px 16px;min-height:44px}button:disabled{opacity:.55;cursor:wait}input:focus-visible,textarea:focus-visible,button:focus-visible{outline:3px solid #ba8457;outline-offset:2px}.intro{background:#edf0e3;padding:14px;border-radius:14px}.intro strong{display:block;margin-bottom:5px}.intro p{font-size:12px;margin:0}.hint{font-size:12px;color:#788672;margin-top:6px;line-height:1.6}.consent{display:flex;gap:8px;align-items:flex-start;font-size:12px;font-weight:normal;line-height:1.7;margin-bottom:16px}.consent input{margin-top:4px}.trap{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}.actions{display:flex;justify-content:space-between;align-items:center;gap:12px}.actions span{font-size:12px;color:#788672}#status{margin:12px 0;font-size:13px;white-space:pre-line}article{padding:16px 0;border-top:1px solid #dce1d2}article header{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px}article time{color:#819080;font-size:11px}article p{white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0 0;line-height:1.8}#refresh{font-size:12px;color:#597863;background:#e8eddc;padding:8px 12px;min-height:36px}.list-heading{display:flex;align-items:center;justify-content:space-between;margin-top:24px}.list-heading h2{margin:0}.empty{color:#819080;padding:20px 0;font-size:13px}
</style></head><body>
<div class="intro"><strong>오늘의 산책, 한 줄 남겨 주세요.</strong><p>실명·학번·연락처 등 개인정보는 적지 말아 주세요.<br>글은 선생님이 확인하고 승인한 뒤 공개돼요.</p></div>
<form id="form"><label for="nickname">닉네임 <span class="hint">선택 · 20자 이내</span></label><input id="nickname" type="text" maxlength="20" placeholder="비워 두면 익명의 산책자" autocomplete="off">
<label for="message">방명록</label><textarea id="message" minlength="2" maxlength="300" required placeholder="학교를 둘러본 소감이나 따뜻한 인사를 남겨 주세요."></textarea>
<div class="trap" aria-hidden="true"><label for="website">웹사이트</label><input id="website" type="text" tabindex="-1" autocomplete="off"></div>
<label class="consent"><input id="consent" type="checkbox" required><span>닉네임과 글이 Google 스프레드시트에 저장되고, 승인 후 사이트에 공개되는 데 동의합니다. 개인정보를 적지 않았습니다.</span></label>
<div class="actions"><span id="count">0 / 300자</span><button id="submit" type="submit">발자국 남기기</button></div></form>
<p id="status" role="status" aria-live="polite"></p><div class="list-heading"><h2>함께 남긴 발자국</h2><button id="refresh" type="button">새로고침</button></div><div id="entries" aria-live="polite"></div>
<script>
const $=id=>document.getElementById(id);let token='';
try{token=localStorage.getItem('school-guestbook-token')||'';}catch(e){}
if(!/^[a-zA-Z0-9_-]{16,80}$/.test(token)){token=crypto.randomUUID();try{localStorage.setItem('school-guestbook-token',token);}catch(e){}}
$('message').oninput=()=>{$('count').textContent=$('message').value.length+' / 300자';};
function showEntries(entries){
  $('entries').replaceChildren();
  if(!entries.length){const p=document.createElement('p');p.className='empty';p.textContent='아직 공개된 글이 없어요. 첫 발자국을 남겨 주세요.';$('entries').append(p);}
  entries.forEach(entry=>{const article=document.createElement('article'),header=document.createElement('header'),name=document.createElement('strong'),time=document.createElement('time'),message=document.createElement('p');name.textContent=entry.nickname;time.textContent=entry.date;message.textContent=entry.message;header.append(name,time);article.append(header,message);$('entries').append(article);});
}
function load(){
  $('refresh').disabled=true;
  google.script.run.withSuccessHandler(entries=>{showEntries(entries);$('refresh').disabled=false;}).withFailureHandler(()=>{$('entries').textContent='글을 불러오지 못했어요. 새로고침을 눌러 주세요.';$('refresh').disabled=false;}).getApprovedEntries();
}
$('refresh').onclick=load;
$('form').onsubmit=event=>{
  event.preventDefault();if(!$('form').reportValidity())return;
  $('submit').disabled=true;$('status').textContent='발자국을 남기는 중이에요…';
  const input={nickname:$('nickname').value,message:$('message').value,consent:$('consent').checked,website:$('website').value,token:token};
  google.script.run.withSuccessHandler(()=>{$('form').reset();$('count').textContent='0 / 300자';$('status').textContent='잘 받았어요! 선생님이 승인하면 이곳에 공개됩니다.';$('submit').disabled=false;}).withFailureHandler(error=>{$('status').textContent=String(error.message||'저장하지 못했어요. 잠시 후 다시 시도해 주세요.').replace(/^Exception: /,'');$('submit').disabled=false;}).submitEntry(input);
};load();
</script></body></html>`;

const SCHOOL_GUIDE_HTML_ = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
:root{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#344b40;background:#fffdf2;font-size:14px}*{box-sizing:border-box}body{margin:0;padding:18px}p{line-height:1.9;white-space:pre-wrap;overflow-wrap:anywhere}button{font:inherit;cursor:pointer;border:1px solid #d3dfc6;border-radius:14px;color:#4d6955;background:#eff3e4;min-height:48px;padding:13px 16px;text-align:left}button:focus-visible{outline:3px solid #ba8457;outline-offset:3px}button:disabled{opacity:.55;cursor:wait}.greeting{background:#edf0e3;border-radius:18px;padding:19px;margin:0 0 20px}.eyebrow{font-size:11px;letter-spacing:.08em;color:#819080;margin-bottom:8px}h2{font-size:20px;margin:0 0 14px;overflow-wrap:anywhere}h3{font-size:14px;margin:24px 0 12px}#choices{display:grid;gap:10px}#choices button{display:flex;justify-content:space-between;gap:16px;overflow-wrap:anywhere}#choices button span:first-child{min-width:0}#answer{padding:18px 0}#answer-text{margin:0 0 24px}#refresh{font-size:12px;min-height:38px;margin-top:22px;padding:8px 12px;background:transparent;color:#819080}#status{font-size:12px;color:#7b8874}[hidden]{display:none!important}
</style></head><body><div id="status" role="status" aria-live="polite">교장선생님의 이야기를 불러오고 있어요…</div>
<section id="welcome" hidden><div class="greeting"><div class="eyebrow">교장선생님의 환영 인사</div><p id="greeting"></p></div><h3>어떤 이야기가 궁금한가요?</h3><div id="choices"></div><p id="empty" hidden>학교 소개를 준비하고 있어요. 먼저 학교를 천천히 둘러보세요.</p></section>
<section id="answer" hidden aria-live="polite"><div class="eyebrow">교장선생님의 학교 이야기</div><h2 id="answer-title" tabindex="-1"></h2><p id="answer-text"></p><button id="back">← 다른 이야기 듣기</button></section><button id="refresh">이야기 새로고침</button>
<script>
const $=id=>document.getElementById(id);let previousChoice=null;
function load(){
  $('refresh').disabled=true;$('status').textContent='교장선생님의 이야기를 불러오고 있어요…';$('welcome').hidden=true;$('answer').hidden=true;
  google.script.run.withSuccessHandler(data=>{
    $('greeting').textContent=data.greeting;$('choices').replaceChildren();$('empty').hidden=data.topics.length>0;
    data.topics.forEach(topic=>{const button=document.createElement('button'),title=document.createElement('span'),arrow=document.createElement('span');title.textContent=topic.title;arrow.textContent='→';arrow.setAttribute('aria-hidden','true');button.append(title,arrow);button.onclick=()=>{previousChoice=button;$('welcome').hidden=true;$('answer').hidden=false;$('answer-title').textContent=topic.title;$('answer-text').textContent=topic.text;$('answer-title').focus();window.scrollTo(0,0);};$('choices').append(button);});
    $('welcome').hidden=false;$('status').textContent='';$('refresh').disabled=false;
  }).withFailureHandler(()=>{$('status').textContent='이야기를 불러오지 못했어요. 아래 새로고침을 눌러 다시 시도해 주세요.';$('refresh').disabled=false;}).getSchoolGuide();
}
$('back').onclick=()=>{$('answer').hidden=true;$('welcome').hidden=false;previousChoice?.focus();};$('refresh').onclick=load;load();
</script></body></html>`;
