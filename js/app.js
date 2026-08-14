// spark 메모앱 - 메인 로직

const STORAGE_KEY = 'spark-memos';
const FONT_SIZE_KEY = 'spark-font-size';
const FONT_SIZES = ['xs', 's', 'm', 'l', 'xl'];
const THEME_KEY = 'spark-theme';
const THEME_COLOR = { light: '#1E3A5F', dark: '#101014' };

let editingId = null;
let showStarredOnly = false;
let activeFolder = 'ALL'; // 'ALL' | 'UNCLASSIFIED' | 실제 폴더명

// 메모 첫 줄이 "폴더명/" 형식(슬래시나 공백 없는 이름 + 슬래시 하나)이면 폴더로 인식
const FOLDER_LINE_PATTERN = /^([^\s/]+)\/$/;

// 새 메모(빈 글쓰기 폼)에서 음성 녹음을 시작하면 자동으로 이 폴더에 저장되도록 첫 줄에 넣는다
const VOICE_MEMO_FOLDER = '녹취';

// ===== DOM 참조 =====
const memoInput = document.getElementById('memo-input');
const starToggle = document.getElementById('star-toggle');
const saveBtn = document.getElementById('save-btn');
const searchInput = document.getElementById('search-input');
const filterToggle = document.getElementById('filter-toggle');
const folderTabs = document.getElementById('folder-tabs');
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

const micBtn = document.getElementById('mic-btn');
const micCancelBtn = document.getElementById('mic-cancel-btn');

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

// ===== 폴더 =====
function extractFolder(content) {
  const firstLine = content.split('\n')[0].trim();
  const match = firstLine.match(FOLDER_LINE_PATTERN);
  return match ? match[1] : null;
}

// ===== CRUD =====
function createMemo(content, starred, folder) {
  const now = new Date().toISOString();
  const memo = {
    id: generateId(),
    content,
    folder: folder || null,
    starred,
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

// ===== 화면 꺼짐 방지 (Wake Lock) =====
// navigator.wakeLock 미지원 브라우저에서는 조용히 무시됨
let wakeLock = null;

async function requestWakeLock() {
  if (!navigator.wakeLock || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch (err) {
    // 권한 거부, 탭이 백그라운드인 상태 등에서 요청이 실패할 수 있음 — 무시
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
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
  stopRecording();
}

function loadMemoIntoEditor(memo) {
  editingId = memo.id;
  memoInput.value = memo.content;
  autoGrowMemoInput();
  starToggle.setAttribute('aria-pressed', String(memo.starred));
  memoInput.focus();
}

memoInput.addEventListener('input', autoGrowMemoInput);
memoInput.addEventListener('focus', requestWakeLock);
memoInput.addEventListener('blur', releaseWakeLock);

// Wake Lock은 탭이 백그라운드로 가면 브라우저가 자동으로 해제하므로,
// 입력창에 계속 포커스가 남아있는 상태로 화면에 복귀하면 다시 요청한다.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && document.activeElement === memoInput) {
    requestWakeLock();
  }
});

// ===== 상세보기 =====
function openDetail(memo) {
  detailMemoId = memo.id;
  detailContent.textContent = memo.content;
  detailDate.textContent = `작성 ${formatDate(memo.createdAt)}  ·  수정 ${formatDate(memo.updatedAt)}`;

  memoEditorSection.hidden = true;
  memoToolbar.hidden = true;
  folderTabs.hidden = true;
  memoListSection.hidden = true;
  detailView.hidden = false;
}

function closeDetail() {
  detailMemoId = null;
  detailView.hidden = true;
  memoEditorSection.hidden = false;
  memoToolbar.hidden = false;
  renderFolderTabs();
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
  const lines = memo.content.split('\n');
  const hasFolderLine = FOLDER_LINE_PATTERN.test(lines[0].trim());
  const previewLines = hasFolderLine ? lines.slice(1) : lines;
  const firstLine = (previewLines[0] || '').trim();
  if (firstLine) return firstLine;
  return '(내용 없음)';
}

// ===== 폴더 탭 =====
function renderFolderTabs() {
  const folders = [...new Set(getMemos().map((memo) => memo.folder).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ko')
  );

  if (folders.length === 0) {
    activeFolder = 'ALL';
    folderTabs.hidden = true;
    folderTabs.innerHTML = '';
    return;
  }

  folderTabs.hidden = false;
  folderTabs.innerHTML = '';

  const tabs = [
    { key: 'ALL', label: '전체', deletable: false },
    { key: 'UNCLASSIFIED', label: '미분류', deletable: false },
    ...folders.map((name) => ({ key: name, label: name, deletable: true })),
  ];

  tabs.forEach((tab) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'folder-tab' + (activeFolder === tab.key ? ' active' : '');
    btn.textContent = tab.label;

    btn.addEventListener('click', () => {
      activeFolder = tab.key;
      renderList();
    });

    if (tab.deletable) {
      let pressTimer = null;
      const startPress = () => {
        pressTimer = setTimeout(() => {
          pressTimer = null;
          if (confirm(`'${tab.label}' 폴더를 삭제할까요? 폴더 안의 메모는 미분류로 이동합니다.`)) {
            deleteFolder(tab.label);
          }
        }, 600);
      };
      const cancelPress = () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      };
      btn.addEventListener('pointerdown', startPress);
      btn.addEventListener('pointerup', cancelPress);
      btn.addEventListener('pointerleave', cancelPress);
      btn.addEventListener('pointercancel', cancelPress);
    }

    folderTabs.appendChild(btn);
  });
}

function deleteFolder(folderName) {
  const memos = getMemos();
  memos.forEach((memo) => {
    if (memo.folder === folderName) {
      memo.folder = null;
      memo.updatedAt = new Date().toISOString();
    }
  });
  setMemos(memos);
  if (activeFolder === folderName) {
    activeFolder = 'ALL';
  }
  renderList();
}

function renderList() {
  renderFolderTabs();

  const keyword = searchInput.value.trim().toLowerCase();
  const memos = getMemos()
    .filter((memo) => !showStarredOnly || memo.starred)
    .filter((memo) => memo.content.toLowerCase().includes(keyword))
    .filter((memo) => {
      if (activeFolder === 'ALL') return true;
      if (activeFolder === 'UNCLASSIFIED') return !memo.folder;
      return memo.folder === activeFolder;
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  memoList.innerHTML = '';
  emptyMessage.style.display = memos.length === 0 ? 'block' : 'none';

  memos.forEach((memo) => {
    const li = document.createElement('li');
    li.className = memo.starred ? 'memo-item memo-item--starred' : 'memo-item';

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

    // 중요 표시된 메모만 별을 보여줌 (중요하지 않은 메모는 별 자리 자체를 만들지 않음)
    if (memo.starred) {
      const starBtn = document.createElement('button');
      starBtn.type = 'button';
      starBtn.className = 'memo-star-btn active';
      starBtn.textContent = '★';
      starBtn.setAttribute('aria-label', '중요 메모 토글');
      starBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        updateMemo(memo.id, { starred: !memo.starred });
        renderList();
      });

      actionsDiv.append(starBtn);
    }

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
  if (!content) {
    showToast('메모 내용을 입력해주세요.');
    return;
  }
  const starred = starToggle.getAttribute('aria-pressed') === 'true';
  const folder = extractFolder(content);

  const saved = editingId
    ? updateMemo(editingId, { content, starred, folder })
    : createMemo(content, starred, folder);

  if (!saved) {
    showToast('저장 공간이 부족해 메모를 저장하지 못했습니다.');
    return;
  }

  vibrate(100);
  releaseWakeLock();
  resetEditor();
  renderList();
});

// ===== 음성 메모 (Web Speech API, A안 - 음성을 텍스트로 변환) =====
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let isRecording = false;
let recordInsertPos = 0;
let recordStartValue = '';

function setMicUiRecording(recording) {
  isRecording = recording;
  micBtn.setAttribute('aria-pressed', String(recording));
  micBtn.setAttribute('aria-label', recording ? '음성 메모 중지' : '음성 메모 시작');
  micCancelBtn.hidden = !recording;
}

function insertTextAtCursor(text) {
  const value = memoInput.value;
  const pos = recordInsertPos;
  memoInput.value = value.slice(0, pos) + text + value.slice(pos);
  recordInsertPos = pos + text.length;
  memoInput.selectionStart = memoInput.selectionEnd = recordInsertPos;
  autoGrowMemoInput();
}

function createRecognition() {
  const rec = new SpeechRecognitionCtor();
  rec.lang = 'ko-KR';
  rec.continuous = true;
  rec.interimResults = false;

  rec.addEventListener('result', (event) => {
    let finalText = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalText += event.results[i][0].transcript;
      }
    }
    if (finalText) {
      insertTextAtCursor(finalText);
    }
  });

  rec.addEventListener('error', (event) => {
    if (event.error === 'aborted' || event.error === 'no-speech') return;
    showToast('음성 인식 중 오류가 발생했습니다.');
    stopRecording();
  });

  // 무음 등으로 인식이 자동 종료되어도, 사용자가 아직 녹음 중이라면 이어서 재시작한다
  rec.addEventListener('end', () => {
    if (isRecording) {
      try {
        rec.start();
      } catch (err) {
        // 이미 시작된 상태 등은 무시
      }
    }
  });

  return rec;
}

function startRecording() {
  if (!SpeechRecognitionCtor || isRecording) return;
  recordStartValue = memoInput.value;

  // 새 메모(편집 중이 아니고 글쓰기 폼이 비어있음)라면 "녹취/" 폴더 줄을 자동으로 넣는다.
  // 이미 내용이 있거나 기존 메모를 편집 중이면 기존 폴더/내용을 그대로 둔다.
  if (!editingId && memoInput.value.trim() === '') {
    memoInput.value = `${VOICE_MEMO_FOLDER}/\n`;
    recordInsertPos = memoInput.value.length;
  } else {
    recordInsertPos = memoInput.selectionStart;
  }

  memoInput.focus();
  memoInput.selectionStart = memoInput.selectionEnd = recordInsertPos;
  recognition = createRecognition();
  try {
    recognition.start();
  } catch (err) {
    showToast('음성 인식을 시작할 수 없습니다.');
    return;
  }
  setMicUiRecording(true);
}

function stopRecording() {
  // isRecording을 먼저 false로 바꿔야, stop()이 유발하는 'end' 이벤트의 자동 재시작 로직이
  // 사용자가 직접 멈춘 것과 무음 타임아웃으로 끊긴 것을 올바르게 구분할 수 있다
  setMicUiRecording(false);
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
}

function cancelRecording() {
  memoInput.value = recordStartValue;
  autoGrowMemoInput();
  stopRecording();
}

if (!SpeechRecognitionCtor) {
  micBtn.disabled = true;
  micBtn.setAttribute('aria-label', '이 브라우저는 음성 인식을 지원하지 않습니다');
  micBtn.title = '이 브라우저는 음성 인식을 지원하지 않습니다';
}

micBtn.addEventListener('click', () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});

micCancelBtn.addEventListener('click', cancelRecording);

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
// 버튼 글자 자체가 상태를 나타냄: 라이트모드일 땐 "다크모드"(누르면 다크로),
// 다크모드일 땐 "라이트모드"(누르면 라이트로) — 별도 토글 표시(동그라미) 없이 글자로만 안내
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  darkModeBtn.setAttribute('aria-pressed', String(theme === 'dark'));
  darkModeBtn.textContent = theme === 'dark' ? '라이트모드' : '다크모드';
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
