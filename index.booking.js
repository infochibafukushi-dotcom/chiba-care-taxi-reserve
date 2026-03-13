function applyLocalReservationBlock(selectedDate, selectedHour, selectedMinute, roundTripLabel){
  const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), Number(selectedHour), Number(selectedMinute || 0), 0, 0);
  const slots = (String(roundTripLabel || '').trim() === getMenuLabel('ROUND_STANDBY', '待機') || String(roundTripLabel || '').trim() === getMenuLabel('ROUND_HOSPITAL', '病院付き添い')) ? 4 : 2;

  for (let i = 0; i < slots; i++){
    const dt = new Date(start.getTime() + i * 30 * 60 * 1000);
    reservedSlots.add(`${ymdLocal(dt)}-${dt.getHours()}-${dt.getMinutes()}`);
  }
}

async function submitBooking(e){
  e.preventDefault();

  if (isSubmittingBooking) return;
  if (!selectedSlot) {
    toast('予約枠を選択してください');
    return;
  }

  const oldError = document.querySelector('#bookingForm .booking-error');
  if (oldError) oldError.remove();

  isSubmittingBooking = true;
  updateSubmitButton();

  const submitBtn = document.getElementById('submitBooking');
  submitBtn.disabled = true;
  submitBtn.textContent = '予約送信中...';

  const reservationId = formatDateForId(selectedSlot.date, selectedSlot.hour, selectedSlot.minute);
  const total = calculatePrice();

  const equipmentRental = document.getElementById('equipmentRental').value;
  const roundTripValue = document.getElementById('roundTrip').value;
  const stretcherTwoStaff = (
    equipmentRental === getMenuLabel('EQUIP_STRETCHER', 'ストレッチャーレンタル') &&
    (String(config.rule_force_stretcher_staff2_on_stretcher || '1') === '1' || getRuleEnabled(6))
  ) ? 'あり' : 'なし';

  const slotDateStr = ymdLocal(selectedSlot.date);

  const reservation = {
    reservation_id: reservationId,
    reservation_datetime: `${slotDateStr} ${String(selectedSlot.hour).padStart(2,'0')}:${String(selectedSlot.minute).padStart(2,'0')}`,
    usage_type: document.getElementById('usageType').value,
    customer_name: document.getElementById('customerName').value.trim(),
    phone_number: document.getElementById('phoneNumber').value.trim(),
    pickup_location: document.getElementById('pickupLocation').value.trim(),
    destination: document.getElementById('destination').value.trim() || '',
    assistance_type: document.getElementById('assistanceType').value,
    stair_assistance: document.getElementById('stairAssistance').value,
    equipment_rental: equipmentRental,
    stretcher_two_staff: stretcherTwoStaff,
    round_trip: roundTripValue,
    notes: document.getElementById('notes').value.trim() || '',
    total_price: total,
    status: '未対応',
    slot_date: slotDateStr,
    slot_hour: selectedSlot.hour,
    slot_minute: selectedSlot.minute,
    is_visible: true
  };

  try{
    await withLoading(async ()=>{
      await gsRun('api_createReservation', reservation);
    }, '予約中...');

    applyLocalReservationBlock(selectedSlot.date, selectedSlot.hour, selectedSlot.minute, roundTripValue);
    renderCalendar();

    document.getElementById('reservationId').textContent = reservationId;
    document.getElementById('bookingModal').classList.add('hidden');
    document.getElementById('completeModal').classList.remove('hidden');

    submitBtn.textContent = config.form_submit_button_text || '予約する';

    fireTrigger();
    setTimeout(()=>{
      refreshAllDataInBackground();
    }, 300);

  }catch(err){
    submitBtn.textContent = config.form_submit_button_text || '予約する';
    toast(err?.message || '通信エラー（予約保存）');

    const errorDiv = document.createElement('div');
    errorDiv.className = 'booking-error bg-red-100 border-2 border-red-300 text-red-700 px-4 py-3 rounded-xl mb-4 font-medium';
    errorDiv.textContent = 'NG 予約に失敗しました。もう一度お試しください。';
    document.getElementById('bookingForm').prepend(errorDiv);
  }finally{
    isSubmittingBooking = false;
    updateSubmitButton();
  }
}

async function init(){
  try{
    await withLoading(async ()=>{
      await refreshAllData(true);
      bindGridDelegation();
      renderCalendar();
    }, '読み込み中...');
  }catch(e){
    try{ showLoading(false); }catch(_){}
    toast('初期化エラー: ' + (e?.message || e));
    try{ renderCalendar(); }catch(_){}
  }
}

document.getElementById('bookingForm').addEventListener('submit', submitBooking);

bindUI();
init();
