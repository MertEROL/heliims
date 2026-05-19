// Core Application Coordinator

import { 
  loginWithSicil, 
  logoutUser, 
  onAuthStateChangedListener 
} from "./auth.js";

import { 
  addHelicopter, 
  getHelicopters, 
  addEquipment, 
  getEquipments, 
  updateEquipmentStatus, 
  mountEquipmentToHelicopter, 
  unmountEquipmentFromHelicopter, 
  getLogs, 
  getRegisteredUsers 
} from "./db.js";

import { 
  registerNewUser 
} from "./auth.js";

import { 
  state, 
  setupNavigation, 
  setupModalTriggers, 
  openModal, 
  closeModal, 
  renderActiveSection, 
  renderManageEquipmentLists 
} from "./ui.js";

// Firestore Subscription Cancelers
let unsubHelis = null;
let unsubEquips = null;
let unsubLogs = null;
let unsubUsers = null;

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupModalTriggers();
  setupEventListeners();
  observeAuthState();
});

// Observe Authentication State
function observeAuthState() {
  onAuthStateChangedListener((userProfile) => {
    const loadingScreen = document.getElementById("app-loading");
    const loginScreen = document.getElementById("login-screen");
    const mainApp = document.getElementById("main-app");

    if (userProfile) {
      // User is logged in
      state.currentUser = userProfile;
      
      // Update sidebar profile
      document.getElementById("user-display-name").textContent = userProfile.name;
      document.getElementById("user-avatar-text").textContent = userProfile.name.charAt(0).toUpperCase();
      document.getElementById("user-role-badge").textContent = userProfile.role === "admin" ? "Yönetici" : "Teknisyen";
      
      // Handle admin-only UI
      const adminNav = document.getElementById("nav-admin");
      if (userProfile.role === "admin") {
        adminNav.classList.remove("hidden");
      } else {
        adminNav.classList.add("hidden");
        // If technical user was somehow on admin section, kick them back to dashboard
        if (state.activeSection === "section-admin") {
          document.querySelector('.nav-item[data-target="section-dashboard"]').click();
        }
      }

      // Hide login, show main app
      loginScreen.classList.add("hidden");
      mainApp.classList.remove("hidden");

      // Subscribe to real-time database updates
      subscribeToDbUpdates();
    } else {
      // User is logged out
      state.currentUser = null;
      
      // Unsubscribe from DB listeners
      unsubscribeFromDbUpdates();

      // Show login, hide main app
      mainApp.classList.add("hidden");
      loginScreen.classList.remove("hidden");
    }

    // Hide loader overlay
    loadingScreen.classList.add("hidden");
  });
}

// Subscribe to Firestore updates
function subscribeToDbUpdates() {
  unsubscribeFromDbUpdates(); // Ensure clean slate

  // 1. Helicopters
  unsubHelis = getHelicopters((list) => {
    state.helicopters = list;
    renderActiveSection();
    
    // If the equipment management modal is open, refresh its content
    const manageModal = document.getElementById("modal-manage-heli-equip");
    if (!manageModal.classList.contains("hidden")) {
      const activeHeliId = manageModal.getAttribute("data-heli-id");
      const activeHeli = state.helicopters.find(h => h.tailNo === activeHeliId);
      if (activeHeli) {
        renderManageEquipmentLists(activeHeli);
      }
    }
  });

  // 2. Equipments
  unsubEquips = getEquipments((list) => {
    state.equipments = list;
    renderActiveSection();
  });

  // 3. Audit Logs
  unsubLogs = getLogs((list) => {
    state.logs = list;
    renderActiveSection();
  });

  // 4. Users (Admin Only)
  if (state.currentUser && state.currentUser.role === "admin") {
    unsubUsers = getRegisteredUsers((list) => {
      state.users = list;
      renderActiveSection();
    });
  }
}

// Unsubscribe helper
function unsubscribeFromDbUpdates() {
  if (unsubHelis) { unsubHelis(); unsubHelis = null; }
  if (unsubEquips) { unsubEquips(); unsubEquips = null; }
  if (unsubLogs) { unsubLogs(); unsubLogs = null; }
  if (unsubUsers) { unsubUsers(); unsubUsers = null; }
}

// Set up UI event listeners
function setupEventListeners() {
  // 1. Login Form Submission
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.add("hidden");
    const sicil = document.getElementById("login-sicil").value;
    const password = document.getElementById("login-password").value;

    try {
      await loginWithSicil(sicil, password);
      loginForm.reset();
    } catch (err) {
      console.error("Giriş hatası:", err);
      loginError.classList.remove("hidden");
      // Firebase auth error code translation
      let errorMsg = "Hatalı Sicil veya Şifre!";
      if (err.code === "auth/invalid-credential") {
        errorMsg = "Giriş bilgileri hatalı. Sicil ve şifrenizi kontrol edin.";
      } else if (err.code === "auth/too-many-requests") {
        errorMsg = "Çok fazla hatalı deneme yapıldı. Lütfen daha sonra tekrar deneyin.";
      }
      loginError.querySelector(".error-text").textContent = errorMsg;
    }
  });

  // 2. Logout Button
  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    if (confirm("Çıkış yapmak istediğinize emin misiniz?")) {
      try {
        await logoutUser();
      } catch (err) {
        console.error("Çıkış hatası:", err);
      }
    }
  });

  // 3. Search and filter changes (Live rendering)
  const searchHeli = document.getElementById("search-helicopters");
  searchHeli.addEventListener("input", () => renderActiveSection());

  const searchEquip = document.getElementById("search-equipment");
  searchEquip.addEventListener("input", () => renderActiveSection());

  const filterEquipStatus = document.getElementById("filter-equipment-status");
  filterEquipStatus.addEventListener("change", () => renderActiveSection());

  const filterEquipLoc = document.getElementById("filter-equipment-location");
  filterEquipLoc.addEventListener("change", () => renderActiveSection());

  const searchInv = document.getElementById("search-inventory-input");
  searchInv.addEventListener("input", () => renderActiveSection());

  const searchLogs = document.getElementById("search-logs-input");
  searchLogs.addEventListener("input", () => renderActiveSection());

  const filterLogsAct = document.getElementById("filter-logs-action");
  filterLogsAct.addEventListener("change", () => renderActiveSection());

  // 4. Inventory Tab Buttons switching
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderActiveSection();
    });
  });

  // 5. Open modals
  document.getElementById("btn-add-helicopter").addEventListener("click", () => {
    openModal("modal-add-helicopter");
  });

  document.getElementById("btn-add-equipment").addEventListener("click", () => {
    openModal("modal-add-equipment");
  });

  // 6. Form Submission: Add Helicopter
  const addHeliForm = document.getElementById("add-helicopter-form");
  addHeliForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tailNo = document.getElementById("heli-tail-no").value;
    const model = document.getElementById("heli-model").value;
    const fleet = document.getElementById("heli-fleet").value;
    const notes = document.getElementById("heli-notes").value;

    try {
      await addHelicopter(tailNo, model, fleet, notes, state.currentUser.sicil, state.currentUser.name);
      closeModal("modal-add-helicopter");
      alert(`${tailNo} kuyruk nolu helikopter başarıyla eklendi.`);
    } catch (err) {
      alert("Hata: " + err.message);
    }
  });

  // 7. Form Submission: Add Equipment
  const addEquipForm = document.getElementById("add-equipment-form");
  addEquipForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const serial = document.getElementById("equip-serial-no").value;
    const name = document.getElementById("equip-name").value;
    const model = document.getElementById("equip-model").value;
    const status = document.getElementById("equip-status").value;
    const fleet = document.getElementById("equip-fleet").value;
    const notes = document.getElementById("equip-notes").value;

    try {
      await addEquipment(serial, name, model, status, fleet, notes, state.currentUser.sicil, state.currentUser.name);
      closeModal("modal-add-equipment");
      alert(`${serial} seri nolu ekipman başarıyla eklendi.`);
    } catch (err) {
      alert("Hata: " + err.message);
    }
  });

  // 8. Form Submission: Edit Equipment Status/Location
  const editEquipForm = document.getElementById("edit-equipment-form");
  editEquipForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("edit-equip-id").value;
    const status = document.getElementById("edit-equip-status").value;
    const notes = document.getElementById("edit-equip-notes").value;
    const comment = document.getElementById("edit-equip-comment").value;
    
    // Only fetch fleet warehouse selector if it is visible
    const fleetSelect = document.getElementById("edit-equip-fleet");
    const fleetName = fleetSelect.style.display !== "none" ? fleetSelect.value : null;

    try {
      await updateEquipmentStatus(
        id, 
        status, 
        fleetName, 
        notes, 
        state.currentUser.sicil, 
        state.currentUser.name, 
        comment
      );
      closeModal("modal-edit-equipment");
      alert("Ekipman durumu güncellendi.");
    } catch (err) {
      alert("Güncelleme hatası: " + err.message);
    }
  });

  // 9. Admin Panel: Form Submission: Add User
  const addUserForm = document.getElementById("add-user-form");
  const adminStatus = document.getElementById("admin-user-status");

  addUserForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    adminStatus.className = "alert hidden";
    
    const sicil = document.getElementById("admin-new-sicil").value;
    const name = document.getElementById("admin-new-name").value;
    const role = document.getElementById("admin-new-role").value;
    const password = document.getElementById("admin-new-password").value;

    if (password.length < 6) {
      adminStatus.className = "alert alert-danger";
      adminStatus.textContent = "Şifre en az 6 karakter olmalıdır!";
      return;
    }

    try {
      adminStatus.className = "alert alert-warning";
      adminStatus.textContent = "Kullanıcı oluşturuluyor...";
      
      await registerNewUser(sicil, name, role, password);
      
      adminStatus.className = "alert alert-success";
      adminStatus.textContent = `Sicil ${sicil} (${name}) kullanıcısı başarıyla sisteme kaydedildi.`;
      addUserForm.reset();
    } catch (err) {
      console.error("Kullanıcı ekleme hatası:", err);
      adminStatus.className = "alert alert-danger";
      let msg = "Kullanıcı oluşturulamadı: " + err.message;
      if (err.code === "auth/email-already-in-use") {
        msg = "Bu sicil numarası zaten sisteme kayıtlı!";
      }
      adminStatus.textContent = msg;
    }
  });

  // 10. Mount & Unmount Equipment Event Delegation inside the Manage Equipment Modal
  const manageModal = document.getElementById("modal-manage-heli-equip");
  
  manageModal.addEventListener("click", async (e) => {
    // Check if clicked button is mount or unmount
    const mountBtn = e.target.closest(".btn-mount");
    const unmountBtn = e.target.closest(".btn-unmount");
    
    if (!mountBtn && !unmountBtn) return;
    e.preventDefault();

    const heliId = manageModal.getAttribute("data-heli-id");
    const heliFleet = manageModal.getAttribute("data-heli-fleet");
    const commentInput = document.getElementById("manage-equip-comment");
    const comment = commentInput.value.trim();

    if (!comment) {
      alert("Bu işlem için bir açıklama / gerekçe girmek zorunludur!");
      commentInput.focus();
      return;
    }

    const operatorSicil = state.currentUser.sicil;
    const operatorName = state.currentUser.name;

    try {
      if (mountBtn) {
        const equipId = mountBtn.getAttribute("data-id");
        mountBtn.disabled = true;
        await mountEquipmentToHelicopter(equipId, heliId, operatorSicil, operatorName, comment);
        alert(`Ekipman (${equipId}) başarıyla helikoptere takıldı.`);
      } else if (unmountBtn) {
        const equipId = unmountBtn.getAttribute("data-id");
        unmountBtn.disabled = true;
        // Unmounted equipment goes to the helicopter's fleet warehouse
        await unmountEquipmentFromHelicopter(equipId, heliId, heliFleet, operatorSicil, operatorName, comment);
        alert(`Ekipman (${equipId}) sökülerek ${heliFleet} deposuna aktarıldı.`);
      }
      
      // Clear comment input on successful transaction
      commentInput.value = "";
      
      // Refresh the modal views based on the updated state
      const updatedHeli = state.helicopters.find(h => h.tailNo === heliId);
      if (updatedHeli) {
        renderManageEquipmentLists(updatedHeli);
      }
    } catch (err) {
      alert("İşlem hatası: " + err.message);
    } finally {
      if (mountBtn) mountBtn.disabled = false;
      if (unmountBtn) unmountBtn.disabled = false;
    }
  });
}
