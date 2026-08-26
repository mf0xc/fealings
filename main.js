// ============================================
// مشروع مشاركة المشاعر - فرات وفوفو
// ============================================

// -- إعدادات Supabase --
const SUPABASE_URL = 'https://nviviicpompmdokkritx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aXZpaWNwb21wbWRva2tyaXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMTc3NzQsImV4cCI6MjEwMjc5Mzc3NH0.hqqp-bqejHF7AlGhlfLcoyZ1MEhGGsqkfilZy1gaG6E';

// تهيئة عميل Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// -- المتغيرات العامة --
let currentUser = null;       // اسم المستخدم الحالي ('فرات' أو 'فوفو')
let otherUser = null;         // اسم الطرف الآخر
let subscription = null;      // اشتراك Realtime

// -- عناصر DOM --
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const welcomeText = document.getElementById('welcome-text');
const otherTitle = document.getElementById('other-title');
const otherFeelingText = document.getElementById('other-feeling-text');
const statusTime = document.getElementById('status-time');
const customInput = document.getElementById('custom-feeling-input');
const addCustomBtn = document.getElementById('add-custom-btn');
const feelingsGrid = document.getElementById('feelings-grid');
const toast = document.getElementById('success-toast');

// ============================================
// شاشة تسجيل الدخول
// ============================================

/**
 * إعداد أزرار اختيار المستخدم
 */
function initLoginScreen() {
  const userCards = document.querySelectorAll('.user-card');

  userCards.forEach(card => {
    card.addEventListener('click', () => {
      const selectedUser = card.dataset.user;
      login(selectedUser);
    });
  });
}

/**
 * تسجيل الدخول وتحديد المستخدم
 * @param {string} userName - اسم المستخدم ('فرات' أو 'فوفو')
 */
function login(userName) {
  currentUser = userName;
  otherUser = userName === 'فرات' ? 'فوفو' : 'فرات';

  // حفظ في LocalStorage للجلسة
  localStorage.setItem('currentUser', currentUser);

  // الانتقال للوحة التحكم
  showScreen('dashboard');

  // تحديث واجهة المستخدم
  welcomeText.textContent = `مرحباً ${currentUser}`;
  otherTitle.textContent = `حالة ${otherUser}`;

  // تحميل البيانات
  loadMyFeeling();
  loadOtherFeeling();

  // الاشتراك في التحديثات الفورية
  subscribeToRealtime();
}

/**
 * تسجيل الخروج
 */
function logout() {
  currentUser = null;
  otherUser = null;
  localStorage.removeItem('currentUser');

  // إلغاء الاشتراك
  if (subscription) {
    subscription.unsubscribe();
    subscription = null;
  }

  // إعادة تعيين الحقول
  document.querySelectorAll('input[name="feeling"]').forEach(r => r.checked = false);
  customInput.value = '';

  showScreen('login');
}

// ============================================
// إدارة الشاشات
// ============================================

/**
 * الانتقال بين الشاشات بتأثير Fade
 * @param {string} screenName - 'login' أو 'dashboard'
 */
function showScreen(screenName) {
  if (screenName === 'login') {
    dashboardScreen.classList.remove('active');
    setTimeout(() => {
      loginScreen.classList.add('active');
    }, 300);
  } else {
    loginScreen.classList.remove('active');
    setTimeout(() => {
      dashboardScreen.classList.add('active');
    }, 300);
  }
}

// ============================================
// إدارة المشاعر
// ============================================

/**
 * حفظ الشعور في Supabase
 * @param {string} feeling - نص الشعور
 */
async function saveFeeling(feeling) {
  if (!currentUser) return;

  try {
    // إدراج شعور جديد
    const { error } = await supabase
      .from('feelings')
      .insert([{ user_name: currentUser, feeling: feeling }]);

    if (error) {
      console.error('Error saving feeling:', error);
      showToast('حدث خطأ أثناء الحفظ', true);
      return;
    }

    showToast('تم تحديث شعورك بنجاح');

    // تحديث حالة الطرف الآخر (للتأكد من المزامنة)
    loadOtherFeeling();

  } catch (err) {
    console.error('Exception saving feeling:', err);
    showToast('حدث خطأ في الاتصال', true);
  }
}

/**
 * تحميل آخر شعور للمستخدم الحالي
 */
async function loadMyFeeling() {
  if (!currentUser) return;

  try {
    const { data, error } = await supabase
      .from('feelings')
      .select('feeling')
      .eq('user_name', currentUser)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error loading my feeling:', error);
      return;
    }

    if (data && data.length > 0) {
      const feeling = data[0].feeling;
      selectFeelingInUI(feeling);
    }

  } catch (err) {
    console.error('Exception loading my feeling:', err);
  }
}

/**
 * تحميل آخر شعور للطرف الآخر
 */
async function loadOtherFeeling() {
  if (!otherUser) return;

  try {
    const { data, error } = await supabase
      .from('feelings')
      .select('feeling, created_at')
      .eq('user_name', otherUser)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error loading other feeling:', error);
      otherFeelingText.textContent = 'غير متوفر';
      statusTime.textContent = '';
      return;
    }

    if (data && data.length > 0) {
      otherFeelingText.textContent = data[0].feeling;
      statusTime.textContent = formatTime(data[0].created_at);
    } else {
      otherFeelingText.textContent = 'لم يشارك شعوراً بعد';
      statusTime.textContent = '';
    }

  } catch (err) {
    console.error('Exception loading other feeling:', err);
    otherFeelingText.textContent = 'خطأ في الاتصال';
    statusTime.textContent = '';
  }
}

// ============================================
// واجهة المستخدم
// ============================================

/**
 * تحديد الشعور في واجهة المستخدم
 * @param {string} feeling - نص الشعور
 */
function selectFeelingInUI(feeling) {
  // البحث عن radio button مطابق
  const radios = document.querySelectorAll('input[name="feeling"]');
  let found = false;

  radios.forEach(radio => {
    if (radio.value === feeling) {
      radio.checked = true;
      found = true;
    } else {
      radio.checked = false;
    }
  });

  // إذا لم يكن من القائمة، ضعه في حقل مخصص
  if (!found) {
    customInput.value = feeling;
  } else {
    customInput.value = '';
  }
}

/**
 * إضافة شعور مخصص
 */
function addCustomFeeling() {
  const feeling = customInput.value.trim();
  if (!feeling) {
    customInput.focus();
    return;
  }

  // إلغاء تحديد أي radio
  document.querySelectorAll('input[name="feeling"]').forEach(r => r.checked = false);

  // حفظ الشعور
  saveFeeling(feeling);
}

/**
 * عرض رسالة Toast
 * @param {string} message - نص الرسالة
 * @param {boolean} isError - هل هي رسالة خطأ
 */
function showToast(message, isError = false) {
  const toastEl = document.getElementById('success-toast');
  toastEl.querySelector('span').textContent = message;

  if (isError) {
    toastEl.style.background = '#c75a82';
  } else {
    toastEl.style.background = 'var(--text-main)';
  }

  toastEl.classList.add('show');

  setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2500);
}

/**
 * تنسيق الوقت
 * @param {string} dateString - نص التاريخ
 * @returns {string} - نص منسق
 */
function formatTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000); // بالثواني

  if (diff < 60) return 'منذ لحظات';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

// ============================================
// Realtime - تحديثات فورية
// ============================================

/**
 * الاشتراك في تحديثات Supabase Realtime
 */
function subscribeToRealtime() {
  // إلغاء الاشتراك السابق إن وجد
  if (subscription) {
    subscription.unsubscribe();
  }

  subscription = supabase
    .channel('feelings-channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'feelings',
        filter: `user_name=eq.${otherUser}`
      },
      (payload) => {
        // تم استلام شعور جديد من الطرف الآخر
        console.log('Realtime update received:', payload);
        loadOtherFeeling();
      }
    )
    .subscribe((status) => {
      console.log('Realtime subscription status:', status);
    });
}

// ============================================
// إعداد الأحداث (Event Listeners)
// ============================================

function initEventListeners() {
  // أزرار تسجيل الدخول
  initLoginScreen();

  // زر تسجيل الخروج
  document.getElementById('logout-btn').addEventListener('click', logout);

  // Radio buttons للمشاعر
  document.querySelectorAll('input[name="feeling"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        customInput.value = ''; // مسح الحقل المخصص
        saveFeeling(e.target.value);
      }
    });
  });

  // زر إضافة شعور مخصص
  addCustomBtn.addEventListener('click', addCustomFeeling);

  // إضافة شعور مخصص عند الضغط على Enter
  customInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addCustomFeeling();
    }
  });
}

// ============================================
// تهيئة التطبيق
// ============================================

/**
 * التحقق من جلسة سابقة
 */
function checkExistingSession() {
  const savedUser = localStorage.getItem('currentUser');
  if (savedUser && (savedUser === 'فرات' || savedUser === 'فوفو')) {
    login(savedUser);
  }
}

// بدء التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  checkExistingSession();
});
