const fs = require("fs");

function timeToSeconds(timeStr) {
  timeStr = timeStr.trim().toLowerCase();
  const period = timeStr.includes("am") ? "am" : "pm";
  const timePart = timeStr.replace("am", "").replace("pm", "").trim();

  let [hours, minutes, seconds] = timePart.split(":").map(Number);

  if (period === "am") {
    if (hours === 12) hours = 0; // 12:xx am → 0:xx (midnight)
  } else {
    if (hours !== 12) hours += 12; // 1–11 pm → 13–23; 12 pm stays 12
  }

  return hours * 3600 + minutes * 60 + seconds;
}

function secondsToHMS(totalSeconds) {
  totalSeconds = Math.abs(totalSeconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return `${h}:${mm}:${ss}`;
}


function hmsToSeconds(hmsStr) {
  const [h, m, s] = hmsStr.trim().split(":").map(Number);
  return h * 3600 + m * 60 + s;
}
function getDayName(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][date.getDay()];
}
function isEidDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return year === 2025 && month === 4 && day >= 10 && day <= 30;
}
// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================

function getShiftDuration(startTime, endTime) {
    const startSeconds = timeToSeconds(startTime);
  const endSeconds = timeToSeconds(endTime);
  const diff = endSeconds - startSeconds;
  return secondsToHMS(diff);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
 
function getIdleTime(startTime, endTime) {
    const DELIVERY_START = 8 * 3600; 
  const DELIVERY_END   = 22 * 3600;  

  const shiftStart = timeToSeconds(startTime);
  const shiftEnd   = timeToSeconds(endTime);

  let idleSeconds = 0;

  if (shiftStart < DELIVERY_START) {
    const earlyEnd = Math.min(shiftEnd, DELIVERY_START);
    idleSeconds += earlyEnd - shiftStart;
  }

  if (shiftEnd > DELIVERY_END) {
    const lateStart = Math.max(shiftStart, DELIVERY_END);
    idleSeconds += shiftEnd - lateStart;
  }

  return secondsToHMS(idleSeconds);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================

function getActiveTime(shiftDuration, idleTime) {
  const shiftSeconds = hmsToSeconds(shiftDuration);
  const idleSeconds  = hmsToSeconds(idleTime);
  const activeSeconds = shiftSeconds - idleSeconds;
  return secondsToHMS(activeSeconds);
}
// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================

function metQuota(date, activeTime) {
  const NORMAL_QUOTA = 8 * 3600 + 24 * 60; 
  const EID_QUOTA    = 6 * 3600;            

  const [year, month, day] = date.split("-").map(Number);
  const isEid =
    year === 2025 &&
    month === 4 &&
    day >= 10 &&
    day <= 30;

  const requiredSeconds = isEid ? EID_QUOTA : NORMAL_QUOTA;
  const activeSeconds   = hmsToSeconds(activeTime);

  return activeSeconds >= requiredSeconds;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================

    function addShiftRecord(textFile, shiftObj) {
  const { driverID, driverName, date, startTime, endTime } = shiftObj;

  const raw   = fs.readFileSync(textFile, "utf8");
  
  const lines = raw.trim() === "" ? [] : raw.trim().split("\n");

  
  for (const line of lines) {
    const cols = line.split(",");
    if (cols[0].trim() === driverID && cols[2].trim() === date) {
      return {};
    }
  }

  const shiftDuration = getShiftDuration(startTime, endTime);
  const idleTime      = getIdleTime(startTime, endTime);
  const activeTime    = getActiveTime(shiftDuration, idleTime);
  const quota         = metQuota(date, activeTime);
  const hasBonus      = false;

  const newRow = [
    driverID, driverName, date,
    startTime.trim(), endTime.trim(),
    shiftDuration, idleTime, activeTime,
    quota, hasBonus
  ].join(",");

  let lastIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].split(",")[0].trim() === driverID) {
      lastIdx = i;
    }
  }

  if (lastIdx === -1) {
    
    lines.push(newRow);
  } else {
    
    lines.splice(lastIdx + 1, 0, newRow);
  }

  fs.writeFileSync(textFile, lines.join("\n") + "\n", "utf8");

  return {
    driverID,
    driverName,
    date,
    startTime: startTime.trim(),
    endTime: endTime.trim(),
    shiftDuration,
    idleTime,
    activeTime,
    metQuota: quota,
    hasBonus,
  };
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
  const lines = fs.readFileSync(textFile, "utf8").trim().split("\n");

  const updated = lines.map((line) => {
    const cols = line.split(",");
    if (cols[0].trim() === driverID && cols[2].trim() === date) {
      cols[9] = String(newValue); 
      return cols.join(",");
    }
    return line;
  });

  fs.writeFileSync(textFile, updated.join("\n") + "\n", "utf8");
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
  const targetMonth = parseInt(month, 10); // normalise "04" → 4
  const lines = fs.readFileSync(textFile, "utf8").trim().split("\n");

  let driverExists = false;
  let count = 0;

  for (const line of lines) {
    if (line.trim() === "") continue;
    const cols = line.split(",");
    if (cols[0].trim() !== driverID) continue;

    driverExists = true;

    const recordMonth = parseInt(cols[2].trim().split("-")[1], 10);
    if (recordMonth !== targetMonth) continue;

    if (cols[9].trim().toLowerCase() === "true") count++;
  }

  return driverExists ? count : -1;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
  const lines = fs.readFileSync(textFile, "utf8").trim().split("\n");

  let totalSeconds = 0;

  for (const line of lines) {
    if (line.trim() === "") continue;
    const cols = line.split(",");
    if (cols[0].trim() !== driverID) continue;

    const recordMonth = parseInt(cols[2].trim().split("-")[1], 10);
    if (recordMonth !== month) continue;

    totalSeconds += hmsToSeconds(cols[7].trim()); 
  }

  return secondsToHMS(totalSeconds);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
  const NORMAL_QUOTA = 8 * 3600 + 24 * 60; 
  const EID_QUOTA    = 6 * 3600;            

  const rateLines = fs.readFileSync(rateFile, "utf8").trim().split("\n");
  let dayOff = null;
  for (const line of rateLines) {
    if (line.trim() === "") continue;
    const cols = line.split(",");
    if (cols[0].trim() === driverID) {
      dayOff = cols[1].trim(); 
      break;
    }
  }const shiftLines = fs.readFileSync(textFile, "utf8").trim().split("\n");

  let totalRequired = 0;

  for (const line of shiftLines) {
    if (line.trim() === "") continue;
    const cols = line.split(",");
    if (cols[0].trim() !== driverID) continue;

    const dateStr     = cols[2].trim();
    const recordMonth = parseInt(dateStr.split("-")[1], 10);
    if (recordMonth !== month) continue;

    const dayName = getDayName(dateStr);
    if (dayOff && dayName === dayOff) continue;

    const quota = isEidDate(dateStr) ? EID_QUOTA : NORMAL_QUOTA;
    totalRequired += quota;
  }

  const bonusDeduction = bonusCount * 2 * 3600;
  totalRequired = Math.max(0, totalRequired - bonusDeduction);

  return secondsToHMS(totalRequired);
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
  const TIER_ALLOWANCE = { 1: 50, 2: 20, 3: 10, 4: 3 };

  const rateLines = fs.readFileSync(rateFile, "utf8").trim().split("\n");
  let basePay = 0;
  let tier    = 0;
  for (const line of rateLines) {
    if (line.trim() === "") continue;
    const cols = line.split(",");
    if (cols[0].trim() === driverID) {
      basePay = parseInt(cols[2].trim(), 10);
      tier    = parseInt(cols[3].trim(), 10);
      break;
    }
  }

  const actualSeconds   = hmsToSeconds(actualHours);
  const requiredSeconds = hmsToSeconds(requiredHours);

  if (actualSeconds >= requiredSeconds) return basePay;

  const missingSeconds  = requiredSeconds - actualSeconds;
  const missingHours    = missingSeconds / 3600; 

  const allowance       = TIER_ALLOWANCE[tier] || 0;
  const billableHours   = Math.max(0, missingHours - allowance);
  const billableFullHrs = Math.floor(billableHours); 

  const deductionRate   = Math.floor(basePay / 185);
  const deduction       = billableFullHrs * deductionRate;

  return basePay - deduction;
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
