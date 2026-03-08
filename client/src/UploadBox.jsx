import { useEffect, useState } from "react";
import "./uploadBox.css";

export default function UploadBox({ accept, onSelect }) {
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState("idle"); // idle | dropped | animating | uploaded
  const [showCircle, setShowCircle] = useState(false);
  const [showTick, setShowTick] = useState(false);
  const timers = useState([])[0];

  const clearTimers = () => {
    while (timers.length) {
      const t = timers.pop();
      clearTimeout(t);
    }
  };

  const startAnimation = () => {
    clearTimers();
    setDragging(false);
    setStage("dropped");
    setShowCircle(false);
    setShowTick(false);

    timers.push(
      setTimeout(() => {
        setStage("animating");
        setShowCircle(true);
      }, 800)
    );
    timers.push(
      setTimeout(() => {
        setShowTick(true);
      }, 3000)
    );
    timers.push(
      setTimeout(() => {
        setStage("uploaded");
      }, 3500)
    );
  };

  const handleFiles = (files) => {
    const file = files?.[0];
    if (file) {
      onSelect?.(file);
      startAnimation();
    }
  };

  useEffect(() => () => clearTimers(), []);

  const circleSvg = (
    <div className="upload-after-circle">
      <svg className="animated-line" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <path d="M 100 100 m 0 -90 a 90 90 0 1 1 0 180 a 90 90 0 0 1 0 -180" strokeLinecap="round"></path>
      </svg>
      <svg className="animated-line-2" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <path d="M 100 100 m 0 -90 a 90 90 0 1 1 0 180 a 90 90 0 0 1 0 -180" strokeLinecap="round"></path>
      </svg>
    </div>
  );

  const tickSvg = (
    <svg className="tick-line" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
      <polyline
        className="path check"
        fill="none"
        stroke="#07da38"
        strokeWidth="15"
        strokeLinecap="round"
        strokeMiterlimit="10"
        points="100.2,40.2 51.5,88.8 29.8,67.5 "
      />
    </svg>
  );

  const uploadIcon = (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v10" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 8l4-4 4 4" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <div className="upload-container">
      <div className={`upload-file ${stage === "uploaded" ? "uploaded" : ""}`}>
        <div className={`upload-wrap ${dragging ? "dragging" : ""} ${stage === "dropped" || stage === "animating" || stage === "uploaded" ? "dropped" : ""}`}>
          <input
            type="file"
            accept={accept}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="custom-upload-design">
            <div className="upload-icon">{uploadIcon}</div>
            <div className="upload-text">
              Drag and drop <br /> a file, or <span>Browse</span>
            </div>
          </div>
        </div>

        <div className="after-file-upload">
          {showCircle && circleSvg}
          {showTick && <div className="upload-tick">{tickSvg}</div>}
          {stage === "uploaded" && <span className="text-uploaded">Uploaded</span>}
        </div>
      </div>
    </div>
  );
}
