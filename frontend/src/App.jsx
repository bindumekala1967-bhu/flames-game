
import { useState } from "react";
import "./App.css";

const FLAMES_RESULTS = {
  F: {
    title: "Friends",
    emoji: "🤝",
    message: "A friendship full of fun and memories!",
  },
  L: {
    title: "Love",
    emoji: "❤️",
    message: "A playful result filled with love!",
  },
  A: {
    title: "Affection",
    emoji: "🥰",
    message: "A bond filled with care and affection!",
  },
  M: {
    title: "Marriage",
    emoji: "💍",
    message: "The game predicts a marriage connection!",
  },
  E: {
    title: "Enemies",
    emoji: "⚡",
    message: "A little rivalry makes this game interesting!",
  },
  S: {
    title: "Siblings",
    emoji: "👫",
    message: "A fun sibling-like connection!",
  },
};

function App() {
  const [firstName, setFirstName] = useState("");
  const [secondName, setSecondName] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [history, setHistory] = useState([]);

  // Send both names to the Python FastAPI backend.
  async function handleCalculate(event) {
    event.preventDefault();

    if (!firstName.trim() || !secondName.trim()) {
      setError("Please enter both names!");
      setResult(null);
      return;
    }

    if (
      !/[a-z]/i.test(firstName) ||
      !/[a-z]/i.test(secondName)
    ) {
      setError("Please enter names containing English letters.");
      setResult(null);
      return;
    }

    setError("");
    setResult(null);
    setIsCalculating(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/flames",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            your_name: firstName.trim(),
            their_name: secondName.trim(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      const answer = Object.values(FLAMES_RESULTS).find(
        (item) =>
          item.title.toLowerCase() ===
          String(data.result || "").toLowerCase()
      );

      if (!answer) {
        throw new Error("Unknown result returned by backend");
      }

      setResult(answer);

      // Add each successful calculation to the history.
      setHistory((previousHistory) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          firstName: firstName.trim(),
          secondName: secondName.trim(),
          title: answer.title,
          emoji: answer.emoji,
          time: new Date().toLocaleTimeString(),
        },
        ...previousHistory,
      ]);
    } catch (err) {
      console.error("FLAMES API error:", err);
      setError(
        "Could not connect to the backend. Check that your Python server is running."
      );
    } finally {
      setIsCalculating(false);
    }
  }

  // Share the current result or copy it to the clipboard.
  async function handleShare() {
    if (!result) return;

    const shareText =
      `My FLAMES result: ${firstName.trim()} + ` +
      `${secondName.trim()} = ${result.title} ${result.emoji}\n` +
      "Just for fun — not a real relationship prediction!";

    try {
      if (navigator.share) {
        await navigator.share({
          title: "My FLAMES Result",
          text: shareText,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert("Result copied! You can now share it.");
      }
    } catch (err) {
      if (err.name === "AbortError") return;

      try {
        await navigator.clipboard.writeText(shareText);
        alert("Result copied! You can now share it.");
      } catch {
        setError("Could not share or copy the result.");
      }
    }
  }

  // Share a previous result from the history list.
  async function handleShareHistory(item) {
    const shareText =
      `My FLAMES result: ${item.firstName} + ` +
      `${item.secondName} = ${item.title} ${item.emoji}\n` +
      "Just for fun — not a real relationship prediction!";

    try {
      if (navigator.share) {
        await navigator.share({
          title: "My FLAMES Result",
          text: shareText,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert("Result copied! You can now share it.");
      }
    } catch (err) {
      if (err.name === "AbortError") return;

      try {
        await navigator.clipboard.writeText(shareText);
        alert("Result copied! You can now share it.");
      } catch {
        setError("Could not share or copy the result.");
      }
    }
  }

  function handleReset() {
    setFirstName("");
    setSecondName("");
    setResult(null);
    setError("");
  }

  function handleClearHistory() {
    setHistory([]);
  }

  return (
    <main className="app">
      <div className="heart heart-one">♥</div>
      <div className="heart heart-two">♥</div>
      <div className="heart heart-three">♥</div>

      <nav className="navbar">
        <a className="brand" href="#home">
          <span className="brand-icon">♥</span>
          FLAMES
        </a>

        <span className="nav-label">
          A little game of destiny ✨
        </span>
      </nav>

      <section className="hero" id="home">
        <div className="eyebrow">
          ✨ THE CLASSIC NAME GAME ✨
        </div>

        <h1>
          What's your
          <br />
          <span>FLAMES story?</span>
        </h1>

        <p className="subtitle">
          Two names, one playful calculation.
          <br />
          Discover what the FLAMES game says!
        </p>

        <div className="game-card">
          <div className="card-heading">
            <span className="sparkle">✦</span>
            <h2>Let's find your connection</h2>
            <p>Enter two names to begin your game.</p>
          </div>

          <form onSubmit={handleCalculate}>
            <label htmlFor="firstName">YOUR NAME</label>

            <input
              id="firstName"
              type="text"
              placeholder="Enter your name..."
              value={firstName}
              onChange={(event) =>
                setFirstName(event.target.value)
              }
              maxLength={50}
              autoComplete="off"
            />

            <div className="heart-divider">♥</div>

            <label htmlFor="secondName">THEIR NAME</label>

            <input
              id="secondName"
              type="text"
              placeholder="Enter their name..."
              value={secondName}
              onChange={(event) =>
                setSecondName(event.target.value)
              }
              maxLength={50}
              autoComplete="off"
            />

            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}

            <button
              className="calculate-button"
              type="submit"
              disabled={isCalculating}
            >
              {isCalculating
                ? "Calculating..."
                : "Calculate FLAMES"}
              {!isCalculating && <span> →</span>}
            </button>
          </form>

          {result && (
            <div className="result-card" aria-live="polite">
              <div className="result-emoji">
                {result.emoji}
              </div>

              <p className="result-label">
                YOUR FLAMES RESULT
              </p>

              <h2>{result.title}</h2>

              <p className="result-message">
                {result.message}
              </p>

              <p className="disclaimer">
                Just for fun — not a real relationship prediction.
              </p>

              <button
                className="share-button"
                type="button"
                onClick={handleShare}
              >
                ↗ Share Result
              </button>
            </div>
          )}

          <button
            className="reset-button"
            type="button"
            onClick={handleReset}
          >
            ↻ Start Again
          </button>
        </div>

        {history.length > 0 && (
          <section className="history-card">
            <div className="history-heading">
              <h2>📜 Your Game History</h2>
              <span>{history.length} result(s)</span>
            </div>

            <div className="history-list">
              {history.map((item) => (
                <div className="history-item" key={item.id}>
                  <div className="history-details">
                    <strong>
                      {item.firstName} + {item.secondName}
                    </strong>
                    <p>{item.time}</p>
                  </div>

                  <div className="history-result">
                    <span>
                      {item.emoji} {item.title}
                    </span>

                    <button
                      className="history-share-button"
                      type="button"
                      onClick={() => handleShareHistory(item)}
                      aria-label={`Share ${item.firstName} and ${item.secondName} result`}
                    >
                      Share
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              className="reset-button clear-history-button"
              type="button"
              onClick={handleClearHistory}
            >
              Clear History
            </button>
          </section>
        )}

        <div className="flames-legend">
          {Object.entries(FLAMES_RESULTS).map(
            ([letter, item]) => (
              <div className="legend-item" key={letter}>
                <span>{letter}</span>
                <small>{item.title}</small>
              </div>
            )
          )}
        </div>

        <footer>
          Made with <span>♥</span> for a little fun
        </footer>
      </section>
    </main>
  );
}

export default App;
