let map = null;
let allMarkers = [];
const mapContainer = document.getElementById("map");

if (typeof L !== "undefined" && mapContainer) {
  // ===== Initialize Leaflet Map =====
  map = L.map("map").setView([14.0745, 100.6065], 15);

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
  } else {
    alert("Your browser does not support geolocation.");
  }
}

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
if (searchInput && map) {
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const query = searchInput.value.trim();
      if (query) handleSearch(query);
    }
  });
}


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
        alert("The location you are looking for was not found.");
      }
    } catch (err) {
      console.error("Search error:", err);
      alert("An error occurred while searching for the location.");
    }
  }
}


// ===== Create Booking Marker (เพิ่มการแสดงจำนวนที่ว่าง) =====
function createBookingMarker(lat, lng, name, available, total) {
  if (!map) return;
  const marker = L.marker([lat, lng]).addTo(map).bindPopup(
    `<b>${name}</b><br><span>${available} Avaliable spots from ${total} parking spots</span><br><button onclick="goToBooking('${encodeURIComponent(name)}')" style="background:#007bff;color:white;border:none;padding:6px 10px;border-radius:8px;margin-top:6px;cursor:pointer;">booking now 🚗</button>`
  );
  allMarkers.push(marker);
}

// ===== Go to Booking Page =====
function goToBooking(place) {
  window.location.href = `booking.html?place=${encodeURIComponent(place)}`;
}

// ===== Show SIIT Parking Spots =====
function showSIITParking() {
  if (!map || !Array.isArray(window.parkingSpots)) {
    return;
  }
  allMarkers.forEach((m) => map.removeLayer(m));  // ลบ markers เก่า
  allMarkers = [];

  window.parkingSpots.forEach((p) => {
    const marker = L.marker([p.lat, p.lng], {
      icon: L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/854/854878.png",
        iconSize: [30, 30],
      }),
    })
      .addTo(map)
      .bindPopup(
        `<b>${p.name}</b><br><span id="spot-${p.name.replace(/\s+/g, "-")}">${p.available} spots available</span><br>
        <button onclick="goToBooking('${encodeURIComponent(p.name)}')" style="background:#007bff;color:white;border:none;padding:6px 10px;border-radius:8px;margin-top:6px;cursor:pointer;">booking now 🚗</button>`
      )
      .openPopup();

    allMarkers.push(marker);
  });

  const avgLat = window.parkingSpots.reduce((sum, p) => sum + p.lat, 0) / window.parkingSpots.length;
  const avgLng = window.parkingSpots.reduce((sum, p) => sum + p.lng, 0) / window.parkingSpots.length;
  map.setView([avgLat, avgLng], 18.5);
}

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
  const isLoggedIn = localStorage.getItem("loggedIn") === "true";
  const userEmail = localStorage.getItem("userEmail");
  const userDataRaw = localStorage.getItem("userData");

  let displayName = "";
  let derivedEmail = userEmail || "";
  if (userDataRaw) {
    try {
      const userData = JSON.parse(userDataRaw);
      const firstName = userData.firstName || userData.firstname || "";
      const lastName = userData.lastName || userData.lastname || "";
      displayName = `${firstName} ${lastName}`.trim();
      if (!displayName && userData.fullName) {
        displayName = userData.fullName;
      }
      if (!displayName && userData.username) {
        displayName = userData.username;
      }
      if (!derivedEmail && userData.email) {
        derivedEmail = userData.email;
      }
    } catch (error) {
      console.warn("Unable to parse stored user data:", error);
    }
  }

  if (!displayName && userEmail) {
    displayName = userEmail.split("@")[0];
  }

  if (!displayName) {
    displayName = "Park with Me User";
  }

  if (!derivedEmail) {
    derivedEmail = "guest@example.com";
  }

  const displayEmail = derivedEmail;
  const initials = buildInitials(displayName, displayEmail);

  if (isLoggedIn) {
    authButtons?.classList.add("hidden");
    profileMenu?.classList.remove("hidden");

    if (profileName) profileName.textContent = displayName;
    if (profileEmail) profileEmail.textContent = displayEmail;
    if (profileInitials) profileInitials.textContent = initials;
  } else {
    authButtons?.classList.remove("hidden");
    profileMenu?.classList.add("hidden");
    closeProfileDropdown();
  }
}

function buildInitials(displayName, userEmail) {
  if (displayName) {
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

  if (userEmail) {
    return userEmail[0].toUpperCase();
  }

  return "PW";
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

loginButton?.addEventListener("click", () => {
  goToLogin();
});

signupButton?.addEventListener("click", () => {
  goToSignup();
});

profileButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleProfileDropdown();
});

profileDropdown?.addEventListener("click", (event) => {
  event.stopPropagation();
});

bookingPageButton?.addEventListener("click", () => {
  window.location.href = "index.html";
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

initializeAuthUI();

// Navigation functions
function goToLogin() {
  localStorage.setItem("previousPage", window.location.href);
  window.location.href = "login.html";
}

function goToSignup() {
  localStorage.setItem("previousPage", window.location.href);
  window.location.href = "signup.html";
}

function goToMybooking() {
  window.location.href = "my_booking.html";
}

function goToProfile() {
  window.location.href = "personal_info.html";
}

function goToSettings() {
  window.location.href = "settings.html";
}

function goToHelp() {
  window.location.href = "help.html";
}

function goToAbout() {
  window.location.href = "about.html";
}

function logout() {
  if (confirm("Are you sure you want to sign out?")) {
    localStorage.removeItem("loggedIn");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userData");
    closeProfileDropdown();
    initializeAuthUI();
    alert("You have been signed out successfully!");
  }
}

// ===== Realtime Update Mock (Update Available Spots) =====
if (map) {
  setInterval(() => {
    customLocations.forEach((loc) => {
      let change = Math.random() < 0.5 ? -1 : 1;
      loc.available = Math.max(0, Math.min(loc.total, loc.available + change));
      const label = document.querySelector(`#spot-${loc.name.replace(/\s+/g, "-")}`);
      if (label) label.textContent = `${loc.available} Avaliable Spots`;
    });
  }, 5000);
}