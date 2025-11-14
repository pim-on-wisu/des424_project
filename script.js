

// ===== Initialize Leaflet Map =====
const map = L.map("map").setView([14.0745, 100.6065], 15);

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
      L.marker([latitude, longitude], {
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
        alert("ไม่สามารถเข้าถึงตำแหน่งของคุณได้");
      }
  );
}

let allMarkers = [];

// ===== Static Locations (lat/lng + lot_id only) =====
const customLocations = [
  { keywords: ["ยิม 7", "gym"], name: "ยิม 7", lot_id: "gym7", lat: 14.06991063395858, lng: 100.60127691199303, available: 0, total: 0 },
  { keywords: ["สกร", "sgr"], name: "สกร (SGR Building)", lot_id: "sgr", lat: 14.071526194306847, lng: 100.60373525365584, available: 0, total: 0 },

  { keywords: ["uvillage"], name: "U Village", lot_id: "uvillage", lat: 14.06608047410596, lng: 100.60964327537296, available: 0, total: 0 },
  { keywords: ["mingle"], name: "Mingle Café", lot_id: "mingle", lat: 14.06643051762887, lng: 100.61064864591621, available: 0, total: 0 },

  { keywords: ["siit", "a1"], name: "SIIT Parking A1", lot_id: "siit_a1", lat: 14.068225363631793, lng: 100.60776673076252, available: 0, total: 0 },
  { keywords: ["siit", "a2"], name: "SIIT Parking A2", lot_id: "siit_a2", lat: 14.068881627251303, lng: 100.60813318970119, available: 0, total: 0 },
  { keywords: ["bkd"], name: "SIIT BKD", lot_id: "siit_bkd", lat: 13.980709012610262, lng: 100.55455850149666, available: 0, total: 0 },
];

// ===== Load Parking Lot Info (total + available from DynamoDB) =====
async function fetchParkingLotsInfo() {
  try {
    const response = await fetch(
      "https://0jcihmcez1.execute-api.ap-southeast-1.amazonaws.com/dev/getParkingLots"
    );
    const json = await response.json();
    const lots = json.data;

    // 🧠 แปลง DynamoDB JSON → normal JSON
    lots.forEach(item => {
      const lotId = item.lot_id.S;
      const total = Number(item.total_slots.N);
      const available = Number(item.available_slots.N);

      const loc = customLocations.find(loc => loc.lot_id === lotId);

      if (loc) {
        loc.total = total;
        loc.available = available;
      }
    });

    console.log("🔥 Updated Locations:", customLocations);

  } catch (error) {
    console.error("Error loading parking lot metadata:", error);
  }
}


// ===== Fetch Real-Time Slot Data (siit_a1_01, siit_a2_05, …) =====
async function fetchParkingData() {
  try {
    const response = await fetch(
      "https://0jcihmcez1.execute-api.ap-southeast-1.amazonaws.com/dev/getParking"
    );
    const json = await response.json();
    const slots = JSON.parse(json.body);   // ⭐⭐ สำคัญ!


    // reset available
    customLocations.forEach(loc => loc.available = 0);

    slots.forEach(item => {

      // รองรับทั้ง DynamoDB JSON และ Normal JSON
      const lotId =
        item.lot_id?.S !== undefined ? item.lot_id.S : item.lot_id;

      const status =
        item.status?.S !== undefined ? item.status.S : item.status;

      const found = customLocations.find(loc => loc.lot_id === lotId);

      if (found && status === "free") {
        found.available++;
      }
    });

    updateMarkersWithRealtime();
  } catch (err) {
    console.error("FETCH ERROR:", err);
  }
}


// ===== Update Map Markers =====
function updateMarkersWithRealtime() {
  allMarkers.forEach((m) => map.removeLayer(m));
  allMarkers = [];

  customLocations.forEach((loc) => {
    const iconUrl =
      loc.available > 0
        ? "https://cdn-icons-png.flaticon.com/512/190/190411.png"
        : "https://cdn-icons-png.flaticon.com/512/463/463612.png";

    const marker = L.marker([loc.lat, loc.lng], {
      icon: L.icon({ iconUrl, iconSize: [32, 32] }),
    })
      .addTo(map)
      .bindPopup(
        `<b>${loc.name}</b><br>
        ${loc.available} ช่องว่าง จาก ${loc.total} ช่อง<br>
        <button onclick="goToBooking('${loc.name}', '${loc.lot_id}')" 
        style="background:#007bff;color:white;padding:6px 10px;border-radius:8px;border:none;margin-top:6px;">จองเลย 🚗</button>`
      );

    allMarkers.push(marker);
  });
}

// ===== Search =====
const searchInput = document.querySelector(".search-bar input");
searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleSearch(searchInput.value.trim());
});

async function handleSearch(query) {
  const clean = query.toLowerCase();

  allMarkers.forEach((m) => map.removeLayer(m));
  allMarkers = [];

  const found = customLocations.filter(loc =>
    loc.keywords.some(key => clean.includes(key.toLowerCase()))
  );

  if (found.length > 0) {
    found.forEach(loc => {
      createBookingMarker(loc.lat, loc.lng, loc.name, loc.available, loc.total);
      map.flyTo([loc.lat, loc.lng], 18);
    });
  } else {
    alert("ไม่พบสถานที่");
  }
}

// ===== Create Marker for Search Result =====
function createBookingMarker(lat, lng, name, available, total) {
  const marker = L.marker([lat, lng]).addTo(map).bindPopup(
    `<b>${name}</b><br>${available} ช่องว่าง จาก ${total} ช่อง<br>
     <button onclick="goToBooking('${name}')"
     style="background:#007bff;color:white;padding:6px 10px;border-radius:8px;border:none;margin-top:6px;">จองเลย 🚗</button>`
  );
  allMarkers.push(marker);
}

// ===== Go to Booking Page =====
function goToBooking(place, lot_id) {
  window.location.href = `booking.html?place=${encodeURIComponent(place)}&lot_id=${lot_id}`;
}

// ===== INITIAL LOAD =====
(async () => {
  //await fetchParkingData();
  await fetchParkingLotsInfo();   // โหลด total + available จาก DynamoDB
  await fetchParkingData(); // โหลด real-time free slots
  setInterval(fetchParkingData, 10000);
})();