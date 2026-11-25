(() => {
  const canvas = document.getElementById('unity-canvas');
  let frame, loading, active = false, receiver, last = '';

  const signal = document.createElement('canvas');
  signal.width = 128;
  signal.height = 64;
  signal.hidden = true;
  signal.style.cssText = 'position:fixed;image-rendering:pixelated;z-index:1;background:#102216';
  document.body.append(signal);
  const ctx = signal.getContext('2d', {alpha:false});
  const pixels = ctx.createImageData(signal.width, signal.height);
  let signalFrame = 0, signalDone = false, desktopReady = false;

  function reveal() {
    if (!active || !signalDone || !desktopReady) return;
    signal.hidden = true;
    frame.style.pointerEvents='auto';
    frame.inert=false;
    frame.hidden = false;
    frame.contentWindow.pauseDesktop?.(false);
    frame.contentWindow.focus();
  }

  function startSignal() {
    cancelAnimationFrame(signalFrame);
    signalDone = false;
    const start = performance.now();
    function paint(now) {
      if (!active) return;
      const band = Math.floor(Math.random()*61);
      for (let y=0; y<64; y++) {
        const slip = y>=band && y<band+3 ? 9 : 0;
        for (let x=0; x<128; x++) {
          let g = 25 + Math.random()*32 + (y%3 ? 7 : -9);
          if (slip && (x+slip)%31<15) g+=14;
          const i=(128*y+x)*4;
          pixels.data[i]=g*.24; pixels.data[i+1]=g;
          pixels.data[i+2]=g*.46; pixels.data[i+3]=255;
        }
      }
      ctx.putImageData(pixels,0,0);
      if (now-start<150) signalFrame=requestAnimationFrame(paint);
      else {signalDone=true;reveal();}
    }
    paint(start);
  }

  // Runs in the desktop's own window, before any of its original scripts.
  function installHost() {
    const later = window.setTimeout.bind(window), cancel = window.clearTimeout.bind(window);
    if (window.AudioNode) {
      const connect = AudioNode.prototype.connect;
      const buses = new WeakMap();
      AudioNode.prototype.connect = function(target,...ports) {
        if (target === this.context.destination) {
          let bus = buses.get(this.context);
          if (!bus) {
            bus = this.context.createGain();
            connect.call(bus,target);
            buses.set(this.context,bus);
          }
          bus.gain.value = parent.roomMenu.effectsGain;
          target = bus;
        }
        return connect.call(this,target,...ports);
      };
    }
    const timers = new Map();
    let serial = 0, paused = !parent.clover.desktopRunning;
    function arm(t) {
      t.due = performance.now() + t.left;
      t.native = later(() => {
        if (!t.repeat) timers.delete(t.id);
        else { t.left = t.delay; arm(t); }
        t.fn(...t.args);
      }, t.left);
    }
    function schedule(fn, delay, args, repeat) {
      const t = {id: ++serial, fn, delay: Math.max(0, Number(delay) || 0), args, repeat};
      t.left = t.delay;
      timers.set(t.id,t);
      if (!paused) arm(t);
      return t.id;
    }
    window.setTimeout = (fn, ms, ...args) => schedule(fn,ms,args,false);
    window.setInterval = (fn, ms, ...args) => schedule(fn,ms,args,true);
    window.clearTimeout = window.clearInterval = id => {
      const t = timers.get(id);
      if (t) { cancel(t.native); timers.delete(id); }
    };
    window.pauseDesktop = next => {
      if (paused === next) return;
      paused = next;
      for (const t of timers.values()) {
        if (paused) { cancel(t.native); t.left = Math.max(0,t.due-performance.now()); }
        else arm(t);
      }
    };
    window.addEventListener('keydown', e => parent.clover.escape(e), true);
  }

  function layout(x,y,w,h) {
    if (!frame || !active || w <= 0 || h <= 0) return;
    const r = canvas.getBoundingClientRect();
    const width = r.width*w, height = r.height*h;
    const key = [r.left+r.width*x,r.top+r.height*y,width,height].join(',');
    if (last === key) return;
    last = key;
    Object.assign(signal.style,{left:r.left+r.width*x+'px',top:r.top+r.height*y+'px',width:width+'px',height:height+'px'});
    signal.hidden = !frame.hidden;
    Object.assign(frame.style,{left:r.left+r.width*x+'px',top:r.top+r.height*y+'px',
      width:'1280px',height:1280*height/width+'px',transform:'scale('+width/1280+')'});
  }

  const host = window.clover = {
    get active() {return active;},
    get desktopRunning() {return active && signalDone && desktopReady;},
    async show(name) {
      receiver = name; active = true;
      if (!frame) {
        frame = document.createElement('iframe');
        frame.title = 'PIXEL HOLD’EM';
        frame.hidden = true;
        document.body.append(frame);
      }
      frame.inert=true;
      frame.style.pointerEvents='none';
      frame.hidden = true;
      last = '';
      startSignal();
      if (!loading) {
        desktopReady = false;
        frame.onload = () => {
          if (frame.contentWindow.location.href !== 'about:srcdoc') return;
          desktopReady = true;
          reveal();
        };
        loading = fetch('StreamingAssets/PixelHoldem/desktop.html')
          .then(r => {if (!r.ok) throw Error('HTTP '+r.status); return r.text();})
          .then(html => {
            frame.srcdoc = html.replace(/<head>/i, () => '<head><meta charset="utf-8"><script>('+
              installHost.toString()+')();<\/script>');
          }).catch(err => {
            loading = null;
            frame.onload = () => {
              frame.contentWindow.addEventListener('keydown',host.escape,true);
              desktopReady = true;
              reveal();
            };
            frame.srcdoc = '<p lang="ko">게임을 불러오지 못했습니다. ESC로 나간 뒤 다시 시도하세요.</p>';
            console.error(err);
          });
      }
    },
    hide() {
      active = false; last = '';
      cancelAnimationFrame(signalFrame);
      signal.hidden = true;
      if (frame) {frame.contentWindow.pauseDesktop?.(true); frame.inert=true; frame.style.pointerEvents='none'; frame.hidden=true;}
      canvas.focus({preventScroll:true});
    },
    align: layout,
    escape(e) {
      if (!active || e.key !== 'Escape') return;
      e.preventDefault(); e.stopImmediatePropagation();
      host.player.SendMessage(receiver,'LeaveComputer');
    }
  };
  window.addEventListener('keydown',host.escape,true);
})();
