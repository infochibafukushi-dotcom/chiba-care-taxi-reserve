function applyAdminCalendarGridColumns(gridEl, daysCount){
  const isMobile = window.matchMedia('(max-width: 640px)').matches;
  const timeCol = isMobile ? 44 : 60;
  const sc = gridEl?.closest?.('.scroll-container') || gridEl?.parentElement;
  const baseW = (sc && sc.clientWidth) ? sc.clientWidth : window.innerWidth;

  if (!isMobile){
    const dayW = Math.max(120, Math.floor((baseW - timeCol) / 7));
    gridEl.style.gridTemplateColumns = `${timeCol}px repeat(${daysCount}, ${dayW}px)`;
  } else {
    gridEl.style.gridTemplateColumns = `${timeCol}px repeat(${daysCount}, minmax(62px, 1fr))`;
  }
}

function renderAdminCalendar(){
  const grid = document.getElementById('adminCalendarGrid');
  const dateRangeEl = document.getElementById('adminDateRange');
  if (!grid || !dateRangeEl) return;

  const dates = getAdminDatesRange();
  adminCalendarDates = dates;

  if (dates.length === 0){
    dateRangeEl.textContent = '';
    grid.innerHTML = '';
    return;
  }

  dateRangeEl.textContent = `${formatDate(dates[0])} ～ ${formatDate(dates[dates.length - 1])}`;

  const { regularSlots } = buildAdminSlots();

  let html = '';
  html += '<div class="time-label sticky-corner">時間</div>';

  dates.forEach((date, idx)=>{
    const isWeekend = (date.getDay() === 0 || date.getDay() === 6);
    const ymd = ymdLocal(date);
    html += `
      <div class="date-header sticky-top ${isWeekend ? 'weekend' : ''}">
        <div class="flex flex-col items-center justify-center gap-1 w-full">
          <div>${formatDate(date)}</div>
          <div class="flex items-center gap-1">
            <button type="button" class="day-btn day-btn-block" data-action="block-day-regular" data-date="${ymd}">昼</button>
            <button type="button" class="day-btn day-btn-block" data-action="block-day-other" data-date="${ymd}">他</button>
            <button type="button" class="day-btn day-btn-block" data-action="toggle-day" data-date="${ymd}">全</button>
          </div>
        </div>
      </div>
    `;
  });

  for (const slot of regularSlots){
    html += `<div class="time-label sticky-left">${slot.display}</div>`;

    for (let idx=0; idx<dates.length; idx++){
      const date = dates[idx];
      const blocked = adminIsSlotBlocked(date, slot.hour, slot.minute);
      const cls = blocked ? 'admin-slot-unavailable' : 'admin-slot-available';
      html += `
        <div class="${cls} p-3 text-center text-lg font-bold rounded-lg cursor-pointer transition"
             data-action="toggle-slot"
             data-date-idx="${idx}"
             data-hour="${slot.hour}"
             data-minute="${slot.minute}">
          ${blocked ? 'X' : '◎'}
        </div>
      `;
    }
  }

  grid.innerHTML = html;
  applyAdminCalendarGridColumns(grid, dates.length);
  requestAnimationFrame(()=> applyAdminCalendarGridColumns(grid, dates.length));
}

function bindAdminCalendarDelegation(){
  if (hasBoundAdminGridDelegation) return;

  const grid = document.getElementById('adminCalendarGrid');
  if (!grid) return;

  grid.addEventListener('click', async (e)=>{
    const el = e.target.closest('[data-action]');
    if (!el) return;

    const action = el.getAttribute('data-action');

    try{
      if (action === 'toggle-slot'){
        const dateIdx = Number(el.getAttribute('data-date-idx'));
        const hour = Number(el.getAttribute('data-hour'));
        const minute = Number(el.getAttribute('data-minute') || 0);
        const date = adminCalendarDates[dateIdx];
        if (!date) return;

        await withLoading(async ()=>{
          await gsRun('api_toggleBlock', {
            dateStr: ymdLocal(date),
            hour: hour,
            minute: minute
          });
          await adminRefreshAllData(false);
        }, '枠更新中...');

        renderAdminCalendar();
        toast('枠を更新しました');
        return;
      }

      if (action === 'toggle-day'){
        const dateStr = el.getAttribute('data-date') || '';
        await withLoading(async ()=>{
          await gsRun('api_toggleEntireDay', {
            dateStr: dateStr
          });
          await adminRefreshAllData(false);
        }, '日ブロック更新中...');

        renderAdminCalendar();
        toast('全日ブロックを更新しました');
        return;
      }

      if (action === 'block-day-regular'){
        const dateStr = el.getAttribute('data-date') || '';
        await withLoading(async ()=>{
          await gsRun('api_setRegularDayBlocked', {
            dateStr: dateStr,
            isBlocked: true
          });
          await adminRefreshAllData(false);
        }, '通常時間更新中...');

        renderAdminCalendar();
        toast('通常時間をブロックしました');
        return;
      }

      if (action === 'block-day-other'){
        const dateStr = el.getAttribute('data-date') || '';
        await withLoading(async ()=>{
          await gsRun('api_setOtherTimeDayBlocked', {
            dateStr: dateStr,
            isBlocked: true
          });
          await adminRefreshAllData(false);
        }, '他時間更新中...');

        renderAdminCalendar();
        toast('他時間をブロックしました');
        return;
      }
    }catch(err){
      toast(err?.message || '更新に失敗しました');
    }
  });

  hasBoundAdminGridDelegation = true;
}
