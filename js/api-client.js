// ============================================================
// api-client.js — Wrapper gọi GAS Web App API
// ============================================================
// ⚠️  CẤU HÌNH: Thay GAS_URL bằng URL Web App sau khi deploy.
// ============================================================

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyk2-0SR-5ZQY1_0bzEXXP08osJpTyvho8ZlTOLO60DDsz2ea-tvhrq0PKlweP-VM21/exec';

const API = (() => {

  // ── Core request ────────────────────────────────────────

  /**
   * Gọi GAS API bằng GET.
   * @param {string} action
   * @param {Object} [params={}]  Query params thêm vào
   * @returns {Promise<Object>}   Response JSON
   */
  async function get(action, params = {}) {
    const token = AUTH.getToken();
    const query = new URLSearchParams({ action, token, ...params }).toString();
    const res = await fetch(`${GAS_URL}?${query}`, {
      method: 'GET',
      redirect: 'follow'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  /**
   * Gọi GAS API bằng POST.
   * @param {string} action
   * @param {Object} [body={}]
   * @returns {Promise<Object>}
   */
  async function post(action, body = {}) {
    const token = AUTH.getToken();
    const res = await fetch(GAS_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' }, // GAS yêu cầu text/plain để không trigger CORS preflight
      body: JSON.stringify({ action, token, ...body })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  // ── Auth ─────────────────────────────────────────────────

  const auth = {
    login:  (username, password) => post('auth.login', { username, password }),
    verify: ()                   => get('auth.verify')
  };

  // ── Vehicles ─────────────────────────────────────────────

  const vehicles = {
    list:     (filters = {}) => get('vehicles.list', filters),
    get:      (vin)          => get('vehicles.get', { vin }),
    getByVin: (vin)          => get('vehicles.get', { vin }), // alias dùng trong warehouse.html

    /**
     * Import preview (không lưu).
     * @param {Object[]} rows
     */
    importPreview: (rows) => post('vehicles.import', { preview: true, rows }),

    /**
     * Import confirm (lưu hàng hợp lệ).
     * @param {Object[]} rows
     */
    importConfirm: (rows) => post('vehicles.import', { preview: false, rows }),

    updateSalesStatus: (vin, salesStatus) =>
      post('vehicles.updateSalesStatus', { vin, salesStatus })
  };

  // ── Warehouse operations ──────────────────────────────────

  const warehouse = {
    /**
     * Nhập kho.
     * @param {Object} data  { vin, warehouseId, zone, row, slot, photos[], performedBy }
     */
    inbound:  (data) => post('warehouse.inbound',  data),

    /**
     * Xuất kho.
     * @param {Object} data  { vin, deliverer, note, photos[], performedBy }
     */
    outbound: (data) => post('warehouse.outbound', data)
  };

  // ── Locations (vị trí kho) ────────────────────────────────

  const locations = {
    /** Danh sách khu trong một kho. */
    getZones:         (warehouseId)             => get('locations.zones',  { warehouseId }),

    /** Danh sách dãy trong một khu. */
    getRows:          (warehouseId, zone)        => get('locations.rows',   { warehouseId, zone }),

    /** Danh sách ô (kèm trạng thái chiếm dụng) trong một dãy. */
    getAvailableSlots:(warehouseId, zone, row)   => get('locations.slots',  { warehouseId, zone, row })
  };

  // ── Requests ─────────────────────────────────────────────

  const requests = {
    create:  (type, vin, customerName) =>
      post('requests.create', { type, vin, customerName }),
    list:    (filters = {}) => get('requests.list', filters),
    approve: (requestId, approved, note) =>
      post('requests.approve', { requestId, approved, note })
  };

  // ── Images ───────────────────────────────────────────────

  const images = {
    getUploadToken: (vin, type) => post('images.getUploadToken', { vin, type })
  };

  // ── Warehouses ───────────────────────────────────────────

  const warehouses = {
    list:   ()           => get('warehouses.list'),
    create: (data)       => post('warehouses.create', data),
    update: (id, data)   => post('warehouses.update', { id, ...data })
  };

  // ── Users ────────────────────────────────────────────────

  const users = {
    list:   ()     => post('users.list'),
    create: (data) => post('users.create', data),
    update: (data) => post('users.update', data)
  };

  // ── Logs ─────────────────────────────────────────────────

  const logs = {
    list: (filters = {}) => get('logs.list', filters)
  };

  // ── Error helper ─────────────────────────────────────────

  /**
   * Hiển thị lỗi từ API response.
   * @param {Object} res   API response object
   * @param {string} [fallback] Thông báo fallback
   * @returns {string}
   */
  function getErrorMessage(res, fallback) {
    return res?.message || fallback || 'Đã xảy ra lỗi. Vui lòng thử lại.';
  }

  return { get, post, auth, vehicles, warehouse, locations, requests, images, warehouses, users, logs, getErrorMessage };
})();
