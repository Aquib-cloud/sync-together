import React, { useEffect, useState, useRef } from "react";
import "./LandingPage.css";

const LandingPage = ({ onFinish }) => {
  const [isFading, setIsFading] = useState(false);
  const starsRef = useRef(null);
  const finishedRef = useRef(false);


  useEffect(() => {
    const starContainer = starsRef.current;
    if (!starContainer) return;

    const starCount = 30;
    starContainer.innerHTML = "";

    for (let i = 0; i < starCount; i++) {
      const star = document.createElement("div");
      star.classList.add("star");

      star.style.top = Math.random() * 100 + "%";
      star.style.left = Math.random() * 100 + "%";
      star.style.animationDelay = Math.random() * 1 + "s";
      star.style.animationDuration = (1 + Math.random()) + "s";

      starContainer.appendChild(star);
    }

    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 1100);

    return () => {
      clearTimeout(fadeTimer);
    };
  }, [onFinish]);
  return (
    <div
      className={`landing-wrapper ${isFading ? "fade-out" : ""}`}
      onTransitionEnd={(e) => {
        if (e.target !== e.currentTarget) return;
        if (!isFading || finishedRef.current) return;
        finishedRef.current = true;
        onFinish?.();
      }}
    >
      <div className="stars" ref={starsRef}></div>

      <div className="content">
        <div className="block">
          <h1>Sync</h1>
        </div>

        <div className="block">
          <h2>Together</h2>
        </div>

        <div className="block">
          <h3>DEVELOPED BY AQUIB ALI</h3>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;