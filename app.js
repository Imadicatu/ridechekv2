// ===== ข้อมูลจำลอง (Simulated Data) =====

// สถานที่ยอดนิยมในกรุงเทพ
const LOCATIONS = [
    { name: 'สยามพารากอน', icon: '🛍️', lat: 13.7466, lng: 100.5347 },
    { name: 'เซ็นทรัลเวิลด์', icon: '🏬', lat: 13.7468, lng: 100.5390 },
    { name: 'สนามบินสุวรรณภูมิ', icon: '✈️', lat: 13.6900, lng: 100.7501 },
    { name: 'สนามบินดอนเมือง', icon: '✈️', lat: 13.9133, lng: 100.6067 },
    { name: 'อนุสาวรีย์ชัยสมรภูมิ', icon: '🏛️', lat: 13.7649, lng: 100.5382 },
    { name: 'หมอชิต', icon: '🚌', lat: 13.8028, lng: 100.5538 },
    { name: 'สาทร', icon: '🏢', lat: 13.7183, lng: 100.5150 },
    { name: 'อโศก', icon: '🚇', lat: 13.7379, lng: 100.5601 },
    { name: 'ทองหล่อ', icon: '🍸', lat: 13.7341, lng: 100.5782 },
    { name: 'เอกมัย', icon: '🚐', lat: 13.7197, lng: 100.5852 },
    { name: 'สีลม', icon: '🏦', lat: 13.7280, lng: 100.5216 },
    { name: 'เยาวราช', icon: '🐉', lat: 13.7388, lng: 100.5082 },
    { name: 'คลองเตย', icon: '📦', lat: 13.7125, lng: 100.5556 },
    { name: 'พระราม 9', icon: '🏙️', lat: 13.7572, lng: 100.5657 },
    { name: 'ลาดพร้าว', icon: '🏘️', lat: 13.8058, lng: 100.5817 },
    { name: 'บางนา', icon: '🛣️', lat: 13.6667, lng: 100.6042 },
    { name: 'รัชดาภิเษก', icon: '🌃', lat: 13.7632, lng: 100.5735 },
    { name: 'MBK Center', icon: '🛒', lat: 13.7443, lng: 100.5300 },
    { name: 'ไอคอนสยาม', icon: '🌟', lat: 13.7262, lng: 100.5102 },
    { name: 'จตุจักร', icon: '🎪', lat: 13.7999, lng: 100.5505 },
];

// ข้อมูลแอปเรียกรถ
const RIDE_APPS = [
    {
        id: 'grab',
        name: 'Grab',
        type: 'GrabCar / GrabBike',
        logo: 'G',
        color: '#00B14F',
        basePrice: 45,
        perKm: 7.5,
        surgeMultiplier: 1.0,
        avgRating: 4.7,
        minWait: 2,
        maxWait: 6,
    },
    {
        id: 'bolt',
        name: 'Bolt',
        type: 'Bolt Ride',
        logo: 'B',
        color: '#34D186',
        basePrice: 35,
        perKm: 6.8,
        surgeMultiplier: 1.0,
        avgRating: 4.5,
        minWait: 3,
        maxWait: 8,
    },
    {
        id: 'lineman',
        name: 'LINE MAN',
        type: 'LINE MAN Taxi',
        logo: 'L',
        color: '#00C851',
        basePrice: 40,
        perKm: 7.2,
        surgeMultiplier: 1.0,
        avgRating: 4.6,
        minWait: 3,
        maxWait: 7,
    },
    {
        id: 'maxim',
        name: 'Maxim',
        type: 'Maxim Car',
        logo: 'M',
        color: '#FF6B35',
        basePrice: 30,
        perKm: 6.0,
        surgeMultiplier: 1.0,
        avgRating: 4.3,
        minWait: 4,
        maxWait: 10,
    },
    {
        id: 'indrive',
        name: 'InDrive',
        type: 'InDrive Ride',
        logo: 'iD',
        color: '#B3FF00',
        basePrice: 25,
        perKm: 5.5,
        surgeMultiplier: 1.0,
        avgRating: 4.2,
        minWait: 3,
        maxWait: 12,
    },
];

// ===== ตัวแปรกลาง =====
let currentResults = [];

// ===== คำนวณระยะทางจำลอง (Haversine formula) =====
function calcDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ===== คำนวณราคาจำลอง =====
function calcPrice(app, distanceKm) {
    // เพิ่มความสุ่มเล็กน้อยเพื่อให้เหมือนจริง
    const randomFactor = 0.9 + Math.random() * 0.2;
    // จำลอง Surge Pricing ตามเวลา
    const hour = new Date().getHours();
    let surge = 1.0;
    if (hour >= 7 && hour <= 9) surge = 1.3;    // ชั่วโมงเร่งด่วนเช้า
    if (hour >= 17 && hour <= 19) surge = 1.4;   // ชั่วโมงเร่งด่วนเย็น
    if (hour >= 22 || hour <= 5) surge = 1.2;    // กลางคืน

    const price = (app.basePrice + (app.perKm * distanceKm * 1.3)) * surge * randomFactor;
    return Math.round(price);
}

// ===== ระบบ Autocomplete =====
function setupAutocomplete(inputId, suggestionsId) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(suggestionsId);

    input.addEventListener('input', function () {
        const query = this.value.trim().toLowerCase();
        dropdown.innerHTML = '';

        if (query.length === 0) {
            dropdown.classList.remove('active');
            return;
        }

        const matches = LOCATIONS.filter(loc =>
            loc.name.toLowerCase().includes(query)
        ).slice(0, 5);

        if (matches.length === 0) {
            dropdown.classList.remove('active');
            return;
        }

        matches.forEach(loc => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.innerHTML = `<span class="loc-icon">${loc.icon}</span> ${loc.name}`;
            item.addEventListener('click', () => {
                input.value = loc.name;
                dropdown.classList.remove('active');
            });
            dropdown.appendChild(item);
        });

        dropdown.classList.add('active');
    });

    // ปิด dropdown เมื่อคลิกที่อื่น
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.input-wrapper')) {
            dropdown.classList.remove('active');
        }
    });

    // แสดงทั้งหมดเมื่อ focus ถ้ายังว่าง
    input.addEventListener('focus', function () {
        if (this.value.trim() === '') {
            dropdown.innerHTML = '';
            LOCATIONS.slice(0, 6).forEach(loc => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.innerHTML = `<span class="loc-icon">${loc.icon}</span> ${loc.name}`;
                item.addEventListener('click', () => {
                    input.value = loc.name;
                    dropdown.classList.remove('active');
                });
                dropdown.appendChild(item);
            });
            dropdown.classList.add('active');
        }
    });
}

// ===== ค้นหาราคา =====
function searchRides() {
    const pickupName = document.getElementById('pickup').value.trim();
    const dropoffName = document.getElementById('dropoff').value.trim();

    if (!pickupName || !dropoffName) {
        shakeElement(document.querySelector('.search-box'));
        return;
    }

    // หา location data
    const pickup = LOCATIONS.find(l => l.name === pickupName);
    const dropoff = LOCATIONS.find(l => l.name === dropoffName);

    if (!pickup || !dropoff) {
        alert('กรุณาเลือกสถานที่จากรายการที่แนะนำ');
        return;
    }

    if (pickupName === dropoffName) {
        alert('จุดรับและปลายทางต้องไม่ซ้ำกัน!');
        return;
    }

    // แสดง Loading
    const btn = document.getElementById('search-btn');
    btn.querySelector('.btn-text').style.display = 'none';
    btn.querySelector('.btn-loading').style.display = 'inline';
    btn.disabled = true;

    // จำลองการโหลดข้อมูล (delay 1.5s)
    setTimeout(() => {
        const distance = calcDistance(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
        // เพิ่มระยะทางถนนจริง (~1.3x ระยะตรง)
        const roadDistance = distance * 1.3;

        // คำนวณราคาจากทุกแอป
        currentResults = RIDE_APPS.map(app => {
            const price = calcPrice(app, roadDistance);
            const waitTime = Math.floor(app.minWait + Math.random() * (app.maxWait - app.minWait));
            const rating = (app.avgRating - 0.1 + Math.random() * 0.2).toFixed(1);
            return {
                ...app,
                price,
                waitTime,
                rating: parseFloat(rating),
                distance: roadDistance.toFixed(1),
            };
        });

        // เรียงตามราคา
        currentResults.sort((a, b) => a.price - b.price);

        // แสดงผล
        renderResults(pickupName, dropoffName, roadDistance);

        // ซ่อน Loading
        btn.querySelector('.btn-text').style.display = 'inline';
        btn.querySelector('.btn-loading').style.display = 'none';
        btn.disabled = false;

        // Scroll ลงไปดูผล
        document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
    }, 1500);
}

// ===== แสดงผลลัพธ์ =====
function renderResults(pickup, dropoff, distance) {
    const section = document.getElementById('results-section');
    const grid = document.getElementById('results-grid');
    const routeInfo = document.getElementById('route-info');
    const savingsBanner = document.getElementById('savings-banner');
    const savingsText = document.getElementById('savings-text');

    section.style.display = 'block';

    // Route info
    routeInfo.innerHTML = `📍 ${pickup} &nbsp;→&nbsp; 🏁 ${dropoff} &nbsp;|&nbsp; 📏 ${distance.toFixed(1)} กม.`;

    // Clear & render cards
    grid.innerHTML = '';

    const cheapestPrice = currentResults[0].price;
    const expensivePrice = currentResults[currentResults.length - 1].price;

    currentResults.forEach((result, index) => {
        const isCheapest = index === 0;
        const savedAmount = result.price - cheapestPrice;

        const card = document.createElement('div');
        card.className = `result-card ${isCheapest ? 'cheapest' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;

        card.innerHTML = `
            <div class="app-info">
                <div class="app-logo ${result.id}">${result.logo}</div>
                <div>
                    <div class="app-name">${result.name}</div>
                    <div class="app-type">${result.type}</div>
                </div>
            </div>
            <div class="ride-details">
                <div class="detail-item">
                    <div class="detail-label">เวลารอ</div>
                    <div class="detail-value">🕐 ${result.waitTime} นาที</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">ระยะทาง</div>
                    <div class="detail-value">📏 ${result.distance} กม.</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">คะแนน</div>
                    <div class="detail-value"><span class="stars">★</span> ${result.rating}</div>
                </div>
            </div>
            <div class="price-cta">
                <div>
                    <div class="price"><span class="price-currency">฿</span>${result.price}</div>
                    ${!isCheapest ? `<div class="price-saved" style="color: #E53935; background: #FFEBEE;">แพงกว่า ฿${savedAmount}</div>` : '<div class="price-saved">ประหยัดที่สุด!</div>'}
                </div>
                <button class="open-app-btn ${result.id}" onclick="openApp('${result.id}')">
                    เปิดแอป ${result.name} →
                </button>
            </div>
        `;

        grid.appendChild(card);
    });

    // Savings Banner
    const savings = expensivePrice - cheapestPrice;
    if (savings > 0) {
        savingsBanner.style.display = 'block';
        savingsText.textContent = `เจ๋งไปเลย! ถ้าคุณเลือก ${currentResults[0].name} แทน ${currentResults[currentResults.length - 1].name} คุณจะประหยัดได้ ฿${savings} (ถูกกว่า ${Math.round(savings / expensivePrice * 100)}%)`;
    }

    // Update sort buttons
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.sort === 'price') btn.classList.add('active');
    });
}

// ===== เรียงลำดับผล =====
function sortResults(criteria) {
    // Update active button
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sort === criteria);
    });

    switch (criteria) {
        case 'price':
            currentResults.sort((a, b) => a.price - b.price);
            break;
        case 'time':
            currentResults.sort((a, b) => a.waitTime - b.waitTime);
            break;
        case 'rating':
            currentResults.sort((a, b) => b.rating - a.rating);
            break;
    }

    const routeInfo = document.getElementById('route-info').innerHTML;
    const pickup = routeInfo.match(/📍 (.+?) /)?.[1] || '';
    const dropoff = routeInfo.match(/🏁 (.+?) /)?.[1] || '';

    renderResults(
        pickup,
        dropoff,
        parseFloat(currentResults[0].distance) / 1.3
    );
}

// ===== Quick Search =====
function quickSearch(from, to) {
    document.getElementById('pickup').value = from;
    document.getElementById('dropoff').value = to;
    searchRides();
}

// ===== เปิดแอป =====
function openApp(appId) {
    const appNames = {
        grab: 'Grab',
        bolt: 'Bolt',
        lineman: 'LINE MAN',
        maxim: 'Maxim',
        indrive: 'InDrive'
    };
    alert(`🚗 กำลังเปิดแอป ${appNames[appId]}...\n\n(ในเวอร์ชันจริง ระบบจะพาคุณไปเปิดแอป ${appNames[appId]} พร้อมกรอกจุดรับ-ส่งให้อัตโนมัติ)`);
}

// ===== Shake Animation =====
function shakeElement(el) {
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'shake 0.4s ease';
    setTimeout(() => { el.style.animation = 'none'; }, 400);
}

// เพิ่ม CSS animation สำหรับ shake
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-8px); }
        40% { transform: translateX(8px); }
        60% { transform: translateX(-4px); }
        80% { transform: translateX(4px); }
    }
`;
document.head.appendChild(style);

// ===== FAQ Toggle =====
function toggleFaq(button) {
    const item = button.closest('.faq-item');
    item.classList.toggle('open');
}

// ===== Animate Stats Numbers =====
function animateStats() {
    const numbers = document.querySelectorAll('[data-target]');
    numbers.forEach(num => {
        const target = parseInt(num.dataset.target);
        const duration = 2000;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(eased * target);
            num.textContent = current.toLocaleString();
            if (progress < 1) requestAnimationFrame(update);
        }

        requestAnimationFrame(update);
    });
}

// ===== Intersection Observer for Stats Animation =====
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateStats();
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    // Setup autocomplete
    setupAutocomplete('pickup', 'pickup-suggestions');
    setupAutocomplete('dropoff', 'dropoff-suggestions');

    // Observe stats section
    const statsSection = document.getElementById('stats');
    if (statsSection) statsObserver.observe(statsSection);

    // Enter key to search
    document.getElementById('pickup').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('dropoff').focus();
    });
    document.getElementById('dropoff').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchRides();
    });
});
