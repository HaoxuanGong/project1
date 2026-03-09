export function getCompanionLayout(width, height) {
  const safeWidth = Math.max(320, width || 0);
  const safeHeight = Math.max(220, height || 0);
  const padding = Math.round(Math.max(16, Math.min(safeWidth, safeHeight) * 0.06));
  const deskWidth = Math.round(Math.max(220, Math.min(360, safeWidth * 0.72)));
  const deskHeight = Math.round(Math.max(108, Math.min(156, safeHeight * 0.34)));
  const deskX = safeWidth - deskWidth - padding;
  const deskY = safeHeight - deskHeight - padding;

  return {
    padding,
    desk: {
      x: deskX,
      y: deskY,
      width: deskWidth,
      height: deskHeight,
      frontHeight: Math.round(deskHeight * 0.46),
    },
    character: {
      x: Math.round(deskX + deskWidth * 0.54),
      y: Math.round(deskY + deskHeight * 0.12),
      scale: Number(Math.max(1.2, Math.min(1.8, safeHeight / 220)).toFixed(2)),
    },
    monitor: {
      x: Math.round(deskX + deskWidth * 0.55),
      y: Math.round(deskY + deskHeight * 0.1),
      width: Math.round(deskWidth * 0.28),
      height: Math.round(deskHeight * 0.34),
    },
    lamp: {
      x: Math.round(deskX + deskWidth * 0.16),
      y: Math.round(deskY + deskHeight * 0.02),
    },
    mug: {
      x: Math.round(deskX + deskWidth * 0.82),
      y: Math.round(deskY + deskHeight * 0.22),
    },
  };
}
