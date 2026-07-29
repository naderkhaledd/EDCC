// Auth State
const ALLOWED_USERS = [
    { email: "ahmed.awad@egyptian-drilling.com", name: "Ahmed Awad" },
    { email: "ahmed.ibrahim@egyptian-drilling.com", name: "Ahmed Ibrahim", role: "Logistics Section Head" },
    { email: "maged.halim@egyptian-drilling.com", name: "Maged Halim" },
    { email: "maged.saber@egyptian-drilling.com", name: "Maged Saber" },
    { email: "mahmoud.adel@egyptian-drilling.com", name: "Mahmoud Adel" },
    { email: "mahmoud.arafa@egyptian-drilling.com", name: "Mahmoud Arafa" },
    { email: "mohamed.hagag@egyptian-drilling.com", name: "Mohamed Hagag" },
    { email: "mostafa.salah@egyptian-drilling.com", name: "Mostafa Salah" },
    { email: "nader.khaled@egyptian-drilling.com", name: "Nader Khaled" },
    { email: "shaaban.hafez@egyptian-drilling.com", name: "Shaaban Hafez" },
    { email: "emad.said@egyptian-drilling.com", name: "Emad Said", role: "Logistics Manager" }
];
let loggedInUser = null;

// EDC Logistics Dashboard Application State
let shipmentsData = [];
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 15;
let currentStatusFilter = "all";
let overviewStatusFilter = "all";
let overviewSearchQuery = "";
let currentEditId = null;
let currentWizardStep = 1;

// Document Ready
document.addEventListener("DOMContentLoaded", () => {
    // Initialise UI icons
    lucide.createIcons();
    
    // Firebase Data Sync or Local Storage Fallback
    if (window.db) {
        window.db.collection("shipments").onSnapshot((snapshot) => {
            const data = [];
            snapshot.forEach(doc => {
                data.push(doc.data());
            });
            if (data.length > 0) {
                shipmentsData = data.map(item => {
                    if (!item.mrNo) {
                        item.mrNo = item.id ? String(item.id).split('_')[0] : "";
                    }
                    return item;
                });
                sortShipmentsData();
                if (typeof filterAndSearchData === 'function') filterAndSearchData();
                if (typeof initDashboard === 'function') initDashboard();
            } else {
                // If Firebase is empty, fallback to seed logic
                loadFromLocalStorageFallback();
            }
        }, (error) => {
            console.error("Error fetching from Firebase:", error);
            loadFromLocalStorageFallback();
        });
    } else {
        loadFromLocalStorageFallback();
    }

    function loadFromLocalStorageFallback() {
        const savedData = localStorage.getItem("edc_shipments_data");
        let needsInitialSeed = false;
        if (savedData) {
            try { 
                shipmentsData = JSON.parse(savedData); 
                if (!shipmentsData || shipmentsData.length < 50) {
                    needsInitialSeed = true;
                } else {
                    let dataUpdated = false;
                    shipmentsData = shipmentsData.map(item => {
                        const cleanRef = (val) => {
                            if (val === null || val === undefined) return val;
                            let s = val.toString().trim();
                            if (s.endsWith(".0")) {
                                const base = s.slice(0, -2).trim();
                                if (!isNaN(base) || /^\d+$/.test(base) || base === "") {
                                    return base;
                                }
                            }
                            return val;
                        };

                        const oldId = item.id;
                        item.id = cleanRef(item.id);
                        if (item.id !== oldId) dataUpdated = true;

                        if (!item.mrNo) {
                            item.mrNo = item.id ? String(item.id).split('_')[0] : "";
                            dataUpdated = true;
                        }

                        if (item.poNo) {
                            const oldPo = item.poNo;
                            item.poNo = cleanRef(item.poNo);
                            if (item.poNo !== oldPo) dataUpdated = true;
                        }

                        if (item.prNo) {
                            const oldPr = item.prNo;
                            item.prNo = cleanRef(item.prNo);
                            if (item.prNo !== oldPr) dataUpdated = true;
                        }

                        if (item.id && item.id.toString().toUpperCase() === "EDC-92372") {
                            item.id = "92372";
                            dataUpdated = true;
                        }
                        if (item.mrNo && item.mrNo.toString().toUpperCase() === "EDC-92372") {
                            item.mrNo = "92372";
                            dataUpdated = true;
                        }
                        if (item.poNo && item.poNo.toString().toUpperCase() === "EDC-92372") {
                            item.poNo = "92372";
                            dataUpdated = true;
                        }
                        return item;
                    });
                    if (dataUpdated) {
                        localStorage.setItem("edc_shipments_data", JSON.stringify(shipmentsData));
                    }
                }
            } catch (e) { 
                needsInitialSeed = true; 
            }
        } else {
            needsInitialSeed = true;
        }
        
        if (needsInitialSeed && typeof realShipmentsData !== 'undefined' && realShipmentsData.length > 0) {
            shipmentsData = realShipmentsData.map((item, index) => {
                const mrVal = String(item.id || '').trim();
                const poVal = String(item.poNo || '').trim();
                return {
                    ...item,
                    mrNo: mrVal,
                    id: poVal ? `${mrVal}_${poVal}` : `${mrVal}_seed_${index}`,
                };
            });
            localStorage.setItem("edc_shipments_data", JSON.stringify(shipmentsData));
        }
        
        sortShipmentsData();
    }
    filteredData = [...shipmentsData];
    
    // Auth Init
    const savedUser = localStorage.getItem("edc_logged_in_user");
    if (savedUser) {
        try { 
            const parsed = JSON.parse(savedUser);
            if (parsed && parsed.email) {
                const freshUser = ALLOWED_USERS.find(u => u.email.toLowerCase() === parsed.email.toLowerCase());
                if (freshUser) {
                    loggedInUser = freshUser;
                    localStorage.setItem("edc_logged_in_user", JSON.stringify(freshUser));
                } else {
                    loggedInUser = parsed;
                }
            }
        } catch(e){}
    }
    
    // Initialize views & event listeners
    initDashboard();
    setupEventListeners();
    populateFormDropdowns();
    updateAuthUI();
});

function initDashboard() {
    updateKPIs();
    renderSummaryTable();
    filterAndSearchData();
    const isManager = loggedInUser && (loggedInUser.email.toLowerCase() === "emad.said@egyptian-drilling.com" || loggedInUser.email.toLowerCase() === "ahmed.ibrahim@egyptian-drilling.com");
    if (isManager) {
        updateManagerDashboard();
    }
}

function switchTab(activeBtn, showPanel, title, subtitle, skipMenuSelect=false) {
    if (!showPanel) return;
    
    const panels = ["panel-overview", "panel-search", "panel-create", "panel-analytics", "panel-manager"];
    panels.forEach(pid => {
        const p = document.getElementById(pid);
        if (p) p.classList.add("hidden");
    });
    
    showPanel.classList.remove("hidden");
    
    if (activeBtn && !skipMenuSelect) {
        document.querySelectorAll(".sidebar .menu-item").forEach(item => item.classList.remove("active"));
        activeBtn.classList.add("active");
    }
    
    const pageTitle = document.getElementById("page-title");
    const pageSubtitle = document.getElementById("page-subtitle");
    if (pageTitle && title) pageTitle.innerText = title;
    if (pageSubtitle && subtitle) pageSubtitle.innerText = subtitle;
    
    lucide.createIcons();
}

function updateKPIs() {
    const total = shipmentsData.length;
    let delivered = 0, transit = 0, delayed = 0;
    
    shipmentsData.forEach(item => {
        const s = String(item.status || '').toLowerCase();
        if (s === "delivered") delivered++;
        else if (s === "delayed") delayed++;
        else if (s === "in transit") transit++;
    });
    
    const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
    
    const valTotal = document.getElementById("val-total");
    const valDelivered = document.getElementById("val-delivered");
    const valTransit = document.getElementById("val-transit");
    const valDelayed = document.getElementById("val-delayed");
    const rateDelivered = document.getElementById("rate-delivered");
    
    if (valTotal) valTotal.innerText = total.toLocaleString();
    if (valDelivered) valDelivered.innerText = delivered.toLocaleString();
    if (valTransit) valTransit.innerText = transit.toLocaleString();
    if (valDelayed) valDelayed.innerText = delayed.toLocaleString();
    if (rateDelivered) rateDelivered.innerText = `${deliveryRate}%`;
    
    // Adjust trend values/indicators
    const trendTotal = document.getElementById("trend-total");
    const trendDelivered = document.getElementById("trend-delivered");
    const trendDelayed = document.getElementById("trend-delayed");
    
    if (trendTotal) {
        trendTotal.innerHTML = `<i data-lucide="package-open"></i> Count`;
        trendTotal.className = "trend-indicator pos";
    }
    if (trendDelivered) {
        trendDelivered.className = deliveryRate >= 80 ? "trend-indicator pos" : "trend-indicator neutral";
        trendDelivered.innerHTML = `<i data-lucide="shield-check"></i> ${deliveryRate}%`;
    }
    if (trendDelayed) {
        if (delayed > 0) {
            trendDelayed.className = "trend-indicator neg";
            trendDelayed.innerHTML = `<i data-lucide="alert-circle"></i> Requires Review`;
        } else {
            trendDelayed.className = "trend-indicator pos";
            trendDelayed.innerHTML = `<i data-lucide="check-circle"></i> No Issues`;
        }
    }
    
    lucide.createIcons();
    updateAnalyticsDashboard();
}

function updateAnalyticsDashboard() {
    const allData = shipmentsData;
    const totalCount = allData.length;
    
    const isReceived = (status) => {
        const s = String(status || '').toLowerCase();
        return s === 'received' || s === 'delivered' || s === 'cancel';
    };
    
    const pendingData = allData.filter(item => !isReceived(item.status));
    
    const airCount = pendingData.filter(item => String(item.freightType || '').toLowerCase().includes('a/f')).length;
    const seaCount = pendingData.filter(item => String(item.freightType || '').toLowerCase().includes('o/f')).length;
    const fzCount = pendingData.filter(item => String(item.freightType || '').toLowerCase().includes('f/z')).length;
    const landCount = pendingData.filter(item => String(item.freightType || '').toLowerCase().includes('l/f')).length;
    
    const valTotal = document.getElementById("val-analytic-total");
    const valAir = document.getElementById("val-analytic-air");
    const valSea = document.getElementById("val-analytic-sea");
    const valFz = document.getElementById("val-analytic-fz");
    const valLand = document.getElementById("val-analytic-land");
    
    if (valTotal) valTotal.innerText = totalCount.toLocaleString();
    if (valAir) valAir.innerText = airCount.toLocaleString();
    if (valSea) valSea.innerText = seaCount.toLocaleString();
    if (valFz) valFz.innerText = fzCount.toLocaleString();
    if (valLand) valLand.innerText = landCount.toLocaleString();
}

function highlightText(value, query) {
    if (value === undefined || value === null || value === "") return '-';
    const strVal = String(value);
    if (!query) return strVal;
    
    const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return strVal.replace(regex, '<mark style="background-color: #fef08a; color: #854d0e; padding: 0.05rem 0.15rem; border-radius: 2px;">$1</mark>');
}

function generateShipmentRowHTML(item, query = "") {
    let badgeClass = "pending";
    const statusLower = String(item.status || '').toLowerCase();
    if (statusLower === "delivered") badgeClass = "delivered";
    else if (statusLower === "in transit") badgeClass = "in-transit";
    else if (statusLower === "delayed") badgeClass = "delayed";
    else if (statusLower === "hold") badgeClass = "hold";
    else if (statusLower === "cancel") badgeClass = "cancel";
    else if (statusLower === "received") badgeClass = "received";
    else if (statusLower === "doc. received" || statusLower === "doc received") badgeClass = "doc-received";
    else if (statusLower === "under approval") badgeClass = "under-approval";
    else if (statusLower === "under clearance") badgeClass = "under-clearance";
    else if (statusLower === "waiting certificate") badgeClass = "waiting-certificate";

    return `
        <td style="font-weight: 700; color: var(--accent-purple); white-space: nowrap;">${highlightText(item.mrNo || (item.id ? String(item.id).split('_')[0] : ''), query)}</td>
        <td style="font-weight: 600; color: var(--text-secondary); white-space: nowrap;">${highlightText(item.poNo, query)}</td>
        <td>${highlightText(item.prNo, query)}</td>
        <td>${highlightText(item.shipmentRef, query)}</td>
        <td>${highlightText(item.entityShipmentNo, query)}</td>
        <td style="white-space: nowrap;">${highlightText(item.date ? item.date.split('T')[0] : '', query)}</td>
        <td style="font-weight: 600; color: var(--text-primary); white-space: nowrap;">${highlightText(item.contractor, query)}</td>
        <td>${highlightText(item.rig, query)}</td>
        <td>${highlightText(item.supplier, query)}</td>
        <td><span class="status-badge status-${badgeClass}">${highlightText(item.status || 'Pending', query)}</span></td>
        <td>${highlightText(item.incoterm, query)}</td>
        <td>${highlightText(item.materialDesc, query)}</td>
        <td>${highlightText(item.freightType, query)}</td>
        <td>${highlightText(item.origin, query)}</td>
        <td>${highlightText(item.destination, query)}</td>
        <td>${highlightText(item.deliveryPlace, query)}</td>
        <td>${highlightText(item.vesselName, query)}</td>
        <td>${highlightText(item.shippingLine, query)}</td>
        <td>${highlightText(item.blAwb, query)}</td>
        <td>${highlightText(item.acid, query)}</td>
        <td>${highlightText(item.ffwForeign, query)}</td>
        <td>${highlightText(item.ffw, query)}</td>
        <td>${highlightText(item.containerNo, query)}</td>
        <td>${highlightText(item.containerType, query)}</td>
        <td>${highlightText(item.lcl, query)}</td>
        <td class="text-right">${highlightText(item.qty20, query)}</td>
        <td class="text-right">${highlightText(item.qty40, query)}</td>
        <td class="text-right">${highlightText(item.pkg, query)}</td>
        <td class="text-right">${highlightText(item.weightKg, query)}</td>
        <td style="white-space: nowrap;">${highlightText(item.etd ? item.etd.split('T')[0] : '', query)}</td>
        <td style="white-space: nowrap;">${highlightText(item.eta1 ? item.eta1.split('T')[0] : '', query)}</td>
        <td style="white-space: nowrap;">${highlightText(item.eta2 ? item.eta2.split('T')[0] : '', query)}</td>
        <td style="white-space: nowrap;">${highlightText(item.eta3 ? item.eta3.split('T')[0] : '', query)}</td>
        <td style="white-space: nowrap;">${highlightText(item.etaFinal ? item.etaFinal.split('T')[0] : '', query)}</td>
        <td style="white-space: nowrap;">${highlightText(item.sentToOperatorDate ? item.sentToOperatorDate.split('T')[0] : '', query)}</td>
        <td style="white-space: nowrap;">${highlightText(item.receivedFromOperatorDate ? item.receivedFromOperatorDate.split('T')[0] : '', query)}</td>
        <td style="white-space: nowrap;">${highlightText(item.sentToFfwDate ? item.sentToFfwDate.split('T')[0] : '', query)}</td>
        <td style="white-space: nowrap;">${highlightText(item.releasingDate ? item.releasingDate.split('T')[0] : '', query)}</td>
        <td style="white-space: nowrap;">${highlightText(item.kpiDate ? item.kpiDate.split('T')[0] : '', query)}</td>
        <td class="text-right">${highlightText(item.clearanceDate || item.clearancePeriod, query)}</td>
        <td>${highlightText(item.customDecReceived, query)}</td>
        <td>${highlightText(item.customDecNo, query)}</td>
        <td style="white-space: nowrap;">${highlightText(item.customDecDate ? item.customDecDate.split('T')[0] : '', query)}</td>
        <td class="text-right">${highlightText(item.customDecValue, query)}</td>
        <td>${highlightText(item.customCertNo, query)}</td>
        <td>${highlightText(item.customsReceiptNo, query)}</td>
        <td style="white-space: nowrap;">${highlightText(item.customsReceiptDate ? item.customsReceiptDate.split('T')[0] : '', query)}</td>
        <td>${highlightText(item.localInvoiceNo, query)}</td>
        <td class="text-right">${highlightText(item.valueFc, query)}</td>
        <td>${highlightText(item.fc, query)}</td>
        <td class="text-right">${highlightText(item.localChargesImmediate, query)}</td>
        <td class="text-right">${highlightText(item.localChargesCca, query)}</td>
        <td>${highlightText(item.demurrageInvoice, query)}</td>
        <td class="text-right">${highlightText(item.demurrageValue, query)}</td>
        <td>${highlightText(item.foreignInvoiceNo, query)}</td>
        <td style="white-space: nowrap;">${highlightText(item.receivingDate ? item.receivingDate.split('T')[0] : '', query)}</td>
        <td class="text-right">${highlightText(item.foreignInvoiceValue, query)}</td>
        <td class="text-right">${highlightText(item.localChargesUsd, query)}</td>
        <td class="text-right" style="font-weight: 700;">${highlightText(item.finalShipmentChargesUsd, query)}</td>
        <td>${highlightText(item.costRig, query)}</td>
        <td>${highlightText(item.prRig, query)}</td>
        <td>${highlightText(item.remarks, query)}</td>
        <td style="white-space: nowrap; font-weight: 600; color: var(--accent-blue);">${highlightText(item.createdBy, query)}</td>
        <td style="white-space: nowrap; font-weight: 600; color: var(--accent-purple);">${highlightText(item.lastModifiedBy, query)}</td>
    `;
}

function filterAndSearchOverviewData() {
    const searchInput = document.getElementById("overview-search-input");
    overviewSearchQuery = searchInput ? searchInput.value.toLowerCase().trim() : "";
    
    let result = shipmentsData;
    
    if (overviewStatusFilter !== "all") {
        result = result.filter(item => String(item.status || '').toLowerCase() === overviewStatusFilter.toLowerCase());
    }
    
    if (overviewSearchQuery) {
        result = result.filter(item => {
            return (
                String(item.mrNo || '').toLowerCase().includes(overviewSearchQuery) ||
                String(item.id || '').toLowerCase().includes(overviewSearchQuery) ||
                String(item.poNo || '').toLowerCase().includes(overviewSearchQuery) ||
                String(item.supplier || '').toLowerCase().includes(overviewSearchQuery) ||
                String(item.contractor || '').toLowerCase().includes(overviewSearchQuery) ||
                String(item.materialDesc || '').toLowerCase().includes(overviewSearchQuery)
            );
        });
    }
    
    renderSummaryTableFiltered(result, overviewSearchQuery);
}

function renderSummaryTable() {
    filterAndSearchOverviewData();
}

function renderSummaryTableFiltered(items, query = "") {
    const summaryTableBody = document.getElementById("summary-table-body");
    if (!summaryTableBody) return;
    summaryTableBody.innerHTML = "";
    
    const isManager = loggedInUser && (loggedInUser.email.toLowerCase() === "emad.said@egyptian-drilling.com" || loggedInUser.email.toLowerCase() === "ahmed.ibrahim@egyptian-drilling.com");
    
    const recordCountEl = document.getElementById("overview-record-count");
    if (recordCountEl) {
        recordCountEl.innerText = `Showing ${items.length} shipments${query || overviewStatusFilter !== 'all' ? ' (Filtered)' : ''}`;
    }
    
    // Set margin-top of the table container dynamically
    const summaryTableSection = document.querySelector("#panel-overview .data-table-section");
    const summaryTableContainer = document.querySelector("#panel-overview .table-container");
    
    if (summaryTableSection) {
        summaryTableSection.style.marginTop = isManager ? "1rem" : "0px";
    }
    
    if (summaryTableContainer) {
        if (isManager) {
            summaryTableContainer.style.height = "";
            summaryTableContainer.style.maxHeight = "";
            summaryTableContainer.style.overflowY = "";
        } else {
            summaryTableContainer.style.height = "calc(100vh - 150px)";
            summaryTableContainer.style.maxHeight = "none";
            summaryTableContainer.style.overflowY = "auto";
        }
    }
    
    let summaryItems = isManager ? items.slice(0, 15) : items;
    
    if (summaryItems.length === 0) {
        summaryTableBody.innerHTML = `<tr><td colspan="62" style="text-align: center; padding: 2rem;">No shipments found matching your search.</td></tr>`;
        return;
    }
    
    summaryItems.forEach(item => {
        const row = document.createElement("tr");
        row.innerHTML = generateShipmentRowHTML(item, query);
        row.addEventListener("click", () => window.editShipment(item.id));
        row.style.cursor = "pointer";
        summaryTableBody.appendChild(row);
    });
}

function renderTable() {
    const tableBody = document.getElementById("table-body");
    if (!tableBody) return;
    const recordCountText = document.getElementById("table-record-count");
    const paginationInfo = document.getElementById("pagination-info");
    const btnPrev = document.getElementById("btn-prev-page");
    const btnNext = document.getElementById("btn-next-page");
    
    tableBody.innerHTML = "";
    
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, totalItems);
    
    if (recordCountText) recordCountText.innerText = `Showing ${totalItems > 0 ? startIdx + 1 : 0} to ${endIdx} of ${totalItems} shipments`;
    if (paginationInfo) paginationInfo.innerText = `Page ${currentPage} of ${totalPages}`;
    
    if (btnPrev) btnPrev.disabled = currentPage === 1;
    if (btnNext) btnNext.disabled = currentPage === totalPages;
    
    const pageItems = filteredData.slice(startIdx, endIdx);
    
    if (pageItems.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="48" style="text-align: center; padding: 4rem;">No shipments found matching your search.</td></tr>`;
        return;
    }
    
    const searchInput = document.getElementById("search-input");
    const query = searchInput ? searchInput.value.trim() : "";
    
    pageItems.forEach(item => {
        const row = document.createElement("tr");
        row.style.cursor = "pointer";
        row.title = "Click to Edit Shipment";
        row.addEventListener("click", () => window.editShipment(item.id));
        row.innerHTML = generateShipmentRowHTML(item, query);
        tableBody.appendChild(row);
    });
    
    lucide.createIcons();
}

function filterAndSearchData() {
    const searchInput = document.getElementById("search-input");
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    
    let result = shipmentsData;
    
    if (currentStatusFilter !== "all") {
        result = result.filter(item => String(item.status || '').toLowerCase() === currentStatusFilter.toLowerCase());
    }
    
    if (query) {
        result = result.filter(item => {
            return (
                String(item.mrNo || '').toLowerCase().includes(query) ||
                String(item.id || '').toLowerCase().includes(query) ||
                String(item.poNo || '').toLowerCase().includes(query) ||
                String(item.supplier || '').toLowerCase().includes(query) ||
                String(item.contractor || '').toLowerCase().includes(query) ||
                String(item.materialDesc || '').toLowerCase().includes(query)
            );
        });
    }
    
    filteredData = result;
    currentPage = 1;
    renderTable();
}

function sortShipmentsData() {
    shipmentsData.sort((a, b) => {
        const valA = a.mrNo || (a.id ? String(a.id).split('_')[0] : '');
        const valB = b.mrNo || (b.id ? String(b.id).split('_')[0] : '');
        const numA = parseInt(valA);
        const numB = parseInt(valB);
        if (isNaN(numA) && isNaN(numB)) {
            return String(valA).localeCompare(String(valB));
        }
        if (isNaN(numA)) return 1;
        if (isNaN(numB)) return -1;
        return numA - numB;
    });
}



function saveShipment(item) {
    if (window.db) {
        window.db.collection("shipments").doc(String(item.id)).set(item)
            .then(() => console.log("Shipment saved to Firebase"))
            .catch(e => {
                console.error("Firebase save error:", e);
                saveToLocalStorage();
            });
    } else {
        saveToLocalStorage();
    }
}

function updateWizardUI() {
    const steps = document.querySelectorAll(".wizard-step");
    steps.forEach((step, idx) => {
        if (idx + 1 === currentWizardStep) {
            step.classList.add("active");
            step.classList.remove("completed");
        } else if (idx + 1 < currentWizardStep) {
            step.classList.add("completed");
            step.classList.remove("active");
        } else {
            step.classList.remove("active", "completed");
        }
    });

    const panels = document.querySelectorAll(".wizard-form-pane");
    panels.forEach(panel => panel.classList.remove("active"));
    
    const activePanel = document.getElementById(`wizard-pane-${currentWizardStep}`);
    if (activePanel) activePanel.classList.add("active");
    
    const btnPrev = document.getElementById("btn-wizard-prev");
    const btnNext = document.getElementById("btn-wizard-next");
    const btnSubmit = document.getElementById("btn-wizard-submit");
    
    if (currentWizardStep === 1) {
        btnPrev.classList.add("hidden");
        btnNext.classList.remove("hidden");
        btnSubmit.classList.remove("hidden");
    } else if (currentWizardStep === 3) {
        btnPrev.classList.remove("hidden");
        btnNext.classList.add("hidden");
        btnSubmit.classList.remove("hidden");
    } else {
        btnPrev.classList.remove("hidden");
        btnNext.classList.remove("hidden");
        btnSubmit.classList.remove("hidden");
    }
}

function setDropdownValue(selectId, customId, value) {
    const selectEl = document.getElementById(selectId);
    const customEl = document.getElementById(customId);
    if (!selectEl) return;
    const options = Array.from(selectEl.options).map(o => o.value);
    if (!value) {
        selectEl.value = "";
        if (customEl) { customEl.value = ""; customEl.classList.add("hidden"); }
        return;
    }
    if (options.includes(value)) {
        selectEl.value = value;
        if (customEl) { customEl.value = ""; customEl.classList.add("hidden"); }
    } else {
        selectEl.value = "other";
        if (customEl) { customEl.value = value; customEl.classList.remove("hidden"); }
    }
}

function updateAuthUI() {
    const btnCreate = document.getElementById("btn-create");
    const loginUserName = document.getElementById("login-user-name");
    const uploadZone = document.getElementById("upload-zone");
    const loginState = document.getElementById("logged-in-state");
    const loginForm = document.getElementById("form-login");
    const currentUserDisplay = document.getElementById("current-user-display");
    const btnManagerPanel = document.getElementById("btn-manager-panel");
    
    const isManager = loggedInUser && (loggedInUser.email.toLowerCase() === "emad.said@egyptian-drilling.com" || loggedInUser.email.toLowerCase() === "ahmed.ibrahim@egyptian-drilling.com");
    if (btnManagerPanel) {
        if (isManager) {
            btnManagerPanel.classList.remove("hidden");
        } else {
            btnManagerPanel.classList.add("hidden");
        }
    }
    
    // Reposition the main KPI grid depending on manager status
    const kpiGrid = document.getElementById("registry-kpi-grid");
    if (kpiGrid) {
        if (isManager) {
            // Move back to Overview Dashboard (above recent shipments summary table)
            const panelOverview = document.getElementById("panel-overview");
            if (panelOverview) {
                const tableSection = panelOverview.querySelector(".data-table-section");
                if (tableSection) {
                    panelOverview.insertBefore(kpiGrid, tableSection);
                } else {
                    panelOverview.appendChild(kpiGrid);
                }
            }
        } else {
            // Move to Analytics Dashboard (at the top, before the freight distribution grid)
            const panelAnalytics = document.getElementById("panel-analytics");
            if (panelAnalytics) {
                panelAnalytics.insertBefore(kpiGrid, panelAnalytics.firstChild);
            }
        }
    }
    
    const loginUserRole = document.getElementById("login-user-role");
    const currentUserRole = document.getElementById("current-user-role");

    if (loggedInUser) {
        if (btnCreate) btnCreate.style.display = "flex";
        if (uploadZone) uploadZone.style.display = "flex";
        if (loginUserName) loginUserName.innerText = loggedInUser.name;
        if (loginUserRole) {
            if (loggedInUser.role) {
                loginUserRole.innerText = loggedInUser.role;
                loginUserRole.classList.remove("hidden");
            } else {
                loginUserRole.innerText = "";
                loginUserRole.classList.add("hidden");
            }
        }
        if (loginState) loginState.classList.remove("hidden");
        if (loginForm) loginForm.classList.add("hidden");
        if (currentUserDisplay) currentUserDisplay.innerText = loggedInUser.name;
        if (currentUserRole) {
            if (loggedInUser.role) {
                currentUserRole.innerText = loggedInUser.role;
                currentUserRole.classList.remove("hidden");
            } else {
                currentUserRole.innerText = "";
                currentUserRole.classList.add("hidden");
            }
        }
    } else {
        if (btnCreate) btnCreate.style.display = "none";
        if (uploadZone) uploadZone.style.display = "none";
        if (loginUserName) loginUserName.innerText = "Login to Edit";
        if (loginUserRole) {
            loginUserRole.innerText = "";
            loginUserRole.classList.add("hidden");
        }
        if (loginState) loginState.classList.add("hidden");
        if (loginForm) loginForm.classList.remove("hidden");
        if (currentUserDisplay) currentUserDisplay.innerText = "";
        if (currentUserRole) {
            currentUserRole.innerText = "";
            currentUserRole.classList.add("hidden");
        }
    }
    renderSummaryTable();
}

window.editShipment = function(id) {
    if (!loggedInUser) {
        alert("You must be logged in to edit shipments.");
        return;
    }
    
    const item = shipmentsData.find(s => String(s.id) === String(id));
    if (!item) return;
    
    currentEditId = item.id;
    
    const panelCreate = document.getElementById("panel-create");
    const btnCreate = document.getElementById("btn-create");
    switchTab(btnCreate, panelCreate, "Edit Shipment", `Updating details for MR: ${item.mrNo || (item.id ? String(item.id).split('_')[0] : '')}`);
    
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.tagName.toLowerCase() === 'select') {
            const options = Array.from(el.options);
            const match = options.find(o => String(o.value).toLowerCase() === String(val).toLowerCase());
            if (match) el.value = match.value;
            else el.value = val;
        } else {
            el.value = val;
        }
    };
    
    setVal("form-shipment-id", item.mrNo || (item.id ? String(item.id).split('_')[0] : ""));
    if (typeof setPoPrValues === 'function') {
        setPoPrValues(item.poNo, item.prNo);
    }
    setVal("form-shipment-ref", item.shipmentRef || "");
    setVal("form-entity-shipment-no", item.entityShipmentNo || "");
    setVal("form-date", item.date ? item.date.split('T')[0] : "");
    setVal("form-status", item.status || "Pending");
    
    setDropdownValue("form-incoterm", "form-incoterm-custom", item.incoterm);
    setDropdownValue("form-contractor", "form-contractor-custom", item.contractor);
    setDropdownValue("form-rig", "form-rig-custom", item.rig);
    setDropdownValue("form-supplier", "form-supplier-custom", item.supplier);
    
    setVal("form-material-desc", item.materialDesc || "");
    
    setDropdownValue("form-freight-type", "form-freight-type-custom", item.freightType);
    setDropdownValue("form-origin", "form-origin-custom", item.origin);
    setDropdownValue("form-destination", "form-destination-custom", item.destination);
    
    setVal("form-delivery-place", item.deliveryPlace || "");
    setVal("form-vessel-name", item.vesselName || "");
    setVal("form-shipping-line", item.shippingLine || "");
    setVal("form-bl-awb", item.blAwb || "");
    setVal("form-acid", item.acid || "");
    
    setDropdownValue("form-ffw-foreign", "form-ffw-foreign-custom", item.ffwForeign);
    setDropdownValue("form-ffw", "form-ffw-custom", item.ffw);
    
    setVal("form-container-no", item.containerNo || "");
    setVal("form-container-type", item.containerType || "");
    setVal("form-lcl", item.lcl || "");
    setVal("form-c20", item.qty20 || "");
    setVal("form-c40", item.qty40 || "");
    setVal("form-pkg", item.pkg || "");
    setVal("form-weight", item.weightKg || "");
    
    setVal("form-etd", item.etd ? item.etd.split('T')[0] : "");
    setVal("form-eta-1st", item.eta1 ? item.eta1.split('T')[0] : "");
    setVal("form-eta-2nd", item.eta2 ? item.eta2.split('T')[0] : "");
    setVal("form-eta-3rd", item.ata ? item.ata.split('T')[0] : "");
    setVal("form-clearance-period", item.clearanceDate ? item.clearanceDate.split('T')[0] : "");
    
    setVal("form-value-fc", item.valueFc || "");
    setVal("form-fc", item.fc || "");
    setVal("form-local-charges-immediate", item.localChargesImmediate || "");
    setVal("form-local-charges-cca", item.localChargesCca || "");
    setVal("form-demurrage-inv", item.demurrageInvoice || "");
    setVal("form-demurrage-val", item.demurrageValue || "");
    setVal("form-foreign-invoice-no", item.foreignInvoiceNo || "");
    setVal("form-receiving-date", item.receivingDate ? item.receivingDate.split('T')[0] : "");
    setVal("form-foreign-invoice-value", item.foreignInvoiceValue || "");
    setVal("form-local-charges-usd", item.localChargesUsd || "");
    setVal("form-final-shipment-charges-usd", item.finalShipmentChargesUsd || "");
    setVal("form-cost-rig", item.costRig || "");
    setVal("form-pr-rig", item.prRig || "");
    setVal("form-remarks", item.remarks || "");
    
    const submitBtn = document.getElementById("btn-wizard-submit");
    if (submitBtn) submitBtn.innerHTML = `<i data-lucide="save"></i> Update Shipment`;
    lucide.createIcons();
    
    currentWizardStep = 1;
    updateWizardUI();
};

function setupEventListeners() {
    // Auth Event Listeners
    const modalLogin = document.getElementById("modal-login");
    const btnLoginModal = document.getElementById("btn-login-modal");
    const btnCloseLogin = document.getElementById("btn-close-login");
    const formLogin = document.getElementById("form-login");
    const btnLogout = document.getElementById("btn-logout");
    
    if (btnLoginModal && modalLogin) btnLoginModal.addEventListener("click", () => modalLogin.classList.remove("hidden"));
    if (btnCloseLogin && modalLogin) btnCloseLogin.addEventListener("click", () => modalLogin.classList.add("hidden"));
    
    if (formLogin) {
        formLogin.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value.trim().toLowerCase();
            const password = document.getElementById("login-password").value.trim();
            const errorEl = document.getElementById("login-error");
            
            const user = ALLOWED_USERS.find(u => u.email.toLowerCase() === email);
            if (user && password === "00000") {
                loggedInUser = user;
                localStorage.setItem("edc_logged_in_user", JSON.stringify(user));
                updateAuthUI();
                initDashboard();
                modalLogin.classList.add("hidden");
                errorEl.classList.add("hidden");
                formLogin.reset();
            } else {
                errorEl.classList.remove("hidden");
            }
        });
    }
    
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            loggedInUser = null;
            localStorage.removeItem("edc_logged_in_user");
            updateAuthUI();
            if (modalLogin) modalLogin.classList.add("hidden");
            const panelCreate = document.getElementById("panel-create");
            const panelManager = document.getElementById("panel-manager");
            const shouldRedirect = (panelCreate && !panelCreate.classList.contains("hidden")) || (panelManager && !panelManager.classList.contains("hidden"));
            if (shouldRedirect) {
                const btnOverview = document.getElementById("btn-overview");
                if (btnOverview) btnOverview.click();
            }
        });
    }

    const btnOverview = document.getElementById("btn-overview");
    const btnSearch = document.getElementById("btn-search");
    const btnCreate = document.getElementById("btn-create");
    const btnAnalytics = document.getElementById("btn-analytics");
    const linkViewAll = document.getElementById("link-view-all");
    const btnManagerPanel = document.getElementById("btn-manager-panel");
    
    const panelOverview = document.getElementById("panel-overview");
    const panelSearch = document.getElementById("panel-search");
    const panelCreate = document.getElementById("panel-create");
    const panelAnalytics = document.getElementById("panel-analytics");
    const panelManager = document.getElementById("panel-manager");
    
    if (btnOverview) {
        btnOverview.addEventListener("click", (e) => {
            e.preventDefault();
            switchTab(btnOverview, panelOverview, "EDC Logistics Registry", "Real-time supply chain tracking and shipment database");
            filterAndSearchData();
        });
    }
    
    if (btnAnalytics) {
        btnAnalytics.addEventListener("click", (e) => {
            e.preventDefault();
            switchTab(btnAnalytics, panelAnalytics, "Dashboard Analytics", "Detailed breakdown of pending shipments by freight type");
            updateAnalyticsDashboard();
        });
    }
    
    if (btnSearch) {
        btnSearch.addEventListener("click", (e) => {
            e.preventDefault();
            switchTab(btnSearch, panelSearch, "Shipment Registry & Search", "Search, filter, and export the entire logistics dataset");
            filterAndSearchData();
        });
    }
    
    if (btnManagerPanel && panelManager) {
        btnManagerPanel.addEventListener("click", (e) => {
            e.preventDefault();
            switchTab(btnManagerPanel, panelManager, "Manager Dashboard", "Executive financial summary and system activity logs");
            updateManagerDashboard();
        });
    }
    
    if (linkViewAll) {
        linkViewAll.addEventListener("click", (e) => {
            e.preventDefault();
            switchTab(btnSearch, panelSearch, "Shipment Registry & Search", "Search, filter, and export the entire logistics dataset");
            filterAndSearchData();
        });
    }
    
    if (btnCreate) {
        btnCreate.addEventListener("click", (e) => {
            e.preventDefault();
            currentEditId = null;
            switchTab(btnCreate, panelCreate, "Register New Shipment", "Follow the wizard to add a new shipment to the registry");
            
            const createForm = document.getElementById("create-shipment-form");
            if (createForm) createForm.reset();
            if (typeof clearPoPrRows === 'function') {
                clearPoPrRows();
                addPoPrRow("", "");
            }
            
            const lastMr = localStorage.getItem("last_entered_mr");
            if (lastMr) document.getElementById("form-shipment-id").value = lastMr;
            
            document.querySelectorAll(".custom-input").forEach(el => el.classList.add("hidden"));
            
            const submitBtn = document.getElementById("btn-wizard-submit");
            if (submitBtn) submitBtn.innerHTML = `<i data-lucide="save"></i> Save Shipment`;
            lucide.createIcons();
            
            currentWizardStep = 1;
            updateWizardUI();
        });
    }
    
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("keyup", filterAndSearchData);
    }
    
    const btnTriggerSearch = document.getElementById("btn-trigger-search");
    if (btnTriggerSearch) {
        btnTriggerSearch.addEventListener("click", filterAndSearchData);
    }
    
    const overviewSearchInput = document.getElementById("overview-search-input");
    if (overviewSearchInput) {
        overviewSearchInput.addEventListener("keyup", filterAndSearchOverviewData);
    }
    
    const overviewBtnTriggerSearch = document.getElementById("overview-btn-trigger-search");
    if (overviewBtnTriggerSearch) {
        overviewBtnTriggerSearch.addEventListener("click", filterAndSearchOverviewData);
    }
    
    const overviewBtnExportCurrent = document.getElementById("overview-btn-export-current");
    if (overviewBtnExportCurrent) {
        overviewBtnExportCurrent.addEventListener("click", () => {
            const overviewFilteredData = shipmentsData.filter(item => {
                const statusMatch = overviewStatusFilter === "all" || String(item.status || '').toLowerCase() === overviewStatusFilter.toLowerCase();
                if (!statusMatch) return false;
                
                if (overviewSearchQuery) {
                    return (
                        String(item.mrNo || '').toLowerCase().includes(overviewSearchQuery) ||
                        String(item.id || '').toLowerCase().includes(overviewSearchQuery) ||
                        String(item.poNo || '').toLowerCase().includes(overviewSearchQuery) ||
                        String(item.supplier || '').toLowerCase().includes(overviewSearchQuery) ||
                        String(item.contractor || '').toLowerCase().includes(overviewSearchQuery) ||
                        String(item.materialDesc || '').toLowerCase().includes(overviewSearchQuery)
                    );
                }
                return true;
            });
            
            if (overviewFilteredData.length === 0) {
                alert("No data to export.");
                return;
            }
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(overviewFilteredData);
            XLSX.utils.book_append_sheet(wb, ws, "Shipments");
            XLSX.writeFile(wb, "EDC_Logistics_Export.xlsx");
        });
    }
    
    const logSearchInput = document.getElementById("mgr-log-search");
    if (logSearchInput) {
        logSearchInput.addEventListener("keyup", (e) => {
            renderManagerLogs(e.target.value);
        });
    }
    
    const searchStatusFilters = document.querySelectorAll("#search-category-tabs .category-tab");
    searchStatusFilters.forEach(btn => {
        btn.addEventListener("click", (e) => {
            searchStatusFilters.forEach(b => b.classList.remove("active"));
            e.currentTarget.classList.add("active");
            currentStatusFilter = e.currentTarget.dataset.status;
            filterAndSearchData();
        });
    });
    
    const overviewStatusFilters = document.querySelectorAll("#overview-category-tabs .category-tab");
    overviewStatusFilters.forEach(btn => {
        btn.addEventListener("click", (e) => {
            overviewStatusFilters.forEach(b => b.classList.remove("active"));
            e.currentTarget.classList.add("active");
            overviewStatusFilter = e.currentTarget.dataset.status;
            filterAndSearchOverviewData();
        });
    });
    
    const btnPrev = document.getElementById("btn-prev-page");
    const btnNext = document.getElementById("btn-next-page");
    if (btnPrev) {
        btnPrev.addEventListener("click", () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        });
    }
    if (btnNext) {
        btnNext.addEventListener("click", () => {
            const totalPages = Math.ceil(filteredData.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
            }
        });
    }
    
    const btnExport = document.getElementById("btn-export");
    if (btnExport) {
        btnExport.addEventListener("click", exportFilteredData);
    }
    
    // Custom Fields Togglers
    const customFields = [
        { select: "form-incoterm", custom: "form-incoterm-custom" },
        { select: "form-contractor", custom: "form-contractor-custom" },
        { select: "form-rig", custom: "form-rig-custom" },
        { select: "form-supplier", custom: "form-supplier-custom" },
        { select: "form-freight-type", custom: "form-freight-type-custom" },
        { select: "form-origin", custom: "form-origin-custom" },
        { select: "form-destination", custom: "form-destination-custom" },
        { select: "form-ffw-foreign", custom: "form-ffw-foreign-custom" },
        { select: "form-ffw", custom: "form-ffw-custom" }
    ];
    
    customFields.forEach(field => {
        const selectEl = document.getElementById(field.select);
        const customEl = document.getElementById(field.custom);
        if (selectEl && customEl) {
            selectEl.addEventListener("change", () => {
                if (selectEl.value === "other") {
                    customEl.classList.remove("hidden");
                    customEl.required = true;
                } else {
                    customEl.classList.add("hidden");
                    customEl.required = false;
                }
            });
        }
    });

    // Wizard Controls
    const btnWizardPrev = document.getElementById("btn-wizard-prev");
    const btnWizardNext = document.getElementById("btn-wizard-next");
    
    if (btnWizardNext) {
        btnWizardNext.addEventListener("click", () => {
            if (currentWizardStep < 3) {
                currentWizardStep++;
                updateWizardUI();
            }
        });
    }
    
    if (btnWizardPrev) {
        btnWizardPrev.addEventListener("click", () => {
            if (currentWizardStep > 1) {
                currentWizardStep--;
                updateWizardUI();
            }
        });
    }
    
    const createForm = document.getElementById("create-shipment-form");
    const btnWizardSubmit = document.getElementById("btn-wizard-submit");
    if (btnWizardSubmit) {
        btnWizardSubmit.addEventListener("click", () => {
            
            const shipmentId = document.getElementById("form-shipment-id").value.trim();
            if (!shipmentId) {
                alert("MR No (Shipment ID) is required!");
                return;
            }
            
            const newPo = typeof getPoPrData === 'function' ? getPoPrData().poNo : "";
            const existing = shipmentsData.find(item => 
                String(item.mrNo || item.id || '').toLowerCase() === shipmentId.toLowerCase() &&
                String(item.poNo || '').toLowerCase() === newPo.toLowerCase()
            );
            if (existing && existing.id !== currentEditId) {
                alert(`A shipment with MR No ${shipmentId} and PO No ${newPo} already exists!`);
                return;
            }
            
            const getValue = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
            
            const incotermSelect = getValue("form-incoterm");
            const incoterm = incotermSelect === "other" ? getValue("form-incoterm-custom") : incotermSelect;
            
            const contractorSelect = getValue("form-contractor");
            const contractor = contractorSelect === "other" ? getValue("form-contractor-custom") : contractorSelect;
            
            const rigSelect = getValue("form-rig");
            const rig = rigSelect === "other" ? getValue("form-rig-custom") : rigSelect;
            
            const supplierSelect = getValue("form-supplier");
            const supplier = supplierSelect === "other" ? getValue("form-supplier-custom") : supplierSelect;
            
            const freightTypeSelect = getValue("form-freight-type");
            const freightType = freightTypeSelect === "other" ? getValue("form-freight-type-custom") : freightTypeSelect;
            
            const originSelect = getValue("form-origin");
            const origin = originSelect === "other" ? getValue("form-origin-custom") : originSelect;
            
            const destinationSelect = getValue("form-destination");
            const destination = destinationSelect === "other" ? getValue("form-destination-custom") : destinationSelect;
            
            const ffwForeignSelect = getValue("form-ffw-foreign");
            const ffwForeign = ffwForeignSelect === "other" ? getValue("form-ffw-foreign-custom") : ffwForeignSelect;
            
            const ffwSelect = getValue("form-ffw");
            const ffw = ffwSelect === "other" ? getValue("form-ffw-custom") : ffwSelect;
            
            const newItem = {
                id: currentEditId || (newPo ? `${shipmentId}_${newPo}` : `${shipmentId}_manual_${Date.now()}`),
                mrNo: shipmentId,
                poNo: newPo,
                prNo: typeof getPoPrData === 'function' ? getPoPrData().prNo : "",
                shipmentRef: getValue("form-shipment-ref"),
                entityShipmentNo: getValue("form-entity-shipment-no"),
                date: getValue("form-date"),
                status: getValue("form-status") || "Pending",
                incoterm: incoterm,
                contractor: contractor,
                rig: rig,
                supplier: supplier,
                materialDesc: getValue("form-material-desc"),
                freightType: freightType,
                origin: origin,
                destination: destination,
                deliveryPlace: getValue("form-delivery-place"),
                vesselName: getValue("form-vessel-name"),
                shippingLine: getValue("form-shipping-line"),
                blAwb: getValue("form-bl-awb"),
                acid: getValue("form-acid"),
                ffwForeign: ffwForeign,
                ffw: ffw,
                containerNo: getValue("form-container-no"),
                containerType: getValue("form-container-type"),
                lcl: getValue("form-lcl"),
                qty20: getValue("form-c20"),
                qty40: getValue("form-c40"),
                pkg: getValue("form-pkg"),
                weightKg: getValue("form-weight"),
                etd: getValue("form-etd"),
                eta1: getValue("form-eta-1st"),
                eta2: getValue("form-eta-2nd"),
                ata: getValue("form-eta-3rd"),
                clearanceDate: getValue("form-clearance-period"),
                valueFc: getValue("form-value-fc"),
                fc: getValue("form-fc"),
                localChargesImmediate: getValue("form-local-charges-immediate"),
                localChargesCca: getValue("form-local-charges-cca"),
                demurrageInvoice: getValue("form-demurrage-inv"),
                demurrageValue: getValue("form-demurrage-val"),
                foreignInvoiceNo: getValue("form-foreign-invoice-no"),
                receivingDate: getValue("form-receiving-date"),
                foreignInvoiceValue: getValue("form-foreign-invoice-value"),
                localChargesUsd: getValue("form-local-charges-usd"),
                finalShipmentChargesUsd: getValue("form-final-shipment-charges-usd"),
                costRig: getValue("form-cost-rig"),
                prRig: getValue("form-pr-rig"),
                remarks: getValue("form-remarks")
            };
            
            if (currentEditId) {
                const index = shipmentsData.findIndex(s => s.id === currentEditId);
                if (index !== -1) {
                    newItem.createdBy = shipmentsData[index].createdBy || "";
                    newItem.lastModifiedBy = loggedInUser ? loggedInUser.name : "";
                    const changes = getShipmentChanges(shipmentsData[index], newItem);
                    addAuditLog("Edit Shipment", newItem.id, newItem.poNo, newItem.status, changes);
                    shipmentsData[index] = newItem;
                }
                currentEditId = null;
                const submitBtn = document.getElementById("btn-wizard-submit");
                if (submitBtn) submitBtn.innerHTML = `<i data-lucide="save"></i> Save Shipment`;
            } else {
                newItem.createdBy = loggedInUser ? loggedInUser.name : "";
                newItem.lastModifiedBy = "";
                addAuditLog("Create Shipment", newItem.id, newItem.poNo, newItem.status, `Created shipment (PO: ${newItem.poNo}, Contractor: ${newItem.contractor}, Rig: ${newItem.rig})`);
                shipmentsData.unshift(newItem);
            }
            
            saveShipment(newItem);
            localStorage.setItem("last_entered_mr", shipmentId);
            
            
            if (createForm) createForm.reset();
            if (typeof clearPoPrRows === 'function') {
                clearPoPrRows();
                addPoPrRow("", "");
            }
            document.querySelectorAll(".custom-input").forEach(el => el.classList.add("hidden"));
            currentWizardStep = 1;
            updateWizardUI();
            
            initDashboard();
            switchTab(btnOverview, panelOverview, "EDC Logistics Registry", "Real-time supply chain tracking and shipment database", true);
        });
    }

    const fileInput = document.getElementById("excel-file-input");
    const uploadZone = document.getElementById("upload-zone");
    if (uploadZone && fileInput) {
        uploadZone.addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) handleExcelFile(e.target.files[0]);
        });
        uploadZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            uploadZone.classList.add("dragover");
        });
        uploadZone.addEventListener("dragleave", () => {
            uploadZone.classList.remove("dragover");
        });
        uploadZone.addEventListener("drop", (e) => {
            e.preventDefault();
            uploadZone.classList.remove("dragover");
            if (e.dataTransfer.files.length > 0) handleExcelFile(e.dataTransfer.files[0]);
        });
    }

    // Dynamic PO/PR Event Listeners
    const btnAddPoPr = document.getElementById("btn-add-po-pr");
    if (btnAddPoPr) {
        btnAddPoPr.addEventListener("click", () => {
            if (typeof addPoPrRow === 'function') addPoPrRow("", "");
        });
    }

    const uploadPoPrExcel = document.getElementById("upload-po-pr-excel");
    if (uploadPoPrExcel) {
        uploadPoPrExcel.addEventListener("change", (e) => {
            if (e.target.files.length > 0 && typeof handlePoPrExcelFile === 'function') {
                handlePoPrExcelFile(e.target.files[0]);
            }
        });
    }
}

function handleExcelFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheet];
            const json = XLSX.utils.sheet_to_json(worksheet, {defval: ""});
            
            const parsedData = json.map((row, index) => {
                let normalized = {};
                const findValueByKeywords = (obj, keywords) => {
                    const keys = Object.keys(obj);
                    for (const key of keys) {
                        const lowerKey = key.toLowerCase().trim();
                        if (keywords.some(k => lowerKey === k || lowerKey.includes(k) || k.includes(lowerKey))) {
                            return obj[key];
                        }
                    }
                    return null;
                };
                
                const mrVal = String(findValueByKeywords(row, ["mr", "m r", "shipment id", "id"]) || "").trim();
                const poVal = String(findValueByKeywords(row, ["oracle", "po", "p o"]) || "").trim();
                
                normalized.mrNo = mrVal;
                normalized.id = poVal ? `${mrVal}_${poVal}` : `${mrVal}_import_${index}`;
                normalized.poNo = poVal;
                normalized.prNo = findValueByKeywords(row, ["pr"]) || "";
                normalized.shipmentRef = findValueByKeywords(row, ["shipment ref", "reference"]) || "";
                normalized.entityShipmentNo = findValueByKeywords(row, ["entity"]) || "";
                
                let rDate = findValueByKeywords(row, ["date", "طھط§ط±ظٹط®"]);
                if (typeof rDate === "number") {
                    const dateObj = XLSX.SSF.parse_date_code(rDate);
                    normalized.date = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
                } else {
                    normalized.date = rDate || "";
                }
                
                normalized.contractor = findValueByKeywords(row, ["contractor", "ظ…ظ‚ط§ظˆظ„"]) || "";
                normalized.rig = findValueByKeywords(row, ["rig", "ط¨ط±ظٹظ…ط©"]) || "";
                normalized.supplier = findValueByKeywords(row, ["supplier", "ظ…ظˆط±ط¯", "vendor"]) || "";
                normalized.status = findValueByKeywords(row, ["status", "ط­ط§ظ„ط©", "ط§ظ„ط­ط§ظ„ط©"]) || "Pending";
                normalized.incoterm = findValueByKeywords(row, ["incoterm"]) || "";
                normalized.materialDesc = findValueByKeywords(row, ["material", "desc", "ظˆطµظپ"]) || "";
                normalized.freightType = findValueByKeywords(row, ["freight type", "freight"]) || "";
                normalized.origin = findValueByKeywords(row, ["origin", "port of origin"]) || "";
                normalized.destination = findValueByKeywords(row, ["destination", "final destination"]) || "";
                normalized.deliveryPlace = findValueByKeywords(row, ["delivery place"]) || "";
                normalized.vesselName = findValueByKeywords(row, ["vessel"]) || "";
                normalized.shippingLine = findValueByKeywords(row, ["shipping line", "air line"]) || "";
                normalized.blAwb = findValueByKeywords(row, ["b/l", "awb", "bill"]) || "";
                normalized.acid = findValueByKeywords(row, ["acid"]) || "";
                normalized.ffwForeign = findValueByKeywords(row, ["ffw", "foreign", "freight forwarder"]) || "";
                normalized.ffw = findValueByKeywords(row, ["local"]) || "";
                normalized.containerNo = findValueByKeywords(row, ["container no"]) || "";
                normalized.containerType = findValueByKeywords(row, ["container type"]) || "";
                normalized.lcl = findValueByKeywords(row, ["lcl"]) || "";
                normalized.qty20 = findValueByKeywords(row, ["20", "qty 20"]) || "";
                normalized.qty40 = findValueByKeywords(row, ["40", "qty 40"]) || "";
                normalized.pkg = findValueByKeywords(row, ["pkg"]) || "";
                normalized.weightKg = findValueByKeywords(row, ["weight"]) || "";
                
                normalized.etd = findValueByKeywords(row, ["etd"]) || "";
                normalized.eta1 = findValueByKeywords(row, ["1st eta"]) || "";
                normalized.eta2 = findValueByKeywords(row, ["2nd eta"]) || "";
                normalized.ata = findValueByKeywords(row, ["ata"]) || "";
                normalized.clearanceDate = findValueByKeywords(row, ["clearance date"]) || "";
                
                normalized.valueFc = findValueByKeywords(row, ["value f/c", "fc"]) || "";
                normalized.fc = findValueByKeywords(row, ["f/c", "currency"]) || "";
                normalized.localChargesImmediate = findValueByKeywords(row, ["local charges immediate"]) || "";
                normalized.localChargesCca = findValueByKeywords(row, ["local charges (cca)", "cca"]) || "";
                normalized.demurrageInvoice = findValueByKeywords(row, ["demurrage invoice"]) || "";
                normalized.demurrageValue = findValueByKeywords(row, ["demurrage value"]) || "";
                normalized.foreignInvoiceNo = findValueByKeywords(row, ["foreign invoice"]) || "";
                normalized.receivingDate = findValueByKeywords(row, ["receiving date"]) || "";
                normalized.foreignInvoiceValue = findValueByKeywords(row, ["foreign invoice value"]) || "";
                normalized.localChargesUsd = findValueByKeywords(row, ["local charges (usd)", "usd local"]) || "";
                normalized.finalShipmentChargesUsd = findValueByKeywords(row, ["final shipment", "final"]) || "";
                normalized.costRig = findValueByKeywords(row, ["cost /rig", "cost rig"]) || "";
                normalized.prRig = findValueByKeywords(row, ["pr rig"]) || "";
                normalized.remarks = findValueByKeywords(row, ["remarks", "note", "ظ…ظ„ط§ط­ط¸ط§طھ", "ظ…ظ„ط§ط­ط¸ط©"]) || "";
                
                return normalized;
            });
            
            shipmentsData = parsedData;
            saveToLocalStorage();
            filteredData = [...shipmentsData];
            currentPage = 1;
            
            addAuditLog("Import Excel", "Bulk", "-", "-", `Imported excel sheet containing ${parsedData.length} records.`);
            initDashboard();
            alert(`Successfully uploaded ${parsedData.length} records!`);
            
        } catch (error) {
            console.error(error);
            alert(`Error parsing file: ${error.message}`);
        }
    };
    reader.onerror = function() {
        alert("Error reading file from disk.");
    };
    reader.readAsArrayBuffer(file);
}

function exportFilteredData() {
    if (filteredData.length === 0) {
        alert("No data to export.");
        return;
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filteredData);
    XLSX.utils.book_append_sheet(wb, ws, "Shipments");
    XLSX.writeFile(wb, "EDC_Logistics_Export.xlsx");
}

function populateFormDropdowns() {
    if (typeof LOOKUP_DATA === 'undefined') return;
    
    const populateSelect = (selectId, dataArr) => {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = "";
            dataArr.forEach(item => {
                const opt = document.createElement("option");
                opt.value = item;
                opt.textContent = item;
                select.appendChild(opt);
            });
            const otherOpt = document.createElement("option");
            otherOpt.value = "other";
            otherOpt.textContent = "Other (Specify)";
            select.appendChild(otherOpt);
        }
    };
    
    populateSelect("form-incoterm", LOOKUP_DATA.incoterms);
    populateSelect("form-contractor", LOOKUP_DATA.contractors);
    populateSelect("form-rig", LOOKUP_DATA.rigs);
    populateSelect("form-freight-type", LOOKUP_DATA.freightTypes);
    populateSelect("form-origin", LOOKUP_DATA.origins);
    populateSelect("form-destination", LOOKUP_DATA.destinations);
    populateSelect("form-ffw-foreign", LOOKUP_DATA.freightForwardersForeign);
    populateSelect("form-ffw", LOOKUP_DATA.freightForwardersLocal);
    populateSelect("form-supplier", LOOKUP_DATA.carriers);
    
    const statusSelect = document.getElementById("form-status");
    if (statusSelect) {
        statusSelect.innerHTML = "";
        LOOKUP_DATA.statuses.forEach(item => {
            const opt = document.createElement("option");
            opt.value = item;
            opt.textContent = item;
            statusSelect.appendChild(opt);
        });
    }
}

// --- Manager Dashboard & Activity Log Functions ---

function addAuditLog(actionType, shipmentId, poNo, status, changesSummary) {
    const userDisplay = loggedInUser ? `${loggedInUser.name} (${loggedInUser.email})` : "System/Import";
    const timestamp = new Date().toLocaleString();
    
    const logEntry = {
        timestamp,
        user: userDisplay,
        actionType,
        shipmentId,
        poNo,
        status,
        changesSummary
    };

    if (window.db) {
        window.db.collection("logs").add(logEntry)
            .catch(e => console.error("Error adding log:", e));
    } else {
        let logs = [];
        const savedLogs = localStorage.getItem("edc_shipments_logs");
        if (savedLogs) {
            try { logs = JSON.parse(savedLogs); } catch(e){}
        }
        logs.unshift(logEntry);
        if (logs.length > 1000) logs = logs.slice(0, 1000);
        localStorage.setItem("edc_shipments_logs", JSON.stringify(logs));
    }
}

function getShipmentChanges(oldItem, newItem) {
    const changes = [];
    const fieldsToTrack = {
        status: "Status",
        poNo: "PO No",
        prNo: "PR No",
        shipmentRef: "Shipment Ref",
        entityShipmentNo: "Entity Shipment No",
        date: "Date",
        contractor: "Contractor",
        rig: "Rig",
        supplier: "Supplier",
        incoterm: "Incoterm",
        materialDesc: "Material Desc",
        freightType: "Freight Type",
        origin: "Origin",
        destination: "Destination",
        deliveryPlace: "Delivery Place",
        vesselName: "Vessel Name",
        shippingLine: "Shipping Line",
        blAwb: "B/L - AWB",
        acid: "ACID #",
        ffwForeign: "Foreign FFW",
        ffw: "Local FFW",
        containerNo: "Container No",
        containerType: "Container Type",
        lcl: "LCL",
        qty20: "20\" Qty",
        qty40: "40\" Qty",
        pkg: "PKG",
        weightKg: "Weight (KG)",
        etd: "ETD",
        eta1: "1st ETA",
        eta2: "2nd ETA",
        eta3: "3rd ETA",
        etaFinal: "Final ETA",
        sentToOperatorDate: "Sent to Operator",
        receivedFromOperatorDate: "Received from Operator",
        sentToFfwDate: "Sent to FFW",
        releasingDate: "Releasing Date",
        kpiDate: "KPI Date",
        clearanceDate: "Clearance Period",
        customDecReceived: "Custom Dec Received",
        customDecNo: "Custom Dec No",
        customDecDate: "Custom Dec Date",
        customDecValue: "Custom Dec Value",
        customCertNo: "Custom Cert No",
        customsReceiptNo: "Customs Receipt No",
        customsReceiptDate: "Customs Receipt Date",
        localInvoiceNo: "Local Invoice No",
        valueFc: "Value in F.C",
        fc: "F.C Currency",
        localChargesImmediate: "Local Charges (Official)",
        localChargesCca: "Local Charges (CCA)",
        demurrageInvoice: "Demurrage Invoice",
        demurrageValue: "Demurrage Value",
        foreignInvoiceNo: "Foreign Invoice No",
        receivingDate: "Receiving Date",
        foreignInvoiceValue: "Foreign Invoice Value",
        localChargesUsd: "Local Charges (USD)",
        finalShipmentChargesUsd: "Final Shipment Charges",
        costRig: "Cost /Rig",
        prRig: "PR Rig",
        remarks: "Remarks"
    };
    
    for (const key in fieldsToTrack) {
        let valOld = String(oldItem[key] || '').trim();
        let valNew = String(newItem[key] || '').trim();
        if (key === 'date' || key === 'etd' || key === 'eta1' || key === 'eta2' || key === 'eta3' || key === 'etaFinal' || key === 'sentToOperatorDate' || key === 'receivedFromOperatorDate' || key === 'sentToFfwDate' || key === 'releasingDate' || key === 'kpiDate' || key === 'customDecDate' || key === 'customsReceiptDate' || key === 'receivingDate') {
            if (valOld.includes('T')) valOld = valOld.split('T')[0];
            if (valNew.includes('T')) valNew = valNew.split('T')[0];
        }
        if (valOld !== valNew) {
            changes.push(`${fieldsToTrack[key]}: "${valOld || '-'}" â‍” "${valNew || '-'}"`);
        }
    }
    return changes.length > 0 ? changes.join(', ') : "No changes detected (save clicked)";
}

function updateManagerDashboard() {
    let totalLocalEgp = 0;
    let totalFinalUsd = 0;
    const fcSums = {};

    const rigCosts = {};
    const supplierStats = {};

    // New analytics variables
    let totalDemurrage = 0;
    let totalClearanceDays = 0;
    let clearanceDaysCount = 0;
    let missingAcidCount = 0;

    const freightStats = {};
    const incotermStats = {};
    const demurrageStats = {};
    const criticalAlertsList = [];

    shipmentsData.forEach(item => {
        // Value in FC
        const valFc = parseFloat(String(item.valueFc || '').replace(/,/g, '')) || 0;
        const curFc = String(item.fc || 'USD').trim().toUpperCase();
        if (valFc > 0) {
            fcSums[curFc] = (fcSums[curFc] || 0) + valFc;
        }

        // Local Charges
        const chgOfficial = parseFloat(String(item.localChargesImmediate || '').replace(/,/g, '')) || 0;
        const chgCca = parseFloat(String(item.localChargesCca || '').replace(/,/g, '')) || 0;
        totalLocalEgp += (chgOfficial + chgCca);

        // Final Shipment Charges (USD)
        const chgFinalUsd = parseFloat(String(item.finalShipmentChargesUsd || '').replace(/,/g, '')) || 0;
        totalFinalUsd += chgFinalUsd;

        // Rig Breakdown
        const rig = String(item.rig || 'N/A').trim();
        if (!rigCosts[rig]) {
            rigCosts[rig] = { cost: 0, count: 0 };
        }
        rigCosts[rig].cost += chgFinalUsd;
        rigCosts[rig].count += 1;

        // Supplier Breakdown
        const supplier = String(item.supplier || 'N/A').trim();
        const clearanceDays = parseFloat(item.clearanceDate || item.clearancePeriod) || null;
        if (!supplierStats[supplier]) {
            supplierStats[supplier] = { count: 0, clearanceDaysSum: 0, clearanceDaysCount: 0 };
        }
        supplierStats[supplier].count += 1;
        if (clearanceDays !== null && !isNaN(clearanceDays)) {
            supplierStats[supplier].clearanceDaysSum += clearanceDays;
            supplierStats[supplier].clearanceDaysCount += 1;
            totalClearanceDays += clearanceDays;
            clearanceDaysCount += 1;
        }

        // Demurrage Calculations
        const demurrageVal = parseFloat(String(item.demurrageValue || '').replace(/,/g, '')) || 0;
        totalDemurrage += demurrageVal;
        if (demurrageVal > 0) {
            if (!demurrageStats[supplier]) {
                demurrageStats[supplier] = { count: 0, total: 0 };
            }
            demurrageStats[supplier].count += 1;
            demurrageStats[supplier].total += demurrageVal;
        }

        // Freight Type Spending Calculations
        const freight = String(item.freightType || 'N/A').trim();
        if (!freightStats[freight]) {
            freightStats[freight] = { count: 0, spend: 0 };
        }
        freightStats[freight].count += 1;
        freightStats[freight].spend += chgFinalUsd;

        // Incoterm Spending Calculations
        const incoterm = String(item.incoterm || 'N/A').trim().toUpperCase();
        if (!incotermStats[incoterm]) {
            incotermStats[incoterm] = { count: 0, spend: 0 };
        }
        incotermStats[incoterm].count += 1;
        incotermStats[incoterm].spend += chgFinalUsd;

        // Critical Shipments & Missing ACID Alerts
        const statusLower = String(item.status || '').toLowerCase().trim();
        const isDelivered = statusLower === "delivered";
        if (!isDelivered) {
            let issue = "";
            if (!String(item.acid || '').trim()) {
                issue = "Missing ACID #";
                missingAcidCount++;
            } else if (statusLower === "delayed") {
                issue = "Shipment Delayed";
            } else if (statusLower === "pending" && !item.etd) {
                issue = "No ETD Specified";
            }
            
            if (issue) {
                criticalAlertsList.push({
                    id: item.id || 'N/A',
                    poNo: item.poNo || '-',
                    status: item.status || '-',
                    issue: issue
                });
            }
        }
    });

    // Format Foreign Currencies
    const fcParts = [];
    for (const cur in fcSums) {
        fcParts.push(`${cur} ${fcSums[cur].toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})}`);
    }
    const mgrValFc = document.getElementById("mgr-val-fc");
    if (mgrValFc) {
        mgrValFc.innerText = fcParts.length > 0 ? fcParts.join(" / ") : "EGP 0 / USD 0";
    }

    // Format Local Charges
    const mgrValLocalEgp = document.getElementById("mgr-val-local-egp");
    if (mgrValLocalEgp) {
        mgrValLocalEgp.innerText = `EGP ${totalLocalEgp.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})}`;
    }

    // Format Final Shipment Charges
    const mgrValFinalUsd = document.getElementById("mgr-val-final-usd");
    if (mgrValFinalUsd) {
        mgrValFinalUsd.innerText = `$${totalFinalUsd.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})}`;
    }

    // Populate New KPI elements:
    const mgrValDemurrage = document.getElementById("mgr-val-demurrage");
    if (mgrValDemurrage) {
        mgrValDemurrage.innerText = `$${totalDemurrage.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})}`;
    }

    const mgrValAvgClearance = document.getElementById("mgr-val-avg-clearance");
    if (mgrValAvgClearance) {
        const avgClearance = clearanceDaysCount > 0 ? Math.round(totalClearanceDays / clearanceDaysCount) : 0;
        mgrValAvgClearance.innerText = `${avgClearance} Days`;
    }

    const mgrValAcidAlerts = document.getElementById("mgr-val-acid-alerts");
    if (mgrValAcidAlerts) {
        mgrValAcidAlerts.innerText = missingAcidCount;
    }

    // Render Rig Costs Chart (Bar Chart)
    const rigCanvas = document.getElementById("mgr-chart-rig-costs");
    if (rigCanvas) {
        const sortedRigs = Object.keys(rigCosts).sort((a, b) => rigCosts[b].cost - rigCosts[a].cost).slice(0, 10); // Top 10
        const rigLabels = sortedRigs;
        const rigData = sortedRigs.map(rig => rigCosts[rig].cost);
        
        if (window.rigCostsChart) window.rigCostsChart.destroy();
        window.rigCostsChart = new Chart(rigCanvas, {
            type: 'bar',
            data: {
                labels: rigLabels,
                datasets: [{
                    label: 'Total Charges (USD)',
                    data: rigData,
                    backgroundColor: '#8b5cf6',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } }
            }
        });
    }

    // Render Supplier Stats Chart (Doughnut)
    const supplierCanvas = document.getElementById("mgr-chart-supplier-stats");
    if (supplierCanvas) {
        const sortedSuppliers = Object.keys(supplierStats).sort((a, b) => supplierStats[b].count - supplierStats[a].count).slice(0, 6);
        const supLabels = sortedSuppliers;
        const supData = sortedSuppliers.map(sup => supplierStats[sup].count);
        
        if (window.supplierStatsChart) window.supplierStatsChart.destroy();
        window.supplierStatsChart = new Chart(supplierCanvas, {
            type: 'doughnut',
            data: {
                labels: supLabels,
                datasets: [{
                    data: supData,
                    backgroundColor: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { position: 'right', labels: { color: '#94a3b8', font: { family: "'Plus Jakarta Sans', sans-serif" } } }
                }
            }
        });
    }

    // Render Freight Type Stats Chart (Pie)
    const freightCanvas = document.getElementById("mgr-chart-freight-stats");
    if (freightCanvas) {
        const sortedFreight = Object.keys(freightStats).sort((a, b) => freightStats[b].spend - freightStats[a].spend);
        const frLabels = sortedFreight;
        const frData = sortedFreight.map(fr => freightStats[fr].spend);
        
        if (window.freightStatsChart) window.freightStatsChart.destroy();
        window.freightStatsChart = new Chart(freightCanvas, {
            type: 'pie',
            data: {
                labels: frLabels,
                datasets: [{
                    data: frData,
                    backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981', '#f43f5e', '#eab308'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: '#94a3b8', font: { family: "'Plus Jakarta Sans', sans-serif" } } }
                }
            }
        });
    }

    // Render Incoterms Stats Chart (Bar)
    const incotermCanvas = document.getElementById("mgr-chart-incoterm-stats");
    if (incotermCanvas) {
        const sortedIncoterms = Object.keys(incotermStats).sort((a, b) => incotermStats[b].spend - incotermStats[a].spend);
        const incLabels = sortedIncoterms;
        const incData = sortedIncoterms.map(inc => incotermStats[inc].spend);
        
        if (window.incotermStatsChart) window.incotermStatsChart.destroy();
        window.incotermStatsChart = new Chart(incotermCanvas, {
            type: 'bar',
            data: {
                labels: incLabels,
                datasets: [{
                    label: 'Total Spend (USD)',
                    data: incData,
                    backgroundColor: '#10b981',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } }
            }
        });
    }

    // Render Demurrage by Supplier Table
    const demurrageTbody = document.getElementById("mgr-table-demurrage-stats");
    if (demurrageTbody) {
        demurrageTbody.innerHTML = "";
        const sortedDemurrage = Object.keys(demurrageStats).sort((a, b) => demurrageStats[b].total - demurrageStats[a].total);
        if (sortedDemurrage.length === 0) {
            demurrageTbody.innerHTML = `<tr><td colspan="3" class="text-center" style="color: var(--text-secondary);">No demurrage data available</td></tr>`;
        } else {
            sortedDemurrage.forEach(sup => {
                const info = demurrageStats[sup];
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td style="font-weight: 600; color: var(--text-primary);">${sup}</td>
                    <td class="text-right">${info.count}</td>
                    <td class="text-right" style="font-weight: 700; color: #ef4444;">$${info.total.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})}</td>
                `;
                demurrageTbody.appendChild(tr);
            });
        }
    }

    // Render Critical Shipment Alerts Table
    const criticalTbody = document.getElementById("mgr-table-critical-alerts");
    if (criticalTbody) {
        criticalTbody.innerHTML = "";
        if (criticalAlertsList.length === 0) {
            criticalTbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color: var(--emerald); font-weight: 600; padding: 1rem;"><i data-lucide="check" style="vertical-align: middle; margin-right: 0.25rem;"></i> All active shipments are healthy!</td></tr>`;
        } else {
            criticalAlertsList.forEach(alert => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td style="font-weight: 700; color: var(--accent-purple);">${alert.id}</td>
                    <td>${alert.poNo}</td>
                    <td><span class="status-badge status-delayed" style="font-size: 0.75rem; padding: 2px 6px;">${alert.status}</span></td>
                    <td style="font-weight: 600; color: #ef4444;"><i data-lucide="alert-circle" style="vertical-align: middle; width: 14px; height: 14px; margin-right: 4px; display: inline-block;"></i>${alert.issue}</td>
                `;
                criticalTbody.appendChild(tr);
            });
        }
    }

    // Render Logs Table
    renderManagerLogs();

    // Initialize lucide icons for newly added tables (like check and alert-circle)
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

function renderManagerLogs(filterText = "") {
    const logsTbody = document.getElementById("mgr-table-logs");
    if (!logsTbody) return;

    logsTbody.innerHTML = "";

    const processLogs = (logs) => {
        const term = filterText.toLowerCase().trim();
        const filteredLogs = logs.filter(log => {
            if (!term) return true;
            return String(log.user || '').toLowerCase().includes(term) ||
                   String(log.actionType || '').toLowerCase().includes(term) ||
                   String(log.shipmentId || '').toLowerCase().includes(term) ||
                   String(log.poNo || '').toLowerCase().includes(term) ||
                   String(log.status || '').toLowerCase().includes(term) ||
                   String(log.changesSummary || '').toLowerCase().includes(term);
        });

        if (filteredLogs.length === 0) {
            logsTbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color: var(--text-secondary); padding: 1.5rem;">No activity log records found</td></tr>`;
            return;
        }

        filteredLogs.forEach(log => {
            const tr = document.createElement("tr");
            let badgeColor = "var(--text-secondary)";
            if (log.actionType.includes("Create")) badgeColor = "var(--emerald)";
            else if (log.actionType.includes("Edit")) badgeColor = "var(--accent-blue)";
            else if (log.actionType.includes("Import")) badgeColor = "var(--accent-purple)";

            tr.innerHTML = `
                <td style="white-space: nowrap; font-size: 0.85rem; color: var(--text-secondary);">${log.timestamp}</td>
                <td style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary);">${log.user}</td>
                <td><span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; background: rgba(255,255,255,0.05); color: ${badgeColor}; border: 1px solid ${badgeColor};">${log.actionType}</span></td>
                <td style="font-weight: 700; color: var(--accent-purple);">${log.shipmentId || '-'}</td>
                <td>${log.poNo || '-'}</td>
                <td><span class="status-badge" style="font-size: 0.75rem; padding: 2px 6px;">${log.status || '-'}</span></td>
                <td style="font-size: 0.8rem; color: var(--text-secondary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.changesSummary}">${log.changesSummary || '-'}</td>
            `;
            logsTbody.appendChild(tr);
        });
    };

    if (window.db) {
        window.db.collection("logs").orderBy("timestamp", "desc").limit(500).get().then(snapshot => {
            const logs = [];
            snapshot.forEach(doc => logs.push(doc.data()));
            processLogs(logs);
        }).catch(e => {
            console.error("Error fetching logs from Firebase:", e);
            fetchLocalLogs();
        });
    } else {
        fetchLocalLogs();
    }

    function fetchLocalLogs() {
        let logs = [];
        const savedLogs = localStorage.getItem("edc_shipments_logs");
        if (savedLogs) {
            try { logs = JSON.parse(savedLogs); } catch(e){}
        }
        processLogs(logs);
    }
}

// ----------------------------------------------------
// Dynamic PO & PR Row Management
// ----------------------------------------------------

function addPoPrRow(poValue = "", prValue = "") {
    const container = document.getElementById("po-pr-rows-container");
    if (!container) return;

    const row = document.createElement("div");
    row.className = "po-pr-row";
    row.innerHTML = `
        <div class="form-group">
            <input type="text" class="po-input" placeholder="PO Number (e.g. P24E39644)" value="${poValue}">
        </div>
        <div class="form-group">
            <input type="text" class="pr-input" placeholder="PR (e.g. E33240554)" value="${prValue}">
        </div>
        <button type="button" class="btn-remove-row" title="Remove Row">
            <i data-lucide="trash-2"></i>
        </button>
    `;

    // Add remove event listener
    const removeBtn = row.querySelector(".btn-remove-row");
    removeBtn.addEventListener("click", () => {
        row.remove();
        // Always keep at least one empty row
        if (container.children.length === 0) {
            addPoPrRow("", "");
        }
    });

    container.appendChild(row);
    lucide.createIcons();
}

function clearPoPrRows() {
    const container = document.getElementById("po-pr-rows-container");
    if (container) {
        container.innerHTML = "";
    }
}

function setPoPrValues(poNoStr, prNoStr) {
    clearPoPrRows();
    
    // Split the comma-separated strings
    const pos = poNoStr ? String(poNoStr).split(',').map(s => s.trim()) : [];
    const prs = prNoStr ? String(prNoStr).split(',').map(s => s.trim()) : [];
    
    const maxLen = Math.max(pos.length, prs.length);
    if (maxLen === 0) {
        addPoPrRow("", "");
    } else {
        for (let i = 0; i < maxLen; i++) {
            addPoPrRow(pos[i] || "", prs[i] || "");
        }
    }
}

function getPoPrData() {
    const container = document.getElementById("po-pr-rows-container");
    if (!container) return { poNo: "", prNo: "" };
    
    const poInputs = container.querySelectorAll(".po-input");
    const prInputs = container.querySelectorAll(".pr-input");
    
    const pos = [];
    const prs = [];
    
    poInputs.forEach(input => {
        const val = input.value.trim();
        if (val) pos.push(val);
    });
    
    prInputs.forEach(input => {
        const val = input.value.trim();
        if (val) prs.push(val);
    });
    
    return {
        poNo: pos.join(", "),
        prNo: prs.join(", ")
    };
}

function handlePoPrExcelFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheet];
            const json = XLSX.utils.sheet_to_json(worksheet, {defval: ""});
            
            const rows = [];
            json.forEach(row => {
                const findValueByKeywords = (obj, keywords) => {
                    const keys = Object.keys(obj);
                    for (const key of keys) {
                        const lowerKey = key.toLowerCase().trim();
                        if (keywords.some(k => lowerKey === k || lowerKey.includes(k) || k.includes(lowerKey))) {
                            return obj[key];
                        }
                    }
                    return "";
                };
                
                const poVal = String(findValueByKeywords(row, ["po", "purchase order", "oracle", "p o"]) || "").trim();
                const prVal = String(findValueByKeywords(row, ["pr", "purchase request", "p r"]) || "").trim();
                
                if (poVal || prVal) {
                    rows.push({ po: poVal, pr: prVal });
                }
            });
            
            if (rows.length > 0) {
                clearPoPrRows();
                rows.forEach(r => {
                    addPoPrRow(r.po, r.pr);
                });
                alert(`Successfully imported ${rows.length} PO/PR records from Excel!`);
            } else {
                alert("No PO or PR columns found in the uploaded file.");
            }
        } catch (error) {
            console.error("Error reading PO/PR Excel:", error);
            alert("Failed to parse the Excel file: " + error.message);
        }
    };
    reader.readAsArrayBuffer(file);
    // Reset file input value so user can upload the same file again if they want
    const fileInput = document.getElementById("upload-po-pr-excel");
    if (fileInput) fileInput.value = "";
}

// ----------------------------------------------------
// Firebase Migration Utility
// ----------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    // Show migrate button if Firebase is active
    setTimeout(() => {
        const btnMigrate = document.getElementById("btn-migrate-firebase");
        if (btnMigrate && window.db) {
            btnMigrate.style.display = "inline-block";
            btnMigrate.addEventListener("click", async () => {
                const confirmMigrate = confirm("This will upload your local mock shipments to Firebase. Doing this might exhaust your free Firebase quota if you have thousands of records. Do you want to proceed by uploading a small batch (first 100 records) to test?");
                if (!confirmMigrate) return;
                
                let localData = [];
                try {
                    const saved = localStorage.getItem("edc_shipments_data");
                    if (saved) localData = JSON.parse(saved);
                } catch(e) {}
                
                if (localData.length === 0) {
                    alert("No local data to migrate.");
                    return;
                }
                
                const batchSize = Math.min(localData.length, 100);
                const batch = localData.slice(0, batchSize);
                let successCount = 0;
                
                btnMigrate.disabled = true;
                btnMigrate.innerHTML = `<i data-lucide="loader" class="spin"></i> Migrating...`;
                
                for (const item of batch) {
                    try {
                        await window.db.collection("shipments").doc(String(item.id)).set(item);
                        successCount++;
                    } catch (e) {
                        console.error("Error migrating document:", e);
                    }
                }
                
                alert(`Migration complete! Successfully uploaded ${successCount} records to Firebase.`);
                btnMigrate.innerHTML = `<i data-lucide="check"></i> Migration Done`;
                lucide.createIcons();
            });
        }
    }, 1500);
});
// ----------------------------------------------------
// Bulk Excel Import
// ----------------------------------------------------
function handleBulkExcelImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheet];
            const json = XLSX.utils.sheet_to_json(worksheet, {defval: ""});
            
            if(json.length === 0) {
                alert("The Excel file is empty!");
                return;
            }

            let importedCount = 0;
            let updatedCount = 0;
            
            const mapColumn = (row, exactMatches, partialMatches = []) => {
                const keys = Object.keys(row);
                for(let k of keys) {
                    const cleanK = k.toLowerCase().replace(/\s+/g, ' ').trim();
                    if(exactMatches.some(m => cleanK === m.toLowerCase())) return String(row[k] || "").trim();
                }
                for(let k of keys) {
                    const cleanK = k.toLowerCase().replace(/\s+/g, ' ').trim();
                    if(partialMatches.some(m => cleanK.includes(m.toLowerCase()))) return String(row[k] || "").trim();
                }
                return "";
            };

            json.forEach((row, index) => {
                const mrNo = mapColumn(row, ["mr no.", "mr no", "mr number"]);
                if(!mrNo) return;

                const poNo = mapColumn(row, ["oracle po number", "oracle po", "po number", "po no"]);
                const id = poNo ? `${mrNo}_${poNo}` : `${mrNo}_manual_${Date.now()}_${index}`;

                const newItem = {
                    id: id,
                    mrNo: mrNo,
                    poNo: poNo,
                    prNo: mapColumn(row, ["pr #", "pr no"]),
                    status: mapColumn(row, ["status"]),
                    date: mapColumn(row, ["status date"]),
                    supplier: mapColumn(row, ["supplier"]),
                    vesselName: mapColumn(row, ["vessel name", "vessel"]),
                    shippingLine: mapColumn(row, ["shipping line // air line", "shipping line", "air line"]),
                    blAwb: mapColumn(row, ["b/l - awb(f/z invoice no.)", "b/l", "awb"]),
                    acid: mapColumn(row, ["acid #", "acid"]),
                    freightType: mapColumn(row, ["freight type"]),
                    origin: mapColumn(row, ["port of origin", "origin"]),
                    destination: mapColumn(row, ["final destination", "destination"]),
                    ffwForeign: mapColumn(row, ["freight forwarder (forigen)", "freight forwarder foreign"]),
                    etd: mapColumn(row, ["etd"]),
                    eta1: mapColumn(row, ["1st eta"]),
                    eta2: mapColumn(row, ["2nd eta"]),
                    ata: mapColumn(row, ["3rd eta"]),
                    etaFinal: mapColumn(row, ["final eta"]),
                    containerType: mapColumn(row, ["container type"]),
                    lcl: mapColumn(row, ["lcl"]),
                    qty20: mapColumn(row, ["20'", "20"]),
                    qty40: mapColumn(row, ["40'", "40"]),
                    pkg: mapColumn(row, ["pkg"]),
                    weightKg: mapColumn(row, ["total weight (b/l) / kg", "total weight", "weight"]),
                    containerNo: mapColumn(row, ["container no"]),
                    shipmentRef: mapColumn(row, ["shipment ref.", "shipment ref"]),
                    entityShipmentNo: mapColumn(row, ["entity shipment #", "entity shipment"]),
                    valueFc: mapColumn(row, ["value in (f.c)"]),
                    fc: mapColumn(row, ["f.c", "fc"]),
                    materialDesc: mapColumn(row, ["material description", "material"]),
                    contractor: mapColumn(row, ["contractor"]),
                    sentToOperatorDate: mapColumn(row, ["sent to operator (date)", "sent to operator"]),
                    receivedFromOperatorDate: mapColumn(row, ["received from operator (date)", "received from operator"]),
                    ffw: mapColumn(row, ["freight forwarder", "ffw"], ["freight forwarder"]),
                    sentToFfwDate: mapColumn(row, ["sent to ffw (date)", "sent to ffw"]),
                    deliveryPlace: mapColumn(row, ["delivery place"]),
                    releasingDate: mapColumn(row, ["releasing (date)", "releasing"]),
                    kpiDate: mapColumn(row, ["kpi date"]),
                    clearanceDate: mapColumn(row, ["clearance period(days)", "clearance period"]),
                    customDeclarationReceivedDate: mapColumn(row, ["original custom declaration received date", "custom declaration received"]),
                    rig: mapColumn(row, ["rig no.", "rig no", "rig"]),
                    customDeclarationNo: mapColumn(row, ["custom declaration no.", "custom declaration no"]),
                    customDeclarationDate: mapColumn(row, ["custom declaration date"]),
                    customDeclarationValue: mapColumn(row, ["custom declaration value"]),
                    customCertificateNo: mapColumn(row, ["custom certeficate no.", "custom certificate no.", "custom certificate"]),
                    customsReceiptNo: mapColumn(row, ["customs reciept no.", "customs receipt no.", "customs receipt no"]),
                    customsReceiptDate: mapColumn(row, ["customs reciept date", "customs receipt date"]),
                    localInvoiceNo: mapColumn(row, ["local invoice no.", "local invoice no"]),
                    localChargesImmediate: mapColumn(row, ["total local charges (egp) - immediate payment - official receipt", "immediate payment"]),
                    localChargesCca: mapColumn(row, ["total local charges (egp) - cca service", "cca service"]),
                    demurrageInvoice: mapColumn(row, ["demurrage , storage & discharge fees invoice", "demurrage invoice"]),
                    demurrageValue: "",
                    foreignInvoiceNo: mapColumn(row, ["forigen invoice no.", "foreign invoice no.", "foreign invoice no"]),
                    receivingDate: mapColumn(row, ["receiving date"]),
                    foreignInvoiceValue: "",
                    localChargesUsd: mapColumn(row, ["local charges (usd)", "local charges usd"]),
                    finalShipmentChargesUsd: mapColumn(row, ["final shipment charges"]),
                    remarks: mapColumn(row, ["remarks"]),
                    createdBy: typeof loggedInUser !== "undefined" && loggedInUser ? loggedInUser.name : "Excel Import",
                    lastModifiedBy: typeof loggedInUser !== "undefined" && loggedInUser ? loggedInUser.name : "Excel Import"
                };

                const keys = Object.keys(row);
                let valueCols = keys.filter(k => k.toLowerCase().trim().startsWith("value") && k.length <= 8);
                if (valueCols.length > 0) newItem.demurrageValue = String(row[valueCols[0]] || "");
                if (valueCols.length > 1) newItem.foreignInvoiceValue = String(row[valueCols[1]] || "");

                const existingIdx = typeof shipmentsData !== "undefined" ? shipmentsData.findIndex(s => s.mrNo === mrNo && (s.poNo === poNo || !poNo)) : -1;
                if(existingIdx !== -1) {
                    newItem.id = shipmentsData[existingIdx].id;
                    newItem.createdBy = shipmentsData[existingIdx].createdBy || newItem.createdBy;
                    shipmentsData[existingIdx] = Object.assign({}, shipmentsData[existingIdx], newItem);
                    updatedCount++;
                } else {
                    if (typeof shipmentsData !== "undefined") shipmentsData.push(newItem);
                    importedCount++;
                }

                if(window.saveShipment) {
                    window.saveShipment(newItem);
                }
            });

            alert(`أ¢إ“â€¦ Excel Import Complete!\n\nImported New: ${importedCount}\nUpdated Existing: ${updatedCount}`);
            if (typeof renderShipmentsTable === 'function') renderShipmentsTable();
            if (typeof updateDashboardKPIs === 'function') updateDashboardKPIs();
            
        } catch(err) {
            console.error("Bulk Import Error:", err);
            alert("Error parsing Excel: " + err.message);
        }
        e.target.value = ""; 
    };
    reader.readAsArrayBuffer(file);
}

document.addEventListener("DOMContentLoaded", () => {
    const bulkImportExcel = document.getElementById("bulk-import-excel");
    if (bulkImportExcel) {
        bulkImportExcel.addEventListener("change", handleBulkExcelImport);
    }
});

// ----------------------------------------------------
// Bulk Excel Import
// ----------------------------------------------------
function handleBulkExcelImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheet];
            const json = XLSX.utils.sheet_to_json(worksheet, {defval: ""});
            
            if(json.length === 0) {
                alert("The Excel file is empty!");
                return;
            }

            let importedCount = 0;
            let updatedCount = 0;
            
            const mapColumn = (row, exactMatches, partialMatches = []) => {
                const keys = Object.keys(row);
                for(let k of keys) {
                    const cleanK = k.toLowerCase().replace(/\s+/g, ' ').trim();
                    if(exactMatches.some(m => cleanK === m.toLowerCase())) return String(row[k] || "").trim();
                }
                for(let k of keys) {
                    const cleanK = k.toLowerCase().replace(/\s+/g, ' ').trim();
                    if(partialMatches.some(m => cleanK.includes(m.toLowerCase()))) return String(row[k] || "").trim();
                }
                return "";
            };

            json.forEach((row, index) => {
                const mrNo = mapColumn(row, ["mr no.", "mr no", "mr number", "mr#", "m.r"], ["mr", "shipment id", "m.r"]);
                if(!mrNo) return;

                const poNo = mapColumn(row, ["oracle po number", "oracle po", "po number", "po no"]);
                const id = poNo ? `${mrNo}_${poNo}` : `${mrNo}_manual_` + Date.now() + "_" + index;

                const newItem = {
                    id: id,
                    mrNo: mrNo,
                    poNo: poNo,
                    prNo: mapColumn(row, ["pr #", "pr no"]),
                    status: mapColumn(row, ["status"]),
                    date: mapColumn(row, ["status date"]),
                    supplier: mapColumn(row, ["supplier"]),
                    vesselName: mapColumn(row, ["vessel name", "vessel"]),
                    shippingLine: mapColumn(row, ["shipping line // air line", "shipping line", "air line"]),
                    blAwb: mapColumn(row, ["b/l - awb(f/z invoice no.)", "b/l", "awb"]),
                    acid: mapColumn(row, ["acid #", "acid"]),
                    freightType: mapColumn(row, ["freight type"]),
                    origin: mapColumn(row, ["port of origin", "origin"]),
                    destination: mapColumn(row, ["final destination", "destination"]),
                    ffwForeign: mapColumn(row, ["freight forwarder (forigen)", "freight forwarder foreign"]),
                    etd: mapColumn(row, ["etd"]),
                    eta1: mapColumn(row, ["1st eta"]),
                    eta2: mapColumn(row, ["2nd eta"]),
                    ata: mapColumn(row, ["3rd eta"]),
                    etaFinal: mapColumn(row, ["final eta"]),
                    containerType: mapColumn(row, ["container type"]),
                    lcl: mapColumn(row, ["lcl"]),
                    qty20: mapColumn(row, ["20'", "20"]),
                    qty40: mapColumn(row, ["40'", "40"]),
                    pkg: mapColumn(row, ["pkg"]),
                    weightKg: mapColumn(row, ["total weight (b/l) / kg", "total weight", "weight"]),
                    containerNo: mapColumn(row, ["container no"]),
                    shipmentRef: mapColumn(row, ["shipment ref.", "shipment ref"]),
                    entityShipmentNo: mapColumn(row, ["entity shipment #", "entity shipment"]),
                    valueFc: mapColumn(row, ["value in (f.c)"]),
                    fc: mapColumn(row, ["f.c", "fc"]),
                    materialDesc: mapColumn(row, ["material description", "material"]),
                    contractor: mapColumn(row, ["contractor"]),
                    sentToOperatorDate: mapColumn(row, ["sent to operator (date)", "sent to operator"]),
                    receivedFromOperatorDate: mapColumn(row, ["received from operator (date)", "received from operator"]),
                    ffw: mapColumn(row, ["freight forwarder", "ffw"], ["freight forwarder"]),
                    sentToFfwDate: mapColumn(row, ["sent to ffw (date)", "sent to ffw"]),
                    deliveryPlace: mapColumn(row, ["delivery place"]),
                    releasingDate: mapColumn(row, ["releasing (date)", "releasing"]),
                    kpiDate: mapColumn(row, ["kpi date"]),
                    clearanceDate: mapColumn(row, ["clearance period(days)", "clearance period"]),
                    customDeclarationReceivedDate: mapColumn(row, ["original custom declaration received date", "custom declaration received"]),
                    rig: mapColumn(row, ["rig no.", "rig no", "rig"]),
                    customDeclarationNo: mapColumn(row, ["custom declaration no.", "custom declaration no"]),
                    customDeclarationDate: mapColumn(row, ["custom declaration date"]),
                    customDeclarationValue: mapColumn(row, ["custom declaration value"]),
                    customCertificateNo: mapColumn(row, ["custom certeficate no.", "custom certificate no.", "custom certificate"]),
                    customsReceiptNo: mapColumn(row, ["customs reciept no.", "customs receipt no.", "customs receipt no"]),
                    customsReceiptDate: mapColumn(row, ["customs reciept date", "customs receipt date"]),
                    localInvoiceNo: mapColumn(row, ["local invoice no.", "local invoice no"]),
                    localChargesImmediate: mapColumn(row, ["total local charges (egp) - immediate payment - official receipt", "immediate payment"]),
                    localChargesCca: mapColumn(row, ["total local charges (egp) - cca service", "cca service"]),
                    demurrageInvoice: mapColumn(row, ["demurrage , storage & discharge fees invoice", "demurrage invoice"]),
                    demurrageValue: "",
                    foreignInvoiceNo: mapColumn(row, ["forigen invoice no.", "foreign invoice no.", "foreign invoice no"]),
                    receivingDate: mapColumn(row, ["receiving date"]),
                    foreignInvoiceValue: "",
                    localChargesUsd: mapColumn(row, ["local charges (usd)", "local charges usd"]),
                    finalShipmentChargesUsd: mapColumn(row, ["final shipment charges"]),
                    remarks: mapColumn(row, ["remarks"]),
                    createdBy: typeof loggedInUser !== "undefined" && loggedInUser ? loggedInUser.name : "Excel Import",
                    lastModifiedBy: typeof loggedInUser !== "undefined" && loggedInUser ? loggedInUser.name : "Excel Import"
                };

                const keys = Object.keys(row);
                let valueCols = keys.filter(k => k.toLowerCase().trim().startsWith("value") && k.length <= 8);
                if (valueCols.length > 0) newItem.demurrageValue = String(row[valueCols[0]] || "");
                if (valueCols.length > 1) newItem.foreignInvoiceValue = String(row[valueCols[1]] || "");

                const existingIdx = typeof shipmentsData !== "undefined" ? shipmentsData.findIndex(s => s.mrNo === mrNo && (s.poNo === poNo || !poNo)) : -1;
                if(existingIdx !== -1) {
                    newItem.id = shipmentsData[existingIdx].id;
                    newItem.createdBy = shipmentsData[existingIdx].createdBy || newItem.createdBy;
                    shipmentsData[existingIdx] = Object.assign({}, shipmentsData[existingIdx], newItem);
                    updatedCount++;
                } else {
                    if (typeof shipmentsData !== "undefined") shipmentsData.push(newItem);
                    importedCount++;
                }

                if(window.saveShipment) {
                    window.saveShipment(newItem);
                }
            });
            
            if (importedCount === 0 && updatedCount === 0 && json.length > 0) {
                const sampleKeys = Object.keys(json[0]).join(" | ");
                alert("ظ„ظ… ظٹطھظ… ط¥ط¶ط§ظپط© ط£ظٹ ط¨ظٹط§ظ†ط§طھ!\nط§ظ„ظ†ط¸ط§ظ… ظ…ط´ ظ‚ط§ط¯ط± ظٹطھط¹ط±ظپ ط¹ظ„ظ‰ ط¹ظ…ظˆط¯ ط±ظ‚ظ… ط§ظ„ط´ط­ظ†ط© (MR No).\nط§ظ„ط£ط¹ظ…ط¯ط© ط§ظ„ظ„ظٹ ظ„ظ‚ط§ظ‡ط§ ظپظٹ ط§ظ„ظ…ظ„ظپ ظ‡ظٹ:\n" + sampleKeys);
            } else {
                alert(`âœ… Excel Import Complete!\n\nImported New: ` + importedCount + `\nUpdated Existing: ` + updatedCount);
            }

            if (typeof renderShipmentsTable === 'function') renderShipmentsTable();
            if (typeof updateDashboardKPIs === 'function') updateDashboardKPIs();
            
        } catch(err) {
            console.error("Bulk Import Error:", err);
            alert("Error parsing Excel: " + err.message);
        }
        e.target.value = ""; 
    };
    reader.readAsArrayBuffer(file);
}

document.addEventListener("DOMContentLoaded", () => {
    const bulkImportExcel = document.getElementById("bulk-import-excel");
    if (bulkImportExcel) {
        bulkImportExcel.addEventListener("change", handleBulkExcelImport);
    }
});


