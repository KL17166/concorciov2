/**
 * Admin Sandwich & Accordion Interactive Helper
 * Handles collapsible cards, expandable long table wrappers, quick status filtering and search.
 */

window.toggleAdminAccordion = function(headerElement) {
    const card = headerElement.closest('.admin-card');
    if (!card) return;
    card.classList.toggle('admin-card--collapsed');
};

window.toggleSandwichExpansion = function(buttonElement, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const isExpanded = container.classList.toggle('is-expanded');
    const icon = buttonElement.querySelector('i');
    const textSpan = buttonElement.querySelector('.sandwich-btn-text');

    if (isExpanded) {
        if (icon) icon.className = 'bi bi-arrows-angle-contract';
        if (textSpan) textSpan.textContent = 'Recolher modo sanduíche';
    } else {
        if (icon) icon.className = 'bi bi-arrows-angle-expand';
        if (textSpan) textSpan.textContent = 'Expandir todas as linhas';
    }
};

window.filterSandwichTable = function(tableId, filterValue, tabButton) {
    const table = document.getElementById(tableId);
    if (!table) return;

    // Update active tab styling
    if (tabButton && tabButton.parentElement) {
        tabButton.parentElement.querySelectorAll('.admin-sandwich-tab').forEach(t => t.classList.remove('is-active'));
        tabButton.classList.add('is-active');
    }

    const rows = table.querySelectorAll('tbody tr');
    let visibleCount = 0;

    rows.forEach(row => {
        const rowStatus = (row.getAttribute('data-status') || '').toUpperCase();
        if (filterValue === 'ALL' || rowStatus === filterValue.toUpperCase()) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    const counterSpan = document.getElementById(`${tableId}-visible-count`);
    if (counterSpan) {
        counterSpan.textContent = `${visibleCount} visíveis`;
    }
};

window.searchSandwichTable = function(tableId, query) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const q = (query || '').toLowerCase().trim();
    const rows = table.querySelectorAll('tbody tr');
    let visibleCount = 0;

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (!q || text.includes(q)) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    const counterSpan = document.getElementById(`${tableId}-visible-count`);
    if (counterSpan) {
        counterSpan.textContent = `${visibleCount} encontrados`;
    }
};
