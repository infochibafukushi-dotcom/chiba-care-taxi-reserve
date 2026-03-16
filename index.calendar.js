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

function getCalendarStructureState(){
  const dates = getDatesRange();
  const { regularSlots, extendedSlots } = buildSlots();
  const slots = isExtendedView ? regularSlots.concat(extendedSlots) : regularSlots;
  const signature = JSON.stringify({
    isExtendedView: !!isExtendedView,
    maxForwardDays: Number(config.max_forward_days || 30),
    same_day_enabled: String(config.same_day_enabled || '0'),
    same_day_min_hours: String(config.same_day_min_hours || '3'),
    dates: dates.map(d => ymdLocal(d)),
    slots: slots.map(s => `${s.hour}:${s.minute}`)
  });
  return { dates, regularSlots, extendedSlots, slots, signature };
}

function buildCalendarGridHtml(dates, regularSlots, extendedSlots){
  let html = '';
  html += '<div class="time-label sticky-corner">時間</div>';

  dates.forEach((date, idx)=>{
    const isWeekend = (date.getDay() === 0 || date.getDay() === 6);
    html += `<div class="date-header sticky-top ${isWeekend ? 'weekend' : ''}" data-date-idx="${idx}">${formatDate(date)}</div>`;
  });

  for (const slot of regularSlots){
    html += `<div class="time-label sticky-left">${slot.display}</div>`;
    for (let idx=0; idx<dates.length; idx++){
      html += `<div class="slot-cell p-3 text-center text-lg font-bold rounded-lg cursor-pointer transition"
                data-action="slot"
                data-date-idx="${idx}"
                data-hour="${slot.hour}"
                data-minute="${slot.minute}"></div>`;
    }
  }

  if (isExtendedView){
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
        html += `<div class="slot-cell p-3 text-center text-lg font-bold rounded-lg cursor-pointer transition"
                  data-action="slot"
                  data-date-idx="${idx}"
                  data-hour="${slot.hour}"
                  data-minute="${slot.minute}"></div>`;
      }
    }
  }

  return html;
}

function updateCalendarSlotCells(grid, dates){
  const slotEls = grid.querySelectorAll('.slot-cell[data-action="slot"]');
  slotEls.forEach(el => {
    const dateIdx = Number(el.dataset.dateIdx);
    const hour = Number(el.dataset.hour);
    const minute = Number(el.dataset.minute || 0);
    const date = dates[dateIdx];
    if (!date) return;

    const blocked = isSlotBlockedWithMinute(date, hour, minute);
    const isAlt = isExtendedView && (hour > 21 || (hour === 21 && minute === 30) || hour < 6);

    el.classList.remove('slot-available', 'slot-unavailable', 'slot-alternate');
    el.classList.add(blocked ? 'slot-unavailable' : (isAlt ? 'slot-alternate' : 'slot-available'));
    el.textContent = blocked ? 'X' : '◎';
    el.setAttribute('aria-disabled', blocked ? 'true' : 'false');
  });
}

function renderCalendar(forceFullRebuild = false) {
  const grid = document.getElementById('calendarGrid');
  const dateRangeEl = document.getElementById('dateRange');
  if (!grid || !dateRangeEl) return;

  const state = getCalendarStructureState();
  const { dates, regularSlots, extendedSlots, signature } = state;
  calendarDates = dates;

  if (dates.length === 0) {
    dateRangeEl.textContent = '';
    grid.innerHTML = '';
    grid.dataset.signature = '';
    return;
  }

  dateRangeEl.textContent = `${formatDate(dates[0])} ～ ${formatDate(dates[dates.length-1])}`;

  if (forceFullRebuild || grid.dataset.signature !== signature) {
    grid.innerHTML = buildCalendarGridHtml(dates, regularSlots, extendedSlots);
    grid.dataset.signature = signature;
  }

  updateCalendarSlotCells(grid, dates);
  applyCalendarGridColumns(grid, dates.length);
  requestAnimationFrame(()=> applyCalendarGridColumns(grid, dates.length));
}

function bindGridDelegation(){
  if (hasBoundGridDelegation) return;

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

  hasBoundGridDelegation = true;
}
