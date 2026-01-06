import { useState } from "react";

function App() {
  const [idea, setIdea] = useState("");
  const [email, setEmail] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [blueprint, setBlueprint] = useState("");
  const [instruction, setInstruction] = useState("");
  const [message, setMessage] = useState("");
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [loadingImprove, setLoadingImprove] = useState(false);
  const [loadingFinalize, setLoadingFinalize] = useState(false);

  // ✅ Use production API base or fallback to localhost
  const API_BASE =
    import.meta.env.VITE_API_BASE ||
    (window.location.hostname === "localhost"
      ? "http://localhost:5000"
      : window.location.origin);

  // ✅ Helper to safely fetch JSON and detect backend HTML errors
  const safeFetchJson = async (url, options) => {
    try {
      const res = await fetch(url, options);
      const text = await res.text();

      // Detect HTML errors (e.g. Render 404/502 pages)
      if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
        console.error("⚠️ Backend returned HTML instead of JSON:", text.slice(0, 120));
        return { ok: false, data: { error: "Server returned HTML — likely wrong endpoint or CORS issue." } };
      }

      try {
        return { ok: res.ok, data: JSON.parse(text) };
      } catch {
        console.error("Invalid JSON from backend:", text);
        return { ok: false, data: { error: "Invalid backend JSON response" } };
      }
    } catch (err) {
      console.error("Fetch failed:", err);
      return { ok: false, data: { error: "Network error. Check API_BASE URL." } };
    }
  };

  // 🧠 1️⃣ Generate initial blueprint
  const handleGenerate = async (e) => {
    e.preventDefault();
    setMessage("");
    setBlueprint("");
    setLoadingGenerate(true);

    const { ok, data } = await safeFetchJson(`${API_BASE}/agent/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea, email }),
    });

    if (ok) {
      setSessionId(data.sessionId);
      setBlueprint(data.blueprint);
      setMessage("✅ Blueprint generated! You can suggest improvements below.");
    } else {
      setMessage(`❌ ${data.error || "Could not generate blueprint."}`);
    }
    setLoadingGenerate(false);
  };

  // ✍️ 2️⃣ Improve blueprint
  const handleImprove = async () => {
    if (!instruction || !sessionId) return;
    setMessage("");
    setLoadingImprove(true);

    const { ok, data } = await safeFetchJson(`${API_BASE}/agent/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message: instruction }),
    });

    if (ok) {
      setBlueprint(data.blueprint);
      setInstruction("");
      setMessage("✅ Blueprint updated!");
    } else {
      setMessage(`❌ ${data.error || "Could not update blueprint."}`);
    }
    setLoadingImprove(false);
  };

  // 📤 3️⃣ Finalize & send PDF
  const handleFinalize = async () => {
    if (!sessionId) return;
    setMessage("");
    setLoadingFinalize(true);

    const { ok, data } = await safeFetchJson(`${API_BASE}/agent/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });

    if (ok) {
      setMessage(data.message);
      setSessionId(null);
      setBlueprint("");
    } else {
      setMessage(`❌ ${data.error || "Could not finalize blueprint."}`);
    }
    setLoadingFinalize(false);
  };

  return (
    <div style={{ padding: "2rem", maxWidth: 800, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1 style={{ textAlign: "center", marginBottom: "1.5rem" }}>AI Website Blueprint Agent</h1>

      {!sessionId && (
        <form onSubmit={handleGenerate}>
          <label htmlFor="idea" style={{ display: "block", marginBottom: "0.5rem" }}>
            Describe your website idea
          </label>
          <textarea
            id="idea"
            rows="4"
            placeholder="Your website idea..."
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "0.8rem",
              marginBottom: "1rem",
              borderRadius: "8px",
              border: "1px solid #ccc",
              fontSize: "1rem",
            }}
          />

          <label htmlFor="email" style={{ display: "block", marginBottom: "0.5rem" }}>
            Your Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "0.8rem",
              marginBottom: "1.5rem",
              borderRadius: "8px",
              border: "1px solid #ccc",
              fontSize: "1rem",
            }}
          />

          <button
            type="submit"
            disabled={loadingGenerate}
            style={{
              background: "#1a1a1a",
              color: "white",
              border: "none",
              padding: "0.8rem 1.5rem",
              borderRadius: "8px",
              cursor: loadingGenerate ? "not-allowed" : "pointer",
              width: "100%",
              fontSize: "1rem",
              fontWeight: "bold",
            }}
          >
            {loadingGenerate ? "Generating..." : "Generate Blueprint"}
          </button>
        </form>
      )}

      {sessionId && (
        <>
          <div
            style={{
              marginTop: "2rem",
              whiteSpace: "pre-wrap",
              background: "#333",
              color: "#fff",
              padding: "1rem",
              borderRadius: "8px",
              minHeight: "200px",
            }}
          >
            {blueprint || "Loading blueprint..."}
          </div>

          <label htmlFor="instruction" style={{ display: "block", marginTop: "1rem", marginBottom: "0.5rem" }}>
            Suggest improvements (optional)
          </label>
          <textarea
            id="instruction"
            rows="2"
            placeholder="Enter your instruction..."
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            style={{
              width: "100%",
              padding: "0.8rem",
              borderRadius: "8px",
              border: "1px solid #ccc",
              fontSize: "1rem",
            }}
          />

          <button
            onClick={handleImprove}
            disabled={loadingImprove}
            style={{
              background: "#007bff",
              color: "white",
              border: "none",
              padding: "0.8rem 1.5rem",
              borderRadius: "8px",
              cursor: loadingImprove ? "not-allowed" : "pointer",
              width: "100%",
              fontSize: "1rem",
              fontWeight: "bold",
              marginTop: "0.5rem",
            }}
          >
            {loadingImprove ? "Updating..." : "Improve Blueprint"}
          </button>

          <button
            onClick={handleFinalize}
            disabled={loadingFinalize}
            style={{
              background: "#28a745",
              color: "white",
              border: "none",
              padding: "0.8rem 1.5rem",
              borderRadius: "8px",
              cursor: loadingFinalize ? "not-allowed" : "pointer",
              width: "100%",
              fontSize: "1rem",
              fontWeight: "bold",
              marginTop: "0.5rem",
            }}
          >
            {loadingFinalize ? "Finalizing..." : "Finalize & Send PDF"}
          </button>
        </>
      )}

      {message && (
        <p style={{ marginTop: "1.5rem", textAlign: "center", color: "#c5c5c5de", fontSize: "1rem" }}>
          {message}
        </p>
      )}
    </div>
  );
}

export default App;
