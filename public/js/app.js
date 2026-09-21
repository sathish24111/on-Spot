// ============================================================
// SWEETALERT2 GLOBAL HELPERS — replaces browser alert/confirm
// ============================================================
function showAlert(msg, type = 'info', title = '') {
  const iconMap = { success: 'success', error: 'error', warning: 'warning', info: 'info', question: 'question' };
  return Swal.fire({
    icon: iconMap[type] || 'info',
    title: title || (type === 'error' ? 'Error' : type === 'success' ? 'Success' : type === 'warning' ? 'Warning' : 'Notice'),
    text: msg,
    confirmButtonColor: '#0284c7',
    customClass: { popup: 'swal-custom-popup' }
  });
}

function showConfirm(msg, title = 'Are you sure?', confirmText = 'Yes', cancelText = 'Cancel') {
  return Swal.fire({
    icon: 'question',
    title: title,
    text: msg,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: '#0284c7',
    cancelButtonColor: '#64748b',
    customClass: { popup: 'swal-custom-popup' }
  }).then(result => result.isConfirmed);
}

function showToast(msg, type = 'success') {
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: type,
    title: msg,
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    customClass: { popup: 'swal-custom-popup' }
  });
}

// Global App State
let eventCatalog = [];
let selectedDay = 'day1';
let selectedEventIds = new Set();
let selectedHackathonTheme = 'Intelligent Systems';
let currentCoordinatorEventId = null;
let currentEventStudents = [];
let selectedEventTeamStudentIds = new Set();
let currentEventTeams = [];
let activeAdminDayTab = 'day1';
let isCoordinatorLoggedIn = false;
let loggedInCoordinatorEventKey = null; // e.g. 'd1_adzap' or 'ALL'
let loggedInCoordinatorEventName = null; // e.g. 'Adzap Desk'
let loggedInCoordinatorUsername = null; // e.g. 'adzap'
let loggedInCoordinatorRole = null; // 'EVENT_COORDINATOR' or 'MASTER'

const HACKATHON_THEMES = [
  'Intelligent Systems',
  'Sustainability',
  'Tech for Everyday',
  'FinTech / CommerceTech',
  'Smart Business Management / Institution Automation'
];

const PRICING = {
  day1: 250,
  day2: 250,
  both: 350,
  freefire: 400
};

const LIMITS = {
  day1Max: 2,
  day2Max: 2,
  bothTotalMax: 4
};

// ============================================================
// REAL-TIME BACKGROUND AUTO-SYNC ENGINE (NO PAGE RELOAD)
// ============================================================
const LiveSyncEngine = {
  syncIntervalMs: 3000,
  idleIntervalMs: 10000,
  timerId: null,
  isSyncing: false,
  lastSignatures: {},

  getSignature(data) {
    try {
      return JSON.stringify(data);
    } catch (e) {
      return String(Date.now());
    }
  },

  hasChanged(key, data) {
    const sig = this.getSignature(data);
    if (this.lastSignatures[key] === sig) {
      return false;
    }
    this.lastSignatures[key] = sig;
    return true;
  },

  flashSyncIndicator() {
    const ind = document.getElementById('liveSyncStatusIndicator');
    if (ind) {
      ind.classList.add('syncing');
      setTimeout(() => ind.classList.remove('syncing'), 600);
    }
  },

  init() {
    this.startHeartbeat(this.syncIntervalMs);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.startHeartbeat(this.syncIntervalMs);
        this.triggerImmediateSync();
      } else {
        this.startHeartbeat(this.idleIntervalMs);
      }
    });

    window.addEventListener('focus', () => {
      this.triggerImmediateSync();
    });
  },

  startHeartbeat(interval) {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      this.syncActiveView();
    }, interval);
  },

  async triggerImmediateSync() {
    if (this.isSyncing) return;
    await this.syncActiveView();
  },

  async syncActiveView() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      // 1. Always sync global stats & pending badges
      await this.syncGlobalStats();

      // 2. Identify active panel
      const activePanel = document.querySelector('.app-view-panel.active');
      const activeViewId = activePanel ? activePanel.id : 'viewHome';

      if (activeViewId === 'viewAdminMaster') {
        await this.syncAdminMasterView();
      } else if (activeViewId === 'viewCoordinatorLogin' && isCoordinatorLoggedIn) {
        await this.syncCoordinatorView();
      } else if (activeViewId === 'viewEventIssue') {
        await this.syncEventIssueView();
      }
    } catch (err) {
      console.warn('Auto-sync cycle notice:', err);
    } finally {
      this.isSyncing = false;
    }
  },

  async syncGlobalStats() {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.success && data.stats) {
        const s = data.stats;
        if (this.hasChanged('global_stats', s)) {
          this.flashSyncIndicator();
          const elOnline = document.getElementById('kpiAdminOnlineCount');
          const elSpot = document.getElementById('kpiAdminSpotCount');
          const elFfPlayers = document.getElementById('kpiAdminFfPlayersCount');
          const elFfTeams = document.getElementById('kpiAdminFfTeamsCount');
          const elTotal = document.getElementById('kpiAdminTotalCount');
          const elPassBreakdown = document.getElementById('kpiAdminPassBreakdown');
          const elRevenue = document.getElementById('kpiAdminTotalRevenue');
          const elPendingTotal = document.getElementById('kpiAdminPendingTotal');
          const elPendingSub = document.getElementById('kpiAdminPendingSub');
          const elTabBadge = document.getElementById('tabApprovalsBadge');

          if (elOnline) elOnline.textContent = s.onlineCount;
          if (elSpot) elSpot.textContent = s.spotCount;
          if (elFfPlayers) elFfPlayers.textContent = s.freefireTotalPlayers;
          if (elFfTeams) elFfTeams.textContent = `${s.freefireTeamsCount} Squads / Teams formed`;
          if (elTotal) elTotal.textContent = s.totalStudents;
          if (elPassBreakdown) elPassBreakdown.textContent = `Day 1: ${s.day1Count} | Day 2: ${s.day2Count} | Both: ${s.bothDaysCount}`;
          if (elRevenue) elRevenue.textContent = `₹${(s.totalRevenue || 0).toLocaleString('en-IN')}`;

          const totalPending = (s.pendingProfileRequestsCount || 0) + (s.pendingEventRequestsCount || 0);
          if (elPendingTotal) elPendingTotal.textContent = totalPending;
          if (elPendingSub) elPendingSub.textContent = `${s.pendingProfileRequestsCount || 0} Profile | ${s.pendingEventRequestsCount || 0} Event Changes`;
          if (elTabBadge) elTabBadge.textContent = totalPending;
        }
      }
    } catch (e) { }
  },

  async syncAdminMasterView() {
    const subtab = typeof currentMasterActiveSubtab !== 'undefined' ? currentMasterActiveSubtab : 'directory';

    if (subtab === 'directory') {
      try {
        const res = await fetch('/api/admin/all-students');
        const data = await res.json();
        if (data.success && data.students) {
          if (this.hasChanged('admin_directory', data.students)) {
            this.flashSyncIndicator();
            currentMasterStudents = data.students;
            filterMasterDirectoryTable();
          }
        }
      } catch (e) { }
    } else if (subtab === 'approvals') {
      try {
        const [profRes, evtRes] = await Promise.all([
          fetch('/api/admin/edit-requests'),
          fetch('/api/admin/event-change-requests')
        ]);
        const profData = await profRes.json();
        const evtData = await evtRes.json();

        if (profData.success && this.hasChanged('admin_prof_requests', profData.requests || [])) {
          this.flashSyncIndicator();
          renderMasterProfileRequests(profData.requests || []);
        }
        if (evtData.success && this.hasChanged('admin_evt_requests', evtData.requests || [])) {
          this.flashSyncIndicator();
          renderMasterEventRequests(evtData.requests || []);
        }
      } catch (e) { }
    } else if (subtab === 'events') {
      if (typeof currentMasterSelectedEventId !== 'undefined' && currentMasterSelectedEventId) {
        try {
          const res = await fetch(`/api/registrations?eventId=${currentMasterSelectedEventId}`);
          const data = await res.json();
          if (data.success && data.students) {
            if (this.hasChanged(`admin_event_${currentMasterSelectedEventId}`, data.students)) {
              this.flashSyncIndicator();
              currentMasterEventStudents = data.students;
              // Calculate live 4 KPI Counters
              const totalEnrolled = currentMasterEventStudents.length;
              const checkedInCount = currentMasterEventStudents.filter(st =>
                (st.events || []).some(e => e.event_id === currentMasterSelectedEventId && e.event_status === 'COMPLETED')
              ).length;
              const foodCount = currentMasterEventStudents.filter(st => st.food_given).length;
              const tagCount = currentMasterEventStudents.filter(st => st.tag_given).length;

              const elTotal = document.getElementById('adminEvtCount');
              const elCheckedIn = document.getElementById('adminEvtCheckedInCount');
              const elFood = document.getElementById('adminEvtFoodCount');
              const elTag = document.getElementById('adminEvtTagCount');

              if (elTotal) elTotal.textContent = totalEnrolled;
              if (elCheckedIn) elCheckedIn.textContent = checkedInCount;
              if (elFood) elFood.textContent = foodCount;
              if (elTag) elTag.textContent = tagCount;

              filterMasterInsideEventTable();
            }
          }
        } catch (e) { }
      }
    } else if (subtab === 'freefire') {
      try {
        const [soloRes, teamsRes] = await Promise.all([
          fetch('/api/freefire/unassigned-online-players'),
          fetch('/api/freefire/teams')
        ]);
        const soloData = await soloRes.json();
        const teamsData = await teamsRes.json();

        if (soloData.success && this.hasChanged('admin_ff_solos', soloData.players || [])) {
          this.flashSyncIndicator();
          currentMasterFfSoloPlayers = soloData.players || [];
          const countBadge = document.getElementById('adminFfSoloCount');
          if (countBadge) countBadge.textContent = currentMasterFfSoloPlayers.length;
          filterMasterFfSoloTable();
        }
        if (teamsData.success && this.hasChanged('admin_ff_teams', teamsData.teams || [])) {
          this.flashSyncIndicator();
          currentMasterFfTeams = teamsData.teams || [];
          const countHeader = document.getElementById('adminFfTeamsHeaderCount');
          if (countHeader) countHeader.textContent = currentMasterFfTeams.length;
          filterMasterFfTeamsGrid();
        }
      } catch (e) { }
    } else if (subtab === 'counters') {
      try {
        const [countersRes, facultyRes] = await Promise.all([
          fetch('/api/counters'),
          fetch('/api/faculty-list')
        ]);
        const countersData = await countersRes.json();
        const facultyData = await facultyRes.json();

        if (countersData.success && facultyData.success) {
          const combo = { c: countersData.counters, f: facultyData.faculty };
          if (this.hasChanged('admin_counters_setup', combo)) {
            this.flashSyncIndicator();
            currentCountersList = countersData.counters || [];
            currentFacultyList = facultyData.faculty || [];
            renderAdminCountersGrid();
            populateSpotCounterSelects(currentCountersList);
          }
        }
      } catch (e) { }
    } else if (subtab === 'counter-reg') {
      try {
        const elCounter = document.getElementById('filterReportCounter');
        const elFaculty = document.getElementById('filterReportFaculty');
        const elDate = document.getElementById('filterReportDate');
        const elSearch = document.getElementById('filterReportSearch');

        const counterVal = elCounter ? elCounter.value : 'all';
        const facultyVal = elFaculty ? elFaculty.value : 'all';
        const dateVal = elDate ? elDate.value : '';
        const searchVal = elSearch ? elSearch.value.trim() : '';

        const params = new URLSearchParams();
        if (counterVal && counterVal !== 'all') params.append('counter', counterVal);
        if (facultyVal && facultyVal !== 'all') params.append('faculty', facultyVal);
        if (dateVal) params.append('date', dateVal);
        if (searchVal) params.append('q', searchVal);

        const res = await fetch(`/api/admin/counter-report?${params.toString()}`);
        const data = await res.json();
        if (data.success && this.hasChanged('admin_counter_report', data)) {
          this.flashSyncIndicator();
          currentCounterReportData = data;
          renderCounterReportSummary(data.summary, data.counterWiseCounts);
          renderCounterCardsOverview(data.counterWiseCounts, counterVal);
          populateFacultyFilterOptions(data.counterWiseCounts);
          renderCounterReportTable(data.registrations || []);
        }
      } catch (e) { }
    }
  },

  async syncCoordinatorView() {
    if (!currentCoordinatorEventId) return;

    try {
      const res = await fetch(`/api/registrations?eventId=${currentCoordinatorEventId}`);
      const data = await res.json();
      if (data.success && data.students) {
        if (this.hasChanged(`coord_students_${currentCoordinatorEventId}`, data.students)) {
          this.flashSyncIndicator();
          currentEventStudents = data.students;
          const countEl = document.getElementById('coordEventCount');
          if (countEl) countEl.textContent = currentEventStudents.length;
          updateEventTeamSelectionUI();
          filterCoordinatorTable();
        }
      }

      const evt = (typeof eventCatalog !== 'undefined' && eventCatalog) ? eventCatalog.find(e => e.id === currentCoordinatorEventId) : null;
      if (evt && (evt.max_participants || 1) > 1) {
        const teamsRes = await fetch(`/api/coordinator/event-teams?eventId=${currentCoordinatorEventId}`);
        const teamsData = await teamsRes.json();
        if (teamsData.success && teamsData.teams) {
          if (this.hasChanged(`coord_teams_${currentCoordinatorEventId}`, teamsData.teams)) {
            this.flashSyncIndicator();
            currentEventTeams = teamsData.teams || [];
            const badge = document.getElementById('coordTeamsCountBadge');
            if (badge) badge.textContent = currentEventTeams.length;
            renderCoordinatorFormedTeams();
          }
        }
      }
    } catch (e) { }
  },

  async syncEventIssueView() {
    try {
      const [regsRes, pendingRes] = await Promise.all([
        fetch('/api/registrations'),
        fetch('/api/coordinator/pending-event-requests')
      ]);
      const regsData = await regsRes.json();
      const pendingData = await pendingRes.json();

      if (regsData.success && pendingData.success) {
        const combo = { r: regsData.students, p: pendingData.pendingStudentIds };
        if (this.hasChanged('event_issue_data', combo)) {
          this.flashSyncIndicator();
          currentEventIssueParticipants = regsData.students || [];
          pendingEventChangeStudentIds = new Set(pendingData.pendingStudentIds || []);
          filterEventIssueTable();
        }
      }
    } catch (e) { }
  }
};

window.LiveSyncEngine = LiveSyncEngine;

document.addEventListener('DOMContentLoaded', () => {
  initMainNavigation();
  initHomeScreen();
  initSpotChoiceFlow();
  initRegistrationForm();
  initDay2GateSearch();
  initCoordinatorLogin();
  initAdminDashboard();
  initCoordinatorDesk();
  initEventIssueManagement();
  initFreeFireKiosk();
  initFreeFireDashboard();
  initMasterAdminPortal();
  initExcelImport();
  initCountersAndReports();
  initAccessControl();
  initRouter();
  LiveSyncEngine.init();

  // Restore coordinator session if active
  const savedCoordEventKey = sessionStorage.getItem('techraga_coord_event_key');
  const savedCoordEventName = sessionStorage.getItem('techraga_coord_event_name');
  const savedCoordUser = sessionStorage.getItem('techraga_coord_user');
  const savedCoordRole = sessionStorage.getItem('techraga_coord_role');
  if (savedCoordEventKey && sessionStorage.getItem('techraga_auth_coordinator_portal') === 'true') {
    isCoordinatorLoggedIn = true;
    loggedInCoordinatorEventKey = savedCoordEventKey;
    loggedInCoordinatorEventName = savedCoordEventName || 'Event Desk';
    loggedInCoordinatorUsername = savedCoordUser || 'coordinator';
    loggedInCoordinatorRole = savedCoordRole || 'EVENT_COORDINATOR';
    updateCoordinatorIdentityBadge();
    const cLoginBox = document.getElementById('coordinatorLoginBox');
    const cDashBox = document.getElementById('coordinatorDashboardBox');
    if (cLoginBox) cLoginBox.style.display = 'none';
    if (cDashBox) cDashBox.style.display = 'block';
  }

  // Load Event Catalog
  loadEventCatalog();
});

// Top-Level Delegated Click Listener for Edit Team Buttons (Failsafe String ID Match & Auto-Fetch Fallback)
document.addEventListener('click', async (e) => {
  const editBtn = e.target.closest('.btn-edit-ff-team');
  if (editBtn) {
    e.preventDefault();
    e.stopPropagation();
    const teamId = editBtn.getAttribute('data-team-id');
    if (!teamId) return;

    let team = currentFfTeams.find(t => String(t.id) === String(teamId));
    if (!team) {
      try {
        const res = await fetch('/api/freefire/teams');
        const data = await res.json();
        if (data.success && data.teams) {
          currentFfTeams = data.teams;
          team = currentFfTeams.find(t => String(t.id) === String(teamId));
        }
      } catch (fetchErr) {
        console.error('Failed to fetch teams on edit click:', fetchErr);
      }
    }

    if (team) {
      openEditFfTeamModal(team);
    } else {
      showAlert(`Team #${teamId} details loading... Please try clicking edit again.`);
      loadFreeFireTeams();
    }
  }
});

// ROUTE AND DYNAMIC HEADER MAPPING
const MODULE_ROUTES = {
  viewHome: {
    hash: 'home',
    title: "TechRaga '26",
    sub: "KPR College of Arts Science and Research",
    icon: ""
  },
  viewKiosk: {
    hash: 'spot-registration',
    title: "Spot Registration",
    sub: "TechRaga '26 • Desk Kiosk",
    icon: "fa-pen-to-square"
  },
  viewEventIssue: {
    hash: 'event-issue',
    title: "Event Issue Management",
    sub: "TechRaga '26 • Help Desk",
    icon: "fa-triangle-exclamation"
  },
  viewDay2Search: {
    hash: 'day2-gate-search',
    title: "Day 2 Gate Search",
    sub: "TechRaga '26 • Gate Verification",
    icon: "fa-magnifying-glass"
  },
  viewCoordinatorLogin: {
    hash: 'coordinator-portal',
    title: "Coordinator Portal",
    sub: "TechRaga '26 • Event Management",
    icon: "fa-user-shield"
  },
  viewAdminMaster: {
    hash: 'admin-master',
    title: "Admin Master Portal",
    sub: "TechRaga '26 • System Control",
    icon: "fa-crown"
  }
};

// MODULE ACCESS CONTROL CONFIGURATION
const MODULE_AUTH_CONFIG = {
  viewHome: {
    isPublic: true,
    moduleKey: null,
    moduleName: 'Home Screen'
  },
  viewKiosk: {
    isPublic: false,
    moduleKey: 'spot_registration',
    moduleName: 'Spot Registration Desk',
    defaultHint: 'spot / spot123',
    icon: 'fa-pen-to-square'
  },
  viewEventIssue: {
    isPublic: false,
    moduleKey: 'event_issue',
    moduleName: 'Event Issue Management Desk',
    defaultHint: 'issue / issue123',
    icon: 'fa-triangle-exclamation'
  },
  viewDay2Search: {
    isPublic: false,
    moduleKey: 'day2_gate',
    moduleName: 'Day 2 Gate Search Desk',
    defaultHint: 'gate / gate123',
    icon: 'fa-magnifying-glass'
  },
  viewCoordinatorLogin: {
    isPublic: true,
    moduleKey: 'coordinator_portal',
    moduleName: 'Coordinator Portal',
    defaultHint: 'coordinator / coord123',
    icon: 'fa-user-shield'
  },
  viewAdminMaster: {
    isPublic: false,
    moduleKey: 'admin_master',
    moduleName: 'Admin Master Portal',
    defaultHint: 'admin / admin123',
    icon: 'fa-crown'
  }
};

function isModuleAuthorized(viewId) {
  const cfg = MODULE_AUTH_CONFIG[viewId];
  if (!cfg || cfg.isPublic) return true;
  if (sessionStorage.getItem('techraga_auth_admin_master') === 'true') return true;
  return sessionStorage.getItem('techraga_auth_' + cfg.moduleKey) === 'true';
}

let pendingAuthCallback = null;

function promptDeskLogin(targetViewId, onSuccess) {
  const cfg = MODULE_AUTH_CONFIG[targetViewId];
  if (!cfg) {
    if (typeof onSuccess === 'function') onSuccess();
    return;
  }

  pendingAuthCallback = onSuccess;

  const titleEl = document.getElementById('deskLoginTitle');
  const subEl = document.getElementById('deskLoginSubtitle');
  const iconEl = document.getElementById('deskLoginIcon');
  const hintTextEl = document.getElementById('deskLoginHintText');
  const keyInput = document.getElementById('deskLoginModuleKey');
  const uInput = document.getElementById('inputDeskLoginUsername');
  const pInput = document.getElementById('inputDeskLoginPassword');
  const errEl = document.getElementById('deskLoginErrorMsg');

  if (titleEl) titleEl.textContent = `${cfg.moduleName} Login`;
  if (subEl) subEl.textContent = `Enter credentials for ${cfg.moduleName} to unlock`;
  if (iconEl && cfg.icon) iconEl.className = `fa-solid ${cfg.icon}`;
  if (hintTextEl) hintTextEl.textContent = cfg.defaultHint || 'spot / spot123';
  if (keyInput) keyInput.value = cfg.moduleKey || '';
  if (uInput) uInput.value = '';
  if (pInput) pInput.value = '';
  if (errEl) errEl.style.display = 'none';

  openModal('modalDeskLogin');
  if (uInput) setTimeout(() => uInput.focus(), 150);
}

async function submitDeskLogin() {
  const keyInput = document.getElementById('deskLoginModuleKey');
  const uInput = document.getElementById('inputDeskLoginUsername');
  const pInput = document.getElementById('inputDeskLoginPassword');
  const errEl = document.getElementById('deskLoginErrorMsg');
  const btnSubmit = document.getElementById('btnSubmitDeskLogin');

  const moduleKey = keyInput ? keyInput.value : '';
  const username = uInput ? uInput.value.trim() : '';
  const password = pInput ? pInput.value.trim() : '';

  if (!username || !password) {
    if (errEl) {
      errEl.textContent = 'Please enter both username and password.';
      errEl.style.display = 'block';
    }
    return;
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verifying...`;
  }
  if (errEl) errEl.style.display = 'none';

  try {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleKey, username, password })
    });

    const data = await res.json();
    if (data.success) {
      // Mark authorized in session
      sessionStorage.setItem('techraga_auth_' + data.moduleKey, 'true');
      if (data.role === 'ADMIN' || data.moduleKey === 'admin_master') {
        sessionStorage.setItem('techraga_auth_admin_master', 'true');
      }

      if (data.moduleKey === 'coordinator_portal' || data.category === 'EVENT' || data.role === 'EVENT_COORDINATOR') {
        isCoordinatorLoggedIn = true;
        if (data.role === 'EVENT_COORDINATOR' || data.category === 'EVENT') {
          loggedInCoordinatorEventKey = data.moduleKey;
          loggedInCoordinatorEventName = data.moduleName;
          loggedInCoordinatorUsername = data.username;
          loggedInCoordinatorRole = 'EVENT_COORDINATOR';
        } else {
          loggedInCoordinatorEventKey = 'ALL';
          loggedInCoordinatorEventName = 'Master Coordinator';
          loggedInCoordinatorUsername = data.username;
          loggedInCoordinatorRole = 'MASTER';
        }

        sessionStorage.setItem('techraga_coord_event_key', loggedInCoordinatorEventKey);
        sessionStorage.setItem('techraga_coord_event_name', loggedInCoordinatorEventName);
        sessionStorage.setItem('techraga_coord_user', loggedInCoordinatorUsername);
        sessionStorage.setItem('techraga_coord_role', loggedInCoordinatorRole);

        updateCoordinatorIdentityBadge();

        const cLoginBox = document.getElementById('coordinatorLoginBox');
        const cDashBox = document.getElementById('coordinatorDashboardBox');
        if (cLoginBox) cLoginBox.style.display = 'none';
        if (cDashBox) cDashBox.style.display = 'block';

        if (loggedInCoordinatorEventKey && loggedInCoordinatorEventKey !== 'ALL') {
          selectCoordinatorEvent(loggedInCoordinatorEventKey);
        }
      }

      closeModal('modalDeskLogin');

      if (typeof pendingAuthCallback === 'function') {
        const cb = pendingAuthCallback;
        pendingAuthCallback = null;
        cb();
      }
    } else {
      if (errEl) {
        errEl.textContent = data.message || 'Invalid username or password.';
        errEl.style.display = 'block';
      }
    }
  } catch (err) {
    console.error('Authentication request error:', err);
    if (errEl) {
      errEl.textContent = 'Server connection error. Please try again.';
      errEl.style.display = 'block';
    }
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<i class="fa-solid fa-unlock"></i> Unlock & Access Desk`;
    }
  }
}

// MODULE NAVIGATION HELPER
function switchModuleTab(targetViewId, pushHistory = true) {
  if (!isModuleAuthorized(targetViewId)) {
    promptDeskLogin(targetViewId, () => {
      switchModuleTab(targetViewId, pushHistory);
    });
    return;
  }

  const navBtns = document.querySelectorAll('.nav-tab-btn');
  navBtns.forEach(btn => {
    if (btn.getAttribute('data-target') === targetViewId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  document.querySelectorAll('.app-view-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const targetPanel = document.getElementById(targetViewId);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  // Update Left Header Title & Subtitle dynamically
  const info = MODULE_ROUTES[targetViewId] || MODULE_ROUTES.viewHome;
  const brandTitleEl = document.getElementById('headerBrandTitle');
  const brandSubEl = document.getElementById('headerBrandSub');
  if (brandTitleEl) {
    if (info.icon) {
      brandTitleEl.innerHTML = `<i class="fa-solid ${info.icon}" style="margin-right: 0.35rem; color: #f59e0b;"></i> ${info.title}`;
    } else {
      brandTitleEl.textContent = info.title;
    }
  }
  if (brandSubEl) {
    brandSubEl.textContent = info.sub;
  }

  // HTML5 History & URL hash push
  if (pushHistory) {
    const currentHash = window.location.hash.replace('#', '');
    if (currentHash !== info.hash) {
      history.pushState({ viewId: targetViewId }, '', '#' + info.hash);
    }
  }

  if (targetViewId === 'viewKiosk') {
    showSpotChoiceHub();
  }
  if (targetViewId === 'viewCoordinatorLogin' && isCoordinatorLoggedIn) {
    loadAdminDashboard();
  }
  if (targetViewId === 'viewEventIssue') {
    loadEventIssueParticipants();
  }
  if (targetViewId === 'viewAdminMaster') {
    loadMasterAdminDashboard();
  }
}


// BROWSER HISTORY & ROUTING (Chrome Back/Forward Arrow Support)
function initRouter() {
  window.addEventListener('popstate', (e) => {
    let targetViewId = 'viewHome';
    if (e.state && e.state.viewId) {
      targetViewId = e.state.viewId;
    } else {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      for (const [vId, cfg] of Object.entries(MODULE_ROUTES)) {
        if (cfg.hash === hash ||
          (hash.includes('spot') && vId === 'viewKiosk') ||
          (hash.includes('day2') && vId === 'viewDay2Search') ||
          (hash.includes('coord') && vId === 'viewCoordinatorLogin') ||
          (hash.includes('admin') && vId === 'viewAdminMaster') ||
          (hash.includes('issue') && vId === 'viewEventIssue')) {
          targetViewId = vId;
          break;
        }
      }
    }
    switchModuleTab(targetViewId, false);
  });

  // Handle initial page load from direct hash
  const initialHash = window.location.hash.replace('#', '').toLowerCase();
  let matchedViewId = 'viewHome';
  if (initialHash) {
    for (const [vId, cfg] of Object.entries(MODULE_ROUTES)) {
      if (cfg.hash === initialHash ||
        (initialHash.includes('spot') && vId === 'viewKiosk') ||
        (initialHash.includes('day2') && vId === 'viewDay2Search') ||
        (initialHash.includes('coord') && vId === 'viewCoordinatorLogin') ||
        (initialHash.includes('admin') && vId === 'viewAdminMaster') ||
        (initialHash.includes('issue') && vId === 'viewEventIssue')) {
        matchedViewId = vId;
        break;
      }
    }
  }
  const initialCfg = MODULE_ROUTES[matchedViewId] || MODULE_ROUTES.viewHome;
  history.replaceState({ viewId: matchedViewId }, '', '#' + initialCfg.hash);
  switchModuleTab(matchedViewId, false);
}

// 1. MAIN APP NAVIGATION (6 MODULES)
function initMainNavigation() {
  const navBtns = document.querySelectorAll('.nav-tab-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetViewId = btn.getAttribute('data-target');
      switchModuleTab(targetViewId, true);
    });
  });
}

// 0. HOME SCREEN QUICK ACCESS & HERO NAVIGATION
function initHomeScreen() {
  const brandLogo = document.getElementById('brandHeaderLogo');
  if (brandLogo) {
    brandLogo.addEventListener('click', () => {
      switchModuleTab('viewHome');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const btnHeroSpot = document.getElementById('btnHeroSpotRegister');
  const cardSpot = document.getElementById('homeCardSpot');
  if (btnHeroSpot) {
    btnHeroSpot.addEventListener('click', () => {
      switchModuleTab('viewKiosk');
    });
  }
  if (cardSpot) {
    cardSpot.addEventListener('click', () => {
      switchModuleTab('viewKiosk');
    });
  }

  const btnHeroGate = document.getElementById('btnHeroGateSearch');
  const cardGate = document.getElementById('homeCardGate');
  if (btnHeroGate) {
    btnHeroGate.addEventListener('click', () => {
      switchModuleTab('viewDay2Search');
    });
  }
  if (cardGate) {
    cardGate.addEventListener('click', () => {
      switchModuleTab('viewDay2Search');
    });
  }

  const cardIssue = document.getElementById('homeCardIssue');
  if (cardIssue) {
    cardIssue.addEventListener('click', () => {
      switchModuleTab('viewEventIssue');
    });
  }

  const cardCoord = document.getElementById('homeCardCoord');
  if (cardCoord) {
    cardCoord.addEventListener('click', () => {
      switchModuleTab('viewCoordinatorLogin');
    });
  }

  const cardAdmin = document.getElementById('homeCardAdmin');
  if (cardAdmin) {
    cardAdmin.addEventListener('click', () => {
      switchModuleTab('viewAdminMaster');
    });
  }
}

// SPOT REGISTRATION FLOW LOGIC (CHOICE HUB -> REGISTER / FREE FIRE REGISTER)
function initSpotChoiceFlow() {
  const btnGen = document.getElementById('btnSelectGeneralRegister');
  const btnFF = document.getElementById('btnSelectFreeFireRegister');
  const btnBackGen = document.getElementById('btnBackToSpotHub');
  const btnBackFF = document.getElementById('btnBackToSpotHubFromFF');

  if (btnGen) {
    btnGen.addEventListener('click', () => {
      showGeneralRegistrationForm();
    });
  }

  if (btnFF) {
    btnFF.addEventListener('click', () => {
      showFreeFireRegistrationForm();
    });
  }

  if (btnBackGen) {
    btnBackGen.addEventListener('click', () => {
      showSpotChoiceHub();
    });
  }

  if (btnBackFF) {
    btnBackFF.addEventListener('click', () => {
      showSpotChoiceHub();
    });
  }
}

function showSpotChoiceHub() {
  const hub = document.getElementById('spotChoiceHub');
  const genForm = document.getElementById('generalRegistrationFormContainer');
  const bannerTitle = document.getElementById('kioskBannerHeading');
  const bannerSub = document.getElementById('kioskBannerSub');

  if (hub) hub.style.display = 'block';
  if (genForm) genForm.style.display = 'none';
  if (bannerTitle) bannerTitle.textContent = 'Student Spot Registration';
  if (bannerSub) bannerSub.textContent = 'Select your registration track below to get started';

  document.querySelectorAll('.app-view-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  const viewKiosk = document.getElementById('viewKiosk');
  if (viewKiosk) viewKiosk.classList.add('active');

  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const tabKiosk = document.getElementById('tabNavKiosk');
  if (tabKiosk) tabKiosk.classList.add('active');
}

function showGeneralRegistrationForm() {
  const hub = document.getElementById('spotChoiceHub');
  const genForm = document.getElementById('generalRegistrationFormContainer');
  const bannerTitle = document.getElementById('kioskBannerHeading');
  const bannerSub = document.getElementById('kioskBannerSub');

  if (hub) hub.style.display = 'none';
  if (genForm) genForm.style.display = 'block';
  if (bannerTitle) bannerTitle.textContent = 'Student Event Registration';
  if (bannerSub) bannerSub.textContent = 'Complete your spot registration for Day 1, Day 2, or Both days below';

  document.querySelectorAll('.app-view-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  const viewKiosk = document.getElementById('viewKiosk');
  if (viewKiosk) viewKiosk.classList.add('active');

  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const tabKiosk = document.getElementById('tabNavKiosk');
  if (tabKiosk) tabKiosk.classList.add('active');
}

// ============================================================
// REGISTRATION WIZARD - 3 STEP UI
// ============================================================
let currentWizardStep = 1;

window.goToWizardStep = function (step) {
  // Validate before advancing
  if (step > currentWizardStep) {
    if (currentWizardStep === 1) {
      const name = document.getElementById('studentName').value.trim();
      const phone = document.getElementById('studentPhone').value.trim();
      const email = (document.getElementById('studentEmail') ? document.getElementById('studentEmail').value : '').trim();
      const college = document.getElementById('studentCollege').value.trim();
      if (!name) { showAlert('Please enter Student Full Name.', 'warning'); return; }
      if (!phone || !/^\d{10}$/.test(phone)) { showAlert('Please enter a valid 10-digit Phone Number.', 'warning'); return; }
      if (!email) { showAlert('Please enter Student Email Address.', 'warning'); return; }
      if (!college) { showAlert('Please enter College Name.', 'warning'); return; }
    }
    if (currentWizardStep === 2) {
      // pass selection is always valid (radio has a default)
    }
  }

  currentWizardStep = step;

  // Hide all content blocks
  document.querySelectorAll('.wizard-content-block').forEach(b => b.style.display = 'none');
  const activeBlock = document.getElementById(`wiz-content-${step}`);
  if (activeBlock) activeBlock.style.display = 'block';

  // Update progress bar
  [1, 2, 3].forEach(i => {
    const el = document.getElementById(`wiz-step-${i}`);
    if (!el) return;
    el.classList.remove('active', 'completed');
    if (i < step) el.classList.add('completed');
    else if (i === step) el.classList.add('active');
  });

  // Update order summary
  updateOrderSummary();

  // If entering step 3, refresh event rendering
  if (step === 3) {
    renderRegistrationEvents();
    updateEventCheckboxStates();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function updateOrderSummary() {
  const name = document.getElementById('studentName') ? document.getElementById('studentName').value.trim() : '';
  const phone = document.getElementById('studentPhone') ? document.getElementById('studentPhone').value.trim() : '';

  const nameEl = document.getElementById('summaryName');
  const phoneEl = document.getElementById('summaryPhone');
  const passEl = document.getElementById('summaryPassType');
  const totalEl = document.getElementById('summaryTotalAmount');
  const listEl = document.getElementById('summaryEventsList');
  const countEl = document.getElementById('summaryEventsCount');

  if (nameEl) nameEl.textContent = name || '--';
  if (phoneEl) phoneEl.textContent = phone || '--';

  const passLabels = { day1: 'Day 1 Pass (₹250)', day2: 'Day 2 Pass (₹250)', both: 'Both Days Pass (₹350)' };
  if (passEl) passEl.textContent = passLabels[selectedDay] || 'Day 1 Pass (₹250)';
  if (totalEl) totalEl.textContent = `₹${PRICING[selectedDay] || 250}`;

  if (listEl) {
    const selected = eventCatalog.filter(e => selectedEventIds.has(e.id));
    if (selected.length === 0) {
      listEl.innerHTML = '<li class="empty-events">No events selected yet</li>';
    } else {
      listEl.innerHTML = selected.map(e => `<li><i class="fa-solid fa-ticket"></i> ${e.name} <span style="color:#94a3b8; font-size:0.75rem;">(${e.day === 'day1' ? 'Day 1' : 'Day 2'})</span></li>`).join('');
    }
    if (countEl) countEl.textContent = selected.length;
  }
}

window.resetWizardAndStartNew = function () {
  currentWizardStep = 1;
  selectedEventIds.clear();
  selectedDay = 'day1';
  const form = document.getElementById('registrationForm');
  if (form) form.reset();
  const successDiv = document.getElementById('registrationSuccessMessage');
  if (successDiv) successDiv.style.display = 'none';
  if (form) form.style.display = 'block';
  updateDaySelectionUI();
  window.goToWizardStep(1);
  updateOrderSummary();
};

function showRegistrationSuccess(data) {
  const reg = data.registration;
  const form = document.getElementById('registrationForm');
  const successDiv = document.getElementById('registrationSuccessMessage');
  if (form) form.style.display = 'none';
  if (successDiv) {
    const detailsBox = document.getElementById('successDetailsBox');
    if (detailsBox) {
      let passLabel = 'Day 1';
      if (reg.day_selection === 'day2') passLabel = 'Day 2';
      if (reg.day_selection === 'both') passLabel = 'Both Days';
      const events = (reg.selected_events || []).map(e => `<div style="margin:0.2rem 0;"><i class="fa-solid fa-ticket" style="color:#0284c7;"></i> ${e.name}</div>`).join('');
      detailsBox.innerHTML = `
        <div style="font-size:1.5rem; font-weight:800; color:#0284c7; margin-bottom:1rem;">${reg.reg_code || 'SPOT-' + reg.id}</div>
        <div style="margin-bottom:0.5rem;"><strong>Name:</strong> ${reg.name}</div>
        <div style="margin-bottom:0.5rem;"><strong>Phone:</strong> ${reg.phone}</div>
        <div style="margin-bottom:0.5rem;"><strong>College:</strong> ${reg.college}</div>
        <div style="margin-bottom:0.5rem;"><strong>Pass:</strong> ${passLabel} — ₹${reg.total_fee}</div>
        <div style="margin-top:0.75rem;"><strong>Events:</strong>${events || '<em>None</em>'}</div>
      `;
    }
    successDiv.style.display = 'block';
  }
  loadEventCatalog();
}

function showFreeFireRegistrationForm() {
  document.querySelectorAll('.app-view-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  const ffPanel = document.getElementById('viewFreeFireKiosk');
  if (ffPanel) ffPanel.classList.add('active');

  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const tabKiosk = document.getElementById('tabNavKiosk');
  if (tabKiosk) tabKiosk.classList.add('active');
}

// 2. LOAD EVENT CATALOG
async function loadEventCatalog() {
  try {
    const res = await fetch('/api/events');
    const data = await res.json();
    if (data.success) {
      eventCatalog = data.events;
      renderRegistrationEvents();
      renderSidebarDynamicEvents();
    }
  } catch (err) {
    console.error('Failed to load event catalog:', err);
  }
}

// 3. STUDENT SPOT REGISTRATION FORM
function initRegistrationForm() {
  const dayRadios = document.querySelectorAll('input[name="daySelection"]');
  dayRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      selectedDay = e.target.value;
      updateDaySelectionUI();
      updateOrderSummary();
    });
  });

  // Wizard final submit button
  const btnFinal = document.getElementById('btnFinalSubmitRegistration');
  if (btnFinal) {
    btnFinal.addEventListener('click', handleWizardFinalSubmit);
  }

  // Old review/modal flow (keep for backward compat if modal still exists)
  const btnReview = document.getElementById('btnReviewRegistration');
  if (btnReview) btnReview.addEventListener('click', handleReviewRegistration);
  const closeSum = document.getElementById('closeSummaryModal');
  if (closeSum) closeSum.addEventListener('click', () => closeModal('modalSummary'));
  const btnEdit = document.getElementById('btnEditRegistration');
  if (btnEdit) btnEdit.addEventListener('click', () => closeModal('modalSummary'));
  const btnConfirm = document.getElementById('btnConfirmRegister');
  if (btnConfirm) btnConfirm.addEventListener('click', handleConfirmRegistration);
  const btnNewReg = document.getElementById('btnNewRegistration');
  if (btnNewReg) btnNewReg.addEventListener('click', resetRegistrationForm);

  // Live update order summary on input
  ['studentName', 'studentPhone'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateOrderSummary);
  });
}

function updateDaySelectionUI() {
  document.querySelectorAll('.day-option-card').forEach(card => card.classList.remove('selected'));
  const activeLabel = document.getElementById(`label-${selectedDay}`);
  if (activeLabel) activeLabel.classList.add('selected');

  const blockDay1 = document.getElementById('block-day1-events');
  const blockDay2 = document.getElementById('block-day2-events');

  if (blockDay1 && blockDay2) {
    if (selectedDay === 'day1') {
      blockDay1.style.display = 'block';
      blockDay2.style.display = 'none';
    } else if (selectedDay === 'day2') {
      blockDay1.style.display = 'none';
      blockDay2.style.display = 'block';
    } else if (selectedDay === 'both') {
      blockDay1.style.display = 'block';
      blockDay2.style.display = 'block';
    }
  }

  const validEvents = eventCatalog.filter(e => {
    if (e.is_standalone) return false;
    if (selectedDay === 'day1') return e.day === 'day1';
    if (selectedDay === 'day2') return e.day === 'day2';
    return true;
  }).map(e => e.id);

  selectedEventIds.forEach(id => {
    if (!validEvents.includes(id)) {
      selectedEventIds.delete(id);
    }
  });

  updateEventCheckboxStates();
}

function getEventParticipantBadge(evt) {
  const min = evt.min_participants || 1;
  const max = evt.max_participants || 1;
  if (min === max) {
    if (min === 1) {
      return `<span class="evt-participants-badge badge-solo"><i class="fa-solid fa-user"></i> Min: 1 | Max: 1</span>`;
    }
    return `<span class="evt-participants-badge badge-team"><i class="fa-solid fa-users"></i> Min: ${min} | Max: ${max}</span>`;
  }
  return `<span class="evt-participants-badge badge-team-range"><i class="fa-solid fa-users"></i> Min: ${min} | Max: ${max}</span>`;
}

function renderRegistrationEvents() {
  const gridDay1 = document.getElementById('grid-day1-events');
  const gridDay2 = document.getElementById('grid-day2-events');

  gridDay1.innerHTML = '';
  gridDay2.innerHTML = '';

  eventCatalog.forEach(evt => {
    // Exclude standalone tournament events (Free Fire has its own dedicated registration)
    if (evt.is_standalone) return;

    const card = document.createElement('label');
    card.className = 'event-checkbox-card';
    card.setAttribute('data-event-id', evt.id);

    const isChecked = selectedEventIds.has(evt.id);

    card.innerHTML = `
      <input type="checkbox" value="${evt.id}" ${isChecked ? 'checked' : ''}>
      <div class="evt-details">
        <div class="evt-title-row">
          <span class="evt-name">${evt.name}</span>
          ${getEventParticipantBadge(evt)}
        </div>
        <span class="evt-cat">${evt.category}</span>
        ${evt.has_themes ? '<span class="evt-theme-notice"><i class="fa-solid fa-code"></i> Select 1 of 5 Hackathon Themes (Min: 3 | Max: 5)</span>' : ''}
      </div>
    `;

    const checkbox = card.querySelector('input');
    checkbox.addEventListener('change', (e) => handleEventCheckboxToggle(evt, e.target.checked));

    if (evt.day === 'day1') {
      gridDay1.appendChild(card);
    } else if (evt.day === 'day2') {
      gridDay2.appendChild(card);
    }
  });

  // If Hackathon is selected, render the 5 Themes selection container underneath
  renderHackathonThemeContainer();

  updateDaySelectionUI();
}

function renderHackathonThemeContainer() {
  const existingThemeContainer = document.getElementById('hackathonThemeContainer');
  if (existingThemeContainer) {
    existingThemeContainer.remove();
  }

  if (selectedEventIds.has('d1_hackathon')) {
    const gridDay1 = document.getElementById('grid-day1-events');
    const themeBox = document.createElement('div');
    themeBox.id = 'hackathonThemeContainer';
    themeBox.className = 'hackathon-theme-container';

    themeBox.innerHTML = `
      <div class="hackathon-theme-header">
        <i class="fa-solid fa-lightbulb"></i> Select Your Hackathon Theme (1 of 5) <span class="theme-team-pill"><i class="fa-solid fa-users"></i> Min: 3 | Max: 5</span>:
      </div>
      <div class="hackathon-theme-pills">
        ${HACKATHON_THEMES.map(theme => `
          <button type="button" class="theme-pill ${selectedHackathonTheme === theme ? 'active' : ''}" data-theme="${theme}">
            <i class="fa-solid ${getThemeIcon(theme)}"></i> ${theme}
          </button>
        `).join('')}
      </div>
    `;

    themeBox.querySelectorAll('.theme-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        selectedHackathonTheme = btn.getAttribute('data-theme');
        themeBox.querySelectorAll('.theme-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    gridDay1.appendChild(themeBox);
  }
}

function getThemeIcon(theme) {
  if (theme.includes('Intelligent')) return 'fa-brain';
  if (theme.includes('Sustainability')) return 'fa-leaf';
  if (theme.includes('Everyday')) return 'fa-laptop-code';
  if (theme.includes('FinTech') || theme.includes('Commerce')) return 'fa-chart-line';
  if (theme.includes('Smart Business') || theme.includes('Institution') || theme.includes('Automation')) return 'fa-building-columns';
  return 'fa-code';
}

function handleEventCheckboxToggle(evt, isChecked) {
  if (isChecked) {
    if (evt.id === 'd1_freefire') {
      selectedEventIds.clear();
      selectedEventIds.add('d1_freefire');
    } else {
      if (selectedEventIds.has('d1_freefire')) {
        selectedEventIds.delete('d1_freefire');
      }

      const selectedEventsList = eventCatalog.filter(e => selectedEventIds.has(e.id));
      const day1Count = selectedEventsList.filter(e => e.day === 'day1').length;
      const day2Count = selectedEventsList.filter(e => e.day === 'day2').length;

      if (evt.day === 'day1' && day1Count >= LIMITS.day1Max) {
        showAlert(`You can select a maximum of ${LIMITS.day1Max} events for Day 1.`);
        return renderRegistrationEvents();
      }
      if (evt.day === 'day2' && day2Count >= LIMITS.day2Max) {
        showAlert(`You can select a maximum of ${LIMITS.day2Max} events for Day 2.`);
        return renderRegistrationEvents();
      }

      selectedEventIds.add(evt.id);
    }
  } else {
    selectedEventIds.delete(evt.id);
  }

  renderHackathonThemeContainer();
  updateEventCheckboxStates();
  updateOrderSummary();
}

function updateEventCheckboxStates() {
  const selectedEventsList = eventCatalog.filter(e => selectedEventIds.has(e.id));
  const day1Count = selectedEventsList.filter(e => e.day === 'day1').length;
  const day2Count = selectedEventsList.filter(e => e.day === 'day2').length;

  const c1 = document.getElementById('counter-day1');
  const c2 = document.getElementById('counter-day2');
  if (c1) c1.textContent = `Selected: ${day1Count} / ${LIMITS.day1Max}`;
  if (c2) c2.textContent = `Selected: ${day2Count} / ${LIMITS.day2Max}`;

  const isFreeFireSelected = selectedEventIds.has('d1_freefire');

  document.querySelectorAll('.event-checkbox-card').forEach(card => {
    const evtId = card.getAttribute('data-event-id');
    const evt = eventCatalog.find(e => e.id === evtId);
    const checkbox = card.querySelector('input');

    // Hide Free Fire Tournament strictly when Both Days pass is selected
    if (selectedDay === 'both' && evtId === 'd1_freefire') {
      card.style.display = 'none';
      if (selectedEventIds.has('d1_freefire')) {
        selectedEventIds.delete('d1_freefire');
      }
    } else {
      card.style.display = 'flex';
    }

    checkbox.checked = selectedEventIds.has(evtId);
    card.classList.toggle('selected', selectedEventIds.has(evtId));

    if (isFreeFireSelected) {
      if (evtId !== 'd1_freefire') {
        checkbox.disabled = true;
        card.classList.add('disabled');
      } else {
        checkbox.disabled = false;
        card.classList.remove('disabled');
      }
    } else {
      checkbox.disabled = false;
      card.classList.remove('disabled');

      if (!selectedEventIds.has(evtId)) {
        if (evt.day === 'day1' && day1Count >= LIMITS.day1Max) {
          checkbox.disabled = true;
          card.classList.add('disabled');
        } else if (evt.day === 'day2' && day2Count >= LIMITS.day2Max) {
          checkbox.disabled = true;
          card.classList.add('disabled');
        }
      }
    }
  });
}

function calculateCurrentFee() {
  if (selectedEventIds.has('d1_freefire')) {
    return PRICING.freefire;
  }
  return PRICING[selectedDay] || 250;
}

function handleReviewRegistration() {
  const name = document.getElementById('studentName').value.trim();
  const phone = document.getElementById('studentPhone').value.trim();
  const email = (document.getElementById('studentEmail') ? document.getElementById('studentEmail').value : '').trim();
  const college = document.getElementById('studentCollege').value.trim();

  if (!name) return showAlert('Please enter Student Full Name.', 'warning');
  if (!phone || !/^\d{10}$/.test(phone)) return showAlert('Please enter a valid 10-digit Phone Number.', 'warning');
  if (!email) return showAlert('Please enter Student Email Address.', 'warning');
  if (!college) return showAlert('Please enter College Name.', 'warning');
  if (selectedEventIds.size === 0) return showAlert('Please select at least one event.', 'warning');

  const fee = calculateCurrentFee();
  const selectedEvents = eventCatalog.filter(e => selectedEventIds.has(e.id));

  document.getElementById('sumName').textContent = name;
  document.getElementById('sumPhone').textContent = phone;
  const sumEmailEl = document.getElementById('sumEmail');
  if (sumEmailEl) sumEmailEl.textContent = email;
  document.getElementById('sumCollege').textContent = college;

  let dayText = 'Day 1';
  if (selectedDay === 'day2') dayText = 'Day 2';
  if (selectedDay === 'both') dayText = 'Both (Day 1 & 2)';
  if (selectedEventIds.has('d1_freefire')) dayText += ' (Free Fire Standalone)';

  document.getElementById('sumDay').textContent = dayText;
  document.getElementById('sumFee').textContent = `₹${fee}`;

  const eventsContainer = document.getElementById('sumEventsContainer');
  eventsContainer.innerHTML = '';
  selectedEvents.forEach(evt => {
    const item = document.createElement('div');
    item.className = 's-row';
    const isHackathon = evt.id === 'd1_hackathon';
    const nameLabel = isHackathon ? `• ${evt.name} (Theme: ${selectedHackathonTheme})` : `• ${evt.name}`;
    item.innerHTML = `
      <span class="lbl">${nameLabel}</span>
      <span class="val">${evt.day.toUpperCase()}</span>
    `;
    eventsContainer.appendChild(item);
  });

  openModal('modalSummary');
}

// Double-submit prevention & thread-safe handling for 60+ simultaneous users
async function handleConfirmRegistration() {
  const btnSubmit = document.getElementById('btnConfirmRegister');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Registering...`;

  const name = document.getElementById('studentName').value.trim();
  const phone = document.getElementById('studentPhone').value.trim();
  const email = (document.getElementById('studentEmail') ? document.getElementById('studentEmail').value : '').trim();
  const college = document.getElementById('studentCollege').value.trim();
  const counterName = typeof getActiveSpotCounter === 'function' ? getActiveSpotCounter() : 'Counter 1';

  const payload = {
    name,
    phone,
    email,
    college,
    daySelection: selectedDay,
    selectedEventIds: Array.from(selectedEventIds),
    hackathonTheme: selectedEventIds.has('d1_hackathon') ? selectedHackathonTheme : null,
    counterName
  };

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      closeModal('modalSummary');

      const reg = data.registration;
      document.getElementById('ticketName').textContent = reg.name;
      document.getElementById('ticketCollege').textContent = reg.college;

      let passLabel = 'Day 1';
      if (reg.day_selection === 'day2') passLabel = 'Day 2';
      if (reg.day_selection === 'both') passLabel = 'Both (Day 1 & 2)';

      document.getElementById('ticketDay').textContent = `Pass: ${passLabel} (${reg.selected_events.length} Events)`;
      document.getElementById('ticketFee').textContent = `Fee Paid: ₹${reg.total_fee}`;

      openModal('modalSuccess');
      loadEventCatalog();
      if (typeof LiveSyncEngine !== 'undefined') {
        LiveSyncEngine.triggerImmediateSync();
      }
    } else {
      showAlert(`Registration Failed: ${data.message}`);
    }
  } catch (err) {
    console.error('Error registering:', err);
    showAlert('Server connection error. Please try again.', 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<i class="fa-solid fa-check"></i> Confirm & Submit`;
  }
}

// Wizard Step 3 Submit — shows success inline, no redirect
async function handleWizardFinalSubmit() {
  if (selectedEventIds.size === 0) {
    showAlert('Please select at least one event before submitting.', 'warning');
    return;
  }

  const btn = document.getElementById('btnFinalSubmitRegistration');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registering...'; }

  const name = document.getElementById('studentName').value.trim();
  const phone = document.getElementById('studentPhone').value.trim();
  const email = (document.getElementById('studentEmail') ? document.getElementById('studentEmail').value : '').trim();
  const college = document.getElementById('studentCollege').value.trim();
  const counterName = typeof getActiveSpotCounter === 'function' ? getActiveSpotCounter() : 'Counter 1';

  const payload = {
    name, phone, email, college,
    daySelection: selectedDay,
    selectedEventIds: Array.from(selectedEventIds),
    hackathonTheme: selectedEventIds.has('d1_hackathon') ? selectedHackathonTheme : null,
    counterName
  };

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showRegistrationSuccess(data);
      showToast(`Registration successful! Code: ${data.registration.reg_code}`, 'success');
      if (typeof LiveSyncEngine !== 'undefined') {
        LiveSyncEngine.triggerImmediateSync();
      }
    } else {
      showAlert(`Registration Failed: ${data.message}`, 'error');
    }
  } catch (err) {
    console.error('Error registering:', err);
    showAlert('Server connection error. Please try again.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Confirm & Register'; }
  }
}

function resetRegistrationForm() {
  closeModal('modalSuccess');
  document.getElementById('registrationForm').reset();
  selectedEventIds.clear();
  selectedDay = 'day1';
  document.querySelector('input[name="daySelection"][value="day1"]').checked = true;
  updateDaySelectionUI();
  renderRegistrationEvents();
  showSpotChoiceHub();
}

// 4. MODULE 2: DEDICATED DAY 2 GATE SEARCH PORTAL
function initDay2GateSearch() {
  const searchInput = document.getElementById('day2GateSearchInput');
  const searchBtn = document.getElementById('btnTriggerDay2Search');

  searchBtn.addEventListener('click', performDay2GateSearch);
  searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') performDay2GateSearch();
  });
}

async function performDay2GateSearch() {
  const query = document.getElementById('day2GateSearchInput').value.trim();
  const container = document.getElementById('day2SearchResultContainer');

  if (!query) {
    showAlert('Please enter Student Name, Phone Number, or College Name to search.');
    return;
  }

  container.innerHTML = `<div style="text-align:center; padding:2.5rem; color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><br><br>Searching Day 2 Registration Database...</div>`;

  try {
    const res = await fetch(`/api/registrations?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.success) {
      renderDay2GateResults(data.students, query);
    } else {
      container.innerHTML = `<div class="day2-status-card not-registered"><div class="status-badge-lg not-reg"><i class="fa-solid fa-circle-xmark"></i> SEARCH ERROR</div><p>Failed to query database.</p></div>`;
    }
  } catch (err) {
    console.error('Day 2 Gate Search Error:', err);
    container.innerHTML = `<div class="day2-status-card not-registered"><div class="status-badge-lg not-reg"><i class="fa-solid fa-circle-xmark"></i> CONNECTION ERROR</div><p>Unable to connect to registration server.</p></div>`;
  }
}

function renderDay2GateResults(students, query) {
  const container = document.getElementById('day2SearchResultContainer');
  container.innerHTML = '';

  if (students.length === 0) {
    container.innerHTML = `
      <div class="day2-status-card not-registered">
        <div class="status-header-row">
          <div class="status-badge-lg not-reg blink-text">
            <i class="fa-solid fa-circle-xmark"></i> NO SPOT REGISTRATION RECORD FOUND
          </div>
        </div>
        <p style="color:#dc2626; font-size:0.98rem; margin-top:0.5rem; font-weight:700;">
          No student found matching <strong>"${query}"</strong> in the spot registration database.
        </p>
        <div style="margin-top:1rem; font-size:0.88rem; color:#475569; background:#f8fafc; padding:0.85rem; border-radius:10px; border:1px solid #cbd5e1; font-weight:600;">
          <i class="fa-solid fa-circle-info"></i> Please direct this student to the <strong>Spot Registration Kiosk</strong> to register for Day 2 events.
        </div>
      </div>
    `;
    return;
  }

  students.forEach(st => {
    const isRegisteredForDay2 = (st.day_selection === 'both' || st.day_selection === 'day2');
    const day2EventsList = st.events.filter(e => e.event_day === 'day2');

    let passLabel = 'Day 1 Pass';
    if (st.day_selection === 'day2') passLabel = 'Day 2 Pass';
    if (st.day_selection === 'both') passLabel = 'Both (Day 1 & 2) Pass';

    if (isRegisteredForDay2) {
      const card = document.createElement('div');
      card.className = 'day2-status-card registered';

      const eventsPills = day2EventsList.map(e => `<span class="evt-pill-tag"><i class="fa-solid fa-check"></i> ${e.event_name}</span>`).join(' ');

      card.innerHTML = `
        <div class="status-header-row">
          <div class="status-badge-lg reg blink-text">
            <i class="fa-solid fa-circle-check"></i> REGISTERED FOR DAY 2 EVENTS
          </div>
          <span style="font-weight:800; font-size:0.9rem; color:#059669;">VERIFIED GATE PASS</span>
        </div>

        <div class="student-info-grid">
          <div class="info-box">
            <div class="lbl">Student Name</div>
            <div class="val">${st.name}</div>
          </div>
          <div class="info-box">
            <div class="lbl">Phone Number</div>
            <div class="val">${st.phone}</div>
          </div>
          <div class="info-box">
            <div class="lbl">College Name</div>
            <div class="val">${st.college}</div>
          </div>
          <div class="info-box">
            <div class="lbl">Pass Selection</div>
            <div class="val">${passLabel}</div>
          </div>
          <div class="info-box">
            <div class="lbl">Fee Paid</div>
            <div class="val" style="color:#059669;">₹${st.total_fee}</div>
          </div>
        </div>

        <div class="day2-registered-events-box">
          <h4><i class="fa-solid fa-list-check"></i> Registered Day 2 Events (${day2EventsList.length}):</h4>
          <div class="events-tags-list">
            ${eventsPills || '<span style="color:#64748b; font-size:0.85rem; font-weight:600;">Day 2 General Access</span>'}
          </div>
        </div>
      `;

      container.appendChild(card);
    } else {
      const card = document.createElement('div');
      card.className = 'day2-status-card not-registered';

      card.innerHTML = `
        <div class="status-header-row">
          <div class="status-badge-lg not-reg blink-text">
            <i class="fa-solid fa-circle-xmark"></i> NOT REGISTERED FOR DAY 2 (DAY 1 ONLY PASS)
          </div>
        </div>

        <div class="student-info-grid">
          <div class="info-box">
            <div class="lbl">Student Name</div>
            <div class="val">${st.name}</div>
          </div>
          <div class="info-box">
            <div class="lbl">Phone Number</div>
            <div class="val">${st.phone}</div>
          </div>
          <div class="info-box">
            <div class="lbl">College Name</div>
            <div class="val">${st.college}</div>
          </div>
          <div class="info-box">
            <div class="lbl">Pass Selection</div>
            <div class="val" style="color:#dc2626;">Day 1 Only Pass (₹${st.total_fee})</div>
          </div>
        </div>

        <div style="font-size:0.9rem; color:#991b1b; background:#fef2f2; padding:1rem; border-radius:10px; border:1px solid #fecaca; font-weight:600;">
          <i class="fa-solid fa-triangle-exclamation"></i> <strong>Gate Notice:</strong> This student registered for <strong>Day 1 only</strong> on Day 1. They have <strong>not</strong> registered or paid for Day 2 events. Please direct them to the Spot Registration Kiosk to register for Day 2.
        </div>
      `;

      container.appendChild(card);
    }
  });
}

// 5. MODULE 3: COORDINATOR PORTAL & LOGIN
function initCoordinatorLogin() {
  const btnLogin = document.getElementById('btnLoginSubmit');
  const btnLogout = document.getElementById('btnLogoutCoordinator');
  const inputEmail = document.getElementById('loginEmail');
  const inputPass = document.getElementById('loginPassword');

  if (btnLogin) btnLogin.addEventListener('click', handleCoordinatorLogin);
  if (btnLogout) btnLogout.addEventListener('click', handleCoordinatorLogout);

  if (inputEmail) {
    inputEmail.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleCoordinatorLogin();
    });
  }
  if (inputPass) {
    inputPass.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleCoordinatorLogin();
    });
  }
}

async function handleCoordinatorLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const btnLogin = document.getElementById('btnLoginSubmit');

  if (!email || !password) {
    showAlert('Please enter username and password.', 'warning');
    return;
  }

  if (btnLogin) {
    btnLogin.disabled = true;
    btnLogin.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...`;
  }

  try {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleKey: 'coordinator_portal',
        username: email,
        password: password
      })
    });

    const data = await res.json();
    if (data.success) {
      isCoordinatorLoggedIn = true;
      sessionStorage.setItem('techraga_auth_coordinator_portal', 'true');
      if (data.role === 'ADMIN' || data.moduleKey === 'admin_master') {
        sessionStorage.setItem('techraga_auth_admin_master', 'true');
      }

      // Determine role & assigned event
      if (data.role === 'EVENT_COORDINATOR' || data.category === 'EVENT') {
        loggedInCoordinatorEventKey = data.moduleKey;
        loggedInCoordinatorEventName = data.moduleName;
        loggedInCoordinatorUsername = data.username;
        loggedInCoordinatorRole = 'EVENT_COORDINATOR';
      } else {
        loggedInCoordinatorEventKey = 'ALL';
        loggedInCoordinatorEventName = 'Master Coordinator';
        loggedInCoordinatorUsername = data.username;
        loggedInCoordinatorRole = 'MASTER';
      }

      sessionStorage.setItem('techraga_coord_event_key', loggedInCoordinatorEventKey);
      sessionStorage.setItem('techraga_coord_event_name', loggedInCoordinatorEventName);
      sessionStorage.setItem('techraga_coord_user', loggedInCoordinatorUsername);
      sessionStorage.setItem('techraga_coord_role', loggedInCoordinatorRole);

      updateCoordinatorIdentityBadge();

      document.getElementById('coordinatorLoginBox').style.display = 'none';
      document.getElementById('coordinatorDashboardBox').style.display = 'block';

      // Load Catalog and Route directly to assigned event
      await loadEventCatalog();
      await loadAdminDashboard();

      if (loggedInCoordinatorEventKey === 'd1_freefire') {
        switchAdminPanel('freefire');
      } else if (loggedInCoordinatorEventKey && loggedInCoordinatorEventKey !== 'ALL') {
        const targetEvt = eventCatalog.find(e => e.id === loggedInCoordinatorEventKey);
        if (targetEvt) {
          activeAdminDayTab = targetEvt.day;
          const tab1 = document.getElementById('tabSelectDay1');
          const tab2 = document.getElementById('tabSelectDay2');
          if (tab1) tab1.classList.toggle('active', activeAdminDayTab === 'day1');
          if (tab2) tab2.classList.toggle('active', activeAdminDayTab === 'day2');
          renderSidebarDynamicEvents();
        }
        await selectCoordinatorEvent(loggedInCoordinatorEventKey);
      } else {
        switchAdminPanel('dashboard');
      }
    } else {
      showAlert(data.message || 'Invalid username or password.', 'error');
    }
  } catch (err) {
    console.error('Coordinator login error:', err);
    showAlert('Server connection error. Please try again.', 'error');
  } finally {
    if (btnLogin) {
      btnLogin.disabled = false;
      btnLogin.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Login to Event Desk`;
    }
  }
}

function updateCoordinatorIdentityBadge() {
  const badgeEl = document.getElementById('coordActiveUserBadge');
  const textEl = document.getElementById('coordActiveUserBadgeText');
  if (!badgeEl) return;

  if (isCoordinatorLoggedIn && loggedInCoordinatorEventName) {
    badgeEl.style.display = 'inline-flex';
    if (loggedInCoordinatorRole === 'EVENT_COORDINATOR' && loggedInCoordinatorEventKey !== 'ALL') {
      textEl.textContent = `${loggedInCoordinatorEventName} (${loggedInCoordinatorUsername})`;
    } else {
      textEl.textContent = `Master Coordinator (${loggedInCoordinatorUsername || 'Admin'})`;
    }
  } else {
    badgeEl.style.display = 'none';
  }
}

function handleCoordinatorLogout() {
  isCoordinatorLoggedIn = false;
  loggedInCoordinatorEventKey = null;
  loggedInCoordinatorEventName = null;
  loggedInCoordinatorUsername = null;
  loggedInCoordinatorRole = null;

  sessionStorage.removeItem('techraga_auth_coordinator_portal');
  sessionStorage.removeItem('techraga_coord_event_key');
  sessionStorage.removeItem('techraga_coord_event_name');
  sessionStorage.removeItem('techraga_coord_user');
  sessionStorage.removeItem('techraga_coord_role');

  updateCoordinatorIdentityBadge();

  document.getElementById('coordinatorDashboardBox').style.display = 'none';
  document.getElementById('coordinatorLoginBox').style.display = 'block';
  const loginPass = document.getElementById('loginPassword');
  if (loginPass) loginPass.value = '';
}

// 6. ADMIN DASHBOARD & SIDEBAR
function initAdminDashboard() {
  document.getElementById('btnRefreshStats').addEventListener('click', loadAdminDashboard);

  document.getElementById('navAdminDashboard').addEventListener('click', () => {
    switchAdminPanel('dashboard');
  });

  const tabDay1 = document.getElementById('tabSelectDay1');
  const tabDay2 = document.getElementById('tabSelectDay2');

  tabDay1.addEventListener('click', () => {
    activeAdminDayTab = 'day1';
    tabDay1.classList.add('active');
    tabDay2.classList.remove('active');
    renderSidebarDynamicEvents();
  });

  tabDay2.addEventListener('click', () => {
    activeAdminDayTab = 'day2';
    tabDay2.classList.add('active');
    tabDay1.classList.remove('active');
    renderSidebarDynamicEvents();
  });
}

function renderSidebarDynamicEvents() {
  const container = document.getElementById('sidebarDynamicEvents');
  const title = document.getElementById('sidebarDayListTitle');
  if (!container) return;
  container.innerHTML = '';

  const day1Events = eventCatalog.filter(evt => evt.day === 'day1' && !evt.is_standalone);
  const day2Events = eventCatalog.filter(evt => evt.day === 'day2' && !evt.is_standalone);

  const tabDay1 = document.getElementById('tabSelectDay1');
  const tabDay2 = document.getElementById('tabSelectDay2');
  if (tabDay1) tabDay1.innerHTML = `<i class="fa-solid fa-1"></i> Day 1 (${day1Events.length})`;
  if (tabDay2) tabDay2.innerHTML = `<i class="fa-solid fa-2"></i> Day 2 (${day2Events.length})`;

  const isDay1 = activeAdminDayTab === 'day1';
  const filteredEvents = isDay1 ? day1Events : day2Events;
  if (title) {
    title.innerHTML = `<span><i class="fa-solid fa-list-check"></i> ${isDay1 ? `DAY 1 EVENTS (${day1Events.length})` : `DAY 2 EVENTS (${day2Events.length})`}</span>`;
  }

  const isRestrictedSingleEvent = Boolean(
    loggedInCoordinatorEventKey &&
    loggedInCoordinatorEventKey !== 'ALL' &&
    loggedInCoordinatorRole === 'EVENT_COORDINATOR'
  );

  filteredEvents.forEach(evt => {
    const isThisAssignedEvent = evt.id === loggedInCoordinatorEventKey;
    const isLocked = isRestrictedSingleEvent && !isThisAssignedEvent;

    const btn = document.createElement('button');
    btn.className = `sidebar-item ${currentCoordinatorEventId === evt.id ? 'active' : ''} ${isLocked ? 'sidebar-item-locked' : (isThisAssignedEvent ? 'sidebar-item-unlocked' : '')}`;
    btn.setAttribute('data-event-id', evt.id);

    if (isLocked) {
      btn.setAttribute('title', `Access Locked: You are assigned as Coordinator for ${loggedInCoordinatorEventName || 'another event'}.`);
      btn.innerHTML = `
        <span style="display:flex; align-items:center; gap:0.35rem;">
          <i class="fa-solid fa-lock" style="color:#94a3b8; font-size:0.75rem;"></i>
          <span>${evt.name}</span>
        </span>
        <span class="badge-count" style="background:#e2e8f0; color:#64748b;">${evt.registered_count || 0}</span>
      `;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        showAlert(`🔒 Access Restricted:\nYou are logged in as the Coordinator for "${loggedInCoordinatorEventName}".\n\nOnly your assigned event desk is accessible. Other event desks are locked.`);
      });
    } else {
      // Unlocked / Active Event
      const unlockedIcon = isThisAssignedEvent ? '<i class="fa-solid fa-lock-open" style="color:#059669; font-size:0.75rem;"></i> ' : '';
      btn.innerHTML = `
        <span style="display:flex; align-items:center; gap:0.35rem;">
          ${unlockedIcon}
          <span>${evt.name}</span>
        </span>
        <span class="badge-count">${evt.registered_count || 0}</span>
      `;

      btn.addEventListener('click', () => {
        selectCoordinatorEvent(evt.id);
      });
    }

    container.appendChild(btn);
  });

  // Also lock/unlock Dashboard Overview and Free Fire sidebar items if restricted
  const navOverview = document.getElementById('navAdminDashboard');
  const navFf = document.getElementById('navFreeFireDashboard');

  if (isRestrictedSingleEvent) {
    if (loggedInCoordinatorEventKey === 'd1_freefire') {
      if (navOverview) {
        navOverview.classList.add('sidebar-item-locked');
        navOverview.title = 'Access restricted to Free Fire Esports Desk';
      }
      if (navFf) {
        navFf.classList.remove('sidebar-item-locked');
        navFf.classList.add('sidebar-item-unlocked');
      }
    } else {
      if (navOverview) {
        navOverview.classList.add('sidebar-item-locked');
        navOverview.title = `Access restricted to ${loggedInCoordinatorEventName}`;
      }
      if (navFf) {
        navFf.classList.add('sidebar-item-locked');
        navFf.title = `Access restricted to ${loggedInCoordinatorEventName}`;
      }
    }
  } else {
    if (navOverview) {
      navOverview.classList.remove('sidebar-item-locked');
      navOverview.removeAttribute('title');
    }
    if (navFf) {
      navFf.classList.remove('sidebar-item-locked');
      navFf.removeAttribute('title');
    }
  }
}

async function loadAdminDashboard() {
  try {
    const [statsRes, eventsRes] = await Promise.all([
      fetch('/api/stats'),
      fetch('/api/events')
    ]);

    const statsData = await statsRes.json();
    const eventsData = await eventsRes.json();

    if (statsData.success) {
      const s = statsData.stats;
      const elTotal = document.getElementById('kpiTotalStudents');
      if (elTotal) elTotal.textContent = s.totalStudents;
      const elDay1 = document.getElementById('kpiDay1Students');
      if (elDay1) elDay1.textContent = s.day1Count;
      const elDay2 = document.getElementById('kpiDay2Students');
      if (elDay2) elDay2.textContent = s.day2Count;
      const elBoth = document.getElementById('kpiBothDaysStudents');
      if (elBoth) elBoth.textContent = s.bothDaysCount;
    }

    if (eventsData.success) {
      eventCatalog = eventsData.events;
      renderSidebarDynamicEvents();
    }

    // Always pre-fetch Free Fire & Admin Edit Requests data so dashboard is up-to-date
    loadUnassignedSoloPlayers();
    loadFreeFireTeams();
    loadAdminEditRequests();
    loadAdminEventChangeRequests();
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

function switchAdminPanel(panelType) {
  const isRestrictedSingleEvent = Boolean(
    loggedInCoordinatorEventKey &&
    loggedInCoordinatorEventKey !== 'ALL' &&
    loggedInCoordinatorRole === 'EVENT_COORDINATOR'
  );

  if (isRestrictedSingleEvent) {
    if (panelType === 'dashboard' && loggedInCoordinatorEventKey !== 'd1_freefire') {
      showAlert(`🔒 You are logged in as Coordinator for "${loggedInCoordinatorEventName}".\nDirecting you to your event desk.`);
      selectCoordinatorEvent(loggedInCoordinatorEventKey);
      return;
    }
    if (panelType === 'freefire' && loggedInCoordinatorEventKey !== 'd1_freefire') {
      showAlert(`🔒 Access Restricted:\nYou are assigned to "${loggedInCoordinatorEventName}". Free Fire Esports Desk is locked.`);
      return;
    }
    if (panelType === 'coordinator' && loggedInCoordinatorEventKey === 'd1_freefire') {
      showAlert(`🔒 You are logged in as Free Fire Esports Coordinator.`);
      return;
    }
  }

  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(s => s.classList.remove('active'));

  if (panelType === 'dashboard') {
    document.getElementById('adminPanelDashboard').classList.add('active');
    document.getElementById('navAdminDashboard').classList.add('active');
    loadAdminEditRequests();
    loadAdminEventChangeRequests();
  } else if (panelType === 'eventIssue') {
    const p = document.getElementById('adminPanelEventIssue');
    if (p) p.classList.add('active');
    const navBtn = document.getElementById('navEventIssueManagement');
    if (navBtn) navBtn.classList.add('active');
    loadEventIssueParticipants();
  } else if (panelType === 'coordinator') {
    document.getElementById('adminPanelCoordinator').classList.add('active');
  } else if (panelType === 'freefire') {
    document.getElementById('adminPanelFreeFire').classList.add('active');
    document.getElementById('navFreeFireDashboard').classList.add('active');
    loadUnassignedSoloPlayers();
    loadFreeFireTeams();
  }
}

// 7. EVENT COORDINATOR DESK (PER-EVENT VIEW, PARTICIPANTS LIST & DYNAMIC TEAM FORMATION)
function initCoordinatorDesk() {
  const searchInput = document.getElementById('eventSearchInput');
  if (searchInput) searchInput.addEventListener('input', filterCoordinatorTable);

  const clearSearch = document.getElementById('clearEventSearch');
  if (clearSearch) {
    clearSearch.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      filterCoordinatorTable();
    });
  }

  // Subtab Switcher
  const btnSubtabPart = document.getElementById('btnCoordSubtabParticipants');
  const btnSubtabTeams = document.getElementById('btnCoordSubtabTeams');

  if (btnSubtabPart) {
    btnSubtabPart.addEventListener('click', () => switchCoordinatorSubtab('participants'));
  }
  if (btnSubtabTeams) {
    btnSubtabTeams.addEventListener('click', () => switchCoordinatorSubtab('teams'));
  }

  // Team Formation Buttons & Modals
  const btnCreateTeam = document.getElementById('btnCreateEventTeam');
  if (btnCreateTeam) {
    btnCreateTeam.addEventListener('click', openCreateEventTeamModal);
  }

  const closeConfirmModal = document.getElementById('closeConfirmEventTeamModal');
  if (closeConfirmModal) {
    closeConfirmModal.addEventListener('click', () => closeModal('modalConfirmEventTeam'));
  }

  const btnCancelConfirm = document.getElementById('btnCancelConfirmEventTeam');
  if (btnCancelConfirm) {
    btnCancelConfirm.addEventListener('click', () => closeModal('modalConfirmEventTeam'));
  }

  const btnSubmitConfirm = document.getElementById('btnSubmitConfirmEventTeam');
  if (btnSubmitConfirm) {
    btnSubmitConfirm.addEventListener('click', handleConfirmCreateEventTeam);
  }

  // Formed Teams Search
  const teamsSearchInput = document.getElementById('coordTeamsSearchInput');
  if (teamsSearchInput) {
    teamsSearchInput.addEventListener('input', renderCoordinatorFormedTeams);
  }

  const clearTeamsSearch = document.getElementById('clearCoordTeamsSearch');
  if (clearTeamsSearch) {
    clearTeamsSearch.addEventListener('click', () => {
      if (teamsSearchInput) teamsSearchInput.value = '';
      renderCoordinatorFormedTeams();
    });
  }

  // Edit Request Modal Listeners
  const closeEditReq = document.getElementById('closeEditRequestModal');
  if (closeEditReq) closeEditReq.addEventListener('click', () => closeModal('modalEditRequest'));

  const cancelEditReq = document.getElementById('btnCancelEditRequest');
  if (cancelEditReq) cancelEditReq.addEventListener('click', () => closeModal('modalEditRequest'));

  const submitEditReq = document.getElementById('btnSubmitEditRequest');
  if (submitEditReq) submitEditReq.addEventListener('click', handleSubmitEditRequest);
}

function switchCoordinatorSubtab(subtab) {
  const btnPart = document.getElementById('btnCoordSubtabParticipants');
  const btnTeams = document.getElementById('btnCoordSubtabTeams');
  const panelPart = document.getElementById('coordSubtabParticipantsContent');
  const panelTeams = document.getElementById('coordSubtabTeamsContent');

  if (subtab === 'participants') {
    if (btnPart) btnPart.classList.add('active');
    if (btnTeams) btnTeams.classList.remove('active');
    if (panelPart) panelPart.style.display = 'block';
    if (panelTeams) panelTeams.style.display = 'none';
  } else if (subtab === 'teams') {
    if (btnPart) btnPart.classList.remove('active');
    if (btnTeams) btnTeams.classList.add('active');
    if (panelPart) panelPart.style.display = 'none';
    if (panelTeams) panelTeams.style.display = 'block';
    renderCoordinatorFormedTeams();
  }
}

window.selectCoordinatorEvent = async function (eventId) {
  // Permission guard
  if (
    loggedInCoordinatorEventKey &&
    loggedInCoordinatorEventKey !== 'ALL' &&
    loggedInCoordinatorRole === 'EVENT_COORDINATOR' &&
    loggedInCoordinatorEventKey !== eventId
  ) {
    showAlert(`🔒 Access Restricted:\nYou are logged in as the Coordinator for "${loggedInCoordinatorEventName}".\n\nAccess to other event desks is locked.`);
    return;
  }

  currentCoordinatorEventId = eventId;
  selectedEventTeamStudentIds.clear();

  const evt = eventCatalog.find(e => e.id === eventId);
  if (!evt) return;

  const isTeamEvent = (evt.max_participants || 1) > 1;

  activeAdminDayTab = evt.day;
  document.getElementById('tabSelectDay1').classList.toggle('active', activeAdminDayTab === 'day1');
  document.getElementById('tabSelectDay2').classList.toggle('active', activeAdminDayTab === 'day2');

  renderSidebarDynamicEvents();
  switchAdminPanel('coordinator');

  document.getElementById('coordEventTitle').textContent = evt.name;
  document.getElementById('coordEventCategory').textContent = `${evt.category} • Min: ${evt.min_participants || 1} | Max: ${evt.max_participants || 1}`;
  document.getElementById('coordEventDayBadge').textContent = evt.day.toUpperCase();

  // Toggle subtab switcher & team panels based on event type (Solo vs Team)
  const subtabSwitcher = document.getElementById('coordSubtabSwitcher');
  const selectedPanel = document.getElementById('coordSelectedPanel');
  const actionBarCard = document.getElementById('coordActionBarCard');
  const thSelect = document.querySelector('.col-coord-select');
  const thTeamStatus = document.querySelector('.col-coord-team-status');

  if (subtabSwitcher) subtabSwitcher.style.display = isTeamEvent ? 'flex' : 'none';
  if (selectedPanel) selectedPanel.style.display = isTeamEvent ? 'block' : 'none';
  if (actionBarCard) actionBarCard.style.display = isTeamEvent ? 'flex' : 'none';
  if (thSelect) thSelect.style.display = isTeamEvent ? '' : 'none';
  if (thTeamStatus) thTeamStatus.style.display = isTeamEvent ? '' : 'none';

  const searchInput = document.getElementById('eventSearchInput');
  if (searchInput) searchInput.value = '';

  switchCoordinatorSubtab('participants');

  const promises = [loadEventParticipants(eventId)];
  if (isTeamEvent) {
    promises.push(loadEventTeams(eventId));
  } else {
    currentEventTeams = [];
    const badge = document.getElementById('coordTeamsCountBadge');
    if (badge) badge.textContent = '0';
  }
  await Promise.all(promises);
};

async function loadEventParticipants(eventId) {
  try {
    const res = await fetch(`/api/registrations?eventId=${eventId}`);
    const data = await res.json();

    if (data.success) {
      currentEventStudents = data.students;
      document.getElementById('coordEventCount').textContent = currentEventStudents.length;
      updateEventTeamSelectionUI();
      filterCoordinatorTable();
    }
  } catch (err) {
    console.error('Error loading participants:', err);
  }
}

async function loadEventTeams(eventId) {
  try {
    const res = await fetch(`/api/coordinator/event-teams?eventId=${eventId}`);
    const data = await res.json();

    if (data.success) {
      currentEventTeams = data.teams || [];
      const badge = document.getElementById('coordTeamsCountBadge');
      if (badge) badge.textContent = currentEventTeams.length;
      renderCoordinatorFormedTeams();
    }
  } catch (err) {
    console.error('Error loading event teams:', err);
  }
}

function updateEventTeamSelectionUI() {
  const evt = eventCatalog.find(e => e.id === currentCoordinatorEventId) || { min_participants: 1, max_participants: 1 };
  const isTeamEvent = (evt.max_participants || 1) > 1;
  const min = evt.min_participants || 1;
  const max = evt.max_participants || 1;
  const count = selectedEventTeamStudentIds.size;

  const subtabSwitcher = document.getElementById('coordSubtabSwitcher');
  const selectedPanel = document.getElementById('coordSelectedPanel');
  const actionBarCard = document.getElementById('coordActionBarCard');
  const thSelect = document.querySelector('.col-coord-select');
  const thTeamStatus = document.querySelector('.col-coord-team-status');

  if (subtabSwitcher) subtabSwitcher.style.display = isTeamEvent ? 'flex' : 'none';
  if (selectedPanel) selectedPanel.style.display = isTeamEvent ? 'block' : 'none';
  if (actionBarCard) actionBarCard.style.display = isTeamEvent ? 'flex' : 'none';
  if (thSelect) thSelect.style.display = isTeamEvent ? '' : 'none';
  if (thTeamStatus) thTeamStatus.style.display = isTeamEvent ? '' : 'none';

  if (!isTeamEvent) return;

  const chipCountEl = document.getElementById('coordSelectedChipCount');
  const maxBadgeEl = document.getElementById('coordEventMaxBadge');
  const selectedCountEl = document.getElementById('coordSelectedCount');
  const chipsListEl = document.getElementById('coordSelectedChipsList');
  const ruleHintEl = document.getElementById('coordTeamRuleHint');
  const valMsgEl = document.getElementById('coordValidationMsg');
  const btnCreate = document.getElementById('btnCreateEventTeam');
  const unassignedBadge = document.getElementById('coordUnassignedCountBadge');

  if (chipCountEl) chipCountEl.textContent = count;
  if (maxBadgeEl) maxBadgeEl.textContent = max;
  if (selectedCountEl) selectedCountEl.textContent = count;

  const unassignedCount = currentEventStudents.filter(s => !s.team_id).length;
  if (unassignedBadge) unassignedBadge.textContent = unassignedCount;

  // Render Selected Chips
  if (chipsListEl) {
    if (count === 0) {
      chipsListEl.innerHTML = `<span class="no-chips-text">No participants selected yet. Select checkboxes below to form a team.</span>`;
    } else {
      const selectedStudents = currentEventStudents.filter(s => selectedEventTeamStudentIds.has(Number(s.id)));
      chipsListEl.innerHTML = selectedStudents.map(st => `
        <div class="whatsapp-chip">
          <span><strong>${st.name}</strong> (${st.college})</span>
          <button type="button" class="btn-remove-chip" onclick="window.handleCoordinatorParticipantToggle(${st.id}, false)">&times;</button>
        </div>
      `).join('');
    }
  }

  // Dynamic Validation & Button Activation
  if (btnCreate && valMsgEl && ruleHintEl) {
    if (count === 0) {
      valMsgEl.textContent = `Select between ${min} and ${max} participants to form a team`;
      valMsgEl.style.color = '#64748b';
      btnCreate.disabled = true;
      btnCreate.classList.remove('active');
      ruleHintEl.textContent = `Min: ${min} | Max: ${max} participants required`;
    } else if (count < min) {
      valMsgEl.textContent = `⚠️ Minimum ${min} participant${min > 1 ? 's' : ''} required (${count}/${min})`;
      valMsgEl.style.color = '#dc2626';
      btnCreate.disabled = true;
      btnCreate.classList.remove('active');
      ruleHintEl.textContent = `Need ${min - count} more to reach minimum requirement (${count}/${min})`;
    } else if (count >= min && count <= max) {
      valMsgEl.textContent = `✔ Ready to form team (${count} selected, max ${max})`;
      valMsgEl.style.color = '#059669';
      btnCreate.disabled = false;
      btnCreate.classList.add('active');
      ruleHintEl.textContent = count === max ? 'Maximum participant capacity reached' : `Ready to create team (or select up to ${max})`;
    } else {
      valMsgEl.textContent = `⚠️ Exceeded maximum limit of ${max}`;
      valMsgEl.style.color = '#dc2626';
      btnCreate.disabled = true;
      btnCreate.classList.remove('active');
    }
  }
}

window.handleCoordinatorParticipantToggle = function (studentId, isChecked) {
  const evt = eventCatalog.find(e => e.id === currentCoordinatorEventId) || { min_participants: 1, max_participants: 1 };
  const max = evt.max_participants || 1;
  if (max <= 1) return; // Solo event, no team creation

  const numId = Number(studentId);

  if (isChecked) {
    if (selectedEventTeamStudentIds.size >= max && !selectedEventTeamStudentIds.has(numId)) {
      showAlert(`Maximum ${max} participant${max > 1 ? 's' : ''} allowed for ${evt.name}.`);
      filterCoordinatorTable();
      return;
    }
    selectedEventTeamStudentIds.add(numId);
  } else {
    selectedEventTeamStudentIds.delete(numId);
  }

  updateEventTeamSelectionUI();
  filterCoordinatorTable();
};

function filterCoordinatorTable() {
  const query = document.getElementById('eventSearchInput').value.trim().toLowerCase();
  const tbody = document.getElementById('eventStudentsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const evt = eventCatalog.find(e => e.id === currentCoordinatorEventId) || { min_participants: 1, max_participants: 1 };
  const isTeamEvent = (evt.max_participants || 1) > 1;
  const max = evt.max_participants || 1;
  const maxReached = selectedEventTeamStudentIds.size >= max;

  const thSelect = document.querySelector('.col-coord-select');
  const thTeamStatus = document.querySelector('.col-coord-team-status');
  if (thSelect) thSelect.style.display = isTeamEvent ? '' : 'none';
  if (thTeamStatus) thTeamStatus.style.display = isTeamEvent ? '' : 'none';

  const filtered = currentEventStudents.filter(st => {
    if (!query) return true;
    return (
      (st.name || '').toLowerCase().includes(query) ||
      (st.phone || '').includes(query) ||
      (st.college || '').toLowerCase().includes(query) ||
      (st.email || '').toLowerCase().includes(query) ||
      (st.reg_code || '').toLowerCase().includes(query)
    );
  });

  const countLbl = document.getElementById('eventSearchCount');
  if (countLbl) {
    countLbl.textContent = `Showing ${filtered.length} of ${currentEventStudents.length} participants`;
  }

  const colSpanCount = isTeamEvent ? 9 : 7;
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colSpanCount}" style="text-align:center; padding: 2rem; color: #64748b;">No matching registered participants found.</td></tr>`;
    return;
  }

  filtered.forEach((st, idx) => {
    const tr = document.createElement('tr');

    const registeredEvents = Array.isArray(st.events) ? st.events : [];
    const currentEvtObj = registeredEvents.find(e => e.event_id === currentCoordinatorEventId);
    const isCurrentEvtCompleted = currentEvtObj && currentEvtObj.event_status === 'COMPLETED';

    const inBtnHtml = `<button type="button" class="btn-action-sm ${isCurrentEvtCompleted ? 'active-green' : ''}" data-action="ENTER_EVENT" data-student-id="${st.id}" data-event-id="${currentCoordinatorEventId}" ${isCurrentEvtCompleted ? 'disabled' : ''} onclick="window.handleCoordinatorAction('${st.id}', 'ENTER_EVENT', '${currentCoordinatorEventId}')"><i class="fa-solid fa-right-to-bracket"></i> ${isCurrentEvtCompleted ? '✔ In' : 'In'}</button>`;
    const foodBtnHtml = `<button type="button" class="btn-action-sm ${st.food_given ? 'active-green' : ''}" data-action="ISSUE_FOOD" data-student-id="${st.id}" ${st.food_given ? 'disabled' : ''} onclick="window.handleCoordinatorAction('${st.id}', 'ISSUE_FOOD')"><i class="fa-solid fa-utensils"></i> ${st.food_given ? '✔ Food Token' : 'Food Token'}</button>`;
    const tagBtnHtml = `<button type="button" class="btn-action-sm ${st.tag_given ? 'active-green' : ''}" data-action="ISSUE_TAG" data-student-id="${st.id}" ${st.tag_given ? 'disabled' : ''} onclick="window.handleCoordinatorAction('${st.id}', 'ISSUE_TAG')"><i class="fa-solid fa-id-badge"></i> ${st.tag_given ? '✔ Tag Given' : 'Tag Given'}</button>`;

    const actionsHtml = `
      <div class="linear-actions-flex">
        ${inBtnHtml}
        ${foodBtnHtml}
        ${tagBtnHtml}
      </div>
    `;

    const editBtnHtml = `
      <button type="button" class="btn-edit-sm btn-req-edit" data-student-id="${st.id}" onclick="window.handleOpenEditRequestModal('${st.id}')">
        <i class="fa-solid fa-pen"></i> ✏️ Edit
      </button>
    `;

    if (isTeamEvent) {
      // Team Assignment status & Checkbox
      const isAssigned = Boolean(st.team_id);
      const isSelected = selectedEventTeamStudentIds.has(Number(st.id));
      const isCbDisabled = isAssigned || (maxReached && !isSelected);

      const checkboxHtml = isAssigned
        ? '<i class="fa-solid fa-lock" style="color:#94a3b8;" title="Already in a team"></i>'
        : `<input type="checkbox" class="coord-student-checkbox" value="${st.id}" ${isSelected ? 'checked' : ''} ${isCbDisabled ? 'disabled' : ''} onchange="window.handleCoordinatorParticipantToggle(${st.id}, this.checked)">`;

      const teamStatusHtml = isAssigned
        ? `<span class="badge-team-assigned"><i class="fa-solid fa-users"></i> ${st.team_code || 'TEAM'} (${st.team_name || 'Assigned'})</span>`
        : `<span class="badge-team-unassigned"><i class="fa-solid fa-user-clock"></i> Unassigned</span>`;

      tr.innerHTML = `
        <td style="text-align:center;">${checkboxHtml}</td>
        <td style="text-align:center; font-weight:700;">${idx + 1}</td>
        <td>
          <strong style="color:#0f172a; white-space:nowrap; display:block;">${st.name}</strong>
          <span style="font-size:0.75rem; color:#64748b; font-weight:700;">${st.reg_code}</span>
        </td>
        <td><span style="color:#334155; white-space:nowrap;">${st.phone}</span></td>
        <td><span style="color:#334155;">${st.college}</span></td>
        <td><span class="email-box-pill"><i class="fa-solid fa-envelope" style="color:#0284c7;"></i> ${st.email || 'N/A'}</span></td>
        <td>${teamStatusHtml}</td>
        <td>${actionsHtml}</td>
        <td style="text-align:center;">${editBtnHtml}</td>
      `;
    } else {
      // Solo / individual event - Clean table without checkboxes or team status
      tr.innerHTML = `
        <td style="text-align:center; font-weight:700;">${idx + 1}</td>
        <td>
          <strong style="color:#0f172a; white-space:nowrap; display:block;">${st.name}</strong>
          <span style="font-size:0.75rem; color:#64748b; font-weight:700;">${st.reg_code}</span>
        </td>
        <td><span style="color:#334155; white-space:nowrap;">${st.phone}</span></td>
        <td><span style="color:#334155;">${st.college}</span></td>
        <td><span class="email-box-pill"><i class="fa-solid fa-envelope" style="color:#0284c7;"></i> ${st.email || 'N/A'}</span></td>
        <td>${actionsHtml}</td>
        <td style="text-align:center;">${editBtnHtml}</td>
      `;
    }

    tbody.appendChild(tr);
  });
}

window.openCreateEventTeamModal = function () {
  const evt = eventCatalog.find(e => e.id === currentCoordinatorEventId) || { min_participants: 1, max_participants: 1 };
  const min = evt.min_participants || 1;
  const max = evt.max_participants || 1;
  const count = selectedEventTeamStudentIds.size;

  if (max <= 1) {
    showAlert(`Team creation is not applicable for ${evt.name}.`);
    return;
  }

  if (count < min) {
    showAlert(`Minimum ${min} participant${min > 1 ? 's' : ''} required for ${evt.name}. You selected ${count}.`);
    return;
  }
  if (count > max) {
    showAlert(`Maximum ${max} participant${max > 1 ? 's' : ''} allowed for ${evt.name}. You selected ${count}.`);
    return;
  }

  const nextNum = currentEventTeams.length + 1;
  const teamCode = `TEAM-${String(nextNum).padStart(3, '0')}`;
  const defaultTeamName = `Team ${String(nextNum).padStart(3, '0')}`;

  const elCode = document.getElementById('mTeamConfirmCode');
  const elCount = document.getElementById('mTeamConfirmMembersCount');
  const elEventName = document.getElementById('mTeamConfirmEventName');
  const elNameInput = document.getElementById('mTeamNameInput');
  const elList = document.getElementById('mTeamConfirmMembersList');

  if (elCode) elCode.textContent = teamCode;
  if (elCount) elCount.textContent = `${count} Members`;
  if (elEventName) elEventName.textContent = `${evt.name} (Min: ${min} | Max: ${max})`;
  if (elNameInput) elNameInput.value = defaultTeamName;

  if (elList) {
    const selectedStudents = currentEventStudents.filter(s => selectedEventTeamStudentIds.has(Number(s.id)));
    elList.innerHTML = selectedStudents.map((st, i) => `
      <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:0.6rem 0.8rem; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong style="color:#1e0b36; font-size:0.92rem;">${i + 1}. ${st.name}</strong>
          <div style="font-size:0.78rem; color:#64748b;">${st.college} • ${st.phone}</div>
        </div>
        <span style="font-size:0.75rem; font-weight:800; background:#f1f5f9; color:#475569; padding:0.2rem 0.5rem; border-radius:4px;">${st.reg_code}</span>
      </div>
    `).join('');
  }

  openModal('modalConfirmEventTeam');
};

window.handleConfirmCreateEventTeam = async function () {
  const elNameInput = document.getElementById('mTeamNameInput');
  const teamName = elNameInput ? elNameInput.value.trim() : '';
  const studentIds = Array.from(selectedEventTeamStudentIds);

  const btnSubmit = document.getElementById('btnSubmitConfirmEventTeam');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Forming Team...`;
  }

  try {
    const res = await fetch('/api/coordinator/create-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: currentCoordinatorEventId,
        teamName,
        studentIds
      })
    });

    const data = await res.json();
    if (data.success) {
      closeModal('modalConfirmEventTeam');
      selectedEventTeamStudentIds.clear();
      showAlert(data.message || 'Team created successfully!');
      await loadEventParticipants(currentCoordinatorEventId);
      await loadEventTeams(currentCoordinatorEventId);
      switchCoordinatorSubtab('teams');
      if (typeof LiveSyncEngine !== 'undefined') {
        LiveSyncEngine.triggerImmediateSync();
      }
    } else {
      showAlert(data.message || 'Failed to create team.');
    }
  } catch (err) {
    console.error('Error creating team:', err);
    showAlert('Server error creating team.');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<i class="fa-solid fa-check"></i> Confirm Team`;
    }
  }
};

function renderCoordinatorFormedTeams() {
  const container = document.getElementById('coordFormedTeamsList');
  if (!container) return;

  const searchInput = document.getElementById('coordTeamsSearchInput');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const filtered = currentEventTeams.filter(t => {
    if (!query) return true;
    const matchTeam = (t.team_code || '').toLowerCase().includes(query) || (t.team_name || '').toLowerCase().includes(query);
    const matchMember = (t.members || []).some(m => (m.name || '').toLowerCase().includes(query) || (m.college || '').toLowerCase().includes(query) || (m.phone || '').includes(query));
    return matchTeam || matchMember;
  });

  const countLbl = document.getElementById('coordTeamsSearchCount');
  if (countLbl) {
    countLbl.textContent = `Showing ${filtered.length} of ${currentEventTeams.length} formed teams`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #64748b; background: #f8fafc; border-radius: 14px; border: 1.5px dashed #cbd5e1;">
        <i class="fa-solid fa-people-group" style="font-size: 2.5rem; margin-bottom: 0.75rem; color: #94a3b8; display: block;"></i>
        <h4 style="font-weight: 800; color: #1e0b36; margin-bottom: 0.35rem;">No Formed Teams Found</h4>
        <p style="font-size: 0.9rem; margin: 0;">${query ? 'No teams matching your search.' : 'Select participants in the first tab to create teams.'}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(t => {
    const createdDateStr = t.created_at ? new Date(t.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Just now';
    return `
      <div class="formed-team-card">
        <div class="formed-team-header">
          <div class="formed-team-title-group">
            <span class="formed-team-code">${t.team_code}</span>
            <h4 class="formed-team-title">${t.team_name}</h4>
            <span style="font-size:0.8rem; color:#64748b; font-weight:600;"><i class="fa-solid fa-calendar-check"></i> ${t.event_name}</span>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.4rem;">
            <span style="font-size:0.75rem; font-weight:800; background:#e0f2fe; color:#0284c7; padding:0.25rem 0.65rem; border-radius:999px;">
              <i class="fa-solid fa-users"></i> ${t.members_count} Members
            </span>
            <span style="font-size:0.7rem; font-weight:700; background:#ecfdf5; color:#059669; padding:0.15rem 0.5rem; border-radius:4px;">
              ✔ ${t.status || 'Formed'}
            </span>
          </div>
        </div>

        <div class="formed-team-members-list">
          ${(t.members || []).map((m, idx) => `
            <div class="formed-member-item">
              <div>
                <span class="m-name">${idx + 1}. ${m.name}</span>
                <div class="m-sub">${m.college} • ${m.phone}</div>
              </div>
              <span style="font-size:0.74rem; font-weight:800; color:#0284c7;">${m.reg_code}</span>
            </div>
          `).join('')}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f5f9; padding-top:0.75rem; margin-top:auto;">
          <span style="font-size:0.72rem; color:#94a3b8; font-weight:600;"><i class="fa-solid fa-clock"></i> ${createdDateStr}</span>
          <button type="button" class="btn-disband-team" onclick="window.handleDisbandEventTeam(${t.id}, '${t.team_code}')">
            <i class="fa-solid fa-trash-can"></i> Disband Team
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.handleDisbandEventTeam = async function (teamId, teamCode) {
  if (!await showConfirm(`Are you sure you want to disband ${teamCode}? Its members will become unassigned and available for new team formation.`, 'Disband Team', 'Yes, Disband', 'Cancel')) {
    return;
  }

  try {
    const res = await fetch(`/api/coordinator/teams/${teamId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showAlert(data.message || 'Team disbanded successfully.');
      await loadEventParticipants(currentCoordinatorEventId);
      await loadEventTeams(currentCoordinatorEventId);
      if (typeof LiveSyncEngine !== 'undefined') {
        LiveSyncEngine.triggerImmediateSync();
      }
    } else {
      showAlert(data.message || 'Failed to disband team.');
    }
  } catch (err) {
    console.error('Error disbanding team:', err);
    showAlert('Server error disbanding team.');
  }
};

// Global Window Handler for Coordinator Action (Food Token, Tag, Event Entry, Confirm & Lock)
window.handleCoordinatorAction = async function (studentId, actionType, eventId) {
  try {
    const targetEvtId = eventId || currentCoordinatorEventId || currentMasterSelectedEventId;
    const res = await fetch('/api/coordinator/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        eventId: targetEvtId,
        actionType
      })
    });
    const data = await res.json();
    if (data.success) {
      if (currentCoordinatorEventId) {
        await loadEventParticipants(currentCoordinatorEventId);
      }
      if (currentMasterSelectedEventId) {
        await loadMasterEventParticipants(currentMasterSelectedEventId);
      }
      if (typeof loadMasterStudentDirectory === 'function' && document.getElementById('adminPaneDirectory')?.classList.contains('active')) {
        loadMasterStudentDirectory();
      }
      if (typeof LiveSyncEngine !== 'undefined') {
        LiveSyncEngine.triggerImmediateSync();
      }
    } else {
      showAlert(`Action Failed: ${data.message}`);
    }
  } catch (err) {
    console.error('Coordinator action error:', err);
    showAlert('Server error executing coordinator action.');
  }
};

// Open Participant Edit Request Modal
window.handleOpenEditRequestModal = function (studentId) {
  try {
    let student = (currentEventStudents || []).find(s => String(s.id) === String(studentId));
    if (!student) {
      student = (currentMasterEventStudents || []).find(s => String(s.id) === String(studentId));
    }
    if (!student) {
      student = (currentMasterStudents || []).find(s => String(s.id) === String(studentId));
    }
    if (!student) {
      student = (currentEventIssueParticipants || []).find(s => String(s.id) === String(studentId));
    }
    if (!student) return showAlert('Student details not found for ID: ' + studentId);

    const idInput = document.getElementById('editStudentId');
    const nameInput = document.getElementById('editStudentName');
    const phoneInput = document.getElementById('editStudentPhone');
    const emailInput = document.getElementById('editStudentEmail');
    const collegeInput = document.getElementById('editStudentCollege');

    if (idInput) idInput.value = student.id;
    if (nameInput) nameInput.value = student.name || '';
    if (phoneInput) phoneInput.value = student.phone || '';
    if (emailInput) emailInput.value = student.email || '';
    if (collegeInput) collegeInput.value = student.college || '';

    let eventName = '';
    if (typeof currentCoordinatorEventId !== 'undefined' && currentCoordinatorEventId) {
      const ev = (typeof eventCatalog !== 'undefined' && eventCatalog) ? eventCatalog.find(e => e.id === currentCoordinatorEventId) : null;
      if (ev) eventName = ev.name;
    } else if (typeof currentMasterSelectedEventId !== 'undefined' && currentMasterSelectedEventId) {
      const ev = (typeof eventCatalog !== 'undefined' && eventCatalog) ? eventCatalog.find(e => e.id === currentMasterSelectedEventId) : null;
      if (ev) eventName = ev.name;
    }
    if (!eventName && student && student.events && student.events.length > 0) {
      eventName = student.events.map(e => e.name || e.event_name).filter(Boolean).join(', ');
    }
    if (!eventName) eventName = 'Event Desk';

    const evtNameInput = document.getElementById('editRequestEventName');
    if (evtNameInput) evtNameInput.value = eventName;

    const modalEl = document.getElementById('modalEditRequest');
    if (modalEl) {
      modalEl.classList.add('active');
      modalEl.style.display = 'flex';
      modalEl.style.zIndex = '99999';
    } else {
      showAlert('Modal #modalEditRequest element missing in DOM.');
    }
  } catch (err) {
    console.error('Error opening edit request modal:', err);
    showAlert('Error opening edit modal: ' + err.message);
  }
};

async function handleSubmitEditRequest() {
  const studentId = document.getElementById('editStudentId').value;
  const name = document.getElementById('editStudentName').value.trim();
  const phone = document.getElementById('editStudentPhone').value.trim();
  const email = document.getElementById('editStudentEmail').value.trim();
  const college = document.getElementById('editStudentCollege').value.trim();
  const evtNameInput = document.getElementById('editRequestEventName');
  const eventName = (evtNameInput && evtNameInput.value.trim()) ? evtNameInput.value.trim() : 'Event Desk';
  const coordEl = document.getElementById('editCoordinatorName');
  const coordinatorName = (coordEl && coordEl.value.trim()) ? coordEl.value.trim() : eventName;

  if (!name || !phone || !email || !college) {
    return showAlert('Please fill in all required fields.');
  }
  if (!/^\d{10}$/.test(phone)) {
    return showAlert('Please enter a valid 10-digit mobile number.');
  }

  try {
    const res = await fetch('/api/coordinator/edit-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: parseInt(studentId),
        coordinatorName,
        eventName,
        newData: { name, phone, email, college }
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Edit request submitted to Admin for review!', 'success');
      closeModal('modalEditRequest');
      loadAdminEditRequests();
      if (typeof LiveSyncEngine !== 'undefined') {
        LiveSyncEngine.triggerImmediateSync();
      }
    } else {
      showAlert(`Submission Failed: ${data.message}`);
    }
  } catch (err) {
    console.error('Submit edit request error:', err);
    showAlert('Server error submitting edit request.');
  }
}

// ADMIN DASHBOARD: EDIT REQUESTS QUEUE & APPROVAL WORKFLOW
async function loadAdminEditRequests() {
  try {
    const res = await fetch('/api/admin/edit-requests');
    const data = await res.json();
    if (data.success) {
      renderAdminEditRequestsTable(data.requests || []);
    }
  } catch (err) {
    console.error('Error loading admin edit requests:', err);
  }
}

function renderAdminEditRequestsTable(requests) {
  const tbody = document.getElementById('adminEditRequestsTableBody');
  const badge = document.getElementById('pendingRequestsBadge');
  if (!tbody) return;

  const pendingRequests = requests.filter(r => (r.status || '').toUpperCase() === 'PENDING');
  if (badge) badge.textContent = `${pendingRequests.length} Pending`;

  tbody.innerHTML = '';

  if (requests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #64748b;">No modification requests found.</td></tr>`;
    return;
  }

  requests.forEach((req, idx) => {
    const tr = document.createElement('tr');

    let oldData = typeof req.old_data === 'object' && req.old_data !== null ? req.old_data : {};
    if (typeof req.old_data === 'string') {
      try { oldData = JSON.parse(req.old_data); } catch (e) { }
    }
    let newData = typeof req.new_data === 'object' && req.new_data !== null ? req.new_data : {};
    if (typeof req.new_data === 'string') {
      try { newData = JSON.parse(req.new_data); } catch (e) { }
    }

    const isPending = (req.status || '').toUpperCase() === 'PENDING';
    const isApproved = (req.status || '').toUpperCase() === 'APPROVED';
    const timeStr = req.created_at ? new Date(req.created_at).toLocaleString() : '';

    const nameChanged = (oldData.name || '').trim() !== (newData.name || '').trim();
    const phoneChanged = (oldData.phone || '').trim() !== (newData.phone || '').trim();
    const emailChanged = (oldData.email || '').trim() !== (newData.email || '').trim();
    const collegeChanged = (oldData.college || '').trim() !== (newData.college || '').trim();

    tr.innerHTML = `
      <td style="text-align:center; font-weight:700;">${idx + 1}</td>
      <td>
        <strong style="color:#0f172a;">${oldData.name || req.current_name || 'Participant #' + req.student_id}</strong>
        <div style="font-size:0.78rem; color:#64748b;">Reg: ${req.reg_code || '#' + req.student_id}</div>
      </td>
      <td>
        <div class="diff-box old-box">
          <div class="diff-row"><span class="diff-label">Name:</span> <span class="diff-val">${oldData.name || '-'}</span></div>
          <div class="diff-row"><span class="diff-label">Phone:</span> <span class="diff-val">${oldData.phone || '-'}</span></div>
          <div class="diff-row"><span class="diff-label">Email:</span> <span class="diff-val">${oldData.email || '-'}</span></div>
          <div class="diff-row"><span class="diff-label">College:</span> <span class="diff-val">${oldData.college || '-'}</span></div>
        </div>
      </td>
      <td>
        <div class="diff-box new-box">
          <div class="diff-row"><span class="diff-label">Name:</span> <span class="diff-val ${nameChanged ? 'modified' : ''}">${newData.name || '-'} ${nameChanged ? '<span class="diff-badge-edit">UPDATED</span>' : ''}</span></div>
          <div class="diff-row"><span class="diff-label">Phone:</span> <span class="diff-val font-mono ${phoneChanged ? 'modified' : ''}">${newData.phone || '-'} ${phoneChanged ? '<span class="diff-badge-edit">UPDATED</span>' : ''}</span></div>
          <div class="diff-row"><span class="diff-label">Email:</span> <span class="diff-val ${emailChanged ? 'modified' : ''}">${newData.email || '-'} ${emailChanged ? '<span class="diff-badge-edit">UPDATED</span>' : ''}</span></div>
          <div class="diff-row"><span class="diff-label">College:</span> <span class="diff-val ${collegeChanged ? 'modified' : ''}">${newData.college || '-'} ${collegeChanged ? '<span class="diff-badge-edit">UPDATED</span>' : ''}</span></div>
        </div>
      </td>
      <td>
        <div style="font-size:0.85rem; font-weight:700; color:#1e0b36;"><i class="fa-solid fa-calendar-check" style="color:#0284c7;"></i> ${req.event_name || req.coordinator_name || 'Event Desk'}</div>
        <div style="font-size:0.76rem; color:#64748b; margin-top:0.25rem;">${timeStr}</div>
      </td>
      <td style="text-align:center;">
        ${isPending ? `
          <div class="decision-pill-group">
            <span class="status-pill pending" style="background:#fef3c7; color:#b45309; border:1px solid #fcd34d; font-weight:700; padding:0.35rem 0.75rem; border-radius:9999px; display:inline-flex; align-items:center; gap:0.35rem; font-size:0.8rem;">
              <i class="fa-solid fa-clock"></i> Pending Admin Approval
            </span>
            <div class="decision-meta" style="font-size:0.75rem; color:#64748b; margin-top:0.25rem;">Awaiting Admin Review</div>
          </div>
        ` : `
          <div class="decision-pill-group">
            <span class="status-pill ${isApproved ? 'green' : 'red'}"><i class="fa-solid ${isApproved ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${isApproved ? 'Proceeded / Approved' : 'Rejected'}</span>
            <div class="decision-meta">by <strong>${req.admin_name || 'Admin'}</strong></div>
            <div class="decision-time">${req.approved_at ? new Date(req.approved_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</div>
          </div>
        `}
      </td>
    `;

    tbody.appendChild(tr);
  });
}

window.handleAdminApproveEditRequest = async function (requestId) {
  if (!await showConfirm('Participant details will be updated immediately in the database.', 'Approve Modification?', 'Yes, Proceed', 'Cancel')) return;
  try {
    const res = await fetch('/api/admin/edit-request/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, adminName: 'Admin' })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Modification approved & updated successfully!', 'success');
      loadMasterApprovals();
      loadMasterStudentDirectory();
      loadMasterAdminDashboard();
      loadAdminEditRequests();
      if (currentCoordinatorEventId) {
        loadEventParticipants(currentCoordinatorEventId);
      }
      if (typeof currentMasterSelectedEventId !== 'undefined' && currentMasterSelectedEventId) {
        loadMasterEventParticipants(currentMasterSelectedEventId);
      }
    } else {
      showAlert(`Action Failed: ${data.message}`);
    }
  } catch (err) {
    console.error('Approve error:', err);
    showAlert('Server error processing request.');
  }
};

window.handleAdminRejectEditRequest = async function (requestId) {
  if (!await showConfirm('Original details will be preserved.', 'Reject Request?', 'Yes, Reject', 'Cancel')) return;
  try {
    const res = await fetch('/api/admin/edit-request/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, adminName: 'Admin' })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Modification rejected.', 'info');
      loadMasterApprovals();
      loadMasterAdminDashboard();
      loadAdminEditRequests();
      if (typeof LiveSyncEngine !== 'undefined') {
        LiveSyncEngine.triggerImmediateSync();
      }
    } else {
      showAlert(`Rejection Failed: ${data.message}`);
    }
  } catch (err) {
    console.error('Reject error:', err);
    showAlert('Server error rejecting request.');
  }
};

// ==========================================================
// 8. DEDICATED FREE FIRE TOURNAMENT LOGIC (KIOSK & DASHBOARD)
// ==========================================================

let selectedFfSoloPlayerIds = new Set();
let currentFfSoloPlayers = [];
let currentFfTeams = [];

function initFreeFireKiosk() {
  const btnSubmit = document.getElementById('btnSubmitFreeFireTeam');
  if (btnSubmit) {
    btnSubmit.addEventListener('click', handleFreeFireSpotRegister);
  }

  const btnNewReg = document.getElementById('btnNewFreeFireRegistration');
  if (btnNewReg) {
    btnNewReg.addEventListener('click', () => {
      closeModal('modalFreeFireSuccess');
      document.getElementById('formFreeFireKiosk').reset();
      showSpotChoiceHub();
    });
  }
}

async function handleFreeFireSpotRegister() {
  const teamName = document.getElementById('ffTeamName').value.trim();
  if (!teamName) return showAlert('Please enter Team / Squad Name.');

  const members = [
    { name: document.getElementById('ffP1Name').value.trim(), phone: document.getElementById('ffP1Phone').value.trim(), email: (document.getElementById('ffP1Email') ? document.getElementById('ffP1Email').value : '').trim(), college: document.getElementById('ffP1College').value.trim() },
    { name: document.getElementById('ffP2Name').value.trim(), phone: document.getElementById('ffP2Phone').value.trim(), email: (document.getElementById('ffP2Email') ? document.getElementById('ffP2Email').value : '').trim(), college: document.getElementById('ffP2College').value.trim() },
    { name: document.getElementById('ffP3Name').value.trim(), phone: document.getElementById('ffP3Phone').value.trim(), email: (document.getElementById('ffP3Email') ? document.getElementById('ffP3Email').value : '').trim(), college: document.getElementById('ffP3College').value.trim() },
    { name: document.getElementById('ffP4Name').value.trim(), phone: document.getElementById('ffP4Phone').value.trim(), email: (document.getElementById('ffP4Email') ? document.getElementById('ffP4Email').value : '').trim(), college: document.getElementById('ffP4College').value.trim() }
  ];

  for (let i = 0; i < 4; i++) {
    const m = members[i];
    if (!m.name) return showAlert(`Please enter Player ${i + 1} Name.`);
    if (!m.phone || !/^\d{10}$/.test(m.phone)) return showAlert(`Please enter a valid 10-digit Phone for Player ${i + 1}.`);
    if (!m.email) return showAlert(`Please enter Player ${i + 1} Email Address.`);
    if (!m.college) return showAlert(`Please enter Player ${i + 1} College Name.`);
  }

  const btnSubmit = document.getElementById('btnSubmitFreeFireTeam');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Registering Team...`;

  const counterName = typeof getActiveSpotCounter === 'function' ? getActiveSpotCounter() : 'Counter 1';

  try {
    const res = await fetch('/api/freefire/spot-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamName, members, counterName })
    });

    const data = await res.json();
    if (data.success) {
      const team = data.team;
      document.getElementById('ffTicketTeamCode').textContent = team.team_code;
      document.getElementById('ffTicketTeamName').textContent = team.team_name;

      const membersList = document.getElementById('ffTicketMembers');
      membersList.innerHTML = team.members.map((m, idx) => `
        <div class="ff-ticket-member-row">
          <span>${idx === 0 ? '👑' : '🎮'} P${idx + 1}: <strong>${m.name}</strong> (${m.phone}${m.email ? ' | ' + m.email : ''})</span>
          <span style="font-size:0.8rem; color:#64748b;">${m.college}</span>
        </div>
      `).join('');

      openModal('modalFreeFireSuccess');
      document.getElementById('formFreeFireKiosk').reset();
      loadFreeFireTeams();
      if (typeof LiveSyncEngine !== 'undefined') {
        LiveSyncEngine.triggerImmediateSync();
      }
    } else {
      showAlert(`Registration Failed: ${data.message}`);
    }
  } catch (err) {
    console.error('Free Fire spot register error:', err);
    showAlert('Server error registering Free Fire team.');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<i class="fa-solid fa-check-double"></i> Confirm 4-Player Free Fire Registration (₹400)`;
  }
}

function initFreeFireDashboard() {
  const navFf = document.getElementById('navFreeFireDashboard');
  if (navFf) {
    navFf.addEventListener('click', () => {
      switchAdminPanel('freefire');
      loadUnassignedSoloPlayers();
      loadFreeFireTeams();
    });
  }

  const btnSolo = document.getElementById('btnFfSubtabSolo');
  const btnTeams = document.getElementById('btnFfSubtabTeams');

  if (btnSolo && btnTeams) {
    btnSolo.addEventListener('click', () => {
      btnSolo.classList.add('active');
      btnTeams.classList.remove('active');
      document.getElementById('ffSubtabSoloContent').classList.add('active');
      document.getElementById('ffSubtabTeamsContent').classList.remove('active');
      loadUnassignedSoloPlayers();
    });

    btnTeams.addEventListener('click', () => {
      btnTeams.classList.add('active');
      btnSolo.classList.remove('active');
      document.getElementById('ffSubtabTeamsContent').classList.add('active');
      document.getElementById('ffSubtabSoloContent').classList.remove('active');
      loadFreeFireTeams();
    });
  }

  const btnFormTeam = document.getElementById('btnFormFfTeam');
  if (btnFormTeam) {
    btnFormTeam.addEventListener('click', handleFormFfTeamFromSolo);
  }

  // Standalone Search for Solo Registrations in Sub-Tab 1
  const soloSearchInput = document.getElementById('ffSoloSearchInput');
  if (soloSearchInput) {
    soloSearchInput.addEventListener('input', renderSoloPlayersTable);
  }

  const clearSoloSearchBtn = document.getElementById('clearFfSoloSearch');
  if (clearSoloSearchBtn) {
    clearSoloSearchBtn.addEventListener('click', () => {
      if (soloSearchInput) soloSearchInput.value = '';
      renderSoloPlayersTable();
    });
  }

  const searchTeamInput = document.getElementById('ffTeamSearchInput');
  if (searchTeamInput) {
    searchTeamInput.addEventListener('input', renderFreeFireTeamsGrid);
  }

  // Edit Modal Buttons & Delegated Click Handler
  const closeEditBtn = document.getElementById('closeEditFfTeamModal');
  if (closeEditBtn) closeEditBtn.addEventListener('click', () => closeModal('modalEditFreeFireTeam'));

  const cancelEditBtn = document.getElementById('btnCancelEditFfTeam');
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => closeModal('modalEditFreeFireTeam'));

  const saveEditBtn = document.getElementById('btnSaveEditFfTeam');
  if (saveEditBtn) saveEditBtn.addEventListener('click', handleSaveEditFfTeam);

  // Global Delegated Click Listener for Edit Team Buttons (Failsafe String ID Match & Auto-Fetch Fallback)
  document.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-edit-ff-team');
    if (editBtn) {
      e.preventDefault();
      const teamId = editBtn.getAttribute('data-team-id');
      if (!teamId) return;

      let team = currentFfTeams.find(t => String(t.id) === String(teamId));
      if (!team) {
        try {
          const res = await fetch('/api/freefire/teams');
          const data = await res.json();
          if (data.success && data.teams) {
            currentFfTeams = data.teams;
            team = currentFfTeams.find(t => String(t.id) === String(teamId));
          }
        } catch (fetchErr) {
          console.error('Failed to fetch teams on edit click:', fetchErr);
        }
      }

      if (team) {
        openEditFfTeamModal(team);
      } else {
        showAlert(`Team #${teamId} details could not be loaded. Please refresh the page.`);
      }
    }
  });
}

async function loadUnassignedSoloPlayers() {
  try {
    const res = await fetch('/api/freefire/unassigned-online-players');
    const data = await res.json();
    if (data.success) {
      currentFfSoloPlayers = data.players || [];
      renderSoloPlayersTable();
    }
  } catch (err) {
    console.error('Error loading solo players:', err);
  }
}

function renderSoloPlayersTable() {
  const tbody = document.getElementById('ffSoloTableBody');
  const countLbl = document.getElementById('ffSoloSearchCount');
  const soloSearchInput = document.getElementById('ffSoloSearchInput');
  const query = soloSearchInput ? soloSearchInput.value.trim().toLowerCase() : '';

  if (!tbody) return;
  tbody.innerHTML = '';

  const soloList = Array.isArray(currentFfSoloPlayers) ? currentFfSoloPlayers : [];

  const filtered = soloList.filter(p => {
    if (!query) return true;
    return (
      (p.name || '').toLowerCase().includes(query) ||
      (p.phone || '').includes(query) ||
      (p.email || '').toLowerCase().includes(query) ||
      (p.college || '').toLowerCase().includes(query)
    );
  });

  if (countLbl) {
    countLbl.textContent = `Showing ${filtered.length} of ${soloList.length} solo players`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: #64748b;">${soloList.length === 0 ? 'No unassigned online solo players found. All players grouped into teams!' : 'No matching solo players found.'}</td></tr>`;
    renderFfSelectedChips();
    updateFormFfTeamButtonState();
    return;
  }

  filtered.forEach((p, idx) => {
    const tr = document.createElement('tr');
    const isChecked = selectedFfSoloPlayerIds.has(p.id);

    tr.innerHTML = `
      <td style="text-align:center;">
        <input type="checkbox" class="ff-player-checkbox" data-player-id="${p.id}" ${isChecked ? 'checked' : ''}>
      </td>
      <td>${idx + 1}</td>
      <td style="font-weight:700; color:#0f172a;">${p.name}</td>
      <td style="color:#334155;">${p.phone}</td>
      <td style="color:#334155;">${p.email || '-'}</td>
      <td style="color:#334155;">${p.college}</td>
      <td>${p.registration_type === 'SPOT' ? '<span class="evt-theme-badge" style="background:#ecfdf5; color:#059669; border-color:#a7f3d0;"><i class="fa-solid fa-pen-to-square"></i> SPOT REGISTRATION</span>' : '<span class="evt-theme-badge"><i class="fa-solid fa-globe"></i> ONLINE REGISTRATION</span>'}</td>
    `;

    const checkbox = tr.querySelector('.ff-player-checkbox');
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (selectedFfSoloPlayerIds.size >= 4) {
          e.target.checked = false;
          showAlert('You can select a maximum of exactly 4 players to form a squad.');
          return;
        }
        selectedFfSoloPlayerIds.add(p.id);
      } else {
        selectedFfSoloPlayerIds.delete(p.id);
      }
      renderFfSelectedChips();
      updateFormFfTeamButtonState();
    });

    tbody.appendChild(tr);
  });

  renderFfSelectedChips();
  updateFormFfTeamButtonState();
}

function renderFfSelectedChips() {
  const chipsList = document.getElementById('ffSelectedChipsList');
  const chipCountSpan = document.getElementById('ffSelectedChipCount');
  const count = selectedFfSoloPlayerIds.size;

  if (chipCountSpan) chipCountSpan.textContent = count;
  if (!chipsList) return;

  if (count === 0) {
    chipsList.innerHTML = `<span class="no-chips-text">No players selected yet. Search & select 4 players to form team.</span>`;
    return;
  }

  chipsList.innerHTML = '';
  const soloList = Array.isArray(currentFfSoloPlayers) ? currentFfSoloPlayers : [];

  selectedFfSoloPlayerIds.forEach(id => {
    const player = soloList.find(p => p.id === id);
    const playerName = player ? player.name : `Player #${id}`;

    const chip = document.createElement('div');
    chip.className = 'chip-item';
    chip.innerHTML = `
      <i class="fa-solid fa-user"></i>
      <span>${playerName}</span>
      <button type="button" class="chip-remove-btn" data-player-id="${id}">&times;</button>
    `;

    chip.querySelector('.chip-remove-btn').addEventListener('click', () => {
      selectedFfSoloPlayerIds.delete(id);
      const cb = document.querySelector(`.ff-player-checkbox[data-player-id="${id}"]`);
      if (cb) cb.checked = false;
      renderFfSelectedChips();
      updateFormFfTeamButtonState();
    });

    chipsList.appendChild(chip);
  });
}

function updateFormFfTeamButtonState() {
  const btnFormTeam = document.getElementById('btnFormFfTeam');
  const countSpan = document.getElementById('ffSelectedCount');
  const count = selectedFfSoloPlayerIds.size;

  if (countSpan) countSpan.textContent = count;
  if (btnFormTeam) {
    if (count === 4) {
      btnFormTeam.disabled = false;
      btnFormTeam.classList.add('active');
    } else {
      btnFormTeam.disabled = true;
      btnFormTeam.classList.remove('active');
    }
  }
}

async function handleFormFfTeamFromSolo() {
  if (selectedFfSoloPlayerIds.size !== 4) return;

  const teamName = prompt('Enter Team / Squad Name for these 4 online players:');
  if (!teamName || !teamName.trim()) return showAlert('Team Name is required.');

  try {
    const res = await fetch('/api/freefire/create-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamName: teamName.trim(),
        playerIds: Array.from(selectedFfSoloPlayerIds)
      })
    });

    const data = await res.json();
    if (data.success) {
      showAlert(`Team "${teamName}" formed successfully! Moved to Formed Teams Dashboard.`);
      selectedFfSoloPlayerIds.clear();
      renderFfSelectedChips();
      loadUnassignedSoloPlayers();
      loadFreeFireTeams();
      if (typeof LiveSyncEngine !== 'undefined') {
        LiveSyncEngine.triggerImmediateSync();
      }
    } else {
      showAlert(`Failed to form team: ${data.message}`);
    }
  } catch (err) {
    console.error('Error creating team:', err);
    showAlert('Server error creating team.');
  }
}

async function loadFreeFireTeams() {
  try {
    const res = await fetch('/api/freefire/teams');
    const data = await res.json();
    if (data.success) {
      currentFfTeams = data.teams || [];
      renderFreeFireTeamsGrid();
    }
  } catch (err) {
    console.error('Error loading teams:', err);
  }
}

function renderFreeFireTeamsGrid() {
  const grid = document.getElementById('ffTeamsGrid');
  const countLbl = document.getElementById('ffTeamsSearchCount');
  const searchInput = document.getElementById('ffTeamSearchInput');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  if (!grid) return;

  const teamsList = Array.isArray(currentFfTeams) ? currentFfTeams : [];

  const filtered = teamsList.filter(t => {
    if (!query) return true;
    return (
      (t.team_name || '').toLowerCase().includes(query) ||
      (t.team_code || '').toLowerCase().includes(query) ||
      (t.members || []).some(m => (m.name || '').toLowerCase().includes(query) || (m.phone || '').includes(query) || (m.email || '').toLowerCase().includes(query) || (m.college || '').toLowerCase().includes(query))
    );
  });

  if (countLbl) {
    countLbl.textContent = `Showing ${filtered.length} of ${teamsList.length} formed teams`;
  }
  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; padding: 2.5rem; text-align: center; color: #64748b;">No matching Free Fire teams found.</div>`;
    return;
  }

  filtered.forEach(team => {
    const card = document.createElement('div');
    card.className = 'ff-team-dashboard-card';

    const isSpot = team.registration_source === 'SPOT';
    const sourceBadge = isSpot
      ? `<span class="ff-source-badge spot"><i class="fa-solid fa-pen-to-square"></i> SPOT REGISTERED TEAM</span>`
      : `<span class="ff-source-badge online"><i class="fa-solid fa-user-shield"></i> COORDINATOR FORMED TEAM</span>`;

    card.innerHTML = `
      <div class="ff-team-card-header">
        <div class="ff-team-title-group">
          <span class="ff-code-badge">${team.team_code}</span>
          <h3 class="ff-team-title">${team.team_name}</h3>
          ${sourceBadge}
        </div>
        <button type="button" class="btn-edit-ff-team" data-team-id="${team.id}" onclick="window.handleEditFfTeamClick('${team.id}')">
          <i class="fa-solid fa-pen"></i> ✏️ Edit Team
        </button>
      </div>

      <div class="ff-team-members-grid">
        ${(team.members || []).map((m, idx) => `
          <div class="ff-member-pill ${m.is_captain ? 'captain' : ''}">
            <div class="p-num">${m.is_captain ? '👑 CAPTAIN' : `P${idx + 1}`}</div>
            <div class="p-name">${m.name || ''}</div>
            <div class="p-phone"><i class="fa-solid fa-phone"></i> ${m.phone || ''}</div>
            ${m.email ? `<div class="p-email" style="font-size:0.75rem; color:#0284c7; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><i class="fa-solid fa-envelope"></i> ${m.email}</div>` : ''}
            <div class="p-college">${m.college || ''}</div>
          </div>
        `).join('')}
      </div>
    `;

    grid.appendChild(card);
  });
}

let pendingRemovedMemberIds = [];

// Global Window Handler for Direct Inline Button Click
window.handleEditFfTeamClick = async function (teamId) {
  try {
    if (!teamId) return;
    let team = (currentFfTeams || []).find(t => String(t.id) === String(teamId));

    if (!team) {
      try {
        const res = await fetch('/api/freefire/teams');
        const data = await res.json();
        if (data.success && data.teams) {
          currentFfTeams = data.teams;
          team = currentFfTeams.find(t => String(t.id) === String(teamId));
        }
      } catch (fetchErr) {
        console.error('Error fetching teams:', fetchErr);
      }
    }

    if (team) {
      openEditFfTeamModal(team);
    } else {
      showAlert('Team details could not be loaded. Please refresh the page.');
      loadFreeFireTeams();
    }
  } catch (err) {
    console.error('Error in handleEditFfTeamClick:', err);
    showAlert('Error opening edit modal: ' + err.message);
  }
};

window.openEditFfTeamModal = function (team) {
  try {
    if (!team) return showAlert('Error: Team data not found.');
    pendingRemovedMemberIds = [];

    const idInput = document.getElementById('editFfTeamId');
    const nameInput = document.getElementById('editFfTeamName');

    if (idInput) idInput.value = team.id;
    if (nameInput) nameInput.value = team.team_name || '';

    renderEditMembersList(team);

    const modalEl = document.getElementById('modalEditFreeFireTeam');
    if (modalEl) {
      modalEl.classList.add('active');
      modalEl.style.display = 'flex';
      modalEl.style.zIndex = '99999';
    } else {
      showAlert('Modal element #modalEditFreeFireTeam not found in DOM.');
    }
  } catch (err) {
    console.error('Error opening edit team modal:', err);
    showAlert('Error opening edit modal: ' + err.message);
  }
};

function renderEditMembersList(team) {
  const container = document.getElementById('editFfMembersContainer');
  if (!container) return;
  container.innerHTML = '';

  const membersList = (team && Array.isArray(team.members)) ? team.members : [];

  // Render current team members
  membersList.forEach((m, idx) => {
    if (pendingRemovedMemberIds.includes(m.id)) return;

    const row = document.createElement('div');
    row.className = 'edit-member-row';
    row.setAttribute('data-member-id', m.id);

    const pName = m.name || '';
    const pPhone = m.phone || '';
    const pEmail = m.email || '';
    const pCollege = m.college || '';

    row.innerHTML = `
      <div class="row-header-flex">
        <span>${m.is_captain ? '👑 Captain (Player 1)' : `Player ${idx + 1}`}</span>
        <button type="button" class="btn-remove-edit-member" data-member-id="${m.id}" title="Remove player from team">
          <i class="fa-solid fa-user-minus"></i> Remove Player
        </button>
      </div>
      <div class="edit-inputs-grid">
        <input type="text" class="edit-m-name" value="${pName}" placeholder="Player Name" required>
        <input type="tel" class="edit-m-phone" value="${pPhone}" placeholder="10-digit Phone" maxlength="10">
        <input type="email" class="edit-m-email" value="${pEmail}" placeholder="Email Address">
        <input type="text" class="edit-m-college" value="${pCollege}" placeholder="College Name">
      </div>
    `;

    row.querySelector('.btn-remove-edit-member').addEventListener('click', async () => {
      const confirmed = await showConfirm(`Remove ${pName} from team "${team.team_name}"? They will return to Sub-Tab 1 as an unassigned solo player.`, 'Remove Player?', 'Yes, Remove', 'Cancel');
      if (confirmed) {
        pendingRemovedMemberIds.push(m.id);
        row.remove();
      }
    });

    container.appendChild(row);
  });

  const soloList = Array.isArray(currentFfSoloPlayers) ? currentFfSoloPlayers : [];

  // Action box to add existing solo player OR add brand new player
  const addBox = document.createElement('div');
  addBox.className = 'add-member-edit-box';
  addBox.innerHTML = `
    <div class="add-member-header"><i class="fa-solid fa-user-plus"></i> Add Player to Team</div>
    <div class="add-options-flex">
      <div class="field-group" style="flex:1;">
        <label style="font-size:0.78rem; font-weight:700; color:#166534;">Pick Unassigned Solo Player from Sub-Tab 1:</label>
        <select id="selectSoloForTeam" class="solo-select-dropdown">
          <option value="">-- Select Solo Player (${soloList.length} available) --</option>
          ${soloList.map(p => `<option value="${p.id}">${p.name || 'Player'} (${p.phone || ''} - ${p.college || ''})</option>`).join('')}
        </select>
      </div>
      <button type="button" id="btnAddSoloToTeamBtn" class="btn-add-solo-action">
        <i class="fa-solid fa-plus"></i> Add Solo Player
      </button>
    </div>
    <div style="text-align:center; font-size:0.78rem; color:#475569; margin: 0.6rem 0; font-weight:700;">— OR Add New Spot Player —</div>
    <div class="edit-inputs-grid" id="newPlayerInputGrid">
      <input type="text" id="newMName" placeholder="New Player Name">
      <input type="tel" id="newMPhone" placeholder="10-digit Phone" maxlength="10">
      <input type="email" id="newMEmail" placeholder="Email Address">
      <input type="text" id="newMCollege" placeholder="College Name">
    </div>
  `;

  container.appendChild(addBox);

  addBox.querySelector('#btnAddSoloToTeamBtn').addEventListener('click', () => {
    const sel = document.getElementById('selectSoloForTeam');
    const selectedId = parseInt(sel.value);
    if (!selectedId) return showAlert('Please select a solo player from the dropdown.');
    const p = soloList.find(sp => sp.id === selectedId);
    if (!p) return;

    if (document.querySelector(`.edit-member-row[data-member-id="${p.id}"]`) || document.querySelector(`.edit-member-row[data-add-solo-id="${p.id}"]`)) {
      return showAlert(`${p.name} is already in this team roster list.`);
    }

    const row = document.createElement('div');
    row.className = 'edit-member-row added-solo-row';
    row.setAttribute('data-add-solo-id', p.id);
    row.innerHTML = `
      <div class="row-header-flex">
        <span style="color:#059669; font-weight:800;"><i class="fa-solid fa-circle-check"></i> Added from Solo List</span>
        <button type="button" class="btn-remove-edit-member" title="Remove player"><i class="fa-solid fa-xmark"></i> Remove</button>
      </div>
      <div class="edit-inputs-grid">
        <input type="text" class="edit-m-name" value="${p.name || ''}" readonly>
        <input type="tel" class="edit-m-phone" value="${p.phone || ''}" readonly>
        <input type="email" class="edit-m-email" value="${p.email || ''}" readonly>
        <input type="text" class="edit-m-college" value="${p.college || ''}" readonly>
      </div>
    `;

    row.querySelector('.btn-remove-edit-member').addEventListener('click', () => row.remove());
    container.insertBefore(row, addBox);
    sel.value = '';
  });
}

async function handleSaveEditFfTeam() {
  const teamId = document.getElementById('editFfTeamId').value;
  const teamName = document.getElementById('editFfTeamName').value.trim();

  if (!teamName) return showAlert('Team Name is required.');

  // Collect modified existing members
  const memberRows = document.querySelectorAll('#editFfMembersContainer .edit-member-row[data-member-id]');
  const members = [];
  for (const row of memberRows) {
    const id = parseInt(row.getAttribute('data-member-id'));
    const name = row.querySelector('.edit-m-name').value.trim();
    const phone = row.querySelector('.edit-m-phone').value.trim();
    const email = (row.querySelector('.edit-m-email') ? row.querySelector('.edit-m-email').value : '').trim();
    const college = row.querySelector('.edit-m-college').value.trim();

    if (!name) return showAlert('All player names are required.');

    members.push({ id, name, phone, email, college });
  }

  // Collect added solo player IDs
  const addedSoloRows = document.querySelectorAll('#editFfMembersContainer .added-solo-row');
  const addPlayerIds = [];
  addedSoloRows.forEach(row => {
    const sId = parseInt(row.getAttribute('data-add-solo-id'));
    if (sId) addPlayerIds.push(sId);
  });

  // Collect new spot player inputs if filled out
  const newMembers = [];
  const newName = document.getElementById('newMName')?.value.trim();
  const newPhone = document.getElementById('newMPhone')?.value.trim();
  const newEmail = document.getElementById('newMEmail')?.value.trim();
  const newCollege = document.getElementById('newMCollege')?.value.trim();
  if (newName) {
    newMembers.push({ name: newName, phone: newPhone, email: newEmail, college: newCollege });
  }

  try {
    const res = await fetch(`/api/freefire/teams/${teamId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamName,
        members,
        removedMemberIds: pendingRemovedMemberIds,
        addPlayerIds,
        newMembers
      })
    });

    const data = await res.json();
    if (data.success) {
      closeModal('modalEditFreeFireTeam');
      loadUnassignedSoloPlayers();
      loadFreeFireTeams();
      if (typeof LiveSyncEngine !== 'undefined') {
        LiveSyncEngine.triggerImmediateSync();
      }
    } else {
      showAlert(`Update Failed: ${data.message}`);
    }
  } catch (err) {
    console.error('Error saving edit:', err);
    showAlert('Server error updating team.');
  }
}

// ==========================================================
// 9. EVENT ISSUE MANAGEMENT & ADMIN APPROVAL WORKFLOW
// ==========================================================

let currentPassFilter = 'all';
let pendingEventChangeStudentIds = new Set();
let eventIssueCurrentPage = 1;
const eventIssueRowsPerPage = 10;

let currentEventIssueParticipants = [];
let currentEditingEventStudent = null;
let modalSelectedEventIds = new Set();
let modalOriginalEventIds = new Set();
let modalSelectedHackathonTheme = 'AI & Smart Automation';

function initEventIssueManagement() {
  const navBtn = document.getElementById('navEventIssueManagement');
  if (navBtn) {
    navBtn.addEventListener('click', () => {
      switchAdminPanel('eventIssue');
    });
  }

  const searchInput = document.getElementById('eventIssueSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      eventIssueCurrentPage = 1;
      filterEventIssueTable();
    });
  }

  const clearBtn = document.getElementById('clearEventIssueSearch');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      eventIssueCurrentPage = 1;
      filterEventIssueTable();
    });
  }

  const refreshBtn = document.getElementById('btnRefreshEventIssue');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadEventIssueParticipants);
  }

  const prevPageBtn = document.getElementById('btnEventIssuePrevPage');
  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (eventIssueCurrentPage > 1) {
        eventIssueCurrentPage--;
        filterEventIssueTable();
      }
    });
  }

  const nextPageBtn = document.getElementById('btnEventIssueNextPage');
  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      eventIssueCurrentPage++;
      filterEventIssueTable();
    });
  }

  // Pass filter buttons
  document.querySelectorAll('.pass-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pass-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPassFilter = btn.getAttribute('data-pass-filter') || 'all';
      eventIssueCurrentPage = 1;
      filterEventIssueTable();
    });
  });

  // Modal close buttons
  const closeBtn = document.getElementById('closeEditParticipantEventsModal');
  if (closeBtn) closeBtn.addEventListener('click', () => closeModal('modalEditParticipantEvents'));

  const cancelBtn = document.getElementById('btnCancelEditParticipantEvents');
  if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal('modalEditParticipantEvents'));

  const submitBtn = document.getElementById('btnSubmitEventChangeRequest');
  if (submitBtn) submitBtn.addEventListener('click', handleSubmitEventChangeRequest);
}

async function loadEventIssueParticipants() {
  const tbody = document.getElementById('eventIssueTableBody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: #64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Loading participant records...</td></tr>`;

  try {
    const [regsRes, pendingRes] = await Promise.all([
      fetch('/api/registrations'),
      fetch('/api/coordinator/pending-event-requests')
    ]);

    const regsData = await regsRes.json();
    const pendingData = await pendingRes.json();

    if (regsData.success) {
      currentEventIssueParticipants = regsData.students || [];
    }
    if (pendingData.success) {
      pendingEventChangeStudentIds = new Set(pendingData.pendingStudentIds || []);
    }

    filterEventIssueTable();
  } catch (err) {
    console.error('Error loading event issue participants:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: #dc2626;">Error loading participants. Please refresh.</td></tr>`;
  }
}

function filterEventIssueTable() {
  const tbody = document.getElementById('eventIssueTableBody');
  const countLbl = document.getElementById('eventIssueSearchCount');
  const searchInput = document.getElementById('eventIssueSearchInput');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  if (!tbody) return;
  tbody.innerHTML = '';

  const list = Array.isArray(currentEventIssueParticipants) ? currentEventIssueParticipants : [];

  const filtered = list.filter(st => {
    // Pass filter
    if (currentPassFilter !== 'all' && st.day_selection !== currentPassFilter) {
      return false;
    }
    // Search query
    if (!query) return true;
    return (
      (st.name || '').toLowerCase().includes(query) ||
      (st.phone || '').includes(query) ||
      (st.reg_code || '').toLowerCase().includes(query) ||
      (st.college || '').toLowerCase().includes(query)
    );
  });

  if (countLbl) {
    countLbl.textContent = `Showing ${filtered.length} of ${list.length} participants`;
  }

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / eventIssueRowsPerPage) || 1;
  if (eventIssueCurrentPage > totalPages) eventIssueCurrentPage = totalPages;
  if (eventIssueCurrentPage < 1) eventIssueCurrentPage = 1;

  const startIndex = (eventIssueCurrentPage - 1) * eventIssueRowsPerPage;
  const endIndex = Math.min(startIndex + eventIssueRowsPerPage, filtered.length);
  const paginated = filtered.slice(startIndex, endIndex);

  // Update pagination controls
  const infoEl = document.getElementById('eventIssuePaginationInfo');
  if (infoEl) {
    if (filtered.length === 0) {
      infoEl.textContent = 'Showing 0-0 of 0';
    } else {
      infoEl.textContent = `Showing ${startIndex + 1}-${endIndex} of ${filtered.length}`;
    }
  }

  const prevBtn = document.getElementById('btnEventIssuePrevPage');
  const nextBtn = document.getElementById('btnEventIssueNextPage');
  if (prevBtn) prevBtn.disabled = eventIssueCurrentPage === 1;
  if (nextBtn) nextBtn.disabled = eventIssueCurrentPage === totalPages;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: #64748b;">No matching participant records found.</td></tr>`;
    return;
  }

  paginated.forEach((st, idx) => {
    const absoluteIdx = startIndex + idx + 1;
    const tr = document.createElement('tr');
    const isPending = pendingEventChangeStudentIds.has(st.id);

    let passLabel = 'Day 1 Pass';
    let passClass = 'd1';
    if (st.day_selection === 'day2') { passLabel = 'Day 2 Pass'; passClass = 'd2'; }
    if (st.day_selection === 'both') { passLabel = 'Both Days Pass'; passClass = 'both'; }

    const eventsPills = (st.events || []).map(e => {
      const themeText = e.hackathon_theme ? ` (${e.hackathon_theme})` : '';
      return `<span class="evt-pill-tag" style="display:inline-block; font-size:0.75rem; padding:0.2rem 0.5rem; margin:0.15rem; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; font-weight:700;"><i class="fa-solid fa-check"></i> ${e.event_name}${themeText}</span>`;
    }).join(' ');

    const actionHtml = isPending ? `
      <div style="display:flex; flex-direction:column; align-items:center; gap:0.25rem;">
        <span class="status-pill yellow" style="font-size:0.72rem; padding:0.25rem 0.55rem;"><i class="fa-solid fa-clock"></i> Pending Review</span>
        <button type="button" class="btn-edit-sm" style="font-size:0.75rem; padding:0.25rem 0.5rem; opacity:0.7;" onclick="window.handleOpenEditEventsModal('${st.id}')" title="View or re-submit change request">
          <i class="fa-solid fa-eye"></i> View / Edit
        </button>
      </div>
    ` : `
      <button type="button" class="btn-edit-sm" onclick="window.handleOpenEditEventsModal('${st.id}')">
        <i class="fa-solid fa-pen-ruler"></i> ✏️ Edit Events
      </button>
    `;

    tr.innerHTML = `
      <td style="text-align:center; font-weight:700;">${absoluteIdx}</td>
      <td><span class="reg-pill" style="font-size:0.78rem; font-weight:800; background:#0284c7; color:#fff; padding:0.2rem 0.5rem; border-radius:4px;">${st.reg_code}</span></td>
      <td><strong style="color:#0f172a; white-space:nowrap;">${st.name}</strong></td>
      <td><span style="color:#334155; white-space:nowrap;">${st.phone}</span></td>
      <td><span style="color:#334155;">${st.college}</span></td>
      <td><span class="evt-day-badge ${passClass}" style="font-size:0.75rem;">${passLabel}</span></td>
      <td><div style="max-width:320px; line-height:1.4;">${eventsPills || '<span style="color:#64748b;">No events</span>'}</div></td>
      <td style="text-align:center;">${actionHtml}</td>
    `;

    tbody.appendChild(tr);
  });
}

// Global Window Handler to Open Modal
window.handleOpenEditEventsModal = function (studentId) {
  let student = (currentEventIssueParticipants || []).find(s => String(s.id) === String(studentId));
  if (!student) {
    student = (currentMasterEventStudents || []).find(s => String(s.id) === String(studentId));
  }
  if (!student) {
    student = (currentMasterStudents || []).find(s => String(s.id) === String(studentId));
  }
  if (!student) {
    student = (currentEventStudents || []).find(s => String(s.id) === String(studentId));
  }
  if (!student) return showAlert('Participant details not found for ID: ' + studentId);

  currentEditingEventStudent = student;
  modalOriginalEventIds = new Set((student.events || []).map(e => e.event_id || e.id));
  modalSelectedEventIds = new Set(modalOriginalEventIds);

  const hackathonEvt = (student.events || []).find(e => (e.event_id === 'd1_hackathon' || e.id === 'd1_hackathon'));
  modalSelectedHackathonTheme = hackathonEvt && hackathonEvt.hackathon_theme ? hackathonEvt.hackathon_theme : 'AI & Smart Automation';

  // Populate Participant Header in Modal
  document.getElementById('editEventStudentId').value = student.id;
  document.getElementById('mEventRegCode').textContent = student.reg_code || `SPOT-${student.id}`;
  document.getElementById('mEventStudentName').textContent = student.name;
  document.getElementById('mEventDetails').textContent = `Phone: ${student.phone} | College: ${student.college}`;

  let passText = 'Day 1 Pass (Max 2 Events)';
  if (student.day_selection === 'day2') passText = 'Day 2 Pass (Max 2 Events)';
  if (student.day_selection === 'both') passText = 'Both Days Pass (Max 2 Day 1 + 2 Day 2)';
  document.getElementById('mEventPassBadge').textContent = passText;

  renderModalEventsSelection();
  updateEventChangeDiff();

  openModal('modalEditParticipantEvents');
};

function renderModalEventsSelection() {
  if (!currentEditingEventStudent) return;
  const st = currentEditingEventStudent;

  const blockDay1 = document.getElementById('mBlockDay1Events');
  const blockDay2 = document.getElementById('mBlockDay2Events');
  const gridDay1 = document.getElementById('mGridDay1Events');
  const gridDay2 = document.getElementById('mGridDay2Events');

  gridDay1.innerHTML = '';
  gridDay2.innerHTML = '';

  if (st.day_selection === 'day1') {
    blockDay1.style.display = 'block';
    blockDay2.style.display = 'none';
  } else if (st.day_selection === 'day2') {
    blockDay1.style.display = 'none';
    blockDay2.style.display = 'block';
  } else {
    blockDay1.style.display = 'block';
    blockDay2.style.display = 'block';
  }

  eventCatalog.forEach(evt => {
    if (evt.is_standalone) return;
    // Check if event belongs to student's allowed days
    if (st.day_selection === 'day1' && evt.day !== 'day1') return;
    if (st.day_selection === 'day2' && evt.day !== 'day2') return;

    const card = document.createElement('label');
    card.className = 'event-checkbox-card';
    card.setAttribute('data-event-id', evt.id);

    const isChecked = modalSelectedEventIds.has(evt.id);
    const wasOriginal = modalOriginalEventIds.has(evt.id);

    card.innerHTML = `
      <input type="checkbox" value="${evt.id}" ${isChecked ? 'checked' : ''}>
      <div class="evt-details">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="evt-name">${evt.name}</span>
          ${wasOriginal ? '<span style="font-size:0.68rem; background:#f1f5f9; color:#475569; padding:0.15rem 0.4rem; border-radius:4px; font-weight:700;">CURRENT</span>' : ''}
        </div>
        <span class="evt-cat">${evt.category}</span>
        ${evt.has_themes ? '<span class="evt-theme-notice"><i class="fa-solid fa-code"></i> Includes 5 Themes</span>' : ''}
      </div>
    `;

    const checkbox = card.querySelector('input');
    checkbox.addEventListener('change', (e) => {
      handleModalEventToggle(evt, e.target.checked);
    });

    if (evt.day === 'day1') {
      gridDay1.appendChild(card);
    } else {
      gridDay2.appendChild(card);
    }
  });

  renderModalHackathonThemeContainer();
  updateModalCheckboxStates();
}

function handleModalEventToggle(evt, isChecked) {
  if (!currentEditingEventStudent) return;
  const st = currentEditingEventStudent;

  if (isChecked) {
    const selectedList = eventCatalog.filter(e => modalSelectedEventIds.has(e.id));
    const day1Count = selectedList.filter(e => e.day === 'day1').length;
    const day2Count = selectedList.filter(e => e.day === 'day2').length;

    if (evt.day === 'day1' && day1Count >= LIMITS.day1Max) {
      showAlert(`Maximum ${LIMITS.day1Max} events allowed for Day 1.`);
      return renderModalEventsSelection();
    }
    if (evt.day === 'day2' && day2Count >= LIMITS.day2Max) {
      showAlert(`Maximum ${LIMITS.day2Max} events allowed for Day 2.`);
      return renderModalEventsSelection();
    }

    modalSelectedEventIds.add(evt.id);
  } else {
    modalSelectedEventIds.delete(evt.id);
  }

  renderModalHackathonThemeContainer();
  updateModalCheckboxStates();
  updateEventChangeDiff();
}

function updateModalCheckboxStates() {
  const selectedList = eventCatalog.filter(e => modalSelectedEventIds.has(e.id));
  const day1Count = selectedList.filter(e => e.day === 'day1').length;
  const day2Count = selectedList.filter(e => e.day === 'day2').length;

  const counterDay1 = document.getElementById('mCounterDay1');
  const counterDay2 = document.getElementById('mCounterDay2');

  if (counterDay1) counterDay1.textContent = `Selected: ${day1Count} / ${LIMITS.day1Max}`;
  if (counterDay2) counterDay2.textContent = `Selected: ${day2Count} / ${LIMITS.day2Max}`;

  document.querySelectorAll('.modal-events-grid .event-checkbox-card').forEach(card => {
    const evtId = card.getAttribute('data-event-id');
    const evt = eventCatalog.find(e => e.id === evtId);
    const cb = card.querySelector('input');

    if (!evt || !cb) return;

    const isChecked = modalSelectedEventIds.has(evtId);
    cb.checked = isChecked;
    card.classList.toggle('selected', isChecked);

    if (!isChecked) {
      if (evt.day === 'day1' && day1Count >= LIMITS.day1Max) {
        cb.disabled = true;
        card.classList.add('disabled');
      } else if (evt.day === 'day2' && day2Count >= LIMITS.day2Max) {
        cb.disabled = true;
        card.classList.add('disabled');
      } else {
        cb.disabled = false;
        card.classList.remove('disabled');
      }
    } else {
      cb.disabled = false;
      card.classList.remove('disabled');
    }
  });
}

function renderModalHackathonThemeContainer() {
  const container = document.getElementById('mHackathonThemeContainer');
  const pillsList = document.getElementById('mHackathonThemePills');
  if (!container || !pillsList) return;

  if (modalSelectedEventIds.has('d1_hackathon')) {
    container.style.display = 'block';
    pillsList.innerHTML = HACKATHON_THEMES.map(theme => `
      <button type="button" class="theme-pill ${modalSelectedHackathonTheme === theme ? 'active' : ''}" data-theme="${theme}">
        <i class="fa-solid ${getThemeIcon(theme)}"></i> ${theme}
      </button>
    `).join('');

    pillsList.querySelectorAll('.theme-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        modalSelectedHackathonTheme = btn.getAttribute('data-theme');
        pillsList.querySelectorAll('.theme-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateEventChangeDiff();
      });
    });
  } else {
    container.style.display = 'none';
  }
}

function updateEventChangeDiff() {
  const oldContainer = document.getElementById('mDiffOldEventsList');
  const newContainer = document.getElementById('mDiffNewEventsList');
  const summaryAlert = document.getElementById('mDiffSummaryAlert');

  if (!oldContainer || !newContainer) return;

  oldContainer.innerHTML = '';
  newContainer.innerHTML = '';

  const oldEvtList = eventCatalog.filter(e => modalOriginalEventIds.has(e.id));
  const newEvtList = eventCatalog.filter(e => modalSelectedEventIds.has(e.id));

  const addedIds = Array.from(modalSelectedEventIds).filter(id => !modalOriginalEventIds.has(id));
  const removedIds = Array.from(modalOriginalEventIds).filter(id => !modalSelectedEventIds.has(id));
  const unchangedIds = Array.from(modalSelectedEventIds).filter(id => modalOriginalEventIds.has(id));

  // Render Old Column
  oldEvtList.forEach(evt => {
    const isRemoved = removedIds.includes(evt.id);
    const tag = document.createElement('div');
    tag.className = `diff-evt-tag ${isRemoved ? 'removed' : 'unchanged'}`;
    tag.innerHTML = `
      <span>${evt.name} (${evt.day.toUpperCase()})</span>
      <span class="diff-badge ${isRemoved ? 'rem' : 'same'}">${isRemoved ? '<i class="fa-solid fa-xmark"></i> Removed' : '<i class="fa-solid fa-check"></i> Kept'}</span>
    `;
    oldContainer.appendChild(tag);
  });

  if (oldEvtList.length === 0) {
    oldContainer.innerHTML = `<span style="color:#64748b; font-size:0.85rem;">No original events</span>`;
  }

  // Render New Column
  newEvtList.forEach(evt => {
    const isAdded = addedIds.includes(evt.id);
    const tag = document.createElement('div');
    tag.className = `diff-evt-tag ${isAdded ? 'added' : 'unchanged'}`;
    const isHackathon = evt.id === 'd1_hackathon';
    const themeSuffix = isHackathon ? ` [${modalSelectedHackathonTheme}]` : '';

    tag.innerHTML = `
      <span>${evt.name}${themeSuffix} (${evt.day.toUpperCase()})</span>
      <span class="diff-badge ${isAdded ? 'add' : 'same'}">${isAdded ? '<i class="fa-solid fa-plus"></i> Added' : '<i class="fa-solid fa-check"></i> Kept'}</span>
    `;
    newContainer.appendChild(tag);
  });

  if (newEvtList.length === 0) {
    newContainer.innerHTML = `<span style="color:#dc2626; font-size:0.85rem; font-weight:700;">No events selected! (At least 1 required)</span>`;
  }

  // Summary Alert
  if (addedIds.length === 0 && removedIds.length === 0) {
    summaryAlert.style.background = '#f1f5f9';
    summaryAlert.style.color = '#475569';
    summaryAlert.innerHTML = `<i class="fa-solid fa-circle-info"></i> No changes made to current event selections.`;
  } else {
    summaryAlert.style.background = '#eff6ff';
    summaryAlert.style.color = '#1e40af';
    summaryAlert.innerHTML = `
      <i class="fa-solid fa-code-compare"></i> Summary of changes: 
      <strong style="color:#059669; margin-left:0.3rem;">+${addedIds.length} Added</strong>, 
      <strong style="color:#dc2626; margin-left:0.3rem;">-${removedIds.length} Removed</strong>, 
      <strong style="color:#334155; margin-left:0.3rem;">${unchangedIds.length} Kept</strong>
    `;
  }
}

async function handleSubmitEventChangeRequest() {
  if (!currentEditingEventStudent) return;

  const studentId = document.getElementById('editEventStudentId').value;
  let eventName = '';
  if (typeof currentCoordinatorEventId !== 'undefined' && currentCoordinatorEventId) {
    const ev = (typeof eventCatalog !== 'undefined' && eventCatalog) ? eventCatalog.find(e => e.id === currentCoordinatorEventId) : null;
    if (ev) eventName = ev.name;
  } else if (typeof currentMasterSelectedEventId !== 'undefined' && currentMasterSelectedEventId) {
    const ev = (typeof eventCatalog !== 'undefined' && eventCatalog) ? eventCatalog.find(e => e.id === currentMasterSelectedEventId) : null;
    if (ev) eventName = ev.name;
  }
  if (!eventName && currentEditingEventStudent && currentEditingEventStudent.events && currentEditingEventStudent.events.length > 0) {
    eventName = currentEditingEventStudent.events.map(e => e.name || e.event_name).filter(Boolean).join(', ');
  }
  if (!eventName) eventName = 'Event Issue Desk';
  const coordinatorName = eventName;
  const reason = '';

  if (modalSelectedEventIds.size === 0) {
    return showAlert('At least one event must be selected.');
  }

  const addedIds = Array.from(modalSelectedEventIds).filter(id => !modalOriginalEventIds.has(id));
  const removedIds = Array.from(modalOriginalEventIds).filter(id => !modalSelectedEventIds.has(id));

  // Check if anything actually changed
  if (addedIds.length === 0 && removedIds.length === 0) {
    const proceed = await showConfirm('No events were added or removed. Submit change request anyway?', 'No Changes Detected', 'Yes, Submit', 'Cancel');
    if (!proceed) {
      return;
    }
  }

  const btnSubmit = document.getElementById('btnSubmitEventChangeRequest');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting Request...`;

  try {
    const res = await fetch('/api/coordinator/event-change-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: parseInt(studentId),
        coordinatorName,
        eventName,
        newEventIds: Array.from(modalSelectedEventIds),
        hackathonTheme: modalSelectedEventIds.has('d1_hackathon') ? modalSelectedHackathonTheme : null,
        reason
      })
    });

    const data = await res.json();
    if (data.success) {
      showAlert('Event modification request submitted successfully to Admin Dashboard for review!');
      closeModal('modalEditParticipantEvents');
      loadEventIssueParticipants();
      loadAdminEventChangeRequests();
      if (typeof LiveSyncEngine !== 'undefined') {
        LiveSyncEngine.triggerImmediateSync();
      }
    } else {
      showAlert(`Submission Failed: ${data.message}`);
    }
  } catch (err) {
    console.error('Error submitting event change request:', err);
    showAlert('Server error submitting event change request.', 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Submit Change Request to Admin`;
  }
}

// ==========================================================
// ADMIN DASHBOARD: EVENT CHANGE REQUESTS QUEUE & APPROVALS
// ==========================================================

async function loadAdminEventChangeRequests() {
  try {
    const res = await fetch('/api/admin/event-change-requests');
    const data = await res.json();
    if (data.success) {
      renderAdminEventChangeRequestsTable(data.requests || []);
    }
  } catch (err) {
    console.error('Error loading admin event change requests:', err);
  }
}

function renderAdminEventChangeRequestsTable(requests) {
  const tbody = document.getElementById('adminEventRequestsTableBody');
  const badge = document.getElementById('pendingEventRequestsBadge');
  if (!tbody) return;

  const pendingRequests = requests.filter(r => (r.status || '').toUpperCase() === 'PENDING');
  if (badge) badge.textContent = `${pendingRequests.length} Pending`;

  tbody.innerHTML = '';

  if (requests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #64748b;">No event change requests found.</td></tr>`;
    return;
  }

  requests.forEach((req, idx) => {
    const tr = document.createElement('tr');
    const isPending = (req.status || '').toUpperCase() === 'PENDING';
    const isApproved = (req.status || '').toUpperCase() === 'APPROVED';
    const timeStr = req.created_at ? new Date(req.created_at).toLocaleString() : '';

    let oldEvts = Array.isArray(req.old_events) ? req.old_events : [];
    if (typeof req.old_events === 'string') {
      try { oldEvts = JSON.parse(req.old_events); } catch (e) { }
    }
    let newEvts = Array.isArray(req.new_events) ? req.new_events : [];
    if (typeof req.new_events === 'string') {
      try { newEvts = JSON.parse(req.new_events); } catch (e) { }
    }

    const oldIds = oldEvts.map(e => e.id);
    const newIds = newEvts.map(e => e.id);

    // Render Old Events list with removed highlights
    const oldHtml = oldEvts.map(e => {
      const isRemoved = !newIds.includes(e.id);
      return `<div class="admin-diff-tag ${isRemoved ? 'rem' : 'same'}">
        <span>${isRemoved ? '❌' : '✔'} ${e.name} (${(e.day || '').toUpperCase()})</span>
      </div>`;
    }).join('');

    // Render New Events list with added highlights
    const newHtml = newEvts.map(e => {
      const isAdded = !oldIds.includes(e.id);
      const theme = e.hackathon_theme ? ` [${e.hackathon_theme}]` : '';
      return `<div class="admin-diff-tag ${isAdded ? 'add' : 'same'}">
        <span>${isAdded ? '✨ +' : '✔'} ${e.name}${theme} (${(e.day || '').toUpperCase()})</span>
      </div>`;
    }).join('');

    tr.innerHTML = `
      <td style="text-align:center; font-weight:700;">${idx + 1}</td>
      <td>
        <strong style="color:#0f172a;">${req.student_name}</strong>
        <div style="font-size:0.78rem; color:#0284c7; font-weight:700;">${req.reg_code}</div>
        <div style="font-size:0.75rem; color:#64748b;">${req.college} (${(req.day_selection || '').toUpperCase()})</div>
      </td>
      <td><div class="admin-diff-cell">${oldHtml || '<span style="color:#64748b;">None</span>'}</div></td>
      <td><div class="admin-diff-cell">${newHtml || '<span style="color:#64748b;">None</span>'}</div></td>
      <td>
        <div style="font-size:0.85rem; font-weight:700; color:#1e0b36;"><i class="fa-solid fa-calendar-check" style="color:#0284c7;"></i> ${req.event_name || req.coordinator_name || 'Event Desk'}</div>
        ${req.reason ? `<div style="font-size:0.78rem; color:#475569; margin-top:0.2rem;"><em>"${req.reason}"</em></div>` : ''}
        <div style="font-size:0.75rem; color:#64748b; margin-top:0.2rem;">${timeStr}</div>
      </td>
      <td style="text-align:center;">
        ${isPending ? `
          <div class="decision-pill-group">
            <span class="status-pill pending" style="background:#fef3c7; color:#b45309; border:1px solid #fcd34d; font-weight:700; padding:0.35rem 0.75rem; border-radius:9999px; display:inline-flex; align-items:center; gap:0.35rem; font-size:0.8rem;">
              <i class="fa-solid fa-clock"></i> Pending Admin Approval
            </span>
            <div class="decision-meta" style="font-size:0.75rem; color:#64748b; margin-top:0.25rem;">Awaiting Admin Review</div>
          </div>
        ` : `
          <div class="decision-pill-group">
            <span class="status-pill ${isApproved ? 'green' : 'red'}"><i class="fa-solid ${isApproved ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${isApproved ? 'Proceeded / Approved' : 'Rejected'}</span>
            <div class="decision-meta">by <strong>${req.admin_name || 'Admin'}</strong></div>
            <div class="decision-time">${req.approved_at ? new Date(req.approved_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</div>
          </div>
        `}
      </td>
    `;

    tbody.appendChild(tr);
  });
}

window.handleAdminApproveEventChangeRequest = async function (requestId) {
  if (!await showConfirm('The participant event registrations will be automatically updated immediately.', 'Approve Event Change?', 'Yes, Proceed', 'Cancel')) return;

  try {
    const res = await fetch('/api/admin/event-change-request/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, adminName: 'Admin' })
    });
    const data = await res.json();
    if (data.success) {
      showAlert('Event modification proceeded & approved! Participant event selections updated.');
      loadMasterApprovals();
      loadMasterStudentDirectory();
      loadMasterAdminDashboard();
      loadAdminEventChangeRequests();
      loadEventIssueParticipants();
      loadEventCatalog();
      if (currentCoordinatorEventId) {
        loadEventParticipants(currentCoordinatorEventId);
      }
      if (typeof currentMasterSelectedEventId !== 'undefined' && currentMasterSelectedEventId) {
        loadMasterEventParticipants(currentMasterSelectedEventId);
      }
      if (typeof LiveSyncEngine !== 'undefined') {
        LiveSyncEngine.triggerImmediateSync();
      }
    } else {
      showAlert(`Action Failed: ${data.message}`);
    }
  } catch (err) {
    console.error('Approve event request error:', err);
    showAlert('Server error processing event request.');
  }
};

window.handleAdminRejectEventChangeRequest = async function (requestId) {
  if (!await showConfirm('Original event registrations will be kept unchanged.', 'Reject Event Change?', 'Yes, Reject', 'Cancel')) return;

  try {
    const res = await fetch('/api/admin/event-change-request/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, adminName: 'Admin' })
    });
    const data = await res.json();
    if (data.success) {
      showAlert('Event modification request rejected.');
      loadMasterApprovals();
      loadMasterAdminDashboard();
      loadAdminEventChangeRequests();
      loadEventIssueParticipants();
      if (typeof LiveSyncEngine !== 'undefined') {
        LiveSyncEngine.triggerImmediateSync();
      }
    } else {
      showAlert(`Rejection Failed: ${data.message}`);
    }
  } catch (err) {
    console.error('Reject event request error:', err);
    showAlert('Server error rejecting event request.');
  }
};

function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    el.classList.add('active');
    el.style.display = 'flex';
  }
}
window.openModal = openModal;

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    el.classList.remove('active');
    el.style.display = 'none';
  }
}
window.closeModal = closeModal;

// Global Backdrop Click & Escape Key to Close Active Modals
document.addEventListener('click', (e) => {
  if (e.target && e.target.classList && e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
    e.target.style.display = 'none';
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(modal => {
      modal.classList.remove('active');
      modal.style.display = 'none';
    });
  }
});

// ==========================================================
// MASTER ADMIN PORTAL: FULL CONTROLLER & LOGIC
// ==========================================================

let currentMasterStudents = [];
let currentMasterDirFilterSource = 'all';
let currentMasterDirFilterPass = 'all';
let currentMasterActiveSubtab = 'directory';
let currentMasterSelectedEventId = null;
let currentMasterEventStudents = [];
let masterSelectedFfPlayerIds = new Set();
let currentMasterFfSoloPlayers = [];
let currentMasterFfTeams = [];
let currentMasterEventsDayFilter = 'all';
let currentMasterEventsViewMode = 'detailed';
let currentMasterFilteredEventsList = [];

function initMasterAdminPortal() {
  // 1. Refresh button
  const btnRefresh = document.getElementById('btnAdminMasterRefresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadMasterAdminDashboard();
    });
  }

  // 2. Subtab switcher
  document.querySelectorAll('.admin-tab-btn').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      const targetSubtab = tabBtn.getAttribute('data-admin-subtab');
      switchMasterAdminSubtab(targetSubtab);
    });
  });

  // 3. Directory Search
  const dirSearchInput = document.getElementById('adminDirSearchInput');
  if (dirSearchInput) {
    dirSearchInput.addEventListener('input', filterMasterDirectoryTable);
  }
  const clearDirSearch = document.getElementById('clearAdminDirSearch');
  if (clearDirSearch) {
    clearDirSearch.addEventListener('click', () => {
      if (dirSearchInput) dirSearchInput.value = '';
      filterMasterDirectoryTable();
    });
  }

  // 4. Source Filter Pills
  document.querySelectorAll('[data-dir-source]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-dir-source]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMasterDirFilterSource = btn.getAttribute('data-dir-source');
      filterMasterDirectoryTable();
    });
  });

  // 5. Pass Filter Pills
  document.querySelectorAll('[data-dir-pass]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-dir-pass]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMasterDirFilterPass = btn.getAttribute('data-dir-pass');
      filterMasterDirectoryTable();
    });
  });

  // 6. Free Fire Hub Subtab Switcher
  const btnFfSolo = document.getElementById('btnAdminFfSubSolo');
  const btnFfTeams = document.getElementById('btnAdminFfSubTeams');
  if (btnFfSolo && btnFfTeams) {
    btnFfSolo.addEventListener('click', () => {
      btnFfSolo.classList.add('active');
      btnFfTeams.classList.remove('active');
      document.getElementById('adminFfSoloSection').style.display = 'block';
      document.getElementById('adminFfTeamsSection').style.display = 'none';
      loadMasterUnassignedSoloPlayers();
    });
    btnFfTeams.addEventListener('click', () => {
      btnFfTeams.classList.add('active');
      btnFfSolo.classList.remove('active');
      document.getElementById('adminFfSoloSection').style.display = 'none';
      document.getElementById('adminFfTeamsSection').style.display = 'block';
      loadMasterFreeFireTeams();
    });
  }

  // 7. Free Fire Solo Search
  const ffSoloSearch = document.getElementById('adminFfSoloSearchInput');
  if (ffSoloSearch) ffSoloSearch.addEventListener('input', filterMasterFfSoloTable);
  const clearFfSoloSearch = document.getElementById('clearAdminFfSoloSearch');
  if (clearFfSoloSearch) {
    clearFfSoloSearch.addEventListener('click', () => {
      if (ffSoloSearch) ffSoloSearch.value = '';
      filterMasterFfSoloTable();
    });
  }

  // 8. Form Team Button in Admin Free Fire Hub
  const btnFormTeam = document.getElementById('btnAdminFormFfTeam');
  if (btnFormTeam) {
    btnFormTeam.addEventListener('click', handleMasterFormFfTeam);
  }

  // 9. Free Fire Team Search
  const ffTeamSearch = document.getElementById('adminFfTeamSearchInput');
  if (ffTeamSearch) ffTeamSearch.addEventListener('input', filterMasterFfTeamsGrid);

  // 10. Master Event Coordinator Desk & Sequential Navigator
  // 10a. View Mode Switcher
  const btnViewDetailed = document.getElementById('btnAdminViewDetailed');
  const btnViewMatrix = document.getElementById('btnAdminViewMatrix');
  if (btnViewDetailed && btnViewMatrix) {
    btnViewDetailed.addEventListener('click', () => {
      switchMasterEventsViewMode('detailed');
    });
    btnViewMatrix.addEventListener('click', () => {
      switchMasterEventsViewMode('matrix');
    });
  }

  // 10b. Day Filter Chips
  document.querySelectorAll('[data-day-filter]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-day-filter]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentMasterEventsDayFilter = chip.getAttribute('data-day-filter') || 'all';
      if (currentMasterEventsViewMode === 'matrix') {
        renderAllEventsMatrix();
      } else {
        renderMasterDynamicEvents(currentMasterEventsDayFilter);
      }
    });
  });

  // 10c. Sequential Navigation Buttons (Prev / Next)
  const btnPrev = document.getElementById('btnAdminPrevEvent');
  const btnNext = document.getElementById('btnAdminNextEvent');
  if (btnPrev) btnPrev.addEventListener('click', handleAdminPrevEvent);
  if (btnNext) btnNext.addEventListener('click', handleAdminNextEvent);

  // 10d. Quick Jump Select Dropdown
  const jumpSelect = document.getElementById('adminEventQuickJumpSelect');
  if (jumpSelect) {
    jumpSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        selectMasterCoordinatorEvent(e.target.value);
      }
    });
  }

  // 10e. Single Event Export Roster Button
  const btnExportCurrentEvt = document.getElementById('btnAdminExportCurrentEvent');
  if (btnExportCurrentEvt) {
    btnExportCurrentEvt.addEventListener('click', handleAdminExportCurrentEvent);
  }

  // 10f. Search inside Active Event
  const insideEvtSearch = document.getElementById('adminInsideEventSearch');
  if (insideEvtSearch) insideEvtSearch.addEventListener('input', filterMasterInsideEventTable);
  const clearInsideEvtSearch = document.getElementById('clearAdminInsideEventSearch');
  if (clearInsideEvtSearch) {
    clearInsideEvtSearch.addEventListener('click', () => {
      if (insideEvtSearch) insideEvtSearch.value = '';
      filterMasterInsideEventTable();
    });
  }

  // 10g. Global Keyboard Navigation (ArrowLeft / ArrowRight) for Sequential Browsing
  document.addEventListener('keydown', (e) => {
    if (currentMasterActiveSubtab !== 'events') return;
    if (currentMasterEventsViewMode !== 'detailed') return;
    const activeTag = document.activeElement ? document.activeElement.tagName.toUpperCase() : '';
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handleAdminPrevEvent();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleAdminNextEvent();
    }
  });

  // 11. System Info Refresh
  const btnRefreshSys = document.getElementById('btnRefreshSystemInfo');
  if (btnRefreshSys) {
    btnRefreshSys.addEventListener('click', loadMasterSystemInfo);
  }
}

function switchMasterAdminSubtab(subtabName) {
  currentMasterActiveSubtab = subtabName;
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-admin-subtab') === subtabName);
  });
  document.querySelectorAll('.admin-subtab-pane').forEach(pane => {
    pane.classList.remove('active');
  });

  const targetPaneMap = {
    directory: 'adminPaneDirectory',
    approvals: 'adminPaneApprovals',
    freefire: 'adminPaneFreefire',
    counters: 'adminPaneCounters',
    'counter-reg': 'adminPaneCounterReg',
    events: 'adminPaneEvents',
    export: 'adminPaneExport',
    system: 'adminPaneSystem',
    'access-control': 'adminPaneAccessControl'
  };

  const targetPaneId = targetPaneMap[subtabName] || 'adminPaneDirectory';
  const targetPane = document.getElementById(targetPaneId);
  if (targetPane) targetPane.classList.add('active');

  // Load relevant data on tab switch
  if (subtabName === 'directory') loadMasterStudentDirectory();
  else if (subtabName === 'approvals') loadMasterApprovals();
  else if (subtabName === 'freefire') {
    loadMasterUnassignedSoloPlayers();
    loadMasterFreeFireTeams();
  } else if (subtabName === 'counters') {
    loadAdminCounters();
  } else if (subtabName === 'counter-reg') {
    loadCounterReport();
  } else if (subtabName === 'events') {
    if (currentMasterEventsViewMode === 'matrix') {
      renderAllEventsMatrix();
    } else {
      renderMasterDynamicEvents(currentMasterEventsDayFilter || 'all');
    }
  } else if (subtabName === 'system') {
    loadMasterSystemInfo();
  } else if (subtabName === 'access-control') {
    loadAdminCredentials();
  }
}

async function loadMasterAdminDashboard() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    if (data.success) {
      const s = data.stats;

      const elOnline = document.getElementById('kpiAdminOnlineCount');
      const elSpot = document.getElementById('kpiAdminSpotCount');
      const elFfPlayers = document.getElementById('kpiAdminFfPlayersCount');
      const elFfTeams = document.getElementById('kpiAdminFfTeamsCount');
      const elTotal = document.getElementById('kpiAdminTotalCount');
      const elPassBreakdown = document.getElementById('kpiAdminPassBreakdown');
      const elRevenue = document.getElementById('kpiAdminTotalRevenue');
      const elPendingTotal = document.getElementById('kpiAdminPendingTotal');
      const elPendingSub = document.getElementById('kpiAdminPendingSub');
      const elTabBadge = document.getElementById('tabApprovalsBadge');

      if (elOnline) elOnline.textContent = s.onlineCount;
      if (elSpot) elSpot.textContent = s.spotCount;
      if (elFfPlayers) elFfPlayers.textContent = s.freefireTotalPlayers;
      if (elFfTeams) elFfTeams.textContent = `${s.freefireTeamsCount} Squads / Teams formed`;
      if (elTotal) elTotal.textContent = s.totalStudents;
      if (elPassBreakdown) elPassBreakdown.textContent = `Day 1: ${s.day1Count} | Day 2: ${s.day2Count} | Both: ${s.bothDaysCount}`;
      if (elRevenue) elRevenue.textContent = `₹${(s.totalRevenue || 0).toLocaleString('en-IN')}`;

      const totalPending = (s.pendingProfileRequestsCount || 0) + (s.pendingEventRequestsCount || 0);
      if (elPendingTotal) elPendingTotal.textContent = totalPending;
      if (elPendingSub) elPendingSub.textContent = `${s.pendingProfileRequestsCount || 0} Profile | ${s.pendingEventRequestsCount || 0} Event Changes`;
      if (elTabBadge) elTabBadge.textContent = totalPending;
    }

    // Refresh active subtab data
    switchMasterAdminSubtab(currentMasterActiveSubtab);
  } catch (err) {
    console.error('Error loading master admin dashboard:', err);
  }
}

// ----------------------------------------------------------
// 1. MASTER PARTICIPANT DIRECTORY LOGIC
// ----------------------------------------------------------
async function loadMasterStudentDirectory() {
  try {
    const res = await fetch('/api/admin/all-students');
    const data = await res.json();
    if (data.success) {
      currentMasterStudents = data.students || [];
      filterMasterDirectoryTable();
    }
  } catch (err) {
    console.error('Error loading master student directory:', err);
  }
}

function filterMasterDirectoryTable() {
  const query = (document.getElementById('adminDirSearchInput') ? document.getElementById('adminDirSearchInput').value : '').trim().toLowerCase();
  const source = currentMasterDirFilterSource;
  const pass = currentMasterDirFilterPass;

  const filtered = currentMasterStudents.filter(st => {
    // Source filter
    if (source !== 'all') {
      const regType = (st.registration_type || 'ONLINE').toLowerCase();
      if (source === 'online') {
        if (regType !== 'online') return false;
      } else if (source === 'online_invalid') {
        if (regType !== 'online_invalid' && !regType.includes('invalid')) return false;
      } else if (source === 'spot') {
        if (regType !== 'spot') return false;
      } else {
        if (regType !== source.toLowerCase()) return false;
      }
    }
    // Pass filter
    if (pass !== 'all') {
      if (pass === 'day1' && st.day_selection !== 'day1' && st.day_selection !== 'both') return false;
      if (pass === 'day2' && st.day_selection !== 'day2' && st.day_selection !== 'both') return false;
      if (pass === 'both' && st.day_selection !== 'both') return false;
    }
    // Query search
    if (query) {
      const matchName = (st.name || '').toLowerCase().includes(query);
      const matchPhone = (st.phone || '').includes(query);
      const matchCollege = (st.college || '').toLowerCase().includes(query);
      const matchEmail = (st.email || '').toLowerCase().includes(query);
      const matchReg = (st.reg_code || '').toLowerCase().includes(query);
      if (!matchName && !matchPhone && !matchCollege && !matchEmail && !matchReg) return false;
    }
    return true;
  });

  const countLabel = document.getElementById('adminDirCountLabel');
  if (countLabel) {
    countLabel.textContent = `Showing ${filtered.length} of ${currentMasterStudents.length} participants`;
  }

  renderMasterDirectoryTable(filtered);
}

function renderMasterDirectoryTable(students) {
  const tbody = document.getElementById('adminDirTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2.5rem; color: #64748b;">No matching participants found.</td></tr>`;
    return;
  }

  students.forEach((st, idx) => {
    const tr = document.createElement('tr');

    const regType = (st.registration_type || 'ONLINE').toUpperCase();
    let sourceBadge = '';
    if (regType === 'ONLINE_INVALID' || regType.includes('INVALID')) {
      sourceBadge = `<span class="badge-source-online-invalid" title="Imported as invalid/flagged record - Pending desk verification"><i class="fa-solid fa-triangle-exclamation"></i> ONLINE (INVALID)</span>`;
    } else if (regType === 'ONLINE') {
      sourceBadge = `<span class="evt-theme-badge" style="background:#eff6ff; color:#0284c7; border-color:#bfdbfe;"><i class="fa-solid fa-globe"></i> ONLINE (VALID)</span>`;
    } else {
      sourceBadge = `<span class="evt-theme-badge" style="background:#f5f3ff; color:#7c3aed; border-color:#ddd6fe;"><i class="fa-solid fa-bolt"></i> SPOT</span>`;
    }

    let passLabel = 'Day 1';
    let passClass = 'd1';
    if (st.day_selection === 'day2') { passLabel = 'Day 2'; passClass = 'd2'; }
    if (st.day_selection === 'both') { passLabel = 'Both Days'; passClass = 'both'; }

    const eventsPills = (st.events || []).map(e => {
      const isCompleted = e.event_status === 'COMPLETED';
      return `<span class="evt-theme-badge ${isCompleted ? 'badge-completed' : ''}" style="margin: 0.15rem; display:inline-block;">${e.event_name} (${(e.event_day || '').toUpperCase()})${e.hackathon_theme ? ` [${e.hackathon_theme}]` : ''}</span>`;
    }).join(' ');

    // Day 1 & Day 2 Food and Tag Actions
    let actionsHtml = '';
    if (st.day_selection === 'day1') {
      const foodBtnHtml = `<button type="button" class="btn-action-sm ${st.food_given ? 'active-green' : ''}" onclick="window.handleMasterQuickAction('${st.id}', 'ISSUE_FOOD_D1')"><i class="fa-solid fa-utensils"></i> ${st.food_given ? '✔ Food' : 'Food'}</button>`;
      const tagBtnHtml = `<button type="button" class="btn-action-sm ${st.tag_given ? 'active-green' : ''}" onclick="window.handleMasterQuickAction('${st.id}', 'ISSUE_TAG_D1')"><i class="fa-solid fa-id-badge"></i> ${st.tag_given ? '✔ Tag' : 'Tag'}</button>`;
      actionsHtml = `<div class="linear-actions-flex">${foodBtnHtml}${tagBtnHtml}</div>`;
    } else if (st.day_selection === 'day2') {
      const foodBtnHtml = `<button type="button" class="btn-action-sm ${st.food_d2_given ? 'active-green' : ''}" onclick="window.handleMasterQuickAction('${st.id}', 'ISSUE_FOOD_D2')"><i class="fa-solid fa-utensils"></i> ${st.food_d2_given ? '✔ Food' : 'Food'}</button>`;
      const tagBtnHtml = `<button type="button" class="btn-action-sm ${st.tag_d2_given ? 'active-green' : ''}" onclick="window.handleMasterQuickAction('${st.id}', 'ISSUE_TAG_D2')"><i class="fa-solid fa-id-badge"></i> ${st.tag_d2_given ? '✔ Tag' : 'Tag'}</button>`;
      actionsHtml = `<div class="linear-actions-flex">${foodBtnHtml}${tagBtnHtml}</div>`;
    } else {
      // Both Days Pass: Day 1 enabled, Day 2 disabled until Day 1 Food & Tag are given
      const d1FoodDone = !!st.food_given;
      const d1TagDone = !!st.tag_given;
      const day2Unlocked = d1FoodDone && d1TagDone;

      const d1FoodBtn = `<button type="button" class="btn-action-sm ${d1FoodDone ? 'active-green' : ''}" onclick="window.handleMasterQuickAction('${st.id}', 'ISSUE_FOOD_D1')" title="Day 1 Food Token"><i class="fa-solid fa-utensils"></i> ${d1FoodDone ? '✔ Food' : 'Food'}</button>`;
      const d1TagBtn = `<button type="button" class="btn-action-sm ${d1TagDone ? 'active-green' : ''}" onclick="window.handleMasterQuickAction('${st.id}', 'ISSUE_TAG_D1')" title="Day 1 ID Tag"><i class="fa-solid fa-id-badge"></i> ${d1TagDone ? '✔ Tag' : 'Tag'}</button>`;

      const d2FoodBtn = `<button type="button" class="btn-action-sm ${st.food_d2_given ? 'active-green' : ''}" ${day2Unlocked ? '' : 'disabled title="Day 2 Food Token disabled until Day 1 Food & Tag are claimed"'} onclick="window.handleMasterQuickAction('${st.id}', 'ISSUE_FOOD_D2')"><i class="fa-solid fa-utensils"></i> ${st.food_d2_given ? '✔ Food' : 'Food'}</button>`;
      const d2TagBtn = `<button type="button" class="btn-action-sm ${st.tag_d2_given ? 'active-green' : ''}" ${day2Unlocked ? '' : 'disabled title="Day 2 Tag disabled until Day 1 Food & Tag are claimed"'} onclick="window.handleMasterQuickAction('${st.id}', 'ISSUE_TAG_D2')"><i class="fa-solid fa-id-badge"></i> ${st.tag_d2_given ? '✔ Tag' : 'Tag'}</button>`;

      actionsHtml = `
        <div class="day-action-group both-days-group">
          <div class="day-action-row">
            <span class="day-mini-badge d1">D1:</span>
            ${d1FoodBtn}
            ${d1TagBtn}
          </div>
          <div class="day-action-row ${day2Unlocked ? '' : 'row-locked'}" style="margin-top:0.3rem;">
            <span class="day-mini-badge d2 ${day2Unlocked ? '' : 'badge-locked'}">D2:</span>
            ${d2FoodBtn}
            ${d2TagBtn}
          </div>
        </div>
      `;
    }

    const editBtnHtml = `
      <button type="button" class="btn-edit-sm" style="background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1;" onclick="window.handleOpenEditEventsModal('${st.id}')">
        <i class="fa-solid fa-pen-to-square"></i> Events
      </button>
    `;

    tr.innerHTML = `
      <td style="text-align:center; font-weight:700;">${idx + 1}</td>
      <td><span class="reg-pill" style="font-size:0.78rem; font-weight:800; background:#0284c7; color:#fff; padding:0.2rem 0.5rem; border-radius:4px;">${st.reg_code}</span></td>
      <td>
        <strong style="color:#0f172a; white-space:nowrap;">${st.name}</strong>
        <div style="font-size:0.75rem; color:#64748b;">Fee: ₹${st.total_fee}</div>
      </td>
      <td>
        <div><i class="fa-solid fa-phone" style="font-size:0.7rem; color:#64748b;"></i> ${st.phone}</div>
        <div style="font-size:0.78rem; color:#64748b;"><i class="fa-solid fa-envelope" style="font-size:0.7rem; color:#64748b;"></i> ${st.email || 'N/A'}</div>
      </td>
      <td><span style="color:#334155; font-size:0.85rem;">${st.college}</span></td>
      <td>
        <div style="display:flex; flex-direction:column; gap:0.25rem;">
          ${sourceBadge}
          <span class="evt-day-badge ${passClass}" style="font-size:0.72rem;">${passLabel}</span>
        </div>
      </td>
      <td><div style="max-width:280px; line-height:1.4;">${eventsPills || '<span style="color:#94a3b8;">No events</span>'}</div></td>
      <td>${actionsHtml}</td>
      <td style="text-align:center;">${editBtnHtml}</td>
    `;

    tbody.appendChild(tr);
  });
}

window.handleMasterQuickAction = async function (studentId, actionType) {
  try {
    const res = await fetch('/api/coordinator/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, actionType })
    });
    const data = await res.json();
    if (data.success) {
      loadMasterStudentDirectory();
      if (typeof LiveSyncEngine !== 'undefined') {
        LiveSyncEngine.triggerImmediateSync();
      }
    } else {
      showAlert(`Action Failed: ${data.message}`);
    }
  } catch (err) {
    console.error('Quick action error:', err);
    showAlert('Server error processing action.');
  }
};

// ----------------------------------------------------------
// 2. MASTER APPROVALS DESK LOGIC
// ----------------------------------------------------------
async function loadMasterApprovals() {
  try {
    const [profRes, evtRes] = await Promise.all([
      fetch('/api/admin/edit-requests'),
      fetch('/api/admin/event-change-requests')
    ]);

    const profData = await profRes.json();
    const evtData = await evtRes.json();

    if (profData.success) {
      renderMasterProfileRequests(profData.requests || []);
    }
    if (evtData.success) {
      renderMasterEventRequests(evtData.requests || []);
    }
  } catch (err) {
    console.error('Error loading master approvals:', err);
  }
}

function renderMasterProfileRequests(requests) {
  const tbody = document.getElementById('adminMasterProfileRequestsBody');
  const badge = document.getElementById('adminMasterPendingProfileBadge');
  if (!tbody) return;

  const pending = requests.filter(r => (r.status || '').toUpperCase() === 'PENDING');
  if (badge) badge.textContent = `${pending.length} Pending`;

  tbody.innerHTML = '';
  if (requests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2.5rem; color: #64748b;"><i class="fa-solid fa-clipboard-check" style="font-size:1.5rem; color:#94a3b8; display:block; margin-bottom:0.5rem;"></i> No profile modification requests found.</td></tr>`;
    return;
  }

  requests.forEach((req, idx) => {
    const tr = document.createElement('tr');

    let oldData = typeof req.old_data === 'object' && req.old_data !== null ? req.old_data : {};
    if (typeof req.old_data === 'string') {
      try { oldData = JSON.parse(req.old_data); } catch (e) { }
    }
    let newData = typeof req.new_data === 'object' && req.new_data !== null ? req.new_data : {};
    if (typeof req.new_data === 'string') {
      try { newData = JSON.parse(req.new_data); } catch (e) { }
    }

    const isPending = (req.status || '').toUpperCase() === 'PENDING';
    const isApproved = (req.status || '').toUpperCase() === 'APPROVED';
    const timeStr = req.created_at ? new Date(req.created_at).toLocaleString() : '';

    const nameChanged = (oldData.name || '').trim() !== (newData.name || '').trim();
    const phoneChanged = (oldData.phone || '').trim() !== (newData.phone || '').trim();
    const emailChanged = (oldData.email || '').trim() !== (newData.email || '').trim();
    const collegeChanged = (oldData.college || '').trim() !== (newData.college || '').trim();

    const oldNameHtml = `<div class="diff-row"><span class="diff-label">Name:</span> <span class="diff-val">${oldData.name || '-'}</span></div>`;
    const oldPhoneHtml = `<div class="diff-row"><span class="diff-label">Phone:</span> <span class="diff-val font-mono">${oldData.phone || '-'}</span></div>`;
    const oldEmailHtml = `<div class="diff-row"><span class="diff-label">Email:</span> <span class="diff-val">${oldData.email || '-'}</span></div>`;
    const oldCollegeHtml = `<div class="diff-row"><span class="diff-label">College:</span> <span class="diff-val">${oldData.college || '-'}</span></div>`;

    const newNameHtml = `<div class="diff-row"><span class="diff-label">Name:</span> <span class="diff-val ${nameChanged ? 'modified' : ''}">${newData.name || '-'} ${nameChanged ? '<span class="diff-badge-edit">UPDATED</span>' : ''}</span></div>`;
    const newPhoneHtml = `<div class="diff-row"><span class="diff-label">Phone:</span> <span class="diff-val font-mono ${phoneChanged ? 'modified' : ''}">${newData.phone || '-'} ${phoneChanged ? '<span class="diff-badge-edit">UPDATED</span>' : ''}</span></div>`;
    const newEmailHtml = `<div class="diff-row"><span class="diff-label">Email:</span> <span class="diff-val ${emailChanged ? 'modified' : ''}">${newData.email || '-'} ${emailChanged ? '<span class="diff-badge-edit">UPDATED</span>' : ''}</span></div>`;
    const newCollegeHtml = `<div class="diff-row"><span class="diff-label">College:</span> <span class="diff-val ${collegeChanged ? 'modified' : ''}">${newData.college || '-'} ${collegeChanged ? '<span class="diff-badge-edit">UPDATED</span>' : ''}</span></div>`;

    let decisionHtml = '';
    if (isPending) {
      decisionHtml = `
        <div class="admin-approval-btn-group">
          <button type="button" class="btn-approve-admin" onclick="window.handleAdminApproveEditRequest(${req.id})">
            <i class="fa-solid fa-check"></i> Proceed
          </button>
          <button type="button" class="btn-reject-admin" onclick="window.handleAdminRejectEditRequest(${req.id})">
            <i class="fa-solid fa-xmark"></i> Reject
          </button>
        </div>
      `;
    } else {
      decisionHtml = `
        <div class="decision-pill-group">
          <span class="status-pill ${isApproved ? 'green' : 'red'}">
            <i class="fa-solid ${isApproved ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${isApproved ? 'Proceeded / Approved' : 'Rejected'}
          </span>
          <div class="decision-meta">by <strong>${req.admin_name || 'Admin'}</strong></div>
          <div class="decision-time">${req.approved_at ? new Date(req.approved_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</div>
        </div>
      `;
    }

    tr.innerHTML = `
      <td style="text-align:center; font-weight:700;">${idx + 1}</td>
      <td>
        <strong style="color:#0f172a;">${oldData.name || req.current_name || 'Participant #' + req.student_id}</strong>
        <div style="margin-top:0.2rem;"><span class="reg-pill" style="font-size:0.75rem; background:#0284c7; color:#fff; padding:0.15rem 0.45rem; border-radius:3px; font-weight:800;">${req.reg_code || '#' + req.student_id}</span></div>
      </td>
      <td>
        <div class="diff-box old-box">
          ${oldNameHtml}
          ${oldPhoneHtml}
          ${oldEmailHtml}
          ${oldCollegeHtml}
        </div>
      </td>
      <td>
        <div class="diff-box new-box">
          ${newNameHtml}
          ${newPhoneHtml}
          ${newEmailHtml}
          ${newCollegeHtml}
        </div>
      </td>
      <td>
        <div style="font-size:0.85rem; font-weight:700; color:#1e0b36;"><i class="fa-solid fa-calendar-check" style="color:#0284c7;"></i> ${req.event_name || req.coordinator_name || 'Event Desk'}</div>
        <div style="font-size:0.75rem; color:#64748b; margin-top:0.25rem;"><i class="fa-regular fa-clock"></i> ${timeStr}</div>
      </td>
      <td style="text-align:center;">
        ${decisionHtml}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderMasterEventRequests(requests) {
  const tbody = document.getElementById('adminMasterEventRequestsBody');
  const badge = document.getElementById('adminMasterPendingEventBadge');
  if (!tbody) return;

  const pending = requests.filter(r => (r.status || '').toUpperCase() === 'PENDING');
  if (badge) badge.textContent = `${pending.length} Pending`;

  tbody.innerHTML = '';
  if (requests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2.5rem; color: #64748b;"><i class="fa-solid fa-calendar-check" style="font-size:1.5rem; color:#94a3b8; display:block; margin-bottom:0.5rem;"></i> No event change requests found.</td></tr>`;
    return;
  }

  requests.forEach((req, idx) => {
    const tr = document.createElement('tr');
    let oldEvts = Array.isArray(req.old_events) ? req.old_events : [];
    if (typeof req.old_events === 'string') {
      try { oldEvts = JSON.parse(req.old_events); } catch (e) { }
    }
    let newEvts = Array.isArray(req.new_events) ? req.new_events : [];
    if (typeof req.new_events === 'string') {
      try { newEvts = JSON.parse(req.new_events); } catch (e) { }
    }

    const oldIds = new Set(oldEvts.map(e => e.id));
    const newIds = new Set(newEvts.map(e => e.id));

    const oldHtml = oldEvts.map(e => {
      const isRemoved = !newIds.has(e.id);
      return `<div class="admin-diff-tag ${isRemoved ? 'rem' : 'same'}">${isRemoved ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-check"></i>'} ${e.name} (${(e.day || '').toUpperCase()})</div>`;
    }).join('') || '<span style="color:#94a3b8; font-size:0.8rem;">None</span>';

    const newHtml = newEvts.map(e => {
      const isAdded = !oldIds.has(e.id);
      const themeSuffix = e.hackathon_theme ? ` [${e.hackathon_theme}]` : '';
      return `<div class="admin-diff-tag ${isAdded ? 'add' : 'same'}">${isAdded ? '<i class="fa-solid fa-plus"></i>' : '<i class="fa-solid fa-check"></i>'} ${e.name}${themeSuffix} (${(e.day || '').toUpperCase()})</div>`;
    }).join('') || '<span style="color:#dc2626; font-size:0.8rem;">None</span>';

    const isPending = (req.status || '').toUpperCase() === 'PENDING';
    const isApproved = (req.status || '').toUpperCase() === 'APPROVED';
    const timeStr = req.created_at ? new Date(req.created_at).toLocaleString() : '';

    let decisionHtml = '';
    if (isPending) {
      decisionHtml = `
        <div class="admin-approval-btn-group">
          <button type="button" class="btn-approve-admin" onclick="window.handleAdminApproveEventChangeRequest(${req.id})">
            <i class="fa-solid fa-check"></i> Proceed
          </button>
          <button type="button" class="btn-reject-admin" onclick="window.handleAdminRejectEventChangeRequest(${req.id})">
            <i class="fa-solid fa-xmark"></i> Reject
          </button>
        </div>
      `;
    } else {
      decisionHtml = `
        <div class="decision-pill-group">
          <span class="status-pill ${isApproved ? 'green' : 'red'}">
            <i class="fa-solid ${isApproved ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${isApproved ? 'Proceeded / Approved' : 'Rejected'}
          </span>
          <div class="decision-meta">by <strong>${req.admin_name || 'Admin'}</strong></div>
          <div class="decision-time">${req.approved_at ? new Date(req.approved_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</div>
        </div>
      `;
    }

    tr.innerHTML = `
      <td style="text-align:center; font-weight:700;">${idx + 1}</td>
      <td>
        <strong style="color:#0f172a;">${req.student_name}</strong>
        <div style="font-size:0.78rem; color:#0284c7; font-weight:700; margin-top:0.15rem;">${req.reg_code} | ${req.phone}</div>
        <div style="font-size:0.75rem; color:#64748b;">${req.college} (${(req.day_selection || '').toUpperCase()})</div>
      </td>
      <td><div class="admin-diff-cell">${oldHtml}</div></td>
      <td><div class="admin-diff-cell">${newHtml}</div></td>
      <td>
        <div style="font-size:0.85rem; font-weight:700; color:#1e0b36;"><i class="fa-solid fa-calendar-check" style="color:#0284c7;"></i> ${req.event_name || req.coordinator_name || 'Event Desk'}</div>
        ${req.reason ? `<div style="font-size:0.78rem; color:#475569; margin-top:0.2rem;"><em>"${req.reason}"</em></div>` : ''}
        <div style="font-size:0.75rem; color:#64748b; margin-top:0.25rem;"><i class="fa-regular fa-clock"></i> ${timeStr}</div>
      </td>
      <td style="text-align:center;">
        ${decisionHtml}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ----------------------------------------------------------
// 3. MASTER FREE FIRE HUB LOGIC
// ----------------------------------------------------------
async function loadMasterUnassignedSoloPlayers() {
  try {
    const res = await fetch('/api/freefire/unassigned-online-players');
    const data = await res.json();
    if (data.success) {
      currentMasterFfSoloPlayers = data.players || [];
      const countBadge = document.getElementById('adminFfSoloCount');
      if (countBadge) countBadge.textContent = currentMasterFfSoloPlayers.length;
      filterMasterFfSoloTable();
    }
  } catch (err) {
    console.error('Error loading master FF solo players:', err);
  }
}

function filterMasterFfSoloTable() {
  const query = (document.getElementById('adminFfSoloSearchInput') ? document.getElementById('adminFfSoloSearchInput').value : '').trim().toLowerCase();
  const filtered = currentMasterFfSoloPlayers.filter(p => {
    if (!query) return true;
    return (p.name || '').toLowerCase().includes(query) || (p.phone || '').includes(query) || (p.email || '').toLowerCase().includes(query) || (p.college || '').toLowerCase().includes(query);
  });

  const countLbl = document.getElementById('adminFfSoloSearchCount');
  if (countLbl) countLbl.textContent = `Showing ${filtered.length} solo players`;

  renderMasterFfSoloTable(filtered);
}

function renderMasterFfSoloTable(players) {
  const tbody = document.getElementById('adminFfSoloTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (players.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: #64748b;">No solo online players found.</td></tr>`;
    return;
  }

  players.forEach((p, idx) => {
    const tr = document.createElement('tr');
    const isChecked = masterSelectedFfPlayerIds.has(p.id);

    tr.innerHTML = `
      <td style="text-align:center;">
        <input type="checkbox" value="${p.id}" ${isChecked ? 'checked' : ''} onchange="window.handleMasterFfPlayerToggle(${p.id}, this.checked)">
      </td>
      <td style="font-weight:700;">${idx + 1}</td>
      <td><strong style="color:#0f172a;">${p.name}</strong></td>
      <td><span style="color:#334155;">${p.phone}</span></td>
      <td><span style="color:#334155;">${p.email || '-'}</span></td>
      <td><span style="color:#334155;">${p.college}</span></td>
      <td><span class="evt-theme-badge"><i class="fa-solid fa-globe"></i> ${p.registration_type || 'ONLINE'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

window.handleMasterFfPlayerToggle = function (playerId, isChecked) {
  if (isChecked) {
    if (masterSelectedFfPlayerIds.size >= 4) {
      showAlert('You can select a maximum of 4 players for a Free Fire squad.');
      filterMasterFfSoloTable();
      return;
    }
    masterSelectedFfPlayerIds.add(playerId);
  } else {
    masterSelectedFfPlayerIds.delete(playerId);
  }

  updateMasterFfSelectedChips();
};

function updateMasterFfSelectedChips() {
  const chipsList = document.getElementById('adminFfSelectedChipsList');
  const chipCount = document.getElementById('adminFfSelectedChipCount');
  const actionCount = document.getElementById('adminFfSelectedCount');
  const btnForm = document.getElementById('btnAdminFormFfTeam');

  const count = masterSelectedFfPlayerIds.size;
  if (chipCount) chipCount.textContent = count;
  if (actionCount) actionCount.textContent = count;
  if (btnForm) btnForm.disabled = count !== 4;

  if (!chipsList) return;

  if (count === 0) {
    chipsList.innerHTML = `<span class="no-chips-text">No players selected yet. Search & select 4 players to form team.</span>`;
    return;
  }

  const selectedPlayers = currentMasterFfSoloPlayers.filter(p => masterSelectedFfPlayerIds.has(p.id));
  chipsList.innerHTML = selectedPlayers.map((p, idx) => `
    <div class="whatsapp-chip">
      <span class="chip-avatar"><i class="fa-solid fa-user"></i></span>
      <span class="chip-name">${idx === 0 ? '👑 ' : ''}${p.name}</span>
      <button type="button" class="chip-remove" onclick="window.handleMasterFfPlayerToggle(${p.id}, false)">&times;</button>
    </div>
  `).join('');
}

async function handleMasterFormFfTeam() {
  if (masterSelectedFfPlayerIds.size !== 4) {
    return showAlert('Please select exactly 4 players to form a Free Fire squad.');
  }

  const teamName = prompt('Enter Squad / Team Name (e.g., Cyber Ninjas):');
  if (!teamName || !teamName.trim()) return;

  try {
    const res = await fetch('/api/freefire/create-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamName: teamName.trim(),
        playerIds: Array.from(masterSelectedFfPlayerIds)
      })
    });

    const data = await res.json();
    if (data.success) {
      showAlert(`Team "${teamName}" formed successfully!`);
      masterSelectedFfPlayerIds.clear();
      updateMasterFfSelectedChips();
      loadMasterUnassignedSoloPlayers();
      loadMasterFreeFireTeams();
      loadMasterAdminDashboard();
      if (typeof LiveSyncEngine !== 'undefined') {
        LiveSyncEngine.triggerImmediateSync();
      }
    } else {
      showAlert(`Team formation failed: ${data.message}`);
    }
  } catch (err) {
    console.error('Error forming team:', err);
    showAlert('Server error forming team.');
  }
}

async function loadMasterFreeFireTeams() {
  try {
    const res = await fetch('/api/freefire/teams');
    const data = await res.json();
    if (data.success) {
      currentMasterFfTeams = data.teams || [];
      const countHeader = document.getElementById('adminFfTeamsHeaderCount');
      if (countHeader) countHeader.textContent = currentMasterFfTeams.length;
      filterMasterFfTeamsGrid();
    }
  } catch (err) {
    console.error('Error loading master FF teams:', err);
  }
}

function filterMasterFfTeamsGrid() {
  const query = (document.getElementById('adminFfTeamSearchInput') ? document.getElementById('adminFfTeamSearchInput').value : '').trim().toLowerCase();
  const grid = document.getElementById('adminFfTeamsGrid');
  if (!grid) return;

  const filtered = currentMasterFfTeams.filter(t => {
    if (!query) return true;
    const matchTeam = (t.team_name || '').toLowerCase().includes(query) || (t.team_code || '').toLowerCase().includes(query);
    const matchMember = (t.members || []).some(m => (m.name || '').toLowerCase().includes(query) || (m.phone || '').includes(query) || (m.email || '').toLowerCase().includes(query) || (m.college || '').toLowerCase().includes(query));
    return matchTeam || matchMember;
  });

  const countLbl = document.getElementById('adminFfTeamsSearchCount');
  if (countLbl) countLbl.textContent = `Showing ${filtered.length} teams`;

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="padding: 2rem; text-align: center; color: #64748b;">No Free Fire teams match your search.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(t => {
    const membersHtml = (t.members || []).map((m, idx) => `
      <div class="ff-member-row">
        <span>${idx === 0 ? '👑' : '👤'} <strong>${m.name}</strong> (${m.phone}${m.email ? ' | ' + m.email : ''})</span>
        <span style="font-size:0.75rem; color:#64748b;">${m.college}</span>
      </div>
    `).join('');

    return `
      <div class="ff-team-card">
        <div class="ff-team-header">
          <div>
            <span class="reg-pill" style="font-size:0.72rem; background:#dc2626; color:#fff; padding:0.15rem 0.5rem; border-radius:4px;">${t.team_code}</span>
            <h4 style="margin: 0.35rem 0 0 0; color:#0f172a; font-size:1.15rem;">${t.team_name}</h4>
          </div>
          <button class="btn-edit-ff-team" data-team-id="${t.id}">
            <i class="fa-solid fa-pen-to-square"></i> Edit Team
          </button>
        </div>
        <div class="ff-members-list">${membersHtml}</div>
      </div>
    `;
  }).join('');
}

// ----------------------------------------------------------
// 4. MASTER EVENT COORDINATOR DESK & SEQUENTIAL ACCESS LOGIC
// ----------------------------------------------------------

function switchMasterEventsViewMode(mode) {
  currentMasterEventsViewMode = mode;
  const detailedLayout = document.getElementById('adminDetailedEventsLayout');
  const matrixLayout = document.getElementById('adminMatrixEventsLayout');
  const seqNav = document.getElementById('adminSequentialNavGroup');
  const btnDetailed = document.getElementById('btnAdminViewDetailed');
  const btnMatrix = document.getElementById('btnAdminViewMatrix');

  if (mode === 'matrix') {
    if (detailedLayout) detailedLayout.style.display = 'none';
    if (matrixLayout) matrixLayout.style.display = 'block';
    if (seqNav) seqNav.style.display = 'none';
    if (btnDetailed) btnDetailed.classList.remove('active');
    if (btnMatrix) btnMatrix.classList.add('active');
    renderAllEventsMatrix();
  } else {
    if (detailedLayout) detailedLayout.style.display = 'grid';
    if (matrixLayout) matrixLayout.style.display = 'none';
    if (seqNav) seqNav.style.display = 'flex';
    if (btnDetailed) btnDetailed.classList.add('active');
    if (btnMatrix) btnMatrix.classList.remove('active');
    renderMasterDynamicEvents(currentMasterEventsDayFilter || 'all');
  }
}

function renderMasterDynamicEvents(filterDay) {
  currentMasterEventsDayFilter = filterDay || 'all';
  const container = document.getElementById('adminDynamicEventsList');
  const jumpSelect = document.getElementById('adminEventQuickJumpSelect');
  if (!container) return;
  container.innerHTML = '';

  let dayEvents = [...eventCatalog];
  if (currentMasterEventsDayFilter === 'day1') {
    dayEvents = eventCatalog.filter(e => e.day === 'day1');
  } else if (currentMasterEventsDayFilter === 'day2') {
    dayEvents = eventCatalog.filter(e => e.day === 'day2');
  }

  currentMasterFilteredEventsList = dayEvents;

  if (dayEvents.length === 0) {
    container.innerHTML = `<span style="color:#64748b; font-size:0.85rem; padding:1rem;">No events available.</span>`;
    return;
  }

  // Populate Jump Select Dropdown
  if (jumpSelect) {
    jumpSelect.innerHTML = `<option value="">Jump directly to any event (${dayEvents.length})...</option>` +
      dayEvents.map((evt, idx) => `
        <option value="${evt.id}" ${evt.id === currentMasterSelectedEventId ? 'selected' : ''}>
          #${idx + 1}. ${evt.name} [${evt.day.toUpperCase()}]
        </option>
      `).join('');
  }

  // Ensure current selected event is within active filter
  if (!currentMasterSelectedEventId || !dayEvents.some(e => e.id === currentMasterSelectedEventId)) {
    currentMasterSelectedEventId = dayEvents[0].id;
  }

  // Render Sidebar Event Buttons
  dayEvents.forEach((evt, idx) => {
    const isSelected = evt.id === currentMasterSelectedEventId;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `sidebar-evt-btn ${isSelected ? 'active' : ''}`;
    btn.setAttribute('data-event-id', evt.id);
    btn.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.4rem; overflow:hidden;">
        <span class="evt-seq-num">#${idx + 1}</span>
        <span class="evt-title-truncate">${evt.name}</span>
      </div>
      <span class="evt-count-badge" title="Enrolled Students">${evt.registered_count || 0}</span>
    `;
    btn.addEventListener('click', () => {
      selectMasterCoordinatorEvent(evt.id);
    });
    container.appendChild(btn);
  });

  selectMasterCoordinatorEvent(currentMasterSelectedEventId);
}

async function selectMasterCoordinatorEvent(eventId) {
  currentMasterSelectedEventId = eventId;
  const evt = eventCatalog.find(e => e.id === eventId);
  if (!evt) return;

  const currentList = currentMasterFilteredEventsList.length > 0 ? currentMasterFilteredEventsList : eventCatalog;
  let currentIndex = currentList.findIndex(e => e.id === eventId);
  if (currentIndex === -1) currentIndex = 0;

  // Update Header Banner Details
  const elTitle = document.getElementById('adminEvtTitle');
  const elCat = document.getElementById('adminEvtCategory');
  const elDayBadge = document.getElementById('adminEvtDayBadge');
  const elSeqTag = document.getElementById('adminEvtSeqTag');
  const elSeqIdx = document.getElementById('adminEventSequenceIndex');
  const elSeqTot = document.getElementById('adminEventSequenceTotal');
  const elJumpSelect = document.getElementById('adminEventQuickJumpSelect');

  if (elTitle) elTitle.textContent = evt.name;
  if (elCat) elCat.textContent = `${evt.category || 'General'} • Min: ${evt.min_participants || 1} | Max: ${evt.max_participants || 1}`;
  if (elDayBadge) {
    elDayBadge.textContent = evt.day.toUpperCase();
    elDayBadge.className = `evt-day-badge ${evt.day}`;
  }
  if (elSeqTag) elSeqTag.textContent = `#${currentIndex + 1} of ${currentList.length}`;
  if (elSeqIdx) elSeqIdx.textContent = `Event ${currentIndex + 1}`;
  if (elSeqTot) elSeqTot.textContent = currentList.length;
  if (elJumpSelect) elJumpSelect.value = eventId;

  // Update Navigation Controls State (Prev / Next Buttons)
  const btnPrev = document.getElementById('btnAdminPrevEvent');
  const btnNext = document.getElementById('btnAdminNextEvent');
  if (btnPrev) btnPrev.disabled = (currentIndex <= 0);
  if (btnNext) btnNext.disabled = (currentIndex >= currentList.length - 1);

  // Update Sidebar Highlight
  document.querySelectorAll('#adminDynamicEventsList .sidebar-evt-btn').forEach(btn => {
    const isSelected = btn.getAttribute('data-event-id') === eventId;
    btn.classList.toggle('active', isSelected);
  });

  await loadMasterEventParticipants(eventId);
}

function handleAdminNextEvent() {
  const currentList = currentMasterFilteredEventsList.length > 0 ? currentMasterFilteredEventsList : eventCatalog;
  const currentIndex = currentList.findIndex(e => e.id === currentMasterSelectedEventId);
  if (currentIndex >= 0 && currentIndex < currentList.length - 1) {
    selectMasterCoordinatorEvent(currentList[currentIndex + 1].id);
  }
}

function handleAdminPrevEvent() {
  const currentList = currentMasterFilteredEventsList.length > 0 ? currentMasterFilteredEventsList : eventCatalog;
  const currentIndex = currentList.findIndex(e => e.id === currentMasterSelectedEventId);
  if (currentIndex > 0) {
    selectMasterCoordinatorEvent(currentList[currentIndex - 1].id);
  }
}

function handleAdminExportCurrentEvent() {
  if (!currentMasterSelectedEventId) {
    return showAlert('Please select an event to export.');
  }
  window.open(`/api/admin/export/event/${currentMasterSelectedEventId}`, '_blank');
}

function renderAllEventsMatrix() {
  const grid = document.getElementById('adminAllEventsMatrixGrid');
  const summaryPill = document.getElementById('adminMatrixSummaryPill');
  if (!grid) return;

  let displayEvents = [...eventCatalog];
  if (currentMasterEventsDayFilter === 'day1') {
    displayEvents = eventCatalog.filter(e => e.day === 'day1');
  } else if (currentMasterEventsDayFilter === 'day2') {
    displayEvents = eventCatalog.filter(e => e.day === 'day2');
  }

  if (summaryPill) {
    summaryPill.textContent = `${displayEvents.length} Events Showing`;
  }

  if (displayEvents.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:3rem; color:#64748b;">No events match the active day filter.</div>`;
    return;
  }

  grid.innerHTML = displayEvents.map((evt, idx) => {
    const isStandalone = evt.is_standalone;
    const enrolled = evt.registered_count || 0;

    return `
      <div class="matrix-event-card ${isStandalone ? 'standalone-card' : ''}">
        <div class="matrix-card-header">
          <div style="display:flex; align-items:center; gap:0.4rem;">
            <span class="evt-day-badge ${evt.day}" style="font-size:0.7rem; padding:0.2rem 0.5rem;">${evt.day.toUpperCase()}</span>
            <span class="evt-seq-tag">#${idx + 1}</span>
          </div>
          <span class="matrix-category-tag">${evt.category}</span>
        </div>
        
        <div class="matrix-card-body">
          <h4 class="matrix-event-title">${evt.name}</h4>
          <div class="matrix-card-stats">
            <div class="matrix-stat-item">
              <span class="stat-lbl"><i class="fa-solid fa-users"></i> Enrolled:</span>
              <span class="stat-num">${enrolled} Students</span>
            </div>
          </div>
        </div>

        <div class="matrix-card-actions">
          <button type="button" class="btn-matrix-open" onclick="window.handleOpenEventFromMatrix('${evt.id}')">
            <i class="fa-solid fa-arrow-right-to-bracket"></i> Open Event Desk
          </button>
          <a href="/api/admin/export/event/${evt.id}" class="btn-matrix-export" title="Export Excel Roster" download>
            <i class="fa-solid fa-file-excel"></i>
          </a>
        </div>
      </div>
    `;
  }).join('');
}

window.handleOpenEventFromMatrix = function (eventId) {
  switchMasterEventsViewMode('detailed');
  selectMasterCoordinatorEvent(eventId);
};

async function loadMasterEventParticipants(eventId) {
  try {
    const res = await fetch(`/api/registrations?eventId=${eventId}`);
    const data = await res.json();
    if (data.success) {
      currentMasterEventStudents = data.students || [];

      // Calculate 4 Live KPI Counters
      const totalEnrolled = currentMasterEventStudents.length;
      const checkedInCount = currentMasterEventStudents.filter(st =>
        (st.events || []).some(e => e.event_id === eventId && e.event_status === 'COMPLETED')
      ).length;
      const foodCount = currentMasterEventStudents.filter(st => st.food_given).length;
      const tagCount = currentMasterEventStudents.filter(st => st.tag_given).length;

      const elTotal = document.getElementById('adminEvtCount');
      const elCheckedIn = document.getElementById('adminEvtCheckedInCount');
      const elFood = document.getElementById('adminEvtFoodCount');
      const elTag = document.getElementById('adminEvtTagCount');

      if (elTotal) elTotal.textContent = totalEnrolled;
      if (elCheckedIn) elCheckedIn.textContent = checkedInCount;
      if (elFood) elFood.textContent = foodCount;
      if (elTag) elTag.textContent = tagCount;

      filterMasterInsideEventTable();
    }
  } catch (err) {
    console.error('Error loading master event participants:', err);
  }
}

function filterMasterInsideEventTable() {
  const query = (document.getElementById('adminInsideEventSearch') ? document.getElementById('adminInsideEventSearch').value : '').trim().toLowerCase();
  const tbody = document.getElementById('adminEventStudentsBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = currentMasterEventStudents.filter(st => {
    if (!query) return true;
    return (
      (st.name || '').toLowerCase().includes(query) ||
      (st.reg_code || '').toLowerCase().includes(query) ||
      (st.phone || '').includes(query) ||
      (st.college || '').toLowerCase().includes(query) ||
      (st.email || '').toLowerCase().includes(query)
    );
  });

  const countLbl = document.getElementById('adminInsideEventCount');
  if (countLbl) countLbl.textContent = `Showing ${filtered.length} of ${currentMasterEventStudents.length} participants`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2.5rem; color: #64748b;"><i class="fa-solid fa-user-xmark" style="font-size:1.5rem; margin-bottom:0.5rem; display:block; color:#94a3b8;"></i> No participants match your search in this event.</td></tr>`;
    return;
  }

  const selectedEvtObj = eventCatalog.find(e => e.id === currentMasterSelectedEventId);
  const isDay2Evt = selectedEvtObj && selectedEvtObj.day === 'day2';

  filtered.forEach((st, idx) => {
    const tr = document.createElement('tr');
    const regEvents = st.events || [];
    const currentEvt = regEvents.find(e => e.event_id === currentMasterSelectedEventId);
    const isCompleted = currentEvt && currentEvt.event_status === 'COMPLETED';

    const inBtnHtml = `<button type="button" class="btn-action-sm ${isCompleted ? 'active-green' : ''}" ${isCompleted ? 'disabled' : ''} onclick="window.handleCoordinatorAction('${st.id}', 'ENTER_EVENT', '${currentMasterSelectedEventId}')"><i class="fa-solid fa-right-to-bracket"></i> ${isCompleted ? '✔ In' : 'In'}</button>`;

    let foodBtnHtml = '';
    let tagBtnHtml = '';

    if (st.day_selection === 'day1') {
      foodBtnHtml = `<button type="button" class="btn-action-sm ${st.food_given ? 'active-green' : ''}" ${st.food_given ? 'disabled' : ''} onclick="window.handleCoordinatorAction('${st.id}', 'ISSUE_FOOD_D1')"><i class="fa-solid fa-utensils"></i> ${st.food_given ? '✔ Food D1' : 'Food D1'}</button>`;
      tagBtnHtml = `<button type="button" class="btn-action-sm ${st.tag_given ? 'active-green' : ''}" ${st.tag_given ? 'disabled' : ''} onclick="window.handleCoordinatorAction('${st.id}', 'ISSUE_TAG_D1')"><i class="fa-solid fa-id-badge"></i> ${st.tag_given ? '✔ Tag D1' : 'Tag D1'}</button>`;
    } else if (st.day_selection === 'day2') {
      foodBtnHtml = `<button type="button" class="btn-action-sm ${st.food_d2_given ? 'active-green' : ''}" ${st.food_d2_given ? 'disabled' : ''} onclick="window.handleCoordinatorAction('${st.id}', 'ISSUE_FOOD_D2')"><i class="fa-solid fa-utensils"></i> ${st.food_d2_given ? '✔ Food D2' : 'Food D2'}</button>`;
      tagBtnHtml = `<button type="button" class="btn-action-sm ${st.tag_d2_given ? 'active-green' : ''}" ${st.tag_d2_given ? 'disabled' : ''} onclick="window.handleCoordinatorAction('${st.id}', 'ISSUE_TAG_D2')"><i class="fa-solid fa-id-badge"></i> ${st.tag_d2_given ? '✔ Tag D2' : 'Tag D2'}</button>`;
    } else {
      // Both Days Pass
      const d1FoodDone = !!st.food_given;
      const d1TagDone = !!st.tag_given;
      const day2Unlocked = d1FoodDone && d1TagDone;

      if (isDay2Evt) {
        foodBtnHtml = `<button type="button" class="btn-action-sm ${st.food_d2_given ? 'active-green' : ''}" ${day2Unlocked ? (st.food_d2_given ? 'disabled' : '') : 'disabled title="Day 2 Food Token disabled until Day 1 Food & Tag are claimed"'} onclick="window.handleCoordinatorAction('${st.id}', 'ISSUE_FOOD_D2')"><i class="fa-solid fa-utensils"></i> ${st.food_d2_given ? '✔ Food D2' : 'Food D2'}</button>`;
        tagBtnHtml = `<button type="button" class="btn-action-sm ${st.tag_d2_given ? 'active-green' : ''}" ${day2Unlocked ? (st.tag_d2_given ? 'disabled' : '') : 'disabled title="Day 2 Tag disabled until Day 1 Food & Tag are claimed"'} onclick="window.handleCoordinatorAction('${st.id}', 'ISSUE_TAG_D2')"><i class="fa-solid fa-id-badge"></i> ${st.tag_d2_given ? '✔ Tag D2' : 'Tag D2'}</button>`;
      } else {
        foodBtnHtml = `<button type="button" class="btn-action-sm ${d1FoodDone ? 'active-green' : ''}" ${d1FoodDone ? 'disabled' : ''} onclick="window.handleCoordinatorAction('${st.id}', 'ISSUE_FOOD_D1')"><i class="fa-solid fa-utensils"></i> ${d1FoodDone ? '✔ Food D1' : 'Food D1'}</button>`;
        tagBtnHtml = `<button type="button" class="btn-action-sm ${d1TagDone ? 'active-green' : ''}" ${d1TagDone ? 'disabled' : ''} onclick="window.handleCoordinatorAction('${st.id}', 'ISSUE_TAG_D1')"><i class="fa-solid fa-id-badge"></i> ${d1TagDone ? '✔ Tag D1' : 'Tag D1'}</button>`;
      }
    }

    const actionsHtml = `
      <div class="linear-actions-flex">
        ${inBtnHtml}
        ${foodBtnHtml}
        ${tagBtnHtml}
      </div>
    `;

    const editProfileBtn = `
      <button type="button" class="btn-edit-sm" style="font-size:0.75rem; padding:0.3rem 0.6rem; margin-bottom:0.25rem;" onclick="window.handleOpenEditRequestModal('${st.id}')">
        <i class="fa-solid fa-user-pen"></i> Edit Profile
      </button>
    `;

    const editEventsBtn = `
      <button type="button" class="btn-edit-sm" style="font-size:0.75rem; padding:0.3rem 0.6rem; background:#f0fdf4; color:#166534; border-color:#bbf7d0;" onclick="window.handleOpenEditEventsModal('${st.id}')">
        <i class="fa-solid fa-pen-ruler"></i> Edit Events
      </button>
    `;

    const modifyCellHtml = `
      <div style="display:flex; flex-direction:column; gap:0.25rem; align-items:center;">
        ${editProfileBtn}
        ${editEventsBtn}
      </div>
    `;

    let passPillClass = 'd1';
    let passPillText = 'Day 1';
    if (st.day_selection === 'day2') { passPillClass = 'd2'; passPillText = 'Day 2'; }
    if (st.day_selection === 'both') { passPillClass = 'both'; passPillText = 'Both Days'; }

    const themeBadge = currentEvt && currentEvt.hackathon_theme
      ? `<div style="font-size:0.72rem; color:#0284c7; font-weight:700; margin-top:0.2rem;"><i class="fa-solid fa-lightbulb"></i> ${currentEvt.hackathon_theme}</div>`
      : '';

    const sourceBadge = st.registration_type === 'SPOT'
      ? `<span class="source-tag spot" style="font-size:0.68rem; padding:0.1rem 0.35rem; border-radius:3px; background:#ecfdf5; color:#059669; font-weight:800;">SPOT</span>`
      : `<span class="source-tag online" style="font-size:0.68rem; padding:0.1rem 0.35rem; border-radius:3px; background:#eff6ff; color:#0284c7; font-weight:800;">ONLINE</span>`;

    tr.innerHTML = `
      <td style="text-align:center; font-weight:700;">${idx + 1}</td>
      <td>
        <div style="display:flex; align-items:center; gap:0.35rem; margin-bottom:0.15rem;">
          <strong style="color:#0f172a;">${st.name}</strong>
          ${sourceBadge}
        </div>
        <span class="reg-pill" style="font-size:0.74rem; background:#0284c7; color:#fff; padding:0.15rem 0.45rem; border-radius:3px; font-weight:800;">${st.reg_code || 'SPOT-REG'}</span>
      </td>
      <td><span style="color:#334155; font-weight:600; font-family:monospace;">${st.phone}</span></td>
      <td><span style="color:#334155; font-size:0.86rem;">${st.college}</span></td>
      <td><span class="email-box-pill"><i class="fa-solid fa-envelope" style="color:#0284c7;"></i> ${st.email || 'N/A'}</span></td>
      <td>
        <span class="evt-day-badge ${passPillClass}" style="font-size:0.72rem;">${passPillText}</span>
        ${themeBadge}
      </td>
      <td>${actionsHtml}</td>
      <td style="text-align:center;">${modifyCellHtml}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ----------------------------------------------------------
// 5. MASTER SYSTEM & DATABASE HEALTH LOGIC
// ----------------------------------------------------------
async function loadMasterSystemInfo() {
  try {
    const res = await fetch('/api/admin/system-info');
    const data = await res.json();
    if (data.success && data.system) {
      const sys = data.system;
      const tables = sys.tables || {};

      const elStudents = document.getElementById('sysTableStudents');
      const elStudentEvents = document.getElementById('sysTableStudentEvents');
      const elFfPlayers = document.getElementById('sysTableFfPlayers');
      const elFfTeams = document.getElementById('sysTableFfTeams');
      const elReqs = document.getElementById('sysTableRequests');

      if (elStudents) elStudents.textContent = tables.students || 0;
      if (elStudentEvents) elStudentEvents.textContent = tables.student_events || 0;
      if (elFfPlayers) elFfPlayers.textContent = tables.freefire_players || 0;
      if (elFfTeams) elFfTeams.textContent = tables.freefire_teams || 0;
      if (elReqs) elReqs.textContent = (tables.edit_requests || 0) + (tables.event_change_requests || 0);
    }
  } catch (err) {
    console.error('Error loading system info:', err);
  }
}

// ----------------------------------------------------------
// 6. EXCEL IMPORT & DYNAMIC EVENT SPLITTING LOGIC
// ----------------------------------------------------------
let selectedImportFile = null;

function initExcelImport() {
  const dropzone = document.getElementById('excelDropzone');
  const fileInput = document.getElementById('excelFileInput');
  const btnRemove = document.getElementById('btnRemoveSelectedFile');
  const btnSubmit = document.getElementById('btnSubmitExcelImport');

  const closeBtn = document.getElementById('closeImportExcelModal');
  const cancelBtn = document.getElementById('btnCancelImportExcel');
  const closeSummaryBtn = document.getElementById('closeImportSummaryModal');
  const doneSummaryBtn = document.getElementById('btnCloseImportSummary');

  if (closeBtn) closeBtn.addEventListener('click', () => closeModal('modalImportExcel'));
  if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal('modalImportExcel'));
  if (closeSummaryBtn) closeSummaryBtn.addEventListener('click', () => closeModal('modalImportSummary'));
  if (doneSummaryBtn) {
    doneSummaryBtn.addEventListener('click', () => {
      closeModal('modalImportSummary');
      loadAdminDashboard();
      if (typeof loadMasterStatsSummary === 'function') loadMasterStatsSummary();
      if (typeof loadMasterStudentsDirectory === 'function') loadMasterStudentsDirectory();
    });
  }

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', (e) => {
      if (e.target !== btnRemove && !btnRemove.contains(e.target)) {
        fileInput.click();
      }
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#059669';
      dropzone.style.background = '#d1fae5';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = '#10b981';
      dropzone.style.background = '#ecfdf5';
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#10b981';
      dropzone.style.background = '#ecfdf5';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelection(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelection(e.target.files[0]);
      }
    });
  }

  if (btnRemove) {
    btnRemove.addEventListener('click', (e) => {
      e.stopPropagation();
      resetDropzone();
    });
  }

  if (btnSubmit) {
    btnSubmit.addEventListener('click', handleExecuteExcelImport);
  }
}

function handleFileSelection(file) {
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx', 'xls', 'csv'].includes(ext)) {
    showAlert('Please select a valid Excel or CSV file (.xlsx, .xls, .csv).');
    return;
  }

  selectedImportFile = file;

  const defaultState = document.getElementById('dropzoneDefaultState');
  const selectedState = document.getElementById('dropzoneSelectedState');
  const fileNameEl = document.getElementById('selectedFileName');
  const fileSizeEl = document.getElementById('selectedFileSize');
  const btnSubmit = document.getElementById('btnSubmitExcelImport');

  if (defaultState) defaultState.style.display = 'none';
  if (selectedState) selectedState.style.display = 'block';
  if (fileNameEl) fileNameEl.textContent = file.name;
  if (fileSizeEl) fileSizeEl.textContent = (file.size / 1024).toFixed(1) + ' KB';
  if (btnSubmit) {
    btnSubmit.disabled = false;
    btnSubmit.style.opacity = '1';
  }
}

let currentExcelImportMode = 'valid';

function resetDropzone() {
  selectedImportFile = null;
  const fileInput = document.getElementById('excelFileInput');
  if (fileInput) fileInput.value = '';

  const defaultState = document.getElementById('dropzoneDefaultState');
  const selectedState = document.getElementById('dropzoneSelectedState');
  const btnSubmit = document.getElementById('btnSubmitExcelImport');
  const progressContainer = document.getElementById('importProgressBarContainer');

  if (defaultState) defaultState.style.display = 'block';
  if (selectedState) selectedState.style.display = 'none';
  if (progressContainer) progressContainer.style.display = 'none';
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.style.opacity = '0.6';
    if (currentExcelImportMode === 'invalid') {
      btnSubmit.innerHTML = `<i class="fa-solid fa-file-circle-exclamation"></i> Import Invalid / Flagged Records`;
    } else {
      btnSubmit.innerHTML = `<i class="fa-solid fa-file-circle-check"></i> Import Valid Online Records`;
    }
  }
}

window.openImportExcelModal = function (mode = 'valid') {
  currentExcelImportMode = (mode === 'invalid') ? 'invalid' : 'valid';
  resetDropzone();

  const modalHeader = document.getElementById('modalImportExcelHeader');
  const modalTitle = document.getElementById('modalImportExcelTitle');
  const modalDesc = document.getElementById('modalImportExcelDesc');
  const dropzone = document.getElementById('excelDropzone');
  const dropzoneIcon = document.getElementById('dropzoneIcon');
  const dropzoneHeading = document.getElementById('dropzoneHeading');
  const btnSubmit = document.getElementById('btnSubmitExcelImport');
  const progressLabel = document.getElementById('importProgressLabel');

  if (currentExcelImportMode === 'invalid') {
    if (modalHeader) modalHeader.style.background = 'linear-gradient(135deg, #7f1d1d, #b91c1c)';
    if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-file-circle-exclamation" style="color: #fca5a5;"></i> Import Online Invalid Details';
    if (modalDesc) modalDesc.innerHTML = 'Upload online registration records with <strong>invalid / incomplete details, payment discrepancies, or missing phone numbers</strong>. These records will be tagged as <code style="color:#dc2626; font-weight:800;">ONLINE_INVALID</code> and made accessible in the Master Directory & Event Issue Desk for spot resolution.';
    if (dropzone) {
      dropzone.style.borderColor = '#ef4444';
      dropzone.style.background = '#fef2f2';
    }
    if (dropzoneIcon) {
      dropzoneIcon.style.color = '#dc2626';
      dropzoneIcon.className = 'fa-solid fa-file-circle-exclamation';
    }
    if (dropzoneHeading) dropzoneHeading.textContent = 'Click to browse or Drag & Drop Invalid Excel File';
    if (btnSubmit) {
      btnSubmit.style.background = 'linear-gradient(135deg, #d97706, #ef4444)';
      btnSubmit.innerHTML = `<i class="fa-solid fa-file-circle-exclamation"></i> Import Invalid / Flagged Records`;
    }
    if (progressLabel) progressLabel.textContent = 'Importing and tagging invalid online records...';
  } else {
    if (modalHeader) modalHeader.style.background = 'linear-gradient(135deg, #065f46, #047857)';
    if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-file-circle-check" style="color: #6ee7b7;"></i> Import Online Valid Details';
    if (modalDesc) modalDesc.innerHTML = 'Upload verified and approved online registrations (<code>.xlsx</code>, <code>.xls</code>, or <code>.csv</code>). The engine will match participant records, parse registered events, and split participants into their respective Day 1 & Day 2 events in real time.';
    if (dropzone) {
      dropzone.style.borderColor = '#10b981';
      dropzone.style.background = '#ecfdf5';
    }
    if (dropzoneIcon) {
      dropzoneIcon.style.color = '#059669';
      dropzoneIcon.className = 'fa-solid fa-cloud-arrow-up';
    }
    if (dropzoneHeading) dropzoneHeading.textContent = 'Click to browse or Drag & Drop Valid Excel File here';
    if (btnSubmit) {
      btnSubmit.style.background = 'linear-gradient(135deg, #059669, #10b981)';
      btnSubmit.innerHTML = `<i class="fa-solid fa-file-circle-check"></i> Import Valid Online Records`;
    }
    if (progressLabel) progressLabel.textContent = 'Importing and splitting participant events...';
  }

  openModal('modalImportExcel');
};

async function handleExecuteExcelImport() {
  if (!selectedImportFile) {
    showAlert('Please select an Excel file to upload.');
    return;
  }

  const btnSubmit = document.getElementById('btnSubmitExcelImport');
  const progressContainer = document.getElementById('importProgressBarContainer');

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing & Splitting...`;
  }
  if (progressContainer) progressContainer.style.display = 'block';

  try {
    const formData = new FormData();
    formData.append('file', selectedImportFile);
    formData.append('import_type', currentExcelImportMode);

    const res = await fetch('/api/admin/import/excel', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (data.success && data.summary) {
      closeModal('modalImportExcel');
      renderImportSummaryModal(data.summary);

      // Auto-refresh all views
      await Promise.all([
        loadAdminDashboard(),
        loadEventCatalog(),
        typeof loadMasterStatsSummary === 'function' ? loadMasterStatsSummary() : Promise.resolve(),
        typeof loadMasterStudentsDirectory === 'function' ? loadMasterStudentsDirectory() : Promise.resolve(),
        typeof loadMasterSystemInfo === 'function' ? loadMasterSystemInfo() : Promise.resolve()
      ]);

      if (currentCoordinatorEventId) {
        loadEventParticipants(currentCoordinatorEventId);
      }
      if (typeof LiveSyncEngine !== 'undefined') {
        LiveSyncEngine.triggerImmediateSync();
      }
    } else {
      showAlert(data.message || 'Failed to import Excel sheet.');
    }
  } catch (err) {
    console.error('Error uploading Excel file:', err);
    showAlert('Network or server error while uploading Excel file.');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<i class="fa-solid fa-file-import"></i> Upload & Split Events`;
    }
    if (progressContainer) progressContainer.style.display = 'none';
  }
}

function renderImportSummaryModal(summary) {
  const elTotal = document.getElementById('mImportStatTotal');
  const elDay1 = document.getElementById('mImportStatDay1');
  const elDay2 = document.getElementById('mImportStatDay2');
  const elBoth = document.getElementById('mImportStatBoth');
  const elFf = document.getElementById('mImportStatFf');
  const badgeCount = document.getElementById('mImportEventsCountBadge');
  const grid = document.getElementById('mImportEventBreakdownGrid');

  if (elTotal) elTotal.textContent = summary.totalStudents || 0;
  if (elDay1) elDay1.textContent = summary.day1Count || 0;
  if (elDay2) elDay2.textContent = summary.day2Count || 0;
  if (elBoth) elBoth.textContent = summary.bothDaysCount || 0;
  if (elFf) elFf.textContent = summary.freefirePlayers || 0;

  const breakdown = summary.eventBreakdown || [];
  if (badgeCount) badgeCount.textContent = `${breakdown.length} Events With Enrolled Students`;

  if (grid) {
    if (breakdown.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:1.5rem; color:#64748b;">No specific events were assigned.</div>`;
    } else {
      grid.innerHTML = breakdown.map(eb => `
        <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; padding:0.85rem; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span style="font-size:0.7rem; font-weight:800; background:#e0f2fe; color:#0284c7; padding:0.15rem 0.4rem; border-radius:4px;">${eb.day}</span>
            <strong style="display:block; color:#1e0b36; font-size:0.92rem; margin-top:0.25rem;">${eb.name}</strong>
            <span style="font-size:0.75rem; color:#64748b;">${eb.category}</span>
          </div>
          <div style="text-align:right;">
            <span style="font-size:1.3rem; font-weight:900; color:#059669; display:block;">${eb.count}</span>
            <span style="font-size:0.7rem; color:#64748b; font-weight:700;">Students</span>
          </div>
        </div>
      `).join('');
    }
  }

  openModal('modalImportSummary');
}

// ==========================================================
// 22. COUNTER REGISTRATION MANAGEMENT & REPORTING CONTROLLER
// ==========================================================

let currentCountersList = [];
let currentFacultyList = [];
let currentCounterReportData = null;
let activeSpotCounterName = localStorage.getItem('techraga_spot_counter') || 'Counter 1';

function getActiveSpotCounter() {
  return activeSpotCounterName || 'Counter 1';
}

function initCountersAndReports() {
  initSpotCounterBar();
  initAddFacultyModal();
  initCounterReportFilters();

  const btnRefreshCounters = document.getElementById('btnRefreshCountersList');
  if (btnRefreshCounters) {
    btnRefreshCounters.addEventListener('click', () => {
      loadAdminCounters();
    });
  }

  const btnResetReportFilters = document.getElementById('btnResetReportFilters');
  if (btnResetReportFilters) {
    btnResetReportFilters.addEventListener('click', () => {
      const elCounter = document.getElementById('filterReportCounter');
      const elFaculty = document.getElementById('filterReportFaculty');
      const elDate = document.getElementById('filterReportDate');
      const elSearch = document.getElementById('filterReportSearch');

      if (elCounter) elCounter.value = 'all';
      if (elFaculty) elFaculty.value = 'all';
      if (elDate) elDate.value = '';
      if (elSearch) elSearch.value = '';

      document.querySelectorAll('.counter-kpi-card').forEach(c => c.classList.remove('active-selected-counter'));
      loadCounterReport();
    });
  }
}

// 1. Spot Registration Counter Station Bar Management
function initSpotCounterBar() {
  const selGeneral = document.getElementById('spotGeneralActiveCounterSelect');
  const selFf = document.getElementById('spotFfActiveCounterSelect');

  function syncCounterSelection(cName) {
    activeSpotCounterName = cName;
    localStorage.setItem('techraga_spot_counter', cName);

    if (selGeneral) selGeneral.value = cName;
    if (selFf) selFf.value = cName;

    updateSpotCounterBadgeDisplays();
  }

  if (selGeneral) {
    selGeneral.addEventListener('change', (e) => {
      syncCounterSelection(e.target.value);
    });
  }

  if (selFf) {
    selFf.addEventListener('change', (e) => {
      syncCounterSelection(e.target.value);
    });
  }

  // Load counter stations on init
  loadCounterStationOptions();
}

async function loadCounterStationOptions() {
  try {
    const res = await fetch('/api/counters');
    const data = await res.json();
    if (data.success && data.counters) {
      currentCountersList = data.counters;
      populateSpotCounterSelects(data.counters);
    }
  } catch (err) {
    console.error('Error loading counter stations:', err);
  }
}

function populateSpotCounterSelects(counters) {
  const selGeneral = document.getElementById('spotGeneralActiveCounterSelect');
  const selFf = document.getElementById('spotFfActiveCounterSelect');

  const optionsHtml = counters.map(c => {
    const facLabel = c.faculty_name ? ` • ${c.faculty_name}` : ' (Unassigned)';
    return `<option value="${c.counter_name}">${c.counter_name}${facLabel}</option>`;
  }).join('');

  if (selGeneral) {
    selGeneral.innerHTML = optionsHtml;
    selGeneral.value = activeSpotCounterName;
  }
  if (selFf) {
    selFf.innerHTML = optionsHtml;
    selFf.value = activeSpotCounterName;
  }

  updateSpotCounterBadgeDisplays();
}

function updateSpotCounterBadgeDisplays() {
  const badgeGeneral = document.getElementById('spotGeneralActiveCounterDisplay');
  const badgeFf = document.getElementById('spotFfActiveCounterDisplay');

  const matched = currentCountersList.find(c => c.counter_name === activeSpotCounterName);
  const text = matched
    ? `${matched.counter_name} • ${matched.faculty_name || 'Operator Station'}`
    : `${activeSpotCounterName} • Registration Desk`;

  if (badgeGeneral) badgeGeneral.textContent = text;
  if (badgeFf) badgeFf.textContent = text;
}

// 2. Load and Render 10 Counters Setup in Admin Master
async function loadAdminCounters() {
  const grid = document.getElementById('adminCountersGrid');
  if (grid) {
    grid.innerHTML = `<div style="grid-column: 1/-1; padding: 2rem; text-align: center; color: #64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Loading counters and faculty assignments...</div>`;
  }

  try {
    const [countersRes, facultyRes] = await Promise.all([
      fetch('/api/counters'),
      fetch('/api/faculty-list')
    ]);

    const countersData = await countersRes.json();
    const facultyData = await facultyRes.json();

    if (countersData.success && facultyData.success) {
      currentCountersList = countersData.counters || [];
      currentFacultyList = facultyData.faculty || [];
      renderAdminCountersGrid();
      populateSpotCounterSelects(currentCountersList);
    }
  } catch (err) {
    console.error('Error loading counters:', err);
    if (grid) {
      grid.innerHTML = `<div style="grid-column: 1/-1; padding: 2rem; text-align: center; color: #dc2626;">Failed to load counters list.</div>`;
    }
  }
}

function renderAdminCountersGrid() {
  const grid = document.getElementById('adminCountersGrid');
  if (!grid) return;

  grid.innerHTML = '';

  currentCountersList.forEach(counter => {
    const card = document.createElement('div');
    card.className = 'counter-setup-card';

    const isAssigned = Boolean(counter.faculty_name && counter.faculty_name.trim());
    const statusClass = isAssigned ? 'status-active-assigned' : 'status-unassigned';
    const statusText = isAssigned ? `<i class="fa-solid fa-circle-check"></i> Assigned` : `<i class="fa-solid fa-circle-xmark"></i> Unassigned`;

    // Generate Dropdown options with Exclusive Faculty Filtering
    const dropdownOptions = currentFacultyList.map(fac => {
      const isCurrentCounterFaculty = fac.name === counter.faculty_name;
      const isAssignedToOther = fac.assigned_counter && fac.assigned_counter !== counter.counter_name;

      if (isCurrentCounterFaculty) {
        return `<option value="${fac.name}" selected>${fac.name} (Assigned to this counter)</option>`;
      } else if (isAssignedToOther) {
        return `<option value="${fac.name}" disabled style="color:#94a3b8; background:#f1f5f9;">${fac.name} (Assigned to ${fac.assigned_counter})</option>`;
      } else {
        return `<option value="${fac.name}">${fac.name}</option>`;
      }
    }).join('');

    card.innerHTML = `
      <div>
        <div class="counter-setup-header">
          <div class="counter-card-tag">
            <i class="fa-solid fa-headset" style="color: #f59e0b;"></i> ${counter.counter_name}
          </div>
          <span class="counter-status-badge ${statusClass}">
            ${statusText}
          </span>
        </div>

        <div class="counter-faculty-select-group">
          <label for="selectFaculty_${counter.id}">
            <i class="fa-solid fa-user-tie"></i> Assigned Faculty Operator:
          </label>
          <select id="selectFaculty_${counter.id}" class="counter-faculty-select">
            <option value="">-- Select Faculty Member --</option>
            ${dropdownOptions}
          </select>
        </div>

        <div class="counter-live-stats-row">
          <div class="counter-mini-stat">
            <div class="mini-num">${counter.total_registrations}</div>
            <div class="mini-lbl">Spot Registrations</div>
          </div>
          <div class="counter-mini-stat">
            <div class="mini-num" style="color: #059669;">₹${(counter.total_amount || 0).toLocaleString('en-IN')}</div>
            <div class="mini-lbl">Total Amount</div>
          </div>
        </div>
      </div>

      <div class="counter-card-actions">
        <button type="button" class="btn-assign-faculty" onclick="window.handleAssignFacultyClick(${counter.id}, '${counter.counter_name}')">
          <i class="fa-solid fa-floppy-disk"></i> Save Assignment
        </button>
        ${isAssigned ? `
          <button type="button" class="btn-unassign-faculty" title="Unassign faculty from this counter" onclick="window.handleUnassignFacultyClick(${counter.id}, '${counter.counter_name}')">
            <i class="fa-solid fa-user-minus"></i> Unassign
          </button>
        ` : ''}
      </div>
    `;

    grid.appendChild(card);
  });
}

window.handleAssignFacultyClick = async function (counterId, counterName) {
  const selectEl = document.getElementById(`selectFaculty_${counterId}`);
  if (!selectEl) return;

  const facultyName = selectEl.value.trim();

  try {
    const res = await fetch('/api/counters/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counterId, counterName, facultyName })
    });

    const data = await res.json();
    if (data.success) {
      showAlert(data.message);
      await loadAdminCounters();
      if (currentMasterActiveSubtab === 'counter-reg') {
        loadCounterReport();
      }
      if (typeof LiveSyncEngine !== 'undefined') {
        LiveSyncEngine.triggerImmediateSync();
      }
    } else {
      showAlert(`Assignment Error: ${data.message}`);
    }
  } catch (err) {
    console.error('Error assigning faculty:', err);
    showAlert('Server error saving faculty assignment.');
  }
};

window.handleUnassignFacultyClick = async function (counterId, counterName) {
  if (!await showConfirm(`Are you sure you want to unassign faculty from ${counterName}?`, 'Unassign Faculty?', 'Yes, Unassign', 'Cancel')) return;

  try {
    const res = await fetch('/api/counters/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counterId, counterName, facultyName: '' })
    });

    const data = await res.json();
    if (data.success) {
      showAlert(data.message);
      await loadAdminCounters();
      if (currentMasterActiveSubtab === 'counter-reg') {
        loadCounterReport();
      }
      if (typeof LiveSyncEngine !== 'undefined') {
        LiveSyncEngine.triggerImmediateSync();
      }
    } else {
      showAlert(`Unassign Error: ${data.message}`);
    }
  } catch (err) {
    console.error('Error unassigning faculty:', err);
    showAlert('Server error unassigning faculty.');
  }
};

// 3. Counter Registration Report (counter-reg) Controller
function initCounterReportFilters() {
  const elCounter = document.getElementById('filterReportCounter');
  const elFaculty = document.getElementById('filterReportFaculty');
  const elDate = document.getElementById('filterReportDate');
  const elSearch = document.getElementById('filterReportSearch');
  const clearSearchBtn = document.getElementById('clearFilterReportSearch');

  if (elCounter) elCounter.addEventListener('change', () => loadCounterReport());
  if (elFaculty) elFaculty.addEventListener('change', () => loadCounterReport());
  if (elDate) elDate.addEventListener('change', () => loadCounterReport());
  if (elSearch) elSearch.addEventListener('input', () => loadCounterReport());
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (elSearch) elSearch.value = '';
      loadCounterReport();
    });
  }
}

async function loadCounterReport() {
  const elCounter = document.getElementById('filterReportCounter');
  const elFaculty = document.getElementById('filterReportFaculty');
  const elDate = document.getElementById('filterReportDate');
  const elSearch = document.getElementById('filterReportSearch');

  const counterVal = elCounter ? elCounter.value : 'all';
  const facultyVal = elFaculty ? elFaculty.value : 'all';
  const dateVal = elDate ? elDate.value : '';
  const searchVal = elSearch ? elSearch.value.trim() : '';

  const params = new URLSearchParams();
  if (counterVal && counterVal !== 'all') params.append('counter', counterVal);
  if (facultyVal && facultyVal !== 'all') params.append('faculty', facultyVal);
  if (dateVal) params.append('date', dateVal);
  if (searchVal) params.append('q', searchVal);

  try {
    const res = await fetch(`/api/admin/counter-report?${params.toString()}`);
    const data = await res.json();

    if (data.success) {
      currentCounterReportData = data;
      renderCounterReportSummary(data.summary, data.counterWiseCounts);
      renderCounterCardsOverview(data.counterWiseCounts, counterVal);
      populateFacultyFilterOptions(data.counterWiseCounts);
      renderCounterReportTable(data.registrations || []);
    }
  } catch (err) {
    console.error('Error loading counter report:', err);
  }
}

function renderCounterReportSummary(summary, counterWise) {
  const elActive = document.getElementById('kpiCounterRegActiveCounters');
  const elTotalSpot = document.getElementById('kpiCounterRegTotalSpot');
  const elTotalAmount = document.getElementById('kpiCounterRegTotalAmount');
  const elHighestCounter = document.getElementById('kpiCounterRegHighestCounter');
  const elHighestSub = document.getElementById('kpiCounterRegHighestSub');

  if (elActive) elActive.textContent = `${summary.totalCountersActive || 0} / 10`;
  if (elTotalSpot) elTotalSpot.textContent = summary.totalSpotRegistrations || 0;
  if (elTotalAmount) elTotalAmount.textContent = `₹${(summary.totalAmountCollected || 0).toLocaleString('en-IN')}`;

  if (elHighestCounter && summary.highestPerformingCounter) {
    const hp = summary.highestPerformingCounter;
    elHighestCounter.textContent = `${hp.counter_name} (${hp.faculty_name})`;
    if (elHighestSub) {
      elHighestSub.textContent = `${hp.total_registrations} Registrations • ₹${(hp.total_amount || 0).toLocaleString('en-IN')}`;
    }
  } else if (elHighestCounter) {
    elHighestCounter.textContent = 'None';
    if (elHighestSub) elHighestSub.textContent = '0 Registrations • ₹0';
  }
}

function renderCounterCardsOverview(counterWiseList, selectedCounter) {
  const grid = document.getElementById('adminCounterCardsOverviewGrid');
  if (!grid) return;

  grid.innerHTML = '';

  counterWiseList.forEach(c => {
    const isSelected = selectedCounter === c.counter_name;
    const card = document.createElement('div');
    card.className = `counter-kpi-card ${isSelected ? 'active-selected-counter' : ''}`;
    card.setAttribute('data-counter-card-name', c.counter_name);

    card.innerHTML = `
      <div class="counter-kpi-card-header">
        <div class="counter-kpi-card-title">
          <i class="fa-solid fa-headset" style="color:#f59e0b;"></i> ${c.counter_name}
        </div>
        <span style="font-size:0.72rem; font-weight:800; background:${c.total_registrations > 0 ? '#dcfce7' : '#f1f5f9'}; color:${c.total_registrations > 0 ? '#166534' : '#64748b'}; padding:0.15rem 0.45rem; border-radius:4px;">
          ${c.total_registrations > 0 ? 'Active' : 'Idle'}
        </span>
      </div>
      <div class="counter-kpi-faculty-name" title="${c.faculty_name}">
        <i class="fa-solid fa-user-tie"></i> ${c.faculty_name}
      </div>
      <div class="counter-kpi-data-row">
        <div>
          <div style="font-size:0.7rem; font-weight:700; color:#64748b; text-transform:uppercase;">Registrations</div>
          <div class="counter-kpi-registrations">${c.total_registrations}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.7rem; font-weight:700; color:#64748b; text-transform:uppercase;">Collected</div>
          <div class="counter-kpi-amount">₹${(c.total_amount || 0).toLocaleString('en-IN')}</div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      const elCounterFilter = document.getElementById('filterReportCounter');
      if (elCounterFilter) {
        if (elCounterFilter.value === c.counter_name) {
          elCounterFilter.value = 'all';
        } else {
          elCounterFilter.value = c.counter_name;
        }
        loadCounterReport();
      }
    });

    grid.appendChild(card);
  });
}

function populateFacultyFilterOptions(counterWiseList) {
  const select = document.getElementById('filterReportFaculty');
  if (!select) return;

  const currentVal = select.value;
  const facultySet = new Set();
  counterWiseList.forEach(c => {
    if (c.faculty_name && c.faculty_name !== 'Not Assigned' && c.faculty_name !== 'Unassigned') {
      facultySet.add(c.faculty_name);
    }
  });

  const optionsHtml = ['<option value="all">All Faculty Members</option>'];
  Array.from(facultySet).sort().forEach(fac => {
    optionsHtml.push(`<option value="${fac}" ${currentVal === fac ? 'selected' : ''}>${fac}</option>`);
  });

  select.innerHTML = optionsHtml.join('');
}

function renderCounterReportTable(registrations) {
  const tbody = document.getElementById('adminCounterReportTableBody');
  const countText = document.getElementById('reportFilteredCountText');
  const amountText = document.getElementById('reportFilteredAmountText');

  if (!tbody) return;
  tbody.innerHTML = '';

  const totalAmount = registrations.reduce((sum, r) => sum + (r.total_fee || 0), 0);
  if (countText) countText.textContent = `Showing ${registrations.length} spot registrations`;
  if (amountText) amountText.textContent = `Filtered Total: ₹${totalAmount.toLocaleString('en-IN')}`;

  if (registrations.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding: 2.5rem; color: #64748b;">No spot registrations found matching the selected filters.</td></tr>`;
    return;
  }

  registrations.forEach((st, idx) => {
    const tr = document.createElement('tr');

    const eventsList = (st.events || []).map(e => {
      let label = e.event_name;
      if (e.hackathon_theme) label += ` [${e.hackathon_theme}]`;
      return label;
    }).join('; ') || 'Fest Pass';

    const timeStr = st.registered_at ? new Date(st.registered_at).toLocaleString() : '-';

    tr.innerHTML = `
      <td style="text-align:center; font-weight:700;">${idx + 1}</td>
      <td><span style="font-size:0.8rem; font-weight:800; background:#f1f5f9; color:#334155; padding:0.2rem 0.5rem; border-radius:4px;">${st.reg_code}</span></td>
      <td><strong style="color:#0f172a;">${st.name}</strong></td>
      <td><span style="color:#334155;">${st.phone}</span></td>
      <td><span class="email-box-pill"><i class="fa-solid fa-envelope" style="color:#0284c7;"></i> ${st.email || 'N/A'}</span></td>
      <td><span style="color:#475569;">${st.college}</span></td>
      <td><span style="font-weight:800; color:#1e0b36;"><i class="fa-solid fa-headset" style="color:#f59e0b;"></i> ${st.counter_name}</span></td>
      <td><span style="font-weight:700; color:#4338ca;"><i class="fa-solid fa-user-tie"></i> ${st.faculty_name}</span></td>
      <td style="font-weight:900; color:#059669;">₹${(st.total_fee || 0).toLocaleString('en-IN')}</td>
      <td><span class="badge-source-spot">${(st.day_selection || 'PASS').toUpperCase()}</span></td>
      <td><span style="font-size:0.8rem; color:#475569;">${eventsList}</span></td>
      <td><span style="font-size:0.75rem; color:#64748b;">${timeStr}</span></td>
    `;

    tbody.appendChild(tr);
  });
}

// 4. Modal Add Faculty Member
function initAddFacultyModal() {
  const btnOpen = document.getElementById('btnOpenAddFacultyModal');
  const btnClose = document.getElementById('closeAddFacultyModal');
  const btnCancel = document.getElementById('btnCancelAddFaculty');
  const btnSubmit = document.getElementById('btnSubmitAddFaculty');

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      document.getElementById('formAddFaculty').reset();
      openModal('modalAddFaculty');
    });
  }

  if (btnClose) btnClose.addEventListener('click', () => closeModal('modalAddFaculty'));
  if (btnCancel) btnCancel.addEventListener('click', () => closeModal('modalAddFaculty'));

  if (btnSubmit) {
    btnSubmit.addEventListener('click', async () => {
      const name = document.getElementById('inputNewFacultyName').value.trim();
      const department = document.getElementById('inputNewFacultyDept').value.trim();

      if (!name) return showAlert('Faculty Name is required.');

      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Adding...`;

      try {
        const res = await fetch('/api/faculty/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, department })
        });

        const data = await res.json();
        if (data.success) {
          showAlert(`Faculty "${name}" added to catalog successfully!`);
          closeModal('modalAddFaculty');
          await loadAdminCounters();
        } else {
          showAlert(`Failed to add faculty: ${data.message}`);
        }
      } catch (err) {
        console.error('Error adding faculty:', err);
        showAlert('Server connection error.');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `<i class="fa-solid fa-check"></i> Add to Catalog`;
      }
    });
  }
}

// ==========================================================
// ACCESS CONTROL & CREDENTIALS MANAGEMENT CONTROLLER
// ==========================================================

let currentAdminCredentials = [];
let currentCredFilterCategory = 'all';

function initAccessControl() {
  // 1. Refresh credentials button
  const btnRefresh = document.getElementById('btnRefreshCredentials');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadAdminCredentials();
    });
  }

  // 2. Category filter pills
  const filterBtns = document.querySelectorAll('#credsCategoryFilters [data-filter-cred]');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCredFilterCategory = btn.getAttribute('data-filter-cred') || 'all';
      filterAndRenderCredentialsTable();
    });
  });

  // 3. Search credentials input
  const searchInput = document.getElementById('inputSearchCredentials');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      filterAndRenderCredentialsTable();
    });
  }

  // 4. Edit Credentials Modal handlers
  const btnCloseModal = document.getElementById('closeEditCredsModal');
  const btnCancelModal = document.getElementById('btnCancelEditCreds');
  const btnSubmitModal = document.getElementById('btnSubmitEditCreds');
  const btnToggleEditPass = document.getElementById('btnToggleEditPassword');

  if (btnCloseModal) btnCloseModal.addEventListener('click', () => closeModal('modalEditCredentials'));
  if (btnCancelModal) btnCancelModal.addEventListener('click', () => closeModal('modalEditCredentials'));
  if (btnSubmitModal) btnSubmitModal.addEventListener('click', handleSaveCredentials);

  if (btnToggleEditPass) {
    btnToggleEditPass.addEventListener('click', () => {
      const passInput = document.getElementById('editCredPassword');
      if (passInput) {
        if (passInput.type === 'password') {
          passInput.type = 'text';
          btnToggleEditPass.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
        } else {
          passInput.type = 'password';
          btnToggleEditPass.innerHTML = '<i class="fa-solid fa-eye"></i>';
        }
      }
    });
  }

  // 5. Universal Desk Login Modal handlers
  const btnCloseDeskLogin = document.getElementById('closeDeskLoginModal');
  const btnSubmitDeskLogin = document.getElementById('btnSubmitDeskLogin');
  const btnToggleDeskPass = document.getElementById('btnToggleDeskLoginPassword');
  const pDeskInput = document.getElementById('inputDeskLoginPassword');

  if (btnCloseDeskLogin) btnCloseDeskLogin.addEventListener('click', () => closeModal('modalDeskLogin'));
  if (btnSubmitDeskLogin) btnSubmitDeskLogin.addEventListener('click', submitDeskLogin);

  if (btnToggleDeskPass) {
    btnToggleDeskPass.addEventListener('click', () => {
      if (pDeskInput) {
        if (pDeskInput.type === 'password') {
          pDeskInput.type = 'text';
          btnToggleDeskPass.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
        } else {
          pDeskInput.type = 'password';
          btnToggleDeskPass.innerHTML = '<i class="fa-solid fa-eye"></i>';
        }
      }
    });
  }

  // Enter key support in login modal
  const uDeskInput = document.getElementById('inputDeskLoginUsername');
  if (uDeskInput) {
    uDeskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitDeskLogin();
    });
  }
  if (pDeskInput) {
    pDeskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitDeskLogin();
    });
  }

  // Enter key support in Edit Credentials modal
  const editPassInput = document.getElementById('editCredPassword');
  const editUserInput = document.getElementById('editCredUsername');
  if (editPassInput) {
    editPassInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSaveCredentials();
    });
  }
  if (editUserInput) {
    editUserInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSaveCredentials();
    });
  }
}

async function loadAdminCredentials() {
  try {
    const res = await fetch('/api/admin/credentials');
    const data = await res.json();
    if (data.success) {
      currentAdminCredentials = data.credentials || [];
      updateCredentialsKpis(currentAdminCredentials);
      filterAndRenderCredentialsTable();
    }
  } catch (err) {
    console.error('Error fetching credentials:', err);
  }
}

function updateCredentialsKpis(credentials) {
  const totalEl = document.getElementById('kpiTotalCredentials');
  const portalEl = document.getElementById('kpiPortalCredentials');
  const eventEl = document.getElementById('kpiEventCredentials');

  const total = credentials.length;
  const portals = credentials.filter(c => c.category === 'PORTAL').length;
  const events = credentials.filter(c => c.category === 'EVENT').length;

  if (totalEl) totalEl.textContent = total;
  if (portalEl) portalEl.textContent = portals;
  if (eventEl) eventEl.textContent = events;
}

function filterAndRenderCredentialsTable() {
  const tbody = document.getElementById('tableBodyCredentials');
  if (!tbody) return;

  const searchInput = document.getElementById('inputSearchCredentials');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const filtered = currentAdminCredentials.filter(c => {
    // Category filter
    if (currentCredFilterCategory !== 'all' && c.category !== currentCredFilterCategory) {
      return false;
    }
    // Search query
    if (query) {
      const matchName = (c.module_name || '').toLowerCase().includes(query);
      const matchKey = (c.module_key || '').toLowerCase().includes(query);
      const matchUser = (c.username || '').toLowerCase().includes(query);
      const matchCat = (c.category || '').toLowerCase().includes(query);
      return matchName || matchKey || matchUser || matchCat;
    }
    return true;
  });

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2.5rem; color: #64748b;">No credentials found matching the search criteria.</td></tr>`;
    return;
  }

  filtered.forEach((c, idx) => {
    const tr = document.createElement('tr');

    const isPortal = c.category === 'PORTAL';
    const categoryBadge = isPortal
      ? `<span class="badge-cred-portal"><i class="fa-solid fa-desktop"></i> Core Portal</span>`
      : `<span class="badge-cred-event"><i class="fa-solid fa-calendar-check"></i> Event Desk</span>`;

    const lastUpdatedStr = c.updated_at ? new Date(c.updated_at).toLocaleString() : 'System Default';

    tr.innerHTML = `
      <td style="text-align:center; font-weight:700;">${idx + 1}</td>
      <td>
        <strong style="color:#0f172a; font-size:0.92rem;">${c.module_name}</strong>
      </td>
      <td>
        <span style="font-size:0.78rem; font-weight:700; background:#f1f5f9; color:#475569; padding:0.2rem 0.5rem; border-radius:4px; font-family:monospace;">${c.module_key}</span>
      </td>
      <td>${categoryBadge}</td>
      <td>
        <span style="font-weight:800; color:#0284c7; background:#f0f9ff; border:1px solid #bae6fd; padding:0.25rem 0.6rem; border-radius:6px; font-family:monospace;">${c.username}</span>
      </td>
      <td>
        <div style="display:inline-flex; align-items:center;">
          <span id="credPassVal_${c.module_key}" style="font-family:monospace; font-weight:700; color:#1e0b36;" data-plain="${c.password}" data-masked="true">••••••••</span>
          <button type="button" class="btn-eye-sm" onclick="window.toggleCredPasswordDisplay('${c.module_key}')" title="Toggle password visibility">
            <i class="fa-solid fa-eye" id="credEyeIcon_${c.module_key}"></i>
          </button>
        </div>
      </td>
      <td>
        <span style="font-size:0.78rem; color:#64748b;">${lastUpdatedStr}</span>
      </td>
      <td style="text-align:center;">
        <button type="button" class="btn-edit-cred" onclick="window.openEditCredModal('${c.module_key}')">
          <i class="fa-solid fa-pen-to-square"></i> Change Password
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

window.toggleCredPasswordDisplay = function (moduleKey) {
  const span = document.getElementById(`credPassVal_${moduleKey}`);
  const icon = document.getElementById(`credEyeIcon_${moduleKey}`);
  if (!span) return;

  const isMasked = span.getAttribute('data-masked') === 'true';
  const plainText = span.getAttribute('data-plain') || '';

  if (isMasked) {
    span.textContent = plainText;
    span.setAttribute('data-masked', 'false');
    if (icon) icon.className = 'fa-solid fa-eye-slash';
  } else {
    span.textContent = '••••••••';
    span.setAttribute('data-masked', 'true');
    if (icon) icon.className = 'fa-solid fa-eye';
  }
};

window.openEditCredModal = function (moduleKey) {
  const cred = currentAdminCredentials.find(c => c.module_key === moduleKey);
  if (!cred) return;

  const keyInput = document.getElementById('editCredModuleKey');
  const nameInput = document.getElementById('editCredModuleName');
  const userInput = document.getElementById('editCredUsername');
  const passInput = document.getElementById('editCredPassword');

  if (keyInput) keyInput.value = cred.module_key;
  if (nameInput) nameInput.value = cred.module_name;
  if (userInput) userInput.value = cred.username;
  if (passInput) passInput.value = cred.password;

  openModal('modalEditCredentials');
  if (passInput) setTimeout(() => passInput.focus(), 150);
};

async function handleSaveCredentials() {
  const keyInput = document.getElementById('editCredModuleKey');
  const nameInput = document.getElementById('editCredModuleName');
  const userInput = document.getElementById('editCredUsername');
  const passInput = document.getElementById('editCredPassword');
  const btnSubmit = document.getElementById('btnSubmitEditCreds');

  const moduleKey = keyInput ? keyInput.value : '';
  const moduleName = nameInput ? nameInput.value : 'Desk';
  const username = userInput ? userInput.value.trim() : '';
  const password = passInput ? passInput.value.trim() : '';

  if (!moduleKey || !username || !password) {
    showAlert('Both Username and Password are required.');
    return;
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving Password...`;
  }

  try {
    const res = await fetch('/api/admin/credentials/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleKey, username, password })
    });

    const data = await res.json();
    if (data.success) {
      showAlert(`Success: Login credentials for "${moduleName}" have been updated!\n\nNew Login: ${username} / ${password}\n\nAny user accessing this event or desk must now use the new password immediately.`);
      closeModal('modalEditCredentials');
      await loadAdminCredentials();
      if (typeof LiveSyncEngine !== 'undefined') {
        LiveSyncEngine.triggerImmediateSync();
      }
    } else {
      showAlert(`Failed to update credentials: ${data.message}`);
    }
  } catch (err) {
    console.error('Error saving credentials:', err);
    showAlert('Server connection error. Please try again.', 'error');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save & Apply Password`;
    }
  }
}




