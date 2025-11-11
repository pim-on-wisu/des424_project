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
  { keywords: ["ยิม 7", "gym 7"], name: "ยิม 7", lat: 14.06991063395858, lng: 100.60127691199303, available: 5, total: 10 },
  { keywords: ["สกร", "sgr"], name: "สกร (SGR Building)", lat: 14.071526194306847, lng: 100.60373525365584, available: 3, total: 10 },
  {
    keywords: ["interzone", "อินเตอร์โซน", "tops", "ทิวสน"],
    name: "Interzone / Tops / ทิวสน",
    lat: 14.076015771509779, lng: 100.59795880142016, available: 8, total: 10,
    lat2: 14.07682278342416, lng2: 100.59639938431137, available2: 6, total2: 10
  },
  { keywords: ["sc", "โรงอาหาร sc"], name: "SC Canteen", lat: 14.069925020628173, lng: 100.60475923799383, available: 7, total: 10 },
  { keywords: ["uvillage", "u village", "ยูวิลเลจ"], name: "U Village", lat: 14.06608047410596, lng: 100.60964327537296, available: 4, total: 10 },
  { keywords: ["mingle", "มิงเกิล"], name: "Mingle Café", lat: 14.06643051762887, lng: 100.61064864591621, available: 2, total: 10 },
  { keywords: ["siit bkd", "siit บกด", "บกด"], name: "SIIT BKD", lat: 13.980709012610262, lng: 100.55455850149666, available: 3, total: 5 },

  // เพิ่มคำค้นสำหรับ SIIT Parking A1 และ A2
  { keywords: ["siit", "สิรินธร", "สถาบันเทคโนโลยีนานาชาติสิรินธร"], name: "SIIT Parking A1", lat: 14.068225363631793, lng: 100.60776673076252, available: 6, total: 10 },
  { keywords: ["siit", "สิรินธร", "สถาบันเทคโนโลยีนานาชาติสิรินธร"], name: "SIIT Parking A2", lat: 14.068881627251303, lng: 100.60813318970119, available: 9, total: 12 },
];

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

// ===== Go to Booking Page =====
function goToBooking(place) {
  window.location.href = `booking.html?place=${place}`;
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

// ===== Realtime Update Mock (Update Available Spots) =====
setInterval(() => {
  customLocations.forEach((loc) => {
    let change = Math.random() < 0.5 ? -1 : 1;
    loc.available = Math.max(0, Math.min(loc.total, loc.available + change));
    const label = document.querySelector(`#spot-${loc.name.replace(/\s+/g, "-")}`);
    if (label) label.textContent = `${loc.available} ช่องว่าง`;
  });
}, 5000);
