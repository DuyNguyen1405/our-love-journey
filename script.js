import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBxkDY6uEMMwZy8r29wyixjNbBBka5mQk0",
    authDomain: "our-love-journey-c2da0.firebaseapp.com",
    databaseURL: "https://our-love-journey-c2da0-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "our-love-journey-c2da0",
    storageBucket: "our-love-journey-c2da0.firebasestorage.app",
    messagingSenderId: "428563386307",
    appId: "1:428563386307:web:b2c4daacc93aaf19b1f776"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Các bảng dữ liệu trên Firebase
const eventsRef = ref(db, 'loveEvents_BiMat123'); 
const settingsRef = ref(db, 'loveSettings_BiMat123'); // Cài đặt: biệt danh + ghi chú
const todosRef = ref(db, 'loveTodos_BiMat123'); // Todo List

// Biến lưu trữ toàn cục
window.loveEventsList = [];
window.loveTodosList = [];
let currentEventsData = null; // Chứa dữ liệu thô của sự kiện
let nicknameDuy = ''; // Biệt danh Duy
let nicknameChi = ''; // Biệt danh Chi
let noteDuy = ''; // Ghi chú riêng Duy
let noteChi = ''; // Ghi chú riêng Chi

let swiperInstance = null;
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

// Logic đăng nhập
const passcodeInput = document.getElementById('passcodeInput');
const errorMessage = document.getElementById('errorMessage');
const loginScreen = document.getElementById('loginScreen');
const mainContent = document.getElementById('mainContent');

if (passcodeInput && errorMessage && loginScreen && mainContent) {
    passcodeInput.focus(); 

    passcodeInput.addEventListener('keyup', (e) => {
        let val = e.target.value;
        val = val.replace(/[^0-9]/g, '');
        e.target.value = val; 

        if (errorMessage.classList.contains('active')) {
            errorMessage.classList.remove('active');
        }

        if (val.length === 4) {
            if (val === '1405' || val === '1704') {
                currentUser = (val === '1405') ? 'Duy' : 'Chi';
                
                // Hiển thị lời chào có kèm biệt danh (nếu đã tải xong)
                const currentNickname = (currentUser === 'Duy') ? nicknameDuy : nicknameChi;
                const greetingName = currentNickname ? `${currentUser} (${currentNickname})` : currentUser;
                if(userGreeting) {
                    userGreeting.innerText = `Chào ${greetingName} ❤️`;
                }

                passcodeInput.disabled = true;
                loginScreen.style.opacity = '0';
                
                setTimeout(() => {
                    loginScreen.style.display = 'none';
                    mainContent.style.display = 'block';
                }, 800);
            } else {
                errorMessage.classList.add('active');
                passcodeInput.value = '';
            }
        }
    });
}

// ----------------------------------------------------
// ĐỒNG BỘ DỮ LIỆU TỪ FIREBASE VÀ RENDER TIMELINE
// ----------------------------------------------------

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
        userGreeting.innerText = `Chào ${greetingName} ❤️`;
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
    renderTodos();
});

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
        return;
    }

    window.loveEventsList = Object.entries(currentEventsData).map(([key, value]) => ({
        key,
        ...value
    }));
    
    window.loveEventsList.sort((a, b) => new Date(a.date) - new Date(b.date));

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
    const ev = window.loveEventsList.find(item => item.key === key);
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
        await remove(itemRef);
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

    const eventData = { date, title, content, images };

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

closeSliderBtn.addEventListener('click', () => sliderModal.classList.remove('active'));
sliderModal.addEventListener('click', (e) => {
    if (e.target === sliderModal) sliderModal.classList.remove('active');
});

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

function renderTodos() {
    if(!activeTasksContainer || !completedTasksContainer) return;

    activeTasksContainer.innerHTML = '';
    completedTasksContainer.innerHTML = '';
    
    let hasActive = false;
    let hasCompleted = false;

    // Sắp xếp theo ngày (tăng dần)
    window.loveTodosList.sort((a, b) => new Date(a.time) - new Date(b.time));

    window.loveTodosList.forEach(task => {
        const timeObj = new Date(task.time);
        const timeStr = isNaN(timeObj) ? task.time : timeObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        const itemHtml = `
            <div class="todo-item">
                <input type="checkbox" onchange="toggleTodoStatus('${task.key}', this.checked)" ${task.isCompleted ? 'checked' : ''}>
                <a href="#" onclick="editTodo('${task.key}'); return false;">
                    ${task.name} <span class="todo-date">(${timeStr})</span>
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
        await update(ref(db, `loveTodos_BiMat123/${key}`), { isCompleted });
    } catch (e) {
        alert('Lỗi: ' + e.message);
    }
};

window.editTodo = function(key) {
    const task = window.loveTodosList.find(t => t.key === key);
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
            content: taskContentInput.value.trim()
        };

        try {
            if (key) {
                await update(ref(db, `loveTodos_BiMat123/${key}`), taskData);
            } else {
                taskData.isCompleted = false;
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
                await remove(ref(db, `loveTodos_BiMat123/${key}`));
                switchTodoTab('list');
            } catch (e) {
                alert('Lỗi xóa task: ' + e.message);
            }
        }
    });
}