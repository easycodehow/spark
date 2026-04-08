// Service Worker — SPARK 메모앱

const CACHE_NAME = 'spark-v6';

// 오프라인에서도 동작할 파일 목록
const CACHE_FILES = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/sw-register.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/manifest.json',
  '/public/fonts/pretendard/woff2/Pretendard-Regular.woff2',
  '/public/fonts/pretendard/woff2/Pretendard-Medium.woff2',
  '/public/fonts/pretendard/woff2/Pretendard-SemiBold.woff2',
  '/public/fonts/pretendard/woff2/Pretendard-Bold.woff2',
];

/* =============================================
   install — 캐시 파일 저장
   ============================================= */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_FILES))
  );
  // 새 Service Worker 즉시 활성화
  self.skipWaiting();
});

/* =============================================
   activate — 이전 캐시 정리
   ============================================= */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  // 새 Service Worker가 즉시 모든 클라이언트를 제어
  self.clients.claim();
});

/* =============================================
   fetch — 캐시 우선, 실패 시 네트워크
   ============================================= */
self.addEventListener('fetch', (event) => {
  // POST 등 non-GET 요청은 캐시하지 않음
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // 유효한 응답만 캐시에 추가
        if (response && response.status === 200 && response.type === 'basic') {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return response;
      });
    })
  );
});
