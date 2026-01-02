// ========================================
// SPARK 메모앱 메인 JavaScript
// ========================================

// 전역 변수
let memos = [];
let currentMemoId = null;
let isImportantFilter = false;
let currentEditingId = null;

// DOM 요소
const memoInput = document.getElementById('memoInput');
const saveBtn = document.getElementById('saveBtn');
const starBtn = document.getElementById('starBtn');
const cameraBtn = document.getElementById('cameraBtn');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const starFilterBtn = document.getElementById('starFilterBtn');
const memoList = document.getElementById('memoList');
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
const darkModeBtn = document.getElementById('darkModeBtn');
const fontSizeSelect = document.getElementById('fontSizeSelect');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const detailView = document.getElementById('detailView');
const backBtn = document.getElementById('backBtn');
const detailContent = document.getElementById('detailContent');
const detailDate = document.getElementById('detailDate');
const editBtn = document.getElementById('editBtn');
const shareBtn = document.getElementById('shareBtn');
const copyBtn = document.getElementById('copyBtn');
const deleteBtn = document.getElementById('deleteBtn');

// ========================================
// LocalStorage 관리
// ========================================

// 메모 불러오기
function loadMemos() {
  const saved = localStorage.getItem('sparkMemos');
  if (saved) {
    memos = JSON.parse(saved);
  }
}

// 메모 저장하기
function saveMemos() {
  localStorage.setItem('sparkMemos', JSON.stringify(memos));
}

// ========================================
// 메모 CRUD 기능
// ========================================

// 메모 생성
function createMemo(content, isImportant = false) {
  const memo = {
    id: Date.now(),
    content: content.trim(),
    isImportant: isImportant,
    date: new Date().toLocaleDateString('ko-KR')
  };

  memos.unshift(memo); // 최신 메모를 앞에 추가
  saveMemos();
  return memo;
}

// 메모 수정
function updateMemo(id, content, isImportant) {
  const memo = memos.find(m => m.id === id);
  if (memo) {
    memo.content = content.trim();
    memo.isImportant = isImportant;
    saveMemos();
    return memo;
  }
  return null;
}

// 메모 삭제
function deleteMemo(id) {
  const index = memos.findIndex(m => m.id === id);
  if (index !== -1) {
    memos.splice(index, 1);
    saveMemos();
    return true;
  }
  return false;
}

// 메모 검색
function searchMemos(keyword) {
  return memos.filter(memo =>
    memo.content.toLowerCase().includes(keyword.toLowerCase())
  );
}

// 중요 메모 필터링
function filterImportantMemos() {
  return memos.filter(memo => memo.isImportant);
}

// ========================================
// UI 렌더링
// ========================================

// 메모 목록 렌더링
function renderMemos(memosToRender = memos) {
  memoList.innerHTML = '';

  if (memosToRender.length === 0) {
    memoList.innerHTML = '<p style="text-align: center; color: var(--placeholder-color); padding: 2rem;">메모가 없습니다</p>';
    return;
  }

  memosToRender.forEach(memo => {
    const card = createMemoCard(memo);
    memoList.appendChild(card);
  });
}

// 메모 카드 생성
function createMemoCard(memo) {
  const card = document.createElement('div');
  card.className = 'memo-card' + (memo.isImportant ? ' important' : '');
  card.dataset.id = memo.id;

  // 제목 (첫 줄)
  const lines = memo.content.split('\n');
  const firstLine = lines[0] || '제목 없음';
  const title = document.createElement('div');
  title.className = 'memo-card-title';
  title.innerHTML = `
    <span>${escapeHtml(firstLine)}</span>
    ${memo.isImportant ? '<span class="star">⭐</span>' : ''}
  `;

  // 날짜
  const date = document.createElement('div');
  date.className = 'memo-card-date';
  date.textContent = memo.date;

  card.appendChild(title);
  card.appendChild(date);

  // 미리보기 (여러 줄일 경우에만 표시)
  if (lines.length > 1 || memo.content.length > 50) {
    const preview = document.createElement('div');
    preview.className = 'memo-card-preview';
    preview.textContent = memo.content;
    card.appendChild(preview);
  }

  // 클릭 이벤트
  card.addEventListener('click', () => {
    openDetailView(memo.id);
  });

  return card;
}

// HTML 이스케이프 (XSS 방지)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========================================
// 메모 작성/수정
// ========================================

// 저장 버튼 클릭
saveBtn.addEventListener('click', () => {
  const content = memoInput.value.trim();

  if (!content) {
    alert('메모 내용을 입력해주세요.');
    return;
  }

  const isImportant = starBtn.classList.contains('active');

  if (currentEditingId) {
    // 수정 모드
    updateMemo(currentEditingId, content, isImportant);
    currentEditingId = null;
  } else {
    // 생성 모드
    createMemo(content, isImportant);
  }

  // 초기화
  memoInput.value = '';
  starBtn.classList.remove('active');

  // 화면 갱신
  renderMemos(getCurrentFilteredMemos());
});

// 별 버튼 토글
starBtn.addEventListener('click', () => {
  starBtn.classList.toggle('active');
});

// 카메라 버튼 (추후 구현)
cameraBtn.addEventListener('click', () => {
  alert('이미지 첨부 기능은 추후 구현 예정입니다.');
});

// ========================================
// 검색 및 필터
// ========================================

// 검색 버튼
searchBtn.addEventListener('click', () => {
  performSearch();
});

// 검색 입력창 엔터키
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    performSearch();
  }
});

// 검색 실행
function performSearch() {
  const keyword = searchInput.value.trim();

  if (!keyword) {
    renderMemos(getCurrentFilteredMemos());
    return;
  }

  let results = searchMemos(keyword);

  // 중요 메모 필터가 켜져있으면 적용
  if (isImportantFilter) {
    results = results.filter(memo => memo.isImportant);
  }

  renderMemos(results);
}

// 중요 메모 필터 토글
starFilterBtn.addEventListener('click', () => {
  isImportantFilter = !isImportantFilter;
  starFilterBtn.classList.toggle('active', isImportantFilter);

  renderMemos(getCurrentFilteredMemos());
});

// 현재 필터 상태에 따른 메모 목록 반환
function getCurrentFilteredMemos() {
  const keyword = searchInput.value.trim();
  let filtered = memos;

  // 검색어가 있으면 검색
  if (keyword) {
    filtered = searchMemos(keyword);
  }

  // 중요 메모 필터가 켜져있으면 적용
  if (isImportantFilter) {
    filtered = filtered.filter(memo => memo.isImportant);
  }

  return filtered;
}

// ========================================
// 상세보기 화면
// ========================================

// 상세보기 열기
function openDetailView(memoId) {
  const memo = memos.find(m => m.id === memoId);
  if (!memo) return;

  currentMemoId = memoId;

  detailContent.textContent = memo.content;
  detailDate.textContent = memo.date;

  detailView.classList.add('active');
}

// 상세보기 닫기
function closeDetailView() {
  detailView.classList.remove('active');
  currentMemoId = null;
}

backBtn.addEventListener('click', closeDetailView);

// 수정 버튼
editBtn.addEventListener('click', () => {
  const memo = memos.find(m => m.id === currentMemoId);
  if (!memo) return;

  // 메모 내용을 입력창에 채우기
  memoInput.value = memo.content;
  currentEditingId = currentMemoId;

  // 중요 메모 상태 반영
  if (memo.isImportant) {
    starBtn.classList.add('active');
  } else {
    starBtn.classList.remove('active');
  }

  // 상세보기 닫기
  closeDetailView();

  // 입력창으로 스크롤
  memoInput.scrollIntoView({ behavior: 'smooth' });
  memoInput.focus();
});

// 공유 버튼 (Web Share API)
shareBtn.addEventListener('click', async () => {
  const memo = memos.find(m => m.id === currentMemoId);
  if (!memo) return;

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'SPARK 메모',
        text: memo.content
      });
    } catch (err) {
      console.log('공유 취소:', err);
    }
  } else {
    alert('이 브라우저는 공유 기능을 지원하지 않습니다.');
  }
});

// 복사 버튼 (Clipboard API)
copyBtn.addEventListener('click', async () => {
  const memo = memos.find(m => m.id === currentMemoId);
  if (!memo) return;

  try {
    await navigator.clipboard.writeText(memo.content);
    alert('클립보드에 복사되었습니다.');
  } catch (err) {
    alert('복사 실패: ' + err.message);
  }
});

// 삭제 버튼
deleteBtn.addEventListener('click', () => {
  if (!confirm('정말 삭제하시겠습니까?')) return;

  deleteMemo(currentMemoId);
  closeDetailView();
  renderMemos(getCurrentFilteredMemos());
});

// ========================================
// 더보기 메뉴
// ========================================

// 메뉴 토글
menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  menu.classList.toggle('active');
});

// 메뉴 외부 클릭 시 닫기
document.addEventListener('click', () => {
  menu.classList.remove('active');
});

menu.addEventListener('click', (e) => {
  e.stopPropagation();
});

// 다크모드 토글
darkModeBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('darkMode', isDark);
});

// 글자크기 변경
fontSizeSelect.addEventListener('change', () => {
  const size = fontSizeSelect.value;

  document.body.classList.remove('font-small', 'font-medium', 'font-large');
  document.body.classList.add(`font-${size}`);

  localStorage.setItem('fontSize', size);
});

// 메모 내보내기 (JSON)
exportBtn.addEventListener('click', () => {
  const dataStr = JSON.stringify(memos, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `spark-memos-${new Date().toISOString().split('T')[0]}.json`;
  a.click();

  URL.revokeObjectURL(url);
  alert('메모를 내보냈습니다.');
});

// 메모 가져오기 (JSON)
importBtn.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedMemos = JSON.parse(event.target.result);

        if (!Array.isArray(importedMemos)) {
          throw new Error('잘못된 파일 형식입니다.');
        }

        // 기존 메모와 병합 (중복 제거)
        const existingIds = new Set(memos.map(m => m.id));
        const newMemos = importedMemos.filter(m => !existingIds.has(m.id));

        memos = [...memos, ...newMemos];
        saveMemos();
        renderMemos(getCurrentFilteredMemos());

        alert(`${newMemos.length}개의 메모를 가져왔습니다.`);
      } catch (err) {
        alert('파일 불러오기 실패: ' + err.message);
      }
    };

    reader.readAsText(file);
  });

  input.click();
});

// ========================================
// 앱 초기화
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('SPARK 메모앱 시작');

  // 저장된 메모 불러오기
  loadMemos();

  // 다크모드 설정 불러오기
  const savedDarkMode = localStorage.getItem('darkMode');
  if (savedDarkMode === 'true') {
    document.body.classList.add('dark-mode');
  }

  // 글자크기 설정 불러오기
  const savedFontSize = localStorage.getItem('fontSize') || 'medium';
  fontSizeSelect.value = savedFontSize;
  document.body.classList.add(`font-${savedFontSize}`);

  // 메모 목록 렌더링
  renderMemos();
});
