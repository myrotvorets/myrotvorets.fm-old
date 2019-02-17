if ('serviceWorker' in navigator && !/^(127|192\.168|10)\./.test(location.hostname)) {
	navigator.serviceWorker.register('sw.js').then((reg) => {
		reg.onupdatefound = () => {
			const installingWorker = reg.installing;
			installingWorker.onstatechange = () => {
				if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
					reg.update();
				}
			};
		};
	});
}
