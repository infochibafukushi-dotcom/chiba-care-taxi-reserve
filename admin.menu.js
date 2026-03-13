const MENU_GROUP_ORDER = ['price', 'assistance', 'stair', 'equipment', 'round_trip', 'custom'];

function buildMenuAutoApplyOptions(selectedGroup, selectedKey){
  const groupOptions = [
    `<option value="">自動セットなし</option>`,
    `<option value="assistance" ${selectedGroup === 'assistance' ? 'selected' : ''}>介助内容</option>`,
    `<option value="equipment" ${selectedGroup === 'equipment' ? 'selected' : ''}>機材レンタル</option>`,
    `<option value="round_trip" ${selectedGroup === 'round_trip' ? 'selected' : ''}>往復送迎</option>`
  ].join('');

  let keyCandidates = [];
  if (selectedGroup) {
    keyCandidates = (adminMenuMaster || []).filter(item => String(item.menu_group || '') === String(selectedGroup || ''));
  }

  const keyOptions = [`<option value="">選択してください</option>`].concat(
    keyCandidates.map(item => `<option value="${escapeHtml(String(item.key || ''))}" ${String(item.key || '') === String(selectedKey || '') ? 'selected' : ''}>${escapeHtml(String(item.label || item.key || ''))}</option>`)
  ).join('');

  return { groupOptions, keyOptions };
}

function makeMenuInternalKey(row, index){
  const existing = String(row.key || '').trim();
  if (existing) return existing;

  const group = String(row.menu_group || 'custom').trim().toUpperCase();
  const label = String(row.label || 'ITEM').trim()
    .replace(/[　\s]+/g, '_')
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase() || 'ITEM';

  return `CUSTOM_${group}_${label}_${index + 1}`;
}

function normalizeGroupKey(group){
  const g = String(group || 'custom').trim();
  return MENU_GROUP_ORDER.includes(g) ? g : 'custom';
}

function adminNormalizeMenuRows(){
  return (adminMenuMaster || []).map((item, idx) => {
    const clone = JSON.parse(JSON.stringify(item || {}));
    clone.menu_group = normalizeGroupKey(clone.menu_group);
    clone.key = makeMenuInternalKey(clone, idx);
    clone.key_jp = String(clone.key_jp || '');
    clone.label = String(clone.label || '');
    clone.price = Number(clone.price || 0);
    clone.note = String(clone.note || '');
    clone.sort_order = Number(clone.sort_order || ((idx + 1) * 10));
    clone.is_visible = !(clone.is_visible === false || String(clone.is_visible).toUpperCase() === 'FALSE');
    clone.required_flag = !!clone.required_flag;
    clone.auto_apply_group = String(clone.auto_apply_group || '');
    clone.auto_apply_key = String(clone.auto_apply_key || '');
    return clone;
  });
}

function getMenuItemsByGroup(group){
  return (adminMenuMaster || [])
    .filter(item => String(item.menu_group || '') === String(group || ''))
    .sort((a, b) => Number(a.sort_order || 9999) - Number(b.sort_order || 9999));
}

function resequenceMenuSortOrderByGroup(){
  MENU_GROUP_ORDER.forEach(group => {
    const items = getMenuItemsByGroup(group);
    items.forEach((item, idx) => {
      item.sort_order = (idx + 1) * 10;
    });
  });
}

function getGroupDescription(group){
  if (group === 'price') return '料金概算の基本項目';
  if (group === 'assistance') return '予約フォームの「介助内容」';
  if (group === 'stair') return '予約フォームの「階段介助」';
  if (group === 'equipment') return '予約フォームの「機材レンタル」';
  if (group === 'round_trip') return '予約フォームの「往復送迎」';
  return '保存のみ';
}

function renderMenuItemCard(item, idx, groupItems){
  const autoOptions = buildMenuAutoApplyOptions(item.auto_apply_group || '', item.auto_apply_key || '');
  const groupIndex = groupItems.findIndex(x => String(x.key || '') === String(item.key || ''));

  return `
    <div class="menu-item-card" data-menu-key="${escapeHtml(item.key || '')}">
      <div class="menu-item-top">
        <div class="menu-move-box">
          <button class="move-btn" data-action="menuUp" data-key="${escapeHtml(item.key || '')}" type="button" ${groupIndex <= 0 ? 'disabled' : ''}>↑</button>
          <button class="move-btn" data-action="menuDown" data-key="${escapeHtml(item.key || '')}" type="button" ${groupIndex >= groupItems.length - 1 ? 'disabled' : ''}>↓</button>
        </div>

        <div class="flex-1">
          <div class="menu-item-main">
            <div class="form-group">
              <label class="form-label">項目名</label>
              <input type="text" value="${escapeHtml(item.label || '')}" data-field="label" data-key="${escapeHtml(item.key || '')}" placeholder="例: テスト">
            </div>

            <div class="form-group">
              <label class="form-label">価格</label>
              <input type="number" value="${Number(item.price || 0)}" data-field="price" data-key="${escapeHtml(item.key || '')}" placeholder="0">
            </div>

            <div class="form-group">
              <label class="form-label">表示切替</label>
              <select data-field="is_visible" data-key="${escapeHtml(item.key || '')}">
                <option value="1" ${item.is_visible ? 'selected' : ''}>表示</option>
                <option value="0" ${!item.is_visible ? 'selected' : ''}>非表示</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">説明</label>
              <input type="text" value="${escapeHtml(item.note || '')}" data-field="note" data-key="${escapeHtml(item.key || '')}" placeholder="補足説明">
            </div>
          </div>

          <div class="menu-item-bottom">
            <div class="form-group">
              <label class="form-label">自動セット先</label>
              <select data-field="auto_apply_group" data-key="${escapeHtml(item.key || '')}">
                ${autoOptions.groupOptions}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">自動セット項目</label>
              <select data-field="auto_apply_key" data-key="${escapeHtml(item.key || '')}">
                ${autoOptions.keyOptions}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">内部キー</label>
              <input type="text" value="${escapeHtml(item.key || '')}" data-field="key" data-key="${escapeHtml(item.key || '')}" placeholder="自動生成">
            </div>

            <div class="form-group">
              <label class="form-label">現在グループ</label>
              <input type="text" value="${escapeHtml(getAdminGroupLabel(item.menu_group || 'custom'))}" disabled>
            </div>
          </div>

          <div class="menu-meta">
            並び順: <strong>${Number(item.sort_order || 0)}</strong>
            ／ 日本語キー: <strong>${escapeHtml(item.key_jp || item.label || '未設定')}</strong>
            ／ 内部キーは保存用IDです
          </div>

          <div class="menu-inline-actions">
            <button class="cute-btn px-4 py-2 menu-remove-btn" data-action="menuRemove" data-key="${escapeHtml(item.key || '')}" type="button">削除</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMenuGroupCard(group){
  const items = getMenuItemsByGroup(group);

  return `
    <div class="menu-group-card" data-menu-group="${escapeHtml(group)}">
      <div class="menu-group-card-header">
        <div>
          <div class="menu-group-card-title">${escapeHtml(getAdminGroupLabel(group))}</div>
          <div class="menu-group-card-sub">${escapeHtml(getGroupDescription(group))}</div>
        </div>
        <div class="menu-add-row">
          <button class="cute-btn px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700" data-action="menuAddInGroup" data-group="${escapeHtml(group)}" type="button">
            このグループに追加
          </button>
        </div>
      </div>

      <div>
        ${items.length ? items.map(item => renderMenuItemCard(item, 0, items)).join('') : `
          <div class="text-sm text-slate-500 font-bold py-3">まだ項目がありません</div>
        `}
      </div>
    </div>
  `;
}

function renderMenuAdminList(){
  const wrap = document.getElementById('menuAdminList');
  if (!wrap) return;

  adminMenuMaster = adminNormalizeMenuRows();
  resequenceMenuSortOrderByGroup();

  wrap.innerHTML = MENU_GROUP_ORDER.map(group => renderMenuGroupCard(group)).join('');
}

function addMenuItemToGroup(group){
  const nextIndex = adminMenuMaster.length;
  adminMenuMaster.push({
    key: '',
    key_jp: '',
    label: '',
    price: 0,
    note: '',
    is_visible: true,
    sort_order: 9999,
    menu_group: normalizeGroupKey(group),
    required_flag: false,
    auto_apply_group: '',
    auto_apply_key: ''
  });

  adminMenuMaster = adminNormalizeMenuRows();
  adminMenuMaster[adminMenuMaster.length - 1].key = makeMenuInternalKey(adminMenuMaster[adminMenuMaster.length - 1], nextIndex);
  resequenceMenuSortOrderByGroup();
  renderMenuAdminList();
}

function findMenuIndexByKey(key){
  return adminMenuMaster.findIndex(item => String(item.key || '') === String(key || ''));
}

function moveMenuItemWithinGroup(key, direction){
  const idx = findMenuIndexByKey(key);
  if (idx < 0) return;

  const item = adminMenuMaster[idx];
  const group = String(item.menu_group || 'custom');
  const groupItems = getMenuItemsByGroup(group);
  const pos = groupItems.findIndex(x => String(x.key || '') === String(key || ''));
  if (pos < 0) return;

  if (direction === 'up' && pos > 0){
    const otherKey = groupItems[pos - 1].key;
    const otherIdx = findMenuIndexByKey(otherKey);
    const tmp = adminMenuMaster[idx];
    adminMenuMaster[idx] = adminMenuMaster[otherIdx];
    adminMenuMaster[otherIdx] = tmp;
  }

  if (direction === 'down' && pos < groupItems.length - 1){
    const otherKey = groupItems[pos + 1].key;
    const otherIdx = findMenuIndexByKey(otherKey);
    const tmp = adminMenuMaster[idx];
    adminMenuMaster[idx] = adminMenuMaster[otherIdx];
    adminMenuMaster[otherIdx] = tmp;
  }

  resequenceMenuSortOrderByGroup();
  renderMenuAdminList();
}

function bindMenuEvents(){
  const wrap = document.getElementById('menuAdminList');
  if (!wrap) return;

  wrap.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const key = String(btn.dataset.key || '');
    const group = String(btn.dataset.group || '');

    if (action === 'menuAddInGroup'){
      addMenuItemToGroup(group);
      return;
    }

    if (action === 'menuUp'){
      moveMenuItemWithinGroup(key, 'up');
      return;
    }

    if (action === 'menuDown'){
      moveMenuItemWithinGroup(key, 'down');
      return;
    }

    if (action === 'menuRemove'){
      const idx = findMenuIndexByKey(key);
      if (idx >= 0){
        adminMenuMaster.splice(idx, 1);
        resequenceMenuSortOrderByGroup();
        renderMenuAdminList();
      }
    }
  });

  wrap.addEventListener('input', (e)=>{
    const el = e.target;
    const key = String(el.dataset.key || '');
    const field = String(el.dataset.field || '');
    const idx = findMenuIndexByKey(key);
    if (idx < 0 || !field) return;

    if (field === 'price'){
      adminMenuMaster[idx][field] = Number(el.value || 0);
    } else if (field === 'key'){
      adminMenuMaster[idx][field] = String(el.value || '').trim();
    } else {
      adminMenuMaster[idx][field] = el.value;
    }

    if (field === 'label'){
      const currentKey = String(adminMenuMaster[idx].key || '');
      if (!currentKey || currentKey.startsWith('CUSTOM_')){
        adminMenuMaster[idx].key = makeMenuInternalKey(adminMenuMaster[idx], idx);
      }
    }
  });

  wrap.addEventListener('change', (e)=>{
    const el = e.target;
    const key = String(el.dataset.key || '');
    const field = String(el.dataset.field || '');
    const idx = findMenuIndexByKey(key);
    if (idx < 0 || !field) return;

    if (field === 'is_visible'){
      adminMenuMaster[idx][field] = String(el.value) === '1';
    } else {
      adminMenuMaster[idx][field] = el.value;
    }

    if (field === 'auto_apply_group'){
      adminMenuMaster[idx].auto_apply_key = '';
      renderMenuAdminList();
    }
  });
}

function buildSaveMenuPayload(){
  resequenceMenuSortOrderByGroup();

  return adminMenuMaster.map((item, idx) => {
    const label = String(item.label || '').trim();
    const group = String(item.menu_group || 'custom').trim() || 'custom';
    const key = String(item.key || '').trim() || makeMenuInternalKey(item, idx);

    let keyJp = String(item.key_jp || '').trim();
    if (!keyJp){
      const catalog = adminFindCatalogByKey(key);
      keyJp = catalog ? String(catalog.key_jp || '') : label;
    }

    return {
      key: key,
      key_jp: keyJp,
      label: label,
      price: Number(item.price || 0),
      note: String(item.note || '').trim(),
      is_visible: !(item.is_visible === false || String(item.is_visible).toUpperCase() === 'FALSE'),
      sort_order: Number(item.sort_order || ((idx + 1) * 10)),
      menu_group: group,
      required_flag: false,
      auto_apply_group: String(item.auto_apply_group || '').trim(),
      auto_apply_key: String(item.auto_apply_key || '').trim()
    };
  }).filter(item => String(item.label || '').trim());
}
