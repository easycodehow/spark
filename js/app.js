// SPARK 메인 앱

const STORAGE_KEY = 'spark_memos';

// 검색 & 필터 상태
let searchKeyword = '';
let showStarredOnly = false;

// 폴더 필터 상태 ('__all__' | '__none__' | '폴더명')
let activeFolder = '__all__';

// 에디터 임시 이미지 (Base64 배열)
let editorImages = [];

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
   검색 & 필터 적용
   ============================================= */

// 현재 검색어 + 중요 필터 + 폴더 필터를 적용한 메모 반환
function getFilteredMemos() {
  let memos = getMemos();

  if (activeFolder === '__none__') {
    memos = memos.filter(m => !m.folder);
  } else if (activeFolder !== '__all__') {
    memos = memos.filter(m => m.folder === activeFolder);
  }

  if (showStarredOnly) {
    memos = memos.filter(m => m.starred);
  }

  if (searchKeyword) {
    const kw = searchKeyword.toLowerCase();
    memos = memos.filter(m => m.content.toLowerCase().includes(kw));
  }

  return memos;
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

    // 첫 줄을 제목으로 사용 (폴더명 줄이면 다음 줄로 대체)
    const lines = memo.content.split('\n');
    const firstLine = lines[0] || '';
    const isFolder = /^.+\/$/.test(firstLine.trimEnd());
    const title = (isFolder ? lines[1] : firstLine) || '(내용 없음)';

    // 날짜 포맷
    const date = new Date(memo.updatedAt);
    const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    li.innerHTML = `
      <div class="memo-item__body">
        <p class="memo-item__title">${escapeHtml(title)}</p>
        <p class="memo-item__date">${dateStr}</p>
      </div>
      ${memo.starred ? '<svg class="memo-item__star" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' : ''}
      <button class="memo-item__delete" aria-label="삭제" data-id="${memo.id}">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    `;

    // 메모 카드 클릭 → 상세보기 열기 (삭제 버튼 클릭 제외)
    li.addEventListener('click', (e) => {
      if (e.target.closest('.memo-item__delete')) return;
      openDetail(memo.id);
    });

    // 삭제 버튼 클릭
    li.querySelector('.memo-item__delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteMemo(memo.id);
    });

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
   폴더 추출
   ============================================= */

// 첫 줄이 "폴더명/" 형식이면 폴더명 반환, 아니면 null
function extractFolder(content) {
  const firstLine = content.split('\n')[0].trimEnd();
  const match = firstLine.match(/^(.+)\/$/);

  return match ? match[1].trim() : null;
}

/* =============================================
   Create — 새 메모 생성
   ============================================= */

function createMemo(content, starred, images = []) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    content,
    folder: extractFolder(content),
    starred,
    images,
    createdAt: now,
    updatedAt: now,
  };
}

/* =============================================
   Delete — 메모 삭제
   ============================================= */

function deleteMemo(id) {
  const memos = getMemos().filter(m => m.id !== id);
  saveMemos(memos);

  vibrateOnDelete();

  // 수정 중이던 메모가 삭제된 경우 수정 모드 해제
  const btnSave = document.getElementById('btn-save');
  if (btnSave.dataset.editingId === id) {
    document.getElementById('memo-input').value = '';
    exitEditMode();
  }

  renderFolderTabs();
  renderMemos(getFilteredMemos());
}

/* =============================================
   상세보기 — 열기 / 닫기
   ============================================= */

// 현재 상세보기 중인 메모 ID
let detailMemoId = null;

function openDetail(id) {
  const memo = getMemos().find(m => m.id === id);
  if (!memo) return;

  detailMemoId = id;

  // 날짜 포맷
  const date = new Date(memo.updatedAt);
  const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  document.getElementById('detail-date').textContent = dateStr;

  // 본문 — 줄바꿈 유지
  const contentEl = document.getElementById('detail-content');
  contentEl.textContent = memo.content;

  // 첨부 이미지 표시
  const imagesEl = document.getElementById('detail-images');
  imagesEl.innerHTML = '';
  if (memo.images && memo.images.length > 0) {
    imagesEl.hidden = false;
    memo.images.forEach((base64, idx) => {
      const img = document.createElement('img');
      img.src = base64;
      img.alt = `첨부 이미지 ${idx + 1}`;
      img.className = 'detail-image';
      imagesEl.appendChild(img);
    });
  } else {
    imagesEl.hidden = true;
  }

  // 상세보기 페이지 표시 (오른쪽에서 슬라이드인)
  const page = document.getElementById('page-detail');
  page.hidden = false;
  // 브라우저가 초기 위치(translateX 100%)를 먼저 렌더링하도록 더블 RAF 사용
  requestAnimationFrame(() => {
    requestAnimationFrame(() => page.classList.add('is-open'));
  });

  // 브라우저/폰 뒤로가기 버튼 지원
  history.pushState({ detail: id }, '');

  // 스크롤 상단으로
  document.getElementById('detail-body') && (document.getElementById('detail-body').scrollTop = 0);
  page.querySelector('.detail-body').scrollTop = 0;

  // 아이콘 재생성
  if (window.lucide) lucide.createIcons();
}

function closeDetail() {
  const page = document.getElementById('page-detail');
  page.classList.remove('is-open');
  page.addEventListener('transitionend', () => {
    page.hidden = true;
    detailMemoId = null;
  }, { once: true });
}

/* =============================================
   상세보기 — 버튼 핸들러
   ============================================= */

// 수정 버튼: 상세보기 닫고 에디터에 로드
function handleDetailEdit() {
  const id = detailMemoId;
  history.back();
  setTimeout(() => enterEditMode(id), 300);
}

// 삭제 버튼
function handleDetailDelete() {
  const id = detailMemoId;
  history.back();
  setTimeout(() => deleteMemo(id), 300);
}

// 공유 버튼 (Web Share API)
async function handleDetailShare() {
  const memo = getMemos().find(m => m.id === detailMemoId);
  if (!memo) return;

  if (navigator.share) {
    try {
      await navigator.share({ text: memo.content });
    } catch (e) {
      // 사용자가 공유 취소한 경우 무시
    }
  } else {
    // Web Share API 미지원 시 복사로 대체
    handleDetailCopy();
  }
}

// 복사 버튼 (Clipboard API)
async function handleDetailCopy() {
  const memo = getMemos().find(m => m.id === detailMemoId);
  if (!memo) return;

  try {
    await navigator.clipboard.writeText(memo.content);
    showToast('복사되었습니다');
  } catch (e) {
    // 클립보드 접근 실패 시 무시
  }
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

  // 이미지 복원
  editorImages = memo.images ? [...memo.images] : [];
  renderEditorImages();

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
  editorImages = [];
  renderEditorImages();
}

/* =============================================
   이미지 첨부
   ============================================= */

const IMAGE_MAX_BYTES = 500 * 1024; // 500KB

// 이미지 선택 메뉴 토글
function toggleImageMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('image-menu');
  menu.hidden = !menu.hidden;
}

function closeImageMenu() {
  document.getElementById('image-menu').hidden = true;
}

// 에디터 미리보기 렌더링
function renderEditorImages() {
  const wrap = document.getElementById('editor-images');
  wrap.innerHTML = '';

  if (editorImages.length === 0) {
    wrap.hidden = true;
    return;
  }

  wrap.hidden = false;
  editorImages.forEach((base64, idx) => {
    const item = document.createElement('div');
    item.className = 'editor__image-item';
    item.innerHTML = `
      <img src="${base64}" alt="첨부 이미지 ${idx + 1}" />
      <button class="editor__image-delete" aria-label="이미지 삭제" data-idx="${idx}">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    item.querySelector('.editor__image-delete').addEventListener('click', () => {
      editorImages.splice(idx, 1);
      renderEditorImages();
    });
    wrap.appendChild(item);
  });
}

// LocalStorage 잔여 용량 체크 (저장 가능 여부 반환)
function checkStorageCapacity(additionalBytes) {
  try {
    const used = new Blob([localStorage.getItem(STORAGE_KEY) || '']).size;
    // LocalStorage 한도 약 5MB 기준
    const limit = 5 * 1024 * 1024;
    return (used + additionalBytes) < limit;
  } catch {
    return true;
  }
}

// FileList를 받아 Base64로 변환 후 editorImages에 추가
function processImageFiles(files) {
  Array.from(files).forEach(file => {
    if (file.size > IMAGE_MAX_BYTES) {
      showToast(`${file.name}: 500KB를 초과한 이미지는 첨부할 수 없습니다`, true);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      editorImages.push(e.target.result);
      renderEditorImages();
    };
    reader.readAsDataURL(file);
  });
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

  // 저장 전 LocalStorage 용량 체크
  const imagesSize = editorImages.reduce((sum, b64) => sum + b64.length, 0);
  if (!checkStorageCapacity(imagesSize)) {
    showToast('저장 공간이 부족합니다. 일부 메모를 내보낸 후 삭제해 주세요', true);
    return;
  }

  let memos = getMemos();

  if (editingId) {
    // Update: 기존 메모 수정
    memos = memos.map(m => {
      if (m.id !== editingId) return m;
      return { ...m, content, folder: extractFolder(content), starred, images: [...editorImages], updatedAt: new Date().toISOString() };
    });
  } else {
    // Create: 새 메모 추가
    memos.push(createMemo(content, starred, [...editorImages]));
  }

  saveMemos(memos);
  renderFolderTabs();
  renderMemos(getFilteredMemos()); // 현재 필터 상태 유지

  vibrateOnSave();
  releaseWakeLock();

  // 입력 영역 초기화
  input.value = '';
  editorImages = [];
  renderEditorImages();
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
   검색 핸들러
   ============================================= */

function handleSearch(e) {
  searchKeyword = e.target.value.trim();
  renderMemos(getFilteredMemos());
}

/* =============================================
   중요 메모 필터 토글
   ============================================= */

function handleFilterToggle() {
  const btn = document.getElementById('btn-filter');
  showStarredOnly = !showStarredOnly;
  btn.dataset.active = showStarredOnly ? 'true' : 'false';
  renderMemos(getFilteredMemos());
}

/* =============================================
   앱 설치 유도 배너
   ============================================= */

let installPromptEvent = null;

// 이미 설치된 앱인지 확인 (standalone 모드 또는 localStorage 기록)
function isAppInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    localStorage.getItem('pwa-installed') === 'true'
  );
}

// beforeinstallprompt 이벤트 캐치
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  if (isAppInstalled()) return; // 이미 설치된 경우 무시
  installPromptEvent = e;
  document.getElementById('btn-install').hidden = false;
  if (window.lucide) lucide.createIcons();
});

// 설치 완료 후 버튼 숨김
window.addEventListener('appinstalled', () => {
  document.getElementById('btn-install').hidden = true;
  installPromptEvent = null;
  localStorage.setItem('pwa-installed', 'true');
});

async function handleInstall() {
  if (!installPromptEvent) return;
  // 프롬프트는 1회만 사용 가능하므로 클릭 즉시 버튼 숨김
  const evt = installPromptEvent;
  installPromptEvent = null;
  document.getElementById('btn-install').hidden = true;
  evt.prompt();
  const { outcome } = await evt.userChoice;
  if (outcome === 'accepted') {
    localStorage.setItem('pwa-installed', 'true');
  }
}

/* =============================================
   햅틱 피드백 (Vibration API)
   ============================================= */

function vibrateOnSave() {
  if (navigator.vibrate) navigator.vibrate(100);
}

function vibrateOnDelete() {
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
}

/* =============================================
   화면 꺼짐 방지 (Screen Wake Lock API)
   ============================================= */

let wakeLock = null;

async function requestWakeLock() {
  if (!('wakeLock' in navigator) || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch {
    // Wake Lock 미지원 또는 거부 시 무시
  }
}

async function releaseWakeLock() {
  if (!wakeLock) return;
  try {
    await wakeLock.release();
  } catch {
    // 무시
  }
  wakeLock = null;
}

// 백그라운드 복귀 시 Wake Lock 재요청
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const input = document.getElementById('memo-input');
    if (document.activeElement === input) requestWakeLock();
  }
});

/* =============================================
   폴더 탭 렌더링
   ============================================= */

function renderFolderTabs() {
  const memos = getMemos();
  const section = document.getElementById('folder-tabs');
  const scroll = document.getElementById('folder-tabs-scroll');

  // 폴더 목록 수집
  const folderSet = new Set();
  let hasUnfiled = false;
  memos.forEach(m => {
    if (m.folder) folderSet.add(m.folder);
    else hasUnfiled = true;
  });

  const folders = [...folderSet].sort();

  // 폴더가 전혀 없으면 탭 영역 숨김
  if (folders.length === 0 && !hasUnfiled) {
    section.hidden = true;
    activeFolder = '__all__';
    return;
  }

  section.hidden = false;
  scroll.innerHTML = '';

  // 전체 탭
  const allTab = makeTab('전체', '__all__', activeFolder === '__all__');
  scroll.appendChild(allTab);

  // 폴더별 탭
  folders.forEach(name => {
    const tab = makeTab(name, name, activeFolder === name);
    addLongPress(tab, name);
    scroll.appendChild(tab);
  });

  // 미분류 탭 (폴더 없는 메모가 있을 때만)
  if (hasUnfiled) {
    const noneTab = makeTab('미분류', '__none__', activeFolder === '__none__');
    scroll.appendChild(noneTab);
  }
}

function makeTab(label, value, isActive) {
  const btn = document.createElement('button');
  btn.className = 'folder-tab' + (isActive ? ' is-active' : '');
  btn.textContent = label;
  btn.dataset.folder = value;
  btn.addEventListener('click', () => {
    activeFolder = value;
    renderFolderTabs();
    renderMemos(getFilteredMemos());
  });
  return btn;
}

// 길게 누르기 (폴더 삭제)
function addLongPress(tab, folderName) {
  let timer = null;

  const start = () => {
    timer = setTimeout(() => showFolderDeleteConfirm(folderName), 600);
  };
  const cancel = () => clearTimeout(timer);

  tab.addEventListener('touchstart', start, { passive: true });
  tab.addEventListener('touchend', cancel);
  tab.addEventListener('touchmove', cancel);
  tab.addEventListener('mousedown', start);
  tab.addEventListener('mouseup', cancel);
  tab.addEventListener('mouseleave', cancel);
}

function showFolderDeleteConfirm(folderName) {
  if (!confirm(`"${folderName}" 폴더를 삭제할까요?\n메모는 삭제되지 않고 미분류로 이동합니다.`)) return;
  deleteFolder(folderName);
}

function deleteFolder(folderName) {
  const now = new Date().toISOString();
  const memos = getMemos().map(m => {
    if (m.folder !== folderName) return m;
    return { ...m, folder: null, updatedAt: now };
  });
  saveMemos(memos);

  if (activeFolder === folderName) activeFolder = '__all__';
  renderFolderTabs();
  renderMemos(getFilteredMemos());
}

/* =============================================
   다크모드 토글
   ============================================= */

const THEME_KEY = 'spark_theme';

function applyTheme(isDark) {
  document.documentElement.dataset.theme = isDark ? 'dark' : '';
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');

  // 아이콘 전환
  const icon = document.querySelector('#btn-dark-toggle [data-lucide]');
  if (icon) {
    icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    if (window.lucide) lucide.createIcons();
  }
}

function handleDarkToggle() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  applyTheme(!isDark);
}

/* =============================================
   더보기 메뉴 — 열기 / 닫기
   ============================================= */

function openMoreMenu() {
  document.getElementById('more-menu').hidden = false;
}

function closeMoreMenu() {
  document.getElementById('more-menu').hidden = true;
}

function toggleMoreMenu() {
  const menu = document.getElementById('more-menu');
  menu.hidden ? openMoreMenu() : closeMoreMenu();
}

/* =============================================
   메모 내보내기 (Export)
   ============================================= */

function handleExport() {
  closeMoreMenu();

  const memos = getMemos();
  const json = JSON.stringify(memos, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

  const a = document.createElement('a');
  a.href = url;
  a.download = `spark-backup-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* =============================================
   메모 가져오기 (Import)
   ============================================= */

function handleImportTrigger() {
  closeMoreMenu();
  document.getElementById('import-input').click();
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  // 파일 선택 초기화 (같은 파일 재선택 가능하도록)
  e.target.value = '';

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const imported = JSON.parse(event.target.result);

      // 배열 여부 및 필수 필드 검증
      if (!Array.isArray(imported)) throw new Error('형식 오류');
      imported.forEach(m => {
        if (!m.id || !('content' in m)) throw new Error('형식 오류');
      });

      const existing = getMemos();
      const existingIds = new Set(existing.map(m => m.id));

      // ID 중복 제거 후 병합
      const merged = [...existing, ...imported.filter(m => !existingIds.has(m.id))];
      saveMemos(merged);
      renderMemos(getFilteredMemos());

      const added = merged.length - existing.length;
      showToast(`${added}개의 메모를 가져왔습니다`);
    } catch {
      showToast('올바른 SPARK 백업 파일이 아닙니다', true);
    }
  };
  reader.readAsText(file);
}

/* =============================================
   글자크기 조절
   ============================================= */

const FONT_SIZE_KEY = 'spark_font_size';

function applyFontSize(size) {
  document.body.dataset.fontSize = size;
  localStorage.setItem(FONT_SIZE_KEY, size);

  // 버튼 active 상태 갱신
  document.querySelectorAll('.btn-font-size').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.size === size);
  });
}

function handleFontSizeClick(e) {
  const btn = e.target.closest('.btn-font-size');
  if (!btn) return;
  applyFontSize(btn.dataset.size);
}

/* =============================================
   토스트 알림 (공용)
   ============================================= */

function showToast(message, isError = false) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'copy-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.backgroundColor = isError ? 'rgba(231,76,60,0.9)' : 'rgba(0,0,0,0.75)';
  toast.classList.add('is-visible');
  setTimeout(() => toast.classList.remove('is-visible'), 2500);
}

/* =============================================
   앱 초기화
   ============================================= */

function init() {
  // 저장된 테마 적용
  const savedTheme = localStorage.getItem(THEME_KEY);
  applyTheme(savedTheme === 'dark');

  // 저장된 글자크기 적용
  const savedSize = localStorage.getItem(FONT_SIZE_KEY) || 'medium';
  applyFontSize(savedSize);

  // 저장된 메모 불러와 렌더링
  renderFolderTabs();
  renderMemos(getMemos());

  // 이벤트 바인딩
  document.getElementById('btn-save').addEventListener('click', handleSave);
  document.getElementById('btn-star').addEventListener('click', handleStarToggle);
  document.getElementById('search-input').addEventListener('input', handleSearch);
  document.getElementById('btn-filter').addEventListener('click', handleFilterToggle);

  // 상세보기 버튼
  document.getElementById('btn-detail-back').addEventListener('click', () => {
    history.back();
  });
  document.getElementById('btn-detail-edit').addEventListener('click', handleDetailEdit);
  document.getElementById('btn-detail-delete').addEventListener('click', handleDetailDelete);
  document.getElementById('btn-detail-share').addEventListener('click', handleDetailShare);
  document.getElementById('btn-detail-copy').addEventListener('click', handleDetailCopy);

  // 브라우저/폰 뒤로가기 버튼 처리
  window.addEventListener('popstate', () => {
    if (detailMemoId) closeDetail();
  });

  // 앱 설치 버튼
  document.getElementById('btn-install').addEventListener('click', handleInstall);

  // Wake Lock — textarea focus/blur
  const textarea = document.getElementById('memo-input');
  textarea.addEventListener('focus', requestWakeLock);
  textarea.addEventListener('blur', releaseWakeLock);

  // 이미지 첨부
  document.getElementById('btn-camera').addEventListener('click', toggleImageMenu);
  document.getElementById('btn-gallery').addEventListener('click', () => {
    closeImageMenu();
    document.getElementById('image-input-gallery').click();
  });
  document.getElementById('btn-camera-capture').addEventListener('click', () => {
    closeImageMenu();
    document.getElementById('image-input-camera').click();
  });
  document.getElementById('image-input-gallery').addEventListener('change', (e) => {
    processImageFiles(e.target.files);
    e.target.value = '';
  });
  document.getElementById('image-input-camera').addEventListener('change', (e) => {
    processImageFiles(e.target.files);
    e.target.value = '';
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#image-menu') && !e.target.closest('#btn-camera')) {
      closeImageMenu();
    }
  });

  // 다크모드 토글
  document.getElementById('btn-dark-toggle').addEventListener('click', handleDarkToggle);

  // 더보기 메뉴
  document.getElementById('btn-more').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMoreMenu();
  });
  document.getElementById('btn-export').addEventListener('click', handleExport);
  document.getElementById('btn-import-trigger').addEventListener('click', handleImportTrigger);
  document.getElementById('import-input').addEventListener('change', handleImportFile);
  document.querySelector('.font-size-controls').addEventListener('click', handleFontSizeClick);

  // 더보기 메뉴 외부 클릭 시 닫기
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#more-menu') && !e.target.closest('#btn-more')) {
      closeMoreMenu();
    }
  });

  // textarea에서 Ctrl+Enter / Cmd+Enter 로 저장
  document.getElementById('memo-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave();
  });
}

document.addEventListener('DOMContentLoaded', init);
