export const EDGE_PADDING = 16;
export const LAUNCHER_HEIGHT = 60;
export const SIDEBAR_GAP = 20;
export const SIDEBAR_SAFE_TOP = 92;
export const SIDEBAR_FALLBACK_WIDTH = 80;

const MIN_VIEWPORT_DIMENSION = 1;

const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) return min;
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
};

const toFinite = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);

export const getViewportRect = () => {
  if (typeof window === "undefined") {
    return { left: 0, top: 0, width: 1280, height: 720 };
  }

  const vv = window.visualViewport;
  if (vv) {
    return {
      left: toFinite(vv.offsetLeft, 0),
      top: toFinite(vv.offsetTop, 0),
      width: Math.max(MIN_VIEWPORT_DIMENSION, toFinite(vv.width, window.innerWidth || 0)),
      height: Math.max(MIN_VIEWPORT_DIMENSION, toFinite(vv.height, window.innerHeight || 0)),
    };
  }

  return {
    left: 0,
    top: 0,
    width: Math.max(MIN_VIEWPORT_DIMENSION, toFinite(window.innerWidth, 0)),
    height: Math.max(MIN_VIEWPORT_DIMENSION, toFinite(window.innerHeight, 0)),
  };
};

export const getSafeViewportSize = ({
  width,
  height,
  minWidth,
  minHeight,
  viewport = getViewportRect(),
  edgePadding = EDGE_PADDING,
}) => {
  const maxWidth = Math.max(MIN_VIEWPORT_DIMENSION, viewport.width - edgePadding * 2);
  const maxHeight = Math.max(MIN_VIEWPORT_DIMENSION, viewport.height - edgePadding * 2);

  const boundedMinWidth = Math.min(Math.max(MIN_VIEWPORT_DIMENSION, minWidth), maxWidth);
  const boundedMinHeight = Math.min(Math.max(MIN_VIEWPORT_DIMENSION, minHeight), maxHeight);

  return {
    width: clamp(toFinite(width, boundedMinWidth), boundedMinWidth, maxWidth),
    height: clamp(toFinite(height, boundedMinHeight), boundedMinHeight, maxHeight),
  };
};

export const getSafeViewportPosition = ({
  x,
  y,
  width,
  height,
  viewport = getViewportRect(),
  edgePadding = EDGE_PADDING,
}) => {
  const minX = viewport.left + edgePadding;
  const minY = viewport.top + edgePadding;
  const maxX = viewport.left + viewport.width - width - edgePadding;
  const maxY = viewport.top + viewport.height - height - edgePadding;

  return {
    x: clamp(x, minX, Math.max(minX, maxX)),
    y: clamp(y, minY, Math.max(minY, maxY)),
  };
};

export const getLauncherPosition = ({
  width,
  height,
  viewport = getViewportRect(),
  edgePadding = EDGE_PADDING,
}) => {
  const x = viewport.left + viewport.width - width - edgePadding;
  const y = viewport.top + viewport.height - height - edgePadding;

  return getSafeViewportPosition({
    x,
    y,
    width,
    height,
    viewport,
    edgePadding,
  });
};

export const getSidebarPosition = ({
  width,
  height,
  sidebarRect,
  viewport = getViewportRect(),
  edgePadding = EDGE_PADDING,
  sidebarGap = SIDEBAR_GAP,
  safeTop = SIDEBAR_SAFE_TOP,
  fallbackSidebarWidth = SIDEBAR_FALLBACK_WIDTH,
}) => {
  const sidebarRight = toFinite(sidebarRect?.right, viewport.left + fallbackSidebarWidth);
  const x = sidebarRight + sidebarGap;

  // try to align with messages button instead of sidebar center
  const messageBtn = document.querySelector(
    '.ig-nav-item[aria-label="Messages"]'
  );

  let y;

  if (messageBtn) {
    const rect = messageBtn.getBoundingClientRect();
    // const buttonCenter = rect.top + rect.height / 2;
    // y = buttonCenter - height / 2;
    y = rect.top;
  } else {
    // fallback to sidebar center
    const sidebarTop = toFinite(sidebarRect?.top, viewport.top);
    // const sidebarHeight = toFinite(sidebarRect?.height, viewport.height);
    // const sidebarCenter = sidebarTop + sidebarHeight / 2;
    // y = sidebarCenter - height / 2;
    y = sidebarTop + safeTop;
  }

  return getSafeViewportPosition({
    x,
    y,
    width,
    height,
    viewport,
    edgePadding,
  });
};
