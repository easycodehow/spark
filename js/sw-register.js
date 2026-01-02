// ========================================
// SPARK 메모앱 Service Worker 등록
// ========================================

// Service Worker 지원 여부 확인 및 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[SPARK] Service Worker 등록 성공:', registration.scope);

        // 업데이트 확인
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('[SPARK] Service Worker 업데이트 발견');

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[SPARK] 새 버전 사용 가능. 페이지를 새로고침하세요.');
            }
          });
        });
      })
      .catch((error) => {
        console.error('[SPARK] Service Worker 등록 실패:', error);
      });
  });
} else {
  console.warn('[SPARK] 이 브라우저는 Service Worker를 지원하지 않습니다.');
}
