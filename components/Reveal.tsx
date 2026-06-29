"use client";

import { motion, type Variants } from "motion/react";
import { EASE } from "@/lib/motion";

const defaultVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

export function Reveal({
  children,
  className,
  delay = 0,
  duration = 0.7,
  variants = defaultVariants,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  variants?: Variants;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-10%" }}
      variants={variants}
      transition={{ duration, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}
