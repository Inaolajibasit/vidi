"use client";

import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { useRef, type ReactNode } from "react";

export type StackDirection = "left" | "right";

export interface StackCard {
  content: ReactNode;
  id: string | number;
}

interface StackProps {
  animationConfig?: { damping: number; stiffness: number };
  cards: StackCard[];
  className?: string;
  disabled?: boolean;
  onDrag?: (info: PanInfo) => void;
  onDragEnd?: (info: PanInfo) => void;
  onDragStart?: () => void;
  onSwipe: (direction: StackDirection, info: PanInfo) => void;
  randomRotation?: boolean;
  reducedMotion?: boolean;
  sensitivity?: number;
  velocityThreshold?: number;
}

const EXIT_DISTANCE = 620;

export default function Stack({
  animationConfig = { stiffness: 420, damping: 34 },
  cards,
  className,
  disabled = false,
  onDrag,
  onDragEnd,
  onDragStart,
  onSwipe,
  randomRotation = false,
  reducedMotion = false,
  sensitivity = 88,
  velocityThreshold = 700,
}: StackProps) {
  return (
    <div className={className} style={{ perspective: 900 }}>
      {[...cards].reverse().map((card, reverseIndex) => {
        const index = cards.length - reverseIndex - 1;
        return (
          <StackLayer
            animationConfig={animationConfig}
            card={card}
            disabled={disabled}
            index={index}
            isTop={index === 0}
            key={card.id}
            onDrag={onDrag}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
            onSwipe={onSwipe}
            randomRotation={randomRotation}
            reducedMotion={reducedMotion}
            sensitivity={sensitivity}
            velocityThreshold={velocityThreshold}
          />
        );
      })}
    </div>
  );
}

interface StackLayerProps extends Omit<StackProps, "cards" | "className"> {
  card: StackCard;
  index: number;
  isTop: boolean;
}

function StackLayer({
  animationConfig,
  card,
  disabled,
  index,
  isTop,
  onDrag,
  onDragEnd,
  onDragStart,
  onSwipe,
  randomRotation,
  reducedMotion,
  sensitivity = 88,
  velocityThreshold = 700,
}: StackLayerProps) {
  const committing = useRef(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-160, 160], [8, -8]);
  const rotateY = useTransform(x, [-240, 240], [-5, 5]);
  const rotateZ = useTransform(x, [-240, 0, 240], [-11, 0, 11]);
  const scale = 1 - index * 0.035;
  const stackY = index * 9;
  const restingRotation = randomRotation
    ? ((Number(card.id) || String(card.id).length) % 5) - 2
    : 0;

  async function handleDragEnd(
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) {
    onDragEnd?.(info);
    const projectedX = info.offset.x + info.velocity.x * 0.12;
    const shouldCommit =
      Math.abs(info.offset.x) >= sensitivity ||
      (Math.abs(info.offset.x) >= 32 &&
        Math.abs(info.velocity.x) >= velocityThreshold) ||
      Math.abs(projectedX) >= sensitivity * 1.35;

    if (!shouldCommit) {
      animate(x, 0, {
        type: "spring",
        velocity: info.velocity.x,
        ...animationConfig,
      });
      animate(y, 0, {
        type: "spring",
        velocity: info.velocity.y,
        ...animationConfig,
      });
      return;
    }

    committing.current = true;
    const direction: StackDirection = projectedX < 0 ? "left" : "right";
    if (!reducedMotion) {
      await animate(x, direction === "left" ? -EXIT_DISTANCE : EXIT_DISTANCE, {
        duration: 0.38,
        ease: [0.16, 0.68, 0.22, 1],
        velocity: info.velocity.x,
      });
    }
    onSwipe(direction, info);
  }

  return (
    <motion.div
      animate={{ opacity: 1, scale, y: stackY }}
      className="absolute inset-0 origin-[90%_90%] will-change-transform"
      drag={isTop && !disabled ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.42}
      dragMomentum={false}
      initial={
        reducedMotion
          ? false
          : { opacity: 0, scale: scale * 0.98, y: stackY + 8 }
      }
      onDrag={(_event, info) => {
        if (!committing.current) onDrag?.(info);
      }}
      onDragEnd={handleDragEnd}
      onDragStart={onDragStart}
      style={{
        pointerEvents: isTop ? "auto" : "none",
        rotateX: isTop ? rotateX : 0,
        rotateY: isTop ? rotateY : 0,
        rotateZ: isTop ? rotateZ : restingRotation,
        x,
        zIndex: 20 - index,
      }}
      transition={
        reducedMotion ? { duration: 0 } : { type: "spring", ...animationConfig }
      }
      whileDrag={{ cursor: "grabbing", scale: scale * 0.99 }}
    >
      {card.content}
    </motion.div>
  );
}
