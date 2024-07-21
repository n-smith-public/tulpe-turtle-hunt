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
            console.log('Log message sent successfully');
        } else {
            console.error('Failed to send log message');
        }
    } catch (error) {
        console.error('Error sending log message:', error);
    }
}