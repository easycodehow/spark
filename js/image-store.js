// spark 이미지 저장소 (IndexedDB)
// LocalStorage(용량이 작음)와 분리해, 첨부 이미지 원본(base64)은 여기 저장하고
// 메모(js/app.js, LocalStorage)에는 이 저장소를 가리키는 id만 남긴다.

const IMAGE_DB_NAME = 'spark-images';
const IMAGE_DB_VERSION = 1;
const IMAGE_STORE_NAME = 'images';

let imageDbPromise = null;

function openImageDb() {
  if (imageDbPromise) return imageDbPromise;
  imageDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB_NAME, IMAGE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        db.createObjectStore(IMAGE_STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return imageDbPromise;
}

function generateImageId() {
  if (window.crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// base64(dataURL) 이미지를 저장하고 참조 id를 반환한다.
async function saveImage(base64) {
  const db = await openImageDb();
  const id = generateImageId();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
    tx.objectStore(IMAGE_STORE_NAME).put({ id, base64 });
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

// id로 이미지 base64를 가져온다. 없으면 null.
async function getImage(id) {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, 'readonly');
    const request = tx.objectStore(IMAGE_STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result ? request.result.base64 : null);
    request.onerror = () => reject(request.error);
  });
}

// id 배열로 base64 배열을 가져온다 (없는 항목은 결과에서 제외).
async function getImages(ids) {
  const results = await Promise.all(ids.map((id) => getImage(id)));
  return results.filter((base64) => base64 !== null);
}

// id 하나를 삭제한다.
async function deleteImage(id) {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
    tx.objectStore(IMAGE_STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// id 배열을 한 번에 삭제한다.
async function deleteImages(ids) {
  await Promise.all(ids.map((id) => deleteImage(id)));
}
