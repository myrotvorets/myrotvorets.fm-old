'use strict';

const gulp         = require('gulp');
const del          = require('del');
const rsync        = require('rsyncwrapper');
const rename       = require('gulp-rename');
const sourcemaps   = require('gulp-sourcemaps');
const sass         = require('gulp-sass');
const postcss      = require('gulp-postcss');
const cssnano      = require('cssnano')
const autoprefixer = require('autoprefixer')
const uglify       = require('gulp-uglify-es').default;
const htmlmin      = require('gulp-htmlmin');
const imagemin     = require('gulp-imagemin');
const rev          = require('gulp-rev');
const collect      = require('gulp-rev-collector');
const revdel       = require('gulp-rev-delete-original');
const srizer       = require('gulp-srizer');
const wbbuild      = require('workbox-build');
const critical     = require('critical').stream;
const replace      = require('gulp-replace');
const gitrev       = require('git-rev');
const touch        = require('gulp-touch-fd');
const useref       = require('gulp-useref');
const gulpif       = require('gulp-if');
const hashmap      = require('inline-csp-hash');

const config       = require('./.internal/config.json');

gulp.task('scss', () => {
	const src  = ['dev/scss/all.scss'];
	const dest = 'dev/css';

	return gulp.src(src)
		.pipe(sass({ errLogToConsole: true, outputStyle: 'expanded', precision: 5 }))
		.pipe(gulp.dest(dest))
	;
});

gulp.task('styles', gulp.series(['scss', () => {
	const src  = ['dev/css/all.css'];
	const dest = 'dist/css';

	return gulp.src(src)
		.pipe(sourcemaps.init())
		.pipe(rename("combined.min.css"))
		.pipe(postcss([
			autoprefixer({browsers: '> 5%'}),
			cssnano({
				preset: ['default', {
					discardComments: {
						removeAll: true,
					},
				}]
			})
		]))
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest(dest))
	;
}]));

gulp.task('html', () => {
	const src  = 'dev/index.html';
	const dest = 'dist';

	return gulp.src(src)
		.pipe(replace(/<!-- DEV -->.*?<!-- ENDDEV -->(\n)?/s, ''))
		.pipe(replace('<!-- DEV\n', ''))
		.pipe(replace('\nENDDEV -->\n', ''))
		.pipe(useref())
		.pipe(gulpif('*.html', htmlmin({
			removeComments: true,
			collapseWhitespace: true,
			caseSensitive: true,
			decodeEntities: true,
			keepClosingSlash: true,
			collapseBooleanAttributes: false,
			removeAttributeQuotes: false,
			removeRedundantAttributes: true,
			removeEmptyAttributes: true,
			removeScriptTypeAttributes: true,
			removeStyleLinkTypeAttributes: true,
			removeOptionalTags: false,
			minifyJS: true,
			minifyCSS: true
		})))
		.pipe(gulp.dest(dest))
	;
});


gulp.task('scripts', gulp.series(['html', () => {
	const src  = ['dist/js/combined.min.js'];
	const dest = 'dist/js';

	return gulp.src(src)
		.pipe(sourcemaps.init())
		.pipe(uglify())
		.pipe(rename('combined.min.js'))
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest(dest))
	;
}]));

gulp.task('images', () => {
	const src  = 'dev/img/*';
	const dest = 'dist/img';

	return gulp.src(src)
		.pipe(
			imagemin([
				imagemin.gifsicle({ interlaced: true }),
				imagemin.jpegtran({ progressive: true }),
				imagemin.optipng({ optimizationLevel: 7 }),
				imagemin.svgo({
					plugins: [
						{ collapseGroups: false },
						{ cleanupIDs: false }
					]
				})
			])
		)
		.pipe(gulp.dest(dest))
	;
});

gulp.task('critical', gulp.series(['styles',
	() => {
		const src  = ['dist/index.html'];
		const dest = 'dist';
		return gulp.src(src)
			.pipe(critical({
				base: 'dist/',
				inline: true,
				minify: true,
				extract: !true,
				dimensions: [
					{ height: 1000, width: 383 },
					{ height: 1000, width: 384 },
					{ height: 1000, width: 576 },
					{ height: 1000, width: 768 },
					{ height: 1000, width: 769 }
				],
				target: { uncritical: 'css/noncritical.min.css' }
			}))
			.pipe(replace('</style>\n', '</style>'))
			.pipe(replace(/<\/noscript>\n<script>.*<\/script><link/, '</noscript><link'))
			.pipe(replace('combined.min.css', 'noncritical.min.css'))
			.pipe(gulp.dest(dest))
		;
	},
	(done) => {
		del('dist/css/combined.min.css');
		done();
	}
]));

gulp.task('inline-hash', () => {
	return gulp.src('dist/*.html')
		.pipe(hashmap({
			what: 'script',
			replace_cb: (s, hashes) => {
				let fragment = hashes.join(" ");
				return s.replace(/script-src 'self'[^;]*/, "script-src 'self' " + fragment);
			}
		}))
		.pipe(hashmap({
			what: 'style',
			replace_cb: (s, hashes) => {
				let fragment = hashes.join(" ");
				return s.replace(/style-src 'self'[^;]*/, "style-src 'self' " + fragment);
			}
		}))
		.pipe(gulp.dest('dist/'))
	;
});

gulp.task('copy', () => {
	const src  = ['dev/manifest.json'];
	const dest = 'dist';

	return gulp.src(src).pipe(gulp.dest(dest));
});

gulp.task('revision:rename', () => {
	const src  = ['dist/css/noncritical.min.css', 'dist/js/combined.min.js'];
	const dest = 'dist';
	return gulp.src(src, { base: 'dist' })
		.pipe(rev())
		.pipe(revdel())
		.pipe(gulp.dest(dest))
		.pipe(rev.manifest({ path: 'rev-manifest.json' }))
		.pipe(gulp.dest(dest))
	;
});

gulp.task('revision:updateRef', gulp.series('revision:rename', () => {
	const src  = ['dist/rev-manifest.json', 'dist/index.html'];
	const dest = 'dist';
	return gulp.src(src, { base: 'public' })
		.pipe(collect())
		.pipe(gulp.dest(dest))
		.pipe(touch())
	;
}));

gulp.task('sri', gulp.series('revision:updateRef', () => {
	const src  = ['dist/index.html'];
	const dest = 'dist';

	return gulp.src(src)
		.pipe(srizer({ fileExt: '{css,js}' }))
		.pipe(gulp.dest(dest))
		.pipe(touch())
	;
}));

gulp.task('gitrev', (done) => {
	gitrev.short(function(r) {
		gulp.src('dist/index.html')
			.pipe(replace('{{ revision }}', r))
			.pipe(gulp.dest('dist'))
			.pipe(touch())
		;
		done();
	});
});

gulp.task('bundle-sw', gulp.series([
	(done) => {
		del(['dist/js/combined.js'])
		done();
	},
	() => {
		return wbbuild.generateSW({
			globDirectory:  './dist/',
			swDest:         './dist/sw.js',
			globPatterns:   ['**\/*.{html,js,css,png,gif}'],
			globIgnores:    ['js/combined.js'],
			dontCacheBustUrlsMatching: /-[a-f0-9]{10}\./,
			skipWaiting: true,
			clientsClaim: true,
			runtimeCaching: [
				{
					urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\//,
					handler: 'cacheFirst',
					options: {
						cacheName: 'cdn-cache',
						expiration: {
							maxEntries: 100
						},
						cacheableResponse: {
							statuses: [0, 200]
						}
					}
				},
				{
					urlPattern: /^https:\/\/psb4ukr\.natocdn\.net\/mp3\/playlist\.txt/,
					handler: 'staleWhileRevalidate',
					options: {
						cacheName: 'playlist-cache',
						expiration: {
							maxAgeSeconds: 900
						},
						cacheableResponse: {
							statuses: [0, 200]
						}
					}
				}
			]
		});
	},
	() => {
		return gulp.src(['dist/sw.js'])
			.pipe(uglify())
			.pipe(gulp.dest('dist'))
		;
	}
]));

gulp.task('deploy', function(done) {
	rsync({
		exclude: ['/.internal/', '/.settings/', '/.tmp/', '/node_modules/', '/.project', '/.git/'],
		args: ['-avHz', '--password-file=.internal/password', '--ignore-times'],
		src: './dist/',
		dest: config.deploy_target,
		delete: !true
	}, function (error,stdout,stderr,cmd) {
		//console.log(cmd);
		console.log(stdout);
		console.log(stderr);
		done();
	});
});

gulp.task('deploy:dev', function(done) {
	rsync({
		exclude: ['/.internal/', '/.settings/', '/.tmp/', '/node_modules/', '/.project', '/.git/'],
		args: ['-avHz', '--password-file=.internal/password', '--ignore-times'],
		src: './dist/',
		dest: config.dev_deploy_target,
		delete: false
	}, function (error,stdout,stderr,cmd) {
		//console.log(cmd);
		console.log(stdout);
		console.log(stderr);
		done();
	});
});

gulp.task('download', function(done) {
	rsync({
		exclude: ['/.internal/', '/.settings/', '/.tmp/', '/node_modules/', '/.project', '/.git/'],
		args: ['-aHz', '--password-file=.internal/password'],
		dest: './dist/',
		src: config.deploy_target,
		dryRun: true,
		delete: true
	}, function (error,stdout,stderr,cmd) {
		//console.log(cmd);
		console.log(stdout);
		console.log(stderr);
		done();
	});
});

gulp.task('default', gulp.series([gulp.parallel(['scripts', 'images']), 'critical', 'inline-hash', 'sri', 'gitrev', 'bundle-sw', 'copy']));
