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

function renderAdminCalendar(){
  const grid = document.getElementById('adminCalendarGrid');
  const dateRangeEl = document.getElementById('adminDateRange');
  if (!grid || !dateRangeEl) return;

  const dates = getAdminDatesRange();
  adminCalendarDates = dates;

  if (dates.length === 0) {
    dateRangeEl.textContent = '';
    grid.innerHTML = '';
    return;
  }

  dateRangeEl.textContent = `${formatDate(dates[0])} ～ ${formatDate(dates[dates.length - 1])}`;

  const { regularSlots, otherSlots } = buildAdminSlots();
  const slots = adminExtendedView ? otherSlots : regularSlots;

  let html = '';
  html += '<div class="time-label sticky-corner">時間</div>';

  dates.forEach((date, idx)=>{
    const isWeekend = (date.getDay() === 0 || date.getDay() === 6);
    let rightBtnText = adminExtendedView ? '夜' : '日';
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
      const date = dates[idx];
      const blocked = isAdminSlotBlocked(date, slot.hour, slot.minute);
      const slotClass = blocked ? 'admin-slot-unavailable' : (adminExtendedView ? 'admin-slot-other' : 'admin-slot-available');

      html += `
        <div class="${slotClass} p-3 text-center text-lg font-bold rounded-lg transition"
             data-action="toggleSlot"
             data-date-idx="${idx}"
             data-hour="${slot.hour}"
             data-minute="${slot.minute}">
          ${blocked ? 'X' : '◎'}
        </div>
      `;
    }
  }

  grid.innerHTML = html;
  adminApplyCalendarGridColumns(grid, dates.length);
  requestAnimationFrame(()=> adminApplyCalendarGridColumns(grid, dates.length));
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

        await withLoading(async ()=>{
          await gsRun('api_toggleBlock', {
            dateStr: ymdLocal(date),
            hour: hour,
            minute: minute
          });
          await adminRefreshAllData();
        }, '枠を更新中...');
      }

      if (action === 'toggleDay'){
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
          await adminRefreshAllData();
        }, '日単位ブロック更新中...');
      }

      if (action === 'toggleDayPart'){
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
          await adminRefreshAllData();
        }, '時間帯一括更新中...');
      }
    }catch(err){
      toast(err?.message || '更新に失敗しました');
    }
  });

  hasBoundAdminGridDelegation = true;
}
