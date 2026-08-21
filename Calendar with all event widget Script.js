// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: calendar-alt;
// Scriptable: Dynamic Calendar & Events Medium Widget - Bounds Adjusted

// --- CONFIGURATION ---
const maxEvents = 5; 

// --- FETCH TODAY'S EVENTS ---
const today = new Date();
let allEvents = await CalendarEvent.today();

let upcomingEvents = allEvents
  .filter(e => !e.title.startsWith("Canceled:"))
  .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

// --- WIDGET SETUP ---
let widget = new ListWidget();
widget.backgroundColor = new Color("#1C1C1E"); 
// Reduced top and bottom padding to give more breathing room
widget.setPadding(12, 16, 12, 16); 

// Top spring to keep content pushed down from the ceiling
widget.addSpacer(); 

let mainStack = widget.addStack();
mainStack.layoutHorizontally();
mainStack.topAlignContent();

// ==========================================
// LEFT COLUMN: DATE & EVENTS
// ==========================================
let leftCol = mainStack.addStack();
leftCol.layoutVertically();
leftCol.size = new Size(150, 0); 

// 1. Header (Day Only)
let headerStack = leftCol.addStack();
headerStack.layoutHorizontally();
headerStack.centerAlignContent();

let dfDay = new DateFormatter();
dfDay.dateFormat = "E"; 
let dayText = headerStack.addText(dfDay.string(today).toUpperCase());
dayText.font = Font.systemFont(13, 'bold');
dayText.textColor = new Color("#FF453A"); 

headerStack.addSpacer(); 

leftCol.addSpacer(2);

// 2. Giant Date Number
let dfDate = new DateFormatter();
dfDate.dateFormat = "d"; 
let giantDate = leftCol.addText(dfDate.string(today));
giantDate.font = Font.systemFont(35, 'medium');
giantDate.textColor = Color.white();

leftCol.addSpacer(8);

// 3. Events List
if (upcomingEvents.length === 0) {
  let noEvents = leftCol.addText("No Events Today");
  noEvents.font = Font.systemFont(15, 'medium');
  noEvents.textColor = new Color("#8E8E93");
} else {
  let displayCount = Math.min(upcomingEvents.length, maxEvents);
  
  for (let i = 0; i < displayCount; i++) {
    let event = upcomingEvents[i];
    
    let eventRow = leftCol.addStack();
    eventRow.layoutHorizontally();
    eventRow.centerAlignContent();
    
    let colorIndicator = eventRow.addStack();
    colorIndicator.size = new Size(3, 12);
    colorIndicator.cornerRadius = 1.5;
    colorIndicator.backgroundColor = event.calendar.color;
    
    eventRow.addSpacer(6);
    
    let eventTitle = eventRow.addText(event.title);
    eventTitle.font = Font.systemFont(10, 'semibold');
    eventTitle.textColor = new Color("#EBEBF5");
    eventTitle.lineLimit = 1; 
    
    leftCol.addSpacer(6);
  }
}
// Removed the aggressive bottom spring here so it stops pushing up

// ==========================================
// MIDDLE GAP
// ==========================================
mainStack.addSpacer(16);

// ==========================================
// RIGHT COLUMN: CALENDAR GRID
// ==========================================
let rightCol = mainStack.addStack();
rightCol.layoutVertically();

const currentYear = today.getFullYear();
const currentMonth = today.getMonth();
const todayDate = today.getDate();

// 1. Month Header
let monthFormatter = new DateFormatter();
monthFormatter.dateFormat = "MMMM"; 
let monthName = monthFormatter.string(today).toUpperCase();

let monthStack = rightCol.addStack();
let monthText = monthStack.addText(monthName);
monthText.font = Font.systemFont(13, 'bold');
monthText.textColor = new Color("#FF453A"); 

// Slightly reduced gap to save vertical space
rightCol.addSpacer(6);

// 2. Day Header Row (S M T W T F S)
const dayLetters = ["S", "M", "T", "W", "T", "F", "S"];
let daysHeaderRow = rightCol.addStack();
daysHeaderRow.layoutHorizontally();

for (let d of dayLetters) {
  let dayStack = daysHeaderRow.addStack();
  dayStack.size = new Size(20, 14);
  let dt = dayStack.addText(d);
  dt.font = Font.systemFont(11, 'medium');
  dt.textColor = new Color("#8E8E93");
  dt.centerAlignText();
}

rightCol.addSpacer(4);

// 3. Calendar Grid
let firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
let daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
let dayCounter = 1;
let totalWeeks = Math.ceil((firstDayOfWeek + daysInMonth) / 7);

for (let week = 0; week < totalWeeks; week++) {
  let weekRow = rightCol.addStack();
  weekRow.layoutHorizontally();

  for (let col = 0; col < 7; col++) {
    let dayCell = weekRow.addStack();
    // Slightly reduced cell height to perfectly fit the boundaries
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
  rightCol.addSpacer(1);
}
// Removed the aggressive bottom spring here as well

// Bottom spring to hold the content safely away from the bottom edge
widget.addSpacer(); 

// --- PRESENT WIDGET ---
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  widget.presentMedium();
}

Script.complete();