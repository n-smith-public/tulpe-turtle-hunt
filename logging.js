function logToServer(level, message) {
    fetch('/log', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ level, message })
    })
    .then(response => response.text())
    .then(data => {
        console.log('Message sent to server: ', data);
    })
    .catch(error => {
        console.error('Error sending message to server: ', error);
    });
}