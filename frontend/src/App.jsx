import { useState } from "react";

function App() {
  const [idea, setIdea] = useState("");
  const [email, setEmail] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [blueprint, setBlueprint] = useState("");
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const API_BASE = "http://localhost:5000";

  // Step 1: Generate initial blueprint
  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setBlueprint("");

    try {
      const res = await fetch(`${API_BASE}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, email }),
      });
      const data = await res.json();
      setSessionId(data.sessionId);
      setBlueprint(data.blueprint);
      setMessage("Blueprint generated! You can suggest improvements below.");
    } catch (err) {
      console.error(err);
      setMessage("Error generating blueprint.");
    }
    setLoading(false);
  };

  // Step 2: Improve blueprint
  const handleImprove = async () => {
    if (!instruction) return;
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/improve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, instruction }),
      });
      const data = await res.json();
      setBlueprint(data.blueprint);
      setInstruction("");
      setMessage("Blueprint updated!");
    } catch (err) {
      console.error(err);
      setMessage("Error improving blueprint.");
    }
    setLoading(false);
  };

  // Step 3: Finalize & email PDF
  const handleFinalize = async () => {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      setMessage(data.message);
      setSessionId(null);
      setBlueprint("");
    } catch (err) {
      console.error(err);
      setMessage("Error finalizing blueprint.");
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: "2rem", maxWidth: 800, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1 style={{ textAlign: "center", marginBottom: "1.5rem" }}>AI Website Blueprint Generator</h1>

      {!sessionId && (
        <form onSubmit={handleGenerate}>
          <textarea
            rows="4"
            placeholder="Describe your website idea..."
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
          <input
            type="email"
            placeholder="Your email"
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
            disabled={loading}
            style={{
              background: "#1a1a1a",
              color: "white",
              border: "none",
              padding: "0.8rem 1.5rem",
              borderRadius: "8px",
              cursor: loading ? "not-allowed" : "pointer",
              width: "100%",
              fontSize: "1rem",
              fontWeight: "bold",
            }}
          >
            {loading ? "Generating..." : "Generate My Blueprint"}
          </button>
        </form>
      )}

      {sessionId && (
        <>
          <div style={{ marginTop: "2rem", whiteSpace: "pre-wrap", background: "#f5f5f5", padding: "1rem", borderRadius: "8px" }}>
            {blueprint}
          </div>

          <textarea
            rows="2"
            placeholder="Suggest improvements (optional)"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            style={{
              width: "100%",
              padding: "0.8rem",
              marginTop: "1rem",
              borderRadius: "8px",
              border: "1px solid #ccc",
              fontSize: "1rem",
            }}
          />

          <button
            onClick={handleImprove}
            disabled={loading}
            style={{
              background: "#007bff",
              color: "white",
              border: "none",
              padding: "0.8rem 1.5rem",
              borderRadius: "8px",
              cursor: loading ? "not-allowed" : "pointer",
              width: "100%",
              fontSize: "1rem",
              fontWeight: "bold",
              marginTop: "0.5rem",
            }}
          >
            {loading ? "Updating..." : "Improve Blueprint"}
          </button>

          <button
            onClick={handleFinalize}
            disabled={loading}
            style={{
              background: "#28a745",
              color: "white",
              border: "none",
              padding: "0.8rem 1.5rem",
              borderRadius: "8px",
              cursor: loading ? "not-allowed" : "pointer",
              width: "100%",
              fontSize: "1rem",
              fontWeight: "bold",
              marginTop: "0.5rem",
            }}
          >
            {loading ? "Finalizing..." : "Finalize & Send PDF"}
          </button>
        </>
      )}

      {message && (
        <p style={{ marginTop: "1.5rem", textAlign: "center", color: "#333", fontSize: "1rem" }}>
          {message}
        </p>
      )}
    </div>
  );
}

export default App;
