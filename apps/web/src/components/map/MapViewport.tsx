import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { WAR_MAP_THEME } from './warMapTheme';

const MIN_ZOOM_LEVEL = 0.5;
const MAX_ZOOM_LEVEL = 3;
const DRAG_THRESHOLD_PX = 4;
const CLICK_SUPPRESSION_MS = 220;

export const MAP_LOW_ZOOM_THRESHOLD = 1.15;
export const MAP_HIGH_ZOOM_THRESHOLD = 1.75;

type ViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startViewBox: ViewBox;
  hasExceededThreshold: boolean;
};

type MapViewportProps = {
  ariaLabel: string;
  baseViewBox: ViewBox;
  children: (helpers: { shouldIgnoreMapClick: () => boolean; zoomLevel: number }) => ReactNode;
  maxWidth?: number;
  resetKey?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampViewBox(baseViewBox: ViewBox, nextViewBox: ViewBox): ViewBox {
  const minX = Math.min(baseViewBox.x, baseViewBox.x + baseViewBox.width - nextViewBox.width);
  const maxX = Math.max(baseViewBox.x, baseViewBox.x + baseViewBox.width - nextViewBox.width);
  const minY = Math.min(baseViewBox.y, baseViewBox.y + baseViewBox.height - nextViewBox.height);
  const maxY = Math.max(baseViewBox.y, baseViewBox.y + baseViewBox.height - nextViewBox.height);

  return {
    x: clamp(nextViewBox.x, minX, maxX),
    y: clamp(nextViewBox.y, minY, maxY),
    width: nextViewBox.width,
    height: nextViewBox.height,
  };
}

export function MapViewport({
  ariaLabel,
  baseViewBox,
  children,
  maxWidth,
  resetKey,
}: MapViewportProps) {
  const [viewBox, setViewBox] = useState<ViewBox>(baseViewBox);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewBoxRef = useRef<ViewBox>(baseViewBox);
  const dragStateRef = useRef<DragState | null>(null);
  const pointerCleanupRef = useRef<(() => void) | null>(null);
  const suppressClickUntilRef = useRef(0);

  const updateViewBox = (nextViewBox: ViewBox) => {
    const clampedViewBox = clampViewBox(baseViewBox, nextViewBox);
    viewBoxRef.current = clampedViewBox;
    setViewBox(clampedViewBox);
  };

  useEffect(() => {
    viewBoxRef.current = baseViewBox;
    setViewBox(baseViewBox);
    setIsDragging(false);
    dragStateRef.current = null;
    pointerCleanupRef.current?.();
    pointerCleanupRef.current = null;
    suppressClickUntilRef.current = 0;
  }, [baseViewBox.height, baseViewBox.width, baseViewBox.x, baseViewBox.y, resetKey]);

  const shouldIgnoreMapClick = () => performance.now() < suppressClickUntilRef.current;
  const zoomLevel = baseViewBox.width / viewBox.width;

  const handleWheelZoom = useCallback((event: Pick<WheelEvent, 'clientX' | 'clientY' | 'deltaY' | 'preventDefault'>) => {
    const svg = svgRef.current;

    if (!svg) {
      return;
    }

    const rect = svg.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    event.preventDefault();

    const currentViewBox = viewBoxRef.current;
    const currentZoomLevel = baseViewBox.width / currentViewBox.width;
    const nextZoomLevel = clamp(
      currentZoomLevel * Math.exp(-event.deltaY * 0.0015),
      MIN_ZOOM_LEVEL,
      MAX_ZOOM_LEVEL,
    );

    if (Math.abs(nextZoomLevel - currentZoomLevel) < 0.0001) {
      return;
    }

    const localX = (event.clientX - rect.left) / rect.width;
    const localY = (event.clientY - rect.top) / rect.height;
    const anchorX = currentViewBox.x + localX * currentViewBox.width;
    const anchorY = currentViewBox.y + localY * currentViewBox.height;
    const nextWidth = baseViewBox.width / nextZoomLevel;
    const nextHeight = baseViewBox.height / nextZoomLevel;

    updateViewBox({
      x: anchorX - localX * nextWidth,
      y: anchorY - localY * nextHeight,
      width: nextWidth,
      height: nextHeight,
    });
  }, [baseViewBox.height, baseViewBox.width]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    const handleNativeWheel = (event: WheelEvent) => {
      handleWheelZoom(event);
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
    };
  }, [handleWheelZoom]);

  useEffect(() => {
    return () => {
      pointerCleanupRef.current?.();
      pointerCleanupRef.current = null;
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) {
      return;
    }

    pointerCleanupRef.current?.();
    pointerCleanupRef.current = null;

    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startViewBox: viewBoxRef.current,
      hasExceededThreshold: false,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dragState = dragStateRef.current;
      const svg = svgRef.current;

      if (!dragState || dragState.pointerId !== moveEvent.pointerId || !svg) {
        return;
      }

      const rect = svg.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const deltaX = moveEvent.clientX - dragState.startClientX;
      const deltaY = moveEvent.clientY - dragState.startClientY;

      if (
        !dragState.hasExceededThreshold &&
        (Math.abs(deltaX) > DRAG_THRESHOLD_PX || Math.abs(deltaY) > DRAG_THRESHOLD_PX)
      ) {
        dragState.hasExceededThreshold = true;
        setIsDragging(true);
      }

      if (!dragState.hasExceededThreshold) {
        return;
      }

      moveEvent.preventDefault();

      updateViewBox({
        x: dragState.startViewBox.x - (deltaX * dragState.startViewBox.width) / rect.width,
        y: dragState.startViewBox.y - (deltaY * dragState.startViewBox.height) / rect.height,
        width: dragState.startViewBox.width,
        height: dragState.startViewBox.height,
      });
    };

    const endPointerInteraction = (pointerId: number) => {
      const dragState = dragStateRef.current;

      if (!dragState || dragState.pointerId !== pointerId) {
        return;
      }

      if (dragState.hasExceededThreshold) {
        suppressClickUntilRef.current = performance.now() + CLICK_SUPPRESSION_MS;
      }

      dragStateRef.current = null;
      setIsDragging(false);
      pointerCleanupRef.current?.();
      pointerCleanupRef.current = null;
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      endPointerInteraction(upEvent.pointerId);
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    pointerCleanupRef.current = cleanup;

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        maxWidth,
        border: `1px solid ${WAR_MAP_THEME.panelBorder}`,
        borderRadius: 14,
        background: WAR_MAP_THEME.background,
        display: 'block',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
        overflow: 'hidden',
        overscrollBehavior: 'contain',
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        role="img"
        aria-label={ariaLabel}
        onPointerDown={handlePointerDown}
        onDragStart={(event) => {
          event.preventDefault();
        }}
        style={{
          width: '100%',
          display: 'block',
          background: WAR_MAP_THEME.background,
        }}
      >
        {children({ shouldIgnoreMapClick, zoomLevel })}
      </svg>
    </div>
  );
}
