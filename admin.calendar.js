function adminApplyCalendarGridColumns(gridEl, daysCount){
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

function getAdminDatesRange(){
  const today = new Date();
  today.setHours(0,0,0,0);

  const maxForwardDays = Number(adminConfig.max_forward_days || 30);
  const startOffset = 0;
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

  const otherSlots = [];
  otherSlots.push({hour:21, minute:30, display:'21:30'});
  for (let h=22; h<24; h++){
    otherSlots.push({hour:h, minute:0, display:`${String(h).padStart(2,'0')}:00`});
    otherSlots.push({hour:h, minute:30, display:`${String(h).padStart(2,'0')}:30`});
  }
  for (let h=0; h<=5; h++){
    otherSlots.push({hour:h, minute:0, display:`${String(h).padStart(2,'0')}:00`});
    otherSlots.push({hour:h, minute:30, display:`${String(h).padStart(2,'0')}:30`});
  }

  return { regularSlots, otherSlots };
}

function isAdminSlotBlocked(dateObj, hour, minute){
  const key = `${ymdLocal(dateObj)}-${hour}-${minute}`;
  return adminBlockedSlots.has(key) || adminReservedSlots.has(key);
}

function getAdminCalendarStructureState(){
  const dates = getAdminDatesRange();
  const { regularSlots, otherSlots } = buildAdminSlots();
  const slots = adminExtendedView ? otherSlots : regularSlots;
  const signature = JSON.stringify({
    adminExtendedView: !!adminExtendedView,
    maxForwardDays: Number(adminConfig.max_forward_days || 30),
    dates: dates.map(d => ymdLocal(d)),
    slots: slots.map(s => `${s.hour}:${s.minute}`)
  });
  return { dates, regularSlots, otherSlots, slots, signature };
}

function buildAdminCalendarHtml(dates, slots){
  let html = '';
  html += '<div class="time-label sticky-corner">時間</div>';

  dates.forEach((date, idx)=>{
    const isWeekend = (date.getDay() === 0 || date.getDay() === 6);
    const rightBtnText = adminExtendedView ? '夜' : '日';
    html += `
      <div class="date-header sticky-top ${isWeekend ? 'weekend' : ''}">
        <div class="w-full flex items-center justify-between px-1 gap-1">
          <button class="day-btn day-btn-block" data-action="toggleDay" data-date-idx="${idx}" type="button">全</button>
          <span class="text-[11px] font-extrabold leading-none">${formatDate(date)}</span>
          <button class="day-btn ${adminExtendedView ? 'day-btn-block' : 'day-btn-unblock'}" data-action="toggleDayPart" data-date-idx="${idx}" type="button">${rightBtnText}</button>
        </div>
      </div>
    `;
  });

  for (const slot of slots){
    html += `<div class="time-label sticky-left">${slot.display}</div>`;
    for (let idx=0; idx<dates.length; idx++){
      html += `
        <div class="admin-slot-cell p-3 text-center text-lg font-bold rounded-lg transition"
             data-action="toggleSlot"
             data-date-idx="${idx}"
             data-hour="${slot.hour}"
             data-minute="${slot.minute}"></div>
      `;
    }
  }

  return html;
}

function updateAdminCalendarSlotCells(grid, dates){
  const slotEls = grid.querySelectorAll('.admin-slot-cell[data-action="toggleSlot"]');
  slotEls.forEach(el => {
    const dateIdx = Number(el.dataset.dateIdx);
    const hour = Number(el.dataset.hour);
    const minute = Number(el.dataset.minute || 0);
    const date = dates[dateIdx];
    if (!date) return;

    const blocked = isAdminSlotBlocked(date, hour, minute);
    el.classList.remove('admin-slot-available', 'admin-slot-unavailable', 'admin-slot-other');
    el.classList.add(blocked ? 'admin-slot-unavailable' : (adminExtendedView ? 'admin-slot-other' : 'admin-slot-available'));
    el.textContent = blocked ? 'X' : '◎';
  });
}

function renderAdminCalendar(forceFullRebuild = false){
  const grid = document.getElementById('adminCalendarGrid');
  const dateRangeEl = document.getElementById('adminDateRange');
  if (!grid || !dateRangeEl) return;

  const state = getAdminCalendarStructureState();
  const { dates, slots, signature } = state;
  adminCalendarDates = dates;

  if (dates.length === 0) {
    dateRangeEl.textContent = '';
    grid.innerHTML = '';
    grid.dataset.signature = '';
    return;
  }

  dateRangeEl.textContent = `${formatDate(dates[0])} ～ ${formatDate(dates[dates.length - 1])}`;

  if (forceFullRebuild || grid.dataset.signature !== signature) {
    grid.innerHTML = buildAdminCalendarHtml(dates, slots);
    grid.dataset.signature = signature;
  }

  updateAdminCalendarSlotCells(grid, dates);
  adminApplyCalendarGridColumns(grid, dates.length);
  requestAnimationFrame(()=> adminApplyCalendarGridColumns(grid, dates.length));
}

function adminAddBlockLocal(dateStr, hour, minute){
  const key = `${dateStr}-${Number(hour)}-${Number(minute || 0)}`;
  if (!adminBlockedSlots.has(key)) adminBlockedSlots.add(key);

  const exists = adminBlocks.some(b => String(normalizeDateToYMD(b.date || b.slot_date || b.dateStr || '')) === String(dateStr) && Number(b.hour) === Number(hour) && Number(b.minute || 0) === Number(minute || 0));
  if (!exists){
    adminBlocks.push({ date: dateStr, hour: Number(hour), minute: Number(minute || 0) });
  }
}

function adminRemoveBlockLocal(dateStr, hour, minute){
  const key = `${dateStr}-${Number(hour)}-${Number(minute || 0)}`;
  adminBlockedSlots.delete(key);
  adminBlocks = adminBlocks.filter(b => !(String(normalizeDateToYMD(b.date || b.slot_date || b.dateStr || '')) === String(dateStr) && Number(b.hour) === Number(hour) && Number(b.minute || 0) === Number(minute || 0)));
}

function adminApplyDayBlockedLocal(dateStr, isBlocked, slots){
  (slots || []).forEach(slot => {
    if (isBlocked){
      adminAddBlockLocal(dateStr, slot.hour, slot.minute);
    } else {
      adminRemoveBlockLocal(dateStr, slot.hour, slot.minute);
    }
  });
}

function bindAdminGridDelegation(){
  if (hasBoundAdminGridDelegation) return;

  const grid = document.getElementById('adminCalendarGrid');
  if (!grid) return;

  grid.addEventListener('click', async (ev)=>{
    const el = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
    if (!el) return;

    const action = el.dataset.action;

    try{
      if (action === 'toggleSlot'){
        const dateIdx = Number(el.dataset.dateIdx);
        const hour = Number(el.dataset.hour);
        const minute = Number(el.dataset.minute || 0);
        const date = adminCalendarDates[dateIdx];
        if (!date) return;

        const dateStr = ymdLocal(date);
        const wasBlocked = isAdminSlotBlocked(date, hour, minute);

        await withLoading(async ()=>{
          await gsRun('api_toggleBlock', {
            dateStr: dateStr,
            hour: hour,
            minute: minute
          });
        }, '枠を更新中...');

        if (wasBlocked && !adminReservedSlots.has(`${dateStr}-${hour}-${minute}`)) {
          adminRemoveBlockLocal(dateStr, hour, minute);
        } else if (!wasBlocked) {
          adminAddBlockLocal(dateStr, hour, minute);
        }

        renderAdminCalendar(false);
        return;
      }

      if (action === 'toggleDay' || action === 'toggleDayPart'){
        const dateIdx = Number(el.dataset.dateIdx);
        const date = adminCalendarDates[dateIdx];
        if (!date) return;

        const dateStr = ymdLocal(date);
        const targetAction = adminExtendedView ? 'api_setOtherTimeDayBlocked' : 'api_setRegularDayBlocked';

        let blockedCount = 0;
        const { regularSlots, otherSlots } = buildAdminSlots();
        const slots = adminExtendedView ? otherSlots : regularSlots;
        slots.forEach(slot => {
          if (isAdminSlotBlocked(date, slot.hour, slot.minute)) blockedCount++;
        });

        const allBlocked = blockedCount === slots.length;
        const nextState = !allBlocked;

        await withLoading(async ()=>{
          await gsRun(targetAction, {
            dateStr: dateStr,
            isBlocked: nextState
          });
        }, action === 'toggleDay' ? '日単位ブロック更新中...' : '時間帯一括更新中...');

        adminApplyDayBlockedLocal(dateStr, nextState, slots.filter(slot => !adminReservedSlots.has(`${dateStr}-${slot.hour}-${slot.minute}`)));
        renderAdminCalendar(false);
        return;
      }
    }catch(err){
      toast(err?.message || '更新に失敗しました');
    }
  });

  hasBoundAdminGridDelegation = true;
}
