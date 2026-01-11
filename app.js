/* ELEMENTS */
const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginUser = document.getElementById("loginUser");
const loginEmail = document.getElementById("loginEmail");
const loginPin = document.getElementById("loginPin");
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

/* STORAGE */
const store = {
  users: JSON.parse(localStorage.getItem("users")) || [],
  session: JSON.parse(localStorage.getItem("session")) || { userId: null },
  activities: JSON.parse(localStorage.getItem("activities")) || [],
  switchConfirm: false,
  currentDisplayList: []
};

function save() {
  localStorage.setItem("users", JSON.stringify(store.users));
  localStorage.setItem("session", JSON.stringify(store.session));
  localStorage.setItem("activities", JSON.stringify(store.activities));
}

/* HELPERS */
function currentUser() {
  // Firebase user id is stored in store.session.userId
  return { id: store.session.userId, username: store.session.username || "UNKNOWN" };
}


function print(text = "") {
  screen.innerHTML = text.replace(/\n/g, "<br>");
}

/* VIEWS */
function hideAllForms() {
  activityForm.classList.add("hidden");
  profileForm.classList.add("hidden");
  deleteForm.classList.add("hidden");
}

function showApp(showActivity = false) {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  hideAllForms();

  if(showActivity) showActivityForm();
  else drawHome();
}

function showActivityForm() {
  hideAllForms();
  screen.textContent = "";
  activityForm.classList.remove("hidden");

  activityType.value = "";
  activityDuration.value = "";
  activityNotes.value = "";

  const today = new Date().toISOString().slice(0,10);
  activityDate.value = today;

  activityType.focus();
}

function showProfileForm() {
  hideAllForms();
  screen.textContent = "";
  profileForm.classList.remove("hidden");

  profileUsername.value = store.session.username || "";
  profilePin.value = ""; // do not display pin
}


function drawHome() {
  screen.textContent = "";
  const user = currentUser();
  print(`USER: ${user.username}\n\nSelect an option.`);
}

/* LOGIN & CREATE USER */
loginBtn.addEventListener("click", () => {
  const username = loginUser.value.trim();
  const email = (loginEmail.value || "").trim();
  const pin = loginPin.value.trim();

  if (!email || !pin) {
    loginError.textContent = "ENTER EMAIL AND PIN";
    return;
  }

  auth.signInWithEmailAndPassword(email, pin)
    .then(userCred => {
      store.session.userId = userCred.user.uid;

      // Keep a local display name (can be edited in Profile)
      store.session.username = username || store.session.username || "USER";

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



createBtn.addEventListener("click", () => {
  const username = loginUser.value.trim();
  const email = (loginEmail.value || "").trim();
  const pin = loginPin.value.trim();

  if (!username || !email || !pin) {
    loginError.textContent = "ENTER USERNAME, EMAIL, AND PIN";
    return;
  }

  auth.createUserWithEmailAndPassword(email, pin)
    .then(userCred => {
      store.session.userId = userCred.user.uid;
      store.session.username = username;
      save();

      loginError.textContent = "";
      loginUser.value = "";
      loginEmail.value = "";
      loginPin.value = "";

      showApp(true);
    })
    .catch(err => {
      console.error(err);
      loginError.textContent = `${err.code || "ERROR"}: ${err.message || "CREATE FAILED"}`;
    });
});



/* MENU */
menu.addEventListener("click", e => {
  if(!e.target.dataset.action) return;

  hideAllForms();
  screen.textContent = "";

  switch(e.target.dataset.action){
    case "log": showActivityForm(); store.switchConfirm = false; break;
    case "today": showToday(); store.switchConfirm = false; break;
    case "history": showHistory(); store.switchConfirm = false; break;
    case "profile": showProfileForm(); store.switchConfirm = false; break;
    case "stats": showStatistics(); store.switchConfirm = false; break;
    case "switch":
      if(store.switchConfirm) {
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
  const date = activityDate.value || new Date().toISOString().slice(0,10);

  if(!type || !duration) return alert("Fill activity and minutes");

  store.activities.push({
    id: Date.now().toString(),
    userId: store.session.userId,
    date,
    type,
    duration: Number(duration),
    notes
  });
  save();
  hideAllForms();
  print("Activity logged.");
});

cancelActivityBtn.addEventListener("click", hideAllForms);

/* PROFILE SAVE */
saveProfileBtn.addEventListener("click", () => {
  const username = profileUsername.value.trim();
  const newPin = profilePin.value.trim();

  // Username is required, PIN is optional
  if (!username) {
    print("USERNAME REQUIRED.");
    return;
  }

  // Save display name locally
  store.session.username = username;
  save();

  // If PIN is blank, we ONLY update username display
  if (!newPin) {
    print("PROFILE UPDATED.");
    hideAllForms();
    drawHome();
    return;
  }

  // If PIN provided, attempt to update Firebase password
  auth.currentUser.updatePassword(newPin)
    .then(() => {
      print("PROFILE UPDATED.");
      hideAllForms();
      drawHome();
    })
    .catch(() => {
      print("USERNAME UPDATED.\nPIN CHANGE REQUIRES RE-LOGIN.");
      hideAllForms();
      drawHome();
    });
});


/* DELETE ACTIVITY */
deleteBtn.addEventListener("click", () => {
  const idx = Number(deleteIndex.value) - 1;
  const list = store.currentDisplayList || [];

  if(idx < 0 || idx >= list.length) return print("Invalid activity number.");

  const idToDelete = list[idx].id;
  store.activities = store.activities.filter(a => a.id !== idToDelete);
  save();

  deleteIndex.value = "";

  // Refresh history view
  showHistory();
});

cancelDeleteBtn.addEventListener("click", () => {
  deleteForm.classList.add("hidden");
});

/* DISPLAY FUNCTIONS */
function showToday() {
  hideAllForms();
  const today = new Date().toISOString().slice(0,10);
  const list = store.activities.filter(a => a.userId===store.session.userId && a.date===today);

  if(list.length) {
    let output = list.map((a,i) => `${i+1}. ${a.type} - ${a.duration} min${a.notes ? " (" + a.notes + ")" : ""}`).join("\n");
    print(output);
    store.currentDisplayList = list;
  } else {
    print("No activities today.");
    store.currentDisplayList = [];
  }

  deleteForm.classList.add("hidden");
}

function showHistory() {
  hideAllForms();
  screen.textContent = "";
  const list = store.activities.filter(a => a.userId===store.session.userId);

  if(list.length) {
    let output = list.map((a,i) => `${i+1}. ${a.date} | ${a.type} | ${a.duration} min${a.notes ? " (" + a.notes + ")" : ""}`).join("\n");
    print(output + "\n");
    
    // Show delete form inline
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
  const userActivities = store.activities.filter(a => a.userId===store.session.userId);
  screen.textContent = "";

  if(!userActivities.length) {
    print("No activities to show statistics.");
    return;
  }

  const totals = {};
  userActivities.forEach(a => {
    if(!totals[a.type]) totals[a.type] = 0;
    totals[a.type] += a.duration;
  });

  const lines = ["--- STATISTICS ---"];
  for(const [type, mins] of Object.entries(totals)) {
    lines.push(`${type} : ${mins} min`);
  }

  print(lines.join("\n"));
}

/* LOGIN/APP BOOT */
function showLogin() {
  loginView.classList.remove("hidden");
  appView.classList.add("hidden");
  loginEmail.focus();
}

auth.onAuthStateChanged((user) => {
  if(user) {
    store.session.userId = user.uid;
    // keep previous username if we have it; otherwise show placeholder
    store.session.username = store.session.username || "USER";
    save();
    showApp(true);
  } else {
    store.session.userId = null;
    store.session.username = null;
    save();
    showLogin();
  }
});






