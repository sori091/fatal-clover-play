(() => {
  const canvas = document.getElementById('unity-canvas');
  const prompt = document.getElementById('look-prompt');
  const message = prompt.querySelector('span');
  const copy = prompt.querySelector('button');
  const nativeLock = canvas.requestPointerLock?.bind(canvas);
  let mode = 'MainMenu', pending = false, failure = '', ticket = 0;
  const locked = () => document.pointerLockElement === canvas;
  const foreground = () => document.hasFocus() && !document.hidden;
  const allowed = () => mode === 'Intro' || mode === 'Gameplay';
  const ready = () => mode === 'Gameplay' && foreground() && locked() && document.activeElement === canvas;
  function update() {
    prompt.hidden = mode !== 'Gameplay' || ready();
    const unavailable = !nativeLock || ['UnknownError','WrongDocumentError','SecurityError','NotSupportedError'].includes(failure);
    message.textContent = unavailable ? '마우스를 잠글 수 없습니다. 일반 브라우저에서 직접 열거나 화면을 클릭해 다시 시도하세요.' : '화면을 클릭하여 계속하기';
    copy.hidden = !unavailable;
    canvas.classList.toggle('look-unlocked', !locked());
    if (!ready()) document.getElementById('computer-hint').hidden = true;
  }
  function release() {
    ++ticket;
    pending = false;
    if (locked()) document.exitPointerLock();
  }
  function request(event) {
    if (!event.isTrusted || !allowed() || !foreground() || !nativeLock) { update(); return; }
    canvas.focus({preventScroll:true});
    if (locked() || pending) { update(); return; }
    const id = ++ticket;
    pending = true;
    const fail = error => {
      if (id !== ticket) return;
      failure = error.name; pending = false; update();
    };
    try {
      const promise = nativeLock();
      if (promise) promise.catch(fail);
    } catch (error) { fail(error); }
  }
  // Emscripten queues Unity's requests for a later gesture. The native call
  // belongs exclusively to the trusted start/canvas click handlers below.
  if (nativeLock) canvas.requestPointerLock = () => {};
  document.addEventListener('pointerlockchange', () => {
    pending = false;
    if (locked()) {
      if (!allowed() || !foreground()) release();
      else { failure = ''; canvas.focus({preventScroll:true}); }
    }
    update();
  });
  document.addEventListener('pointerlockerror', () => { pending=false; update(); });
  window.addEventListener('blur', () => { if (allowed()) release(); update(); });
  window.addEventListener('focus', update);
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); update(); });
  document.addEventListener('fullscreenchange', () => {
    if (allowed() && foreground()) canvas.focus({preventScroll:true});
    update();
  });
  canvas.addEventListener('click', event => { if (event.button===0) request(event); });
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(location.origin+location.pathname); copy.textContent='복사됨'; }
    catch { message.textContent='현재 주소를 복사해 일반 브라우저에서 열어 주세요.'; }
  };
  window.roomInput = {
    ready,
    enter(next) {
      mode = next;
      if (!allowed()) { release(); failure=''; }
      else if (mode === 'Gameplay' && foreground()) canvas.focus({preventScroll:true});
      update();
    },
    start(event, goingFullscreen) {
      mode = 'Intro';
      if (!goingFullscreen) request(event);
    },
    get state() {return mode === 'Gameplay' && !ready() ? 'FocusLost' : mode;},
    get failure() {return failure;}
  };
  if (new URLSearchParams(location.search).get('inputDiagnostics') === '1') {
    const trace = window.roomInput.trace = {
      frames:0, trusted:[0,0], native:[0,0], unity:[0,0], turns:0,
      sample(dx,dy,yaw,pitch,x,z,gain,cam,cursor) {
        this.frames++;this.unity[0]+=dx;this.unity[1]+=dy;
        this.turns+=dx*gain/360;this.view={yaw,pitch,x,z,gain,cam,cursor};
      }
    };
    document.addEventListener('mousemove',e=>{
      if(!ready())return;
      trace.native[0]+=e.movementX;trace.native[1]+=e.movementY;
      if(e.isTrusted){trace.trusted[0]+=e.movementX;trace.trusted[1]+=e.movementY;}
    },true);
    const out=document.createElement('output');
    out.style.cssText='position:fixed;inset:auto 0 0;pointer-events:none;color:white;background:#121812;z-index:8;font:12px monospace';
    document.body.append(out);
    setInterval(()=>{out.textContent='INPUT-QA '+JSON.stringify({
      state:window.roomInput.state,lock:locked(),focus:document.activeElement?.tagName,
      full:!!document.fullscreenElement,foreground:foreground(),error:failure,
      frames:trace.frames,trusted:trace.trusted,native:trace.native,unity:trace.unity,
      turns:+trace.turns.toFixed(3),view:trace.view
    });},250);
  }
})();
