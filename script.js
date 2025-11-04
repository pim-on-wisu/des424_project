const apiUrl = "https://xxxxx.execute-api.us-east-1.amazonaws.com/prod/slots"; // 🔹 เปลี่ยนเป็น API ของคุณเอง

async function loadData() {
  try {
    const res = await fetch(apiUrl);
    const data = await res.json();

    // แสดงจำนวนช่องจอด
    const freeCount = data.filter(x => x.status === "free").length;
    const occCount = data.filter(x => x.status === "occupied").length;
    document.getElementById("summary").innerText = 
      `ที่ว่าง: ${freeCount} | ไม่ว่าง: ${occCount}`;

    // แสดงช่องจอดทั้งหมด
    const grid = document.getElementById("grid");
    grid.innerHTML = "";
    data.forEach(slot => {
      const div = document.createElement("div");
      div.className = `slot ${slot.status}`;
      div.textContent = slot.slot_id;
      grid.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    document.getElementById("summary").innerText = "⚠️ โหลดข้อมูลไม่สำเร็จ";
  }
}

loadData();
setInterval(loadData, 5000); // รีเฟรชทุก 5 วิ
