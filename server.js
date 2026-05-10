const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files (index.html dll)
app.use(express.static(path.join(__dirname, "public")));

// ===== PROXY ENDPOINT untuk Claude API =====
app.post("/api/search-doa", async (req, res) => {
  const { query } = req.body;

  if (!query || query.trim() === "") {
    return res.status(400).json({ error: "Query tidak boleh kosong." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key tidak ditemukan di server." });
  }

  const systemPrompt = `Kamu adalah ustadz digital yang ahli dalam Al-Qur'an dan Hadis.
Ketika user mencari doa, bacaan, atau shalawat, berikan jawaban LENGKAP dalam format JSON berikut (array, bisa 1-5 item):

[
  {
    "title": "Nama doa/bacaan",
    "arabic": "Teks Arab lengkap",
    "latin": "Transliterasi latin dengan tanda baca panjang pendek (ā, ī, ū, ḥ, dll)",
    "indonesia": "Terjemahan bahasa Indonesia yang fasih dan lengkap",
    "source": "Sumber lengkap (contoh: QS. Al-Baqarah: 255 atau HR. Bukhari no. 6312)",
    "type": "quran atau hadis",
    "keterangan": "Penjelasan singkat kapan dan bagaimana doa ini dibaca (1-2 kalimat)"
  }
]

Aturan penting:
- Kembalikan HANYA JSON valid, tidak ada teks lain di luar array JSON
- Teks Arab harus benar, lengkap, dan menggunakan harakat
- Latin menggunakan transliterasi akademik yang konsisten
- Terjemahan harus lengkap dan mudah dipahami
- Jika tidak ditemukan, kembalikan array kosong: []
- Maksimal 5 doa per pencarian
- Jangan tambahkan komentar atau markdown di luar JSON`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2500,
        system: systemPrompt,
        messages: [{ role: "user", content: query }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      return res.status(502).json({ error: "Gagal menghubungi AI. Coba lagi." });
    }

    const data = await response.json();
    const rawText = data.content?.map((c) => c.text || "").join("") || "";

    let result = [];
    try {
      const clean = rawText.replace(/```json|```/g, "").trim();
      result = JSON.parse(clean);
      if (!Array.isArray(result)) result = [];
    } catch {
      result = [];
    }

    return res.json({ results: result });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
});

// Fallback: semua route ke index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Server berjalan di port ${PORT}`);
});
