// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: teal; icon-glyph: magic;
// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: pink; icon-glyph: magic;
const fm = FileManager.iCloud();
const dir = fm.documentsDirectory();
const cachePath = fm.joinPath(dir, "health_data.json");

// --- 1. FETCH HEALTH DATA ---
async function getHealthData() {
  if (!fm.fileExists(cachePath)) {
    return { error: "Run Shortcut" };
  }
  if (!fm.isFileDownloaded(cachePath)) {
    await fm.downloadFileFromiCloud(cachePath);
  }
  try {
    let rawStr = fm.readString(cachePath);
    return JSON.parse(rawStr);
  } catch (e) {
    return { error: "JSON Error" };
  }
}

const liveData = await getHealthData();

// --- 2. WIDGET SETUP ---
let widget = new ListWidget();
widget.backgroundColor = new Color("#1C1C1E"); 
// Reduced top/bottom padding to give the content more breathing room
widget.setPadding(12, 16, 12, 16); 

// Top spring to keep content pushed down from the ceiling
widget.addSpacer(); 

let contentStack = widget.addStack();
contentStack.layoutHorizontally();
contentStack.topAlignContent(); 

// ==========================================
// LEFT COLUMN: CALENDAR
// ==========================================
let calendarCol = contentStack.addStack();
calendarCol.layoutVertically();

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth();
const todayDate = now.getDate();
calendarCol.addSpacer(5);
// Calendar Header
let calHeader = calendarCol.addStack();
calHeader.layoutHorizontally();
calHeader.centerAlignContent(); 

let monthFormatter = new DateFormatter();
monthFormatter.dateFormat = " MMMM";
let monthName = monthFormatter.string(now).toUpperCase();

let monthText = calHeader.addText(monthName);
monthText.font = Font.systemFont(13, 'bold');
monthText.textColor = new Color("#FF453A"); 

calHeader.addSpacer(); 

// Reduced gap below the header
calendarCol.addSpacer(5);

// Day Header Row (S M T W T F S)
const dayLetters = ["S", "M", "T", "W", "T", "F", "S"];
let daysHeaderRow = calendarCol.addStack();
daysHeaderRow.layoutHorizontally();

for (let d of dayLetters) {
  let dayStack = daysHeaderRow.addStack();
  dayStack.size = new Size(20, 14);
  let dt = dayStack.addText(d);
  dt.font = Font.systemFont(11, 'regular');
  dt.textColor = new Color("#8E8E93");
  dt.centerAlignText();
}

// Reduced gap below the days row
calendarCol.addSpacer(4);

// Generate Calendar Days Grid
let firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
let daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

let dayCounter = 1;
let totalWeeks = Math.ceil((firstDayOfWeek + daysInMonth) / 7);

for (let week = 0; week < totalWeeks; week++) {
  let weekRow = calendarCol.addStack();
  weekRow.layoutHorizontally();

  for (let col = 0; col < 7; col++) {
    let dayCell = weekRow.addStack();
    // Slightly reduced cell height to prevent vertical overflow
    dayCell.size = new Size(20, 16);
    dayCell.centerAlignContent();

    let cellIndex = week * 7 + col;
    if (cellIndex >= firstDayOfWeek && dayCounter <= daysInMonth) {
      let isToday = (dayCounter === todayDate);

      if (isToday) {
        dayCell.cornerRadius = 8;
        dayCell.backgroundColor = new Color("#FF453A"); 
      }

      let dateNumber = dayCell.addText(dayCounter.toString());
      dateNumber.font = Font.systemFont(11, isToday ? 'bold' : 'medium');
      dateNumber.textColor = Color.white();
      dateNumber.centerAlignText();

      dayCounter++;
    } else {
      let emptyText = dayCell.addText("");
      emptyText.font = Font.systemFont(11, 'regular');
    }
  }
  // Reduced gap between weeks
  calendarCol.addSpacer(1);
}

// ==========================================
// MIDDLE GAP
// ==========================================
contentStack.addSpacer(5); 

// ==========================================
// RIGHT COLUMN: HEALTH METRICS
// ==========================================
let healthCol = contentStack.addStack();
healthCol.layoutVertically();
healthCol.addSpacer(22);
// Health Header
let healthHeader = healthCol.addStack();
healthHeader.layoutHorizontally();
healthHeader.centerAlignContent();

let titleText = healthHeader.addText("Workout");
titleText.font = Font.systemFont(14, 'semibold');
titleText.textColor = new Color("#32D74B"); 

healthHeader.addSpacer();

// Matches the space below the calendar header
healthCol.addSpacer(5);

// Helper for Health Metric Rows
function addHealthRow(label, value, unit) {
  let row = healthCol.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();

  let l = row.addText(label);
  l.font = Font.systemFont(10, 'medium');
  l.textColor = new Color("#8E8E93");
  row.addSpacer();

  let v = row.addText(value);
  v.font = Font.systemFont(11, 'semibold'); 
  v.textColor = Color.white();

  if (unit) {
    row.addSpacer(3);
    let u = row.addText(unit);
    u.font = Font.systemFont(11, 'regular');
    u.textColor = new Color("#8E8E93");
  }

  // Reduced padding around the separator lines
  healthCol.addSpacer(2);
  let sep = healthCol.addStack();
  sep.size = new Size(0, 1);
  sep.backgroundColor = new Color("#2C2C2E");
  healthCol.addSpacer(2);
}

function fmt(n) { return Number(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

let spo2 = Number(liveData.spo2) || 0;
let fSpo2 = spo2 <= 1 ? (spo2 * 100) : spo2;

addHealthRow("STEPS", fmt(Math.round(liveData.steps || 0)), null);
addHealthRow("CALORIES", Math.round(liveData.calories || 0).toString(), "kcal");
addHealthRow("HEART RATE", Math.round(liveData.heartRate || 0).toString(), "bpm");
addHealthRow("BLOOD OXYGEN", fSpo2.toFixed(2), "%");
addHealthRow("WEIGHT", Number(liveData.weight || 0).toFixed(1), "kg");

// Bottom spring to push the content safely away from the bottom edge
widget.addSpacer(); 

// --- 3. PRESENT WIDGET ---
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  widget.presentMedium();
}

Script.complete();