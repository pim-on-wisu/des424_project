// ===== Initialize Map =====
const map = L.map("map").setView([14.0745, 100.6065], 15);

// Tile Layer
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
  maxZoom: 19,
}).addTo(map);

// ===== Parking Data (มีจำนวนช่องจอดและช่องว่างที่เปลี่ยนได้) =====
let parkingSpots = [
  { name: "SIIT Parking A1", lat: 14.068225363631793, lng: 100.60776673076252, total: 10, available: 6 },
  { name: "SIIT Parking A2", lat: 14.068881627251303, lng: 100.60813318970119, total: 12, available: 9 },
];

let allMarkers = [];
let userMarker = null;

// ===== Custom search locations (7 สถานที่) =====
const customLocations = [
  { keywords: ["ยิม 7", "gym 7"], name: "ยิม 7", lat: 14.06991063395858, lng: 100.60127691199303 },
  { keywords: ["สกร", "sgr"], name: "สกร (SGR Building)", lat: 14.071526194306847, lng: 100.60373525365584 },
  {
    keywords: ["interzone", "อินเตอร์โซน", "tops", "ทิวสน"],
    name: "Interzone / Tops / ทิวสน",
    lat: 14.076015771509779, lng: 100.59795880142016,
    lat2: 14.07682278342416, lng2: 100.59639938431137,
  },
  { keywords: ["sc", "โรงอาหาร sc"], name: "SC Canteen", lat: 14.069925020628173, lng: 100.60475923799383 },
  { keywords: ["uvillage", "u village", "ยูวิลเลจ"], name: "U Village", lat: 14.06608047410596, lng: 100.60964327537296 },
  { keywords: ["mingle", "มิงเกิล"], name: "Mingle Café", lat: 14.06643051762887, lng: 100.61064864591621 },
  { keywords: ["siit bkd", "siit บกด", "บกด"], name: "SIIT BKD", lat: 13.980709012610262, lng: 100.55455850149666 },
];

// ===== Show User Location =====
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      userMarker = L.marker([latitude, longitude], {
        icon: L.icon({
          iconUrl: "https://cdn-icons-png.flaticon.com/512/447/447031.png",
          iconSize: [32, 32],
        }),
      })
        .addTo(map)
        .bindPopup("<b>You are here</b>")
        .openPopup();

      map.setView([latitude, longitude], 16);
    },
    (err) => {
      console.warn("Location access denied:", err.message);
    }
  );
} else {
  alert("Your browser does not support geolocation.");
}

// ===== Search Input =====
const searchInput = document.querySelector(".search-bar input");
searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const query = searchInput.value.trim();
    if (query) handleSearch(query);
  }
});

// ===== Handle Search =====
async function handleSearch(query) {
  const cleanQuery = query.trim().toLowerCase();

  allMarkers.forEach((m) => map.removeLayer(m));
  allMarkers = [];

  const found = customLocations.find((loc) =>
    loc.keywords.some((k) => cleanQuery.includes(k))
  );

  if (found) {
    createBookingMarker(found.lat, found.lng, found.name);
    if (found.lat2 && found.lng2) {
      createBookingMarker(found.lat2, found.lng2, found.name + " (2)");
      const midLat = (found.lat + found.lat2) / 2;
      const midLng = (found.lng + found.lng2) / 2;
      map.flyTo([midLat, midLng], 17, { animate: true, duration: 1.2 });
    } else {
      map.flyTo([found.lat, found.lng], 18, { animate: true, duration: 1.2 });
    }
    return;
  }

  if (
    cleanQuery.includes("สิรินธร") ||
    cleanQuery.includes("siit") ||
    cleanQuery.includes("สถาบันเทคโนโลยีนานาชาติสิรินธร")
  ) {
    showSIITParking();
    return;
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}`,
      { headers: { "User-Agent": "SmartParkingApp/1.0" } }
    );
    const data = await res.json();
    if (!data || data.length === 0) {
      alert("No results found.");
      return;
    }

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    createBookingMarker(lat, lon, query);
    map.flyTo([lat, lon], 18, { animate: true, duration: 1.2 });
  } catch (err) {
    console.error("Search error:", err);
    alert("Error while searching location.");
  }
}

// ===== Create Booking Marker =====
function createBookingMarker(lat, lng, name) {
  const marker = L.marker([lat, lng], {
    icon: L.icon({
      iconUrl: "https://cdn-icons-png.flaticon.com/512/854/854878.png",
      iconSize: [32, 32],
    }),
  })
    .addTo(map)
    .bindPopup(
      `<b>${name}</b><br><button onclick="goToBooking('${encodeURIComponent(
        name
      )}')" style="background:#007bff;color:white;border:none;padding:6px 10px;border-radius:8px;margin-top:6px;cursor:pointer;">Book Now 🚗</button>`
    )
    .openPopup();

  allMarkers.push(marker);
}

// ===== Go to Booking Page =====
function goToBooking(place) {
  window.location.href = `booking.html?place=${place}`;
}

// ===== Show SIIT Parking Spots =====
function showSIITParking() {
  allMarkers.forEach((m) => map.removeLayer(m));
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
        <button onclick="goToBooking('${encodeURIComponent(
          p.name
        )}')" style="background:#007bff;color:white;border:none;padding:6px 10px;border-radius:8px;margin-top:6px;cursor:pointer;">Book Now 🚗</button>`
      )
      .openPopup();

    allMarkers.push(marker);
  });

  const avgLat = parkingSpots.reduce((sum, p) => sum + p.lat, 0) / parkingSpots.length;
  const avgLng = parkingSpots.reduce((sum, p) => sum + p.lng, 0) / parkingSpots.length;
  map.setView([avgLat, avgLng], 18.5);
}

// ===== Realtime update mock =====
// จำลองอัปเดตจำนวนว่างแบบเรียลไทม์ทุก 5 วินาที
setInterval(() => {
  parkingSpots.forEach((p) => {
    // สุ่มเพิ่ม/ลดที่ว่างแบบสมเหตุสมผล
    let change = Math.random() < 0.5 ? -1 : 1;
    p.available = Math.max(0, Math.min(p.total, p.available + change));

    const label = document.getElementById(`spot-${p.name.replace(/\s+/g, "-")}`);
    if (label) label.textContent = `${p.available} spots available`;
  });
}, 5000);
