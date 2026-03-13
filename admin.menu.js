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

function adminNormalizeMenuRows(){
  return (adminMenuMaster || []).map((item, idx) => {
    const clone = JSON.parse(JSON.stringify(item || {}));
    clone.key = makeMenuInternalKey(clone, idx);
    clone.key_jp = String(clone.key_jp || '');
    clone.label = String(clone.label || '');
    clone.price = Number(clone.price || 0);
    clone.note = String(clone.note || '');
    clone.menu_group = String(clone.menu_group || 'custom');
    clone.sort_order = Number(clone.sort_order || ((idx + 1) * 10));
    clone.is_visible = !(clone.is_visible === false || String(clone.is_visible).toUpperCase() === 'FALSE');
    clone.required_flag = !!clone.required_flag;
    clone.auto_apply_group = String(clone.auto_apply_group || '');
    clone.auto_apply_key = String(clone.auto_apply_key || '');
    return clone;
  });
}

function renderMenuAdminList(){
  const wrap = document.getElementById('menuAdminList');
  if (!wrap) return;

  adminMenuMaster = adminNormalizeMenuRows();

  wrap.innerHTML = (adminMenuMaster || []).map((item, idx) => {
    const autoOptions = buildMenuAutoApplyOptions(item.auto_apply_group || '', item.auto_apply_key || '');

    return `
      <div class="menu-card" data-menu-index="${idx}">
        <div class="menu-card-left">
          <button class="move-btn" data-action="menuUp" data-index="${idx}" type="button">↑</button>
          <button class="move-btn" data-action="menuDown" data-index="${idx}" type="button">↓</button>
        </div>

        <div>
          <div class="menu-card-grid">
            <div class="form-group">
              <label class="form-label">どこのプルダウン</label>
              <select data-field="menu_group" data-index="${idx}">
                ${ADMIN_MENU_GROUPS.map(g => `<option value="${escapeHtml(g.key)}" ${String(item.menu_group || '') === String(g.key) ? 'selected' : ''}>${escapeHtml(g.label)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">項目名</label>
              <input type="text" value="${escapeHtml(item.label || '')}" data-field="label" data-index="${idx}" placeholder="例: テスト">
            </div>

            <div class="form-group">
              <label class="form-label">価格</label>
              <input type="number" value="${Number(item.price || 0)}" data-field="price" data-index="${idx}" placeholder="0">
            </div>

            <div class="form-group">
              <label class="form-label">表示切替</label>
              <select data-field="is_visible" data-index="${idx}">
                <option value="1" ${item.is_visible ? 'selected' : ''}>表示</option>
                <option value="0" ${!item.is_visible ? 'selected' : ''}>非表示</option>
              </select>
            </div>
          </div>

          <div class="menu-card-grid-bottom">
            <div class="form-group">
              <label class="form-label">自動セット先</label>
              <select data-field="auto_apply_group" data-index="${idx}" class="menu-auto-group">
                ${autoOptions.groupOptions}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">自動セット項目</label>
              <select data-field="auto_apply_key" data-index="${idx}" class="menu-auto-key">
                ${autoOptions.keyOptions}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">内部キー</label>
              <input type="text" value="${escapeHtml(item.key || '')}" data-field="key" data-index="${idx}" placeholder="自動生成">
            </div>

            <div class="form-group">
              <label class="form-label">説明</label>
              <input type="text" value="${escapeHtml(item.note || '')}" data-field="note" data-index="${idx}" placeholder="補足説明">
            </div>
          </div>

          <div class="menu-card-meta">
            表示位置: <strong>${escapeHtml(getAdminGroupLabel(item.menu_group || 'custom'))}</strong>
            ／ 並び順: <strong>${Number(item.sort_order || 0)}</strong>
            ／ 日本語キー: <strong>${escapeHtml(item.key_jp || '') || '未設定'}</strong>
          </div>

          <div class="menu-inline-actions">
            <button class="cute-btn px-4 py-2 menu-remove-btn" data-action="menuRemove" data-index="${idx}" type="button">削除</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function resequenceMenuSortOrder(){
  adminMenuMaster.forEach((item, idx) => {
    item.sort_order = (idx + 1) * 10;
  });
}

function addMenuItemRow(){
  adminMenuMaster.push({
    key: '',
    key_jp: '',
    label: '',
    price: 0,
    note: '',
    is_visible: true,
    sort_order: (adminMenuMaster.length + 1) * 10,
    menu_group: 'custom',
    required_flag: false,
    auto_apply_group: '',
    auto_apply_key: ''
  });
  renderMenuAdminList();
}

function bindMenuEvents(){
  const wrap = document.getElementById('menuAdminList');
  if (!wrap) return;

  wrap.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const idx = Number(btn.dataset.index);
    const action = btn.dataset.action;

    if (action === 'menuUp' && idx > 0){
      const tmp = adminMenuMaster[idx - 1];
      adminMenuMaster[idx - 1] = adminMenuMaster[idx];
      adminMenuMaster[idx] = tmp;
      resequenceMenuSortOrder();
      renderMenuAdminList();
    }

    if (action === 'menuDown' && idx < adminMenuMaster.length - 1){
      const tmp = adminMenuMaster[idx + 1];
      adminMenuMaster[idx + 1] = adminMenuMaster[idx];
      adminMenuMaster[idx] = tmp;
      resequenceMenuSortOrder();
      renderMenuAdminList();
    }

    if (action === 'menuRemove'){
      adminMenuMaster.splice(idx, 1);
      resequenceMenuSortOrder();
      renderMenuAdminList();
    }
  });

  wrap.addEventListener('input', (e)=>{
    const el = e.target;
    const idx = Number(el.dataset.index);
    const field = String(el.dataset.field || '');
    if (Number.isNaN(idx) || !field || !adminMenuMaster[idx]) return;

    if (field === 'price'){
      adminMenuMaster[idx][field] = Number(el.value || 0);
    } else {
      adminMenuMaster[idx][field] = el.value;
    }

    if (field === 'label' && !String(adminMenuMaster[idx].key || '').trim()){
      adminMenuMaster[idx].key = makeMenuInternalKey(adminMenuMaster[idx], idx);
    }
  });

  wrap.addEventListener('change', (e)=>{
    const el = e.target;
    const idx = Number(el.dataset.index);
    const field = String(el.dataset.field || '');
    if (Number.isNaN(idx) || !field || !adminMenuMaster[idx]) return;

    if (field === 'is_visible'){
      adminMenuMaster[idx][field] = String(el.value) === '1';
    } else {
      adminMenuMaster[idx][field] = el.value;
    }

    if (field === 'menu_group' && !String(adminMenuMaster[idx].key || '').trim()){
      adminMenuMaster[idx].key = makeMenuInternalKey(adminMenuMaster[idx], idx);
    }

    if (field === 'auto_apply_group'){
      adminMenuMaster[idx].auto_apply_key = '';
      renderMenuAdminList();
    }
  });
}

function buildSaveMenuPayload(){
  resequenceMenuSortOrder();

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
