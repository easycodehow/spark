// spark 메모앱 - 메인 로직

const STORAGE_KEY = 'spark-memos';

let editingId = null;
let showStarredOnly = false;

// ===== DOM 참조 =====
const memoInput = document.getElementById('memo-input');
const starToggle = document.getElementById('star-toggle');
const saveBtn = document.getElementById('save-btn');
const searchInput = document.getElementById('search-input');
const filterToggle = document.getElementById('filter-toggle');
const memoList = document.getElementById('memo-list');
const emptyMessage = document.getElementById('empty-message');

// ===== LocalStorage 입출력 =====
function getMemos() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function setMemos(memos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
}

// ===== CRUD =====
function createMemo(content, starred) {
  const now = new Date().toISOString();
  const memo = {
    id: crypto.randomUUID(),
    content,
    folder: null,
    starred,
    images: [],
    createdAt: now,
    updatedAt: now,
  };
  const memos = getMemos();
  memos.unshift(memo);
  setMemos(memos);
}

function updateMemo(id, changes) {
  const memos = getMemos();
  const target = memos.find((memo) => memo.id === id);
  if (!target) return;
  Object.assign(target, changes, { updatedAt: new Date().toISOString() });
  setMemos(memos);
}

function deleteMemo(id) {
  const memos = getMemos().filter((memo) => memo.id !== id);
  setMemos(memos);
}

// ===== 편집기 상태 =====
function resetEditor() {
  editingId = null;
  memoInput.value = '';
  starToggle.setAttribute('aria-pressed', 'false');
}

function loadMemoIntoEditor(memo) {
  editingId = memo.id;
  memoInput.value = memo.content;
  starToggle.setAttribute('aria-pressed', String(memo.starred));
  memoInput.focus();
}

// ===== 렌더링 =====
function formatDate(isoString) {
  const date = new Date(isoString);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
}

function getMemoTitle(content) {
  const firstLine = content.split('\n')[0].trim();
  return firstLine || '(내용 없음)';
}

function renderList() {
  const keyword = searchInput.value.trim().toLowerCase();
  const memos = getMemos()
    .filter((memo) => !showStarredOnly || memo.starred)
    .filter((memo) => memo.content.toLowerCase().includes(keyword))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  memoList.innerHTML = '';
  emptyMessage.style.display = memos.length === 0 ? 'block' : 'none';

  memos.forEach((memo) => {
    const li = document.createElement('li');
    li.className = 'memo-item';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'memo-item-content';

    const titleEl = document.createElement('p');
    titleEl.className = 'memo-item-title';
    titleEl.textContent = getMemoTitle(memo.content);

    const dateEl = document.createElement('p');
    dateEl.className = 'memo-item-date';
    dateEl.textContent = formatDate(memo.updatedAt);

    contentDiv.append(titleEl, dateEl);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'memo-item-actions';

    const starBtn = document.createElement('button');
    starBtn.type = 'button';
    starBtn.className = 'memo-star-btn' + (memo.starred ? ' active' : '');
    starBtn.textContent = '★';
    starBtn.setAttribute('aria-label', '중요 메모 토글');
    starBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      updateMemo(memo.id, { starred: !memo.starred });
      renderList();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'memo-delete-btn';
    deleteBtn.textContent = '삭제';
    deleteBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (editingId === memo.id) resetEditor();
      deleteMemo(memo.id);
      renderList();
    });

    actionsDiv.append(starBtn, deleteBtn);

    li.append(contentDiv, actionsDiv);
    li.addEventListener('click', () => loadMemoIntoEditor(memo));

    memoList.appendChild(li);
  });
}

// ===== 이벤트 =====
starToggle.addEventListener('click', () => {
  const pressed = starToggle.getAttribute('aria-pressed') === 'true';
  starToggle.setAttribute('aria-pressed', String(!pressed));
});

saveBtn.addEventListener('click', () => {
  const content = memoInput.value.trim();
  if (!content) return;
  const starred = starToggle.getAttribute('aria-pressed') === 'true';

  if (editingId) {
    updateMemo(editingId, { content, starred });
  } else {
    createMemo(content, starred);
  }

  resetEditor();
  renderList();
});

searchInput.addEventListener('input', renderList);

filterToggle.addEventListener('click', () => {
  showStarredOnly = !showStarredOnly;
  filterToggle.setAttribute('aria-pressed', String(showStarredOnly));
  renderList();
});

// ===== 초기 렌더링 =====
renderList();
