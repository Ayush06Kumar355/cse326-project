/* =====================================================
   StoryNest - script.js
   Data is stored in the browser using localStorage
   ===================================================== */

// ---------- Small helpers ----------
const $ = (id) => document.getElementById(id);
const KEYS = {
  users: "sn_users",
  books: "sn_books",
  requests: "sn_requests",
  notifs: "sn_notifs",
  session: "sn_session"
};

function getData(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch (e) { return []; }
}
function setData(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function uid(prefix) { return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function today() { return new Date().toLocaleDateString(); }
function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const ROLE_LABELS = { reader: "Parent / Reader", author: "Author", admin: "Admin" };

let currentUser = null;
let toastTimer = null;

// ---------- Seed demo data (runs only first time) ----------
function seedData() {
  if (getData(KEYS.users).length === 0) {
    setData(KEYS.users, [
      { id: "u_admin", name: "Admin", email: "admin@storynest.com", password: "Admin@123", role: "admin", joined: today() },
      { id: "u_author1", name: "Riya Sharma", email: "author@storynest.com", password: "Author@123", role: "author", joined: today() }
    ]);
  }
  if (getData(KEYS.books).length === 0) {
    setData(KEYS.books, [
      { id: "b1", title: "The Brave Little Dragon", category: "Fantasy", age: "5-7 years", emoji: "🐉", authorId: "u_author1", authorName: "Riya Sharma",
        desc: "{name} meets a tiny dragon who is afraid of fire. Together they learn that being brave means trying even when you are scared." },
      { id: "b2", title: "Journey to the Moon", category: "Space", age: "5-7 years", emoji: "🚀", authorId: "u_author1", authorName: "Riya Sharma",
        desc: "{name} builds a rocket from a cardboard box and flies to the moon to make friends with a sleepy star." },
      { id: "b3", title: "The Sleepy Bear", category: "Bedtime", age: "2-4 years", emoji: "🐻", authorId: "u_author1", authorName: "Riya Sharma",
        desc: "{name} helps a sleepy bear find his cosy cave before the snow falls. Goodnight, little bear!" },
      { id: "b4", title: "Jungle Treasure Hunt", category: "Adventure", age: "8-10 years", emoji: "🗺️", authorId: "u_author1", authorName: "Riya Sharma",
        desc: "{name} follows a secret map through the jungle, with a clever monkey as a guide, to find a hidden treasure." }
    ]);
  }
}

// ---------- Toast notification ----------
function toast(message, type) {
  const t = $("toast");
  t.textContent = message;
  t.className = "toast " + (type || "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 3000);
}

// ---------- Validation helpers ----------
// Shows or clears an error under a field. Returns true if there is NO error.
function setError(id, message) {
  const field = $(id);
  const err = $(id + "Err");
  if (err) err.textContent = message;
  if (field) field.classList.toggle("invalid", !!message);
  return !message;
}
function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function isStrongPassword(v) { return v.length >= 6 && /\d/.test(v) && /[A-Za-z]/.test(v); }

// Remove red error as soon as the user types again
document.addEventListener("input", (e) => {
  if (e.target.classList && e.target.classList.contains("invalid")) {
    e.target.classList.remove("invalid");
    const err = $(e.target.id + "Err");
    if (err) err.textContent = "";
  }
});

// ---------- Modals ----------
function openModal(id) { $(id).classList.remove("hidden"); }
function closeModal(id) { $(id).classList.add("hidden"); }

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});
document.querySelectorAll(".modal").forEach((modal) => {
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.add("hidden"); });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.querySelectorAll(".modal").forEach((m) => m.classList.add("hidden"));
});

// ---------- Page navigation ----------
function showPage(name) {
  if (name === "dashboard" && !currentUser) { openModal("loginModal"); return; }
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  $("page-" + name).classList.remove("hidden");
  $("navLinks").classList.remove("open");
  window.scrollTo(0, 0);
  if (name === "dashboard") openDashboard();
}

document.querySelectorAll("[data-page]").forEach((link) => {
  link.addEventListener("click", (e) => { e.preventDefault(); showPage(link.dataset.page); });
});
$("logoLink").addEventListener("click", (e) => { e.preventDefault(); showPage("home"); });
$("menuToggle").addEventListener("click", () => $("navLinks").classList.toggle("open"));

$("openLogin").addEventListener("click", () => openModal("loginModal"));
$("openRegister").addEventListener("click", () => openModal("registerModal"));
$("heroLogin").addEventListener("click", () => currentUser ? showPage("dashboard") : openModal("loginModal"));
$("heroRegister").addEventListener("click", () => currentUser ? showPage("dashboard") : openModal("registerModal"));
$("goDashboard").addEventListener("click", () => showPage("dashboard"));
$("switchToRegister").addEventListener("click", (e) => { e.preventDefault(); closeModal("loginModal"); openModal("registerModal"); });
$("switchToLogin").addEventListener("click", (e) => { e.preventDefault(); closeModal("registerModal"); openModal("loginModal"); });

function updateNav() {
  const loggedIn = !!currentUser;
  $("navGuest").classList.toggle("hidden", loggedIn);
  $("navUser").classList.toggle("hidden", !loggedIn);
  if (loggedIn) $("navWelcome").textContent = "Hi, " + currentUser.name.split(" ")[0] + "!";
}

// =====================================================
//  AUTHENTICATION
// =====================================================
$("registerForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("regName").value.trim();
  const email = $("regEmail").value.trim().toLowerCase();
  const role = $("regRole").value;
  const pass = $("regPassword").value;
  const confirm = $("regConfirm").value;
  const users = getData(KEYS.users);

  let ok = true;
  ok = setError("regName", /^[A-Za-z ]{3,40}$/.test(name) ? "" : "Name must be 3-40 letters") && ok;
  let emailMsg = "";
  if (!isEmail(email)) emailMsg = "Enter a valid email";
  else if (users.some((u) => u.email === email)) emailMsg = "This email is already registered";
  ok = setError("regEmail", emailMsg) && ok;
  ok = setError("regRole", role ? "" : "Please select a role") && ok;
  ok = setError("regPassword", isStrongPassword(pass) ? "" : "Min 6 characters with letters and a number") && ok;
  ok = setError("regConfirm", pass === confirm ? "" : "Passwords do not match") && ok;
  if (!ok) return;

  const user = { id: uid("u"), name, email, password: pass, role, joined: today() };
  users.push(user);
  setData(KEYS.users, users);
  addNotif(user.id, "Welcome to StoryNest, " + name + "! 🎉");
  e.target.reset();
  closeModal("registerModal");
  loginUser(user);
  toast("Registration successful! Welcome 🎉");
});

$("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = $("loginEmail").value.trim().toLowerCase();
  const pass = $("loginPassword").value;
  $("loginErr").textContent = "";

  let ok = true;
  ok = setError("loginEmail", isEmail(email) ? "" : "Enter a valid email") && ok;
  ok = setError("loginPassword", pass ? "" : "Enter your password") && ok;
  if (!ok) return;

  const user = getData(KEYS.users).find((u) => u.email === email && u.password === pass);
  if (!user) { $("loginErr").textContent = "Wrong email or password."; return; }

  e.target.reset();
  closeModal("loginModal");
  loginUser(user);
  toast("Welcome back, " + user.name + "!");
});

function loginUser(user) {
  currentUser = user;
  localStorage.setItem(KEYS.session, user.id);
  updateNav();
  showPage("dashboard");
}

$("logoutBtn").addEventListener("click", () => {
  currentUser = null;
  localStorage.removeItem(KEYS.session);
  updateNav();
  showPage("home");
  toast("Logged out. See you soon!", "info");
});

// =====================================================
//  DASHBOARD (role-based)
// =====================================================
function openDashboard() {
  $("dashName").textContent = currentUser.name;
  $("dashRole").textContent = ROLE_LABELS[currentUser.role];
  $("avatar").textContent = currentUser.name.charAt(0).toUpperCase();

  // Role-based access: hide menu items that this role should not see
  document.querySelectorAll(".side-menu li").forEach((li) => {
    const hasRule = ["role-admin", "role-author", "role-reader"].some((c) => li.classList.contains(c));
    li.classList.toggle("hidden", hasRule && !li.classList.contains("role-" + currentUser.role));
  });
  // Only readers can create requests
  $("requestFormCard").classList.toggle("hidden", currentUser.role !== "reader");

  showSection("overview");
}

function showSection(name) {
  document.querySelectorAll(".dash-section").forEach((s) => s.classList.add("hidden"));
  $("sec-" + name).classList.remove("hidden");
  document.querySelectorAll(".side-menu a").forEach((a) => a.classList.toggle("active", a.dataset.section === name));

  if (name === "overview") renderOverview();
  if (name === "books") renderBooks();
  if (name === "manageBooks") renderManageBooks();
  if (name === "requests") { fillBookSelect(); renderRequests(); }
  if (name === "users") renderUsers();
  if (name === "reports") renderReports();
  if (name === "notifications") renderNotifs();
  if (name === "profile") loadProfile();
  updateNotifBadge();
}

document.querySelectorAll(".side-menu a").forEach((a) => {
  a.addEventListener("click", (e) => { e.preventDefault(); showSection(a.dataset.section); });
});

// ---------- Which requests can this user see? ----------
function visibleRequests() {
  const all = getData(KEYS.requests);
  if (currentUser.role === "admin") return all;
  if (currentUser.role === "author") return all.filter((r) => r.authorId === currentUser.id);
  return all.filter((r) => r.readerId === currentUser.id);
}
function visibleBooks() {
  const all = getData(KEYS.books);
  return currentUser.role === "admin" ? all : all.filter((b) => b.authorId === currentUser.id);
}
function statusClass(status) {
  return { "Pending": "status-pending", "In Progress": "status-progress", "Ready": "status-ready", "Rejected": "status-rejected" }[status];
}
function statCard(icon, label, number) {
  return '<div class="stat-card"><div class="stat-icon">' + icon + '</div><div class="stat-number">' + number +
         '</div><div class="stat-label">' + label + "</div></div>";
}

// ---------- OVERVIEW ----------
function renderOverview() {
  $("overviewName").textContent = currentUser.name.split(" ")[0];
  const reqs = visibleRequests();
  const count = (s) => reqs.filter((r) => r.status === s).length;
  let cards = "";

  if (currentUser.role === "reader") {
    cards = statCard("📦", "My Requests", reqs.length) + statCard("⏳", "Pending", count("Pending")) +
            statCard("🎨", "In Progress", count("In Progress")) + statCard("✅", "Ready", count("Ready"));
  } else if (currentUser.role === "author") {
    cards = statCard("📖", "My Stories", visibleBooks().length) + statCard("📦", "Requests Received", reqs.length) +
            statCard("⏳", "Pending", count("Pending")) + statCard("✅", "Completed", count("Ready"));
  } else {
    cards = statCard("👥", "Total Users", getData(KEYS.users).length) + statCard("📖", "Total Stories", getData(KEYS.books).length) +
            statCard("📦", "Total Requests", reqs.length) + statCard("⏳", "Pending", count("Pending"));
  }
  $("statGrid").innerHTML = cards;

  const recent = reqs.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  $("recentActivity").innerHTML = recent.length
    ? recent.map((r) => '<div class="activity-item">📘 <strong>' + esc(r.bookTitle) + "</strong> for " + esc(r.childName) +
        ' <span class="status ' + statusClass(r.status) + '">' + r.status + "</span> <small>" + r.date + "</small></div>").join("")
    : '<div class="empty">No activity yet. Start by sending a book request! 🌈</div>';
}

// ---------- STORY LIBRARY ----------
function renderBooks() {
  const q = $("bookSearch").value.trim().toLowerCase();
  const cat = $("bookCategoryFilter").value;
  const list = getData(KEYS.books).filter((b) =>
    (!cat || b.category === cat) && (b.title.toLowerCase().includes(q) || b.authorName.toLowerCase().includes(q)));

  if (list.length === 0) { $("bookGrid").innerHTML = '<div class="empty">No stories found 🔍</div>'; return; }

  $("bookGrid").innerHTML = list.map((b) =>
    '<div class="book-card"><div class="book-cover">' + esc(b.emoji) + '</div><div class="book-info">' +
    "<h3>" + esc(b.title) + "</h3>" +
    '<span class="tag">' + esc(b.category) + '</span><span class="tag">' + esc(b.age) + "</span>" +
    "<p>by " + esc(b.authorName) + "</p>" +
    '<div class="book-actions"><button class="btn btn-sm btn-info" data-action="preview" data-id="' + b.id + '">Preview</button>' +
    (currentUser.role === "reader" ? '<button class="btn btn-sm btn-primary" data-action="request" data-id="' + b.id + '">Request</button>' : "") +
    "</div></div></div>").join("");
}
$("bookSearch").addEventListener("input", renderBooks);
$("bookCategoryFilter").addEventListener("change", renderBooks);

$("bookGrid").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const book = getData(KEYS.books).find((b) => b.id === btn.dataset.id);
  if (!book) return;
  if (btn.dataset.action === "preview") {
    $("previewContent").innerHTML =
      '<div class="preview-cover">' + esc(book.emoji) + "</div><h2>" + esc(book.title) + "</h2>" +
      '<span class="tag">' + esc(book.category) + '</span><span class="tag">' + esc(book.age) + "</span>" +
      '<div class="preview-story">' + esc(book.desc).replace(/\{name\}/g, "<strong>[Your Child]</strong>") + "</div>" +
      "<small>Written by " + esc(book.authorName) + "</small>";
    openModal("previewModal");
  }
  if (btn.dataset.action === "request") {
    showSection("requests");
    $("reqBook").value = book.id;
    $("reqChildName").focus();
  }
});

// ---------- MANAGE STORIES (CRUD) ----------
function renderManageBooks() {
  const list = visibleBooks();
  $("manageBookBody").innerHTML = list.length
    ? list.map((b) => "<tr><td>" + esc(b.emoji) + "</td><td>" + esc(b.title) + "</td><td>" + esc(b.category) + "</td><td>" +
        esc(b.age) + "</td><td>" + esc(b.authorName) + '</td><td><button class="btn btn-sm btn-info" data-action="edit" data-id="' + b.id +
        '">Edit</button><button class="btn btn-sm btn-danger" data-action="delete" data-id="' + b.id + '">Delete</button></td></tr>').join("")
    : '<tr><td colspan="6" class="empty">You have not added any stories yet.</td></tr>';
}

function resetBookForm() {
  $("bookForm").reset();
  $("bookId").value = "";
  $("bookFormTitle").textContent = "Add New Story";
  $("bookSubmitBtn").textContent = "Add Story";
  $("bookCancelBtn").classList.add("hidden");
}
$("bookCancelBtn").addEventListener("click", resetBookForm);

$("bookForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = $("bookId").value;
  const title = $("bookTitle").value.trim();
  const category = $("bookCategory").value;
  const age = $("bookAge").value;
  const emoji = $("bookEmoji").value.trim() || "📖";
  const desc = $("bookDesc").value.trim();

  let ok = true;
  ok = setError("bookTitle", title.length >= 3 ? "" : "Title must be at least 3 characters") && ok;
  ok = setError("bookCategory", category ? "" : "Select a category") && ok;
  ok = setError("bookAge", age ? "" : "Select an age group") && ok;
  ok = setError("bookDesc", desc.length >= 20 ? "" : "Summary must be at least 20 characters") && ok;
  if (!ok) return;

  const books = getData(KEYS.books);
  if (id) {
    const b = books.find((x) => x.id === id);
    Object.assign(b, { title, category, age, emoji, desc });
    toast("Story updated ✅");
  } else {
    books.push({ id: uid("b"), title, category, age, emoji, desc, authorId: currentUser.id, authorName: currentUser.name });
    toast("Story added 🎉");
  }
  setData(KEYS.books, books);
  resetBookForm();
  renderManageBooks();
});

$("manageBookBody").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const books = getData(KEYS.books);
  const book = books.find((b) => b.id === btn.dataset.id);
  if (!book) return;

  if (btn.dataset.action === "edit") {
    $("bookId").value = book.id;
    $("bookTitle").value = book.title;
    $("bookCategory").value = book.category;
    $("bookAge").value = book.age;
    $("bookEmoji").value = book.emoji;
    $("bookDesc").value = book.desc;
    $("bookFormTitle").textContent = "Edit Story";
    $("bookSubmitBtn").textContent = "Update Story";
    $("bookCancelBtn").classList.remove("hidden");
    window.scrollTo(0, 0);
  }
  if (btn.dataset.action === "delete") {
    if (!confirm('Delete the story "' + book.title + '"?')) return;
    setData(KEYS.books, books.filter((b) => b.id !== book.id));
    renderManageBooks();
    toast("Story deleted", "info");
  }
});

// ---------- REQUESTS (workflow + status tracking) ----------
function fillBookSelect() {
  const sel = $("reqBook");
  const keep = sel.value;
  sel.innerHTML = '<option value="">Select a story</option>' +
    getData(KEYS.books).map((b) => '<option value="' + b.id + '">' + esc(b.emoji + " " + b.title) + "</option>").join("");
  sel.value = keep;
}

$("requestForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const bookId = $("reqBook").value;
  const childName = $("reqChildName").value.trim();
  const age = Number($("reqChildAge").value);
  const theme = $("reqTheme").value;
  const message = $("reqMessage").value.trim();

  let ok = true;
  ok = setError("reqBook", bookId ? "" : "Please choose a story") && ok;
  ok = setError("reqChildName", /^[A-Za-z ]{2,30}$/.test(childName) ? "" : "Enter a valid name (letters only)") && ok;
  ok = setError("reqChildAge", Number.isInteger(age) && age >= 1 && age <= 12 ? "" : "Age must be between 1 and 12") && ok;
  ok = setError("reqTheme", theme ? "" : "Please select a theme") && ok;
  if (!ok) return;

  const book = getData(KEYS.books).find((b) => b.id === bookId);
  const requests = getData(KEYS.requests);

  // Validation: block duplicate active requests
  const duplicate = requests.some((r) => r.readerId === currentUser.id && r.bookId === bookId &&
    r.childName.toLowerCase() === childName.toLowerCase() && (r.status === "Pending" || r.status === "In Progress"));
  if (duplicate) { toast("You already have an active request for this story and child.", "error"); return; }

  requests.push({
    id: "R" + String(Date.now()).slice(-6),
    bookId: book.id, bookTitle: book.title, authorId: book.authorId,
    readerId: currentUser.id, readerName: currentUser.name,
    childName, childAge: age, theme, message,
    status: "Pending", date: today(), createdAt: Date.now()
  });
  setData(KEYS.requests, requests);

  addNotif(currentUser.id, 'Your request for "' + book.title + '" was sent successfully.');
  addNotif(book.authorId, "New request from " + currentUser.name + ' for "' + book.title + '".');
  e.target.reset();
  toast("Request sent! ✅");
  renderRequests();
  updateNotifBadge();
});

function actionBtn(action, id, label, style) {
  return '<button class="btn btn-sm btn-' + style + '" data-action="' + action + '" data-id="' + id + '">' + label + "</button>";
}

function renderRequests() {
  const q = $("reqSearch").value.trim().toLowerCase();
  const st = $("reqStatusFilter").value;
  const list = visibleRequests()
    .filter((r) => (!st || r.status === st) && (r.childName.toLowerCase().includes(q) || r.bookTitle.toLowerCase().includes(q)))
    .sort((a, b) => b.createdAt - a.createdAt);

  if (list.length === 0) { $("requestBody").innerHTML = '<tr><td colspan="8" class="empty">No requests found.</td></tr>'; return; }

  $("requestBody").innerHTML = list.map((r) => {
    let actions = "";
    if (currentUser.role === "reader") {
      if (r.status === "Ready") actions += actionBtn("read", r.id, "Read", "info");
      if (r.status === "Pending") actions += actionBtn("cancel", r.id, "Cancel", "danger");
    } else {
      if (r.status === "Pending") actions += actionBtn("progress", r.id, "Start", "info") + actionBtn("reject", r.id, "Reject", "danger");
      if (r.status === "In Progress") actions += actionBtn("ready", r.id, "Mark Ready", "success") + actionBtn("reject", r.id, "Reject", "danger");
      if (r.status === "Ready") actions += actionBtn("read", r.id, "View", "info");
      if (currentUser.role === "admin") actions += actionBtn("remove", r.id, "Delete", "danger");
    }
    return "<tr><td>" + r.id + "</td><td>" + esc(r.bookTitle) + "</td><td>" + esc(r.childName) + " (" + r.childAge + ")</td><td>" +
      esc(r.theme) + "</td><td>" + esc(r.readerName) + "</td><td>" + r.date + '</td><td><span class="status ' + statusClass(r.status) + '">' +
      r.status + "</span></td><td>" + (actions || "-") + "</td></tr>";
  }).join("");
}
$("reqSearch").addEventListener("input", renderRequests);
$("reqStatusFilter").addEventListener("change", renderRequests);

function changeStatus(id, newStatus) {
  const requests = getData(KEYS.requests);
  const r = requests.find((x) => x.id === id);
  if (!r) return;
  r.status = newStatus;
  setData(KEYS.requests, requests);
  addNotif(r.readerId, 'Your request ' + r.id + ' for "' + r.bookTitle + '" is now: ' + newStatus + ".");
  toast("Status changed to " + newStatus);
  renderRequests();
  updateNotifBadge();
}

$("requestBody").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === "progress") changeStatus(id, "In Progress");
  if (action === "ready") changeStatus(id, "Ready");
  if (action === "reject") changeStatus(id, "Rejected");

  if (action === "cancel" || action === "remove") {
    if (!confirm("Delete request " + id + "?")) return;
    setData(KEYS.requests, getData(KEYS.requests).filter((r) => r.id !== id));
    renderRequests();
    toast("Request removed", "info");
  }

  if (action === "read") {
    const r = getData(KEYS.requests).find((x) => x.id === id);
    const book = getData(KEYS.books).find((b) => b.id === r.bookId);
    const story = book ? esc(book.desc).replace(/\{name\}/g, "<strong>" + esc(r.childName) + "</strong>") : "Story no longer available.";
    $("previewContent").innerHTML =
      '<div class="preview-cover">' + (book ? esc(book.emoji) : "📘") + "</div>" +
      "<h2>" + esc(r.bookTitle) + "</h2><p>A special book for <strong>" + esc(r.childName) + "</strong> (age " + r.childAge +
      ") with a <strong>" + esc(r.theme) + "</strong> theme</p>" +
      '<div class="preview-story">' + story + "</div>" +
      (r.message ? "<p>💌 <em>" + esc(r.message) + "</em></p>" : "");
    openModal("previewModal");
  }
});

// ---------- MANAGE USERS (admin) ----------
function renderUsers() {
  const q = $("userSearch").value.trim().toLowerCase();
  const role = $("userRoleFilter").value;
  const list = getData(KEYS.users).filter((u) =>
    (!role || u.role === role) && (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));

  $("userBody").innerHTML = list.length
    ? list.map((u) => {
        const self = u.id === currentUser.id;
        return "<tr><td>" + esc(u.name) + "</td><td>" + esc(u.email) + "</td><td>" +
          '<select data-userid="' + u.id + '"' + (self ? " disabled" : "") + ">" +
          ["reader", "author", "admin"].map((r) => '<option value="' + r + '"' + (u.role === r ? " selected" : "") + ">" + ROLE_LABELS[r] + "</option>").join("") +
          "</select></td><td>" + u.joined + "</td><td>" +
          (self ? "(you)" : actionBtn("deleteUser", u.id, "Delete", "danger")) + "</td></tr>";
      }).join("")
    : '<tr><td colspan="5" class="empty">No users found.</td></tr>';
}
$("userSearch").addEventListener("input", renderUsers);
$("userRoleFilter").addEventListener("change", renderUsers);

$("userBody").addEventListener("change", (e) => {
  if (!e.target.dataset.userid) return;
  const users = getData(KEYS.users);
  const u = users.find((x) => x.id === e.target.dataset.userid);
  u.role = e.target.value;
  setData(KEYS.users, users);
  addNotif(u.id, "Your role was changed to " + ROLE_LABELS[u.role] + " by the admin.");
  toast("Role updated for " + u.name);
});
$("userBody").addEventListener("click", (e) => {
  const btn = e.target.closest('[data-action="deleteUser"]');
  if (!btn) return;
  if (!confirm("Delete this user?")) return;
  setData(KEYS.users, getData(KEYS.users).filter((u) => u.id !== btn.dataset.id));
  renderUsers();
  toast("User deleted", "info");
});

// ---------- REPORTS ----------
function barChart(containerId, data) {
  const keys = Object.keys(data);
  const max = Math.max(1, ...Object.values(data));
  $(containerId).innerHTML = keys.length
    ? keys.map((k) => '<div class="bar-row"><div class="bar-label">' + esc(k) + '</div><div class="bar-track"><div class="bar-fill" style="width:' +
        Math.max(data[k] / max * 100, data[k] ? 12 : 0) + '%">' + data[k] + "</div></div></div>").join("")
    : '<div class="empty">No data yet</div>';
}

function renderReports() {
  const reqs = visibleRequests();
  const books = visibleBooks();
  const ready = reqs.filter((r) => r.status === "Ready").length;
  const rate = reqs.length ? Math.round((ready / reqs.length) * 100) : 0;

  $("reportStats").innerHTML = statCard("📖", "Stories", books.length) + statCard("📦", "Requests", reqs.length) +
    statCard("✅", "Completed", ready) + statCard("📈", "Completion Rate", rate + "%");

  const byStatus = { "Pending": 0, "In Progress": 0, "Ready": 0, "Rejected": 0 };
  reqs.forEach((r) => byStatus[r.status]++);
  barChart("statusChart", byStatus);

  const byCat = {};
  books.forEach((b) => { byCat[b.category] = (byCat[b.category] || 0) + 1; });
  barChart("categoryChart", byCat);
}
$("printReport").addEventListener("click", () => window.print());

// ---------- NOTIFICATIONS ----------
function addNotif(userId, message) {
  const list = getData(KEYS.notifs);
  list.push({ id: uid("n"), userId, message, time: Date.now(), read: false });
  setData(KEYS.notifs, list);
}
function myNotifs() { return getData(KEYS.notifs).filter((n) => n.userId === currentUser.id).sort((a, b) => b.time - a.time); }

function updateNotifBadge() {
  if (!currentUser) return;
  const unread = myNotifs().filter((n) => !n.read).length;
  $("notifCount").textContent = unread;
  $("notifCount").classList.toggle("hidden", unread === 0);
}
function renderNotifs() {
  const list = myNotifs();
  $("notifList").innerHTML = list.length
    ? list.map((n) => '<div class="notif-item ' + (n.read ? "" : "unread") + '">' + esc(n.message) +
        '<span class="notif-time">' + new Date(n.time).toLocaleString() + "</span></div>").join("")
    : '<div class="empty">No notifications yet 🔔</div>';
}
$("clearNotifs").addEventListener("click", () => {
  const all = getData(KEYS.notifs);
  all.forEach((n) => { if (n.userId === currentUser.id) n.read = true; });
  setData(KEYS.notifs, all);
  renderNotifs();
  updateNotifBadge();
});

// ---------- PROFILE ----------
function loadProfile() {
  $("profName").value = currentUser.name;
  $("profEmail").value = currentUser.email;
  $("profPass").value = "";
}
$("profileForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("profName").value.trim();
  const pass = $("profPass").value;

  let ok = true;
  ok = setError("profName", /^[A-Za-z ]{3,40}$/.test(name) ? "" : "Name must be 3-40 letters") && ok;
  ok = setError("profPass", !pass || isStrongPassword(pass) ? "" : "Min 6 characters with letters and a number") && ok;
  if (!ok) return;

  const users = getData(KEYS.users);
  const u = users.find((x) => x.id === currentUser.id);
  u.name = name;
  if (pass) u.password = pass;
  setData(KEYS.users, users);
  currentUser = u;
  updateNav();
  openDashboard();
  showSection("profile");
  toast("Profile updated ✅");
});

// =====================================================
//  START THE APP
// =====================================================
seedData();
const savedId = localStorage.getItem(KEYS.session);
if (savedId) {
  const found = getData(KEYS.users).find((u) => u.id === savedId);
  if (found) currentUser = found;
}
updateNav();
showPage(currentUser ? "dashboard" : "home");