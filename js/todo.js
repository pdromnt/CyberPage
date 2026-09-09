(function () {
  'use strict';

  const MAX_TODOS = 50;
  const MAX_TEXT_LENGTH = 160;
  const widget = document.querySelector('#todo-widget');
  const form = document.querySelector('#todo-form');
  const input = document.querySelector('#todo-input');
  const list = document.querySelector('#todo-list');
  const count = document.querySelector('#todo-count');
  let todos = [];

  async function load() {
    const [settings, saved] = await Promise.all([
      chrome.storage.sync.get({ todo: { show: true } }),
      chrome.storage.local.get({ todos: [] })
    ]);
    setVisibility(settings.todo?.show !== false);
    todos = normalizeTodos(saved.todos);
    render();
  }

  function setVisibility(show) {
    widget.hidden = !show;
  }

  function normalizeTodos(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, MAX_TODOS).map((todo, index) => ({
      id: typeof todo?.id === 'string' ? todo.id : `legacy-${index}`,
      text: typeof todo?.text === 'string' ? todo.text.slice(0, MAX_TEXT_LENGTH) : '',
      done: !!todo?.done
    })).filter(todo => todo.text.trim());
  }

  function render() {
    list.replaceChildren();
    count.textContent = `${todos.length}/${MAX_TODOS}`;

    if (!todos.length) {
      const empty = document.createElement('div');
      empty.className = 'todo-empty';
      empty.textContent = 'QUEUE EMPTY';
      list.appendChild(empty);
      return;
    }

    todos.forEach(todo => {
      const row = document.createElement('div');
      row.className = 'todo-item';
      if (todo.done) row.classList.add('done');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = todo.done;
      checkbox.setAttribute('aria-label', `Mark ${todo.text} as ${todo.done ? 'active' : 'complete'}`);
      checkbox.addEventListener('change', () => updateTodo(todo.id, { done: checkbox.checked }));

      const text = document.createElement('span');
      text.className = 'todo-text';
      text.textContent = todo.text;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'todo-remove';
      remove.setAttribute('aria-label', `Delete ${todo.text}`);
      remove.title = 'Delete task';
      const icon = document.createElement('span');
      icon.className = 'lni lni-trash-can';
      icon.setAttribute('aria-hidden', 'true');
      remove.appendChild(icon);
      remove.addEventListener('click', () => deleteTodo(todo.id));

      row.append(checkbox, text, remove);
      list.appendChild(row);
    });
  }

  async function save() {
    await chrome.storage.local.set({ todos });
  }

  async function addTodo(text) {
    const cleanText = text.trim().slice(0, MAX_TEXT_LENGTH);
    if (!cleanText || todos.length >= MAX_TODOS) return;
    todos.push({ id: createId(), text: cleanText, done: false });
    input.value = '';
    render();
    await save();
  }

  async function updateTodo(id, change) {
    const todo = todos.find(item => item.id === id);
    if (!todo) return;
    Object.assign(todo, change);
    render();
    await save();
  }

  async function deleteTodo(id) {
    todos = todos.filter(todo => todo.id !== id);
    render();
    await save();
  }

  function createId() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    addTodo(input.value).catch(() => {});
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.todo) {
      setVisibility(changes.todo.newValue?.show !== false);
    }
    if (namespace === 'local' && changes.todos) {
      todos = normalizeTodos(changes.todos.newValue);
      render();
    }
  });

  load().catch(() => {
    widget.hidden = true;
  });
})();
