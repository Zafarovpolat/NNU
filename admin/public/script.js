let currentRejectId = null;
let allPurchases = [];
let sidebarOpen = false;

// Переключение табов
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
    });
});

function switchTab(tabName) {
    // Обновляем кнопки навигации
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    const activeTab = document.getElementById(tabName);
    if (activeTab) activeTab.classList.add('active');

    // Обновляем заголовок
    const titles = {
        'dashboard': 'Dashboard',
        'purchases': 'To\'lovlar',
        'courses': 'Kurslar',
        'users': 'Foydalanuvchilar'
    };
    document.getElementById('pageTitle').textContent = titles[tabName] || tabName;

    // Закрываем sidebar на мобильных
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('active');
    }
}

// Мобильное меню
document.getElementById('menuToggle').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('active');
});

// Проверка статуса бота
async function checkBotStatus() {
    try {
        const response = await fetch('/api/bot-status');
        const status = await response.json();

        if (!status.connected) {
            showToast('⚠️ Бот не подключен! Запустите бота для отправки уведомлений.', 'warning');
        }
    } catch (error) {
        console.error('Ошибка проверки статуса бота:', error);
    }
}

// Toast уведомления
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 5000);
}

// Загрузка статистики
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();

        document.getElementById('totalUsers').textContent = stats.totalUsers.toLocaleString();
        document.getElementById('pendingPayments').textContent = stats.pendingPayments.toLocaleString();
        document.getElementById('confirmedPayments').textContent = stats.confirmedPayments.toLocaleString();
        document.getElementById('totalRevenue').textContent = stats.totalRevenue.toLocaleString();

        // Обновляем badge в навигации
        const badge = document.getElementById('pendingBadge');
        if (badge) {
            badge.textContent = stats.pendingPayments;
            if (stats.pendingPayments > 0) {
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Загрузка покупок
async function loadPurchases() {
    try {
        const response = await fetch('/api/purchases');
        allPurchases = await response.json();
        displayPurchases(allPurchases);
        displayRecentPayments(allPurchases.slice(0, 5));
        loadStats();
    } catch (error) {
        console.error('Ошибка загрузки покупок:', error);
        showToast('Ошибка загрузки покупок', 'error');
    }
}

function displayPurchases(purchases) {
    const tbody = document.getElementById('purchasesTableBody');
    tbody.innerHTML = '';

    if (purchases.length === 0) {
        tbody.innerHTML = `
      <tr>
        <td colspan="8" class="loading-row">
          <div style="padding: 60px 20px; text-align: center; color: #6c757d;">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 16px; opacity: 0.3;">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Hech qanday to'lov topilmadi</p>
            <p style="font-size: 14px; opacity: 0.7;">To'lovlar ro'yxati bo'sh</p>
          </div>
        </td>
      </tr>
    `;
        return;
    }

    purchases.forEach(p => {
        let statusBadge = '';
        let actionButtons = '';

        switch (p.status) {
            case 'waiting_confirmation':
                statusBadge = '<span class="badge badge-waiting">⏳ Kutilmoqda</span>';
                actionButtons = `
          <div class="action-buttons">
            <button class="btn-success" onclick="confirmPayment(${p.id})">
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

        const icon = p.course_type === 'course' ? '📚' : p.course_type === 'book' ? '📖' : '🎥';

        const row = `
      <tr>
        <td><strong style="color: var(--primary);">#${p.id}</strong></td>
        <td>
          <div style="font-weight: 600; margin-bottom: 4px;">${p.full_name || 'N/A'}</div>
          <div style="font-size: 12px; color: #6c757d;">@${p.telegram_id}</div>
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

    try {
        const response = await fetch(`/api/purchases/${id}/confirm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.success) {
            showToast('✅ To\'lov tasdiqlandi! Foydalanuvchiga xabar yuborildi.', 'success');
            if (result.warning) {
                setTimeout(() => {
                    showToast('⚠️ ' + result.message, 'warning');
                }, 2000);
            }
            loadPurchases();
        } else {
            showToast('❌ Xatolik: ' + (result.error || 'Noma\'lum xatolik'), 'error');
        }
    } catch (error) {
        console.error('Ошибка подтверждения:', error);
        showToast('❌ Xatolik yuz berdi', 'error');
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
            if (result.warning) {
                setTimeout(() => {
                    showToast('⚠️ ' + result.message, 'warning');
                }, 2000);
            }
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

// Загрузка курсов
async function loadCourses() {
    try {
        const response = await fetch('/api/courses');
        const courses = await response.json();

        displayCoursesGrid(courses);
        displayCoursesStats(courses);
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
        <p>Hali hech qanday kurs qo'shilmagan</p>
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
          <button class="btn-primary" style="width: 100%;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Tahrirlash
          </button>
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

// Автообновление каждые 30 секунд
setInterval(() => {
    loadPurchases();
}, 30000);

// Клавиатурные сокращения
document.addEventListener('keydown', (e) => {
    // ESC - закрыть модал
    if (e.key === 'Escape') {
        closeRejectModal();
    }

    // Ctrl/Cmd + R - обновить
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        loadPurchases();
    }
});

// Закрытие модала по клику вне его
document.getElementById('rejectModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        closeRejectModal();
    }
});

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎨 Admin Panel загружен');
    checkBotStatus();
    loadStats();
    loadPurchases();
    loadCourses();

    // Показываем приветствие
    setTimeout(() => {
        showToast('👋 Xush kelibsiz, Administrator!', 'success');
    }, 500);
});

// Обработка ошибок загрузки
window.addEventListener('error', (e) => {
    console.error('Глобальная ошибка:', e);
});

// Показываем индикатор загрузки при переключении табов
const originalSwitchTab = switchTab;
switchTab = function (tabName) {
    originalSwitchTab(tabName);

    // Добавляем анимацию при переключении
    const content = document.getElementById(tabName);
    if (content) {
        content.style.opacity = '0';
        setTimeout(() => {
            content.style.transition = 'opacity 0.3s ease';
            content.style.opacity = '1';
        }, 50);
    }
};