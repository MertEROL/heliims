// UI Rendering Engine for HETS

// Global UI State
export const state = {
  currentUser: null,
  helicopters: [],
  equipments: [],
  logs: [],
  users: [],
  activeSection: "section-dashboard",
  selectedFleetFilter: null // Dashboard fleet selection filter
};

// Fleet constants
export const FLEETS = [
  { id: "Ankara", name: "Ankara (Başkanlık)", isPresidential: true },
  { id: "İstanbul", name: "İstanbul", isPresidential: false },
  { id: "İzmir", name: "İzmir", isPresidential: false },
  { id: "Adana", name: "Adana", isPresidential: false },
  { id: "Antalya", name: "Antalya", isPresidential: false },
  { id: "Diyarbakır", name: "Diyarbakır", isPresidential: false },
  { id: "Van", name: "Van", isPresidential: false }
];

// Navigation handler
export function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const sections = document.querySelectorAll(".app-section");
  const titleEl = document.getElementById("current-section-title");

  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = item.getAttribute("data-target");
      
      // Update navigation active class
      navItems.forEach(i => i.classList.remove("active"));
      item.classList.add("active");

      // Show/Hide sections
      sections.forEach(s => s.classList.add("hidden"));
      const targetSection = document.getElementById(targetId);
      if (targetSection) targetSection.classList.remove("hidden");

      // Update Header Title
      const sectionText = item.querySelector("span").textContent;
      if (titleEl) titleEl.textContent = sectionText;

      state.activeSection = targetId;
      renderActiveSection();
    });
  });

  // Live Clock
  setInterval(() => {
    const clockEl = document.getElementById("live-clock");
    if (clockEl) {
      const now = new Date();
      clockEl.textContent = now.toLocaleTimeString("tr-TR");
    }
  }, 1000);
}

// Global modal toggle helpers
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("hidden");
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("hidden");
    // Reset forms inside the modal if any
    const form = modal.querySelector("form");
    if (form) form.reset();
  }
}

export function setupModalTriggers() {
  document.querySelectorAll(".btn-close-modal").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const modal = btn.closest(".modal-overlay");
      if (modal) closeModal(modal.id);
    });
  });
}

// Format ISO date to Turkish display date
function formatDate(isoString) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

// Renders stats and fleets cards in the Dashboard
function renderDashboard() {
  // Update top general stats
  const totalHeli = state.helicopters.length;
  
  // A helicopter is active/faal if it exists. 
  // Let's check status: if all mounted equipment on a helicopter is "faal", it is faal.
  // Actually, let's calculate active helis: helis with no "gayri_faal" equipment mounted.
  let activeHeli = 0;
  state.helicopters.forEach(h => {
    const heliEquips = state.equipments.filter(e => h.equipmentIds.includes(e.serialNo));
    const hasBrokenEquip = heliEquips.some(e => e.status === "gayri_faal");
    if (!hasBrokenEquip) activeHeli++;
  });

  const totalEquip = state.equipments.length;
  const inRepair = state.equipments.filter(e => e.status === "onarimda").length;

  document.getElementById("stat-total-helicopters").textContent = totalHeli;
  document.getElementById("stat-active-helicopters").textContent = activeHeli;
  document.getElementById("stat-total-equipments").textContent = totalEquip;
  document.getElementById("stat-in-repair").textContent = inRepair;

  // Render Fleet Grid
  const gridContainer = document.getElementById("fleet-list-container");
  if (!gridContainer) return;
  gridContainer.innerHTML = "";

  FLEETS.forEach(fleet => {
    const fleetHelis = state.helicopters.filter(h => h.fleet === fleet.id);
    const fleetEquips = state.equipments.filter(e => e.locationType === "depo" && e.locationId === fleet.id);
    const mountedEquips = state.equipments.filter(e => e.locationType === "helicopter" && state.helicopters.some(h => h.fleet === fleet.id && h.tailNo === e.locationId));

    const totalFleetEquips = fleetEquips.length + mountedEquips.length;
    const activeFleetEquips = [...fleetEquips, ...mountedEquips].filter(e => e.status === "faal").length;

    const card = document.createElement("div");
    card.className = "fleet-card";
    card.innerHTML = `
      <div class="fleet-card-header">
        <h4>
          <i data-lucide="${fleet.isPresidential ? 'crown' : 'navigation'}"></i>
          <span>${fleet.name}</span>
        </h4>
        ${fleet.isPresidential ? '<span class="fleet-badge-presidential">Başkanlık</span>' : ''}
      </div>
      <div class="fleet-card-stats">
        <div class="fleet-substat">
          <span class="fleet-substat-label">Helikopterler</span>
          <span class="fleet-substat-val">${fleetHelis.length} Helikopter</span>
        </div>
        <div class="fleet-substat">
          <span class="fleet-substat-label">Toplam Ekipman</span>
          <span class="fleet-substat-val">${totalFleetEquips} Adet</span>
        </div>
        <div class="fleet-substat">
          <span class="fleet-substat-label">Faal Ekipman</span>
          <span class="fleet-substat-val text-success">${activeFleetEquips} / ${totalFleetEquips}</span>
        </div>
        <div class="fleet-substat">
          <span class="fleet-substat-label">Depo Durumu</span>
          <span class="fleet-substat-val">${fleetEquips.length} Depoda</span>
        </div>
      </div>
    `;

    // Click on fleet card to navigate to Helicopters tab and filter by that fleet
    card.addEventListener("click", () => {
      state.selectedFleetFilter = fleet.id;
      // Trigger navigation to Helicopters section programmatically
      const heliNavItem = document.querySelector('.nav-item[data-target="section-helicopters"]');
      if (heliNavItem) heliNavItem.click();
    });

    gridContainer.appendChild(card);
  });
  lucide.createIcons();
}

// Renders the Helicopters Section
function renderHelicopters() {
  const container = document.getElementById("helicopter-list-container");
  if (!container) return;
  container.innerHTML = "";

  const queryText = document.getElementById("search-helicopters")?.value.toLowerCase() || "";
  
  // Filter helicopters
  let list = state.helicopters;
  
  // Apply fleet filter (if selected from Dashboard)
  if (state.selectedFleetFilter) {
    list = list.filter(h => h.fleet === state.selectedFleetFilter);
    // Add clear filter badge if selected
    const clearBtn = document.createElement("div");
    clearBtn.style.gridColumn = "1 / -1";
    clearBtn.innerHTML = `
      <div class="alert alert-warning" style="display:inline-flex; align-items:center; cursor:pointer;">
        <span>Filtre uygulandı: <strong>${state.selectedFleetFilter} Filosu</strong> (Temizlemek için tıklayın)</span>
        <i data-lucide="x-circle" style="width:16px; height:16px; margin-left:8px;"></i>
      </div>
    `;
    clearBtn.addEventListener("click", () => {
      state.selectedFleetFilter = null;
      renderHelicopters();
    });
    container.appendChild(clearBtn);
  }

  // Filter search query
  if (queryText) {
    list = list.filter(h => h.tailNo.toLowerCase().includes(queryText) || h.model.toLowerCase().includes(queryText));
  }

  if (list.length === 0) {
    container.innerHTML += `<p class="text-secondary" style="grid-column: 1/-1; text-align: center; padding: 2rem;">Helikopter kaydı bulunamadı.</p>`;
    lucide.createIcons();
    return;
  }

  list.forEach(heli => {
    // Get equipment details for this helicopter
    const heliEquips = state.equipments.filter(e => heli.equipmentIds.includes(e.serialNo));

    const card = document.createElement("div");
    card.className = "helicopter-card";
    
    // Generate equipment tags
    let tagsHTML = "";
    if (heliEquips.length === 0) {
      tagsHTML = '<span class="text-muted" style="font-size:0.8rem;">Takılı Ekipman Yok</span>';
    } else {
      heliEquips.forEach(eq => {
        let statusColor = "text-success";
        if (eq.status === "gayri_faal") statusColor = "text-danger";
        else if (eq.status === "onarimda") statusColor = "text-warning";

        tagsHTML += `
          <span class="equip-tag" title="${eq.model} (${eq.status.toUpperCase()})">
            <i data-lucide="wrench" class="${statusColor}"></i>
            <strong>${eq.name}</strong> (${eq.serialNo})
          </span>
        `;
      });
    }

    card.innerHTML = `
      <div class="heli-card-header">
        <div>
          <span class="heli-tail">${heli.tailNo}</span>
          <div class="heli-fleet-loc">
            <i data-lucide="map-pin"></i>
            <span>${heli.fleet} Filosu</span>
          </div>
        </div>
        <span class="heli-model-badge">${heli.model}</span>
      </div>
      
      <div class="heli-equipments-section">
        <span>GÖREV EKİPMANLARI</span>
        <div class="heli-tags-list">
          ${tagsHTML}
        </div>
      </div>
      
      <p class="heli-notes-p" title="${heli.notes}">${heli.notes || "Not bulunmamaktadır."}</p>
      
      <button class="btn btn-secondary btn-block btn-manage-equip" data-id="${heli.tailNo}">
        <i data-lucide="cog"></i>
        <span>Ekipman Yönet</span>
      </button>
    `;

    card.querySelector(".btn-manage-equip").addEventListener("click", () => {
      openManageEquipmentModal(heli.tailNo);
    });

    container.appendChild(card);
  });

  lucide.createIcons();
}

// Renders the Equipment Section
function renderEquipment() {
  const container = document.getElementById("equipment-list-container");
  if (!container) return;
  container.innerHTML = "";

  const searchText = document.getElementById("search-equipment")?.value.toLowerCase() || "";
  const statusFilter = document.getElementById("filter-equipment-status")?.value || "all";
  const locationFilter = document.getElementById("filter-equipment-location")?.value || "all";

  let list = state.equipments;

  // Apply filters
  if (statusFilter !== "all") {
    list = list.filter(e => e.status === statusFilter);
  }
  if (locationFilter !== "all") {
    list = list.filter(e => e.locationType === locationFilter);
  }
  if (searchText) {
    list = list.filter(e => 
      e.serialNo.toLowerCase().includes(searchText) || 
      e.name.toLowerCase().includes(searchText) || 
      e.model.toLowerCase().includes(searchText)
    );
  }

  if (list.length === 0) {
    container.innerHTML = `<p class="text-secondary" style="grid-column: 1/-1; text-align: center; padding: 2rem;">Ekipman kaydı bulunamadı.</p>`;
    return;
  }

  list.forEach(eq => {
    const card = document.createElement("div");
    card.className = "equipment-card";

    let locationHTML = "";
    if (eq.locationType === "depo") {
      locationHTML = `<span class="text-primary">${eq.locationId} Deposu</span>`;
    } else {
      locationHTML = `<span class="text-warning">${eq.locationId} Helikopteri</span>`;
    }

    card.innerHTML = `
      <div class="equip-card-header">
        <div>
          <span class="equip-serial">${eq.serialNo}</span>
          <h4 class="equip-name-title">${eq.name}</h4>
        </div>
        <span class="equip-status-badge status-${eq.status}">
          ${eq.status === "faal" ? "Faal" : eq.status === "gayri_faal" ? "Gayri Faal" : "Onarımda"}
        </span>
      </div>
      
      <div class="equip-info-grid">
        <div class="equip-info-row">
          <span class="equip-info-label">Model:</span>
          <span class="equip-info-val">${eq.model}</span>
        </div>
        <div class="equip-info-row">
          <span class="equip-info-label">Konum:</span>
          <span class="equip-info-val">${locationHTML}</span>
        </div>
        <div class="equip-info-row">
          <span class="equip-info-label">Son Güncelleme:</span>
          <span class="equip-info-val" style="font-size:0.75rem;">${formatDate(eq.updatedAt)}</span>
        </div>
      </div>
      
      <p class="heli-notes-p" title="${eq.notes}" style="height:32px;">${eq.notes || "Açıklama yok."}</p>
      
      <button class="btn btn-secondary btn-block btn-edit-equip" data-id="${eq.serialNo}">
        <i data-lucide="edit-3"></i>
        <span>Durumu Düzenle</span>
      </button>
    `;

    card.querySelector(".btn-edit-equip").addEventListener("click", () => {
      openEditEquipmentModal(eq.serialNo);
    });

    container.appendChild(card);
  });

  lucide.createIcons();
}

// Renders the Detailed Inventory Table (Filters tab)
function renderInventoryTable() {
  const tableBody = document.getElementById("inventory-table-body");
  if (!tableBody) return;
  tableBody.innerHTML = "";

  const activeTabFilter = document.querySelector(".tab-btn.active")?.getAttribute("data-filter") || "all";
  const searchText = document.getElementById("search-inventory-input")?.value.toLowerCase() || "";

  let list = state.equipments;

  // Apply tab filters
  if (activeTabFilter === "kullanimda") {
    list = list.filter(e => e.locationType === "helicopter");
  } else if (activeTabFilter === "depoda") {
    list = list.filter(e => e.locationType === "depo");
  } else if (activeTabFilter === "onarimda") {
    list = list.filter(e => e.status === "onarimda");
  }

  // Apply search
  if (searchText) {
    list = list.filter(e => 
      e.serialNo.toLowerCase().includes(searchText) || 
      e.name.toLowerCase().includes(searchText) || 
      e.model.toLowerCase().includes(searchText) || 
      e.locationId.toLowerCase().includes(searchText)
    );
  }

  if (list.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8" class="text-secondary" style="text-align: center; padding: 2rem;">Kayıt bulunamadı.</td></tr>`;
    return;
  }

  list.forEach(eq => {
    const row = document.createElement("tr");
    
    let locationHTML = "";
    if (eq.locationType === "depo") {
      locationHTML = `<span class="text-primary"><i data-lucide="archive" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i> ${eq.locationId} Deposu</span>`;
    } else {
      locationHTML = `<span class="text-warning"><i data-lucide="plane" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i> ${eq.locationId} Helikopteri</span>`;
    }

    row.innerHTML = `
      <td><strong>${eq.serialNo}</strong></td>
      <td>${eq.name}</td>
      <td>${eq.model}</td>
      <td>
        <span class="equip-status-badge status-${eq.status}">
          ${eq.status === "faal" ? "Faal" : eq.status === "gayri_faal" ? "Gayri Faal" : "Onarımda"}
        </span>
      </td>
      <td>${locationHTML}</td>
      <td style="font-size: 0.8rem; color: var(--text-muted);">${formatDate(eq.updatedAt)}</td>
      <td style="font-size: 0.85rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${eq.notes}">${eq.notes || "-"}</td>
      <td>
        <button class="btn btn-secondary btn-icon btn-edit-table" data-id="${eq.serialNo}" title="Düzenle">
          <i data-lucide="edit-3" style="width:16px; height:16px;"></i>
        </button>
      </td>
    `;

    row.querySelector(".btn-edit-table").addEventListener("click", () => {
      openEditEquipmentModal(eq.serialNo);
    });

    tableBody.appendChild(row);
  });

  lucide.createIcons();
}

// Renders the Operation/Audit logs
function renderLogs() {
  const tableBody = document.getElementById("logs-table-body");
  if (!tableBody) return;
  tableBody.innerHTML = "";

  const searchText = document.getElementById("search-logs-input")?.value.toLowerCase() || "";
  const actionFilter = document.getElementById("filter-logs-action")?.value || "all";

  let list = state.logs;

  if (actionFilter !== "all") {
    list = list.filter(l => l.actionType === actionFilter);
  }

  if (searchText) {
    list = list.filter(l => 
      l.details.toLowerCase().includes(searchText) || 
      l.userName.toLowerCase().includes(searchText) || 
      l.userSicil.toLowerCase().includes(searchText) || 
      l.comment.toLowerCase().includes(searchText)
    );
  }

  if (list.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="text-secondary" style="text-align: center; padding: 2rem;">Log kaydı bulunamadı.</td></tr>`;
    return;
  }

  list.forEach(log => {
    const row = document.createElement("tr");

    let badgeClass = "badge";
    if (log.actionType === "CREATE") badgeClass += " bg-success-soft text-success";
    else if (log.actionType === "UPDATE") badgeClass += " bg-primary-soft text-primary";
    else if (log.actionType === "MOUNT") badgeClass += " bg-info-soft text-indigo";
    else if (log.actionType === "UNMOUNT") badgeClass += " bg-warning-soft text-warning";

    row.innerHTML = `
      <td style="font-family: monospace; font-size: 0.8rem; white-space: nowrap;">${formatDate(log.timestamp)}</td>
      <td>
        <strong>${log.userName}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted)">Sicil: ${log.userSicil}</div>
      </td>
      <td><span class="${badgeClass}" style="border:none; text-transform:uppercase;">${log.actionType}</span></td>
      <td style="font-size: 0.9rem; line-height: 1.4; max-width: 320px;">${log.details}</td>
      <td style="font-size: 0.85rem; color: var(--text-secondary); max-width: 250px; font-style: italic;">
        "${log.comment}"
      </td>
    `;

    tableBody.appendChild(row);
  });
}

// Renders the Admin panel user list
function renderUsers() {
  const tableBody = document.getElementById("admin-users-table-body");
  if (!tableBody) return;
  tableBody.innerHTML = "";

  if (state.users.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="text-secondary" style="text-align: center;">Kullanıcı bulunamadı.</td></tr>`;
    return;
  }

  state.users.forEach(u => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${u.sicil}</strong></td>
      <td>${u.name}</td>
      <td>
        <span class="badge ${u.role === 'admin' ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary'}" style="border:none;">
          ${u.role === 'admin' ? 'Yönetici' : 'Teknisyen'}
        </span>
      </td>
      <td style="font-size:0.8rem; color:var(--text-muted)">${formatDate(u.createdAt)}</td>
    `;
    tableBody.appendChild(row);
  });
}

// Selects rendering based on active section
export function renderActiveSection() {
  switch (state.activeSection) {
    case "section-dashboard":
      renderDashboard();
      break;
    case "section-helicopters":
      renderHelicopters();
      break;
    case "section-equipment":
      renderEquipment();
      break;
    case "section-inventory":
      renderInventoryTable();
      break;
    case "section-logs":
      renderLogs();
      break;
    case "section-admin":
      renderUsers();
      break;
  }
}

// Opens the equipment management modal for a specific helicopter
function openManageEquipmentModal(heliTailNo) {
  const heli = state.helicopters.find(h => h.tailNo === heliTailNo);
  if (!heli) return;

  document.getElementById("manage-heli-title").textContent = `${heli.tailNo} Ekipman Yönetimi`;
  document.getElementById("manage-heli-subtitle").textContent = `${heli.model} | ${heli.fleet} Filosu`;
  document.getElementById("manage-equip-comment").value = "";

  // Set attributes for form handlers to access
  const modal = document.getElementById("modal-manage-heli-equip");
  modal.setAttribute("data-heli-id", heli.tailNo);
  modal.setAttribute("data-heli-fleet", heli.fleet);

  renderManageEquipmentLists(heli);
  openModal("modal-manage-heli-equip");
}

// Renders the mountable and unmountable equipment lists in the modal
export function renderManageEquipmentLists(heli) {
  const mountedList = document.getElementById("mounted-equip-list");
  const availableList = document.getElementById("available-equip-list");

  mountedList.innerHTML = "";
  availableList.innerHTML = "";

  // 1. Render mounted equipment
  const heliEquips = state.equipments.filter(e => heli.equipmentIds.includes(e.serialNo));
  if (heliEquips.length === 0) {
    mountedList.innerHTML = `<span class="text-secondary" style="font-size:0.8rem; text-align:center; padding:1rem; display:block;">Üzerinde ekipman yok.</span>`;
  } else {
    heliEquips.forEach(eq => {
      const item = document.createElement("div");
      item.className = "list-group-item";
      item.innerHTML = `
        <div>
          <strong>${eq.name}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted)">${eq.serialNo} | ${eq.model}</div>
        </div>
        <div class="list-group-item-actions">
          <button type="button" class="btn-unmount" data-id="${eq.serialNo}" title="Sök / Demonte Et">
            <i data-lucide="minus"></i>
          </button>
        </div>
      `;
      mountedList.appendChild(item);
    });
  }

  // 2. Render available equipment in this helicopter's fleet warehouse (Must be status = faal and locationType = depo)
  const availableEquips = state.equipments.filter(e => 
    e.locationType === "depo" && 
    e.locationId === heli.fleet && 
    e.status === "faal"
  );

  if (availableEquips.length === 0) {
    availableList.innerHTML = `<span class="text-secondary" style="font-size:0.8rem; text-align:center; padding:1rem; display:block;">Depoda monte edilebilir faal ekipman yok.</span>`;
  } else {
    availableEquips.forEach(eq => {
      const item = document.createElement("div");
      item.className = "list-group-item";
      item.innerHTML = `
        <div>
          <strong>${eq.name}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted)">${eq.serialNo} | ${eq.model}</div>
        </div>
        <div class="list-group-item-actions">
          <button type="button" class="btn-mount" data-id="${eq.serialNo}" title="Tak / Monte Et">
            <i data-lucide="plus"></i>
          </button>
        </div>
      `;
      availableList.appendChild(item);
    });
  }

  lucide.createIcons();
}

// Opens the edit status modal for a specific equipment
function openEditEquipmentModal(equipSerialNo) {
  const eq = state.equipments.find(e => e.serialNo === equipSerialNo);
  if (!eq) return;

  document.getElementById("edit-equip-title").textContent = `${eq.name} (${eq.model})`;
  document.getElementById("edit-equip-id").value = eq.serialNo;
  document.getElementById("edit-equip-status").value = eq.status;
  document.getElementById("edit-equip-notes").value = eq.notes;
  document.getElementById("edit-equip-comment").value = "";

  const relocateGroup = document.getElementById("edit-equip-relocate-group");
  const mountedInfo = document.getElementById("edit-equip-mounted-info");
  const fleetSelect = document.getElementById("edit-equip-fleet");

  if (eq.locationType === "helicopter") {
    // Cannot change depot location if mounted on helicopter
    relocateGroup.style.display = "block";
    fleetSelect.style.display = "none";
    mountedInfo.style.display = "inline";
    mountedInfo.textContent = `Bu ekipman şu anda ${eq.locationId} helikopterine takılıdır. Konum değiştirmek için önce ekipmanı sökmeniz gerekmektedir.`;
  } else {
    // Can change depot location if it is in warehouse
    relocateGroup.style.display = "block";
    fleetSelect.style.display = "block";
    fleetSelect.value = eq.locationId;
    mountedInfo.style.display = "none";
  }

  openModal("modal-edit-equipment");
}
