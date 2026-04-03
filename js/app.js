// SPARK 메인 앱

const STORAGE_KEY = 'spark_memos';

/* =============================================
   LocalStorage 유틸
   ============================================= */

// 저장된 메모 전체 불러오기
function getMemos() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

// 메모 전체 저장
function saveMemos(memos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
}

/* =============================================
   메모 렌더링
   ============================================= */

// 메모 목록을 화면에 그리기
function renderMemos(memos) {
  const list = document.getElementById('memo-list');
  const empty = document.getElementById('memo-empty');

  list.innerHTML = '';

  if (memos.length === 0) {
    empty.hidden = false;
    return;
  }

  empty.hidden = true;

  // 최신순 정렬
  const sorted = [...memos].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  sorted.forEach(memo => {
    const li = document.createElement('li');
    li.className = 'memo-item';
    li.dataset.id = memo.id;

    // 첫 줄을 제목으로 사용
    const lines = memo.content.split('\n');
    const title = lines[0] || '(내용 없음)';

    // 날짜 포맷
    const date = new Date(memo.updatedAt);
    const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    li.innerHTML = `
      <div class="memo-item__body">
        <p class="memo-item__title">${escapeHtml(title)}</p>
        <p class="memo-item__date">${dateStr}</p>
      </div>
      ${memo.starred ? '<svg class="memo-item__star" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' : ''}
    `;

    // 메모 카드 클릭 → 수정 모드
    li.addEventListener('click', () => enterEditMode(memo.id));

    list.appendChild(li);
  });
}

// XSS 방지용 HTML 이스케이프
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* =============================================
   Create — 새 메모 생성
   ============================================= */

function createMemo(content, starred) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    content,
    folder: null,
    starred,
    images: [],
    createdAt: now,
    updatedAt: now,
  };
}

/* =============================================
   Update — 메모 수정 모드
   ============================================= */

// 수정 모드 진입: 카드 클릭 시 textarea에 내용 로드
function enterEditMode(id) {
  const memos = getMemos();
  const memo = memos.find(m => m.id === id);
  if (!memo) return;

  const input = document.getElementById('memo-input');
  const btnSave = document.getElementById('btn-save');
  const btnStar = document.getElementById('btn-star');

  // textarea에 내용 복원
  input.value = memo.content;
  input.focus();

  // 별 버튼 상태 복원
  btnStar.dataset.starred = memo.starred ? 'true' : 'false';

  // 저장 버튼에 수정 중인 ID 기록
  btnSave.dataset.editingId = id;
  btnSave.textContent = '수정';
}

// 수정 모드 해제
function exitEditMode() {
  const btnSave = document.getElementById('btn-save');
  const btnStar = document.getElementById('btn-star');

  btnSave.dataset.editingId = '';
  btnSave.textContent = '저장';
  btnStar.dataset.starred = 'false';
}

/* =============================================
   저장 버튼 핸들러 (Create / Update 분기)
   ============================================= */

function handleSave() {
  const input = document.getElementById('memo-input');
  const btnSave = document.getElementById('btn-save');
  const btnStar = document.getElementById('btn-star');

  const content = input.value.trim();
  if (!content) return;

  const starred = btnStar.dataset.starred === 'true';
  const editingId = btnSave.dataset.editingId;

  let memos = getMemos();

  if (editingId) {
    // Update: 기존 메모 수정
    memos = memos.map(m => {
      if (m.id !== editingId) return m;
      return { ...m, content, starred, updatedAt: new Date().toISOString() };
    });
  } else {
    // Create: 새 메모 추가
    memos.push(createMemo(content, starred));
  }

  saveMemos(memos);
  renderMemos(memos);

  // 입력 영역 초기화
  input.value = '';
  exitEditMode();
}

/* =============================================
   별 버튼 토글
   ============================================= */

function handleStarToggle() {
  const btn = document.getElementById('btn-star');
  const isStarred = btn.dataset.starred === 'true';
  btn.dataset.starred = isStarred ? 'false' : 'true';
}

/* =============================================
   앱 초기화
   ============================================= */

function init() {
  // 저장된 메모 불러와 렌더링
  renderMemos(getMemos());

  // 이벤트 바인딩
  document.getElementById('btn-save').addEventListener('click', handleSave);
  document.getElementById('btn-star').addEventListener('click', handleStarToggle);

  // textarea에서 Ctrl+Enter / Cmd+Enter 로 저장
  document.getElementById('memo-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave();
  });
}

document.addEventListener('DOMContentLoaded', init);
