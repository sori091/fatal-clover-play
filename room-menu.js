(() => {
  const canvas=document.getElementById('unity-canvas');
  const root=document.createElement('section');
  root.id='room-menu';root.hidden=true;
  // Original single-stroke lettering. Uneven outlines and gaps follow the chalk reference.
  function lettering(path,view,width) {
    return '<svg aria-hidden="true" viewBox="'+view+'" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><g filter="url(#chalk-edge)"><path d="'+path+'" stroke-width="'+width+'" opacity=".78"/><path d="'+path+'" stroke-width="'+width*.36+'" stroke-dasharray="11 2 3 3 18 1" transform="translate(-1 -.7)"/></g></svg>';
  }
  const title=lettering('M27 182 Q31 111 40 36 M14 48 Q53 30 103 17 M24 111 L82 91 M75 132 Q51 153 57 155 Q67 155 78 127 Q74 155 88 145 M115 49 Q99 126 108 144 M89 96 L136 77 M152 118 Q128 131 126 146 Q135 150 152 117 Q147 146 163 135 M191 26 Q183 74 187 123 Q189 139 198 139 M127 184 Q108 175 88 208 C63 258 105 250 128 227 M158 153 L146 248 M185 196 C163 189 151 239 174 232 C194 227 197 187 182 199 M206 195 L209 229 Q222 202 235 185 M244 214 Q268 204 258 196 C243 190 224 241 253 226 L265 217 M276 236 L283 188 L278 212 Q294 189 311 185','0 0 326 265',4.8);
  const start=lettering('M22 10 Q18 28 5 40 M18 25 L32 38 M43 6 L42 47 M65 14 L87 10 M77 15 Q74 27 61 36 M73 23 L87 32 M96 6 L94 36 M96 21 L107 19 M68 43 L90 40 L88 54','0 0 112 59',3.3);
  const settings=lettering('M20 9 Q17 20 5 29 M17 18 L28 26 M33 17 L44 15 M45 5 L44 29 M14 35 L41 32 L39 40 L16 43 L15 50 L39 48 M63 12 L84 9 M74 13 Q72 22 60 29 M70 21 L83 28 M85 19 L95 17 M97 5 L95 33 M83 36 C65 36 66 54 81 52 C97 50 98 32 83 36','0 0 112 59',3.2);
  root.innerHTML='<svg width="0" height="0" aria-hidden="true" style="position:absolute"><defs><filter id="chalk-edge" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".16" numOctaves="3" result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale="4.5" result="ink"/><feComponentTransfer in="grain" result="scratches"><feFuncA type="linear" slope="1.5" intercept="-.56"/></feComponentTransfer><feComposite in="ink" in2="scratches" operator="out"/></filter></defs></svg>'+
    '<div id="room-home"><div class="title-art" role="img" aria-label="Fatal Clover">'+title+'</div><nav><button id="begin-room" aria-label="시작">'+start+'</button><button id="open-options" aria-label="설정">'+settings+'</button></nav></div>'+
    '<section id="room-options" hidden aria-labelledby="settings-title"><h1 id="settings-title">설정</h1><div id="room-sliders"></div><label>그래픽 품질<select name="quality"><option>낮음</option><option>중간</option><option>높음</option></select></label><label>전체 화면<input name="fullscreen" type="checkbox"></label><footer><button id="defaults">기본값 복원</button><button id="back-room">뒤로 가기</button></footer></section>';
  document.body.append(root);
  const $=s=>root.querySelector(s),options=$('#room-options');
  const defs=[['master','전체 볼륨',0,1],['music','배경음 볼륨',0,1],['effects','효과음 볼륨',0,1],['sensitivity','마우스 감도',.03,.4],['brightness','화면 밝기',.65,1.55]];
  $('#room-sliders').innerHTML=defs.map(([k,n,l,h])=>'<label>'+n+'<output id="out-'+k+'"></output><input name="'+k+'" type="range" min="'+l+'" max="'+h+'" step=".01"></label>').join('');
  let prefs={},state='',ready=false;
  const send=(m,v)=>{if(ready)window.clover.player.SendMessage('RoomOpening',m,...(v===undefined?[]:[v]));};
  const save=()=>send('SetPreferences',JSON.stringify(prefs));
  function paint(k){$('#out-'+k).textContent=k==='sensitivity'?prefs[k].toFixed(2):Math.round(prefs[k]*100)+'%';}
  function screenMode(on){
    if(!document.fullscreenEnabled)return;
    if(on&&!document.fullscreenElement)document.documentElement.requestFullscreen().catch(()=>{});
    if(!on&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});
  }
  options.addEventListener('input',e=>{
    const k=e.target.name;
    if(k==='fullscreen'){screenMode(e.target.checked);return;}
    if(k==='quality')prefs.quality=e.target.selectedIndex;
    else {prefs[k]=Number(e.target.value);paint(k);}
  });
  options.addEventListener('change',e=>{if(e.target.name!=='fullscreen')save();});
  document.addEventListener('fullscreenchange',()=>{prefs.fullscreen=!!document.fullscreenElement;options.querySelector('[name=fullscreen]').checked=prefs.fullscreen;if(state==='Settings')save();});
  $('#open-options').onclick=()=>send('OpenSettings');
  $('#back-room').onclick=()=>send('Back');
  $('#defaults').onclick=()=>{screenMode(false);send('ResetSettings');};
  $('#begin-room').onclick=event=>{
    if(!ready)return;
    const goingFullscreen=prefs.fullscreen&&document.fullscreenEnabled&&!document.fullscreenElement;
    window.roomInput.start(event,goingFullscreen);
    if(goingFullscreen)screenMode(true);
    send('BeginGame');
  };
  root.addEventListener('keydown',e=>{if(state==='Settings'&&e.key==='Escape')send('Back');});
  window.roomMenu={
    ready(){ready=true;root.hidden=!['MainMenu','Settings'].includes(state);},
    get effectsGain(){return (prefs.master??1)*(prefs.effects??1);},
    update(next,settings){
      const changed=state!==next;state=next;prefs=settings;
      canvas.style.filter=prefs.brightness===1?'':'brightness('+prefs.brightness+')';
      root.hidden=!ready||!['MainMenu','Settings'].includes(state);
      $('#room-home').hidden=state!=='MainMenu';options.hidden=state!=='Settings';
      if(state==='Settings'){
        for(const [k] of defs){options.querySelector('[name='+k+']').value=prefs[k];paint(k);}
        options.querySelector('select').selectedIndex=prefs.quality;
        const full=options.querySelector('[name=fullscreen]');full.disabled=!document.fullscreenEnabled;full.checked=!!document.fullscreenElement;
        if(changed)options.querySelector('input').focus({preventScroll:true});
      }
    }
  };
})();
