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

const moreMenuToggle = document.getElementById('more-menu-toggle');
const moreMenu = document.getElementById('more-menu');
const exportBtn = document.getElementById('export-btn');

const memoEditorSection = document.querySelector('.memo-editor');
const memoToolbar = document.querySelector('.memo-toolbar');
const memoListSection = document.querySelector('.memo-list-section');
const detailView = document.querySelector('.detail-view');
const detailBackBtn = document.getElementById('detail-back-btn');
const detailContent = document.getElementById('detail-content');
const detailDate = document.getElementById('detail-date');
const detailEditBtn = document.getElementById('detail-edit-btn');
const detailShareBtn = document.getElementById('detail-share-btn');
const detailCopyBtn = document.getElementById('detail-copy-btn');
const detailDeleteBtn = document.getElementById('detail-delete-btn');

let detailMemoId = null;

// ===== LocalStorage 입출력 =====
function getMemos() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function setMemos(memos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
}

// ===== ID 생성 =====
// crypto.randomUUID()는 보안 컨텍스트(HTTPS/localhost)에서만 지원되므로,
// 미지원 환경(예: 같은 네트워크의 다른 기기에서 로컬 IP로 접속하는 경우)을 위한 대체 로직을 둔다.
function generateId() {
  if (window.crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ===== CRUD =====
function createMemo(content, starred) {
  const now = new Date().toISOString();
  const memo = {
    id: generateId(),
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

// ===== 상세보기 =====
function openDetail(memo) {
  detailMemoId = memo.id;
  detailContent.textContent = memo.content;
  detailDate.textContent = `작성 ${formatDate(memo.createdAt)}  ·  수정 ${formatDate(memo.updatedAt)}`;

  memoEditorSection.hidden = true;
  memoToolbar.hidden = true;
  memoListSection.hidden = true;
  detailView.hidden = false;
}

function closeDetail() {
  detailMemoId = null;
  detailView.hidden = true;
  memoEditorSection.hidden = false;
  memoToolbar.hidden = false;
  memoListSection.hidden = false;
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
    li.addEventListener('click', () => openDetail(memo));

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

// ===== 더보기 메뉴 =====
function closeMoreMenu() {
  moreMenu.hidden = true;
  moreMenuToggle.setAttribute('aria-expanded', 'false');
}

moreMenuToggle.addEventListener('click', (event) => {
  event.stopPropagation();
  const isOpen = !moreMenu.hidden;
  if (isOpen) {
    closeMoreMenu();
  } else {
    moreMenu.hidden = false;
    moreMenuToggle.setAttribute('aria-expanded', 'true');
  }
});

document.addEventListener('click', (event) => {
  if (moreMenu.hidden) return;
  if (moreMenu.contains(event.target) || event.target === moreMenuToggle) return;
  closeMoreMenu();
});

// ===== 메모 내보내기 =====
function exportMemos() {
  const memos = getMemos();
  const json = JSON.stringify(memos, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  const a = document.createElement('a');
  a.href = url;
  a.download = `spark-backup-${yyyy}${mm}${dd}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

exportBtn.addEventListener('click', () => {
  exportMemos();
  closeMoreMenu();
});

detailBackBtn.addEventListener('click', closeDetail);

detailEditBtn.addEventListener('click', () => {
  const memo = getMemos().find((item) => item.id === detailMemoId);
  if (!memo) return;
  closeDetail();
  loadMemoIntoEditor(memo);
});

detailDeleteBtn.addEventListener('click', () => {
  if (!detailMemoId) return;
  if (!confirm('이 메모를 삭제할까요?')) return;
  if (editingId === detailMemoId) resetEditor();
  deleteMemo(detailMemoId);
  closeDetail();
  renderList();
});

detailShareBtn.addEventListener('click', async () => {
  const memo = getMemos().find((item) => item.id === detailMemoId);
  if (!memo) return;
  if (!navigator.share) {
    alert('이 브라우저는 공유 기능을 지원하지 않습니다.');
    return;
  }
  try {
    await navigator.share({ text: memo.content });
  } catch (err) {
    // 사용자가 공유를 취소한 경우 등은 무시
  }
});

detailCopyBtn.addEventListener('click', async () => {
  const memo = getMemos().find((item) => item.id === detailMemoId);
  if (!memo) return;
  try {
    await navigator.clipboard.writeText(memo.content);
    const original = detailCopyBtn.textContent;
    detailCopyBtn.textContent = '복사됨';
    setTimeout(() => {
      detailCopyBtn.textContent = original;
    }, 1500);
  } catch (err) {
    alert('복사에 실패했습니다.');
  }
});

// ===== 초기 렌더링 =====
renderList();
