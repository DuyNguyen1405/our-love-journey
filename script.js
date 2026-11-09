import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, set, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBxkDY6uEMMwZy8r29wyixjNbBBka5mQk0",
    authDomain: "our-love-journey-c2da0.firebaseapp.com",
    databaseURL: "https://our-love-journey-c2da0-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "our-love-journey-c2da0",
    storageBucket: "our-love-journey-c2da0.appspot.com",
    messagingSenderId: "428563386307",
    appId: "1:428563386307:web:b2c4daacc93aaf19b1f776"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Các bảng dữ liệu trên Firebase
const eventsRef = ref(db, 'loveEvents_BiMat123'); 
const settingsRef = ref(db, 'loveSettings_BiMat123'); // Cài đặt: biệt danh + ghi chú
const todosRef = ref(db, 'loveTodos_BiMat123'); // Todo List
const pageViewsRef = ref(db, 'loveStats_BiMat123/pageViews'); // Bộ đếm lượt xem toàn hệ thống
const albumPhotosRef = ref(db, 'loveAlbumPhotos_BiMat123'); // Album ảnh chung
const albumDeletedRef = ref(db, 'loveAlbumDeleted_BiMat123'); // Danh sách ảnh đã xóa riêng lẻ
const albumLockedRef = ref(db, 'loveAlbumLocked_BiMat123'); // Danh sách ảnh đã khóa lên đầu

// Biến lưu trữ toàn cục
window.loveEventsList = [];
window.allLoveEventsList = [];
window.allLoveTodosList = [];
window.loveTodosList = [];
let currentEventsData = null; // Chứa dữ liệu thô của sự kiện
let nicknameDuy = ''; // Biệt danh Duy
let nicknameChi = ''; // Biệt danh Chi
let noteDuy = ''; // Ghi chú riêng Duy
let noteChi = ''; // Ghi chú riêng Chi
let lastLoginTime = 0; // Mốc đăng nhập lần trước để so sánh thông báo
let newOrUpdatedEvents = [];

let swiperInstance = null;
let savedPhotoIndexBeforeLock = null;
let savedNextPhotoUrl = null;
let editingKey = null;
let currentUser = ''; 

const timeline = document.getElementById('timeline');
const eventForm = document.getElementById('eventForm');
const contentInput = document.getElementById('contentInput');
const formHeading = document.getElementById('formHeading');
const submitBtn = document.getElementById('submitBtn');
const formModal = document.getElementById('formModal');
const feelingInput = document.getElementById('feelingInput');
const userGreeting = document.getElementById('userGreeting');
const visitCountValue = document.getElementById('visitCountValue');

// Logic đăng nhập
const passcodeInput = document.getElementById('passcodeInput');
const errorMessage = document.getElementById('errorMessage');
const loginScreen = document.getElementById('loginScreen');
const mainContent = document.getElementById('mainContent');
const logoutBtn = document.getElementById('logoutBtn');

function incrementVisitCount() {
    // Dùng sessionStorage để chỉ tăng 1 lần trong suốt 1 phiên làm việc trên tab hiện tại
    if (sessionStorage.getItem('hasCountedThisSession')) return;

    sessionStorage.setItem('hasCountedThisSession', 'true');
    runTransaction(pageViewsRef, (currentVal) => {
        return (Number(currentVal) || 0) + 1;
    }).catch((error) => {
        console.error("Lỗi khi cập nhật bộ đếm lượt truy cập:", error);
        // Rollback cờ phiên nếu transaction thất bại để thử lại lần sau
        sessionStorage.removeItem('hasCountedThisSession');
    });
}

function loginWithPin(val, isAutoLogin = false) {
    if (val === '1405' || val === '1704') {
        currentUser = (val === '1405') ? 'Duy' : 'Chi';

        const lastLoginKey = `lastLogin_${currentUser}`;
        const prevLogin = localStorage.getItem(lastLoginKey);
        lastLoginTime = prevLogin ? parseInt(prevLogin, 10) : 0;
        localStorage.setItem(lastLoginKey, Date.now().toString());
        localStorage.setItem('savedUserPin', val);

        signInAnonymously(auth).then(() => {
            setupDatabaseListeners();
            incrementVisitCount();

            // Hiển thị lời chào có kèm biệt danh (nếu đã tải xong)
            const currentNickname = (currentUser === 'Duy') ? nicknameDuy : nicknameChi;
            const greetingName = currentNickname ? `${currentUser} (${currentNickname})` : currentUser;
            if (userGreeting) {
                userGreeting.innerText = `Chào ${greetingName} ❤️`;
            }

            if (isAutoLogin) {
                loginScreen.style.display = 'none';
                mainContent.style.display = 'block';
            } else {
                passcodeInput.disabled = true;
                loginScreen.style.opacity = '0';

                setTimeout(() => {
                    loginScreen.style.display = 'none';
                    mainContent.style.display = 'block';
                }, 800);
            }
        }).catch((error) => {
            console.error("Auth Error:", error);
            localStorage.removeItem('savedUserPin');
            loginScreen.style.display = 'flex';
            loginScreen.style.opacity = '1';
            mainContent.style.display = 'none';
            errorMessage.innerText = "Lỗi xác thực: " + error.message;
            errorMessage.classList.add('active');
            if (passcodeInput) {
                passcodeInput.disabled = false;
                passcodeInput.value = '';
            }
        });
    } else {
        errorMessage.innerText = "Quên sinh nhật mình rồi à 🥺";
        errorMessage.classList.add('active');
        if (passcodeInput) {
            passcodeInput.value = '';
        }
    }
}

const savedPin = localStorage.getItem('savedUserPin');
if (savedPin === '1405' || savedPin === '1704') {
    loginScreen.style.display = 'none';
    loginWithPin(savedPin, true);
} else if (passcodeInput) {
    passcodeInput.focus();
}

if (passcodeInput && errorMessage && loginScreen && mainContent) {
    passcodeInput.addEventListener('keyup', (e) => {
        let val = e.target.value;
        val = val.replace(/[^0-9]/g, '');
        e.target.value = val; 

        if (errorMessage.classList.contains('active')) {
            errorMessage.classList.remove('active');
        }

        if (val.length === 4) {
            loginWithPin(val, false);
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('savedUserPin');
        sessionStorage.removeItem('hasCountedThisSession');
        window.location.reload();
    });
}

// ----------------------------------------------------
// ĐỒNG BỘ DỮ LIỆU TỪ FIREBASE VÀ RENDER TIMELINE
// ----------------------------------------------------

window.setupDatabaseListeners = function() {
    // 1. Lắng nghe thay đổi Cài đặt (Biệt danh + ghi chú)
    onValue(settingsRef, (snapshot) => {
        const data = snapshot.val();
        const nicknames = data?.nicknames || {};
        nicknameDuy = nicknames.duy || '';
        nicknameChi = nicknames.chi || '';
        
        const notes = data?.notes || {};
        noteDuy = notes.duy || '';
        noteChi = notes.chi || '';
        
        // Cập nhật lại lời chào nếu đổi biệt danh ngay lúc đang online
        if (currentUser) {
            const currentNickname = (currentUser === 'Duy') ? nicknameDuy : nicknameChi;
            const greetingName = currentNickname ? `${currentUser} (${currentNickname})` : currentUser;
            if(userGreeting) {
                userGreeting.innerText = `Chào ${greetingName} ❤️`;
            }
        }

        renderTimeline(); // Vẽ lại timeline với biệt danh mới
    });

    // 2. Lắng nghe thay đổi Sự kiện
    onValue(eventsRef, (snapshot) => {
        currentEventsData = snapshot.val();
        renderTimeline(); // Vẽ lại timeline với sự kiện mới
    });

    // 2.5 Lắng nghe Todo List
    onValue(todosRef, (snapshot) => {
        const data = snapshot.val();
        window.loveTodosList = data ? Object.entries(data).map(([key, value]) => ({ key, ...value })) : [];
        window.allLoveTodosList = data ? Object.entries(data).map(([key, value]) => ({ key, ...value })) : [];
        window.loveTodosList = window.allLoveTodosList.filter(t => !t.isDeleted);
        renderTodos();
        renderNotifications();
    });

    // 2.6 Lắng nghe Bộ đếm lượt truy cập (Global Counter)
    onValue(pageViewsRef, (snapshot) => {
        const val = snapshot.val();
        if (visitCountValue) {
            const count = Number(val) || 0;
            visitCountValue.innerText = count.toLocaleString('vi-VN');
        }
    });

    // 2.7 Lắng nghe Album ảnh chung
    onValue(albumPhotosRef, (snapshot) => {
        const data = snapshot.val();
        window.allLovePhotosList = data ? Object.entries(data).map(([key, value]) => ({ key, ...value })) : [];
        renderAlbumGrid(data);
        renderNotifications();
    });

    // 2.8 Lắng nghe mốc thời gian xóa ảnh album
    onValue(ref(db, 'loveAlbumSettings_BiMat123/clearedAt'), (snapshot) => {
        albumClearedAt = Number(snapshot.val()) || 0;
        syncAndRenderAlbum();
    });

    // 2.9 Lắng nghe danh sách ảnh bị xóa riêng lẻ
    onValue(albumDeletedRef, (snapshot) => {
        const val = snapshot.val();
        deletedAlbumUrls = new Set();
        if (val) {
            Object.values(val).forEach(d => {
                if (d.url) deletedAlbumUrls.add(d.url);
                if (d.thumbUrl) deletedAlbumUrls.add(d.thumbUrl);
            });
        }
        syncAndRenderAlbum();
    });

    // 2.10 Lắng nghe danh sách ảnh bị khóa lên đầu
    onValue(albumLockedRef, (snapshot) => {
        lockedAlbumMap = snapshot.val() || {};
        syncAndRenderAlbum();
    });

    if (typeof loadIbbAlbumPhotos === 'function') {
        loadIbbAlbumPhotos();
    }
};

const GOODNIGHT_START = new Date(2026, 4, 17); // 17/5/2026, tính cả ngày này là ngày 1

function parseLocalDate(dateStr) {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
}

function getGoodnightWishDay(dateStr) {
    const eventDate = parseLocalDate(dateStr);
    if (!eventDate || eventDate < GOODNIGHT_START) return null;
    const diffDays = Math.round((eventDate - GOODNIGHT_START) / (1000 * 60 * 60 * 24));
    return diffDays + 1;
}

// 3. Hàm vẽ Timeline
function renderTimeline() {
    timeline.innerHTML = '';

    if (!currentEventsData) {
        timeline.innerHTML = '<p style="text-align:center; color:#888;">Chưa có kỷ niệm nào. Hãy tạo kỷ niệm đầu tiên nhé!</p>';
        window.loveEventsList = [];
        window.allLoveEventsList = [];
        renderNotifications();
        return;
    }

    const allEvents = Object.entries(currentEventsData).map(([key, value]) => ({
        key,
        ...value
    }));
    window.allLoveEventsList = allEvents;

    // Chỉ hiển thị trên timeline những sự kiện chưa bị xóa
    window.loveEventsList = allEvents.filter(ev => !ev.isDeleted);
    window.loveEventsList.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (window.loveEventsList.length === 0) {
        timeline.innerHTML = '<p style="text-align:center; color:#888;">Chưa có kỷ niệm nào. Hãy tạo kỷ niệm đầu tiên nhé!</p>';
    } else {
    window.loveEventsList.forEach((ev, index) => {
        const item = document.createElement('div');
        
        const hasChiFeeling = ev.feelingChi && ev.feelingChi.trim() !== '';
        const hasDuyFeeling = ev.feelingDuy && ev.feelingDuy.trim() !== '';
        
        let itemClasses = 'timeline-item';
        if (hasChiFeeling && hasDuyFeeling) {
            itemClasses += ' complete-feelings';
        } else {
            itemClasses += ' incomplete-feelings';
        }
        item.className = itemClasses;
        item.id = `event-${ev.key}`;

        const dateObj = new Date(ev.date);
        const dateStr = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        let galleryHTML = '';
        let photoIcon = '';
        if (ev.images && ev.images.length > 0) {
            photoIcon = '📸';
            galleryHTML = '<div class="timeline-gallery">';
            ev.images.forEach((imgUrl, imgIndex) => {
                galleryHTML += `<img src="${imgUrl}" alt="Thumbnail" onclick="openSlider(${index}, ${imgIndex})" onerror="this.style.display='none'">`;
            });
            galleryHTML += '</div>';
        }

        let goodnightWishHTML = '';
        const goodnightDay = getGoodnightWishDay(ev.date);
        if (goodnightDay !== null) {
            goodnightWishHTML = `<p class="goodnight-wish">Lời chúc ngủ ngon thứ ${goodnightDay}</p>`;
        }

        let feelingsHTML = '';
        if (hasChiFeeling || hasDuyFeeling) {
            feelingsHTML += '<div class="feelings-container">';
            
            // Xử lý hiển thị tên + Biệt danh
            const labelChi = nicknameChi ? `Chi (${nicknameChi})` : 'Chi';
            const labelDuy = nicknameDuy ? `Duy (${nicknameDuy})` : 'Duy';

            if (hasChiFeeling) {
                feelingsHTML += `<div class="feeling-box feeling-chi"><span class="feeling-author">👩 ${labelChi}:</span>${ev.feelingChi}</div>`;
            }
            if (hasDuyFeeling) {
                feelingsHTML += `<div class="feeling-box feeling-duy"><span class="feeling-author">👦 ${labelDuy}:</span>${ev.feelingDuy}</div>`;
            }
            feelingsHTML += '</div>';
        }

        item.innerHTML = `
            <div class="timeline-date">${dateStr}</div>
            <div class="timeline-title" onclick="openSlider(${index}, 0)">${ev.title} ${photoIcon}</div>
            <div class="timeline-content">${ev.content}</div>
            ${galleryHTML}
            ${goodnightWishHTML}
            ${feelingsHTML}
            <div class="timeline-actions">
                <button class="btn-action btn-edit" onclick="editEvent('${ev.key}')" title="Sửa hoặc thêm cảm nghĩ">✏️ Sửa</button>
                <button class="btn-action btn-delete" onclick="deleteEvent('${ev.key}')" title="Xóa kỷ niệm">🗑️ Xóa</button>
            </div>
        `;
        timeline.appendChild(item);
    });

    // Thêm khung Lời chúc ngủ ngon hôm nay
    const today = new Date();
    const todayYMD = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const currentGoodnightDay = getGoodnightWishDay(todayYMD);

    if (currentGoodnightDay !== null) {
        const todayStrVN = today.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        let randomMemoryHTML = '';
        if (window.loveEventsList && window.loveEventsList.length > 0) {
            const randomIndex = Math.floor(Math.random() * window.loveEventsList.length);
            const randomEv = window.loveEventsList[randomIndex];
            const evDate = parseLocalDate(randomEv.date);
            if (evDate) {
                const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const diffDays = Math.round((todayMidnight - evDate) / (1000 * 60 * 60 * 24));
                const originalTitle = randomEv.title || '';
                const evDateStr = evDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                randomMemoryHTML = `<div style="color: #0056b3; font-size: 0.95rem; margin-top: 5px; font-style: italic;">Đã ${diffDays} ngày trôi qua kể từ <a href="#event-${randomEv.key}" style="color: #0056b3; font-weight: 600; text-decoration: underline; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1">${originalTitle} (${evDateStr})</a></div>`;
            }
        }

        const todayItem = document.createElement('div');
        todayItem.className = 'timeline-item today-box';
        todayItem.innerHTML = `
            <div class="timeline-date">Hôm nay, ngày ${todayStrVN}</div>
            ${randomMemoryHTML}
            <p class="goodnight-wish">Lời chúc ngủ ngon thứ ${currentGoodnightDay}</p>
        `;
        timeline.appendChild(todayItem);
    }
    }

    renderNotifications();
}

// ----------------------------------------------------
// LOGIC THÔNG BÁO CẬP NHẬT (ICON HOA HỒNG 🌹)
// ----------------------------------------------------
const notifTrigger = document.getElementById('notifTrigger');
const notifBadge = document.getElementById('notifBadge');
const notifDropdown = document.getElementById('notifDropdown');
const notifList = document.getElementById('notifList');
const markAllReadBtn = document.getElementById('markAllReadBtn');

function getReadNotificationIds() {
    if (!currentUser) return [];
    try {
        const raw = localStorage.getItem(`readNotifs_${currentUser}`);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function markNotificationAsRead(notifId) {
    if (!currentUser || !notifId) return;
    const list = getReadNotificationIds();
    if (!list.includes(notifId)) {
        list.push(notifId);
        localStorage.setItem(`readNotifs_${currentUser}`, JSON.stringify(list));
    }
    renderNotifications();
}

function getNotifTime(item) {
    if (item.notifKind === 'photo') return item.uploadedAt || 0;
    return item.updatedAt || item.createdAt || (item.date ? new Date(item.date).getTime() : (item.time ? new Date(item.time).getTime() : 0));
}

function markAllNotificationsAsRead() {
    if (!currentUser || !newOrUpdatedEvents || newOrUpdatedEvents.length === 0) return;
    if (notifList && notifList.classList.contains('fade-out')) return;

    if (notifList) {
        notifList.classList.add('fade-out');
    }

    setTimeout(() => {
        const list = getReadNotificationIds();
        newOrUpdatedEvents.forEach(item => {
            const timeVal = getNotifTime(item);
            const notifId = `${item.key}_${timeVal}`;
            if (!list.includes(notifId)) {
                list.push(notifId);
            }
        });
        localStorage.setItem(`readNotifs_${currentUser}`, JSON.stringify(list));
        renderNotifications();
        if (notifList) {
            notifList.classList.remove('fade-out');
        }
        if (notifDropdown) {
            notifDropdown.classList.remove('active');
        }
    }, 300);
}

function renderNotifications() {
    if (!notifBadge || !notifList) return;

    const readNotifIds = getReadNotificationIds();
    const sourceEvents = (window.allLoveEventsList || window.loveEventsList || []).map(ev => ({ ...ev, notifKind: 'event' }));
    const sourceTodos = (window.allLoveTodosList || window.loveTodosList || []).map(td => ({ ...td, notifKind: 'todo' }));
    
    const sourcePhotos = [];
    if (window.allLovePhotosList && window.allLovePhotosList.length > 0) {
        const validPhotos = window.allLovePhotosList.filter(p => {
            if (albumClearedAt && (p.uploadedAt || 0) <= albumClearedAt) return false;
            if (deletedAlbumUrls && (deletedAlbumUrls.has(p.url) || deletedAlbumUrls.has(p.thumbUrl))) return false;
            return true;
        });
        validPhotos.sort((a, b) => (a.uploadedAt || 0) - (b.uploadedAt || 0));

        let currentBatch = [];
        for (let i = 0; i < validPhotos.length; i++) {
            const photo = validPhotos[i];
            if (currentBatch.length === 0) {
                currentBatch.push(photo);
            } else {
                const prevPhoto = currentBatch[currentBatch.length - 1];
                const timeDiff = Math.abs((photo.uploadedAt || 0) - (prevPhoto.uploadedAt || 0));
                if (photo.uploadedBy === prevPhoto.uploadedBy && timeDiff <= 300000) {
                    currentBatch.push(photo);
                } else {
                    sourcePhotos.push({
                        notifKind: 'photo',
                        key: currentBatch[0].key,
                        uploadedAt: currentBatch[currentBatch.length - 1].uploadedAt,
                        uploadedBy: currentBatch[0].uploadedBy,
                        photoCount: currentBatch.length,
                        firstPhotoUrl: currentBatch[0].thumbUrl || currentBatch[0].url
                    });
                    currentBatch = [photo];
                }
            }
        }
        if (currentBatch.length > 0) {
            sourcePhotos.push({
                notifKind: 'photo',
                key: currentBatch[0].key,
                uploadedAt: currentBatch[currentBatch.length - 1].uploadedAt,
                uploadedBy: currentBatch[0].uploadedBy,
                photoCount: currentBatch.length,
                firstPhotoUrl: currentBatch[0].thumbUrl || currentBatch[0].url
            });
        }
    }

    const allSources = [...sourceEvents, ...sourceTodos, ...sourcePhotos];
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    newOrUpdatedEvents = allSources.filter(item => {
        const itemTime = getNotifTime(item);
        let isFromOtherUser = false;
        
        if (item.notifKind === 'photo') {
            isFromOtherUser = item.uploadedBy ? item.uploadedBy !== currentUser : true;
        } else {
            isFromOtherUser = item.updatedBy ? item.updatedBy !== currentUser : (item.createdBy ? item.createdBy !== currentUser : true);
        }

        const notifId = `${item.key}_${itemTime}`;
        if (readNotifIds.includes(notifId)) return false;

        return itemTime > sevenDaysAgo && isFromOtherUser;
    });

    newOrUpdatedEvents.sort((a, b) => getNotifTime(b) - getNotifTime(a));

    if (newOrUpdatedEvents.length > 0) {
        if (markAllReadBtn) markAllReadBtn.style.display = 'inline-block';
        notifBadge.innerText = newOrUpdatedEvents.length > 99 ? '99+' : newOrUpdatedEvents.length;
        notifBadge.style.display = 'inline-block';

        notifList.innerHTML = newOrUpdatedEvents.map(item => {
            let badgeTypeClass = 'notif-badge-edit';
            let badgeTypeLabel = 'Cập nhật ✏️';
            let itemTitle = '';
            let author = '';
            let timeVal = getNotifTime(item);

            if (item.notifKind === 'photo') {
                badgeTypeClass = 'notif-badge-new';
                badgeTypeLabel = 'Ảnh mới 🖼️';
                itemTitle = `Đã tải lên ${item.photoCount} ảnh`;
                author = item.uploadedBy || (currentUser === 'Duy' ? 'Chi' : 'Duy');
            } else if (item.notifKind === 'todo') {
                const isDelete = Boolean(item.isDeleted || item.lastAction === 'delete_todo');
                if (isDelete) {
                    badgeTypeClass = 'notif-badge-delete';
                    badgeTypeLabel = 'Xóa task 🗑️';
                } else if (item.lastAction === 'complete_todo') {
                    badgeTypeClass = 'notif-badge-done';
                    badgeTypeLabel = 'Xong task ✅';
                } else if (item.lastAction === 'uncomplete_todo') {
                    badgeTypeClass = 'notif-badge-edit';
                    badgeTypeLabel = 'Mở lại task ⏳';
                } else if (item.lastAction === 'create_todo' || (!item.lastAction && item.createdAt && item.createdAt > lastLoginTime)) {
                    badgeTypeClass = 'notif-badge-new';
                    badgeTypeLabel = 'Task mới 📝';
                } else {
                    badgeTypeClass = 'notif-badge-edit';
                    badgeTypeLabel = 'Sửa task 📝';
                }
                itemTitle = item.name || 'Kế hoạch';
                author = item.updatedBy || (currentUser === 'Duy' ? 'Chi' : 'Duy');
            } else {
                const isDeletedEvent = Boolean(item.isDeleted || item.lastAction === 'delete_event');
                const isDeletedFeeling = Boolean(item.lastAction === 'delete_feeling');
                const isDelete = isDeletedEvent || isDeletedFeeling;
                const isNew = !isDelete && (item.lastAction === 'create_event' || (!item.lastAction && item.createdAt && item.createdAt > sevenDaysAgo));

                if (isDelete) {
                    badgeTypeClass = 'notif-badge-delete';
                    badgeTypeLabel = isDeletedFeeling ? 'Xóa bình luận 🗑️' : 'Xóa 🗑️';
                } else if (isNew) {
                    badgeTypeClass = 'notif-badge-new';
                    badgeTypeLabel = 'Mới 💌';
                }
                itemTitle = item.title || 'Kỷ niệm';
                author = item.updatedBy || (currentUser === 'Duy' ? 'Chi' : 'Duy');
            }

            const notifId = `${item.key}_${timeVal}`;
            const timeStr = new Date(timeVal).toLocaleString('vi-VN', {
                hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'
            });

            return `
                <div class="notif-item" onclick="scrollToEvent('${item.key}', '${notifId}', '${item.notifKind}')">
                    <div class="notif-title">
                        <span class="notif-badge-type ${badgeTypeClass}">[${badgeTypeLabel}]</span>
                        ${itemTitle}
                    </div>
                    <div class="notif-time">${author} • ${timeStr}</div>
                </div>
            `;
        }).join('');
    } else {
        if (markAllReadBtn) markAllReadBtn.style.display = 'none';
        notifBadge.style.display = 'none';
        notifList.innerHTML = '<div class="notif-empty">Không có cập nhật mới nào ✨</div>';
    }
}

if (notifTrigger && notifDropdown) {
    notifTrigger.addEventListener('click', (e) => {
        if (e.target.closest('#notifDropdown')) return;
        e.stopPropagation();
        notifDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!notifTrigger.contains(e.target)) {
            notifDropdown.classList.remove('active');
        }
    });
}

if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        markAllNotificationsAsRead();
    });
}

window.scrollToEvent = function(key, notifId, kind = 'event') {
    if (notifDropdown) notifDropdown.classList.remove('active');
    if (notifId) {
        markNotificationAsRead(notifId);
    }
    
    if (kind === 'photo') {
        const albumWidget = document.getElementById('albumGrid');
        if (albumWidget) {
            albumWidget.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (typeof currentAlbumList !== 'undefined' && currentAlbumList.length > 0) {
            const photoIndex = currentAlbumList.findIndex(p => p.key === key);
            if (photoIndex !== -1) {
                if (typeof previewAlbumPhoto === 'function') {
                    previewAlbumPhoto(photoIndex);
                }
            } else {
                alert('Ảnh này có thể đã bị xóa.');
            }
        }
        return;
    }

    if (kind === 'todo') {
        const task = (window.allLoveTodosList || window.loveTodosList || []).find(t => t.key === key);
        if (!task || task.isDeleted) {
            alert('Task này đã bị xóa.');
            return;
        }
        editTodo(key);
        const todoWidget = document.querySelector('.todo-sidebar');
        if (todoWidget) {
            todoWidget.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } else {
        const targetItem = document.getElementById(`event-${key}`);
        if (targetItem) {
            targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetItem.classList.remove('highlight-memory');
            void targetItem.offsetWidth;
            targetItem.classList.add('highlight-memory');
        } else {
            alert('Kỷ niệm này đã bị xóa.');
        }
    }
};

// ----------------------------------------------------
// LOGIC CÀI ĐẶT (SETTINGS MODAL)
// ----------------------------------------------------
const settingsModal = document.getElementById('settingsModal');
const settingsForm = document.getElementById('settingsForm');

document.getElementById('openSettingsBtn').addEventListener('click', () => {
    // Đổ dữ liệu hiện tại vào form cài đặt
    document.getElementById('nicknameDuy').value = nicknameDuy;
    document.getElementById('nicknameChi').value = nicknameChi;
    
    // Hiển thị ghi chú cá nhân theo người đang đăng nhập
    const currentNote = (currentUser === 'Duy') ? noteDuy : noteChi;
    document.getElementById('settingsNote').value = currentNote;
    
    const label = document.getElementById('settingsNoteLabel');
    if (label) {
        label.innerText = `Ghi chú cá nhân của ${currentUser} 🔒`;
    }

    settingsModal.classList.add('active');
});

document.getElementById('closeSettingsBtn').addEventListener('click', () => {
    settingsModal.classList.remove('active');
});

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('active');
});

settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveSettingsBtn');
    btn.innerText = 'Đang lưu...';

    const nDuy = document.getElementById('nicknameDuy').value.trim();
    const nChi = document.getElementById('nicknameChi').value.trim();
    const myNote = document.getElementById('settingsNote').value.trim();

    const updates = {
        nicknames: {
            duy: nDuy,
            chi: nChi
        }
    };

    if (currentUser === 'Duy') {
        updates['notes/duy'] = myNote;
    } else if (currentUser === 'Chi') {
        updates['notes/chi'] = myNote;
    }

    try {
        await update(ref(db, 'loveSettings_BiMat123'), updates);
        settingsModal.classList.remove('active');
    } catch (error) {
        alert("Lỗi khi lưu cài đặt: " + error.message);
    } finally {
        btn.innerText = 'Lưu Cài Đặt 💾';
    }
});


// ----------------------------------------------------
// LOGIC FORM SỰ KIỆN VÀ SLIDER
// ----------------------------------------------------
window.formatDoc = function(cmd, value = null) {
    document.execCommand(cmd, false, value);
    contentInput.focus();
};

document.getElementById('openFormBtn').addEventListener('click', () => {
    editingKey = null;
    eventForm.reset();
    contentInput.innerHTML = '';
    feelingInput.value = '';
    formHeading.innerText = 'Thêm kỷ niệm mới 💌';
    submitBtn.innerText = 'Lưu Kỷ Niệm 💌';
    formModal.classList.add('active');
});

// ----------------------------------------------------
// LOGIC ALBUM & TỰ ĐỘNG CHIA ẢNH GHÉP (CANVAS)
// ----------------------------------------------------
const uploadDropzone = document.getElementById('uploadDropzone');
const photoFileInput = document.getElementById('photoFileInput');
const uploadProgressContainer = document.getElementById('uploadProgressContainer');
const uploadProgressBar = document.getElementById('uploadProgressBar');
const uploadProgressText = document.getElementById('uploadProgressText');
const albumGrid = document.getElementById('albumGrid');
const randomAlbumBtn = document.getElementById('randomAlbumBtn');
const clearAlbumBtn = document.getElementById('clearAlbumBtn');
const IBB_ALBUM_URL = 'https://ibb.co/album/1JmL2h';
const IBB_ALBUM_ID = '1JmL2h';
let currentAlbumList = [];
let currentFirebaseAlbumData = null;
let currentIbbAlbumPhotos = [];
let albumClearedAt = 0;
let deletedAlbumUrls = new Set();
let lockedAlbumMap = {};

function getUrlKey(url) {
    if (!url) return 'unknown';
    try {
        return btoa(unescape(encodeURIComponent(url)))
            .replace(/=/g, '')
            .replace(/\//g, '_')
            .replace(/\+/g, '-');
    } catch (e) {
        return url.replace(/[.#$\[\]\/]/g, '_');
    }
}

async function fetchIbbAlbumPhotos() {
    const proxyUrls = [
        `https://api.allorigins.win/get?url=${encodeURIComponent(IBB_ALBUM_URL)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(IBB_ALBUM_URL)}`
    ];

    let html = null;
    for (const proxyUrl of proxyUrls) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            const res = await fetch(proxyUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                if (proxyUrl.includes('allorigins.win/get')) {
                    const data = await res.json();
                    html = data?.contents || null;
                } else {
                    html = await res.text();
                }
                if (html && (html.includes('image-container') || html.includes('list-item') || html.includes('ibb.co'))) {
                    break;
                }
            }
        } catch {
            html = null;
        }
    }

    if (!html) return [];

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const imgElements = doc.querySelectorAll('.image-container img, .list-item img, a[href*="ibb.co/"] img, img[src*="ibb.co"], img[data-src*="ibb.co"]');
        const photos = [];
        const seenUrls = new Set();

        imgElements.forEach((img, idx) => {
            const thumbUrl = img.getAttribute('src') || img.getAttribute('data-src');
            if (!thumbUrl || thumbUrl.includes('avatar') || thumbUrl.includes('logo') || seenUrls.has(thumbUrl)) return;
            seenUrls.add(thumbUrl);

            let fullUrl = thumbUrl;
            if (thumbUrl.includes('.th.')) {
                fullUrl = thumbUrl.replace('.th.', '.md.');
            }

            const parentA = img.closest('a');
            const pageUrl = parentA ? parentA.getAttribute('href') : '';

            photos.push({
                key: `ibb_${IBB_ALBUM_ID}_${idx}`,
                url: fullUrl,
                thumbUrl: thumbUrl,
                pageUrl: pageUrl,
                albumId: IBB_ALBUM_ID,
                source: 'ibb_album',
                uploadedAt: Date.now() - idx * 1000
            });
        });

        return photos;
    } catch (e) {
        console.error("Lỗi khi đọc danh sách ảnh từ album ibb.co:", e);
        return [];
    }
}

function mergeAlbumPhotos(firebaseData, ibbPhotos) {
    const list = [];
    const urlSet = new Set();

    if (firebaseData) {
        Object.entries(firebaseData).forEach(([k, v]) => {
            if (v && v.url && !urlSet.has(v.url)) {
                if (albumClearedAt && (v.uploadedAt || 0) <= albumClearedAt) return;
                if (deletedAlbumUrls.has(v.url) || (v.thumbUrl && deletedAlbumUrls.has(v.thumbUrl))) return;
                urlSet.add(v.url);
                const urlKey = getUrlKey(v.url);
                const lockInfo = lockedAlbumMap[urlKey];
                const isLocked = Boolean(v.isLocked || lockInfo);
                const lockedAt = lockInfo?.lockedAt || v.lockedAt || 0;
                list.push({ key: k, ...v, isLocked, lockedAt });
            }
        });
    }

    if (Array.isArray(ibbPhotos)) {
        ibbPhotos.forEach(p => {
            if (albumClearedAt && (p.uploadedAt || 0) <= albumClearedAt) return;
            if (deletedAlbumUrls.has(p.url) || (p.thumbUrl && deletedAlbumUrls.has(p.thumbUrl))) return;
            const isDuplicate = list.some(item => {
                if (item.url === p.url) return true;
                if (item.thumbUrl && p.thumbUrl && item.thumbUrl === p.thumbUrl) return true;
                if (p.pageUrl && item.url.includes(p.pageUrl.split('/').pop())) return true;
                return false;
            });
            if (!isDuplicate && !urlSet.has(p.url)) {
                urlSet.add(p.url);
                const urlKey = getUrlKey(p.url);
                const lockInfo = lockedAlbumMap[urlKey];
                const isLocked = Boolean(lockInfo);
                const lockedAt = lockInfo?.lockedAt || 0;
                list.push({ ...p, isLocked, lockedAt });
            }
        });
    }

    list.sort((a, b) => {
        if (Boolean(a.isLocked) !== Boolean(b.isLocked)) {
            return a.isLocked ? -1 : 1;
        }
        if (a.isLocked && b.isLocked) {
            return (b.lockedAt || 0) - (a.lockedAt || 0);
        }
        return (b.uploadedAt || 0) - (a.uploadedAt || 0);
    });
    return list;
}

async function loadIbbAlbumPhotos() {
    const photos = await fetchIbbAlbumPhotos();
    if (photos && photos.length > 0) {
        currentIbbAlbumPhotos = photos;
        syncAndRenderAlbum();
    }
}

if (uploadDropzone && photoFileInput) {
    uploadDropzone.addEventListener('click', () => photoFileInput.click());

    uploadDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadDropzone.classList.add('dragover');
    });

    uploadDropzone.addEventListener('dragleave', () => {
        uploadDropzone.classList.remove('dragover');
    });

    uploadDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadDropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleSelectedFiles(e.dataTransfer.files);
        }
    });

    photoFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleSelectedFiles(e.target.files);
            e.target.value = '';
        }
    });
}

window.pickRandomAlbumPhoto = function(event) {
    savedNextPhotoUrl = null;
    savedPhotoIndexBeforeLock = null;
    if (event) event.stopPropagation();
    if (!currentAlbumList || currentAlbumList.length === 0) {
        alert('Chưa có ảnh nào trong thư viện!');
        return;
    }

    let targetIndex = 0;
    if (currentAlbumList.length > 1) {
        let currentIndex = -1;
        if (sliderModal && sliderModal.classList.contains('active') && swiperInstance) {
            currentIndex = swiperInstance.realIndex !== undefined ? swiperInstance.realIndex : swiperInstance.activeIndex;
        }
        do {
            targetIndex = Math.floor(Math.random() * currentAlbumList.length);
        } while (targetIndex === currentIndex && currentAlbumList.length > 1);
    }

    if (sliderModal && sliderModal.classList.contains('active') && swiperInstance) {
        if (swiperInstance.params && swiperInstance.params.loop) {
            swiperInstance.slideToLoop(targetIndex);
        } else {
            swiperInstance.slideTo(targetIndex);
        }
    } else {
        previewAlbumPhoto(targetIndex);
    }
};

if (randomAlbumBtn) {
    randomAlbumBtn.addEventListener('click', (e) => pickRandomAlbumPhoto(e));
}

if (clearAlbumBtn) {
    clearAlbumBtn.addEventListener('click', async () => {
        if (!currentAlbumList || currentAlbumList.length === 0) {
            alert('Thư viện ảnh hiện đang trống!');
            return;
        }

        const confirmed = await askConfirm({
            title: 'Xóa toàn bộ ảnh 🗑️',
            message: `Bạn có chắc chắn muốn xóa toàn bộ ${currentAlbumList.length} ảnh trong thư viện không? Hành động này sẽ dọn sạch danh sách ảnh hiển thị.`,
            okText: 'Xóa hết',
            danger: true
        });
        if (!confirmed) return;

        try {
            clearAlbumBtn.innerText = '⏳ Đang xóa...';
            await remove(albumPhotosRef);
            await set(ref(db, 'loveAlbumSettings_BiMat123/clearedAt'), Date.now());
            await remove(albumLockedRef);
            lockedAlbumMap = {};
            currentIbbAlbumPhotos = [];
            currentFirebaseAlbumData = null;
            syncAndRenderAlbum(null);
        } catch (error) {
            alert('Lỗi khi xóa ảnh: ' + error.message);
        } finally {
            clearAlbumBtn.innerText = 'Xóa hết ảnh thư viện 🗑️';
        }
    });
}

function syncAndRenderAlbum(firebaseData = currentFirebaseAlbumData) {
    currentFirebaseAlbumData = firebaseData;
    const mergedList = mergeAlbumPhotos(currentFirebaseAlbumData, currentIbbAlbumPhotos);
    renderAlbumGridWithList(mergedList);
}

function renderAlbumGrid(albumData) {
    syncAndRenderAlbum(albumData);
}

function renderAlbumGridWithList(list) {
    if (!albumGrid) return;
    const countText = document.getElementById('albumCountText');
    currentAlbumList = list || [];

    if (currentAlbumList.length === 0) {
        albumGrid.innerHTML = '<div class="album-empty">Chưa có ảnh nào trong album. Hãy tải ảnh đầu tiên lên nhé!</div>';
        if (countText) countText.innerText = 'Tất cả ảnh (0)';
        return;
    }

    if (countText) countText.innerText = `Tất cả ảnh (${currentAlbumList.length})`;

    albumGrid.innerHTML = currentAlbumList.map((item, idx) => {
        const thumbSrc = item.thumbUrl || item.url;
        const lockIcon = item.isLocked ? '🔒' : '🔓';
        const lockTitle = item.isLocked ? 'Bỏ khóa ảnh' : 'Khóa ảnh lên đầu';
        return `
            <div class="album-item ${item.isLocked ? 'is-locked' : ''}" data-index="${idx}" title="Click để phóng to ảnh">
                <img src="${thumbSrc}" alt="Album Photo" loading="lazy" onerror="this.src='https://via.placeholder.com/80?text=Err'">
                <span class="album-item-preview">🔍</span>
                <div class="album-item-actions">
                    <button type="button" class="album-item-btn album-item-lock ${item.isLocked ? 'locked' : ''}" onclick="toggleLockAlbumPhoto(${idx}, event)" title="${lockTitle}">${lockIcon}</button>
                    <button type="button" class="album-item-btn album-item-delete" onclick="deleteAlbumPhoto(${idx}, event)" title="Xóa ảnh này">🗑️</button>
                </div>
            </div>
        `;
    }).join('');

    albumGrid.querySelectorAll('.album-item').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.album-item-actions')) return;
            const idx = parseInt(el.getAttribute('data-index'), 10);
            previewAlbumPhoto(idx);
        });
    });
}

window.toggleLockAlbumPhoto = async function(index, event) {
    if (event) event.stopPropagation();
    const item = currentAlbumList[index];
    if (!item) return;

    const isCurrentlyLocked = Boolean(item.isLocked);
    const urlKey = getUrlKey(item.url);

    // Lưu lại vị trí và ảnh tiếp theo trước khi chuyển ảnh khóa lên đầu
    if (!isCurrentlyLocked && currentAlbumList.length > 1) {
        savedPhotoIndexBeforeLock = index;
        const nextIdx = (index + 1) % currentAlbumList.length;
        savedNextPhotoUrl = currentAlbumList[nextIdx] ? currentAlbumList[nextIdx].url : null;
    } else {
        savedPhotoIndexBeforeLock = null;
        savedNextPhotoUrl = null;
    }

    try {
        if (isCurrentlyLocked) {
            await remove(ref(db, `loveAlbumLocked_BiMat123/${urlKey}`));
            if (!item.source || item.source !== 'ibb_album') {
                await update(ref(db, `loveAlbumPhotos_BiMat123/${item.key}`), { isLocked: false });
            }
        } else {
            await set(ref(db, `loveAlbumLocked_BiMat123/${urlKey}`), {
                url: item.url,
                thumbUrl: item.thumbUrl || '',
                lockedAt: Date.now(),
                lockedBy: currentUser || 'Anonymous'
            });
            if (!item.source || item.source !== 'ibb_album') {
                await update(ref(db, `loveAlbumPhotos_BiMat123/${item.key}`), { isLocked: true, lockedAt: Date.now() });
            }
        }

        if (sliderModal && sliderModal.classList.contains('active')) {
            setTimeout(() => {
                const newIdx = currentAlbumList.findIndex(p => p.url === item.url);
                if (newIdx !== -1) {
                    previewAlbumPhoto(newIdx);
                }
            }, 100);
        }
    } catch (error) {
        alert('Lỗi khi cập nhật trạng thái khóa: ' + error.message);
    }
};

window.deleteAlbumPhoto = async function(index, event) {
    savedNextPhotoUrl = null;
    savedPhotoIndexBeforeLock = null;
    if (event) event.stopPropagation();
    const item = currentAlbumList[index];
    if (!item) return;

    const confirmed = await askConfirm({
        title: 'Xóa ảnh 🗑️',
        message: 'Bạn có chắc chắn muốn xóa ảnh này khỏi thư viện không?',
        okText: 'Xóa',
        danger: true
    });
    if (!confirmed) return;

    try {
        if (!item.source || item.source !== 'ibb_album') {
            await remove(ref(db, `loveAlbumPhotos_BiMat123/${item.key}`));
        }
        await push(albumDeletedRef, {
            url: item.url,
            thumbUrl: item.thumbUrl || '',
            deletedAt: Date.now(),
            deletedBy: currentUser || 'Anonymous'
        });
        const urlKey = getUrlKey(item.url);
        await remove(ref(db, `loveAlbumLocked_BiMat123/${urlKey}`));

        if (sliderModal && sliderModal.classList.contains('active')) {
            setTimeout(() => {
                if (currentAlbumList.length === 0) {
                    sliderModal.classList.remove('active');
                } else {
                    const nextIdx = Math.min(index, currentAlbumList.length - 1);
                    previewAlbumPhoto(nextIdx);
                }
            }, 100);
        }
    } catch (error) {
        alert('Lỗi khi xóa ảnh: ' + error.message);
    }
};

window.previewAlbumPhoto = function(index) {
    if (!currentAlbumList || !currentAlbumList[index]) return;
    swiperWrapper.innerHTML = '';
    currentAlbumList.forEach((item, idx) => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        const lockIcon = item.isLocked ? '🔒' : '🔓';
        const lockTitle = item.isLocked ? 'Bỏ khóa ảnh để trở về thứ tự cũ' : 'Khóa ảnh luôn ghim ở đầu';
        slide.innerHTML = `
            <img src="${item.url}" alt="Album Preview">
            <div class="slider-photo-toolbar">
                <button type="button" class="btn-slider-toolbar btn-slider-lock ${item.isLocked ? 'locked' : ''}" onclick="toggleLockAlbumPhoto(${idx}, event)" title="${lockTitle}">
                    ${lockIcon}
                </button>
                <button type="button" class="btn-slider-toolbar btn-slider-random" onclick="pickRandomAlbumPhoto(event)" title="Xem ảnh ngẫu nhiên">
                    🎲
                </button>
                <button type="button" class="btn-slider-toolbar btn-slider-delete" onclick="deleteAlbumPhoto(${idx}, event)" title="Xóa ảnh này">
                    🗑️
                </button>
            </div>
        `;
        swiperWrapper.appendChild(slide);
    });

    sliderModal.classList.add('active');
    if (swiperInstance) swiperInstance.destroy(true, true);
    swiperInstance = new Swiper(".mySwiper", {
        initialSlide: index,
        navigation: { nextEl: ".swiper-button-next", prevEl: ".swiper-button-prev" },
        pagination: { el: ".swiper-pagination", clickable: true },
        loop: currentAlbumList.length > 1,
        on: {
            slideNextTransitionStart: function() {
                if (savedNextPhotoUrl) {
                    const targetIdx = currentAlbumList.findIndex(p => p.url === savedNextPhotoUrl);
                    savedNextPhotoUrl = null;
                    savedPhotoIndexBeforeLock = null;
                    if (targetIdx !== -1 && targetIdx !== this.realIndex) {
                        setTimeout(() => {
                            if (this.params && this.params.loop) {
                                this.slideToLoop(targetIdx);
                            } else {
                                this.slideTo(targetIdx);
                            }
                        }, 0);
                    }
                }
            },
            slidePrevTransitionStart: function() {
                savedNextPhotoUrl = null;
                savedPhotoIndexBeforeLock = null;
            }
        }
    });
};

// 1. Kiểm tra rãnh viền đơn sắc (Áp dụng cho ảnh viền xanh, viền hồng, viền tím)
function checkSeparators(imgData, w, h) {
    const marginX = Math.max(2, Math.min(10, Math.floor(w * 0.03)));
    const marginY = Math.max(2, Math.min(10, Math.floor(h * 0.03)));

    function isRowSeparator(y) {
        const sampleCount = 35;
        const step = Math.max(1, Math.floor((w - 2 * marginX) / sampleCount));
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let x = marginX; x < w - marginX; x += step) {
            const idx = (y * w + x) * 4;
            sumR += imgData[idx];
            sumG += imgData[idx + 1];
            sumB += imgData[idx + 2];
            count++;
        }
        if (count === 0) return false;
        const avgR = sumR / count, avgG = sumG / count, avgB = sumB / count;
        for (let x = marginX; x < w - marginX; x += step) {
            const idx = (y * w + x) * 4;
            const diff = Math.abs(imgData[idx] - avgR) + Math.abs(imgData[idx + 1] - avgG) + Math.abs(imgData[idx + 2] - avgB);
            if (diff > 30) return false;
        }
        return true;
    }

    function isColSeparator(x) {
        const sampleCount = 35;
        const step = Math.max(1, Math.floor((h - 2 * marginY) / sampleCount));
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let y = marginY; y < h - marginY; y += step) {
            const idx = (y * w + x) * 4;
            sumR += imgData[idx];
            sumG += imgData[idx + 1];
            sumB += imgData[idx + 2];
            count++;
        }
        if (count === 0) return false;
        const avgR = sumR / count, avgG = sumG / count, avgB = sumB / count;
        for (let y = marginY; y < h - marginY; y += step) {
            const idx = (y * w + x) * 4;
            const diff = Math.abs(imgData[idx] - avgR) + Math.abs(imgData[idx + 1] - avgG) + Math.abs(imgData[idx + 2] - avgB);
            if (diff > 30) return false;
        }
        return true;
    }

    const rawHBands = [];
    let inCut = false, startY = 0;
    for (let y = 0; y < h; y++) {
        if (isRowSeparator(y)) {
            if (!inCut) { inCut = true; startY = y; }
        } else if (inCut) {
            inCut = false;
            rawHBands.push({ start: startY, end: y - 1, size: y - startY });
        }
    }
    if (inCut) rawHBands.push({ start: startY, end: h - 1, size: h - startY });

    const rawVBands = [];
    let inColCut = false, startX = 0;
    for (let x = 0; x < w; x++) {
        if (isColSeparator(x)) {
            if (!inColCut) { inColCut = true; startX = x; }
        } else if (inColCut) {
            inColCut = false;
            rawVBands.push({ start: startX, end: x - 1, size: x - startX });
        }
    }
    if (inColCut) rawVBands.push({ start: startX, end: w - 1, size: w - startX });

    let topMargin = 0, bottomMargin = h;
    const borderThreshY = Math.max(4, Math.floor(h * 0.02));
    const innerH = rawHBands.filter(b => {
        if (b.start <= borderThreshY) { topMargin = Math.max(topMargin, b.end + 1); return false; }
        if (b.end >= h - 1 - borderThreshY) { bottomMargin = Math.min(bottomMargin, b.start); return false; }
        return b.size >= 4 && b.size <= Math.floor(h * 0.35);
    });

    let leftMargin = 0, rightMargin = w;
    const borderThreshX = Math.max(4, Math.floor(w * 0.02));
    const innerV = rawVBands.filter(b => {
        if (b.start <= borderThreshX) { leftMargin = Math.max(leftMargin, b.end + 1); return false; }
        if (b.end >= w - 1 - borderThreshX) { rightMargin = Math.min(rightMargin, b.start); return false; }
        return b.size >= 4 && b.size <= Math.floor(w * 0.35);
    });

    const xSegments = [];
    let prevX = leftMargin;
    for (const sep of innerV) {
        if (sep.start > prevX + 60) xSegments.push({ start: prevX, end: sep.start });
        prevX = sep.end + 1;
    }
    if (rightMargin > prevX + 60) xSegments.push({ start: prevX, end: rightMargin });

    const ySegments = [];
    let prevY = topMargin;
    for (const sep of innerH) {
        if (sep.start > prevY + 60) ySegments.push({ start: prevY, end: sep.start });
        prevY = sep.end + 1;
    }
    if (bottomMargin > prevY + 60) ySegments.push({ start: prevY, end: bottomMargin });

    return {
        xSegments, ySegments,
        topMargin, bottomMargin, leftMargin, rightMargin,
        hasInnerBorders: innerH.length > 0 || innerV.length > 0,
        hasOuterBorders: topMargin > 0 || bottomMargin < h || leftMargin > 0 || rightMargin < w
    };
}

// 2. Tìm đường phân cách sát mí của ảnh ghép 2x2 không viền
function findSeamlessCutLine(imgData, w, h, axis) {
    const L = axis === 'V' ? w : h;
    const otherL = axis === 'V' ? h : w;
    if (L < 220 || otherL < 200) return null;

    function getDiscontinuity(t) {
        const sampleCount = 60;
        const step = Math.max(1, Math.floor((otherL - 10) / sampleCount));
        let sum = 0, jumps = 0, count = 0;
        for (let o = 5; o < otherL - 5; o += step) {
            // Compare pixels slightly further apart to account for WebP compression blur
            const p1 = Math.max(0, t - 2);
            const p2 = Math.min(L - 1, t + 1);
            
            const idx1 = axis === 'V' ? (o * w + p1) * 4 : (p1 * w + o) * 4;
            const idx2 = axis === 'V' ? (o * w + p2) * 4 : (p2 * w + o) * 4;
            
            const d = Math.abs(imgData[idx1] - imgData[idx2]) +
                      Math.abs(imgData[idx1 + 1] - imgData[idx2 + 1]) +
                      Math.abs(imgData[idx1 + 2] - imgData[idx2 + 2]);
            sum += d;
            if (d > 20) jumps++; // Slightly lower threshold for individual jumps
            count++;
        }
        return { meanDiff: count > 0 ? sum / count : 0, jumpRatio: count > 0 ? jumps / count : 0 };
    }

    let bestT = -1, bestScore = 0, bestRatio = 0;
    const minT = Math.floor(L * 0.47), maxT = Math.floor(L * 0.53);
    for (let t = minT; t <= maxT; t++) {
        const disc = getDiscontinuity(t);
        if (disc.meanDiff > bestScore) {
            bestScore = disc.meanDiff;
            bestRatio = disc.jumpRatio;
            bestT = t;
        }
    }

    // Đòi hỏi đường cắt phải chạy liền mạch > 60% chiều dài ảnh
    // Lowered bestScore slightly to account for wider sampling distance which might average out some sharpness
    if (bestT !== -1 && bestScore >= 40 && bestRatio >= 0.60) {
        return { pos: bestT, score: bestScore };
    }
    return null;
}

// 3. Phân tách ảnh an toàn: Đúng 4, 5, 8 mảnh cho ảnh photobooth; giữ nguyên ảnh thường
function splitCanvasRecursively(canvas, depth = 0, forceNoSeamless = false) {
    const w = canvas.width;
    const h = canvas.height;

    if (depth >= 3 || w < 100 || h < 100) return [canvas];

    // Tối ưu hóa bộ nhớ: Tạo canvas thu nhỏ để lấy imgData phân tích (tránh crash RAM)
    const maxAnalysisSize = 800;
    let scale = 1;
    if (Math.max(w, h) > maxAnalysisSize) {
        scale = maxAnalysisSize / Math.max(w, h);
    }
    
    const analysisW = Math.round(w * scale);
    const analysisH = Math.round(h * scale);
    
    const analysisCanvas = document.createElement('canvas');
    analysisCanvas.width = analysisW;
    analysisCanvas.height = analysisH;
    const analysisCtx = analysisCanvas.getContext('2d', { willReadFrequently: true });
    analysisCtx.drawImage(canvas, 0, 0, analysisW, analysisH);
    
    const imgData = analysisCtx.getImageData(0, 0, analysisW, analysisH).data;
    const sepInfoRaw = checkSeparators(imgData, analysisW, analysisH);

    // Hàm helper để convert tọa độ cắt từ bản thu nhỏ về bản gốc
    const unscale = (val) => Math.round(val / scale);

    const sepInfo = {
        xSegments: sepInfoRaw.xSegments.map(s => ({ start: unscale(s.start), end: unscale(s.end) })),
        ySegments: sepInfoRaw.ySegments.map(s => ({ start: unscale(s.start), end: unscale(s.end) })),
        topMargin: unscale(sepInfoRaw.topMargin),
        bottomMargin: unscale(sepInfoRaw.bottomMargin),
        leftMargin: unscale(sepInfoRaw.leftMargin),
        rightMargin: unscale(sepInfoRaw.rightMargin),
        hasInnerBorders: sepInfoRaw.hasInnerBorders,
        hasOuterBorders: sepInfoRaw.hasOuterBorders
    };

    const canSplitV = sepInfo.xSegments.length > 1 && sepInfo.xSegments.length <= 4;
    const canSplitH = sepInfo.ySegments.length > 1 && sepInfo.ySegments.length <= 6;
    const hasAnyBorder = sepInfo.hasInnerBorders || sepInfo.hasOuterBorders;
    
    // Đảm bảo không bị gián đoạn khi đang tiếp tục quá trình cắt đệ quy seamless (2x2)
    // Nếu ở depth 1 và không ép buộc forceNoSeamless, bỏ qua lỗi nhận diện viền giả của checkSeparators
    const isContinuingSeamless = depth === 1 && !forceNoSeamless;
    const disableSeamless = forceNoSeamless || (!isContinuingSeamless && hasAnyBorder);

    // ƯU TIÊN 1: Cắt theo rãnh dọc có viền (Ảnh 2, 3)
    if (!isContinuingSeamless && canSplitV) {
        const subCanvases = [];
        for (const xSeg of sepInfo.xSegments) {
            const sw = xSeg.end - xSeg.start;
            const sh = sepInfo.bottomMargin - sepInfo.topMargin;
            if (sw > 80 && sh > 80) {
                const subCanvas = document.createElement('canvas');
                subCanvas.width = sw;
                subCanvas.height = sh;
                subCanvas.getContext('2d').drawImage(canvas, xSeg.start, sepInfo.topMargin, sw, sh, 0, 0, sw, sh);
                subCanvases.push(...splitCanvasRecursively(subCanvas, depth + 1, true));
            }
        }
        if (subCanvases.length > 1) return subCanvases;
    }

    // ƯU TIÊN 2: Cắt theo rãnh ngang có viền (Ảnh 2, 3, 4)
    if (!isContinuingSeamless && canSplitH) {
        const subCanvases = [];
        for (const ySeg of sepInfo.ySegments) {
            const sw = sepInfo.rightMargin - sepInfo.leftMargin;
            const sh = ySeg.end - ySeg.start;
            if (sw > 80 && sh > 80) {
                const subCanvas = document.createElement('canvas');
                subCanvas.width = sw;
                subCanvas.height = sh;
                subCanvas.getContext('2d').drawImage(canvas, sepInfo.leftMargin, ySeg.start, sw, sh, 0, 0, sw, sh);
                subCanvases.push(...splitCanvasRecursively(subCanvas, depth + 1, true));
            }
        }
        if (subCanvases.length > 1) return subCanvases;
    }

    // ƯU TIÊN 3: Cắt ảnh ghép không viền 2x2, 2x1, 1x2
    if (!disableSeamless && depth < 2) {
        const cutHRaw = findSeamlessCutLine(imgData, analysisW, analysisH, 'H');
        const cutVRaw = findSeamlessCutLine(imgData, analysisW, analysisH, 'V');
        
        const cutH = cutHRaw ? { pos: unscale(cutHRaw.pos), score: cutHRaw.score } : null;
        const cutV = cutVRaw ? { pos: unscale(cutVRaw.pos), score: cutVRaw.score } : null;

        if (cutH && (!cutV || cutH.score >= cutV.score)) {
            const topCanvas = document.createElement('canvas');
            topCanvas.width = w; topCanvas.height = cutH.pos;
            topCanvas.getContext('2d').drawImage(canvas, 0, 0, w, cutH.pos, 0, 0, w, cutH.pos);

            const botCanvas = document.createElement('canvas');
            botCanvas.width = w; botCanvas.height = h - cutH.pos;
            botCanvas.getContext('2d').drawImage(canvas, 0, cutH.pos, w, h - cutH.pos, 0, 0, w, h - cutH.pos);

            return [
                ...splitCanvasRecursively(topCanvas, depth + 1, false),
                ...splitCanvasRecursively(botCanvas, depth + 1, false)
            ];
        } else if (cutV) {
            const leftCanvas = document.createElement('canvas');
            leftCanvas.width = cutV.pos; leftCanvas.height = h;
            leftCanvas.getContext('2d').drawImage(canvas, 0, 0, cutV.pos, h, 0, 0, cutV.pos, h);

            const rightCanvas = document.createElement('canvas');
            rightCanvas.width = w - cutV.pos; rightCanvas.height = h;
            rightCanvas.getContext('2d').drawImage(canvas, cutV.pos, 0, w - cutV.pos, h, 0, 0, w - cutV.pos, h);

            return [
                ...splitCanvasRecursively(leftCanvas, depth + 1, false),
                ...splitCanvasRecursively(rightCanvas, depth + 1, false)
            ];
        }
    }

    // Không phải ảnh ghép cần tách -> Trả về nguyên canvas gốc
    return [canvas];
}

async function processAndSplitCollage(file) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const w = img.width;
            const h = img.height;
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img, 0, 0);

            // Ảnh nhỏ dưới 250px giữ nguyên ảnh gốc
            if (w < 250 || h < 250) {
                resolve([file]);
                return;
            }

            const resultCanvases = splitCanvasRecursively(canvas, 0);

            // NẾU TÁCH THÀNH CÔNG THÀNH NHIỀU ẢNH
            if (resultCanvases && resultCanvases.length > 1) {
                Promise.all(resultCanvases.map(c => canvasToBlob(c))).then(blobs => {
                    const validBlobs = blobs.filter(Boolean);
                    resolve(validBlobs.length > 1 ? validBlobs : [file]);
                });
            } else {
                // KHÔNG PHẢI ĐỐI TƯỢNG CẦN TÁCH -> TẢI NGUYÊN FILE GỐC
                resolve([file]);
            }
        };
        img.onerror = () => resolve([file]);
        img.src = url;
    });
}

function canvasToBlob(canvas) {
    return new Promise(resolve => {
        canvas.toBlob(blob => {
            resolve(blob || null);
        }, 'image/jpeg', 0.92);
    });
}

// 4. Quá trình tải lên an toàn (Bao gồm Album ID và chống nghẽn Rate Limit)
async function handleSelectedFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    uploadProgressContainer.style.display = 'block';
    uploadProgressBar.style.width = '5%';
    uploadProgressText.innerText = 'Đang phân tích định dạng ảnh...';

    const finalUploadItems = [];
    for (let i = 0; i < files.length; i++) {
        const items = await processAndSplitCollage(files[i]);
        finalUploadItems.push(...items);
    }

    const total = finalUploadItems.length;
    let completed = 0;
    let failed = 0;

    for (let i = 0; i < total; i++) {
        const item = finalUploadItems[i];
        if (!item) continue;

        // Giãn cách 800ms giữa các ảnh để ImgBB không chặn API
        if (i > 0) {
            await new Promise(r => setTimeout(r, 800));
        }

        const formData = new FormData();
        formData.append('key', '428c31582c15eb58b9bf14e4c7f3a4ea');
        formData.append('album_id', IBB_ALBUM_ID);
        formData.append('image', item, `love_${Date.now()}_${i}.jpg`);

        await new Promise((resolveUpload) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'https://api.imgbb.com/1/upload', true);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const progress = (e.loaded / e.total) * 100;
                    const totalPercent = Math.round(((completed + (progress / 100)) / total) * 100);
                    uploadProgressBar.style.width = `${totalPercent}%`;
                    uploadProgressText.innerText = `Đang tải ảnh ${completed + 1}/${total} (${totalPercent}%)...`;
                }
            };

            xhr.onload = async () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.success && response.data) {
                            const imgData = response.data;
                            await push(albumPhotosRef, {
                                url: imgData.display_url || imgData.url,
                                thumbUrl: imgData.thumb?.url || imgData.url,
                                albumId: IBB_ALBUM_ID,
                                uploadedAt: Date.now(),
                                uploadedBy: currentUser || 'Anonymous'
                            });
                            completed++;
                            resolveUpload();
                            return;
                        }
                    } catch (err) {
                        console.error("Lỗi phân tích phản hồi ImgBB:", err);
                    }
                }
                console.error("Lỗi upload ImgBB:", xhr.status, xhr.responseText);
                failed++;
                resolveUpload();
            };

            xhr.onerror = () => {
                failed++;
                resolveUpload();
            };

            xhr.send(formData);
        });
    }

    if (failed > 0) {
        uploadProgressBar.style.background = '#e03131';
        uploadProgressText.innerText = `Hoàn tất với ${completed}/${total} ảnh. Có ${failed} ảnh bị lỗi tải lên.`;
    } else {
        uploadProgressBar.style.width = '100%';
        uploadProgressText.innerText = `Hoàn tất! Đã thêm đủ ${completed} ảnh vào Album.`;
    }
    await loadIbbAlbumPhotos();
    setTimeout(() => {
        uploadProgressContainer.style.display = 'none';
        uploadProgressBar.style.background = '';
    }, 3500);
}

document.getElementById('closeFormBtn').addEventListener('click', () => {
    formModal.classList.remove('active');
});

formModal.addEventListener('click', (e) => {
    if (e.target === formModal) formModal.classList.remove('active');
});

const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const confirmOkBtn = document.getElementById('confirmOkBtn');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
let confirmResolver = null;

function closeConfirmModal(result) {
    confirmModal.classList.remove('active');
    if (confirmResolver) {
        const resolve = confirmResolver;
        confirmResolver = null;
        resolve(result);
    }
}

function askConfirm({ title, message, okText, danger = false }) {
    confirmTitle.innerText = title;
    confirmMessage.innerText = message;
    confirmOkBtn.innerText = okText;
    confirmOkBtn.classList.toggle('danger', danger);
    confirmModal.classList.add('active');
    return new Promise((resolve) => {
        confirmResolver = resolve;
    });
}

confirmCancelBtn.addEventListener('click', () => closeConfirmModal(false));
confirmOkBtn.addEventListener('click', () => closeConfirmModal(true));
confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) closeConfirmModal(false);
});

window.editEvent = async function(key) {
    const ev = window.loveEventsList.find(item => item.key === key);
    if (!ev) return;

    const confirmed = await askConfirm({
        title: 'Sửa kỷ niệm ✏️',
        message: `Bạn có muốn sửa kỷ niệm "${ev.title || ''}" không?`,
        okText: 'Sửa'
    });
    if (!confirmed) return;

    editingKey = key;

    document.getElementById('dateInput').value = ev.date || '';
    document.getElementById('titleInput').value = ev.title || '';
    contentInput.innerHTML = ev.content || '';
    document.getElementById('imagesInput').value = (ev.images && ev.images.length > 0) ? ev.images.join(', ') : '';

    if (currentUser === 'Duy') {
        feelingInput.value = ev.feelingDuy || '';
    } else {
        feelingInput.value = ev.feelingChi || '';
    }

    formHeading.innerText = 'Cập nhật kỷ niệm ✏️';
    submitBtn.innerText = 'Cập Nhật Kỷ Niệm 💾';
    formModal.classList.add('active');
};

window.deleteEvent = async function(key) {
    const ev = (window.allLoveEventsList || window.loveEventsList).find(item => item.key === key);
    const title = ev?.title ? `"${ev.title}"` : 'kỷ niệm này';
    const confirmed = await askConfirm({
        title: 'Xóa kỷ niệm 🗑️',
        message: `Bạn có chắc chắn muốn xóa ${title} không? Hành động này không thể hoàn tác.`,
        okText: 'Xóa',
        danger: true
    });
    if (!confirmed) return;

    try {
        const itemRef = ref(db, `loveEvents_BiMat123/${key}`);
        await update(itemRef, {
            isDeleted: true,
            updatedAt: Date.now(),
            updatedBy: currentUser,
            lastAction: 'delete_event'
        });
        if (editingKey === key) formModal.classList.remove('active');
    } catch (error) {
        alert("Lỗi khi xóa: " + error.message);
    }
};

eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const contentHTML = contentInput.innerHTML.trim();
    if (contentInput.innerText.trim() === '' && !contentInput.querySelector('img')) {
        alert("Vui lòng nhập nội dung kỷ niệm!");
        return;
    }

    submitBtn.innerText = editingKey ? 'Đang cập nhật...' : 'Đang lưu...';

    const date = document.getElementById('dateInput').value;
    const title = document.getElementById('titleInput').value;
    const content = contentHTML;
    const imagesStr = document.getElementById('imagesInput').value;
    const myFeeling = feelingInput.value.trim();
    
    let images = [];
    if(imagesStr.trim() !== '') {
        images = imagesStr.split(',').map(img => img.trim()).filter(img => img !== '');
    }

    const oldEv = editingKey ? (window.allLoveEventsList || window.loveEventsList).find(item => item.key === editingKey) : null;
    const prevFeeling = currentUser === 'Duy' ? (oldEv?.feelingDuy || '') : (oldEv?.feelingChi || '');
    const isDeletingFeeling = Boolean(editingKey && prevFeeling.trim() !== '' && myFeeling === '');

    const eventData = {
        date,
        title,
        content,
        images,
        updatedAt: Date.now(),
        updatedBy: currentUser,
        lastAction: isDeletingFeeling ? 'delete_feeling' : (editingKey ? 'edit_event' : 'create_event')
    };

    if (currentUser === 'Duy') {
        eventData.feelingDuy = myFeeling;
    } else if (currentUser === 'Chi') {
        eventData.feelingChi = myFeeling;
    }

    try {
        if (editingKey) {
            const itemRef = ref(db, `loveEvents_BiMat123/${editingKey}`);
            await update(itemRef, eventData);
        } else {
            eventData.createdAt = Date.now();
            eventData.createdBy = currentUser;
            await push(eventsRef, eventData);
        }
        formModal.classList.remove('active');
    } catch (error) {
        alert("Lỗi: " + error.message);
    } finally {
        submitBtn.innerText = editingKey ? 'Cập Nhật Kỷ Niệm 💾' : 'Lưu Kỷ Niệm 💌';
    }
});

const sliderModal = document.getElementById('sliderModal');
const closeSliderBtn = document.getElementById('closeSliderBtn');
const swiperWrapper = document.getElementById('swiperWrapper');

window.openSlider = function(eventIndex, initialSlideIndex = 0) {
    const event = window.loveEventsList[eventIndex];
    if (!event.images || event.images.length === 0) return;

    swiperWrapper.innerHTML = '';
    event.images.forEach(imgUrl => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.innerHTML = `<img src="${imgUrl}" alt="Kỷ niệm" onerror="this.src='https://via.placeholder.com/600x400?text=Lỗi+tải+ảnh'">`;
        swiperWrapper.appendChild(slide);
    });

    sliderModal.classList.add('active');

    if (swiperInstance) {
        swiperInstance.destroy(true, true);
    }
    
    swiperInstance = new Swiper(".mySwiper", {
        initialSlide: initialSlideIndex,
        navigation: { nextEl: ".swiper-button-next", prevEl: ".swiper-button-prev" },
        pagination: { el: ".swiper-pagination", clickable: true },
        loop: event.images.length > 1
    });
}

closeSliderBtn.addEventListener('click', () => {
    savedNextPhotoUrl = null;
    savedPhotoIndexBeforeLock = null;
    sliderModal.classList.remove('active');
});
sliderModal.addEventListener('click', (e) => {
    if (e.target === sliderModal) {
        savedNextPhotoUrl = null;
        savedPhotoIndexBeforeLock = null;
        sliderModal.classList.remove('active');
    }
});

const swiperNextBtn = document.querySelector('.swiper-button-next');
if (swiperNextBtn) {
    swiperNextBtn.addEventListener('click', (e) => {
        if (savedNextPhotoUrl && swiperInstance && currentAlbumList && currentAlbumList.length > 0) {
            const targetIdx = currentAlbumList.findIndex(p => p.url === savedNextPhotoUrl);
            savedNextPhotoUrl = null;
            savedPhotoIndexBeforeLock = null;
            if (targetIdx !== -1) {
                e.preventDefault();
                e.stopPropagation();
                if (swiperInstance.params && swiperInstance.params.loop) {
                    swiperInstance.slideToLoop(targetIdx);
                } else {
                    swiperInstance.slideTo(targetIdx);
                }
            }
        }
    }, true);
}

const swiperPrevBtn = document.querySelector('.swiper-button-prev');
if (swiperPrevBtn) {
    swiperPrevBtn.addEventListener('click', () => {
        savedNextPhotoUrl = null;
        savedPhotoIndexBeforeLock = null;
    }, true);
}

const scrollToTopBtn = document.getElementById('scrollToTopBtn');
if (scrollToTopBtn) {
    scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

const scrollToBottomBtn = document.getElementById('scrollToBottomBtn');
if (scrollToBottomBtn) {
    scrollToBottomBtn.addEventListener('click', () => {
        window.scrollTo({
            top: document.body.scrollHeight,
            behavior: 'smooth'
        });
    });
}

const randomMemoryBtn = document.getElementById('randomMemoryBtn');
if (randomMemoryBtn) {
    randomMemoryBtn.addEventListener('click', () => {
        const items = document.querySelectorAll('#timeline .timeline-item');
        if (!items || items.length === 0) {
            alert('Chưa có kỷ niệm nào để xem ngẫu nhiên!');
            return;
        }

        const randomIndex = Math.floor(Math.random() * items.length);
        const selectedItem = items[randomIndex];

        selectedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });

        selectedItem.classList.remove('highlight-memory');
        void selectedItem.offsetWidth; // Trigger reflow để kích hoạt lại animation
        selectedItem.classList.add('highlight-memory');
    });
}

// ----------------------------------------------------
// LOGIC TODO LIST
// ----------------------------------------------------
const tabListBtn = document.getElementById('tabListBtn');
const tabDetailBtn = document.getElementById('tabDetailBtn');
const tabListContent = document.getElementById('tabListContent');
const tabDetailContent = document.getElementById('tabDetailContent');

const activeTasksContainer = document.getElementById('activeTasks');
const completedTasksContainer = document.getElementById('completedTasks');

const todoForm = document.getElementById('todoForm');
const taskIdInput = document.getElementById('taskIdInput');
const taskNameInput = document.getElementById('taskNameInput');
const taskTimeInput = document.getElementById('taskTimeInput');
const clearTaskTimeBtn = document.getElementById('clearTaskTimeBtn');
const taskContentInput = document.getElementById('taskContentInput');

const addNewTaskBtn = document.getElementById('addNewTaskBtn');
const cancelTaskBtn = document.getElementById('cancelTaskBtn');
const deleteTaskBtn = document.getElementById('deleteTaskBtn');

function switchTodoTab(tab) {
    if (tab === 'list') {
        tabListBtn.classList.add('active');
        tabDetailBtn.classList.remove('active');
        tabListContent.classList.add('active');
        tabDetailContent.classList.remove('active');
    } else {
        tabDetailBtn.classList.add('active');
        tabListBtn.classList.remove('active');
        tabDetailContent.classList.add('active');
        tabListContent.classList.remove('active');
    }
}

if(tabListBtn) tabListBtn.addEventListener('click', () => switchTodoTab('list'));
if(tabDetailBtn) tabDetailBtn.addEventListener('click', () => switchTodoTab('detail'));

if(addNewTaskBtn) {
    addNewTaskBtn.addEventListener('click', () => {
        todoForm.reset();
        taskIdInput.value = '';
        deleteTaskBtn.style.display = 'none';
        switchTodoTab('detail');
    });
}

if(cancelTaskBtn) {
    cancelTaskBtn.addEventListener('click', () => {
        switchTodoTab('list');
    });
}

if (clearTaskTimeBtn && taskTimeInput) {
    clearTaskTimeBtn.addEventListener('click', () => {
        taskTimeInput.value = '';
    });
}

function renderTodos() {
    if(!activeTasksContainer || !completedTasksContainer) return;

    activeTasksContainer.innerHTML = '';
    completedTasksContainer.innerHTML = '';
    
    let hasActive = false;
    let hasCompleted = false;

    // Sắp xếp theo ngày (tăng dần, task không có hạn xếp xuống cuối)
    window.loveTodosList.sort((a, b) => {
        if (!a.time && !b.time) return 0;
        if (!a.time) return 1;
        if (!b.time) return -1;
        return new Date(a.time) - new Date(b.time);
    });

    window.loveTodosList.forEach(task => {
        let dateHtml = '';
        if (task.time) {
            const timeObj = new Date(task.time);
            const timeStr = isNaN(timeObj) ? task.time : timeObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            dateHtml = ` <span class="todo-date">(${timeStr})</span>`;
        }
        
        const itemHtml = `
            <div class="todo-item">
                <input type="checkbox" onchange="toggleTodoStatus('${task.key}', this.checked)" ${task.isCompleted ? 'checked' : ''}>
                <a href="#" onclick="editTodo('${task.key}'); return false;">
                    ${task.name}${dateHtml}
                </a>
            </div>
        `;

        if (task.isCompleted) {
            completedTasksContainer.innerHTML += itemHtml;
            hasCompleted = true;
        } else {
            activeTasksContainer.innerHTML += itemHtml;
            hasActive = true;
        }
    });

    if (!hasActive) activeTasksContainer.innerHTML = '<p style="color:#aaa; font-size:0.85rem; font-style:italic;">Không có task nào đang tiến hành.</p>';
    if (!hasCompleted) completedTasksContainer.innerHTML = '<p style="color:#aaa; font-size:0.85rem; font-style:italic;">Chưa có task nào hoàn thành.</p>';
}

window.toggleTodoStatus = async function(key, isCompleted) {
    try {
        await update(ref(db, `loveTodos_BiMat123/${key}`), {
            isCompleted,
            updatedAt: Date.now(),
            updatedBy: currentUser,
            lastAction: isCompleted ? 'complete_todo' : 'uncomplete_todo'
        });
    } catch (e) {
        alert('Lỗi: ' + e.message);
    }
};

window.editTodo = function(key) {
    const task = (window.allLoveTodosList || window.loveTodosList).find(t => t.key === key);
    if (!task) return;
    
    taskIdInput.value = task.key;
    taskNameInput.value = task.name || '';
    taskTimeInput.value = task.time || '';
    taskContentInput.value = task.content || '';
    
    deleteTaskBtn.style.display = 'block';
    switchTodoTab('detail');
};

if(todoForm) {
    todoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('saveTaskBtn');
        const oldText = btn.innerText;
        btn.innerText = 'Đang lưu...';
        
        const key = taskIdInput.value;
        const taskData = {
            name: taskNameInput.value.trim(),
            time: taskTimeInput.value,
            content: taskContentInput.value.trim(),
            updatedAt: Date.now(),
            updatedBy: currentUser,
            lastAction: key ? 'edit_todo' : 'create_todo'
        };

        try {
            if (key) {
                await update(ref(db, `loveTodos_BiMat123/${key}`), taskData);
            } else {
                taskData.isCompleted = false;
                taskData.createdAt = Date.now();
                taskData.createdBy = currentUser;
                await push(todosRef, taskData);
            }
            switchTodoTab('list');
        } catch (error) {
            alert('Lỗi lưu task: ' + error.message);
        } finally {
            btn.innerText = oldText;
        }
    });
}

if(deleteTaskBtn) {
    deleteTaskBtn.addEventListener('click', async () => {
        const key = taskIdInput.value;
        if (!key) return;
        
        const confirmed = await askConfirm({
            title: 'Xóa Task',
            message: 'Bạn có chắc chắn muốn xóa task này?',
            okText: 'Xóa',
            danger: true
        });
        
        if (confirmed) {
            try {
                await update(ref(db, `loveTodos_BiMat123/${key}`), {
                    isDeleted: true,
                    updatedAt: Date.now(),
                    updatedBy: currentUser,
                    lastAction: 'delete_todo'
                });
                switchTodoTab('list');
            } catch (e) {
                alert('Lỗi xóa task: ' + e.message);
            }
        }
    });
}