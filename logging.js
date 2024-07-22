// Console logging
async function logToServer(level, message) {
    try {
        const response = await fetch('/consoleMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ level, message }),
        });

        if (response.ok) {
            //console.log('Log message sent successfully');
        } else {
            console.error('Failed to send log message');
        }
    } catch (error) {
        console.error('Error sending log message:', error);
    }
}


// Sound Effect Helper Functions
function successSFX() {
    const audio = new Audio('Media/submitComplete.wav');
    audio.play();
}

function warnSFX() {
    const audio = new Audio('Media/warning.wav');
    audio.play();
}

// Page transfer helper functions
function toDisclaimer() {
    window.location.href = '/';
}

function toSubmit() {
    window.location.href = '/submit';
}

function toAbout() {
    window.location.href = '/about';
}

function toDashboard() {
    window.location.href = '/queries';
}

function toDevlog() {
    window.location.href = '/log';
}