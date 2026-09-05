/* ============================================================================
   Tend - app.js
   ----------------------------------------------------------------------------
   The task tracker itself: lists, calendar, stats, categories, the new/edit
   forms, drag-and-drop ordering, settings and backup.

   State lives in Store. Every mutation ends with Store.save*() so the change
   is cached locally and, in cloud mode, pushed to the database.
   ============================================================================ */

const App = (function () {
  'use strict';

  const DEFAULT_CATEGORY_COLOR = '#8a8f98';
  /* Suggestions, not a colour picker. Picking a category colour out of the
     full 16-million is a decision nobody wants to make about "Errands", and the
     native colour input opens an OS dialog to make it. These are chosen to stay
     distinct from each other at pill size, which a free pick does not.
     Appending to this list is safe: a category stores its own hex, so nothing
     already made can change. */
  const CATEGORY_PALETTE = [
    '#2a78d6', '#eda100', '#4a3aa7', '#e87ba4', '#eb6834', '#0f9d6a',
    '#c0392b', '#16a085', '#8e44ad', '#d35400', '#2c3e50', '#c2185b',
    '#00838f', '#7cb342', '#5d4037', '#546e7a'
  ];

  /* Which suggestion is armed for the next category. Null means "whichever is
     not in use yet", which is what it falls back to after each add. */
  let pendingCategoryColor = null;

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

  /* garden.js declares `const Garden`, which is a global *lexical* binding and
     not a property of window - so every `window.Garden && ...` guard in here
     was quietly always false, and the branch behind it never ran. The garden
     tab kept its default label in the ocean world, hiding the garden did not
     reach it, and switching to it did not redraw. Same for `window.App` from
     the garden's side. */
  function hasGarden() { return typeof Garden !== 'undefined'; }

  function addCategory(name, color) {
    name = (name || '').trim();
    if (!name) return false;
    if (categories().some(c => c.name.toLowerCase() === name.toLowerCase())) return false;
    categories().push({ id: Util.uid(), name: name, color: color || nextCategoryColor() });
    Store.saveCategories();
    return true;
  }

  /* Removing a category never removes what was in it. The tasks keep their
     place in the list and simply become uncategorised, which is what Other is.

     They already *showed* under Other, because groupByCategory sends anything
     whose category is not a real one there - but each task still carried the
     dead name. That meant a stale pill on the row, a search that matched a
     category nobody could see, and tasks that silently rejoined the category if
     one was ever created with the same name again. So the name is cleared for
     real. The snapshot above covers tickets as well as categories, so one Undo
     puts the category back and its tasks back into it. */
  function removeCategoryByIndex(i) {
    const list = categories();
    if (i < 0 || i >= list.length) return;
    const name = list[i].name;
    snapshot('removing the ' + name + ' category');

    const key = (name || '').trim().toLowerCase();
    let moved = 0;
    tickets().forEach(t => {
      if ((t.category || '').trim().toLowerCase() !== key) return;
      t.category = '';
      moved++;
    });

    list.splice(i, 1);
    Store.saveCategories();
    if (moved) Store.saveTickets();
    renderCategoryKey();
    populateCategorySelects();
    renderAll();

    if (moved) {
      showUndoToast(`Removed ${name} \u2014 ${moved} ${moved === 1 ? 'task' : 'tasks'} moved to Other`);
    } else {
      showUndoToast('Removed ' + name);
    }
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

  /* A category always looks the same wherever it appears: a small bubble, in
     the category's own colour, the same shape as the steps counter beside it. */
  function categoryPill(name, color) {
    const c = color || DEFAULT_CATEGORY_COLOR;
    return `<span class="tag category-tag" style="background:${Util.hexToRgba(c, 0.13)};`
      + `border-color:${Util.hexToRgba(c, 0.45)};color:${Util.inkShade(c, 0.35)}">`
      + `<span class="category-dot" style="background:${c}"></span>${Util.escapeHtml(name)}</span>`;
  }

  function renderCategoryKey() {
    const hint = document.getElementById('category-hint');
    if (hint) {
      const ocean = (Store.prefs() || {}).world === 'ocean';
      hint.textContent = (ocean
        ? 'Colour-codes your tasks and the shells your corals sit in.'
        : 'Colour-codes your tasks and the plant pots in your garden.')
        + ' Drag one by its handle to change the order they are listed in.';
    }

    const grip = `<span class="key-grip" title="Drag to reorder" aria-hidden="true"><svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor"><circle cx="2.5" cy="3" r="1.3"/><circle cx="7.5" cy="3" r="1.3"/><circle cx="2.5" cy="8" r="1.3"/><circle cx="7.5" cy="8" r="1.3"/><circle cx="2.5" cy="13" r="1.3"/><circle cx="7.5" cy="13" r="1.3"/></svg></span>`;
    const items = categories().map((c, i) =>
      `<div class="key-item person-key-item cat-sortable-item" data-cat-index="${i}">
        ${grip}
        ${categoryPill(c.name, c.color)}
        <button class="person-remove-btn" title="Remove ${Util.escapeHtml(c.name)}" onclick="App.removeCategoryByIndex(${i})">&times;</button>
      </div>`
    );
    const chosen = pendingCategoryColor || nextCategoryColor();
    const used = new Set(categories().map(c => c.color));
    const swatches = CATEGORY_PALETTE.map(c =>
      `<button type="button" class="swatch${c === chosen ? ' on' : ''}${used.has(c) ? ' used' : ''}"
               style="--swatch:${c}" data-color="${c}"
               title="${used.has(c) ? 'Already used by another category' : c}"
               aria-label="Use ${c}"${c === chosen ? ' aria-pressed="true"' : ''}
               onclick="App.pickCategoryColor('${c}')"></button>`).join('');

    const addForm = `
      <div class="person-add-row">
        <input type="text" id="category-add-name" placeholder="Add category&hellip;" maxlength="100" onkeydown="if(event.key==='Enter')App.submitAddCategory()">
        <button class="person-add-btn" onclick="App.submitAddCategory()">Add</button>
      </div>
      <div class="swatch-row" id="category-swatches" role="group" aria-label="Colour for the new category">${swatches}</div>`;
    /* Only the real categories are draggable; Other is not a category anybody
       owns, so it stays pinned at the bottom outside the sortable block. */
    document.getElementById('category-key').innerHTML =
      `<div class="key-sortable" id="category-order">${items.join('')}</div>`
      + `<div class="key-item">${categoryPill('Other', DEFAULT_CATEGORY_COLOR)}</div>`
      + addForm;
    initCategoryDrag();
  }

  /* ---------------------------------------------------------------
     The category list is a ranking, not just a palette: its order is
     the order the groups appear in on both category views and in the
     task dropdowns. Dragging uses pointer events rather than HTML5
     drag-and-drop, so it works with a finger as well as a mouse.
     --------------------------------------------------------------- */

  let catDrag = null;

  function catDropTarget(host, y) {
    const others = [...host.querySelectorAll('.cat-sortable-item:not(.dragging)')];
    return others.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
  }

  function commitCategoryOrder(host) {
    const order = [...host.querySelectorAll('.cat-sortable-item')].map(el => Number(el.dataset.catIndex));
    const list = categories();
    const moved = order.map(i => list[i]).filter(Boolean);
    /* If anything looks off, redraw from the stored order rather than saving
       a list that has lost or doubled an entry. */
    if (moved.length !== list.length) { renderCategoryKey(); return; }
    if (moved.every((c, i) => c === list[i])) return;      /* nothing actually moved */

    snapshot('reordering the categories');
    list.length = 0;
    moved.forEach(c => list.push(c));
    Store.saveCategories();

    renderCategoryKey();
    renderByCategory();
    populateCategorySelects();
    renderList();
  }

  function initCategoryDrag() {
    const host = document.getElementById('category-order');
    if (!host || host.dataset.dndReady) return;
    host.dataset.dndReady = '1';

    host.addEventListener('pointerdown', e => {
      const grip = e.target.closest('.key-grip');
      if (!grip) return;
      const item = grip.closest('.cat-sortable-item');
      if (!item) return;
      e.preventDefault();
      item.classList.add('dragging');
      try { grip.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
      catDrag = { item: item, grip: grip, pointerId: e.pointerId };
    });

    host.addEventListener('pointermove', e => {
      if (!catDrag || e.pointerId !== catDrag.pointerId) return;
      e.preventDefault();
      const after = catDropTarget(host, e.clientY);
      if (after == null) host.appendChild(catDrag.item);
      else host.insertBefore(catDrag.item, after);
    });

    const finish = function (e) {
      if (!catDrag || (e && e.pointerId !== catDrag.pointerId)) return;
      catDrag.item.classList.remove('dragging');
      try { catDrag.grip.releasePointerCapture(catDrag.pointerId); } catch (err) { /* already released */ }
      catDrag = null;
      commitCategoryOrder(host);
    };
    host.addEventListener('pointerup', finish);
    host.addEventListener('pointercancel', finish);
  }

  /* Arming a colour must not redraw the panel: renderCategoryKey replaces the
     whole thing, which would throw away the name being typed and the caret with
     it. So the classes are moved by hand. */
  function pickCategoryColor(color) {
    pendingCategoryColor = color;
    const host = document.getElementById('category-swatches');
    if (!host) return;
    host.querySelectorAll('.swatch').forEach(el => {
      const on = el.dataset.color === color;
      el.classList.toggle('on', on);
      if (on) el.setAttribute('aria-pressed', 'true');
      else el.removeAttribute('aria-pressed');
    });
  }

  function submitAddCategory() {
    const nameInput = document.getElementById('category-add-name');
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    snapshot('adding the ' + name + ' category');
    if (addCategory(name, pendingCategoryColor || nextCategoryColor())) {
      nameInput.value = '';
      /* Back to "next unused" so the following one does not silently reuse the
         colour just taken. */
      pendingCategoryColor = null;
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
      /* Each option carries its category's colour twice over: as a tint behind
         it and as a bullet in front of it. Desktop browsers paint the tint;
         phones mostly ignore option styling and show a plain list, which is why
         the bullet is there as well - and why the select itself is tinted when
         a category is chosen, since that much every browser will draw. */
      categories().forEach(c => {
        const col = c.color || DEFAULT_CATEGORY_COLOR;
        opts.push(`<option value="${Util.escapeHtml(c.name)}" data-color="${col}"`
          + ` style="background:${Util.hexToRgba(col, 0.16)};color:${Util.inkShade(col, 0.35)}">`
          + `\u25CF ${Util.escapeHtml(c.name)}</option>`);
      });
      opts.push('<option value="other">Other&hellip;</option>');
      sel.innerHTML = opts.join('');
      if (current && (categories().some(c => c.name === current) || current === 'other')) sel.value = current;
      tintCategorySelect(sel);
    });
  }

  /* The picker wears the colour of whatever is picked, so the choice is
     visible without opening it. */
  function tintCategorySelect(sel) {
    if (!sel) return;
    const opt = sel.options[sel.selectedIndex];
    const col = opt && opt.dataset ? opt.dataset.color : '';
    if (col) {
      sel.style.borderLeft = '6px solid ' + col;
      sel.style.background = Util.hexToRgba(col, 0.1);
      sel.style.color = Util.inkShade(col, 0.35);
    } else {
      sel.style.borderLeft = '';
      sel.style.background = '';
      sel.style.color = '';
    }
  }

  /* ========================= tasks ========================= */

  function onCategoryChange() {
    const select = document.getElementById('new-task-category');
    document.getElementById('category-other-row').style.display = select.value === 'other' ? 'flex' : 'none';
    tintCategorySelect(select);
  }

  function onEditCategoryChange() {
    const select = document.getElementById('edit-task-category');
    document.getElementById('edit-category-other-row').style.display = select.value === 'other' ? 'flex' : 'none';
    tintCategorySelect(select);
  }

  function addTask() {
    const input = document.getElementById('new-task-input');
    const notesInput = document.getElementById('new-task-notes');
    const catSelect = document.getElementById('new-task-category');
    const catOtherInput = document.getElementById('new-task-category-other');
    const priorityCheckbox = document.getElementById('new-task-priority');
    const dueDateInput = document.getElementById('new-task-duedate');

    const title = input.value.trim();
    if (!title) return;
    snapshot('adding "' + title + '"');

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
      category: category,
      priority: priorityCheckbox.checked,
      archived: false,
      dueDate: dueDateInput.value || null,
      createdAt: Util.todayStr(),
      completedAt: null,
      subtasks: readSubtaskEditor('new-subtasks')
    });

    input.value = '';
    notesInput.value = '';
    catSelect.value = '';
    catOtherInput.value = '';
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

  /* ---------------------------------------------------------------
     Undo.

     Every action that changes a task or a category takes a snapshot of
     both lists first, and Undo puts the last one back. Snapshots rather
     than a dozen hand-written opposites: one restore is far easier to
     keep honest than twelve inverses, and the lists are small.

     The garden is deliberately not in here. Growth and purchases are
     merged forward across devices on purpose, so an undo of those would
     be quietly re-applied by the next sync - which is worse than not
     offering it.
     --------------------------------------------------------------- */

  const UNDO_LIMIT = 30;
  let undoStack = [];

  function snapshot(label) {
    undoStack.push({
      label: label,
      tickets: JSON.stringify(tickets()),
      categories: JSON.stringify(categories())
    });
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    renderUndoButton();
  }

  function canUndo() { return undoStack.length > 0; }

  function undoLast() {
    const step = undoStack.pop();
    if (!step) return;

    Store.setTickets(JSON.parse(step.tickets));
    const cats = categories();
    cats.length = 0;
    JSON.parse(step.categories).forEach(c => cats.push(c));
    Store.saveCategories();

    renderAll();
    renderUndoButton();
    showToast('Undone: ' + step.label);
  }

  function renderUndoButton() {
    const btn = document.getElementById('undo-btn');
    if (!btn) return;
    const next = undoStack[undoStack.length - 1];
    btn.disabled = !next;
    btn.title = next ? 'Undo: ' + next.label + '  (Ctrl+Z)' : 'Nothing to undo';
  }

  function toggleTask(id, elm) {
    const t = tickets().find(x => x.id === id);
    if (!t) return;
    const nowCompleting = !t.completedAt;
    snapshot(nowCompleting ? 'finishing "' + t.title + '"' : 'un-ticking "' + t.title + '"');
    t.completedAt = t.completedAt ? null : Util.todayStr();
    Store.saveTickets();
    if (nowCompleting) {
      /* A coin has just been earned, so it sounds like one. */
      if (hasGarden() && Garden.playCashSound) Garden.playCashSound();
      if (elm) {
        const r = elm.getBoundingClientRect();
        launchConfetti(r.left + r.width / 2, r.top + r.height / 2);
      }
    }
    renderAll();
    /* After the render, so the counter it flies to is the new one. */
    if (nowCompleting) rewardEarned(elm);
  }

  /* The coin was the quietest thing on the screen: a sound, and a number
     changing in a panel you were not looking at. Now it leaves the checkbox you
     just ticked and lands on the counter, and the toast says what it is worth -
     which is the sentence that sends anyone to the shop. */
  function coinTarget() {
    /* Wherever the count actually is right now: beside the garden on the web,
       and on the Garden tab when the garden is a section of its own or hidden. */
    const candidates = ['garden-coins', 'shop-coins-row', 'bnav-garden', 'account-btn'];
    for (const id of candidates) {
      const el = document.getElementById(id);
      if (el && el.offsetParent !== null) return el;
    }
    return null;
  }

  function flyCoin(fromEl, toEl) {
    if (!fromEl || !toEl) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    const coin = document.createElement('div');
    coin.className = 'coin-fly';
    coin.innerHTML = (hasGarden() && Garden.coinSVG) ? Garden.coinSVG() : '\u{1FA99}';
    coin.style.left = (a.left + a.width / 2 - 11) + 'px';
    coin.style.top = (a.top + a.height / 2 - 11) + 'px';
    document.body.appendChild(coin);
    const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
    const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
    requestAnimationFrame(() => {
      coin.style.transform = `translate(${dx}px, ${dy}px) scale(0.55)`;
      coin.style.opacity = '0.2';
    });
    setTimeout(() => coin.remove(), 900);
  }

  function rewardEarned(fromEl) {
    if (!hasGarden()) return;
    const n = (Garden.coinsPerTask ? Garden.coinsPerTask() : 1);
    flyCoin(fromEl, coinTarget());
    const hint = Garden.coinHint ? Garden.coinHint() : '';
    showToast('+' + n + (n === 1 ? ' coin' : ' coins') + (hint ? ' \u2014 ' + hint : ''));
  }

  function togglePriority(id) {
    const t = tickets().find(x => x.id === id);
    if (!t) return;
    snapshot((t.priority ? 'unstarring "' : 'starring "') + t.title + '"');
    t.priority = !t.priority;
    Store.saveTickets();
    renderList();
  }

  function toggleArchive(id) {
    const t = tickets().find(x => x.id === id);
    if (t) snapshot((t.archived ? 'unarchiving "' : 'archiving "') + t.title + '"');
    if (!t) return;
    const nowArchived = !t.archived;
    t.archived = nowArchived;
    if (t.archived) t.priority = false;
    Store.saveTickets();
    renderList();
    showUndoToast(nowArchived
      ? 'Archived \u201c' + t.title + '\u201d \u2014 find it under Show archived'
      : 'Restored \u201c' + t.title + '\u201d');
  }

  /* No confirm box. A dialog for something that is one keystroke to undo is a
     tax on every deliberate delete to catch the rare accidental one; the toast
     puts the way back where the mistake happens. */
  function deleteTask(id) {
    const t = tickets().find(x => x.id === id);
    if (!t) return;
    snapshot('deleting "' + t.title + '"');
    const list = tickets();
    const i = list.findIndex(x => x.id === id);
    if (i !== -1) list.splice(i, 1);
    Store.saveTickets();
    renderAll();
    showUndoToast('Deleted \u201c' + t.title + '\u201d');
  }

  /* ---------------------------------------------------------------
     Subtasks. A task carries a small checklist; ticking items off is
     progress, but only the task itself pays a coin.
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
    snapshot('a step on "' + t.title + '"');
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
    snapshot('reordering the list');
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
    return [t.title, t.notes, t.category].some(v => (v || '').toLowerCase().includes(q));
  }

  /* Tasks bucketed by category, in the order the categories are listed, with
     anything uncategorised - or pointing at a category since deleted - under
     Other. Empty buckets are dropped: a column of "Nothing left to do." under
     categories you are not using was the mess on the overview page. */
  function groupByCategory(list) {
    const names = categories().map(c => c.name);
    const known = new Set(names.map(n => n.toLowerCase()));
    const groups = names.map(n => ({ name: n, color: categoryColor(n), list: [] }));
    const index = {};
    groups.forEach(g => { index[g.name.toLowerCase()] = g; });
    const other = { name: 'Other', color: DEFAULT_CATEGORY_COLOR, list: [] };

    list.forEach(t => {
      const key = (t.category || '').trim().toLowerCase();
      ((key && known.has(key)) ? index[key] : other).list.push(t);
    });
    groups.push(other);
    return groups.filter(g => g.list.length);
  }

  /* The task list has three shapes, and a button for each. The choice is
     remembered per account; category is what a new account opens on. */
  /* 'priority' - a Priority block lifted out above the categories - was removed.
     An account still holding it in prefs falls through listGrouping's validation
     and lands back on 'category'. */
  const LIST_GROUPINGS = [
    ['category', 'By category'],
    ['due', 'By date'],
    ['status', 'By status']
  ];

  function listGrouping() {
    const m = Store.prefs().listGroup;
    return LIST_GROUPINGS.some(g => g[0] === m) ? m : 'category';
  }

  function setListGrouping(mode) {
    Store.prefs().listGroup = LIST_GROUPINGS.some(g => g[0] === mode) ? mode : 'category';
    Store.savePrefs();
    renderList();
  }

  function renderListGroupToggle() {
    const host = document.getElementById('list-group-toggle');
    if (!host) return;
    const mode = listGrouping();
    host.innerHTML = LIST_GROUPINGS.map(([key, label]) =>
      `<button type="button" class="${mode === key ? 'on' : ''}" onclick="App.setListGrouping('${key}')">${label}</button>`
    ).join('');
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

    const noActiveMsg = query ? 'No active tasks match your search.' : 'Nothing active. Add a task to get started.';
    const noPriorityMsg = query ? 'No priority tasks match your search.' : 'Star a task to mark it as priority.';
    const noCompletedMsg = query ? 'No completed tasks match your search.' : 'Nothing completed yet.';
    const noArchivedMsg = query ? 'No archived tasks match your search.' : 'Archive a task to tuck it away here.';

    renderListGroupToggle();
    const mode = listGrouping();
    const grouped = mode !== 'status';
    const statusEl = document.getElementById('status-sections');
    const catEl = document.getElementById('category-sections');
    if (statusEl) statusEl.style.display = grouped ? 'none' : '';
    if (catEl) catEl.style.display = grouped ? '' : 'none';

    /* Only the shape on screen is drawn. Rendering both put every open task in
       the document twice, and a task row carries ids of its own - so
       toggleSubtaskList's getElementById found the copy in the hidden half and
       "Steps" did nothing at all in the category views. */
    if (grouped) {
      activeList.innerHTML = '';
      priorityList.innerHTML = '';
      if (mode === 'due') renderListByDate(activeAll, query);
      else renderListByCategory(activeAll, query);
    } else {
      if (catEl) catEl.innerHTML = '';
      activeList.innerHTML = active.length ? active.map(renderTaskItem).join('') : `<li class="empty-note">${noActiveMsg}</li>`;
      priorityList.innerHTML = priority.length ? priority.map(renderTaskItem).join('') : `<li class="empty-note">${noPriorityMsg}</li>`;
    }

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

  /* The same rows as the Priority / Active lists, gathered under their
     category, with the starred ones first inside each category. */
  function renderListByCategory(open, query) {
    const host = document.getElementById('category-sections');
    if (!host) return;

    const section = (headHtml, list, opts) =>
      `<section class="list-section${opts && opts.wide ? ' cat-section-wide' : ''}">
        <div class="cat-section-head">${headHtml}</div>
        <ul class="task-list">${list.map(t => renderTaskItem(t, opts)).join('')}</ul>
      </section>`;

    const groups = groupByCategory(open);

    if (!groups.length) {
      host.innerHTML = `<div class="cat-wide"><section class="list-section"><ul class="task-list"><li class="empty-note">${
        query ? 'No active tasks match your search.' : 'Nothing active. Add a task to get started.'
      }</li></ul></section></div>`;
      return;
    }

    const blocks = groups.map(g => {
      /* Inside a category's own group, repeating that category on every row is
         the noise this view exists to remove. Starred tasks still rise to the
         top of their own category - the star has not gone anywhere, only the
         view that pulled them all out into a block of their own. */
      const sorted = g.list.slice().sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0));
      return section(categoryPill(g.name, g.color), sorted, { hideCategory: true, noDrag: true });
    });
    host.innerHTML = `<div class="cat-columns">${blocks.join('')}</div>`;
  }

  /* The same rows again, gathered by when they are due rather than by what
     they are about - the view you want on a Monday morning. Buckets with
     nothing in them are left out, the same rule the category view follows. */
  const DUE_BUCKETS = [
    ['overdue', 'Overdue', '#d0353a'],
    ['today', 'Today', '#eb6834'],
    ['tomorrow', 'Tomorrow', '#eb9c34'],
    ['week', 'Rest of this week', '#3f9142'],
    ['later', 'Later', '#4361ee'],
    ['none', 'No date', DEFAULT_CATEGORY_COLOR]
  ];

  function dueBucket(t) {
    if (!t.dueDate) return 'none';
    const today = Util.todayStr();
    if (t.dueDate < today) return 'overdue';
    if (t.dueDate === today) return 'today';
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const tomorrow = d.toISOString().slice(0, 10);
    if (t.dueDate === tomorrow) return 'tomorrow';
    /* "This week" runs to Sunday, so on a Friday it means the weekend and on a
       Monday it means the whole week - which is how people say it. */
    const end = new Date(today + 'T00:00:00');
    end.setDate(end.getDate() + ((7 - end.getDay()) % 7));
    return t.dueDate <= end.toISOString().slice(0, 10) ? 'week' : 'later';
  }

  function renderListByDate(open, query) {
    const host = document.getElementById('category-sections');
    if (!host) return;

    const bins = {};
    open.forEach(t => { (bins[dueBucket(t)] = bins[dueBucket(t)] || []).push(t); });

    if (!open.length) {
      host.innerHTML = `<div class="cat-wide"><section class="list-section"><ul class="task-list"><li class="empty-note">${
        query ? 'No active tasks match your search.' : 'Nothing active. Add a task to get started.'
      }</li></ul></section></div>`;
      return;
    }

    host.innerHTML = '<div class="cat-wide">' + DUE_BUCKETS.filter(([key]) => (bins[key] || []).length).map(([key, label, color]) => {
      /* Inside a date group the dates are the heading, so a row only repeats
         its own date when it is overdue and the exact day matters. */
      const list = bins[key].slice().sort((a, b) => {
        if (!!b.priority !== !!a.priority) return b.priority ? 1 : -1;
        return (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1;
      });
      return `<section class="list-section cat-section-wide">
        <div class="cat-section-head">${categoryPill(label, color)}</div>
        <ul class="task-list">${list.map(t => renderTaskItem(t, { noDrag: true, hideDue: key !== 'overdue' })).join('')}</ul>
      </section>`;
    }).join('') + '</div>';
  }

  /* A click anywhere on the row that is not one of its own controls opens the
     task's details. That is where the dates now live - the collapsed row
     carries only what you need to scan the list. */
  function taskRowClick(id, ev) {
    if (ev && ev.target && ev.target.closest('button, input, a, label, .task-subtasks')) return;
    showTaskDetail(id);
  }

  function renderTaskItem(t, opts) {
    const done = !!t.completedAt;
    /* Called straight from .map in places, where the second argument is an
       index - so only an object counts as options. */
    const o = (opts && typeof opts === 'object') ? opts : {};

    const notesHtml = t.notes ? `<div class="task-notes">${Util.escapeHtml(t.notes)}</div>` : '';
    const catColor = categoryColor(t.category);

    const tags = [];
    if (t.category && !o.hideCategory) {
      tags.push(categoryPill(t.category, catColor));
    }
    const prog = subtaskProgress(t);
    if (prog.total) {
      tags.push(`<button type="button" class="tag subtask-tag ${prog.done === prog.total ? 'all-done' : ''}"
        onclick="event.stopPropagation();App.toggleSubtaskList('${t.id}')"
        title="Show the steps">&#9744; ${prog.done}/${prog.total}</button>`);
    }
    if (t.dueDate && !o.hideDue) {
      const overdue = !done && t.dueDate < Util.todayStr();
      tags.push(`<span class="tag ${overdue ? 'overdue' : ''}">Due ${Util.formatDate(t.dueDate)}${overdue ? ' (overdue)' : ''}</span>`);
    }
    const tagsHtml = tags.length ? `<div class="task-tags">${tags.join('')}</div>` : '';
    const borderStyle = t.category ? ` style="border-left-color:${catColor}"` : '';

    const starBtn = (done || t.archived) ? '' :
      `<button class="star-btn ${t.priority ? 'active' : ''}" title="${t.priority ? 'Unstar (move back to Active)' : 'Star as priority'}" onclick="App.togglePriority('${t.id}')">${t.priority ? '★' : '☆'}</button>`;

    const archiveIcon = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="5" rx="1"></rect><path d="M4 8v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8"></path><path d="M9.5 12h5"></path></svg>';
    /* Only the Priority / Active lists reorder by dragging. In the grouped
       views the order comes from the categories, so a row there is not
       draggable and does not offer the open-hand cursor. */
    const draggable = (o.noDrag || (done && !t.archived)) ? 'false' : 'true';

    return `
      <li class="task ${done ? 'done' : ''} ${t.archived ? 'archived' : ''}"${borderStyle} data-id="${t.id}" draggable="${draggable}"
          title="Open the task" onclick="App.taskRowClick('${t.id}', event)">
        <input type="checkbox" ${done ? 'checked' : ''} onchange="App.toggleTask('${t.id}', this)">
        <div class="task-body">
          <div class="task-title">${Util.escapeHtml(t.title)}</div>
          ${notesHtml}
          ${tagsHtml}
          ${renderSubtaskList(t)}
        </div>
        <div class="task-actions">
          ${starBtn}
          <div class="row-menu-wrap">
            <button class="row-menu-btn" title="More" aria-haspopup="true" aria-expanded="false"
                    onclick="App.toggleRowMenu('${t.id}', event)">&#8943;</button>
            <div class="row-menu" id="row-menu-${t.id}" hidden>
              <button type="button" onclick="App.rowMenuAction('edit','${t.id}',event)">&#9998; Edit</button>
              <button type="button" onclick="App.rowMenuAction('archive','${t.id}',event)">${archiveIcon} ${t.archived ? 'Unarchive' : 'Archive'}</button>
              <button type="button" class="danger" onclick="App.rowMenuAction('delete','${t.id}',event)">&times; Delete</button>
            </div>
          </div>
        </div>
      </li>`;
  }

  /* Four unlabelled icons on every row put Delete a thumb's width from the
     paperclip. Star and the checkbox stay where they are - they are the two
     things you do while scanning - and the rest moved behind one button, where
     they get words rather than glyphs. */
  let openRowMenu = null;

  function closeRowMenu() {
    if (!openRowMenu) return;
    const el = document.getElementById('row-menu-' + openRowMenu);
    if (el) {
      el.hidden = true;
      const btn = el.parentElement && el.parentElement.querySelector('.row-menu-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
    openRowMenu = null;
  }

  function toggleRowMenu(id, ev) {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    const wasOpen = openRowMenu === id;
    closeRowMenu();
    if (wasOpen) return;
    const el = document.getElementById('row-menu-' + id);
    if (!el) return;
    el.hidden = false;
    const btn = el.parentElement && el.parentElement.querySelector('.row-menu-btn');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    openRowMenu = id;
    /* Near the bottom of the window it opens upwards instead of off-screen. */
    const box = el.getBoundingClientRect();
    el.classList.toggle('drop-up', box.bottom > window.innerHeight - 8);
  }

  function rowMenuAction(what, id, ev) {
    if (ev) ev.stopPropagation();
    closeRowMenu();
    if (what === 'edit') openEditModal(id);
    else if (what === 'archive') toggleArchive(id);
    else if (what === 'delete') deleteTask(id);
  }

  /* ========================= stats ========================= */

  /* Open tasks due today, and anything already past its date. */
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

    /* A chip in the header corner rather than a card in the sidebar, so the
       number is on screen at every width and in every view. */
    btn.className = 'due-chip' + (late ? ' has-overdue' : (due ? ' has-due' : ''));
    btn.innerHTML = `<span class="due-chip-count">${due}</span>`
      + `<span class="due-chip-label">due today</span>`
      + (late ? `<span class="due-chip-late">${late} overdue</span>` : '');
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

    document.getElementById('stats-chart').innerHTML = `
      <div class="summary-headline">
        <span class="summary-num">${openTotal}</span>
        <span class="summary-label">Open tasks</span>
      </div>
      <ul class="summary-breakdown">
        <li><span class="summary-cat priority">Priority</span><span class="summary-catnum">${priorityCount}</span></li>
        <li><span class="summary-cat active">Active</span><span class="summary-catnum">${activeCount}</span></li>
        <li><span class="summary-cat archived">Archived</span><span class="summary-catnum">${archivedCount}</span></li>
      </ul>
      <div class="summary-headline completed">
        <span class="summary-num">${completedAll}</span>
        <span class="summary-label">Completed (all time)</span>
      </div>`;
  }

  /* ========================= calendar ========================= */

  /* ---------------------------------------------------------------
     Phone view and desktop view.

     One page, two shells. Phone view puts the three sections in a bar
     fixed to the bottom, promotes the garden to a section of its own
     rather than something you scroll to, and shrinks the ribbon to a
     title bar. Desktop view is the tabs-at-the-top layout with the
     garden as a column beside the tasks.

     Which one you get follows the width of the window, because that is
     what actually decides whether the layout fits - a wide window is a
     desktop whether or not Tend was opened from an installed icon. The
     setting can pin it either way. `?app=1` / `?app=0` force it, for
     looking at one from the other.
     --------------------------------------------------------------- */

  const PHONE_MAX_WIDTH = 900;
  let phoneView = false;

  function viewModePref() {
    const m = (Store.prefs() || {}).viewMode;
    return (m === 'phone' || m === 'desktop') ? m : 'auto';
  }

  function setViewMode(mode) {
    Store.prefs().viewMode = (mode === 'phone' || mode === 'desktop') ? mode : 'auto';
    Store.savePrefs();
    applyLayoutMode();
    renderViewModePicker();
  }

  function detectPhoneView() {
    try {
      if (/[?&]app=1\b/.test(location.search)) return true;
      if (/[?&]app=0\b/.test(location.search)) return false;
    } catch (e) { /* ignore */ }
    const pref = viewModePref();
    if (pref === 'phone') return true;
    if (pref === 'desktop') return false;
    return window.innerWidth <= PHONE_MAX_WIDTH;
  }

  function isAppMode() { return phoneView; }

  /* The Friends tab is new, so the bar says so until it has been opened once.
     Kept in plain localStorage rather than Store.kv on purpose: it is about
     this browser having seen the tab, not about the account, and it has no
     business riding along in the synced garden bag. */
  const FRIENDS_BADGE_KEY = 'tend:friends-badge-seen';

  function friendsBadgeSeen() {
    try { return localStorage.getItem(FRIENDS_BADGE_KEY) === '1'; } catch (e) { return false; }
  }

  function markFriendsBadgeSeen() {
    try { localStorage.setItem(FRIENDS_BADGE_KEY, '1'); } catch (e) { /* private mode */ }
    renderFriendsBadge();
  }

  function renderFriendsBadge() {
    const tag = document.getElementById('bnav-friends-new');
    if (tag) tag.hidden = friendsBadgeSeen();
  }

  function applyLayoutMode() {
    const was = phoneView;
    phoneView = detectPhoneView();
    if (phoneView) document.documentElement.setAttribute('data-mode', 'phone');
    else document.documentElement.removeAttribute('data-mode');

    /* The garden is only a section of its own in phone view, so leaving it
       has to put you somewhere that still exists. */
    if (was && !phoneView && currentView === 'garden') switchView('list');

    const label = document.getElementById('bnav-garden-label');
    if (label && hasGarden() && Garden.shortLabel) label.textContent = Garden.shortLabel();

    /* With the sections in the bottom bar the tab row is empty, so search
       moves up beside the account chip rather than sitting on a row of its
       own. Moved in the DOM rather than duplicated, so there is only ever
       one search box and one piece of state. */
    const search = document.getElementById('nav-search');
    const topRow = document.querySelector('.header-top-row');
    const tabs = document.querySelector('nav.tabs');
    const gardenBtn = document.getElementById('garden-toggle-btn');
    if (search && topRow && tabs) {
      if (phoneView) {
        if (search.parentElement !== topRow) topRow.appendChild(search);
      } else if (search.parentElement !== tabs) {
        tabs.insertBefore(search, gardenBtn);
      }
    }

    updateAppTitle(currentView);
    renderFriendsBadge();
    if (hasGarden() && Garden.applyVisibility) Garden.applyVisibility();
    /* Buttons or keys - the garden is told which set of instructions applies
       now, because the window can be dragged across the threshold at any
       moment and the pinned setting can be changed at any moment too. */
    if (hasGarden() && Garden.refreshControls) Garden.refreshControls();
    /* The garden column's width just changed, so the plot is re-fitted to it. */
    if (hasGarden() && Garden.refit) Garden.refit();
  }

  /* The window can be resized across the threshold at any moment. */
  const onResize = Util.debounce(function () {
    if (viewModePref() === 'auto') applyLayoutMode();
    /* Even when the mode has not changed, the column has a new width and the
       plot has to be rescaled to it. */
    if (hasGarden() && Garden.refit) Garden.refit();
  }, 150);

  /* In the app the heading says which section you are in; on the website it
     stays the page title it has always been. */
  function updateAppTitle(view) {
    if (!phoneView) {
      const h = document.getElementById('page-title');
      const name = Store.displayName() || 'Your';
      if (h) h.textContent = (/s$/i.test(name) ? name + "'" : name + "'s") + ' Tasks';
      return;
    }
    const h = document.getElementById('page-title');
    if (!h) return;
    if (view === 'calendar') h.textContent = 'Calendar';
    else if (view === 'overview') h.textContent = 'Overview';
    else if (view === 'friends') h.textContent = 'Friends';
    else if (view === 'garden') h.textContent = (hasGarden() && Garden.shortLabel) ? Garden.shortLabel() : 'Garden';
    else {
      const name = Store.displayName() || 'Your';
      h.textContent = (/s$/i.test(name) ? name + "'" : name + "'s") + ' Tasks';
    }
  }

  let currentView = 'list';

  function switchView(view) {
    /* The garden is only a section of its own in phone view. */
    if (view === 'garden' && !phoneView) view = 'list';
    currentView = view;

    ['list', 'calendar', 'overview', 'friends'].forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.classList.toggle('active', view === v);
      const tab = document.getElementById('tab-' + v);
      if (tab) tab.classList.toggle('active', view === v);
    });

    const layout = document.querySelector('.app-layout');
    if (layout) {
      layout.classList.toggle('view-garden', view === 'garden');
      /* The sidebar belongs to the task list; the other sections take the width. */
      layout.classList.toggle('no-sidebar', view !== 'list');
    }

    [['bnav-list', 'list'], ['bnav-calendar', 'calendar'],
     ['bnav-overview', 'overview'], ['bnav-friends', 'friends'],
     ['bnav-garden', 'garden']].forEach(([id, v]) => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.toggle('active', view === v);
    });

    /* There is nothing to search outside the task list. */
    const search = document.getElementById('nav-search');
    if (search) search.hidden = view !== 'list';

    if (view === 'calendar') renderCalendar();
    if (view === 'overview') renderOverview();
    if (view === 'friends') { markFriendsBadgeSeen(); renderFriends(); }
    else if (hasGarden() && Garden.stopPreviewLife) Garden.stopPreviewLife();
    if (view === 'garden' && hasGarden()) Garden.render();
    applyCalendarWidth();
    updateAppTitle(view);
    if (phoneView) window.scrollTo(0, 0);
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
    /* A filter that is on must not be able to hide itself. */
    if (has) wrap.classList.add('open');
    if (clear) clear.hidden = !has;
  }

  /* On a phone the search is a magnifier until you ask for it. Tapping opens
     the field; tapping again closes it, unless something is typed in. */
  function toggleSearch() {
    const wrap = document.getElementById('nav-search');
    const input = document.getElementById('search-input');
    if (!wrap || !input) return;
    if (wrap.classList.contains('open') && !input.value) {
      wrap.classList.remove('open');
      input.blur();
      return;
    }
    wrap.classList.add('open');
    input.focus();
  }

  function clearSearch() {
    const input = document.getElementById('search-input');
    const wrap = document.getElementById('nav-search');
    if (!input) return;
    input.value = '';
    syncSearchChrome();
    renderList();
    /* Emptied by hand: fold it away again rather than leaving a blank bar. */
    if (wrap) wrap.classList.remove('open');
    input.blur();
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

  /* Which dates a task is plotted on. "Due" is the one most people want -
     it answers "what is coming up" - so it and Completed are on by default and
     Created is off. Each person's choice is remembered with their preferences. */
  /* How many task rows fit in an agenda cell before it says "+n more". */
  const AGENDA_ROWS = 3;

  const CAL_SERIES = [
    { key: 'created', label: 'Created', on: false },
    { key: 'due', label: 'Due', on: true },
    { key: 'completed', label: 'Complete', on: true }
  ];

  /* 'numbers' = counts per day. 'agenda' = the tasks themselves, the way a
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
    layout.classList.toggle('cal-wide', currentView !== 'garden' && onCalendar && calView() === 'agenda');
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
      /* Normalised again here so a task with an odd date still lands on the
         right square even before the store has tidied it away. */
      const made = Util.toIsoDate(t.createdAt);
      const due = Util.toIsoDate(t.dueDate);
      const done = Util.toIsoDate(t.completedAt);
      if (made) (createdByDay[made] = createdByDay[made] || []).push(t);
      if (due) (dueByDay[due] = dueByDay[due] || []).push(t);
      if (done) (completedByDay[done] = completedByDay[done] || []).push(t);
    });
    renderCalendarLegend();
    renderCalViewToggle();
    renderWeekendToggle();
    const series = calSeries();
    const agenda = calView() === 'agenda';
    const weekends = showWeekends();

    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const today = Util.todayStr();

    const allDows = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const dows = weekends ? allDows : allDows.slice(0, 5);
    let html = dows.map(d => `<div class="dow">${d}</div>`).join('');

    /* Weeks run Monday to Sunday, so shift getDay()'s Sunday-first numbering. */
    const weekdayOf = d => (d.getDay() + 6) % 7;
    const visible = d => weekends || weekdayOf(d) < 5;
    /* One step forward or back, landing on the next day the grid actually
       shows - which skips the weekend when the weekend columns are off. */
    const step = (d, delta) => {
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
      return visible(next) ? next : step(next, delta);
    };

    /* Every row is a whole week. A month that starts mid-week borrows the days
       before it from the month before, and the same at the end, so you never
       get a half-empty row with no idea what belongs in the gap. */
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(calYear, calMonth, d);
      if (visible(date)) days.push({ date: date, outside: false });
    }
    if (days.length) {
      let cursor = days[0].date;
      for (let i = weekdayOf(cursor); i > 0; i--) {
        cursor = step(cursor, -1);
        days.unshift({ date: cursor, outside: true });
      }
      cursor = days[days.length - 1].date;
      for (let i = weekdayOf(cursor); i < dows.length - 1; i++) {
        cursor = step(cursor, 1);
        days.push({ date: cursor, outside: true });
      }
    }

    for (const cell of days) {
      const date = cell.date;
      const day = date.getDate();
      const iso = Util.dateToStr(date);
      const isToday = iso === today;
      const madeCount = series.created ? (createdByDay[iso] || []).length : 0;
      const doneCount = series.completed ? (completedByDay[iso] || []).length : 0;

      /* Only work still outstanding counts as due - a task you have finished
         is not due any more, and it already shows under Completed on the day you
         did it. Clicking the day still lists the finished ones, marked done. */
      const dueList = series.due
        ? (dueByDay[iso] || []).filter(t => !t.completedAt && !t.archived)
        : [];

      /* A due date that has passed with work still on it is worth shouting about. */
      const overdue = iso < today && dueList.length > 0;

      let countsHtml;

      if (agenda) {
        /* One row per task, like a wall calendar. Only so many fit in a cell
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

      html += `<div class="cal-cell ${isToday ? 'today' : ''} ${cell.outside ? 'outside' : ''}" onclick="App.showDayModal('${iso}')">
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
      /* Same rule as the square: archived work is set aside, so it is not due. */
      { title: 'Due', list: series.due ? (dueByDay[iso] || []).filter(t => !t.archived) : [] },
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
      rows.push(detailRow('Category', categoryPill(t.category, categoryColor(t.category))));
    }
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
        <button class="detail-edit-btn" onclick="App.closeModal(); App.openEditModal('${t.id}')">Edit task</button>
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
    snapshot('editing "' + t.title + '"');

    const sel = document.getElementById('edit-task-category');
    const category = sel.value === 'other' ? document.getElementById('edit-task-category-other').value.trim() : sel.value;

    if (sel.value === 'other' && category) {
      addCategory(category);
      renderCategoryKey();
      populateCategorySelects();
    }

    t.title = title;
    t.notes = document.getElementById('edit-task-notes').value.trim();
    t.category = category;
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

  /* The line under the name is the day's fun fact.

     It briefly carried the live counts instead - overdue, due today, open,
     coins - and they were accurate and useful and nobody was ever pleased to
     see them. The counts that actually matter have their own homes: Due today
     is a card of its own and the coins sit on the garden. This is the one line
     on the page that is not about work, so it gets to not be about work.

     Facts.today() picks by the day of the year in the reader's own timezone, so
     it turns over at their midnight and everybody signed in gets the same one
     on the same date - which is the point of it. */
  function renderHeaderSubtitle() {
    const el = document.getElementById('page-subtitle');
    if (!el) return;
    if (typeof Facts === 'undefined' || !Facts.today) {
      el.textContent = 'Every task you finish earns a coin. Coins buy plants for the garden.';
      return;
    }
    el.innerHTML = '<span class="fact-label">Fun fact</span>'
      + '<span class="fact-text">' + Util.escapeHtml(Facts.today()) + '</span>';
  }

  function renderHeader() {
    const name = Store.displayName() || 'Your';
    const possessive = /s$/i.test(name) ? name + "'" : name + "'s";
    document.getElementById('page-title').textContent = `${possessive} Tasks`;
    document.title = `${possessive} Tasks · ${(Store.config.APP_NAME || 'Tend')}`;
    renderHeaderSubtitle();

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
      <button class="acct-item" onclick="App.openUpdates()">What&#39;s new</button>
      <button class="acct-item" onclick="App.openSettings()">Settings &amp; backup</button>
      <button class="acct-item" onclick="App.exportBackup()">Export a backup</button>
      ${repoLinkHTML()}
      ${isCloud
        ? '<button class="acct-item danger" onclick="App.signOut()">Sign out</button>'
        : '<button class="acct-item" onclick="App.switchProfile()">Switch profile</button>'}`;
  }

  /* Opens a pre-filled issue on the project's GitHub repo, if one is configured.
     This is feedback about Tend itself - it is public, so it is deliberately
     separate from your own tasks. */
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

  /* ---------------------------------------------------------------
     What's new.

     Plain-language, newest first. One line each - enough to recognise
     a change you noticed, not a technical log.
     --------------------------------------------------------------- */

  const UPDATES = [
    { date: '2026-09-05', items: [
      'Due today and + New Task now sit in the top corner of every page, so they are there whatever the window is doing. The sidebar they used to live in is gone, and the tasks and the calendar have its width.',
      'You can walk over the plants you buy - and only those. Trees, saplings, beds of scenery, tables and a finished cabin stop you again.',
    ] },
    { date: '2026-09-04', items: [
      'You can now walk over your own plants.',
      'Press E on whatever you are standing on, or whatever you are facing. Walking onto a plant still waters it, and putting something down uses the square under your feet unless it is taken.',
      'The garden never scrolls sideways now. It scales down to fit whatever room it has, so the whole plot is always on screen at once.',
      'The Friends tab only lists people who have actually planted something.',
      "Butterflies now appear the moment you open a friend's garden, already on the plot, instead of drifting in from off the edge half a minute later. Any garden with a plant in it gets at least one - fish, in the reef.",
      'Every cabin you finish building raises what a task is worth. No cabins pays 1 coin, one pays 2, two pay 3, and so on. The shop shows your current rate.',
      'The rate is fixed at the moment you tick a task, so finishing a cabin does not reprice work you have already done - and un-ticking an old task refunds exactly what it paid, not what it would pay today.',
      'The Priority + category view has been removed. Starred tasks still rise to the top of their own category.',
      'Adding a category now offers a row of suggested colours to click, instead of a colour picker with sixteen million options in it. Colours already taken by another category are dimmed.',
      'There is a fun fact at the top of the page now, a different one every day, on a loop of 365. Every one of them is about animals, plants or the ocean. It replaces the counts that were there - Due today has its own card and the coins sit on the garden.',
      'Categories no longer line up in rows. A short category now starts right under the one above it instead of waiting for the tall one beside it to finish, so there are no more empty gaps down the page.',
      'Deleting a category no longer leaves its tasks carrying a name that no longer exists - they move to Other, and the message says how many did. Undo puts the category back with its tasks in it.',
      'Fixed: signing in on a new device while the connection was down could quietly overwrite which world you are in, turning a reef into a garden - for you and for everyone looking at you in Friends.',
      'Each row in Friends now says whether that person is in a Garden or an Ocean.',
      'The category picker is colour-coded: every category shows its own colour in the list, and the box wears the colour of whatever you have chosen.',
      'A new By date view groups your tasks into Overdue, Today, Tomorrow, Rest of this week, Later and No date.',
      'Task rows are tidier: the checkbox and the star stay put, and Edit, Archive and Delete moved behind the \u22ef button - so Delete is no longer sitting next to Edit under your thumb.',
      'Deleting no longer asks "are you sure". It just deletes, and the message that appears has an Undo button in it. Ctrl+Z still works too.',
      'Finishing a task now sends a coin flying from the checkbox to your coin counter, and tells you what it is worth.',
      'The line under your name is live now: overdue, due today, still open and coins in hand.',
      'A brand new account starts with two tasks that show you how the whole thing works, rather than an empty list.',
      'The part of the garden you have not unlocked yet is now a strip at the bottom rather than a whole empty panel, so the garden takes up less of the page.',
      'On a phone the Pick up and Put down buttons now sit in a bar under the garden rather than down its side, so the garden gets its full width back. The bar floats just above the tabs so it is always in reach.',
      'The Garden now sits in the middle of the bottom bar as a raised round button, since it is the reason most people open Tend.',
      'Friends is marked New in the bottom bar until you have opened it once.',
      'A Holding box beside the plot now shows what the gardener is carrying, by name - a Sapling, a Hoe, a Rose - so you are never guessing.',
      'On a phone there are now Pick up and Put down buttons next to the garden. Whichever one is not what would happen next is greyed out, and it says Use it rather than Put down when you are holding a tool.',
      'The instructions now match the thing you are actually using: a phone is told about tapping and the buttons, a computer is told about W A S D and E. Neither is told about the other.',
      'On a phone the garden now slides sideways to keep the gardener on screen, so the buttons do not cost you the right-hand column.',
      'Fifty plants to find in each world. The nineteen you picked have been added to the end of the list, so nothing already growing has changed into something else.',
      "A friend's garden now opens straight under their name rather than at the foot of the page, and clicking the name again folds it away.",
      'Every row says how many plants that gardener has, and how many kinds they have found out of fifty.',
      "You now see their gardener too, wearing whatever outfit they have bought and put on - and they stroll about, along with their animals and their butterflies (fish, in the reef).",
      'Butterflies now wander the garden in every direction and hang about over the flowers, instead of crossing in a straight line from the left.',
      'There are more of them the more you have planted, and none at all on an empty plot.',
      'Picking a plant up no longer sends the butterflies back to the edge and starts them over.',
      'Words in the thought bubble now read left to right whichever way the gardener is facing.',
      'The first garden now has four beds running down it - X Y X Y Y X Y X across. Your plants stay exactly where they are.',
      'Buying a seedling with no room left no longer takes the coin and loses the plant: the shop says there is no room and the button switches off.',
      'A new seedling can no longer arrive on top of a log, a sapling, a bowl of food or you.',
      'Press E now picks up whatever you are facing, rather than whatever happens to be above you.',
      'Walking a long route no longer waters every plant it squeezes past - only the one you walked up to.',
      'Seedlings are much smaller now: a stem and two leaves, so they no longer look like a grown plant.',
      'Fewer butterflies - one to three - and they stay around the flowers instead of crossing the whole garden.',
      'The shop now says what each tool is for. The hose and the bucket are ornaments; watering needs no tool at all.',
      'Twice as many plants to find - 44 varieties instead of 22, in both the garden and the reef. Everything already planted stays exactly what it was.',
      'The sapling has moved into the Plants part of the shop, where it belongs.',
      'The butterflies fly a good deal more slowly.',
      'Purchases can no longer be forgotten. Anything you have bought - the magnifying glass, your tools, your land - now survives an update, a second device, and a save that did not get through.',
      'The hose and the bucket have left the shop. They never did anything. Any you already own stay where they are.',
      'The shop is back to plain names and prices - the help buttons still explain everything.',
      'Thirteen plants have been retired from both worlds, leaving 31 in each. Everything already growing keeps the plant it was; the few that were one of the retired kinds have become something else.',
      'Butterflies now arrive as the garden fills: one past five plants, two past ten, three past fifteen.',
      'The garden reset has been taken out of the shop.',
      'The task list has a By category button now, next to By status. It remembers which you last used.',
      'Tasks by category on the Overview page is tidier: categories you have nothing in are no longer listed, starred tasks come first, and due dates sit on the right.',
      'By category lays the groups out side by side on a wide screen, the way Priority and Active do - three columns across with the garden hidden.',
      'Drag your categories into the order you want them on the Overview page - grab the handle to the left of one. That order is used everywhere: both category views and the dropdown when you add a task.',
      'Fixed: in the category view, Steps would not open and the row would not expand.',
      'By category is now what the task list opens on.',
      'A third view, Priority + category: everything you have starred sits in its own block across the top, and the categories follow underneath without it.',
      'Fixed: the mouse pointer turning white and disappearing over the dark header, and over selected text.',
      'Watering works properly again. It counts every six seconds rather than once a minute, and each watering says how far along the seedling is - "Watered 3 of 5".',
      'A grown plant can no longer turn back into a seedling when another device syncs. Watering only ever counts up now, whichever device did it.',
      'Picking a plant up no longer risks losing it. Carry one while the app updates or syncs and it goes back where it was instead of vanishing.',
      'The magnifying glass names plants and nothing else now - no more Flower bed, Lawnmower or Dug soil.',
      'The pale open-hand cursor is gone from the category handles and the task rows; dragging still works.',
      'The garden now counts the kinds you have found - "Found 5 of 31 plants" beside the gardener, and in the shop. Growing a seedling is what reveals a kind, and once found it stays found even if you cash the plant in.',
      'Finishing a task now makes a cash-register sound, to go with the coin.',
      'Undo. There is a button next to Hide Garden, and Ctrl+Z works too. It takes back the last change to your tasks or categories - ticking, deleting, editing, reordering, the lot.',
      'A Friends tab: everyone with an account, how many plants they have and how many kinds they have found. Click a name to look around their garden. Tasks stay private - only the garden is shared.',
      'Fixed: clicking a friend made the list flicker and the garden jump down the page.',
      'A friend\u2019s garden now looks like a real garden: the same ground textures, fences and walls, plants swaying in their pots, their animals wandering about and butterflies over their flowers.'
    ]},
    { date: '2026-09-03', items: [
      'On a phone, the gardener now walks in two straight legs - one direction then the other - instead of cutting a diagonal, following the way you dragged.'
    ]},
    { date: '2026-09-02', items: [
      'Coins are now worked out from your finished tasks and what you have spent, so an update can no longer lose them.',
      'The worn path through the garden has been taken out.',
      'The shovel is a shovel again, not a donkey.',
      'Only the magnifying glass names things - nothing else pops a thought bubble.'
    ]},
    { date: '2026-09-01', items: [
      'Fixed the watering sparkle not appearing.',
      'Drag from the gardener on a phone and they walk to where you let go.',
      'The garden has grass tufts, pebbles and proper edging between sections.',
      'Plants sway, and two of the same kind no longer look identical.',
      'A seedling starts to look like its plant halfway through watering.',
      'Butterflies drift across, more of them the fuller the garden.',
      'Ground you have not bought yet looks like open country rather than a fault.'
    ]},
    { date: '2026-08-31', items: [
      'Overview and Categories moved to their own section, with every task listed under its category.',
      'Work is now added to accounts that were made before it existed.',
      'The calendar shows whole weeks - the days either side of the month are there, greyed out.',
      'Fixed the garden sitting off to the right on a phone.',
      'The app now notices a new version when you open it, and updates itself.',
      'New seedlings always arrive in a pot - you choose where to plant them.',
      'More garden is bought with 10 coins at the gate, instead of unlocking every 10 tasks.',
      'Cash a plant back in - a seedling is worth 1 coin, a grown one 2.',
      'Buying more garden asks you to confirm first.'
    ]},
    { date: '2026-08-30', items: [
      'Everything now says "task" instead of "ticket".',
      'Added Work as a starting category.',
      'Removed the "Where did it come up?" box and the follow-up tickbox.',
      'Choose the phone or desktop layout yourself in Settings, or leave it to pick.',
      'Plants now arrive as seedlings and grow when watered in the ground.',
      'This list.'
    ]},
    { date: '2026-08-29', items: [
      'Added an app layout for phones, with Tasks, Calendar and Garden along the bottom.',
      'Fixed tasks with odd dates never appearing on the calendar.',
      'The search box is a magnifier on phones, out of the way until you need it.',
      'Categories are coloured bubbles rather than highlighter marks.',
      'Eight header colours to choose from; Forest is the new default.',
      'Coins are gold and carry the Tend leaf.',
      'The home-screen icon is drawn from the real logo instead of a rough copy.'
    ]},
    { date: '2026-08-28', items: [
      'Your phone and laptop now update each other within a second or two.',
      'Fixed the starting categories appearing three times.',
      'Fixed the app opening zoomed in on an iPhone.',
      'Tap a square to walk there, or swipe, when you are on a phone.',
      'A QR code in the account menu for getting Tend onto a phone.',
      'One food for every animal instead of one per species.',
      'A magnifying glass in the shop names whatever you walk up to.',
      'Hide the weekend on the calendar.',
      'Created dates moved off the task rows - tap a task to see them.'
    ]},
    { date: '2026-08-27', items: [
      'Checklists inside a task.',
      'Tend can be installed on a phone and works with no signal.',
      'Calendar list view, and a button for what is due today.',
      'Weeks start on Monday.'
    ]},
    { date: '2026-08-26', items: [
      'Finishing a task earns a gold coin; coins buy plants.',
      'Pick a garden or an ocean, and a male or female character.',
      'Tasks show on the calendar by their due date.'
    ]}
  ];

  function renderUpdates() {
    const host = document.getElementById('updates-list');
    if (!host) return;
    host.innerHTML = UPDATES.map(u => `
      <div class="update-block">
        <div class="update-date">${Util.formatDate(u.date)}</div>
        <ul class="update-items">${u.items.map(i => `<li>${Util.escapeHtml(i)}</li>`).join('')}</ul>
      </div>`).join('');
  }

  function openUpdates() {
    document.getElementById('account-dropdown').hidden = true;
    setSettingsTitle("What's new");
    document.getElementById('settings-body').innerHTML = `
      <div class="settings-section">
        <p>The short version of what has changed, newest first.</p>
        <div class="settings-row">
          <button class="settings-btn" onclick="App.checkForUpdate()">Check for an update</button>
        </div>
        <div class="settings-note" id="update-check-note"></div>
      </div>

      <div class="settings-section">
        <div id="updates-list"></div>
      </div>`;
    renderUpdates();
    document.getElementById('settings-modal-backdrop').classList.add('active');
  }

  /* Installed on a home screen, Tend is resumed rather than reloaded, so it can
     sit on an old version. This asks outright. */
  async function checkForUpdate() {
    const note = document.getElementById('update-check-note');
    const say = t => { if (note) note.textContent = t; };
    say('Checking\u2026');
    try {
      if (window.TEND_SW && typeof window.TEND_SW.update === 'function') {
        await window.TEND_SW.update();
        /* If there was one, the new worker takes over and boot.js reloads the
           page from under us. If we are still here a moment later, there was
           not - but a plain reload costs nothing and settles any doubt. */
        setTimeout(function () {
          say('Up to date. Reloading to be sure\u2026');
          setTimeout(function () { location.reload(); }, 600);
        }, 1200);
      } else {
        say('Reloading\u2026');
        setTimeout(function () { location.reload(); }, 500);
      }
    } catch (e) {
      say('Could not check just now - are you online?');
    }
  }

  const VIEW_MODES = [
    { id: 'auto',    name: 'Automatic', hint: 'Phone layout on a small screen, desktop on a big one.' },
    { id: 'phone',   name: 'Phone',     hint: 'Always the bottom bar, whatever the screen.' },
    { id: 'desktop', name: 'Desktop',   hint: 'Always tabs at the top and the garden beside your tasks.' }
  ];

  function renderViewModePicker() {
    const host = document.getElementById('viewmode-picker');
    if (!host) return;
    const current = viewModePref();
    host.innerHTML = `<div class="mode-list">${VIEW_MODES.map(m => `
      <button type="button" class="mode-tile ${m.id === current ? 'on' : ''}" onclick="App.setViewMode('${m.id}')">
        <span class="mode-name">${Util.escapeHtml(m.name)}</span>
        <span class="mode-hint">${Util.escapeHtml(m.hint)}</span>
      </button>`).join('')}</div>
      <div class="settings-note">Showing the <strong>${phoneView ? 'phone' : 'desktop'}</strong> layout now.</div>`;
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
        <h4>Layout</h4>
        <p>Tend has two layouts: a phone one with the sections along the bottom, and a desktop one with tabs at the top and the garden beside your tasks.</p>
        <div id="viewmode-picker"></div>
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
          ? 'Cloud mode. Your tasks and garden are stored in your account and sync to any device you sign in on. A copy is kept in this browser so the app keeps working offline.'
          : 'Local mode. Everything is stored in this browser only. Export a backup if you want to keep it safe or move it to another device.'}</p>
        <div class="settings-row">
          <button class="settings-btn" onclick="App.exportBackup()">Export backup (.json)</button>
          <button class="settings-btn" onclick="document.getElementById('import-file').click()">Import backup</button>
          ${isCloud ? '<button class="settings-btn" onclick="App.forcePull()">Refresh from server</button>' : ''}
        </div>
        <div class="settings-note" id="settings-data-note"></div>
      </div>

      <div class="settings-section">
        <h4>What&#39;s new</h4>
        <p>A short list of what has changed in Tend, newest first.</p>
        <div class="settings-row">
          <button class="settings-btn" onclick="App.openUpdates()">See the updates</button>
        </div>
      </div>

      <div class="settings-section">
        <h4>Danger zone</h4>
        <p>Deletes every task, category and garden change on this account. There is no undo, so export a backup first.</p>
        <div class="settings-row">
          <button class="settings-btn danger" onclick="App.eraseEverything()">Erase all my data</button>
        </div>
      </div>`;
    renderWorldSettings();
    renderThemePicker();
    renderViewModePicker();
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
    applyLayoutMode();
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
        if (!confirm(`Import ${count} task${count === 1 ? '' : 's'}? This replaces everything currently in "${Store.displayName()}".`)) return;
        Store.importData(data);
        loadViewPrefs();
        renderAll();
        Garden.loadAll();
        Garden.render();
        if (note) { note.className = 'settings-note ok'; note.textContent = `Imported ${count} tasks.`; }
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
    if (!confirm('Erase every task, category and garden change on this account?')) return;
    if (!confirm('Really erase everything? This cannot be undone.')) return;
    Store.eraseAccountData();
    loadViewPrefs();
    renderAll();
    Garden.loadAll();
    Garden.render();
    closeSettings();
  }

  /* ---------------------------------------------------------------
     Friends.

     Everybody with an account, their garden and how much is in it.
     The list comes from `public.gardens`, a read-only view holding a
     name, a world and a plot - and nothing else, so nobody's tasks,
     notes or email are anywhere near it. Until supabase/gardens.sql has
     been run the view does not exist, and the tab says so plainly
     rather than looking broken.
     --------------------------------------------------------------- */

  let friendsCache = [];
  let openFriendId = null;

  function friendInitials(name) {
    return (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
  }

  function plantsIn(layout) {
    return Object.keys(layout || {}).filter(id => layout[id] && !layout[id].held).length;
  }

  /* Fetching and painting are separate on purpose. Clicking a name only needs
     a repaint - to move the highlight - and going back to the server for that
     replaced the list with "Looking for gardens..." for a moment, which
     collapsed its height and threw the garden panel up the page and back down
     again as the rows returned. */
  async function renderFriends() {
    const host = document.getElementById('friends-list');
    if (!host) return;
    /* Only say so when there is nothing to show yet; a refresh over an already
       painted list happens in place. */
    if (!friendsCache.length) host.innerHTML = '<p class="cat-empty">Looking for gardens&hellip;</p>';

    let list;
    try {
      list = await Store.listGardens();
    } catch (err) {
      if (!friendsCache.length) {
        host.innerHTML = '<p class="cat-empty">Could not load the other gardens.'
          + ' If this is a new install, the one-off <code>supabase/gardens.sql</code> still needs running.</p>';
      }
      return;
    }

    friendsCache = list || [];
    paintFriends();
  }

  function paintFriends() {
    const host = document.getElementById('friends-list');
    if (!host) return;

    if (!friendsCache.length) {
      host.innerHTML = '<p class="cat-empty">Nobody else has a garden yet.</p>';
      return;
    }

    /* Only gardens with something in them. An account that has signed up and
       not planted anything is a row with nothing to look at, and the tab is for
       looking at gardens. */
    const growing = friendsCache.filter(f => plantsIn(f.layout) > 0);
    if (!growing.length) {
      host.innerHTML = '<p class="cat-empty">Nobody has planted anything yet.</p>';
      if (hasGarden() && Garden.stopPreviewLife) Garden.stopPreviewLife();
      return;
    }

    /* Biggest gardens first - it is a list you scroll to compare. */
    const sorted = growing.slice().sort((a, b) => plantsIn(b.layout) - plantsIn(a.layout));

    host.innerHTML = `<div class="friend-list">${sorted.map(f => {
      const plants = plantsIn(f.layout);
      const found = Array.isArray(f.found) ? f.found.length : 0;
      const open = openFriendId === f.id;
      /* Which world they are in, on the row. It reads as a nice touch and it is
         one - but it is here because a reef that draws as a garden and a reef
         that is recorded as a garden look identical until something says which
         the server actually thinks it is. */
      const theirWorld = Worlds.get(f.world);
      const worldTag = `<span class="friend-world ${theirWorld.id}">${Util.escapeHtml(theirWorld.label)}</span>`;
      return `<div class="friend-item ${open ? 'open' : ''}">
          <button type="button" class="friend-row ${open ? 'on' : ''}" onclick="App.openFriendGarden('${f.id}')">
            <span class="friend-avatar">${Util.escapeHtml(friendInitials(f.name))}</span>
            <span class="friend-name">${Util.escapeHtml(f.name)}${f.isMe ? ' <span class="friend-you">you</span>' : ''}</span>
            ${worldTag}
            <span class="friend-counts">
              <b>${plants}</b> ${plants === 1 ? 'plant' : 'plants'}
              <span class="friend-kinds">&middot; ${found} of ${theirWorld.plants.length} kinds</span>
            </span>
          </button>
          ${open ? friendGardenHtml(f) : ''}
        </div>`;
    }).join('')}</div>`;

    /* The plot only exists once it has been painted, so its butterflies, fish,
       animals and gardener are started here rather than in the click. */
    if (!openFriendId) {
      if (hasGarden() && Garden.stopPreviewLife) Garden.stopPreviewLife();
      return;
    }
    const openF = friendsCache.find(x => x.id === openFriendId);
    const plotHost = host.querySelector('.friend-garden-plot');
    if (openF && plotHost && hasGarden() && Garden.startPreviewLife) Garden.startPreviewLife(plotHost, openF);
  }

  /* The garden itself, folded in under the row it belongs to. */
  function friendGardenHtml(f) {
    const plants = plantsIn(f.layout);
    const found = Array.isArray(f.found) ? f.found.length : 0;
    const world = Worlds.get(f.world);
    const title = (/s$/i.test(f.name) ? f.name + "'" : f.name + "'s")
      + ' ' + world.terms.place.replace(/^the\s+/i, '');
    const sub = `${plants} ${plants === 1 ? world.terms.plant : world.terms.plants}`
      + ` \u00b7 found ${found} of ${world.plants.length} kinds`;
    return `<div class="friend-garden-inline">
        <div class="friend-garden-head">
          <h2>${Util.escapeHtml(title)}</h2>
          <button type="button" class="section-toggle-btn" onclick="event.stopPropagation(); App.closeFriendGarden()">Close</button>
        </div>
        <p class="friend-garden-sub">${Util.escapeHtml(sub)}</p>
        <div class="friend-garden-plot">${hasGarden() ? Garden.previewPlotHTML(f) : ''}</div>
      </div>`;
  }

  /* Clicking a name opens it in place; clicking it again folds it away. */
  function openFriendGarden(id) {
    const f = friendsCache.find(x => x.id === id);
    if (!f) return;
    if (hasGarden() && Garden.stopPreviewLife) Garden.stopPreviewLife();
    openFriendId = (openFriendId === id) ? null : id;
    paintFriends();
    if (!openFriendId) return;

    /* Only scroll if the row it opened under is off-screen - the garden appears
       right where you clicked, so usually there is nothing to scroll to. */
    const host = document.getElementById('friends-list');
    const item = host && host.querySelector('.friend-item.open');
    if (!item) return;
    const box = item.getBoundingClientRect();
    if (box.top < 0 || box.top > window.innerHeight - 80) {
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function closeFriendGarden() {
    openFriendId = null;
    if (hasGarden() && Garden.stopPreviewLife) Garden.stopPreviewLife();
    paintFriends();
  }

  /* ========================= boot ========================= */

  function renderAll() {
    renderUndoButton();
    renderDueToday();
    renderCategoryKey();
    populateCategorySelects();
    renderList();
    initDragAndDrop();
    renderCalendar();
    renderStats();
    renderByCategory();
    Garden.render();
    /* Cheap, and it means a page left open overnight picks up the new day's
       fact the first time anything is touched. */
    renderHeaderSubtitle();
  }

  function renderOverview() {
    renderStats();
    renderCategoryKey();
    renderByCategory();
  }

  /* ---------------------------------------------------------------
     Tasks grouped by category.

     Every category gets a row, even an empty one, so the page doubles
     as an answer to "what have I got on for the house?" and to "which
     of these categories am I actually using?".
     --------------------------------------------------------------- */

  function categoryScope() {
    return Store.prefs().catScope === 'all' ? 'all' : 'open';
  }

  function setCategoryScope(scope) {
    Store.prefs().catScope = scope === 'all' ? 'all' : 'open';
    Store.savePrefs();
    renderByCategory();
  }

  function renderCategoryScopeToggle() {
    const host = document.getElementById('cat-scope-toggle');
    if (!host) return;
    const scope = categoryScope();
    host.innerHTML = [['open', 'Still to do'], ['all', 'Everything']].map(([key, label]) =>
      `<button type="button" class="${scope === key ? 'on' : ''}" onclick="App.setCategoryScope('${key}')">${label}</button>`
    ).join('');
  }

  function renderByCategory() {
    const host = document.getElementById('by-category');
    if (!host) return;
    renderCategoryScopeToggle();

    const scope = categoryScope();
    const live = tickets().filter(t => !t.archived);
    const shown = scope === 'all' ? live : live.filter(t => !t.completedAt);
    const groups = groupByCategory(shown);

    if (!groups.length) {
      host.innerHTML = `<p class="cat-empty">${
        scope === 'all' ? 'No tasks yet.' : 'Nothing left to do - the lot is finished.'}</p>`;
      return;
    }

    host.innerHTML = groups.map(g => {
      const sorted = g.list.slice().sort((a, b) => {
        if (!!a.completedAt !== !!b.completedAt) return a.completedAt ? 1 : -1;
        if (!!a.priority !== !!b.priority) return a.priority ? -1 : 1;
        return 0;
      });

      const items = sorted.map(t => {
        const overdue = !t.completedAt && t.dueDate && t.dueDate < Util.todayStr();
        const due = t.dueDate
          ? `<span class="cat-task-due ${overdue ? 'overdue' : ''}">${Util.formatDate(t.dueDate)}</span>` : '';
        const star = t.priority && !t.completedAt ? '<span class="cat-task-star">&#9733;</span>' : '';
        return `<li class="cat-task ${t.completedAt ? 'done' : ''}" onclick="App.showTaskDetail('${t.id}')">
            ${star}<span class="cat-task-title">${Util.escapeHtml(t.title)}</span>${due}
          </li>`;
      }).join('');

      return `<section class="cat-group" style="--cat-color:${g.color}">
          <div class="cat-group-head">${categoryPill(g.name, g.color)}</div>
          <ul class="cat-tasks">${items}</ul>
        </section>`;
    }).join('');
  }

  /* A brief note when something arrives from another device, so the screen
     changing under you is explained rather than startling. The header badge is
     hidden on a phone, which is exactly where this matters most. */
  let syncedFlashTimer = null;
  function showToast(text) {
    let el = document.getElementById('sync-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sync-toast';
      el.className = 'sync-toast';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('show');
    if (syncedFlashTimer) clearTimeout(syncedFlashTimer);
    syncedFlashTimer = setTimeout(function () {
      el.classList.remove('show');
      syncedFlashTimer = null;
    }, 2200);
  }

  /* The same toast, with the way back in it. Ctrl+Z already did this; the
     button is for the hand that is nowhere near a keyboard. */
  function showUndoToast(text) {
    let el = document.getElementById('sync-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sync-toast';
      el.className = 'sync-toast';
      document.body.appendChild(el);
    }
    el.innerHTML = '<span>' + Util.escapeHtml(text) + '</span>'
      + '<button type="button" class="toast-undo" onclick="App.undoLast()">Undo</button>';
    el.classList.add('show');
    if (syncedFlashTimer) clearTimeout(syncedFlashTimer);
    syncedFlashTimer = setTimeout(function () {
      el.classList.remove('show');
      syncedFlashTimer = null;
    }, 5000);
  }

  function flashSynced() { showToast('Updated from your other device'); }

  /* A new account used to open on an empty list, a locked garden and three
     bullet points about which keys to press. Two tasks demonstrate the whole
     loop in about ten seconds instead - and the first one is the demonstration.

     The flag is per account and lives in this browser: it is "has this person
     been shown the starter tasks", not part of their data, and it must not come
     back from the cloud and re-seed a list they have deliberately emptied. */
  function seedFirstRun() {
    const id = Store.accountId();
    if (!id) return;
    const key = 'tend:seeded:' + id;
    try { if (localStorage.getItem(key) === '1') return; } catch (e) { return; }
    /* Only ever on a genuinely empty list - never over an account whose tasks
       simply have not synced down yet on a fresh device. */
    if (tickets().length) {
      try { localStorage.setItem(key, '1'); } catch (e) { /* private mode */ }
      return;
    }

    const today = Util.todayStr();
    const starters = [
      { title: 'Tick this box to earn your first coin',
        notes: 'Every task you finish pays one coin. Coins buy plants in the shop below the garden.' },
      { title: 'Spend that coin on a seedling, then water it',
        notes: 'Walk into a seedling five times to grow it. Grown plants can be cashed in for more coins.' }
    ];
    starters.reverse().forEach(st => tickets().unshift({
      id: Util.uid(),
      title: st.title,
      notes: st.notes,
      category: '',
      priority: false,
      archived: false,
      dueDate: null,
      createdAt: today,
      completedAt: null,
      subtasks: []
    }));
    try { localStorage.setItem(key, '1'); } catch (e) { /* private mode */ }
    Store.saveTickets();
  }

  function boot() {
    loadViewPrefs();
    applyTheme();
    applyLayoutMode();

    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();

    renderHeader();
    Garden.loadAll();   /* hydrate the garden before anything renders or saves it */
    seedFirstRun();
    renderAll();
    Garden.start();
    switchView(currentView);   /* sets the bar, the sections and the widths */

    if (!booted) {
      booted = true;
      Store.onStatus(renderSyncBadge);
      primeDownloadBridge();

      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', onResize);

      /* The row menu closes the way every menu should: click anywhere else, or
         press Escape. Scrolling closes it too - it is anchored to a row that
         moves. */
      document.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('.row-menu-wrap')) return;
        closeRowMenu();
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeRowMenu(); });
      window.addEventListener('scroll', closeRowMenu, true);

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

      /* Ctrl+Z anywhere except inside something you are typing in, where the
         browser's own undo is the one you want. */
      document.addEventListener('keydown', function (e) {
        if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
        const el = e.target;
        if (el && (el.matches('input, textarea, select') || el.isContentEditable)) return;
        e.preventDefault();
        undoLast();
      });

      document.getElementById('new-task-input').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
      document.getElementById('search-input').addEventListener('input', function () {
        syncSearchChrome();
        renderList();
      });
      document.getElementById('search-input').addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.stopPropagation(); clearSearch(); }
      });
      /* Tapping away from an empty box folds it back to the magnifier. */
      document.getElementById('search-input').addEventListener('blur', function () {
        const wrap = document.getElementById('nav-search');
        if (wrap && !this.value) wrap.classList.remove('open');
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
    toggleRowMenu, rowMenuAction,
    openNewTaskModal, closeNewTaskModal, closeNewTaskModalOnBackdrop,
    taskRowClick,
    openEditModal, saveEditedTask, closeEditModal, closeEditModalOnBackdrop,
    onCategoryChange, onEditCategoryChange,
    submitAddCategory, removeCategoryByIndex,
    toggleSubtask, toggleSubtaskList, editorAdd, editorRemove, editorRename, editorToggle,
    switchView, changeMonth, goToday, showDayModal, showTaskDetail, toggleCalSeries,
    setCalView, toggleWeekends, showDueToday,
    openInstall, copyInstallLink, runInstallPrompt, openUpdates, checkForUpdate,
    clearSearch, toggleSearch, setTheme, isAppMode, setViewMode, setCategoryScope,
    setListGrouping, undoLast, pickCategoryColor,
    renderFriends, openFriendGarden, closeFriendGarden,
    closeModal, closeModalOnBackdrop,
    toggleShowCompleted, toggleShowArchived,
    toggleAccountMenu, openSettings, closeSettings, closeSettingsOnBackdrop, setWorld,
    saveDisplayName, exportBackup, forcePull, eraseEverything,
    setDigest, setDigestHour,
    signOut, switchProfile
  };
})();
