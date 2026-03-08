import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { socket } from "./socket";

const MAX_REACTIONS = 20;
const REACTION_DURATION_MS = 3000;
const MOBILE_BREAKPOINT = 768;
const REACTION_PATHS = [
  "reaction-float--left",
  "reaction-float--right",
  "reaction-float--zigzag",
];
const CONFETTI_EMOJIS = ["🎉", "🎊", "✨"];

const randomBetween = (min, max) => min + Math.random() * (max - min);
const randomInt = (min, max) => Math.floor(randomBetween(min, max + 1));
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const pickRandom = (items) => items[Math.floor(Math.random() * items.length)];

const getViewportRect = () => {
  const viewport = window.visualViewport;
  return {
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
  };
};

const getReactionSpawn = () => {
  const viewport = getViewportRect();
  const minLeft = Math.max(24, viewport.width * 0.2);
  const maxLeft = Math.min(viewport.width - 24, viewport.width * 0.8);
  const mobileBottom = clamp(viewport.height * 0.18, 88, 128);
  const desktopBottom = clamp(viewport.height * 0.08, 44, 84);

  return {
    viewport,
    left: randomBetween(minLeft, Math.max(minLeft, maxLeft)),
    bottom: viewport.width <= MOBILE_BREAKPOINT ? mobileBottom : desktopBottom,
  };
};

const createReactionEntry = (emoji, overrides = {}) => {
  const spawn = overrides.spawn ?? getReactionSpawn();
  const maxLeft = spawn.viewport.width - 24;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    emoji,
    left: clamp(overrides.left ?? spawn.left, 24, maxLeft),
    bottom: overrides.bottom ?? spawn.bottom,
    size: overrides.size ?? randomBetween(30, 42),
    rise: overrides.rise ?? clamp(spawn.viewport.height * 0.42, 180, 340),
    drift: overrides.drift ?? randomBetween(30, 84),
    delay: overrides.delay ?? 0,
    pathClass: overrides.pathClass ?? pickRandom(REACTION_PATHS),
    particle: Boolean(overrides.particle),
  };
};

const buildReactionBatch = (emoji) => {
  const spawn = getReactionSpawn();
  const reactions = [createReactionEntry(emoji, { spawn })];

  if (emoji === "🎉") {
    const particleCount = randomInt(8, 12);
    const minLeft = Math.max(24, spawn.viewport.width * 0.18);
    const maxLeft = Math.min(spawn.viewport.width - 24, spawn.viewport.width * 0.82);

    for (let index = 0; index < particleCount; index += 1) {
      reactions.push(
        createReactionEntry(pickRandom(CONFETTI_EMOJIS), {
          spawn,
          particle: true,
          size: randomBetween(18, 26),
          left: clamp(spawn.left + randomBetween(-90, 90), minLeft, maxLeft),
          bottom: spawn.bottom + randomBetween(-8, 24),
          rise: clamp(spawn.viewport.height * randomBetween(0.24, 0.48), 140, 320),
          drift: randomBetween(18, 72),
          delay: randomBetween(0, 180),
          pathClass: pickRandom(REACTION_PATHS),
        })
      );
    }
  }

  return reactions;
};

function ReactionOverlay() {
  const [reactions, setReactions] = useState([]);
  const pendingReactionsRef = useRef([]);
  const frameRef = useRef(0);
  const timeoutsRef = useRef(new Map());

  useEffect(() => {
    const removeReaction = (reactionId) => {
      setReactions((current) => current.filter((reaction) => reaction.id !== reactionId));
      const timeoutId = timeoutsRef.current.get(reactionId);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutsRef.current.delete(reactionId);
      }
    };

    const queueReactions = (nextReactions) => {
      pendingReactionsRef.current.push(...nextReactions);

      nextReactions.forEach((reaction) => {
        const timeoutId = window.setTimeout(
          () => removeReaction(reaction.id),
          REACTION_DURATION_MS + reaction.delay
        );
        timeoutsRef.current.set(reaction.id, timeoutId);
      });

      if (frameRef.current) return;

      // Batch socket bursts into a single state commit per frame.
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = 0;

        if (!pendingReactionsRef.current.length) return;

        const queued = pendingReactionsRef.current.splice(0);
        setReactions((current) => {
          const next = [...current, ...queued];
          return next.length > MAX_REACTIONS ? next.slice(next.length - MAX_REACTIONS) : next;
        });
      });
    };

    const handleReaction = ({ emoji }) => {
      if (!emoji) return;
      queueReactions(buildReactionBatch(emoji));
    };

    socket.on("reaction", handleReaction);

    return () => {
      socket.off("reaction", handleReaction);

      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }

      timeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      timeoutsRef.current.clear();
      pendingReactionsRef.current = [];
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="reaction-overlay" aria-hidden="true">
      {reactions.map((reaction) => (
        <div
          key={reaction.id}
          className={`reaction-bubble ${reaction.particle ? "reaction-bubble--particle" : ""}`.trim()}
          style={{
            left: `${reaction.left}px`,
            bottom: `${reaction.bottom}px`,
            "--reaction-size": `${reaction.size}px`,
            "--reaction-rise": `${reaction.rise}px`,
            "--reaction-x": `${reaction.drift}px`,
            animationDelay: `${reaction.delay}ms`,
            drift: (Math.random() > 0.5 ? 1 : -1) * randomBetween(20, 80),
          }}
        >
          <span className="reaction-bubble__emoji">{reaction.emoji}</span>
        </div>
      ))}
    </div>,
    document.body
  );
}

export default memo(ReactionOverlay);
