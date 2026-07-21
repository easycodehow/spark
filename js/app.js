// spark 메모앱 - 메인 로직

const STORAGE_KEY = 'spark-memos';
const FONT_SIZE_KEY = 'spark-font-size';
const FONT_SIZES = ['xs', 's', 'm', 'l', 'xl'];
const THEME_KEY = 'spark-theme';
const THEME_COLOR = { light: '#1E3A5F', dark: '#101014' };
const IMAGE_MAX_BYTES = 500 * 1024;
// 브라우저별로 LocalStorage 실제 한도가 다르지만(대부분 5MB 내외), 보수적으로 5MB를 기준 용량으로 삼는다.
const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024;

let editingId = null;
let showStarredOnly = false;
let editorImages = [];

// ===== DOM 참조 =====
const memoInput = document.getElementById('memo-input');
const starToggle = document.getElementById('star-toggle');
const saveBtn = document.getElementById('save-btn');
const searchInput = document.getElementById('search-input');
const filterToggle = document.getElementById('filter-toggle');
const memoList = document.getElementById('memo-list');
const emptyMessage = document.getElementById('empty-message');

const installBtn = document.getElementById('install-btn');
const moreMenuToggle = document.getElementById('more-menu-toggle');
const moreMenu = document.getElementById('more-menu');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFileInput = document.getElementById('import-file-input');
const toastEl = document.getElementById('toast');
const fontSizeDecreaseBtn = document.getElementById('fontsize-decrease');
const fontSizeIncreaseBtn = document.getElementById('fontsize-increase');
const fontSizeDots = document.querySelectorAll('.fontsize-dot');
const darkModeBtn = document.getElementById('dark-mode-btn');
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

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
const detailImages = document.getElementById('detail-images');

const imageAddBtn = document.getElementById('image-add-btn');
const imageCameraBtn = document.getElementById('image-camera-btn');
const imageGalleryInput = document.getElementById('image-gallery-input');
const imageCameraInput = document.getElementById('image-camera-input');
const editorImagePreview = document.getElementById('editor-image-preview');

let detailMemoId = null;

// ===== LocalStorage 입출력 =====
function getMemos() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function setMemos(memos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
    return true;
  } catch (err) {
    return false;
  }
}

// ===== LocalStorage 용량 체크 =====
function estimateStorageUsageBytes() {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key) || '';
    total += (key.length + value.length) * 2; // UTF-16 기준 대략치
  }
  return total;
}

function hasStorageRoomFor(additionalBytes) {
  return estimateStorageUsageBytes() + additionalBytes < STORAGE_QUOTA_BYTES;
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
function createMemo(content, starred, images) {
  const now = new Date().toISOString();
  const memo = {
    id: generateId(),
    content,
    folder: null,
    starred,
    images,
    createdAt: now,
    updatedAt: now,
  };
  const memos = getMemos();
  memos.unshift(memo);
  return setMemos(memos);
}

function updateMemo(id, changes) {
  const memos = getMemos();
  const target = memos.find((memo) => memo.id === id);
  if (!target) return false;
  Object.assign(target, changes, { updatedAt: new Date().toISOString() });
  return setMemos(memos);
}

function deleteMemo(id) {
  const memos = getMemos().filter((memo) => memo.id !== id);
  setMemos(memos);
}

// ===== 햅틱 피드백 =====
// navigator.vibrate 미지원 브라우저(예: iOS Safari)에서는 조용히 무시됨
function vibrate(pattern) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

// ===== 편집기 상태 =====

// 입력한 줄 수만큼 textarea 높이를 자동으로 늘림 (최대 높이는 CSS max-height가 제한, 그 이상은 내부 스크롤)
function autoGrowMemoInput() {
  memoInput.style.height = 'auto';
  memoInput.style.height = `${memoInput.scrollHeight}px`;
}

function resetEditor() {
  editingId = null;
  memoInput.value = '';
  memoInput.style.height = '';
  starToggle.setAttribute('aria-pressed', 'false');
  editorImages = [];
  renderEditorImagePreview();
}

function loadMemoIntoEditor(memo) {
  editingId = memo.id;
  memoInput.value = memo.content;
  autoGrowMemoInput();
  starToggle.setAttribute('aria-pressed', String(memo.starred));
  editorImages = [...memo.images];
  renderEditorImagePreview();
  memoInput.focus();
}

memoInput.addEventListener('input', autoGrowMemoInput);

// ===== 이미지 첨부 =====
function renderEditorImagePreview() {
  editorImagePreview.innerHTML = '';
  editorImages.forEach((base64, index) => {
    const thumb = document.createElement('div');
    thumb.className = 'editor-image-thumb';

    const img = document.createElement('img');
    img.src = base64;
    img.alt = `첨부 이미지 ${index + 1}`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'editor-image-remove-btn';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', '이미지 삭제');
    removeBtn.addEventListener('click', () => {
      editorImages.splice(index, 1);
      renderEditorImagePreview();
    });

    thumb.append(img, removeBtn);
    editorImagePreview.appendChild(thumb);
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러올 수 없습니다.'));
    img.src = dataUrl;
  });
}

// 카메라 촬영본처럼 500KB를 넘는 사진을, 화질/해상도를 단계적으로 낮춰가며
// 캔버스로 다시 인코딩해 용량 제한 안으로 맞춘다. 끝까지 못 맞추면 null 반환.
async function compressImageToLimit(file, maxBytes) {
  const originalDataUrl = await readFileAsDataURL(file);
  const img = await loadImageElement(originalDataUrl);

  let width = img.naturalWidth;
  let height = img.naturalHeight;
  let quality = 0.85;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  for (let attempt = 0; attempt < 12; attempt++) {
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64Length = dataUrl.length - dataUrl.indexOf(',') - 1;
    const byteSize = Math.ceil((base64Length * 3) / 4);

    if (byteSize <= maxBytes) return dataUrl;

    if (quality > 0.5) {
      quality -= 0.1;
    } else {
      width = Math.round(width * 0.8);
      height = Math.round(height * 0.8);
      quality = 0.7;
    }
    if (width < 80 || height < 80) break;
  }
  return null;
}

async function addImageFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('이미지 파일만 첨부할 수 있습니다.');
    return;
  }

  let base64;

  if (file.size > IMAGE_MAX_BYTES) {
    try {
      base64 = await compressImageToLimit(file, IMAGE_MAX_BYTES);
    } catch (err) {
      showToast('이미지를 불러오지 못했습니다.');
      return;
    }
    if (!base64) {
      showToast('이미지 용량이 너무 커서 자동으로 줄여도 500KB를 넘습니다.');
      return;
    }
  } else {
    try {
      base64 = await readFileAsDataURL(file);
    } catch (err) {
      showToast('이미지를 읽는 중 오류가 발생했습니다.');
      return;
    }
  }

  if (!hasStorageRoomFor(base64.length * 2)) {
    showToast('저장 공간이 부족해 이미지를 추가할 수 없습니다.');
    return;
  }

  editorImages.push(base64);
  renderEditorImagePreview();
}

// ===== 상세보기 =====
function openDetail(memo) {
  detailMemoId = memo.id;
  detailContent.textContent = memo.content;
  detailDate.textContent = `작성 ${formatDate(memo.createdAt)}  ·  수정 ${formatDate(memo.updatedAt)}`;

  detailImages.innerHTML = '';
  memo.images.forEach((base64, index) => {
    const img = document.createElement('img');
    img.src = base64;
    img.alt = `첨부 이미지 ${index + 1}`;
    detailImages.appendChild(img);
  });

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

function getMemoTitle(memo) {
  const firstLine = memo.content.split('\n')[0].trim();
  if (firstLine) return firstLine;
  if (memo.images.length > 0) return `[이미지] ${formatDate(memo.updatedAt)}`;
  return '(내용 없음)';
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
    titleEl.textContent = getMemoTitle(memo);

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

    actionsDiv.append(starBtn);

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
  const images = [...editorImages];
  if (!content && images.length === 0) {
    showToast('메모 내용이나 이미지를 추가해주세요.');
    return;
  }
  const starred = starToggle.getAttribute('aria-pressed') === 'true';

  const saved = editingId
    ? updateMemo(editingId, { content, starred, images })
    : createMemo(content, starred, images);

  if (!saved) {
    showToast('저장 공간이 부족해 메모를 저장하지 못했습니다.');
    return;
  }

  vibrate(100);
  resetEditor();
  renderList();
});

// ===== 이미지 추가 (갤러리) / 카메라 촬영 =====
imageAddBtn.addEventListener('click', () => {
  imageGalleryInput.click();
});

imageCameraBtn.addEventListener('click', () => {
  imageCameraInput.click();
});

imageGalleryInput.addEventListener('change', () => {
  addImageFile(imageGalleryInput.files[0]);
  imageGalleryInput.value = '';
});

imageCameraInput.addEventListener('change', () => {
  addImageFile(imageCameraInput.files[0]);
  imageCameraInput.value = '';
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

// ===== 토스트 알림 =====
let toastTimer = null;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  // 리플로우를 강제해 매번 fade-in 트랜지션이 재생되도록 함
  void toastEl.offsetWidth;
  toastEl.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => {
      toastEl.hidden = true;
    }, 200);
  }, 2500);
}

// ===== 메모 가져오기 =====
function isValidMemo(memo) {
  return (
    memo &&
    typeof memo === 'object' &&
    typeof memo.id === 'string' &&
    typeof memo.content === 'string' &&
    (memo.folder === null || typeof memo.folder === 'string') &&
    typeof memo.starred === 'boolean' &&
    Array.isArray(memo.images) &&
    typeof memo.createdAt === 'string' &&
    typeof memo.updatedAt === 'string'
  );
}

function importMemos(parsed) {
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isValidMemo)) {
    showToast('올바른 메모 백업 파일이 아닙니다.');
    return;
  }

  const existingMemos = getMemos();
  const existingIds = new Set(existingMemos.map((memo) => memo.id));
  const newMemos = parsed.filter((memo) => !existingIds.has(memo.id));
  const duplicateCount = parsed.length - newMemos.length;

  setMemos([...newMemos, ...existingMemos]);
  renderList();

  if (newMemos.length === 0) {
    showToast('가져올 새 메모가 없습니다 (모두 중복).');
  } else {
    const suffix = duplicateCount > 0 ? ` (중복 ${duplicateCount}개 제외)` : '';
    showToast(`메모 ${newMemos.length}개를 가져왔습니다.${suffix}`);
  }
}

importBtn.addEventListener('click', () => {
  closeMoreMenu();
  importFileInput.click();
});

importFileInput.addEventListener('change', () => {
  const file = importFileInput.files[0];
  importFileInput.value = '';
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      importMemos(parsed);
    } catch (err) {
      showToast('올바른 JSON 파일이 아닙니다.');
    }
  };
  reader.onerror = () => {
    showToast('파일을 읽는 중 오류가 발생했습니다.');
  };
  reader.readAsText(file);
});

// ===== 글자크기 조절 =====
function applyFontSize(size) {
  document.documentElement.setAttribute('data-font-size', size);
  fontSizeDots.forEach((dot) => {
    dot.classList.toggle('active', dot.dataset.size === size);
  });

  const index = FONT_SIZES.indexOf(size);
  fontSizeDecreaseBtn.disabled = index <= 0;
  fontSizeIncreaseBtn.disabled = index >= FONT_SIZES.length - 1;
}

function loadFontSize() {
  const saved = localStorage.getItem(FONT_SIZE_KEY);
  applyFontSize(FONT_SIZES.includes(saved) ? saved : 'm');
}

function stepFontSize(delta) {
  const current = document.documentElement.getAttribute('data-font-size') || 'm';
  const currentIndex = FONT_SIZES.indexOf(current);
  const nextIndex = Math.min(FONT_SIZES.length - 1, Math.max(0, currentIndex + delta));
  const nextSize = FONT_SIZES[nextIndex];
  applyFontSize(nextSize);
  localStorage.setItem(FONT_SIZE_KEY, nextSize);
}

fontSizeDecreaseBtn.addEventListener('click', () => stepFontSize(-1));
fontSizeIncreaseBtn.addEventListener('click', () => stepFontSize(1));

loadFontSize();

// ===== 다크모드 토글 =====
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  darkModeBtn.setAttribute('aria-pressed', String(theme === 'dark'));
  themeColorMeta.setAttribute('content', THEME_COLOR[theme]);
}

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'dark' ? 'dark' : 'light');
}

darkModeBtn.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

loadTheme();

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
  vibrate([100, 50, 100]);
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
    const labelEl = detailCopyBtn.querySelector('.detail-action-label');
    const original = labelEl.textContent;
    labelEl.textContent = '복사됨';
    setTimeout(() => {
      labelEl.textContent = original;
    }, 1500);
  } catch (err) {
    alert('복사에 실패했습니다.');
  }
});

// ===== 앱 설치 유도 배너 =====
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installBtn.hidden = false;
});

installBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBtn.hidden = true;
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  installBtn.hidden = true;
});

// ===== 초기 렌더링 =====
renderList();
