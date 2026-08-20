// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: light-brown; icon-glyph: heartbeat;
const fm = FileManager.iCloud();
const dir = fm.documentsDirectory();
const cachePath = fm.joinPath(dir, "health_data.json");

async function getHealthData() {
  if (!fm.fileExists(cachePath)) {
    return { error: "File not found. Run Shortcut." };
  }
  
  if (!fm.isFileDownloaded(cachePath)) {
    await fm.downloadFileFromiCloud(cachePath);
  }
  
  let rawStr = fm.readString(cachePath);
  try {
    return JSON.parse(rawStr);
  } catch (e) {
    return { error: "JSON Error. Check Dictionary." };
  }
}

const liveData = await getHealthData();
let widget = new ListWidget();
widget.backgroundColor = new Color("#1C1C1E"); 
widget.setPadding(14, 16, 14, 16); 

// Error Handling Display
if (liveData.error) {
  let errText = widget.addText(liveData.error);
  errText.textColor = Color.red();
  errText.font = Font.systemFont(14, 'bold');
  Script.setWidget(widget);
  widget.presentSmall();
  Script.complete();
  return;
}

// --- HEADER WITH TIMESTAMP ---
let headerStack = widget.addStack();
headerStack.layoutHorizontally();
headerStack.centerAlignContent(); 

let headerText = headerStack.addText("Health");
headerText.font = Font.systemFont(13, 'bold');
headerText.textColor = new Color("#32D74B"); 
headerStack.addSpacer(); 

let timeFormatter = new DateFormatter();
timeFormatter.useShortTimeStyle();
let dateObj = new Date(liveData.timestamp || Date.now());
let timeText = headerStack.addText(timeFormatter.string(dateObj));
timeText.font = Font.systemFont(10, 'regular');
timeText.textColor = new Color("#FAFA33"); 
widget.addSpacer(10); 


// --- DATA ROWS ---
const labelFont = Font.systemFont(9, 'medium');
const valueFont = Font.systemFont(9, 'bold'); 
const unitFont = Font.systemFont(9, 'regular');

function addRow(label, value, unit) {
  let row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  let l = row.addText(label);
  l.font = labelFont; l.textColor = new Color("#A9A9A9");
  row.addSpacer();
  let v = row.addText(value);
  v.font = valueFont; v.textColor = Color.white();
  if(unit){
    row.addSpacer(4);
    let u = row.addText(unit);
    u.font = unitFont; u.textColor = new Color("#A9A9A9");
  }
  widget.addSpacer(4);
  let sep = widget.addStack();
  sep.size = new Size(0, 1); sep.backgroundColor = new Color("#2C2C2E");
  widget.addSpacer(4);
}

function fmt(n) { return Number(n||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

// Strictly force SPO2 into a number to prevent the toFixed error
let spo2 = Number(liveData.spo2) || 0;
let fSpo2 = spo2 <= 1 ? (spo2 * 100) : spo2; 

addRow("STEPS", fmt(Math.round(liveData.steps || 0)), null);
addRow("CALORIES", Math.round(liveData.calories || 0).toString(), "kcal");
addRow("HEART RATE", Math.round(liveData.heartRate || 0).toString(), "bpm");
addRow("BLOOD OXYGEN", fSpo2.toFixed(2), "%"); 
addRow("WEIGHT", Number(liveData.weight || 0).toFixed(1), "kg"); 

widget.size = new Size(169, 169); 
Script.setWidget(widget);
widget.presentSmall();
Script.complete();