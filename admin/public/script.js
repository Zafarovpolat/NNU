let currentRejectId = null;
let currentCourseId = null;
let allPurchases = [];
let allCourses = [];
let currentLessons = [];

// Проверка авторизации
function checkAuth() {
  const token = localStorage.getItem('admin_token');

  if (!token) {
    window.location.href = '/login';
    return false;
  }

  // Проверяем токен на сервере
  fetch('/api/auth/verify', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
    .then(res => {
      if (!res.ok) {
        throw new Error('Invalid token');
      }
      return res.json();
    })
    .then(data => {
      // Обновляем имя админа
      const adminName = localStorage.getItem('admin_name') || data.admin.username;
      document.getElementById('adminName').textContent = adminName;
    })
    .catch(() => {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_name');
      window.location.href = '/login';
    });

  return true;
}

// Проверяем при загрузке
if (!checkAuth()) {
  throw new Error('Not authenticated');
}

// Улучшенная обработка fetch с логированием
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const token = localStorage.getItem('admin_token');

  // Добавляем токен
  if (token) {
    if (args[1]) {
      args[1].headers = {
        ...args[1].headers,
        'Authorization': `Bearer ${token}`
      };
    } else {
      args[1] = {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };
    }
  }

  try {
    const response = await originalFetch.apply(this, args);

    // Логируем ошибки
    if (!response.ok) {
      console.error(`❌ Fetch error: ${args[0]} - ${response.status} ${response.statusText}`);
    }

    return response;
  } catch (error) {
    console.error(`❌ Network error: ${args[0]}`, error);
    throw error;
  }
};

// Функция выхода
function logout() {
  if (confirm('Chiqishni xohlaysizmi?')) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_name');
    window.location.href = '/login';
  }
}

// Переключение табов
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    switchTab(tab);
  });
});

function switchTab(tabName) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  const activeTab = document.getElementById(tabName);
  if (activeTab) activeTab.classList.add('active');

  const titles = {
    'dashboard': 'Dashboard',
    'purchases': 'To\'lovlar',
    'courses': 'Kurslar',
    'users': 'Foydalanuvchilar',
    'admins': 'Adminlar'
  };
  document.getElementById('pageTitle').textContent = titles[tabName] || tabName;

  // Загружаем данные для конкретного таба
  if (tabName === 'users') loadUsers();
  if (tabName === 'admins') loadAdmins();

  if (window.innerWidth <= 768) {
    document.querySelector('.sidebar').classList.remove('active');
  }
}

// Мобильное меню
document.getElementById('menuToggle')?.addEventListener('click', () => {
  document.querySelector('.sidebar').classList.toggle('active');
});

// Toast уведомления
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 5000);
}

// === СТАТИСТИКА ===
async function loadStats() {
  try {
    const response = await fetch('/api/stats');
    const stats = await response.json();

    document.getElementById('totalUsers').textContent = stats.totalUsers.toLocaleString();
    document.getElementById('pendingPayments').textContent = stats.pendingPayments.toLocaleString();
    document.getElementById('confirmedPayments').textContent = stats.confirmedPayments.toLocaleString();
    document.getElementById('totalRevenue').textContent = stats.totalRevenue.toLocaleString();

    const badge = document.getElementById('pendingBadge');
    if (badge) {
      badge.textContent = stats.pendingPayments;
      badge.style.display = stats.pendingPayments > 0 ? 'inline-block' : 'none';
    }
  } catch (error) {
    console.error('Ошибка загрузки статистики:', error);
  }
}

// === ПОКУПКИ ===
async function loadPurchases() {
  try {
    const response = await fetch('/api/purchases');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Проверяем что data это массив
    if (!Array.isArray(data)) {
      console.error('Получены некорректные данные:', data);
      throw new Error(data.error || 'Некорректный формат данных');
    }

    allPurchases = data;
    displayPurchases(allPurchases);
    displayRecentPayments(allPurchases.slice(0, 5));
    loadStats();
  } catch (error) {
    console.error('Ошибка загрузки покупок:', error);
    showToast('Ошибка загрузки покупок: ' + error.message, 'error');

    // Показываем ошибку в таблице
    const tbody = document.getElementById('purchasesTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="loading-row">
            <div style="padding: 60px 20px; text-align: center; color: #dc3545;">
              <p style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">❌ Xatolik</p>
              <p style="font-size: 14px;">${error.message}</p>
            </div>
          </td>
        </tr>
      `;
    }
  }
}

function displayPurchases(purchases) {
  const tbody = document.getElementById('purchasesTableBody');
  tbody.innerHTML = '';

  if (purchases.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="loading-row">
          <div style="padding: 60px 20px; text-align: center; color: #6c757d;">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 16px; opacity: 0.3;">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Hech qanday to'lov topilmadi</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  purchases.forEach(p => {
    let statusBadge = '';
    let receiptInfo = '';
    let actionButtons = '';

    switch (p.status) {
      case 'waiting_confirmation':
        statusBadge = '<span class="badge badge-waiting">⏳ Kutilmoqda</span>';
        actionButtons = `
          <div class="action-buttons">
            <button class="btn-success" onclick="confirmPayment(${p.id})" id="confirm-${p.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Tasdiqlash
            </button>
            <button class="btn-danger" onclick="openRejectModal(${p.id})" style="padding: 10px 16px; font-size: 13px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Rad etish
            </button>
          </div>
        `;
        break;
      case 'paid':
        statusBadge = '<span class="badge badge-paid">✅ To\'langan</span>';
        actionButtons = `<span style="color: #28a745; font-size: 13px; font-weight: 600;">✓ Tasdiqlangan</span>`;
        break;
      case 'rejected':
        statusBadge = '<span class="badge badge-rejected">❌ Rad etilgan</span>';
        actionButtons = '-';
        break;
      default:
        statusBadge = '<span class="badge badge-pending">Pending</span>';
        actionButtons = '-';
    }

    // Информация о чеке
    if (p.payment_proof) {
      if (p.payment_proof_type === 'photo' || p.payment_proof_type === 'document') {
        receiptInfo = `<button class="btn-primary" onclick="viewReceipt('${p.payment_proof}', '${p.payment_proof_type}')" style="padding: 6px 12px; font-size: 12px;">📎 Ko'rish</button>`;
      } else if (p.payment_proof_type === 'link') {
        receiptInfo = `<a href="${p.payment_proof}" target="_blank" style="font-size: 12px;">🔗 Havola</a>`;
      }
    } else {
      receiptInfo = '-';
    }

    const icon = p.course_type === 'course' ? '📚' : p.course_type === 'book' ? '📖' : '🎥';

    const row = `
      <tr>
        <td><strong style="color: var(--primary);">#${p.id}</strong></td>
        <td>
          <div style="font-weight: 600; margin-bottom: 4px;">${p.full_name || 'N/A'}</div>
          <div style="font-size: 12px; color: #6c757d;">@${p.username || p.telegram_id}</div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">${icon}</span>
            <span style="font-weight: 500;">${p.course_title}</span>
          </div>
        </td>
        <td><strong style="color: var(--primary); font-size: 15px;">${p.amount.toLocaleString()}</strong> <span style="font-size: 12px; color: #6c757d;">so'm</span></td>
        <td><span style="text-transform: capitalize; font-weight: 500;">${p.payment_type}</span></td>
        <td>${statusBadge}</td>
        <td>${receiptInfo}</td>
        <td style="font-size: 13px; color: #6c757d;">
          ${formatDate(p.created_at)}
        </td>
        <td>${actionButtons}</td>
      </tr>
    `;

    tbody.innerHTML += row;
  });
}

function displayRecentPayments(purchases) {
  const container = document.getElementById('recentPayments');

  if (!purchases || purchases.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #6c757d;">
        <p>Hech qanday to'lov yo'q</p>
      </div>
    `;
    return;
  }

  container.innerHTML = purchases.map(p => {
    const icon = p.course_type === 'course' ? '📚' : p.course_type === 'book' ? '📖' : '🎥';
    const statusColor = p.status === 'paid' ? '#28a745' : p.status === 'waiting_confirmation' ? '#ffc107' : '#dc3545';

    return `
      <div style="padding: 16px 24px; border-bottom: 1px solid #e9ecef; display: flex; align-items: center; gap: 16px; transition: background 0.2s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">
        <div style="font-size: 28px;">${icon}</div>
        <div style="flex: 1;">
          <div style="font-weight: 600; margin-bottom: 4px; color: #212529;">${p.course_title}</div>
          <div style="font-size: 13px; color: #6c757d;">${p.full_name || 'N/A'} • ${formatDate(p.created_at)}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 700; font-size: 16px; color: var(--primary); margin-bottom: 4px;">${p.amount.toLocaleString()} so'm</div>
          <div style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor}; margin-left: auto;"></div>
        </div>
      </div>
    `;
  }).join('');
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) {
    return `${minutes} daqiqa oldin`;
  } else if (hours < 24) {
    return `${hours} soat oldin`;
  } else if (days < 7) {
    return `${days} kun oldin`;
  } else {
    return date.toLocaleDateString('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

function filterPurchases() {
  const status = document.getElementById('statusFilter').value;

  if (status === '') {
    displayPurchases(allPurchases);
  } else {
    const filtered = allPurchases.filter(p => p.status === status);
    displayPurchases(filtered);
  }
}

async function confirmPayment(id) {
  if (!confirm('To\'lovni tasdiqlaysizmi?\n\nFoydalanuvchiga xabar yuboriladi.')) return;

  const btn = document.getElementById(`confirm-${id}`);
  const originalHTML = btn ? btn.innerHTML : '';

  if (btn) {
    btn.classList.add('loading');
    btn.disabled = true;
    btn.style.minWidth = btn.offsetWidth + 'px'; // Фиксируем ширину
  }

  try {
    const response = await fetch(`/api/purchases/${id}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (result.success) {
      if (result.warning) {
        showToast('⚠️ ' + result.message, 'warning');
      } else {
        showToast('✅ To\'lov tasdiqlandi! Foydalanuvchiga xabar yuborildi.', 'success');
      }
      loadPurchases();
    } else {
      showToast('❌ Xatolik: ' + (result.error || 'Noma\'lum xatolik'), 'error');
      if (btn) {
        btn.classList.remove('loading');
        btn.disabled = false;
        btn.innerHTML = originalHTML;
      }
    }
  } catch (error) {
    console.error('Ошибка подтверждения:', error);
    showToast('❌ Xatolik yuz berdi', 'error');
    if (btn) {
      btn.classList.remove('loading');
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }
}

function openRejectModal(id) {
  currentRejectId = id;
  document.getElementById('rejectModal').classList.add('active');
  document.getElementById('rejectReason').value = '';
  document.getElementById('rejectReason').focus();
}

function closeRejectModal() {
  document.getElementById('rejectModal').classList.remove('active');
  currentRejectId = null;
}

async function confirmReject() {
  if (!currentRejectId) return;

  const reason = document.getElementById('rejectReason').value;

  try {
    const response = await fetch(`/api/purchases/${currentRejectId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });

    const result = await response.json();

    if (result.success) {
      showToast('✅ To\'lov rad etildi! Foydalanuvchiga xabar yuborildi.', 'success');
      closeRejectModal();
      loadPurchases();
    } else {
      showToast('❌ Xatolik: ' + (result.error || 'Noma\'lum xatolik'), 'error');
    }
  } catch (error) {
    console.error('Ошибка отклонения:', error);
    showToast('❌ Xatolik yuz berdi', 'error');
  }
}

// Просмотр чека
function viewReceipt(proof, type) {
  const modal = document.getElementById('receiptModal');
  const content = document.getElementById('receiptContent');

  modal.classList.add('active');

  if (type === 'photo') {
    content.innerHTML = `<img src="/uploads/receipts/${proof}" class="receipt-preview" alt="Chek">`;
  } else if (type === 'document') {
    content.innerHTML = `
      <p style="margin-bottom: 16px;">📄 Hujjat</p>
      <a href="/uploads/receipts/${proof}" target="_blank" class="receipt-link">Yuklab olish</a>
    `;
  }
}

function closeReceiptModal() {
  document.getElementById('receiptModal').classList.remove('active');
}

// === КУРСЫ ===
async function loadCourses() {
  try {
    const response = await fetch('/api/courses');
    allCourses = await response.json();

    displayCoursesGrid(allCourses);
    displayCoursesStats(allCourses);
  } catch (error) {
    console.error('Ошибка загрузки курсов:', error);
  }
}

function displayCoursesGrid(courses) {
  const grid = document.getElementById('coursesGrid');

  if (courses.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
        <h3>Kurslar yo'q</h3>
        <p>Yangi kurs qo'shish uchun yuqoridagi tugmani bosing</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = courses.map(c => {
    const icon = c.type === 'course' ? '📚' : c.type === 'book' ? '📖' : '🎥';
    const typeText = c.type === 'course' ? 'Kurs' : c.type === 'book' ? 'Kitob' : 'Video';

    return `
      <div class="course-card">
        <div class="course-header">
          <div class="course-icon">${icon}</div>
          <h4 class="course-title">${c.title}</h4>
          <p class="course-type">${typeText}</p>
        </div>
        <div class="course-body">
          <div class="course-info">
            <div class="info-row">
              <span class="info-label">Darslar:</span>
              <span class="info-value">${c.lessons_count}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Davomiyligi:</span>
              <span class="info-value">${c.duration}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Narx (to'liq):</span>
              <span class="info-value" style="color: var(--primary);">${c.price_full.toLocaleString()} so'm</span>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            ${c.type === 'course' ? `<button class="btn-primary" onclick="openLessonsModal(${c.id})" style="flex: 1; margin: 0; padding: 10px; font-size: 13px;">📚 Darslar</button>` : ''}
            <button class="btn-primary" onclick="editCourse(${c.id})" style="flex: 1; margin: 0; padding: 10px; font-size: 13px;">✏️ Tahrirlash</button>
            <button class="btn-danger" onclick="deleteCourse(${c.id})" style="padding: 10px 12px; font-size: 13px;">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function displayCoursesStats(courses) {
  const container = document.getElementById('coursesStats');

  const courseCount = courses.filter(c => c.type === 'course').length;
  const bookCount = courses.filter(c => c.type === 'book').length;
  const videoCount = courses.filter(c => c.type === 'video').length;

  container.innerHTML = `
    <div style="padding: 24px;">
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 14px; color: #6c757d;">📚 Kurslar</span>
          <span style="font-weight: 700; font-size: 18px; color: var(--primary);">${courseCount}</span>
        </div>
        <div style="height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden;">
          <div style="height: 100%; background: linear-gradient(90deg, var(--primary), var(--primary-dark)); width: ${courseCount > 0 ? (courseCount / courses.length * 100) : 0}%;"></div>
        </div>
      </div>
      
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 14px; color: #6c757d;">📖 Kitoblar</span>
          <span style="font-weight: 700; font-size: 18px; color: #667eea;">${bookCount}</span>
        </div>
        <div style="height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden;">
          <div style="height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); width: ${bookCount > 0 ? (bookCount / courses.length * 100) : 0}%;"></div>
        </div>
      </div>
      
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 14px; color: #6c757d;">🎥 Video kurslar</span>
          <span style="font-weight: 700; font-size: 18px; color: #28a745;">${videoCount}</span>
        </div>
        <div style="height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden;">
          <div style="height: 100%; background: linear-gradient(90deg, #4facfe, #00f2fe); width: ${videoCount > 0 ? (videoCount / courses.length * 100) : 0}%;"></div>
        </div>
      </div>
    </div>
    
    <div style="padding: 16px 24px; background: #f8f9fa; border-top: 1px solid #e9ecef;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 600; color: #212529;">Jami:</span>
        <span style="font-weight: 700; font-size: 24px; color: var(--primary);">${courses.length}</span>
      </div>
    </div>
  `;
}

// Модал для курса
function openCourseModal(courseId = null) {
  currentCourseId = courseId;
  const modal = document.getElementById('courseModal');
  const form = document.getElementById('courseForm');

  form.reset();

  if (courseId) {
    document.getElementById('courseModalTitle').textContent = 'Kursni tahrirlash';
    const course = allCourses.find(c => c.id === courseId);

    if (course) {
      document.getElementById('courseId').value = course.id;
      document.getElementById('courseTitle').value = course.title;
      document.getElementById('courseDescription').value = course.description;
      document.getElementById('courseType').value = course.type;
      document.getElementById('courseLessonsCount').value = course.lessons_count;
      document.getElementById('courseDuration').value = course.duration;
      document.getElementById('coursePriceFull').value = course.price_full;
      document.getElementById('coursePriceMonthly').value = course.price_monthly;
      document.getElementById('coursePriceSingle').value = course.price_single;
      document.getElementById('courseFileUrl').value = course.file_url || '';

      toggleCourseFields();
    }
  } else {
    document.getElementById('courseModalTitle').textContent = 'Yangi kurs qo\'shish';
    toggleCourseFields();
  }

  modal.classList.add('active');
}

function closeCourseModal() {
  document.getElementById('courseModal').classList.remove('active');
  currentCourseId = null;
}

function toggleCourseFields() {
  const type = document.getElementById('courseType').value;

  // Для книги и видео показываем поле для файла
  const fileUrlGroup = document.getElementById('fileUrlGroup');
  const lessonsCountGroup = document.getElementById('lessonsCountGroup');
  const priceMonthlyGroup = document.getElementById('priceMonthlyGroup');

  if (type === 'book' || type === 'video') {
    fileUrlGroup.style.display = 'block';
    lessonsCountGroup.style.display = 'none';
    priceMonthlyGroup.style.display = 'none';
  } else {
    fileUrlGroup.style.display = 'none';
    lessonsCountGroup.style.display = 'block';
    priceMonthlyGroup.style.display = 'block';
  }
}

// Сохранение курса
document.getElementById('courseForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const courseData = {
    title: document.getElementById('courseTitle').value,
    description: document.getElementById('courseDescription').value,
    type: document.getElementById('courseType').value,
    lessons_count: parseInt(document.getElementById('courseLessonsCount').value) || 1,
    duration: document.getElementById('courseDuration').value,
    price_full: parseFloat(document.getElementById('coursePriceFull').value) || 0,
    price_monthly: parseFloat(document.getElementById('coursePriceMonthly').value) || 0,
    price_single: parseFloat(document.getElementById('coursePriceSingle').value) || 0,
    file_url: document.getElementById('courseFileUrl').value || null
  };

  const btn = document.getElementById('saveCourseBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const url = currentCourseId ? `/api/courses/${currentCourseId}` : '/api/courses';
    const method = currentCourseId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(courseData)
    });

    const result = await response.json();

    if (result.success) {
      showToast(`✅ Kurs ${currentCourseId ? 'yangilandi' : 'qo\'shildi'}!`, 'success');
      closeCourseModal();
      loadCourses();
    } else {
      showToast('❌ Xatolik: ' + (result.error || 'Noma\'lum xatolik'), 'error');
    }
  } catch (error) {
    console.error('Ошибка сохранения курса:', error);
    showToast('❌ Xatolik yuz berdi', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
});

function editCourse(id) {
  openCourseModal(id);
}

async function deleteCourse(id) {
  if (!confirm('Bu kursni o\'chirmoqchimisiz?\n\nBu amalni qaytarib bo\'lmaydi!')) return;

  try {
    const response = await fetch(`/api/courses/${id}`, { method: 'DELETE' });
    const result = await response.json();

    if (result.success) {
      showToast('✅ Kurs o\'chirildi!', 'success');
      loadCourses();
    } else {
      showToast('❌ Xatolik', 'error');
    }
  } catch (error) {
    console.error('Ошибка удаления курса:', error);
    showToast('❌ Xatolik yuz berdi', 'error');
  }
}

// === УРОКИ ===
async function openLessonsModal(courseId) {
  currentCourseId = courseId;
  const course = allCourses.find(c => c.id === courseId);

  document.getElementById('lessonsModalTitle').textContent = `Darslar: ${course.title}`;

  try {
    const response = await fetch(`/api/courses/${courseId}/lessons`);
    currentLessons = await response.json();

    displayLessons();
    document.getElementById('lessonsModal').classList.add('active');
  } catch (error) {
    console.error('Ошибка загрузки уроков:', error);
    showToast('❌ Xatolik yuz berdi', 'error');
  }
}

function closeLessonsModal() {
  document.getElementById('lessonsModal').classList.remove('active');
  currentCourseId = null;
  currentLessons = [];
}

function displayLessons() {
  const container = document.getElementById('lessonsList');

  if (currentLessons.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 20px;">Darslar yo\'q. Qo\'shish uchun tugmani bosing.</p>';
    return;
  }

  container.innerHTML = currentLessons.map((lesson, index) => `
    <div class="lesson-row" data-lesson-index="${index}">
      <input 
        type="number" 
        value="${lesson.order_num}" 
        min="1" 
        data-field="order"
        onchange="updateLessonData(${index}, 'order_num', this.value)"
      >
      <input 
        type="text" 
        value="${lesson.title}" 
        data-field="title" 
        placeholder="Dars nomi"
        onchange="updateLessonData(${index}, 'title', this.value)"
        oninput="updateLessonData(${index}, 'title', this.value)"
      >
      <input 
        type="text" 
        value="${lesson.video_url || ''}" 
        data-field="url" 
        placeholder="Video URL"
        onchange="updateLessonData(${index}, 'video_url', this.value)"
        oninput="updateLessonData(${index}, 'video_url', this.value)"
      >
      <button type="button" class="btn-icon" onclick="removeLesson(${index})">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('');
}

// Обновление данных урока без перерисовки
function updateLessonData(index, field, value) {
  if (currentLessons[index]) {
    currentLessons[index][field] = value;
    console.log(`Обновлен урок ${index}, поле ${field}:`, value);
  }
}

function addLessonRow() {
  const newLesson = {
    id: null,
    course_id: currentCourseId,
    order_num: currentLessons.length + 1,
    title: '',
    video_url: ''
  };

  currentLessons.push(newLesson);

  // Перерисовываем только если список был пуст
  if (currentLessons.length === 1) {
    displayLessons();
  } else {
    // Добавляем только новую строку
    const container = document.getElementById('lessonsList');
    const index = currentLessons.length - 1;

    const newRow = document.createElement('div');
    newRow.className = 'lesson-row';
    newRow.dataset.lessonIndex = index;
    newRow.innerHTML = `
      <input 
        type="number" 
        value="${newLesson.order_num}" 
        min="1" 
        data-field="order"
        onchange="updateLessonData(${index}, 'order_num', this.value)"
      >
      <input 
        type="text" 
        value="${newLesson.title}" 
        data-field="title" 
        placeholder="Dars nomi"
        onchange="updateLessonData(${index}, 'title', this.value)"
        oninput="updateLessonData(${index}, 'title', this.value)"
      >
      <input 
        type="text" 
        value="${newLesson.video_url || ''}" 
        data-field="url" 
        placeholder="Video URL"
        onchange="updateLessonData(${index}, 'video_url', this.value)"
        oninput="updateLessonData(${index}, 'video_url', this.value)"
      >
      <button type="button" class="btn-icon" onclick="removeLesson(${index})">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    container.appendChild(newRow);

    // Фокусируемся на новое поле
    newRow.querySelector('input[data-field="title"]').focus();
  }
}

function removeLesson(index) {
  if (confirm('Bu darsni o\'chirmoqchimisiz?')) {
    currentLessons.splice(index, 1);
    displayLessons(); // Перерисовываем весь список
  }
}

async function saveLessons() {
  // Собираем финальные данные из инпутов
  const rows = document.querySelectorAll('.lesson-row');
  const lessonsToSave = [];

  rows.forEach((row, idx) => {
    const index = parseInt(row.dataset.lessonIndex);
    const lesson = currentLessons[index];

    if (lesson && lesson.title && lesson.title.trim()) {
      lessonsToSave.push({
        id: lesson.id,
        order_num: lesson.order_num,
        title: lesson.title,
        video_url: lesson.video_url
      });
    }
  });

  if (lessonsToSave.length === 0) {
    showToast('❌ Kamida bitta dars qo\'shing', 'error');
    return;
  }

  try {
    // Удаляем старые уроки которые были удалены
    for (const lesson of currentLessons) {
      if (lesson.id && !lessonsToSave.find(l => l.id === lesson.id)) {
        await fetch(`/api/lessons/${lesson.id}`, { method: 'DELETE' });
      }
    }

    // Сохраняем новые и обновленные
    for (const lesson of lessonsToSave) {
      if (lesson.id) {
        await fetch(`/api/lessons/${lesson.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lesson)
        });
      } else {
        await fetch('/api/lessons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...lesson, course_id: currentCourseId })
        });
      }
    }

    // Обновляем количество уроков в курсе
    await fetch(`/api/courses/${currentCourseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...allCourses.find(c => c.id === currentCourseId),
        lessons_count: lessonsToSave.length
      })
    });

    showToast('✅ Darslar saqlandi!', 'success');
    closeLessonsModal();
    loadCourses();
  } catch (error) {
    console.error('Ошибка сохранения уроков:', error);
    showToast('❌ Xatolik yuz berdi', 'error');
  }
}

// === ПОЛЬЗОВАТЕЛИ ===
// === ПОЛЬЗОВАТЕЛИ ===
async function loadUsers() {
  console.log('📥 Загрузка пользователей...');

  const tbody = document.getElementById('usersTableBody');

  if (!tbody) {
    console.error('❌ Элемент usersTableBody не найден в DOM!');
    console.log('Доступные элементы tbody:', Array.from(document.querySelectorAll('tbody')).map(el => el.id));
    return;
  }

  // Показываем loader
  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="loading-row">
        <div class="spinner"></div>
        <p>Yuklanmoqda...</p>
      </td>
    </tr>
  `;

  try {
    const response = await fetch('/api/users');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const users = await response.json();

    console.log(`✅ Загружено пользователей: ${users.length}`, users);

    displayUsers(users);
  } catch (error) {
    console.error('❌ Ошибка загрузки пользователей:', error);

    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="loading-row">
          <div style="padding: 40px; text-align: center; color: #dc3545;">
            <p style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">❌ Xatolik</p>
            <p style="font-size: 14px;">${error.message}</p>
          </div>
        </td>
      </tr>
    `;

    showToast('Foydalanuvchilarni yuklashda xatolik', 'error');
  }
}

function displayUsers(users) {
  console.log('🎨 Отображение пользователей:', users.length);

  const tbody = document.getElementById('usersTableBody');

  if (!tbody) {
    console.error('❌ Элемент usersTableBody не найден при отображении!');
    return;
  }

  // Очищаем таблицу
  tbody.innerHTML = '';

  if (!users || users.length === 0) {
    console.log('ℹ️ Пользователи не найдены');
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="loading-row">
          <div style="padding: 60px 20px; text-align: center; color: #6c757d;">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 16px; opacity: 0.3;">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <p style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Foydalanuvchilar yo'q</p>
            <p style="font-size: 14px; opacity: 0.7;">Hali hech kim botni ishlatmagan</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  console.log('✅ Создание строк для', users.length, 'пользователей');

  let rowsHTML = '';

  users.forEach((u, index) => {
    console.log(`Создание строки ${index + 1}:`, u);

    const row = `
      <tr>
        <td><strong>${u.id}</strong></td>
        <td>
          <div style="font-weight: 600; margin-bottom: 4px;">${u.full_name || 'N/A'}</div>
          <div style="font-size: 11px; color: #6c757d;">ID: ${u.telegram_id}</div>
        </td>
        <td>${u.username ? '@' + u.username : '-'}</td>
        <td><code style="font-size: 12px; background: #f8f9fa; padding: 4px 8px; border-radius: 4px;">${u.telegram_id}</code></td>
        <td>
          <span style="display: inline-block; background: var(--primary); color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
            ${u.purchases_count || 0}
          </span>
        </td>
        <td><strong style="color: var(--primary);">${(u.total_spent || 0).toLocaleString()}</strong> <span style="font-size: 12px; color: #6c757d;">so'm</span></td>
        <td style="font-size: 13px; color: #6c757d;">${formatDate(u.created_at)}</td>
      </tr>
    `;

    rowsHTML += row;
  });

  tbody.innerHTML = rowsHTML;

  console.log('✅ Таблица обновлена');
}

// Поиск пользователей
function initUserSearch() {
  const searchInput = document.getElementById('searchUsers');

  if (!searchInput) {
    console.log('⚠️ Поле поиска пользователей не найдено');
    return;
  }

  searchInput.addEventListener('input', (e) => {
    const search = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#usersTableBody tr');

    console.log(`🔍 Поиск: "${search}", строк: ${rows.length}`);

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(search) ? '' : 'none';
    });
  });
}

// Поиск пользователей
document.getElementById('searchUsers')?.addEventListener('input', (e) => {
  const search = e.target.value.toLowerCase();
  const rows = document.querySelectorAll('#usersTableBody tr');

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(search) ? '' : 'none';
  });
});

// === АДМИНЫ ===
async function loadAdmins() {
  try {
    const response = await fetch('/api/admins');
    const admins = await response.json();

    displayAdmins(admins);
  } catch (error) {
    console.error('Ошибка загрузки админов:', error);
  }
}

function displayAdmins(admins) {
  const grid = document.getElementById('adminsGrid');

  grid.innerHTML = admins.map(admin => {
    const initial = admin.full_name.charAt(0).toUpperCase();
    const isSuperAdmin = admin.id === 1;

    return `
      <div class="admin-card">
        <div class="admin-card-header">
          <div class="admin-avatar">${initial}</div>
          <div class="admin-info">
            <h4>${admin.full_name} ${isSuperAdmin ? '⭐' : ''}</h4>
            <p>@${admin.username}</p>
          </div>
        </div>
        <div class="admin-card-body">
          <div class="admin-meta">
            <div class="admin-meta-item">
              <span>📅</span>
              <span>Qo'shilgan: ${formatDate(admin.created_at)}</span>
            </div>
            ${admin.last_login ? `
              <div class="admin-meta-item">
                <span>🕐</span>
                <span>Oxirgi kirish: ${formatDate(admin.last_login)}</span>
              </div>
            ` : ''}
          </div>
          ${!isSuperAdmin ? `
            <button class="btn-danger" onclick="deleteAdmin(${admin.id})" style="width: 100%; font-size: 13px;">
              O'chirish
            </button>
          ` : '<p style="text-align: center; color: #6c757d; font-size: 12px;">Super Admin</p>'}
        </div>
      </div>
    `;
  }).join('');
}

function openAddAdminModal() {
  document.getElementById('addAdminModal').classList.add('active');
  document.getElementById('addAdminForm').reset();
}

function closeAddAdminModal() {
  document.getElementById('addAdminModal').classList.remove('active');
}

document.getElementById('addAdminForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    username: document.getElementById('adminUsername').value,
    password: document.getElementById('adminPassword').value,
    full_name: document.getElementById('adminFullName').value
  };

  try {
    const response = await fetch('/api/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (result.success) {
      showToast('✅ Admin qo\'shildi!', 'success');
      closeAddAdminModal();
      loadAdmins();
    } else {
      showToast('❌ ' + (result.error || 'Xatolik'), 'error');
    }
  } catch (error) {
    console.error('Ошибка добавления админа:', error);
    showToast('❌ Xatolik yuz berdi', 'error');
  }
});

async function deleteAdmin(id) {
  if (!confirm('Bu adminni o\'chirmoqchimisiz?')) return;

  try {
    const response = await fetch(`/api/admins/${id}`, { method: 'DELETE' });
    const result = await response.json();

    if (result.success) {
      showToast('✅ Admin o\'chirildi', 'success');
      loadAdmins();
    } else {
      showToast('❌ Xatolik', 'error');
    }
  } catch (error) {
    console.error('Ошибка удаления админа:', error);
    showToast('❌ Xatolik yuz berdi', 'error');
  }
}

// === ПРОФИЛЬ ===
let currentAdminData = null;

async function loadProfile() {
  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json();

    if (data.admin) {
      currentAdminData = data.admin;
      displayProfile(data.admin);
    }
  } catch (error) {
    console.error('Ошибка загрузки профиля:', error);
  }
}

function displayProfile(admin) {
  const initial = admin.full_name.charAt(0).toUpperCase();

  document.getElementById('profileAvatarLarge').textContent = initial;
  document.getElementById('profileFullName').textContent = admin.full_name;
  document.getElementById('profileUsername').textContent = admin.username;

  document.getElementById('profileEditUsername').value = admin.username;
  document.getElementById('profileEditFullName').value = admin.full_name;
}

// Сохранение профиля
document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    username: document.getElementById('profileEditUsername').value,
    full_name: document.getElementById('profileEditFullName').value
  };

  try {
    const response = await fetch('/api/admins/update-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (result.success) {
      showToast('✅ Profil yangilandi!', 'success');

      // Обновляем имя в localStorage
      localStorage.setItem('admin_name', data.full_name);
      document.getElementById('adminName').textContent = data.full_name;

      loadProfile();
    } else {
      showToast('❌ ' + (result.error || 'Xatolik'), 'error');
    }
  } catch (error) {
    console.error('Ошибка обновления профиля:', error);
    showToast('❌ Xatolik yuz berdi', 'error');
  }
});

// Смена пароля в профиле
document.getElementById('profilePasswordForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const currentPassword = document.getElementById('profileCurrentPassword').value;
  const newPassword = document.getElementById('profileNewPassword').value;
  const confirmPassword = document.getElementById('profileConfirmPassword').value;

  if (newPassword !== confirmPassword) {
    showToast('❌ Yangi parollar mos kelmadi!', 'error');
    return;
  }

  try {
    const response = await fetch('/api/admins/change-password-secure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const result = await response.json();

    if (result.success) {
      showToast('✅ Parol o\'zgartirildi! Qaytadan kirish kerak.', 'success');
      document.getElementById('profilePasswordForm').reset();

      setTimeout(() => {
        logout();
      }, 2000);
    } else {
      showToast('❌ ' + (result.error || 'Xatolik'), 'error');
    }
  } catch (error) {
    console.error('Ошибка смены пароля:', error);
    showToast('❌ Xatolik yuz berdi', 'error');
  }
});

// === РАССЫЛКА ===
async function loadBroadcastStats() {
  try {
    const response = await fetch('/api/broadcast/stats');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const stats = await response.json();

    document.getElementById('broadcastUsersCount').textContent = stats.totalUsers || 0;
    document.getElementById('broadcastNotifCount').textContent = stats.notificationsEnabled || 0;
  } catch (error) {
    console.error('Ошибка загрузки статистики рассылки:', error);
    document.getElementById('broadcastUsersCount').textContent = '0';
    document.getElementById('broadcastNotifCount').textContent = '0';
  }
}

// Тестовая рассылка
async function testBroadcast() {
  const message = document.getElementById('broadcastMessage').value;

  if (!message.trim()) {
    showToast('❌ Xabar matnini kiriting', 'error');
    return;
  }

  try {
    const response = await fetch('/api/broadcast/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Server error');
    }

    const result = await response.json();

    if (result.success) {
      showToast('✅ Test muvaffaqiyatli!', 'success');
    } else {
      showToast('❌ ' + (result.error || 'Xatolik'), 'error');
    }
  } catch (error) {
    console.error('Ошибка тестовой рассылки:', error);
    showToast('❌ Xatolik: ' + error.message, 'error');
  }
}

// Массовая рассылка
document.getElementById('broadcastForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const message = document.getElementById('broadcastMessage').value;

  if (!message.trim()) {
    showToast('❌ Xabar matnini kiriting', 'error');
    return;
  }

  const usersCount = parseInt(document.getElementById('broadcastUsersCount').textContent) || 0;

  if (usersCount === 0) {
    showToast('❌ Foydalanuvchilar yo\'q', 'error');
    return;
  }

  if (!confirm(`Hammaga xabar yuborilsinmi?\n\nJami: ${usersCount} foydalanuvchi`)) return;

  const progressDiv = document.getElementById('broadcastProgress');
  const progressBar = document.getElementById('broadcastProgressBar');
  const sentSpan = document.getElementById('broadcastSent');
  const totalSpan = document.getElementById('broadcastTotal');

  progressDiv.style.display = 'block';
  totalSpan.textContent = usersCount;
  sentSpan.textContent = 0;
  progressBar.style.width = '0%';

  try {
    const response = await fetch('/api/broadcast/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Server error');
    }

    const result = await response.json();

    if (result.success) {
      // Симуляция прогресса
      let sent = 0;
      const interval = setInterval(() => {
        sent += Math.floor(Math.random() * 3) + 1;
        if (sent >= usersCount) {
          sent = usersCount;
          clearInterval(interval);

          setTimeout(() => {
            progressDiv.style.display = 'none';
            showToast(`✅ Xabar yuborildi! Jami: ${usersCount}`, 'success');
            document.getElementById('broadcastForm').reset();
          }, 1000);
        }

        sentSpan.textContent = sent;
        progressBar.style.width = ((sent / usersCount) * 100) + '%';
      }, 100);
    } else {
      progressDiv.style.display = 'none';
      showToast('❌ ' + (result.error || 'Xatolik'), 'error');
    }
  } catch (error) {
    console.error('Ошибка рассылки:', error);
    progressDiv.style.display = 'none';
    showToast('❌ Xatolik: ' + error.message, 'error');
  }
});

// Обновите switchTab
function switchTab(tabName) {
  console.log('📑 Переключение на таб:', tabName);

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  const activeTab = document.getElementById(tabName);
  if (activeTab) activeTab.classList.add('active');

  const titles = {
    'dashboard': 'Dashboard',
    'purchases': 'To\'lovlar',
    'courses': 'Kurslar',
    'users': 'Foydalanuvchilar',
    'broadcast': 'Xabarlar',
    'admins': 'Adminlar',
    'profile': 'Profil'
  };
  document.getElementById('pageTitle').textContent = titles[tabName] || tabName;

  // Загружаем данные для конкретного таба
  if (tabName === 'users') loadUsers();
  if (tabName === 'admins') loadAdmins();
  if (tabName === 'broadcast') loadBroadcastStats();
  if (tabName === 'profile') loadProfile();

  if (window.innerWidth <= 768) {
    document.querySelector('.sidebar').classList.remove('active');
  }
}

// Автообновление
setInterval(() => {
  loadPurchases();
}, 30000);

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎨 Admin Panel загружен');

  // Проверяем наличие важных элементов
  console.log('🔍 Проверка элементов DOM:');
  console.log('   purchasesTableBody:', !!document.getElementById('purchasesTableBody'));
  console.log('   usersTableBody:', !!document.getElementById('usersTableBody'));
  console.log('   coursesGrid:', !!document.getElementById('coursesGrid'));
  console.log('   adminsGrid:', !!document.getElementById('adminsGrid'));

  // Инициализируем поиск
  initUserSearch();

  // Загружаем данные
  loadStats();
  loadPurchases();
  loadCourses();

  // Если открыт таб users - загружаем пользователей
  const activeTab = document.querySelector('.tab-content.active');
  if (activeTab && activeTab.id === 'users') {
    loadUsers();
  }

  setTimeout(() => {
    showToast('👋 Xush kelibsiz!', 'success');
  }, 500);
});