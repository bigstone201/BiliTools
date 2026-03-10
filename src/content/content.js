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
  enableGesture: true // 默认开启
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
        setupGestureSeeking(); // 初始化鼠标滑动引擎
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
    if (currentTargetRate === null || isLongPressing) return;
    if (Math.abs(video.playbackRate - currentTargetRate) > 0.1) {
      applySpeed(currentTargetRate);
    }
  });
  video.setAttribute('data-pro-speed-guardian', 'true');
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
        showToast(`🚀 ${globalSettings.longPressSpeed}x`);
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowRight' && isLongPressing) {
      isLongPressing = false;
      applySpeed(currentTargetRate);
      showToast(`已恢复 ${currentTargetRate}x`);
    }
  });
  hoverListenerBound = true;
}

function showToast(text) {
  const resultDiv = document.querySelector('.bpx-player-ctrl-playbackrate-result');
  if (resultDiv) resultDiv.textContent = text;
}

// ==========================================
// 手势滑动引擎 (已优化时间格式与鼠标样式)
// ==========================================
function setupGestureSeeking() {
  if (gestureListenerBound) return;

  let isDragging = false;
  let isSignificantDrag = false;
  let startX = 0;
  let startVideoTime = 0;
  let targetTime = 0;
  const SECONDS_PER_PIXEL = 0.2;

  // 【新增】动态注入全局拖拽样式 (确保能覆盖B站自带的鼠标样式)
  if (!document.getElementById('bili-tools-drag-style')) {
    const style = document.createElement('style');
    style.id = 'bili-tools-drag-style';
    style.textContent = `
            /* 拖拽时，强制网页所有元素鼠标变成左右箭头，并禁止选中文字 */
            body.bili-tools-dragging, 
            body.bili-tools-dragging * {
                cursor: ew-resize !important;
                user-select: none !important;
            }
        `;
    document.head.appendChild(style);
  }

  // 【优化】完美对齐 B站时间格式
  // 如果视频总长超过1小时，则显示 HH:MM:SS，否则显示 MM:SS
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

  // UI 显示
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

    // 使用对齐 B站 格式的时间
    toast.innerHTML = `
            <div style="font-size: 22px; color: ${offset > 0 ? '#00AEEC' : '#FF6666'};">${offsetText}</div>
            <div style="font-size: 14px; color: #eee;">${formatTime(target, total)} / ${formatTime(total, total)}</div>
        `;
  }

  function hideDragUI() {
    const toast = document.getElementById('bili-tools-drag-toast');
    if (toast) toast.style.display = 'none';
  }

  // 1. 鼠标按下
  document.body.addEventListener('mousedown', (e) => {
    // 【关键拦截】：如果用户在设置里关闭了手势功能，直接退出，不触发任何逻辑
    if (!globalSettings.enableGesture) return;

    if (e.button !== 0) return;

    const target = e.target;
    if (!target.closest('.bpx-player-video-area')) return;
    if (target.closest('.bpx-player-control-wrap') || target.closest('.bpx-player-sending-area')) return;

    const video = document.querySelector('video');
    if (!video) return;

    isDragging = true;
    isSignificantDrag = false;
    startX = e.clientX;
    startVideoTime = video.currentTime;
  }, true);

  // 2. 鼠标移动
  document.body.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const video = document.querySelector('video');
    if (!video) return;

    const deltaX = e.clientX - startX;

    // 阈值：超过10像素才算拖拽
    if (Math.abs(deltaX) > 10) {
      if (!isSignificantDrag) {
        isSignificantDrag = true;
        // 【生效】给 body 添加拖拽专属 CSS 类，改变鼠标指针
        document.body.classList.add('bili-tools-dragging');
      }

      const offsetTime = deltaX * SECONDS_PER_PIXEL;
      targetTime = startVideoTime + offsetTime;
      targetTime = Math.max(0, Math.min(targetTime, video.duration));

      showDragUI(offsetTime, targetTime, video.duration);
    }
  }, true);

  // 3. 鼠标松开 (绑定在 window 上，防止鼠标移出浏览器边界导致失效)
  window.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;

    // 【恢复】移除拖拽 CSS 类，恢复正常鼠标指针
    document.body.classList.remove('bili-tools-dragging');

    if (isSignificantDrag) {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = targetTime;
      }
      hideDragUI();
    }
  }, true);

  // 4. 拦截点击暂停
  document.body.addEventListener('click', (e) => {
    if (isSignificantDrag) {
      e.stopPropagation();
      e.preventDefault();
      setTimeout(() => { isSignificantDrag = false; }, 50);
    }
  }, true);

  gestureListenerBound = true;
  console.log('BiliTools: 手势滑动引擎已启动 (受设置控制)');
}

// ==========================================
// 菜单 UI 注入与监听逻辑
// ==========================================
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