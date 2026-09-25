import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// ==========================================
// CẤU HÌNH FIREBASE TRỰC TIẾP TẠI ĐÂY
// ==========================================
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
const eventsRef = ref(db, 'loveEvents_BiMat123'); // Tên bảng dữ liệu

window.loveEventsList = [];
let swiperInstance = null;
let editingKey = null;
let currentUser = ''; // 'Duy' hoặc 'Chi'

// Biến giao diện
const timeline = document.getElementById('timeline');
const eventForm = document.getElementById('eventForm');
const contentInput = document.getElementById('contentInput');
const formHeading = document.getElementById('formHeading');
const submitBtn = document.getElementById('submitBtn');
const formModal = document.getElementById('formModal');
const feelingInput = document.getElementById('feelingInput');
const userGreeting = document.getElementById('userGreeting');

// ==========================================
// LOGIC KIỂM TRA MẬT KHẨU (ĐÃ SỬA LỖI)
// ==========================================
const passcodeInput = document.getElementById('passcodeInput');
const errorMessage = document.getElementById('errorMessage');
const loginScreen = document.getElementById('loginScreen');
const mainContent = document.getElementById('mainContent');

if (passcodeInput && errorMessage && loginScreen && mainContent) {
    // THÊM DÒNG NÀY ĐỂ ÉP TỰ ĐỘNG FOCUS KHI TẢI TRANG
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
                
                if(userGreeting) {
                    userGreeting.innerText = `Chào ${currentUser} ❤️`;
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

// Thao tác định dạng văn bản
window.formatDoc = function(cmd, value = null) {
    document.execCommand(cmd, false, value);
    contentInput.focus();
};

// Bật Menu Form Đăng Ký
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

// Lắng nghe dữ liệu Realtime
// Lắng nghe dữ liệu Realtime
onValue(eventsRef, (snapshot) => {
    const data = snapshot.val();
    timeline.innerHTML = '';

    if (data) {
        window.loveEventsList = Object.entries(data).map(([key, value]) => ({
            key,
            ...value
        }));
        
        window.loveEventsList.sort((a, b) => new Date(a.date) - new Date(b.date));

        window.loveEventsList.forEach((ev, index) => {
            const item = document.createElement('div');
            
            // ==========================================
            // KIỂM TRA TRẠNG THÁI CẢM NGHĨ (THÊM VIỀN ĐỎ/XANH)
            // ==========================================
            const hasChiFeeling = ev.feelingChi && ev.feelingChi.trim() !== '';
            const hasDuyFeeling = ev.feelingDuy && ev.feelingDuy.trim() !== '';
            
            // Mặc định class là timeline-item
            let itemClasses = 'timeline-item';
            
            // Nếu cả 2 đều đã viết cảm nghĩ -> Viền Xanh
            if (hasChiFeeling && hasDuyFeeling) {
                itemClasses += ' complete-feelings';
            } 
            // Nếu 1 trong 2 (hoặc cả 2) chưa viết cảm nghĩ -> Viền Đỏ
            else {
                itemClasses += ' incomplete-feelings';
            }
            
            // Gán class cho phần tử
            item.className = itemClasses;
            // ==========================================

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

            let feelingsHTML = '';
            if (hasChiFeeling || hasDuyFeeling) {
                feelingsHTML += '<div class="feelings-container">';
                if (hasChiFeeling) {
                    feelingsHTML += `<div class="feeling-box feeling-chi"><span class="feeling-author">👩 Chi:</span>${ev.feelingChi}</div>`;
                }
                if (hasDuyFeeling) {
                    feelingsHTML += `<div class="feeling-box feeling-duy"><span class="feeling-author">👦 Duy:</span>${ev.feelingDuy}</div>`;
                }
                feelingsHTML += '</div>';
            }

            item.innerHTML = `
                <div class="timeline-date">${dateStr}</div>
                <div class="timeline-title" onclick="openSlider(${index}, 0)">${ev.title} ${photoIcon}</div>
                <div class="timeline-content">${ev.content}</div>
                ${galleryHTML}
                ${feelingsHTML}
                <div class="timeline-actions">
                    <button class="btn-action btn-edit" onclick="editEvent('${ev.key}')" title="Sửa hoặc thêm cảm nghĩ">✏️ Sửa</button>
                    <button class="btn-action btn-delete" onclick="deleteEvent('${ev.key}')" title="Xóa kỷ niệm">🗑️ Xóa</button>
                </div>
            `;
            timeline.appendChild(item);
        });
    } else {
        timeline.innerHTML = '<p style="text-align:center; color:#888;">Chưa có kỷ niệm nào. Hãy tạo kỷ niệm đầu tiên nhé!</p>';
    }
});

// Kích hoạt chế độ Chỉnh sửa
window.editEvent = function(key) {
    const ev = window.loveEventsList.find(item => item.key === key);
    if (!ev) return;

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

// Xóa kỷ niệm
window.deleteEvent = async function(key) {
    if (confirm("Bạn có chắc chắn muốn xóa kỷ niệm này không? 🥺")) {
        try {
            const itemRef = ref(db, `loveEvents_BiMat123/${key}`);
            await remove(itemRef);
            if (editingKey === key) formModal.classList.remove('active');
        } catch (error) {
            alert("Lỗi khi xóa: " + error.message);
        }
    }
};

// Gửi dữ liệu (Thêm mới hoặc Cập nhật)
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

// Modal Slider Ảnh 
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