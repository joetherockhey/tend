/* ============================================================================
   Tend - app.js
   ----------------------------------------------------------------------------
   The ticket tracker itself: lists, calendar, stats, categories, the new/edit
   forms, drag-and-drop ordering, settings and backup.

   State lives in Store. Every mutation ends with Store.save*() so the change
   is cached locally and, in cloud mode, pushed to the database.
   ============================================================================ */

const App = (function () {
  'use strict';

  const DEFAULT_CATEGORY_COLOR = '#8a8f98';
  const CATEGORY_PALETTE = ['#2a78d6', '#eda100', '#4a3aa7', '#e87ba4', '#eb6834', '#0f9d6a', '#c0392b', '#16a085', '#8e44ad', '#d35400', '#2c3e50', '#c2185b'];

  let calYear, calMonth;              // calMonth is 0-indexed
  let showCompleted = false;
  let showArchived = false;
  let booted = false;

  /* ========================= convenience ========================= */

  function tickets() { return Store.tickets(); }
  function categories() { return Store.categories(); }

  function categoryColor(name) {
    if (!name) return DEFAULT_CATEGORY_COLOR;
    const c = categories().find(x => x.name === name);
    return c ? c.color : DEFAULT_CATEGORY_COLOR;
  }

  function nextCategoryColor() {
    const used = new Set(categories().map(c => c.color));
    return CATEGORY_PALETTE.find(c => !used.has(c)) || DEFAULT_CATEGORY_COLOR;
  }

  function addCategory(name, color) {
    name = (name || '').trim();
    if (!name) return false;
    if (categories().some(c => c.name.toLowerCase() === name.toLowerCase())) return false;
    categories().push({ id: Util.uid(), name: name, color: color || nextCategoryColor() });
    Store.saveCategories();
    return true;
  }

  function removeCategoryByIndex(i) {
    const list = categories();
    if (i < 0 || i >= list.length) return;
    list.splice(i, 1);
    Store.saveCategories();
    renderCategoryKey();
    populateCategorySelects();
    renderList();
  }

  /* ========================= view preferences ========================= */

  function loadViewPrefs() {
    const p = Store.prefs() || {};
    showCompleted = !!p.showCompleted;
    showArchived = !!p.showArchived;
  }

  function saveViewPrefs() {
    const p = Store.prefs();
    p.showCompleted = showCompleted;
    p.showArchived = showArchived;
    Store.savePrefs();
  }

  function toggleShowCompleted() { showCompleted = !showCompleted; saveViewPrefs(); renderList(); }
  function toggleShowArchived() { showArchived = !showArchived; saveViewPrefs(); renderList(); }

  /* ========================= category key panel ========================= */

  function renderCategoryKey() {
    const items = categories().map((c, i) =>
      `<div class="key-item person-key-item">
        <span class="highlight-mark" style="background:${Util.hexToRgba(c.color, 0.4)}">${Util.escapeHtml(c.name)}</span>
        <button class="person-remove-btn" title="Remove ${Util.escapeHtml(c.name)}" onclick="App.removeCategoryByIndex(${i})">&times;</button>
      </div>`
    );
    items.push(`<div class="key-item"><span class="highlight-mark" style="background:${Util.hexToRgba(DEFAULT_CATEGORY_COLOR, 0.4)}">Other</span></div>`);
    const addForm = `
      <div class="person-add-row">
        <input type="color" id="category-add-color" value="${nextCategoryColor()}" title="Pick a colour">
        <input type="text" id="category-add-name" placeholder="Add category&hellip;" maxlength="100" onkeydown="if(event.key==='Enter')App.submitAddCategory()">
        <button class="person-add-btn" onclick="App.submitAddCategory()">Add</button>
      </div>`;
    document.getElementById('category-key').innerHTML = items.join('') + addForm;
  }

  function submitAddCategory() {
    const nameInput = document.getElementById('category-add-name');
    const colorInput = document.getElementById('category-add-color');
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    if (addCategory(name, colorInput.value)) {
      nameInput.value = '';
      renderCategoryKey();
      populateCategorySelects();
      renderList();
    } else {
      nameInput.select();
    }
  }

  function populateCategorySelects() {
    ['new-task-category', 'edit-task-category'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const current = sel.value;
      const opts = ['<option value="">-- Select --</option>'];
      categories().forEach(c => opts.push(`<option value="${Util.escapeHtml(c.name)}">${Util.escapeHtml(c.name)}</option>`));
      opts.push('<option value="other">Other&hellip;</option>');
      sel.innerHTML = opts.join('');
      if (current && (categories().some(c => c.name === current) || current === 'other')) sel.value = current;
    });
  }

  /* ========================= tickets ========================= */

  function onCategoryChange() {
    const select = document.getElementById('new-task-category');
    document.getElementById('category-other-row').style.display = select.value === 'other' ? 'flex' : 'none';
  }

  function onEditCategoryChange() {
    const select = document.getElementById('edit-task-category');
    document.getElementById('edit-category-other-row').style.display = select.value === 'other' ? 'flex' : 'none';
  }

  function addTask() {
    const input = document.getElementById('new-task-input');
    const notesInput = document.getElementById('new-task-notes');
    const settingInput = document.getElementById('new-task-setting');
    const catSelect = document.getElementById('new-task-category');
    const catOtherInput = document.getElementById('new-task-category-other');
    const followUpCheckbox = document.getElementById('new-task-followup');
    const priorityCheckbox = document.getElementById('new-task-priority');
    const dueDateInput = document.getElementById('new-task-duedate');

    const title = input.value.trim();
    if (!title) return;

    const category = catSelect.value === 'other' ? catOtherInput.value.trim() : catSelect.value;

    if (catSelect.value === 'other' && category) {
      addCategory(category);
      renderCategoryKey();
      populateCategorySelects();
    }

    tickets().unshift({
      id: Util.uid(),
      title: title,
      notes: notesInput.value.trim(),
      setting: settingInput.value.trim(),
      category: category,
      followUp: followUpCheckbox.checked,
      priority: priorityCheckbox.checked,
      archived: false,
      dueDate: dueDateInput.value || null,
      createdAt: Util.todayStr(),
      completedAt: null
    });

    input.value = '';
    notesInput.value = '';
    settingInput.value = '';
    catSelect.value = '';
    catOtherInput.value = '';
    followUpCheckbox.checked = false;
    priorityCheckbox.checked = false;
    dueDateInput.value = '';
    onCategoryChange();
    closeNewTaskModal();

    Store.saveTickets();
    renderAll();
  }

  function openNewTaskModal() {
    document.getElementById('new-task-modal-backdrop').classList.add('active');
    document.getElementById('new-task-input').focus();
  }

  function closeNewTaskModal() {
    document.getElementById('new-task-modal-backdrop').classList.remove('active');
  }

  function closeNewTaskModalOnBackdrop(event) {
    if (event.target.id === 'new-task-modal-backdrop') closeNewTaskModal();
  }

  function toggleTask(id, elm) {
    const t = tickets().find(x => x.id === id);
    if (!t) return;
    const nowCompleting = !t.completedAt;
    t.completedAt = t.completedAt ? null : Util.todayStr();
    Store.saveTickets();
    if (nowCompleting && elm) {
      const r = elm.getBoundingClientRect();
      launchConfetti(r.left + r.width / 2, r.top + r.height / 2);
    }
    renderAll();
  }

  function togglePriority(id) {
    const t = tickets().find(x => x.id === id);
    if (!t) return;
    t.priority = !t.priority;
    Store.saveTickets();
    renderList();
  }

  function toggleArchive(id) {
    const t = tickets().find(x => x.id === id);
    if (!t) return;
    t.archived = !t.archived;
    if (t.archived) t.priority = false;
    Store.saveTickets();
    renderList();
  }

  function deleteTask(id) {
    const t = tickets().find(x => x.id === id);
    if (!t) return;
    if (!confirm(`Delete "${t.title}"?`)) return;
    const list = tickets();
    const i = list.findIndex(x => x.id === id);
    if (i !== -1) list.splice(i, 1);
    Store.saveTickets();
    renderAll();
  }

  function launchConfetti(x, y) {
    const colors = ['#8c52ff', '#00d68f', '#f5a623', '#e0546a', '#2a78d6', '#eda100'];
    const count = 28;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.background = colors[i % colors.length];
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 90;
      p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
      p.style.animationDelay = (Math.random() * 0.08) + 's';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 900);
    }
  }

  /* ========================= drag and drop ordering ========================= */

  const REORDERABLE_LISTS = ['priority-list', 'active-list', 'archived-list'];

  function getDragAfterElement(container, y) {
    const items = [...container.querySelectorAll('.task:not(.dragging)')];
    return items.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
  }

  function commitListOrder(ul) {
    const idsInOrder = [...ul.querySelectorAll('.task')].map(li => li.dataset.id);
    const list = tickets();
    const moved = idsInOrder.map(id => list.find(t => t.id === id)).filter(Boolean);
    const rest = list.filter(t => !idsInOrder.includes(t.id));
    const firstIndex = list.findIndex(t => idsInOrder.includes(t.id));
    rest.splice(firstIndex === -1 ? rest.length : firstIndex, 0, ...moved);
    Store.setTickets(rest);
    renderList();
  }

  function initDragAndDrop() {
    REORDERABLE_LISTS.forEach(listId => {
      const ul = document.getElementById(listId);
      if (!ul || ul.dataset.dndReady) return;
      ul.dataset.dndReady = '1';

      ul.addEventListener('dragstart', e => {
        const li = e.target.closest('.task');
        if (!li || li.getAttribute('draggable') !== 'true') return;
        li.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', li.dataset.id); } catch (err) { /* Safari */ }
      });

      ul.addEventListener('dragend', e => {
        const li = e.target.closest('.task');
        if (li) li.classList.remove('dragging');
        commitListOrder(ul);
      });

      ul.addEventListener('dragover', e => {
        e.preventDefault();
        const dragging = document.querySelector('.task.dragging');
        if (!dragging) return;
        const after = getDragAfterElement(ul, e.clientY);
        if (after == null) ul.appendChild(dragging);
        else ul.insertBefore(dragging, after);
      });
    });
  }

  /* ========================= list rendering ========================= */

  function matchesSearch(t, q) {
    if (!q) return true;
    return [t.title, t.notes, t.setting, t.category].some(v => (v || '').toLowerCase().includes(q));
  }

  function renderList() {
    const query = (document.getElementById('search-input').value || '').trim().toLowerCase();
    const filtered = tickets().filter(t => matchesSearch(t, query));

    const notArchived = filtered.filter(t => !t.archived);
    const activeAll = notArchived.filter(t => !t.completedAt);
    const active = activeAll.filter(t => !t.priority);
    const priority = activeAll.filter(t => t.priority);
    const completed = notArchived.filter(t => t.completedAt).sort((a, b) => a.completedAt < b.completedAt ? 1 : -1);
    const archived = filtered.filter(t => t.archived);

    const activeList = document.getElementById('active-list');
    const priorityList = document.getElementById('priority-list');
    const completedList = document.getElementById('completed-list');
    const archivedList = document.getElementById('archived-list');

    const noActiveMsg = query ? 'No active tickets match your search.' : 'Nothing active. Add a ticket to get started.';
    const noPriorityMsg = query ? 'No priority tickets match your search.' : 'Star a ticket to mark it as priority.';
    const noCompletedMsg = query ? 'No completed tickets match your search.' : 'Nothing completed yet.';
    const noArchivedMsg = query ? 'No archived tickets match your search.' : 'Archive a ticket to tuck it away here.';

    activeList.innerHTML = active.length ? active.map(renderTaskItem).join('') : `<li class="empty-note">${noActiveMsg}</li>`;
    priorityList.innerHTML = priority.length ? priority.map(renderTaskItem).join('') : `<li class="empty-note">${noPriorityMsg}</li>`;

    if (!completed.length) {
      completedList.innerHTML = `<li class="empty-note">${noCompletedMsg}</li>`;
    } else {
      const groups = [];
      completed.forEach(t => {
        const lastGroup = groups[groups.length - 1];
        if (lastGroup && lastGroup.date === t.completedAt) lastGroup.tasks.push(t);
        else groups.push({ date: t.completedAt, tasks: [t] });
      });
      completedList.innerHTML = groups.map(g => `
        <li class="completed-day-group">
          <div class="completed-day-heading">${Util.formatDate(g.date)}</div>
          <ul class="task-list">${g.tasks.map(renderTaskItem).join('')}</ul>
        </li>`).join('');
    }

    archivedList.innerHTML = archived.length ? archived.map(renderTaskItem).join('') : `<li class="empty-note">${noArchivedMsg}</li>`;

    completedList.style.display = showCompleted ? '' : 'none';
    document.getElementById('toggle-completed-btn').textContent = showCompleted ? 'Hide completed' : `Show completed (${completed.length})`;

    document.getElementById('archived-section').style.display = showArchived ? '' : 'none';
    document.getElementById('toggle-archived-btn').textContent = showArchived ? 'Hide archived' : `Show archived (${archived.length})`;
  }

  function renderTaskItem(t) {
    const done = !!t.completedAt;
    let metaText = done
      ? `Created ${Util.formatDate(t.createdAt)} &middot; Completed ${Util.formatDate(t.completedAt)}`
      : `Created ${Util.formatDate(t.createdAt)}`;
    if (t.setting) metaText += ` &middot; Came up: ${Util.escapeHtml(t.setting)}`;

    const notesHtml = t.notes ? `<div class="task-notes">${Util.escapeHtml(t.notes)}</div>` : '';
    const catColor = categoryColor(t.category);

    const tags = [];
    if (t.category) {
      tags.push(`<span class="tag highlighter"><span class="highlight-mark" style="background:${Util.hexToRgba(catColor, 0.4)}">${Util.escapeHtml(t.category)}</span></span>`);
    }
    if (t.followUp) tags.push('<span class="tag followup">Needs a follow-up</span>');
    if (t.dueDate) {
      const overdue = !done && t.dueDate < Util.todayStr();
      tags.push(`<span class="tag ${overdue ? 'overdue' : ''}">Due ${Util.formatDate(t.dueDate)}${overdue ? ' (overdue)' : ''}</span>`);
    }
    const tagsHtml = tags.length ? `<div class="task-tags">${tags.join('')}</div>` : '';
    const borderStyle = t.category ? ` style="border-left-color:${catColor}"` : '';

    const starBtn = (done || t.archived) ? '' :
      `<button class="star-btn ${t.priority ? 'active' : ''}" title="${t.priority ? 'Unstar (move back to Active)' : 'Star as priority'}" onclick="App.togglePriority('${t.id}')">${t.priority ? '★' : '☆'}</button>`;

    const archiveIcon = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="5" rx="1"></rect><path d="M4 8v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8"></path><path d="M9.5 12h5"></path></svg>';
    const archiveBtn = `<button class="archive-btn ${t.archived ? 'active' : ''}" title="${t.archived ? 'Unarchive (restore ticket)' : 'Archive ticket'}" onclick="App.toggleArchive('${t.id}')">${archiveIcon}</button>`;

    const draggable = (!done || t.archived) ? 'true' : 'false';

    return `
      <li class="task ${done ? 'done' : ''} ${t.archived ? 'archived' : ''}"${borderStyle} data-id="${t.id}" draggable="${draggable}">
        <input type="checkbox" ${done ? 'checked' : ''} onchange="App.toggleTask('${t.id}', this)">
        <div class="task-body">
          <div class="task-title">${Util.escapeHtml(t.title)}</div>
          ${notesHtml}
          ${tagsHtml}
          <div class="task-meta">${metaText}</div>
        </div>
        <div class="task-actions">
          ${starBtn}
          ${archiveBtn}
          <button class="edit-btn" title="Edit" onclick="App.openEditModal('${t.id}')">&#9998;</button>
          <button class="delete-btn" title="Delete" onclick="App.deleteTask('${t.id}')">&times;</button>
        </div>
      </li>`;
  }

  /* ========================= stats ========================= */

  function renderStats() {
    const list = tickets();
    const priorityCount = list.filter(t => !t.completedAt && !t.archived && t.priority).length;
    const activeCount = list.filter(t => !t.completedAt && !t.archived && !t.priority).length;
    const archivedCount = list.filter(t => t.archived).length;
    const openTotal = priorityCount + activeCount;
    const completedAll = list.filter(t => !!t.completedAt).length;
    const followUps = list.filter(t => !t.completedAt && !t.archived && t.followUp).length;

    document.getElementById('stats-chart').innerHTML = `
      <div class="summary-headline">
        <span class="summary-num">${openTotal}</span>
        <span class="summary-label">Open tickets</span>
      </div>
      <ul class="summary-breakdown">
        <li><span class="summary-cat priority">Priority</span><span class="summary-catnum">${priorityCount}</span></li>
        <li><span class="summary-cat active">Active</span><span class="summary-catnum">${activeCount}</span></li>
        <li><span class="summary-cat archived">Archived</span><span class="summary-catnum">${archivedCount}</span></li>
        <li><span class="summary-cat">Follow-ups</span><span class="summary-catnum">${followUps}</span></li>
      </ul>
      <div class="summary-headline completed">
        <span class="summary-num">${completedAll}</span>
        <span class="summary-label">Completed (all time)</span>
      </div>`;
  }

  /* ========================= calendar ========================= */

  function switchView(view) {
    document.getElementById('view-list').classList.toggle('active', view === 'list');
    document.getElementById('view-calendar').classList.toggle('active', view === 'calendar');
    document.getElementById('tab-list').classList.toggle('active', view === 'list');
    document.getElementById('tab-calendar').classList.toggle('active', view === 'calendar');
    if (view === 'calendar') renderCalendar();
  }

  function changeMonth(delta) {
    calMonth += delta;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  }

  function goToday() {
    const d = new Date();
    calYear = d.getFullYear();
    calMonth = d.getMonth();
    renderCalendar();
  }

  let createdByDay = {}, completedByDay = {};

  function renderCalendar() {
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    document.getElementById('cal-title').textContent = `${monthNames[calMonth]} ${calYear}`;

    createdByDay = {};
    completedByDay = {};
    tickets().forEach(t => {
      if (t.createdAt) (createdByDay[t.createdAt] = createdByDay[t.createdAt] || []).push(t);
      if (t.completedAt) (completedByDay[t.completedAt] = completedByDay[t.completedAt] || []).push(t);
    });

    const firstOfMonth = new Date(calYear, calMonth, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const today = Util.todayStr();

    const dows = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    let html = dows.map(d => `<div class="dow">${d}</div>`).join('');

    for (let i = 0; i < startWeekday; i++) html += '<div class="cal-cell empty"></div>';

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = iso === today;
      const madeCount = (createdByDay[iso] || []).length;
      const doneCount = (completedByDay[iso] || []).length;

      let countsHtml = '';
      if (madeCount) countsHtml += `<span class="cal-count-num created">${madeCount}</span>`;
      if (doneCount) countsHtml += `<span class="cal-count-num completed">${doneCount}</span>`;

      html += `<div class="cal-cell ${isToday ? 'today' : ''}" onclick="App.showDayModal('${iso}')">
                 <div class="cal-daynum">${day}</div>
                 <div class="cal-events">${countsHtml}</div>
               </div>`;
    }
    document.getElementById('cal-grid').innerHTML = html;
  }

  function showDayModal(iso) {
    const created = createdByDay[iso] || [];
    const completed = completedByDay[iso] || [];
    if (!created.length && !completed.length) return;

    document.getElementById('modal-title').textContent = Util.formatDate(iso);

    let body = '';
    if (created.length) {
      body += `<div class="modal-group"><h4>Created</h4><ul>${created.map(t => `<li class="day-task" onclick="App.showTaskDetail('${t.id}', '${iso}')">${Util.escapeHtml(t.title)}</li>`).join('')}</ul></div>`;
    }
    if (completed.length) {
      body += `<div class="modal-group"><h4>Completed</h4><ul>${completed.map(t => `<li class="day-task" onclick="App.showTaskDetail('${t.id}', '${iso}')">${Util.escapeHtml(t.title)}</li>`).join('')}</ul></div>`;
    }
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-backdrop').classList.add('active');
  }

  function detailRow(label, valueHtml) {
    return `<div class="detail-row"><div class="detail-label">${label}</div><div class="detail-value">${valueHtml}</div></div>`;
  }

  function showTaskDetail(id, iso) {
    const t = tickets().find(x => x.id === id);
    if (!t) return;
    const done = !!t.completedAt;

    document.getElementById('modal-title').textContent = t.title;

    const rows = [];
    rows.push(detailRow('Status', done ? `Completed ${Util.formatDate(t.completedAt)}` : (t.priority ? 'Priority (open)' : 'Active (open)') + (t.archived ? ' &middot; archived' : '')));
    rows.push(detailRow('Created', Util.formatDate(t.createdAt)));
    if (t.dueDate) {
      const overdue = !done && t.dueDate < Util.todayStr();
      rows.push(detailRow('Due', Util.formatDate(t.dueDate) + (overdue ? ' <span style="color:var(--danger)">(overdue)</span>' : '')));
    }
    if (t.category) {
      rows.push(detailRow('Category', `<span class="highlight-mark" style="background:${Util.hexToRgba(categoryColor(t.category), 0.4)}">${Util.escapeHtml(t.category)}</span>`));
    }
    if (t.setting) rows.push(detailRow('Came up', Util.escapeHtml(t.setting)));
    if (t.followUp) rows.push(detailRow('Follow-up', 'Needed'));
    if (t.notes) rows.push(detailRow('Notes', Util.escapeHtml(t.notes).replace(/\n/g, '<br>')));

    const backBtn = iso ? `<button class="detail-back-btn" onclick="App.showDayModal('${iso}')">&larr; Back to ${Util.formatDate(iso)}</button>` : '';

    document.getElementById('modal-body').innerHTML = `
      ${backBtn}
      <div class="task-detail">${rows.join('')}</div>
      <div class="detail-actions">
        <button class="detail-edit-btn" onclick="App.closeModal(); App.openEditModal('${t.id}')">Edit ticket</button>
      </div>`;
    document.getElementById('modal-backdrop').classList.add('active');
  }

  function closeModal() { document.getElementById('modal-backdrop').classList.remove('active'); }
  function closeModalOnBackdrop(event) { if (event.target.id === 'modal-backdrop') closeModal(); }

  /* ========================= edit modal ========================= */

  function openEditModal(id) {
    const t = tickets().find(x => x.id === id);
    if (!t) return;

    document.getElementById('edit-task-id').value = t.id;
    document.getElementById('edit-task-title').value = t.title || '';
    document.getElementById('edit-task-notes').value = t.notes || '';
    document.getElementById('edit-task-setting').value = t.setting || '';
    document.getElementById('edit-task-followup').checked = !!t.followUp;
    document.getElementById('edit-task-priority').checked = !!t.priority;
    document.getElementById('edit-task-duedate').value = t.dueDate || '';

    const sel = document.getElementById('edit-task-category');
    const known = categories().map(c => c.name);
    if (t.category && !known.includes(t.category)) {
      sel.value = 'other';
      document.getElementById('edit-task-category-other').value = t.category;
    } else {
      sel.value = t.category || '';
      document.getElementById('edit-task-category-other').value = '';
    }
    onEditCategoryChange();

    document.getElementById('edit-modal-backdrop').classList.add('active');
  }

  function saveEditedTask() {
    const id = document.getElementById('edit-task-id').value;
    const t = tickets().find(x => x.id === id);
    if (!t) return;

    const title = document.getElementById('edit-task-title').value.trim();
    if (!title) return;

    const sel = document.getElementById('edit-task-category');
    const category = sel.value === 'other' ? document.getElementById('edit-task-category-other').value.trim() : sel.value;

    if (sel.value === 'other' && category) {
      addCategory(category);
      renderCategoryKey();
      populateCategorySelects();
    }

    t.title = title;
    t.notes = document.getElementById('edit-task-notes').value.trim();
    t.setting = document.getElementById('edit-task-setting').value.trim();
    t.category = category;
    t.followUp = document.getElementById('edit-task-followup').checked;
    t.priority = document.getElementById('edit-task-priority').checked;
    t.dueDate = document.getElementById('edit-task-duedate').value || null;

    Store.saveTickets();
    renderAll();
    closeEditModal();
  }

  function closeEditModal() { document.getElementById('edit-modal-backdrop').classList.remove('active'); }
  function closeEditModalOnBackdrop(event) { if (event.target.id === 'edit-modal-backdrop') closeEditModal(); }

  /* ========================= account menu + header ========================= */

  function renderHeader() {
    const name = Store.displayName() || 'Your';
    const possessive = /s$/i.test(name) ? name + "'" : name + "'s";
    document.getElementById('page-title').textContent = `${possessive} Tickets`;
    document.title = `${possessive} Tickets · ${(Store.config.APP_NAME || 'Tend')}`;

    const btn = document.getElementById('account-btn');
    btn.innerHTML = `
      <span class="profile-avatar" style="background:${Util.colorFor(Store.accountId() || name)}">${Util.escapeHtml(Util.initials(name))}</span>
      <span>${Util.escapeHtml(name)}</span>
      <span class="caret">&#9660;</span>`;

    const dd = document.getElementById('account-dropdown');
    const isCloud = Store.isCloud();
    dd.innerHTML = `
      <div class="acct-head">
        <div class="acct-name">${Util.escapeHtml(name)}</div>
        <div class="acct-sub">${isCloud ? Util.escapeHtml(Store.email()) : 'Local profile on this device'}</div>
      </div>
      <button class="acct-item" onclick="App.openSettings()">Settings &amp; backup</button>
      <button class="acct-item" onclick="App.exportBackup()">Export a backup</button>
      ${repoLinkHTML()}
      ${isCloud
        ? '<button class="acct-item danger" onclick="App.signOut()">Sign out</button>'
        : '<button class="acct-item" onclick="App.switchProfile()">Switch profile</button>'}`;
  }

  /* Opens a pre-filled issue on the project's GitHub repo, if one is configured.
     This is feedback about Tend itself - it is public, so it is deliberately
     separate from your own tickets. */
  function repoLinkHTML() {
    const repo = (Store.config.GITHUB_REPO || '').trim();
    if (!repo) return '';
    const url = `https://github.com/${repo}/issues/new?template=ticket.yml`;
    return `<a class="acct-item" href="${Util.escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Suggest something on GitHub &#8599;</a>`;
  }

  function toggleAccountMenu(e) {
    if (e) e.stopPropagation();
    const dd = document.getElementById('account-dropdown');
    dd.hidden = !dd.hidden;
  }

  function renderSyncBadge(status) {
    const badge = document.getElementById('sync-badge');
    if (!badge) return;
    const map = {
      idle: ['', 'Saved to your account'],
      saving: ['saving', 'Saving…'],
      offline: ['offline', 'Offline — saved on this device'],
      local: ['local', 'Saved in this browser']
    };
    const [cls, label] = map[status] || map.idle;
    badge.className = 'sync-badge ' + cls;
    badge.innerHTML = `<span class="sync-dot"></span>${label}`;
  }

  async function signOut() { await Auth.signOut(); }
  async function switchProfile() { await Auth.switchProfile(); }

  /* ========================= settings + backup ========================= */

  function openSettings() {
    document.getElementById('account-dropdown').hidden = true;
    const isCloud = Store.isCloud();
    document.getElementById('settings-body').innerHTML = `
      <div class="settings-section">
        <h4>Display name</h4>
        <p>Used for the page title and the gardener in the garden.</p>
        <div class="settings-row">
          <input type="text" id="settings-name" value="${Util.escapeHtml(Store.displayName())}" maxlength="60">
          <button class="settings-btn primary" onclick="App.saveDisplayName()">Save</button>
        </div>
        <div class="settings-note" id="settings-name-note"></div>
      </div>

      <div class="settings-section">
        <h4>Where your data lives</h4>
        <p>${isCloud
          ? 'Cloud mode. Your tickets and garden are stored in your account and sync to any device you sign in on. A copy is kept in this browser so the app keeps working offline.'
          : 'Local mode. Everything is stored in this browser only. Export a backup if you want to keep it safe or move it to another device.'}</p>
        <div class="settings-row">
          <button class="settings-btn" onclick="App.exportBackup()">Export backup (.json)</button>
          <button class="settings-btn" onclick="document.getElementById('import-file').click()">Import backup</button>
          ${isCloud ? '<button class="settings-btn" onclick="App.forcePull()">Refresh from server</button>' : ''}
        </div>
        <div class="settings-note" id="settings-data-note"></div>
      </div>

      <div class="settings-section">
        <h4>Danger zone</h4>
        <p>Deletes every ticket, category and garden change on this account. There is no undo, so export a backup first.</p>
        <div class="settings-row">
          <button class="settings-btn danger" onclick="App.eraseEverything()">Erase all my data</button>
        </div>
      </div>`;
    document.getElementById('settings-modal-backdrop').classList.add('active');
  }

  function closeSettings() { document.getElementById('settings-modal-backdrop').classList.remove('active'); }
  function closeSettingsOnBackdrop(e) { if (e.target.id === 'settings-modal-backdrop') closeSettings(); }

  function saveDisplayName() {
    const v = document.getElementById('settings-name').value.trim();
    if (!v) return;
    Store.setDisplayName(v);
    renderHeader();
    Garden.render();
    const note = document.getElementById('settings-name-note');
    note.className = 'settings-note ok';
    note.textContent = 'Saved.';
  }

  /* Some hosts (the claude.ai artifact viewer, for one) frame the page and do
     not allow a page to start its own download. Where that host offers a save
     bridge we use it; everywhere else - GitHub Pages, a local file, any normal
     web server - the plain anchor download is the right path. */
  let downloadBridge = null;

  function primeDownloadBridge() {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    downloadBridge = window.claude.use('downloads').catch(() => null);
  }

  async function saveTextFile(filename, text) {
    if (downloadBridge) {
      const ns = await downloadBridge;
      if (ns) {
        try {
          await ns.save({ filename: filename, data: text });
          return 'saved';
        } catch (err) {
          return (err && err.code === 'declined') ? 'declined' : 'failed';
        }
      }
    }
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    return 'saved';
  }

  async function exportBackup() {
    document.getElementById('account-dropdown').hidden = true;
    const text = JSON.stringify(Store.exportData(), null, 2);
    const safe = (Store.displayName() || 'tend').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const result = await saveTextFile(`tend-${safe}-${Util.todayStr()}.json`, text);

    const note = document.getElementById('settings-data-note');
    if (!note) return;
    if (result === 'saved') { note.className = 'settings-note ok'; note.textContent = 'Backup saved.'; }
    else if (result === 'declined') { note.className = 'settings-note'; note.textContent = 'Save cancelled.'; }
    else { note.className = 'settings-note bad'; note.textContent = 'This browser would not let the page save a file. Try the site in its own tab.'; }
  }

  function handleImportFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const note = document.getElementById('settings-data-note');
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const data = JSON.parse(reader.result);
        const list = Array.isArray(data) ? data : (data.tickets || data.tasks || []);
        const count = Array.isArray(list) ? list.length : 0;
        if (!confirm(`Import ${count} ticket${count === 1 ? '' : 's'}? This replaces everything currently in "${Store.displayName()}".`)) return;
        Store.importData(data);
        loadViewPrefs();
        renderAll();
        Garden.loadAll();
        Garden.render();
        if (note) { note.className = 'settings-note ok'; note.textContent = `Imported ${count} tickets.`; }
      } catch (err) {
        if (note) { note.className = 'settings-note bad'; note.textContent = err.message || 'Could not read that file.'; }
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  }

  async function forcePull() {
    const note = document.getElementById('settings-data-note');
    try {
      await Store.flush();
      await Store.pull();
      loadViewPrefs();
      renderAll();
      Garden.loadAll();
      Garden.render();
      if (note) { note.className = 'settings-note ok'; note.textContent = 'Up to date with the server.'; }
    } catch (err) {
      if (note) { note.className = 'settings-note bad'; note.textContent = 'Could not reach the server.'; }
    }
  }

  function eraseEverything() {
    if (!confirm('Erase every ticket, category and garden change on this account?')) return;
    if (!confirm('Really erase everything? This cannot be undone.')) return;
    Store.eraseAccountData();
    loadViewPrefs();
    renderAll();
    Garden.loadAll();
    Garden.render();
    closeSettings();
  }

  /* ========================= boot ========================= */

  function renderAll() {
    renderCategoryKey();
    populateCategorySelects();
    renderList();
    initDragAndDrop();
    renderCalendar();
    renderStats();
    Garden.render();
  }

  function boot() {
    loadViewPrefs();

    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();

    renderHeader();
    renderAll();
    Garden.start();

    if (!booted) {
      booted = true;
      Store.onStatus(renderSyncBadge);
      primeDownloadBridge();

      document.getElementById('new-task-input').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
      document.getElementById('search-input').addEventListener('input', renderList);
      document.getElementById('import-file').addEventListener('change', function () { handleImportFile(this); });

      document.addEventListener('click', function (e) {
        const dd = document.getElementById('account-dropdown');
        if (!dd || dd.hidden) return;
        if (!e.target.closest('.account-menu')) dd.hidden = true;
      });

      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        closeModal(); closeEditModal(); closeNewTaskModal(); closeSettings();
        document.getElementById('account-dropdown').hidden = true;
      });
    }
  }

  return {
    boot, renderAll, renderList, renderStats, renderCalendar, renderHeader,
    tickets, categories, categoryColor, DEFAULT_CATEGORY_COLOR,
    addTask, toggleTask, togglePriority, toggleArchive, deleteTask,
    openNewTaskModal, closeNewTaskModal, closeNewTaskModalOnBackdrop,
    openEditModal, saveEditedTask, closeEditModal, closeEditModalOnBackdrop,
    onCategoryChange, onEditCategoryChange,
    submitAddCategory, removeCategoryByIndex,
    switchView, changeMonth, goToday, showDayModal, showTaskDetail,
    closeModal, closeModalOnBackdrop,
    toggleShowCompleted, toggleShowArchived,
    toggleAccountMenu, openSettings, closeSettings, closeSettingsOnBackdrop,
    saveDisplayName, exportBackup, forcePull, eraseEverything,
    signOut, switchProfile
  };
})();
