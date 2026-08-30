// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: purple; icon-glyph: magic;
// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: dark-gray; icon-glyph: chart-pie;

const fm = FileManager.iCloud();
const dir = fm.documentsDirectory();
const cachePath = fm.joinPath(dir, "health_data.json");

// ==========================================
// 1. SMART BACKGROUND REFRESH LOGIC
// ==========================================
const today = new Date();
let nextRefresh = new Date();
let dOfWeek = today.getDay(); 
let hOfDay = today.getHours();

// Weekdays 6 AM to 9 AM (Global Market)
let isGlobalTime = (dOfWeek >= 1 && dOfWeek <= 5 && hOfDay >= 6 && hOfDay < 9);
// Weekdays 9 AM to 4 PM (Nifty 50)
let isMarketHours = (dOfWeek >= 1 && dOfWeek <= 5 && hOfDay >= 9 && hOfDay < 16); 
let isTrackingActive = (isMarketHours || isGlobalTime);

if (isMarketHours) {
  // 15-minute refresh during Nifty market hours
  nextRefresh = new Date(today.getTime() + 15 * 60000);
} else if (isGlobalTime) {
  // 30-minute refresh during Global market hours
  nextRefresh = new Date(today.getTime() + 30 * 60000);
} else {
  // 3-hour refresh for Health/Calendar data (Weekends & Off-hours)
  nextRefresh = new Date(today.getTime() + 3 * 60 * 60000); 
}

// ==========================================
// 2. DATA FETCHING
// ==========================================
async function getSingleGlobalIndex(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    let req = new Request(url);
    req.headers = { "User-Agent": "Mozilla/5.0" };
    
    let res = await req.loadJSON();
    let meta = res.chart.result[0].meta;
    let currentPrice = meta.regularMarketPrice;
    let prevClose = meta.chartPreviousClose || meta.previousClose;
    let diff = currentPrice - prevClose;
    let pct = (diff / prevClose) * 100;
    
    return {
      symbol: symbol,
      regularMarketPrice: currentPrice,
      regularMarketChange: diff,
      regularMarketChangePercent: pct
    };
  } catch (e) {
    return { symbol: symbol, error: true };
  }
}

async function getGlobalIndices() {
  const symbols = ["^DJI", "^N225", "^IXIC", "^KS11", "^HSI", "S68.SI"];
  const promises = symbols.map(sym => getSingleGlobalIndex(sym));
  return await Promise.all(promises);
}

async function getStockData(symbol = "^NSEI") {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
    let req = new Request(url);
    req.headers = { "User-Agent": "Mozilla/5.0" };
    
    let res = await req.loadJSON();
    let result = res.chart.result[0];
    let meta = result.meta;
    let currentPrice = meta.regularMarketPrice;
    let prevClose = meta.chartPreviousClose || meta.previousClose;
    let diff = currentPrice - prevClose;
    let pct = (diff / prevClose) * 100;
    
    let rawQuotes = result.indicators.quote[0].close || [];
    let rawTimestamps = result.timestamp || [];
    
    let points = [];
    let timestamps = [];
    
    for (let i = 0; i < rawQuotes.length; i++) {
      if (rawQuotes[i] !== null && rawQuotes[i] !== undefined) {
        points.push(rawQuotes[i]);
        timestamps.push(rawTimestamps[i]);
      }
    }

    return {
      symbol: symbol,
      shortName: "NIFTY 50",
      price: currentPrice,
      prevClose: prevClose,
      diff: diff,
      pct: pct,
      points: points,
      timestamps: timestamps
    };
  } catch (e) {
    return null;
  }
}

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

// ==========================================
// 3. GENERATORS (CHART)
// ==========================================
function drawAdvancedChart(points, timestamps, prevClose, isPositive, width = 300, height = 70) {
  let dc = new DrawContext();
  dc.size = new Size(width, height);
  dc.opaque = false;
  dc.respectScreenScale = true;

  if (!points || points.length < 2) return dc.getImage();

  let chartW = width - 42; 
  let chartH = height - 14; 

  let min = Math.min(...points, prevClose);
  let max = Math.max(...points, prevClose);
  let range = (max - min) || 1;
  let pad = range * 0.15; 
  min -= pad; max += pad;
  range = max - min;

  let lineColor = isPositive ? new Color("#30D158") : new Color("#FF453A");
  let fillColor = isPositive ? new Color("#30D158", 0.15) : new Color("#FF453A", 0.15);
  let gridColor = new Color("#ffffff", 0.08); 
  let textColor = new Color("#8E8E93");
  let font = Font.systemFont(8, 'medium');
  dc.setFont(font);
  dc.setTextColor(textColor);

  let steps = 3;
  for (let i = 0; i <= steps; i++) {
    let val = min + (range * (i / steps));
    let y = chartH - ((val - min) / range) * chartH;
    let p = new Path();
    p.move(new Point(0, y));
    p.addLine(new Point(chartW, y));
    dc.addPath(p);
    dc.setStrokeColor(gridColor);
    dc.setLineWidth(1);
    dc.strokePath();
    let labelVal = Math.round(val).toLocaleString('en-IN');
    dc.drawTextInRect(labelVal, new Rect(chartW + 6, y - 5, 36, 12));
  }

  let targetHours = [10, 12, 14]; 
  let drawnHours = new Set();
  timestamps.forEach((ts, i) => {
    let d = new Date(ts * 1000);
    let h = d.getHours();
    if (targetHours.includes(h) && !drawnHours.has(h)) {
      drawnHours.add(h);
      let x = (i / (points.length - 1)) * chartW;
      let p = new Path();
      p.move(new Point(x, 0));
      p.addLine(new Point(x, chartH));
      dc.addPath(p);
      dc.setStrokeColor(gridColor);
      dc.setLineWidth(1);
      dc.strokePath();
      let ampm = h >= 12 ? 'PM' : 'AM';
      let displayH = h > 12 ? h - 12 : h;
      dc.drawTextInRect(`${displayH} ${ampm}`, new Rect(x + 4, chartH + 2, 35, 12));
    }
  });

  let prevY = chartH - ((prevClose - min) / range) * chartH;
  let dashPath = new Path();
  for (let x = 0; x < chartW; x += 6) {
    dashPath.move(new Point(x, prevY));
    dashPath.addLine(new Point(x + 3, prevY));
  }
  dc.addPath(dashPath);
  dc.setStrokeColor(new Color("#8E8E93", 0.6));
  dc.setLineWidth(1);
  dc.strokePath();

  let path = new Path();
  let fillPath = new Path();
  fillPath.move(new Point(0, chartH));
  points.forEach((val, i) => {
    let x = (i / (points.length - 1)) * chartW;
    let y = chartH - ((val - min) / range) * chartH;
    let pt = new Point(x, y);
    if (i === 0) { path.move(pt); fillPath.addLine(pt); }
    else { path.addLine(pt); fillPath.addLine(pt); }
  });
  fillPath.addLine(new Point(chartW, chartH));
  fillPath.closeSubpath();
  
  dc.addPath(fillPath);
  dc.setFillColor(fillColor);
  dc.fillPath();

  dc.addPath(path);
  dc.setStrokeColor(lineColor);
  dc.setLineWidth(2.5);
  dc.strokePath();

  return dc.getImage();
}

// ==========================================
// 4. MAIN WIDGET LAYOUT INITIALIZATION
// ==========================================
let widget = new ListWidget();
widget.backgroundColor = new Color("#1C1C1E"); 
widget.setPadding(16, 16, 16, 16); 
widget.refreshAfterDate = nextRefresh;

const liveData = await getHealthData();

// ==========================================
// TOP HALF: GLOBAL INDICES (6AM-9AM) OR NIFTY (9AM-4PM)
// ==========================================
let topContainer = widget.addStack();
topContainer.layoutVertically();

if (isGlobalTime) {
  // 6:00 AM to 8:59 AM - Global Indices View
  const globalData = await getGlobalIndices();
  
  function addIndexCell(rowStack, item) {
    let cell = rowStack.addStack();
    cell.layoutVertically();
    cell.size = new Size(135, 0); 

    if (!item || item.error) {
       let errTxt = cell.addText("Unavailable");
       errTxt.textColor = new Color("#8E8E93");
       errTxt.font = Font.systemFont(12, 'medium');
       return cell;
    }
    
    let topRow = cell.addStack();
    topRow.layoutHorizontally();
    let isPos = item.regularMarketChange >= 0;
    let color = isPos ? new Color("#30D158") : new Color("#FF453A");
    let sign = isPos ? "+" : "";
    
    let titleName = item.symbol;
    if (item.symbol === "^DJI") titleName = "Dow Jones";
    if (item.symbol === "^IXIC") titleName = "NASDAQ";
    if (item.symbol === "^KS11") titleName = "KOSPI.KS";
    
    let symTxt = topRow.addText(`${isPos ? '▲' : '▼'} ${titleName}`);
    symTxt.font = Font.systemFont(13, 'bold');
    symTxt.textColor = Color.white();
    symTxt.lineLimit = 1;
    topRow.addSpacer();
    
    let changeTxt = topRow.addText(`${sign}${item.regularMarketChange.toFixed(2)}`);
    changeTxt.font = Font.systemFont(13, 'medium');
    changeTxt.textColor = color;
    
    cell.addSpacer(2);
    
    let botRow = cell.addStack();
    botRow.layoutHorizontally();
    let priceTxt = botRow.addText(`${Math.round(item.regularMarketPrice).toLocaleString('en-US')}`);
    priceTxt.font = Font.systemFont(12, 'regular');
    priceTxt.textColor = Color.white();
    botRow.addSpacer();
    
    let pctTxt = botRow.addText(`${sign}${item.regularMarketChangePercent.toFixed(2)}%`);
    pctTxt.font = Font.systemFont(12, 'bold');
    pctTxt.textColor = color;
    
    return cell;
  }

  if (globalData && globalData.length > 0 && !globalData[0].error) {
    for (let i = 0; i < 3; i++) {
      let gridRow = topContainer.addStack();
      gridRow.layoutHorizontally();
      
      let leftItem = globalData[i * 2];
      let rightItem = globalData[i * 2 + 1];
      
      addIndexCell(gridRow, leftItem);
      gridRow.addSpacer();
      addIndexCell(gridRow, rightItem);
      
      if (i < 2) {
        topContainer.addSpacer(8);
        let div = topContainer.addStack();
        div.size = new Size(0, 1);
        div.backgroundColor = new Color("#2C2C2E", 0.5);
        topContainer.addSpacer(8);
      }
    }
  } else {
    let errStack = topContainer.addStack();
    errStack.layoutVertically();
    errStack.centerAlignContent();
    errStack.size = new Size(0, 145); 
    let icon = errStack.addText("📡");
    icon.font = Font.systemFont(24, 'regular');
    icon.centerAlignText();
    errStack.addSpacer(6);
    let err = errStack.addText("Global Data Unavailable");
    err.textColor = new Color("#8E8E93");
    err.font = Font.systemFont(13, 'medium');
    err.centerAlignText();
  }

} else {
  // 9:00 AM onwards - Nifty 50 & India VIX View
  const [stockData, vixData] = await Promise.all([
    getStockData("^NSEI"),
    getSingleGlobalIndex("^INDIAVIX")
  ]);
  
  if (stockData) {
    let isPositive = stockData.diff >= 0;
    let accentColor = isPositive ? new Color("#30D158") : new Color("#FF453A");
    let sign = isPositive ? "+" : "";

    let headerRow = topContainer.addStack();
    headerRow.layoutHorizontally();
    headerRow.centerAlignContent();

    let leftHeader = headerRow.addStack();
    leftHeader.layoutVertically();
    
    // ROW 1: NIFTY 50 and absolute value change
    let titleRow1 = leftHeader.addStack();
    titleRow1.layoutHorizontally();
    titleRow1.centerAlignContent();

    let symStack = titleRow1.addStack();
    symStack.size = new Size(82, 0); 
    let sym = symStack.addText(`${isPositive ? '▲' : '▼'} NIFTY 50`);
    sym.font = Font.systemFont(13, 'bold');
    sym.textColor = Color.white();
    sym.lineLimit = 1;
    sym.minimumScaleFactor = 0.8;
    
    let diffTextVal = titleRow1.addText(`${sign}${stockData.diff.toFixed(2)}`);
    diffTextVal.font = Font.systemFont(13, 'bold');
    diffTextVal.textColor = accentColor;
    diffTextVal.lineLimit = 1;
    diffTextVal.minimumScaleFactor = 0.8; 

    leftHeader.addSpacer(4);

    // ROW 2: INDIA VIX and full values
    let titleRow2 = leftHeader.addStack();
    titleRow2.layoutHorizontally();
    titleRow2.centerAlignContent();
    
    let vArrow = "";
    if (vixData && !vixData.error) {
      vArrow = vixData.regularMarketChange >= 0 ? "▲ " : "▼ ";
    }

    let nameStack = titleRow2.addStack();
    nameStack.size = new Size(82, 0); 
    let nameText = nameStack.addText(`${vArrow}INDIA VIX`);
    nameText.font = Font.systemFont(12, 'medium');
    nameText.textColor = new Color("#8E8E93");
    nameText.lineLimit = 1;
    nameText.minimumScaleFactor = 0.8;
    
    if (vixData && !vixData.error) {
      let vSign = vixData.regularMarketChange >= 0 ? '+' : '';
      let vColor = vixData.regularMarketChange >= 0 ? new Color("#30D158") : new Color("#FF453A");
      
      let vixTxt = titleRow2.addText(`${vixData.regularMarketPrice.toFixed(2)}   ${vSign}${vixData.regularMarketChange.toFixed(2)}`);
      vixTxt.font = Font.systemFont(12, 'medium');
      vixTxt.textColor = vColor;
      vixTxt.lineLimit = 1;
      vixTxt.minimumScaleFactor = 0.8; 
    } else {
      let errTxt = titleRow2.addText("Unavailable");
      errTxt.font = Font.systemFont(12, 'medium');
      errTxt.textColor = new Color("#8E8E93");
    }

    headerRow.addSpacer();

    let rightHeader = headerRow.addStack();
    rightHeader.layoutVertically();

    let priceRow = rightHeader.addStack();
    priceRow.layoutHorizontally();
    priceRow.addSpacer(); 
    function fmtPrice(p) { return Math.round(p).toLocaleString('en-IN'); }
    let priceText = priceRow.addText(fmtPrice(stockData.price));
    priceText.font = Font.systemFont(24, 'semibold'); 
    priceText.textColor = Color.white();

    rightHeader.addSpacer(2);

    let timeRow = rightHeader.addStack();
    timeRow.layoutHorizontally();
    timeRow.addSpacer(); 
    let timeFormatter = new DateFormatter();
    timeFormatter.useShortTimeStyle();
    let timeStr = `Updated: ${timeFormatter.string(today)}`;
    if (!isTrackingActive) timeStr += " (Closed)";
    let updateText = timeRow.addText(timeStr);
    updateText.font = Font.systemFont(9, 'medium');
    updateText.textColor = new Color("#5A5A5E"); 
    updateText.textOpacity = 0.8;

    topContainer.addSpacer(12);

    let chartWidth = 322;
    let chartHeight = 102; 
    let chartImg = drawAdvancedChart(stockData.points, stockData.timestamps, stockData.prevClose, isPositive, chartWidth, chartHeight);
    let chartStack = topContainer.addImage(chartImg);
    chartStack.imageSize = new Size(chartWidth, chartHeight);
    chartStack.centerAlignImage();
    
  } else {
    let errStack = topContainer.addStack();
    errStack.layoutVertically();
    errStack.centerAlignContent();
    errStack.size = new Size(0, 160); 
    let icon = errStack.addText("📡");
    icon.font = Font.systemFont(24, 'regular');
    icon.centerAlignText();
    errStack.addSpacer(6);
    let err = errStack.addText("Nifty Data Unavailable");
    err.textColor = new Color("#8E8E93");
    err.font = Font.systemFont(13, 'medium');
    err.centerAlignText();
  }
}

// ------------------------------------------
// DIVIDER BETWEEN SECTIONS
// ------------------------------------------
widget.addSpacer(5); 
let divider = widget.addStack();
divider.size = new Size(0, 1);
divider.backgroundColor = new Color("#2C2C2E");
widget.addSpacer(5);

// ==========================================
// BOTTOM HALF: CALENDAR & HEALTH DATA
// ==========================================
let bottomStack = widget.addStack();
bottomStack.layoutHorizontally();
bottomStack.topAlignContent();

// --- LEFT COLUMN: CALENDAR ---
let calendarCol = bottomStack.addStack();
calendarCol.layoutVertically();

const currentYear = today.getFullYear();
const currentMonth = today.getMonth();
const todayDate = today.getDate();

let calHeader = calendarCol.addStack();
calHeader.layoutHorizontally();
calHeader.centerAlignContent(); 

let monthFormatter = new DateFormatter();
monthFormatter.dateFormat = " MMMM";
let monthName = monthFormatter.string(today).toUpperCase();

let monthText = calHeader.addText(monthName);
monthText.font = Font.systemFont(13, 'bold');
monthText.textColor = new Color("#FF453A"); 
calHeader.addSpacer(); 
calendarCol.addSpacer(8);

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
calendarCol.addSpacer(6);

let firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
let daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

let dayCounter = 1;
let totalWeeks = Math.ceil((firstDayOfWeek + daysInMonth) / 7);

for (let week = 0; week < totalWeeks; week++) {
  let weekRow = calendarCol.addStack();
  weekRow.layoutHorizontally();

  for (let col = 0; col < 7; col++) {
    let dayCell = weekRow.addStack();
    dayCell.size = new Size(20, 18);
    dayCell.centerAlignContent();

    let cellIndex = week * 7 + col;
    if (cellIndex >= firstDayOfWeek && dayCounter <= daysInMonth) {
      let isToday = (dayCounter === todayDate);

      if (isToday) {
        dayCell.cornerRadius = 9;
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
  calendarCol.addSpacer(2);
}

// --- MIDDLE GAP ---
bottomStack.addSpacer(15); 

// --- RIGHT COLUMN: HEALTH METRICS ---
let healthCol = bottomStack.addStack();
healthCol.layoutVertically();
healthCol.addSpacer(19); 

let healthHeader = healthCol.addStack();
healthHeader.layoutHorizontally();
healthHeader.centerAlignContent();

let titleText = healthHeader.addText("Workout");
titleText.font = Font.systemFont(14, 'semibold');
titleText.textColor = new Color("#32D74B"); 
healthHeader.addSpacer();
healthCol.addSpacer(8);

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

  healthCol.addSpacer(3);
  let sep = healthCol.addStack();
  sep.size = new Size(0, 1);
  sep.backgroundColor = new Color("#2C2C2E");
  healthCol.addSpacer(3);
}

function fmt(n) { return Number(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

let stepsCount = Math.round(liveData.steps || 0);

if (stepsCount === 0) {
  healthCol.addSpacer(10);
  let noWorkoutText = healthCol.addText("No workout today ");
  noWorkoutText.font = Font.systemFont(12, 'medium');
  noWorkoutText.textColor = new Color("#8E8E93");
} else {
  let spo2 = Number(liveData.spo2) || 0;
  let fSpo2 = spo2 <= 1 ? (spo2 * 100) : spo2;

  addHealthRow("STEPS", fmt(stepsCount), null);
  addHealthRow("CALORIES", Math.round(liveData.calories || 0).toString(), "kcal");
  addHealthRow("HEART RATE", Math.round(liveData.heartRate || 0).toString(), "bpm");
  addHealthRow("BLOOD OXYGEN", fSpo2.toFixed(2), "%");
  addHealthRow("WEIGHT", Number(liveData.weight || 0).toFixed(1), "kg");
}

// Add Last Updated Timestamp for Health
healthCol.addSpacer(5);
let hTimeRow = healthCol.addStack();
hTimeRow.layoutHorizontally();
hTimeRow.addSpacer(); 

let healthTimeObj = today;
if (liveData.timestamp) {
  healthTimeObj = new Date(liveData.timestamp);
} else {
  try { healthTimeObj = fm.modificationDate(cachePath) || today; } catch(e) {}
}

let hTimeFmt = new DateFormatter();
hTimeFmt.useShortTimeStyle();
let hUpdateText = hTimeRow.addText(`Updated: ${hTimeFmt.string(healthTimeObj)}`);
hUpdateText.font = Font.systemFont(8, 'medium');
hUpdateText.textColor = new Color("#5A5A5E");
hUpdateText.textOpacity = 0.8;

// ==========================================
// 5. PRESENT WIDGET
// ==========================================
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  widget.presentLarge();
}

Script.complete();