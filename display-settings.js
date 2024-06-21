function isMobileDevice() {
    const details = navigator.userAgent;
    const regexp = /android|iphone|kindle|ipad/i;
    return regexp.test(details);
}

// Function to adjust layout based on device type
function adjustLayoutForDevice() {
    if (isMobileDevice()) {
        // Apply mobile-specific styles
        document.querySelector('.titleForeground').style.display = 'none';
        document.querySelector('.titleForegroundSubmit').style.display = 'none';
        document.querySelector('.contentContainer').style.maxWidth = '90%';
        document.querySelector('.submission').style.maxWidth = '90%';
    } else {
        // Default styles for larger screens (desktop)
        document.querySelector('.titleForeground').style.display = 'block';
        document.querySelector('.titleForegroundSubmit').style.display = 'block';
        document.querySelector('.contentContainer').style.maxWidth = '80%';
        document.querySelector('.submission').style.maxWidth = '300px';
    }
}

// Execute the adjustLayoutForDevice function when the page loads
document.addEventListener('DOMContentLoaded', function() {
    adjustLayoutForDevice();

    // Optionally, you can also listen for window resize events to adjust layout dynamically
    window.addEventListener('resize', adjustLayoutForDevice);
});