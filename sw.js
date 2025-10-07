// This code runs in the background
const scheduledAlarms = new Map();

self.addEventListener('message', (event) => {
    const { type, task } = event.data;
    if (type === 'SCHEDULE_ALARM') {
        const now = Date.now();
        const timeToAlarm = new Date(task.dateTime).getTime() - now;

        if (timeToAlarm > 0) {
            const timerId = setTimeout(() => {
                self.registration.showNotification('My Planner Reminder', {
                    body: task.text,
                    icon: 'https://placehold.co/192x192/4f46e5/ffffff?text=P',
                    vibrate: [200, 100, 200], // Vibrate pattern
                    data: { sound: task.sound },
                    tag: task.id // Use a tag to prevent duplicate notifications
                });

                // Send a message back to the main page to play the sound
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({ type: 'PLAY_SOUND', sound: task.sound });
                    });
                });

                scheduledAlarms.delete(task.id);
            }, timeToAlarm);
            scheduledAlarms.set(task.id, timerId);
        }
    } else if (type === 'CANCEL_ALARM') {
        if(scheduledAlarms.has(task.id)) {
            clearTimeout(scheduledAlarms.get(task.id));
            scheduledAlarms.delete(task.id);
        }
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    // Focus the app window if it's open, otherwise open a new one.
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url === self.registration.scope && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(self.registration.scope);
            }
        })
    );
});

self.addEventListener('install', (event) => {
    self.skipWaiting();
});
