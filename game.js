// =======================
// GAME STATE
// =======================
let money = 1000;
let day = 1;
const maxDays = 7;
let popularity = 50; // 0~100

// time: 08:00 ~ 16:00 (1 game hour = 10 real seconds)
let hour = 8;
let minute = 0;
let clockTimer = null;
let dayRunning = false;
let skipAvailable = false;

// menu data
const menuItems = [
  { id: "burger",  emoji: "🍔", name: "Burger",  basePrice: 19.99, price: 19.99, weight: 1.2 },
  { id: "fries",   emoji: "🍟", name: "Fries",   basePrice: 2.99,  price: 2.99,  weight: 0.8 },
  { id: "pizza",   emoji: "🍕", name: "Pizza",   basePrice: 14.99, price: 14.99, weight: 1.3 },
  { id: "chicken", emoji: "🍗", name: "Chicken", basePrice: 12.99, price: 12.99, weight: 1.4 },
  { id: "hotdog",  emoji: "🌭", name: "Hotdog",  basePrice: 4.99,  price: 4.99,  weight: 1.0 },
  { id: "soda",    emoji: "🥤", name: "Soda",    basePrice: 1.99,  price: 1.99,  weight: 0.5 }
];

// per-day stats
let todaysCustomers = 0;
let todaysIncome = 0;
let todaysMeals = 0;
let todaysGood = 0;
let todaysBad = 0;

// total stats
let totalCustomers = 0;
let totalIncome = 0;
let totalMeals = 0;
let bestDayIncome = 0;

// planned customers for day (target)
let plannedCustomers = 0;
let spawnedCustomers = 0;

// arrays for graph (per-day)
let dailyIncome = [];
let dailyPopularity = [];

let gameOver = false;

// =======================
// DOM ELEMENTS
// =======================
const dayEl = document.getElementById("day");
const moneyEl = document.getElementById("money");
const priceEl = document.getElementById("price");
const popularityEl = document.getElementById("popularity");
const customersEl = document.getElementById("customers");
const clockEl = document.getElementById("clock");

const boardCustomersEl = document.getElementById("boardCustomers");
const boardIncomeEl = document.getElementById("boardIncome");
const boardSatisfactionEl = document.getElementById("boardSatisfaction");
const boardMealsEl = document.getElementById("boardMeals");
const boardNoteEl = document.getElementById("boardNote");

const toastContainer = document.getElementById("toastContainer");
const customerLogArea = document.getElementById("customerLogArea");

const dayOverlay = document.getElementById("dayOverlay");
const overlayDayTitle = document.getElementById("overlayDayTitle");
const overlayCustEl = document.getElementById("overlayCust");
const overlayIncomeEl = document.getElementById("overlayIncome");
const overlaySatisfactionEl = document.getElementById("overlaySatisfaction");
const overlayPopNowEl = document.getElementById("overlayPopNow");

const finalOverlay = document.getElementById("finalOverlay");
const finalMoneyEl = document.getElementById("finalMoney");
const finalCustomersEl = document.getElementById("finalCustomers");
const finalAvgPopEl = document.getElementById("finalAvgPop");
const finalBestIncomeEl = document.getElementById("finalBestIncome");
const finalMealsEl = document.getElementById("finalMeals");
const finalScoreEl = document.getElementById("finalScore");
const finalRankEl = document.getElementById("finalRank");

// menu panel
const menuToggleBtn = document.getElementById("menuToggleBtn");
const menuPanel = document.getElementById("menuPanel");
const menuListEl = document.getElementById("menuList");

// graph
const graphCanvas = document.getElementById("graphCanvas");

// theme toggle
const themeToggleBtn = document.getElementById("themeToggleBtn");

// skip button (floating)
const skipBtn = document.getElementById("skipBtn");

// =======================
// UTILS
// =======================
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatMoney(v) {
  return "$" + v.toFixed(2);
}

function calcAveragePrice() {
  let sum = 0;
  menuItems.forEach((m) => (sum += m.price));
  return sum / menuItems.length;
}

// =======================
// UI HELPERS
// =======================
function updateUI() {
  dayEl.textContent = `${day} / ${maxDays}`;
  moneyEl.textContent = formatMoney(money);
  popularityEl.textContent = `${Math.round(popularity)}%`;
  customersEl.textContent = `${todaysCustomers}`;
  priceEl.textContent = formatMoney(calcAveragePrice());

  boardCustomersEl.textContent = todaysCustomers;
  boardIncomeEl.textContent = formatMoney(todaysIncome);
  boardMealsEl.textContent = todaysMeals;

  const totalReactions = todaysGood + todaysBad;
  let sat = 0;
  if (totalReactions > 0) {
    sat = Math.round((todaysGood / totalReactions) * 100);
  }
  boardSatisfactionEl.textContent = `${sat}%`;
}

function showToast(message) {
  if (!toastContainer) return;
  const div = document.createElement("div");
  div.className = "toast";
  div.textContent = message;
  toastContainer.appendChild(div);

  setTimeout(() => {
    div.classList.add("fade-out");
    setTimeout(() => div.remove(), 400);
  }, 2500);
}

function addCustomerLog(text) {
  if (!customerLogArea) return;
  const div = document.createElement("div");
  div.className = "customer-msg";
  div.textContent = text;
  customerLogArea.appendChild(div);

  // keep last 25 logs
  while (customerLogArea.children.length > 25) {
    customerLogArea.firstElementChild.remove();
  }
}

// =======================
// CLOCK / TIME
// =======================
function resetClock() {
  hour = 8;
  minute = 0;
  updateClockUI();
  skipAvailable = false;
  disableSkipButton();
}

function updateClockUI() {
  if (!clockEl) return;
  const hh = hour.toString().padStart(2, "0");
  const mm = minute.toString().padStart(2, "0");
  clockEl.textContent = `${hh}:${mm}`;
}

function startClock() {
  if (clockTimer) clearInterval(clockTimer);
  updateClockUI();
  clockTimer = setInterval(tickClock, 1000); // 1 sec = 10 min
}

function tickClock() {
  if (!dayRunning) return;

  minute += 10;
  if (minute >= 60) {
    minute = 0;
    hour++;
  }
  updateClockUI();

  // unlock skip at 09:00
  if (hour >= 9 && !skipAvailable) {
    skipAvailable = true;
    enableSkipButton();
    showToast("⏩ Skip Day is now available!");
  }

  // spawn customers based on time/chance
  maybeSpawnCustomer();

  // auto close at 16:00
  if (hour >= 16) {
    closeDay(false);
  }
}

// =======================
// MENU PANEL
// =======================
function buildMenuPanel() {
  if (!menuListEl) return;
  menuListEl.innerHTML = "";
  menuItems.forEach((m, index) => {
    const row = document.createElement("div");
    row.className = "menu-row";
    row.innerHTML = `
      <div class="menu-main">
        <span class="menu-emoji">${m.emoji}</span>
        <span class="menu-name">${m.name}</span>
      </div>
      <div class="menu-controls">
        <button class="menu-btn minus" data-index="${index}">−</button>
        <input class="menu-input" type="number" step="0.5" value="${m.price.toFixed(
          2
        )}" data-index="${index}" />
        <button class="menu-btn plus" data-index="${index}">+</button>
      </div>
    `;
    menuListEl.appendChild(row);
  });

  // attach events
  const inputs = menuListEl.querySelectorAll(".menu-input");
  inputs.forEach((input) => {
    input.addEventListener("change", (e) => {
      const idx = parseInt(e.target.getAttribute("data-index"));
      const v = parseFloat(e.target.value);
      menuItems[idx].price = isNaN(v) || v <= 0 ? menuItems[idx].basePrice : v;
      updateUI();
    });
  });

  const minusButtons = menuListEl.querySelectorAll(".menu-btn.minus");
  minusButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"));
      menuItems[idx].price = Math.max(0.5, menuItems[idx].price - 1);
      buildMenuPanel();
      updateUI();
    });
  });

  const plusButtons = menuListEl.querySelectorAll(".menu-btn.plus");
  plusButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"));
      menuItems[idx].price += 1;
      buildMenuPanel();
      updateUI();
    });
  });
}

// =======================
// CUSTOMER SPAWN LOGIC
// =======================
function calculatePlannedCustomers() {
  const avgPrice = calcAveragePrice();
  // base > popularity & price balance
  let base = 10 + popularity / 4; // 10 ~ 35
  // if very expensive, fewer customers
  const avgBasePrice =
    menuItems.reduce((s, m) => s + m.basePrice, 0) / menuItems.length;
  const priceRatio = avgPrice / avgBasePrice;
  if (priceRatio > 1.2) {
    base *= 0.7;
  } else if (priceRatio < 0.8) {
    base *= 1.2;
  }
  base = clamp(base, 6, 40);
  return Math.round(base);
}

function getSpawnChance() {
  // We want roughly plannedCustomers across the working day (~48 ticks)
  const basePerTick = plannedCustomers / 48;
  let chance = basePerTick;

  // time-of-day multiplier
  if (hour >= 12 && hour < 14) {
    chance *= 1.7; // lunch
  } else if (hour < 10 || hour >= 15) {
    chance *= 0.7;
  }

  chance = clamp(chance, 0.05, 0.7);
  return chance;
}

function maybeSpawnCustomer() {
  if (!dayRunning) return;
  if (spawnedCustomers >= plannedCustomers) return;

  const chance = getSpawnChance();
  if (Math.random() < chance) {
    spawnCustomer(true);
  }
}

function calcMenuWeight(menu) {
  const priceRatio = menu.price / menu.basePrice;
  // if 1.0 ~ 1.3 → ok, >1.8 → bad
  let priceFactor = 1.5 - priceRatio;
  priceFactor = clamp(priceFactor, 0.2, 1.5);
  // popularity helps all
  const popFactor = 0.5 + popularity / 100;
  return Math.max(0, menu.weight * priceFactor * popFactor);
}

// spawnReal: whether to log to UI (true when real-time, false when skip simulation)
function spawnCustomer(spawnReal) {
  spawnedCustomers++;

  // pick menu by weight
  let weights = [];
  let sum = 0;
  menuItems.forEach((m) => {
    const w = calcMenuWeight(m);
    weights.push(w);
    sum += w;
  });

  let chosenIndex = 0;
  if (sum <= 0) {
    chosenIndex = Math.floor(Math.random() * menuItems.length);
  } else {
    let r = Math.random() * sum;
    for (let i = 0; i < weights.length; i++) {
      if (r < weights[i]) {
        chosenIndex = i;
        break;
      }
      r -= weights[i];
    }
  }

  const item = menuItems[chosenIndex];

  // quantity
  let qty = 1;
  const roll = Math.random();
  if (hour >= 12 && hour < 14) {
    if (roll < 0.15) qty = 3;
    else if (roll < 0.45) qty = 2;
  } else {
    if (roll < 0.1) qty = 3;
    else if (roll < 0.35) qty = 2;
  }

  const sale = item.price * qty;
  todaysCustomers++;
  todaysMeals += qty;
  todaysIncome += sale;
  money += sale;
  totalIncome += sale;
  totalCustomers++;

  // reaction based on price ratio
  const ratio = item.price / item.basePrice;
  let reactionText = "";
  let icon = "";
  let good = true;

  if (ratio <= 1.2) {
    if (Math.random() < 0.5) {
      reactionText = "loved the food!";
      icon = "🟩";
    } else {
      reactionText = "said everything tasted great.";
      icon = "😊";
    }
    popularity = clamp(popularity + 0.5, 0, 100);
  } else if (ratio <= 1.8) {
    if (Math.random() < 0.3) {
      reactionText = "complained a bit about the price...";
      icon = "😐";
      good = false;
      popularity = clamp(popularity - 0.3, 0, 100);
    } else {
      reactionText = "was okay with the price.";
      icon = "🙂";
    }
  } else {
    if (Math.random() < 0.7) {
      reactionText = "complained that it's too expensive!";
      icon = "🔻";
      good = false;
      popularity = clamp(popularity - 0.8, 0, 100);
    } else {
      reactionText = "bought it but is not satisfied.";
      icon = "😓";
      good = false;
      popularity = clamp(popularity - 0.5, 0, 100);
    }
  }

  if (good) todaysGood++;
  else todaysBad++;

  if (spawnReal) {
    addCustomerLog(`${icon} Customer bought ${qty}× ${item.name} ${item.emoji} - ${reactionText}`);
  }

  updateUI();
}

// simulate remaining customers instantly when skipping
function simulateRemainingCustomers() {
  const remaining = Math.max(0, plannedCustomers - spawnedCustomers);
  for (let i = 0; i < remaining; i++) {
    spawnCustomer(false);
  }
}

// =======================
// DAY FLOW
// =======================
function openDay() {
  if (gameOver || dayRunning) return;
  showToast(`Day ${day} started!`);
  dayRunning = true;

  todaysCustomers = 0;
  todaysIncome = 0;
  todaysMeals = 0;
  todaysGood = 0;
  todaysBad = 0;
  spawnedCustomers = 0;

  plannedCustomers = calculatePlannedCustomers();
  boardNoteEl.textContent = `Day ${day} running... Target around ${plannedCustomers} customers.`;

  resetClock();
  startClock();
  updateUI();
}

function closeDay(skipped) {
  if (!dayRunning) return;
  dayRunning = false;

  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }

  if (skipped) {
    simulateRemainingCustomers();
  }

  // finalize stats
  dailyIncome.push(todaysIncome);
  dailyPopularity.push(popularity);
  bestDayIncome = Math.max(bestDayIncome, todaysIncome);
  totalMeals += todaysMeals;

  const totalReactions = todaysGood + todaysBad;
  let sat = 0;
  if (totalReactions > 0) {
    sat = Math.round((todaysGood / totalReactions) * 100);
  }

  if (dayOverlay) {
    overlayDayTitle.textContent = `Day ${day} Results`;
    overlayCustEl.textContent = todaysCustomers;
    overlayIncomeEl.textContent = formatMoney(todaysIncome);
    overlaySatisfactionEl.textContent = `${sat}%`;
    overlayPopNowEl.textContent = `${Math.round(popularity)}%`;
    dayOverlay.classList.remove("hidden");
  }

  drawGraph();

  if (day >= maxDays) {
    gameOver = true;
    showFinalResults();
  } else {
    day++;
  }

  skipAvailable = false;
  disableSkipButton();
  updateUI();
}

function showFinalResults() {
  if (!finalOverlay) return;

  finalMoneyEl.textContent = formatMoney(money);
  finalCustomersEl.textContent = totalCustomers;
  const avgPop =
    dailyPopularity.length > 0
      ? dailyPopularity.reduce((a, b) => a + b, 0) / dailyPopularity.length
      : popularity;
  finalAvgPopEl.textContent = `${Math.round(avgPop)}%`;
  finalBestIncomeEl.textContent = formatMoney(bestDayIncome);
  finalMealsEl.textContent = totalMeals;

  // score: 40% money, 25% avgPop, 20% meals, 15% trend
  let score = 0;
  score += clamp(money / 3000, 0, 1) * 40;
  score += clamp(avgPop / 100, 0, 1) * 25;
  score += clamp(totalMeals / 200, 0, 1) * 20;

  const incomeTrend =
    dailyIncome.length > 1
      ? dailyIncome[dailyIncome.length - 1] / dailyIncome[0]
      : 1;
  score += clamp(incomeTrend, 0, 2) / 2 * 15;

  score = Math.round(score);
  finalScoreEl.textContent = score;

  let rank = "C";
  if (score >= 85) rank = "S";
  else if (score >= 70) rank = "A";
  else if (score >= 55) rank = "B";

  finalRankEl.textContent = rank;
  finalOverlay.classList.remove("hidden");
}

// =======================
// GRAPH
// =======================
function drawGraph() {
  if (!graphCanvas) return;
  const ctx = graphCanvas.getContext("2d");
  const w = graphCanvas.width;
  const h = graphCanvas.height;

  ctx.clearRect(0, 0, w, h);

  if (dailyIncome.length === 0) return;

  // normalize income
  const maxIncome = Math.max(...dailyIncome, 1);
  const maxPop = 100;

  const n = dailyIncome.length;
  const stepX = w / (Math.max(n - 1, 1));

  ctx.lineWidth = 2;

  // income line
  ctx.strokeStyle = "#46c9ff";
  ctx.beginPath();
  dailyIncome.forEach((val, i) => {
    const x = i * stepX;
    const y = h - (val / maxIncome) * (h * 0.9);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // popularity line
  ctx.strokeStyle = "#ffd95e";
  ctx.beginPath();
  dailyPopularity.forEach((val, i) => {
    const x = i * stepX;
    const y = h - (val / maxPop) * (h * 0.9);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

// =======================
// RANDOM EVENTS
// =======================
function triggerRandomEvent(showToastOnly = false) {
  if (gameOver) return;

  const roll = Math.random();
  if (roll < 0.25) {
    const gain = randInt(80, 160);
    money += gain;
    popularity = clamp(popularity + 3, 0, 100);
    showToast(`Local blogger loved your place! +$${gain}, +3% popularity`);
  } else if (roll < 0.5) {
    const cost = randInt(60, 140);
    money -= cost;
    popularity = clamp(popularity - 4, 0, 100);
    showToast(`Bad review went viral... -$${cost}, -4% popularity`);
  } else if (roll < 0.75) {
    popularity = clamp(popularity + 8, 0, 100);
    showToast("Food festival nearby! Popularity +8%");
  } else {
    const cost = randInt(50, 120);
    money -= cost;
    showToast(`Kitchen repair needed. -$${cost}`);
  }
  updateUI();
}

// =======================
// SKIP BUTTON HELPERS
// =======================
function disableSkipButton() {
  if (!skipBtn) return;
  skipBtn.classList.remove("enabled");
  skipBtn.classList.add("disabled");
}

function enableSkipButton() {
  if (!skipBtn) return;
  skipBtn.classList.remove("disabled");
  skipBtn.classList.add("enabled");
}

// =======================
// RESET GAME
// =======================
function resetGame() {
  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }

  money = 1000;
  day = 1;
  popularity = 50;
  hour = 8;
  minute = 0;
  dayRunning = false;
  skipAvailable = false;

  todaysCustomers = 0;
  todaysIncome = 0;
  todaysMeals = 0;
  todaysGood = 0;
  todaysBad = 0;
  totalCustomers = 0;
  totalIncome = 0;
  totalMeals = 0;
  bestDayIncome = 0;
  plannedCustomers = 0;
  spawnedCustomers = 0;
  dailyIncome = [];
  dailyPopularity = [];
  gameOver = false;

  if (customerLogArea) customerLogArea.innerHTML = "";
  if (boardNoteEl)
    boardNoteEl.textContent = 'Set your menu prices, then press “Open Day”.';
  if (dayOverlay) dayOverlay.classList.add("hidden");
  if (finalOverlay) finalOverlay.classList.add("hidden");

  // reset menu prices
  menuItems.forEach((m) => (m.price = m.basePrice));
  buildMenuPanel();
  updateUI();
  resetClock();
  drawGraph();
  showToast("Game reset! Try a new menu strategy.");
}

// =======================
// THEME TOGGLE
// =======================
if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const body = document.body;
    if (body.classList.contains("theme-neon")) {
      body.classList.remove("theme-neon");
      body.classList.add("theme-classic");
    } else {
      body.classList.remove("theme-classic");
      body.classList.add("theme-neon");
    }
  });
}

// =======================
// BUTTON BINDINGS
// =======================
document.getElementById("openDayBtn").onclick = () => {
  if (!dayRunning && !gameOver) {
    openDay();
  }
};

document.getElementById("priceUpBtn").onclick = () => {
  if (dayRunning || gameOver) return;
  menuItems.forEach((m) => (m.price += 1));
  buildMenuPanel();
  updateUI();
};

document.getElementById("priceDownBtn").onclick = () => {
  if (dayRunning || gameOver) return;
  menuItems.forEach((m) => (m.price = Math.max(0.5, m.price - 1)));
  buildMenuPanel();
  updateUI();
};

document.getElementById("advertiseBtn").onclick = () => {
  if (dayRunning || gameOver) return;
  if (money < 120) {
    showToast("Not enough money to advertise.");
    return;
  }
  money -= 120;
  popularity = clamp(popularity + 15, 0, 100);
  showToast("Ad campaign ran! Popularity +15%, Money -$120");
  updateUI();
};

document.getElementById("eventBtn").onclick = () => {
  if (dayRunning) return;
  triggerRandomEvent(false);
};

document.getElementById("resetBtn").onclick = resetGame;
document.getElementById("playAgainBtn").onclick = resetGame;
document.getElementById("nextDayBtn").onclick = () => {
  if (dayOverlay) dayOverlay.classList.add("hidden");
  if (!gameOver) {
    boardNoteEl.textContent =
      "Adjust your menu or run ads, then press Open Day.";
  }
};

if (menuToggleBtn) {
  menuToggleBtn.addEventListener("click", () => {
    menuPanel.classList.toggle("hidden");
  });
}

// skip button click
if (skipBtn) {
  skipBtn.addEventListener("click", () => {
    if (!dayRunning || !skipAvailable || skipBtn.classList.contains("disabled"))
      return;
    showToast("Skipping to end of day...");
    hour = 16;
    minute = 0;
    updateClockUI();
    closeDay(true);
  });
}

// =======================
// INIT
// =======================
buildMenuPanel();
updateUI();
resetClock();
drawGraph();
showToast("Welcome to Restaurant Tycoon! Edit your menu, then press Open Day.");

