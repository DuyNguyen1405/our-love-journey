import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

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
const eventsRef = ref(db, 'loveEvents');

window.loveEventsList = [];
let swiperInstance = null;
let editingKey = null;

const timeline = document.getElementById('timeline');
const eventForm = document.getElementById('eventForm');
const contentInput = document.getElementById('contentInput');
const formHeading = document.getElementById('formHeading');
const submitBtn = document.getElementById('submitBtn');
const formModal = document.getElementById('formModal');

// Thao tác định dạng văn bản
window.formatDoc = function(cmd, value = null) {
    document.execCommand(cmd, false, value);
    contentInput.focus();
};

// Bật / Tắt Menu Form Đăng Ký
document.getElementById('openFormBtn').addEventListener('click', () => {
    editingKey = null;
    eventForm.reset();
    contentInput.innerHTML = '';
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

// Lắng nghe dữ liệu Realtime
onValue(eventsRef, (snapshot) => {
    const data = snapshot.val();
    timeline.innerHTML = '';

    if (data) {
        window.loveEventsList = Object.entries(data).map(([key, value]) => ({
            key,
            ...value
        }));
        
        // Sắp xếp theo ngày tháng TĂNG DẦN (Cũ nhất ở trên cùng)
        window.loveEventsList.sort((a, b) => new Date(a.date) - new Date(b.date));

        window.loveEventsList.forEach((ev, index) => {
            const item = document.createElement('div');
            item.className = 'timeline-item';
            
            const dateObj = new Date(ev.date);
            const dateStr = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const photoIcon = (ev.images && ev.images.length > 0) ? '📸' : '';

            item.innerHTML = `
                <div class="timeline-date">${dateStr}</div>
                <div class="timeline-title" onclick="openSlider(${index})">${ev.title} ${photoIcon}</div>
                <div class="timeline-content">${ev.content}</div>
                <div class="timeline-actions">
                    <button class="btn-action btn-edit" onclick="editEvent('${ev.key}')" title="Sửa kỷ niệm">✏️ Sửa</button>
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

    formHeading.innerText = 'Chỉnh sửa kỷ niệm ✏️';
    submitBtn.innerText = 'Cập Nhật Kỷ Niệm 💾';
    formModal.classList.add('active'); // Bật Menu lên
};

// Xóa kỷ niệm
window.deleteEvent = async function(key) {
    if (confirm("Bạn có chắc chắn muốn xóa kỷ niệm này không? 🥺")) {
        try {
            const itemRef = ref(db, `loveEvents/${key}`);
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
    
    let images = [];
    if(imagesStr.trim() !== '') {
        images = imagesStr.split(',').map(img => img.trim()).filter(img => img !== '');
    }

    const eventData = { date, title, content, images };

    try {
        if (editingKey) {
            const itemRef = ref(db, `loveEvents/${editingKey}`);
            await update(itemRef, eventData);
        } else {
            await push(eventsRef, eventData);
        }
        formModal.classList.remove('active'); // Đóng form sau khi lưu thành công
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

window.openSlider = function(index) {
    const event = window.loveEventsList[index];
    if (!event.images || event.images.length === 0) {
        alert("Sự kiện này chưa có ảnh nào! 🥺");
        return;
    }

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
        navigation: { nextEl: ".swiper-button-next", prevEl: ".swiper-button-prev" },
        pagination: { el: ".swiper-pagination", clickable: true },
        loop: event.images.length > 1
    });
}

closeSliderBtn.addEventListener('click', () => sliderModal.classList.remove('active'));
sliderModal.addEventListener('click', (e) => {
    if (e.target === sliderModal) sliderModal.classList.remove('active');
});