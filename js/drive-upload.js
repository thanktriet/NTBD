// ============================================================
// drive-upload.js — Upload ảnh thẳng lên Google Drive
// ============================================================
// Flow:
//   1. Gọi API.images.getUploadToken(vin, type) → { accessToken, folderId, uploadUrl }
//   2. Nén ảnh browser-side (max 1280px, quality 0.8)
//   3. Upload song song bằng Promise.all()
//   4. Trả về array preview URLs
// ============================================================

const DriveUpload = (() => {

  // ── Nén ảnh ─────────────────────────────────────────────

  const MAX_WIDTH  = 1280;
  const MAX_HEIGHT = 1280;
  const QUALITY    = 0.82;

  /**
   * Nén một File ảnh về max 1280px, quality 0.82.
   * Giảm ~70-80% dung lượng so với ảnh gốc từ điện thoại.
   * @param {File} file
   * @returns {Promise<Blob>}
   */
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        let { width, height } = img;

        // Tính tỉ lệ scale để không vượt MAX
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(blob => {
          if (!blob) reject(new Error('Không thể nén ảnh'));
          else resolve(blob);
        }, 'image/jpeg', QUALITY);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Không thể load ảnh: ' + file.name));
      };

      img.src = url;
    });
  }

  // ── Upload một file lên Drive ────────────────────────────

  /**
   * Upload một Blob lên Google Drive folder.
   * @param {Blob}   blob
   * @param {string} fileName
   * @param {string} folderId    Drive folder ID
   * @param {string} accessToken OAuth token từ GAS
   * @param {string} uploadUrl   Drive upload endpoint
   * @returns {Promise<string>}  Preview URL của file vừa upload
   */
  async function uploadOneToDrive(blob, fileName, folderId, accessToken, uploadUrl) {
    const metadata = {
      name:    fileName,
      parents: [folderId]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob, fileName);

    const res = await fetch(uploadUrl, {
      method:  'POST',
      headers: { Authorization: 'Bearer ' + accessToken },
      body:    form
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error('Upload thất bại (' + res.status + '): ' + err);
    }

    const data  = await res.json();
    const fileId = data.id;

    // Đặt file ở chế độ "Anyone with link can view" để hiển thị trên web
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method:  'POST',
      headers: {
        Authorization:  'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });

    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  // ── Upload nhiều ảnh song song ───────────────────────────

  /**
   * Upload tối đa 10 ảnh cho một VIN.
   * @param {File[]}   files      Mảng File objects từ <input type="file">
   * @param {string}   vin        VIN xe
   * @param {string}   type       'INBOUND' hoặc 'OUTBOUND'
   * @param {Function} [onProgress]  Callback(completedCount, totalCount)
   * @returns {Promise<string[]>}  Mảng preview URLs
   */
  async function uploadPhotos(files, vin, type, onProgress) {
    if (!files || files.length === 0) return [];
    if (files.length > 10) throw new Error('Tối đa 10 ảnh. Đã chọn: ' + files.length);

    // Lấy upload token từ GAS
    const tokenRes = await API.images.getUploadToken(vin, type);
    if (!tokenRes.success) throw new Error(tokenRes.message || 'Không lấy được upload token');

    const { accessToken, folderId, uploadUrl } = tokenRes.data;

    // Nén + upload song song
    let completed = 0;
    const uploadPromises = Array.from(files).map(async (file, idx) => {
      const blob     = await compressImage(file);
      const fileName = `${vin}_${type}_${Date.now()}_${idx + 1}.jpg`;
      const url      = await uploadOneToDrive(blob, fileName, folderId, accessToken, uploadUrl);
      completed++;
      if (onProgress) onProgress(completed, files.length);
      return url;
    });

    return Promise.all(uploadPromises);
  }

  // ── Preview URLs từ File objects (local, trước khi upload) ─

  /**
   * Tạo object URL tạm để preview ảnh trước khi upload.
   * Nhớ gọi URL.revokeObjectURL() sau khi không dùng nữa.
   * @param {File} file
   * @returns {string}
   */
  function createLocalPreview(file) {
    return URL.createObjectURL(file);
  }

  return { uploadPhotos, compressImage, createLocalPreview };
})();
