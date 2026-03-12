const GAS_URL = "https://script.google.com/macros/s/AKfycbzd65XmVTR-oxl_-qvbVs51S2JCmv_QBN7OS7wlfaaIxp5eCA486C_vnzI7Y07Llgpy/exec";
const PUBLIC_PAGE_URL = "index.html";
const ADMIN_AUTH_KEY = "chiba_care_taxi_admin_auth";
const ADMIN_AUTH_TIME_KEY = "chiba_care_taxi_admin_auth_time";
const ADMIN_AUTH_MAX_AGE_MS = 1000 * 60 * 60 * 12;

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
    } else if (func === 'api_getDriveImageDataUrl') {
      const fileId = args[0];
      data = await _jsonpCall(`${GAS_URL}?action=getDriveImageDataUrl&fileId=${encodeURIComponent(fileId)}`);
    } else if (func === 'api_updateReservation') {
      data = await _postJson('updateReservation', args[0]);
    } else if (func === 'api_toggleBlock') {
      data = await _postJson('toggleBlock', {
        dateStr: args[0],
        hour: args[1],
        minute: args[2]
      });
    } else if (func === 'api_setRegularDayBlocked') {
      data = await _postJson('setRegularDayBlocked', {
        dateStr: args[0],
        isBlocked: args[1]
      });
    } else if (func === 'api_setOtherTimeDayBlocked') {
      data = await _postJson('setOtherTimeDayBlocked', {
        dateStr: args[0],
        isBlocked: args[1]
      });
    } else if (func === 'api_saveConfig') {
      data = await _postJson('saveConfig', args[0]);
    } else if (func === 'api_saveMenuMaster') {
      data = await _postJson('saveMenuMaster', args[0]);
    } else if (func === 'api_uploadLogoImage') {
      data = await _postJson('uploadLogoImage', args[0]);
    } else if (func === 'api_changeAdminPassword') {
      data = await _postJson('changeAdminPassword', args[0]);
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
let selectedReservation = null;
let config = {};
let menuMaster = [];
let menuKeyCatalog = [];
let menuGroupCatalog = [];
let adminCalendarDates = [];

const defaultConfig = {
  main_title: '介護タクシー予約',
  logo_text: '介護タクシー予約',
  logo_subtext: '丁寧・安全な送迎をご提供します',
  logo_image_url: '',
  logo_drive_file_id: '',
  logo_use_drive_image: '0',
  phone_notify_text: '090-6331-4289',
  same_day_enabled: '0',
  same_day_min_hours: '3',
  admin_tap_count: '5',
  max_forward_days: '30',
  extended_enabled: '1'
};

const defaultMenuGroupCatalog = [
  { key: 'price', label: '料金概算（基本料金）' },
  { key: 'assistance', label: '介助内容' },
  { key: 'stair', label: '階段介助' },
  { key: 'equipment', label: '機材レンタル' },
  { key: 'round_trip', label: '往復送迎' },
  { key: 'custom', label: 'その他（表示先なし）' }
];

function isAdminAuthenticated(){
  const auth = sessionStorage.getItem(ADMIN_AUTH_KEY);
  const authTime = Number(sessionStorage.getItem(ADMIN_AUTH_TIME_KEY) || 0);
  if (auth !== 'ok') return false;
  if (!authTime) return false;
  const age = Date.now() - authTime;
  return age >= 0 && age <= ADMIN_AUTH_MAX_AGE_MS;
}

function clearAdminAuth(){
  sessionStorage.removeItem(ADMIN_AUTH_KEY);
  sessionStorage.removeItem(ADMIN_AUTH_TIME_KEY);
}

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

function findMenuGroupByKey(groupKey){
  const list = (menuGroupCatalog && menuGroupCatalog.length) ? menuGroupCatalog : defaultMenuGroupCatalog;
  return list.find(item => String(item.key || '') === String(groupKey || '')) || null;
}

function normalizeMenuGroup(groupKey){
  const key = String(groupKey || '').trim();
  const allowed = (menuGroupCatalog && menuGroupCatalog.length ? menuGroupCatalog : defaultMenuGroupCatalog).map(x => String(x.key));
  return allowed.includes(key) ? key : 'custom';
}

function getMenuPrice(key, fallback){
  const map = getMenuMap();
  if (map[key] && map[key].price !== undefined && map[key].price !== null && map[key].price !== '') {
    return Number(map[key].price || 0);
  }
  return Number(fallback || 0);
}

function getMenuKeyJp(key, fallback){
  const map = getMenuMap();
  if (map[key] && map[key].key_jp) return String(map[key].key_jp);
  const catalog = findCatalogByKey(key);
  if (catalog && catalog.key_jp) return String(catalog.key_jp);
  return fallback || key || '';
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

function formatDate(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['日','月','火','水','木','金','土'];
  return `${month}/${day}(${weekdays[date.getDay()]})`;
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

function isRegularFullyBlocked(dateStr){
  for (let h = 6; h <= 21; h++){
    if (!isSlotBlockedWithMinuteByDateStr(dateStr, h, 0)) return false;
    if (h < 21){
      if (!isSlotBlockedWithMinuteByDateStr(dateStr, h, 30)) return false;
    }
  }
  return true;
}

function isOtherTimeFullyBlocked(dateStr){
  if (!isSlotBlockedWithMinuteByDateStr(dateStr, 21, 30)) return false;
  for (let h = 22; h < 24; h++){
    if (!isSlotBlockedWithMinuteByDateStr(dateStr, h, 0)) return false;
    if (!isSlotBlockedWithMinuteByDateStr(dateStr, h, 30)) return false;
  }
  for (let h = 0; h <= 5; h++){
    if (!isSlotBlockedWithMinuteByDateStr(dateStr, h, 0)) return false;
    if (!isSlotBlockedWithMinuteByDateStr(dateStr, h, 30)) return false;
  }
  return true;
}

function isSlotBlockedWithMinuteByDateStr(dateStr, hour, minute){
  const [y,m,d] = String(dateStr).split('-').map(Number);
  const date = new Date(y, m-1, d, 0, 0, 0, 0);
  return isSlotBlockedWithMinute(date, hour, minute);
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
  const grid = document.getElementById('adminCalendarGrid');
  const dateRangeEl = document.getElementById('adminDateRange');
  if (!grid || !dateRangeEl) return;

  const dates = getDatesRange();
  adminCalendarDates = dates;

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
    const dateStr = ymdLocal(date);
    const fullBlocked = isRegularFullyBlocked(dateStr);
    const label = fullBlocked ? '〇' : '×';
    const nextBlocked = !fullBlocked;
    const btnClass = fullBlocked ? 'day-btn day-btn-unblock' : 'day-btn day-btn-block';

    html += `
      <div class="date-header sticky-top ${isWeekend ? 'weekend' : ''}" data-date-idx="${idx}">
        <div class="flex flex-col items-center gap-1">
          <div>${formatDate(date)}</div>
          <button class="${btnClass}"
            data-action="day"
            data-scope="regular"
            data-date-idx="${idx}"
            data-next-blocked="${nextBlocked}"
            type="button">${label}</button>
        </div>
      </div>
    `;
  });

  for (const slot of regularSlots){
    html += `<div class="time-label sticky-left">${slot.display}</div>`;
    for (let idx=0; idx<dates.length; idx++){
      const date = dates[idx];
      const blocked = isSlotBlockedWithMinute(date, slot.hour, slot.minute);
      const slotClass = blocked ? 'admin-slot-unavailable' : 'admin-slot-available';

      html += `<div class="${slotClass} p-3 text-center text-lg font-bold rounded-lg cursor-pointer transition"
                data-action="slot"
                data-date-idx="${idx}"
                data-hour="${slot.hour}"
                data-minute="${slot.minute}">
                ${blocked ? 'X' : '◎'}
              </div>`;
    }
  }

  html += '<div class="time-label sticky-left" style="font-weight:bold;background:linear-gradient(135deg,#cffafe 0%,#a5f3fc 100%);color:#0e7490;border:2px solid #06b6d4;">他時間</div>';

  dates.forEach((date, idx)=>{
    const isWeekend = (date.getDay() === 0 || date.getDay() === 6);
    const dateStr = ymdLocal(date);
    const fullBlocked = isOtherTimeFullyBlocked(dateStr);
    const label = fullBlocked ? '〇' : '×';
    const nextBlocked = !fullBlocked;
    const btnClass = fullBlocked ? 'day-btn day-btn-unblock' : 'day-btn day-btn-block';

    html += `
      <div class="date-header ${isWeekend ? 'weekend' : ''}"
        style="background:linear-gradient(135deg,#cffafe 0%,#a5f3fc 100%);border-color:#06b6d4;color:#0e7490;"
        data-date-idx="${idx}">
        <div class="flex flex-col items-center gap-1">
          <div>${formatDate(date)}</div>
          <button class="${btnClass}"
            data-action="day"
            data-scope="other"
            data-date-idx="${idx}"
            data-next-blocked="${nextBlocked}"
            type="button">${label}</button>
        </div>
      </div>
    `;
  });

  for (const slot of extendedSlots){
    html += `<div class="time-label sticky-left" style="background:linear-gradient(135deg,#cffafe 0%,#a5f3fc 100%);border:2px solid #06b6d4;color:#0e7490;font-weight:600;">${slot.display}</div>`;
    for (let idx=0; idx<dates.length; idx++){
      const date = dates[idx];
      const blocked = isSlotBlockedWithMinute(date, slot.hour, slot.minute);
      const slotClass = blocked ? 'admin-slot-unavailable' : 'admin-slot-available';

      html += `<div class="${slotClass} p-3 text-center text-lg font-bold rounded-lg cursor-pointer transition"
                data-action="slot"
                data-date-idx="${idx}"
                data-hour="${slot.hour}"
                data-minute="${slot.minute}">
                ${blocked ? 'X' : '◎'}
              </div>`;
    }
  }

  grid.innerHTML = html;

  applyCalendarGridColumns(grid, dates.length);
  requestAnimationFrame(()=> applyCalendarGridColumns(grid, dates.length));
}

function bindGridDelegation(){
  const grid = document.getElementById('adminCalendarGrid');
  if (!grid) return;

  grid.addEventListener('click', async (ev)=>{
    const el = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
    if (!el) return;

    const action = el.dataset.action;

    if (action === 'day'){
      ev.preventDefault();
      ev.stopPropagation();

      const dateIdx = Number(el.dataset.dateIdx);
      const nextBlocked = String(el.dataset.nextBlocked) === 'true';
      const scope = String(el.dataset.scope || 'regular');
      const date = adminCalendarDates[dateIdx];
      if (!date) return;
      const dateStr = ymdLocal(date);

      try{
        await withLoading(async ()=>{
          if (scope === 'other'){
            await gsRun('api_setOtherTimeDayBlocked', dateStr, nextBlocked);
          } else {
            await gsRun('api_setRegularDayBlocked', dateStr, nextBlocked);
          }

          await waitAndRefresh_(700);
          renderCalendar();
        }, '更新中...');

        const label = (scope === 'other') ? '他時間' : '通常時間';
        toast(nextBlocked ? `${label} ブロック（×）` : `${label} ブロック解除（〇）`, 1400);
      }catch(e){
        toast(e?.message || '通信エラー（日付更新）');
      }
      return;
    }

    if (action === 'slot'){
      const dateIdx = Number(el.dataset.dateIdx);
      const hour = Number(el.dataset.hour);
      const minute = Number(el.dataset.minute || 0);
      const date = adminCalendarDates[dateIdx];
      if (!date) return;
      await handleAdminSlotClick(date, hour, minute);
    }
  }, { passive: false });
}

async function handleAdminSlotClick(date, hour, minute){
  const dateStr = ymdLocal(date);
  const key = `${dateStr}-${hour}-${minute}`;
  if (reservedSlots.has(key)) return;

  try{
    await withLoading(async ()=>{
      await gsRun('api_toggleBlock', dateStr, hour, minute);
      await waitAndRefresh_(700);
      renderCalendar();
    }, '更新中...');
  }catch(e){
    toast(e?.message || '通信エラー（ブロック更新）');
  }
}

function updateStats(){
  const visible = reservations.filter(r => r.is_visible !== false && r.is_visible !== 'FALSE');
  document.getElementById('totalReservations').textContent = visible.length;
  document.getElementById('pendingCount').textContent = visible.filter(r=>r.status==='未対応').length;
  document.getElementById('confirmedCount').textContent = visible.filter(r=>r.status==='確認済').length;
  document.getElementById('completedCount').textContent = visible.filter(r=>r.status==='完了').length;
}

function getBadgeClass(status){
  return ({
    '未対応':'badge-pending',
    '確認済':'badge-confirmed',
    '完了':'badge-completed',
    'キャンセル':'badge-cancelled'
  }[status]) || 'badge-pending';
}

function renderSheetView(){
  const tbody = document.getElementById('sheetTableBody');
  if (!tbody) return;

  const visible = reservations.filter(r => r.is_visible !== false && r.is_visible !== 'FALSE');

  if (visible.length === 0){
    tbody.innerHTML = '<tr><td colspan="16" class="border border-gray-300 p-2 text-center text-gray-500">データがありません</td></tr>';
    return;
  }

  const sorted = [...visible].sort((a,b)=> new Date(b.reservation_datetime) - new Date(a.reservation_datetime));
  tbody.innerHTML = sorted.map(r=>`
    <tr class="hover:bg-sky-50 sheet-row-clickable" data-reservation-id="${escapeHtml(String(r.reservation_id || ''))}">
      <td class="border border-sky-200 p-3 font-mono text-xs">${escapeHtml(r.reservation_id || '')}</td>
      <td class="border border-sky-200 p-3">${escapeHtml(r.reservation_datetime || '')}</td>
      <td class="border border-sky-200 p-3">${escapeHtml(r.usage_type || '')}</td>
      <td class="border border-sky-200 p-3 font-bold">${escapeHtml(r.customer_name || '')}</td>
      <td class="border border-sky-200 p-3">${escapeHtml(r.phone_number || '')}</td>
      <td class="border border-sky-200 p-3">${escapeHtml(r.pickup_location || '')}</td>
      <td class="border border-sky-200 p-3">${escapeHtml(r.destination || '-')}</td>
      <td class="border border-sky-200 p-3">${escapeHtml(r.assistance_type || '')}</td>
      <td class="border border-sky-200 p-3">${escapeHtml(r.stair_assistance || '')}</td>
      <td class="border border-sky-200 p-3">${escapeHtml(r.equipment_rental || '')}</td>
      <td class="border border-sky-200 p-3">${escapeHtml(r.stretcher_two_staff || '')}</td>
      <td class="border border-sky-200 p-3">${escapeHtml(r.round_trip || '')}</td>
      <td class="border border-sky-200 p-3">${escapeHtml(r.notes || '-')}</td>
      <td class="border border-sky-200 p-3 font-bold text-emerald-600">${Number(r.total_price||0).toLocaleString()}円</td>
      <td class="border border-sky-200 p-3"><span class="badge ${getBadgeClass(r.status)}">${escapeHtml(r.status || '')}</span></td>
      <td class="border border-sky-200 p-3 text-center text-sky-700 font-bold">詳細</td>
    </tr>
  `).join('');
}

function openReservationDetail(reservation){
  selectedReservation = reservation;
  const content = document.getElementById('detailContent');

  content.innerHTML = `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-sky-50 p-4 rounded-lg border-2 border-sky-200">
          <p class="text-xs text-gray-500 font-bold mb-1">予約ID</p>
          <p class="font-bold text-gray-800">${escapeHtml(reservation.reservation_id || '')}</p>
        </div>
        <div class="bg-sky-50 p-4 rounded-lg border-2 border-sky-200">
          <p class="text-xs text-gray-500 font-bold mb-1">予約日時</p>
          <p class="font-bold text-gray-800">${escapeHtml(reservation.reservation_datetime || '')}</p>
        </div>
      </div>
      <div class="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
        <p class="text-xs text-gray-500 font-bold mb-1">ご利用区分</p>
        <p class="font-bold text-gray-800">${escapeHtml(reservation.usage_type || '')}</p>
      </div>
      <div class="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
        <p class="text-xs text-gray-500 font-bold mb-1">お名前</p>
        <p class="font-bold text-gray-800 text-lg">${escapeHtml(reservation.customer_name || '')}</p>
      </div>
      <div class="bg-pink-50 p-4 rounded-lg border-2 border-pink-200">
        <p class="text-xs text-gray-500 font-bold mb-1">連絡先</p>
        <p class="font-bold text-gray-800">${escapeHtml(reservation.phone_number || '')}</p>
      </div>
      <div class="bg-emerald-50 p-4 rounded-lg border-2 border-emerald-200">
        <p class="text-xs text-gray-500 font-bold mb-1">お伺い先</p>
        <p class="font-bold text-gray-800">${escapeHtml(reservation.pickup_location || '')}</p>
      </div>
      <div class="bg-teal-50 p-4 rounded-lg border-2 border-teal-200">
        <p class="text-xs text-gray-500 font-bold mb-1">送迎先</p>
        <p class="font-bold text-gray-800">${escapeHtml(reservation.destination || '-')}</p>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-200">
          <p class="text-xs text-gray-500 font-bold mb-1">介助内容</p>
          <p class="font-bold text-gray-800">${escapeHtml(reservation.assistance_type || '')}</p>
        </div>
        <div class="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
          <p class="text-xs text-gray-500 font-bold mb-1">階段介助</p>
          <p class="font-bold text-gray-800">${escapeHtml(reservation.stair_assistance || '')}</p>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-cyan-50 p-4 rounded-lg border-2 border-cyan-200">
          <p class="text-xs text-gray-500 font-bold mb-1">機材</p>
          <p class="font-bold text-gray-800">${escapeHtml(reservation.equipment_rental || '')}</p>
        </div>
        <div class="bg-indigo-50 p-4 rounded-lg border-2 border-indigo-200">
          <p class="text-xs text-gray-500 font-bold mb-1">2名体制</p>
          <p class="font-bold text-gray-800">${escapeHtml(reservation.stretcher_two_staff || '')}</p>
        </div>
      </div>
      <div class="bg-lime-50 p-4 rounded-lg border-2 border-lime-200">
        <p class="text-xs text-gray-500 font-bold mb-1">往復送迎</p>
        <p class="font-bold text-gray-800">${escapeHtml(reservation.round_trip || '')}</p>
      </div>
      <div class="bg-rose-50 p-4 rounded-lg border-2 border-rose-200">
        <p class="text-xs text-gray-500 font-bold mb-1">ご要望・備考</p>
        <p class="font-bold text-gray-800">${escapeHtml(reservation.notes || '-')}</p>
      </div>
      <div class="bg-gradient-to-r from-emerald-100 to-teal-100 p-4 rounded-lg border-2 border-emerald-300">
        <p class="text-xs text-gray-500 font-bold mb-2">概算合計</p>
        <p class="font-bold text-emerald-600 text-2xl">${Number(reservation.total_price || 0).toLocaleString()}円</p>
      </div>
    </div>
  `;

  document.getElementById('statusSelect').value = reservation.status || '未対応';
  document.getElementById('detailModal').classList.remove('hidden');
}

async function updateReservationStatus(){
  if (!selectedReservation) return;

  const newStatus = document.getElementById('statusSelect').value;
  const updateBtn = document.getElementById('updateStatus');
  updateBtn.disabled = true;
  updateBtn.textContent = '待機中 更新中...';

  const updatedReservation = {
    ...selectedReservation,
    status: newStatus,
    is_visible: (newStatus === 'キャンセル') ? false : true
  };

  try{
    await withLoading(async ()=>{
      await gsRun('api_updateReservation', updatedReservation);
    }, '更新中...');

    await waitAndRefresh_(1000);

    updateBtn.disabled = false;
    updateBtn.textContent = '更新';

    document.getElementById('detailModal').classList.add('hidden');
    renderSheetView();
    updateStats();
    renderCalendar();

  }catch(e){
    updateBtn.disabled = false;
    updateBtn.textContent = '更新';
    toast(e?.message || '通信エラー（ステータス更新）');
  }
}

async function hideSelectedReservation(){
  if (!selectedReservation) return;

  const hideBtn = document.getElementById('hideReservation');
  hideBtn.disabled = true;
  hideBtn.textContent = '待機中 非表示中...';

  const updatedReservation = { ...selectedReservation, is_visible: false };

  try{
    await withLoading(async ()=>{
      await gsRun('api_updateReservation', updatedReservation);
    }, '更新中...');

    await waitAndRefresh_(1000);

    hideBtn.disabled = false;
    hideBtn.textContent = '非表示';

    document.getElementById('detailModal').classList.add('hidden');
    renderSheetView();
    updateStats();
    renderCalendar();

  }catch(e){
    hideBtn.disabled = false;
    hideBtn.textContent = '非表示';
    toast(e?.message || '通信エラー（非表示）');
  }
}

function bindSheetRowClick(){
  const tbody = document.getElementById('sheetTableBody');
  if (!tbody) return;

  tbody.addEventListener('click', (ev)=>{
    const tr = ev.target?.closest?.('tr[data-reservation-id]');
    if (!tr) return;

    const rid = String(tr.dataset.reservationId || '').trim();
    const r = reservations.find(x => String(x.reservation_id) === rid);
    if (!r) {
      toast('予約データが見つかりません');
      return;
    }

    document.getElementById('sheetModal').classList.add('hidden');
    openReservationDetail(r);
  });
}

function buildMenuKeyJpOptions(selectedKey){
  const currentSelected = String(selectedKey || '');
  let html = `<option value="">選択してください</option>`;
  (menuKeyCatalog || []).forEach(item => {
    html += `<option value="${escapeAttr(item.key || '')}" ${String(item.key || '') === currentSelected ? 'selected' : ''}>${escapeHtml(item.key_jp || item.key || '')}</option>`;
  });
  return html;
}

function buildMenuGroupOptions(selectedGroup){
  const current = normalizeMenuGroup(selectedGroup || 'custom');
  const list = (menuGroupCatalog && menuGroupCatalog.length) ? menuGroupCatalog : defaultMenuGroupCatalog;
  let html = '';
  list.forEach(item => {
    html += `<option value="${escapeAttr(item.key || '')}" ${String(item.key || '') === current ? 'selected' : ''}>${escapeHtml(item.label || item.key || '')}</option>`;
  });
  return html;
}

function getMenuGroupForRow(item){
  const catalog = findCatalogByKey(item.key || '');
  return normalizeMenuGroup(item.menu_group || (catalog ? catalog.menu_group : 'custom'));
}

function renderMenuAdminList(){
  const wrap = document.getElementById('menuAdminList');
  if (!wrap) return;

  const items = [...(menuMaster || [])].sort((a,b) => {
    const aOrder = Number(a.sort_order || 9999);
    const bOrder = Number(b.sort_order || 9999);
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a.key || '').localeCompare(String(b.key || ''));
  });

  wrap.innerHTML = items.map((item, idx) => `
    <div class="menu-admin-row" data-menu-row="${idx}">
      <select class="menu-key-jp">
        ${buildMenuKeyJpOptions(item.key || '')}
      </select>

      <select class="menu-group-select">
        ${buildMenuGroupOptions(getMenuGroupForRow(item))}
      </select>

      <input type="text" class="menu-key" value="${escapeAttr(item.key || '')}" placeholder="内部KEY" readonly>
      <input type="text" class="menu-label" value="${escapeAttr(item.label || '')}" placeholder="表示名">
      <input type="number" class="menu-price" value="${escapeAttr(String(Number(item.price || 0)))}" placeholder="金額">
      <input type="text" class="menu-note" value="${escapeAttr(item.note || '')}" placeholder="説明">
      <select class="menu-visible">
        <option value="1" ${item.is_visible ? 'selected' : ''}>表示</option>
        <option value="0" ${!item.is_visible ? 'selected' : ''}>非表示</option>
      </select>
      <input type="number" class="menu-sort" value="${escapeAttr(String(Number(item.sort_order || 9999)))}" placeholder="順番">

      <input type="hidden" class="menu-key-jp-hidden" value="${escapeAttr(item.key_jp || getMenuKeyJp(item.key, ''))}">
      <input type="hidden" class="menu-required-flag" value="${item.required_flag ? '1' : '0'}">
    </div>
  `).join('');

  bindMenuAdminRowEvents();
}

function bindMenuAdminRowEvents(){
  const rows = Array.from(document.querySelectorAll('#menuAdminList .menu-admin-row'));
  rows.forEach(row => {
    const jpSelect = row.querySelector('.menu-key-jp');
    const groupSelect = row.querySelector('.menu-group-select');
    const keyInput = row.querySelector('.menu-key');
    const labelInput = row.querySelector('.menu-label');
    const priceInput = row.querySelector('.menu-price');
    const hiddenKeyJp = row.querySelector('.menu-key-jp-hidden');
    const requiredFlag = row.querySelector('.menu-required-flag');

    if (!jpSelect) return;

    jpSelect.addEventListener('change', ()=>{
      const key = String(jpSelect.value || '').trim();
      const catalog = findCatalogByKey(key);

      keyInput.value = key;

      if (catalog){
        hiddenKeyJp.value = catalog.key_jp || '';
        requiredFlag.value = catalog.required_flag ? '1' : '0';

        if (!labelInput.value.trim()){
          labelInput.value = catalog.default_label || '';
        }
        if (!priceInput.value.trim() || Number(priceInput.value || 0) === 0){
          priceInput.value = String(Number(catalog.default_price || 0));
        }

        if (groupSelect && (!groupSelect.value || groupSelect.value === 'custom')) {
          groupSelect.value = normalizeMenuGroup(catalog.menu_group || 'custom');
        }
      } else {
        hiddenKeyJp.value = '';
        requiredFlag.value = '0';
        if (groupSelect && !groupSelect.value) {
          groupSelect.value = 'custom';
        }
      }
    });

    if (groupSelect){
      groupSelect.addEventListener('change', ()=>{
        groupSelect.value = normalizeMenuGroup(groupSelect.value);
      });
    }
  });
}

function collectMenuAdminList(){
  const rows = Array.from(document.querySelectorAll('#menuAdminList .menu-admin-row'));
  return rows.map((row, idx) => {
    const key = row.querySelector('.menu-key').value.trim();
    const catalog = findCatalogByKey(key);

    let keyJp = row.querySelector('.menu-key-jp-hidden').value.trim();
    if (catalog && catalog.key_jp) keyJp = catalog.key_jp;

    return {
      key: key,
      key_jp: keyJp,
      label: row.querySelector('.menu-label').value.trim(),
      price: Number(row.querySelector('.menu-price').value || 0),
      note: row.querySelector('.menu-note').value.trim(),
      is_visible: row.querySelector('.menu-visible').value === '1',
      sort_order: Number(row.querySelector('.menu-sort').value || (idx + 1)),
      menu_group: normalizeMenuGroup(row.querySelector('.menu-group-select').value.trim() || (catalog ? catalog.menu_group : 'custom')),
      required_flag: row.querySelector('.menu-required-flag').value === '1'
    };
  }).filter(item => item.key && item.label);
}

function addMenuAdminRow(){
  const wrap = document.getElementById('menuAdminList');
  if (!wrap) return;

  const row = document.createElement('div');
  row.className = 'menu-admin-row';
  row.innerHTML = `
    <select class="menu-key-jp">
      ${buildMenuKeyJpOptions('')}
    </select>

    <select class="menu-group-select">
      ${buildMenuGroupOptions('custom')}
    </select>

    <input type="text" class="menu-key" value="" placeholder="内部KEY" readonly>
    <input type="text" class="menu-label" value="" placeholder="表示名">
    <input type="number" class="menu-price" value="0" placeholder="金額">
    <input type="text" class="menu-note" value="" placeholder="説明">
    <select class="menu-visible">
      <option value="1" selected>表示</option>
      <option value="0">非表示</option>
    </select>
    <input type="number" class="menu-sort" value="9999" placeholder="順番">

    <input type="hidden" class="menu-key-jp-hidden" value="">
    <input type="hidden" class="menu-required-flag" value="0">
  `;
  wrap.appendChild(row);
  bindMenuAdminRowEvents();
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
    reservations = data.reservations || [];
    const blocks = data.blocks || [];

    rebuildBlockedSlotsFromSheet(blocks);
    rebuildReservedSlotsFromReservations(reservations);

    applyConfigToUI();
    renderMenuAdminList();
    updateStats();
  }catch(e){
    if (showToastOnFail) toast(e?.message || '通信エラー（データ取得）');
    throw e;
  }
}

async function refreshAllData(showToastOnFail=false){
  await refreshData(showToastOnFail);
}

function applyConfigToUI(){
  if (document.getElementById('cfgLogoText')) document.getElementById('cfgLogoText').value = config.logo_text || config.main_title || '';
  if (document.getElementById('cfgLogoSubtext')) document.getElementById('cfgLogoSubtext').value = config.logo_subtext || '';
  if (document.getElementById('cfgLogoImageUrl')) document.getElementById('cfgLogoImageUrl').value = config.logo_image_url || '';
  if (document.getElementById('cfgLogoDriveFileId')) document.getElementById('cfgLogoDriveFileId').value = config.logo_drive_file_id || '';
  if (document.getElementById('cfgLogoUseDriveImage')) document.getElementById('cfgLogoUseDriveImage').value = String(config.logo_use_drive_image || '0');
  if (document.getElementById('cfgPhoneNotifyText')) document.getElementById('cfgPhoneNotifyText').value = config.phone_notify_text || '';
  if (document.getElementById('cfgSameDayEnabled')) document.getElementById('cfgSameDayEnabled').value = String(config.same_day_enabled || '0');
  if (document.getElementById('cfgSameDayMinHours')) document.getElementById('cfgSameDayMinHours').value = String(config.same_day_min_hours || '3');

  updateLogoPreview();
}

async function updateLogoPreview(){
  const previewImg = document.getElementById('adminLogoPreview');
  const previewText = document.getElementById('adminLogoPreviewText');
  const previewSubText = document.getElementById('adminLogoPreviewSubtext');

  const logoText = config.logo_text || config.main_title || defaultConfig.main_title;
  const logoSubText = config.logo_subtext || defaultConfig.logo_subtext;

  if (previewText) previewText.textContent = logoText;
  if (previewSubText) previewSubText.textContent = logoSubText;

  let finalSrc = config.logo_image_url || 'https://raw.githubusercontent.com/infochibafukushi-dotcom/chiba-care-taxi-assets/main/logo.png';

  const useDrive = String(config.logo_use_drive_image || '0') === '1';
  const driveFileId = String(config.logo_drive_file_id || '').trim();

  if (useDrive && driveFileId) {
    try{
      const res = await gsRun('api_getDriveImageDataUrl', driveFileId);
      if (res && res.isOk && res.data && res.data.dataUrl) {
        finalSrc = res.data.dataUrl;
      }
    }catch(_){}
  }

  if (previewImg) previewImg.src = finalSrc;
}

async function saveLogoConfig(){
  const payload = {
    logo_text: document.getElementById('cfgLogoText').value.trim(),
    logo_subtext: document.getElementById('cfgLogoSubtext').value.trim(),
    logo_image_url: document.getElementById('cfgLogoImageUrl').value.trim(),
    logo_drive_file_id: document.getElementById('cfgLogoDriveFileId').value.trim(),
    logo_use_drive_image: document.getElementById('cfgLogoUseDriveImage').value,
    phone_notify_text: document.getElementById('cfgPhoneNotifyText').value.trim(),
    main_title: document.getElementById('cfgLogoText').value.trim()
  };

  await withLoading(async ()=>{
    await gsRun('api_saveConfig', payload);
    await refreshAllData(true);
    renderCalendar();
  }, '保存中...');
}

async function saveSameDayConfig(){
  const payload = {
    same_day_enabled: document.getElementById('cfgSameDayEnabled').value,
    same_day_min_hours: document.getElementById('cfgSameDayMinHours').value
  };

  await withLoading(async ()=>{
    await gsRun('api_saveConfig', payload);
    await refreshAllData(true);
    renderCalendar();
  }, '保存中...');
}

async function saveMenuMaster(){
  const items = collectMenuAdminList();
  await withLoading(async ()=>{
    await gsRun('api_saveMenuMaster', items);
    await refreshAllData(true);
    renderCalendar();
  }, '保存中...');
}

function fileToDataUrl(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadLogoImageFromFile(){
  const input = document.getElementById('logoFileInput');
  const statusEl = document.getElementById('logoUploadStatus');
  if (!input || !input.files || !input.files[0]) {
    toast('画像ファイルを選択してください');
    if (statusEl){
      statusEl.textContent = '画像ファイルを選択してください';
      statusEl.className = 'small-status ng';
    }
    return;
  }

  const file = input.files[0];

  try{
    if (statusEl){
      statusEl.textContent = 'アップロード中...';
      statusEl.className = 'small-status';
    }

    const dataUrl = await fileToDataUrl(file);
    const payload = {
      file_name: file.name || ('logo_' + Date.now() + '.png'),
      mime_type: file.type || 'image/png',
      base64_data: dataUrl
    };

    await withLoading(async ()=>{
      await gsRun('api_uploadLogoImage', payload);
      await refreshAllData(true);
      renderCalendar();
    }, 'ロゴ画像アップロード中...');

    if (statusEl){
      statusEl.textContent = 'アップロードが完了しました';
      statusEl.className = 'small-status ok';
    }

    toast('ロゴ画像をアップロードしました', 1600);
    input.value = '';

  }catch(e){
    if (statusEl){
      statusEl.textContent = e?.message || 'アップロードに失敗しました';
      statusEl.className = 'small-status ng';
    }
    toast(e?.message || 'アップロードに失敗しました');
  }
}

async function changeAdminPassword(){
  const currentPassword = document.getElementById('cfgCurrentPassword').value.trim();
  const newPassword = document.getElementById('cfgNewPassword').value.trim();
  const confirmPassword = document.getElementById('cfgConfirmPassword').value.trim();
  const statusEl = document.getElementById('passwordChangeStatus');

  try{
    if (statusEl){
      statusEl.textContent = '';
      statusEl.className = 'small-status';
    }

    await withLoading(async ()=>{
      await gsRun('api_changeAdminPassword', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      });
    }, 'パスワード変更中...');

    document.getElementById('cfgCurrentPassword').value = '';
    document.getElementById('cfgNewPassword').value = '';
    document.getElementById('cfgConfirmPassword').value = '';

    if (statusEl){
      statusEl.textContent = 'パスワードを変更しました';
      statusEl.className = 'small-status ok';
    }

    toast('パスワードを変更しました', 1600);
  }catch(e){
    if (statusEl){
      statusEl.textContent = e?.message || 'パスワード変更に失敗しました';
      statusEl.className = 'small-status ng';
    }
    toast(e?.message || 'パスワード変更に失敗しました');
  }
}

function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitAndRefresh_(waitMs){
  await sleep(waitMs || 700);
  await refreshAllData(true);
}

function escapeHtml(str){
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str){
  return escapeHtml(str);
}

function debounce(fn, ms){
  let t = null;
  return (...args)=>{
    clearTimeout(t);
    t = setTimeout(()=>fn(...args), ms);
  };
}

async function init(){
  if (!isAdminAuthenticated()){
    document.getElementById('authScreen').classList.remove('hidden');
    return;
  }

  document.getElementById('adminView').classList.remove('hidden');

  try{
    await withLoading(async ()=>{
      try{ await refreshAllData(true); }catch(e){}
      try{ bindGridDelegation(); }catch(e){}
      try{ bindSheetRowClick(); }catch(e){}
      try{ renderCalendar(); }catch(e){
        toast('カレンダー描画エラー: ' + (e?.message || e));
      }
    }, '読み込み中...');
  }catch(e){
    try{ showLoading(false); }catch(_){}
    toast('初期化エラー: ' + (e?.message || e));
    try{ renderCalendar(); }catch(_){}
  }
}

(function bindUI(){
  document.getElementById('goPublicPageBtn').addEventListener('click', ()=>{
    window.location.href = PUBLIC_PAGE_URL;
  });

  document.getElementById('goPublicPageTopBtn').addEventListener('click', ()=>{
    window.location.href = PUBLIC_PAGE_URL;
  });

  document.getElementById('openSheetBtn').addEventListener('click', async ()=>{
    try{
      await withLoading(async ()=>{
        await refreshAllData(true);
        renderSheetView();
        updateStats();
      }, '読み込み中...');
      document.getElementById('sheetModal').classList.remove('hidden');
    }catch(_){
      toast('通信エラー（予約一覧）');
    }
  });

  document.getElementById('closeSheet').addEventListener('click', ()=> document.getElementById('sheetModal').classList.add('hidden'));
  document.getElementById('closeDetail').addEventListener('click', ()=> document.getElementById('detailModal').classList.add('hidden'));

  document.getElementById('updateStatus').addEventListener('click', updateReservationStatus);
  document.getElementById('hideReservation').addEventListener('click', hideSelectedReservation);

  document.getElementById('logoutAdmin').addEventListener('click', ()=>{
    clearAdminAuth();
    window.location.href = PUBLIC_PAGE_URL;
  });

  document.getElementById('saveLogoConfigBtn').addEventListener('click', async ()=>{
    try{
      await saveLogoConfig();
      toast('ロゴ設定を保存しました', 1400);
    }catch(_){}
  });

  document.getElementById('uploadLogoBtn').addEventListener('click', async ()=>{
    await uploadLogoImageFromFile();
  });

  document.getElementById('changePasswordBtn').addEventListener('click', async ()=>{
    await changeAdminPassword();
  });

  document.getElementById('saveSameDayConfigBtn').addEventListener('click', async ()=>{
    try{
      await saveSameDayConfig();
      toast('当日予約設定を保存しました', 1400);
    }catch(_){}
  });

  document.getElementById('saveMenuMasterBtn').addEventListener('click', async ()=>{
    try{
      await saveMenuMaster();
      toast('メニューを保存しました', 1400);
    }catch(_){}
  });

  document.getElementById('addMenuItemBtn').addEventListener('click', ()=>{
    addMenuAdminRow();
  });

  ['cfgLogoText','cfgLogoSubtext','cfgLogoImageUrl','cfgLogoDriveFileId','cfgLogoUseDriveImage'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', async ()=>{
      config.logo_text = document.getElementById('cfgLogoText').value.trim();
      config.logo_subtext = document.getElementById('cfgLogoSubtext').value.trim();
      config.logo_image_url = document.getElementById('cfgLogoImageUrl').value.trim();
      config.logo_drive_file_id = document.getElementById('cfgLogoDriveFileId').value.trim();
      config.logo_use_drive_image = document.getElementById('cfgLogoUseDriveImage').value;
      await updateLogoPreview();
    });
    el.addEventListener('change', async ()=>{
      config.logo_text = document.getElementById('cfgLogoText').value.trim();
      config.logo_subtext = document.getElementById('cfgLogoSubtext').value.trim();
      config.logo_image_url = document.getElementById('cfgLogoImageUrl').value.trim();
      config.logo_drive_file_id = document.getElementById('cfgLogoDriveFileId').value.trim();
      config.logo_use_drive_image = document.getElementById('cfgLogoUseDriveImage').value;
      await updateLogoPreview();
    });
  });

  document.getElementById('logoFileInput').addEventListener('change', async ()=>{
    const input = document.getElementById('logoFileInput');
    const statusEl = document.getElementById('logoUploadStatus');
    if (input && input.files && input.files[0]) {
      if (statusEl){
        statusEl.textContent = `選択中: ${input.files[0].name}`;
        statusEl.className = 'small-status';
      }

      try{
        const dataUrl = await fileToDataUrl(input.files[0]);
        const previewImg = document.getElementById('adminLogoPreview');
        if (previewImg) previewImg.src = dataUrl;
      }catch(_){}
    }
  });

  window.addEventListener('resize', debounce(()=>{
    try{
      renderCalendar();
    }catch(_){}
  }, 150));
})();

init();
