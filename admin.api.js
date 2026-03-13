const GAS_URL = "https://script.google.com/macros/s/AKfycbzrwIdc_qyVqSPpd8mlmC2OtmjVb0w-0rp_McUqFRQcI7gRe6RdAdDqfdSr4LipKUYLLg/exec";
const PUBLIC_PAGE_URL = "index.html";

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

function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

function _jsonpCall(url, timeoutMs = 20000){
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
    }, timeoutMs);

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

async function _jsonpCallWithRetry(url, retryCount = 1, timeoutMs = 20000){
  let lastError = null;
  for (let i = 0; i <= retryCount; i++){
    try{
      return await _jsonpCall(url, timeoutMs);
    }catch(err){
      lastError = err;
      if (i < retryCount){
        await sleep(600);
      }
    }
  }
  throw lastError || new Error('JSONP error');
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
      data = await _jsonpCallWithRetry(`${GAS_URL}?action=getConfig`, 1, 20000);
    } else if (func === 'api_getInitData') {
      data = await _jsonpCallWithRetry(`${GAS_URL}?action=getInitData`, 1, 25000);
    } else if (func === 'api_getMenuMaster') {
      data = await _jsonpCallWithRetry(`${GAS_URL}?action=getMenuMaster`, 1, 20000);
    } else if (func === 'api_getMenuKeyCatalog') {
      data = await _jsonpCallWithRetry(`${GAS_URL}?action=getMenuKeyCatalog`, 1, 20000);
    } else if (func === 'api_getMenuGroupCatalog') {
      data = await _jsonpCallWithRetry(`${GAS_URL}?action=getMenuGroupCatalog`, 1, 20000);
    } else if (func === 'api_getAutoRuleCatalog') {
      data = await _jsonpCallWithRetry(`${GAS_URL}?action=getAutoRuleCatalog`, 1, 20000);
    } else if (func === 'api_getDriveImageDataUrl') {
      const fileId = args[0];
      data = await _jsonpCallWithRetry(`${GAS_URL}?action=getDriveImageDataUrl&fileId=${encodeURIComponent(fileId)}`, 1, 20000);
    } else if (func === 'api_saveConfig') {
      data = await _postJson('saveConfig', args[0]);
    } else if (func === 'api_saveMenuMaster') {
      data = await _postJson('saveMenuMaster', args[0]);
    } else if (func === 'api_upsertMenuItem') {
      data = await _postJson('upsertMenuItem', args[0]);
    } else if (func === 'api_toggleMenuItemVisible') {
      data = await _postJson('toggleMenuItemVisible', args[0]);
    } else if (func === 'api_uploadLogoImage') {
      data = await _postJson('uploadLogoImage', args[0]);
    } else if (func === 'api_changeAdminPassword') {
      data = await _postJson('changeAdminPassword', args[0]);
    } else if (func === 'api_updateReservation') {
      data = await _postJson('updateReservation', args[0]);
    } else if (func === 'api_toggleBlock') {
      data = await _postJson('toggleBlock', args[0]);
    } else if (func === 'api_toggleEntireDay') {
      data = await _postJson('toggleEntireDay', args[0]);
    } else if (func === 'api_setRegularDayBlocked') {
      data = await _postJson('setRegularDayBlocked', args[0]);
    } else if (func === 'api_setOtherTimeDayBlocked') {
      data = await _postJson('setOtherTimeDayBlocked', args[0]);
    } else {
      throw new Error(`未対応のAPIです: ${func}`);
    }

    if (data && data.isOk === false) {
      const msg = data.error || data.message || '通信エラー（isOk=false）';
      throw new Error(msg);
    }

    return data;
  }catch(e){
    throw new Error(e?.message || '通信エラー');
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

function formatDate(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['日','月','火','水','木','金','土'];
  return `${month}/${day}(${weekdays[date.getDay()]})`;
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

let adminConfig = {};
let adminReservations = [];
let adminMenuMaster = [];
let adminMenuKeyCatalog = [];
let adminMenuGroupCatalog = [];
let adminAutoRuleCatalog = [];
let adminBlocks = [];
let adminBlockedSlots = new Set();
let adminReservedSlots = new Set();
let adminCalendarDates = [];
let currentDetailReservationId = '';
let hasBoundAdminGridDelegation = false;

const adminDefaultConfig = {
  main_title: '介護タクシー予約',
  logo_text: '介護タクシー予約',
  logo_subtext: '丁寧・安全な送迎をご提供します',
  logo_image_url: '',
  logo_use_github_image: '1',
  logo_github_path: 'logo/logo.png',
  github_username: '',
  github_repo: '',
  github_branch: 'main',
  github_token: '',
  github_assets_base_path: '',
  phone_notify_text: '090-6331-4289',
  same_day_enabled: '0',
  same_day_min_hours: '3',
  admin_panels_collapsed_default: '1'
};

const adminDefaultMenuGroupCatalog = [
  { key: 'price', label: '料金概算（基本料金）' },
  { key: 'assistance', label: '介助内容' },
  { key: 'stair', label: '階段介助' },
  { key: 'equipment', label: '機材レンタル' },
  { key: 'round_trip', label: '往復送迎' },
  { key: 'custom', label: 'その他（表示先なし）' }
];

function getAdminMenuMap(){
  const map = {};
  (adminMenuMaster || []).forEach(item => {
    map[item.key] = item;
  });
  return map;
}

function findAdminCatalogByKey(key){
  return (adminMenuKeyCatalog || []).find(item => String(item.key || '') === String(key || '')) || null;
}

function getAdminItemsByGroup(group){
  return (adminMenuMaster || []).filter(item => String(item.menu_group || '') === String(group || ''))
    .sort((a,b)=>{
      const ao = Number(a.sort_order || 9999);
      const bo = Number(b.sort_order || 9999);
      if (ao !== bo) return ao - bo;
      return String(a.key).localeCompare(String(b.key));
    });
}

function rebuildAdminBlockedSlotsFromSheet(blocks){
  adminBlockedSlots = new Set();
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

    if (!date || Number.isNaN(hour)) return;
    if (Number.isNaN(minute)) minute = 0;

    adminBlockedSlots.add(`${date}-${hour}-${minute}`);
  });
}

function adminReservationBlockSlots(r){
  const rt = String(r?.round_trip || '').trim();
  if (rt === '待機' || rt === '病院付き添い') return 4;
  return 2;
}

function rebuildAdminReservedSlotsFromReservations(list){
  adminReservedSlots = new Set();
  (list || []).forEach(r=>{
    if (r.is_visible === false || r.is_visible === 'FALSE') return;
    if (r.status === 'キャンセル') return;

    const d = normalizeDateToYMD(r.slot_date);
    const h = Number(r.slot_hour);
    const m = Number(r.slot_minute || 0);
    if (!d || Number.isNaN(h) || Number.isNaN(m)) return;

    const start = new Date(`${d}T00:00:00`);
    start.setHours(h, m, 0, 0);

    const slots = adminReservationBlockSlots(r);
    for (let i=0;i<slots;i++){
      const dt = new Date(start.getTime() + i * 30 * 60 * 1000);
      adminReservedSlots.add(`${ymdLocal(dt)}-${dt.getHours()}-${dt.getMinutes()}`);
    }
  });
}

function adminIsSlotBlocked(dateObj, hour, minute) {
  const key = `${ymdLocal(dateObj)}-${hour}-${minute}`;
  return adminBlockedSlots.has(key) || adminReservedSlots.has(key);
}

function getAdminDatesRange(){
  const today = new Date();
  today.setHours(0,0,0,0);

  const maxForwardDays = Number(adminConfig.max_forward_days || 30);
  const startOffset = String(adminConfig.same_day_enabled || '0') === '1' ? 0 : 1;
  const dates = [];

  for (let i=0;i<maxForwardDays;i++){
    const dt = new Date(today);
    dt.setDate(today.getDate() + startOffset + i);
    dates.push(dt);
  }
  return dates;
}

function buildAdminSlots(){
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

function arrayBufferToBase64(buffer){
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++){
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function readFileAsDataUrl(file){
  const buffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  return `data:${file.type || 'application/octet-stream'};base64,${base64}`;
}

async function adminRefreshAllData(showToastOnFail=false){
  try{
    const initRes = await gsRun('api_getInitData');
    if (!initRes || !initRes.isOk) throw new Error('init failed');

    const data = initRes.data || {};
    adminConfig = { ...adminDefaultConfig, ...(data.config || {}) };
    adminReservations = Array.isArray(data.reservations) ? data.reservations : [];
    adminMenuMaster = Array.isArray(data.menu_master) ? data.menu_master : [];
    adminMenuKeyCatalog = Array.isArray(data.menu_key_catalog) ? data.menu_key_catalog : [];
    adminMenuGroupCatalog = Array.isArray(data.menu_group_catalog) && data.menu_group_catalog.length ? data.menu_group_catalog : adminDefaultMenuGroupCatalog;
    adminAutoRuleCatalog = Array.isArray(data.auto_rule_catalog) ? data.auto_rule_catalog : [];
    adminBlocks = Array.isArray(data.blocks) ? data.blocks : [];

    rebuildAdminBlockedSlotsFromSheet(adminBlocks);
    rebuildAdminReservedSlotsFromReservations(adminReservations);
  }catch(e){
    if (showToastOnFail) toast(e?.message || '通信エラー（データ取得）');
    throw e;
  }
}
