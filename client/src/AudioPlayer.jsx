import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import "./audioPlayer.css";

const AudioPlayer = forwardRef(function AudioPlayer({ src, onPlay, onPause, onSeek }, forwardedRef) {
  const audioRef = useRef(null);
  const playBtnRef = useRef(null);
  const forwardBtnRef = useRef(null);
  const backwardBtnRef = useRef(null);
  const progressRef = useRef(null);
  const currentRef = useRef(null);
  const durationRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause);
  const onSeekRef = useRef(onSeek);

  useImperativeHandle(forwardedRef, () => audioRef.current);

  useEffect(() => {
    onPlayRef.current = onPlay;
  }, [onPlay]);

  useEffect(() => {
    onPauseRef.current = onPause;
  }, [onPause]);

  useEffect(() => {
    onSeekRef.current = onSeek;
  }, [onSeek]);

  useEffect(() => {
    if (src && audioRef.current) {
      audioRef.current.src = src;
      audioRef.current.load();
    }
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    const playBtn = playBtnRef.current;
    const forwardBtn = forwardBtnRef.current;
    const backwardBtn = backwardBtnRef.current;
    const progress = progressRef.current;
    const currentDisplay = currentRef.current;
    const durationDisplay = durationRef.current;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const audioContext = audioContextRef.current;

    if (!analyserRef.current) {
      analyserRef.current = audioContext.createAnalyser();
      analyserRef.current.smoothingTimeConstant = 0.92;
    }
    const analyser = analyserRef.current;

    if (!sourceRef.current) {
      sourceRef.current = audioContext.createMediaElementSource(audio);
      sourceRef.current.connect(analyser);
      analyser.connect(audioContext.destination);
    }

    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationId = null;
    let isPlaying = false;

    function drawVisualizer() {
      animationId = requestAnimationFrame(drawVisualizer);
      analyser.getByteTimeDomainData(dataArray);
      // visualizer no-op for now to keep performance and layout simple
    }

    const fmt = (t) => {
      const minutes = Math.floor(t / 60) || 0;
      const seconds = Math.floor(t % 60) || 0;
      return `${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
    };

    const handlePlayEvent = () => {
      audioContext.resume();
      drawVisualizer();
      playBtn.classList.remove("fa-play");
      playBtn.classList.add("fa-pause");
      isPlaying = true;
      onPlayRef.current && onPlayRef.current();
    };

    const handlePauseEvent = () => {
      playBtn.classList.remove("fa-pause");
      playBtn.classList.add("fa-play");
      isPlaying = false;
      onPauseRef.current && onPauseRef.current();
    };

    const handlePlayClick = () => {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play();
      }
    };

    const handleForward = () => {
      if (!audio) return;
      audio.currentTime = Math.min((audio.currentTime || 0) + 10, audio.duration || audio.currentTime + 10);
    };

    const handleBackward = () => {
      if (!audio) return;
      audio.currentTime = Math.max((audio.currentTime || 0) - 10, 0);
    };

    const handleLoadedMetadata = () => {
      if (!isNaN(audio.duration)) {
        durationDisplay.textContent = fmt(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      const percent = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      progress.style.setProperty("--fill", `${percent}%`);
      currentDisplay.textContent = fmt(audio.currentTime);
    };

    const handleSeeked = () => {
      onSeekRef.current && onSeekRef.current();
    };

    const handleProgressClick = (e) => {
      const width = progress.clientWidth;
      const clickX = e.offsetX;
      const duration = audio.duration || 0;
      if (!duration) return;
      audio.currentTime = (clickX / width) * duration;
    };

    audio.addEventListener("play", handlePlayEvent);
    audio.addEventListener("pause", handlePauseEvent);
    playBtn.addEventListener("click", handlePlayClick);
    forwardBtn.addEventListener("click", handleForward);
    backwardBtn.addEventListener("click", handleBackward);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("seeked", handleSeeked);
    progress.addEventListener("click", handleProgressClick);
    return () => {
      audio.removeEventListener("play", handlePlayEvent);
      audio.removeEventListener("pause", handlePauseEvent);
      playBtn.removeEventListener("click", handlePlayClick);
      forwardBtn.removeEventListener("click", handleForward);
      backwardBtn.removeEventListener("click", handleBackward);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("seeked", handleSeeked);
      progress.removeEventListener("click", handleProgressClick);
      cancelAnimationFrame(animationId);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      sourceRef.current = null;
    };
  }, []);
  useEffect(() => {
    const handler = (e) => {
      const audio = audioRef.current;
      if (!audio) return;

      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      // play / pause
      if (e.code === "Space") {
        e.preventDefault();
        if (audio.paused) {
          audio.play().catch(() => { });
        } else {
          audio.pause();
        }
      }

      // seek forward
      if (e.code === "ArrowRight") {
        e.preventDefault();
        audio.currentTime += 5;
      }

      // seek backward
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        audio.currentTime = Math.max(0, audio.currentTime - 5);
      }
    };

    window.addEventListener("keydown", handler);

    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, []);

  return (
    <div className="voice-wrapper">
      <div className="voice-title">Now Playing</div>

      <div className="voice-progress-row">
        <span ref={currentRef} className="voice-time">0:00</span>
        <div ref={progressRef} className="voice-bar">
          <div className="voice-bar-fill" />
        </div>
        <span ref={durationRef} className="voice-time">0:00</span>
      </div>

      <div className="voice-controls">
        <button
          ref={backwardBtnRef}
          type="button"
          className="vbtn"
          aria-label="Back 10 seconds"
        >
          <i class="fa-solid fa-backward-fast"></i>
        </button>
        <button
          ref={playBtnRef}
          type="button"
          className="vbtn play fa fa-play"
          aria-label="Play or pause"
        />
        <button
          ref={forwardBtnRef}
          type="button"
          className="vbtn"
          aria-label="Forward 10 seconds"
        >
          <i class="fa-solid fa-forward-fast"></i>
        </button>
      </div>

      <audio ref={audioRef} preload="metadata" />
    </div>
  );
});
export default AudioPlayer;