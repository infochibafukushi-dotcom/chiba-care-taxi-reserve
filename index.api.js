const ADMIN_ICON_FILE_ID = '1a0QB8ei00w_lSfL4PnF_xuEFUC2JP6FW';
const GAS_URL = "https://script.google.com/macros/s/AKfycby1DMJIAMChmBORN_zG9Qhu2NKRTXTzrOBvKaY2VsBCGa6OQj2ws8TfW1wCVwyqa4o-Ug/exec";
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
        await sleep(500);
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
    } else if (func === 'api_getConfigPublic') {
      data = await _jsonpCallWithRetry(`${GAS_URL}?action=getConfigPublic`, 1, 20000);
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
    } else if (func === 'api_createReservation') {
      data = await _postJson('createReservation', args[0]);
    } else if (func === 'api_verifyAdminPassword') {
      data = await _postJson('verifyAdminPassword', args[0]);
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

function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
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
let hasBoundGridDelegation = false;

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

function getMenuAutoApplyGroup(key){
  const map = getMenuMap();
  if (map[key] && map[key].auto_apply_group !== undefined) return String(map[key].auto_apply_group || '');
  const catalog = findCatalogByKey(key);
  if (catalog && catalog.auto_apply_group !== undefined) return String(catalog.auto_apply_group || '');
  return '';
}

function getMenuAutoApplyKey(key){
  const map = getMenuMap();
  if (map[key] && map[key].auto_apply_key !== undefined) return String(map[key].auto_apply_key || '');
  const catalog = findCatalogByKey(key);
  if (catalog && catalog.auto_apply_key !== undefined) return String(catalog.auto_apply_key || '');
  return '';
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

function getAutoRuleByTrigger(targetGroup, triggerKey){
  return (autoRuleCatalog || []).find(rule => {
    if (!rule || !rule.enabled) return false;
    return String(rule.target || '') === String(targetGroup || '') && String(rule.trigger_key || '') === String(triggerKey || '');
  }) || null;
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

async function refreshConfigPublic(){
  const res = await gsRun('api_getConfigPublic');
  if (res && res.isOk){
    config = { ...defaultConfig, ...(res.data || {}) };
    applyConfigToUI();
  }
}

async function refreshData(showToastOnFail=false, options={}){
  try{
    const force = !!options.force;
    if (!force && __publicInitDataPromise){
      const initRes = await __publicInitDataPromise;
      return applyPublicInitData(initRes);
    }

    __publicInitDataPromise = gsRun('api_getInitData');
    const initRes = await __publicInitDataPromise;
    if (!initRes || !initRes.isOk) throw new Error('init failed');

    applyPublicInitData(initRes);
  }catch(e){
    if (showToastOnFail) toast(e?.message || '通信エラー（データ取得）');
    throw e;
  }finally{
    __publicInitDataPromise = null;
  }
}

function applyPublicInitData(initRes){
  if (!initRes || !initRes.isOk) throw new Error('init failed');

  const data = initRes.data || {};
  config = { ...defaultConfig, ...(data.config || config || {}) };
  menuMaster = Array.isArray(data.menu_master) ? data.menu_master : [];
  menuKeyCatalog = Array.isArray(data.menu_key_catalog) ? data.menu_key_catalog : [];
  menuGroupCatalog = Array.isArray(data.menu_group_catalog) && data.menu_group_catalog.length ? data.menu_group_catalog : defaultMenuGroupCatalog;
  autoRuleCatalog = Array.isArray(data.auto_rule_catalog) ? data.auto_rule_catalog : [];
  reservations = Array.isArray(data.reservations) ? data.reservations : [];
  const blocks = Array.isArray(data.blocks) ? data.blocks : [];

  rebuildBlockedSlotsFromSheet(blocks);
  rebuildReservedSlotsFromReservations(reservations);

  applyConfigToUI();
  renderServiceSelectors();
}

function addLocalReservationBlock(reservation){
  if (!reservation) return;
  reservations = Array.isArray(reservations) ? reservations.slice() : [];
  reservations.push({ ...reservation });
  rebuildReservedSlotsFromReservations(reservations);
}

async function refreshAllData(showToastOnFail=false, options={}){
  await refreshData(showToastOnFail, options);
}

