import confetti from "canvas-confetti";

export function fireAchievementConfetti() {
  const duration = 3000;
  const end = Date.now() + duration;

  const gold = confetti.create(undefined, { resize: true, useWorker: true });

  const frame = () => {
    gold({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ["#c8a84b", "#ffd700", "#5b4eff", "#2dd49f"],
    });
    gold({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ["#c8a84b", "#ffd700", "#5b4eff", "#2dd49f"],
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();

  setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#c8a84b", "#ffd700", "#5b4eff", "#2dd49f", "#e84558"],
    });
  }, 500);
}
