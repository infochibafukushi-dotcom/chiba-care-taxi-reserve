function checkAdminAuth(){
  const auth = sessionStorage.getItem('chiba_care_taxi_admin_auth');
  if (auth !== 'ok'){
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('adminView').classList.add('hidden');
    return false;
  }

  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('adminView').classList.remove('hidden');
  return true;
}

async function adminRefreshAllData(){
  const res = await gsRun('api_getInitData');
  const data = res.data || {};

  adminConfig = { ...ADMIN_DEFAULT_CONFIG, ...(data.config || {}) };
  adminReservations = Array.isArray(data.reservations) ? data.reservations : [];
  adminBlocks = Array.isArray(data.blocks) ? data.blocks : [];
  adminMenuMaster = Array.isArray(data.menu_master) ? data.menu_master : [];
  adminMenuKeyCatalog = Array.isArray(data.menu_key_catalog) ? data.menu_key_catalog : [];
  adminMenuGroupCatalog = Array.isArray(data.menu_group_catalog) && data.menu_group_catalog.length ? data.menu_group_catalog : ADMIN_MENU_GROUPS;
  adminAutoRuleCatalog = Array.isArray(data.auto_rule_catalog) ? data.auto_rule_catalog : [];

  buildAdminBlockedSlots(adminBlocks);
  buildAdminReservedSlots(adminReservations);

  applyAdminConfigToForm();
  renderAdminStats();
  renderMenuAdminList();
  renderAdminCalendar();
  renderReservationTable();
}

function renderAdminStats(){
  document.getElementById('totalReservations').textContent = String(adminReservations.length || 0);
  document.getElementById('pendingCount').textContent = String(adminReservations.filter(r => String(r.status || '未対応') === '未対応').length);
  document.getElementById('confirmedCount').textContent = String(adminReservations.filter(r => String(r.status || '') === '確認済').length);
  document.getElementById('completedCount').textContent = String(adminReservations.filter(r => String(r.status || '') === '完了').length);
}

function applyAdminConfigToForm(){
  document.getElementById('cfgLogoText').value = adminConfig.logo_text || '';
  document.getElementById('cfgLogoSubtext').value = adminConfig.logo_subtext || '';
  document.getElementById('cfgLogoImageUrl').value = adminConfig.logo_image_url || '';
  document.getElementById('cfgLogoUseGithubImage').value = String(adminConfig.logo_use_github_image || '1');
  document.getElementById('cfgGithubUsername').value = adminConfig.github_username || '';
  document.getElementById('cfgGithubRepo').value = adminConfig.github_repo || '';
  document.getElementById('cfgGithubBranch').value = adminConfig.github_branch || 'main';
  document.getElementById('cfgGithubAssetsBasePath').value = adminConfig.github_assets_base_path || '';
  document.getElementById('cfgLogoGithubPath').value = adminConfig.logo_github_path || '';
  document.getElementById('cfgGithubToken').value = adminConfig.github_token || '';
  document.getElementById('cfgPhoneNotifyText').value = adminConfig.phone_notify_text || '';

  document.getElementById('cfgWarningStairBodyAssistText').value = adminConfig.warning_stair_bodyassist_text || '';
  document.getElementById('cfgWarningWheelchairDamageText').value = adminConfig.warning_wheelchair_damage_text || '';
  document.getElementById('cfgWarningStretcherBodyAssistText').value = adminConfig.warning_stretcher_bodyassist_text || '';
  document.getElementById('cfgCompleteTitle').value = adminConfig.complete_title || '';

  document.getElementById('cfgSameDayEnabled').value = String(adminConfig.same_day_enabled || '0');
  document.getElementById('cfgSameDayMinHours').value = String(adminConfig.same_day_min_hours || '3');

  const img = document.getElementById('adminLogoPreview');
  const txt = document.getElementById('adminLogoPreviewText');
  const sub = document.getElementById('adminLogoPreviewSubtext');
  img.src = adminConfig.logo_image_url || 'https://raw.githubusercontent.com/infochibafukushi-dotcom/chiba-care-taxi-assets/main/logo.png';
  txt.textContent = adminConfig.logo_text || '介護タクシー予約';
  sub.textContent = adminConfig.logo_subtext || '丁寧・安全な送迎をご提供します';

  const toggleBtn = document.getElementById('toggleAdminTimeView');
  toggleBtn.textContent = adminExtendedView ? '通常時間表示' : '時間外表示';
}

function renderReservationTable(){
  const body = document.getElementById('sheetTableBody');
  if (!body) return;

  body.innerHTML = adminReservations.map((r, idx) => {
    const status = String(r.status || '未対応');
    return `
      <tr class="sheet-row-clickable ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}" data-reservation-index="${idx}">
        <td class="border border-slate-200 p-3">${escapeHtml(r.reservation_id || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.reservation_datetime || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.usage_type || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.customer_name || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.phone_number || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.pickup_location || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.destination || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.assistance_type || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.stair_assistance || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.equipment_rental || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.stretcher_two_staff || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.round_trip || '')}</td>
        <td class="border border-slate-200 p-3">${escapeHtml(r.notes || '')}</td>
        <td class="border border-slate-200 p-3">${Number(r.total_price || 0).toLocaleString()}円</td>
        <td class="border border-slate-200 p-3"><span class="badge ${getAdminStatusBadge(status)}">${escapeHtml(status)}</span></td>
        <td class="border border-slate-200 p-3"><button class="cute-btn px-3 py-2 bg-gradient-to-r from-sky-500 to-sky-600 text-white" data-action="openDetail" data-index="${idx}" type="button">詳細</button></td>
      </tr>
    `;
  }).join('');
}

function openReservationDetail(index){
  const r = adminReservations[index];
  if (!r) return;

  adminCurrentReservation = { ...r };

  document.getElementById('detailContent').innerHTML = `
    <div class="space-y-4 text-sm">
      <div><strong>予約ID:</strong> ${escapeHtml(r.reservation_id || '')}</div>
      <div><strong>予約日時:</strong> ${escapeHtml(r.reservation_datetime || '')}</div>
      <div><strong>ご利用区分:</strong> ${escapeHtml(r.usage_type || '')}</div>
      <div><strong>お名前:</strong> ${escapeHtml(r.customer_name || '')}</div>
      <div><strong>電話番号:</strong> ${escapeHtml(r.phone_number || '')}</div>
      <div><strong>お伺い場所:</strong> ${escapeHtml(r.pickup_location || '')}</div>
      <div><strong>送迎先:</strong> ${escapeHtml(r.destination || '')}</div>
      <div><strong>介助内容:</strong> ${escapeHtml(r.assistance_type || '')}</div>
      <div><strong>階段介助:</strong> ${escapeHtml(r.stair_assistance || '')}</div>
      <div><strong>機材:</strong> ${escapeHtml(r.equipment_rental || '')}</div>
      <div><strong>2名体制:</strong> ${escapeHtml(r.stretcher_two_staff || '')}</div>
      <div><strong>往復:</strong> ${escapeHtml(r.round_trip || '')}</div>
      <div><strong>備考:</strong> ${escapeHtml(r.notes || '')}</div>
      <div><strong>料金:</strong> ${Number(r.total_price || 0).toLocaleString()}円</div>
    </div>
  `;

  document.getElementById('statusSelect').value = String(r.status || '未対応');
  document.getElementById('detailModal').classList.remove('hidden');
}

function collectLogoConfigPayload(){
  return {
    logo_text: document.getElementById('cfgLogoText').value.trim(),
    logo_subtext: document.getElementById('cfgLogoSubtext').value.trim(),
    logo_image_url: document.getElementById('cfgLogoImageUrl').value.trim(),
    logo_use_github_image: document.getElementById('cfgLogoUseGithubImage').value,
    github_username: document.getElementById('cfgGithubUsername').value.trim(),
    github_repo: document.getElementById('cfgGithubRepo').value.trim(),
    github_branch: document.getElementById('cfgGithubBranch').value.trim(),
    github_assets_base_path: document.getElementById('cfgGithubAssetsBasePath').value.trim(),
    logo_github_path: document.getElementById('cfgLogoGithubPath').value.trim(),
    github_token: document.getElementById('cfgGithubToken').value.trim(),
    phone_notify_text: document.getElementById('cfgPhoneNotifyText').value.trim()
  };
}

function collectWarningConfigPayload(){
  return {
    warning_stair_bodyassist_text: document.getElementById('cfgWarningStairBodyAssistText').value.trim(),
    warning_wheelchair_damage_text: document.getElementById('cfgWarningWheelchairDamageText').value.trim(),
    warning_stretcher_bodyassist_text: document.getElementById('cfgWarningStretcherBodyAssistText').value.trim(),
    complete_title: document.getElementById('cfgCompleteTitle').value.trim()
  };
}

function collectSameDayPayload(){
  return {
    same_day_enabled: document.getElementById('cfgSameDayEnabled').value,
    same_day_min_hours: document.getElementById('cfgSameDayMinHours').value
  };
}

async function uploadLogoFile(){
  const fileInput = document.getElementById('logoFileInput');
  const file = fileInput.files && fileInput.files[0];
  const status = document.getElementById('logoUploadStatus');

  if (!file){
    status.className = 'small-status ng';
    status.textContent = 'ファイルを選択してください';
    return;
  }

  const base64Data = await new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(String(reader.result || ''));
    reader.onerror = ()=> reject(new Error('画像読込に失敗しました'));
    reader.readAsDataURL(file);
  });

  const payload = {
    file_name: file.name,
    mime_type: file.type || 'image/png',
    base64_data: base64Data
  };

  const res = await withLoading(async ()=>{
    return await gsRun('api_uploadLogoImage', payload);
  }, 'ロゴ画像アップロード中...');

  status.className = 'small-status ok';
  status.textContent = 'アップロード完了';

  if (res && res.data && res.data.raw_url){
    document.getElementById('cfgLogoImageUrl').value = res.data.raw_url;
    document.getElementById('adminLogoPreview').src = res.data.raw_url;
  }
}

function bindPanelToggles(){
  document.querySelectorAll('[data-panel-toggle]').forEach(btn => {
    btn.addEventListener('click', ()=>{
      const key = btn.dataset.panelToggle;
      const body = document.getElementById(key + 'Body');
      if (!body) return;
      const collapsed = body.classList.toggle('collapsed');
      btn.textContent = collapsed ? '＋' : '−';
    });
  });
}

function bindReservationTableEvents(){
  const body = document.getElementById('sheetTableBody');
  if (!body) return;

  body.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-action="openDetail"]');
    if (btn){
      openReservationDetail(Number(btn.dataset.index));
      return;
    }

    const tr = e.target.closest('[data-reservation-index]');
    if (tr){
      openReservationDetail(Number(tr.dataset.reservationIndex));
    }
  });
}

async function saveStatusUpdate(hideOnly = false){
  if (!adminCurrentReservation) return;

  const payload = { ...adminCurrentReservation };
  if (hideOnly){
    payload.is_visible = false;
  } else {
    payload.status = document.getElementById('statusSelect').value;
  }

  await withLoading(async ()=>{
    await gsRun('api_updateReservation', payload);
    await adminRefreshAllData();
  }, '予約を更新中...');

  document.getElementById('detailModal').classList.add('hidden');
}

function bindUI(){
  document.getElementById('goPublicPageBtn').addEventListener('click', ()=>{
    window.location.href = PUBLIC_PAGE_URL;
  });

  document.getElementById('goPublicPageTopBtn').addEventListener('click', ()=>{
    window.location.href = PUBLIC_PAGE_URL;
  });

  document.getElementById('logoutAdmin').addEventListener('click', ()=>{
    sessionStorage.removeItem('chiba_care_taxi_admin_auth');
    sessionStorage.removeItem('chiba_care_taxi_admin_auth_time');
    window.location.href = PUBLIC_PAGE_URL;
  });

  document.getElementById('toggleAdminTimeView').addEventListener('click', ()=>{
    adminExtendedView = !adminExtendedView;
    document.getElementById('toggleAdminTimeView').textContent = adminExtendedView ? '通常時間表示' : '時間外表示';
    renderAdminCalendar();
  });

  document.getElementById('openSheetBtn').addEventListener('click', ()=>{
    document.getElementById('sheetModal').classList.remove('hidden');
  });
  document.getElementById('closeSheet').addEventListener('click', ()=>{
    document.getElementById('sheetModal').classList.add('hidden');
  });

  document.getElementById('closeDetail').addEventListener('click', ()=>{
    document.getElementById('detailModal').classList.add('hidden');
  });

  document.getElementById('updateStatus').addEventListener('click', async ()=>{
    try{
      await saveStatusUpdate(false);
      toast('更新しました');
    }catch(err){
      toast(err?.message || '更新に失敗しました');
    }
  });

  document.getElementById('hideReservation').addEventListener('click', async ()=>{
    try{
      await saveStatusUpdate(true);
      toast('非表示にしました');
    }catch(err){
      toast(err?.message || '更新に失敗しました');
    }
  });

  document.getElementById('saveLogoConfigBtn').addEventListener('click', async ()=>{
    try{
      await withLoading(async ()=>{
        await gsRun('api_saveConfig', collectLogoConfigPayload());
        await adminRefreshAllData();
      }, '設定保存中...');
      toast('保存しました');
    }catch(err){
      toast(err?.message || '保存に失敗しました');
    }
  });

  document.getElementById('saveWarningConfigBtn').addEventListener('click', async ()=>{
    try{
      await withLoading(async ()=>{
        await gsRun('api_saveConfig', collectWarningConfigPayload());
        await adminRefreshAllData();
      }, '警告文保存中...');
      toast('保存しました');
    }catch(err){
      toast(err?.message || '保存に失敗しました');
    }
  });

  document.getElementById('saveSameDayConfigBtn').addEventListener('click', async ()=>{
    try{
      await withLoading(async ()=>{
        await gsRun('api_saveConfig', collectSameDayPayload());
        await adminRefreshAllData();
      }, '当日予約設定保存中...');
      toast('保存しました');
    }catch(err){
      toast(err?.message || '保存に失敗しました');
    }
  });

  document.getElementById('uploadLogoBtn').addEventListener('click', async ()=>{
    try{
      await uploadLogoFile();
      toast('アップロードしました');
    }catch(err){
      document.getElementById('logoUploadStatus').className = 'small-status ng';
      document.getElementById('logoUploadStatus').textContent = err?.message || 'アップロード失敗';
      toast(err?.message || 'アップロードに失敗しました');
    }
  });

  document.getElementById('changePasswordBtn').addEventListener('click', async ()=>{
    const status = document.getElementById('passwordChangeStatus');
    try{
      await withLoading(async ()=>{
        await gsRun('api_changeAdminPassword', {
          current_password: document.getElementById('cfgCurrentPassword').value.trim(),
          new_password: document.getElementById('cfgNewPassword').value.trim(),
          confirm_password: document.getElementById('cfgConfirmPassword').value.trim()
        });
      }, 'パスワード変更中...');

      status.className = 'small-status ok';
      status.textContent = '変更しました';
      document.getElementById('cfgCurrentPassword').value = '';
      document.getElementById('cfgNewPassword').value = '';
      document.getElementById('cfgConfirmPassword').value = '';
      toast('変更しました');
    }catch(err){
      status.className = 'small-status ng';
      status.textContent = err?.message || '変更に失敗しました';
      toast(err?.message || '変更に失敗しました');
    }
  });

  document.getElementById('saveMenuMasterBtn').addEventListener('click', async ()=>{
    try{
      const items = buildSaveMenuPayload();
      await withLoading(async ()=>{
        await gsRun('api_saveMenuMaster', { items });
        await adminRefreshAllData();
      }, 'メニュー保存中...');
      toast('保存しました');
    }catch(err){
      toast(err?.message || '保存に失敗しました');
    }
  });

  window.addEventListener('resize', debounce(()=>{
    try{ renderAdminCalendar(); }catch(_){}
  }, 150));
}

async function initAdmin(){
  if (!checkAdminAuth()) return;

  bindPanelToggles();
  bindMenuEvents();
  bindReservationTableEvents();
  bindAdminGridDelegation();
  bindUI();

  try{
    await withLoading(async ()=>{
      await adminRefreshAllData();
    }, '読み込み中...');
  }catch(err){
    toast(err?.message || '初期化に失敗しました');
  }
}

initAdmin();
