const STORAGE_KEY = 'healthlog.entries.v1';

let entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let activeType = 'glucose';
let editingId = null;
let showAllHistory = false;
let toastTimer;

const medicationOptions = {
  losartan: {
    name: 'Losartan Potassium Tablet',
    dose: '50 mg',
    timing: 'Morning',
    reason: 'Blood pressure',
    schedule: 'Daily',
    expectedDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  },
  empagliflozin: {
    name: 'Empagliflozin Tablet',
    dose: '25 mg',
    timing: 'Morning',
    reason: 'Diabetes',
    schedule: 'Daily',
    expectedDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  },
  atorvastatin: {
    name: 'Atorvastatin Tablet',
    dose: '10 mg',
    timing: 'Evening',
    reason: 'Cholesterol',
    schedule: 'Alternate day',
    expectedDays: ['tue', 'thu', 'sat']
  },
  metformin: {
    name: 'Metformin HCl XR Extended Release Tablet',
    dose: '2000 mg',
    timing: 'Morning',
    reason: 'Diabetes',
    schedule: 'Daily',
    expectedDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  }
};

const days = [
  ['mon', 'Mon'],
  ['tue', 'Tue'],
  ['wed', 'Wed'],
  ['thu', 'Thu'],
  ['fri', 'Fri'],
  ['sat', 'Sat'],
  ['sun', 'Sun']
];

const singaporeParts = () =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Singapore',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value])
  );

const todayISO = () => {
  const p = singaporeParts();
  return `${p.year}-${p.month}-${p.day}`;
};

const timeNow = () => {
  const p = singaporeParts();
  return `${p.hour}:${p.minute}`;
};

const formatDate = (date) =>
  new Intl.DateTimeFormat('en-SG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date(`${date}T12:00:00`));

const escapeHTML = (value) =>
  String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));

const persist = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
};

document.querySelector('#todayDate').textContent = formatDate(todayISO());

const fieldsByType = {
  glucose: () => `
    <div class="value-row two">
      <label class="field">
        <span>Blood glucose</span>
        <input
          name="glucose"
          type="number"
          inputmode="decimal"
          min="1"
          max="35"
          step="0.1"
          placeholder="5.6"
          required
        />
      </label>

      <label class="field">
        <span>Timing</span>
        <select name="context">
          <option>Before meal</option>
          <option>After meal</option>
          <option>Fasting</option>
          <option>Bedtime</option>
          <option>Other</option>
        </select>
      </label>
    </div>
  `,

  meal: () => `
    <label class="field">
      <span>What did you eat?</span>
      <textarea
        name="food"
        rows="3"
        placeholder="e.g. Grilled chicken, vegetables and rice"
        required
      ></textarea>
    </label>

    <div class="meal-chips">
      ${['Breakfast', 'Lunch', 'Dinner', 'Snack']
        .map(
          (meal, index) => `
            <label>
              <input
                type="radio"
                name="mealType"
                value="${meal}"
                ${index === 0 ? 'checked' : ''}
              />
              <span>${meal}</span>
            </label>
          `
        )
        .join('')}
    </div>
  `,

  medication: () => `
    <label class="field">
      <span>Medication</span>
      <select id="medicationSelect" name="medicationKey" required>
        <option value="losartan">Losartan Potassium Tablet — 50 mg</option>
        <option value="empagliflozin">Empagliflozin Tablet — 25 mg</option>
        <option value="atorvastatin">Atorvastatin Tablet — 10 mg</option>
        <option value="metformin">Metformin HCl XR — 2000 mg</option>
      </select>
    </label>

    <div class="medication-card">
      <div class="med-name" id="medName">Losartan Potassium Tablet</div>
      <div class="med-dose" id="medDose">50 mg · Morning · Daily</div>

      <span class="weekly-title">This week taken checklist</span>

      <div class="weekly-days">
        ${days
          .map(
            ([value, label]) => `
              <label class="weekly-day" data-day="${value}">
                <input type="checkbox" name="medWeekDays" value="${value}" />
                <span>${label}</span>
              </label>
            `
          )
          .join('')}
      </div>

      <small class="weekly-hint" id="weeklyHint">
        Tick the days you have taken this medicine.
      </small>
    </div>

    <div class="value-row two">
      <label class="field">
        <span>Status</span>
        <select name="medStatus">
          <option>Taken</option>
          <option>Missed</option>
          <option>Delayed</option>
          <option>Skipped by doctor advice</option>
        </select>
      </label>

      <label class="field">
        <span>Timing</span>
        <input id="medTiming" name="medTiming" type="text" value="Morning" readonly />
      </label>
    </div>

    <label class="field">
      <span>Remarks</span>
      <textarea
        name="medRemarks"
        rows="2"
        placeholder="Optional note"
      ></textarea>
    </label>
  `,

  pressure: () => `
    <div class="value-row two">
      <label class="field">
        <span>Systolic</span>
        <input
          name="systolic"
          type="number"
          inputmode="numeric"
          min="50"
          max="260"
          placeholder="120"
          required
        />
      </label>

      <label class="field">
        <span>Diastolic</span>
        <input
          name="diastolic"
          type="number"
          inputmode="numeric"
          min="30"
          max="160"
          placeholder="80"
          required
        />
      </label>
    </div>

    <label class="field">
      <span>Pulse</span>
      <input
        name="pulse"
        type="number"
        inputmode="numeric"
        min="25"
        max="250"
        placeholder="72"
      />
    </label>
  `
};

function updateForm() {
  const fields = document.querySelector('#dynamicFields');
  fields.innerHTML = fieldsByType[activeType]();

  document.querySelector('#logTime').value = timeNow();
  document.querySelector('#logDate').value = todayISO();

  const labels = {
    glucose: 'Log blood glucose',
    meal: 'Log food & meal',
    medication: 'Log medication',
    pressure: 'Log blood pressure'
  };

  document.querySelector('#submitLabel').textContent =
    editingId ? 'Save changes' : labels[activeType];

  document
    .querySelector('#cancelEdit')
    .classList.toggle('show', Boolean(editingId));

  if (activeType === 'medication') {
    setupMedicationSelect();
  }
}

function setupMedicationSelect() {
  const select = document.querySelector('#medicationSelect');
  if (!select) return;

  const updateMedication = () => {
    const medication = medicationOptions[select.value];
    if (!medication) return;

    document.querySelector('#medName').textContent = medication.name;
    document.querySelector('#medDose').textContent =
      `${medication.dose} · ${medication.timing} · ${medication.schedule}`;
    document.querySelector('#medTiming').value = medication.timing;

    document.querySelectorAll('.weekly-day').forEach((label) => {
      label.classList.toggle(
        'expected',
        medication.expectedDays.includes(label.dataset.day)
      );
    });

    const hint = document.querySelector('#weeklyHint');

    if (select.value === 'atorvastatin') {
      hint.textContent =
        'Atorvastatin alternate-day plan for this week: Tue / Thu / Sat. Tick the days actually taken.';
    } else {
      hint.textContent =
        'Daily medicine. Tick the days you have actually taken it.';
    }
  };

  select.addEventListener('change', updateMedication);
  updateMedication();
}

document.querySelectorAll('.type-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    if (editingId) return;

    activeType = tab.dataset.type;

    document.querySelectorAll('.type-tab').forEach((item) => {
      item.classList.toggle('active', item === tab);
    });

    updateForm();
  });
});

document.querySelector('#logForm').addEventListener('submit', (event) => {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const data = Object.fromEntries(formData.entries());

  if (activeType === 'medication') {
    data.medWeekDays = formData.getAll('medWeekDays');

    const medication = medicationOptions[data.medicationKey];
    data.medicationName = medication.name;
    data.dose = medication.dose;
    data.medReason = medication.reason;
    data.medSchedule = medication.schedule;
  }

  const existing = editingId
    ? entries.find((entry) => entry.id === editingId)
    : null;

  const entry = {
    id: existing?.id || crypto.randomUUID(),
    type: activeType,
    createdAt: existing?.createdAt || new Date().toISOString(),
    ...data
  };

  if (editingId) {
    entries = entries.map((item) =>
      item.id === editingId ? entry : item
    );
  } else {
    entries.push(entry);
  }

  const wasEditing = Boolean(editingId);
  editingId = null;

  persist();
  renderTimeline();
  updateForm();

  showToast(wasEditing ? 'Changes saved' : 'Entry saved');
});

function renderTimeline() {
  const sortedEntries = [...entries].sort((a, b) =>
    `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)
  );

  const todays = sortedEntries.filter(
    (entry) => entry.date === todayISO()
  );

  document.querySelector('#entryBadge').textContent =
    sortedEntries.length;

  document.querySelector('#todayCount').textContent =
    `${todays.length} ${todays.length === 1 ? 'entry' : 'entries'} logged`;

  renderSummary(sortedEntries);

  const timeline = document.querySelector('#timeline');

  if (!sortedEntries.length) {
    timeline.innerHTML = `
      <div class="empty-state">
        <h3>Your day starts here</h3>
        <p>Log a reading, meal or medication and it will appear here.</p>
      </div>
    `;
    return;
  }

  const visible = showAllHistory
    ? sortedEntries
    : sortedEntries.slice(0, 10);

  timeline.innerHTML = `
    <div class="timeline-list">
      ${visible.map(renderTimelineItem).join('')}
    </div>

    ${
      sortedEntries.length > 10
        ? `
          <button class="show-history-btn" type="button">
            ${
              showAllHistory
                ? 'Show recent only'
                : `Show all ${sortedEntries.length} entries`
            }
          </button>
        `
        : ''
    }
  `;
}

function renderTimelineItem(entry) {
  const day =
    entry.date === todayISO()
      ? 'Today'
      : new Intl.DateTimeFormat('en-SG', {
          day: 'numeric',
          month: 'short'
        }).format(new Date(`${entry.date}T12:00:00`));

  let title = '';
  let subtitle = '';
  let icon = '';

  if (entry.type === 'glucose') {
    title = `${escapeHTML(entry.glucose)} mmol/L`;
    subtitle = escapeHTML(entry.context);
    icon = '◉';
  }

  if (entry.type === 'meal') {
    title = escapeHTML(entry.food);
    subtitle = escapeHTML(entry.mealType);
    icon = '🍽';
  }

  if (entry.type === 'pressure') {
    title =
      `${escapeHTML(entry.systolic)}/${escapeHTML(entry.diastolic)} mmHg`;

    subtitle = entry.pulse
      ? `Pulse ${escapeHTML(entry.pulse)} bpm`
      : 'Blood pressure';

    icon = '♥';
  }

  if (entry.type === 'medication') {
    const checkedDays = Array.isArray(entry.medWeekDays)
      ? entry.medWeekDays.map((d) => d.toUpperCase()).join(', ')
      : '';

    title =
      `${escapeHTML(entry.medicationName)} · ${escapeHTML(entry.dose)}`;

    subtitle =
      `${escapeHTML(entry.medStatus || 'Taken')} · ` +
      `${escapeHTML(entry.medSchedule || '')}` +
      `${checkedDays ? ` · Checked: ${escapeHTML(checkedDays)}` : ''}`;

    icon = '💊';
  }

  return `
    <article class="timeline-item">
      <div class="timeline-time">
        ${escapeHTML(entry.time)}
        <small>${day}</small>
      </div>

      <div class="item-icon ${entry.type}">
        ${icon}
      </div>

      <div class="item-body">
        <b>${title}</b>
        <span>${subtitle}</span>
      </div>

      <div class="item-actions">
        <button
          class="edit-btn"
          data-id="${entry.id}"
          type="button"
          title="Edit"
        >
          ✎
        </button>

        <button
          class="delete-btn"
          data-id="${entry.id}"
          type="button"
          title="Delete"
        >
          🗑
        </button>
      </div>
    </article>
  `;
}

function renderSummary(sortedEntries) {
  const glucoseEntries = sortedEntries.filter(
    (entry) =>
      entry.type === 'glucose' &&
      Number.isFinite(Number(entry.glucose))
  );

  const todayGlucose = glucoseEntries.filter(
    (entry) => entry.date === todayISO()
  );

  const latestGlucose = glucoseEntries[0]?.glucose || '—';

  const latestPressure = sortedEntries.find(
    (entry) => entry.type === 'pressure'
  );

  const todayMeals = sortedEntries.filter(
    (entry) =>
      entry.type === 'meal' &&
      entry.date === todayISO()
  );

  const todayMedication = sortedEntries.filter(
    (entry) =>
      entry.type === 'medication' &&
      entry.date === todayISO()
  );

  const range = todayGlucose.length
    ? `${Math.min(
        ...todayGlucose.map((entry) => Number(entry.glucose))
      ).toFixed(1)}–${Math.max(
        ...todayGlucose.map((entry) => Number(entry.glucose))
      ).toFixed(1)}`
    : '—';

  document.querySelector('#summaryGrid').innerHTML = `
    <div class="summary-item glucose">
      <span>Latest glucose</span>
      <strong>${escapeHTML(latestGlucose)}</strong>
      <small>${latestGlucose === '—' ? 'No readings' : 'mmol/L'}</small>
    </div>

    <div class="summary-item pressure">
      <span>Latest pressure</span>
      <strong>
        ${
          latestPressure
            ? `${escapeHTML(latestPressure.systolic)}/${escapeHTML(latestPressure.diastolic)}`
            : '—'
        }
      </strong>
      <small>${latestPressure ? 'mmHg' : 'No reading'}</small>
    </div>

    <div class="summary-item glucose">
      <span>Today's glucose range</span>
      <strong>${range}</strong>
      <small>${range === '—' ? 'No readings' : 'mmol/L'}</small>
    </div>

    <div class="summary-item">
      <span>Today's entries</span>
      <strong>
        ${
          sortedEntries.filter(
            (entry) => entry.date === todayISO()
          ).length
        }
      </strong>
      <small>Total logs</small>
    </div>

    <div class="summary-item full food">
      <span>Today's food</span>
      ${
        todayMeals.length
          ? todayMeals
              .map(
                (entry) => `
                  <small>
                    ${escapeHTML(entry.time)} ·
                    ${escapeHTML(entry.mealType)} ·
                    ${escapeHTML(entry.food)}
                  </small>
                `
              )
              .join('')
          : '<small>No food logged today</small>'
      }
    </div>

    <div class="summary-item full medication">
      <span>Today's medication</span>
      ${
        todayMedication.length
          ? todayMedication
              .map(
                (entry) => `
                  <small>
                    ${escapeHTML(entry.time)} ·
                    ${escapeHTML(entry.medicationName)} ·
                    ${escapeHTML(entry.dose)} ·
                    ${escapeHTML(entry.medStatus || 'Taken')}
                  </small>
                `
              )
              .join('')
          : '<small>No medication logged today</small>'
      }
    </div>
  `;
}

document.querySelector('#timeline').addEventListener('click', (event) => {
  const editButton = event.target.closest('.edit-btn');
  const deleteButton = event.target.closest('.delete-btn');
  const showButton = event.target.closest('.show-history-btn');

  if (showButton) {
    showAllHistory = !showAllHistory;
    renderTimeline();
    return;
  }

  if (editButton) {
    startEditing(editButton.dataset.id);
    return;
  }

  if (deleteButton) {
    const id = deleteButton.dataset.id;

    if (!confirm('Delete this entry?')) return;

    entries = entries.filter((entry) => entry.id !== id);
    persist();
    renderTimeline();
    showToast('Entry deleted');
  }
});

function startEditing(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;

  editingId = id;
  activeType = entry.type;

  document.querySelectorAll('.type-tab').forEach((tab) => {
    tab.classList.toggle(
      'active',
      tab.dataset.type === activeType
    );
  });

  updateForm();

  const form = document.querySelector('#logForm');

  Object.entries(entry).forEach(([key, value]) => {
    if (key === 'medWeekDays') return;

    const control = form.elements.namedItem(key);
    if (!control || value == null) return;

    if (control instanceof RadioNodeList) {
      control.value = value;
    } else {
      control.value = value;
    }
  });

  if (
    entry.type === 'medication' &&
    Array.isArray(entry.medWeekDays)
  ) {
    const select = document.querySelector('#medicationSelect');

    if (entry.medicationKey) {
      select.value = entry.medicationKey;
      select.dispatchEvent(new Event('change'));
    }

    document
      .querySelectorAll('input[name="medWeekDays"]')
      .forEach((checkbox) => {
        checkbox.checked =
          entry.medWeekDays.includes(checkbox.value);
      });
  }

  document.querySelector('#logDate').value = entry.date;
  document.querySelector('#logTime').value = entry.time;

  document
    .querySelector('.logger-card')
    .scrollIntoView({ behavior: 'smooth', block: 'start' });

  showToast('Editing entry');
}

document.querySelector('#cancelEdit').addEventListener('click', () => {
  editingId = null;
  updateForm();
});

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.querySelector('span').textContent = message;

  toast.classList.add('show');

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

updateForm();
renderTimeline();