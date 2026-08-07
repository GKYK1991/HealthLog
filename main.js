const STORAGE_KEY = "healthlog.entries.v2";

let entries = JSON.parse(
  localStorage.getItem(STORAGE_KEY) || "[]"
);

let activeType = "glucose";
let editingId = null;
let showAllHistory = false;
let toastTimer = null;

let currentMealPhoto = "";


const medicationOptions = {

  losartan: {
    name: "Losartan Potassium Tablet",
    dose: "50 mg",
    timing: "Morning",
    reason: "Blood pressure",
    schedule: "Daily",
    expectedDays: [
      "mon","tue","wed","thu","fri","sat","sun"
    ]
  },

  empagliflozin: {
    name: "Empagliflozin Tablet",
    dose: "25 mg",
    timing: "Morning",
    reason: "Diabetes",
    schedule: "Daily",
    expectedDays: [
      "mon","tue","wed","thu","fri","sat","sun"
    ]
  },

  atorvastatin: {
    name: "Atorvastatin Tablet",
    dose: "10 mg",
    timing: "Evening",
    reason: "Cholesterol",
    schedule: "Alternate day",
    expectedDays: [
      "tue","thu","sat"
    ]
  },

  metformin: {
    name: "Metformin HCl XR Extended Release Tablet",
    dose: "2000 mg",
    timing: "Morning",
    reason: "Diabetes",
    schedule: "Daily",
    expectedDays: [
      "mon","tue","wed","thu","fri","sat","sun"
    ]
  }

};


const days = [
  ["mon","Mon"],
  ["tue","Tue"],
  ["wed","Wed"],
  ["thu","Thu"],
  ["fri","Fri"],
  ["sat","Sat"],
  ["sun","Sun"]
];


function singaporeParts() {

  return Object.fromEntries(
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:"Asia/Singapore",
        year:"numeric",
        month:"2-digit",
        day:"2-digit",
        hour:"2-digit",
        minute:"2-digit",
        hourCycle:"h23"
      }
    )
      .formatToParts(new Date())
      .map(
        ({type,value}) => [
          type,
          value
        ]
      )
  );
}


function todayISO() {

  const p = singaporeParts();

  return `${p.year}-${p.month}-${p.day}`;
}


function timeNow() {

  const p = singaporeParts();

  return `${p.hour}:${p.minute}`;
}


function formatDate(date) {

  return new Intl.DateTimeFormat(
    "en-SG",
    {
      weekday:"long",
      day:"numeric",
      month:"long"
    }
  ).format(
    new Date(
      `${date}T12:00:00`
    )
  );
}


function escapeHTML(value) {

  return String(value ?? "")
    .replace(
      /[&<>'"]/g,
      char => ({
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        "'":"&#39;",
        '"':"&quot;"
      }[char])
    );
}


function persist() {

  try {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(entries)
    );

    updateBackupCount();

    return true;

  } catch(error) {

    console.error(error);

    showToast(
      "Storage full — export backup and remove some photos"
    );

    return false;
  }
}


function updateBackupCount() {

  const element =
    document.getElementById(
      "backupRecordCount"
    );

  if(element) {
    element.textContent =
      entries.length;
  }
}


document.getElementById(
  "todayDate"
).textContent =
  formatDate(todayISO());


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
        >
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

      ${[
        "Breakfast",
        "Lunch",
        "Dinner",
        "Snack"
      ].map(
        (meal,index) => `

          <label>

            <input
              type="radio"
              name="mealType"
              value="${meal}"
              ${index === 0 ? "checked" : ""}
            >

            <span>${meal}</span>

          </label>

        `
      ).join("")}

    </div>


    <div class="food-photo-section">

      <span class="food-photo-title">
        Meal photo
      </span>


      <div class="food-photo-actions">

        <label class="photo-btn">

          📷 Take Photo

          <input
            id="mealCamera"
            type="file"
            accept="image/*"
            capture="environment"
            hidden
          >

        </label>


        <label class="photo-btn">

          🖼 Photo Library

          <input
            id="mealLibrary"
            type="file"
            accept="image/*"
            hidden
          >

        </label>

      </div>


      <small class="photo-note">
        Photos are compressed before saving.
      </small>


      <div
        id="mealPhotoPreview"
        class="meal-photo-preview"
      ></div>

    </div>
  `,


  medication: () => `

    <label class="field">

      <span>Medication</span>

      <select
        id="medicationSelect"
        name="medicationKey"
        required
      >

        <option value="losartan">
          Losartan Potassium Tablet — 50 mg
        </option>

        <option value="empagliflozin">
          Empagliflozin Tablet — 25 mg
        </option>

        <option value="atorvastatin">
          Atorvastatin Tablet — 10 mg
        </option>

        <option value="metformin">
          Metformin HCl XR — 2000 mg
        </option>

      </select>

    </label>


    <div class="medication-card">

      <div
        class="med-name"
        id="medName"
      ></div>

      <div
        class="med-dose"
        id="medDose"
      ></div>


      <span class="weekly-title">
        This week taken checklist
      </span>


      <div class="weekly-days">

        ${days.map(
          ([value,label]) => `

            <label
              class="weekly-day"
              data-day="${value}"
            >

              <input
                type="checkbox"
                name="medWeekDays"
                value="${value}"
              >

              <span>${label}</span>

            </label>

          `
        ).join("")}

      </div>


      <small
        id="weeklyHint"
        class="weekly-hint"
      ></small>

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

        <input
          id="medTiming"
          name="medTiming"
          readonly
        >

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
          min="50"
          max="260"
          placeholder="120"
          required
        >

      </label>


      <label class="field">

        <span>Diastolic</span>

        <input
          name="diastolic"
          type="number"
          min="30"
          max="160"
          placeholder="80"
          required
        >

      </label>

    </div>


    <label class="field">

      <span>Pulse</span>

      <input
        name="pulse"
        type="number"
        min="25"
        max="250"
        placeholder="72"
      >

    </label>
  `
};


function updateForm() {

  document.getElementById(
    "dynamicFields"
  ).innerHTML =
    fieldsByType[activeType]();


  document.getElementById(
    "logTime"
  ).value =
    timeNow();


  document.getElementById(
    "logDate"
  ).value =
    todayISO();


  const labels = {
    glucose:"Log blood glucose",
    meal:"Log food & meal",
    medication:"Log medication",
    pressure:"Log blood pressure"
  };


  document.getElementById(
    "submitLabel"
  ).textContent =
    editingId
      ? "Save changes"
      : labels[activeType];


  document.getElementById(
    "cancelEdit"
  ).classList.toggle(
    "show",
    Boolean(editingId)
  );


  if(activeType === "medication") {
    setupMedicationSelect();
  }


  if(activeType === "meal") {
    setupMealPhoto();
  }
}


function setupMedicationSelect() {

  const select =
    document.getElementById(
      "medicationSelect"
    );


  const update = () => {

    const med =
      medicationOptions[
        select.value
      ];


    document.getElementById(
      "medName"
    ).textContent =
      med.name;


    document.getElementById(
      "medDose"
    ).textContent =
      `${med.dose} · ${med.timing} · ${med.schedule}`;


    document.getElementById(
      "medTiming"
    ).value =
      med.timing;


    document.querySelectorAll(
      ".weekly-day"
    ).forEach(
      label => {

        label.classList.toggle(
          "expected",
          med.expectedDays.includes(
            label.dataset.day
          )
        );
      }
    );


    document.getElementById(
      "weeklyHint"
    ).textContent =
      select.value === "atorvastatin"
        ? "Atorvastatin planned days this week: Tue / Thu / Sat. Tick the days actually taken."
        : "Daily medicine. Tick the days actually taken.";
  };


  select.addEventListener(
    "change",
    update
  );


  update();
}


function setupMealPhoto() {

  const camera =
    document.getElementById(
      "mealCamera"
    );

  const library =
    document.getElementById(
      "mealLibrary"
    );


  const handler =
    async event => {

      const file =
        event.target.files?.[0];

      if(!file) return;


      try {

        showToast(
          "Preparing photo…"
        );

        currentMealPhoto =
          await resizePhoto(file);

        renderMealPhotoPreview();

        showToast(
          "Photo ready"
        );

      } catch(error) {

        console.error(error);

        showToast(
          "Could not process photo"
        );
      }

      event.target.value = "";
    };


  camera.addEventListener(
    "change",
    handler
  );

  library.addEventListener(
    "change",
    handler
  );


  renderMealPhotoPreview();
}


function resizePhoto(file) {

  return new Promise(
    resolve => {

      const reader =
        new FileReader();


      reader.onload =
        event => {

          const img =
            new Image();


          img.onload =
            () => {

              const maxWidth =
                1200;


              const scale =
                Math.min(
                  1,
                  maxWidth / img.width
                );


              const canvas =
                document.createElement(
                  "canvas"
                );


              canvas.width =
                Math.round(
                  img.width * scale
                );


              canvas.height =
                Math.round(
                  img.height * scale
                );


              const ctx =
                canvas.getContext(
                  "2d"
                );


              ctx.drawImage(
                img,
                0,
                0,
                canvas.width,
                canvas.height
              );


              resolve(
                canvas.toDataURL(
                  "image/jpeg",
                  .75
                )
              );
            };


          img.src =
            event.target.result;
        };


      reader.readAsDataURL(file);
    }
  );
}


function renderMealPhotoPreview() {

  const preview =
    document.getElementById(
      "mealPhotoPreview"
    );


  if(!preview) return;


  if(!currentMealPhoto) {

    preview.innerHTML = "";
    return;
  }


  preview.innerHTML = `

    <div class="meal-photo-card">

      <img
        src="${currentMealPhoto}"
        alt="Meal photo"
      >

      <button
        id="removeMealPhoto"
        class="remove-photo-btn"
        type="button"
      >
        Remove photo
      </button>

    </div>
  `;


  document.getElementById(
    "removeMealPhoto"
  ).addEventListener(
    "click",
    () => {

      currentMealPhoto = "";
      renderMealPhotoPreview();
    }
  );
}


document.querySelectorAll(
  ".type-tab"
).forEach(
  tab => {

    tab.addEventListener(
      "click",
      () => {

        if(editingId) return;


        activeType =
          tab.dataset.type;


        currentMealPhoto = "";


        document.querySelectorAll(
          ".type-tab"
        ).forEach(
          item => {

            item.classList.toggle(
              "active",
              item === tab
            );
          }
        );


        updateForm();
      }
    );
  }
);


document.getElementById(
  "logForm"
).addEventListener(
  "submit",
  event => {

    event.preventDefault();


    const formData =
      new FormData(
        event.currentTarget
      );


    const data =
      Object.fromEntries(
        formData.entries()
      );


    if(activeType === "meal") {

      data.photo =
        currentMealPhoto || "";
    }


    if(activeType === "medication") {

      data.medWeekDays =
        formData.getAll(
          "medWeekDays"
        );


      const med =
        medicationOptions[
          data.medicationKey
        ];


      data.medicationName =
        med.name;

      data.dose =
        med.dose;

      data.medReason =
        med.reason;

      data.medSchedule =
        med.schedule;
    }


    const existing =
      editingId
        ? entries.find(
            e => e.id === editingId
          )
        : null;


    const entry = {

      id:
        existing?.id ||
        crypto.randomUUID(),

      type:
        activeType,

      createdAt:
        existing?.createdAt ||
        new Date().toISOString(),

      ...data
    };


    if(editingId) {

      entries =
        entries.map(
          item =>
            item.id === editingId
              ? entry
              : item
        );

    } else {

      entries.push(entry);
    }


    const wasEditing =
      Boolean(editingId);


    editingId = null;
    currentMealPhoto = "";


    persist();
    renderTimeline();
    updateForm();


    showToast(
      wasEditing
        ? "Changes saved"
        : "Entry saved"
    );
  }
);


function renderTimeline() {

  const sorted =
    [...entries].sort(
      (a,b) =>
        `${b.date} ${b.time}`
          .localeCompare(
            `${a.date} ${a.time}`
          )
    );


  document.getElementById(
    "entryBadge"
  ).textContent =
    sorted.length;


  const todays =
    sorted.filter(
      e => e.date === todayISO()
    );


  document.getElementById(
    "todayCount"
  ).textContent =
    `${todays.length} ${
      todays.length === 1
        ? "entry"
        : "entries"
    } logged`;


  updateBackupCount();

  renderSummary(sorted);


  const timeline =
    document.getElementById(
      "timeline"
    );


  if(!sorted.length) {

    timeline.innerHTML = `

      <div class="empty-state">

        <h3>Your day starts here</h3>

        <p>
          Log a reading, meal or medication
          and it will appear here.
        </p>

      </div>
    `;

    return;
  }


  const visible =
    showAllHistory
      ? sorted
      : sorted.slice(0,10);


  timeline.innerHTML = `

    ${visible.map(
      renderTimelineItem
    ).join("")}

    ${
      sorted.length > 10
        ? `
          <button
            class="show-history-btn"
            type="button"
          >
            ${
              showAllHistory
                ? "Show recent only"
                : `Show all ${sorted.length} entries`
            }
          </button>
        `
        : ""
    }
  `;
}


function renderTimelineItem(entry) {

  let title = "";
  let subtitle = "";
  let icon = "";
  let photo = "";


  if(entry.type === "glucose") {

    title =
      `${escapeHTML(entry.glucose)} mmol/L`;

    subtitle =
      escapeHTML(entry.context);

    icon = "●";
  }


  if(entry.type === "meal") {

    title =
      escapeHTML(entry.food);

    subtitle =
      escapeHTML(entry.mealType);

    icon = "🍽";


    if(entry.photo) {

      photo = `
        <img
          class="timeline-meal-photo"
          src="${entry.photo}"
          alt="Meal photo"
        >
      `;
    }
  }


  if(entry.type === "pressure") {

    title =
      `${escapeHTML(entry.systolic)}/${escapeHTML(entry.diastolic)} mmHg`;

    subtitle =
      entry.pulse
        ? `Pulse ${escapeHTML(entry.pulse)} bpm`
        : "Blood pressure";

    icon = "♥";
  }


  if(entry.type === "medication") {

    title =
      `${escapeHTML(entry.medicationName)} · ${escapeHTML(entry.dose)}`;

    const daysText =
      Array.isArray(entry.medWeekDays)
        ? entry.medWeekDays
            .map(x => x.toUpperCase())
            .join(", ")
        : "";


    subtitle =
      `${escapeHTML(entry.medStatus || "Taken")} · ${escapeHTML(entry.medSchedule || "")}` +
      (
        daysText
          ? ` · ${escapeHTML(daysText)}`
          : ""
      );

    icon = "💊";
  }


  return `

    <article
      class="timeline-item ${entry.type}"
    >

      <div class="timeline-time">
        ${escapeHTML(entry.time)}

        <small>
          ${escapeHTML(entry.date)}
        </small>
      </div>


      <div
        class="item-icon ${entry.type}"
      >
        ${icon}
      </div>


      <div class="item-body">

        <b>${title}</b>

        <span>${subtitle}</span>

        ${photo}

      </div>


      <div class="item-actions">

        <button
          class="edit-btn"
          data-id="${entry.id}"
          type="button"
        >
          ✎
        </button>

        <button
          class="delete-btn"
          data-id="${entry.id}"
          type="button"
        >
          🗑
        </button>

      </div>

    </article>
  `;
}


function renderSummary(sorted) {

  const glucose =
    sorted.filter(
      e =>
        e.type === "glucose" &&
        Number.isFinite(
          Number(e.glucose)
        )
    );


  const latestGlucose =
    glucose[0]?.glucose || "—";


  const pressure =
    sorted.find(
      e => e.type === "pressure"
    );


  const mealsToday =
    sorted.filter(
      e =>
        e.type === "meal" &&
        e.date === todayISO()
    );


  const medsToday =
    sorted.filter(
      e =>
        e.type === "medication" &&
        e.date === todayISO()
    );


  document.getElementById(
    "summaryGrid"
  ).innerHTML = `

    <div class="summary-item glucose">

      <span>Latest glucose</span>

      <strong>
        ${escapeHTML(latestGlucose)}
      </strong>

      <small>
        ${
          latestGlucose === "—"
            ? "No reading"
            : "mmol/L"
        }
      </small>

    </div>


    <div class="summary-item pressure">

      <span>Latest pressure</span>

      <strong>
        ${
          pressure
            ? `${pressure.systolic}/${pressure.diastolic}`
            : "—"
        }
      </strong>

      <small>
        ${
          pressure
            ? "mmHg"
            : "No reading"
        }
      </small>

    </div>


    <div class="summary-item full food">

      <span>Today's food</span>

      <small>
        ${
          mealsToday.length
            ? `${mealsToday.length} meal records`
            : "No food logged today"
        }
      </small>

    </div>


    <div class="summary-item full medication">

      <span>Today's medication</span>

      <small>
        ${
          medsToday.length
            ? `${medsToday.length} medication records`
            : "No medication logged today"
        }
      </small>

    </div>
  `;
}


document.getElementById(
  "timeline"
).addEventListener(
  "click",
  event => {

    const edit =
      event.target.closest(
        ".edit-btn"
      );

    const remove =
      event.target.closest(
        ".delete-btn"
      );

    const show =
      event.target.closest(
        ".show-history-btn"
      );


    if(show) {

      showAllHistory =
        !showAllHistory;

      renderTimeline();

      return;
    }


    if(edit) {

      startEditing(
        edit.dataset.id
      );

      return;
    }


    if(remove) {

      if(
        !confirm(
          "Delete this entry?"
        )
      ) return;


      entries =
        entries.filter(
          e =>
            e.id !==
            remove.dataset.id
        );


      persist();
      renderTimeline();

      showToast(
        "Entry deleted"
      );
    }
  }
);


function startEditing(id) {

  const entry =
    entries.find(
      e => e.id === id
    );


  if(!entry) return;


  editingId = id;
  activeType = entry.type;


  if(entry.type === "meal") {

    currentMealPhoto =
      entry.photo || "";
  }


  document.querySelectorAll(
    ".type-tab"
  ).forEach(
    tab => {

      tab.classList.toggle(
        "active",
        tab.dataset.type === activeType
      );
    }
  );


  updateForm();


  const form =
    document.getElementById(
      "logForm"
    );


  Object.entries(entry)
    .forEach(
      ([key,value]) => {

        if(
          key === "medWeekDays" ||
          key === "photo"
        ) return;


        const control =
          form.elements.namedItem(
            key
          );


        if(control && value != null) {

          control.value = value;
        }
      }
    );


  if(
    entry.type === "medication" &&
    Array.isArray(entry.medWeekDays)
  ) {

    document.querySelectorAll(
      'input[name="medWeekDays"]'
    ).forEach(
      checkbox => {

        checkbox.checked =
          entry.medWeekDays.includes(
            checkbox.value
          );
      }
    );
  }


  if(entry.type === "meal") {

    renderMealPhotoPreview();
  }


  document.getElementById(
    "logDate"
  ).value =
    entry.date;


  document.getElementById(
    "logTime"
  ).value =
    entry.time;


  window.scrollTo({
    top:0,
    behavior:"smooth"
  });
}


document.getElementById(
  "cancelEdit"
).addEventListener(
  "click",
  () => {

    editingId = null;
    currentMealPhoto = "";

    updateForm();
  }
);


/* =========================
   CSV BACKUP
========================= */


function csvEscape(value) {

  const text =
    String(value ?? "");

  const escaped =
    text.replaceAll(
      '"',
      '""'
    );


  if(
    escaped.includes(",") ||
    escaped.includes('"') ||
    escaped.includes("\n")
  ) {

    return `"${escaped}"`;
  }


  return escaped;
}


function exportCSV() {

  if(!entries.length) {

    alert(
      "No records to export."
    );

    return;
  }


  const headers = [

    "ID",
    "Type",
    "Date",
    "Time",

    "Glucose",
    "Glucose Timing",

    "Food",
    "Meal Type",

    "Systolic",
    "Diastolic",
    "Pulse",

    "Medication Key",
    "Medication Name",
    "Dose",
    "Medication Status",
    "Medication Timing",
    "Medication Reason",
    "Medication Schedule",
    "Medication Week Days",
    "Medication Remarks",

    "Created At"
  ];


  const rows =
    entries.map(
      entry => [

        csvEscape(entry.id),

        csvEscape(entry.type),

        csvEscape(entry.date),

        csvEscape(entry.time),

        csvEscape(entry.glucose),

        csvEscape(entry.context),

        csvEscape(entry.food),

        csvEscape(entry.mealType),

        csvEscape(entry.systolic),

        csvEscape(entry.diastolic),

        csvEscape(entry.pulse),

        csvEscape(entry.medicationKey),

        csvEscape(entry.medicationName),

        csvEscape(entry.dose),

        csvEscape(entry.medStatus),

        csvEscape(entry.medTiming),

        csvEscape(entry.medReason),

        csvEscape(entry.medSchedule),

        csvEscape(
          Array.isArray(
            entry.medWeekDays
          )
            ? entry.medWeekDays.join("|")
            : ""
        ),

        csvEscape(entry.medRemarks),

        csvEscape(entry.createdAt)
      ]
    );


  const csv =
    [
      headers.join(","),
      ...rows.map(
        row => row.join(",")
      )
    ].join("\n");


  const blob =
    new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8"
      }
    );


  downloadBlob(
    blob,
    `HealthLogBackup_${fileDate()}.csv`
  );
}


function parseCSV(text) {

  const rows = [];

  let row = [];
  let value = "";
  let quoted = false;


  for(
    let i = 0;
    i < text.length;
    i++
  ) {

    const char =
      text[i];

    const next =
      text[i + 1];


    if(
      char === '"' &&
      quoted &&
      next === '"'
    ) {

      value += '"';
      i++;

    } else if(
      char === '"'
    ) {

      quoted =
        !quoted;

    } else if(
      char === "," &&
      !quoted
    ) {

      row.push(value);
      value = "";

    } else if(
      (
        char === "\n" ||
        char === "\r"
      ) &&
      !quoted
    ) {

      if(
        char === "\r" &&
        next === "\n"
      ) {

        i++;
      }


      row.push(value);

      rows.push(row);

      row = [];
      value = "";

    } else {

      value += char;
    }
  }


  if(
    value !== "" ||
    row.length
  ) {

    row.push(value);

    rows.push(row);
  }


  return rows;
}


function importCSVBackup() {

  const input =
    document.getElementById(
      "importCSVInput"
    );


  const file =
    input.files[0];


  if(!file) return;


  if(
    !confirm(
      "Import CSV backup? This will replace all current HealthLog records. Meal photos cannot be restored from CSV."
    )
  ) {

    input.value = "";
    return;
  }


  const reader =
    new FileReader();


  reader.onload =
    event => {

      try {

        const rows =
          parseCSV(
            event.target.result
          );


        if(rows.length < 2) {

          alert(
            "CSV backup is empty or invalid."
          );

          return;
        }


        const headers =
          rows[0].map(
            x =>
              x.trim()
                .toLowerCase()
          );


        const imported = [];


        for(
          let i = 1;
          i < rows.length;
          i++
        ) {

          const row =
            rows[i];


          if(
            !row ||
            row.every(
              x =>
                String(x)
                  .trim() === ""
            )
          ) {

            continue;
          }


          const get =
            name => {

              const index =
                headers.indexOf(
                  name.toLowerCase()
                );


              return index >= 0
                ? row[index] || ""
                : "";
            };


          const type =
            get("Type");


          if(!type) continue;


          imported.push({

            id:
              get("ID") ||
              crypto.randomUUID(),

            type,

            date:
              get("Date"),

            time:
              get("Time"),

            glucose:
              get("Glucose"),

            context:
              get("Glucose Timing"),

            food:
              get("Food"),

            mealType:
              get("Meal Type"),

            photo:"",

            systolic:
              get("Systolic"),

            diastolic:
              get("Diastolic"),

            pulse:
              get("Pulse"),

            medicationKey:
              get("Medication Key"),

            medicationName:
              get("Medication Name"),

            dose:
              get("Dose"),

            medStatus:
              get("Medication Status"),

            medTiming:
              get("Medication Timing"),

            medReason:
              get("Medication Reason"),

            medSchedule:
              get("Medication Schedule"),

            medWeekDays:
              get(
                "Medication Week Days"
              )
                ? get(
                    "Medication Week Days"
                  ).split("|")
                : [],

            medRemarks:
              get(
                "Medication Remarks"
              ),

            createdAt:
              get("Created At") ||
              new Date().toISOString()
          });
        }


        if(!imported.length) {

          alert(
            "No valid records found."
          );

          return;
        }


        entries =
          imported;


        persist();
        renderTimeline();


        alert(
          `${imported.length} HealthLog records restored from CSV.`
        );

      } catch(error) {

        console.error(error);

        alert(
          "Failed to import CSV backup."
        );

      } finally {

        input.value = "";
      }
    };


  reader.readAsText(file);
}


/* =========================
   JSON FULL BACKUP
========================= */


function exportFullBackup() {

  if(!entries.length) {

    alert(
      "No records to export."
    );

    return;
  }


  const backup = {

    appName:
      "HealthLog",

    version:
      "1.0",

    exportedAt:
      new Date()
        .toISOString(),

    recordCount:
      entries.length,

    records:
      entries
  };


  const json =
    JSON.stringify(
      backup,
      null,
      2
    );


  const blob =
    new Blob(
      [json],
      {
        type:
          "application/json;charset=utf-8"
      }
    );


  downloadBlob(
    blob,
    `HealthLogFullBackup_${fileDate()}.json`
  );
}


function importFullBackup() {

  const input =
    document.getElementById(
      "importJSONInput"
    );


  const file =
    input.files[0];


  if(!file) return;


  if(
    !confirm(
      "Import full HealthLog backup? This will replace all current records in this browser."
    )
  ) {

    input.value = "";
    return;
  }


  const reader =
    new FileReader();


  reader.onload =
    event => {

      try {

        const backup =
          JSON.parse(
            event.target.result
          );


        if(
          !backup.records ||
          !Array.isArray(
            backup.records
          )
        ) {

          alert(
            "Invalid HealthLog backup file."
          );

          return;
        }


        entries =
          backup.records;


        persist();

        renderTimeline();


        alert(
          `Full backup restored successfully. ${entries.length} records restored including available meal photos.`
        );

      } catch(error) {

        console.error(error);

        alert(
          "Failed to import full backup."
        );

      } finally {

        input.value = "";
      }
    };


  reader.readAsText(file);
}


function fileDate() {

  return new Date()
    .toISOString()
    .slice(0,19)
    .replaceAll(
      ":",
      "-"
    );
}


function downloadBlob(
  blob,
  filename
) {

  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;

  link.download =
    filename;


  document.body.appendChild(
    link
  );


  link.click();

  link.remove();


  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    1000
  );
}


/* BACKUP BUTTONS */

document.getElementById(
  "exportCSVBtn"
).addEventListener(
  "click",
  exportCSV
);


document.getElementById(
  "importCSVInput"
).addEventListener(
  "change",
  importCSVBackup
);


document.getElementById(
  "exportJSONBtn"
).addEventListener(
  "click",
  exportFullBackup
);


document.getElementById(
  "importJSONInput"
).addEventListener(
  "change",
  importFullBackup
);


function showToast(message) {

  const toast =
    document.getElementById(
      "toast"
    );


  toast.querySelector(
    "span"
  ).textContent =
    message;


  toast.classList.add(
    "show"
  );


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(
      () => {

        toast.classList.remove(
          "show"
        );

      },
      2200
    );
}


updateForm();
renderTimeline();
updateBackupCount();
