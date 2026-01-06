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

  const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

  // 1️⃣ Generate initial blueprint
  const handleGenerate = async (e) => {
    e.preventDefault();
    setMessage("");
    setBlueprint("");
    setLoadingGenerate(true);

    try {
      const res = await fetch(`${API_BASE}/agent/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, email }),
      });
      const data = await res.json();
      if (res.ok) {
        setSessionId(data.sessionId);
        setBlueprint(data.blueprint);
        setMessage("✅ Blueprint generated! You can suggest improvements above.");
      } else {
        setMessage(`❌ Error: ${data.error || "Could not generate blueprint."}`);
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Error generating blueprint.");
    } finally {
      setLoadingGenerate(false);
    }
  };

  // 2️⃣ Improve blueprint / send message to agent
  const handleImprove = async () => {
    if (!instruction || !sessionId) return;
    setMessage("");
    setLoadingImprove(true);

    try {
      const res = await fetch(`${API_BASE}/agent/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: instruction }),
      });
      const data = await res.json();
      if (res.ok) {
        setBlueprint(data.blueprint);
        setInstruction("");
        setMessage("✅ Blueprint updated!");
      } else {
        setMessage(`❌ Error: ${data.error || "Could not update blueprint."}`);
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Error improving blueprint.");
    } finally {
      setLoadingImprove(false);
    }
  };

  // 3️⃣ Finalize blueprint and send PDF
  const handleFinalize = async () => {
    if (!sessionId) return;
    setMessage("");
    setLoadingFinalize(true);

    try {
      const res = await fetch(`${API_BASE}/agent/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setSessionId(null);
        setBlueprint("");
      } else {
        setMessage(`❌ Error: ${data.error || "Could not finalize blueprint."}`);
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Error finalizing blueprint.");
    } finally {
      setLoadingFinalize(false);
    }
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
            aria-busy={loadingGenerate}
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
            aria-busy={loadingImprove}
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
            aria-busy={loadingFinalize}
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
