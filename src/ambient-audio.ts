const TRACK = '/ambient-relax.mp3';

const bootAmbientAudio = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const audio = new Audio(TRACK);
  audio.loop = true;
  audio.preload = 'none';
  audio.volume = 0.16;

  let enabled = localStorage.getItem('mini_ambient_sound') !== 'off';
  let started = false;

  const control = document.createElement('button');
  control.type = 'button';
  control.className = 'ambient-sound-control';
  control.setAttribute('aria-label', 'Ativar ou pausar música relaxante');

  const update = () => {
    control.textContent = enabled && started && !audio.paused ? '♪ Som: ligado' : '♪ Som';
    control.setAttribute('aria-pressed', String(enabled && started && !audio.paused));
  };

  const start = async () => {
    if (!enabled || started) return;
    try {
      await audio.play();
      started = true;
      update();
    } catch {
      // Browser may require another explicit interaction.
    }
  };

  const syncForScreen = () => {
    const payment = Boolean(document.querySelector('.payment-card'));
    audio.volume = payment ? 0.07 : 0.16;
  };

  control.addEventListener('click', async () => {
    if (started && !audio.paused) {
      audio.pause();
      enabled = false;
      localStorage.setItem('mini_ambient_sound', 'off');
    } else {
      enabled = true;
      localStorage.setItem('mini_ambient_sound', 'on');
      try {
        await audio.play();
        started = true;
      } catch {}
    }
    update();
  });

  // Start only after a genuine user interaction, respecting autoplay policies.
  document.addEventListener('click', (event) => {
    if (event.target === control || control.contains(event.target as Node)) return;
    void start();
  }, { once: true, capture: true });

  const observer = new MutationObserver(syncForScreen);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.body.appendChild(control);
  syncForScreen();
  update();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootAmbientAudio, { once: true });
} else {
  bootAmbientAudio();
}
