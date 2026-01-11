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
const activityNotes = document.getElementById("activityNotes");
const addActivityBtn = document.getElementById("addActivityBtn");
const cancelActivityBtn = document.getElementById("cancelActivityBtn");

const profileForm = document.getElementById("profileForm");
const profileUsername = document.getElementById("profileUsername");
const profilePin = document.getElementById("profilePin");
const saveProfileBtn = document.getElementById("saveProfileBtn");

const deleteForm = document.getElementById("deleteForm");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

const editIndex = document.getElementById("editIndex");
const editBtn = document.getElementById("editBtn");

const deleteActivityBtn = document.getElementById("deleteActivityBtn");

/* STORAGE */
const store = {
  session: JSON.parse(localStorage.getItem("session")) || { userId: null, username: null },
  activities: JSON.parse(localStorage.getItem("activities")) || [], // legacy local (not used for listing now)
  switchConfirm: false,
  currentDisplayList: [],
  authBusy: false,
  pendingLoginError: "",
  editingActivity: null
};

function save() {
  localStorage.setItem("session", JSON.stringify(store.session));
  localStorage.setItem("activities", JSON.stringify(store.activities));
}

/* HELPERS */
function print(text = "") {
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

if (deleteActivityBtn) {
  deleteActivityBtn.addEventListener("click", async () => {
    const uid = store.session.userId;
    const a = store.editingActivity;

    if (!uid) { print("NOT LOGGED IN."); return; }
    if (!a || !a.id) { print("NOTHING TO DELETE."); return; }

    try {
      await activitiesRef(uid).doc(a.id).delete();

      // reset edit mode
      store.editingActivity = null;
      addActivityBtn.textContent = "Add Activity";
      deleteActivityBtn.classList.add("hidden");

      hideAllForms();
      print("Activity deleted.");

      await showHistory(); // refresh list

    } catch (err) {
      console.error(err);
      print(`DELETE FAILED: ${err.code || ""} ${err.message || err}`);
    }
  });
}


/* VIEWS */
function hideAllForms() {
  activityForm.classList.add("hidden");
  profileForm.classList.add("hidden");
  deleteForm.classList.add("hidden");
}

function showLogin() {
  loginView.classList.remove("hidden");
  appView.classList.add("hidden");

  loginError.textContent = store.pendingLoginError || "";
  store.pendingLoginError = "";

  // reset edit mode if any
  store.editingActivity = null;
  addActivityBtn.textContent = "Add Activity";

  loginEmail.focus();
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

 // If we are NOT editing, hide delete + set label
  if (!store.editingActivity) {
    if (deleteActivityBtn) deleteActivityBtn.classList.add("hidden");
    addActivityBtn.textContent = "Add Activity";
  }

  // If editing, we'll fill them from editBtn handler.
  if (!store.editingActivity) {
    activityType.value = "";
    activityDuration.value = "";
    activityNotes.value = "";
    const distEl = document.getElementById("activityDistance");
    if (distEl) distEl.value = "";

    const today = new Date().toISOString().slice(0, 10);
    activityDate.value = today;

    addActivityBtn.textContent = "Add Activity";
  }

  activityType.focus();
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

/* LOGIN */
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

/* MENU */
menu.addEventListener("click", e => {
  if (!e.target.dataset.action) return;

  hideAllForms();
  screen.textContent = "";

  switch (e.target.dataset.action) {
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

    // clear distance
    const distEl = document.getElementById("activityDistance");
    if (distEl) distEl.value = "";

    hideAllForms();
    print("Activity logged.");

  } catch (err) {
    console.error(err);
    print(`SAVE FAILED: ${err.code || ""} ${err.message || err}`);
  }
});

cancelActivityBtn.addEventListener("click", () => {
  store.editingActivity = null;
  addActivityBtn.textContent = "Add Activity";
  if (deleteActivityBtn) deleteActivityBtn.classList.add("hidden");
  hideAllForms();
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

/* DELETE ACTIVITY (Firestore) */
deleteBtn.addEventListener("click", async () => {
  const idx = Number(deleteIndex.value) - 1;
  const list = store.currentDisplayList || [];

  if (idx < 0 || idx >= list.length) { print("Invalid activity number."); return; }

  const uid = store.session.userId;
  if (!uid) { print("NOT LOGGED IN."); return; }

  const docId = list[idx].id;

  try {
    await activitiesRef(uid).doc(docId).delete();
    deleteIndex.value = "";
    await showHistory();
  } catch (err) {
    console.error(err);
    print(`DELETE FAILED: ${err.code || ""} ${err.message || err}`);
  }
});

cancelDeleteBtn.addEventListener("click", () => {
  deleteForm.classList.add("hidden");
});

/* EDIT ACTIVITY (open form prefilled) */
editBtn.addEventListener("click", () => {
  const idx = Number(editIndex.value) - 1;
  const list = store.currentDisplayList || [];

  if (idx < 0 || idx >= list.length) { print("Invalid activity number."); return; }

  const a = list[idx];
  store.editingActivity = a;

  showActivityForm();

  activityType.value = a.type || "";
  activityDuration.value = (a.duration != null) ? a.duration : "";
  activityNotes.value = a.notes || "";
  activityDate.value = a.date || new Date().toISOString().slice(0, 10);

  const distEl = document.getElementById("activityDistance");
  if (distEl) distEl.value = (a.distance != null) ? a.distance : "";

  addActivityBtn.textContent = "Save Changes";
  if (deleteActivityBtn) deleteActivityBtn.classList.remove("hidden");
});

cancelDeleteBtn.addEventListener("click", () => {
  deleteForm.classList.add("hidden");
});

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



/* DISPLAY: HISTORY (TODAY + PAST) */
async function showHistory() {
  hideAllForms();
  screen.textContent = "";

  const uid = store.session.userId;
  if (!uid) { print("NOT LOGGED IN."); return; }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const snap = await activitiesRef(uid)
      .orderBy("createdAt", "desc")
      .get();

    const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (!list.length) {
      print("No history.");
      deleteForm.classList.add("hidden");
      return;
    }

    const todayList = list.filter(a => a.date === today);
    const pastList = list.filter(a => a.date !== today);

    const displayList = [...todayList, ...pastList];
    store.currentDisplayList = displayList;


    const lines = [];

    lines.push("--- TODAY ---");
    if (todayList.length) {
      todayList.forEach((a, i) => {
        const num = i + 1;
        const dist = (a.distance != null) ? ` | ${a.distance}` : "";
        const notes = a.notes ? ` (${a.notes})` : "";
        lines.push(`${num}. ${a.type} | ${a.duration} min${dist}${notes}`);
      });
    } else {
      lines.push("(none)");
    }

    lines.push("");
    lines.push("--- PAST ---");

    if (pastList.length) {
      pastList.forEach((a, i) => {
        const num = todayList.length + i + 1;
        const dist = (a.distance != null) ? ` | ${a.distance}` : "";
        const notes = a.notes ? ` (${a.notes})` : "";
        lines.push(`${num}. ${a.date} | ${a.type} | ${a.duration} min${dist}${notes}`);
      });
    } else {
      lines.push("(none)");
    }

    print(lines.join("\n") + "\n");

    // show tools
    deleteForm.classList.remove("hidden");
    editIndex.value = "";
    editIndex.focus();


  } catch (err) {
    console.error(err);
    print(`LOAD FAILED: ${err.code || ""} ${err.message || err}`);
    deleteForm.classList.add("hidden");
  }
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

    const lines = ["--- STATISTICS ---", "TYPE | MINUTES | DIST", ""];

    for (const [type, t] of rows) {
      const distStr = t.distance ? t.distance.toFixed(2) : "-";
      lines.push(`${type} | ${t.minutes} | ${distStr}`);
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


