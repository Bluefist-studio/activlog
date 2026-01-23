/* ELEMENTS */
const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");

const loginUser = document.getElementById("loginUser");     // username (unique)
const loginEmail = document.getElementById("loginEmail");   // real email
const loginPin = document.getElementById("loginPin");       // PIN (firebase password)

const loginBtn = document.getElementById("loginBtn");
const createBtn = document.getElementById("createBtn");
const loginError = document.getElementById("loginError");

const screen = document.getElementById("screen");
const menu = document.getElementById("menu");

const activityForm = document.getElementById("activityForm");
const activityType = document.getElementById("activityType");
const activityDuration = document.getElementById("activityDuration");
const activityDate = document.getElementById("activityDate");
  activityDate.addEventListener("input", () => {
    if (activityDate.value > activityDate.max) {
      activityDate.value = activityDate.max;
    }
  });
const activityNotes = document.getElementById("activityNotes");
const addActivityBtn = document.getElementById("addActivityBtn");
const cancelActivityBtn = document.getElementById("cancelActivityBtn");

const profileForm = document.getElementById("profileForm");
const profileUsername = document.getElementById("profileUsername");
const profilePin = document.getElementById("profilePin");
const saveProfileBtn = document.getElementById("saveProfileBtn");

const deleteForm = document.getElementById("deleteForm"); // kept only to keep it hidden
const deleteActivityBtn = document.getElementById("deleteActivityBtn");

const friendUidMap = {};

////////////////*QUOTES*////////////////////

const MOTIVATION_QUOTES = [
  "Every bit of movement is a step foward.",
  "Small actions add up. Your body notices.",
  "It doesn’t have to be a workout — just movement.",
  "Slow, fast, big, small — every thing matters.",
  "A little movement today is better than none.",
  "Health isn’t built in the gym. It’s built in everyday moments.",
  "Move in any way you can. It all counts.",
  "Tiny efforts become real change.",
  "You just need to move.",
  "Your body doesn’t care how you moved — just that you did."
];

function getDailyQuote() {
  const now = new Date();

  // Change twice a day: morning + afternoon/evening
  const day = now.getFullYear() * 1000 + (now.getMonth() + 1) * 50 + now.getDate();
  const half = now.getHours() < 12 ? 0 : 1;

  const index = (day + half) % MOTIVATION_QUOTES.length;
  return MOTIVATION_QUOTES[index];
}

function updateDailyQuote() {
  const el = document.getElementById("dailyQuote");
  if (el) {
    el.textContent = getDailyQuote();
  }
}

const PROMO_MESSAGE = `
Any move is a good move. ActivLog helps you capture them, build momentum, and keep going.`;

const PROMO_FEATURES = `
Beginner friendly & low pressure
• ActivLog is made for anyone who wants to stay active without pressure—just log whatever movement you did today, big or small.

Manual logging clarity
• You choose what counts. Enter any activity manually and keep a simple record of the effort you put in every day.

Everyday life focus
• From stretching to shoveling snow, ActivLog lets you log real life activity, not just traditional workouts.

Anti overwhelm appeal
• No GPS, no sensors, no complicated graphs—just clean, simple activity logging you control.
`;

const PROMO_PARAGRAPH = ``;

function showPromoMessage() {
  const el = document.getElementById("promoMessage");
  if (!el) return;

  el.innerHTML = `
    <p class="promo-headline">${PROMO_MESSAGE}</p>



   <p class="promo-paragraph">${PROMO_PARAGRAPH}</p>
  `;
}


////////////////////////* STORAGE */////////////////////////////////
const store = {
  session: JSON.parse(localStorage.getItem("session")) || { userId: null, username: null },
  activities: [],          // current activities from Firestore (for history/edit)
  switchConfirm: false,
  authBusy: false,
  pendingLoginError: "",
  editingActivity: null    // activity object being edited (or null)
};

function save() {
  localStorage.setItem("session", JSON.stringify(store.session));
}

///////////////////////* HELPERS *////////////////////////////////

function print(text = "") {
  screen.innerHTML += `<div class="line">${String(text).replace(/\n/g, "<br>")}</div>`;
}


function currentUser() {
  return { id: store.session.userId, username: store.session.username || "USER" };
}

function normalizeUsername(name) {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_]/g, "");
}

function validateUsername(name) {
  if (!name) return "USERNAME REQUIRED";
  if (name.length < 3) return "USERNAME TOO SHORT (MIN 3)";
  if (name.length > 20) return "USERNAME TOO LONG (MAX 20)";
  if (!/^[a-z0-9_]+$/.test(name)) return "USERNAME: A-Z 0-9 _ ONLY";
  return null;
}

async function loadUsernameForUid(uid) {
  try {
    const snap = await db.collection("users").doc(uid).get();
    if (snap.exists && snap.data()?.username) return snap.data().username;
  } catch (_) {}
  return null;
}

function activitiesRef(uid) {
  return db.collection("users").doc(uid).collection("activities");
}

function formatShortDateFromString(str) {
  const [y, m, d] = str.split("-").map(Number);
  // Do NOT use new Date(y, m-1, d) — it causes timezone shifts
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatShortDateFromDate(d) {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function formatShortDatePretty(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}



function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d); // local midnight
}




function calculateStreaks(list) {
  // Normalize dates to YYYY-MM-DD
  list = list
    .filter(a => a.date)
    .map(a => ({ ...a, date: a.date.trim().slice(0, 10) }));

  const uniqueDates = [...new Set(list.map(a => a.date))].sort().reverse();
  if (!uniqueDates.length) return { currentStreak: 0, bestStreak: 0 };

  function daysFromDateString(str) {
    const [y, m, d] = str.split("-").map(Number);
    return Date.UTC(y, m - 1, d) / 86400000;
  }

  const todayStr = getLocalDateString();
  const todayDays = daysFromDateString(todayStr);

  // ---- CURRENT STREAK: must start from the most recent activity ----
  let currentStreak = 1; // at least 1 day because you have at least one activity
  let expected = daysFromDateString(uniqueDates[0]); // start at most recent activity

  for (let i = 1; i < uniqueDates.length; i++) {
    const dayIndex = daysFromDateString(uniqueDates[i]);

    if (dayIndex === expected - 1) {
      currentStreak++;
      expected = dayIndex;
    } else {
      break;
    }
  }

  // If last activity was more than 1 day ago, current streak should be 0
  const lastDayIndex = daysFromDateString(uniqueDates[0]);
  if (todayDays - lastDayIndex > 1) {
    currentStreak = 0;
  }

  // ---- BEST STREAK: longest run anywhere ----
  let bestStreak = 0;
  let streak = 0;
  let prev = null;

  for (const dateStr of uniqueDates.slice().reverse()) {
    const dayIndex = daysFromDateString(dateStr);

    if (prev === null || dayIndex === prev + 1) {
      streak++;
    } else {
      streak = 1;
    }
    prev = dayIndex;
    if (streak > bestStreak) bestStreak = streak;
  }

  return { currentStreak, bestStreak };
}




function center(text, width = 30) {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(pad) + text;
}

function centerLine(text) {
  const width = screen.clientWidth || 300; // fallback if needed
  const charWidth = 8; // average monospace char width in px
  const maxChars = Math.floor(width / charWidth);

  const pad = Math.max(0, Math.floor((maxChars - text.length) / 2));
  return " ".repeat(pad) + text;
}

function formatMinutes(min) {
  const hours = Math.floor(min / 60);
  const minutes = min % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} hr ${minutes} min`;
  }
  if (hours > 0 && minutes === 0) {
    return `${hours} hr`;
  }
  return `${minutes} min`;
}









/////////// health ////////////

function calculateHealth(streak, minutesToday, followerCount, followingCount) {
  // 1. Base
  const base = 1;

  // 2. Social (fixed 9%)
  const social = Math.min(followerCount + followingCount, 9);

  // 3. Time bonus: 1% per minute, max 30%
  const timeBonus = Math.min(minutesToday, 30);

  // 4. Streak bonus:
  // streak 1 → 0%
  // streak 2 → 10%
  // streak 3 → 20%
  // ...
  // streak 7 → 60%
  // streak 8+ → capped at 60%
  const streakBonus = Math.min(Math.max(streak, 0) * 10, 60);

  // 5. Total health
  let health = base + social + timeBonus + streakBonus;

  // 6. Cap at 100%
  return Math.round(Math.min(health, 100));
}



async function updateHealthBar() {
  const uid = store.session.userId;
  if (!uid) return;

  // Load activities ordered by date
  const snap = await activitiesRef(uid)
    .orderBy("date", "desc")
    .get();

  const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Calculate streak
  const { currentStreak } = calculateStreaks(list);

  // Calculate today's minutes
  let minutesToday = 0;
  const todayStr = getLocalDateString();

  for (const a of list) {
    if (a.date.startsWith(todayStr)) {
      minutesToday += Number(a.duration || 0);
    }
  }

  // NEW: load social counts
  const followerCount = await getFollowerCount();
  const followingCount = await getFollowingCount();

  // NEW: use your new formula
  const health = calculateHealth(
    currentStreak,
    minutesToday,
    followerCount,
    followingCount
  );

  // Update bar
  const bar = document.getElementById("healthBarFill");
  const label = document.getElementById("healthBarLabel");

  if (!bar || !label) return;

  document.getElementById("healthBarWrapper").style.display = "block";

  bar.style.width = health + "%";

  bar.classList.remove("low", "mid", "high");

  if (health < 30) {
    bar.classList.add("low");
  } else if (health < 70) {
    bar.classList.add("mid");
  } else {
    bar.classList.add("high");
  }

  label.innerHTML = `<span id="healthInfoToggle">[i]</span> HEALTH: <span id="healthValue">${health}%</span>`;

// Attach info toggle AFTER label is rendered
const toggle = document.getElementById("healthInfoToggle");
const panel = document.getElementById("healthInfoPanel");

if (toggle && panel && !toggle.dataset.bound) {
  toggle.dataset.bound = "true"; // prevents double-binding
  toggle.addEventListener("click", () => {
    panel.classList.toggle("hidden");
  });
}

}




//////////////////////////////* VIEWS *////////////////////////////
function hideAllForms() {
  activityForm.classList.add("hidden");
  profileForm.classList.add("hidden");
screen.classList.remove("friends-screen");
document.getElementById("friendControls").classList.add("hidden");

  if (deleteForm) deleteForm.classList.add("hidden"); // keep old form hidden
}

function hideAllViews() {
  document.getElementById("todayMenu")?.classList.add("hidden");
  document.getElementById("yesterdayMenu")?.classList.add("hidden");
  document.getElementById("historyMenu")?.classList.add("hidden");
  document.getElementById("statsMenu")?.classList.add("hidden");
  document.getElementById("friendsMenu")?.classList.add("hidden");
document.getElementById("friendControls").classList.add("hidden");

}


function showLogin() {
  hideAllForms();
  loginView.classList.remove("hidden");
  appView.classList.add("hidden");

  loginError.textContent = store.pendingLoginError || "";
  store.pendingLoginError = "";

  store.editingActivity = null;
  addActivityBtn.textContent = "Add Activity";

const promo = document.getElementById("promoMessage"); 

if (promo) promo.classList.remove("hidden"); 
showPromoMessage();

document.getElementById("healthBarWrapper").style.display = "none";


}

function showApp(showActivity = false) {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  hideAllForms();

const promo = document.getElementById("promoMessage"); 
if (promo) promo.classList.add("hidden"); updateDailyQuote();

  if (showActivity) showActivityForm();
  else drawHome();

}

function showActivityForm() {
  hideAllForms();
  screen.textContent = "";
  activityForm.classList.remove("hidden");
  activityForm.classList.remove("editing"); // reset edit mode

  addActivityBtn.classList.remove("hidden");
  savechangesBtn.classList.add("hidden");

  store.editingActivity = null;

  // Reset buttons
  addActivityBtn.textContent = "Add Activity";

  if (deleteActivityBtn) deleteActivityBtn.classList.add("hidden");

  const cancelBtn = document.getElementById("cancelEditWindowBtn");
  if (cancelBtn) cancelBtn.classList.add("hidden");

  // Reset fields
  activityType.value = "";
  activityDuration.value = "";
  activityNotes.value = "";

  const distEl = document.getElementById("activityDistance");
  if (distEl) distEl.value = "";

  // Reset date
  const today = getLocalDateString();
  activityDate.value = today;
  activityDate.max = today;

  if (activityDate.value > activityDate.max) {
    activityDate.value = activityDate.max;
  }

  // Cancel button behavior
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      store.editingActivity = null;
      addActivityBtn.textContent = "Add Activity";
      cancelBtn.classList.add("hidden");
      if (deleteActivityBtn) deleteActivityBtn.classList.add("hidden");
      hideAllForms();
      showHistory();
    };
  }
}




function openEditActivity(activity) {
  // Edit existing activity: prefill form
  if (!activity) return;

  hideAllForms();
  screen.textContent = "";
  activityForm.classList.remove("hidden");

  store.editingActivity = activity;

  activityType.value = activity.type || "";
  activityDuration.value = activity.duration != null ? activity.duration : "";
  activityNotes.value = activity.notes || "";
  activityDate.value = activity.date || new Date().toISOString().slice(0, 10);

  const distEl = document.getElementById("activityDistance");
  if (distEl) distEl.value = activity.distance != null ? activity.distance : "";

  addActivityBtn.textContent = "Save Changes";
  if (deleteActivityBtn) deleteActivityBtn.classList.remove("hidden");
}


function showProfileForm() {
  hideAllForms();
  screen.textContent = "";
  profileForm.classList.remove("hidden");

  profileUsername.value = store.session.username || "";
  profilePin.value = "";
}

function drawHome() {
  screen.textContent = "";
  const user = currentUser();
  print(`USER: ${user.username}\n\nUser name updated.`);
}

///////////////////////////////* LOGIN *///////////////////////////////////////

loginBtn.addEventListener("click", () => {
  const email = (loginEmail.value || "").trim();
  const pin = (loginPin.value || "").trim();

  if (!email || !pin) {
    loginError.textContent = "ENTER EMAIL AND PIN";
    return;
  }

  auth.signInWithEmailAndPassword(email, pin)
    .then(async (userCred) => {
      store.session.userId = userCred.user.uid;

      const uname = await loadUsernameForUid(userCred.user.uid);
      store.session.username = uname || (loginUser.value.trim() || "USER");
      save();

      loginError.textContent = "";
      loginUser.value = "";
      loginEmail.value = "";
      loginPin.value = "";

      showApp(true);
    })
    .catch(err => {
      console.error(err);
      loginError.textContent = `${err.code || "ERROR"}: ${err.message || "LOGIN FAILED"}`;
    });
});

/* CREATE USER (unique username enforced) */
createBtn.addEventListener("click", () => {
  const rawUsername = (loginUser.value || "").trim();
  const username = normalizeUsername(rawUsername);
  const email = (loginEmail.value || "").trim();
  const pin = (loginPin.value || "").trim();

  const v = validateUsername(username);
  if (v) { loginError.textContent = v; return; }
  if (!email || !pin) { loginError.textContent = "ENTER EMAIL AND PIN"; return; }

  store.authBusy = true;

  auth.createUserWithEmailAndPassword(email, pin)
    .then(async (userCred) => {
      const uid = userCred.user.uid;

      const unameRef = db.collection("usernames").doc(username);
      const userRef = db.collection("users").doc(uid);

      try {
        await db.runTransaction(async (tx) => {
          const unameSnap = await tx.get(unameRef);
          if (unameSnap.exists) throw new Error("USERNAME_TAKEN");

          tx.set(unameRef, {
            uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          tx.set(userRef, {
            username,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });

        store.session.userId = uid;
        store.session.username = username;
        save();

        loginError.textContent = "";
        loginUser.value = "";
        loginEmail.value = "";
        loginPin.value = "";

        store.authBusy = false;
        showApp(true);

      } catch (e) {
        console.error(e);

        store.pendingLoginError = (e?.message === "USERNAME_TAKEN")
          ? "USERNAME TAKEN"
          : `CREATE FAILED: ${e?.code || ""} ${e?.message || e}`;

        try { await auth.currentUser.delete(); } catch (_) {}
        try { await auth.signOut(); } catch (_) {}

        store.session.userId = null;
        store.session.username = null;
        save();

        store.authBusy = false;
        showLogin();
      }
    })
    .catch(err => {
      console.error(err);
      store.authBusy = false;
      loginError.textContent = `${err.code || "ERROR"}: ${err.message || "CREATE FAILED"}`;
    });
});

/////////////////////////////* MENU *///////////////////////////////////

document.addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;


  const action = btn.dataset.action;

  if (!action) return;

  // ⭐ Only hide forms if NOT switching user
  if (action !== "switch") {
    hideAllForms();
    hideAllViews();
    screen.textContent = "";
  }

  switch (action) {
    case "log":
      store.editingActivity = null;
      addActivityBtn.textContent = "Add Activity";
      showActivityForm();
      store.switchConfirm = false;
      break;

    case "history":
      showHistory();
      store.switchConfirm = false;
      break;

    case "friends":
      showFriends();
      store.switchConfirm = false;
      break;

    case "profile":
      showProfileForm();
      store.switchConfirm = false;
      break;

    case "stats":
      showStatistics();
      store.switchConfirm = false;
      break;

    case "switch":
      if (store.switchConfirm) {
        store.switchConfirm = false;

        auth.signOut().finally(() => {
          store.session.userId = null;
          store.session.username = null;
          save();
          showLogin();
        });
      } else {
        store.switchConfirm = true;
        document.getElementById("profileMessage").textContent = "Press 'Switch User' again to confirm logout.";
      }
      return;
  }

setTimeout(scrollBelowMenu, 150);

  document.getElementById("healthBarWrapper").style.display = "block";
  updateHealthBar();
});

function scrollBelowMenu() {
  // Freeze scroll so the browser can't auto‑scroll during layout changes
  document.body.style.overflow = "hidden";

  // Wait for layout to finish (2 frames)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {

      const anchor = document.getElementById("menuAnchor");
      const rect = anchor.getBoundingClientRect();
      const absoluteTop = rect.top + window.scrollY;

      // Now perform the real scroll
      window.scrollTo({
        top: absoluteTop,
        behavior: "smooth"
      });

      // Unfreeze scroll
      document.body.style.overflow = "";
    });
  });
}





const menuButtons = document.querySelectorAll('#menu button');

menuButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    menuButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

const activityModal = document.getElementById("activityModal");

document.querySelectorAll('#menu button').forEach(btn => {
  btn.addEventListener('click', () => {
    activityModal.classList.add('hidden');
  });
});



////////////////////////* ACTIVITY FORM (ADD OR UPDATE) *//////////////////////////////

addActivityBtn.addEventListener("click", async () => {
  const type = activityType.value.trim();
  const duration = activityDuration.value;
  const notes = activityNotes.value.trim();

window.scrollTo({ top: 0, behavior: "smooth" });

  // Raw date from input OR today
  let rawDate = activityDate.value || new Date().toISOString().slice(0, 10);

  // Normalize to YYYY-MM-DD (local date, no time, no timezone issues)
  const d = new Date(rawDate);
  const date = d.toISOString().slice(0, 10);

  if (!type || !duration) {
    print("FILL ACTIVITY AND MINUTES.");
    return;
  }

saveActivityName(type);
loadActivitySuggestions();

  const uid = store.session.userId;
  if (!uid) { print("NOT LOGGED IN."); return; }

  const distanceRaw = (document.getElementById("activityDistance")?.value || "").trim();
  const distance = distanceRaw ? Number(distanceRaw) : null;

  const payload = {
    date,                 // ← normalized date
    type,
    duration: Number(duration),
    distance,
    notes
  };

  try {

if (store.editingActivity && store.editingActivity.id) {
  // UPDATE
  await activitiesRef(uid).doc(store.editingActivity.id).update(payload);
  updateHealthBar();

  store.editingActivity = null;
  addActivityBtn.textContent = "Add Activity";
  if (deleteActivityBtn) deleteActivityBtn.classList.add("hidden");
  document.getElementById("cancelEditWindowBtn").classList.add("hidden");

  hideAllForms();
  print("Activity updated.");
  await showHistory();
  return;
}



    // ADD
    await activitiesRef(uid).add({
      ...payload,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

saveActivityName(type); // ensure saved 
loadActivitySuggestions(); // refresh dropdown

    const distEl = document.getElementById("activityDistance");
    if (distEl) distEl.value = "";

    hideAllForms();
    showStatistics("Activity logged.");

  } catch (err) {
    console.error(err);
    print(`SAVE FAILED: ${err.code || ""} ${err.message || err}`);
  }
});

function saveActivityName(name) {
  if (!name) return;

  let list = JSON.parse(localStorage.getItem("activityNames") || "[]");

  if (!list.includes(name)) {
    list.push(name);
    localStorage.setItem("activityNames", JSON.stringify(list));
  }
}


async function importActivityNamesFromHistory() {
  const uid = store.session.userId;
  if (!uid) return;

  const snap = await activitiesRef(uid).get();

  const names = new Set();

  snap.forEach(doc => {
    const type = doc.data().type;
    if (type && type.trim()) {
      names.add(type.trim());
    }
  });

  // Save ONLY the user's real activity names
  localStorage.setItem("activityNames", JSON.stringify([...names]));
  loadActivitySuggestions();
}



function showModalDropdown(filter = "") {
  const list = JSON.parse(localStorage.getItem("activityNames") || "[]");
  const dropdown = document.getElementById("modalDropdown");

  dropdown.innerHTML = "";

  const filtered = list.filter(name =>
    name.toLowerCase().includes(filter.toLowerCase())
  );

  filtered.forEach(name => {
    const item = document.createElement("div");
    item.textContent = name;
    item.addEventListener("click", () => {
      modalActivityInput.value = name;
      activityType.value = name;
      closeModal();
    });
    dropdown.appendChild(item);
  });
}

function closeModal() {
  document.getElementById("activityModal").classList.add("hidden");
}

modalCloseBtn.addEventListener("click", () => {
  activityType.value = modalActivityInput.value;
  closeModal();
});

modalActivityInput.addEventListener("input", () => {
  showModalDropdown(modalActivityInput.value);
});


activityType.addEventListener("click", () => {
  document.body.classList.add("modal-open");
  activityModal.classList.remove("hidden");

  modalActivityInput.value = activityType.value;
  modalActivityInput.focus();
  showModalDropdown("");

setTimeout(() => {
  const rect = activityModal.getBoundingClientRect();
  const offset = rect.top + window.scrollY - 60; // safe buffer

  window.scrollTo({
    top: offset,
    behavior: "smooth"
  });
}, 50);


});



modalAddBtn.addEventListener("click", () => {
  activityType.value = modalActivityInput.value.trim();
  closeModal();
});

function closeModal() {
  document.getElementById("activityModal").classList.add("hidden");
  document.body.classList.remove("modal-open");
}



////////////////////////////* PROFILE SAVE (PIN change only) *///////////////////////////////

saveProfileBtn.addEventListener("click", async () => {
  const requestedUsername = normalizeUsername(profileUsername.value);
  const current = normalizeUsername(store.session.username || "");
  const newPin = profilePin.value.trim();
  const uid = store.session.userId;
  document.getElementById("profileMessage").textContent = "";
  importActivityNamesFromHistory();


  if (!uid) {
    print("NOT LOGGED IN.");
    return;
  }

  // If username is unchanged, only handle PIN
  if (requestedUsername === current) {
    if (!newPin) {
      print("PROFILE UPDATED.");
      hideAllForms();
      drawHome();
      return;
    }

    try {
      await auth.currentUser.updatePassword(newPin);
      print("PROFILE UPDATED.");
    } catch (_) {
      print("PIN CHANGE REQUIRES RE-LOGIN.");
    }

    hideAllForms();
    drawHome();
    return;
  }

  // Username changed — validate
  const v = validateUsername(requestedUsername);
  if (v) {
    print(v);
    profileUsername.value = store.session.username || "";
    return;
  }

  // Firestore references
  const oldNameRef = db.collection("usernames").doc(current);
  const newNameRef = db.collection("usernames").doc(requestedUsername);
  const userRef = db.collection("users").doc(uid);

  try {
    await db.runTransaction(async (tx) => {
      const newSnap = await tx.get(newNameRef);
      if (newSnap.exists) throw new Error("USERNAME_TAKEN");

      // Remove old username index
      tx.delete(oldNameRef);

      // Create new username index
      tx.set(newNameRef, {
        uid,
        changedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Update user document
      tx.update(userRef, { username: requestedUsername });
    });

    // Update session
    store.session.username = requestedUsername;
    save();

    print("USERNAME UPDATED.");
    hideAllForms();
    drawHome();

  } catch (e) {
    if (e.message === "USERNAME_TAKEN") {
      print("USERNAME TAKEN.");
    } else {
      print("USERNAME CHANGE FAILED.");
    }

    profileUsername.value = store.session.username || "";
  }
});

/* DELETE ACTIVITY (from edit form) */
if (deleteActivityBtn) {
  deleteActivityBtn.addEventListener("click", async () => {
    const uid = store.session.userId;
    const a = store.editingActivity;

    if (!uid) { print("NOT LOGGED IN."); return; }
    if (!a || !a.id) { print("NOTHING TO DELETE."); return; }

    try {
      await activitiesRef(uid).doc(a.id).delete();
updateHealthBar();

      store.editingActivity = null;
      addActivityBtn.textContent = "Add Activity";
      deleteActivityBtn.classList.add("hidden");

      hideAllForms();
      print("Activity deleted.");
      await showHistory();

    } catch (err) {
      console.error(err);
      print(`DELETE FAILED: ${err.code || ""} ${err.message || err}`);
    }
  });
}


function loadActivitySuggestions() {
  const list = JSON.parse(localStorage.getItem("activityNames") || "[]");
  const datalist = document.getElementById("activitySuggestions");

  datalist.innerHTML = "";

  list.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    datalist.appendChild(option);
  });
}






/////////////////////////*FRIENDS*////////////////////////////////////////


async function showFriends(returnHtml = false) {
  hideAllForms();

  const followingHtml = await renderFollowingList();
  const followerCount = await getFollowerCount();
  const followingCount = followingHtml.trim() === "" ? 0 : followingHtml.split("\n").length;

  // --- RETURN-HTML MODE (for Statistics) ---
  if (returnHtml) {
    let html = "";

    html += `<div class="pip-title">FOLLOWERS — ${followerCount}</div>`;
    html += `<div class="pip-title">FOLLOWING — ${followingCount}</div>`;

    const lines = followingHtml.split("\n");
    lines.forEach(line => {
      if (!line.trim()) return;
      html += `<div class="line">${line}</div>`;
    });

    // FOLLOW title spacer (kept for consistency)
    html += `<div class="line"><strong></strong></div>`;

    return html;
  }

  // --- NORMAL FRIENDS SCREEN MODE ---
  screen.classList.add("friends-screen");

  const controls = document.getElementById("friendControls");
  if (controls) controls.classList.remove("hidden");

  // Clear screen
  screen.innerHTML = "";

  // FOLLOWERS title
  screen.insertAdjacentHTML(
    "beforeend",
    `<div class="pip-title">FOLLOWERS — ${followerCount}</div>`
  );

  // FOLLOWING title
  screen.insertAdjacentHTML(
    "beforeend",
    `<div class="pip-title">FOLLOWING — ${followingCount}</div>`
  );

  // Following list
  const lines = followingHtml.split("\n");
  lines.forEach(line => {
    if (!line.trim()) return;

    const div = document.createElement("div");
    div.classList.add("line");
    div.textContent = line;

    if (line.trim().startsWith(">")) {
      const username = line.trim().replace(/^>\s*/, "");
      div.style.cursor = "pointer";
      div.onclick = () => toggleFriendDetails(div, username);
    }

    screen.appendChild(div);
  });

  // FOLLOW title
  const followTitle = document.createElement("div");
  followTitle.innerHTML = `<strong></strong>`;
  followTitle.style.marginTop = "32px";
  followTitle.style.marginBottom = "12px";
  screen.appendChild(followTitle);
}


// FOLLOW //
async function addFriendByUsername() {
  const nameInput = document.getElementById("friendUsername");
  const username = nameInput.value.trim();
  if (!username) return;

  const currentUser = firebase.auth().currentUser;
  if (!currentUser) {
    alert("You must be logged in.");
    return;
  }

  // 1. Find user by username
  const usersRef = firebase.firestore().collection("users");
  const snap = await usersRef.where("username", "==", username).limit(1).get();

  if (snap.empty) {
    alert("No user found with that username.");
    return;
  }

  const friendDoc = snap.docs[0];
  const friendUid = friendDoc.id;

  if (friendUid === currentUser.uid) {
    alert("You can't follow yourself.");
    return;
  }

  // 2. Check if already following
  const followsRef = firebase.firestore().collection("follows");
  const existing = await followsRef
    .where("followerUid", "==", currentUser.uid)
    .where("followingUid", "==", friendUid)
    .limit(1)
    .get();

  if (!existing.empty) {
    alert("You already follow this user.");
    return;
  }

  // 3. Create follow document
  await followsRef.add({
    followerUid: currentUser.uid,
    followingUid: friendUid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  nameInput.value = "";
await showFriends();

}

// UNFOLLOW //

async function unfollowByUsername() {
  const nameInput = document.getElementById("friendUsername");
  const username = nameInput.value.trim();
  if (!username) return;

  const currentUser = firebase.auth().currentUser;
  if (!currentUser) {
    alert("You must be logged in.");
    return;
  }

  // 1. Find user by username
  const usersRef = firebase.firestore().collection("users");
  const snap = await usersRef.where("username", "==", username).limit(1).get();

  if (snap.empty) {
    alert("No user found with that username.");
    return;
  }

  const friendUid = snap.docs[0].id;

  // 2. Find follow relationship
  const followsRef = firebase.firestore().collection("follows");
  const existing = await followsRef
    .where("followerUid", "==", currentUser.uid)
    .where("followingUid", "==", friendUid)
    .limit(1)
    .get();

  if (existing.empty) {
    alert("You are not following this user.");
    return;
  }

  // 3. Delete follow document
  await followsRef.doc(existing.docs[0].id).delete();

  nameInput.value = "";
  await showFriends();
}


async function renderFollowingList() {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) return "No user logged in.\n";

  const followsRef = firebase.firestore().collection("follows");
  const snap = await followsRef
    .where("followerUid", "==", currentUser.uid)
    .get();

  if (snap.empty) return "No friends yet.\n";

  const followingUids = snap.docs.map(d => d.data().followingUid);
  const usersRef = firebase.firestore().collection("users");

  // Do NOT mutate followingUids — use slice instead
  const chunks = [];
  for (let i = 0; i < followingUids.length; i += 10) {
    chunks.push(followingUids.slice(i, i + 10));
  }

  const friends = [];
  for (const chunk of chunks) {
    const q = await usersRef
      .where(firebase.firestore.FieldPath.documentId(), "in", chunk)
      .get();

    q.forEach(doc => {
      const data = { uid: doc.id, ...doc.data() };
      friends.push(data);

      // Populate the UID map
      friendUidMap[data.username] = data.uid;

    });
  }

  return friends.map(f => `> ${f.username}`).join("\n");
}



async function getFollowerCount() {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) return 0;

  const followsRef = firebase.firestore().collection("follows");
  const snap = await followsRef
    .where("followingUid", "==", currentUser.uid)
    .get();

  return snap.size;
}

async function getFollowingCount() {
  const uid = store.session.userId;
  if (!uid) return 0;

  const snap = await firebase.firestore()
    .collection("follows")
    .where("followerUid", "==", uid)
    .get();

  return snap.size;
}


async function getUserActivities(uid) {
  const ref = firebase.firestore()
    .collection("users")
    .doc(uid)
    .collection("activities");

  const snap = await ref.get();
  const list = [];
  snap.forEach(doc => list.push(doc.data()));
  return list;
}


async function toggleFriendDetails(lineElement, username) {

  // If already expanded, collapse it
  if (lineElement.nextSibling && lineElement.nextSibling.classList.contains("friend-details")) {
    lineElement.nextSibling.remove();
    return;
  }

  // Remove any other open friend details
  document.querySelectorAll(".friend-details").forEach(el => el.remove());

  const uid = friendUidMap[username];
  if (!uid) return;

  const activities = await getUserActivities(uid);
  const statsHtml = renderStats(activities);

  const details = document.createElement("div");
  details.classList.add("friend-details", "line");
  details.style.marginLeft = "20px";
  details.style.whiteSpace = "pre-wrap";
  details.style.marginTop = "5px";
  details.style.marginBottom = "10px";

  details.innerHTML = statsHtml;

  lineElement.insertAdjacentElement("afterend", details);
}




function renderStats(list) {
  if (!list || list.length === 0) {
    return "No stats available.";
  }

  const { currentStreak, bestStreak } = calculateStreaks(list);

  function getMinutes(a) {
    return a.minutes ?? a.amount ?? a.duration ?? a.time ?? 0;
  }

  const totalMinutes = list.reduce((sum, a) => sum + getMinutes(a), 0);

  const dayTotals = {};
  list.forEach(a => {
    const day = new Date(a.date).toDateString();
    dayTotals[day] = (dayTotals[day] || 0) + getMinutes(a);
  });
  const topDayMinutes = Math.max(...Object.values(dayTotals));

  const weekTotals = {};
  list.forEach(a => {
    const d = new Date(a.date);
    const week = `${d.getFullYear()}-W${Math.ceil((d.getDate() - d.getDay() + 1) / 7)}`;
    weekTotals[week] = (weekTotals[week] || 0) + getMinutes(a);
  });
  const topWeekMinutes = Math.max(...Object.values(weekTotals));

  let output = "";
  output += `Current streak: ${currentStreak} day(s)\n`;
  output += `Best streak: ${bestStreak} day(s)\n`;
  output += `Total time moving: ${formatMinutes(totalMinutes)}\n`;
  output += `Top day: ${formatMinutes(topDayMinutes)}\n`;
  output += `Top week: ${formatMinutes(topWeekMinutes)}\n`;

  return output.trim();
}





///////////////////////////* DISPLAY: HISTORY *////////////////////////////
async function showHistory() {
  hideAllForms();
  screen.textContent = "";
screen.classList.remove("friends-screen");


  const uid = store.session.userId;
  if (!uid) { print("NOT LOGGED IN."); return; }

  store.editingActivity = null;

  try {
    const snap = await activitiesRef(uid)
      .orderBy("createdAt", "desc")
      .get({ source: "server" });

    const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    store.activities = list;

    if (!list.length) {
      print("No history.");
      return;
    }

const groups = {
  today: [],
  yesterday: [],
  last7: [],
  older: []
};

const today = new Date();
today.setHours(0, 0, 0, 0);

const dayMs = 86400000;


// 1. Get today's date as YYYY-MM-DD
const todayStr = getLocalDateString();

// 2. Convert YYYY-MM-DD → days since epoch (UTC)
function daysFromDateString(str) {
  const [y, m, d] = str.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

// 3. Compute today's day index
const todayDays = daysFromDateString(todayStr);

// 4. Group activities
for (const a of list) {
  if (!a.date) continue;

  const activityDays = daysFromDateString(a.date);
  const diff = todayDays - activityDays;

  if (diff === 0) groups.today.push(a);
  else if (diff === 1) groups.yesterday.push(a);
  else if (diff >= 2 && diff <= 7) groups.last7.push(a);
  else if (diff > 7) groups.older.push(a);
}


    let html = "";

    function append(text = "") {
      html += `${text}<br>`;
    }

    function appendGroup(title, arr, showDateLabel) {
      if (!arr.length) return;
      if (title) append(title);

      for (const a of arr) {
        const dateLabel = formatShortDatePretty(a.date);

        const dist = a.distance != null && a.distance !== "" ? ` — ${a.distance} km`: "";

        const notes = a.notes ? ` (${a.notes})` : "";
        const base = showDateLabel ? `${dateLabel} — ${a.type}` : a.type;
        const line = `> ${base} — ${formatMinutes(a.duration)}${dist}${notes}`;
        html += `<div class="stat-line activity-line" data-id="${a.id}">${line}</div>`;

      }

      append("");
    }

    // TODAY
    const todayLabel = formatShortDateFromDate(today);
    append(`<div class="pip-title">TODAY — ${todayLabel}</div>`);
    if (groups.today.length) {
      appendGroup("", groups.today, false);
    } else {
append(`<div class="stat-line">(none)</div>`);
append(`<div class="stat-line"></div>`);

    }

    // YESTERDAY
    if (groups.yesterday.length) {
      const y = new Date(today.getTime() - dayMs);
      const yLabel = formatShortDateFromDate(y);
      append(`<div class="pip-title">YESTERDAY — ${yLabel}</div>`);
      appendGroup("", groups.yesterday, false);
    }

    // LAST 7 DAYS (2–7 days ago)
    appendGroup(`<div class="pip-title">LAST 7 DAYS</div>`, groups.last7, true);


    // OLDER
    appendGroup(`<div class="pip-title">OLDER</div>`, groups.older, true);

    screen.innerHTML = html;

  } catch (err) {
    console.error(err);
    print(`LOAD FAILED: ${err.code || ""} ${err.message || err}`);
  }
}


/* CLICK HANDLER: history lines + confirmation YES/NO */
screen.addEventListener("click", (e) => {

  // Prevent history logic while viewing friends
  if (screen.classList.contains("friends-screen")) {
    return;
  }

  const target = e.target;


  // Confirmation buttons
  const confirmAction = target.dataset.confirm;
  if (confirmAction === "yes") {
    if (store.editingActivity) {
      openEditActivity(store.editingActivity);
    }
    return;
  }
  if (confirmAction === "no") {
    store.editingActivity = null;
    showHistory();
    return;
  }

  // Activity line clicked
  const row = target.closest(".activity-line");
  if (!row) return;

  const id = row.dataset.id;
  const activity = store.activities.find(a => a.id === id);
  if (!activity) return;

  store.editingActivity = activity;
document.getElementById("cancelEditWindowBtn").classList.remove("hidden");
addActivityBtn.textContent = "Save Activity";


  const dist = activity.distance != null && activity.distance !== "" ? ` — ${activity.distance}` : "";
  const notes = activity.notes ? ` (${activity.notes})` : "";
  const line = `${activity.type} — ${activity.duration} min${dist}${notes}`;

screen.innerHTML = `
  <div class="edit-confirm">
    <div class="pip-title">EDIT ACTIVITY</div>
    <div class="stat-line confirm-line">${line}</div>

    <div class="confirm-row">
      <span class="pip-btn" data-confirm="yes">YES</span>
      <span class="pip-btn" data-confirm="no">NO</span>
    </div>
  </div>
`;



});


////////////////////////* DISPLAY: STATISTICS *//////////////////////
async function showStatistics() {
  hideAllForms();
  screen.textContent = "";
  updateHealthBar();

  const uid = store.session.userId;
  if (!uid) {
    print("NOT LOGGED IN.");
    return;
  }

  try {
    const snap = await activitiesRef(uid)
      .orderBy("createdAt", "desc")
      .get();

    const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (!list.length) {
      print("No activities to show statistics.");
      return;
    }

    // --- STREAKS ---
    const { currentStreak, bestStreak } = calculateStreaks(list);

    // --- TOTAL TIME MOVING ---
    let totalMinutes = 0;
    for (const a of list) {
      totalMinutes += Number(a.duration || 0);
    }

    // --- TOP DAY ---
    const dayTotals = {};
    for (const a of list) {
      const date = a.date.trim().slice(0, 10);
      if (!dayTotals[date]) dayTotals[date] = 0;
      dayTotals[date] += Number(a.duration || 0);
    }

    let topDayMinutes = 0;
    for (const mins of Object.values(dayTotals)) {
      if (mins > topDayMinutes) topDayMinutes = mins;
    }

    // --- TOP WEEK (7‑day window) ---
    const allDates = Object.keys(dayTotals).sort();
    let topWeekMinutes = 0;

    if (allDates.length > 0) {
      const startDate = new Date(allDates[0]);
      const endDate = new Date(allDates[allDates.length - 1]);

      const fullRange = [];
      let d = new Date(startDate);

      while (d <= endDate) {
        const key = d.toISOString().slice(0, 10);
        fullRange.push({
          date: key,
          minutes: dayTotals[key] || 0
        });
        d.setDate(d.getDate() + 1);
      }

      for (let i = 0; i <= fullRange.length - 7; i++) {
        let sum = 0;
        for (let j = 0; j < 7; j++) {
          sum += fullRange[i + j].minutes;
        }
        if (sum > topWeekMinutes) {
          topWeekMinutes = sum;
        }
      }
    }

    // --- TOTALS BY TYPE ---
    const totals = {};
    for (const a of list) {
      const type = (a.type || "").trim();
      if (!type) continue;

      if (!totals[type]) totals[type] = { minutes: 0, distance: 0 };

      totals[type].minutes += Number(a.duration || 0);
      if (a.distance != null && a.distance !== "") {
        totals[type].distance += Number(a.distance || 0);
      }
    }

    const rows = Object.entries(totals)
      .sort(([, A], [, B]) => B.minutes - A.minutes);

    // --- BUILD STAT LINES ---
    const lines = [
      `<div class="pip-title">STREAKS</div>`,
      `Current streak: ${currentStreak} day(s)`,
      `Best streak: ${bestStreak} day(s)`,

      `<div class="pip-title">MOVEMENT TOTALS</div>`,
      `Total time moving: ${formatMinutes(totalMinutes)}`,
      `Top day: ${formatMinutes(topDayMinutes)}`,
      `Top week: ${formatMinutes(topWeekMinutes)}`,

      `<div class="pip-title">TOTALS BY TYPE</div>`
    ];

    for (const [type, t] of rows) {
      const minutes = formatMinutes(t.minutes);
      const distance = t.distance ? `${t.distance.toFixed(2)} Km` : "";
      const line = distance
        ? `${type} - ${minutes} - ${distance}`
        : `${type} - ${minutes}`;
      lines.push(line);
    }

    // --- RENDER STATS ---
    screen.innerHTML =
      lines
        .map(line => {
          if (line.includes("pip-title")) {
            return line;
          }
          return `<div class="stat-line pip-item">${line}</div>`;
        })
        .join("");

    // --- FRIENDS SECTION (inline, using same logic as showFriends) ---
    const followingHtml = await renderFollowingList();
    const followerCount = await getFollowerCount();
    const followingCount = followingHtml.trim() === "" ? 0 : followingHtml.split("\n").length;

    const friendsContainer = document.createElement("div");
    friendsContainer.id = "statsFriendsContainer";
    friendsContainer.style.marginTop = "24px";
    screen.appendChild(friendsContainer);

    // Titles
    const followersTitle = document.createElement("div");
    followersTitle.classList.add("pip-title");
    followersTitle.textContent = `FOLLOWERS — ${followerCount}`;
    friendsContainer.appendChild(followersTitle);

    const followingTitle = document.createElement("div");
    followingTitle.classList.add("pip-title");
    followingTitle.textContent = `FOLLOWING — ${followingCount}`;
    friendsContainer.appendChild(followingTitle);

    // Following list
    const linesArr = followingHtml.split("\n");
    linesArr.forEach(line => {
      if (!line.trim()) return;

      const div = document.createElement("div");
      div.classList.add("line");
      div.textContent = line;

      if (line.trim().startsWith(">")) {
        const username = line.trim().replace(/^>\s*/, "");
        div.style.cursor = "pointer";
        div.onclick = () => toggleFriendDetails(div, username);
      }

      friendsContainer.appendChild(div);
    });

    // Spacer (like showFriends)
    const followTitle = document.createElement("div");
    followTitle.innerHTML = `<strong></strong>`;
    followTitle.style.marginTop = "32px";
    followTitle.style.marginBottom = "12px";
    friendsContainer.appendChild(followTitle);

    // Show friend controls
    const controls = document.getElementById("friendControls");
    if (controls) controls.classList.remove("hidden");

  } catch (err) {
    console.error(err);
    print(`STATS FAILED: ${err.code || ""} ${err.message || err}`);
  }
}







//////////////////////////* BOOT */////////////////////////////
auth.onAuthStateChanged(async (user) => {
  updateDailyQuote();
  if (store.authBusy) return;

  if (user) {
    store.session.userId = user.uid;

    const uname = await loadUsernameForUid(user.uid);
    store.session.username = uname || store.session.username || "USER";

    save();
    loadActivitySuggestions();
    importActivityNamesFromHistory();

    showApp(true);

    // Remove all old highlights
    document.querySelectorAll('#menu button').forEach(btn =>
      btn.classList.remove('active')
    );

    document.querySelector('#menu button[data-action="log"]').classList.add('active');
    document.getElementById("healthBarWrapper").style.display = "block";

    setTimeout(() => {
      updateHealthBar();
    }, 50);

  } else {
    store.session.userId = null;
    store.session.username = null;
    save();
    showLogin();
  }
});


