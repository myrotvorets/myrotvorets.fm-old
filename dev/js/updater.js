DOMReady(() => {
	document.getElementById('update-app').addEventListener('click', () => {
		caches.keys().then(keyList => Promise.all(keyList.map(key => caches.delete(key)))).then(() => {
			if ('serviceWorker' in navigator) {
				navigator.serviceWorker.getRegistration().then((reg) => {
					if (reg) {
						reg.unregister().then(() => location.reload(true));
					}
					else {
						location.reload(true);
					}
				});
			}
			else {
				location.reload(true);
			}
		});
	});
});