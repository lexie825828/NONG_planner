// Keep this tiny bootstrap ES5-compatible so Android can report module load errors.
(function () {
  function report(message) {
    if (window.NongAndroid && typeof window.NongAndroid.reportError === 'function') {
      window.NongAndroid.reportError(String(message).slice(0, 1800));
    }
  }
  window.addEventListener('error', function (event) {
    var target = event.target;
    if (target && target !== window) report('资源加载失败: ' + (target.src || target.href || target.tagName));
    else report('脚本错误: ' + event.message + ' @ ' + (event.filename || '') + ':' + (event.lineno || ''));
  }, true);
  window.addEventListener('unhandledrejection', function (event) {
    report('启动异常: ' + String(event.reason && event.reason.message || event.reason || 'unknown'));
  });
})();
