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
    const hint = document.getElementById('category-hint');
    if (hint) {
      const ocean = (Store.prefs() || {}).world === 'ocean';
      hint.textContent = ocean
        ? 'Colour-codes your tickets and the shells your corals sit in.'
        : 'Colour-codes your tickets and the plant pots in your garden.';
    }

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
      completedAt: null,
      subtasks: readSubtaskEditor('new-subtasks')
    });

    input.value = '';
    notesInput.value = '';
    settingInput.value = '';
    catSelect.value = '';
    catOtherInput.value = '';
    followUpCheckbox.checked = false;
    priorityCheckbox.checked = false;
    dueDateInput.value = '';
    renderSubtaskEditor('new-subtasks', []);
    onCategoryChange();
    closeNewTaskModal();

    Store.saveTickets();
    renderAll();
  }

  function openNewTaskModal() {
    renderSubtaskEditor('new-subtasks', []);
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

  /* ---------------------------------------------------------------
     Subtasks. A ticket carries a small checklist; ticking items off is
     progress, but only the ticket itself pays a coin.
     --------------------------------------------------------------- */

  function subtasksOf(t) {
    return Array.isArray(t.subtasks) ? t.subtasks : [];
  }

  function subtaskProgress(t) {
    const list = subtasksOf(t);
    return { done: list.filter(x => x.done).length, total: list.length };
  }

  function toggleSubtask(ticketId, subId) {
    const t = tickets().find(x => x.id === ticketId);
    if (!t) return;
    const sub = subtasksOf(t).find(x => x.id === subId);
    if (!sub) return;
    sub.done = !sub.done;
    Store.saveTickets();
    renderList();
    renderStats();
  }

  function toggleSubtaskList(ticketId) {
    const el = document.getElementById('subs-' + ticketId);
    if (el) el.hidden = !el.hidden;
  }

  function renderSubtaskList(t) {
    const list = subtasksOf(t);
    if (!list.length) return '';
    const rows = list.map(sub => `
      <li class="subtask ${sub.done ? 'done' : ''}">
        <input type="checkbox" ${sub.done ? 'checked' : ''} onchange="App.toggleSubtask('${t.id}', '${sub.id}')">
        <span>${Util.escapeHtml(sub.title)}</span>
      </li>`).join('');
    return `<ul class="subtask-list" id="subs-${t.id}" hidden>${rows}</ul>`;
  }

  /* ---- the editor used inside the new and edit forms ---- */

  function renderSubtaskEditor(hostId, list) {
    const host = document.getElementById(hostId);
    if (!host) return;
    host.dataset.items = JSON.stringify(list || []);
    const items = (list || []).map((sub, i) => `
      <li class="subtask-edit-row">
        <input type="checkbox" ${sub.done ? 'checked' : ''} onchange="App.editorToggle('${hostId}', ${i})">
        <input type="text" value="${Util.escapeHtml(sub.title)}" maxlength="200"
               oninput="App.editorRename('${hostId}', ${i}, this.value)">
        <button type="button" class="subtask-remove" title="Remove" onclick="App.editorRemove('${hostId}', ${i})">&times;</button>
      </li>`).join('');
    host.innerHTML = `
      <ul class="subtask-edit-list">${items}</ul>
      <div class="subtask-add-row">
        <input type="text" id="${hostId}-add" placeholder="Add a step&hellip;" maxlength="200"
               onkeydown="if(event.key==='Enter'){event.preventDefault();App.editorAdd('${hostId}');}">
        <button type="button" class="settings-btn" onclick="App.editorAdd('${hostId}')">Add</button>
      </div>`;
  }

  function editorItems(hostId) {
    const host = document.getElementById(hostId);
    if (!host) return [];
    try { return JSON.parse(host.dataset.items || '[]'); } catch (e) { return []; }
  }

  function editorAdd(hostId) {
    const input = document.getElementById(hostId + '-add');
    const title = (input.value || '').trim();
    if (!title) { input.focus(); return; }
    const list = editorItems(hostId);
    list.push({ id: Util.uid(), title: title, done: false });
    renderSubtaskEditor(hostId, list);
    const next = document.getElementById(hostId + '-add');
    if (next) next.focus();
  }

  function editorRemove(hostId, index) {
    const list = editorItems(hostId);
    list.splice(index, 1);
    renderSubtaskEditor(hostId, list);
  }

  function editorRename(hostId, index, value) {
    const host = document.getElementById(hostId);
    const list = editorItems(hostId);
    if (!list[index]) return;
    list[index].title = value;
    host.dataset.items = JSON.stringify(list);   /* no redraw - it would steal focus */
  }

  function editorToggle(hostId, index) {
    const list = editorItems(hostId);
    if (!list[index]) return;
    list[index].done = !list[index].done;
    renderSubtaskEditor(hostId, list);
  }

  function readSubtaskEditor(hostId) {
    return editorItems(hostId).filter(x => (x.title || '').trim()).map(x => ({
      id: x.id || Util.uid(), title: x.title.trim(), done: !!x.done
    }));
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

  /* A click anywhere on the row that is not one of its own controls opens the
     ticket's details. That is where the dates now live - the collapsed row
     carries only what you need to scan the list. */
  function taskRowClick(id, ev) {
    if (ev && ev.target && ev.target.closest('button, input, a, label, .task-subtasks')) return;
    showTaskDetail(id);
  }

  function renderTaskItem(t) {
    const done = !!t.completedAt;
    /* Created and completed dates live in the detail view, not here. */
    const metaText = t.setting ? `Came up: ${Util.escapeHtml(t.setting)}` : '';

    const notesHtml = t.notes ? `<div class="task-notes">${Util.escapeHtml(t.notes)}</div>` : '';
    const catColor = categoryColor(t.category);

    const tags = [];
    if (t.category) {
      tags.push(`<span class="tag highlighter"><span class="highlight-mark" style="background:${Util.hexToRgba(catColor, 0.4)}">${Util.escapeHtml(t.category)}</span></span>`);
    }
    const prog = subtaskProgress(t);
    if (prog.total) {
      tags.push(`<button type="button" class="tag subtask-tag ${prog.done === prog.total ? 'all-done' : ''}"
        onclick="event.stopPropagation();App.toggleSubtaskList('${t.id}')"
        title="Show the steps">&#9744; ${prog.done}/${prog.total}</button>`);
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
      <li class="task ${done ? 'done' : ''} ${t.archived ? 'archived' : ''}"${borderStyle} data-id="${t.id}" draggable="${draggable}"
          title="Open the ticket" onclick="App.taskRowClick('${t.id}', event)">
        <input type="checkbox" ${done ? 'checked' : ''} onchange="App.toggleTask('${t.id}', this)">
        <div class="task-body">
          <div class="task-title">${Util.escapeHtml(t.title)}</div>
          ${notesHtml}
          ${tagsHtml}
          ${renderSubtaskList(t)}
          ${metaText ? `<div class="task-meta">${metaText}</div>` : ''}
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

  /* Open tickets due today, and anything already past its date. */
  function dueToday() {
    const today = Util.todayStr();
    return tickets().filter(t => !t.completedAt && !t.archived && t.dueDate === today);
  }

  function overdueTickets() {
    const today = Util.todayStr();
    return tickets().filter(t => !t.completedAt && !t.archived && t.dueDate && t.dueDate < today)
      .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  }

  function renderDueToday() {
    const btn = document.getElementById('due-today-btn');
    if (!btn) return;
    const due = dueToday().length;
    const late = overdueTickets().length;

    btn.className = 'due-today-btn' + (late ? ' has-overdue' : (due ? ' has-due' : ''));
    btn.innerHTML = `
      <span class="due-today-count">${due}</span>
      <span class="due-today-text">
        <span class="due-today-title">Due today</span>
        ${late ? `<span class="due-today-sub">${late} overdue</span>` : ''}
      </span>`;
  }

  function showDueToday() {
    const today = Util.todayStr();
    const due = dueToday();
    const late = overdueTickets();

    document.getElementById('modal-title').textContent = 'Due today \u2014 ' + Util.formatDate(today);

    let body = '';
    if (due.length) {
      body += `<div class="modal-group"><h4>Today</h4><ul>${due.map(t =>
        `<li class="day-task" onclick="App.showTaskDetail('${t.id}')">${Util.escapeHtml(t.title)}</li>`).join('')}</ul></div>`;
    } else {
      body += '<p class="empty-note">Nothing is due today.</p>';
    }
    if (late.length) {
      body += `<div class="modal-group"><h4>Overdue</h4><ul>${late.map(t =>
        `<li class="day-task" onclick="App.showTaskDetail('${t.id}')">${Util.escapeHtml(t.title)}
           <span class="day-task-note overdue">${Util.formatDate(t.dueDate)}</span></li>`).join('')}</ul></div>`;
    }
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-backdrop').classList.add('active');
  }

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
    /* There is nothing to search on the calendar. */
    const search = document.getElementById('nav-search');
    if (search) search.hidden = view !== 'list';
    if (view === 'calendar') renderCalendar();
    applyCalendarWidth();
  }

  /* Keeps the little clear button and the widened field in step with whether
     anything has actually been typed. */
  function syncSearchChrome() {
    const input = document.getElementById('search-input');
    const wrap = document.getElementById('nav-search');
    const clear = document.getElementById('search-clear');
    if (!input || !wrap) return;
    const has = !!input.value;
    wrap.classList.toggle('has-text', has);
    if (clear) clear.hidden = !has;
  }

  function clearSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;
    input.value = '';
    syncSearchChrome();
    renderList();
    input.focus();
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

  let createdByDay = {}, dueByDay = {}, completedByDay = {};

  /* Which dates a ticket is plotted on. "Due" is the one most people want -
     it answers "what is coming up" - so it and Completed are on by default and
     Created is off. Each person's choice is remembered with their preferences. */
  /* How many ticket rows fit in an agenda cell before it says "+n more". */
  const AGENDA_ROWS = 3;

  const CAL_SERIES = [
    { key: 'created', label: 'Created', on: false },
    { key: 'due', label: 'Due', on: true },
    { key: 'completed', label: 'Complete', on: true }
  ];

  /* 'numbers' = counts per day. 'agenda' = the tickets themselves, the way a
     wall calendar or Google Calendar shows them. */
  function calView() {
    const prefs = Store.prefs();
    return prefs.calView === 'agenda' ? 'agenda' : 'numbers';
  }

  function setCalView(view) {
    Store.prefs().calView = view;
    Store.savePrefs();
    renderCalendar();
    applyCalendarWidth();
  }

  /* Weekends on by default; a working week of five columns is wider per day,
     which matters most on a phone. */
  function showWeekends() {
    return Store.prefs().calWeekends !== false;
  }

  function toggleWeekends() {
    Store.prefs().calWeekends = !showWeekends();
    Store.savePrefs();
    renderCalendar();
  }

  /* The list view claims the whole row while it is on screen. */
  function applyCalendarWidth() {
    const layout = document.querySelector('.app-layout');
    if (!layout) return;
    const onCalendar = document.getElementById('view-calendar').classList.contains('active');
    layout.classList.toggle('cal-wide', onCalendar && calView() === 'agenda');
  }

  function renderCalViewToggle() {
    const host = document.getElementById('cal-view-toggle');
    if (!host) return;
    const view = calView();
    host.innerHTML = [['numbers', 'Numbers'], ['agenda', 'List']].map(([key, label]) =>
      `<button type="button" class="${view === key ? 'on' : ''}" onclick="App.setCalView('${key}')">${label}</button>`
    ).join('');
  }

  function renderWeekendToggle() {
    const host = document.getElementById('cal-weekend-toggle');
    if (!host) return;
    const on = showWeekends();
    host.innerHTML = `<button type="button" class="weekend-toggle ${on ? 'on' : ''}"
        onclick="App.toggleWeekends()"
        title="${on ? 'Hide Saturday and Sunday' : 'Show Saturday and Sunday'}">
        ${on ? 'Hide weekends' : 'Show weekends'}
      </button>`;
  }

  function calSeries() {
    const prefs = Store.prefs();
    if (!prefs.calSeries) {
      prefs.calSeries = {};
      CAL_SERIES.forEach(sr => { prefs.calSeries[sr.key] = sr.on; });
    }
    return prefs.calSeries;
  }

  function toggleCalSeries(key) {
    const series = calSeries();
    series[key] = !series[key];
    Store.savePrefs();
    renderCalendar();
  }

  function renderCalendarLegend() {
    const host = document.getElementById('cal-legend');
    if (!host) return;
    const series = calSeries();
    host.innerHTML = CAL_SERIES.map(sr =>
      `<button type="button" class="legend-toggle ${series[sr.key] ? 'on' : ''}"
               onclick="App.toggleCalSeries('${sr.key}')"
               title="${series[sr.key] ? 'Hide' : 'Show'} ${sr.label.toLowerCase()} dates">
         <span class="dot ${sr.key}"></span>${sr.label}
       </button>`).join('');
  }

  function renderCalendar() {
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    document.getElementById('cal-title').textContent = `${monthNames[calMonth]} ${calYear}`;

    createdByDay = {};
    dueByDay = {};
    completedByDay = {};
    tickets().forEach(t => {
      if (t.createdAt) (createdByDay[t.createdAt] = createdByDay[t.createdAt] || []).push(t);
      if (t.dueDate) (dueByDay[t.dueDate] = dueByDay[t.dueDate] || []).push(t);
      if (t.completedAt) (completedByDay[t.completedAt] = completedByDay[t.completedAt] || []).push(t);
    });
    renderCalendarLegend();
    renderCalViewToggle();
    renderWeekendToggle();
    const series = calSeries();
    const agenda = calView() === 'agenda';
    const weekends = showWeekends();

    const firstOfMonth = new Date(calYear, calMonth, 1);
    /* Weeks run Monday to Sunday, so shift getDay()'s Sunday-first numbering. */
    const startWeekday = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const today = Util.todayStr();

    const allDows = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const dows = weekends ? allDows : allDows.slice(0, 5);
    let html = dows.map(d => `<div class="dow">${d}</div>`).join('');

    /* A month that opens on a Saturday or Sunday starts its first visible week
       on the Monday, so with the weekend columns gone it needs no padding. */
    const leading = weekends ? startWeekday : (startWeekday >= 5 ? 0 : startWeekday);
    for (let i = 0; i < leading; i++) html += '<div class="cal-cell empty"></div>';

    for (let day = 1; day <= daysInMonth; day++) {
      const weekday = (new Date(calYear, calMonth, day).getDay() + 6) % 7;
      if (!weekends && weekday > 4) continue;
      const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = iso === today;
      const madeCount = series.created ? (createdByDay[iso] || []).length : 0;
      const doneCount = series.completed ? (completedByDay[iso] || []).length : 0;

      /* Only work still outstanding counts as due - a ticket you have finished
         is not due any more, and it already shows under Completed on the day you
         did it. Clicking the day still lists the finished ones, marked done. */
      const dueList = series.due
        ? (dueByDay[iso] || []).filter(t => !t.completedAt && !t.archived)
        : [];

      /* A due date that has passed with work still on it is worth shouting about. */
      const overdue = iso < today && dueList.length > 0;

      let countsHtml;

      if (agenda) {
        /* One row per ticket, like a wall calendar. Only so many fit in a cell
           of fixed height, so the rest collapse into a "+n more". */
        const rows = [];
        dueList.forEach(t => rows.push({ cls: 'due' + (overdue ? ' overdue' : ''), title: t.title }));
        if (series.completed) (completedByDay[iso] || []).forEach(t => rows.push({ cls: 'completed', title: t.title }));
        if (series.created) (createdByDay[iso] || []).forEach(t => rows.push({ cls: 'created', title: t.title }));

        const shown = rows.slice(0, AGENDA_ROWS);
        const extra = rows.length - shown.length;
        countsHtml = `<div class="cal-agenda">${
          shown.map(r => `<span class="cal-event ${r.cls}"><span class="cal-event-dot"></span><span class="cal-event-title">${Util.escapeHtml(r.title)}</span></span>`).join('')
        }${extra > 0 ? `<span class="cal-more">+${extra} more</span>` : ''}</div>`;
      } else {
        /* Big for the two that need acting on, small for the one that is just
           history. Due leads, because it is the only one about the future. */
        countsHtml = '';
        if (dueList.length) {
          countsHtml += `<span class="cal-stat big due ${overdue ? 'overdue' : ''}">
              <span class="cal-stat-label">Due</span><span class="cal-stat-num">${dueList.length}</span>
            </span>`;
        }
        if (doneCount) {
          countsHtml += `<span class="cal-stat big completed">
              <span class="cal-stat-label">Complete</span><span class="cal-stat-num">${doneCount}</span>
            </span>`;
        }
        if (madeCount) {
          countsHtml += `<span class="cal-stat small created">
              <span class="cal-stat-label">Created</span><span class="cal-stat-num">${madeCount}</span>
            </span>`;
        }
      }

      html += `<div class="cal-cell ${isToday ? 'today' : ''}" onclick="App.showDayModal('${iso}')">
                 <div class="cal-daynum">${day}</div>
                 <div class="cal-events">${countsHtml}</div>
               </div>`;
    }
    const grid = document.getElementById('cal-grid');
    grid.className = 'cal-grid' + (agenda ? ' agenda' : '') + (weekends ? '' : ' no-weekends');
    grid.innerHTML = html;
  }

  function showDayModal(iso) {
    const series = calSeries();
    const groups = [
      { title: 'Due', list: series.due ? (dueByDay[iso] || []) : [] },
      { title: 'Created', list: series.created ? (createdByDay[iso] || []) : [] },
      { title: 'Complete', list: series.completed ? (completedByDay[iso] || []) : [] }
    ].filter(g => g.list.length);

    if (!groups.length) return;

    document.getElementById('modal-title').textContent = Util.formatDate(iso);

    const today = Util.todayStr();

    /* The same labelled counts the square shows, so opening a day confirms what
       you clicked rather than making you count the rows. Due counts only work
       still outstanding, exactly as the square does. */
    const openDue = (dueByDay[iso] || []).filter(t => !t.completedAt && !t.archived).length;
    const doneCount = (completedByDay[iso] || []).length;
    const madeCount = (createdByDay[iso] || []).length;
    const dayOverdue = iso < today && openDue > 0;

    const summary = [
      series.due && openDue ? `<span class="cal-stat big due ${dayOverdue ? 'overdue' : ''}"><span class="cal-stat-label">Due</span><span class="cal-stat-num">${openDue}</span></span>` : '',
      series.completed && doneCount ? `<span class="cal-stat big completed"><span class="cal-stat-label">Complete</span><span class="cal-stat-num">${doneCount}</span></span>` : '',
      series.created && madeCount ? `<span class="cal-stat small created"><span class="cal-stat-label">Created</span><span class="cal-stat-num">${madeCount}</span></span>` : ''
    ].filter(Boolean).join('');

    const summaryHtml = summary ? `<div class="day-summary">${summary}</div>` : '';

    const body = summaryHtml + groups.map(g => {
      const items = g.list.map(t => {
        const late = g.title === 'Due' && !t.completedAt && iso < today;
        const done = g.title === 'Due' && t.completedAt;
        const note = late ? ' <span class="day-task-note overdue">overdue</span>'
                   : (done ? ' <span class="day-task-note done">done</span>' : '');
        return `<li class="day-task" onclick="App.showTaskDetail('${t.id}', '${iso}')">${Util.escapeHtml(t.title)}${note}</li>`;
      }).join('');
      return `<div class="modal-group"><h4>${g.title}</h4><ul>${items}</ul></div>`;
    }).join('');

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
    const dp = subtaskProgress(t);
    if (dp.total) {
      rows.push(detailRow('Steps', `${dp.done} of ${dp.total} done<ul class="detail-subtasks">${
        subtasksOf(t).map(sub => `<li class="${sub.done ? 'done' : ''}">${sub.done ? '&#9745;' : '&#9744;'} ${Util.escapeHtml(sub.title)}</li>`).join('')
      }</ul>`));
    }
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
    renderSubtaskEditor('edit-subtasks', subtasksOf(t));

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
    t.subtasks = readSubtaskEditor('edit-subtasks');

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
      <button class="acct-item" onclick="App.openInstall()">Get Tend on your phone</button>
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

  /* ---------------------------------------------------------------
     Getting Tend onto a phone.

     There is no link that installs a web app by itself - Apple has no
     API for it at all, and Chrome will only offer its own prompt. So
     this shows the address as a QR code to scan, the link to send, and
     the two taps each phone needs after that. On Chrome, where the
     browser does allow it, there is a real one-tap install button.
     --------------------------------------------------------------- */

  function installUrl() {
    /* The address of the app itself, without whatever query or hash the
       current tab happens to carry. */
    const path = location.pathname.replace(/index\.html$/i, '');
    return location.origin + path;
  }

  function setSettingsTitle(text) {
    const h = document.getElementById('settings-title');
    if (h) h.textContent = text;
  }

  function openInstall() {
    document.getElementById('account-dropdown').hidden = true;
    setSettingsTitle('Get Tend on your phone');
    const url = installUrl();
    const local = location.protocol === 'file:' || /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname);

    let qr = '';
    try {
      qr = Qr.svg(url, { width: 190, dark: '#1d2333' });
    } catch (e) {
      qr = '<div class="install-qr-fallback">Could not draw the code</div>';
    }

    const installed = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;

    document.getElementById('settings-body').innerHTML = `
      ${installed ? '<div class="settings-note install-done">You are already using the installed app.</div>' : ''}

      <div class="settings-section install-section">
        <h4>Scan this with a phone</h4>
        <p>Point the camera at the code. It opens Tend in the phone's browser, ready to be added to the home screen.</p>
        <div class="install-qr">${qr}</div>
        ${local ? '<div class="settings-note">This is a local address, so the code only works on this computer. Open the published site to get a code your phone can use.</div>' : ''}
      </div>

      <div class="settings-section">
        <h4>Or send the link</h4>
        <div class="settings-row">
          <input type="text" id="install-link" value="${Util.escapeHtml(url)}" readonly onclick="this.select()">
          <button class="settings-btn primary" onclick="App.copyInstallLink()">Copy</button>
        </div>
        <div class="settings-note" id="install-copy-note"></div>
      </div>

      <div class="settings-section" id="install-prompt-section" hidden>
        <h4>Install it here</h4>
        <p>This browser can add Tend properly, with its own icon and no address bar.</p>
        <div class="settings-row">
          <button class="settings-btn primary" onclick="App.runInstallPrompt()">Install Tend</button>
        </div>
      </div>

      <div class="settings-section">
        <h4>Adding it to the home screen</h4>
        <p>Once the site is open on the phone:</p>
        <ul class="install-steps">
          <li><strong>iPhone or iPad</strong> — in Safari, tap Share (the square with the arrow), scroll down, tap <strong>Add to Home Screen</strong>, then Add.</li>
          <li><strong>Android</strong> — in Chrome, tap the three dots, then <strong>Install app</strong> (or Add to Home screen).</li>
        </ul>
        <p class="settings-note">Apple does not let a link or a code do this last step on its own &mdash; every web app on an iPhone is added the same way.</p>
      </div>`;

    if (deferredInstall) {
      const sec = document.getElementById('install-prompt-section');
      if (sec) sec.hidden = false;
    }
    document.getElementById('settings-modal-backdrop').classList.add('active');
  }

  function copyInstallLink() {
    const input = document.getElementById('install-link');
    const note = document.getElementById('install-copy-note');
    const done = () => { if (note) note.textContent = 'Link copied.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(input.value).then(done, () => {
        input.select();
        if (note) note.textContent = 'Press Ctrl+C (or Cmd+C) to copy.';
      });
    } else {
      input.select();
      if (note) note.textContent = 'Press Ctrl+C (or Cmd+C) to copy.';
    }
  }

  /* Chrome hands us its install prompt ahead of time; we hold on to it so the
     button above can fire it at the moment somebody asks. */
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstall = e;
    const sec = document.getElementById('install-prompt-section');
    if (sec) sec.hidden = false;
  });
  window.addEventListener('appinstalled', function () { deferredInstall = null; });

  async function runInstallPrompt() {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    try { await deferredInstall.userChoice; } catch (e) { /* ignore */ }
    deferredInstall = null;
    const sec = document.getElementById('install-prompt-section');
    if (sec) sec.hidden = true;
  }

  /* ---------------------------------------------------------------
     Header themes. Only the ribbon changes - the page below it stays
     the same, which is the whole point of keeping them to six tokens.
     --------------------------------------------------------------- */

  const THEMES = [
    { id: 'forest',   name: 'Forest',   from: '#10281d', to: '#1f4a34' },
    { id: 'midnight', name: 'Midnight', from: '#1d2333', to: '#2a3350' },
    { id: 'reef',     name: 'Reef',     from: '#07283a', to: '#0f5f75' },
    { id: 'plum',     name: 'Plum',     from: '#2a1a45', to: '#4f2f80' },
    { id: 'slate',    name: 'Slate',    from: '#21252b', to: '#3a414b' },
    { id: 'clay',     name: 'Clay',     from: '#31201a', to: '#7a422b' },
    { id: 'ink',      name: 'Ink',      from: '#0e1014', to: '#1e222b' },
    { id: 'paper',    name: 'Paper',    from: '#f7f5f0', to: '#e8e4dc' }
  ];

  const DEFAULT_THEME = 'forest';

  function currentTheme() {
    const id = Store.prefs().theme;
    return THEMES.some(t => t.id === id) ? id : DEFAULT_THEME;
  }

  function applyTheme() {
    const id = currentTheme();
    /* The default is what :root already says, so it carries no attribute. */
    if (id === DEFAULT_THEME) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', id);

    /* Keep the phone's own chrome (status bar, task switcher) in step. */
    const t = THEMES.find(x => x.id === id) || THEMES[0];
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t.from);
  }

  function setTheme(id) {
    Store.prefs().theme = id;
    Store.savePrefs();
    applyTheme();
    renderThemePicker();
  }

  function renderThemePicker() {
    const host = document.getElementById('theme-picker');
    if (!host) return;
    const current = currentTheme();
    host.innerHTML = `<div class="theme-grid">${THEMES.map(t => `
      <button type="button" class="theme-tile ${t.id === current ? 'on' : ''}" onclick="App.setTheme('${t.id}')">
        <span class="theme-swatch" style="background:linear-gradient(120deg, ${t.from} 0%, ${t.to} 100%)"></span>
        <span class="theme-name">${Util.escapeHtml(t.name)}</span>
      </button>`).join('')}</div>`;
  }

  function openSettings() {
    document.getElementById('account-dropdown').hidden = true;
    setSettingsTitle('Settings & backup');
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
        <h4>Header colour</h4>
        <p>Changes the ribbon at the top of the page. Click one to see it straight away.</p>
        <div id="theme-picker"></div>
      </div>

      <div class="settings-section">
        <h4>World</h4>
        <p>Changes how everything looks. Your ${tickets().length ? 'tickets, coins and ' + (Store.prefs().world === 'ocean' ? 'reef' : 'garden') : 'progress'} come with you &mdash; nothing is reset.</p>
        <div id="world-settings"></div>
      </div>

      ${digestSettingsHTML()}

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
    renderWorldSettings();
    renderThemePicker();
    document.getElementById('settings-modal-backdrop').classList.add('active');
  }

  /* ---------------------------------------------------------------
     Daily summary email. The switch only appears where it can actually
     do something: cloud accounts, on a site whose owner has set the
     reminder job up.
     --------------------------------------------------------------- */

  const DIGEST_HOURS = [6, 7, 8, 9, 12, 17, 20];

  function digestOn() {
    return !!Store.prefs().dailyEmail;
  }

  function digestHour() {
    const h = parseInt(Store.prefs().dailyEmailHour, 10);
    return DIGEST_HOURS.indexOf(h) === -1 ? 7 : h;
  }

  function digestSettingsHTML() {
    if (!Store.config.DAILY_EMAIL || !Store.isCloud()) return '';
    const on = digestOn();
    const hour = digestHour();
    const label = h => (h === 12 ? '12pm' : h > 12 ? (h - 12) + 'pm' : h + 'am');
    return `
      <div class="settings-section">
        <h4>Daily summary email</h4>
        <p>One email a morning listing what is due today and anything overdue. Nothing is sent on a day with neither.</p>
        <label class="checkbox-row">
          <input type="checkbox" id="digest-on" ${on ? 'checked' : ''} onchange="App.setDigest(this.checked)">
          Email me a daily summary
        </label>
        <div class="settings-row" id="digest-time-row" ${on ? '' : 'hidden'}>
          <label class="field-label" for="digest-hour">Send at</label>
          <select id="digest-hour" onchange="App.setDigestHour(this.value)">
            ${DIGEST_HOURS.map(h => `<option value="${h}" ${h === hour ? 'selected' : ''}>${label(h)}</option>`).join('')}
          </select>
        </div>
        <div class="settings-note">Sent to ${Util.escapeHtml(Store.email())}, in your device's time zone.</div>
      </div>`;
  }

  function setDigest(on) {
    Store.prefs().dailyEmail = !!on;
    if (on && !Store.prefs().dailyEmailHour) Store.prefs().dailyEmailHour = 7;
    Store.prefs().timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    Store.savePrefs();
    const row = document.getElementById('digest-time-row');
    if (row) row.hidden = !on;
  }

  function setDigestHour(hour) {
    Store.prefs().dailyEmailHour = parseInt(hour, 10);
    Store.prefs().timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    Store.savePrefs();
  }

  /* The same chooser as the sign-up card, wired to change the live account. */
  function renderWorldSettings() {
    const host = document.getElementById('world-settings');
    if (!host) return;
    const prefs = Store.prefs();
    const worldId = prefs.world || Worlds.DEFAULT_WORLD;
    const hero = prefs.hero === 'female' ? 'female' : 'male';
    const world = Worlds.get(worldId);

    host.innerHTML = `
      <div class="chooser">
        <div class="chooser-row">
          <span class="chooser-label">World</span>
          <div class="choice-group">${Worlds.list().map(w =>
            `<button type="button" class="choice ${w.id === worldId ? 'on' : ''}" data-set-world="${w.id}">
               <span class="choice-name">${Util.escapeHtml(w.label)}</span>
             </button>`).join('')}</div>
        </div>
        <div class="chooser-row">
          <span class="chooser-label">You</span>
          <div class="choice-group">${['male', 'female'].map(g =>
            `<button type="button" class="choice ${g === hero ? 'on' : ''}" data-set-hero="${g}">
               <span class="choice-name">${Util.escapeHtml(world.heroLabels[g])}</span>
             </button>`).join('')}</div>
        </div>
        <div>${Worlds.previewHTML(worldId, hero)}</div>
        <p class="chooser-blurb">${Util.escapeHtml(world.blurb)}</p>
      </div>`;

    host.querySelectorAll('[data-set-world]').forEach(btn => {
      btn.onclick = () => setWorld(btn.dataset.setWorld, null);
    });
    host.querySelectorAll('[data-set-hero]').forEach(btn => {
      btn.onclick = () => setWorld(null, btn.dataset.setHero);
    });
  }

  function setWorld(worldId, hero) {
    const prefs = Store.prefs();
    if (worldId) prefs.world = worldId;
    if (hero) prefs.hero = hero;
    Store.savePrefs();
    Garden.reskin();
    renderWorldSettings();
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
    renderDueToday();
    renderCategoryKey();
    populateCategorySelects();
    renderList();
    initDragAndDrop();
    renderCalendar();
    renderStats();
    Garden.render();
  }

  /* A brief note when something arrives from another device, so the screen
     changing under you is explained rather than startling. The header badge is
     hidden on a phone, which is exactly where this matters most. */
  let syncedFlashTimer = null;
  function flashSynced() {
    let el = document.getElementById('sync-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sync-toast';
      el.className = 'sync-toast';
      document.body.appendChild(el);
    }
    el.textContent = 'Updated from your other device';
    el.classList.add('show');
    if (syncedFlashTimer) clearTimeout(syncedFlashTimer);
    syncedFlashTimer = setTimeout(function () {
      el.classList.remove('show');
      syncedFlashTimer = null;
    }, 2200);
  }

  function boot() {
    loadViewPrefs();
    applyTheme();

    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();

    renderHeader();
    Garden.loadAll();   /* hydrate the garden before anything renders or saves it */
    renderAll();
    applyCalendarWidth();
    Garden.start();

    if (!booted) {
      booted = true;
      Store.onStatus(renderSyncBadge);
      primeDownloadBridge();

      /* Something changed on another device: take the new state and redraw,
         garden included. */
      if (Store.onChange) {
        Store.onChange(function () {
          Garden.loadAll();
          applyTheme();
          renderAll();
          applyCalendarWidth();
          Garden.reskin();
          flashSynced();
        });
      }

      document.getElementById('new-task-input').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
      document.getElementById('search-input').addEventListener('input', function () {
        syncSearchChrome();
        renderList();
      });
      document.getElementById('search-input').addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.stopPropagation(); clearSearch(); }
      });
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
    taskRowClick,
    openEditModal, saveEditedTask, closeEditModal, closeEditModalOnBackdrop,
    onCategoryChange, onEditCategoryChange,
    submitAddCategory, removeCategoryByIndex,
    toggleSubtask, toggleSubtaskList, editorAdd, editorRemove, editorRename, editorToggle,
    switchView, changeMonth, goToday, showDayModal, showTaskDetail, toggleCalSeries,
    setCalView, toggleWeekends, showDueToday,
    openInstall, copyInstallLink, runInstallPrompt,
    clearSearch, setTheme,
    closeModal, closeModalOnBackdrop,
    toggleShowCompleted, toggleShowArchived,
    toggleAccountMenu, openSettings, closeSettings, closeSettingsOnBackdrop, setWorld,
    saveDisplayName, exportBackup, forcePull, eraseEverything,
    setDigest, setDigestHour,
    signOut, switchProfile
  };
})();
