DOMReady(() => {
	const base_url     = "https://psb4ukr.natocdn.net/mp3/";
	const playlist_url = base_url + "playlist.txt?utm_source=myrfm";

	const d            = document;
	const player       = d.getElementById('player');
	const playlist     = d.getElementById('playlist');
	const template     = d.getElementById('playlist-item');
	const error        = d.getElementById('error');

	const vol_slider   = player.querySelector('.amplitude-volume-slider');
	const vol_bar      = player.querySelector('.volume-bar');
	const vol_up       = player.querySelector('.amplitude-volume-up');
	const vol_down     = player.querySelector('.amplitude-volume-down');

	const shuffle_btn  = player.querySelector('.amplitude-shuffle');
	const repeat_btn   = player.querySelector('.amplitude-repeat');

	const progress_bar = player.querySelector('.progress-bar');
	const song_slider  = player.querySelector('.amplitude-song-slider')

	const btn_stop     = player.querySelector('.amplitude-stop');

	let storageAvailable = (type) => {
		try {
			let storage = window[type], x = '__storage_test__';
			storage.setItem(x, x);
			storage.removeItem(x);
			return true;
		}
		catch (e) {
			return false;
		}
	};

	const has_ls = storageAvailable('localStorage');

	let hide_err_timeout = null;
	let showError = (s) => {
		if (hide_err_timeout) {
			clearTimeout(hide_err_timeout);
			hide_err_timeout = null;
		}

		while (error.firstChild) {
			error.removeChild(error.firstChild);
		}

		error.insertAdjacentText('afterbegin', s);
		error.removeAttribute('hidden');
		error.scrollIntoViewIfNeeded();
	};

	let hideError = () => {
		if (hide_err_timeout) {
			clearTimeout(hide_err_timeout);
			hide_err_timeout = null;
		}

		error.setAttribute('hidden', '');
	};

	let respondToVolumeChange = () => {
		let val = parseInt(vol_slider.value, 10);
		if (val === 0) {
			vol_down.setAttribute('disabled', '');
			vol_up.removeAttribute('disabled');
		}
		else if (val === 100) {
			vol_up.setAttribute('disabled', '');
			vol_down.removeAttribute('disabled');
		}
		else {
			vol_down.removeAttribute('disabled');
			vol_up.removeAttribute('disabled');
		}

		vol_bar.style.backgroundSize = val + '% 100%';
		vol_bar.setAttribute('title', `Гучність: ${val}%`);

		if (has_ls) {
			localStorage.setItem('volume', val);
		}
	};

	let timeProgressUpdateHandler = () => {
		let progress1 = Amplitude.getSongPlayedPercentage();
		let progress2 = Amplitude.getBuffered();
		progress_bar.style.backgroundSize = progress1 + '% 100%, ' + progress2 + '% 100%';;
	};

	let updateSelection = () => {
		let song   = Amplitude.getActiveSongMetadata();
		let idx    = song.songid;
		let active = d.querySelector('li[class="active"]');
		if (active) {
			active.classList.remove('active');
		}

		let listitem = d.querySelector('li[data-index="' + idx + '"]');
		listitem.classList.add('active');
		listitem.scrollIntoViewIfNeeded();
	};

	let songChangeHandler = () => {
		const meta     = Amplitude.getActiveSongMetadata();
		const artist   = meta.artist || '';
		const name     = meta.name   || '';

		const title    = (artist ? `${artist} — ` : '') + name + ' — Myrotvorets.FM';
		document.title = title;
	};

	let playHandler = () => {
		btn_stop.removeAttribute('disabled');
		song_slider.removeAttribute('disabled');
		updateSelection();
		songChangeHandler();
	};

	let stopHandler = () => {
		btn_stop.setAttribute('disabled', '');
		song_slider.setAttribute('disabled', '');
	};

	playlist.addEventListener('click', (e) => {
		let el = e.target;
		while (el.tagName.toUpperCase() !== "LI") {
			el = el.parentElement;
		}

		let idx = el.getAttribute('data-index');
		Amplitude.playSongAtIndex(idx-1);
	});

	const xhr = new XMLHttpRequest();
	xhr.addEventListener('load', function() {
		if (this.status !== 200 || this.responseText === null) {
			showError('Під час завантаження списку відтворення сталася помилка. Будь-ласка, спробуйте пізніше.');
			return;
		}

		let t = this.responseText.replace(/^\ufeff/, '').replace(/\r/, '').split("\n");
		if (t.length) {
			let index = 0;
			let songs = [];
			const ul  = d.createElement('ul');
			const df  = d.createDocumentFragment();

			ul.insertAdjacentHTML('afterbegin', template.textContent);
			df.appendChild(ul.firstChild);

			t.forEach((line) => {
				let items = line.split("\t");
				if (items.length === 3) {
					++index;
					let song = {
						url:    base_url + items[2],
						name:   items[1],
						artist: items[0],
						songid: index
					};

					songs.push(song);

					let clone = df.cloneNode(true);
					clone.querySelector('li').setAttribute('data-index', index);
					clone.querySelector('.artist').appendChild(d.createTextNode(items[0]));
					clone.querySelector('.song').appendChild(d.createTextNode(items[1]));
					playlist.appendChild(clone);
				}
			});

			if (index) {
				let volume = 50, shuffle = true, repeat = false;
				if (has_ls) {
					volume  = localStorage.getItem('volume') || 50;
					shuffle = parseInt(localStorage.getItem('shuffle') || 1, 10);
					repeat  = parseInt(localStorage.getItem('repeat') || 0, 10);
				}

				Amplitude.init({
					"songs": songs,
					"volume": parseInt(volume, 10),
					"shuffle_on": !!shuffle,
					"preload": "none",
					"callbacks": {
						"play": playHandler,
						"ended": stopHandler,
						"stop": stopHandler,
						"volumechange": respondToVolumeChange,
						"timeupdate": timeProgressUpdateHandler,
						"progress": timeProgressUpdateHandler,
						"loadeddata": timeProgressUpdateHandler,
						"song_change": songChangeHandler,
						"error": () => {
							let err = Amplitude.getAudio().error.message;
							showError(`Сталася якась важка прикрість (${err}). Перевірте, будь ласка, чи працює Інтернет.`);
							hide_err_timeout = setTimeout(hideError, 10000);
						},
						"initialized": () => {
							if (has_ls) {
								shuffle_btn.addEventListener('click', (e) => localStorage.setItem('shuffle', Amplitude.getShuffle() ? 1 : 0));
								repeat_btn.addEventListener('click',  (e) => localStorage.setItem('repeat',  Amplitude.getRepeat()  ? 1 : 0));
							}
						}
					}
				});

				Amplitude.setRepeat(!!repeat);
				player.removeAttribute('hidden');
				playlist.removeAttribute('hidden');
				setTimeout(updateSelection, 100);
			}
			else {
				showError('Список відтворення порожній. Будь-ласка, спробуйте пізніше.');
			}
		}
	});

	xhr.open('GET', playlist_url);
	xhr.send();
});
