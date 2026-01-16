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
  // Used by existing flows: overwrite content, simple text
  screen.innerHTML = String(text).replace(/\n/g, "<br>");
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
  list = list.map(a => ({ ...a, date: a.date.trim().slice(0, 10) }));

  // Extract unique dates, newest first
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


  // ---- BEST STREAK: longest run anywhere ----
  let bestStreak = 0;
  let streak = 0;
  let prev = null;

  for (const dateStr of uniqueDates.slice().reverse()) {
    const dayIndex = daysFromDateString(dateStr);

    if (prev === null || dayIndex === prev + 1) {
      streak++;
    } else if (dayIndex > prev + 1) {
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



//////////////////////////////* VIEWS *////////////////////////////
function hideAllForms() {
  activityForm.classList.add("hidden");
  profileForm.classList.add("hidden");
  if (deleteForm) deleteForm.classList.add("hidden"); // keep old form hidden
}

function showLogin() {
  hideAllForms();
  loginView.classList.remove("hidden");
  appView.classList.add("hidden");

  loginError.textContent = store.pendingLoginError || "";
  store.pendingLoginError = "";

  store.editingActivity = null;
  addActivityBtn.textContent = "Add Activity";
}

function showApp(showActivity = false) {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  hideAllForms();

  if (showActivity) showActivityForm();
  else drawHome();
}

function showActivityForm() {

  hideAllForms();
  screen.textContent = "";
  activityForm.classList.remove("hidden");

  store.editingActivity = null;
  addActivityBtn.textContent = "Add Activity";
  if (deleteActivityBtn) deleteActivityBtn.classList.add("hidden");

  activityType.value = "";
  activityDuration.value = "";
  activityNotes.value = "";
  const distEl = document.getElementById("activityDistance");
  if (distEl) distEl.value = "";

  // ALWAYS reset date to today
  const today = getLocalDateString();
  activityDate.value = today;
  activityDate.max = today;

  if (activityDate.value > activityDate.max) {
    activityDate.value = activityDate.max;
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

function showFriends() {
  hideAllForms();
  screen.textContent = "";
  print("This feature is under construction.");
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
  print(`USER: ${user.username}\n\nSelect an option.`);
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
menu.addEventListener("click", e => {
  const action = e.target.dataset.action;
  if (!action) return;

  hideAllForms();
  screen.textContent = "";

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
        print("Press 'Switch User' again to confirm logout.");
      }
      break;
  }
});

/* ACTIVITY FORM (ADD OR UPDATE) */
addActivityBtn.addEventListener("click", async () => {
  const type = activityType.value.trim();
  const duration = activityDuration.value;
  const notes = activityNotes.value.trim();
  const date = activityDate.value || new Date().toISOString().slice(0, 10);

  if (!type || !duration) {
    print("FILL ACTIVITY AND MINUTES.");
    return;
  }

  const uid = store.session.userId;
  if (!uid) { print("NOT LOGGED IN."); return; }

  const distanceRaw = (document.getElementById("activityDistance")?.value || "").trim();
  const distance = distanceRaw ? Number(distanceRaw) : null;

  const payload = {
    date,
    type,
    duration: Number(duration),
    distance,
    notes
  };

  try {
    if (store.editingActivity && store.editingActivity.id) {
      // UPDATE
      await activitiesRef(uid).doc(store.editingActivity.id).update(payload);

      store.editingActivity = null;
      addActivityBtn.textContent = "Add Activity";
      if (deleteActivityBtn) deleteActivityBtn.classList.add("hidden");

      hideAllForms();
      print("Activity updated.");
      await showHistory(); // refresh after update
      return;
    }

// ADD
await activitiesRef(uid).add({
  ...payload,
  createdAt: firebase.firestore.FieldValue.serverTimestamp()
});

const distEl = document.getElementById("activityDistance");
if (distEl) distEl.value = "";

// Jump directly to statistics
hideAllForms();
showStatistics("Activity logged.");


  } catch (err) {
    console.error(err);
    print(`SAVE FAILED: ${err.code || ""} ${err.message || err}`);
  }
});

cancelActivityBtn.addEventListener("click", async () => {
  const wasEditing = !!store.editingActivity;

  store.editingActivity = null;
  addActivityBtn.textContent = "Add Activity";
  if (deleteActivityBtn) deleteActivityBtn.classList.add("hidden");

  hideAllForms();

  if (wasEditing) {
    await showHistory();   // go back to history if canceling an edit
  } else {
    drawHome();            // normal cancel from "Log Activity"
  }
});

/* PROFILE SAVE (PIN change only) */
saveProfileBtn.addEventListener("click", () => {
  const requestedUsername = normalizeUsername(profileUsername.value);
  const current = normalizeUsername(store.session.username || "");
  const newPin = profilePin.value.trim();

  if (requestedUsername && requestedUsername !== current) {
    print("USERNAME CHANGE NOT AVAILABLE YET.");
    profileUsername.value = store.session.username || "";
    profilePin.value = "";
    return;
  }

  if (!newPin) {
    print("PROFILE UPDATED.");
    hideAllForms();
    drawHome();
    return;
  }

  auth.currentUser.updatePassword(newPin)
    .then(() => {
      print("PROFILE UPDATED.");
      hideAllForms();
      drawHome();
    })
    .catch(() => {
      print("PIN CHANGE REQUIRES RE-LOGIN.");
      hideAllForms();
      drawHome();
    });
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

///////////////////////////* DISPLAY: HISTORY (TODAY / YESTERDAY / LAST 7 DAYS / OLDER) *////////////////////////////
async function showHistory() {
  hideAllForms();
  screen.textContent = "";

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

        const dist = a.distance != null && a.distance !== "" ? ` — ${a.distance}` : "";
        const notes = a.notes ? ` (${a.notes})` : "";
        const base = showDateLabel ? `${dateLabel} — ${a.type}` : a.type;
        const line = `&gt; ${base} — ${a.duration} min${dist}${notes}`;
        html += `<div class="activity-line" data-id="${a.id}">${line}</div><br>`;
      }

      append("");
    }

    // TODAY
    const todayLabel = formatShortDateFromDate(today);
    append(`TODAY — ${todayLabel}`);
    if (groups.today.length) {
      appendGroup("", groups.today, false);
    } else {
      append("(none)");
      append("");
    }

    // YESTERDAY
    if (groups.yesterday.length) {
      const y = new Date(today.getTime() - dayMs);
      const yLabel = formatShortDateFromDate(y);
      append(`YESTERDAY — ${yLabel}`);
      appendGroup("", groups.yesterday, false);
    }

    // LAST 7 DAYS (2–7 days ago)
    appendGroup("LAST 7 DAYS", groups.last7, true);

    // OLDER
    appendGroup("OLDER", groups.older, true);

    screen.innerHTML = html;

  } catch (err) {
    console.error(err);
    print(`LOAD FAILED: ${err.code || ""} ${err.message || err}`);
  }
}


/* CLICK HANDLER: history lines + confirmation YES/NO */
screen.addEventListener("click", (e) => {
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

  const dist = activity.distance != null && activity.distance !== "" ? ` — ${activity.distance}` : "";
  const notes = activity.notes ? ` (${activity.notes})` : "";
  const line = `${activity.type} — ${activity.duration} min${dist}${notes}`;

  screen.innerHTML =
    `EDIT THIS ACTIVITY?<br>${line}<br><br>` +
    `<span data-confirm="yes">[YES]</span>&nbsp;&nbsp;` +
    `<span data-confirm="no">[NO]</span>`;
});

///////////////////* REPAIR: STATISTICS *////////////////////////
async function repairShiftedDates() {
  const uid = store.session.userId;
  if (!uid) {
    print("NOT LOGGED IN.");
    return;
  }

  print("Starting date repair...");

  const snap = await activitiesRef(uid).get();
  const updates = [];

  snap.forEach(doc => {
    const data = doc.data();
    const dateStr = data.date;

    if (!dateStr) return;

    // Parse the stored date
    const [y, m, d] = dateStr.split("-").map(Number);
    const stored = new Date(y, m - 1, d);

    // Detect UTC shift: stored date is one day behind local date
    const corrected = new Date(stored.getFullYear(), stored.getMonth(), stored.getDate() + 1);

    // Convert back to YYYY-MM-DD
    const fixed = [
      corrected.getFullYear(),
      String(corrected.getMonth() + 1).padStart(2, "0"),
      String(corrected.getDate()).padStart(2, "0")
    ].join("-");

    // Only update if changed
    if (fixed !== dateStr) {
      updates.push(doc.ref.update({ date: fixed }));
    }
  });

  await Promise.all(updates);

  print(`Repaired ${updates.length} activities.`);
  print("Date repair complete.");
}

async function repairShiftedDates2() {
  const uid = store.session.userId;
  if (!uid) {
    print("NOT LOGGED IN.");
    return;
  }

  print("Starting date repair...");

  const snap = await activitiesRef(uid).get();
  const updates = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const doc of snap.docs) {
    const data = doc.data();
    const dateStr = data.date;
    if (!dateStr) continue;

    const d = parseLocalDate(dateStr);

    // Calculate diff in days
    const diff = Math.floor((today - d) / 86400000);

    // Only fix entries that are exactly 1 day behind
    if (diff === 1) {
      const corrected = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

      const fixed = [
        corrected.getFullYear(),
        String(corrected.getMonth() + 1).padStart(2, "0"),
        String(corrected.getDate()).padStart(2, "0")
      ].join("-");

      updates.push(doc.ref.update({ date: fixed }));
    }
  }

  await Promise.all(updates);

  print(`Repaired ${updates.length} activities.`);
  print("Date repair complete.");
}



/* DISPLAY: STATISTICS */
async function showStatistics() {

  hideAllForms();
  screen.textContent = "";

  const uid = store.session.userId;
  if (!uid) { print("NOT LOGGED IN."); return; }

  try {
    const snap = await activitiesRef(uid)
      .orderBy("createdAt", "desc")
      .get();

    const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (!list.length) {
      print("No activities to show statistics.");
      return;
    }

    // --- NEW: streak calculation ---
    const { currentStreak, bestStreak } = calculateStreaks(list);

    const totals = {}; // { type: { minutes, distance } }

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

      const lines = [
        ("STREAKS"),
        "",
        (`Current streak: ${currentStreak} day(s)`), 
        (`Best streak: ${bestStreak} day(s)`),
        "",
        ("TOTALS BY TYPE"),
        ""
      ];


      for (const [type, t] of rows) {
        const minutes = `${t.minutes} Min`;
        const distance = t.distance ? `${t.distance.toFixed(2)} Km` : "";
        const line = distance
          ? `${type} - ${minutes} - ${distance}`
          : `${type} - ${minutes}`;
        lines.push(line);
      }




    print(lines.join("\n"));

  } catch (err) {
    console.error(err);
    print(`STATS FAILED: ${err.code || ""} ${err.message || err}`);
  }
}


/* BOOT */
auth.onAuthStateChanged(async (user) => {
  if (store.authBusy) return;

  if (user) {
    store.session.userId = user.uid;

    const uname = await loadUsernameForUid(user.uid);
    store.session.username = uname || store.session.username || "USER";

    save();
    showApp(true);
  } else {
    store.session.userId = null;
    store.session.username = null;
    save();
    showLogin();
  }
});

function handleLoginKey(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    loginBtn.click();
  }
}

loginEmail.addEventListener("keydown", handleLoginKey);
loginPin.addEventListener("keydown", handleLoginKey);
loginUser.addEventListener("keydown", handleLoginKey);
