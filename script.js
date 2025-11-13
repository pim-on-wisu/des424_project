// ===== Initialize Leaflet Map =====
const map = L.map("map").setView([14.0745, 100.6065], 15);  // ตั้งพิกัดเริ่มต้นของแผนที่

// ===== Tile Layer =====
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
  maxZoom: 19,
}).addTo(map);

// ===== Show User Location (Geolocation) =====
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;

      // Add user's location marker to map
      const userMarker = L.marker([latitude, longitude], {
        icon: L.icon({
          iconUrl: "https://cdn-icons-png.flaticon.com/512/447/447031.png",  // ไอคอนสำหรับตำแหน่งผู้ใช้
          iconSize: [32, 32],
        }),
      })
      .addTo(map)
      .bindPopup("<b>You are here</b>")
      .openPopup();

      map.setView([latitude, longitude], 16);  // Zoom to user's location
    },
    (err) => {
      console.warn("Location access denied:", err.message);
      alert("ไม่สามารถเข้าถึงตำแหน่งของคุณได้");
    }
  );
} else {
  alert("Your browser does not support geolocation.");
}


let allMarkers = [];

// ===== Custom Locations for Search (เพิ่มข้อมูลจำนวนช่องจอดที่ว่าง) =====
const customLocations = [
  { keywords: ["ยิม 7", "gym 7"], name: "ยิม 7", lat: 14.06991063395858, lng: 100.60127691199303, available: 0, total: 10 },
  { keywords: ["สกร", "sgr"], name: "สกร (SGR Building)", lat: 14.071526194306847, lng: 100.60373525365584, available: 0, total: 10 },
  {
    keywords: ["interzone", "อินเตอร์โซน", "tops", "ทิวสน"],
    name: "Interzone / Tops / ทิวสน",
    lat: 14.076015771509779, lng: 100.59795880142016, available: 0, total: 10,
    lat2: 14.07682278342416, lng2: 100.59639938431137, available2: 0, total2: 10
  },
  { keywords: ["sc", "โรงอาหาร sc"], name: "SC Canteen", lat: 14.069925020628173, lng: 100.60475923799383, available: 0, total: 10 },
  { keywords: ["uvillage", "u village", "ยูวิลเลจ"], name: "U Village", lat: 14.06608047410596, lng: 100.60964327537296, available: 0, total: 10 },
  { keywords: ["mingle", "มิงเกิล"], name: "Mingle Café", lat: 14.06643051762887, lng: 100.61064864591621, available: 0, total: 10 },
  { keywords: ["siit bkd", "siit บกด", "บกด"], name: "SIIT BKD", lat: 13.980709012610262, lng: 100.55455850149666, available: 0, total: 5 },

  // เพิ่มคำค้นสำหรับ SIIT Parking A1 และ A2
  { keywords: ["siit", "สิรินธร", "สถาบันเทคโนโลยีนานาชาติสิรินธร"], name: "SIIT Parking A1", lat: 14.068225363631793, lng: 100.60776673076252, available: 0, total: 10 },
  { keywords: ["siit", "สิรินธร", "สถาบันเทคโนโลยีนานาชาติสิรินธร"], name: "SIIT Parking A2", lat: 14.068881627251303, lng: 100.60813318970119, available: 0, total: 12 },
];

// ===== Fetch Realtime Parking Data from AWS =====
async function fetchParkingData() {
  try {
    const response = await fetch("https://0jcihmcez1.execute-api.ap-southeast-1.amazonaws.com/dev/getParking");
    const json = await response.json();
    const data = json.data; // ✅ แก้ตรงนี้

    console.log("📡 Data from AWS:", data);

    // อัปเดต customLocations ให้ตรงกับข้อมูลจริง
    data.forEach((slot) => {
      const found = customLocations.find(loc =>
        loc.name.toLowerCase().includes(slot.slot_id.toLowerCase())
      );

      if (found) {
        found.available = slot.status === "free" ? 1 : 0;
      }
    });

    updateMarkersWithRealtime();
  } catch (error) {
    console.error("Error fetching parking data:", error);
  }
}

// ===== Update Markers with Realtime Status =====
function updateMarkersWithRealtime() {
  allMarkers.forEach((m) => map.removeLayer(m));
  allMarkers = [];

  customLocations.forEach((loc) => {
    const iconUrl = loc.available > 0
      ? "https://cdn-icons-png.flaticon.com/512/190/190411.png" // ✅ สีเขียว ว่าง
      : "https://cdn-icons-png.flaticon.com/512/463/463612.png"; // ❌ สีแดง เต็ม

    const marker = L.marker([loc.lat, loc.lng], {
      icon: L.icon({
        iconUrl: iconUrl,
        iconSize: [32, 32],
      }),
    })
      .addTo(map)
      .bindPopup(
        `<b>${loc.name}</b><br>
         สถานะ: ${loc.available > 0 ? "🟢 ว่าง" : "🔴 ไม่ว่าง"}<br>
         <button onclick="goToBooking('${encodeURIComponent(loc.name)}')"
           style="background:#007bff;color:white;border:none;padding:6px 10px;border-radius:8px;margin-top:6px;cursor:pointer;">
           จองเลย 🚗
         </button>`
      );
    allMarkers.push(marker);
  });
}

// ===== เรียก API ทุก ๆ 10 วินาที =====
fetchParkingData();
setInterval(fetchParkingData, 10000);


// ===== Handle Search Input =====
const searchInput = document.querySelector(".search-bar input");
searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const query = searchInput.value.trim();
    if (query) handleSearch(query);
  }
});


// ===== Handle Search Logic =====
async function handleSearch(query) {
  const cleanQuery = query.trim().toLowerCase();
  allMarkers.forEach((m) => map.removeLayer(m));  // ลบ markers เก่าทุกตัว
  allMarkers = [];

  // ค้นหาทุกตำแหน่งใน customLocations ที่ตรงกับคำค้น
  const foundLocations = customLocations.filter((loc) =>
    loc.keywords.some((keyword) => cleanQuery.includes(keyword.toLowerCase()))
  );

  if (foundLocations.length > 0) {
    // แสดงทุกตำแหน่งที่ค้นหาพบ
    foundLocations.forEach((location) => {
      createBookingMarker(location.lat, location.lng, location.name, location.available, location.total);
      map.flyTo([location.lat, location.lng], 18);
    });
  } else {
    // ถ้าค้นหาไม่พบใน customLocations ให้ใช้ OpenStreetMap API
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}`,
        { headers: { "User-Agent": "SmartParkingApp/1.0" } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        createBookingMarker(lat, lon, query);
        map.flyTo([lat, lon], 18);
      } else {
        alert("ไม่พบสถานที่ที่คุณค้นหา");
      }
    } catch (err) {
      console.error("Search error:", err);
      alert("เกิดข้อผิดพลาดในการค้นหาตำแหน่ง");
    }
  }
}

// ===== Create Booking Marker (เพิ่มการแสดงจำนวนที่ว่าง) =====
function createBookingMarker(lat, lng, name, available, total) {
  const marker = L.marker([lat, lng]).addTo(map).bindPopup(
    `<b>${name}</b><br><span>${available} ช่องว่าง จาก ${total} ช่อง</span><br><button onclick="goToBooking('${encodeURIComponent(name)}')" style="background:#007bff;color:white;border:none;padding:6px 10px;border-radius:8px;margin-top:6px;cursor:pointer;">จองเลย 🚗</button>`
  );
  allMarkers.push(marker);
}

// ===== Go to Booking (เชื่อม AWS API) =====
function goToBooking(place) {
  // เปิดหน้า booking.html พร้อมชื่อสถานที่
  window.location.href = `booking.html?place=${encodeURIComponent(place)}`;
}


// ===== Show SIIT Parking Spots =====
function showSIITParking() {
  allMarkers.forEach((m) => map.removeLayer(m));  // ลบ markers เก่า
  allMarkers = [];

  parkingSpots.forEach((p) => {
    const marker = L.marker([p.lat, p.lng], {
      icon: L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/854/854878.png",
        iconSize: [30, 30],
      }),
    })
      .addTo(map)
      .bindPopup(
        `<b>${p.name}</b><br><span id="spot-${p.name.replace(/\s+/g, "-")}">${p.available} spots available</span><br>
        <button onclick="goToBooking('${encodeURIComponent(p.name)}')" style="background:#007bff;color:white;border:none;padding:6px 10px;border-radius:8px;margin-top:6px;cursor:pointer;">จองเลย 🚗</button>`
      )
      .openPopup();

    allMarkers.push(marker);
  });

  const avgLat = parkingSpots.reduce((sum, p) => sum + p.lat, 0) / parkingSpots.length;
  const avgLng = parkingSpots.reduce((sum, p) => sum + p.lng, 0) / parkingSpots.length;
  map.setView([avgLat, avgLng], 18.5);
}

