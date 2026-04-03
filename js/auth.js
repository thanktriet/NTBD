// ============================================================
// auth.js — JWT helpers, login/logout, role guard
// ============================================================
// Dùng chung cho tất cả trang HTML.
// Cấu hình GAS_URL ở đây hoặc override trong từng trang.
// ============================================================

const AUTH = (() => {
  const TOKEN_KEY  = 'wms_token';
  const USER_KEY   = 'wms_user';

  // ── Lưu / lấy token ─────────────────────────────────────

  function saveSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY)) || null;
    } catch {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // ── Kiểm tra auth ────────────────────────────────────────

  /**
   * Kiểm tra token còn hạn hay không (decode local, không gọi API).
   * @returns {boolean}
   */
  function isLoggedIn() {
    const token = getToken();
    if (!token) return false;
    try {
      const payload = decodeJWTPayload(token);
      return payload && payload.exp > Math.floor(Date.now() / 1000);
    } catch {
      return false;
    }
  }

  /**
   * Decode payload của JWT (không verify signature — chỉ dùng để đọc data).
   * @param {string} token
   * @returns {Object|null}
   */
  function decodeJWTPayload(token) {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  }

  // ── Role guard ───────────────────────────────────────────

  /**
   * Gọi ở đầu mỗi trang để bảo vệ route.
   * Nếu chưa đăng nhập → redirect về index.html.
   * Nếu sai role → redirect về trang phù hợp.
   * @param {string|string[]} requiredRoles  VD: 'admin' hoặc ['admin','warehouse']
   */
  function requireRole(requiredRoles) {
    if (!isLoggedIn()) {
      redirectToLogin();
      return null;
    }
    const user = getUser();
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    if (!roles.includes(user?.role)) {
      redirectByRole(user?.role);
      return null;
    }
    return user;
  }

  function redirectToLogin() {
    if (!window.location.pathname.endsWith('index.html') &&
        !window.location.pathname.endsWith('/')) {
      window.location.href = 'index.html';
    }
  }

  function redirectByRole(role) {
    const map = { admin: 'admin.html', warehouse: 'warehouse.html', viewer: 'viewer.html' };
    window.location.href = map[role] || 'index.html';
  }

  // ── Login / Logout ───────────────────────────────────────

  /**
   * Đăng nhập: gọi GAS API, lưu token, redirect.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{success, message}>}
   */
  async function login(username, password) {
    try {
      const res = await API.post('auth.login', { username, password });
      if (!res.success) return { success: false, message: res.message };

      saveSession(res.data.token, {
        username: res.data.username,
        role:     res.data.role,
        fullName: res.data.fullName
      });

      redirectByRole(res.data.role);
      return { success: true };
    } catch (err) {
      return { success: false, message: 'Lỗi kết nối. Vui lòng thử lại.' };
    }
  }

  /**
   * Đăng xuất: xóa session, về trang login.
   */
  function logout() {
    clearSession();
    window.location.href = 'index.html';
  }

  // ── Public API ───────────────────────────────────────────
  return { saveSession, getToken, getUser, clearSession, isLoggedIn,
           decodeJWTPayload, requireRole, login, logout };
})();
