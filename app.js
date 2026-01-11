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
const deleteIndex = document.getElementById("deleteIndex");
const deleteBtn = document.getElementById("deleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

/* STORAGE (activities still local for now) */
const store = {
  session: JSON.parse(localStorage.getItem("session")) || { userId: null, username: null },
  activities: JSON.parse(localStorage.getItem("activities")) || [],
  switchConfirm: false,
  currentDisplayList: [],
  authBusy: false,
  pendingLoginError: ""
};

function save() {
  localStorage.setItem("session", JSON.stringify(store.session));
  localStorage.setItem("activities", JSON.stringify(store.activities));
}

/* HELPERS */
function print(text = "") {
  screen.innerHTML = text.replace(/\n/g, "<br>");
}

function currentUser() {
  return { id: store.session.userId, username: store.session.username || "USER" };
}

function normalizeUsername(name) {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")          // remove spaces
    .replace(/[^a-z0-9_]/g, "");  // allow a-z 0-9 _
}

function activitiesRef(uid) {
  return db.collection("users").doc(uid).collection("activities");
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
  } catch (e) {}
  return null;
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

  // show any pending auth/db error
  loginError.textContent = store.pendingLoginError || "";
  store.pendingLoginError = "";

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

  activityType.value = "";
  activityDuration.value = "";
  activityNotes.value = "";

  const today = new Date().toISOString().slice(0, 10);
  activityDate.value = today;

  activityType.focus();
}

function showProfileForm() {
  hideAllForms();
  screen.textContent = "";
  profileForm.classList.remove("hidden");

  profileUsername.value = store.session.username || "";
  profilePin.value = ""; // always blank
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

      // Prefer username from Firestore (cross-device)
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

      // Transaction: claim username if available
      const unameRef = db.collection("usernames").doc(username);
      const userRef = db.collection("users").doc(uid);

      try {
        await db.runTransaction(async (tx) => {
          const unameSnap = await tx.get(unameRef);
          if (unameSnap.exists) {
            throw new Error("USERNAME_TAKEN");
          }

          tx.set(unameRef, {
            uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          tx.set(userRef, {
            username,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });

        print("USERNAME CLAIMED.\nPROFILE SAVED.");

        // Success
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
        // Username taken (or transaction fail) -> cleanup the just-created auth user
        console.error(e);

        if (e?.message === "USERNAME_TAKEN") {
          store.pendingLoginError = "USERNAME TAKEN";
        } else {
          store.pendingLoginError = `DB ERROR: ${e?.code || ""} ${e?.message || e}`;
        }



        // Attempt to delete auth account created moments ago
        try {
          await auth.currentUser.delete();
        } catch (_) {}

        // Ensure logged out state
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
    case "log": showActivityForm(); store.switchConfirm = false; break;
    case "today": showToday(); store.switchConfirm = false; break;
    case "history": showHistory(); store.switchConfirm = false; break;
    case "profile": showProfileForm(); store.switchConfirm = false; break;
    case "stats": showStatistics(); store.switchConfirm = false; break;

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

/* ACTIVITY FORM */
addActivityBtn.addEventListener("click", () => {
  const type = activityType.value.trim();
  const duration = activityDuration.value;
  const notes = activityNotes.value.trim();
  const date = activityDate.value || new Date().toISOString().slice(0, 10);

  if (!type || !duration) return alert("Fill activity and minutes");

  const uid = store.session.userId;
  if (!uid) { print("NOT LOGGED IN."); return; }
  
  const distanceRaw = (document.getElementById("activityDistance")?.value || "").trim();
  const distance = distanceRaw ? Number(distanceRaw) : null;
  
  activitiesRef(uid).add({
    date,
    type,
    duration: Number(duration),
    distance,
    notes,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    // optional: clear distance input after save
    const distEl = document.getElementById("activityDistance");
    if (distEl) distEl.value = "";
  
    hideAllForms();
    print("Activity logged.");
  })
  .catch(err => {
    console.error(err);
    print(`SAVE FAILED: ${err.code || ""} ${err.message || err}`);
  });

});

cancelActivityBtn.addEventListener("click", hideAllForms);

/* PROFILE SAVE (PIN change yes, username change not yet) */
saveProfileBtn.addEventListener("click", () => {
  const requestedUsername = normalizeUsername(profileUsername.value);
  const current = normalizeUsername(store.session.username || "");
  const newPin = profilePin.value.trim();

  // Username change not supported yet (keeps uniqueness simple)
  if (requestedUsername && requestedUsername !== current) {
    print("USERNAME CHANGE NOT AVAILABLE YET.\n(Requires username transfer logic.)");
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

/* DELETE ACTIVITY */
deleteBtn.addEventListener("click", () => {
  const idx = Number(deleteIndex.value) - 1;
  const list = store.currentDisplayList || [];

  if (idx < 0 || idx >= list.length) return print("Invalid activity number.");

  const idToDelete = list[idx].id;
  store.activities = store.activities.filter(a => a.id !== idToDelete);
  save();

  deleteIndex.value = "";
  showHistory();
});

cancelDeleteBtn.addEventListener("click", () => {
  deleteForm.classList.add("hidden");
});

/* DISPLAY FUNCTIONS */
async function showToday() {
  hideAllForms();
  screen.textContent = "";

  const uid = store.session.userId;
  if (!uid) { print("NOT LOGGED IN."); return; }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const snap = await db
      .collection("users").doc(uid)
      .collection("activities")
      .where("date", "==", today)
      .orderBy("createdAt", "desc")
      .get();

    const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    store.currentDisplayList = list;

    if (!list.length) {
      print("No activities today.");
      return;
    }

    const output = list.map((a, i) => {
      const dist = (a.distance != null) ? ` | ${a.distance}` : "";
      const notes = a.notes ? ` (${a.notes})` : "";
      return `${i + 1}. ${a.type} - ${a.duration} min${dist}${notes}`;
    }).join("\n");

    print(output);

  } catch (err) {
    console.error(err);
    print(`LOAD FAILED: ${err.code || ""} ${err.message || err}`);
  }
}


function showHistory() {
  hideAllForms();
  screen.textContent = "";

  const list = store.activities.filter(a => a.userId === store.session.userId);

  if (list.length) {
    const output = list.map((a, i) =>
      `${i + 1}. ${a.date} | ${a.type} | ${a.duration} min${a.notes ? " (" + a.notes + ")" : ""}`
    ).join("\n");

    print(output + "\n");

    deleteForm.classList.remove("hidden");
    deleteIndex.value = "";
    deleteIndex.focus();

    store.currentDisplayList = list;
  } else {
    print("No history.");
    store.currentDisplayList = [];
    deleteForm.classList.add("hidden");
  }
}

function showStatistics() {
  hideAllForms();
  const userActivities = store.activities.filter(a => a.userId === store.session.userId);
  screen.textContent = "";

  if (!userActivities.length) {
    print("No activities to show statistics.");
    return;
  }

  const totals = {};
  userActivities.forEach(a => {
    const key = (a.type || "").trim();
    if (!totals[key]) totals[key] = 0;
    totals[key] += a.duration;
  });

  const lines = ["--- STATISTICS ---"];
  for (const [type, mins] of Object.entries(totals)) {
    lines.push(`${type} : ${mins} min`);
  }

  print(lines.join("\n"));
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








