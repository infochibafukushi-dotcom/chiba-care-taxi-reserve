const ADMIN_ICON_FILE_ID = '1a0QB8ei00w_lSfL4PnF_xuEFUC2JP6FW';
const GAS_URL = "https://script.google.com/macros/s/AKfycbzg7goq3dRL1RoHURKpXZakB8cAt76hvTwWqPDThbaAc4Hc8kl2lThZ2nFMbiv9yjJKpA/exec";
const ADMIN_PAGE_URL = "admin.html";

function toast(msg='通信エラー', ms=2200){
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=> el.style.display='none', ms);
}

let __loadingTimer = null;
function showLoading(show, text='読み込み中...'){
  const ov = document.getElementById('loadingOverlay');
  const tx = document.getElementById('loadingText');
  if (!ov || !tx) return;

  if (show){
    tx.textContent = text;
    clearTimeout(__loadingTimer);
    __loadingTimer = setTimeout(()=>{ ov.style.display = 'flex'; }, 180);
  } else {
    clearTimeout(__loadingTimer);
    ov.style.display = 'none';
  }
}

async function withLoading(fn, text){
  showLoading(true, text);
  try{
    return await fn();
  }finally{
    showLoading(false);
  }
}

function _jsonpCall(url){
  return new Promise((resolve, reject)=>{
    const cbName = '__jsonp_cb_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
    const script = document.createElement('script');
    let done = false;

    function cleanup(){
      try{
        delete window[cbName];
      }catch(_){}
      if (script && script.parentNode) script.parentNode.removeChild(script);
    }

    const timer = setTimeout(()=>{
      if (done) return;
      done = true;
      cleanup();
      reject(new Error('JSONP timeout'));
    }, 12000);

    window[cbName] = function(data){
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    script.onerror = function(){
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup();
      reject(new Error('JSONP load error'));
    };

    const sep = url.includes('?') ? '&' : '?';
    script.src = url + sep + 'callback=' + encodeURIComponent(cbName);
    document.body.appendChild(script);
  });
}

async function _postJson(action, payload){
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action: action,
      payload: payload || {}
    })
  });

  const text = await res.text();
  let data = null;

  try{
    data = JSON.parse(text);
  }catch(_){
    throw new Error('POST応答の解析に失敗しました');
  }

  return data;
}

const gsRun = async (func, ...args) => {
  try{
    let data;

    if (func === 'api_getConfig') {
      data = await _jsonpCall(`${GAS_URL}?action=getConfig`);
    } else if (func === 'api_getConfigPublic') {
      data = await _jsonpCall(`${GAS_URL}?action=getConfigPublic`);
    } else if (func === 'api_getInitData') {
      data = await _jsonpCall(`${GAS_URL}?action=getInitData`);
    } else if (func === 'api_getMenuMaster') {
      data = await _jsonpCall(`${GAS_URL}?action=getMenuMaster`);
    } else if (func === 'api_getMenuKeyCatalog') {
      data = await _jsonpCall(`${GAS_URL}?action=getMenuKeyCatalog`);
    } else if (func === 'api_getMenuGroupCatalog') {
      data = await _jsonpCall(`${GAS_URL}?action=getMenuGroupCatalog`);
    } else if (func === 'api_getAutoRuleCatalog') {
      data = await _jsonpCall(`${GAS_URL}?action=getAutoRuleCatalog`);
    } else if (func === 'api_getDriveImageDataUrl') {
      const fileId = args[0];
      data = await _jsonpCall(`${GAS_URL}?action=getDriveImageDataUrl&fileId=${encodeURIComponent(fileId)}`);
    } else if (func === 'api_createReservation') {
      data = await _postJson('createReservation', args[0]);
    } else if (func === 'api_verifyAdminPassword') {
      data = await _postJson('verifyAdminPassword', args[0]);
    } else {
      throw new Error(`未対応のAPIです: ${func}`);
    }

    if (data && data.isOk === false) {
      const msg = data.error || data.message || '通信エラー（isOk=false）';
      toast(msg);
      throw new Error(msg);
    }

    return data;
  }catch(e){
    const msg = e?.message || '通信エラー';
    toast(msg);
    throw e;
  }
};

const TRIGGER_URL = 'https://script.google.com/macros/s/AKfycbxzM8EPlE-1hwHx6qwh4Q1jXgYa0nyc3_WtK0NYbYbcm5JExMJOi1zzjQocUhsoCuUQ/exec?secret=secret1';

function fireTrigger(){
  try{
    if (!TRIGGER_URL) return;
    const sep = TRIGGER_URL.includes('?') ? '&' : '?';
    const url = TRIGGER_URL + sep + 't=' + Date.now();
    const img = new Image();
    img.src = url;
  }catch(_){}
}

function ymdLocal(date){
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function normalizeDateToYMD(v){
  if (!v && v !== 0) return '';
  if (v instanceof Date) return ymdLocal(v);

  const s = String(v).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);

  const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (m){
    const yy = m[1];
    const mm = String(Number(m[2])).padStart(2,'0');
    const dd = String(Number(m[3])).padStart(2,'0');
    return `${yy}-${mm}-${dd}`;
  }

  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return ymdLocal(dt);
  return s;
}

let reservations = [];
let blockedSlots = new Set();
let reservedSlots = new Set();
let selectedSlot = null;
let config = {};
let isExtendedView = false;
let menuMaster = [];
let menuKeyCatalog = [];
let menuGroupCatalog = [];
let autoRuleCatalog = [];
let calendarDates = [];

const defaultConfig = {
  main_title: '介護タクシー予約',
  logo_text: '介護タクシー予約',
  logo_subtext: '丁寧・安全な送迎をご提供します',
  logo_image_url: '',
  logo_drive_file_id: '',
  logo_use_drive_image: '0',
  logo_use_github_image: '1',
  logo_github_path: '',
  phone_notify_text: '090-6331-4289',
  same_day_enabled: '0',
  same_day_min_hours: '3',
  admin_tap_count: '5',
  max_forward_days: '30',
  extended_enabled: '1',
  form_modal_title: 'ご予約',
  form_privacy_text: 'ご入力いただいた個人情報は、ご予約の受付およびサービス提供に用いたします。同意の上チェックをお願いいたします。',
  form_basic_section_title: '基本情報',
  form_basic_section_badge: '必須項目',
  form_usage_type_label: 'ご利用区分',
  form_usage_type_placeholder: '選択してください',
  form_usage_type_option_first: '初めて',
  form_usage_type_option_repeat: '2回目以上',
  form_customer_name_label: 'お名前(カタカナ)',
  form_customer_name_placeholder: 'ヤマダ タロウ',
  form_phone_label: '連絡先(電話番号)',
  form_phone_placeholder: '090-1234-5678',
  form_pickup_label: 'お伺い場所または施設名',
  form_pickup_placeholder: '東京都渋谷区...',
  form_optional_section_title: '追加情報',
  form_optional_section_badge: '任意項目',
  form_destination_label: '送迎先住所または施設名',
  form_destination_placeholder: '病院、クリニック など',
  form_notes_label: 'ご要望・備考',
  form_notes_placeholder: 'その他ご要望があればご記入ください',
  form_service_section_title: 'サービス選択',
  form_service_section_badge: '必須項目',
  form_assistance_label: '介助内容',
  form_stair_label: '階段介助',
  form_equipment_label: '機材レンタル',
  form_round_trip_label: '往復送迎',
  form_price_section_title: '料金概算',
  form_price_total_label: '概算合計',
  form_price_notice_text: '上記料金に加え、距離運賃(2km以上200mごと/90円)が加算されます。また、時速10km以下の移行時は時間制運賃(1分30秒毎/90円)に切り替わります。',
  form_submit_button_text: '予約する',
  complete_title: 'ご予約ありがとう',
  complete_title_sub: 'ございます',
  complete_reservation_id_label: '予約ID',
  complete_phone_guide_prefix: '内容確認のため、以下の番号',
  complete_phone_guide_middle: 'よりお電話をさせていただきます。',
  complete_phone_guide_after: '確認が取れたら、正式な予約完了と致します。',
  complete_phone_guide_warning: 'お電話がつながらない場合、申し訳ございませんが自動キャンセルとさせていただく場合がございます。',
  complete_phone_guide_footer: 'あらかじめご了承ください。',
  complete_close_button_text: '閉じる',
  calendar_toggle_extended_text: '他時間予約',
  calendar_toggle_regular_text: '通常時間',
  calendar_legend_available: '◎ 予約可能',
  calendar_legend_unavailable: 'X 予約不可',
  calendar_scroll_guide_text: '上下・左右にスクロールして、他の日付や時間を確認できます。',
  warning_stair_bodyassist_text: '警告: 階段介助ご利用の場合、身体介助がセットになります',
  warning_wheelchair_damage_text: '警告: 車いす固定による傷、すり傷などは保証対象外になります',
  warning_stretcher_bodyassist_text: '警告: ストレッチャー利用時に2名体制介助料5,000円と身体介助が必須となります',
  rule_force_body_assist_on_stair: '1',
  rule_force_body_assist_on_stretcher: '1',
  rule_force_stretcher_staff2_on_stretcher: '1'
};

const defaultMenuGroupCatalog = [
  { key: 'price', label: '料金概算（基本料金）' },
  { key: 'assistance', label: '介助内容' },
  { key: 'stair', label: '階段介助' },
  { key: 'equipment', label: '機材レンタル' },
  { key: 'round_trip', label: '往復送迎' },
  { key: 'custom', label: 'その他（表示先なし）' }
];

function getMenuMap(){
  const map = {};
  (menuMaster || []).forEach(item => {
    map[item.key] = item;
  });
  return map;
}

function findCatalogByKey(key){
  return (menuKeyCatalog || []).find(item => String(item.key || '') === String(key || '')) || null;
}

function getMenuPrice(key, fallback){
  const map = getMenuMap();
  if (map[key] && map[key].price !== undefined && map[key].price !== null && map[key].price !== '') {
    return Number(map[key].price || 0);
  }
  return Number(fallback || 0);
}

function getMenuLabel(key, fallback){
  const map = getMenuMap();
  if (map[key] && map[key].label) return String(map[key].label);
  const catalog = findCatalogByKey(key);
  if (catalog && catalog.default_label) return String(catalog.default_label);
  return fallback;
}

function getMenuNote(key, fallback){
  const map = getMenuMap();
  if (map[key] && map[key].note) return String(map[key].note);
  return fallback || '';
}

function getItemsByGroup(group){
  return (menuMaster || []).filter(item => {
    if (String(item.menu_group || '') !== String(group || '')) return false;
    if (item.is_visible === false || String(item.is_visible).toUpperCase() === 'FALSE') return false;
    return true;
  }).sort((a,b) => {
    const aOrder = Number(a.sort_order || 9999);
    const bOrder = Number(b.sort_order || 9999);
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a.key).localeCompare(String(b.key));
  });
}

function getRuleByIndex(index){
  return (autoRuleCatalog || []).find(rule => Number(rule.index) === Number(index)) || null;
}

function getRuleEnabled(index){
  const rule = getRuleByIndex(index);
  return !!(rule && rule.enabled);
}

function formatDate(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['日','月','火','水','木','金','土'];
  return `${month}/${day}(${weekdays[date.getDay()]})`;
}

function formatDateForId(date, hour, minute) {
  const year = date.getFullYear();
  const month = String(date.getMonth()+1).padStart(2,'0');
  const day = String(date.getDate()).padStart(2,'0');
  const hourStr = String(hour).padStart(2,'0');
  const minuteStr = String(minute).padStart(2,'0');
  return `${year}${month}${day}${hourStr}${minuteStr}`;
}

function toLocalDateTime(dateStr, hour, minute){
  const [y,m,d] = String(dateStr).split('-').map(Number);
  return new Date(y, m-1, d, Number(hour), Number(minute||0), 0, 0);
}

function rebuildBlockedSlotsFromSheet(blocks){
  blockedSlots = new Set();
  (blocks || []).forEach(b => {
    if (b.is_blocked === false || String(b.is_blocked).toUpperCase() === 'FALSE') return;

    const rawDate = b.block_date || b.date || b.slot_date;
    let date = normalizeDateToYMD(rawDate);

    let hour = Number(b.block_hour ?? b.hour ?? b.slot_hour);
    let minute = Number(b.block_minute ?? b.minute ?? b.slot_minute ?? 0);

    if ((!date || Number.isNaN(hour) || Number.isNaN(minute))){
      const k = String(b.slot_key || b.key || b.block_key || '').trim();
      const mm = k.match(/^(\d{4}-\d{2}-\d{2})-(\d{1,2})-(\d{1,2})$/);
      if (mm){
        date = date || mm[1];
        if (Number.isNaN(hour)) hour = Number(mm[2]);
        if (Number.isNaN(minute)) minute = Number(mm[3]);
      }
    }

    if (!date) return;
    if (Number.isNaN(hour)) return;
    if (Number.isNaN(minute)) minute = 0;

    blockedSlots.add(`${date}-${hour}-${minute}`);
  });
}

function reservationBlockSlots(r){
  const rt = String(r?.round_trip || '').trim();
  if (rt === '待機' || rt === '病院付き添い') return 4;
  return 2;
}

function rebuildReservedSlotsFromReservations(list){
  reservedSlots = new Set();
  (list || []).forEach(r=>{
    if (r.is_visible === false || r.is_visible === 'FALSE') return;
    if (r.status === 'キャンセル') return;

    const d = normalizeDateToYMD(r.slot_date);
    const h = Number(r.slot_hour);
    const m = Number(r.slot_minute || 0);
    if (!d || Number.isNaN(h) || Number.isNaN(m)) return;

    const start = toLocalDateTime(d, h, m);
    const slots = reservationBlockSlots(r);
    for (let i=0;i<slots;i++){
      const dt = new Date(start.getTime() + i * 30 * 60 * 1000);
      reservedSlots.add(`${ymdLocal(dt)}-${dt.getHours()}-${dt.getMinutes()}`);
    }
  });
}

function isSlotBlockedWithMinute(dateObj, hour, minute) {
  const key = `${ymdLocal(dateObj)}-${hour}-${minute}`;
  if (blockedSlots.has(key) || reservedSlots.has(key)) return true;

  const dateStr = ymdLocal(dateObj);
  if (String(config.same_day_enabled || '0') === '1') {
    const todayStr = ymdLocal(new Date());
    if (dateStr === todayStr) {
      const minHours = Number(config.same_day_min_hours || 3);
      const threshold = new Date(Date.now() + minHours * 60 * 60 * 1000);
      const rounded = ceilToNext30Min(threshold);
      const slotDt = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), Number(hour), Number(minute || 0), 0, 0);
      if (slotDt.getTime() < rounded.getTime()) return true;
    }
  }

  return false;
}

function ceilToNext30Min(dt){
  const d = new Date(dt.getTime());
  d.setSeconds(0,0);
  const minute = d.getMinutes();
  if (minute === 0 || minute === 30) return d;
  if (minute < 30) {
    d.setMinutes(30, 0, 0);
    return d;
  }
  d.setHours(d.getHours() + 1);
  d.setMinutes(0, 0, 0);
  return d;
}

function applyCalendarGridColumns(gridEl, daysCount){
  const isMobile = window.matchMedia('(max-width: 640px)').matches;
  const timeCol = isMobile ? 44 : 60;
  const sc = gridEl?.closest?.('.scroll-container') || gridEl?.parentElement;
  const baseW = (sc && sc.clientWidth) ? sc.clientWidth : window.innerWidth;

  if (!isMobile){
    const dayW = Math.max(110, Math.floor((baseW - timeCol) / 7));
    gridEl.style.gridTemplateColumns = `${timeCol}px repeat(${daysCount}, ${dayW}px)`;
  } else {
    gridEl.style.gridTemplateColumns = `${timeCol}px repeat(${daysCount}, minmax(62px, 1fr))`;
  }
}

function getDatesRange(){
  const today = new Date();
  today.setHours(0,0,0,0);

  const maxForwardDays = Number(config.max_forward_days || 30);
  const startOffset = String(config.same_day_enabled || '0') === '1' ? 0 : 1;
  const dates = [];

  for (let i=0;i<maxForwardDays;i++){
    const dt = new Date(today);
    dt.setDate(today.getDate() + startOffset + i);
    dates.push(dt);
  }
  return dates;
}

function buildSlots(){
  const regularSlots = [];
  for (let h=6; h<=21; h++){
    regularSlots.push({hour:h, minute:0, display:`${String(h).padStart(2,'0')}:00`});
    if (h < 21) regularSlots.push({hour:h, minute:30, display:`${String(h).padStart(2,'0')}:30`});
  }

  const extendedSlots = [];
  extendedSlots.push({hour:21, minute:30, display:`21:30`});
  for (let h=22; h<24; h++){
    extendedSlots.push({hour:h, minute:0, display:`${String(h).padStart(2,'0')}:00`});
    extendedSlots.push({hour:h, minute:30, display:`${String(h).padStart(2,'0')}:30`});
  }
  for (let h=0; h<=5; h++){
    extendedSlots.push({hour:h, minute:0, display:`${String(h).padStart(2,'0')}:00`});
    extendedSlots.push({hour:h, minute:30, display:`${String(h).padStart(2,'0')}:30`});
  }
  return { regularSlots, extendedSlots };
}

function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const dateRangeEl = document.getElementById('dateRange');
  if (!grid || !dateRangeEl) return;

  const dates = getDatesRange();
  calendarDates = dates;

  if (dates.length === 0) {
    dateRangeEl.textContent = '';
    grid.innerHTML = '';
    return;
  }

  dateRangeEl.textContent = `${formatDate(dates[0])} ～ ${formatDate(dates[dates.length-1])}`;

  const { regularSlots, extendedSlots } = buildSlots();

  let html = '';
  html += '<div class="time-label sticky-corner">時間</div>';

  dates.forEach((date, idx)=>{
    const isWeekend = (date.getDay() === 0 || date.getDay() === 6);
    html += `<div class="date-header sticky-top ${isWeekend ? 'weekend' : ''}" data-date-idx="${idx}">${formatDate(date)}</div>`;
  });

  for (const slot of regularSlots){
    html += `<div class="time-label sticky-left">${slot.display}</div>`;
    for (let idx=0; idx<dates.length; idx++){
      const date = dates[idx];
      const blocked = isSlotBlockedWithMinute(date, slot.hour, slot.minute);
      const slotClass = blocked ? 'slot-unavailable' : 'slot-available';

      html += `<div class="${slotClass} p-3 text-center text-lg font-bold rounded-lg cursor-pointer transition"
                data-action="slot"
                data-date-idx="${idx}"
                data-hour="${slot.hour}"
                data-minute="${slot.minute}">
                ${blocked ? 'X' : '◎'}
              </div>`;
    }
  }

  const shouldShowExtended = isExtendedView;
  if (shouldShowExtended){
    html += '<div class="time-label sticky-left" style="font-weight:bold;background:linear-gradient(135deg,#cffafe 0%,#a5f3fc 100%);color:#0e7490;border:2px solid #06b6d4;">他時間</div>';

    dates.forEach((date, idx)=>{
      const isWeekend = (date.getDay() === 0 || date.getDay() === 6);
      html += `<div class="date-header ${isWeekend ? 'weekend' : ''}"
                style="background:linear-gradient(135deg,#cffafe 0%,#a5f3fc 100%);border-color:#06b6d4;color:#0e7490;"
                data-date-idx="${idx}">${formatDate(date)}</div>`;
    });

    for (const slot of extendedSlots){
      html += `<div class="time-label sticky-left" style="background:linear-gradient(135deg,#cffafe 0%,#a5f3fc 100%);border:2px solid #06b6d4;color:#0e7490;font-weight:600;">${slot.display}</div>`;
      for (let idx=0; idx<dates.length; idx++){
        const date = dates[idx];
        const blocked = isSlotBlockedWithMinute(date, slot.hour, slot.minute);
        const slotClass = blocked ? 'slot-unavailable' : 'slot-alternate';

        html += `<div class="${slotClass} p-3 text-center text-lg font-bold rounded-lg cursor-pointer transition"
                  data-action="slot"
                  data-date-idx="${idx}"
                  data-hour="${slot.hour}"
                  data-minute="${slot.minute}">
                  ${blocked ? 'X' : '◎'}
                </div>`;
      }
    }
  }

  grid.innerHTML = html;

  applyCalendarGridColumns(grid, dates.length);
  requestAnimationFrame(()=> applyCalendarGridColumns(grid, dates.length));
}

function bindGridDelegation(){
  const grid = document.getElementById('calendarGrid');
  if (!grid) return;

  grid.addEventListener('click', async (ev)=>{
    const el = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
    if (!el) return;

    const action = el.dataset.action;

    if (action === 'slot'){
      const dateIdx = Number(el.dataset.dateIdx);
      const hour = Number(el.dataset.hour);
      const minute = Number(el.dataset.minute || 0);

      const date = calendarDates[dateIdx];
      if (!date) return;

      const blocked = isSlotBlockedWithMinute(date, hour, minute);
      if (blocked) return;

      openBookingForm(date, hour, minute);
    }
  }, { passive: false });
}

function buildSelectOptions(selectEl, items, includePlaceholder, placeholderText, formatter){
  if (!selectEl) return;
  let html = '';
  if (includePlaceholder) {
    html += `<option value="">${placeholderText}</option>`;
  }
  items.forEach(item => {
    const label = typeof formatter === 'function' ? formatter(item) : item.label;
    html += `<option value="${escapeHtml(String(item.label))}">${escapeHtml(String(label))}</option>`;
  });
  selectEl.innerHTML = html;
}

function renderServiceSelectors(){
  const assistanceItems = getItemsByGroup('assistance');
  const stairItems = getItemsByGroup('stair');
  const equipmentItems = getItemsByGroup('equipment');
  const roundTripItems = getItemsByGroup('round_trip');

  buildSelectOptions(
    document.getElementById('assistanceType'),
    assistanceItems,
    true,
    config.form_usage_type_placeholder || '選択してください',
    function(item){ return `${item.label}(${Number(item.price || 0).toLocaleString()}円)`; }
  );

  buildSelectOptions(
    document.getElementById('stairAssistance'),
    stairItems,
    false,
    '',
    function(item){ return `${item.label}(${Number(item.price || 0).toLocaleString()}円)`; }
  );

  buildSelectOptions(
    document.getElementById('equipmentRental'),
    equipmentItems,
    true,
    config.form_usage_type_placeholder || '選択してください',
    function(item){ return `${item.label}(${Number(item.price || 0).toLocaleString()}円)`; }
  );

  buildSelectOptions(
    document.getElementById('roundTrip'),
    roundTripItems,
    false,
    '',
    function(item){
      const note = item.note ? item.note : '';
      if (note && note.includes('30分毎')) {
        return `${item.label}(${Number(item.price || 0).toLocaleString()}円から/30分毎)`;
      }
      return `${item.label}(${Number(item.price || 0).toLocaleString()}円)`;
    }
  );

  const assistanceNote = [
    `<strong>${escapeHtml(getMenuLabel('BOARDING_ASSIST', '乗降介助'))}:</strong>${escapeHtml(getMenuNote('BOARDING_ASSIST', '玄関から車両への車いす等固定まで'))}`,
    `<strong>${escapeHtml(getMenuLabel('BODY_ASSIST', '身体介助'))}:</strong>${escapeHtml(getMenuNote('BODY_ASSIST', 'お部屋から車両への車いす等固定まで'))}`
  ].join('<br>');
  document.getElementById('assistanceNote').innerHTML = assistanceNote;

  const stairNote = [
    `<strong>${escapeHtml(getMenuLabel('STAIR_WATCH', '見守り介助'))}:</strong>${escapeHtml(getMenuNote('STAIR_WATCH', '自力歩行可能で手を握る介助'))}`,
    `<strong>階段移動:</strong>背負い移動または2名による介助`
  ].join('<br>');
  document.getElementById('stairNote').innerHTML = stairNote;

  document.getElementById('equipmentNote').innerHTML = '';

  const roundTripNote = [
    `<strong>${escapeHtml(getMenuLabel('ROUND_STANDBY', '待機'))}:</strong>病院駐車場等で待機`,
    `<strong>${escapeHtml(getMenuLabel('ROUND_HOSPITAL', '病院付き添い'))}:</strong>病院内での移動や会計などをサポート`
  ].join('<br>');
  document.getElementById('roundTripNote').innerHTML = roundTripNote;
}

function openBookingForm(date, hour, minute=0){
  selectedSlot = { date, hour, minute };
  document.getElementById('selectedSlotInfo').textContent =
    `${formatDate(date)} ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} から`;
  document.getElementById('bookingModal').classList.remove('hidden');
  resetBookingForm();
  calculatePrice();
}

function resetBookingForm(){
  document.getElementById('bookingForm').reset();
  document.getElementById('stairWarning').classList.add('hidden');
  document.getElementById('wheelchairWarning').classList.add('hidden');
  document.getElementById('stretcherWarning').classList.add('hidden');
  updateSubmitButton();

  const stairDefault = getItemsByGroup('stair')[0];
  const roundDefault = getItemsByGroup('round_trip')[0];
  if (stairDefault) document.getElementById('stairAssistance').value = stairDefault.label;
  if (roundDefault) document.getElementById('roundTrip').value = roundDefault.label;
}

function calculatePrice(){
  let total = 0;
  const breakdown = [];

  const assistanceType = document.getElementById('assistanceType').value;
  const stairAssistance = document.getElementById('stairAssistance').value;
  const equipmentRental = document.getElementById('equipmentRental').value;
  const roundTrip = document.getElementById('roundTrip').value;

  const stairWarning = document.getElementById('stairWarning');
  const stretcherWarning = document.getElementById('stretcherWarning');
  const wheelchairWarning = document.getElementById('wheelchairWarning');
  const assistanceSelect = document.getElementById('assistanceType');

  let mustUseBodyAssist = false;
  let mustUseStretcherStaff2 = false;

  stairWarning.classList.add('hidden');
  stretcherWarning.classList.add('hidden');
  wheelchairWarning.classList.add('hidden');

  const baseFare = getMenuPrice('BASE_FARE', 730);
  const dispatch = getMenuPrice('DISPATCH', 800);
  const specialVehicle = getMenuPrice('SPECIAL_VEHICLE', 1000);
  const boardingAssistPrice = getMenuPrice('BOARDING_ASSIST', 1400);
  const bodyAssistPrice = getMenuPrice('BODY_ASSIST', 3000);
  const stair2Price = getMenuPrice('STAIR_2F', 6000);
  const stair3Price = getMenuPrice('STAIR_3F', 9000);
  const stair4Price = getMenuPrice('STAIR_4F', 12000);
  const stair5Price = getMenuPrice('STAIR_5F', 15000);
  const recliningPrice = getMenuPrice('EQUIP_RECLINING', 2500);
  const stretcherPrice = getMenuPrice('EQUIP_STRETCHER', 5000);
  const stretcherStaffPrice = getMenuPrice('EQUIP_STRETCHER_STAFF2', 5000);
  const standbyPrice = getMenuPrice('ROUND_STANDBY', 800);
  const hospitalEscortPrice = getMenuPrice('ROUND_HOSPITAL', 1600);

  total += baseFare + dispatch + specialVehicle;
  breakdown.push({ name:getMenuLabel('BASE_FARE', '運賃'), price:baseFare, suffix:' から' });
  breakdown.push({ name:getMenuLabel('DISPATCH', '配車予約'), price:dispatch });
  breakdown.push({ name:getMenuLabel('SPECIAL_VEHICLE', '特殊車両使用料'), price:specialVehicle });

  const stairNeedBody = (
    stairAssistance &&
    stairAssistance !== getMenuLabel('STAIR_NONE', '不要') &&
    stairAssistance !== getMenuLabel('STAIR_WATCH', '見守り介助')
  );

  if (stairNeedBody) {
    if (String(config.rule_force_body_assist_on_stair || '1') === '1' || getRuleEnabled(1) || getRuleEnabled(2) || getRuleEnabled(3) || getRuleEnabled(4)) {
      stairWarning.textContent = config.warning_stair_bodyassist_text || defaultConfig.warning_stair_bodyassist_text;
      stairWarning.classList.remove('hidden');
      mustUseBodyAssist = true;
    }
  }

  if (equipmentRental === getMenuLabel('EQUIP_STRETCHER', 'ストレッチャーレンタル')){
    stretcherWarning.textContent = config.warning_stretcher_bodyassist_text || defaultConfig.warning_stretcher_bodyassist_text;
    stretcherWarning.classList.remove('hidden');

    if (String(config.rule_force_body_assist_on_stretcher || '1') === '1' || getRuleEnabled(5)) {
      mustUseBodyAssist = true;
    }
    if (String(config.rule_force_stretcher_staff2_on_stretcher || '1') === '1' || getRuleEnabled(6)) {
      mustUseStretcherStaff2 = true;
    }
  }

  if (equipmentRental === getMenuLabel('EQUIP_OWN_WHEELCHAIR', 'ご自身車いす')){
    wheelchairWarning.textContent = config.warning_wheelchair_damage_text || defaultConfig.warning_wheelchair_damage_text;
    wheelchairWarning.classList.remove('hidden');
  }

  if (mustUseBodyAssist){
    assistanceSelect.value = getMenuLabel('BODY_ASSIST', '身体介助');
    total += bodyAssistPrice;
    breakdown.push({ name:getMenuLabel('BODY_ASSIST', '身体介助'), price:bodyAssistPrice });
  } else {
    if (assistanceType === getMenuLabel('BOARDING_ASSIST', '乗降介助')){
      total += boardingAssistPrice;
      breakdown.push({ name:getMenuLabel('BOARDING_ASSIST', '乗降介助'), price:boardingAssistPrice });
    } else if (assistanceType === getMenuLabel('BODY_ASSIST', '身体介助')){
      total += bodyAssistPrice;
      breakdown.push({ name:getMenuLabel('BODY_ASSIST', '身体介助'), price:bodyAssistPrice });
    }
  }

  const stairPrices = {};
  stairPrices[getMenuLabel('STAIR_2F', '2階移動')] = stair2Price;
  stairPrices[getMenuLabel('STAIR_3F', '3階移動')] = stair3Price;
  stairPrices[getMenuLabel('STAIR_4F', '4階移動')] = stair4Price;
  stairPrices[getMenuLabel('STAIR_5F', '5階移動')] = stair5Price;

  if (stairPrices[stairAssistance] !== undefined){
    total += stairPrices[stairAssistance];
    breakdown.push({ name:`階段介助(${stairAssistance})`, price:stairPrices[stairAssistance] });
  } else if (stairAssistance === getMenuLabel('STAIR_WATCH', '見守り介助')){
    breakdown.push({ name:getMenuLabel('STAIR_WATCH', '見守り介助'), price:0 });
  }

  if (equipmentRental === getMenuLabel('EQUIP_RECLINING', 'リクライニング車いすレンタル')){
    total += recliningPrice;
    breakdown.push({ name:getMenuLabel('EQUIP_RECLINING', 'リクライニング車いすレンタル'), price:recliningPrice });
  } else if (equipmentRental === getMenuLabel('EQUIP_STRETCHER', 'ストレッチャーレンタル')){
    total += stretcherPrice;
    breakdown.push({ name:getMenuLabel('EQUIP_STRETCHER', 'ストレッチャーレンタル'), price:stretcherPrice });

    if (mustUseStretcherStaff2){
      total += stretcherStaffPrice;
      breakdown.push({ name:getMenuLabel('EQUIP_STRETCHER_STAFF2', 'ストレッチャー2名体制介助料'), price:stretcherStaffPrice });
    }
  } else if (equipmentRental === getMenuLabel('EQUIP_WHEELCHAIR', '車いすレンタル')){
    breakdown.push({ name:getMenuLabel('EQUIP_WHEELCHAIR', '車いすレンタル'), price:0 });
  } else if (equipmentRental === getMenuLabel('EQUIP_OWN_WHEELCHAIR', 'ご自身車いす')){
    breakdown.push({ name:getMenuLabel('EQUIP_OWN_WHEELCHAIR', 'ご自身車いす'), price:0 });
  }

  if (roundTrip === getMenuLabel('ROUND_STANDBY', '待機')){
    total += standbyPrice;
    breakdown.push({ name:getMenuLabel('ROUND_STANDBY', '待機'), price:standbyPrice, suffix:' から/30分毎' });
  } else if (roundTrip === getMenuLabel('ROUND_HOSPITAL', '病院付き添い')){
    total += hospitalEscortPrice;
    breakdown.push({ name:getMenuLabel('ROUND_HOSPITAL', '病院付き添い'), price:hospitalEscortPrice, suffix:' から/30分毎' });
  }

  const breakdownEl = document.getElementById('priceBreakdown');
  breakdownEl.innerHTML = breakdown.map(item => `
    <div class="price-item">
      <span class="price-label">${escapeHtml(item.name)}</span>
      <span class="price-value">${Number(item.price).toLocaleString()}円${escapeHtml(item.suffix || '')}</span>
    </div>
  `).join('');

  document.getElementById('totalPrice').textContent = `${total.toLocaleString()}円`;
  return total;
}

function updateSubmitButton(){
  const privacy = document.getElementById('privacyAgreement').checked;
  const usageType = document.getElementById('usageType').value;
  const customerName = document.getElementById('customerName').value.trim();
  const phoneNumber = document.getElementById('phoneNumber').value.trim();
  const pickupLocation = document.getElementById('pickupLocation').value.trim();
  const assistanceType = document.getElementById('assistanceType').value;
  const equipmentRental = document.getElementById('equipmentRental').value;

  const isValid = privacy && usageType && customerName && phoneNumber && pickupLocation && assistanceType && equipmentRental;

  const submitBtn = document.getElementById('submitBooking');
  if (isValid){
    submitBtn.disabled = false;
    submitBtn.className = 'w-full cute-btn py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 cursor-pointer text-lg';
  } else {
    submitBtn.disabled = true;
    submitBtn.className = 'w-full cute-btn py-4 bg-gray-300 text-white cursor-not-allowed text-lg';
  }
}

function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitAndRefresh_(waitMs){
  await sleep(waitMs || 700);
  await refreshAllData(true);
}

async function submitBooking(e){
  e.preventDefault();

  const submitBtn = document.getElementById('submitBooking');
  submitBtn.disabled = true;
  submitBtn.textContent = '待機中 予約中...';

  const reservationId = formatDateForId(selectedSlot.date, selectedSlot.hour, selectedSlot.minute);
  const total = calculatePrice();

  const equipmentRental = document.getElementById('equipmentRental').value;
  const stretcherTwoStaff = (
    equipmentRental === getMenuLabel('EQUIP_STRETCHER', 'ストレッチャーレンタル') &&
    (String(config.rule_force_stretcher_staff2_on_stretcher || '1') === '1' || getRuleEnabled(6))
  ) ? 'あり' : 'なし';

  const slotDateStr = ymdLocal(selectedSlot.date);

  const reservation = {
    reservation_id: reservationId,
    reservation_datetime: `${slotDateStr} ${String(selectedSlot.hour).padStart(2,'0')}:${String(selectedSlot.minute).padStart(2,'0')}`,
    usage_type: document.getElementById('usageType').value,
    customer_name: document.getElementById('customerName').value.trim(),
    phone_number: document.getElementById('phoneNumber').value.trim(),
    pickup_location: document.getElementById('pickupLocation').value.trim(),
    destination: document.getElementById('destination').value.trim() || '',
    assistance_type: document.getElementById('assistanceType').value,
    stair_assistance: document.getElementById('stairAssistance').value,
    equipment_rental: equipmentRental,
    stretcher_two_staff: stretcherTwoStaff,
    round_trip: document.getElementById('roundTrip').value,
    notes: document.getElementById('notes').value.trim() || '',
    total_price: total,
    status: '未対応',
    slot_date: slotDateStr,
    slot_hour: selectedSlot.hour,
    slot_minute: selectedSlot.minute,
    is_visible: true
  };

  try{
    await withLoading(async ()=>{
      await gsRun('api_createReservation', reservation);
    }, '予約中...');

    await waitAndRefresh_(1000);

    fireTrigger();

    document.getElementById('reservationId').textContent = reservationId;
    document.getElementById('bookingModal').classList.add('hidden');
    document.getElementById('completeModal').classList.remove('hidden');

    renderCalendar(false);

    submitBtn.disabled = false;
    submitBtn.textContent = config.form_submit_button_text || '予約する';

  }catch(err){
    submitBtn.disabled = false;
    submitBtn.textContent = config.form_submit_button_text || '予約する';
    toast(err?.message || '通信エラー（予約保存）');

    const oldError = document.querySelector('#bookingForm .booking-error');
    if (oldError) oldError.remove();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'booking-error bg-red-100 border-2 border-red-300 text-red-700 px-4 py-3 rounded-xl mb-4 font-medium';
    errorDiv.textContent = 'NG 予約に失敗しました。もう一度お試しください。';
    document.getElementById('bookingForm').prepend(errorDiv);
  }
}

async function refreshConfigPublic(){
  try{
    const res = await gsRun('api_getConfigPublic');
    if (res && res.isOk){
      config = { ...defaultConfig, ...(res.data || {}) };
      applyConfigToUI();
    }
  }catch(e){}
}

async function refreshData(showToastOnFail=false){
  try{
    const initRes = await gsRun('api_getInitData');
    if (!initRes || !initRes.isOk) throw new Error('init failed');

    const data = initRes.data || {};
    config = { ...defaultConfig, ...(data.config || config || {}) };
    menuMaster = Array.isArray(data.menu_master) ? data.menu_master : [];
    menuKeyCatalog = Array.isArray(data.menu_key_catalog) ? data.menu_key_catalog : [];
    menuGroupCatalog = Array.isArray(data.menu_group_catalog) && data.menu_group_catalog.length ? data.menu_group_catalog : defaultMenuGroupCatalog;
    autoRuleCatalog = Array.isArray(data.auto_rule_catalog) ? data.auto_rule_catalog : [];
    reservations = data.reservations || [];
    const blocks = data.blocks || [];

    rebuildBlockedSlotsFromSheet(blocks);
    rebuildReservedSlotsFromReservations(reservations);

    applyConfigToUI();
    renderServiceSelectors();
  }catch(e){
    if (showToastOnFail) toast(e?.message || '通信エラー（データ取得）');
    throw e;
  }
}

async function refreshAllData(showToastOnFail=false){
  await refreshData(showToastOnFail);
}

function applyConfigToUI(){
  const titleEl = document.getElementById('mainTitle');
  const subEl = document.getElementById('mainSubTitle');
  const notifyEl = document.getElementById('notifyPhoneText');

  if (titleEl) titleEl.textContent = config.logo_text || config.main_title || defaultConfig.main_title;
  if (subEl) subEl.textContent = config.logo_subtext || defaultConfig.logo_subtext;
  if (notifyEl) notifyEl.textContent = `[${config.phone_notify_text || defaultConfig.phone_notify_text}]`;

  const toggleBtn = document.getElementById('toggleTimeView');
  if (toggleBtn) {
    const extendedEnabled = String(config.extended_enabled || '1') === '1';
    toggleBtn.style.display = extendedEnabled ? '' : 'none';
    if (!extendedEnabled) {
      isExtendedView = false;
    }
    toggleBtn.textContent = isExtendedView
      ? (config.calendar_toggle_regular_text || defaultConfig.calendar_toggle_regular_text)
      : (config.calendar_toggle_extended_text || defaultConfig.calendar_toggle_extended_text);
  }

  document.getElementById('legendAvailableText').textContent = config.calendar_legend_available || defaultConfig.calendar_legend_available;
  document.getElementById('legendUnavailableText').textContent = config.calendar_legend_unavailable || defaultConfig.calendar_legend_unavailable;
  document.getElementById('scrollGuideText').textContent = config.calendar_scroll_guide_text || defaultConfig.calendar_scroll_guide_text;

  document.getElementById('formModalTitle').textContent = config.form_modal_title || defaultConfig.form_modal_title;
  document.getElementById('privacyText').childNodes[0].textContent = (config.form_privacy_text || defaultConfig.form_privacy_text) + ' ';
  document.getElementById('basicSectionTitle').textContent = config.form_basic_section_title || defaultConfig.form_basic_section_title;
  document.getElementById('basicSectionBadge').textContent = config.form_basic_section_badge || defaultConfig.form_basic_section_badge;
  document.getElementById('usageTypeLabel').innerHTML = `${escapeHtml(config.form_usage_type_label || defaultConfig.form_usage_type_label)} <span class="required">*</span>`;
  document.getElementById('customerNameLabel').innerHTML = `${escapeHtml(config.form_customer_name_label || defaultConfig.form_customer_name_label)} <span class="required">*</span>`;
  document.getElementById('phoneLabel').innerHTML = `${escapeHtml(config.form_phone_label || defaultConfig.form_phone_label)} <span class="required">*</span>`;
  document.getElementById('pickupLabel').innerHTML = `${escapeHtml(config.form_pickup_label || defaultConfig.form_pickup_label)} <span class="required">*</span>`;
  document.getElementById('optionalSectionTitle').textContent = config.form_optional_section_title || defaultConfig.form_optional_section_title;
  document.getElementById('optionalSectionBadge').textContent = config.form_optional_section_badge || defaultConfig.form_optional_section_badge;
  document.getElementById('destinationLabel').textContent = config.form_destination_label || defaultConfig.form_destination_label;
  document.getElementById('notesLabel').textContent = config.form_notes_label || defaultConfig.form_notes_label;
  document.getElementById('serviceSectionTitle').textContent = config.form_service_section_title || defaultConfig.form_service_section_title;
  document.getElementById('serviceSectionBadge').textContent = config.form_service_section_badge || defaultConfig.form_service_section_badge;
  document.getElementById('assistanceLabel').innerHTML = `${escapeHtml(config.form_assistance_label || defaultConfig.form_assistance_label)} <span class="required">*</span>`;
  document.getElementById('stairLabel').innerHTML = `${escapeHtml(config.form_stair_label || defaultConfig.form_stair_label)} <span class="required">*</span>`;
  document.getElementById('equipmentLabel').innerHTML = `${escapeHtml(config.form_equipment_label || defaultConfig.form_equipment_label)} <span class="required">*</span>`;
  document.getElementById('roundTripLabel').innerHTML = `${escapeHtml(config.form_round_trip_label || defaultConfig.form_round_trip_label)} <span class="required">*</span>`;
  document.getElementById('priceSectionTitle').textContent = config.form_price_section_title || defaultConfig.form_price_section_title;
  document.getElementById('priceTotalLabel').textContent = config.form_price_total_label || defaultConfig.form_price_total_label;
  document.getElementById('priceNoticeText').textContent = config.form_price_notice_text || defaultConfig.form_price_notice_text;
  document.getElementById('submitBooking').textContent = config.form_submit_button_text || defaultConfig.form_submit_button_text;

  document.getElementById('usageType').innerHTML = `
    <option value="">${escapeHtml(config.form_usage_type_placeholder || defaultConfig.form_usage_type_placeholder)}</option>
    <option value="${escapeHtml(config.form_usage_type_option_first || defaultConfig.form_usage_type_option_first)}">${escapeHtml(config.form_usage_type_option_first || defaultConfig.form_usage_type_option_first)}</option>
    <option value="${escapeHtml(config.form_usage_type_option_repeat || defaultConfig.form_usage_type_option_repeat)}">${escapeHtml(config.form_usage_type_option_repeat || defaultConfig.form_usage_type_option_repeat)}</option>
  `;

  document.getElementById('customerName').placeholder = config.form_customer_name_placeholder || defaultConfig.form_customer_name_placeholder;
  document.getElementById('phoneNumber').placeholder = config.form_phone_placeholder || defaultConfig.form_phone_placeholder;
  document.getElementById('pickupLocation').placeholder = config.form_pickup_placeholder || defaultConfig.form_pickup_placeholder;
  document.getElementById('destination').placeholder = config.form_destination_placeholder || defaultConfig.form_destination_placeholder;
  document.getElementById('notes').placeholder = config.form_notes_placeholder || defaultConfig.form_notes_placeholder;

  document.getElementById('completeTitle').textContent = config.complete_title || defaultConfig.complete_title;
  document.getElementById('completeTitleSub').textContent = config.complete_title_sub || defaultConfig.complete_title_sub;
  document.getElementById('completeReservationIdLabel').textContent = config.complete_reservation_id_label || defaultConfig.complete_reservation_id_label;
  document.getElementById('completePhoneGuidePrefix').textContent = config.complete_phone_guide_prefix || defaultConfig.complete_phone_guide_prefix;
  document.getElementById('completePhoneGuideMiddle').textContent = config.complete_phone_guide_middle || defaultConfig.complete_phone_guide_middle;
  document.getElementById('completePhoneGuideAfter').textContent = config.complete_phone_guide_after || defaultConfig.complete_phone_guide_after;
  document.getElementById('completePhoneGuideWarning').textContent = config.complete_phone_guide_warning || defaultConfig.complete_phone_guide_warning;
  document.getElementById('completePhoneGuideFooter').textContent = config.complete_phone_guide_footer || defaultConfig.complete_phone_guide_footer;
  document.getElementById('closeComplete').textContent = config.complete_close_button_text || defaultConfig.complete_close_button_text;

  updateLogoPreview();
}

async function updateLogoPreview(){
  const mainImg = document.getElementById('adminLoginImg');
  const logoText = config.logo_text || config.main_title || defaultConfig.main_title;
  const logoSubText = config.logo_subtext || defaultConfig.logo_subtext;

  const titleEl = document.getElementById('mainTitle');
  const subEl = document.getElementById('mainSubTitle');
  if (titleEl) titleEl.textContent = logoText;
  if (subEl) subEl.textContent = logoSubText;

  let finalSrc = config.logo_image_url || 'https://raw.githubusercontent.com/infochibafukushi-dotcom/chiba-care-taxi-assets/main/logo.png';

  const useDrive = String(config.logo_use_drive_image || '0') === '1';
  const driveFileId = String(config.logo_drive_file_id || '').trim();

  if (!finalSrc && useDrive && driveFileId) {
    try{
      const res = await gsRun('api_getDriveImageDataUrl', driveFileId);
      if (res && res.isOk && res.data && res.data.dataUrl) {
        finalSrc = res.data.dataUrl;
      }
    }catch(_){}
  }

  if (mainImg) mainImg.src = finalSrc || 'https://raw.githubusercontent.com/infochibafukushi-dotcom/chiba-care-taxi-assets/main/logo.png';
}

function escapeHtml(str){
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function debounce(fn, ms){
  let t = null;
  return (...args)=>{
    clearTimeout(t);
    t = setTimeout(()=>fn(...args), ms);
  };
}

async function init(){
  try{
    await withLoading(async ()=>{
      try{ await refreshConfigPublic(); }catch(e){}
      try{ await refreshAllData(true); }catch(e){}
      try{ bindGridDelegation(); }catch(e){}
      try{ renderCalendar(false); }catch(e){
        toast('カレンダー描画エラー: ' + (e?.message || e));
      }
    }, '読み込み中...');
  }catch(e){
    try{ showLoading(false); }catch(_){}
    toast('初期化エラー: ' + (e?.message || e));
    try{ renderCalendar(false); }catch(_){}
  }
}

(function bindUI(){
  let tapCount = 0;
  let tapTimer = null;

  document.getElementById('adminLoginBtn').addEventListener('click', ()=>{
    tapCount++;
    if (tapTimer) clearTimeout(tapTimer);

    const targetTapCount = Number(config.admin_tap_count || defaultConfig.admin_tap_count || 5);

    if (tapCount === targetTapCount){
      document.getElementById('passwordModal').classList.remove('hidden');
      document.getElementById('adminPassword').value = '';
      document.getElementById('passwordError').classList.add('hidden');
      document.getElementById('adminPassword').focus();
      tapCount = 0;
    } else {
      tapTimer = setTimeout(()=> tapCount = 0, 1500);
    }
  });

  async function doAdminLogin(){
    const password = String(document.getElementById('adminPassword').value || '').trim();

    try{
      await withLoading(async ()=>{
        await gsRun('api_verifyAdminPassword', { password: password });
      }, '認証中...');

      sessionStorage.setItem('chiba_care_taxi_admin_auth', 'ok');
      sessionStorage.setItem('chiba_care_taxi_admin_auth_time', String(Date.now()));

      window.location.href = ADMIN_PAGE_URL;

    }catch(e){
      document.getElementById('passwordError').classList.remove('hidden');
      document.getElementById('adminPassword').value = '';
      document.getElementById('adminPassword').focus();
    }
  }

  document.getElementById('submitPassword').addEventListener('click', doAdminLogin);
  document.getElementById('adminPassword').addEventListener('keypress', (e)=>{
    if (e.key === 'Enter') doAdminLogin();
  });
  document.getElementById('cancelPassword').addEventListener('click', ()=>{
    document.getElementById('passwordModal').classList.add('hidden');
  });

  document.getElementById('closeBooking').addEventListener('click', ()=> document.getElementById('bookingModal').classList.add('hidden'));
  document.getElementById('closeComplete').addEventListener('click', ()=> document.getElementById('completeModal').classList.add('hidden'));

  document.getElementById('toggleTimeView').addEventListener('click', ()=>{
    isExtendedView = !isExtendedView;
    const btn = document.getElementById('toggleTimeView');
    if (isExtendedView){
      btn.classList.remove('from-sky-500','to-sky-600','hover:from-sky-600','hover:to-sky-700');
      btn.classList.add('from-cyan-500','to-cyan-600','hover:from-cyan-600','hover:to-cyan-700');
      btn.textContent = config.calendar_toggle_regular_text || '通常時間';
    } else {
      btn.classList.remove('from-cyan-500','to-cyan-600','hover:from-cyan-600','hover:to-cyan-700');
      btn.classList.add('from-sky-500','to-sky-600','hover:from-sky-600','hover:to-sky-700');
      btn.textContent = config.calendar_toggle_extended_text || '他時間予約';
    }
    renderCalendar(false);
  });

  const formInputs = ['privacyAgreement','usageType','customerName','phoneNumber','pickupLocation','assistanceType','equipmentRental'];
  formInputs.forEach(id=>{
    document.getElementById(id).addEventListener('change', updateSubmitButton);
    document.getElementById(id).addEventListener('input', updateSubmitButton);
  });

  const priceInputs = ['assistanceType','stairAssistance','equipmentRental','roundTrip'];
  priceInputs.forEach(id=>{
    document.getElementById(id).addEventListener('change', ()=>{
      calculatePrice();
      updateSubmitButton();
    });
  });

  document.getElementById('bookingForm').addEventListener('submit', submitBooking);

  window.addEventListener('resize', debounce(()=>{
    try{
      renderCalendar(false);
    }catch(_){}
  }, 150));
})();

init();
