const BRANCHES=["仁多支店","横田支店","大東支店","加茂支店","雲南さくら支店","雲南吉田支店","掛合支店","頓原支店","赤来支店"];
const TIMES=["09:00","09:30","10:00","10:30","11:00","12:30","13:00","13:30","14:00","14:30","15:00"];
const STEP_NAMES=["支店","日程","時間","お客様情報","確認事項","内容確認","完了"];
const HOLIDAYS_2024=[
"2024-01-01","2024-01-08","2024-02-11","2024-02-12","2024-02-23","2024-03-20","2024-04-29",
"2024-05-03","2024-05-04","2024-05-05","2024-05-06","2024-07-15","2024-08-11","2024-08-12",
"2024-09-16","2024-09-22","2024-09-23","2024-10-14","2024-11-03","2024-11-04","2024-11-23"
];
const HOLIDAYS_2025=[
"2025-01-01","2025-01-13","2025-02-11","2025-02-23","2025-02-24","2025-03-20","2025-04-29",
"2025-05-03","2025-05-04","2025-05-05","2025-05-06","2025-07-21","2025-08-11","2025-09-15",
"2025-09-23","2025-10-13","2025-11-03","2025-11-23","2025-11-24"
];
const HOLIDAYS_2026=[
"2026-01-01","2026-01-12","2026-02-11","2026-02-23","2026-03-20","2026-04-29",
"2026-05-03","2026-05-04","2026-05-05","2026-05-06","2026-07-20","2026-08-11",
"2026-09-21","2026-09-22","2026-09-23","2026-10-12","2026-11-03","2026-11-23"
];
const HOLIDAYS_2027=[
"2027-01-01","2027-01-11","2027-02-11","2027-02-23","2027-03-21","2027-03-22","2027-04-29",
"2027-05-03","2027-05-04","2027-05-05","2027-07-19","2027-08-11","2027-09-20","2027-09-23",
"2027-10-11","2027-11-03","2027-11-23"
];
const HOLIDAYS=new Set([...HOLIDAYS_2024,...HOLIDAYS_2025,...HOLIDAYS_2026,...HOLIDAYS_2027]);

const state={
  step:0, branch:"", date:"", time:"",
  customer:{name:"",kana:"",phone:""},
  visitCount:"1",
  details:{
    deceasedName:"",deceasedAddress:"",deceasedBirth:"",deceasedDeath:"",
    relation:"",will:"",agreement:"",notes:""
  },
  calendarMonth:new Date(new Date().getFullYear(),new Date().getMonth(),1),
  editingId: null, completedId: null, justModified: false
};

function getReservations(){
  let list = [];
  try { list = JSON.parse(localStorage.getItem("inheritanceReservations")||"[]"); } catch(e){}
  if(!Array.isArray(list)) list = [];
  list.forEach(r => {
    if(!r.customer) r.customer = {name:"", kana:"", phone:""};
    else if(typeof r.customer.kana === "undefined") r.customer.kana = "";
    if(!r.details) r.details = {};
  });
  return list;
}
function setReservations(v){localStorage.setItem("inheritanceReservations",JSON.stringify(v))}
function getBlocks(){
  let blocks = [];
  try { blocks = JSON.parse(localStorage.getItem("inheritanceBlocks")||"[]"); } catch(e){}
  if(!Array.isArray(blocks)) blocks = [];
  let changed = false;
  let newBlocks = [];
  blocks.forEach(b => {
    if(b.allDay){
      changed = true;
      const ADMIN_TIME_SLOTS=["09:00","09:30","10:00","10:30","11:00","11:30","12:30","13:00","13:30","14:00","14:30","15:00"];
      ADMIN_TIME_SLOTS.forEach(t => newBlocks.push({branch:b.branch,date:b.date,start:t,duration:30}));
    }else{
      newBlocks.push(b);
    }
  });
  if(changed) setBlocks(newBlocks);
  return newBlocks;
}
function setBlocks(v){localStorage.setItem("inheritanceBlocks",JSON.stringify(v))}
function getSettings(){
  let s = null;
  try { s = JSON.parse(localStorage.getItem("inheritanceSettings")); } catch(e){}
  if(!s || typeof s !== 'object') s = {daysAhead:60, sameDay:false};
  if(!s.assignees) s.assignees = {};
  if(Array.isArray(s.assignees)) s.assignees = {};
  
  // 担当者の文字列配列をオブジェクト配列に変換（互換性対応）
  Object.keys(s.assignees).forEach(k => {
    s.assignees[k] = s.assignees[k].map(a => {
      if (typeof a === "string") {
        const parts = a.trim().split(/[\s,　]+/);
        return { name: parts[0], email: parts[1] || "" };
      }
      return a;
    });
  });

  if(!s.branchEmails) s.branchEmails = {};
  if(!s.branchPhones) s.branchPhones = {};
  return s;
}
function setSettings(v){localStorage.setItem("inheritanceSettings",JSON.stringify(v))}

function pad(n){return String(n).padStart(2,"0")}
function formatDateISO(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function parseISO(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
function jpDate(s){
  if(!s)return "";
  const d=parseISO(s);
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${"日月火水木金土"[d.getDay()]}）`
}
function minutes(t){const [h,m]=t.split(":").map(Number);return h*60+m}
function overlaps(startA,durA,startB,durB){return startA<startB+durB && startB<startA+durA}
function endTime(t,d=90){let m=minutes(t)+d;return `${pad(Math.floor(m/60))}:${pad(m%60)}`}

function getPrevBusinessDay(date){
  let d=new Date(date);
  d.setHours(0,0,0,0);
  let count=0;
  while(count<1){
    d.setDate(d.getDate()-1);
    if(d.getDay()!==0&&d.getDay()!==6&&!HOLIDAYS.has(formatDateISO(d))){
      count++;
    }
  }
  return d;
}
function isDeadlinePassed(dateStr){
  const targetDate=parseISO(dateStr);
  const deadline=getPrevBusinessDay(targetDate);
  deadline.setHours(15,0,0,0);
  return new Date() >= deadline;
}

function isBookableDate(dateStr){
  const d=parseISO(dateStr);
  const now=new Date(); now.setHours(0,0,0,0);
  if(d <= now) return false;
  
  const settings=getSettings();
  const maxBookableDate=new Date(); maxBookableDate.setHours(0,0,0,0);
  maxBookableDate.setDate(maxBookableDate.getDate()+Number(settings.daysAhead||60));
  if(d > maxBookableDate) return false;
  if(d.getDay()===0||d.getDay()===6)return false;
  if(HOLIDAYS.has(dateStr))return false;
  return true;
}
function isTimeUnavailable(branch,date,time, excludeId=null){
  const start=minutes(time);
  const reservations=getReservations().filter(r=>r.branch===branch&&r.date===date&&r.status!=="キャンセル"&&r.id!==excludeId);
  if(reservations.some(r=>overlaps(start,90,minutes(r.time),90)))return true;
  const blocks=getBlocks().filter(b=>b.branch===branch&&b.date===date);
  if(blocks.some(b=>overlaps(start,90,minutes(b.start),Number(b.duration||30))))return true;
  return false;
}

function renderSteps(){
  document.getElementById("steps").innerHTML=STEP_NAMES.map((s,i)=>`
    <div class="step-item ${i===state.step?"active":""} ${i<state.step?"done":""}">
      <div class="step-num">${i<state.step?"✓":i+1}</div><div>${s}</div>
    </div>`).join("");
  const total=STEP_NAMES.length-1; // 完了画面は進捗対象外
  const cur=Math.min(state.step,total);
  const pct=Math.round((cur/total)*100);
  document.getElementById("mobileProgress").innerHTML=state.step>=total?"":`
    <span class="label">${cur+1} / ${total} ：${STEP_NAMES[cur]}</span>
    <div class="bar"><span style="width:${pct}%"></span></div>`;
}
function choiceCards(items,selected,onClick){
  return `<div class="cards">${items.map(x=>`
  <button class="choice-card ${selected===x?"selected":""}" aria-pressed="${selected===x}" onclick='${onClick}(${JSON.stringify(x)})'>
    <span class="icon">${x.slice(0,1)}</span>
    <span><strong>${x}</strong><span>${selected===x?"選択中":"選択する"}</span></span>
  </button>`).join("")}</div>`;
}
function showError(msg){document.getElementById("formError").textContent=msg||""}
function nextStep(){state.step++;window.scrollTo({top:0,behavior:"smooth"});renderBooking()}
function prevStep(){state.step--;window.scrollTo({top:0,behavior:"smooth"});renderBooking()}

function renderBooking(){
  renderSteps();
  const el=document.getElementById("bookingContent");
  if(state.step===0){
    el.innerHTML=`
      <h2 class="section-title">ご来店支店を選択</h2>
      <p class="section-lead">相続相談をご希望の支店を選んでください。</p>
      ${choiceCards(BRANCHES,state.branch,"selectBranch")}
      <div id="formError" class="error"></div>
      <div class="actions">
        <button class="btn secondary" onclick="viewLatestReservation()">予約の確認・変更</button>
        <button class="btn primary" onclick="goFromBranch()">日程を選ぶ</button>
      </div>`;
  }else if(state.step===1){
    let warningMsg = "";
    let isBlocked = false;
    if (state.date) {
      if (isDeadlinePassed(state.date)) {
        isBlocked = true;
        const s = getSettings();
        const phone = s.branchPhones[state.branch] || s.branchPhones["すべて"] || "未設定";
        warningMsg = `<div class="notice" style="margin-top:14px; background:#fff1f0; border-color:#f3b7b2; color:var(--danger)">
          1営業日前の15時を過ぎているため、${jpDate(state.date)}のご予約はWEBから受付できません。<br>
          該当日程の来店をご希望の場合は、恐れ入りますが直接 <strong>${state.branch}（TEL: ${esc(phone)}）</strong> までお電話にてご連絡ください。
        </div>`;
      }
    }

    el.innerHTML=`
      <h2 class="section-title">日程を選択</h2>
      <p class="section-lead">${state.branch}の空き日程から選択してください。土・日・祝日は予約できません。</p>
      ${renderCalendar()}
      ${warningMsg}
      <div id="formError" class="error"></div>
      <div class="actions"><button class="btn secondary" onclick="prevStep()">戻る</button><button class="btn primary" onclick="goFromDate()" ${isBlocked?"disabled":""}>時間を選ぶ</button></div>`;
  }else if(state.step===2){
    const allFull=TIMES.every(t=>isTimeUnavailable(state.branch,state.date,t,state.editingId));
    el.innerHTML=`
      <h2 class="section-title">時間を選択</h2>
      <p class="section-lead">${jpDate(state.date)}／相談時間90分</p>
      ${allFull?`<div class="empty-note">この日はすべての時間帯が予約済みです。別の日程をお選びください。</div>`:`
      <div class="times">${TIMES.map(t=>{
        const disabled=isTimeUnavailable(state.branch,state.date,t,state.editingId);
        const mark = disabled ? "×" : "◯";
        return `<button class="time-btn ${state.time===t?"selected":""}" aria-pressed="${state.time===t}" ${disabled?"disabled":""} onclick='selectTime("${t}")'>
          ${t}<br><strong class="time-mark ${disabled?"":"mark-enabled"}">${mark}</strong><span class="muted">${disabled?"予約不可":`${t}～${endTime(t)}`}</span>
        </button>`}).join("")}</div>`}
      <div class="notice" style="margin-top:18px">予約が入っている時間と90分の相談時間が重なる場合、その開始時間は選択できません。</div>
      <div id="formError" class="error"></div>
      <div class="actions"><button class="btn secondary" onclick="prevStep()">戻る</button>${allFull?"":`<button class="btn primary" onclick="goFromTime()">お客様情報へ</button>`}</div>`;
  }else if(state.step===3){
    el.innerHTML=`
      <h2 class="section-title">お客様情報</h2>
      <p class="section-lead">ご連絡可能なお名前、フリガナ、電話番号を入力してください。</p>
      <div class="grid two">
        <label>お名前 <span class="required">必須</span>
          <input id="customerName" value="${esc(state.customer.name)}" placeholder="例：山田 太郎">
        </label>
        <label>フリガナ（カタカナ） <span class="required">必須</span>
          <input id="customerKana" value="${esc(state.customer.kana)}" placeholder="例：ヤマダ タロウ">
        </label>
        <label>電話番号 <span class="required">必須</span>
          <input id="customerPhone" value="${esc(state.customer.phone)}" placeholder="例：090-1234-5678" inputmode="tel" oninput="formatPhoneInput(this)">
        </label>
      </div>
      <div class="notice" style="margin-top:18px">LINE表示名とは別に、正式なお名前をご入力ください。</div>
      <div id="formError" class="error"></div>
      <div class="actions"><button class="btn secondary" onclick="prevStep()">戻る</button><button class="btn primary" onclick="saveCustomer()">確認事項へ</button></div>`;
  }else if(state.step===4){
    const d=state.details;
    el.innerHTML=`
      <h2 class="section-title">確認事項</h2>
      <p class="section-lead">相談準備のため、分かる範囲でご入力ください。</p>
      <label>今回の相続相談は、何回目の来店になりますか？ <span class="required">必須</span>
        <select id="visitCount" onchange="toggleFirstVisit()">
          <option value="1" ${state.visitCount==="1"?"selected":""}>1回目</option>
          <option value="2" ${state.visitCount==="2"?"selected":""}>2回目以降</option>
        </select>
      </label>
      <div id="firstVisitFields" class="${state.visitCount==="2"?"hidden":""}" style="margin-top:18px">
        <div class="grid two">
          <label>被相続人氏名 <span class="required">必須</span>
            <input id="deceasedName" value="${esc(d.deceasedName)}" placeholder="亡くなられた方のお名前">
          </label>
          <label>被相続人住所
            <input id="deceasedAddress" value="${esc(d.deceasedAddress)}" placeholder="分かる範囲で入力">
          </label>
          <label>被相続人生年月日
            <input id="deceasedBirth" type="date" value="${esc(d.deceasedBirth)}">
          </label>
          <label>被相続人死亡日
            <input id="deceasedDeath" type="date" value="${esc(d.deceasedDeath)}">
          </label>
          <label>来店者と被相続人の続柄 <span class="required">必須</span>
            <input id="relation" value="${esc(d.relation)}" placeholder="例：長男、配偶者">
          </label>
          <label>遺言書はありますか？ <span class="required">必須</span>
            <select id="will">
              <option value="">選択してください</option>
              ${["ある","ない","分からない"].map(x=>`<option ${d.will===x?"selected":""}>${x}</option>`).join("")}
            </select>
          </label>
          <label>遺産分割協議書は作成予定ですか？ <span class="required">必須</span>
            <select id="agreement">
              <option value="">選択してください</option>
              ${["作成予定","作成予定はない","すでに作成している","分からない"].map(x=>`<option ${d.agreement===x?"selected":""}>${x}</option>`).join("")}
            </select>
          </label>
        </div>
      </div>
      <label style="margin-top:18px">連絡事項
        <textarea id="notes" placeholder="相談内容や事前に伝えておきたいこと">${esc(d.notes)}</textarea>
      </label>
      <div class="notice" style="margin-top:18px">入力内容は、相続相談の準備と連絡のために利用します。LINE通知には被相続人の詳細情報を表示しません。</div>
      <div id="formError" class="error"></div>
      <div class="actions"><button class="btn secondary" onclick="prevStep()">戻る</button><button class="btn primary" onclick="saveDetails()">確認する</button></div>`;
  }else if(state.step===5){
    el.innerHTML=`
      <h2 class="section-title">予約内容確認</h2>
      <p class="section-lead">内容をご確認のうえ、予約を確定してください。</p>
      ${renderSummary()}
      <div id="formError" class="error"></div>
      <div class="actions"><button class="btn secondary" onclick="prevStep()">修正する</button><button class="btn primary" onclick="submitReservation()">この内容で予約する</button></div>`;
  }else if(state.step===6){
    const latest=getReservations().find(r=>r.id===state.completedId);
    el.innerHTML=`
      <div class="success">
        <div class="success-icon">✓</div>
        <h2 class="section-title">${state.justModified ? "ご予約を変更しました" : "ご予約を受け付けました"}</h2>
        <p class="section-lead">${state.justModified ? "変更内容をLINEで通知する想定です。" : "予約内容をLINE通知する想定です。"}</p>
        ${latest?`
        <dl class="summary" style="text-align:left;max-width:650px;margin:0 auto">
          ${sumRow("予約番号",latest.id)}
          ${sumRow("支店",latest.branch)}
          ${sumRow("日時",`${jpDate(latest.date)} ${latest.time}～${endTime(latest.time)}`)}
          ${sumRow("相談内容","相続相談")}
        </dl>`:""}
        <div class="notice" style="max-width:650px;margin:18px auto 0;text-align:left">
          実運用では、この完了時にLINE Messaging APIからメッセージを送ります。
        </div>
        <div class="grid two" style="max-width:650px;margin:22px auto 0;">
          <button class="btn secondary" onclick="viewMyReservation()">予約内容を確認・変更する</button>
          <button class="btn primary" onclick="resetBooking()">トップへ戻る</button>
        </div>
      </div>`;
  }else if(state.step===7){
    const r = getReservations().find(x=>x.id===state.completedId);
    if(!r) return resetBooking();
    el.innerHTML=`
      <h2 class="section-title">予約内容の確認・変更</h2>
      <p class="section-lead">現在のご予約内容です。変更・キャンセルが可能です。</p>
      ${renderSummary()}
      <div id="formError" class="error"></div>
      <div class="grid two" style="margin-top:24px">
        <button class="btn secondary" onclick="editDateTime()">📅 日時・支店を変更する</button>
        <button class="btn secondary" onclick="editCustomerInfo()">📝 名前・メモなどを変更する</button>
      </div>
      <div style="margin-top:14px">
        <button class="btn danger" style="width:100%" onclick="userCancelReservation('${r.id}')">この予約をキャンセルする</button>
      </div>
      <div class="actions" style="justify-content:center">
        <button class="btn primary" onclick="resetBooking()">トップへ戻る</button>
      </div>
    `;
  }
}
function esc(v){return String(v||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function selectBranch(x){state.branch=x;renderBooking()}
function goFromBranch(){if(!state.branch)return showError("支店を選択してください。");nextStep()}
function goFromDate(){
  if(!state.date)return showError("日程を選択してください。");
  if (isDeadlinePassed(state.date)) {
    return showError("1営業日前の15時を過ぎているため、該当日程のご予約は直接支店へお電話ください。");
  }
  nextStep();
}
function selectTime(t){state.time=t;renderBooking()}
function goFromTime(){if(!state.time)return showError("時間を選択してください。");nextStep()}
function formatPhoneInput(input) {
  let val = input.value;
  if (/[^0-9\-]/.test(val)) {
    input.value = val.replace(/[^0-9\-]/g, '');
    val = input.value;
  }
  if (!val.includes('-')) {
    let nums = val.replace(/[^0-9]/g, '');
    if (nums.length === 11) {
      input.value = nums.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    } else if (nums.length === 10) {
      if (nums.startsWith('03') || nums.startsWith('06')) input.value = nums.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
      else if (nums.startsWith('0120') || nums.startsWith('0800')) input.value = nums.replace(/(\d{4})(\d{3})(\d{3})/, '$1-$2-$3');
      else input.value = nums.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    }
  }
}
function saveCustomer(){
  state.customer.name=document.getElementById("customerName").value.trim();
  state.customer.kana=document.getElementById("customerKana").value.trim();
  state.customer.phone=document.getElementById("customerPhone").value.trim();
  if(!state.customer.name)return showError("お名前を入力してください。");
  if(!state.customer.kana)return showError("フリガナを入力してください。");
  if(!/^[ァ-ヶー\s　]+$/.test(state.customer.kana))return showError("フリガナは全角カタカナで入力してください。");
  if(!/^[0-9\-+() ]{8,20}$/.test(state.customer.phone))return showError("電話番号を正しく入力してください。");
  nextStep();
}
function toggleFirstVisit(){
  state.visitCount=document.getElementById("visitCount").value;
  document.getElementById("firstVisitFields").classList.toggle("hidden",state.visitCount==="2");
}
function saveDetails(){
  state.visitCount=document.getElementById("visitCount").value;
  const d=state.details;
  d.notes=document.getElementById("notes").value.trim();
  if(state.visitCount==="1"){
    d.deceasedName=document.getElementById("deceasedName").value.trim();
    d.deceasedAddress=document.getElementById("deceasedAddress").value.trim();
    d.deceasedBirth=document.getElementById("deceasedBirth").value;
    d.deceasedDeath=document.getElementById("deceasedDeath").value;
    d.relation=document.getElementById("relation").value.trim();
    d.will=document.getElementById("will").value;
    d.agreement=document.getElementById("agreement").value;
    if(!d.deceasedName||!d.relation||!d.will||!d.agreement)return showError("必須項目を入力してください。");
  }
  nextStep();
}
function sumRow(k,v){return `<div class="summary-row"><dt>${k}</dt><dd>${esc(v||"未入力")}</dd></div>`}
function renderSummary(){
  const d=state.details;
  return `<dl class="summary">
    ${sumRow("相談内容","相続相談（90分）")}
    ${sumRow("支店",state.branch)}
    ${sumRow("日時",`${jpDate(state.date)} ${state.time}～${endTime(state.time)}`)}
    ${sumRow("お名前",state.customer.name)}
    ${sumRow("フリガナ",state.customer.kana)}
    ${sumRow("電話番号",state.customer.phone)}
    ${sumRow("来店回数",state.visitCount==="1"?"1回目":"2回目以降")}
    ${state.visitCount==="1"?[
      sumRow("被相続人氏名",d.deceasedName),
      sumRow("被相続人住所",d.deceasedAddress),
      sumRow("被相続人生年月日",d.deceasedBirth),
      sumRow("被相続人死亡日",d.deceasedDeath),
      sumRow("続柄",d.relation),
      sumRow("遺言書",d.will),
      sumRow("遺産分割協議書",d.agreement)
    ].join(""):""}
    ${sumRow("連絡事項",d.notes)}
  </dl>`;
}
function submitReservation(){
  if(isTimeUnavailable(state.branch,state.date,state.time)){
    return showError("この時間は直前に予約済みとなりました。時間を選び直してください。");
  }
  const list=getReservations();
  const now=new Date();
  const id=`SOZOKU-${state.date.replaceAll("-","")}-${String(getReservations().length+1).padStart(3,"0")}`;
  const r={
    id,createdAt:now.toISOString(),status:"未確認",service:"相続相談",duration:90,
    branch:state.branch,date:state.date,time:state.time,
    customer:{...state.customer},visitCount:state.visitCount,details:{...state.details},
    lineUserId:"LIFF連携時に保存"
  };
  list.push(r);setReservations(list);
  state.completedId=id;
  state.justModified=false;
  state.step=6;renderBooking();
}
function resetBooking(){
  Object.assign(state,{
    step:0,branch:"",date:"",time:"",
    customer:{name:"",kana:"",phone:""},visitCount:"1",
    details:{deceasedName:"",deceasedAddress:"",deceasedBirth:"",deceasedDeath:"",relation:"",will:"",agreement:"",notes:""},
    calendarMonth:new Date(new Date().getFullYear(),new Date().getMonth(),1),
    editingId: null, completedId: null, justModified: false
  });
  renderBooking();
}
function renderCalendar(){
  const m=state.calendarMonth;
  const y=m.getFullYear(),mo=m.getMonth();
  const first=new Date(y,mo,1),last=new Date(y,mo+1,0);
  const today=new Date();today.setHours(0,0,0,0);
  const todayIso=formatDateISO(today);
  const currentMonthStart=new Date(today.getFullYear(),today.getMonth(),1);
  let cells=[];
  for(let i=0;i<first.getDay();i++)cells.push(`<div></div>`);
  for(let d=1;d<=last.getDate();d++){
    const iso=formatDateISO(new Date(y,mo,d));
    const enabled=isBookableDate(iso);
    const isToday=iso===todayIso;
    cells.push(`<button class="day ${enabled?"enabled":"disabled"} ${state.date===iso?"selected":""} ${isToday?"today":""}" ${enabled?"":'disabled'} aria-label="${y}年${mo+1}月${d}日${enabled?"":"（予約不可）"}" onclick='pickDate("${iso}")'>${d}</button>`);
  }
  const atMinMonth=new Date(y,mo,1)<=currentMonthStart;
  return `<div class="calendar">
    <div class="calendar-head">
      <button onclick="moveMonth(-1)" ${atMinMonth?"disabled":""} aria-label="前の月">‹</button>
      <strong>${y}年${mo+1}月</strong>
      <button onclick="moveMonth(1)" aria-label="次の月">›</button>
    </div>
    <div class="calendar-grid">
      ${["日","月","火","水","木","金","土"].map(x=>`<div class="dow">${x}</div>`).join("")}
      ${cells.join("")}
    </div>
  </div>`;
}
function moveMonth(n){
  const next=new Date(state.calendarMonth.getFullYear(),state.calendarMonth.getMonth()+n,1);
  const today=new Date();const minMonth=new Date(today.getFullYear(),today.getMonth(),1);
  if(next<minMonth)return;
  state.calendarMonth=next;renderBooking();
}
function pickDate(s){state.date=s;state.time="";renderBooking()}

function viewMyReservation() {
  const r = getReservations().find(x => x.id === state.completedId);
  if (r) {
    state.branch = r.branch;
    state.date = r.date;
    state.time = r.time;
    state.customer = {...r.customer};
    state.visitCount = r.visitCount;
    state.details = {...r.details};
  }
  state.step = 7;
  window.scrollTo({top:0,behavior:"smooth"});
  renderBooking();
}
function viewLatestReservation() {
  const list = getReservations();
  // キャンセルされていない最新の予約を優先して取得
  const target = list.slice().reverse().find(r => r.status !== "キャンセル") || list[list.length - 1];
  
  if (!target) {
    return alert("確認できる予約履歴がありません。");
  }
  state.completedId = target.id;
  viewMyReservation();
}
function editDateTime(){
  state.editingId = state.completedId;
  state.step = 1;
  window.scrollTo({top:0,behavior:"smooth"});
  renderBooking();
}
function editCustomerInfo(){
  state.editingId = state.completedId;
  state.step = 3;
  window.scrollTo({top:0,behavior:"smooth"});
  renderBooking();
}
function userCancelReservation(id) {
  if(confirm("この予約をキャンセルしてもよろしいですか？\n※取り消すと元に戻せません。")) {
    const list = getReservations();
    const r = list.find(x => x.id === id);
    if(r) {
      r.status = "キャンセル";
      setReservations(list);
      alert("ご予約をキャンセルしました。");
      resetBooking();
    }
  }
}

/* Admin */
let adminView="reservations";
let adminTabStatus="未確認";
let adminReservationMonth=new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let adminCalendarLayout="horizontal";

function moveAdminReservationMonth(n) {
  adminReservationMonth = new Date(adminReservationMonth.getFullYear(), adminReservationMonth.getMonth() + n, 1);
  renderAdmin();
}
function resetAdminReservationMonth() {
  adminReservationMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  renderAdmin();
}
function toggleCalendarLayout() {
  adminCalendarLayout = adminCalendarLayout === "vertical" ? "horizontal" : "vertical";
  renderAdmin();
}

function renderAdminReservationCalendar() {
  const m = adminReservationMonth;
  const y = m.getFullYear(), mo = m.getMonth();
  const first = new Date(y, mo, 1), last = new Date(y, mo + 1, 0);
  
  const today = new Date(); today.setHours(0,0,0,0);
  const todayIso = formatDateISO(today);

  const reservationsInMonth = getReservations().filter(r => {
    if(window._fb && r.branch !== window._fb) return false;
    if(r.status === "キャンセル") return false;
    return true;
  });

  const headerMonthLabel = document.getElementById('headerMonthLabel');
  if(headerMonthLabel) headerMonthLabel.textContent = `${y}年${mo+1}月`;

  let cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(`<div></div>`);
  for (let d = 1; d <= last.getDate(); d++) {
    const targetDate = new Date(y, mo, d);
    const iso = formatDateISO(targetDate);
    const isToday = iso === todayIso;
    const isPast = targetDate < today;
    
    const dayReservations = reservationsInMonth.filter(r => r.date === iso);
    const hasRes = dayReservations.length > 0;
    
    let content = `<span class="day-num">${d}</span>`;
    if (adminCalendarLayout === "vertical") {
      if (hasRes) {
        const sortedRes = [...dayReservations].sort((a,b) => a.time.localeCompare(b.time));
        const resHtml = sortedRes.map(r => {
          const serviceName = r.service ? r.service.replace("相談", "") : "相続";
          let statusClass = "";
          if (r.status === "未確認") statusClass = "unread"; else if (r.status === "準備中") statusClass = "doing";
          return `<div class="cal-res-item ${statusClass}" onclick="openAndScrollToReservation('${r.id}')">${r.time} ${esc(serviceName)}:${esc(r.customer.name)}様</div>`;
        }).join("");
        content += `<div style="width:100%;margin-top:4px">${resHtml}</div>`;
      }
    } else {
      const dot = hasRes ? `<span class="dot-partial" style="background:var(--brand)"></span>` : "";
      content += dot;
    }
    
    cells.push(`<div class="day enabled ${isToday?"today":""} ${isPast?"past":""}">${content}</div>`);
  }
  
  let calendarHeadHtml = "";
  if (adminCalendarLayout !== "vertical") {
    calendarHeadHtml = `
      <div class="calendar-head">
        <div style="display:flex; align-items:center; gap:8px;">
          <button onclick="moveAdminReservationMonth(-1)">‹</button>
          <strong>${y}年${mo+1}月</strong>
          <button onclick="moveAdminReservationMonth(1)">›</button>
        </div>
        <button class="btn secondary" style="padding:4px 8px; font-size:11px;" onclick="resetAdminReservationMonth()">今日</button>
      </div>
    `;
  }

  return `
    <div class="calendar" style="background:#fff">
      ${calendarHeadHtml}
      <div class="calendar-grid">
        ${["日","月","火","水","木","金","土"].map(x=>`<div class="dow">${x}</div>`).join("")}
        ${cells.join("")}
      </div>
    </div>
  `;
}

document.querySelectorAll("[data-admin]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-admin]").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");adminView=b.dataset.admin;renderAdmin();
});
function renderAdmin(){
  const isVerticalRes = (adminView === "reservations" && adminCalendarLayout === "vertical");
  
  const adminHeaderMenu = document.querySelector('.admin-header-menu');
  if(adminHeaderMenu) adminHeaderMenu.style.display = isVerticalRes ? "none" : "flex";

  const headerMonthControls = document.getElementById('headerMonthControls');
  if(headerMonthControls) {
    headerMonthControls.style.display = isVerticalRes ? "flex" : "none";
  }

  const calendarLargeControls = document.getElementById('calendarLargeControls');
  const mainModeSwitch = document.getElementById('mainModeSwitch');
  if (calendarLargeControls && mainModeSwitch) {
    if (isVerticalRes) {
      calendarLargeControls.style.display = "flex";
      mainModeSwitch.style.display = "none";
      const sel = document.getElementById('headerFilterBranch');
      if(sel) sel.innerHTML = `<option value="">すべて</option>` + BRANCHES.map(x=>`<option value="${x}" ${window._fb===x?"selected":""}>${x}</option>`).join("");
    } else {
      calendarLargeControls.style.display = "none";
      mainModeSwitch.style.display = "flex";
    }
  }

  const el=document.getElementById("adminContent");
  if(adminView==="reservations")renderReservations(el);
  if(adminView==="blocks")renderBlocks(el);
  if(adminView==="settings")renderSettings(el);
}

let adminEditingReservationId = "";
function saveReservationEdit(id) {
  const list = getReservations();
  const r = list.find(x => x.id === id);
  if (!r) return;

  const getVal = (cid) => document.getElementById(cid) ? document.getElementById(cid).value.trim() : "";

  r.service = getVal(`edit-service-${id}`);
  if(!r.customer) r.customer = {};
  r.customer.name = getVal(`edit-name-${id}`);
  r.customer.kana = getVal(`edit-kana-${id}`);
  r.customer.phone = getVal(`edit-phone-${id}`);
  r.visitCount = getVal(`edit-vc-${id}`);
  
  if(!r.details) r.details = {};
  if (r.visitCount === "1") {
    r.details.deceasedName = getVal(`edit-dname-${id}`);
    r.details.deceasedAddress = getVal(`edit-daddr-${id}`);
    r.details.deceasedBirth = getVal(`edit-dbirth-${id}`);
    r.details.deceasedDeath = getVal(`edit-ddeath-${id}`);
    r.details.relation = getVal(`edit-rel-${id}`);
    r.details.will = getVal(`edit-will-${id}`);
    r.details.agreement = getVal(`edit-agree-${id}`);
  }
  r.details.notes = getVal(`edit-notes-${id}`);

  setReservations(list);
  adminEditingReservationId = "";
  renderAdmin();
}
function saveAdminMemo(id) {
  const list = getReservations();
  const r = list.find(x => x.id === id);
  if (r && document.getElementById(`admin-memo-${id}`)) {
    r.adminMemo = document.getElementById(`admin-memo-${id}`).value;
    setReservations(list);
    alert("管理者メモを保存しました。");
  }
}

function renderReservations(el){
  let allList = getReservations().filter(r => !window._fb || r.branch === window._fb);
  
  // 旧バージョンのデータ互換性
  allList.forEach(r => { 
    if(r.status === "予約受付" || r.status === "未対応") r.status = "未確認"; 
    if(r.status === "対応中") r.status = "準備中"; 
    if(r.status === "対応済") r.status = "来店済"; 
  });

  const countUnread = allList.filter(r => r.status === "未確認").length;
  const countDoing = allList.filter(r => r.status === "準備中").length;
  const countDone = allList.filter(r => r.status === "来店済").length;
  const assigneesObj = getSettings().assignees || { "すべて": [] };

  const list = allList.filter(r => r.status === adminTabStatus).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const isVertical = adminCalendarLayout === "vertical";

  el.innerHTML=`
    ${isVertical ? "" : `
    <div style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:10px; margin-bottom:18px">
      <div>
        <h2 class="section-title" style="margin-bottom:0">予約一覧</h2>
        <p class="section-lead" style="margin-top:4px;margin-bottom:0">全支店の予約を確認できます。</p>
      </div>
      <div class="toolbar" style="margin-bottom:0">
        <label>支店<select id="filterBranch" onchange="window._fb=this.value;renderAdmin()"><option value="">すべて</option>${BRANCHES.map(x=>`<option value="${x}" ${window._fb===x?"selected":""}>${x}</option>`).join("")}</select></label>
        <button class="btn secondary" onclick="toggleCalendarLayout()">カレンダーを大きくする</button>
        <button class="btn secondary" onclick="exportCsv()">CSV出力</button>
      </div>
    </div>
    `}
    
    <div class="admin-reservations-layout ${adminCalendarLayout}">
      <div>
        ${renderAdminReservationCalendar()}
      </div>
      <div>
        <div class="status-tabs">
          <button class="status-tab ${adminTabStatus==="未確認"?"active":""}" data-status="未確認" onclick="adminTabStatus='未確認';renderAdmin()">未確認 <span class="status-badge">${countUnread}</span></button>
          <button class="status-tab ${adminTabStatus==="準備中"?"active":""}" data-status="準備中" onclick="adminTabStatus='準備中';renderAdmin()">準備中 <span class="status-badge">${countDoing}</span></button>
          <button class="status-tab ${adminTabStatus==="来店済"?"active":""}" data-status="来店済" onclick="adminTabStatus='来店済';renderAdmin()">来店済 <span class="status-badge">${countDone}</span></button>
        </div>
        <div class="table-wrap"><table>
      <thead><tr><th>日時</th><th>支店</th><th>氏名</th><th>状態</th><th></th></tr></thead>
      <tbody>${list.length?list.map(r=>`
        <tr class="accordion-trigger ${!r.assignee?'no-assignee':''}" onclick="toggleAccordion('${r.id}')">
          <td>${jpDate(r.date)}<br><strong>${r.time}～${endTime(r.time)}</strong></td>
          <td>${r.branch}<br><span id="assignee-label-${r.id}" class="assignee-label">担当: ${esc(r.assignee||"未設定")}</span></td>
          <td>${esc(r.customer.name)}</td>
          <td><span class="badge ${r.status==="キャンセル"?"cancelled":""}">${r.status}</span></td>
          <td style="text-align:right;color:var(--muted);font-size:12px">詳細 ▼</td>
        </tr>
        <tr id="detail-${r.id}" class="accordion-content ${adminOpenAccordion===r.id?"open":""}">
          <td colspan="5" style="padding:0;border-bottom:1px solid var(--line)">
            <div class="accordion-details">
              <div class="detail-grid">
                ${adminEditingReservationId === r.id ? `
                <div><dt>予約番号</dt><dd>${r.id}</dd></div>
                <div><dt>相談内容</dt><dd><input id="edit-service-${r.id}" value="${esc(r.service||"相続相談")}"></dd></div>
                <div><dt>氏名</dt><dd><input id="edit-name-${r.id}" value="${esc(r.customer.name)}"></dd></div>
                <div><dt>フリガナ</dt><dd><input id="edit-kana-${r.id}" value="${esc(r.customer.kana)}"></dd></div>
                <div><dt>電話番号</dt><dd><input id="edit-phone-${r.id}" value="${esc(r.customer.phone)}"></dd></div>
                <div><dt>来店回数</dt><dd><select id="edit-vc-${r.id}"><option value="1" ${r.visitCount==="1"?"selected":""}>初回</option><option value="2" ${r.visitCount==="2"?"selected":""}>2回目以降</option></select></dd></div>
                ${r.visitCount==="1"?`
                <div><dt>被相続人氏名</dt><dd><input id="edit-dname-${r.id}" value="${esc(r.details.deceasedName)}"></dd></div>
                <div><dt>被相続人住所</dt><dd><input id="edit-daddr-${r.id}" value="${esc(r.details.deceasedAddress)}"></dd></div>
                <div><dt>被相続人生年月日</dt><dd><input type="date" id="edit-dbirth-${r.id}" value="${esc(r.details.deceasedBirth)}"></dd></div>
                <div><dt>被相続人死亡日</dt><dd><input type="date" id="edit-ddeath-${r.id}" value="${esc(r.details.deceasedDeath)}"></dd></div>
                <div><dt>続柄</dt><dd><input id="edit-rel-${r.id}" value="${esc(r.details.relation)}"></dd></div>
                <div><dt>遺言書</dt><dd><select id="edit-will-${r.id}"><option ${r.details.will==="ある"?"selected":""}>ある</option><option ${r.details.will==="ない"?"selected":""}>ない</option><option ${r.details.will==="分からない"?"selected":""}>分からない</option></select></dd></div>
                <div><dt>遺産分割協議書</dt><dd><select id="edit-agree-${r.id}"><option ${r.details.agreement==="作成予定"?"selected":""}>作成予定</option><option ${r.details.agreement==="作成予定はない"?"selected":""}>作成予定はない</option><option ${r.details.agreement==="すでに作成している"?"selected":""}>すでに作成している</option><option ${r.details.agreement==="分からない"?"selected":""}>分からない</option></select></dd></div>
                `:""}
                <div class="detail-full"><dt>連絡事項</dt><dd><textarea id="edit-notes-${r.id}">${esc(r.details.notes)}</textarea></dd></div>
                <div class="detail-full" style="text-align:right; margin-bottom:8px;">
                  <button class="btn secondary" style="padding:6px 12px; font-size:12px;" onclick="adminEditingReservationId=''; renderAdmin();">キャンセル</button>
                  <button class="btn primary" style="padding:6px 12px; font-size:12px;" onclick="saveReservationEdit('${r.id}')">修正を保存</button>
                </div>
                ` : `
                <div><dt>予約番号</dt><dd>${r.id}</dd></div>
                <div><dt>相談内容</dt><dd>${esc(r.service||"相続相談")}</dd></div>
                <div><dt>フリガナ</dt><dd>${esc(r.customer.kana)}</dd></div>
                <div><dt>電話番号</dt><dd>${esc(r.customer.phone)}</dd></div>
                <div><dt>来店回数</dt><dd>${r.visitCount==="1"?"初回":"2回目以降"}</dd></div>
                ${r.visitCount==="1"?`
                <div><dt>被相続人氏名</dt><dd>${esc(r.details.deceasedName)}</dd></div>
                <div><dt>被相続人住所</dt><dd>${esc(r.details.deceasedAddress)||"未入力"}</dd></div>
                <div><dt>被相続人生年月日</dt><dd>${esc(r.details.deceasedBirth)||"未入力"}</dd></div>
                <div><dt>被相続人死亡日</dt><dd>${esc(r.details.deceasedDeath)||"未入力"}</dd></div>
                <div><dt>続柄</dt><dd>${esc(r.details.relation)}</dd></div>
                <div><dt>遺言書</dt><dd>${esc(r.details.will)}</dd></div>
                <div><dt>遺産分割協議書</dt><dd>${esc(r.details.agreement)}</dd></div>
                `:""}
                <div class="detail-full"><dt>連絡事項</dt><dd>${esc(r.details.notes)||"なし"}</dd></div>
                <div class="detail-full" style="text-align:right; margin-bottom:8px;">
                  <button class="btn secondary" style="padding:6px 12px; font-size:12px;" onclick="adminEditingReservationId='${r.id}'; renderAdmin();">予約内容を修正</button>
                </div>
                `}

                <div class="detail-full" style="background:#fff; border:1px dashed var(--line); padding:12px; border-radius:8px;">
                  <dt style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    管理者メモ（お客様には見えません）
                    <button class="btn secondary" style="padding:4px 10px; font-size:11px;" onclick="saveAdminMemo('${r.id}')">メモのみ保存</button>
                  </dt>
                  <dd><textarea id="admin-memo-${r.id}" placeholder="対応の記録など...">${esc(r.adminMemo||"")}</textarea></dd>
                </div>

                <div class="detail-full" style="margin-top:12px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;background:#fff;padding:12px 16px;border-radius:8px;border:1px solid var(--line)">
                  <label style="margin:0;display:flex;align-items:center;gap:8px">当日対応者 <span class="required" style="margin:0">必須</span>:
                    <select id="assignee-${r.id}" onclick="event.stopPropagation()" style="width:140px;padding:6px 10px;font-size:13px;border-radius:6px;min-height:auto">
                      <option value="">選択してください</option>
                      ${[...new Set([...(assigneesObj[r.branch]||[]).map(x=>x.name), r.assignee].filter(x=>x))].map(a => `<option value="${esc(a)}" ${r.assignee===a?"selected":""}>${esc(a)}</option>`).join("")}
                    </select>
                  </label>
                  <button class="btn secondary" style="padding:6px 12px;font-size:12px;border-radius:6px" onclick="event.stopPropagation();confirmAssignee('${r.id}')">設定</button>
                  <div style="display:flex;gap:6px;margin-left:auto;align-items:center;flex-wrap:wrap">
                    <span style="font-size:12px;color:var(--muted)">ステータス変更:</span>
                    ${r.status!=="未確認"?`<button class="btn secondary" style="padding:6px 10px;font-size:12px;border-radius:6px" onclick="event.stopPropagation();changeReservationStatus('${r.id}', '未確認')">未確認に戻す</button>`:""}
                    ${r.status!=="準備中"?`<button class="btn primary" style="padding:6px 10px;font-size:12px;border-radius:6px" onclick="event.stopPropagation();changeReservationStatus('${r.id}', '準備中')">準備中へ</button>`:""}
                    ${(r.status!=="来店済" && r.status!=="未確認")?`<button class="btn secondary" style="padding:6px 10px;font-size:12px;border-radius:6px;background:var(--brand-soft);color:var(--brand-dark);border-color:var(--brand)" onclick="event.stopPropagation();changeReservationStatus('${r.id}', '来店済')">来店済へ</button>`:""}
                    ${r.status!=="キャンセル"?`<button class="btn danger" style="padding:6px 10px;font-size:12px;border-radius:6px" onclick="event.stopPropagation();cancelReservation('${r.id}')">予約取消</button>`:""}
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>`).join(""):`<tr><td colspan="5">予約はまだありません。</td></tr>`}</tbody>
    </table></div>
      </div>
    </div>`;
}
let adminOpenAccordion="";
function toggleAccordion(id){
  const el=document.getElementById("detail-"+id);
  if(el){
    el.classList.toggle("open");
    if(el.classList.contains("open")) adminOpenAccordion=id;
    else if(adminOpenAccordion===id) adminOpenAccordion="";
  }
}
function openAndScrollToReservation(id) {
  const r = getReservations().find(x => x.id === id);
  if(!r) return;
  
  // 対象の予約が現在のタブ（ステータス）にない場合はタブを切り替える
  if(adminTabStatus !== r.status) {
    adminTabStatus = r.status;
  }
  renderAdmin();
  
  setTimeout(() => {
    const detailEl = document.getElementById("detail-" + id);
    if(!detailEl) return;
    if(adminOpenAccordion !== id) {
      if(adminOpenAccordion) {
        const old = document.getElementById("detail-" + adminOpenAccordion);
        if(old) old.classList.remove("open");
      }
      detailEl.classList.add("open");
      adminOpenAccordion = id;
    }
    const trigger = detailEl.previousElementSibling;
    if(trigger) {
      trigger.scrollIntoView({ behavior: "smooth", block: "center" });
      trigger.style.transition = "background 0.5s";
      trigger.style.background = "var(--brand-soft)";
      setTimeout(() => { trigger.style.background = ""; }, 1500);
    }
  }, 50);
}
function confirmAssignee(id){
  const select = document.getElementById("assignee-"+id);
  if(!select) return;
  const val = select.value.trim();
  const list=getReservations();const r=list.find(x=>x.id===id);
  if(r){
    if(confirm("担当者を設定しますか？")){
      r.assignee=val;setReservations(list);
      renderAdmin();
    } else {
      select.value = r.assignee || "";
    }
  }
}
function changeReservationStatus(id, newStatus){
  const list=getReservations();const r=list.find(x=>x.id===id);
  if(r){
    if(newStatus==="準備中" && !r.assignee){
      alert("「準備中」へ変更するには、担当者の設定が必須です。担当者を選択し、「設定」ボタンで確定してください。");
      renderAdmin();return;
    }
    if(r.status==="未確認" && newStatus==="来店済"){
      alert("「未確認」から直接「来店済」へは変更できません。まずは「準備中」へ変更して担当者を設定してください。");
      renderAdmin();return;
    }
    r.status=newStatus;setReservations(list);renderAdmin();renderBooking();
  }
}
function cancelReservation(id){
  if(confirm("この予約を取り消してもよろしいですか？")){
    changeReservationStatus(id, "キャンセル");
  }
}
function exportCsv(){
  const rows=[["予約番号","相談内容","支店","当日対応者","日付","開始","終了","氏名","フリガナ","電話番号","来店回数","被相続人氏名","続柄","状態"]];
  getReservations().forEach(r=>rows.push([r.id,r.service||"相続相談",r.branch,r.assignee||"",r.date,r.time,endTime(r.time),r.customer.name,r.customer.kana||"",r.customer.phone,r.visitCount,r.details.deceasedName,r.details.relation,r.status]));
  const csv="\uFEFF"+rows.map(row=>row.map(v=>`"${String(v||"").replaceAll('"','""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="相続相談予約一覧.csv";a.click();URL.revokeObjectURL(a.href);
}

let adminBlockState = {
  branch: BRANCHES[0],
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  date: formatDateISO(new Date())
};
function renderBlocks(el){
  const ADMIN_TIME_SLOTS = ["09:00","09:30","10:00","10:30","11:00","11:30","12:30","13:00","13:30","14:00","14:30","15:00"];
  const branch = adminBlockState.branch;
  const m = adminBlockState.month;
  const y = m.getFullYear(), mo = m.getMonth();
  const first = new Date(y, mo, 1), last = new Date(y, mo + 1, 0);
  
  const allBlocks = getBlocks();
  const branchBlocks = allBlocks.filter(b => b.branch === branch);
  
  const today = new Date(); today.setHours(0,0,0,0);
  const todayIso = formatDateISO(today);
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const atMinMonth = new Date(y, mo, 1) <= currentMonthStart;

  let cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(`<div></div>`);
  for (let d = 1; d <= last.getDate(); d++) {
    const iso = formatDateISO(new Date(y, mo, d));
    const targetDate = parseISO(iso);
    const dayBlocks = branchBlocks.filter(b => b.date === iso);
    
    let statusClass = "";
    let statusDot = "";
    const isPast = targetDate < today;
    const isHolidayOrWeekend = targetDate.getDay() === 0 || targetDate.getDay() === 6 || HOLIDAYS.has(iso);
    const isDisabled = isPast || isHolidayOrWeekend;
    const isToday = iso === todayIso;
    
    if (isDisabled) {
      statusClass = "disabled";
    } else {
      statusClass = "enabled";
      const daySlotCount = ADMIN_TIME_SLOTS.filter(t => dayBlocks.some(b => b.start === t)).length;
      if (daySlotCount === ADMIN_TIME_SLOTS.length) {
        statusClass += " blocked-all";
      } else if (daySlotCount > 0) {
        statusDot = `<span class="dot-partial"></span>`;
      }
    }
    if (isToday) statusClass += " today";

    const isSel = (adminBlockState.date === iso) ? "selected" : "";
    const disabledAttr = isDisabled ? "disabled" : "";
    cells.push(`<button class="day ${statusClass} ${isSel}" ${disabledAttr} onclick='selectAdminBlockDate("${iso}")'>${d}${statusDot}</button>`);
  }
  
  const targetDateState = parseISO(adminBlockState.date);
  const isSelectedPast = targetDateState < today;
  const isSelectedHolidayOrWeekend = targetDateState.getDay() === 0 || targetDateState.getDay() === 6 || HOLIDAYS.has(adminBlockState.date);
  const isSelectedDisabled = isSelectedPast || isSelectedHolidayOrWeekend;

  const selBlocks = branchBlocks.filter(b => b.date === adminBlockState.date);
  const isAllDay = ADMIN_TIME_SLOTS.every(t => selBlocks.some(b => b.start === t));
  
  const reservations = getReservations().filter(r => r.branch === branch && r.date === adminBlockState.date && r.status !== "キャンセル");

  const slotsHtml = ADMIN_TIME_SLOTS.map(t => {
    const isBlocked = selBlocks.some(b => b.start === t);
    const startM = minutes(t);
    const isReserved = reservations.some(r => overlaps(startM, 90, minutes(r.time), 90));
    if (isReserved) {
      return `<button class="time-block-btn reserved" disabled><span>${t}</span><span class="reserved-label">予約済</span></button>`;
    }
    return `<button class="time-block-btn ${isBlocked?"blocked":""}" data-time="${t}" onmousedown="startDragBlock(event, '${t}')" onmouseenter="enterDragBlock(event, '${t}')" ontouchstart="startDragBlock(event, '${t}')"><span>${t}</span></button>`;
  }).join("");

  el.innerHTML=`
    <h2 class="section-title">対応不可枠設定</h2>
    <p class="section-lead">支店や担当者の都合で対応できない日時をブロックします。時間をタップ（クリック）するだけで即時反映されます。</p>
    
    <div class="toolbar" style="margin-bottom:16px">
      <label>対象支店
        <select onchange="adminBlockState.branch=this.value;renderAdmin()">
          ${BRANCHES.map(x=>`<option value="${x}" ${x===branch?"selected":""}>${x}</option>`).join("")}
        </select>
      </label>
    </div>

    <div class="block-admin-layout">
      <div class="calendar">
        <div class="calendar-head">
          <button onclick="moveAdminBlockMonth(-1)" ${atMinMonth?"disabled":""}>‹</button>
          <strong>${y}年${mo+1}月</strong>
          <button onclick="moveAdminBlockMonth(1)">›</button>
        </div>
        <div class="calendar-grid">
          ${["日","月","火","水","木","金","土"].map(x=>`<div class="dow">${x}</div>`).join("")}
          ${cells.join("")}
        </div>
      </div>
      
      <div class="block-detail-panel">
        <div class="detail-head">
          <h3 style="margin-bottom:12px;margin-top:0">${jpDate(adminBlockState.date)}</h3>
          ${!isSelectedDisabled ? `
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn secondary" style="padding:6px 12px;font-size:12px;border-radius:6px" onclick="setBlockPreset('clear')">すべて可</button>
            <button class="btn secondary" style="padding:6px 12px;font-size:12px;border-radius:6px" onclick="setBlockPreset('am')">午前不可</button>
            <button class="btn secondary" style="padding:6px 12px;font-size:12px;border-radius:6px" onclick="setBlockPreset('pm')">午後不可</button>
            <button class="btn danger" style="padding:6px 12px;font-size:12px;border-radius:6px" onclick="setBlockPreset('all')">終日不可</button>
          </div>
          ` : ""}
        </div>
        ${isSelectedDisabled ? `
        <div class="empty-note" style="margin-top:20px; border: none; background: #f9fafb;">
          ${isSelectedPast ? "過去の日付のため、対応不可枠の設定は不要です。" : "土曜日・日曜日・祝日は定休日のため、対応不可枠の設定は不要です。"}
        </div>
        ` : `
        <div class="time-blocks-grid">
          ${slotsHtml}
        </div>
        <div class="notice" style="margin-top:16px;padding:12px;font-size:12px">
          ・30分単位で対応不可枠を設定できます。<br>
          ・赤色の時間が「不可」としてブロックされます。<br>
          ・すでに予約が入っている時間はグレー（予約済）で表示され、設定不要です。
        </div>
        `}
      </div>
    </div>
  `;
}

function selectAdminBlockDate(iso) {
  adminBlockState.date = iso;
  renderAdmin();
}
function moveAdminBlockMonth(n) {
  const m = adminBlockState.month;
  const next = new Date(m.getFullYear(), m.getMonth() + n, 1);
  const today = new Date(); const minMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  if(next < minMonth) return;
  adminBlockState.month = next;
  renderAdmin();
}
function setBlockPreset(type) {
  const { branch, date } = adminBlockState;
  let allBlocks = getBlocks();
  const ADMIN_TIME_SLOTS = ["09:00","09:30","10:00","10:30","11:00","11:30","12:30","13:00","13:30","14:00","14:30","15:00"];
  
  allBlocks = allBlocks.filter(b => !(b.branch === branch && b.date === date));
  
  let slotsToAdd = [];
  if (type === 'am') slotsToAdd = ADMIN_TIME_SLOTS.filter(t => t < "12:00");
  else if (type === 'pm') slotsToAdd = ADMIN_TIME_SLOTS.filter(t => t >= "12:00");
  else if (type === 'all') slotsToAdd = ADMIN_TIME_SLOTS;
  
  slotsToAdd.forEach(t => allBlocks.push({ branch, date, start: t, duration: 30 }));
  setBlocks(allBlocks);
  renderAdmin();
  renderBooking();
}

let isDraggingBlock = false;
let dragAction = "";

function startDragBlock(e, time) {
  isDraggingBlock = true;
  const { branch, date } = adminBlockState;
  const allBlocks = getBlocks();
  const isBlocked = allBlocks.some(b => b.branch === branch && b.date === date && b.start === time);
  dragAction = isBlocked ? "remove" : "add";
  applyDragBlock(time);
}
function enterDragBlock(e, time) {
  if (isDraggingBlock) applyDragBlock(time);
}
function applyDragBlock(time) {
  const { branch, date } = adminBlockState;
  let allBlocks = getBlocks();
  const targetIndex = allBlocks.findIndex(b => b.branch === branch && b.date === date && b.start === time);
  let changed = false;
  if (dragAction === "add" && targetIndex < 0) {
    allBlocks.push({ branch, date, start: time, duration: 30 });
    changed = true;
  } else if (dragAction === "remove" && targetIndex >= 0) {
    allBlocks.splice(targetIndex, 1);
    changed = true;
  }
  if (changed) {
    setBlocks(allBlocks);
    const btn = document.querySelector(`.time-block-btn[data-time="${time}"]`);
    if (btn) {
      if (dragAction === "add") btn.classList.add("blocked");
      else btn.classList.remove("blocked");
    }
  }
}

document.addEventListener("mouseup", () => {
  if (isDraggingBlock) {
    isDraggingBlock = false;
    renderAdmin();
    renderBooking();
  }
});
document.addEventListener("touchmove", (e) => {
  if (!isDraggingBlock) return;
  const touch = e.touches[0];
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  if (el && el.classList.contains("time-block-btn")) {
    const time = el.getAttribute("data-time");
    if (time) applyDragBlock(time);
  }
}, { passive: false });
document.addEventListener("touchend", () => {
  if (isDraggingBlock) {
    isDraggingBlock = false;
    renderAdmin();
    renderBooking();
  }
});
function renderSettings(el){
  const s=getSettings();
  const currentBranch = window._settingsBranch || "すべて";
  const branchList = ["すべて", ...BRANCHES];

  const assigneesHtml = BRANCHES.map(b => {
    const list = s.assignees[b] || [];
    const rows = list.map(a => `
      <div class="assignee-row" style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
        <input type="text" class="a-name" value="${esc(a.name)}" placeholder="名前（例：山田太郎）" style="flex:1;padding:8px;font-size:13px">
        <input type="text" class="a-email" value="${esc(a.email)}" placeholder="メールアドレス" style="flex:2;padding:8px;font-size:13px">
        <button type="button" class="btn danger" style="padding:8px 12px;font-size:12px;border-radius:6px" onclick="this.parentElement.remove()">削除</button>
      </div>
    `).join("");
    const display = (currentBranch === "すべて" || currentBranch === b) ? "block" : "none";
    return `
      <div id="assignees_container_${b}" class="assignees-container" style="display:${display}; margin-bottom: 16px;">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--brand)">${b}</div>
        <div class="assignee-list">${rows}</div>
        <button type="button" class="btn secondary" style="padding:8px 12px;font-size:12px;border-radius:6px;margin-top:4px" onclick="addAssigneeRow('${b}')">+ ${b}の担当者を追加</button>
      </div>
    `;
  }).join("");

  const emailsHtml = branchList.map(b => {
    if (b === "すべて") {
      return `
      <div id="email_container_${b}" class="emails-container" style="display:${b===currentBranch?'block':'none'}">
        <input type="text" id="email_${b}" value="${esc(s.branchEmails[b]||"")}" placeholder="全支店の予約通知を受け取る管理者用メールアドレス（複数ある場合はカンマ区切り）" style="padding:10px;width:100%">
      </div>
      `;
    }
    return `
      <div id="email_container_${b}" class="emails-container" style="display:${b===currentBranch?'block':'none'}">
        <input type="text" id="email_${b}" value="${esc(s.branchEmails[b]||"")}" placeholder="${b}の通知先メールアドレス（複数ある場合はカンマ区切り）" style="padding:10px;width:100%">
      </div>
    `;
  }).join("");

  const phonesHtml = branchList.map(b => {
    if (b === "すべて") {
      return `
      <div id="phone_container_${b}" class="phones-container" style="display:${b===currentBranch?'block':'none'}">
        <input type="text" id="phone_${b}" value="${esc(s.branchPhones[b]||"")}" placeholder="全支店の共通電話番号（設定する場合のみ）" style="padding:10px;width:100%">
      </div>
      `;
    }
    return `
      <div id="phone_container_${b}" class="phones-container" style="display:${b===currentBranch?'block':'none'}">
        <input type="text" id="phone_${b}" value="${esc(s.branchPhones[b]||"")}" placeholder="${b}の電話番号" style="padding:10px;width:100%">
      </div>
    `;
  }).join("");

  el.innerHTML=`
    <h2 class="section-title">基本設定</h2>
    <p class="section-lead">相続相談専用の予約受付条件や担当者を設定します。</p>
    <div class="notice" style="margin-bottom:18px">ご予約は、ご希望日の1営業日前の15時まで可能です。</div>
    <div class="grid">
      <label>予約可能期間
        <select id="daysAhead">
          ${[30,60,90,120].map(x=>`<option value="${x}" ${Number(s.daysAhead)===x?"selected":""}>${x}日先まで</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="grid" style="margin-top:18px;background:#f9fafb;padding:20px;border-radius:12px;border:1px solid var(--line)">
      <label style="margin-bottom:0;font-size:15px;color:var(--brand)">対象支店</label>
      <select id="settingsBranchSelect" onchange="changeSettingsBranch(this.value)" style="width:100%;max-width:300px;padding:10px;margin-bottom:4px;border-color:var(--brand);box-shadow:0 2px 8px rgba(0,168,89,.1)">
        ${branchList.map(b => `<option value="${b}" ${b===currentBranch?"selected":""}>${b==="すべて"?"すべて（共通）":b}</option>`).join("")}
      </select>

      <div style="border-top:1px solid var(--line);margin:12px 0"></div>

      <label style="margin-bottom:0">担当者リスト
        <span class="muted" style="font-size:12px;font-weight:normal;display:block;margin-top:4px">※対象支店で「すべて（共通）」を選択すると、各支店で登録された担当者がすべて表示されます。予約一覧では各支店の担当者がプルダウンで選択できるようになります。</span>
      </label>
      <div style="margin-bottom:8px">
        ${assigneesHtml}
      </div>

      <label style="margin-bottom:0">通知先メールアドレス
        <span class="muted" style="font-size:12px;font-weight:normal;display:block;margin-top:4px">※予約が入った際に通知を送るメールアドレスを設定します（複数ある場合はカンマ区切り）。</span>
      </label>
      <div style="margin-bottom:12px">
        ${emailsHtml}
      </div>

      <label style="margin-bottom:0">支店の電話番号
        <span class="muted" style="font-size:12px;font-weight:normal;display:block;margin-top:4px">※WEB予約締切後などに、お客様へ案内する電話番号を設定します。</span>
      </label>
      <div>
        ${phonesHtml}
      </div>
    </div>
    <div class="notice" style="margin-top:18px">土曜日・日曜日・登録済みの祝日は常に予約不可です。</div>
    <div class="actions" style="justify-content:flex-end"><button class="btn primary" onclick="saveAdminSettings()">設定を保存</button></div>`;
}
function addAssigneeRow(branch) {
  const container = document.querySelector(`#assignees_container_${branch} .assignee-list`);
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'assignee-row';
  div.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
  div.innerHTML = `
    <input type="text" class="a-name" value="" placeholder="名前（例：山田太郎）" style="flex:1;padding:8px;font-size:13px">
    <input type="text" class="a-email" value="" placeholder="メールアドレス" style="flex:2;padding:8px;font-size:13px">
    <button type="button" class="btn danger" style="padding:8px 12px;font-size:12px;border-radius:6px" onclick="this.parentElement.remove()">削除</button>
  `;
  container.appendChild(div);
}
function changeSettingsBranch(branch) {
  window._settingsBranch = branch;
  
  if (branch === "すべて") {
    document.querySelectorAll('.assignees-container').forEach(el => el.style.display = 'block');
  } else {
    document.querySelectorAll('.assignees-container').forEach(el => el.style.display = 'none');
    const targetA = document.getElementById('assignees_container_' + branch);
    if(targetA) targetA.style.display = 'block';
  }

  document.querySelectorAll('.emails-container').forEach(el => el.style.display = 'none');
  const targetE = document.getElementById('email_container_' + branch);
  if(targetE) targetE.style.display = 'block';

  document.querySelectorAll('.phones-container').forEach(el => el.style.display = 'none');
  const targetP = document.getElementById('phone_container_' + branch);
  if(targetP) targetP.style.display = 'block';
}
function saveAdminSettings(){
  const assigneesObj = {};
  const branchEmails = {};
  const branchPhones = {};
  BRANCHES.forEach(b => {
    const container = document.getElementById("assignees_container_" + b);
    if(container) {
      const rows = container.querySelectorAll(".assignee-row");
      const list = [];
      rows.forEach(row => {
        const name = row.querySelector(".a-name").value.trim();
        const email = row.querySelector(".a-email").value.trim();
        if (name) {
          list.push({ name, email });
        }
      });
      assigneesObj[b] = list;
    }
  });

  ["すべて", ...BRANCHES].forEach(b => {
    const el = document.getElementById("email_" + b);
    if(el) branchEmails[b] = el.value.trim();
    const pl = document.getElementById("phone_" + b);
    if(pl) branchPhones[b] = pl.value.trim();
  });
  setSettings({
    daysAhead:Number(document.getElementById("daysAhead").value),
    assignees: assigneesObj,
    branchEmails: branchEmails,
    branchPhones: branchPhones
  });
  alert("設定を保存しました。");renderAdmin();renderBooking();
}

document.getElementById("userModeBtn").onclick=()=>{
  document.getElementById("userApp").style.display="block";
  document.getElementById("adminApp").style.display="none";
  document.getElementById("userModeBtn").classList.add("active");
  document.getElementById("adminModeBtn").classList.remove("active");
  
  const calendarLargeControls = document.getElementById('calendarLargeControls');
  const mainModeSwitch = document.getElementById('mainModeSwitch');
  if (calendarLargeControls) calendarLargeControls.style.display = "none";
  if (mainModeSwitch) mainModeSwitch.style.display = "flex";
};
document.getElementById("adminModeBtn").onclick=()=>{
  document.getElementById("userApp").style.display="none";
  document.getElementById("adminApp").style.display="block";
  document.getElementById("adminModeBtn").classList.add("active");
  document.getElementById("userModeBtn").classList.remove("active");
  renderAdmin();
};

renderBooking();