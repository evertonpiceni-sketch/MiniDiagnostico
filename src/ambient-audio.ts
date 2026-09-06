const bootAmbientAudio = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  let enabled = localStorage.getItem('mini_ambient_sound') !== 'off';
  let started = false;
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let scheduler: number | null = null;

  const control = document.createElement('button');
  control.type = 'button';
  control.className = 'ambient-sound-control';
  control.setAttribute('aria-label', 'Ativar ou pausar música relaxante');
  Object.assign(control.style, {
    position: 'fixed', right: '14px', bottom: '14px', zIndex: '1000',
    minHeight: '38px', padding: '8px 13px', borderRadius: '999px',
    border: '1px solid rgba(111,47,105,.24)', background: 'rgba(255,250,240,.94)',
    color: '#5b2858', boxShadow: '0 8px 24px rgba(75,55,45,.12)',
    backdropFilter: 'blur(10px)', fontSize: '.74rem', fontWeight: '700', cursor: 'pointer'
  });

  const volumeForScreen = () => document.querySelector('.payment-card') ? 0.035 : 0.075;

  const update = () => {
    control.textContent = enabled && started ? '♪ Som: ligado' : '♪ Som';
    control.setAttribute('aria-pressed', String(enabled && started));
  };

  const playBell = (frequency: number, when: number, duration = 4.8, gain = 0.022) => {
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, when);
    filter.type = 'lowpass';
    filter.frequency.value = 1500;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(filter); filter.connect(g); g.connect(master);
    osc.start(when); osc.stop(when + duration + 0.2);
  };

  const playPad = (frequency: number, when: number, duration = 9) => {
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, when);
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.012, when + 1.5);
    g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(filter); filter.connect(g); g.connect(master);
    osc.start(when); osc.stop(when + duration + 0.3);
  };

  const schedulePhrase = () => {
    if (!ctx || !started) return;
    const now = ctx.currentTime + 0.08;
    const progression = [220, 261.63, 196, 246.94];
    progression.forEach((root, i) => {
      const t = now + i * 6.8;
      playPad(root, t, 8.2);
      playPad(root * 1.5, t + 0.25, 7.6);
      playBell(root * 2, t + 1.3, 4.3, 0.014);
      playBell(root * 2.5, t + 3.9, 3.8, 0.009);
    });
  };

  const start = async () => {
    if (!enabled || started) return;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = volumeForScreen();
    master.connect(ctx.destination);
    await ctx.resume();
    started = true;
    schedulePhrase();
    scheduler = window.setInterval(schedulePhrase, 27200);
    update();
  };

  const stop = async () => {
    started = false;
    if (scheduler !== null) window.clearInterval(scheduler);
    scheduler = null;
    if (ctx) {
      try { await ctx.close(); } catch {}
    }
    ctx = null; master = null;
    update();
  };

  const syncForScreen = () => {
    if (!ctx || !master) return;
    master.gain.setTargetAtTime(volumeForScreen(), ctx.currentTime, 0.8);
  };

  control.addEventListener('click', async () => {
    if (started) {
      enabled = false;
      localStorage.setItem('mini_ambient_sound', 'off');
      await stop();
    } else {
      enabled = true;
      localStorage.setItem('mini_ambient_sound', 'on');
      await start();
    }
  });

  document.addEventListener('click', (event) => {
    if (event.target === control || control.contains(event.target as Node)) return;
    void start();
  }, { once: true, capture: true });

  const observer = new MutationObserver(syncForScreen);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.body.appendChild(control);
  update();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootAmbientAudio, { once: true });
} else {
  bootAmbientAudio();
}
