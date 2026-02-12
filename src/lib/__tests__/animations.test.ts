import { describe, it, expect } from 'vitest';
import {
  springs,
  stagger,
  staggerContainer,
  fadeSlideUp,
  slideFromLeft,
  slideFromRight,
  scaleIn,
  tabContent,
  noMotion,
  noMotionContainer,
} from '../animations';

describe('springs', () => {
  it('has all expected spring presets', () => {
    expect(springs).toHaveProperty('default');
    expect(springs).toHaveProperty('snappy');
    expect(springs).toHaveProperty('gentle');
    expect(springs).toHaveProperty('bouncy');
  });

  it('all springs have type "spring"', () => {
    for (const spring of Object.values(springs)) {
      expect(spring.type).toBe('spring');
    }
  });

  it('all springs have stiffness and damping', () => {
    for (const spring of Object.values(springs)) {
      expect(spring.stiffness).toBeTypeOf('number');
      expect(spring.damping).toBeTypeOf('number');
    }
  });
});

describe('stagger', () => {
  it('has fast, default, and slow presets', () => {
    expect(stagger.fast).toBe(0.05);
    expect(stagger.default).toBe(0.08);
    expect(stagger.slow).toBe(0.12);
  });
});

describe('staggerContainer', () => {
  it('returns variants with hidden and visible keys', () => {
    const variants = staggerContainer();
    expect(variants).toHaveProperty('hidden');
    expect(variants).toHaveProperty('visible');
  });

  it('uses default stagger timing when called without args', () => {
    const variants = staggerContainer();
    const visible = variants.visible as {
      opacity: number;
      transition: { staggerChildren: number; delayChildren: number };
    };
    expect(visible.transition.staggerChildren).toBe(0.08);
    expect(visible.transition.delayChildren).toBe(0);
  });

  it('uses custom delay values', () => {
    const variants = staggerContainer(0.1, 0.5);
    const visible = variants.visible as {
      opacity: number;
      transition: { staggerChildren: number; delayChildren: number };
    };
    expect(visible.transition.staggerChildren).toBe(0.1);
    expect(visible.transition.delayChildren).toBe(0.5);
  });

  it('hidden state has opacity 0', () => {
    const variants = staggerContainer();
    const hidden = variants.hidden as { opacity: number };
    expect(hidden.opacity).toBe(0);
  });
});

describe('fadeSlideUp', () => {
  it('has hidden and visible keys', () => {
    expect(fadeSlideUp).toHaveProperty('hidden');
    expect(fadeSlideUp).toHaveProperty('visible');
  });

  it('hidden state slides down with opacity 0', () => {
    const hidden = fadeSlideUp.hidden as { opacity: number; y: number };
    expect(hidden.opacity).toBe(0);
    expect(hidden.y).toBe(12);
  });

  it('visible state is at origin with full opacity', () => {
    const visible = fadeSlideUp.visible as { opacity: number; y: number };
    expect(visible.opacity).toBe(1);
    expect(visible.y).toBe(0);
  });
});

describe('slideFromLeft', () => {
  it('has hidden and visible keys', () => {
    expect(slideFromLeft).toHaveProperty('hidden');
    expect(slideFromLeft).toHaveProperty('visible');
  });

  it('hidden state is offset to the left', () => {
    const hidden = slideFromLeft.hidden as { opacity: number; x: number };
    expect(hidden.opacity).toBe(0);
    expect(hidden.x).toBe(-16);
  });

  it('visible state is at origin', () => {
    const visible = slideFromLeft.visible as { opacity: number; x: number };
    expect(visible.opacity).toBe(1);
    expect(visible.x).toBe(0);
  });
});

describe('slideFromRight', () => {
  it('has hidden and visible keys', () => {
    expect(slideFromRight).toHaveProperty('hidden');
    expect(slideFromRight).toHaveProperty('visible');
  });

  it('hidden state is offset to the right', () => {
    const hidden = slideFromRight.hidden as { opacity: number; x: number };
    expect(hidden.opacity).toBe(0);
    expect(hidden.x).toBe(16);
  });

  it('visible state is at origin', () => {
    const visible = slideFromRight.visible as { opacity: number; x: number };
    expect(visible.opacity).toBe(1);
    expect(visible.x).toBe(0);
  });
});

describe('scaleIn', () => {
  it('has hidden and visible keys', () => {
    expect(scaleIn).toHaveProperty('hidden');
    expect(scaleIn).toHaveProperty('visible');
  });

  it('hidden state is scaled down', () => {
    const hidden = scaleIn.hidden as { opacity: number; scale: number };
    expect(hidden.opacity).toBe(0);
    expect(hidden.scale).toBe(0.85);
  });

  it('visible state is full scale', () => {
    const visible = scaleIn.visible as { opacity: number; scale: number };
    expect(visible.opacity).toBe(1);
    expect(visible.scale).toBe(1);
  });
});

describe('tabContent', () => {
  it('has hidden, visible, and exit keys', () => {
    expect(tabContent).toHaveProperty('hidden');
    expect(tabContent).toHaveProperty('visible');
    expect(tabContent).toHaveProperty('exit');
  });
});

describe('noMotion', () => {
  it('has hidden, visible, and exit keys', () => {
    expect(noMotion).toHaveProperty('hidden');
    expect(noMotion).toHaveProperty('visible');
    expect(noMotion).toHaveProperty('exit');
  });

  it('uses short durations for instant feel', () => {
    const visible = noMotion.visible as { transition: { duration: number } };
    const exit = noMotion.exit as { transition: { duration: number } };
    expect(visible.transition.duration).toBeLessThanOrEqual(0.15);
    expect(exit.transition.duration).toBeLessThanOrEqual(0.1);
  });
});

describe('noMotionContainer', () => {
  it('has hidden and visible keys', () => {
    expect(noMotionContainer).toHaveProperty('hidden');
    expect(noMotionContainer).toHaveProperty('visible');
  });
});
