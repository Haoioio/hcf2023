'use strict';

/* ---------- DOM 工具 ---------- */
const $ = (sel) => document.querySelector(sel);
function addStep({ok, title, detail, weight, targets=[]}){
  const li = document.createElement('li');
  li.className = 'step-item';
  li.innerHTML = `
    <div class="step-badges" style="margin-bottom:6px">
      <span class="step-badge ${ok ? 'success':'error'}">${ok ? '✅ 触发' : '✖ 未触发'}</span>
      ${weight ? `<span class="step-badge warning">权重 ${weight}</span>`:''}
      ${targets.length ? `<span class="step-badge neutral">${targets.join(' · ')}</span>`:''}
    </div>
    <div class="step-title">${title}</div>
    ${detail ? `<div class="step-detail">${detail}</div>`:''}
  `;
  $('#steps').appendChild(li);
}

/* ---------- 字体探测已移除 ---------- */
// 字体探测函数已被移除

/* ---------- WebGL Renderer/Vendor ---------- */
function getWebGLInfo(){
  try{
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if(!gl) return null;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return { vendor: String(vendor||''), renderer: String(renderer||'') };
  }catch(e){ return null; }
}

/* ---------- 媒体编解码能力（功能已移除） ---------- */
async function checkMediaCapabilities(){
  // HEVC和VP9检测功能已移除
  return { hevc:null, vp9:null };
}

/* ---------- NFC能力检测 ---------- */
async function checkNFCCapabilities(){
  const result = { hasAPI: false, apiType: '', canScan: false, error: null };
  
  try {
    // 检查标准Web NFC API
    if('NDEFReader' in window) {
      result.hasAPI = true;
      result.apiType = 'NDEFReader';
      
      // 尝试创建NDEFReader实例来测试功能可用性
      try {
        const reader = new NDEFReader();
        result.canScan = true;
      } catch(e) {
        result.error = e.message;
      }
    }
    // 检查其他NFC API
    else if(navigator.nfc || 'nfc' in navigator) {
      result.hasAPI = true;
      result.apiType = 'navigator.nfc';
    }
    else if('NFC' in window) {
      result.hasAPI = true;
      result.apiType = 'window.NFC';
    }
  } catch(e) {
    result.error = e.message;
  }
  
  return result;
}

/* ---------- 平台判定：苹果阵营 ---------- */
function isApplePlatform(){
  try {
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const applePay = 'ApplePaySession' in window;
    const safariPush = !!(window.safari && window.safari.pushNotification);
    const iOSPermissionShape = typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
    const isIphoneOrIpadUA = /iPhone|iPad|iPod/i.test(ua);
    const isMac = /Mac/.test(platform) || /Mac OS X/.test(ua);
    const isIPadOS13Plus = platform === 'MacIntel' && (navigator.maxTouchPoints||0) > 1; // iPadOS 报 MacIntel
    const webkitTouch = (CSS.supports?.('-webkit-touch-callout','none') || CSS.supports?.('-webkit-overflow-scrolling','touch')) || false;
    return !!(applePay || safariPush || iOSPermissionShape || isIphoneOrIpadUA || isIPadOS13Plus || (isMac && webkitTouch));
  } catch { return false; }
}

/* ---------- 运行一次检测 ---------- */
async function detect(){
  $('#steps').innerHTML = '';
  const summaryEl = $('#summary'); 
  summaryEl.innerHTML = '<span class="status-text">正在分析系统特征...</span>';
  summaryEl.classList.add('loading');

    const scores = { android:0, ios:0, ipados:0, macos:0, windows:0, linux:0 };
  const pretty = { android:'Android', ios:'iOS', ipados:'iPadOS', macos:'macOS', windows:'Windows', linux:'Linux' };
  const signals = {};

  const vote = (targets, weight, title, detail, ok=true) => {
    if(ok){ targets.forEach(t => scores[t]+=weight); }
    addStep({ok, title, detail, weight, targets:targets.map(t=>pretty[t])});
  };
  const mark = (title, detail, ok=false, weight=0, targets=[]) => addStep({ok, title, detail, weight, targets});

  /* --- 基础输入设备与显示 --- */
  signals.touchPoints = navigator.maxTouchPoints || 0;
  signals.pointerCoarse = matchMedia('(pointer:coarse)').matches;
  signals.pointerFine = matchMedia('(pointer:fine)').matches;
  signals.hover = matchMedia('(hover:hover)').matches;
  
  // 更严格的触控设备判断：需要同时满足多个条件
  const hasRealTouch = signals.touchPoints > 0 && 'ontouchstart' in window;
  const isPrimaryTouch = signals.pointerCoarse && !signals.hover;
  const isTouchy = hasRealTouch || isPrimaryTouch;

  if(isTouchy){
    vote(['android','ios','ipados'], 2, '触控/粗指针环境', `maxTouchPoints=${signals.touchPoints}, coarse=${signals.pointerCoarse}, hover=${signals.hover}`);
  }else{
    vote(['macos','windows','linux'], 2, '细指针为主', `fine=${signals.pointerFine}, hover=${signals.hover}`);
  }

  /* --- Apple 相关强信号 --- */
  signals.webkitTouchCallout = CSS.supports?.('-webkit-touch-callout','none') || false;
  signals.webkitOverflowScrolling = CSS.supports?.('-webkit-overflow-scrolling','touch') || false;
  if(signals.webkitTouchCallout || signals.webkitOverflowScrolling){
     vote(['ios','ipados'], 5, 'iOS/iPadOS WebKit 移动端 CSS 特性', '-webkit-touch-callout / -webkit-overflow-scrolling: touch');
  }else{
     mark('iOS/iPadOS WebKit 移动端 CSS 特性', '未触发', false, 5, ['iOS','iPadOS']);
  }

  signals.applePay = 'ApplePaySession' in window;
  if(signals.applePay){
     vote(['ios','ipados','macos'], 4, 'Apple Pay API', 'Safari 系列可用（iOS/iPadOS/macOS）');
  }else{
     mark('Apple Pay API', '未检测到 ApplePaySession', false, 4, ['iOS','iPadOS','macOS']);
  }

  signals.safariPush = !!(window.safari && window.safari.pushNotification);
  if(signals.safariPush){
     vote(['macos'], 4, 'Safari Push（macOS 专属）', 'window.safari.pushNotification 存在 → macOS Safari');
  }else{
     mark('Safari Push（macOS 专属）', '未发现 macOS Safari 专属对象', false, 4, ['macOS']);
  }

  signals.iOSPermissionShape = typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
  if(signals.iOSPermissionShape){
     vote(['ios','ipados'], 6, 'iOS 权限 API 形态', 'DeviceMotionEvent.requestPermission 仅 iOS/iPadOS Safari 存在');
  }else{
     mark('iOS 权限 API 形态', '无 requestPermission（或非 Safari 内核）', false, 6, ['iOS','iPadOS']);
  }

  signals.pwaStandalone = 'standalone' in navigator ? navigator.standalone : null;
  if(signals.pwaStandalone !== null){
    // 存在该字段已强提示 iOS PWA；true/false 均可作为苹果移动生态证据
    vote(['ios','ipados'], 2, 'navigator.standalone 字段存在（iOS PWA 环境）', `值=${signals.pwaStandalone}`);
  }

  /* --- Android 相关信号 --- */
  // 使用异步NFC检测
  const nfcCaps = await checkNFCCapabilities();
  signals.webNFC = nfcCaps.hasAPI;
  signals.nfcDetails = nfcCaps.apiType;
  const isSecureContext = window.isSecureContext || location.protocol === 'https:';
  
  if(signals.webNFC){
     let detail = `API类型: ${nfcCaps.apiType}`;
     if(nfcCaps.canScan) detail += ', 功能可用';
     if(nfcCaps.error) detail += `, 错误: ${nfcCaps.error}`;
     if(!isSecureContext) detail += ' (需要HTTPS环境)';
     
     vote(['android'], 4, 'Web NFC支持', `${detail} → Android 强信号`);
  }else{
     const protocolNote = isSecureContext ? '' : ' (当前非HTTPS可能影响检测)';
     mark('Web NFC', `未检测到任何NFC API${protocolNote}`, false, 4, ['Android']);
  }

  signals.relatedApps = 'getInstalledRelatedApps' in navigator;
  if(signals.relatedApps){
    vote(['android'], 3, 'getInstalledRelatedApps', 'WebAPK/关系应用（主要是 Android Chrome）');
  }

  /* --- 桌面侧能力（Chromium 系） --- */
  signals.webSerial = 'serial' in navigator;
  signals.webHID = 'hid' in navigator;
  signals.webUSB = 'usb' in navigator;

  if(signals.webSerial){ vote(['windows','macos','linux'], 4, 'Web Serial', '仅桌面主流 Chromium 浏览器启用'); }
    if(signals.webHID){ vote(['windows','macos','linux'], 2, 'Web HID', '桌面浏览器为主'); }
    if(signals.webUSB){ vote(['windows','macos','linux'], 1, 'Web USB', '桌面与部分 Android 具备；弱证据'); }

  /* --- Apple 移动尺寸分流（仅在 Apple 移动支路） --- */
  const shortSideCSS = Math.min(screen.width, screen.height) / (devicePixelRatio || 1);
  if((signals.webkitTouchCallout || signals.webkitOverflowScrolling || signals.iOSPermissionShape) && isTouchy){
    if(shortSideCSS >= 600){
      vote(['ipados'], 5, '屏幕短边≥600 CSS 像素', `短边≈${shortSideCSS.toFixed(0)}px → 更像 iPadOS`);
    }else{
      vote(['ios'], 5, '屏幕短边<600 CSS 像素', `短边≈${shortSideCSS.toFixed(0)}px → 更像 iOS（iPhone）`);
    }
  }

  /* --- 字体检测已移除 --- */
  // 字体检测功能已按要求移除
  const fontAvail = {};

  /* --- 图形栈（强信号；隐私模式下禁用） --- */
  let glInfo = getWebGLInfo();
  if(glInfo){
    const v = (glInfo.vendor||'').toLowerCase();
    const r = (glInfo.renderer||'').toLowerCase();
    const detail = `vendor="${glInfo.vendor}" · renderer="${glInfo.renderer}"`;
    // Apple
    if(v.includes('apple') || r.includes('apple')){
      vote(['macos','ios','ipados'], 6, 'WebGL 渲染器含 Apple', detail);
    }
    // Windows（Direct3D / D3D）
    if(r.includes('direct3d') || r.includes('d3d')){
      vote(['windows'], 6, 'WebGL 渲染后端指向 Direct3D', detail);
    }
    // Linux（Mesa/X.Org/llvmpipe）
    if(v.includes('mesa') || r.includes('mesa') || r.includes('x.org') || r.includes('llvmpipe')){
      vote(['linux'], 5, 'WebGL 渲染器含 Mesa/X.Org/llvmpipe', detail);
    }
    // Linux 显示栈（X11/Wayland）
    if (v.includes('x11') || r.includes('x11') || v.includes('wayland') || r.includes('wayland')) {
      vote(['linux'], 4, 'WebGL 渲染后端含 X11/Wayland', detail);
    }
    // 移动 GPU 词（弱：辅助区分移动）
    if(r.includes('adreno') || r.includes('mali') || r.includes('Maleoon') || r.includes('powervr')){
      if(isTouchy) vote(['android'], 4, '移动 GPU（Adreno/Mali/PowerVR/Maleoon）且为触控环境', detail);
    }
    // Chrome on macOS 常见：ANGLE (Metal)
    if(r.includes('angle') && r.includes('metal')){
        vote(['macos'], 4, 'ANGLE(Metal) 迹象', detail);
    }
  }else{
    mark('WebGL 渲染器信息', '上下文不可用或被禁用', false, 0);
  }

  /* --- 媒体栈检测已移除 --- */
  let mediaCaps = await checkMediaCapabilities();
  // HEVC和VP9检测已移除

  /* --- 置信度计算与展示（含平分时 UA 二次判定） --- */
  const entries = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  const top = entries[0]; const second = entries[1];
  const topName = top[0]; const topScore = top[1]; const secondScore = second[1];
  const gap = topScore - secondScore;

  // 当多个系统分数并列最高时，使用 UA 进行二次判定
  const topCandidates = entries.filter(([k,v])=>v===topScore).map(([k])=>k);
  const prettyList = (arr)=>arr.map(k=>pretty[k]);
  function breakTieWithUA(candidates){
    try{
      const uaRaw = navigator.userAgent || '';
      const ua = uaRaw.toLowerCase();
      const platform = (navigator.platform || '').toLowerCase();
      // 规则：按明确度从强到弱匹配，仅在候选集合内返回
      const pick = (name)=> candidates.includes(name) ? name : null;
      // Android
      if(/android/.test(ua)){
        const hit = pick('android') || pick('harmonyos'); if(hit) return {hit, reason:'UA含 android'};
      }
      // iPhone/iPod 明确 iOS
      if(/iphone|ipod/.test(ua)){
        const hit = pick('ios') || pick('ipados');
        if(hit) return {hit, reason:'UA含 iPhone/iPod'};
      }
      // iPad 优先归入 iPadOS
      if(/ipad/.test(ua)){
        const hit = pick('ipados') || pick('ios');
        if(hit) return {hit, reason:'UA含 iPad'};
      }
      // macOS / iPadOS 的桌面化 UA
      if(/mac os x|macintosh/.test(ua) || /mac/.test(platform)){
        // iPadOS 13+ 常见：Macintosh + Mobile/Safari
        if(/mobile/.test(ua)){
          const hit = pick('ipados') || pick('ios');
          if(hit) return {hit, reason:'UA含 Macintosh 且含 Mobile → iPadOS 倾向'};
        }
        const hit = pick('macos') || pick('ipados');
        if(hit) return {hit, reason:'UA含 Mac OS X/Macintosh'};
      }
      // Windows
      if(/windows nt/.test(ua)){
        const hit = pick('windows'); if(hit) return {hit, reason:'UA含 Windows NT'};
      }
      // Linux/Unix 类（含 CrOS/X11）
      if(/cros|x11|linux/.test(ua)){
        const hit = pick('linux'); if(hit) return {hit, reason:'UA含 CrOS/X11/Linux'};
      }
      return {hit:null, reason:'未命中明确规则'};
    }catch(e){ return {hit:null, reason:'UA 解析异常: '+String(e)}; }
  }

  let finalTopName = topName;
  if(topCandidates.length > 1){
    const {hit, reason} = breakTieWithUA(topCandidates);
    if(hit){
      finalTopName = hit;
      addStep({
        ok:true, weight:0,
        title:'分数并列 → UA 二次判定已介入',
        detail:`候选: ${prettyList(topCandidates).join(', ')}\n命中: ${pretty[hit]}（${reason}）\nUA: ${navigator.userAgent}`,
        targets: prettyList(topCandidates)
      });
    }else{
      addStep({
        ok:false, weight:0,
        title:'分数并列 → UA 二次判定未能区分',
        detail:`候选: ${prettyList(topCandidates).join(', ')}\n原因: ${reason}\nUA: ${navigator.userAgent}`,
        targets: prettyList(topCandidates)
      });
    }
  }

  // 改进的置信度映射（更精细的分级，考虑绝对分数和相对优势）
  let confidence = 0;
  if(topScore <= 0) {
    confidence = 0;
  } else if(topScore >= 15 && gap >= 8) {
    confidence = 98; // 超高置信度：高分且大幅领先
  } else if(topScore >= 12 && gap >= 6) {
    confidence = 95; // 很高置信度
  } else if(topScore >= 10 && gap >= 5) {
    confidence = 92; // 高置信度
  } else if(topScore >= 8 && gap >= 4) {
    confidence = 88; // 较高置信度
  } else if(topScore >= 6 && gap >= 3) {
    confidence = 82; // 中等偏高置信度
  } else if(topScore >= 5 && gap >= 2) {
    confidence = 75; // 中等置信度
  } else if(gap >= 2) {
    confidence = 68; // 中等偏低置信度
  } else if(gap >= 1) {
    confidence = 58; // 低置信度
  } else {
    confidence = 45; // 很低置信度：分数接近，难以区分
  }

  // 结论区域
  const osNameEl = document.getElementById('osName');
  if (osNameEl) {
    osNameEl.textContent = `${pretty[finalTopName]}（分数 ${topScore}）`;
  }
  $('#confBar').style.width = confidence + '%';
  // 更新百分比文本与无障碍属性
  const confPctEl = document.getElementById('confPct');
  if (confPctEl) confPctEl.textContent = `${Math.round(confidence)}%`;
  const confTrackEl = document.querySelector('.progress-track[role="progressbar"]');
  if (confTrackEl) confTrackEl.setAttribute('aria-valuenow', String(Math.round(confidence)));
  summaryEl.classList.remove('loading');
  summaryEl.innerHTML = `<span class="status-text">检测完成：<strong>${pretty[finalTopName]}</strong> (${confidence}% 置信度)</span>`;

  // 各 OS 分数条（修复：按最高分归一化，避免中高分都100%）
  const sb = document.createElement('div');
  for(const [k,v] of entries){
    const row = document.createElement('div');
    row.className = 'score-row';

    // 以最高分为100%归一化；非0分设置一个最小可见宽度，0分为0%
    const pct = topScore > 0 ? (v / topScore) * 100 : 0;
    const barWidth = v === 0 ? 0 : Math.max(6, Math.min(100, Math.round(pct)));

    row.innerHTML = `
      <div class="score-label">${pretty[k]}</div>
      <div class="score-bar"><span style="width:${barWidth}%"></span></div>
      <div class="mono-text" style="width:40px;text-align:right">${v}</div>
    `;
    sb.appendChild(row);
  }
  $('#scoreBoard').innerHTML = ''; $('#scoreBoard').appendChild(sb);

  // 原始信号快照
  addStep({
    ok:true, weight:0,
    title:'原始信号快照',
    detail:JSON.stringify({basic:{touchPoints:signals.touchPoints, coarse:signals.pointerCoarse, fine:signals.pointerFine, hover:signals.hover},
                           apple:{webkitTouchCallout:signals.webkitTouchCallout, webkitOverflowScrolling:signals.webkitOverflowScrolling, applePay:signals.applePay, safariPush:signals.safariPush, iOSPermissionShape:signals.iOSPermissionShape, pwaStandalone:signals.pwaStandalone},
                           android:{webNFC:signals.webNFC, nfcDetails:signals.nfcDetails, relatedApps:signals.relatedApps},
                           desktop:{webSerial:signals.webSerial, webHID:signals.webHID, webUSB:signals.webUSB},
                           display:{dpr:devicePixelRatio||1, screen:[screen.width, screen.height], shortSideCSS},
                           security:{isSecureContext:isSecureContext, protocol:location.protocol},
                           fonts:undefined, // 下面单列
                           webgl:glInfo,
                           media:mediaCaps,
                           nfc:nfcCaps}, null, 2)
  });

    // 检测完成，但先不触发弹幕，等待用户交互后再启动
  console.log(`🔍 检测完成，系统类型: ${finalTopName} (弹幕将在用户交互后启动)`);

    // 根据检测结果立即播放对应的音频
    if (window.audioManager) {
      console.log('🎵 音频管理器存在，开始播放音频');
      try {
        await window.audioManager.playForOS(finalTopName);
      } catch (error) {
        console.error('❌ 音频播放过程中出错:', error);
      }
    } else {
      console.error('❌ 音频管理器不存在');
    }

  // 暴露给全局，供其他逻辑参考
  window.detectedOSType = finalTopName;
  return { scores, top: finalTopName, confidence };
}

/* ---------- 交互 ---------- */
async function runOnce(){
  try{ 
    // 检查Canvas禁用状态
    checkCanvasDisableFlag();
    
    await detect(); 
  }
  catch(e){ addStep({ok:false, title:'运行异常', detail:String(e), weight:0}); }
}
window.addEventListener('DOMContentLoaded', runOnce);

/* ---------- 音频播放管理 ---------- */
class AudioManager {
  constructor() {
    this.currentAudio = null;
    this.pendingOsType = null; // 存储待播放的系统类型
    this.userHasInteracted = false; // 跟踪用户是否已经交互过
    this.audioFiles = {
      // 简化路径，只使用相对路径
      ios: ['apple.mp3'],
      ipados: ['apple.mp3'], 
      macos: ['apple.mp3'],
      windows: ['android_computer.mp3'],
      linux: ['android_computer.mp3'],
      android: ['android_phone.mp3']
    };
    
    // 添加用户交互监听器以启用音频播放
    this.setupUserInteraction();
    
    // 测试音频文件
    this.testAllAudioFiles();
  }

  // 设置用户交互监听器
  setupUserInteraction() {
    const enableAudio = () => {
      console.log('✅ 用户交互检测到，音频功能已启用');
      this.userHasInteracted = true;
      
      // 如果有待播放的音频，立即播放
      if (this.pendingOsType) {
        console.log(`🎵 播放待处理的音频: ${this.pendingOsType}`);
        this.playAudioDirectly(this.pendingOsType);
        this.pendingOsType = null;
      }
      
      // 移除监听器
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
      document.removeEventListener('keydown', enableAudio);
      document.removeEventListener('mousedown', enableAudio);
      
      // 清理提示界面
      this.removeInteractionPrompt();
      
      console.log('✅ 用户交互监听器已移除，音频功能就绪');
    };
    
    // 添加多种用户交互事件监听
    document.addEventListener('click', enableAudio, { once: true, passive: true });
    document.addEventListener('touchstart', enableAudio, { once: true, passive: true });
    document.addEventListener('keydown', enableAudio, { once: true, passive: true });
    document.addEventListener('mousedown', enableAudio, { once: true, passive: true });
    
    console.log('📱 用户交互监听器已设置，等待用户点击以启用音频');
  }

  // 测试所有音频文件
  async testAllAudioFiles() {
    console.log('🔍 开始测试音频文件...');
    
    const uniqueFiles = [...new Set(Object.values(this.audioFiles).flat())];
    
    for (const file of uniqueFiles) {
      console.log(`测试文件: ${file}`);
      
      const testAudio = new Audio(file);
      
      const testResult = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ success: false, error: '超时' });
        }, 3000);
        
        testAudio.addEventListener('canplaythrough', () => {
          clearTimeout(timeout);
          resolve({ 
            success: true, 
            duration: testAudio.duration,
            format: file.split('.').pop()
          });
        });
        
        testAudio.addEventListener('error', (e) => {
          clearTimeout(timeout);
          resolve({ 
            success: false, 
            error: e.target.error?.message || '加载错误',
            code: e.target.error?.code
          });
        });
        
        // 开始加载
        testAudio.load();
      });
      
      if (testResult.success) {
        console.log(`✅ ${file} - OK (时长: ${testResult.duration?.toFixed(1)}s, 格式: ${testResult.format})`);
      } else {
        console.error(`❌ ${file} - 失败: ${testResult.error} (代码: ${testResult.code || 'N/A'})`);
      }
    }
    
    console.log('🔍 音频文件测试完成');
  }

  // 直接播放音频（内部方法）
  async playAudioDirectly(osType) {
    const audioPaths = this.audioFiles[osType];
    if (!audioPaths || audioPaths.length === 0) {
      console.warn(`未找到 ${osType} 对应的音频文件路径`);
      return;
    }

    console.log(`🎵 开始播放 ${osType} 音频`);

    // 停止当前播放的音频
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }

    // 简单直接的播放方式，使用第一个路径
    const audioFile = audioPaths[0];
    console.log(`使用音频文件: ${audioFile}`);
    
    try {
      this.currentAudio = new Audio(audioFile);
      this.currentAudio.loop = true;
      this.currentAudio.volume = 0.7; // 设置音量
      
      // 添加基本事件监听
      this.currentAudio.addEventListener('canplaythrough', () => {
        console.log(`✅ 音频可以完整播放: ${audioFile}`);
      });
      
      this.currentAudio.addEventListener('error', (e) => {
        console.error(`❌ 音频加载错误: ${audioFile}`, e);
        console.error('错误详情:', {
          code: e.target.error?.code,
          message: e.target.error?.message,
          networkState: e.target.networkState,
          readyState: e.target.readyState,
          src: e.target.src
        });
      });
      
      this.currentAudio.addEventListener('loadedmetadata', () => {
        console.log(`📊 音频元数据加载完成:`, {
          duration: this.currentAudio.duration,
          format: audioFile.split('.').pop()
        });
      });

      // 直接尝试播放
      console.log('🎯 尝试播放音频...');
      await this.currentAudio.play();
      console.log(`🎵 播放成功: ${audioFile}`);
      
      // 播放成功后移除交互提示
      this.removeInteractionPrompt();
      
      // 播放成功后自动启动弹幕（重要修复）
      if (window.startDanmuForOS) {
        console.log(`🎊 音频播放成功，自动启动弹幕: ${osType}`);
        window.startDanmuForOS(osType);
      }
      
    } catch (error) {
      console.error(`❌ 播放失败: ${audioFile}`, error);
      
      // 如果是自动播放被阻止，强制显示交互提示
      if (error.name === 'NotAllowedError' || error.name === 'DOMException') {
        console.log('🚫 自动播放被浏览器阻止，需要用户交互');
        this.pendingOsType = osType; // 确保设置待播放类型
        this.forceShowInteractionPrompt(osType);
        return;
      }
      
      // 其他错误可能是文件问题
      console.error('💥 可能的文件问题:', {
        errorName: error.name,
        errorMessage: error.message,
        audioSrc: this.currentAudio?.src,
        audioError: this.currentAudio?.error
      });
    }
  }

  // 播放指定系统对应的音频
  async playForOS(osType) {
    console.log(`🎵 请求播放音频: ${osType}`);
    
    // 总是先尝试直接播放，如果失败会自动显示交互提示
    await this.playAudioDirectly(osType);
  }

  // 强制显示交互提示（当自动播放失败时）
  forceShowInteractionPrompt(osType) {
    console.log(`🚫 强制显示交互提示 - 系统类型: ${osType}`);
    
    // 显示更明显的全屏提示
    this.createFullScreenPrompt(osType);
    
    // 同时显示页面内提示
    this.showInteractionPrompt(osType);
  }

  // 创建全屏交互提示
  createFullScreenPrompt(osType) {
    // 移除之前的全屏提示
    const oldFullPrompt = document.getElementById('full-screen-audio-prompt');
    if (oldFullPrompt) oldFullPrompt.remove();
    
    const fullPrompt = document.createElement('div');
    fullPrompt.id = 'full-screen-audio-prompt';
    fullPrompt.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    const promptContent = document.createElement('div');
    promptContent.style.cssText = `
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(30px);
      -webkit-backdrop-filter: blur(30px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 20px;
      padding: 40px 30px 30px 30px;
      text-align: center;
      max-width: 360px;
      min-width: 320px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 8px 25px rgba(0,0,0,0.1);
      animation: iosModalIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      position: relative;
    `;
    
    const systemName = this.getSystemName(osType);
    
    promptContent.innerHTML = `
      <div style="margin-bottom: 20px; line-height: 1;">
        <img src="./huchenfeng.jpg" style="
          width: 80px; 
          height: 80px; 
          border-radius: 20px; 
          object-fit: cover;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        " alt="户**" />
      </div>
      <div style="font-size: 22px; font-weight: 600; color: #1d1d1f; margin-bottom: 12px; letter-spacing: -0.5px;">
        欢迎使用 设备检测
      </div>
      <div style="font-size: 15px; color: #86868b; line-height: 1.4; margin-bottom: 30px;">
        操作系统检测<br>
        与户**本人无关
      </div>
      <a style="
        background: linear-gradient(135deg, #007AFF 0%, #0051D5 100%);
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 600;
        border: none;
        cursor: pointer;
        display: inline-block;
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
        transition: all 0.2s ease;
        text-decoration: none;"
        href="https://hcf2023.top"
        target="_blank">
        设备检测原链接
        </a>
        <br>
        <br>
      <div style="
        background: linear-gradient(135deg, #007AFF 0%, #0051D5 100%);
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 600;
        border: none;
        cursor: pointer;
        display: inline-block;
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
        transition: all 0.2s ease;
      " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
        确定
      </div>
    `;
    
    // 添加iOS风格CSS动画
    if (!document.getElementById('ios-modal-style')) {
      const style = document.createElement('style');
      style.id = 'ios-modal-style';
      style.textContent = `
        @keyframes iosModalIn {
          0% { 
            transform: scale(0.8) translateY(60px); 
            opacity: 0; 
          }
          100% { 
            transform: scale(1) translateY(0); 
            opacity: 1; 
          }
        }
        @supports (-webkit-backdrop-filter: blur(20px)) or (backdrop-filter: blur(20px)) {
          #full-screen-audio-prompt {
            background: rgba(0, 0, 0, 0.25) !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    fullPrompt.appendChild(promptContent);
    document.body.appendChild(fullPrompt);
    
    // 点击任意位置触发播放和弹幕
    fullPrompt.addEventListener('click', () => {
      console.log('🎯 用户点击了iOS风格提示，开始播放音频');
      this.userHasInteracted = true;
      
      // 播放音频（音频播放成功后会自动启动弹幕）
      this.playAudioDirectly(osType);
      
      fullPrompt.remove();
      this.removeInteractionPrompt();
    });
    
    console.log('� iOS风格交互提示已显示');
  }

  // 获取系统图标
  getSystemEmoji(osType) {
    const emojiMap = {
      android: '🤖',
      ios: '📱', 
      ipados: '📱',
      macos: '💻',
      windows: '🖥️',
      linux: '🐧'
    };
    return emojiMap[osType] || '💻';
  }

  // 获取系统名称
  getSystemName(osType) {
    const nameMap = {
      android: 'Android',
      ios: 'iOS', 
      ipados: 'iPadOS',
      macos: 'macOS',
      windows: 'Windows',
      linux: 'Linux'
    };
    return nameMap[osType] || osType;
  }

  // 移除交互提示
  removeInteractionPrompt() {
    const prompt = document.getElementById('audio-prompt');
    if (prompt) prompt.remove();
    
    const fullPrompt = document.getElementById('full-screen-audio-prompt');
    if (fullPrompt) fullPrompt.remove();
    
    console.log('🧹 交互提示已清理');
  }

  // 显示交互提示
  showInteractionPrompt(osType) {
    const summary = document.getElementById('summary');
    if (summary) {
      // 添加明显的点击提示
      const promptDiv = document.createElement('div');
      promptDiv.id = 'audio-prompt';
      promptDiv.style.cssText = `
        background: #ff6b35;
        color: white;
        padding: 10px;
        margin: 10px 0;
        border-radius: 5px;
        text-align: center;
        font-weight: bold;
        cursor: pointer;
        animation: pulse 1.5s infinite;
      `;
      promptDiv.innerHTML = '🔊 点击任意位置播放对应音频';
      
      // 添加CSS动画
      if (!document.getElementById('audio-prompt-style')) {
        const style = document.createElement('style');
        style.id = 'audio-prompt-style';
        style.textContent = `
          @keyframes pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.05); }
            100% { opacity: 1; transform: scale(1); }
          }
        `;
        document.head.appendChild(style);
      }
      
      // 移除之前的提示
      const oldPrompt = document.getElementById('audio-prompt');
      if (oldPrompt) oldPrompt.remove();
      
      // 插入新提示
      summary.parentNode.insertBefore(promptDiv, summary.nextSibling);
      
      console.log(`💡 显示交互提示 - 待播放: ${osType}`);
    }
  }
}

// 创建全局音频管理器实例
window.audioManager = new AudioManager();

// 空函数，保持兼容性
function initAudioControls() {
  // 无需任何控制界面
}

/* ---------- 弹幕雨 ---------- */
(function(){
  const container = document.getElementById('danmu-container');
  if(!container){ return; }
  const COLORS = ['c1','c2','c3','c4','c5','c6','c7','c8'];
  const MAX_NODES = 60; // 减少最大节点数，防止过多节点卡顿
  const ACTIVE_LIMIT = 45; // 减少同时存在上限
  const BIG_CARD_ID = 'big-msg-card';
  
  // 苹果阵营专用随机短语
  const APPLE_PHRASES = [
    '哎呀呀呀',
    '太性情了',
    '生日快乐',
    '学业顺利',
    '爱情美满',
    '用苹果手机',
    '开苹果汽车',
    '住苹果小区',
    '享苹果人生'
  ];
  
  // 获取弹幕文本的函数
  function getDanmuText() {
    if (isApplePlatform()) {
      // 苹果阵营：从随机短语中选择
      return APPLE_PHRASES[Math.floor(Math.random() * APPLE_PHRASES.length)];
    } else {
      // 其他平台：使用原来的文本
      return '苦日子还在后头呢';
    }
  }

  function removeBigCard(){
    const el = document.getElementById(BIG_CARD_ID);
    if(el) el.remove();
  }

  function spawn(text){
    if(!text) return;
    const el = document.createElement('div');
    el.className = 'danmu ' + COLORS[Math.floor(Math.random()*COLORS.length)];
    el.textContent = text;
    const startX = Math.random() * 100; // vw
    const duration = 3 + Math.random()*2.5; // 3~5.5s，恢复原始速度
    const delay = Math.random()*0.8; // 0~0.8s，恢复原始延迟
    // 使用字体大小代替scale变换以提高性能
    const fontSize = 14 + Math.random()*10; // 14~24px，恢复原始字体范围
    el.style.left = startX + 'vw';
    el.style.fontSize = fontSize + 'px';
    el.style.animationDuration = duration + 's';
    el.style.animationDelay = delay + 's';
    // 移除scale变换，只保留位移
    el.style.transform = `translateY(-60px)`;
    if(container.childElementCount > MAX_NODES){
      // 回收最早的
      container.firstElementChild?.remove();
    }
    container.appendChild(el);
    el.addEventListener('animationend', ()=> el.remove());
  }

  let currentTimer = null;
  let stopTimer = null;
  function start(text, burst=40){
    stop();
    removeBigCard();
    // 先来一波爆发 - 减少初始爆发密度
    const burstCount = Math.min(burst, ACTIVE_LIMIT);
    for(let i=0;i<burstCount;i++) spawn(text);
    // 持续小雨 - 减少密度和频率
    currentTimer = setInterval(()=>{
      const n = 1 + Math.floor(Math.random()*3); // 1~3 条，显著减少
      const existing = container.childElementCount;
      const room = Math.max(0, ACTIVE_LIMIT - existing);
      for(let i=0; i<Math.min(n, room); i++) spawn(text);
    }, 800); // 增加间隔从500ms到800ms

    // 5 秒后自动停止
    stopTimer = setTimeout(()=>{
      stop();
    }, 5000);
  }
  function stop(){
    if(currentTimer){ clearInterval(currentTimer); currentTimer=null; }
    if(stopTimer){ clearTimeout(stopTimer); stopTimer=null; }
    // 渐进清理：不立即清空，交给动画结束回收
  }

  // 暴露到全局供 detect 调用
  window.startDanmuForOS = function(os){
    let text = '';
    switch(os){
      case 'android': 
        text = '麦有回音，安卓手机'; 
        break;
      case 'ios':
      case 'ipados': text = '手机就是苹果'; break;
      case 'macos': text = '电脑就是Mac'; break;
      case 'windows':
      case 'linux': 
        text = '安卓电脑'; 
        break;
      default: text = '正在检测中…';
    }
    
    console.log(`🎊 启动弹幕: ${text}`);
    
    // 启动弹幕雨 - 减少初始爆发数量
    start(text, 40);
    
    // 5秒后弹幕停止，显示大卡片，然后开始无限循环
    setTimeout(() => {
      showBigMessageCard(text);
      
      // 等待3秒后开始无限循环
      setTimeout(() => {
        startInfiniteLoop();
      }, 3000);
    }, 5000);
  }

  function showBigMessageCard(text){
    const grid = document.querySelector('.content-grid');
    if(!grid) return;
    removeBigCard();
    const card = document.createElement('section');
    card.className = 'info-card big-message-card';
    card.id = BIG_CARD_ID;
    // 批注
    const annot = document.createElement('div');
    annot.className = 'big-message-annot';
    annot.textContent = '户**说';
    // 主文案
    const inner = document.createElement('div');
    inner.className = 'big-message-text';
    inner.textContent = text;
    card.appendChild(annot);
    card.appendChild(inner);

    // 置顶到 content-grid 的第一位
    const first = grid.firstElementChild;
    if(first){
      grid.insertBefore(card, first);
    }else{
      grid.appendChild(card);
    }
  }

  // 持续弹幕功能
  window.startContinuousDanmu = function(){
    // 极少的初始弹幕数量
    for(let i=0; i<5; i++) {
      setTimeout(() => spawn(getDanmuText()), i * 500);
    }
    
    let continuousTimer = setInterval(()=>{
      const n = Math.random() < 0.7 ? 1 : 0; // 70%概率生成1条，30%概率不生成
      const existing = container.childElementCount;
      const room = Math.max(0, ACTIVE_LIMIT - existing);
      for(let i=0; i<Math.min(n, room); i++) spawn(getDanmuText());
    }, 2000); // 大幅增加间隔到2000ms (2秒)
    
    // 存储timer以便后续清理
    window.continuousDanmuTimer = continuousTimer;
  }

  // 停止持续弹幕
  window.stopContinuousDanmu = function(){
    if(window.continuousDanmuTimer){
      clearInterval(window.continuousDanmuTimer);
      window.continuousDanmuTimer = null;
    }
  }

  // 无限循环函数：弹幕3秒 -> Canvas 5秒 -> 停止Canvas -> 弹幕3秒 -> Canvas 5秒 -> 循环
  window.startInfiniteLoop = function(){
    console.log('开始无限循环模式');
    
    // 如果Canvas被禁用，只运行弹幕循环
    if (canvasDisabled || checkCanvasDisableFlag()) {
      console.log('🚫 Canvas已禁用，只运行弹幕循环');
      
      function danmuOnlyLoop() {
        console.log('弹幕循环: 启动');
        window.startContinuousDanmu();
        
        setTimeout(() => {
          console.log('弹幕循环: 停止3秒');
          window.stopContinuousDanmu();
          
          setTimeout(() => {
            danmuOnlyLoop(); // 重新开始弹幕循环
          }, 3000); // 停止3秒
        }, 6000); // 弹幕6秒
      }
      
      danmuOnlyLoop();
      return;
    }
    
    function loopCycle(){
      // 第一阶段：弹幕3秒
      console.log('阶段1: 弹幕3秒');
      window.startContinuousDanmu();
      
      setTimeout(() => {
        // 停止弹幕，开始Canvas 5秒
        console.log('阶段2: Canvas 5秒');
        window.stopContinuousDanmu();
        startWebGLExperience();
        
        setTimeout(() => {
          // 停止Canvas，开始弹幕3秒
          console.log('阶段3: 停止Canvas，弹幕3秒');
          stopWebGLExperience();
          window.startContinuousDanmu();
          
          setTimeout(() => {
            // 停止弹幕，开始Canvas 5秒
            console.log('阶段4: Canvas 5秒');
            window.stopContinuousDanmu();
            startWebGLExperience();
            
            setTimeout(() => {
              // 停止Canvas，重新开始循环
              console.log('循环结束，重新开始');
              stopWebGLExperience();
              loopCycle(); // 递归调用，实现无限循环
            }, 5000); // Canvas运行5秒
          }, 3000); // 弹幕3秒
        }, 5000); // Canvas运行5秒
      }, 3000); // 弹幕3秒
    }
    
    // 开始第一个循环
    loopCycle();
  }
})();

/* ---------- WebGL体验启动 ---------- */
let webglAnimationId = null; // 存储动画帧ID
let webglInitialized = false; // 标记WebGL是否已初始化
let canvasDisabled = false; // Canvas禁用标志

// 检查URL中是否包含禁用Canvas的路径
function checkCanvasDisableFlag() {
  const path = window.location.pathname + window.location.search;
  // 1) URL 显式禁用
  if (path.includes('/disablecanvas') || path.includes('disablecanvas')) {
    canvasDisabled = true;
    console.log('🚫 Canvas已被禁用 (通过 /disablecanvas 路径)');
    return true;
  }
  // 2) 苹果阵营全部禁用（iOS/iPadOS/macOS）
  if (isApplePlatform()) {
    canvasDisabled = true;
    console.log('🚫 Canvas已被禁用（苹果阵营策略：iOS/iPadOS/macOS 不渲染）');
    return true;
  }
  return false;
}

// 动态切换Canvas状态的全局函数
window.toggleCanvas = function(enable) {
  if (enable === undefined) {
    // 切换状态
    canvasDisabled = !canvasDisabled;
  } else {
    // 设置指定状态
    canvasDisabled = !enable;
  }
  
  console.log(`🎛️ Canvas状态: ${canvasDisabled ? '已禁用' : '已启用'}`);
  
  if (canvasDisabled) {
    // 如果禁用，停止当前的Canvas
    stopWebGLExperience();
  }
  
  return !canvasDisabled;
};

// 获取Canvas状态的全局函数
window.getCanvasStatus = function() {
  return {
    enabled: !canvasDisabled,
    disabled: canvasDisabled,
    status: canvasDisabled ? 'disabled' : 'enabled'
  };
};

function startWebGLExperience(){
  // 检查Canvas是否被禁用
  if (canvasDisabled || checkCanvasDisableFlag()) {
    console.log('⏭️ Canvas已禁用，跳过WebGL渲染');
    return;
  }
  
  console.log('启动WebGL后台渲染...');

  const webglContainer = document.getElementById('webgl-container');
  if(!webglContainer) return;
  
  // WebGL在后台运行，不显示界面
  webglContainer.style.display = 'none';
  
  // 如果已经初始化，直接启动动画
  if(webglInitialized && window.webglDraw){
    console.log('WebGL已初始化，重启动画循环');
    startWebGLAnimation();
    return;
  }
  
  // 如果没有初始化，则进行完整初始化
  console.log('首次初始化WebGL...');
  initializeWebGL();
}

function stopWebGLExperience(){
  if (canvasDisabled || checkCanvasDisableFlag()) {
    console.log('⏭️ Canvas已禁用，跳过停止操作');
    return;
  }
  
  console.log('停止WebGL渲染...');
  if(webglAnimationId){
    cancelAnimationFrame(webglAnimationId);
    webglAnimationId = null;
  }
}

function startWebGLAnimation(){
  if (canvasDisabled || checkCanvasDisableFlag()) {
    console.log('⏭️ Canvas已禁用，跳过动画启动');
    return;
  }
  
  if(webglAnimationId) {
    console.log('WebGL动画已在运行，跳过启动');
    return; // 防止重复启动
  }
  
  console.log('开始WebGL动画循环');
  function animate(){
    if(window.webglDraw){
      try {
        window.ang1 += 0.01;
        window.webglDraw();
        webglAnimationId = requestAnimationFrame(animate);
      } catch (e) {
        console.error('Animation frame error:', e);
        webglAnimationId = null;
      }
    } else {
      console.error('webglDraw函数不可用');
      webglAnimationId = null;
    }
  }
  webglAnimationId = requestAnimationFrame(animate);
}

function initializeWebGL(){
  if (canvasDisabled || checkCanvasDisableFlag()) {
    console.log('⏭️ Canvas已禁用，跳过WebGL初始化');
    return;
  }
  
  // 将变量暴露到全局作用域，以便控制
  window.cx = undefined; 
  window.cy = undefined;
  window.glposition = undefined;
  window.glright = undefined;
  window.glforward = undefined;
  window.glup = undefined;
  window.glorigin = undefined;
  window.glx = undefined;
  window.gly = undefined;
  window.gllen = undefined;
  window.canvas = undefined;
  window.gl = undefined;
  window.date = new Date();
  var md = 0,mx,my;
  window.t1 = window.date.getTime();
  var mx = 0, my = 0, mx1 = 0, my1 = 0, lasttimen = 0;
  var ml = 0, mr = 0, mm = 0;
  window.len = 1.6; // 暴露到全局
  window.ang1 = 2.8; // 暴露到全局
  window.ang2 = 0.4; // 暴露到全局
  window.cenx = 0.0; // 暴露到全局
  window.ceny = 0.0; // 暴露到全局
  window.cenz = 0.0; // 暴露到全局
  var KERNEL = "float kernal(vec3 ver){\n" +
      "   vec3 a;\n" +
      "float b,c,d,e;\n" +
      "   a=ver;\n" +
      "   for(int i=0;i<5;i++){\n" +
      "       b=length(a);\n" +
      "       c=atan(a.y,a.x)*8.0;\n" +
      "       e=1.0/b;\n" +
      "       d=acos(a.z/b)*8.0;\n" +
      "       b=pow(b,8.0);\n" +
      "       a=vec3(b*sin(d)*cos(c),b*sin(d)*sin(c),b*cos(d))+ver;\n" +
      "       if(b>6.0){\n" +
      "           break;\n" +
      "       }\n" +
      "   }" +
      "   return 4.0-a.x*a.x-a.y*a.y-a.z*a.z;" +
      "}";
  var vertshade;
  var fragshader;
  window.shaderProgram = undefined; // 暴露到全局
  
  // 不再自动循环的draw函数
  window.webglDraw = function() {
      if (!window.gl || !window.shaderProgram) {
        console.error('WebGL context or shader program not available');
        return;
      }
      window.date = new Date();
      var t2 = window.date.getTime();
      window.t1 = t2;
      window.gl.uniform1f(window.glx, window.cx * 2.0 / (window.cx + window.cy));
      window.gl.uniform1f(window.gly, window.cy * 2.0 / (window.cx + window.cy));
      window.gl.uniform1f(window.gllen, window.len);
      window.gl.uniform3f(window.glorigin, window.len * Math.cos(window.ang1) * Math.cos(window.ang2) + window.cenx, window.len * Math.sin(window.ang2) + window.ceny, window.len * Math.sin(window.ang1) * Math.cos(window.ang2) + window.cenz);
      window.gl.uniform3f(window.glright, Math.sin(window.ang1), 0, -Math.cos(window.ang1));
      window.gl.uniform3f(window.glup, -Math.sin(window.ang2) * Math.cos(window.ang1), Math.cos(window.ang2), -Math.sin(window.ang2) * Math.sin(window.ang1));
      window.gl.uniform3f(window.glforward, -Math.cos(window.ang1) * Math.cos(window.ang2), -Math.sin(window.ang2), -Math.sin(window.ang1) * Math.cos(window.ang2));
      window.gl.drawArrays(window.gl.TRIANGLES, 0, 6);
      window.gl.finish();
  }
  
  document.addEventListener("mousedown",
      function (ev) {
          var oEvent = ev || event;
          if (oEvent.button == 0) {
              ml = 1;
              mm = 0;
          }
          if (oEvent.button == 2) {
              mr = 1;
              mm = 0;
          }
          mx = oEvent.clientX;
          my = oEvent.clientY;
      },
      false);
  document.addEventListener("mouseup",
      function (ev) {
          var oEvent = ev || event;
          if (oEvent.button == 0) {
              ml = 0;
          }
          if (oEvent.button == 2) {
              mr = 0;
          }
      },
      false);
  document.addEventListener("mousemove",
      function (ev) {
      var oEvent = ev || event;
      if (ml == 1) {
          ang1 += (oEvent.clientX - mx) * 0.002;
          ang2 += (oEvent.clientY - my) * 0.002;
          if (oEvent.clientX != mx || oEvent.clientY != my) {
              mm = 1;
          }
      }
      if (mr == 1) {
          var l = len * 4.0 / (cx + cy);
          cenx += l * (-(oEvent.clientX - mx) * Math.sin(ang1) - (oEvent.clientY - my) * Math.sin(ang2) * Math.cos(ang1));
          ceny += l * ((oEvent.clientY - my) * Math.cos(ang2));
          cenz += l * ((oEvent.clientX - mx) * Math.cos(ang1) - (oEvent.clientY - my) * Math.sin(ang2) * Math.sin(ang1));
          if (oEvent.clientX != mx || oEvent.clientY != my) {
              mm = 1;
          }
      }
      mx = oEvent.clientX;
      my = oEvent.clientY;
      },
      false);
  document.addEventListener("mousewheel",
      function (ev) {
          ev.preventDefault();
          var oEvent = ev || event;
          len *= Math.exp(-0.001 * oEvent.wheelDelta);
      },
      false);
  document.addEventListener("touchstart",
      function (ev) {
          var n = ev.touches.length;
          if (n == 1) {
              var oEvent = ev.touches[0];
              mx = oEvent.clientX;
              my = oEvent.clientY;
          }
          else if (n == 2) {
              var oEvent = ev.touches[0];
              mx = oEvent.clientX;
              my = oEvent.clientY;
              oEvent = ev.touches[1];
              mx1 = oEvent.clientX;
              my1 = oEvent.clientY;
          }
          lasttimen = n;
      },
      false);
  document.addEventListener("touchend",
      function (ev) {
          var n = ev.touches.length;
          if (n == 1) {
              var oEvent = ev.touches[0];
              mx = oEvent.clientX;
              my = oEvent.clientY;
          }
          else if (n == 2) {
              var oEvent = ev.touches[0];
              mx = oEvent.clientX;
              my = oEvent.clientY;
              oEvent = ev.touches[1];
              mx1 = oEvent.clientX;
              my1 = oEvent.clientY;
          }
          lasttimen = n;
      },
      false);
  document.addEventListener("touchmove",
      function (ev) {
          ev.preventDefault();
          var n = ev.touches.length;
          if (n == 1&&lasttimen==1) {
              var oEvent = ev.touches[0];
              ang1 += (oEvent.clientX - mx) * 0.002;
              ang2 += (oEvent.clientY - my) * 0.002;
              mx = oEvent.clientX;
              my = oEvent.clientY;
          }
          else if (n == 2) {
              var oEvent = ev.touches[0];
              var oEvent1 = ev.touches[1];
              var l = len * 2.0 / (cx + cy), l1;
              cenx += l * (-(oEvent.clientX + oEvent1.clientX - mx - mx1) * Math.sin(ang1) - (oEvent.clientY + oEvent1.clientY - my - my1) * Math.sin(ang2) * Math.cos(ang1));
              ceny += l * ((oEvent.clientY + oEvent1.clientY - my - my1) * Math.cos(ang2));
              cenz += l * ((oEvent.clientX + oEvent1.clientX - mx - mx1) * Math.cos(ang1) - (oEvent.clientY + oEvent1.clientY - my - my1) * Math.sin(ang2) * Math.sin(ang1));
              l1 = Math.sqrt((mx - mx1) * (mx - mx1) + (my - my1) * (my - my1)+1.0);
              mx = oEvent.clientX;
              my = oEvent.clientY;
              mx1 = oEvent1.clientX;
              my1 = oEvent1.clientY;
              l = Math.sqrt((mx - mx1) * (mx - mx1) + (my - my1) * (my - my1) + 1.0);
              len *= l1 / l;
          }
          lasttimen = n;
      },
      false);
  document.oncontextmenu = function (event) {
      if (mm == 1) {
          event.preventDefault();
      }
  };
  
  function resizeHandler() {
      window.cx = document.body.clientWidth;
      window.cy = document.body.clientHeight;
      if(window.cx>window.cy){
          window.cx=window.cy;
      }
      else{
          window.cy=window.cx;
      }
      document.getElementById("main").style.width=1024+"px";
      document.getElementById("main").style.height=1024+"px";
      document.getElementById("main").style.transform="scale("+window.cx/1024+","+window.cy/1024+")";
  }
  
  // 初始化WebGL
  window.cx = document.body.clientWidth;
  window.cy = document.body.clientHeight;
  if(window.cx>window.cy){
      window.cx=window.cy;
  }
  else{
      window.cy=window.cx;
  }
  document.getElementById("main").style.width=1024+"px";
  document.getElementById("main").style.height=1024+"px";
  document.getElementById("main").style.transform="scale("+window.cx/1024+","+window.cy/1024+")";
  
  var positions = [-1.0, -1.0, 0.0, 1.0, -1.0, 0.0, 1.0, 1.0, 0.0, -1.0, -1.0, 0.0, 1.0, 1.0, 0.0, -1.0, 1.0, 0.0];
  var VSHADER_SOURCE =
      "#version 100\n"+
      "precision highp float;\n" +
      "attribute vec4 position;" +
      "varying vec3 dir, localdir;" +
      "uniform vec3 right, forward, up, origin;" +
      "uniform float x,y;" +
      "void main() {" +
      "   gl_Position = position; " +
      "   dir = forward + right * position.x*x + up * position.y*y;" +
      "   localdir.x = position.x*x;" +
      "   localdir.y = position.y*y;" +
      "   localdir.z = -1.0;" +
      "} ";
  var FSHADER_SOURCE =
      "#version 100\n" +
      "#define PI 3.14159265358979324\n" +
      "#define M_L 0.3819660113\n" +
      "#define M_R 0.6180339887\n" +
      "#define MAXR 8\n" +
      "#define SOLVER 8\n" +
      "precision highp float;\n" +
      "float kernal(vec3 ver)\n;" +
      "uniform vec3 right, forward, up, origin;\n" +
      "varying vec3 dir, localdir;\n" +
      "uniform float len;\n" +
      "vec3 ver;\n" +
      "int sign;"+
      "float v, v1, v2;\n" +
      "float r1, r2, r3, r4, m1, m2, m3, m4;\n" +
      "vec3 n, reflect;\n" +
      "const float step = 0.002;\n" +
      "vec3 color;\n" +
      "void main() {\n" +
      "   color.r=0.0;\n" +
      "   color.g=0.0;\n" +
      "   color.b=0.0;\n" +
      "   sign=0;"+
      "   v1 = kernal(origin + dir * (step*len));\n" +
      "   v2 = kernal(origin);\n" +
      "   for (int k = 2; k < 1002; k++) {\n" +
      "      ver = origin + dir * (step*len*float(k));\n" +
      "      v = kernal(ver);\n" +
      "      if (v > 0.0 && v1 < 0.0) {\n" +
      "         r1 = step * len*float(k - 1);\n" +
      "         r2 = step * len*float(k);\n" +
      "         m1 = kernal(origin + dir * r1);\n" +
      "         m2 = kernal(origin + dir * r2);\n" +
      "         for (int l = 0; l < SOLVER; l++) {\n" +
      "            r3 = r1 * 0.5 + r2 * 0.5;\n" +
      "            m3 = kernal(origin + dir * r3);\n" +
      "            if (m3 > 0.0) {\n" +
      "               r2 = r3;\n" +
      "               m2 = m3;\n" +
      "            }\n" +
      "            else {\n" +
      "               r1 = r3;\n" +
      "               m1 = m3;\n" +
      "            }\n" +
      "         }\n" +
      "         if (r3 < 2.0 * len) {\n" +
      "               sign=1;" +
      "            break;\n" +
      "         }\n" +
      "      }\n" +
      "      if (v < v1&&v1>v2&&v1 < 0.0 && (v1*2.0 > v || v1 * 2.0 > v2)) {\n" +
      "         r1 = step * len*float(k - 2);\n" +
      "         r2 = step * len*(float(k) - 2.0 + 2.0*M_L);\n" +
      "         r3 = step * len*(float(k) - 2.0 + 2.0*M_R);\n" +
      "         r4 = step * len*float(k);\n" +
      "         m2 = kernal(origin + dir * r2);\n" +
      "         m3 = kernal(origin + dir * r3);\n" +
      "         for (int l = 0; l < MAXR; l++) {\n" +
      "            if (m2 > m3) {\n" +
      "               r4 = r3;\n" +
      "               r3 = r2;\n" +
      "               r2 = r4 * M_L + r1 * M_R;\n" +
      "               m3 = m2;\n" +
      "               m2 = kernal(origin + dir * r2);\n" +
      "            }\n" +
      "            else {\n" +
      "               r1 = r2;\n" +
      "               r2 = r3;\n" +
      "               r3 = r4 * M_R + r1 * M_L;\n" +
      "               m2 = m3;\n" +
      "               m3 = kernal(origin + dir * r3);\n" +
      "            }\n" +
      "         }\n" +
      "         if (m2 > 0.0) {\n" +
      "            r1 = step * len*float(k - 2);\n" +
      "            r2 = r2;\n" +
      "            m1 = kernal(origin + dir * r1);\n" +
      "            m2 = kernal(origin + dir * r2);\n" +
      "            for (int l = 0; l < SOLVER; l++) {\n" +
      "               r3 = r1 * 0.5 + r2 * 0.5;\n" +
      "               m3 = kernal(origin + dir * r3);\n" +
      "               if (m3 > 0.0) {\n" +
      "                  r2 = r3;\n" +
      "                  m2 = m3;\n" +
      "               }\n" +
      "               else {\n" +
      "                  r1 = r3;\n" +
      "                  m1 = m3;\n" +
      "               }\n" +
      "            }\n" +
      "            if (r3 < 2.0 * len&&r3> step*len) {\n" +
      "                   sign=1;" +
      "               break;\n" +
      "            }\n" +
      "         }\n" +
      "         else if (m3 > 0.0) {\n" +
      "            r1 = step * len*float(k - 2);\n" +
      "            r2 = r3;\n" +
      "            m1 = kernal(origin + dir * r1);\n" +
      "            m2 = kernal(origin + dir * r2);\n" +
      "            for (int l = 0; l < SOLVER; l++) {\n" +
      "               r3 = r1 * 0.5 + r2 * 0.5;\n" +
      "               m3 = kernal(origin + dir * r3);\n" +
      "               if (m3 > 0.0) {\n" +
      "                  r2 = r3;\n" +
      "                  m2 = m3;\n" +
      "               }\n" +
      "               else {\n" +
      "                  r1 = r3;\n" +
      "                  m1 = m3;\n" +
      "               }\n" +
      "            }\n" +
      "            if (r3 < 2.0 * len&&r3> step*len) {\n" +
      "                   sign=1;" +
      "               break;\n" +
      "            }\n" +
      "         }\n" +
      "      }\n" +
      "      v2 = v1;\n" +
      "      v1 = v;\n" +
      "   }\n" +
      "   if (sign==1) {\n" +
      "      ver = origin + dir*r3 ;\n" +
          "       r1=ver.x*ver.x+ver.y*ver.y+ver.z*ver.z;" +
      "      n.x = kernal(ver - right * (r3*0.00025)) - kernal(ver + right * (r3*0.00025));\n" +
      "      n.y = kernal(ver - up * (r3*0.00025)) - kernal(ver + up * (r3*0.00025));\n" +
      "      n.z = kernal(ver + forward * (r3*0.00025)) - kernal(ver - forward * (r3*0.00025));\n" +
      "      r3 = n.x*n.x+n.y*n.y+n.z*n.z;\n" +
      "      n = n * (1.0 / sqrt(r3));\n" +
      "      ver = localdir;\n" +
      "      r3 = ver.x*ver.x+ver.y*ver.y+ver.z*ver.z;\n" +
      "      ver = ver * (1.0 / sqrt(r3));\n" +
      "      reflect = n * (-2.0*dot(ver, n)) + ver;\n" +
      "      r3 = reflect.x*0.276+reflect.y*0.920+reflect.z*0.276;\n" +
      "      r4 = n.x*0.276+n.y*0.920+n.z*0.276;\n" +
      "      r3 = max(0.0,r3);\n" +
      "      r3 = r3 * r3*r3*r3;\n" +
      "      r3 = r3 * 0.45 + r4 * 0.25 + 0.3;\n" +
          "      n.x = sin(r1*10.0)*0.5+0.5;\n" +
          "      n.y = sin(r1*10.0+2.05)*0.5+0.5;\n" +
          "      n.z = sin(r1*10.0-2.05)*0.5+0.5;\n" +
      "      color = n*r3;\n" +
      "   }\n" +
      "   gl_FragColor = vec4(color.x, color.y, color.z, 1.0);" +
      "}";
  
  canvas = document.getElementById('c1');
  if (!canvas) {
    console.error('Canvas element not found');
    alert('Canvas元素未找到，WebGL渲染失败');
    return;
  }
  
  window.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!window.gl) {
    console.error('WebGL not supported');
    alert('WebGL不被支持，无法进行3D渲染');
    return;
  }
  
  vertshade = window.gl.createShader(window.gl.VERTEX_SHADER);
  fragshader = window.gl.createShader(window.gl.FRAGMENT_SHADER);
  window.shaderProgram = window.gl.createProgram();
  window.gl.shaderSource(vertshade, VSHADER_SOURCE);
  window.gl.compileShader(vertshade);
  var infov = window.gl.getShaderInfoLog(vertshade);
  if (!window.gl.getShaderParameter(vertshade, window.gl.COMPILE_STATUS)) {
    console.error('Vertex shader compilation failed:', infov);
    alert('顶点着色器编译失败: ' + infov);
    return;
  }
  
  window.gl.shaderSource(fragshader, FSHADER_SOURCE + KERNEL);
  window.gl.compileShader(fragshader);
  var infof = window.gl.getShaderInfoLog(fragshader);
  if (!window.gl.getShaderParameter(fragshader, window.gl.COMPILE_STATUS)) {
    console.error('Fragment shader compilation failed:', infof);
    alert('片段着色器编译失败: ' + infof);
    return;
  }
  window.gl.attachShader(window.shaderProgram, vertshade);
  window.gl.attachShader(window.shaderProgram, fragshader);
  window.gl.linkProgram(window.shaderProgram);
  window.gl.useProgram(window.shaderProgram);
  if (!window.gl.getProgramParameter(window.shaderProgram, window.gl.LINK_STATUS)) {
      var info = window.gl.getProgramInfoLog(window.shaderProgram);
      throw 'Could not compile WebGL program.\n\n' + infov + infof + info;
  }
  glposition = window.gl.getAttribLocation(window.shaderProgram, 'position');
  glright = window.gl.getUniformLocation(window.shaderProgram, 'right');
  glforward = window.gl.getUniformLocation(window.shaderProgram, 'forward');
  glup = window.gl.getUniformLocation(window.shaderProgram, 'up');
  glorigin = window.gl.getUniformLocation(window.shaderProgram, 'origin');
  glx = window.gl.getUniformLocation(window.shaderProgram, 'x');
  gly = window.gl.getUniformLocation(window.shaderProgram, 'y');
  gllen = window.gl.getUniformLocation(window.shaderProgram, 'len');
  var buffer = window.gl.createBuffer();
  if (!buffer) {
    console.error('Failed to create buffer');
    alert('创建缓冲区失败');
    return;
  }
  window.gl.bindBuffer(window.gl.ARRAY_BUFFER, buffer);
  window.gl.bufferData(window.gl.ARRAY_BUFFER, new Float32Array(positions), window.gl.STATIC_DRAW);
  window.gl.vertexAttribPointer(glposition, 3, window.gl.FLOAT, false, 0, 0);
  window.gl.enableVertexAttribArray(glposition);

  // 将所有gl相关变量暴露到全局
  window.gl = window.gl;
  window.cx = window.cx;
  window.cy = window.cy;
  window.glposition = glposition;
  window.glright = glright;
  window.glforward = glforward;
  window.glup = glup;
  window.glorigin = glorigin;
  window.glx = glx;
  window.gly = gly;
  window.gllen = gllen;
  window.shaderProgram = window.shaderProgram; // 确保shaderProgram也暴露

  window.gl.viewport(0, 0, 1024, 1024);
  
  // 设置初始化完成标志，但不自动启动动画
  webglInitialized = true;
  console.log('WebGL初始化成功，等待控制启动');
  
  // 启动动画循环
  startWebGLAnimation();
  
  document.getElementById("kernel").value = KERNEL;
  document.getElementById("btn").addEventListener("click", function() {
      var state = this.innerText == "CONFIG";
      this.innerText = state ? "HIDE" : "CONFIG";
      document.getElementById("config").style.display = state ? "inline" : "none";
  });
  document.getElementById("apply").addEventListener("click", function() {
      KERNEL = document.getElementById("kernel").value;
      window.gl.shaderSource(fragshader, FSHADER_SOURCE + KERNEL);
      window.gl.compileShader(fragshader);
      var infof = window.gl.getShaderInfoLog(fragshader);
      if (!window.gl.getShaderParameter(fragshader, window.gl.COMPILE_STATUS)) {
        alert('Fragment shader recompilation failed: ' + infof);
        return;
      }
      window.gl.linkProgram(window.shaderProgram);
      if (!window.gl.getProgramParameter(window.shaderProgram, window.gl.LINK_STATUS)) {
          var info = window.gl.getProgramInfoLog(window.shaderProgram);
          alert('Program linking failed: ' + infof + info);
          return;
      }
      window.gl.useProgram(window.shaderProgram);
      window.glposition = window.gl.getAttribLocation(window.shaderProgram, 'position');
      window.glright = window.gl.getUniformLocation(window.shaderProgram, 'right');
      window.glforward = window.gl.getUniformLocation(window.shaderProgram, 'forward');
      window.glup = window.gl.getUniformLocation(window.shaderProgram, 'up');
      window.glorigin = window.gl.getUniformLocation(window.shaderProgram, 'origin');
      window.glx = window.gl.getUniformLocation(window.shaderProgram, 'x');
      window.gly = window.gl.getUniformLocation(window.shaderProgram, 'y');
      window.gllen = window.gl.getUniformLocation(window.shaderProgram, 'len');
  });
  document.getElementById("cancle").addEventListener("click", function() {
      document.getElementById("kernel").value = KERNEL;
  });
  
  window.addEventListener('resize', resizeHandler);
}