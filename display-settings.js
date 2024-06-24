function isMobileDevice() {
    const details = navigator.userAgent;
    const regexp = /android|iphone|kindle|ipad/i;
    return regexp.test(details);
}