DOMReady(() => {
	const base_url     = "https://psb4ukr.natocdn.net/mp3/";
	const playlist_url = base_url + "playlist.txt";

	const d            = document;
	const player       = d.getElementById('player');
	const playlist     = d.getElementById('playlist');
	const template     = d.getElementById('playlist-item');
	const error        = d.getElementById('error');

	const vol_slider   = player.querySelector('.amplitude-volume-slider');
	const vol_bar      = player.querySelector('.volume-bar');
	const vol_up       = player.querySelector('.amplitude-volume-up');
	const vol_down     = player.querySelector('.amplitude-volume-down');

	const progress_bar = player.querySelector('.progress-bar');
	const song_slider  = player.querySelector('.amplitude-song-slider')

	const btn_stop     = player.querySelector('.amplitude-stop');

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

	let playHandler = () => {
		btn_stop.removeAttribute('disabled');
		song_slider.removeAttribute('disabled');
		updateSelection();
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

	fetch(playlist_url).then((response) => {
		if (response.ok) {
			return response.text();
		}

		throw new Error('Під час завантаження списку відтворення сталася помилка. Будь-ласка, спробуйте пізніше.');
	}).then((t) => {
		t = t.replace(/^\ufeff/, '').replace(/\r/, '').split("\n");
		if (t.length) {
			let index    = 0;
			let songs    = [];
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

					let clone = d.importNode(template.content, true);
					clone.querySelector('li').setAttribute('data-index', index);
					clone.querySelector('.artist').appendChild(d.createTextNode(items[0]));
					clone.querySelector('.song').appendChild(d.createTextNode(items[1]));
					playlist.appendChild(clone);
				}
			});

			if (index) {
				Amplitude.init({
					"songs": songs,
					"shuffle_on": true,
					"preload": "none",
					"callbacks": {
						"play": playHandler,
						"ended": stopHandler,
						"stop": stopHandler,
						"volumechange": respondToVolumeChange,
						"timeupdate": timeProgressUpdateHandler,
						"progress": timeProgressUpdateHandler,
						"loadeddata": timeProgressUpdateHandler,
						"error": () => {
							let err = Amplitude.getAudio().error.message;
							showError(`Сталася якась важка прикрість (${err}). Перевірте, будь ласка, чи працює Інтернет.`);
							hide_err_timeout = setTimeout(hideError, 10000);
						}
					}
				});

				player.removeAttribute('hidden');
				playlist.removeAttribute('hidden');
				setTimeout(updateSelection, 100);
			}
			else {
				throw new Error('Список відтворення порожній. Будь-ласка, спробуйте пізніше.');
			}
		}
	}).catch((e) => showError(e.message));
});