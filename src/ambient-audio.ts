const bootAmbientAudio = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  let enabled = localStorage.getItem('mini_ambient_sound') !== 'off';
  let started = false;
  let starting = false;
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let scheduler: number | null = null;

  const control = document.createElement('button');
  control.type = 'button';
  control.className = 'ambient-sound-control';
  control.setAttribute('aria-label', 'Ativar ou pausar música relaxante');
  Object.assign(control.style, {
    position: 'fixed', right: '14px', bottom: '14px', zIndex: '1000',
    minHeight: '40px', padding: '8px 13px', borderRadius: '999px',
    border: '1px solid rgba(111,47,105,.24)', background: 'rgba(255,250,240,.96)',
    color: '#5b2858', boxShadow: '0 8px 24px rgba(75,55,45,.12)',
    backdropFilter: 'blur(10px)', fontSize: '.74rem', fontWeight: '700', cursor: 'pointer'
  });

  const placeControl = () => {
    const mobile = window.matchMedia('(max-width: 700px)').matches;
    const onLanding = !!document.querySelector('.landing-v2');
    if (mobile && onLanding) {
      control.style.position = 'absolute';
      control.style.right = '18px';
      control.style.bottom = '18px';
    } else {
      control.style.position = 'fixed';
      control.style.right = '14px';
      control.style.bottom = '14px';
    }
  };

  const volumeForScreen = () => document.querySelector('.payment-card') ? 0.055 : 0.11;

  const update = () => {
    control.textContent = started ? '♪ Som: ligado' : '♪ Ativar som';
    control.setAttribute('aria-pressed', String(started));
    placeControl();
  };

  const playTone = (frequency: number, when: number, duration: number, gain: number) => {
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, when);
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.22);
    g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(filter); filter.connect(g); g.connect(master);
    osc.start(when); osc.stop(when + duration + 0.2);
  };

  const schedulePhrase = () => {
    if (!ctx || !started) return;
    const now = ctx.currentTime + 0.05;
    const progression = [220, 261.63, 196, 246.94];
    progression.forEach((root, i) => {
      const t = now + i * 6.8;
      playTone(root, t, 8.2, 0.016);
      playTone(root * 1.5, t + 0.25, 7.6, 0.011);
      playTone(root * 2, t + 1.3, 4.3, 0.018);
      playTone(root * 2.5, t + 3.9, 3.8, 0.012);
    });
  };

  const start = async () => {
    if (!enabled || started || starting) return;
    starting = true;
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) throw new Error('AudioContext unavailable');
      ctx = new AudioContextCtor();
      master = ctx.createGain();
      master.gain.value = volumeForScreen();
      master.connect(ctx.destination);
      await ctx.resume();
      started = ctx.state === 'running';
      if (!started) throw new Error('AudioContext blocked');
      schedulePhrase();
      scheduler = window.setInterval(schedulePhrase, 27200);
    } catch (error) {
      console.warn('Ambient audio could not start:', error);
      started = false;
      if (ctx) { try { await ctx.close(); } catch {} }
      ctx = null; master = null;
    } finally {
      starting = false;
      update();
    }
  };

  const stop = async () => {
    started = false;
    if (scheduler !== null) window.clearInterval(scheduler);
    scheduler = null;
    if (ctx) { try { await ctx.close(); } catch {} }
    ctx = null; master = null;
    update();
  };

  const syncForScreen = () => {
    if (ctx && master && ctx.state === 'running') master.gain.setTargetAtTime(volumeForScreen(), ctx.currentTime, 0.8);
    placeControl();
  };

  control.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
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

  const startOnFirstInteraction = () => {
    if (!enabled || started) return;
    void start();
  };
  document.addEventListener('pointerdown', startOnFirstInteraction, { once: true, passive: true });
  document.addEventListener('keydown', startOnFirstInteraction, { once: true });
  window.addEventListener('resize', placeControl, { passive: true });

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
