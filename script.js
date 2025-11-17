if (document.getElementById("map")) {
  // ===== Initialize Leaflet Map =====
const map = L.map("map").setView([14.0745, 100.6065], 15);

// ===== Tile Layer =====
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
  maxZoom: 19,
}).addTo(map);

// ===== Show User Location =====
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
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
    () => alert("ไม่สามารถเข้าถึงตำแหน่งของคุณได้")
  );
}

let allMarkers = [];

// ===== Static Locations (lat/lng + lot_id only) =====
const customLocations = [
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
    
    // ⭐ FIX: Extract 'data' array from the parsed body
    //const lots = JSON.parse(json.body).data; 
    const lots = json.data;

    // 🧠 FIX: Data is Normal JSON (from DocumentClient), no .S or .N needed
    lots.forEach(item => {
      const lotId = item.lot_id;
      const total = Number(item.total_slots);
      const available = Number(item.available_slots);

      const loc = customLocations.find(loc => loc.lot_id === lotId);
      if (loc) {
        loc.total = total;
        loc.available = available; // Start with the summary value
      }
    });

    console.log("🔥 Updated Locations (Summary):", customLocations);
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
    
    // ⭐⭐ FIX: Extract 'data' array from the parsed body
    //const slots = JSON.parse(json.body).data; 
    const slots = json.data;

    // reset available
    customLocations.forEach(loc => loc.available = 0);

    // Recalculate 'available' based on real-time slot status
    slots.forEach(item => {
      // This API returns Normal JSON (no .S or .N)
      const lotId = item.lot_id;
      const status = item.status;

      const found = customLocations.find(loc => loc.lot_id === lotId);

      if (found && status === "free") {
        found.available++;
      }
    });

    updateMarkersWithRealtime();
    
  } catch (err) {
    console.error("Error fetching parking data:", err);
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
      createBookingMarker(loc.lat, loc.lng, loc.name, loc.available, loc.total, loc.lot_id); // ⭐ FIX: Pass lot_id
    });
  } else {
    alert("ไม่พบสถานที่");
  }
}
// ===== Create Marker for Search Result =====
function createBookingMarker(lat, lng, name, available, total, lot_id) { // ⭐ FIX: Receive lot_id
  const marker = L.marker([lat, lng]).addTo(map).bindPopup(
    `<b>${name}</b><br>${available} ช่องว่าง จาก ${total} ช่อง<br>
     <button onclick="goToBooking('${name}', '${lot_id}')" // ⭐ FIX: Pass lot_id
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
  await fetchParkingLotsInfo();   // 1. โหลด total + available (Stale)
  await fetchParkingData();       // 2. โหลด real-time free slots (Recalculate)
  setInterval(fetchParkingData, 10000); // 3. โหลดซ้ำทุก 10 วิ
})();
}

// --- Auth UI Logic ---
const authButtons = document.getElementById("authButtons");
const loginButton = document.getElementById("loginButton");
const signupButton = document.getElementById("signupButton");
const profileMenu = document.getElementById("profileMenu");
const profileButton = document.getElementById("profileButton");
const profileDropdown = document.getElementById("profileDropdown");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profileInitials = document.getElementById("profileInitials");
const bookingPageButton = document.getElementById("bookingPageButton");

function initializeAuthUI() {
  // ⭐ FIX: ใช้ "loggedIn" (L ตัวเล็ก) ให้ตรงกับที่ login.html/signup.html บันทึกไว้
  const isLoggedIn = sessionStorage.getItem("loggedIn") === "true";
  const userDataRaw = sessionStorage.getItem("userData");

  let displayName = "Guest";
  let derivedEmail = "guest@example.com";
  
  if (isLoggedIn && userDataRaw) {
    try {
      const userData = JSON.parse(userDataRaw);
      
      // ⭐ FIX: ดึง "username" และ "email" โดยตรงจาก object
      displayName = userData.username || "Park with Me User";
      derivedEmail = userData.email || `${displayName}@example.com`;
      
    } catch (error) {
      console.warn("Unable to parse stored user data:", error);
      // ถ้าข้อมูลพัง ให้ใช้ Guest ไปก่อน
      displayName = "Park with Me User";
      derivedEmail = "guest@example.com";
    }
  }

  const initials = buildInitials(displayName, derivedEmail);

  if (isLoggedIn) {
    // ⭐ ถ้าล็อกอินแล้ว: ซ่อนปุ่ม Auth, แสดงเมนู Profile
    authButtons?.classList.add("hidden");
    profileMenu?.classList.remove("hidden");

    if (profileName) profileName.textContent = displayName;
    if (profileEmail) profileEmail.textContent = derivedEmail;
    if (profileInitials) profileInitials.textContent = initials;
  } else {
    // ⭐ ถ้ายังไม่ล็อกอิน: แสดงปุ่ม Auth, ซ่อนเมนู Profile
    authButtons?.classList.remove("hidden");
    profileMenu?.classList.add("hidden");
    closeProfileDropdown();
  }
}

function buildInitials(displayName, userEmail) {
  if (displayName && displayName !== "Guest" && displayName !== "Park with Me User") {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
    }
    if (parts[0]?.length >= 2) {
      return `${parts[0][0]}${parts[0][1]}`.toUpperCase();
    }
    if (parts[0]) {
      return parts[0][0].toUpperCase();
    }
  }
  return "PW"; // Default
}

function toggleProfileDropdown() {
  if (isProfileDropdownOpen()) {
    closeProfileDropdown();
  } else {
    openProfileDropdown();
  }
}

function openProfileDropdown() {
  profileDropdown?.classList.add("open");
  profileButton?.classList.add("open");
  profileButton?.setAttribute("aria-expanded", "true");
}

function closeProfileDropdown() {
  profileDropdown?.classList.remove("open");
  profileButton?.classList.remove("open");
  profileButton?.setAttribute("aria-expanded", "false");
}

function isProfileDropdownOpen() {
  return profileDropdown?.classList.contains("open");
}

profileButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleProfileDropdown();
});

profileDropdown?.addEventListener("click", (event) => {
  event.stopPropagation();
});

bookingPageButton?.addEventListener("click", () => {
  window.location.href = "/index.html"; // ⭐ FIX: Added root '/'
});

document.addEventListener("click", () => {
  if (isProfileDropdownOpen()) {
    closeProfileDropdown();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isProfileDropdownOpen()) {
    closeProfileDropdown();
  }
});

// Navigation functions
function goToProfile() { window.location.href = '/personal_info.html'; } // ⭐ FIX: Added root '/'
function goToMybooking() { window.location.href = '/my_booking.html'; } // ⭐ FIX: Added root '/'

function logout() {
  // ⭐ FIX: ใช้ 'loggedIn' (L ตัวเล็ก)
  sessionStorage.removeItem("loggedIn");
  sessionStorage.removeItem("username");
  sessionStorage.removeItem("userData");
  sessionStorage.removeItem("previousPage");
  closeProfileDropdown();
  initializeAuthUI(); // อัปเดต UI ทันที
  alert("You have been signed out successfully!");
  window.location.reload(); 
}