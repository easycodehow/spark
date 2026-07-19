// spark 서비스 워커 — 오프라인 캐싱 담당

// 배포마다 캐시를 새로 채우기 위한 버전 이름 (파일 목록이 바뀌면 이 값을 올릴 것)
const CACHE_NAME = 'spark-cache-v9';

// 오프라인에서도 앱이 뜨는 데 필요한 핵심 파일 목록
const CACHE_FILES = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/sw-register.js',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
];

// 설치 시 핵심 파일을 캐시에 미리 저장
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_FILES))
  );
  // 새 서비스 워커를 바로 활성화 대기 상태로 전환 (재실행 시 최신 버전 즉시 반영)
  self.skipWaiting();
});

// 활성화 시 이전 버전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // 이미 열려 있는 페이지도 새 서비스 워커가 즉시 제어하도록 함
  self.clients.claim();
});

// 요청 시 캐시 우선, 없으면 네트워크 요청 (오프라인 지원)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // 정상 응답만 캐시에 추가로 저장해 다음 오프라인 접속에도 대비
          if (response && response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
