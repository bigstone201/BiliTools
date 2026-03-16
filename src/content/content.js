// src/content/content.js

const DEFAULT_RATES =[2.0, 1.5, 1.25, 1.0, 0.75, 0.5];
let hoverListenerAttached = false;
let currentTargetRate = null;

// 状态标记
let isLongPressing = false;
let hoverListenerBound = false;
let gestureListenerBound = false;

// 全局设置
let globalSettings = {
  enableChipmunk: true,
  longPressSpeed: 3.0,
  enableGesture: true,
  enableMouseLongPress: true,
  mouseLongPressDelay: 500
};

function init() {
  chrome.storage.sync.get(['customSpeeds', 'settings'], (result) => {
    let userRates = result.customSpeeds || DEFAULT_RATES;
    if (!userRates.includes(1.0)) userRates.push(1.0);

    if (result.settings) {
      globalSettings = { ...globalSettings, ...result.settings };
    }

    setTimeout(() => {
      const v = document.querySelector('video');
      if (v) {
        currentTargetRate = v.playbackRate;
        setupKeyboardListener();
        setupGestureSeeking();
      }
      observePlayer(userRates);
    }, 500);
  });
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    globalSettings = { ...globalSettings, ...changes.settings.newValue };
    if (isLongPressing) applySpeed(globalSettings.longPressSpeed, true);
  }
  if (changes.customSpeeds) {
    const menu = document.querySelector('.bpx-player-ctrl-playbackrate-menu');
    if (menu) menu.removeAttribute('data-pro-speed-injected');
  }
});

function applySpeed(rate, isTemporary = false) {
  const video = document.querySelector('video');
  if (!video) return;

  if (!isTemporary) currentTargetRate = rate;

  const CHIPMUNK_THRESHOLD = 7.0;
  if (globalSettings.enableChipmunk) {
    if (rate >= CHIPMUNK_THRESHOLD) {
      video.preservesPitch = false;
      video.mozPreservesPitch = false;
      video.webkitPreservesPitch = false;
    } else {
      video.preservesPitch = true;
      video.mozPreservesPitch = true;
      video.webkitPreservesPitch = true;
    }
  } else {
    video.preservesPitch = true;
    video.mozPreservesPitch = true;
    video.webkitPreservesPitch = true;
  }
  video.playbackRate = rate;
}

function setupAntiReset(video) {
  if (video.hasAttribute('data-pro-speed-guardian')) return;

  video.addEventListener('ratechange', (e) => {
    if (currentTargetRate === null) return;

    // 1. 判断当前应该守护哪个倍数
    // 如果正在长按，就死死锁住长按倍数；如果是平时，就锁住平时选中的倍数
    const expectedRate = isLongPressing ? globalSettings.longPressSpeed : currentTargetRate;

    // 2. 只要实际倍数和期望倍数不一致（被 B站原生代码篡改了）
    if (Math.abs(video.playbackRate - expectedRate) > 0.1) {

      applySpeed(expectedRate, isLongPressing);

      if (isLongPressing && typeof toggleNativeLongPressUI === 'function') {
        toggleNativeLongPressUI(true, expectedRate);
      }
    }
  });

  video.setAttribute('data-pro-speed-guardian', 'true');
}

// 【全新替换】控制 B 站原生长按提示 UI
function toggleNativeLongPressUI(isShowing, speed = 3.0) {
  let hintBox = document.querySelector('.bpx-player-three-playrate-hint');

  // 核心修复：如果 B 站还没加载这个元素，我们自己克隆一个塞进去！
  if (!hintBox) {
    const videoArea = document.querySelector('.bpx-player-video-area');
    if (videoArea) {
      hintBox = document.createElement('div');
      hintBox.className = 'bpx-player-three-playrate-hint'; // 使用B站原生类名，直接白嫖它的 CSS 样式
      hintBox.style.display = 'none';
      // 完美还原B站内部的 DOM 结构
      hintBox.innerHTML = `
                <span class="bpx-player-three-playrate-hint-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 111 66" width="111" height="66" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%; transform: translate3d(0px, 0px, 0px);"><defs><clipPath id="__lottie_element_245"><rect width="111" height="66" x="0" y="0"></rect></clipPath></defs><g clip-path="url(#__lottie_element_245)"><g transform="matrix(1,0,0,1,94.5,32.5)" opacity="0.15" style="display: block;"><g opacity="1" transform="matrix(0,3,-3,0,0,0)"><path fill="rgb(255,255,255)" fill-opacity="1" d=" M6.138000011444092,3.5460000038146973 C6.4679999351501465,4.105999946594238 6.2779998779296875,4.826000213623047 5.7179999351501465,5.156000137329102 C5.538000106811523,5.265999794006348 5.3379998207092285,5.326000213623047 5.118000030517578,5.326000213623047 C5.118000030517578,5.326000213623047 -5.122000217437744,5.326000213623047 -5.122000217437744,5.326000213623047 C-5.771999835968018,5.326000213623047 -6.302000045776367,4.796000003814697 -6.302000045776367,4.145999908447266 C-6.302000045776367,3.936000108718872 -6.242000102996826,3.7260000705718994 -6.142000198364258,3.5460000038146973 C-6.142000198364258,3.5460000038146973 -1.3519999980926514,-4.553999900817871 -1.3519999980926514,-4.553999900817871 C-0.9120000004768372,-5.294000148773193 0.04800000041723251,-5.544000148773193 0.7979999780654907,-5.104000091552734 C1.027999997138977,-4.973999977111816 1.218000054359436,-4.783999919891357 1.3480000495910645,-4.553999900817871 C1.3480000495910645,-4.553999900817871 6.138000011444092,3.5460000038146973 6.138000011444092,3.5460000038146973z"></path></g></g><g transform="matrix(1,0,0,1,55.5,32.5)" opacity="0.36666666666666664" style="display: block;"><g opacity="1" transform="matrix(0,3,-3,0,0,0)"><path fill="rgb(255,255,255)" fill-opacity="1" d=" M6.138000011444092,3.5460000038146973 C6.4679999351501465,4.105999946594238 6.2779998779296875,4.826000213623047 5.7179999351501465,5.156000137329102 C5.538000106811523,5.265999794006348 5.3379998207092285,5.326000213623047 5.118000030517578,5.326000213623047 C5.118000030517578,5.326000213623047 -5.122000217437744,5.326000213623047 -5.122000217437744,5.326000213623047 C-5.771999835968018,5.326000213623047 -6.302000045776367,4.796000003814697 -6.302000045776367,4.145999908447266 C-6.302000045776367,3.936000108718872 -6.242000102996826,3.7260000705718994 -6.142000198364258,3.5460000038146973 C-6.142000198364258,3.5460000038146973 -1.3519999980926514,-4.553999900817871 -1.3519999980926514,-4.553999900817871 C-0.9120000004768372,-5.294000148773193 0.04800000041723251,-5.544000148773193 0.7979999780654907,-5.104000091552734 C1.027999997138977,-4.973999977111816 1.218000054359436,-4.783999919891357 1.3480000495910645,-4.553999900817871 C1.3480000495910645,-4.553999900817871 6.138000011444092,3.5460000038146973 6.138000011444092,3.5460000038146973z"></path></g></g><g transform="matrix(1,0,0,1,16.5,32.5)" opacity="0.5833333333333333" style="display: block;"><g opacity="1" transform="matrix(0,3,-3,0,0,0)"><path fill="rgb(255,255,255)" fill-opacity="1" d=" M6.138000011444092,3.5460000038146973 C6.4679999351501465,4.105999946594238 6.2779998779296875,4.826000213623047 5.7179999351501465,5.156000137329102 C5.538000106811523,5.265999794006348 5.3379998207092285,5.326000213623047 5.118000030517578,5.326000213623047 C5.118000030517578,5.326000213623047 -5.122000217437744,5.326000213623047 -5.122000217437744,5.326000213623047 C-5.771999835968018,5.326000213623047 -6.302000045776367,4.796000003814697 -6.302000045776367,4.145999908447266 C-6.302000045776367,3.936000108718872 -6.242000102996826,3.7260000705718994 -6.142000198364258,3.5460000038146973 C-6.142000198364258,3.5460000038146973 -1.3519999980926514,-4.553999900817871 -1.3519999980926514,-4.553999900817871 C-0.9120000004768372,-5.294000148773193 0.04800000041723251,-5.544000148773193 0.7979999780654907,-5.104000091552734 C1.027999997138977,-4.973999977111816 1.218000054359436,-4.783999919891357 1.3480000495910645,-4.553999900817871 C1.3480000495910645,-4.553999900817871 6.138000011444092,3.5460000038146973 6.138000011444092,3.5460000038146973z"></path></g></g></g></svg></span>
                <span class="bpx-player-three-playrate-hint-text"></span>
            `;
      videoArea.appendChild(hintBox);
    }
  }

  if (hintBox) {
    if (isShowing) {
      hintBox.style.display = '';
      const textSpan = hintBox.querySelector('.bpx-player-three-playrate-hint-text');
      if (textSpan) {
        textSpan.textContent = `倍速播放中`;
      }
    } else {
      hintBox.style.display = 'none';
    }
  } else {
    // 极端情况兜底
    const resultDiv = document.querySelector('.bpx-player-ctrl-playbackrate-result');
    if (resultDiv) resultDiv.textContent = isShowing ? `🚀 ${speed}x` : `${currentTargetRate}x`;
  }
}

function setupKeyboardListener() {
  if (hoverListenerBound) return;
  function isTyping() {
    const target = document.activeElement;
    if (!target) return false;
    const tagName = target.tagName.toUpperCase();
    return tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && !isTyping()) {
      if (e.repeat && !isLongPressing) {
        isLongPressing = true;
        applySpeed(globalSettings.longPressSpeed, true);
        toggleNativeLongPressUI(true, globalSettings.longPressSpeed);
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowRight' && isLongPressing) {
      isLongPressing = false;
      applySpeed(currentTargetRate);
      toggleNativeLongPressUI(false);
    }
  });
  hoverListenerBound = true;
}

// ==========================================
// 手势滑动引擎 & 鼠标长按加速引擎
// ==========================================
function setupGestureSeeking() {
  if (gestureListenerBound) return;

  let isDragging = false;
  let isSignificantDrag = false;
  let startX = 0;
  let startVideoTime = 0;
  let targetTime = 0;
  const SECONDS_PER_PIXEL = 0.08;

  // 左键长按相关的状态变量
  let mouseLongPressTimer = null;
  let isMouseLongPressing = false;
  let wasMouseLongPressing = false; // 用于拦截长按松开时的 click 暂停事件
  let justCancelledDrag = false;    // 用于拦截右键取消时的系统菜单

  if (!document.getElementById('bili-tools-drag-style')) {
    const style = document.createElement('style');
    style.id = 'bili-tools-drag-style';
    style.textContent = `
            body.bili-tools-dragging, 
            body.bili-tools-dragging * {
                cursor: ew-resize !important;
                user-select: none !important;
            }
        `;
    document.head.appendChild(style);
  }

  function formatTime(secs, totalSecs = 0) {
    if (isNaN(secs)) return "00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);

    if (totalSecs >= 3600 || h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // 【修改】在 UI 中加入“右键取消”的提示
  function showDragUI(offset, target, total) {
    let toast = document.getElementById('bili-tools-drag-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'bili-tools-drag-toast';
      toast.style.cssText = `
                position: absolute; top: 20%; left: 50%; transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.7); color: #fff; padding: 12px 24px;
                border-radius: 8px; font-weight: 500; z-index: 99999;
                pointer-events: none; display: flex; flex-direction: column;
                align-items: center; gap: 4px; backdrop-filter: blur(4px);
            `;
      const videoArea = document.querySelector('.bpx-player-video-area');
      if (videoArea) videoArea.appendChild(toast);
    }

    toast.style.display = 'flex';
    const sign = offset > 0 ? '+' : '';
    const offsetText = `${sign}${Math.round(offset)} 秒`;

    toast.innerHTML = `
            <div style="font-size: 22px; color: ${offset > 0 ? '#00AEEC' : '#FF6666'};">${offsetText}</div>
            <div style="font-size: 14px; color: #eee;">${formatTime(target, total)} / ${formatTime(total, total)}</div>
            <div style="font-size: 12px; color: #aaa; margin-top: 6px;">右键取消</div>
        `;
  }

  function hideDragUI() {
    const toast = document.getElementById('bili-tools-drag-toast');
    if (toast) toast.style.display = 'none';
  }

  // 1. 鼠标按下 (处理左键和右键)
  document.body.addEventListener('mousedown', (e) => {
    const target = e.target;
    if (!target.closest('.bpx-player-video-area')) return;
    if (target.closest('.bpx-player-control-wrap') || target.closest('.bpx-player-sending-area')) return;

    // 【新增】如果是在拖拽中按下了右键，则取消操作
    if (e.button === 2 && isDragging && isSignificantDrag) {
      isDragging = false;
      isSignificantDrag = false;
      justCancelledDrag = true;
      hideDragUI();
      document.body.classList.remove('bili-tools-dragging');
      setTimeout(() => { justCancelledDrag = false; }, 200);
      return;
    }

    // 只有左键且手势或长按开启时，才继续
    if (e.button !== 0) return;
    if (!globalSettings.enableGesture && !globalSettings.enableMouseLongPress) return;

    const video = document.querySelector('video');
    if (!video) return;

    // 初始化滑动数据
    isDragging = true;
    isSignificantDrag = false;
    startX = e.clientX;
    startVideoTime = video.currentTime;

    // 【新增】启动左键长按计时器
    if (globalSettings.enableMouseLongPress) {
      mouseLongPressTimer = setTimeout(() => {
        // 如果时间到了，且用户没有大幅度拖拽鼠标，则判定为长按加速
        if (isDragging && !isSignificantDrag) {
          isMouseLongPressing = true;
          isLongPressing = true; // 借用原来的标志位，防止防篡改逻辑介入
          applySpeed(globalSettings.longPressSpeed, true);
          toggleNativeLongPressUI(true, globalSettings.longPressSpeed);
        }
      }, globalSettings.mouseLongPressDelay);
    }
  }, true);

  // 2. 鼠标移动
  document.body.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const video = document.querySelector('video');
    if (!video) return;

    const deltaX = e.clientX - startX;

    // 阈值：滑动超过 10 像素
    if (Math.abs(deltaX) > 10) {
      if (!globalSettings.enableGesture) return;

      // 【核心修复】：如果已经判定为“正在长按加速”，则直接忽略滑动！
      // 这样用户在长按加速时鼠标随便乱晃，也不会变成调进度了。
      if (isMouseLongPressing) {
        return;
      }

      // 如果还没达到长按的延迟时间，但用户已经大幅度滑动了鼠标
      // 说明用户的意图是滑动进度，赶紧把长按加速的计时器掐死
      if (mouseLongPressTimer) {
        clearTimeout(mouseLongPressTimer);
        mouseLongPressTimer = null;
      }

      // 确认进入拖拽模式
      if (!isSignificantDrag) {
        isSignificantDrag = true;
        document.body.classList.add('bili-tools-dragging');
      }

      // 计算目标进度
      const offsetTime = deltaX * SECONDS_PER_PIXEL;
      targetTime = startVideoTime + offsetTime;
      targetTime = Math.max(0, Math.min(targetTime, video.duration));

      showDragUI(offsetTime, targetTime, video.duration);
    }
  }, true);

  // 3. 鼠标松开 (左键松开)
  window.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;

    // 【新增】清理长按相关的状态
    if (mouseLongPressTimer) {
      clearTimeout(mouseLongPressTimer);
      mouseLongPressTimer = null;
    }

    if (isMouseLongPressing) {
      isMouseLongPressing = false;
      isLongPressing = false;
      wasMouseLongPressing = true; // 标记刚刚发生过长按，用来拦截接下来的 click 事件
      applySpeed(currentTargetRate);
      toggleNativeLongPressUI(false);
      setTimeout(() => { wasMouseLongPressing = false; }, 50);
    }

    if (!isDragging) return;
    isDragging = false;
    document.body.classList.remove('bili-tools-dragging');

    // 执行滑动进度跳转
    if (isSignificantDrag) {
      const video = document.querySelector('video');
      if (video) video.currentTime = targetTime;
      hideDragUI();
    }
  }, true);

  // 4. 拦截点击事件 (左键拦截)
  document.body.addEventListener('click', (e) => {
    // 如果刚刚完成了实质性拖拽，或者刚刚结束了长按，则拦截本次点击（防止视频暂停）
    if (isSignificantDrag || wasMouseLongPressing) {
      e.stopPropagation();
      e.preventDefault();
      setTimeout(() => { isSignificantDrag = false; }, 50);
    }
  }, true);

  // 【新增】5. 拦截右键菜单事件 (右键取消时防止弹出菜单)
  document.body.addEventListener('contextmenu', (e) => {
    if (justCancelledDrag) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  gestureListenerBound = true;
  console.log('BiliTools: 手势滑动与长按引擎已启动');
}

// ... 尾部 UI 注入代码 (snapToActive, injectMenu, observePlayer 等保持不变) ...
function snapToActive(menuUl) {
  if (!menuUl) return;
  const activeItem = menuUl.querySelector('.bpx-state-active');
  if (!activeItem) return;
  const prevDisplay = menuUl.style.display;
  const prevVisibility = menuUl.style.visibility;
  menuUl.style.display = 'block';
  menuUl.style.visibility = 'hidden';
  const targetScroll = activeItem.offsetTop - (menuUl.clientHeight / 2) + (activeItem.clientHeight / 2);
  menuUl.scrollTop = targetScroll;
  menuUl.style.display = prevDisplay;
  menuUl.style.visibility = prevVisibility;
}

function injectMenu(rates) {
  const menuUl = document.querySelector('.bpx-player-ctrl-playbackrate-menu');
  if (!menuUl || menuUl.hasAttribute('data-pro-speed-injected')) return;
  const video = document.querySelector('video');
  if (video) {
    setupAntiReset(video);
    if (currentTargetRate === null) currentTargetRate = video.playbackRate;
  }
  menuUl.innerHTML = '';
  const allRates = Array.from(new Set(rates)).sort((a, b) => b - a);
  allRates.forEach(rate => {
    const li = document.createElement('li');
    li.className = 'bpx-player-ctrl-playbackrate-menu-item';
    li.dataset.value = rate;
    li.textContent = rate + 'x';
    if (currentTargetRate && Math.abs(currentTargetRate - rate) < 0.01) {
      li.classList.add('bpx-state-active');
    }
    li.addEventListener('click', (e) => {
      e.stopPropagation();
      applySpeed(rate, false);
      const resultDiv = document.querySelector('.bpx-player-ctrl-playbackrate-result');
      if (resultDiv) resultDiv.textContent = rate + 'x';
      menuUl.querySelectorAll('.bpx-player-ctrl-playbackrate-menu-item').forEach(item => {
        item.classList.remove('bpx-state-active');
      });
      li.classList.add('bpx-state-active');
    });
    menuUl.appendChild(li);
  });
  menuUl.setAttribute('data-pro-speed-injected', 'true');
}

function setupGlobalHoverListener() {
  if (hoverListenerAttached) return;
  document.body.addEventListener('mouseenter', (e) => {
    const target = e.target;
    if (target && target.classList && target.classList.contains('bpx-player-ctrl-playbackrate')) {
      const menuUl = target.querySelector('.bpx-player-ctrl-playbackrate-menu');
      if (menuUl) snapToActive(menuUl);
    }
  }, true);
  hoverListenerAttached = true;
}

function observePlayer(rates) {
  const observer = new MutationObserver(() => {
    const menu = document.querySelector('.bpx-player-ctrl-playbackrate-menu');
    const video = document.querySelector('video');

    if (video && !video.hasAttribute('data-pro-speed-guardian')) {
      setupAntiReset(video);
      setupKeyboardListener();
      setupGestureSeeking();
    }

    if (menu && !menu.hasAttribute('data-pro-speed-injected')) {
      injectMenu(rates);
      setupGlobalHoverListener();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

init();